# Channel Isolation And Multi-Instance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate channel conversations from local main sessions, expose per-account channel instances, and add rename/unbind controls for workbench conversation items without changing the existing chat-first Channels product shape.

**Architecture:** Keep the current Channels page and sidebar structure, but move channel conversation identity to explicit per-channel session keys and persist workbench-specific metadata separately from local chat sessions. Render channel accounts as first-class channel instances in the renderer, and use small dedicated host routes for conversation metadata updates.

**Tech Stack:** Electron host routes, React 19, Zustand, Vitest, TypeScript

---

## Chunk 1: Regression Tests

### Task 1: Channel store returns per-account channel instances

**Files:**
- Modify: `tests/unit/channels-store.test.ts`
- Modify: `src/stores/channels.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `pnpm exec vitest run tests/unit/channels-store.test.ts` and confirm the new test fails**
- [ ] **Step 3: Update the store to emit one `Channel` per configured account instead of collapsing to the primary account**
- [ ] **Step 4: Re-run `pnpm exec vitest run tests/unit/channels-store.test.ts` and confirm it passes**

### Task 2: Channel routes create isolated session keys and expose metadata CRUD

**Files:**
- Modify: `tests/unit/channel-sync-routes.test.ts`
- Modify: `electron/api/routes/channels.ts`
- Modify: `electron/services/channel-conversation-bindings.ts`

- [ ] **Step 1: Add failing tests covering Feishu/WeChat isolated session keys plus workbench rename/unbind metadata routes**
- [ ] **Step 2: Run `pnpm exec vitest run tests/unit/channel-sync-routes.test.ts` and confirm the new assertions fail**
- [ ] **Step 3: Update the route layer and binding store to persist `displayTitle` / `hidden`, and to stop defaulting channel conversations to `agent:*:main`**
- [ ] **Step 4: Re-run `pnpm exec vitest run tests/unit/channel-sync-routes.test.ts` and confirm it passes**

### Task 3: Sidebar and Channels page show prefixes and CRUD actions

**Files:**
- Modify: `tests/unit/workbench-sidebar.test.tsx`
- Modify: `tests/unit/channels-page.test.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Modify: `src/components/channels/ChannelConfigModal.tsx`

- [ ] **Step 1: Add failing UI tests for session prefixes, per-account channel rendering, and workbench rename/unbind controls**
- [ ] **Step 2: Run `pnpm exec vitest run tests/unit/workbench-sidebar.test.tsx tests/unit/channels-page.test.tsx` and confirm the new tests fail**
- [ ] **Step 3: Implement the UI changes with the smallest renderer changes needed**
- [ ] **Step 4: Re-run `pnpm exec vitest run tests/unit/workbench-sidebar.test.tsx tests/unit/channels-page.test.tsx` and confirm they pass**

## Chunk 2: Verification And Docs

### Task 4: Focused regression sweep

**Files:**
- Modify as needed based on failures

- [ ] **Step 1: Run `pnpm exec vitest run tests/unit/channels-store.test.ts tests/unit/channel-sync-routes.test.ts tests/unit/workbench-sidebar.test.tsx tests/unit/channels-page.test.tsx`**
- [ ] **Step 2: Fix any failing assertions without broad refactors**
- [ ] **Step 3: Re-run the same command until all tests are green**

### Task 5: Documentation sync

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `.planning/phases/06-channel-redesign/06-05-PLAN.md`

- [ ] **Step 1: Update docs only if user-visible channel behavior or management flows changed materially**
- [ ] **Step 2: Note the new per-account instance behavior and isolated channel session model**
- [ ] **Step 3: Re-read the changed docs for consistency**

