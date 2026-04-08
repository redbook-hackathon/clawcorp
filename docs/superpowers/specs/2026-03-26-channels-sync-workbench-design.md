# Channels Sync Workbench Design

## Goal

Reframe `Channels` from a configuration-centric page into a real-time external conversation workbench.
The first full implementation target is `Feishu / Lark`, with the same shell reused later for DingTalk, WeCom, and QQ.

The page should prioritize live synchronized conversations, keep configuration controls available but secondary, and reduce visible noise to only the information that helps a human operate ongoing conversations.

## Product Direction

`Channels` is no longer treated as a "channel details" page.
It becomes an "external conversation sync workbench".

Core user goals:

1. See synchronized external conversations in one place.
2. Read ongoing human and agent replies in a chat-native format.
3. Send messages back into the external channel from the app.
4. Keep channel configuration accessible without taking over the page.

## Scope

### In scope

- Restructure `Channels` into a unified chat-first shell.
- Implement the full shell for `Feishu / Lark`.
- Support synchronized session lists containing both:
  - group chats
  - one-to-one bot conversations
- Keep configuration actions available in a settings drawer or overlay.
- Show user-facing conversation content with lightweight tool visibility.
- Define explicit speaking rules for humans, the main brain, and other agents.

### Out of scope for this iteration

- Full parity for non-Feishu channels.
- Multi-agent simultaneous visible speaking in the same external thread.
- Exposing raw sync/system transport logs in the main chat stream.
- Rebuilding channel onboarding from scratch.

## Information Architecture

The page uses a unified four-region layout.

### 1. Far-left narrow rail

Purpose: workspace-level navigation and channel family switching.

Content:

- channel family icons, such as `Feishu`, `DingTalk`, `WeCom`, `QQ`
- existing app navigation affordances that already belong in the global shell

Behavior:

- selecting a family changes the synchronized conversation list and the active conversation source
- the first full implementation is Feishu, but the rail structure must already be reusable

### 2. Conversation list column

Purpose: show synchronized external conversations for the currently selected channel family.

For Feishu, this becomes a unified session list that mixes:

- group chats
- one-to-one bot conversations

Each row should include:

- conversation title
- small type badge: `群聊` or `私聊`
- lightweight sync state indicator
- recent activity context when available
- pinned state when applicable

Sorting rules:

1. pinned conversations first
2. all other conversations sorted by latest activity descending

The list must not split into separate tabs for group vs private conversation.
The distinction is carried by badges only.

### 3. Main conversation pane

Purpose: behave like a real synchronized chat client rather than a configuration detail panel.

Content:

- conversation header
- sync state badge
- participant summary
- live message stream
- composer

Displayed message types:

- real human messages from the external conversation
- ClawCorp or agent replies that are intentionally visible to the external conversation
- lightweight tool cards

Hidden message types:

- sync transport noise
- system-injected internal status messages
- redundant runtime metadata
- configuration/schema readouts
- noisy internal prompts not useful to the operator

Tool cards remain visible, but in compact form only.
They should show the minimum meaningful surface, for example:

- tool name
- duration
- high-level result label

They should not dump raw internal payloads by default in the main conversation stream.

### 4. Settings drawer

Purpose: keep configuration accessible without replacing the chat-first layout.

The drawer should hold channel-level controls such as:

- connect
- disconnect
- send test
- delete
- App ID / App Secret
- runtime capability summary
- sync policy controls relevant to this channel

This keeps configuration subordinate to the live conversation experience.

## Feishu-First Interaction Model

Feishu is the first complete implementation and defines the baseline model for later channels.

The Feishu workbench should feel like an operator-facing synchronized inbox:

- select a synchronized conversation from the list
- read the external conversation and ClawCorp responses in a unified stream
- send a new message from the composer
- open settings when needed, without losing conversation context

The page should default into the most recently active synchronized Feishu conversation.

## Speaking and Routing Rules

This is the highest-risk behavioral area and must be explicit.

### Human identity

