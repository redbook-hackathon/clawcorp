# Wave 2 Runtime Kanban Closure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the remaining Wave 2 runtime/Kanban gap into a real end-to-end loop by backing ticket runtime actions with real Gateway sessions and syncing Kanban state from live session status/history.

**Architecture:** Keep renderer/backend boundaries aligned with `AGENTS.md`: the renderer only calls Host API session routes, while Electron main owns Gateway RPC orchestration, session-key generation, state refresh, and transcript extraction. Use the session runtime manager as an adapter over `chat.send`, `chat.abort`, `sessions.list`, and `chat.history`, then let the Kanban page poll the Host API and map runtime states into ticket execution/status updates.

**Tech Stack:** Electron 40, React 19, TypeScript 5.9, Zustand, Vitest 4

---

## Chunk 1: Real Runtime Session Adapter

### Task 1: Add failing backend tests for Gateway-backed runtime sessions

**Files:**
- Modify: `tests/unit/session-runtime-manager.test.ts`
- Modify: `tests/unit/session-routes-runtime.test.ts`

- [ ] Write failing tests for spawn/steer/kill/wait against a mocked Gateway RPC client.
- [ ] Verify status mapping covers `running`, `blocked`, `waiting_approval`, `error`, `completed`, and `killed`.
- [ ] Verify refreshed transcript/history comes from Gateway `chat.history`, not only in-memory prompts.

### Task 2: Implement the runtime adapter and route refresh

**Files:**
- Modify: `electron/services/session-runtime-manager.ts`
- Modify: `electron/api/routes/sessions.ts`
- Modify: `electron/main/index.ts`

- [ ] Make `SessionRuntimeManager` create and track real Gateway session keys for spawned runs.
- [ ] Use `chat.send` for spawn/steer, `chat.abort` for stop, and `sessions.list` + `chat.history` for refresh/list/wait.
- [ ] Persist runtime metadata (`sessionKey`, `runId`, `status`, `lastError`, transcript) in the manager record.

## Chunk 2: Kanban Runtime State Closure

### Task 3: Add failing frontend tests for deeper Kanban runtime linkage

**Files:**
- Modify: `tests/unit/task-kanban.test.tsx`

- [ ] Add failing tests for runtime status refresh, board-state transitions, and retry/stop flows.
- [ ] Verify active runtime tickets become `in-progress`, completed tickets surface review-ready state, and blocked/approval cases remain visible.

### Task 4: Implement Kanban polling and state mapping

**Files:**
- Modify: `src/pages/TaskKanban/index.tsx`

- [ ] Poll `/api/sessions/subagents/:id/wait` for tickets with active runtime work.
- [ ] Map backend runtime states into ticket `workState`, error/result text, and ticket column/status updates.
- [ ] Keep retry/follow-up/stop actions aligned with the refreshed runtime metadata.

## Chunk 3: Verification and Durable Progress

### Task 5: Verify and sync progress tracking files

**Files:**
- Modify: `continue/task.json`
- Modify: `continue/progress.txt`
- Modify: `Prompt.md`

- [ ] Run focused backend/frontend Vitest suites for the touched areas.
- [ ] Run `pnpm run typecheck` and `pnpm run lint`.
- [ ] Update durable progress files to reflect the new Wave 2 closure state.
