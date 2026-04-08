export type AgentTeamRole = 'leader' | 'worker';
export type AgentChatAccess = 'direct' | 'leader_only';

export interface AgentSummary {
  id: string;
  name: string;
  persona: string;
  isDefault: boolean;
  model: string;
  modelDisplay: string;
  inheritedModel: boolean;
  workspace: string;
  agentDir: string;
  mainSessionKey: string;
  channelTypes: string[];
  avatar?: string | null;
  teamRole: AgentTeamRole;
  chatAccess: AgentChatAccess;
  responsibility: string;
  reportsTo?: string | null;
  directReports?: string[];
}

export interface AgentsSnapshot {
  agents: AgentSummary[];
  defaultAgentId: string;
  configuredChannelTypes: string[];
  channelOwners: Record<string, string>;
}
