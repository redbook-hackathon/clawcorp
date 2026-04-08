# Team Control Plane MVP Design

## Goal

Upgrade ClawCorp's current team surfaces from a static agent overview into a real team control plane.

The MVP should let a user:

- understand who leads the team
- understand which members are long-lived workers
- understand which members can be directly chatted with
- understand what each member is responsible for
- understand what the team is currently doing

This is not a full multi-team platform. It is the first productized layer on top of the existing `agent`, `runtime`, `kanban`, and `channels` capabilities.

## Product Decision

The team system has two distinct layers:

1. Long-lived team structure
2. Runtime work visibility

These layers must be kept separate.

- `Agent` is a long-lived team member with its own workspace.
- `Skill` is a reusable capability package attached to a member.
- `Subagent` or `child runtime` is a temporary execution instance, not a persistent team member.

The MVP must not blur these three concepts together.

## Information Architecture

### Long-lived Objects

- `Team`
  - A product-level aggregation centered around a leader and its members.
  - The MVP may treat this as a derived view rather than a new persisted entity.
- `Member Agent`
  - A persistent team member with independent workspace, memory, model, and skills.
- `Role Policy`
  - Team semantics attached to a member.
- `Hierarchy`
  - Existing `reportsTo / directReports` relationship.
- `Channel Ownership`
  - Which leader owns which user-facing entrypoints.

### Runtime Objects

- `Work Item`
  - Existing task or kanban work under execution.
- `Child Runtime`
  - Temporary execution spawned by a member.
- `Approval / Blocker / Result`
  - Existing workflow state already represented by runtime and kanban layers.

## Team Model Decisions

The MVP should add a small set of explicit team semantics to agents.

### Required Member Fields

- `teamRole`
  - `leader` or `worker`
- `chatAccess`
  - `direct` or `leader_only`
- `responsibility`
  - Short text describing the member's primary role
- `reportsTo`
  - Existing hierarchy field remains in use

### Team Rules

- A `leader` is the primary user-facing coordinator for a team.
- A `worker` is primarily an execution member.
- `leader_only` means the member should be treated as a backend-facing worker rather than a normal direct chat entry.
- `reportsTo` expresses structure, but does not replace `teamRole` or `chatAccess`.
- Team pages show members and their runtime work, not skills as if they were members.

## Page Responsibilities

### TeamOverview

Purpose: team control plane homepage.

It should answer:

- who the leader is
- who belongs to the team
- what each member is responsible for
- who is currently active, blocked, or idle
- what the team is currently working on at a high level

It should emphasize member cards with:

- role
- responsibility
- direct-chat vs leader-only access
- current activity status
- recent activity
- current work count or basic workload signal

### TeamMap

Purpose: relationship and collaboration map.

It should answer:

- how the team is structured
- which members are leaders vs workers
- which members are backend-only workers
- which members are currently participating in active work

It should combine:

- long-lived hierarchy
- current runtime activity cues

It should not become a full task detail replacement for kanban.

### AgentDetail

Purpose: primary member configuration surface.

This is the main place to configure:

- `teamRole`
- `chatAccess`
- `responsibility`
- `reportsTo`

The page should explain the behavioral consequence of each setting so the user does not have to infer system behavior from raw field names.

### Settings

Purpose: global defaults only.

The MVP should avoid using Settings as the primary place to configure per-member team semantics.

Settings may later hold:

- team-wide defaults
- creation defaults
- future governance controls

But member-level team rules belong in `AgentDetail`.

## Runtime Visibility Decisions

The MVP should reuse existing runtime and kanban infrastructure rather than creating a new team runtime model.

Team surfaces should consume existing:

- runtime activity
- child runtime relationships
- recent execution state
- kanban work state

The product goal is to translate runtime data into team language, not to rebuild orchestration.

## MVP Scope

### In Scope

- Add `teamRole`, `chatAccess`, and `responsibility` to the agent model
- Expose these fields through backend config, routes, store, and UI
- Make `AgentDetail` the primary member-level team configuration surface
- Upgrade `TeamOverview` into a role-aware team status surface
- Upgrade `TeamMap` into a role-aware hierarchy plus activity surface
- Aggregate existing runtime and kanban signals into team visibility

### Out of Scope

- Cross-team leader-to-leader collaboration
- Automatic subagent autoscaling
- Team performance analytics
- Team cost center reporting
- A brand-new persisted `Team` backend entity
- Full new permission architecture
- Treating skills as team members
- Deep orchestration redesign

## UX Principles

- Users should feel they are managing a team, not a flat list of agents.
- Long-lived members and temporary child runtimes must remain visually distinct.
- A user should be able to identify leader vs worker vs backend-only worker at a glance.
- Team surfaces should route users toward deeper pages instead of duplicating full detail views everywhere.

## Existing Code Touchpoints

Primary existing surfaces that should anchor this MVP:

- `src/pages/TeamOverview/index.tsx`
- `src/pages/TeamMap/index.tsx`
- `src/pages/AgentDetail/index.tsx`
- `src/stores/agents.ts`
- `src/types/agent.ts`
- `electron/utils/agent-config.ts`
- `electron/api/routes/agents.ts`

Existing supporting systems to reuse rather than replace:

- runtime tree and child runtime drill-down
- kanban runtime linkage
- channel ownership and bindings

## Deferred Ideas

- Multiple formal teams as first-class persisted entities
- Team-level analytics and performance scoring
- Team-level cost dashboards
- System-enforced hard blocking of all direct chat entrypaths for `leader_only` members
- Dynamic worker pool scaling
- Cross-team routing protocols

## Success Criteria

The MVP is successful when a user can:

1. identify who the leader is
2. identify each member's responsibility
3. understand which members are directly chat-accessible
4. understand which members are backend-only workers
5. understand, at a high level, what the team is doing right now

