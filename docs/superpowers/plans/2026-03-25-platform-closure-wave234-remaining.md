# Platform Closure Wave 2-4 Remaining Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-signal remaining `Prompt.md` backlog by deepening runtime/Kanban orchestration, shipping actionable Costs analytics, expanding Memory to multi-agent editing/search with safer writes, and adding Channels runtime guardrails.

**Architecture:** Keep renderer/backend boundaries aligned with `AGENTS.md`: renderer uses `hostApiFetch`, while Electron main owns runtime/session orchestration, file-system safety checks, analytics aggregation, and channel request protection. Each chunk stays in a disjoint write set so workers can implement them independently and verification remains focused.

**Tech Stack:** Electron 40, React 19, Vite 7, TypeScript 5.9, Vitest 4, pnpm 10

---

## Chunk 1: Runtime Tree + Kanban Closure

### Task 1: Add failing tests for parent/child runtime orchestration

**Files:**
- Modify: `tests/unit/session-runtime-manager.test.ts`
- Modify: `tests/unit/session-routes-runtime.test.ts`
- Modify: `tests/unit/task-kanban.test.tsx`

- [ ] Extend the existing node-side runtime tests with a failing case that spawns a root runtime session plus a child runtime session and asserts parent/child linkage metadata is persisted.
- [ ] Extend the existing route tests with a failing case that exercises `parentRuntimeId` spawn semantics and verifies the response exposes tree metadata.
- [ ] Extend the existing jsdom Kanban tests with a failing case that retries work from the detail panel and expects a child runtime run instead of overwriting the prior session.
- [ ] Run `pnpm exec vitest run tests/unit/session-runtime-manager.test.ts tests/unit/session-routes-runtime.test.ts tests/unit/task-kanban.test.tsx --project node --project jsdom`

### Task 2: Implement parent/child runtime metadata and Kanban retry linkage

**Files:**
- Modify: `electron/services/session-runtime-manager.ts`
- Modify: `electron/api/routes/sessions.ts`
- Modify: `src/pages/TaskKanban/index.tsx`

- [ ] Extend runtime records with parent/child orchestration metadata (`parentRuntimeId`, `childRuntimeIds`, depth/root ids as needed for UI and persistence).
- [ ] Let `spawn` accept an optional `parentRuntimeId` and derive linkage from the parent runtime session when present.
- [ ] Expose the extra metadata in session route responses and list payloads without breaking existing callers.
- [ ] Update Kanban retry/start flows to create child runs for follow-up work, while approval matching can resolve against the active session tree.
- [ ] Run `pnpm exec vitest run tests/unit/session-runtime-manager.test.ts tests/unit/session-routes-runtime.test.ts tests/unit/task-kanban.test.tsx --project node --project jsdom`

## Chunk 2: Costs Analytics + Realtime Closure

### Task 3: Add failing tests for analysis aggregates and realtime refresh

**Files:**
- Modify: `tests/unit/costs-routes.test.ts`
- Modify: `tests/unit/costs-page.test.tsx`

- [ ] Extend the existing route tests with a failing case for `/api/costs/analysis` that expects optimization score, anomaly rows, week-over-week deltas, cache savings, and plain-language insights.
- [ ] Extend the existing page tests with a failing case that expects the dashboard to render the new analysis cards and the realtime tab to support auto-refresh polling.
- [ ] Run `pnpm exec vitest run tests/unit/costs-routes.test.ts tests/unit/costs-page.test.tsx --project node --project jsdom`

### Task 4: Implement analysis route and surface it on the Costs page

**Files:**
- Modify: `electron/api/routes/costs.ts`
- Modify: `src/pages/Costs/index.tsx`

- [ ] Add `/api/costs/analysis` using recent token usage history plus existing cron metadata to compute optimization score, anomaly detection, week-over-week deltas, cache savings, and short insights.
- [ ] Keep math deterministic and derived entirely from structured transcript history so tests stay stable.
- [ ] Add dashboard cards/sections for the new analysis payload and add an auto-refresh toggle/interval for the realtime tab.
- [ ] Run `pnpm exec vitest run tests/unit/costs-routes.test.ts tests/unit/costs-page.test.tsx --project node --project jsdom`

