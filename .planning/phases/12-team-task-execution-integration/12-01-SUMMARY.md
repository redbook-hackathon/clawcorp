---
phase: 12-team-task-execution-integration
plan: 01
subsystem: task-data-infrastructure
tags: [task-kanban, electron, host-api, runtime-linkage, zustand]
dependency_graph:
  requires: [02-task-board-redesign, 07-session-redesign]
  provides: [canonical-task-contract, tasks-json-persistence, task-api-routes, host-api-task-store]
  affects: [12-02-chat-wiring, 12-03-task-detail-lineage, 12-04-summary-read-models]
tech_stack:
  added: [tasks-json-document, task-api-routes]
  patterns: [dedicated-json-storage, canonical-execution-thread, hostapi-fetch]
key_files:
  created:
    - electron/utils/task-config.ts
    - electron/api/routes/tasks.ts
    - tests/unit/task-store.test.ts
    - tests/unit/task-runtime-linkage.test.ts
  modified:
    - electron/api/server.ts
    - src/types/task.ts
    - src/stores/approvals.ts
    - src/pages/TaskKanban/index.tsx
    - src/pages/TaskKanban/TaskDetailPanel.tsx
    - tests/unit/approvals-store-tasks.test.ts
    - tests/unit/task-kanban-board-view.test.tsx
    - tests/unit/task-kanban-calendar-view.test.tsx
    - tests/unit/task-types.test.ts
    - vitest.config.ts
decisions:
  - id: TASK-SPINE-01
    summary: Persist canonical task data in a dedicated ~/.openclaw/tasks.json document
    rationale: Keeps task state out of browser localStorage and avoids mixing task snapshots into openclaw.json
  - id: TASK-SPINE-02
    summary: Model one active canonical execution thread directly on the task
    rationale: Downstream chat, task detail, and summary surfaces all need one stable task-owned execution anchor
  - id: TASK-SPINE-03
    summary: Return canonical task snapshots from all mutations
    rationale: Lets renderer state update from backend truth instead of rebuilding task objects locally
requirements-completed: [TASK-01, TASK-02, TEAM-03]
metrics:
  duration_seconds: 7200
  tasks_completed: 2
  files_created: 4
  files_modified: 10
  commits: 2
completed_at: "2026-04-07T15:36:19.8752326+08:00"
---

# Phase 12 Plan 01: Canonical Task Domain and Persistence Spine Summary

**Canonical task snapshots now live in Electron-side `tasks.json`, expose `/api/tasks` mutations, and drive Task Kanban through a host-api-backed store instead of browser localStorage.**

## What Was Built

1. **Canonical task contract**
   - Extended [src/types/task.ts](/C:/Users/22688/Desktop/ClawX-main/src/types/task.ts) with `canonicalExecution`, borrowed execution metadata, execution events, latest internal excerpt, blocker rollup, approval rollup, related session keys, and request/response payload types.
   - Kept legacy runtime fields so existing Kanban surfaces still render while later Phase 12 plans migrate onto richer lineage data.

2. **Electron task persistence**
   - Added [task-config.ts](/C:/Users/22688/Desktop/ClawX-main/electron/utils/task-config.ts) as a dedicated task document boundary backed by `~/.openclaw/tasks.json`.
   - Implemented create, update, delete, execution start, and execution event append flows with normalized canonical snapshots.

3. **Host API task routes**
   - Added [tasks.ts](/C:/Users/22688/Desktop/ClawX-main/electron/api/routes/tasks.ts) and registered it in [server.ts](/C:/Users/22688/Desktop/ClawX-main/electron/api/server.ts).
   - Exposed `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:taskId`, `POST /api/tasks/:taskId/execution/start`, and `POST /api/tasks/:taskId/execution/events`.

4. **Renderer task store rewire**
   - Replaced the task half of [approvals.ts](/C:/Users/22688/Desktop/ClawX-main/src/stores/approvals.ts) so it now reads and mutates tasks through `hostApiFetch('/api/tasks...')`.
   - Added `startTaskExecution` and `appendTaskExecutionEvent` helpers so downstream chat and task-detail work can mutate canonical execution state without inventing side channels.

