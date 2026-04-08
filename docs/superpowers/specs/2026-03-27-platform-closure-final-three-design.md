# Platform Closure Final Three Design

## Goal

Close the last meaningful product gaps still called out in `Prompt.md` by finishing:

1. `Kanban 深化`
2. `Multi-agent runtime / tool registry`
3. `通用 UX 收尾`

The implementation should preserve ClawCorp's current architecture and interaction language while borrowing proven interaction patterns from the `reference/` codebases where they improve clarity or operator flow.

## Product Decision

These are not one feature. They are three sequential closure tracks.

They will be executed in this order:

1. `Kanban 深化`
2. `Multi-agent runtime / tool registry`
3. `通用 UX 收尾`

This order is deliberate:

- `Kanban` is the most directly visible remaining workflow gap.
- `runtime / tool registry` deepening underpins the next layer of task orchestration visibility.
- `UX` should polish the stable interaction surface after the workflow semantics are finished.

## Scope Decomposition

### Track A: Kanban Deepening

This track closes the remaining gap described in `Prompt.md` as:

- deeper `agent work / retry / 状态联动`
- more complete `runtime tree drill-down`
- richer `lineage / subtree` interaction

The intent is not a page rewrite. It is to make the existing `TaskKanban` detail panel behave like a usable operator console for complex runtime trees.

### Track B: Multi-agent Runtime / Tool Registry

This track closes the remaining gap described in `Prompt.md` as:

- more complete `subagent tree orchestration`
- deeper `registry` level runtime capability interaction
- deeper `skills -> runtime` execution bridge visibility

The intent is to expose the runtime tree as a first-class execution model rather than just a transcript trail plus snapshots.

### Track C: Universal UX Finishing

This track closes the remaining gap described in `Prompt.md` as:

- `empty-state illustration`
- `mobile chat adaptation`

This is presentation-only closure. It should not reopen workflow or state architecture.

## Reference Guidance

Reference material was reviewed in:

- `reference/clawport-ui-main`
- `reference/openclaw-control-center-main`
- `reference/LobsterAI-main`

The references are useful for:

- runtime chain visibility
- operator-oriented detail panels
- clearer task/run hierarchy communication

They are not a mandate to restructure ClawCorp toward those codebases.

The governing rule for implementation is:

- keep ClawCorp's current structure
- reuse ClawCorp stores/routes/components where possible
- borrow interaction ideas, not file architecture

## Track A Design: Kanban Deepening

## Primary Outcome

The Kanban detail panel should let an operator answer four questions quickly:

1. What run am I looking at right now?
2. Where does it sit in the parent/child/retry tree?
3. What is the latest active run for this ticket?
4. What should I do next: inspect, follow up, retry, approve, or go back?

## Design Direction

Use the current `TaskKanban` page and keep the right-side detail drawer as the main control surface.

Do not replace it with a new page or a nested router.

Instead, deepen it with:

- stronger lineage navigation
- clearer current-vs-latest runtime context
- better child-run summaries
- better retry semantics
- better execution-path drill-down

## Interaction Model

### 1. Runtime Summary Block

The top of the runtime section should distinguish:

- current selected run
- latest run for this ticket
- parent run
- root run
- child count
- active subtree state

This prevents the operator from losing orientation after drilling into historical or child runs.

### 2. Lineage Rail

The existing lineage chips should become a proper navigation rail:

- `root`
- `parent`
- `current`
- `latest`
- `children`

Selecting any chip should update the transcript and execution views together.

### 3. Child Run List

Child runs must show more than ids.

Each child row should show:

- runtime id
- status
- short final or latest transcript preview
- whether it is waiting approval
- whether it is the latest active branch

This is the minimum needed for subtree triage.

### 4. Retry Semantics

Retry should operate relative to the run the operator is looking at, not only the ticket root.

Recommended behavior:

