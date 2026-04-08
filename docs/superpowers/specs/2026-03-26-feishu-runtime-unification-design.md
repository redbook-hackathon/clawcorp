# Feishu Runtime Unification Design

## Goal

Fix the Feishu channel sync regression by making desktop channel conversations and Feishu mobile conversations flow through the same agent runtime session.

After this change:

1. Sending a message from the `Channels` page must trigger the agent to respond.
2. The reply must appear in both ClawCorp and Feishu.
3. Messages sent from Feishu mobile must update the `Channels` conversation pane, not only the global sidebar.
4. Sidebar, `Channels`, and Feishu must reflect the same conversation history instead of separate partial views.

## Problem Statement

The current implementation has two different sources of truth.

- The global sidebar and main chat experience are driven by runtime and Gateway session history.
- The `Channels` page for Feishu is driven by a Feishu plugin snapshot and sends outbound messages through a direct Feishu bridge.

This split causes two visible failures:

1. A message typed in the `Channels` page can be delivered to Feishu, but it does not enter the bound agent runtime session, so the model does not continue the conversation there.
2. A message sent from Feishu mobile can update the broader runtime/sidebar state without updating the `Channels` message pane, because the page is reading a different transcript source.

## Product Decision

`Channels` remains a channel-facing workbench, but it must become a view over runtime-backed channel conversations instead of maintaining an independent Feishu-only transcript.

Feishu transport still matters for:

- discovering synchronized external conversations
- mapping external conversation identity
- delivering visible outbound replies back to Feishu

But the visible conversation history in the app must be runtime-backed once a conversation is bound.

## Scope

### In scope

- Unify Feishu conversation history with agent runtime session history.
- Ensure desktop sends from `Channels` enter the same runtime session used by Feishu inbound messages.
- Ensure Feishu inbound messages refresh the `Channels` message pane and sidebar consistently.
- Preserve the existing `Channels` page shell as much as possible.

### Out of scope

- Generalizing the same fix to every channel family in this iteration.
- Redesigning the Feishu onboarding wizard.
- Changing visible speaking policy beyond what is required to restore correct end-to-end sync.
- Large i18n cleanup unrelated to this bugfix.

## Required Behavior

### 1. Single conversation authority

For a Feishu conversation, there must be one authoritative bound runtime session.

The binding key is conceptually:

- `channelType`
- `accountId`
- `externalConversationId`

The bound target is:

- `agentId`
- `sessionKey`

Once a binding exists, both desktop-originated and Feishu-originated messages must append to that same session.

### 2. Desktop send behavior

When the user sends a message from the `Channels` page for a bound Feishu conversation:

1. The message is treated as a user message in the bound runtime session.
2. The runtime executes the normal agent reply flow.
3. The agent reply is delivered back to Feishu through the existing channel transport.
4. The `Channels` pane and sidebar both update from the same runtime history.

The desktop page must not treat a direct Feishu transport write as the primary send path for a bound conversation.

### 3. Feishu inbound behavior

When a user sends a message from Feishu mobile:

1. The message must be associated with the correct external conversation binding.
2. It must be persisted into the bound runtime session.
3. The sidebar and the `Channels` page must both refresh against that same session.

It is not acceptable for only the sidebar to update while the `Channels` pane stays stale.

### 4. Visible history consistency

For a bound Feishu conversation, the app should show one logical transcript:

- human messages from Feishu
- agent replies
- compact tool visibility where already supported

The transcript shown in the `Channels` pane must not diverge from the transcript implied by the runtime session shown elsewhere in the app.

## Architecture

## A. Conversation binding layer

Introduce or reuse a backend-owned binding record that maps an external Feishu conversation to a runtime session.

Minimum fields:

- `channelType`
- `accountId`
- `externalConversationId`
- `agentId`
- `sessionKey`
- `lastSyncedAt`

Responsibilities:

