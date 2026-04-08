import type { TeamSummary } from '@/types/team';

export function buildLeaderTeamNaming(agentName: string, existingLeaderCount: number) {
  if (existingLeaderCount <= 0) {
    return {
      leaderDisplayName: agentName,
      defaultTeamName: `${agentName} 的团队`,
    };
  }

  return {
    leaderDisplayName: `${agentName}-${existingLeaderCount}`,
    defaultTeamName: `${agentName} 的团队-${existingLeaderCount}`,
  };
}

export function getLeaderReuseCount(
  teams: Array<Pick<TeamSummary, 'leaderId'>>,
  leaderId: string,
) {
  return teams.reduce((count, team) => {
    return team.leaderId === leaderId ? count + 1 : count;
  }, 0);
}

export function applyLeaderDisplayAliases<T extends Pick<TeamSummary, 'id' | 'leaderId' | 'leaderName' | 'createdAt'>>(
  teams: T[],
) {
  const teamsByLeader = new Map<string, T[]>();

  for (const team of teams) {
    const leaderTeams = teamsByLeader.get(team.leaderId) ?? [];
    leaderTeams.push(team);
    teamsByLeader.set(team.leaderId, leaderTeams);
  }

  const aliasByTeamId = new Map<string, string>();

  for (const leaderTeams of teamsByLeader.values()) {
    const orderedTeams = [...leaderTeams].sort((left, right) => left.createdAt - right.createdAt);

    orderedTeams.forEach((team, index) => {
      aliasByTeamId.set(team.id, buildLeaderTeamNaming(team.leaderName, index).leaderDisplayName);
    });
  }

  return teams.map((team) => ({
    ...team,
    leaderName: aliasByTeamId.get(team.id) ?? team.leaderName,
  }));
}