## Chunk 3: Memory Multi-Agent Browser + Safe Writes

### Task 5: Add failing tests for multi-agent memory browsing, search, and safe writes

**Files:**
- Modify: `tests/unit/openclaw-memory-file-route.test.ts`
- Modify: `tests/unit/openclaw-memory-status.test.ts`
- Modify: `tests/unit/settings-memory-browser.test.tsx`
- Create if needed: `tests/unit/memory-page.test.tsx`

- [ ] Extend the existing node-side memory route tests so `/api/memory` enumerates agent scopes plus companion files (`AGENTS.md`, `HEARTBEAT.md`, `IDENTITY.md`, `SOUL.md`, `TOOLS.md`, `USER.md`) and rejects writes with stale `mtime`.
- [ ] Extend the existing route/UI coverage for query-based full-text search/highlight metadata in the memory payload.
- [ ] Add a failing jsdom test for switching agent scope, filtering by search text, and surfacing unsaved/stale-write warnings.
- [ ] Run `pnpm exec vitest run tests/unit/openclaw-memory-file-route.test.ts tests/unit/openclaw-memory-status.test.ts tests/unit/memory-page.test.tsx --project node --project jsdom`

### Task 6: Implement multi-agent memory payload, search, and safer write pipeline

**Files:**
- Modify: `electron/api/routes/memory.ts`
- Modify: `src/pages/Memory/index.tsx`
- Modify: `src/components/settings-center/settings-memory-browser.tsx`

- [ ] Expand the memory route to enumerate available agent workspaces and expose scope-aware file listings, including companion identity files and configured `extraPaths`.
- [ ] Add full-text query filtering with hit counts and lightweight highlight ranges/snippets in the payload.
- [ ] Upgrade writes to enforce a relative-path whitelist, normalize content, reject stale `mtime`, and write atomically via temp-file rename.
- [ ] Surface scope switching, search, unsaved-change warnings, and post-save refresh/reindex affordances in the Memory page UI and keep the Settings memory browser contract aligned.
- [ ] Run `pnpm exec vitest run tests/unit/openclaw-memory-file-route.test.ts tests/unit/openclaw-memory-status.test.ts tests/unit/settings-memory-browser.test.tsx tests/unit/memory-page.test.tsx --project node --project jsdom`

## Chunk 4: Channels Runtime Guardrails

### Task 7: Add failing tests for channel runtime guardrails

**Files:**
- Modify: `tests/unit/channels-routes.test.ts`

- [ ] Add failing route tests that prove per-channel send/test actions enforce local-only access semantics, account scoping, and short-window rate limiting.
- [ ] Cover both a success path and a throttled path so the guardrail behavior is explicit.
- [ ] Run `pnpm exec vitest run tests/unit/channels-routes.test.ts --project node`

### Task 8: Implement channel send/test guardrails

**Files:**
- Modify: `electron/api/routes/channels.ts`

- [ ] Add reusable guard helpers for local/runtime channel actions so bursty `/test` and `/send` calls are rate-limited per channel/account.
- [ ] Keep capability/config routes unchanged while tightening only message-delivery/test actions.
- [ ] Return explicit JSON errors that the renderer can surface directly.
- [ ] Run `pnpm exec vitest run tests/unit/channels-routes.test.ts --project node`

## Chunk 5: Batch Verification + Durable Progress

### Task 9: Verify and sync durable tracking

**Files:**
- Modify: `continue/task.json`
- Modify: `continue/progress.txt`
- Modify: `Prompt.md`

- [ ] Run `pnpm run typecheck`
- [ ] Run `pnpm exec tsc -p tsconfig.node.json --noEmit`
- [ ] Run `pnpm run lint`
- [ ] Run `pnpm run comms:replay`
- [ ] Run `pnpm run comms:compare`
- [ ] Run focused Vitest suites for all touched areas
- [ ] Run `pnpm run build:vite`
- [ ] Review `README.md` and `README.zh-CN.md` for required updates alongside `continue/task.json`, `continue/progress.txt`, and `Prompt.md`, without restoring disabled Docs/Export surfaces