- if the operator is viewing a child or historical run, `Retry work` spawns from that run
- the newly spawned run becomes the selected run
- the `latest` marker updates immediately

This keeps retry behavior predictable and visible.

### 5. Execution Path View

Execution records should remain in the detail panel but gain clearer drill-down affordances.

When an execution record links to a runtime:

- clicking it opens that runtime directly
- the lineage rail updates
- the operator can return to `latest run` with one click

This closes the loop between tool execution and subagent tree navigation.

## State Rules

The ticket's visible work state must reflect the active subtree, not only the currently selected run.

Recommended state precedence:

1. `waiting_approval`
2. `blocked`
3. `working`
4. `scheduled`
5. `done`
6. `failed`

This keeps ticket-level status aligned with the most actionable branch.

## Data Model Constraints

Prefer reusing the existing ticket/runtime fields:

- `runtimeSessionId`
- `runtimeParentSessionId`
- `runtimeRootSessionId`
- `runtimeSessionKey`
- `runtimeParentSessionKey`
- `runtimeLineageSessionKeys`
- `runtimeChildSessionIds`
- `runtimeHistory`
- `runtimeTranscript`
- `executionRecords`

Add only small derived view state if needed, such as:

- `selectedRuntimeSessionId`
- `latestRuntimeSessionId`
- derived subtree summary flags

## Testing

Track A must prove:

- parent/latest/child switching stays coherent
- retry from a non-root run preserves lineage correctly
- execution record links open the linked runtime
- active subtree state is reflected in the detail summary
- operator can always return to latest run

## Track B Design: Multi-agent Runtime / Tool Registry

## Primary Outcome

The runtime layer should expose orchestration as a readable tree instead of a loose collection of sessions, history, and snapshots.

## Design Direction

Keep the current backend runtime manager and session routes.

Deepen them by:

- making parent/child orchestration relationships explicit
- surfacing runtime capability inheritance and delta
- making skill/tool usage chains easier to inspect

## Visible Capabilities

The operator should be able to inspect:

- which runtime spawned which child runtime
- which tools/skills were available at spawn time
- which execution records created linked child runs
- how a child's capability surface differed from its parent, if at all

This is mainly a runtime observability problem, not a new task authoring problem.

## Boundaries

Do not introduce a separate orchestration system.

Use the existing:

- `session-runtime-manager`
- session persistence
- `executionRecords`
- `toolSnapshot`
- `skillSnapshot`

The closure work is about richer linkage and visibility.

## Testing

Track B must prove:

- parent/child trees stay consistent across persistence and reload
- linked runtime ids/session keys are navigable from UI surfaces
- capability snapshots remain attached to the right runtime node

## Track C Design: Universal UX Finishing

## Primary Outcome

Polish the final generic UX gaps without changing behavior:

- better empty states
- mobile chat adaptation

## Empty States

Target surfaces should feel intentional, not placeholder-heavy.

Recommended treatment:

- one illustration or icon motif per major empty state family
- a primary action
- one sentence of guidance

Do not over-theme this. Reuse ClawCorp's current visual language.

## Mobile Chat Adaptation

The goal is practical usability, not a mobile redesign.

Recommended improvements:

- composer and header remain accessible on narrow widths
- side rails collapse cleanly
- message content wraps without destroying hierarchy
- action buttons do not overflow horizontally

## Testing

Track C must prove:

- empty-state shells render consistently
- chat layout remains usable at narrow viewport widths

## Execution Plan

Execution should proceed as three sequential implementation plans:

1. `Kanban 深化`
2. `runtime / tool registry`
3. `UX 收尾`

The current implementation cycle should start with Track A only.

## Summary

The remaining closure work is best treated as three focused projects.

The recommended approach is:

- deepen `TaskKanban` first
- expose richer runtime orchestration and registry visibility second
- polish empty states and mobile chat last

This keeps ClawCorp structurally stable while still materially improving the parts that currently feel underpowered.