In external conversations, the human remains the human.
The app must not rewrite the human's role or make the human appear as ClawCorp.

### Visible speaking rule

Only an explicitly addressed agent should speak back into the external conversation.

Rules:

1. If a human message explicitly `@` mentions an agent, that agent becomes the visible responder for that request.
2. If no agent is mentioned, no agent should proactively reply.
3. Agents that were not explicitly addressed must not insert themselves into the external conversation.

### Dispatch authority

Only:

- the human
- the main brain

may dispatch other agents for background work.

### Background collaboration

Background collaboration is allowed, but background agents must not directly appear in the external conversation stream unless they were the explicitly addressed visible responder.

This preserves a clean external conversation:

- one visible responder at a time
- no unprompted agent chatter
- internal coordination stays internal

## Agent Reply Lifecycle

When an agent is explicitly mentioned and begins work, the external conversation should use a two-step visible reply model.

### Step 1: acknowledgement

The addressed agent sends a short acknowledgement, for example:

- received
- understood
- processing

This should be lightweight and immediate.

### Step 2: completion report

After work finishes, the same addressed agent sends the final result or summary back into the external conversation.

This creates a clean and predictable pattern:

1. user calls an agent
2. agent acknowledges
3. agent completes and reports

No other agent should visibly interrupt this sequence unless explicitly mentioned by the human in a later message.

## Conversation List Data Model

The list should conceptually represent synchronized external sessions rather than channel config entries.

Feishu session row fields should include:

- session id
- session type: group or private
- title
- source platform
- pinned
- sync state
- latest activity timestamp
- preview text
- participant summary
- assigned/default visible agent, if any

This differs from the current implementation, which treats the middle column more like a list of configured channel accounts.

## Visual Design Rules

The target look is the design-board direction already approved:

- cleaner chat-native composition
- less "settings page" density
- obvious conversation hierarchy
- restrained badges and indicators
- most of the page width dedicated to the message stream

Important visual rules:

- configuration metadata should not dominate the main pane
- conversation rows should feel like inbox items, not config cards
- the selected conversation should be visually obvious
- tool cards should be compact and secondary to messages
- status indicators should be small and unobtrusive

## Error Handling

The page should still communicate failures, but in a focused way.

Examples:

- disconnected channel: shown in header badge and settings drawer
- sync error: shown as a compact inline banner or state row, not as repeated system messages
- failed send: shown as localized send feedback near the composer or message state

Internal sync diagnostics should stay out of the main conversation stream unless they are explicitly surfaced through the settings drawer or a debug-specific interface.

## Implementation Constraints

The design must follow existing repository rules:

- renderer must use host-api/api-client abstractions
- no direct backend fetches outside the approved host path
- existing channel onboarding foundations should be reused
- Feishu-specific behavior should be built in a way that later channels can adopt the same shell

## Testing Strategy

The first implementation should add tests that protect the new shell and message policy.

Key coverage areas:

- conversation-list rendering for mixed `群聊 / 私聊`
- pinned-first ordering then latest-activity ordering
- main pane renders human messages, addressed agent messages, and compact tool cards
- hidden internal/system sync messages do not render in the visible stream
- settings drawer exposes configuration actions without replacing the main pane
- speaking rules:
  - addressed agent replies
  - non-addressed agents do not proactively reply
  - two-step acknowledgement and completion behavior

## Recommended Rollout

### Phase 1

- replace the current Feishu detail view with the chat-first shell
- keep data mocked or adapted if needed, but match the final UI structure

### Phase 2

- wire Feishu live synchronized conversations into the new shell
- enforce visible speaking rules

### Phase 3

- migrate other channels onto the same shell progressively

## Summary

This design changes `Channels` from a configuration panel into an operator-facing synchronized conversation workspace.
The approved behavioral model is intentionally strict:

- explicit mention controls visible speaking
- background coordination remains internal
- the visible stream stays clean
- configuration is secondary

Feishu is the first full target, but the shell must be reusable for all external conversation channels.
