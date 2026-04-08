# Kanban Cron Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore runtime-backed kanban execution, keep cron user-facing output limited to "task scheduled" and execution results, and prevent tickets from completing before the scheduled work actually runs.

**Architecture:** Revert the kanban start action to spawn a tracked runtime, then distinguish "cron job scheduled" from "cron run completed" in both the ticket lifecycle and chat rendering. Use stable cron route data for execution status instead of treating the setup runtime as the final job outcome.

**Tech Stack:** Electron, React 19, TypeScript, Vitest, host API routes, Zustand-backed chat/task state

---

## Chunk 1: Regression Coverage

### Task 1: Cover kanban start-work lifecycle regression

**Files:**
- Modify: `tests/unit/task-kanban.test.tsx`
- Modify: `src/pages/TaskKanban/index.tsx`

- [ ] **Step 1: Write a failing test for start-work behavior**

Add a test asserting `Start work` calls `/api/sessions/spawn`, leaves the ticket in an active state, and does not mark it `done` immediately for a scheduled task setup flow.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: FAIL because the current implementation sends `chat.send` directly and marks the ticket `done`.

- [ ] **Step 3: Write the minimal implementation**

Restore runtime spawning and keep ticket state active until explicit cron execution evidence moves it forward.

- [ ] **Step 4: Re-run the focused kanban test**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: PASS for the new lifecycle assertion.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/task-kanban.test.tsx src/pages/TaskKanban/index.tsx
git commit -m "fix: restore kanban runtime start lifecycle"
```

### Task 2: Cover cron route/session targeting regression

**Files:**
- Modify: `tests/unit/cron-routes.test.ts`
- Modify: `electron/api/routes/cron.ts`

- [ ] **Step 1: Write a failing test for cron route targeting**

Add or tighten a test asserting UI-created cron jobs keep isolated execution routing while still supporting user-facing result projection to the main session.

- [ ] **Step 2: Run the focused cron route test to verify it fails**

Run: `pnpm test -- --run tests/unit/cron-routes.test.ts`
Expected: FAIL because the route currently sets `sessionTarget: 'main'`.

- [ ] **Step 3: Write the minimal implementation**

Restore the expected cron route configuration and expose stable run-status data needed by the kanban lifecycle.

- [ ] **Step 4: Re-run the focused cron route test**

Run: `pnpm test -- --run tests/unit/cron-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/cron-routes.test.ts electron/api/routes/cron.ts
git commit -m "fix: restore isolated cron execution routing"
```

## Chunk 2: User-Facing Cron Messaging

### Task 3: Cover chat filtering for cron setup and execution messages

**Files:**
- Modify: `tests/unit/chat-message.test.tsx`
- Modify: `src/pages/Chat/message-utils.ts`
- Modify: `src/pages/Chat/ChatMessage.tsx`
- Modify: `src/pages/Chat/index.tsx`

- [ ] **Step 1: Write failing tests for chat rendering**

Add coverage proving that cron/system-injected setup noise is hidden while user-facing "task scheduled" and execution-result assistant messages still render or notify correctly.

- [ ] **Step 2: Run the focused chat tests to verify they fail**

Run: `pnpm test -- --run tests/unit/chat-message.test.tsx`
Expected: FAIL because the current filters only partially suppress cron noise and do not enforce the approved message policy.

- [ ] **Step 3: Write the minimal implementation**

Classify cron noise separately from allowed user-facing messages, then filter only the internal/system-injected variants.

- [ ] **Step 4: Re-run the focused chat tests**

Run: `pnpm test -- --run tests/unit/chat-message.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/chat-message.test.tsx src/pages/Chat/message-utils.ts src/pages/Chat/ChatMessage.tsx src/pages/Chat/index.tsx
git commit -m "fix: limit cron chat output to user-facing messages"
```

## Chunk 3: Integrated Lifecycle Wiring

### Task 4: Wire cron execution state into kanban ticket completion

**Files:**
- Modify: `src/pages/TaskKanban/index.tsx`
- Modify: `src/types/cron.ts`
- Modify: `electron/api/routes/cron.ts`
- Modify: `tests/unit/task-kanban.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Add tests covering:
- runtime completes after scheduling a cron job -> ticket becomes scheduled, not done
- first successful one-shot execution -> ticket becomes done
- recurring execution updates result but keeps scheduled state

- [ ] **Step 2: Run the focused kanban suite to verify it fails**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: FAIL on the new scheduled/completed distinction.

- [ ] **Step 3: Write the minimal implementation**

Persist cron metadata on tickets, poll or fetch stable cron run state, and map one-shot versus recurring schedules into the correct work state.

- [ ] **Step 4: Re-run the focused kanban suite**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TaskKanban/index.tsx src/types/cron.ts electron/api/routes/cron.ts tests/unit/task-kanban.test.tsx
git commit -m "fix: track cron execution separately from setup runtime"
```

## Chunk 4: Verification

### Task 5: Run targeted verification

**Files:**
- Modify: `continue/task.json` (if used for handoff)
- Modify: `continue/progress.txt` (if used for handoff)
- Modify: `Prompt.md` (if behavior notes changed)

- [ ] **Step 1: Run focused tests**

Run:
- `pnpm test -- --run tests/unit/task-kanban.test.tsx`
- `pnpm test -- --run tests/unit/cron-routes.test.ts`
- `pnpm test -- --run tests/unit/chat-message.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run broader safety checks**

Run:
- `pnpm run typecheck`
- `pnpm run lint`

Expected: PASS.

- [ ] **Step 3: Update handoff docs if behavior changed materially**

Capture the lifecycle change in `Prompt.md` and progress tracking files if this session is part of the persistent workflow.

- [ ] **Step 4: Commit**

```bash
git add Prompt.md continue/task.json continue/progress.txt
git commit -m "docs: record kanban cron lifecycle fix"
```
