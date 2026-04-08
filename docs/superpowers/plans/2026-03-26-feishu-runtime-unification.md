# Feishu Runtime Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Feishu conversations in `Channels`, the sidebar/runtime session history, and Feishu mobile all use the same bound agent runtime session so desktop sends trigger model replies and inbound Feishu messages update the same transcript everywhere.

**Architecture:** Keep Feishu session discovery in [electron/api/routes/channels.ts](C:/Users/22688/Desktop/ClawX-main/electron/api/routes/channels.ts), but move bound-conversation message loading and send behavior onto runtime-backed session history. Add a small backend binding persistence layer that maps `feishu:<accountId>:<chatId>` to an agent/runtime `sessionKey`, then update the `Channels` page to read/send against that binding and refresh from runtime/gateway events instead of a separate Feishu-only transcript.

**Tech Stack:** Electron, TypeScript, React 19, host-api routes, Gateway RPC (`chat.send` / `chat.history` / `sessions.list`), Vitest

---

## File Structure

**Create**

- `electron/services/channel-conversation-bindings.ts`
  Responsibility: persist and resolve external-conversation-to-runtime bindings for Feishu conversations.
- `tests/unit/channel-conversation-bindings.test.ts`
  Responsibility: lock binding creation, lookup, persistence, and stale-session handling.

**Modify**

- `electron/api/routes/channels.ts`
  Responsibility: keep Feishu session discovery, but load message detail from bound runtime sessions and route desktop send into runtime instead of direct Feishu-only transport for bound conversations.
- `src/pages/Channels/index.tsx`
  Responsibility: stop treating Feishu snapshot messages as the primary transcript, stop appending fake local agent messages, and refresh from runtime-backed message loads plus host events.
- `tests/unit/channel-sync-routes.test.ts`
  Responsibility: verify workbench sessions/messages/send now use binding-aware runtime behavior.
- `tests/unit/channels-page.test.tsx`
  Responsibility: verify the UI reflects runtime-backed updates and preserves the draft on failure without fake successful replies.
- `README.md`
- `README.zh-CN.md`
  Responsibility: review whether the channel-sync behavior description needs updating after the architecture change.

## Chunk 1: Bind Feishu Conversations to Runtime Sessions

### Task 1: Add the failing binding persistence tests

**Files:**
- Create: `tests/unit/channel-conversation-bindings.test.ts`
- Create: `electron/services/channel-conversation-bindings.ts`

- [ ] **Step 1: Write the failing test**

Add tests that require:

- creating a binding for `channelType/accountId/externalConversationId`
- returning the same binding on repeated lookup
- persisting `agentId` and `sessionKey`
- replacing a stale binding when the stored session key is no longer valid

Example test shape:

```ts
it('persists and resolves a feishu conversation binding', async () => {
  const store = createChannelConversationBindingStore(tempFilePath);

  await store.upsert({
    channelType: 'feishu',
    accountId: 'default',
    externalConversationId: 'oc_123',
    agentId: 'main',
    sessionKey: 'agent:main:main',
  });

  await expect(
    store.get('feishu', 'default', 'oc_123'),
  ).resolves.toEqual(expect.objectContaining({
    agentId: 'main',
    sessionKey: 'agent:main:main',
  }));
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channel-conversation-bindings.test.ts`
Expected: FAIL because the binding service does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a small JSON-backed store in `electron/services/channel-conversation-bindings.ts` using app data storage, with methods for:

- `get(channelType, accountId, externalConversationId)`
- `upsert(record)`
- `deleteByChannel(channelType, accountId?)`

Keep the file format minimal and backend-owned. Do not mix it into `openclaw.json`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/channel-conversation-bindings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/channel-conversation-bindings.test.ts electron/services/channel-conversation-bindings.ts
git commit -m "feat: persist feishu conversation runtime bindings"
```

### Task 2: Bind discovered Feishu sessions to runtime session keys

**Files:**
- Modify: `electron/api/routes/channels.ts`
- Modify: `tests/unit/channel-sync-routes.test.ts`
- Modify: `tests/unit/channel-conversation-bindings.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the route tests so `/api/channels/workbench/messages?conversationId=...` requires:

- bound Feishu conversations to return runtime-backed messages
- `conversation` payload to expose the resolved `visibleAgentId`
- unbound conversations to remain readable through the existing fallback metadata path

Example assertion:

```ts
expect(mocks.gatewayRpc).toHaveBeenCalledWith('chat.history', {
  sessionKey: 'agent:main:main',
  limit: 200,
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
Expected: FAIL because the route still reads Feishu snapshot messages directly.

- [ ] **Step 3: Write minimal implementation**

In `electron/api/routes/channels.ts`:

- keep `fetchFeishuWorkbenchSnapshot()` for session discovery
- resolve or create a runtime binding for each Feishu conversation
- load bound message detail via `ctx.gatewayManager.rpc('chat.history', { sessionKey, limit: 200 })`
- map runtime history into the existing `ChannelSyncMessage` view model

Use the existing agent/channel ownership helpers to default a new binding to the correct agent.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/api/routes/channels.ts tests/unit/channel-sync-routes.test.ts tests/unit/channel-conversation-bindings.test.ts
git commit -m "feat: bind feishu workbench sessions to runtime history"
```

## Chunk 2: Unify Desktop Send with Runtime Execution

### Task 3: Prove the current send route is wrong

**Files:**
- Modify: `tests/unit/channel-sync-routes.test.ts`
- Modify: `electron/api/routes/channels.ts`

