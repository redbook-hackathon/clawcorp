# KaiTianClaw Control Plane Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally adapt the existing ClawCorp codebase into the approved KaiTianClaw workbench UI, add the `continue/` persistence mechanism, and seed the first tracked task state without replacing the current app architecture.

**Architecture:** Keep the current Electron + Vite + React + Zustand skeleton. Refactor the existing main layout, sidebar, chat page, and settings page into a single workbench plus settings-center model. Use existing stores and pages where possible, add only focused helper components, and treat `continue/` as the durable project-memory layer for future sessions.

**Tech Stack:** React 19, React Router 7, TypeScript, Zustand persist, Tailwind CSS, i18next, Vitest, Testing Library

---

## File Map

### Existing files to modify

- `src/App.tsx`
  Route exposure strategy. Keep root workbench and `/settings/*` primary. Retain legacy routes only if needed for incremental safety.
- `src/components/layout/MainLayout.tsx`
  Keep the existing shell mount point, but ensure it supports the new workbench layout and settings-center content area cleanly.
- `src/components/layout/Sidebar.tsx`
  Refactor from route navigation into the approved left work-object sidebar with accordion groups for clones, teams, IM channels, and scheduled tasks.
- `src/pages/Chat/index.tsx`
  Evolve into the main workbench center area while reusing existing chat capabilities.
- `src/pages/Settings/index.tsx`
  Rebuild into grouped settings-center secondary navigation and content panels.
- `src/stores/settings.ts`
  Extend UI state persistence for the right context rail collapse state and reuse existing sidebar collapse state.
- `src/i18n/index.ts`
  Register any new namespace if needed.
- `src/i18n/locales/en/common.json`
- `src/i18n/locales/en/settings.json`
- `src/i18n/locales/zh/common.json`
- `src/i18n/locales/zh/settings.json`
- `src/i18n/locales/ja/common.json`
- `src/i18n/locales/ja/settings.json`
  Add the new workbench and settings-center labels. Prefer reusing existing namespaces unless a new `workbench.json` becomes clearer.
- `README.md`
- `README.zh-CN.md`
- `README.ja-JP.md`
  Update the UI/flow description if behavior or navigation meaning changes materially.

### New files to create

- `continue/AGENT.MD`
  Session recovery protocol and task-state workflow.
- `continue/task.json`
  Product-level source-of-truth task tree with design and implementation states.
- `continue/progress.txt`
  Append-only progress log seeded with the approved design decisions.
- `src/components/workbench/workbench-data.ts`
  Centralized mock/static UI data plus store-backed fallback shaping for teams, channels, tasks, and context cards.
- `src/components/workbench/accordion-group.tsx`
  Shared lightweight accordion group for the left sidebar.
- `src/components/workbench/context-rail.tsx`
  Right collapsible context rail.
- `src/components/workbench/workbench-empty-state.tsx`
  Center welcome/empty state card content for the workbench.
- `src/components/settings-center/settings-nav.tsx`
  Grouped secondary navigation for the settings center.
- `src/components/settings-center/settings-section-card.tsx`
  Reusable card shell for settings-center content blocks.
- `tests/unit/workbench-sidebar.test.tsx`
  Sidebar rendering and accordion structure tests.
- `tests/unit/workbench-context-rail.test.tsx`
  Right rail collapse/expand rendering tests.
- `tests/unit/settings-center.test.tsx`
  Settings-center grouped nav and active section tests.
- `tests/unit/settings-store-layout.test.ts`
  Store persistence tests for new UI layout flags.

### Existing files to reuse without large structural changes

- `src/pages/Chat/ChatInput.tsx`
  Reuse as the composer where possible, with layout adaptation only.
- `src/components/settings/ProvidersSettings.tsx`
  Reuse inside the `模型与 Provider` section.
- `src/components/settings/UpdateSettings.tsx`
  Reuse inside update/developer related settings content.
