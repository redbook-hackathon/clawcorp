# Feishu Channel Closure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Feishu channel onboarding backlog by turning the current QR handoff into one integrated wizard that handles creation entry, credential save, app-scope recovery, user authorization, and final ready state without bouncing the user through unrelated surfaces.

**Architecture:** Keep all backend work in Electron host routes/services and keep the renderer on `hostApiFetch`. Extend the Feishu integration service to expose account-level onboarding readiness and enrich auth sessions, then update the Channels wizard to drive a single state machine for create/link/configure/authorize/complete. Preserve existing channel config persistence and gateway restart behavior instead of inventing a second config path.

**Tech Stack:** Electron 40, React 19, Vite 7, TypeScript 5.9, Vitest 4, pnpm 10

---

## Chunk 1: Service + Route Contract

### Task 1: Add failing node tests for richer Feishu onboarding status and config handoff

**Files:**
- Modify: `tests/unit/openclaw-feishu-integration.test.ts`
- Modify: `tests/unit/openclaw-feishu-routes.test.ts`

- [ ] Add a failing service test asserting `getFeishuIntegrationStatus()` exposes a configured account payload with readiness fields for credentials, app scopes, and recent authorization hints.
- [ ] Add a failing service test asserting a failed auth session returns app-permission QR/link metadata that the renderer can show directly.
- [ ] Add a failing route test for a Feishu config-save endpoint that persists credentials through the existing channel config path and returns the updated onboarding status.
- [ ] Run `pnpm exec vitest run tests/unit/openclaw-feishu-integration.test.ts tests/unit/openclaw-feishu-routes.test.ts --project node`

### Task 2: Implement richer Feishu onboarding service state and route support

**Files:**
- Modify: `electron/services/feishu-auth-runtime.ts`
- Modify: `electron/services/feishu-integration.ts`
- Modify: `electron/api/routes/feishu.ts`
- Modify: `electron/api/routes/channels.ts`

- [ ] Extend the auth runtime loader with any token/app-info helpers needed for status introspection.
- [ ] Expand Feishu status output to include account-level onboarding state that distinguishes “needs credentials”, “needs app scopes”, “ready for user auth”, and “authorized recently”.
- [ ] Add a dedicated Feishu config-save route that reuses the existing channel-config persistence path and returns updated status for the wizard.
- [ ] Keep plugin install/update behavior unchanged while letting the wizard re-check status after config and after permission recovery.
- [ ] Run `pnpm exec vitest run tests/unit/openclaw-feishu-integration.test.ts tests/unit/openclaw-feishu-routes.test.ts tests/unit/channels-routes.test.ts --project node`

## Chunk 2: Integrated Wizard Flow

### Task 3: Add failing jsdom tests for the integrated Feishu wizard

**Files:**
- Modify: `tests/unit/feishu-onboarding-wizard.test.tsx`
- Modify: `tests/unit/channels-page.test.tsx`

- [ ] Add a failing wizard test for the “new robot” path that shows creation QR, then continues in-place to credential entry instead of kicking the user out to a different modal.
- [ ] Add a failing wizard test for the app-scope-required path that renders a permission QR/link plus a “re-check” action.
- [ ] Add a failing Channels page test asserting the Feishu add flow stays inside the wizard and refreshes the page state after a config save.
- [ ] Run `pnpm exec vitest run tests/unit/feishu-onboarding-wizard.test.tsx tests/unit/channels-page.test.tsx --project jsdom`

### Task 4: Implement the Feishu wizard state machine and config step

**Files:**
- Modify: `src/components/channels/FeishuOnboardingWizard.tsx`
- Modify: `src/pages/Channels/index.tsx`
- Modify if needed: `src/stores/channels.ts`

- [ ] Replace the current split wizard/modal handoff with an in-wizard multi-step flow covering plugin readiness, create/link choice, credential save, app permission recovery, user authorization, and completion.
- [ ] Let the wizard save Feishu credentials via host routes, refresh channel state, and auto-advance into permission/auth steps when possible.
- [ ] Surface permission QR data when tenant scopes are missing and keep polling/retry behavior explicit instead of requiring the user to restart the whole flow.
- [ ] Keep the Channels page responsible for refreshing configured channel cards after the wizard completes.
- [ ] Run `pnpm exec vitest run tests/unit/feishu-onboarding-wizard.test.tsx tests/unit/channels-page.test.tsx --project jsdom`

## Chunk 3: Batch Verification + Durable Tracking

### Task 5: Verify and sync durable progress

**Files:**
- Modify: `continue/task.json`
- Modify: `continue/progress.txt`
- Modify: `Prompt.md`

- [ ] Run focused Vitest suites for Feishu onboarding and channel routes.
- [ ] Run `pnpm run typecheck`
- [ ] Run `pnpm exec tsc -p tsconfig.node.json --noEmit`
- [ ] Run `pnpm run lint`
- [ ] Run `pnpm run build:vite`
- [ ] Update durable tracking files with the Feishu closure delta and remaining backlog.
