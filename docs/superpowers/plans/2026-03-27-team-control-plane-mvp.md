# Team Control Plane MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn ClawCorp's current team pages into a role-aware team control plane by adding explicit team semantics to agents and surfacing live team state through existing runtime and kanban data.

**Architecture:** Extend the existing `agent` config and snapshot pipeline with a small set of persistent team fields, then reuse the current `agents` store, `AgentDetail`, `TeamOverview`, and `TeamMap` surfaces to render those semantics. Do not add a new persisted `Team` entity or a new runtime system; aggregate the already-existing runtime, child-run, and activity signals into team-facing views.

**Tech Stack:** Electron host API routes, TypeScript, React 19, Zustand, React Router 7, i18next, Tailwind CSS, Vitest, Testing Library

---

## File Map

### Existing files to modify

- `src/types/agent.ts`
  - Add team-specific agent fields used by the renderer.
- `src/stores/agents.ts`
  - Extend the update payload typing so team metadata can be saved through the existing store.
- `electron/utils/agent-config.ts`
  - Persist new team fields in OpenClaw config entries and include them in derived snapshots.
- `electron/api/routes/agents.ts`
  - Accept and validate the new team fields in the existing `PUT /api/agents/:id` route.
- `src/pages/AgentDetail/index.tsx`
  - Turn the page into the primary team-member configuration surface.
- `src/pages/TeamOverview/index.tsx`
  - Upgrade cards from static profile summaries to role-aware team status cards.
- `src/pages/TeamMap/index.tsx`
  - Upgrade the map to reflect role/access semantics and basic runtime activity cues.
- `src/i18n/locales/en/agents.json`
- `src/i18n/locales/zh/agents.json`
- `src/i18n/locales/en/common.json`
- `src/i18n/locales/zh/common.json`
  - Add the new team configuration and display strings.
- `README.md`
- `README.zh-CN.md`
  - Update documentation if the team workflow and agent semantics become user-visible.

### Existing tests to modify

- `tests/unit/agent-detail-page.test.tsx`
  - Cover the new configuration UI and saved semantics.
- `tests/unit/team-overview-page.test.tsx`
  - Cover role, responsibility, access mode, and activity display.
- `tests/unit/team-map-page.test.tsx`
  - Cover role-aware hierarchy display and drawer details.

### New tests to create

- `tests/unit/agent-config-team-fields.test.ts`
  - Validate config snapshot derivation and persistence behavior for the new fields.
- `tests/unit/agent-routes-team-fields.test.ts`
  - Validate route payload handling for the new fields.

### Reusable existing systems to lean on

- `useAgentsStore` snapshot hydration and update flow
- `useChatStore().sessionLastActivity`
- existing runtime/kanban child-run and status signals
- current `reportsTo / directReports` hierarchy derivation

### Constraints

- Keep renderer-to-backend communication on `hostApiFetch()` and existing host routes.
- Do not invent a new persisted `Team` backend entity in this phase.
- Do not treat skills as team members.
- Do not build a new runtime orchestration layer; aggregate existing runtime state.
- Keep `AgentDetail` as the primary per-member configuration surface. Do not move member-level settings into `Settings`.

## Chunk 1: Team Semantics in the Agent Model

### Task 1: Add persistent team fields to the agent config pipeline

**Files:**
- Modify: `src/types/agent.ts`
- Modify: `src/stores/agents.ts`
- Modify: `electron/utils/agent-config.ts`
- Test: `tests/unit/agent-config-team-fields.test.ts`

- [ ] **Step 1: Write the failing config-level test**

Create `tests/unit/agent-config-team-fields.test.ts` covering two behaviors:

```ts
it('includes team role, chat access, and responsibility in the derived snapshot', async () => {
  // arrange config entries with explicit team fields
  // act on build/list snapshot helper
  // assert snapshot.agents includes those fields
});

it('falls back to sensible defaults for legacy agents without team fields', async () => {
  // assert teamRole/chatAccess/responsibility are derived safely
});
```

- [ ] **Step 2: Run the new config test and verify it fails**

