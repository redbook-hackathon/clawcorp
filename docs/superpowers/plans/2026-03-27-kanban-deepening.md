# Kanban Deepening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen `TaskKanban` so operators can understand and control parent/child/latest runtime relationships, retry from the right node, and navigate runtime lineage and execution-linked child runs without losing context.

**Architecture:** Keep the current `TaskKanban` page and detail drawer, but strengthen it with clearer runtime summary state, richer lineage/child navigation, and more explicit latest-vs-selected run behavior. Reuse existing runtime routes, persisted runtime fields, and execution record links rather than introducing a new orchestration model.

**Tech Stack:** React 19, TypeScript, Zustand-backed stores, host-api routes, Vitest, existing runtime session routes

---

## File Structure

**Modify**

- `src/pages/TaskKanban/index.tsx`
  Responsibility: deepen the runtime detail drawer interaction model, latest/selected run behavior, child subtree summaries, and retry semantics.
- `src/i18n/locales/zh/common.json`
- `src/i18n/locales/en/common.json`
  Responsibility: add only the Kanban/runtime strings needed for deeper runtime tree navigation.
- `tests/unit/task-kanban.test.tsx`
  Responsibility: lock the deeper lineage/latest/child/retry behaviors with focused regression coverage.

## Chunk 1: Make Runtime Context Navigable

### Task 1: Add explicit latest-vs-selected runtime navigation

**Files:**
- Modify: `tests/unit/task-kanban.test.tsx`
- Modify: `src/pages/TaskKanban/index.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that require:

- the detail drawer to expose a clear `latest run` target even when a child or parent run is selected
- selecting a child run updates the selected detail view without losing access to the latest run
- returning to the latest run restores the ticket’s current runtime transcript

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: FAIL because the drawer does not yet distinguish `selected` from `latest` strongly enough.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/TaskKanban/index.tsx`:

- derive `latestRuntimeSessionId`
- render an always-available `latest run` navigation action when the selected run differs
- keep the current run context visible in the runtime summary block

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TaskKanban/index.tsx tests/unit/task-kanban.test.tsx
git commit -m "feat: add latest runtime navigation to kanban detail"
```

### Task 2: Enrich child run rows with subtree-operable summaries

**Files:**
- Modify: `tests/unit/task-kanban.test.tsx`
- Modify: `src/pages/TaskKanban/index.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that require child runtime rows to show:

- runtime id
- status
- short transcript preview
- whether the child is waiting approval or is the latest active branch

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: FAIL because child run rows are still too thin.

- [ ] **Step 3: Write minimal implementation**

Render richer child run summaries using existing runtime response fields without introducing a new API.

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TaskKanban/index.tsx tests/unit/task-kanban.test.tsx
git commit -m "feat: enrich kanban child runtime summaries"
```

## Chunk 2: Strengthen Lineage and Retry Semantics

### Task 3: Make retry operate from the currently viewed runtime node

**Files:**
- Modify: `tests/unit/task-kanban.test.tsx`
- Modify: `src/pages/TaskKanban/index.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that require:

- retry from a selected child run to use that runtime as the parent
- the newly spawned retry run to become the selected detail view
- latest-run navigation to update immediately after retry

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: FAIL because retry is still anchored too tightly to ticket-level state.

- [ ] **Step 3: Write minimal implementation**

Use the selected runtime node when present as the retry origin. Update selection state after successful retry creation.

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TaskKanban/index.tsx tests/unit/task-kanban.test.tsx
git commit -m "feat: retry kanban work from selected runtime node"
```

### Task 4: Add stronger lineage summary and parent/current/latest markers

**Files:**
- Modify: `tests/unit/task-kanban.test.tsx`
- Modify: `src/pages/TaskKanban/index.tsx`
- Modify: `src/i18n/locales/zh/common.json`
- Modify: `src/i18n/locales/en/common.json`

- [ ] **Step 1: Write the failing test**

Add tests that require:

- visible labels or markers for root / parent / current / latest in the runtime lineage area
- parent navigation to remain available independently of child chips

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: FAIL until the runtime summary/lineage language is richer.

- [ ] **Step 3: Write minimal implementation**

Add only the locale keys needed to render a clearer lineage summary and markers in the detail drawer.

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TaskKanban/index.tsx src/i18n/locales/zh/common.json src/i18n/locales/en/common.json tests/unit/task-kanban.test.tsx
git commit -m "feat: clarify runtime lineage markers in kanban detail"
```

## Chunk 3: Align Ticket Status With Active Subtree

### Task 5: Derive ticket-level runtime summary from the active subtree

**Files:**
- Modify: `tests/unit/task-kanban.test.tsx`
- Modify: `src/pages/TaskKanban/index.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that require ticket runtime summary to reflect subtree precedence:

- `waiting_approval` beats `blocked`
- `blocked` beats `working`
- historical selected runs must not hide a newer active child branch

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: FAIL because ticket-level detail state still reflects too much of the selected node.

- [ ] **Step 3: Write minimal implementation**

Add derived subtree summary state in the drawer using existing runtime children + selected/latest knowledge.

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TaskKanban/index.tsx tests/unit/task-kanban.test.tsx
git commit -m "feat: align kanban runtime summary with active subtree state"
```

### Task 6: Verify execution-record drill-down still works with the deeper runtime model

**Files:**
- Modify: `tests/unit/task-kanban.test.tsx`
- Modify: `src/pages/TaskKanban/index.tsx`

- [ ] **Step 1: Write the failing test**

Add or tighten tests requiring:

- execution record linked-runtime navigation to update selected/latest context coherently
- the operator can still return from a linked child runtime to the latest run

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: FAIL until the newer selection model is fully integrated.

- [ ] **Step 3: Write minimal implementation**

Adjust execution-record navigation so it cooperates with the new latest/selected runtime behavior.

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `pnpm test -- --run tests/unit/task-kanban.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TaskKanban/index.tsx tests/unit/task-kanban.test.tsx
git commit -m "feat: stabilize kanban execution drill-down with runtime lineage"
```

## Chunk 4: Verification

### Task 7: Run focused and safety verification

**Files:**
- Modify: `Prompt.md` if the remaining Kanban item is no longer accurate
- Modify: `continue/task.json`
- Modify: `continue/progress.txt`

- [ ] **Step 1: Run focused tests**

Run:

- `pnpm test -- --run tests/unit/task-kanban.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run broader safety checks**

Run:

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build:vite`

Expected: PASS.

- [ ] **Step 3: Update persistent progress records**

If the remaining Kanban closure item is fully landed, sync `Prompt.md`, `continue/task.json`, and `continue/progress.txt`.

- [ ] **Step 4: Commit**

```bash
git add Prompt.md continue/task.json continue/progress.txt
git commit -m "docs: record kanban deepening closure"
```