- [ ] **Step 1: Write the failing test**

Add a route test for `POST /api/channels/:id/send` in the Feishu bound-conversation case that requires:

- the request to go through runtime `chat.send`
- the resolved `sessionKey` to be used
- direct `sendMessageFeishu()` not to be the primary path for a bound conversation

Example expectation:

```ts
expect(gatewayRpcMock).toHaveBeenCalledWith('chat.send', expect.objectContaining({
  sessionKey: 'agent:main:main',
  message: '你好',
  deliver: false,
}));
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
Expected: FAIL because the Feishu branch still short-circuits to direct transport send.

- [ ] **Step 3: Write minimal implementation**

Change the send route so:

- if the Feishu conversation is bound, the message enters the bound runtime session via `chat.send`
- if the conversation is not yet bound, resolve/create the binding first, then send to runtime
- direct Feishu transport send remains only for explicit fallback cases, not the normal bound-conversation path

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/api/routes/channels.ts tests/unit/channel-sync-routes.test.ts
git commit -m "feat: route feishu workbench sends through runtime sessions"
```

### Task 4: Stop the page from showing fake local success

**Files:**
- Modify: `tests/unit/channels-page.test.tsx`
- Modify: `src/pages/Channels/index.tsx`

- [ ] **Step 1: Write the failing test**

Add UI coverage that requires:

- the send path to call the same `/api/channels/:id/send` route with `conversationId`
- the page not to append a fake local `agent` message immediately after send
- the draft to clear only on send success
- the draft to remain when the send request fails

Example assertion:

```ts
expect(screen.queryByText('local-ack-placeholder')).not.toBeInTheDocument();
expect(input).toHaveValue('');
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL because `handleSend` currently appends a fake local agent message.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/Channels/index.tsx`:

- remove the optimistic fake agent append
- keep the composer state minimal
- reload the selected conversation from the backend after a successful send

Do not invent a separate local transcript layer.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "fix: remove fake local replies from channels workbench"
```

## Chunk 3: Make Inbound Feishu Activity Refresh the Same Transcript Everywhere

### Task 5: Refresh the `Channels` pane from runtime-backed updates

**Files:**
- Modify: `src/pages/Channels/index.tsx`
- Modify: `tests/unit/channels-page.test.tsx`
- Modify: `src/lib/host-events.ts` only if a stronger typed event hook is needed

- [ ] **Step 1: Write the failing test**

Add UI tests that simulate a second backend message load after inbound activity and require:

- the selected Feishu conversation pane to refresh
- sidebar/workbench session selection not to be reset
- stale messages from the previous load not to linger when the server returns the updated transcript

Example test shape:

```ts
hostApiFetchMock
  .mockResolvedValueOnce(fixtures.sessions)
  .mockResolvedValueOnce(firstMessages)
  .mockResolvedValueOnce(updatedMessages);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL because the page currently preserves old messages too aggressively and only relies on polling.

- [ ] **Step 3: Write minimal implementation**

Update `src/pages/Channels/index.tsx` to:

- replace `messages` with the server transcript for the selected conversation instead of falling back to stale local data
- subscribe to `gateway:notification` so relevant runtime/channel activity triggers an immediate reload
- keep polling only as a fallback safety net

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx src/lib/host-events.ts
git commit -m "fix: refresh channels workbench from runtime-backed feishu updates"
```

### Task 6: Verify sidebar and `Channels` stay aligned for the same Feishu thread

**Files:**
- Modify: `tests/unit/channel-sync-routes.test.ts`
- Modify: `tests/unit/channels-page.test.tsx`
- Modify: `electron/api/routes/channels.ts`

- [ ] **Step 1: Write the failing test**

Add one regression test at the route/UI boundary that proves:

- a Feishu inbound message and a desktop workbench send resolve to the same `sessionKey`
- the conversation transcript returned to `Channels` is the transcript for that same bound runtime session

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

- `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
- `pnpm test -- --run tests/unit/channels-page.test.tsx`

Expected: FAIL until both paths share the same binding/session source.

- [ ] **Step 3: Write minimal implementation**

Tighten route helpers so all Feishu workbench operations resolve through a single binding helper and never recompute different session targets for the same conversation.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run:

- `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
- `pnpm test -- --run tests/unit/channels-page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/api/routes/channels.ts tests/unit/channel-sync-routes.test.ts tests/unit/channels-page.test.tsx
git commit -m "fix: keep feishu workbench and sidebar on one runtime transcript"
```

## Chunk 4: Verification and Documentation

### Task 7: Run focused and broad verification

**Files:**
- Modify: `README.md` if behavior docs need updating
- Modify: `README.zh-CN.md` if behavior docs need updating
- Modify: `Prompt.md` only if the persistent closure notes need to capture the architectural shift

- [ ] **Step 1: Run the focused tests**

Run:

- `pnpm test -- --run tests/unit/channel-conversation-bindings.test.ts`
- `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
- `pnpm test -- --run tests/unit/channels-page.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run the safety checks**

Run:

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build:vite`

Expected: PASS.

- [ ] **Step 3: Review docs for required updates**

Review:

- [README.md](C:/Users/22688/Desktop/ClawX-main/README.md)
- [README.zh-CN.md](C:/Users/22688/Desktop/ClawX-main/README.zh-CN.md)

Only update them if the user-facing Feishu sync behavior is described there and would now be inaccurate.

- [ ] **Step 4: Commit**

```bash
git add README.md README.zh-CN.md Prompt.md
git commit -m "docs: record feishu runtime unification behavior"
```
