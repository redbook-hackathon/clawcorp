# Channels Sync Workbench Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `Channels` into a chat-first synchronized conversation workbench, implementing the full shell for `Feishu / Lark` while keeping channel configuration in a secondary settings drawer.

**Architecture:** Replace the current account-detail layout in [src/pages/Channels/index.tsx](C:/Users/22688/Desktop/ClawX-main/src/pages/Channels/index.tsx) with a reusable workbench shell that separates channel-family navigation, synchronized conversation discovery, live message rendering, and configuration controls. Add Feishu-first session/message models and host routes that expose synchronized conversations as inbox-like sessions, then enforce explicit-mention speaking rules and compact message filtering in the renderer.

**Tech Stack:** Electron, React 19, TypeScript, Zustand, host-api routes, i18next, Vitest

---

## File Structure

**Likely files to create**

- `src/components/channels/ChannelsWorkbenchShell.tsx`
  Responsibility: high-level page shell for the sync workbench layout.
- `src/components/channels/ChannelsConversationList.tsx`
  Responsibility: unified list for mixed `群聊 / 私聊` synchronized sessions.
- `src/components/channels/ChannelsConversationPane.tsx`
  Responsibility: header, message stream, tool cards, composer, and local send state.
- `src/components/channels/ChannelsSettingsDrawer.tsx`
  Responsibility: connect/disconnect/test/delete/config drawer for the selected channel/account.
- `src/components/channels/ChannelToolCard.tsx`
  Responsibility: compact tool-card rendering for external synchronized conversations.
- `src/types/channel-sync.ts`
  Responsibility: synchronized session/message/tool-card types that do not overload config-only `Channel`.

**Likely files to modify**

- `src/pages/Channels/index.tsx`
  Responsibility: orchestrate the new workbench flow instead of the current detail/config page.
- `src/types/channel.ts`
  Responsibility: keep channel-account metadata separate from synchronized conversation types; may add minimal cross-links only if needed.
- `src/stores/channels.ts`
  Responsibility: retain channel-account state and add workbench-friendly selection/loading helpers if appropriate.
- `electron/api/routes/channels.ts`
  Responsibility: expose synchronized conversation/session/message endpoints and channel drawer actions through host routes.
- `src/pages/Chat/ChatMessage.tsx`
  Responsibility: reuse or adapt compact tool/message rendering patterns if the channel workbench shares chat presentation logic.
- `src/i18n/locales/en/channels.json`
- `src/i18n/locales/zh/channels.json`
  Responsibility: new labels for session badges, settings drawer, sync state, and composer states.

**Likely files to add/modify for tests**

- `tests/unit/channels-page.test.tsx`
- `tests/unit/channel-sync-routes.test.ts`
- `tests/unit/channel-speaking-rules.test.ts`
- `tests/unit/chat-message.test.tsx` if compact tool-card behavior is shared

## Chunk 1: Reshape the Page into a Chat-First Workbench

### Task 1: Lock the new shell structure in UI tests

**Files:**
- Modify: `tests/unit/channels-page.test.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Create: `src/components/channels/ChannelsWorkbenchShell.tsx`

- [ ] **Step 1: Write the failing test**

Add UI tests that assert the page renders:

- the far-left channel family rail
- the unified synchronized session list
- the main chat pane
- a settings drawer trigger instead of the current read-only detail panel

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL because the current page still renders the config/detail layout.

- [ ] **Step 3: Write minimal implementation**

Extract the page shell into a dedicated workbench component and remove the config-first center/right-column structure.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/channels-page.test.tsx src/pages/Channels/index.tsx src/components/channels/ChannelsWorkbenchShell.tsx
git commit -m "feat: reshape channels into sync workbench shell"
```

### Task 2: Introduce synchronized conversation types

**Files:**
- Create: `src/types/channel-sync.ts`
- Modify: `src/pages/Channels/index.tsx`
- Modify: `src/stores/channels.ts`

