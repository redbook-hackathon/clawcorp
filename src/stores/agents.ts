import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import type { ChannelType } from '@/types/channel';
import type { AgentChatAccess, AgentLifecycleStatus, AgentSummary, AgentsSnapshot, AgentTeamRole } from '@/types/agent';

interface AgentsState {
  agents: AgentSummary[];
  defaultAgentId: string;
  configuredChannelTypes: string[];
  channelOwners: Record<string, string>;
  agentStatuses: Record<string, 'online' | 'offline' | 'busy'>;
  agentLifecycleStatuses: Record<string, AgentLifecycleStatus>;
  agentSessionCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  createAgent: (input: {
    name: string;
    persona?: string;
    teamRole?: AgentTeamRole;
    model?: string;
  }) => Promise<{ createdAgentId: string }>;
  updateAgent: (
    agentId: string,
    updates: {
      name?: string;
      persona?: string;
      model?: string;
      avatar?: string | null;
      reportsTo?: string | null;
      teamRole?: AgentTeamRole;
      chatAccess?: AgentChatAccess;
      responsibility?: string;
    },
  ) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  assignChannel: (agentId: string, channelType: ChannelType) => Promise<void>;
  removeChannel: (agentId: string, channelType: ChannelType) => Promise<void>;
  updateAgentStatus: (agentId: string, status: 'online' | 'offline' | 'busy') => void;
  fetchAgentStatuses: () => Promise<void>;
  clearError: () => void;
}

function applySnapshot(snapshot: AgentsSnapshot | undefined) {
  return snapshot ? {
    agents: snapshot.agents,
    defaultAgentId: snapshot.defaultAgentId,
    configuredChannelTypes: snapshot.configuredChannelTypes,
    channelOwners: snapshot.channelOwners,
  } : {};
}

function deriveLifecycleStatus(
  status: 'online' | 'offline' | 'busy' | undefined,
  _sessionCount: number
): AgentLifecycleStatus {
  if (status === 'offline') return 'maintenance';
  if (status === 'busy') return 'training';
  // Online agents (with or without sessions) are active — they've been hired/deployed
  return 'active';
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  defaultAgentId: 'main',
  configuredChannelTypes: [],
  channelOwners: {},
  agentStatuses: {},
  agentLifecycleStatuses: {},
  agentSessionCounts: {},
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>('/api/agents');
      set((state) => {
        const newState = {
          ...applySnapshot(snapshot),
          loading: false,
        };
        const statuses: Record<string, 'online' | 'offline' | 'busy'> = {};
        const lifecycleStatuses: Record<string, AgentLifecycleStatus> = {};
        const sessionCounts: Record<string, number> = {};
        const agentsWithLifecycle: AgentSummary[] = [];

        for (const agent of newState.agents || []) {
          const prevStatus = state.agentStatuses[agent.id] || 'online';
          statuses[agent.id] = prevStatus;
          sessionCounts[agent.id] = state.agentSessionCounts[agent.id] || 0;
          lifecycleStatuses[agent.id] = deriveLifecycleStatus(
            prevStatus,
            sessionCounts[agent.id]
          );
          agentsWithLifecycle.push({ ...agent, lifecycleStatus: lifecycleStatuses[agent.id] });
        }

        return {
          ...newState,
          agents: agentsWithLifecycle,
          agentStatuses: statuses,
          agentLifecycleStatuses: lifecycleStatuses,
          agentSessionCounts: sessionCounts,
        };
      });
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  createAgent: async (input) => {
    set({ error: null });
    try {
      const result = await hostApiFetch<AgentsSnapshot & { success?: boolean; createdAgentId: string }>('/api/agents', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      set(applySnapshot(result));
      return { createdAgentId: result.createdAgentId };
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateAgent: async (
    agentId: string,
    updates: {
      name?: string;
      persona?: string;
      model?: string;
      avatar?: string | null;
      reportsTo?: string | null;
      teamRole?: AgentTeamRole;
      chatAccess?: AgentChatAccess;
      responsibility?: string;
    },
  ) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>(
        `/api/agents/${encodeURIComponent(agentId)}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteAgent: async (agentId: string) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>(
        `/api/agents/${encodeURIComponent(agentId)}`,
        { method: 'DELETE' }
      );
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  assignChannel: async (agentId: string, channelType: ChannelType) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>(
        `/api/agents/${encodeURIComponent(agentId)}/channels/${encodeURIComponent(channelType)}`,
        { method: 'PUT' }
      );
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  removeChannel: async (agentId: string, channelType: ChannelType) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>(
        `/api/agents/${encodeURIComponent(agentId)}/channels/${encodeURIComponent(channelType)}`,
        { method: 'DELETE' }
      );
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateAgentStatus: (agentId: string, status: 'online' | 'offline' | 'busy') => {
    set((state) => {
      const agent = state.agents.find((a) => a.id === agentId);
      const lifecycleStatus = agent
        ? deriveLifecycleStatus(status, state.agentSessionCounts[agentId] || 0)
        : state.agentLifecycleStatuses[agentId];
      return {
        agentStatuses: {
          ...state.agentStatuses,
          [agentId]: status,
        },
        agentLifecycleStatuses: {
          ...state.agentLifecycleStatuses,
          [agentId]: lifecycleStatus,
        },
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, lifecycleStatus } : a
        ),
      };
    });
  },

  fetchAgentStatuses: async () => {
    // Simplified implementation: default all agents to online
    // If Gateway provides agent status API in the future, fetch from there
    set((state) => {
      const statuses: Record<string, 'online' | 'offline' | 'busy'> = {};
      for (const agent of state.agents) {
        // Default to online if not already set
        statuses[agent.id] = state.agentStatuses[agent.id] || 'online';
      }
      return { agentStatuses: statuses };
    });
  },

  clearError: () => set({ error: null }),
}));
