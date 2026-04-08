import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import type { ChannelType } from '@/types/channel';
import type { AgentChatAccess, AgentSummary, AgentsSnapshot, AgentTeamRole } from '@/types/agent';

interface AgentsState {
  agents: AgentSummary[];
  defaultAgentId: string;
  configuredChannelTypes: string[];
  channelOwners: Record<string, string>;
  agentStatuses: Record<string, 'online' | 'offline' | 'busy'>;
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

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  defaultAgentId: 'main',
  configuredChannelTypes: [],
  channelOwners: {},
  agentStatuses: {},
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
        // Initialize agent statuses to online for all agents
        const statuses: Record<string, 'online' | 'offline' | 'busy'> = {};
        for (const agent of newState.agents || []) {
          statuses[agent.id] = state.agentStatuses[agent.id] || 'online';
        }
        return {
          ...newState,
          agentStatuses: statuses,
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
    set((state) => ({
      agentStatuses: {
        ...state.agentStatuses,
        [agentId]: status,
      },
    }));
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
