---
phase: 03-team-overview-rebuild
plan: 01
subsystem: team-data-infrastructure
tags: [team-management, data-layer, zustand, backend-api]
dependency_graph:
  requires: [agent-types, agent-store, openclaw-config]
  provides: [team-types, team-store, team-api]
  affects: [team-overview-ui, team-map]
tech_stack:
  added: [team-config-utility, teams-api-routes]
  patterns: [zustand-store, json-config-storage, hostapi-fetch]
key_files:
  created:
    - src/types/team.ts
    - src/stores/teams.ts
    - electron/utils/team-config.ts
    - electron/api/routes/teams.ts
    - tests/unit/team-types.test.ts
    - tests/unit/teams-store.test.ts
  modified:
    - electron/api/server.ts
decisions:
  - id: TEAM-DATA-01
    summary: Store teams in openclaw.json teams section
    rationale: Follows existing agent-config pattern, enables config-level locking
  - id: TEAM-DATA-02
    summary: Auto-generate team names as "{leaderName} 的团队"
    rationale: Per D-15, provides sensible defaults while allowing customization
  - id: TEAM-DATA-03
    summary: Return full teams snapshot after mutations
    rationale: Follows agents.ts pattern, simplifies frontend state management
metrics:
  duration_seconds: 420
  tasks_completed: 3
  files_created: 6
  files_modified: 1
  tests_added: 18
  lines_added: 1012
  commits: 3
completed_at: "2026-03-31T18:14:11Z"
---

# Phase 03 Plan 01: Team Data Structure & Store Summary

**One-liner:** Established team data infrastructure with TypeScript types, Zustand store, and backend API supporting multi-team relationships and auto-naming.

## What Was Built

Created the foundational data layer for team management:

1. **Team Type Definitions** (`src/types/team.ts`)
   - Team, TeamStatus, TeamSummary interfaces
   - CreateTeamRequest, UpdateTeamRequest types
   - Support for multi-team relationships (agents can belong to multiple teams)
   - Comprehensive TypeScript types with JSDoc documentation

2. **Team Zustand Store** (`src/stores/teams.ts`)
   - CRUD operations: fetchTeams, createTeam, updateTeam, deleteTeam
   - Convenience methods: addMember, removeMember
   - Loading and error state management
   - Follows agents.ts pattern with hostApiFetch integration

3. **Backend API Routes** (`electron/api/routes/teams.ts`)
   - GET /api/teams - List all teams with summary data
   - POST /api/teams - Create team with auto-naming
   - PUT /api/teams/:id - Update team properties
   - DELETE /api/teams/:id - Delete team (preserves agents)
   - Integrated with API server route handlers

4. **Team Config Utility** (`electron/utils/team-config.ts`)
   - JSON-based team storage in openclaw.json
   - Auto-name generation: "{leaderName} 的团队" (per D-15)
   - TeamSummary computation with member avatars
   - Config-level locking for concurrent safety

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

### Team Data Storage
Stored teams in `openclaw.json` under a `teams` section, following the existing agent-config pattern. This provides:
- Consistent config management with existing systems
- Config-level locking via withConfigLock
- Easy backup and version control
- No additional database dependencies

### Auto-Naming Strategy
Implemented per D-15: "{leaderName} 的团队" as default, with optional override during creation. Backend generates the name if not provided, ensuring Chinese-first UX.

### API Response Pattern
All mutation endpoints (POST, PUT, DELETE) return the full teams snapshot, following the agents.ts pattern. This simplifies frontend state management by providing a consistent update mechanism.

### Status Calculation Placeholder
Team status calculation (active/idle/blocked per D-23) is stubbed to return 'idle' until agent activity tracking is available. Marked with TODO comments for future enhancement.

## Test Coverage

- **team-types.test.ts**: 7 tests covering all type definitions
- **teams-store.test.ts**: 11 tests covering CRUD operations, error handling, and convenience methods
- All tests passing with mocked API calls

## Known Stubs

1. **Team Status Calculation** (`electron/utils/team-config.ts:48`)
   - Currently returns 'idle' for all teams
   - Reason: Agent activity tracking not yet implemented
   - Resolution: Will be wired when agent status system is available (Phase 4 or later)

2. **Active Task Count** (`electron/utils/team-config.ts:89`)
   - Currently returns 0
   - Reason: Task system integration not yet implemented
   - Resolution: Will be wired when task-team relationship is established (Phase 4)

3. **Last Active Time** (`electron/utils/team-config.ts:92`)
   - Currently returns undefined
   - Reason: Agent activity tracking not yet implemented
   - Resolution: Will be wired when agent activity system is available

4. **Agent Relationship Sync** (`electron/utils/team-config.ts:165, 232`)
   - TODO comments for reportsTo, Memory, Soul, Identity updates
   - Reason: These systems not yet integrated with team management
   - Resolution: Per D-21, will be implemented when those systems are available

These stubs do not prevent the plan's goal (establish data infrastructure) from being achieved. They are intentional placeholders for future integration points.

## Integration Points

### Upstream Dependencies
- `src/types/agent.ts` - AgentSummary type for member information
- `src/stores/agents.ts` - Pattern reference for store implementation
- `electron/utils/agent-config.ts` - Agent data access for validation
- `electron/utils/channel-config.ts` - Config read/write utilities

### Downstream Consumers
- Phase 03 Plan 02: Team card UI components will use TeamSummary type
- Phase 03 Plan 03: Drag-and-drop creation will call createTeam API
- Phase 04: Team map will use team data for visualization

## Files Created

1. `src/types/team.ts` (108 lines) - Team type definitions
2. `src/stores/teams.ts` (120 lines) - Zustand store implementation
3. `electron/utils/team-config.ts` (257 lines) - Team config utility
4. `electron/api/routes/teams.ts` (127 lines) - API route handlers
5. `tests/unit/team-types.test.ts` (133 lines) - Type tests
6. `tests/unit/teams-store.test.ts` (267 lines) - Store tests

## Files Modified

1. `electron/api/server.ts` - Added handleTeamRoutes to route handlers

## Commits

- `dca8339` - feat(03-01): create team type definitions
- `22cee67` - feat(03-01): implement team Zustand store
- `cb67968` - feat(03-01): create team backend API routes

## Verification Results

All success criteria met:
- ✅ Team data structure exists with all required fields
- ✅ Team store provides CRUD operations
- ✅ Backend API handles team creation, deletion, and member updates
- ✅ Multi-team relationships properly stored and queried
- ✅ All unit tests passing (18 tests total)
- ✅ TypeScript compilation successful (no team-related errors)
- ✅ API endpoints registered and accessible

## Next Steps

Phase 03 Plan 02 can now proceed to build the team card UI components using the TeamSummary type and useTeamsStore hook established here.

## Self-Check: PASSED

All claimed files exist:
- ✅ src/types/team.ts
- ✅ src/stores/teams.ts
- ✅ electron/utils/team-config.ts
- ✅ electron/api/routes/teams.ts
- ✅ tests/unit/team-types.test.ts
- ✅ tests/unit/teams-store.test.ts

All claimed commits exist:
- ✅ dca8339 (team type definitions)
- ✅ 22cee67 (team Zustand store)
- ✅ cb67968 (team backend API routes)