- [ ] **Step 1: Write the failing test**

Add or extend tests so the page expects conversation rows with:

- session id
- session type badge (`群聊 / 私聊`)
- title
- pinned state
- latest activity

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL because current state is channel-account based, not session based.

- [ ] **Step 3: Write minimal implementation**

Create sync-specific types and thread them into the page without polluting the existing config-only `Channel` model more than necessary.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/channel-sync.ts src/pages/Channels/index.tsx src/stores/channels.ts tests/unit/channels-page.test.tsx
git commit -m "feat: add synchronized conversation models for channels workbench"
```

## Chunk 2: Feishu Session Discovery and Inbox Ordering

### Task 3: Add synchronized session list routes for Feishu

**Files:**
- Modify: `electron/api/routes/channels.ts`
- Create: `tests/unit/channel-sync-routes.test.ts`

- [ ] **Step 1: Write the failing test**

Add route tests for a Feishu-first sessions endpoint that returns only synchronized conversations and includes:

- mixed `group` and `private` session types
- pinned flag
- latest activity timestamp
- badge-friendly summary fields

- [ ] **Step 2: Run the focused route test to verify it fails**

Run: `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
Expected: FAIL because the endpoint does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a host route under `channels` for synchronized sessions and keep it Feishu-first while designing the response to be channel-agnostic.

- [ ] **Step 4: Re-run the focused route test**

Run: `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/api/routes/channels.ts tests/unit/channel-sync-routes.test.ts
git commit -m "feat: add synchronized channel session routes"
```

### Task 4: Enforce list rendering and ordering rules

**Files:**
- Modify: `src/components/channels/ChannelsConversationList.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Modify: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add tests asserting:

- mixed `群聊 / 私聊` rows render in one list
- pinned sessions sort first
- non-pinned sessions sort by latest activity descending

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL until the new sorting and badge logic is present.

- [ ] **Step 3: Write minimal implementation**

Build the conversation list component with the approved sorting and badge policy.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/channels/ChannelsConversationList.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "feat: render mixed synced conversations with pinned ordering"
```

## Chunk 3: Main Conversation Pane and Compact Message Policy

### Task 5: Render the synchronized chat pane

**Files:**
- Create: `src/components/channels/ChannelsConversationPane.tsx`
- Create: `src/components/channels/ChannelToolCard.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Modify: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that expect the main pane to show:

- conversation header
- sync badge
- participant summary
- human messages
- addressed agent messages
- compact tool cards

and that it does **not** show the old config info block in the main pane.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL against the current detail panel.

- [ ] **Step 3: Write minimal implementation**

Build the pane and compact tool-card components. Reuse existing message presentation patterns where appropriate, but keep the external sync stream cleaner than the internal chat page.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/channels/ChannelsConversationPane.tsx src/components/channels/ChannelToolCard.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "feat: add channels sync conversation pane"
```

### Task 6: Add message filtering rules for external synchronized streams

**Files:**
- Modify: `src/components/channels/ChannelsConversationPane.tsx`
- Modify: `src/pages/Chat/ChatMessage.tsx` only if shared filtering is intentionally reused
- Modify: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that hide:

- transport sync noise
- internal system-injected messages
- redundant metadata blocks

while preserving:

- real human messages
- visible agent replies
- compact tool cards

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL until the filter policy is implemented.

- [ ] **Step 3: Write minimal implementation**

