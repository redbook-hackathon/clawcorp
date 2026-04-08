# Platform Closure P0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-priority `Prompt.md` platform gaps by shipping MCP runtime lifecycle management first, then deepening release/install/E2E guardrails and i18n parity checks in the same execution cycle.

**Architecture:** Keep renderer/backend boundaries aligned with `AGENTS.md`: renderer talks only through `hostApiFetch`, while Electron main owns runtime orchestration, process/network transports, and per-server diagnostics. Build MCP closure as a dedicated main-process manager behind `/api/mcp` routes, then layer UI affordances for runtime control, tool discovery, tool invocation, and log inspection without bypassing the Host API.

**Tech Stack:** Electron 40, React 19, Vite 7, TypeScript 5.9, Vitest 4, Playwright 1.58, pnpm 10

---

## Chunk 1: MCP Runtime Backend Closure

### Task 1: Add MCP runtime manager coverage before implementation

**Files:**
- Create: `tests/unit/mcp-runtime-manager.test.ts`
- Modify: `vitest.config.ts`

- [ ] Write failing node-side tests covering stdio/server lifecycle, tool discovery, tool invocation, and per-server log buffering
- [ ] Mock MCP SDK client/transports so tests assert our orchestration logic instead of third-party internals
- [ ] Run `pnpm exec vitest run tests/unit/mcp-runtime-manager.test.ts --project node`

### Task 2: Implement main-process MCP runtime manager and host wiring

**Files:**
- Create: `electron/services/mcp/runtime-manager.ts`
- Modify: `electron/api/context.ts`
- Modify: `electron/main/index.ts`

- [ ] Implement a reusable MCP runtime manager that can connect stdio/http/sse servers, track runtime state, cache discovered tools, capture per-server logs, and stop cleanly
- [ ] Attach the manager to `HostApiContext` and initialize enabled MCP servers during app startup without blocking window creation
- [ ] Ensure app shutdown closes active MCP connections
- [ ] Run `pnpm exec vitest run tests/unit/mcp-runtime-manager.test.ts --project node`

### Task 3: Extend `/api/mcp` routes from config CRUD to runtime closure

**Files:**
- Create: `tests/unit/mcp-routes.test.ts`
- Modify: `electron/api/routes/mcp.ts`

- [ ] Write failing route tests for runtime-aware list responses and `start/stop/connect/listTools/callTool/logs`
- [ ] Refactor the route module to reuse shared config helpers and forward runtime actions to the new manager
- [ ] Keep config mutations synchronized with runtime state (for example enable/start, disable/stop, delete/stop)
- [ ] Run `pnpm exec vitest run tests/unit/mcp-routes.test.ts --project node`

## Chunk 2: MCP Runtime UI Closure

### Task 4: Add renderer tests for MCP runtime affordances

**Files:**
- Create: `tests/unit/mcp-tab.test.tsx`

- [ ] Write failing jsdom tests for runtime status rendering, start/stop actions, tool discovery visibility, tool invocation, and log viewing
- [ ] Mock `hostApiFetch` responses for runtime-aware endpoints
- [ ] Run `pnpm exec vitest run tests/unit/mcp-tab.test.tsx --project jsdom`

### Task 5: Upgrade the Skills MCP tab to control runtime, inspect tools, and read logs

**Files:**
- Modify: `src/pages/Skills/McpTab.tsx`

- [ ] Replace the config-only cards with runtime-aware cards that show status, tool counts, last error, and lifecycle actions
- [ ] Add expandable sections for discovered tools, a lightweight tool-call runner, and per-server log tail
- [ ] Preserve existing add/edit/delete CRUD flows while keeping all backend access on `hostApiFetch`
- [ ] Run `pnpm exec vitest run tests/unit/mcp-tab.test.tsx --project jsdom`

## Chunk 3: Release / Install / E2E Deepening

### Task 6: Expand Playwright smoke coverage beyond the single browser-preview flow

**Files:**
- Modify: `tests/e2e/app-smoke.spec.ts`
- Modify: `playwright.config.ts`

- [ ] Add at least one additional high-value smoke path covering another stable surface (for example Skills/MCP or Settings navigation)
- [ ] Keep the suite browser-preview friendly and deterministic in CI
- [ ] Run `pnpm run test:e2e`

### Task 7: Add release/install smoke entry points and CI enforcement

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/check.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `README.ja-JP.md`
- Create if needed: `scripts/install-smoke.mjs`
- Create if needed: `scripts/release-smoke.mjs`

- [ ] Add non-destructive release/install smoke scripts that validate the expected build artifacts or commands
- [ ] Wire the new smoke commands into CI without duplicating existing checks
- [ ] Update README command tables and caveats to match the actual scripts
- [ ] Run the new smoke commands locally

## Chunk 4: i18n Closure and Durable State

### Task 8: Add locale parity checks and fix the highest-signal hardcoded strings touched in this batch

**Files:**
- Create if needed: `scripts/check-locale-parity.mjs`
- Create if needed: `tests/unit/i18n-parity.test.ts`
- Modify: `src/i18n/index.ts`
- Modify: locale JSON files touched by new MCP strings
- Modify: any newly touched renderer files that still hardcode user-facing copy

- [ ] Add a parity/coverage check that compares locale namespaces and keys across `zh/en/ja`
- [ ] Move any new user-facing strings introduced by this batch into locale files instead of adding fresh hardcoded copy
- [ ] Run the parity check and any focused tests

### Task 9: Verify the batch and sync durable progress files

**Files:**
- Modify: `continue/task.json`
- Modify: `continue/progress.txt`
- Modify: `Prompt.md`

- [ ] Run `pnpm run typecheck`
- [ ] Run `pnpm exec tsc -p tsconfig.node.json --noEmit`
- [ ] Run `pnpm run lint`
- [ ] Run focused Vitest suites for MCP and any new parity checks
- [ ] Run `pnpm run build:vite`
- [ ] Run `pnpm run test:e2e`
- [ ] Update `continue/task.json`, append a factual `continue/progress.txt` entry, and mark down completed `Prompt.md` items without regressing the user’s “do not restore Docs/Export” constraints
