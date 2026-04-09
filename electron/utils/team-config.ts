import { readOpenClawConfig, writeOpenClawConfig } from './channel-config';
import { withConfigLock } from './config-mutex';
import { listAgentsSnapshot, writeAgentSoulMd } from './agent-config';
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

    // Per D-21: Sync reportsTo relationships on agent entries
    const config = await readOpenClawConfig() as ConfigDocument;
    const agentsConfig = (config.agents ?? {}) as Record<string, unknown>;
    const agentList = Array.isArray(agentsConfig.list)
      ? [...(agentsConfig.list as Array<Record<string, unknown>>)]
      : [];

    for (const member of agentList) {
      if (request.memberIds.includes(member.id as string)) {
        member.reportsTo = request.leaderId;
        member.teamRole = 'worker';
      }
      if ((member.id as string) === request.leaderId) {
        member.teamRole = 'leader';
      }
    }

    config.agents = { ...agentsConfig, list: agentList };
    await writeOpenClawConfig(config);

    // Write leader SOUL.md with team member info
    const updatedSnapshot = await listAgentsSnapshot();
    const workers = updatedSnapshot.agents.filter(
      (a) => request.memberIds.includes(a.id)
    );
    const leaderSoulContent = [
      `你是「${name}」团队的 Leader。`,
      '',
      '## 团队成员',
      ...workers.map(
        (w) => `- **${w.name}** (${w.id}): ${w.responsibility || '暂无职责描述'}`
      ),
      '',
      '## 管理方式',
      '- 收到任务时，根据成员职责分配给对应 worker',
      '- 使用 sessions_spawn 创建子会话来委派任务',
      '- 汇总 worker 结果后回复用户',
      '',
    ].join('\n');

    await writeAgentSoulMd({
      ...leader,
      teamContextOverride: leaderSoulContent,
      teamRole: 'leader',
    });

    // Write SOUL.md for each worker
    for (const memberId of request.memberIds) {
      const worker = snapshot.agents.find((a) => a.id === memberId);
      if (worker) {
        await writeAgentSoulMd({
          ...worker,
          teamRole: 'worker',
          reportsTo: request.leaderId,
        });
      }
    }

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

    // Sync reportsTo relationships if members changed
    if (updates.memberIds !== undefined) {
      const config = await readOpenClawConfig() as ConfigDocument;
      const agentsConfig = (config.agents ?? {}) as Record<string, unknown>;
      const agentList = Array.isArray(agentsConfig.list)
        ? [...(agentsConfig.list as Array<Record<string, unknown>>)]
        : [];

      const removedIds = team.memberIds.filter((id) => !updates.memberIds!.includes(id));
      const addedIds = updates.memberIds!.filter((id) => !team.memberIds.includes(id));

      for (const member of agentList) {
        const memberId = member.id as string;
        // Clear reportsTo for removed members
        if (removedIds.includes(memberId)) {
          delete member.reportsTo;
          delete member.teamRole;
        }
        // Set reportsTo for newly added members
        if (addedIds.includes(memberId)) {
          member.reportsTo = updatedTeam.leaderId;
          member.teamRole = 'worker';
        }
      }

      config.agents = { ...agentsConfig, list: agentList };
      await writeOpenClawConfig(config);

      // Sync SOUL.md for leader (with updated member list)
      const newSnapshot = await listAgentsSnapshot();
      const newWorkers = newSnapshot.agents.filter(
        (a) => updatedTeam.memberIds.includes(a.id)
      );
      const leaderSoulContent = [
        `你是「${updatedTeam.name}」团队的 Leader。`,
        '',
        '## 团队成员',
        ...newWorkers.map(
          (w) => `- **${w.name}** (${w.id}): ${w.responsibility || '暂无职责描述'}`
        ),
        '',
        '## 管理方式',
        '- 收到任务时，根据成员职责分配给对应 worker',
        '- 使用 sessions_spawn 创建子会话来委派任务',
        '- 汇总 worker 结果后回复用户',
        '',
      ].join('\n');
      const leaderAgent = newSnapshot.agents.find((a) => a.id === updatedTeam.leaderId);
      if (leaderAgent) {
        await writeAgentSoulMd({
          ...leaderAgent,
          teamContextOverride: leaderSoulContent,
          teamRole: 'leader',
        });
      }

      // Rewrite SOUL.md for removed workers (clear team context)
      for (const removedId of removedIds) {
        const removedAgent = newSnapshot.agents.find((a) => a.id === removedId);
        if (removedAgent) {
          await writeAgentSoulMd(removedAgent);
        }
      }

      // Write SOUL.md for newly added workers
      for (const addedId of addedIds) {
        const addedAgent = newSnapshot.agents.find((a) => a.id === addedId);
        if (addedAgent) {
          await writeAgentSoulMd({
            ...addedAgent,
            teamRole: 'worker',
            reportsTo: updatedTeam.leaderId,
          });
        }
      }
    }

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
    const team = teams.find((t) => t.id === teamId);
    const filteredTeams = teams.filter((t) => t.id !== teamId);

    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }

    await writeTeamsConfig(filteredTeams);

    // Clear reportsTo and teamRole for former team members
    const config = await readOpenClawConfig() as ConfigDocument;
    const agentsConfig = (config.agents ?? {}) as Record<string, unknown>;
    const agentList = Array.isArray(agentsConfig.list)
      ? [...(agentsConfig.list as Array<Record<string, unknown>>)]
      : [];

    const allMemberIds = [team.leaderId, ...team.memberIds];
    for (const member of agentList) {
      if (allMemberIds.includes(member.id as string)) {
        delete member.reportsTo;
        delete member.teamRole;
      }
    }

    config.agents = { ...agentsConfig, list: agentList };
    await writeOpenClawConfig(config);
  });
}
