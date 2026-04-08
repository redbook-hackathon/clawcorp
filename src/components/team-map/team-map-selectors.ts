import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';

export function getTeamMapLeader(
  agents: AgentSummary[],
  team: TeamSummary,
): AgentSummary | null {
  return agents.find((agent) => agent.id === team.leaderId) ?? null;
}

export function getTeamMapMembers(
  agents: AgentSummary[],
  team: TeamSummary,
): AgentSummary[] {
  const memberIds = new Set(team.memberIds.filter((memberId) => memberId !== team.leaderId));
  return agents.filter((agent) => memberIds.has(agent.id));
}

export function getTeamMapState(
  agents: AgentSummary[],
  team: TeamSummary,
): {
  leader: AgentSummary | null;
  members: AgentSummary[];
  scopedAgents: AgentSummary[];
} {
  const leader = getTeamMapLeader(agents, team);
  const members = getTeamMapMembers(agents, team);

  return {
    leader,
    members,
    scopedAgents: leader ? [leader, ...members] : members,
  };
}