- resolve which runtime session a Feishu thread belongs to
- create the binding when the first valid inbound message appears and no binding exists yet
- return the binding for both desktop send and inbound sync refresh

## B. Runtime-first transcript loading

The `Channels` page may still use Feishu-derived session discovery for the conversation list if needed, but message loading for a bound conversation must be runtime-backed.

That means:

- session list metadata can still come from channel sync discovery
- message detail for a bound Feishu conversation must be loaded from the bound runtime session history
- Feishu-only snapshot loading may remain only as a fallback for unbound or pre-runtime conversations

## C. Send path unification

The current direct Feishu send branch for `conversationId.startsWith('feishu:')` should no longer be the primary path for an active bound conversation.

Instead:

1. resolve binding
2. append/send the user message into the runtime session
3. let the existing runtime/channel delivery path produce the outward Feishu-visible reply

Direct Feishu transport send may remain only for narrow fallback or diagnostic cases, not for the normal workbench conversation flow.

## D. Refresh model

The `Channels` page cannot rely only on periodic polling of a separate snapshot source.

It should refresh when:

- the selected conversation changes
- relevant runtime or gateway notifications arrive
- a send completes
- a Feishu inbound message lands in the bound session

Polling can remain as a safety net, but event-driven refresh should become the main freshness path.

## Data Flow

### Desktop to runtime to Feishu

1. User types in `Channels`.
2. Backend resolves the Feishu conversation binding.
3. Backend forwards the message into the bound runtime session.
4. Agent runtime processes the message.
5. Normal outbound channel delivery sends the visible reply to Feishu.
6. Runtime history refresh updates both sidebar and `Channels`.

### Feishu to runtime to UI

1. User sends a message in Feishu.
2. Feishu integration resolves the conversation binding.
3. Backend appends the inbound message to the bound runtime session.
4. Agent runtime continues processing as usual.
5. UI refresh signals update sidebar and `Channels` from the same session history.

## Error Handling

### Missing binding

If a Feishu conversation has no binding yet:

- backend should try to create one using the current channel owner / visible agent rules
- if binding creation fails, return a clear backend error and keep the conversation readable but not falsely interactive

### Stale or invalid binding

If a binding points to a missing runtime session:

- backend should attempt controlled recovery by recreating or reattaching the session
- if recovery is not possible, mark the conversation as needing resync instead of silently falling back to a different transcript

### Send failure

If runtime send fails:

- do not append a fake successful local agent message
- preserve the draft
- show a visible send error near the composer

## Testing Strategy

Add regression coverage for the exact failures reported by the user.

### Backend tests

- resolving a bound Feishu conversation returns runtime-backed message history
- desktop send for a bound Feishu conversation goes through runtime session dispatch instead of direct Feishu-only transport
- Feishu inbound message updates the same bound session used by desktop send

### Frontend tests

- `Channels` message pane refreshes when the selected Feishu conversation receives new runtime-backed messages
- sidebar and `Channels` remain consistent after Feishu inbound activity
- failed send keeps the draft and does not append a fake successful transcript entry

### Manual verification

1. Open a bound Feishu conversation in `Channels`.
2. Send `你好` from ClawCorp desktop.
3. Confirm the agent replies.
4. Confirm the reply appears in Feishu and in the same `Channels` thread.
5. Send a message from Feishu mobile.
6. Confirm both sidebar and `Channels` update to the same conversation transcript.

## Acceptance Criteria

The fix is complete only if all statements are true:

1. Sending from `Channels` causes the model to respond.
2. That response appears in Feishu and ClawCorp.
3. Feishu mobile inbound messages update both the sidebar and the `Channels` conversation pane.
4. `Channels` and sidebar no longer show diverging histories for the same Feishu thread.

## Summary

The root cause is not a simple refresh bug. It is a split architecture where Feishu workbench history and runtime history are treated as separate truths.

The fix is to make Feishu workbench conversations runtime-bound, with Feishu transport acting as the external delivery layer rather than a separate message authority.
