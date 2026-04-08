# Channel Recovery And Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore visible channel entries, recover Feishu/WeChat channel management, fix WeChat onboarding persistence, and reintroduce a reference-aligned path for configuring additional channels.

**Architecture:** Keep the current chat-first workbench for configured channels, but restore a stable configuration layer underneath it. Normalize OpenClaw channel ids at the frontend boundary, add config-backed fallback when runtime status is unavailable, expose a reference-style channel accounts view from the backend, and wire `/channels` back to `ChannelConfigModal` for Feishu and non-workbench channels while preserving the dedicated WeChat QR onboarding flow.

**Tech Stack:** React 19, Zustand, Electron host API routes, OpenClaw config helpers, Vitest.

---

## Chunk 1: Channel Identity And Fallback Recovery

### Task 1: Add frontend channel alias helpers

**Files:**
- Create: `src/lib/channel-alias.ts`
- Test: `tests/unit/channels-store.test.ts`

- [ ] **Step 1: Write the failing test**

Add a store test asserting `channels.status` entries using `openclaw-weixin` become UI channels of type `wechat`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/channels-store.test.ts`
Expected: FAIL because the current store keeps the raw runtime type.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/channel-alias.ts` with:
- `UI_WECHAT_CHANNEL_TYPE`
- `OPENCLAW_WECHAT_CHANNEL_TYPE`
- `toOpenClawChannelType()`
- `toUiChannelType()`
- `isWechatChannelType()`
- `usesPluginManagedQrAccounts()`
- `buildQrChannelEventName()`
- `normalizeOpenClawAccountId()`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/unit/channels-store.test.ts`
Expected: PASS for the new alias coverage.

- [ ] **Step 5: Commit**

```bash
git add src/lib/channel-alias.ts tests/unit/channels-store.test.ts
git commit -m "test: cover frontend channel alias mapping"
```

### Task 2: Restore status parsing and config fallback in the channels store

**Files:**
- Create: `src/lib/channel-status.ts`
- Modify: `src/stores/channels.ts`
- Test: `tests/unit/channels-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- `fetchChannels()` falling back to `/api/channels/configured` when `channels.status` RPC fails
- fallback creating visible `feishu-default` / `wechat-default` channels
- status parsing using recent activity / probe flags

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/channels-store.test.ts`
Expected: FAIL because the store currently clears channels on RPC failure and lacks alias-aware parsing.

- [ ] **Step 3: Write minimal implementation**

Port the reference helpers into `src/lib/channel-status.ts`, then update `src/stores/channels.ts` to:
- normalize runtime ids via `toUiChannelType()` / `toOpenClawChannelType()`
- compute status through the shared helpers
- use `CHANNEL_NAMES` fallback labels
- fallback to `hostApiFetch('/api/channels/configured')` when runtime RPC fails
- build synthetic `*-default` channels from config-only fallback results

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/channels-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/channel-status.ts src/stores/channels.ts tests/unit/channels-store.test.ts
git commit -m "fix: restore channel store alias mapping and fallback"
```

## Chunk 2: Reference-Style Channel Accounts View

### Task 3: Add configured account aggregation in channel config utilities

**Files:**
- Modify: `electron/utils/channel-config.ts`
- Test: `tests/unit/channel-config.test.ts`

- [ ] **Step 1: Write the failing tests**

Add coverage for:
- `listConfiguredChannelAccounts()` returning configured accounts by channel type
- `setChannelDefaultAccount()` updating `defaultAccount`
- WeChat/OpenClaw ids staying stored under `openclaw-weixin`

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/channel-config.test.ts`
Expected: FAIL because the utility functions do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Port the reference implementations for:
- `ConfiguredChannelAccounts`
- `listConfiguredChannelAccounts()`
- `setChannelDefaultAccount()`

Keep existing save/delete behavior intact.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/channel-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/utils/channel-config.ts tests/unit/channel-config.test.ts
git commit -m "feat: expose configured channel accounts metadata"
```

### Task 4: Add `/api/channels/accounts` and default-account routes

**Files:**
- Modify: `electron/api/routes/channels.ts`
- Test: `tests/unit/channels-routes.test.ts`

- [ ] **Step 1: Write the failing tests**

Add route tests for:
- `GET /api/channels/accounts`
- `PUT /api/channels/default-account`
- mixed config/runtime account aggregation
- UI alias mapping from `openclaw-weixin` to `wechat`

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/channels-routes.test.ts`
Expected: FAIL because these routes and mocks are incomplete.

- [ ] **Step 3: Write minimal implementation**

Bring over the reference account-view builder logic into `electron/api/routes/channels.ts`:
- merge `listConfiguredChannels()`
- merge `listConfiguredChannelAccounts()`
- merge runtime `channels.status`
- expose `/api/channels/accounts`
- expose `/api/channels/default-account`

Also update the route tests to mock `electron.app.getPath()` so route imports stop crashing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/channels-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/api/routes/channels.ts tests/unit/channels-routes.test.ts
git commit -m "feat: add channel accounts management routes"
```