Classify synchronized conversation messages into visible vs hidden categories and filter only the operator-useless variants.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/channels/ChannelsConversationPane.tsx src/pages/Chat/ChatMessage.tsx tests/unit/channels-page.test.tsx
git commit -m "feat: filter external sync noise from channels conversation pane"
```

## Chunk 4: Speaking Rules and Composer Behavior

### Task 7: Implement explicit-mention speaking rules

**Files:**
- Create: `tests/unit/channel-speaking-rules.test.ts`
- Modify: `src/components/channels/ChannelsConversationPane.tsx`
- Modify: `electron/api/routes/channels.ts`

- [ ] **Step 1: Write the failing test**

Add behavior tests for:

- only the explicitly `@` mentioned agent becoming the visible responder
- no proactive reply when no agent is mentioned
- non-addressed agents staying silent in the external thread

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channel-speaking-rules.test.ts`
Expected: FAIL because the speaking policy is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Implement a Feishu-first request routing layer that derives the visible speaker from explicit mention context and avoids automatic agent insertion.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channel-speaking-rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/channel-speaking-rules.test.ts src/components/channels/ChannelsConversationPane.tsx electron/api/routes/channels.ts
git commit -m "feat: enforce explicit mention speaking rules for synced channels"
```

### Task 8: Implement the two-step visible reply lifecycle

**Files:**
- Modify: `tests/unit/channel-speaking-rules.test.ts`
- Modify: `src/components/channels/ChannelsConversationPane.tsx`
- Modify: `electron/api/routes/channels.ts`

- [ ] **Step 1: Write the failing test**

Add tests that require the explicitly addressed agent to:

- send a short acknowledgement first
- later send the completion report

and ensure background-dispatched agents do not visibly interleave into the external stream.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channel-speaking-rules.test.ts`
Expected: FAIL until the two-step lifecycle is modeled.

- [ ] **Step 3: Write minimal implementation**

Implement acknowledgement/completion message states and keep the composer identity pill aligned with the current visible speaker.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channel-speaking-rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/channel-speaking-rules.test.ts src/components/channels/ChannelsConversationPane.tsx electron/api/routes/channels.ts
git commit -m "feat: add acknowledged then completion reply lifecycle for addressed agents"
```

## Chunk 5: Settings Drawer and Final Integration

### Task 9: Move channel actions into a settings drawer

**Files:**
- Create: `src/components/channels/ChannelsSettingsDrawer.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Modify: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that assert:

- connect/disconnect/test/delete actions live in a drawer
- config fields and runtime capability summary are available there
- opening the drawer does not replace the main chat pane

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL until the drawer exists.

- [ ] **Step 3: Write minimal implementation**

Create the drawer and move secondary controls into it, leaving the chat pane visually dominant.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/channels/ChannelsSettingsDrawer.tsx src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "feat: move channel controls into settings drawer"
```

### Task 10: Localize and harden the Feishu-first workbench

**Files:**
- Modify: `src/i18n/locales/en/channels.json`
- Modify: `src/i18n/locales/zh/channels.json`
- Modify: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that require the new labels and badges to come from locale keys instead of hardcoded strings.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: FAIL until the new strings are localized.

- [ ] **Step 3: Write minimal implementation**

Add only the locale keys needed for the approved workbench shell, badges, drawer labels, and composer states.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test -- --run tests/unit/channels-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/en/channels.json src/i18n/locales/zh/channels.json tests/unit/channels-page.test.tsx
git commit -m "feat: localize channels sync workbench"
```

## Chunk 6: Verification

### Task 11: Run focused verification

**Files:**
- Modify: `Prompt.md` if behavior notes need to be persisted
- Modify: `continue/task.json` and `continue/progress.txt` if this branch uses the persistent handoff workflow

- [ ] **Step 1: Run focused tests**

Run:

- `pnpm test -- --run tests/unit/channels-page.test.tsx`
- `pnpm test -- --run tests/unit/channel-sync-routes.test.ts`
- `pnpm test -- --run tests/unit/channel-speaking-rules.test.ts`

Expected: PASS.

- [ ] **Step 2: Run broader safety checks**

Run:

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build:vite`

Expected: PASS.

- [ ] **Step 3: Update persistent handoff docs if needed**

Capture the new `Channels` direction and Feishu-first behavior in the persistent workflow files if this work is part of the active closure plan.

- [ ] **Step 4: Commit**

```bash
git add Prompt.md continue/task.json continue/progress.txt
git commit -m "docs: record channels sync workbench rollout"
```