- `src/stores/chat.ts`, `src/stores/agents.ts`, `src/stores/channels.ts`, `src/stores/cron.ts`
  Reuse current store data where available instead of rebuilding data flow.

### Important implementation constraints

- Do not rewrite routing from scratch.
- Do not replace Zustand with another state layer.
- Do not remove legacy routes until the new workbench and settings-center shell is stable.
- The repository currently appears unsafe for normal checkpoint commits because the working tree is effectively all-untracked. Until tracking is verified, treat `continue/task.json` state changes and `progress.txt` entries as the durable checkpoint mechanism.

## Chunk 1: Persistence Foundation

### Task 1: Create the `continue/` durable workflow files

**Files:**
- Create: `continue/AGENT.MD`
- Create: `continue/task.json`
- Create: `continue/progress.txt`

- [ ] **Step 1: Write the initial failing validation check for the task tree file**

Create a shell validation step in the plan, not a runtime unit test:

```powershell
Get-Content continue\task.json | node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(0,'utf8')); console.log('task.json valid')"
```

Expected before file creation: command fails because `continue/task.json` does not exist.

- [ ] **Step 2: Create `continue/AGENT.MD`**

Include:
- required startup workflow
- required status flow: `brainstorming -> planned -> in_progress -> review -> done`
- explicit instruction to read `task.json` and `progress.txt` first
- explicit rule that design tasks cannot jump directly to implementation
- explicit rule to update `task.json` and `progress.txt` together at the end of a session

- [ ] **Step 3: Create `continue/task.json`**

Seed the product-level task tree with at least:

```json
{
  "project": "KaiTianClaw Control Plane",
  "objective": "Adapt the existing ClawCorp demo into the approved KaiTianClaw workbench UI and preserve project progress across sessions.",
  "current_phase": "planned",
  "current_focus": "PERSIST-001",
  "last_updated": "2026-03-17T00:00:00+08:00",
  "tasks": [
    {
      "id": "PERSIST-001",
      "title": "Establish continue/ persistence mechanism",
      "type": "ops",
      "status": "in_progress",
      "priority": "P0",
      "depends_on": [],
      "description": "Create AGENT.MD, task.json, and progress.txt in continue/ and use them as the durable source of session state.",
      "acceptance_criteria": [
        "continue/AGENT.MD exists",
        "continue/task.json exists and is valid JSON",
        "continue/progress.txt includes this planning session"
      ],
      "notes": "This task must complete before implementation tasks start.",
      "subtasks": []
    }
  ]
}
```

Also seed the design and build tasks from the approved spec:
- `DESIGN-001`
- `DESIGN-002`
- `DESIGN-003`
- `DESIGN-004`
- `PLAN-001`
- `BUILD-001`
- `BUILD-002`
- `BUILD-003`
- `BUILD-004`
- `VERIFY-001`

- [ ] **Step 4: Create `continue/progress.txt`**

Append one initial entry summarizing:
- approved workbench shell
- approved left sidebar groups including team
- approved settings-center grouping
- decision to modify current source incrementally

- [ ] **Step 5: Run the validation command and verify `task.json` parses**

Run:

```powershell
Get-Content continue\task.json | node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(0,'utf8')); console.log('task.json valid')"
```

Expected: `task.json valid`

- [ ] **Step 6: Update task state**

Inside `continue/task.json`:
- mark `PERSIST-001` as `review`
- set `current_focus` to `BUILD-001`

- [ ] **Step 7: Checkpoint**

If repository tracking is safe later:

```bash
git add continue/AGENT.MD continue/task.json continue/progress.txt
git commit -m "chore: add continue persistence workflow"
```

If repository tracking is still unsafe, skip the commit and rely on the `continue/` files as the checkpoint.

## Chunk 2: Shared UI State and Workbench Helpers

### Task 2: Extend persisted UI state for the new shell

