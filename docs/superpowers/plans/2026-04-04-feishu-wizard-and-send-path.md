# Feishu Wizard And Send Path Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the Feishu-specific onboarding/auth wizard in the current channel workbench shape and route Feishu outbound sends through the plugin direct-send path so desktop sends actually reach Feishu.

**Architecture:** Keep the existing chat-first `/channels` page and only special-case Feishu at the integration boundaries. The renderer will reopen `FeishuOnboardingWizard` for Feishu add/edit flows, while the main-process send route will prefer `sendMessageFeishu()` for `feishu:*` conversations and fall back to runtime `chat.send` only if needed.

**Tech Stack:** React 19, TypeScript, Vitest, Electron main-process host API routes.

---

### Task 1: Lock failing UI and route tests

**Files:**
- Modify: `tests/unit/channels-page.test.tsx`
- Modify: `tests/unit/channel-sync-routes.test.ts`

- [ ] Add a failing page test proving current-channel quick-add for Feishu opens `FeishuOnboardingWizard`, not generic `ChannelConfigModal`.
- [ ] Add a failing page test proving Feishu settings/edit entry opens the Feishu wizard path.
- [ ] Add a failing route test proving Feishu send prefers plugin direct-send and does not call `chat.send` when plugin send is available.
- [ ] Run targeted Vitest commands and confirm the new tests fail for the expected reason.

### Task 2: Restore Feishu-specific UI entry points

**Files:**
- Modify: `src/pages/Channels/index.tsx`

- [ ] Route Feishu quick-add and settings/edit flows back to `FeishuOnboardingWizard` while leaving other channels on the current config paths.
- [ ] Preserve current product shape: settings drawer stays, but Feishu edit action launches the wizard instead of generic config modal.
- [ ] Keep WeChat and other channel behavior unchanged.

### Task 3: Fix Feishu outbound send path

**Files:**
- Modify: `electron/api/routes/channels.ts`
- Optional inspect only: `C:\Users\22688\.openclaw\extensions\feishu-openclaw-plugin\src\messaging\outbound\send.js`

- [ ] Change `POST /api/channels/:id/send` for `feishu:*` conversations to prefer plugin `sendMessageFeishu()`.
- [ ] Only fall back to runtime `chat.send` if plugin direct-send is unavailable or cannot be resolved.
- [ ] Preserve existing response shape enough for the renderer optimistic-refresh flow.

### Task 4: Verify and rebuild

**Files:**
- No additional product files expected

- [ ] Run focused tests for page, Feishu wizard, and channel sync routes.
- [ ] Run `pnpm run build:vite` to refresh Electron bundles.
- [ ] Report actual pass/fail counts and any residual risk.