## Chunk 3: Channels Page Recovery

### Task 5: Make URL and active channel resolution deterministic

**Files:**
- Modify: `src/pages/Channels/index.tsx`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add or update tests for:
- router search being authoritative when the stored active channel is stale or missing
- WeChat sessions loading through `?channel=wechat`
- fallback to the first configured channel when no exact active id exists

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx --testNamePattern "router search|wechat sessions"`
Expected: FAIL with empty session list or wrong channel selection.

- [ ] **Step 3: Write minimal implementation**

Refactor `src/pages/Channels/index.tsx` channel selection so it:
- derives a selected channel from URL + current store contents
- repairs stale `activeChannelId`
- does not keep Feishu selected when only `wechat-default` matches the route

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx --testNamePattern "router search|wechat sessions"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Channels/index.tsx tests/unit/channels-page.test.tsx
git commit -m "fix: stabilize channels page selection logic"
```

### Task 6: Restore channel configuration entry points

**Files:**
- Modify: `src/pages/Channels/index.tsx`
- Modify: `src/components/channels/BotBindingModal.tsx`
- Test: `tests/unit/channels-page.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add/update tests for:
- settings opening channel configuration, not crashing
- the page still keeping the chat pane visible while config is open
- `BotBindingModal` tolerating empty `agents` / `teams` arrays

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx --testNamePattern "settings|channel controls"`
Expected: FAIL because the current settings button opens the binding modal and crashes under sparse store mocks.

- [ ] **Step 3: Write minimal implementation**

Update `/channels` to:
- use `ChannelConfigModal` for add/configure flows
- preserve the existing WeChat QR wizard as a dedicated onboarding path
- keep bot binding as a separate action if needed

Harden `BotBindingModal` by defaulting `agents` / `teams` to arrays before `.find()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/channels-page.test.tsx --testNamePattern "settings|channel controls"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Channels/index.tsx src/components/channels/BotBindingModal.tsx tests/unit/channels-page.test.tsx
git commit -m "fix: restore channel configuration entry points"
```

## Chunk 4: WeChat Onboarding Reliability

### Task 7: Align WeChat plugin install and onboarding persistence with reference

**Files:**
- Modify: `electron/api/routes/channels.ts`
- Modify: `electron/utils/wechat-login.ts`
- Modify: `src/components/channels/WeChatOnboardingWizard.tsx`
- Test: `tests/unit/channel-sync-routes.test.ts`

- [ ] **Step 1: Write the failing tests**

Add coverage for:
- WeChat plugin installation using `openclaw-weixin`
- QR status returning persisted account ids
- successful login creating account-state files or calling the persistence path

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/channel-sync-routes.test.ts`
Expected: FAIL for the new WeChat onboarding persistence assertions.

- [ ] **Step 3: Write minimal implementation**

Update WeChat flow to match the reference contract:
- install/candidate source should target `openclaw-weixin`
- login manager should persist normalized account ids into `.openclaw/openclaw-weixin/accounts`
- wizard should surface QR/status errors clearly and complete against persisted account data

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/channel-sync-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/api/routes/channels.ts electron/utils/wechat-login.ts src/components/channels/WeChatOnboardingWizard.tsx tests/unit/channel-sync-routes.test.ts
git commit -m "fix: align wechat onboarding with openclaw account persistence"
```

## Final Verification

### Task 8: Run focused verification

**Files:**
- Modify: none
- Test: `tests/unit/channels-store.test.ts`
- Test: `tests/unit/channels-page.test.tsx`
- Test: `tests/unit/channel-sync-routes.test.ts`
- Test: `tests/unit/channels-routes.test.ts`

- [ ] **Step 1: Run focused unit tests**

Run:
```bash
pnpm exec vitest run tests/unit/channels-store.test.ts tests/unit/channels-page.test.tsx tests/unit/channel-sync-routes.test.ts tests/unit/channels-routes.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Review docs impact**

Check whether `README.md`, `README.zh-CN.md`, and `README.ja-JP.md` need updates for restored channel management behavior.

- [ ] **Step 4: Commit final integration**

```bash
git add docs/superpowers/plans/2026-04-02-channel-recovery-and-management.md
git commit -m "docs: add channel recovery implementation plan"
```