**Files:**
- Modify: `src/stores/settings.ts`
- Test: `tests/unit/settings-store-layout.test.ts`

- [ ] **Step 1: Write the failing store test**

Create a new test that expects the store to persist the right context rail collapse flag.

Example test target:

```ts
it('stores the context rail collapse preference', async () => {
  const { useSettingsStore } = await import('@/stores/settings');
  useSettingsStore.getState().setContextRailCollapsed(true);
  expect(useSettingsStore.getState().contextRailCollapsed).toBe(true);
});
```

- [ ] **Step 2: Run the single test and verify it fails**

Run:

```bash
pnpm test -- tests/unit/settings-store-layout.test.ts
```

Expected: fail because `contextRailCollapsed` and setter do not exist.

- [ ] **Step 3: Add minimal store state**

Update `src/stores/settings.ts`:
- add `contextRailCollapsed: boolean`
- add `setContextRailCollapsed(value: boolean)`
- default value `false`
- persist it with the existing store

Reuse the existing `sidebarCollapsed` field for left-rail collapse instead of inventing a second left-collapse key.

- [ ] **Step 4: Run the single test and verify it passes**

Run:

```bash
pnpm test -- tests/unit/settings-store-layout.test.ts
```

Expected: pass.

- [ ] **Step 5: Checkpoint**

If repository tracking is safe:

```bash
git add src/stores/settings.ts tests/unit/settings-store-layout.test.ts
git commit -m "feat: persist workbench rail collapse state"
```

### Task 3: Create shared workbench mock and shaping helpers

**Files:**
- Create: `src/components/workbench/workbench-data.ts`

- [ ] **Step 1: Create the helper file**

Responsibilities:
- export team mock data
- export fallback channel/task/context data
- expose small shaping helpers to merge store-backed data with placeholders

The file should not fetch directly. It only shapes data for rendering.

- [ ] **Step 2: Keep the helpers intentionally small**

Include focused helpers like:

```ts
export function createTeamItems() { ... }
export function createContextCards() { ... }
export function createTaskItems() { ... }
```

Avoid putting component JSX in this file.

- [ ] **Step 3: Manual verification**

Run:

```bash
pnpm run typecheck
```

Expected: no new type errors from the helper module.

## Chunk 3: Left Workbench Sidebar

### Task 4: Refactor the existing sidebar into the approved accordion work-object sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Create: `src/components/workbench/accordion-group.tsx`
- Test: `tests/unit/workbench-sidebar.test.tsx`

- [ ] **Step 1: Write the failing sidebar render test**

Test for:
- clones accordion exists
- teams accordion exists
- IM channels accordion exists
- scheduled tasks accordion exists
- settings entry remains in the footer

Example assertions:

```tsx
expect(screen.getByText('分身')).toBeInTheDocument();
expect(screen.getByText('团队')).toBeInTheDocument();
expect(screen.getByText('IM 频道')).toBeInTheDocument();
expect(screen.getByText('定时任务')).toBeInTheDocument();
expect(screen.getByText('设置')).toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm test -- tests/unit/workbench-sidebar.test.tsx
```

Expected: fail because the current sidebar still renders route navigation labels.

- [ ] **Step 3: Create `accordion-group.tsx`**

This helper should:
- render header row
- support expanded/collapsed content
- keep styling lightweight
- allow optional count or subtitle

- [ ] **Step 4: Refactor `Sidebar.tsx`**

Keep the file as the top-level left shell, but replace its content strategy:
- remove primary route list from the main body
- keep footer settings entry
- keep collapse button behavior
- render four accordion groups:
  - clones: use actual chat sessions and agent names where available
  - teams: use static workbench data for now
  - IM channels: use `useChannelsStore()` when available, fallback to placeholder items
  - scheduled tasks: use `useCronStore()` when available, fallback to placeholder items

Important:
- the current session list must move inside the `分身` accordion, not remain outside it
- left collapse should shrink to an icon rail, not fully disappear