Run:

```bash
pnpm test -- --run tests/unit/agent-config-team-fields.test.ts
```

Expected: FAIL because the snapshot types and helpers do not yet expose the new fields.

- [ ] **Step 3: Extend the shared renderer type**

Update `src/types/agent.ts` to add:

```ts
export type AgentTeamRole = 'leader' | 'worker';
export type AgentChatAccess = 'direct' | 'leader_only';
```

and extend `AgentSummary` with:

- `teamRole`
- `chatAccess`
- `responsibility`

- [ ] **Step 4: Extend the store update contract**

Update `src/stores/agents.ts` so `updateAgent()` accepts:

- `teamRole`
- `chatAccess`
- `responsibility`

Keep the payload structure aligned with the host route body.

- [ ] **Step 5: Persist the fields in config utilities**

In `electron/utils/agent-config.ts`:

- extend `AgentListEntry`
- extend the exported `AgentSummary`
- derive safe defaults for legacy data
- include the new fields in `buildSnapshotFromConfig()`
- persist updates in `updateAgentProfile()`

Recommended legacy defaults:

- default agent -> `teamRole: 'leader'`
- non-default agents -> `teamRole: 'worker'`
- all existing agents -> `chatAccess: 'direct'`
- missing `responsibility` -> empty string

- [ ] **Step 6: Run the config test again**

Run:

