# Prompt Backlog Session 6 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a reliable test baseline, complete the remaining `Prompt.md` session-6 backend correctness items, wire the remaining Settings actions, and sync the durable progress/docs state.

**Architecture:** Fix the failing verification layer first so TDD is usable again. Keep renderer/backend boundaries consistent with `AGENTS.md`: renderer goes through `hostApiFetch` or `invokeIpc`, provider runtime syncing remains in Electron main utilities/services, and docs/progress files are updated only after fresh verification.

**Tech Stack:** Vitest 4, Vite 7, React 19, Electron 40, TypeScript, Zustand, pnpm

---

## Chunk 1: Verification Baseline

### Task 1: Repair Vitest project alias inheritance

**Files:**
- Modify: `vitest.config.ts`
- Verify: `tests/unit/api-client.test.ts`
- Verify: `tests/unit/agent-config.test.ts`

- [ ] Reproduce alias resolution failure with `pnpm exec vitest run tests/unit/api-client.test.ts --project jsdom`
- [ ] Update the Vitest project config so each project inherits or explicitly receives the shared `@/` and `@electron/` aliases
- [ ] Re-run `pnpm exec vitest run tests/unit/api-client.test.ts --project jsdom`
- [ ] Re-run `pnpm exec vitest run tests/unit/agent-config.test.ts --project node`

### Task 2: Triage remaining failing suites after alias recovery

**Files:**
- Verify only in this task

- [ ] Run `pnpm test`
- [ ] Group failures into: backend correctness, Settings UI wiring/tests, test-only drift, docs/scripts
- [ ] Use those groups to dispatch independent worker tasks

## Chunk 2: Backend Correctness

### Task 3: Keep Settings doctor invocation on the standard host API path

**Files:**
- Verify: `src/pages/Settings/index.tsx`
- Verify: `electron/api/routes/app.ts`
- Test: `tests/unit/app-routes.test.ts`

- [ ] Confirm the renderer uses `hostApiFetch('/api/app/openclaw-doctor', ...)`
- [ ] Add or refresh tests covering `diagnose` and `fix`
- [ ] Run `pnpm exec vitest run tests/unit/app-routes.test.ts --project node`

### Task 4: Stop deleting provider runtime config when only the API key is removed

**Files:**
- Modify: `electron/services/providers/provider-runtime-sync.ts`
- Modify: `electron/main/ipc-handlers.ts`
- Modify: `electron/utils/openclaw-auth.ts`
- Test: `tests/unit/provider-runtime-sync.test.ts`
- Test: `tests/unit/openclaw-auth.test.ts`

- [ ] Reproduce the current delete-key behavior with focused tests
- [ ] Change API-key deletion sync to remove only auth profile secrets, not the whole provider runtime definition
- [ ] Re-run focused provider sync tests

### Task 5: Remove provider-list read side effects

**Files:**
- Modify: `electron/utils/secure-storage.ts`
- Test: `tests/unit/providers.test.ts`

- [ ] Reproduce the side-effecting read behavior with a focused failing test
- [ ] Make provider listing read-only
- [ ] Re-run the focused provider list tests

## Chunk 3: Settings Wiring

### Task 6: Wire the remaining Settings dead buttons

**Files:**
- Modify: `src/pages/Settings/index.tsx`
- Test: `tests/unit/settings-center.test.tsx`

- [ ] Add working handlers for route rules, path whitelist, terminal blacklist, custom tool grants, and quick grant templates
- [ ] Prefer host/main APIs or explicit placeholder feedback over dead controls
- [ ] Re-run `pnpm exec vitest run tests/unit/settings-center.test.tsx --project jsdom`

## Chunk 4: Docs, Scripts, Durable State

### Task 7: Sync scripts and docs with the current repo reality

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `README.ja-JP.md`
- Modify: `Prompt.md`

- [ ] Add non-mutating lint entrypoint if still missing
- [ ] Add missing E2E script entrypoints if still missing
- [ ] Update docs to consistently reference `pnpm` and the actual script names

### Task 8: Update durable progress state after fresh verification

**Files:**
- Modify: `continue/task.json`
- Modify: `continue/progress.txt`
- Modify: `Prompt.md`

- [ ] Run fresh verification commands for all touched areas
- [ ] Update `continue/task.json` current focus and item statuses
- [ ] Append a factual progress entry to `continue/progress.txt`
- [ ] Mark completed `Prompt.md` items and trim obsolete backlog wording