5. **Regression coverage around board and calendar**
   - Added node-side tests for `task-config` persistence and task route linkage.
   - Updated Kanban board/calendar tests so they still cover the current UI contract after the store migration.

## Task Commits

1. **Task 1: Define the canonical task document and Electron host-api contract** - `4a42add` (`feat`)
2. **Task 2: Rewire renderer task state to the canonical host-api spine** - `ef26e72` (`feat`)

## Files Created/Modified

- [task-config.ts](/C:/Users/22688/Desktop/ClawX-main/electron/utils/task-config.ts) - Dedicated Electron task document helpers and canonical snapshot normalization.
- [tasks.ts](/C:/Users/22688/Desktop/ClawX-main/electron/api/routes/tasks.ts) - Host API contract for task CRUD and execution mutations.
- [task-store.test.ts](/C:/Users/22688/Desktop/ClawX-main/tests/unit/task-store.test.ts) - Node coverage for `tasks.json` persistence and canonical execution rollups.
- [task-runtime-linkage.test.ts](/C:/Users/22688/Desktop/ClawX-main/tests/unit/task-runtime-linkage.test.ts) - Route coverage for `/api/tasks` and execution endpoints.
- [task.ts](/C:/Users/22688/Desktop/ClawX-main/src/types/task.ts) - Canonical task metadata, execution payloads, and snapshot types.
- [approvals.ts](/C:/Users/22688/Desktop/ClawX-main/src/stores/approvals.ts) - Host-api-backed task store with canonical execution helpers.
- [index.tsx](/C:/Users/22688/Desktop/ClawX-main/src/pages/TaskKanban/index.tsx) - Added default export for page-level compatibility while keeping named export usage.

## Decisions Made

- Stored tasks in a dedicated `tasks.json` document rather than `openclaw.json` so task state stays isolated from agent/channel config churn.
- Kept one singular `canonicalExecution` field on the task to encode the "one active execution thread" invariant directly in the data model.
- Returned canonical task snapshots from mutation endpoints so renderer state can update from backend truth instead of synthesizing ad hoc task objects.

## Deviations from Plan

### Auto-fixed Issues

**1. Regression coverage drift in Task Kanban tests**
- **Found during:** Task 2 verification
- **Issue:** Existing board/calendar tests assumed the older Zustand mock shape and older FullCalendar toolbar/style contract.
- **Fix:** Updated [task-kanban-board-view.test.tsx](/C:/Users/22688/Desktop/ClawX-main/tests/unit/task-kanban-board-view.test.tsx) and [task-kanban-calendar-view.test.tsx](/C:/Users/22688/Desktop/ClawX-main/tests/unit/task-kanban-calendar-view.test.tsx) to match the current component behavior while preserving regression intent.
- **Impact:** Verification stayed meaningful after the store migration; no product-scope change.

## Issues Encountered

- `pnpm run typecheck` is still blocked by pre-existing unused-variable errors in unrelated files such as `src/components/layout/Sidebar.tsx`, `src/pages/Chat/ChatInput.tsx`, and `src/pages/Settings/index.tsx`. The new task-spine files were verified through targeted tests instead.

## Verification Results

- `pnpm test -- tests/unit/task-store.test.ts tests/unit/task-runtime-linkage.test.ts tests/unit/approvals-store-tasks.test.ts tests/unit/task-kanban-board-view.test.tsx tests/unit/task-kanban-calendar-view.test.tsx`
  - Passed (`23` tests)
- `rg -n "clawcorp-kanban-tasks|localStorage\\.(getItem|setItem)" src/stores/approvals.ts`
  - No matches
- `pnpm run typecheck`
  - Fails due unrelated pre-existing repo errors outside the Phase 12 task-spine scope

## Next Phase Readiness

- Plan `12-02` can now create tasks from chat and start canonical execution threads against stable task ids.
- Plan `12-03` can render lineage, blocker, and related-session surfaces from canonical task execution metadata.
- Plan `12-04` can derive team and agent summary read models from the same task truth instead of browser storage.

## Self-Check: PASSED WITH EXISTING REPO TYPECHECK DEBT

- Claimed files exist and targeted verification passed.
- Repo-wide typecheck still needs separate cleanup outside this plan before phase-level completion can claim a clean global compile.