```bash
pnpm test -- --run tests/unit/agent-config-team-fields.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run focused type checking**

Run:

```bash
pnpm run typecheck
```

Expected: PASS with the new agent fields recognized across the renderer and host layers.

- [ ] **Step 8: Commit**

```bash
git add src/types/agent.ts src/stores/agents.ts electron/utils/agent-config.ts tests/unit/agent-config-team-fields.test.ts
git commit -m "feat: add agent team semantics to config snapshots"
```

## Chunk 2: Host Route Support for Team Metadata

### Task 2: Accept team fields through the existing agent update route

**Files:**
- Modify: `electron/api/routes/agents.ts`
- Test: `tests/unit/agent-routes-team-fields.test.ts`

- [ ] **Step 1: Write the failing route test**

Create `tests/unit/agent-routes-team-fields.test.ts` with a focused route assertion:

```ts
it('passes teamRole, chatAccess, and responsibility through the update route', async () => {
  // mock updateAgentProfile
  // send PUT /api/agents/:id with new fields
  // assert updateAgentProfile receives the full payload
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
pnpm test -- --run tests/unit/agent-routes-team-fields.test.ts
```

Expected: FAIL because the route body typing and forwarded payload do not yet include the new fields.

- [ ] **Step 3: Extend the route payload typing**

Update `electron/api/routes/agents.ts` so the `PUT /api/agents/:id` body accepts:

- `teamRole`
- `chatAccess`
- `responsibility`

Forward them into `updateAgentProfile()` only when present.

- [ ] **Step 4: Re-run the route test**

Run:

```bash
pnpm test -- --run tests/unit/agent-routes-team-fields.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run both backend-focused tests together**

Run:

```bash
pnpm test -- --run tests/unit/agent-config-team-fields.test.ts tests/unit/agent-routes-team-fields.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add electron/api/routes/agents.ts tests/unit/agent-routes-team-fields.test.ts
git commit -m "feat: support team metadata in agent routes"
```

## Chunk 3: AgentDetail as the Team Rule Configuration Surface

### Task 3: Add editable team-role controls to AgentDetail

**Files:**
- Modify: `src/pages/AgentDetail/index.tsx`
- Modify: `src/stores/agents.ts`
- Modify: `src/i18n/locales/en/agents.json`
- Modify: `src/i18n/locales/zh/agents.json`
- Test: `tests/unit/agent-detail-page.test.tsx`

- [ ] **Step 1: Write the failing UI test**

Extend `tests/unit/agent-detail-page.test.tsx` with assertions that the page:

- shows team role
- shows chat access mode
- shows responsibility
- saves updated values through the agents store or host API flow

Example target:

```ts
it('renders and saves team configuration fields', async () => {
  // render AgentDetail
  // change team role, chat access, responsibility
  // submit save
  // assert update flow receives the new values
});
```

- [ ] **Step 2: Run the AgentDetail test and verify it fails**

Run:

```bash
pnpm test -- --run tests/unit/agent-detail-page.test.tsx
```

Expected: FAIL because the page is currently read-only for team semantics.

- [ ] **Step 3: Add the team configuration section**

In `src/pages/AgentDetail/index.tsx`, add a focused editable section for:

- `teamRole`
- `chatAccess`
- `responsibility`
- `reportsTo`

Design requirements:

- explain each field's effect in plain language
- keep metadata and avatar sections intact
- do not move these controls into `Settings`

- [ ] **Step 4: Hook the controls into the existing update flow**

Use `useAgentsStore().updateAgent()` so the page saves through the existing host route rather than making a parallel API path.

- [ ] **Step 5: Add localization strings**

Add labels, descriptions, and value text for the new team semantics in:

- `src/i18n/locales/en/agents.json`
- `src/i18n/locales/zh/agents.json`

- [ ] **Step 6: Re-run the AgentDetail test**

Run:

```bash
pnpm test -- --run tests/unit/agent-detail-page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/AgentDetail/index.tsx src/i18n/locales/en/agents.json src/i18n/locales/zh/agents.json tests/unit/agent-detail-page.test.tsx
git commit -m "feat: add team role controls to agent detail"
```

## Chunk 4: TeamOverview as the Team Control Plane Homepage

### Task 4: Render role-aware member status cards in TeamOverview

**Files:**
- Modify: `src/pages/TeamOverview/index.tsx`
- Modify: `src/i18n/locales/en/common.json`
- Modify: `src/i18n/locales/zh/common.json`
- Test: `tests/unit/team-overview-page.test.tsx`

- [ ] **Step 1: Write the failing TeamOverview test**

Extend `tests/unit/team-overview-page.test.tsx` so member cards must show:

- leader vs worker label
- responsibility text
- direct-chat vs leader-only access text
- activity state label

Example target:

```ts
expect(screen.getByText('Leader')).toBeInTheDocument();
expect(screen.getByText('Requirements triage')).toBeInTheDocument();
expect(screen.getByText('Leader only')).toBeInTheDocument();
expect(screen.getByText('Active')).toBeInTheDocument();
```

- [ ] **Step 2: Run the TeamOverview test and verify it fails**

Run:

```bash
pnpm test -- --run tests/unit/team-overview-page.test.tsx
```

Expected: FAIL because cards currently show only basic agent metadata.

- [ ] **Step 3: Add derived team-state helpers to the page**

Inside `src/pages/TeamOverview/index.tsx`, derive card-level display state from:

- `teamRole`
- `chatAccess`
- `responsibility`
- `sessionLastActivity`

Use simple first-pass activity labels:

- `active`
- `idle`

Do not invent a new backend aggregate yet.

- [ ] **Step 4: Upgrade the member card layout**

Update cards so a user can tell at a glance:

- who leads
- who executes
- who is backend-only
- what each member is responsible for

Avoid replacing the whole page shell; evolve the existing card structure.

- [ ] **Step 5: Add localized strings**

Add the required role, access, and activity labels to:

- `src/i18n/locales/en/common.json`
- `src/i18n/locales/zh/common.json`

- [ ] **Step 6: Re-run the TeamOverview test**

Run:

```bash
pnpm test -- --run tests/unit/team-overview-page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/TeamOverview/index.tsx src/i18n/locales/en/common.json src/i18n/locales/zh/common.json tests/unit/team-overview-page.test.tsx
git commit -m "feat: upgrade team overview to role-aware status cards"
```

## Chunk 5: TeamMap as Structure Plus Activity

### Task 5: Render role/access semantics and activity cues in TeamMap

**Files:**
- Modify: `src/pages/TeamMap/index.tsx`
- Modify: `src/i18n/locales/en/common.json`
- Modify: `src/i18n/locales/zh/common.json`
- Test: `tests/unit/team-map-page.test.tsx`

- [ ] **Step 1: Write the failing TeamMap test**

Extend `tests/unit/team-map-page.test.tsx` to require:

- role-aware node text
- access-mode indicator in the node or drawer
- responsibility shown in the drawer

Example target:

```ts
expect(screen.getByText('Worker')).toBeInTheDocument();
expect(screen.getByText('Leader only')).toBeInTheDocument();
expect(screen.getByText('Finds supporting evidence')).toBeInTheDocument();
```

- [ ] **Step 2: Run the TeamMap test and verify it fails**

Run:

```bash
pnpm test -- --run tests/unit/team-map-page.test.tsx
```

Expected: FAIL because the map currently lacks role/access semantics.

- [ ] **Step 3: Add semantic presentation to map nodes**

In `src/pages/TeamMap/index.tsx`, update nodes and/or badges so they visually distinguish:

- leaders
- workers
- backend-only workers

Keep hierarchy and zoom behavior intact.

- [ ] **Step 4: Add drawer details for team semantics**

Extend the drawer to show:

- team role
- chat access
- responsibility
- existing channels/workspace/session metadata

- [ ] **Step 5: Reuse existing activity logic**

Keep activity driven by `sessionLastActivity`.
Do not add a new runtime polling loop in this task.

- [ ] **Step 6: Re-run the TeamMap test**

Run:

```bash
pnpm test -- --run tests/unit/team-map-page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/TeamMap/index.tsx src/i18n/locales/en/common.json src/i18n/locales/zh/common.json tests/unit/team-map-page.test.tsx
git commit -m "feat: add role-aware semantics to team map"
```

## Chunk 6: Runtime-Aware Team Visibility and Final Verification

### Task 6: Fold existing runtime/kanban signals into team-facing visibility and close docs

**Files:**
- Modify: `src/pages/TeamOverview/index.tsx`
- Modify: `src/pages/TeamMap/index.tsx`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Test: `tests/unit/team-overview-page.test.tsx`
- Test: `tests/unit/team-map-page.test.tsx`

- [ ] **Step 1: Write or extend failing assertions for runtime-aware display**

Add focused assertions that team pages reflect existing runtime-derived activity rather than only static profile data.

Keep this at the level of:

- active vs idle derived from current state
- recent activity surfaced in the UI

Do not add speculative tests for features outside the MVP.

- [ ] **Step 2: Run the focused team-page tests and verify failures**

Run:

```bash
pnpm test -- --run tests/unit/team-overview-page.test.tsx tests/unit/team-map-page.test.tsx
```

Expected: FAIL until the final display wiring is complete.

- [ ] **Step 3: Tighten the display language around current work**

Update the team pages so the user can distinguish:

- long-lived member role
- current activity state
- recent work visibility

Prefer light aggregation of existing signals over adding new backend APIs.

- [ ] **Step 4: Update docs if user-facing behavior changed**

Refresh:

- `README.md`
- `README.zh-CN.md`

Document the new team semantics if the surfaced workflow is now materially different.

- [ ] **Step 5: Run the focused unit suite**

Run:

```bash
pnpm test -- --run tests/unit/agent-config-team-fields.test.ts tests/unit/agent-routes-team-fields.test.ts tests/unit/agent-detail-page.test.tsx tests/unit/team-overview-page.test.tsx tests/unit/team-map-page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run project verification**

Run:

```bash
pnpm run typecheck
pnpm run lint
pnpm run build:vite
```

Expected: PASS.

- [ ] **Step 7: Update session continuity files**

Update:

- `continue/task.json`
- `continue/progress.txt`
- `Prompt.md` if this work materially changes the tracked platform scope or latest delta

- [ ] **Step 8: Final commit**

```bash
git add src/pages/TeamOverview/index.tsx src/pages/TeamMap/index.tsx README.md README.zh-CN.md continue/task.json continue/progress.txt Prompt.md
git commit -m "feat: ship team control plane mvp"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-03-27-team-control-plane-mvp.md`. Ready to execute?