- [ ] **Step 5: Run the sidebar test again**

Run:

```bash
pnpm test -- tests/unit/workbench-sidebar.test.tsx
```

Expected: pass.

- [ ] **Step 6: Run targeted regression tests for existing session behavior**

Run:

```bash
pnpm test -- tests/unit/chat-session-actions.test.ts tests/unit/chat-history-actions.test.ts
```

Expected: pass.

- [ ] **Step 7: Checkpoint**

If repository tracking is safe:

```bash
git add src/components/layout/Sidebar.tsx src/components/workbench/accordion-group.tsx src/components/workbench/workbench-data.ts tests/unit/workbench-sidebar.test.tsx
git commit -m "feat: convert sidebar into workbench accordion rail"
```

## Chunk 4: Center Workbench and Right Context Rail

### Task 5: Add the right context rail component

**Files:**
- Create: `src/components/workbench/context-rail.tsx`
- Test: `tests/unit/workbench-context-rail.test.tsx`

- [ ] **Step 1: Write the failing context rail test**

Test for:
- expanded rail shows the approved cards
- collapsed rail shows a handle

Example:

```tsx
render(<WorkbenchContextRail collapsed={false} cards={[...]} onToggle={vi.fn()} />);
expect(screen.getByText('当前任务')).toBeInTheDocument();
```

- [ ] **Step 2: Run the single test and verify it fails**

Run:

```bash
pnpm test -- tests/unit/workbench-context-rail.test.tsx
```

Expected: fail because the component does not exist.

- [ ] **Step 3: Implement the minimal rail component**

Requirements:
- accepts `collapsed`
- accepts `onToggle`
- accepts normalized context card data
- renders a compact collapse handle in collapsed mode
- stays visually lightweight

- [ ] **Step 4: Run the rail test and verify it passes**

Run:

```bash
pnpm test -- tests/unit/workbench-context-rail.test.tsx
```

Expected: pass.

### Task 6: Evolve the current chat page into the approved center workbench

**Files:**
- Modify: `src/pages/Chat/index.tsx`
- Create: `src/components/workbench/workbench-empty-state.tsx`
- Modify: `src/components/layout/MainLayout.tsx`
- Optionally modify: `src/pages/Chat/ChatInput.tsx`
- Test: `tests/unit/chat-input.test.tsx`

- [ ] **Step 1: Write the failing workbench shell render test**

Prefer a focused render test inside a new file or extend existing tests to assert:
- top quick actions contain `文件`, `Agent`, `快速配置`
- right context rail is mounted beside the chat/work area
- bottom composer still exists

- [ ] **Step 2: Run the workbench shell test and verify it fails**

Run the relevant test file:

```bash
pnpm test -- tests/unit/workbench-shell.test.tsx
```

Expected: fail because the current chat page does not render the new shell.

- [ ] **Step 3: Update `MainLayout.tsx` minimally**

Do not replace the overall shell.
Keep:
- title bar
- left sidebar mount
- main content region

Adjust only spacing and overflow behavior needed for the new workbench.

- [ ] **Step 4: Refactor `src/pages/Chat/index.tsx`**

Keep current chat runtime wiring, but change layout responsibilities:
- top row: clone title + quick actions
- center: welcome/empty/work area
- right side: `WorkbenchContextRail`
- bottom: existing composer

Use `WorkbenchEmptyState` for the blank state instead of the current generic welcome layout.

- [ ] **Step 5: Update `ChatInput.tsx` only if needed**

Keep send behavior intact.
Only change:
- placeholder copy
- spacing or chrome
- visual framing that matches the new shell

Do not rewrite send logic.

- [ ] **Step 6: Run the new shell test**

Run:

```bash
pnpm test -- tests/unit/workbench-shell.test.tsx
```

Expected: pass.

- [ ] **Step 7: Run existing composer and routing tests**

Run:

