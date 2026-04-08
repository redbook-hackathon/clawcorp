import { readOpenClawConfig, writeOpenClawConfig } from './channel-config';
import { withConfigLock } from './config-mutex';
import { listAgentsSnapshot } from './agent-config';
import { listTaskSnapshots } from './task-config';
import type { Team, TeamSummary, CreateTeamRequest, UpdateTeamRequest, TeamStatus } from '../../src/types/team';
import { randomUUID } from 'crypto';
import { buildTeamTaskRollupMap } from '../../src/lib/task-summary-read-model';

interface TeamsConfig {
  teams?: Team[];
}

interface ConfigDocument {
  teams?: TeamsConfig;
  [key: string]: unknown;
}

/**
 * Read teams configuration from openclaw.json
 */
export async function readTeamsConfig(): Promise<Team[]> {
  const config = await readOpenClawConfig() as ConfigDocument;
  return config.teams?.teams ?? [];
}

/**
 * Write teams configuration to openclaw.json
 */
async function writeTeamsConfig(teams: Team[]): Promise<void> {
  await withConfigLock(async () => {
    const config = await readOpenClawConfig() as ConfigDocument;
    config.teams = { teams };
    await writeOpenClawConfig(config);
  });
}

/**
 * Calculate team status based on member activity
 * Per D-23: active if any member working, blocked if any blocked, else idle
 */
function calculateTeamStatus(memberIds: string[], leaderId: string): TeamStatus {
  // TODO: Implement actual status calculation based on agent activity
  // For now, default to 'idle' - will be enhanced when agent activity tracking is available
  return 'idle';
}

/**
 * Generate team name based on leader name
 * Per D-15: "{leaderName} 的团队"
 */
async function generateTeamName(leaderId: string): Promise<string> {
  const snapshot = await listAgentsSnapshot();
  const leader = snapshot.agents.find((a) => a.id === leaderId);

  if (!leader) {
    throw new Error(`Leader agent not found: ${leaderId}`);
  }

  return `${leader.name} 的团队`;
}

/**
 * Build TeamSummary with computed display fields
 */
async function buildTeamSummary(
  team: Team,
  taskRollup?: ReturnType<typeof buildTeamTaskRollupMap>[string],
): Promise<TeamSummary> {
  const snapshot = await listAgentsSnapshot();

  // Find leader
  const leader = snapshot.agents.find((a) => a.id === team.leaderId);
  if (!leader) {
    throw new Error(`Leader agent not found: ${team.leaderId}`);
  }

  // Find members
  const members = team.memberIds
    .map((id) => snapshot.agents.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  // Build member avatars (first 3-4 members)
  const memberAvatars = [leader, ...members].slice(0, 4).map((agent) => ({
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar ?? undefined,
  }));

  // Calculate member count (leader + members)
  const memberCount = 1 + team.memberIds.length;

  const activeTaskCount = taskRollup?.activeTaskCount ?? 0;
  const lastActiveTime = taskRollup?.lastActiveTime;

  return {
    ...team,
    status: taskRollup?.status ?? team.status,
    memberCount,
    activeTaskCount,
    lastActiveTime,
    leaderName: leader.name,
    memberAvatars,
  };
}

/**
 * List all teams with summary information
 */
export async function listTeamsSnapshot(): Promise<TeamSummary[]> {
  const teams = await readTeamsConfig();
  const taskRollups = buildTeamTaskRollupMap(await listTaskSnapshots());

  // Build summaries for all teams
  const summaries = await Promise.all(
    teams.map((team) => buildTeamSummary(team, taskRollups[team.id]))
  );

  // Sort by creation time (newest first, per D-07)
  return summaries.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Create a new team
 * Per D-15: Auto-generate name if not provided
 * Per D-21: Sync updates to agent relationships
 */
export async function createTeam(request: CreateTeamRequest): Promise<TeamSummary> {
  return await withConfigLock(async () => {
    // Validate leader exists
    const snapshot = await listAgentsSnapshot();
    const leader = snapshot.agents.find((a) => a.id === request.leaderId);
    if (!leader) {
      throw new Error(`Leader agent not found: ${request.leaderId}`);
    }

    // Validate all members exist
    for (const memberId of request.memberIds) {
      const member = snapshot.agents.find((a) => a.id === memberId);
      if (!member) {
        throw new Error(`Member agent not found: ${memberId}`);
      }
    }

    // Generate name if not provided
    const name = request.name || await generateTeamName(request.leaderId);

    // Create team
    const now = Date.now();
    const team: Team = {
      id: randomUUID(),
      name,
      leaderId: request.leaderId,
      memberIds: request.memberIds,
      description: request.description || '',
      status: calculateTeamStatus(request.memberIds, request.leaderId),
      createdAt: now,
      updatedAt: now,
    };

    // Save to config
    const teams = await readTeamsConfig();
    teams.push(team);
    await writeTeamsConfig(teams);

    // TODO: Per D-21, sync updates to:
    // - Agent reportsTo relationships
    // - Agent Memory (team context)
    // - Agent Soul (team collaboration awareness)
    // - Agent Identity (team identity)
    // This will be implemented when those systems are available

    return await buildTeamSummary(team);
  });
}

/**
 * Update an existing team
 */
export async function updateTeam(teamId: string, updates: UpdateTeamRequest): Promise<TeamSummary> {
  return await withConfigLock(async () => {
    const teams = await readTeamsConfig();
    const teamIndex = teams.findIndex((t) => t.id === teamId);

    if (teamIndex === -1) {
      throw new Error(`Team not found: ${teamId}`);
    }

    const team = teams[teamIndex];

    // Validate new members if provided
    if (updates.memberIds) {
      const snapshot = await listAgentsSnapshot();
      for (const memberId of updates.memberIds) {
        const member = snapshot.agents.find((a) => a.id === memberId);
        if (!member) {
          throw new Error(`Member agent not found: ${memberId}`);
        }
      }
    }

    // Apply updates
    const updatedTeam: Team = {
      ...team,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.memberIds !== undefined && { memberIds: updates.memberIds }),
      updatedAt: Date.now(),
    };

    // Recalculate status if members changed
    if (updates.memberIds !== undefined) {
      updatedTeam.status = calculateTeamStatus(updatedTeam.memberIds, updatedTeam.leaderId);
    }

    teams[teamIndex] = updatedTeam;
    await writeTeamsConfig(teams);

    return await buildTeamSummary(updatedTeam);
  });
}

/**
 * Delete a team
 * Per D-22: Does not delete agents, only removes team relationship
 */
export async function deleteTeam(teamId: string): Promise<void> {
  await withConfigLock(async () => {
    const teams = await readTeamsConfig();
    const filteredTeams = teams.filter((t) => t.id !== teamId);

    if (filteredTeams.length === teams.length) {
      throw new Error(`Team not found: ${teamId}`);
    }

    await writeTeamsConfig(filteredTeams);

    // TODO: Clear agent reportsTo relationships when that system is available
  });
}
