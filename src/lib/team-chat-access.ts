import type { AgentChatAccess, AgentSummary } from '@/types/agent';

export type TeamChatAccessAgent = Pick<
  AgentSummary,
  'id' | 'name' | 'mainSessionKey' | 'chatAccess' | 'reportsTo' | 'isDefault'
>;

export function isLeaderOnlyAccess(chatAccess: AgentChatAccess | undefined | null): boolean {
  return chatAccess === 'leader_only';
}

export function isLeaderOnlyAgent(agent: Pick<TeamChatAccessAgent, 'chatAccess'> | null | undefined): boolean {
  return isLeaderOnlyAccess(agent?.chatAccess);
}

export function findAgentBySessionKey<T extends Pick<TeamChatAccessAgent, 'mainSessionKey'>>(
  agents: T[],
  sessionKey: string | null | undefined,
): T | null {
  if (!sessionKey) return null;
  return agents.find((agent) => agent.mainSessionKey === sessionKey) ?? null;
}

export function isDirectMainSessionBlocked(
  agent: Pick<TeamChatAccessAgent, 'mainSessionKey' | 'chatAccess'> | null | undefined,
  sessionKey: string | null | undefined,
): boolean {
  if (!agent || !sessionKey) return false;
  return isLeaderOnlyAgent(agent) && agent.mainSessionKey === sessionKey;
}

export function resolveReportingLeader<T extends TeamChatAccessAgent>(
  agent: Pick<TeamChatAccessAgent, 'id' | 'reportsTo'> | null | undefined,
  agents: T[],
): T | null {
  if (!agent) return null;
  if (agent.reportsTo) {
    const parent = agents.find((entry) => entry.id === agent.reportsTo);
    if (parent) return parent;
  }
  return agents.find((entry) => entry.isDefault) ?? null;
}

export function buildLeaderOnlyBlockedMessage(
  blockedAgent: Pick<TeamChatAccessAgent, 'name'>,
  leader: Pick<TeamChatAccessAgent, 'name'> | null,
): string {
  if (leader?.name) {
    return `${blockedAgent.name} is a leader-routed worker. Contact ${leader.name} instead of opening a direct chat.`;
  }
  return `${blockedAgent.name} is a leader-routed worker and is not available for direct chat. Contact the team leader instead.`;
}