```bash
pnpm test -- tests/unit/chat-input.test.tsx tests/unit/app-routes.test.ts
```

Expected: pass.

- [ ] **Step 8: Checkpoint**

If repository tracking is safe:

```bash
git add src/components/layout/MainLayout.tsx src/pages/Chat/index.tsx src/pages/Chat/ChatInput.tsx src/components/workbench/context-rail.tsx src/components/workbench/workbench-empty-state.tsx tests/unit/workbench-context-rail.test.tsx tests/unit/workbench-shell.test.tsx
git commit -m "feat: add workbench center and context rail"
```

## Chunk 5: Settings Center

### Task 7: Add grouped settings-center navigation and section shells

**Files:**
- Modify: `src/pages/Settings/index.tsx`
- Create: `src/components/settings-center/settings-nav.tsx`
- Create: `src/components/settings-center/settings-section-card.tsx`
- Test: `tests/unit/settings-center.test.tsx`

- [ ] **Step 1: Write the failing settings-center test**

Assert:
- grouped nav headings exist
- the `团队与角色策略` section can render as active
- the main panel area renders cards for the active section

Example assertions:

```tsx
expect(screen.getByText('基础')).toBeInTheDocument();
expect(screen.getByText('工作流')).toBeInTheDocument();
expect(screen.getByText('能力')).toBeInTheDocument();
expect(screen.getByText('治理')).toBeInTheDocument();
expect(screen.getByText('团队与角色策略')).toBeInTheDocument();
```

- [ ] **Step 2: Run the settings-center test and verify it fails**

Run:

```bash
pnpm test -- tests/unit/settings-center.test.tsx
```

Expected: fail because the current settings page is still a long scrolling section list.

- [ ] **Step 3: Create the grouped nav helper**

`settings-nav.tsx` should:
- render grouped section headings
- render active/inactive items
- support simple route-segment or local-section activation

- [ ] **Step 4: Create the reusable content card helper**

`settings-section-card.tsx` should:
- wrap subsection blocks consistently
- support title, description, and optional list content

- [ ] **Step 5: Refactor `Settings/index.tsx` incrementally**

Keep and reuse current functional sections where possible:
- `模型与 Provider`: embed `ProvidersSettings`
- `网络与代理`: reuse current proxy controls
- `常规`: reuse appearance and launch settings
- `反馈与开发者`: reuse developer and doctor tools

Add static PRD-aligned placeholder sections for:
- 团队与角色策略
- 通道高级配置
- 自动化默认策略
- 记忆与知识
- Skills 与 MCP
- 工具权限
- 监控与统计策略
- 安全与审批
- 迁移与备份

Important:
- do not throw away working current settings code
- reorganize it under the new grouped shell

- [ ] **Step 6: Run the settings-center test again**

Run:

```bash
pnpm test -- tests/unit/settings-center.test.tsx
```

Expected: pass.

- [ ] **Step 7: Run settings-related regression tests**

Run:

```bash
pnpm test -- tests/unit/proxy.test.ts tests/unit/openclaw-doctor.test.ts tests/unit/openclaw-control-ui.test.ts
```

Expected: pass.

- [ ] **Step 8: Checkpoint**

If repository tracking is safe:

```bash
git add src/pages/Settings/index.tsx src/components/settings-center/settings-nav.tsx src/components/settings-center/settings-section-card.tsx tests/unit/settings-center.test.tsx
git commit -m "feat: turn settings into grouped settings center"
```

## Chunk 6: i18n, Route Exposure, and Documentation

### Task 8: Add or update translation keys for the new workbench and settings-center UI

**Files:**
- Modify: `src/i18n/index.ts`
- Modify: `src/i18n/locales/en/common.json`
- Modify: `src/i18n/locales/en/settings.json`
- Modify: `src/i18n/locales/zh/common.json`
- Modify: `src/i18n/locales/zh/settings.json`
- Modify: `src/i18n/locales/ja/common.json`
- Modify: `src/i18n/locales/ja/settings.json`
- Optionally create: `src/i18n/locales/{en,zh,ja}/workbench.json`

- [ ] **Step 1: Decide namespace strategy**

Use one of:
- extend `common` and `settings` only, or
- add a new `workbench` namespace and register it in `src/i18n/index.ts`

Prefer the new namespace only if the key volume is large enough to justify it.

- [ ] **Step 2: Add the missing labels**

At minimum include:
- 分身
- 团队
- IM 频道
- 定时任务
- 文件
- Agent
- 快速配置
- 当前任务
- 当前文件
- 通道状态
- settings-center group names

- [ ] **Step 3: Run typecheck and targeted UI tests**

Run:

```bash
pnpm run typecheck
pnpm test -- tests/unit/workbench-sidebar.test.tsx tests/unit/settings-center.test.tsx
```

Expected: pass.

### Task 9: Review and update product-facing docs if the new UI meaning changed

**Files:**
- Modify if needed: `README.md`
- Modify if needed: `README.zh-CN.md`
- Modify if needed: `README.ja-JP.md`

- [ ] **Step 1: Review whether the current docs still describe the app accurately**

Check whether the main app is still described as:
- chat-first
- route-driven through legacy pages

- [ ] **Step 2: If inaccurate, update only the relevant UI/flow descriptions**

Keep the edits minimal:
- mention the workbench shell
- mention the left work-object rail
- mention settings-center grouping if exposed to users

- [ ] **Step 3: Checkpoint**

If repository tracking is safe:

```bash
git add README.md README.zh-CN.md README.ja-JP.md
git commit -m "docs: update UI flow for KaiTianClaw workbench"
```

## Chunk 7: Verification and Task State Update

### Task 10: Verify the implementation and advance the continue task tree

**Files:**
- Modify: `continue/task.json`
- Modify: `continue/progress.txt`

- [ ] **Step 1: Run unit tests for the new shell**

Run:

```bash
pnpm test -- tests/unit/workbench-sidebar.test.tsx tests/unit/workbench-context-rail.test.tsx tests/unit/settings-center.test.tsx tests/unit/settings-store-layout.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run broader regression checks**

Run:

```bash
pnpm test -- tests/unit/chat-input.test.tsx tests/unit/proxy.test.ts tests/unit/openclaw-doctor.test.ts tests/unit/openclaw-control-ui.test.ts
```

Expected: all pass.

- [ ] **Step 3: Run static verification**

Run:

```bash
pnpm run typecheck
pnpm run lint
pnpm run build:vite
```

Expected:
- typecheck passes
- lint passes
- Vite build passes

- [ ] **Step 4: Record progress**

Append a new `continue/progress.txt` session entry with:
- files changed
- tests run
- final UI decisions landed
- next work item recommendation

- [ ] **Step 5: Update `continue/task.json`**

Advance task states:
- `PERSIST-001` -> `done`
- `BUILD-001` / `BUILD-002` / `BUILD-003` as appropriate
- set `current_focus` to the next unfinished task

- [ ] **Step 6: Final checkpoint**

If repository tracking is safe:

```bash
git add continue/task.json continue/progress.txt src docs tests
git commit -m "feat: land KaiTianClaw workbench shell and settings center"
```

If repository tracking is still unsafe, explicitly skip the commit and rely on `continue/` progress tracking.

## Local Review Notes

- This plan intentionally modifies current source files instead of replacing the app structure.
- The plan keeps legacy routes and existing settings/provider logic available for incremental safety.
- The plan places persistence first so session loss cannot erase design and build context again.
- The repository currently appears unsafe for normal incremental git commits. Validate repository tracking before using the commit steps above.

Plan complete and saved to `docs/superpowers/plans/2026-03-17-kaitianclaw-control-plane-implementation.md`. Ready to execute?
