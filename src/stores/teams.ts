import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import type { TeamSummary, CreateTeamRequest, UpdateTeamRequest, TeamsSnapshot } from '@/types/team';

interface TeamsState {
  teams: TeamSummary[];
  loading: boolean;
  error: string | null;

  // CRUD operations
  fetchTeams: () => Promise<void>;
  createTeam: (request: CreateTeamRequest) => Promise<void>;
  updateTeam: (teamId: string, updates: UpdateTeamRequest) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;

  // Convenience methods
  addMember: (teamId: string, agentId: string) => Promise<void>;
  removeMember: (teamId: string, agentId: string) => Promise<void>;

  clearError: () => void;
}

function applySnapshot(snapshot: TeamsSnapshot | undefined) {
  return snapshot ? { teams: snapshot.teams } : {};
}

export const useTeamsStore = create<TeamsState>((set, get) => ({
  teams: [],
  loading: false,
  error: null,

  fetchTeams: async () => {
    set({ loading: true, error: null });
    try {
      const snapshot = await hostApiFetch<TeamsSnapshot>('/api/teams');
      set({
        ...applySnapshot(snapshot),
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  createTeam: async (request: CreateTeamRequest) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<TeamsSnapshot>('/api/teams', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateTeam: async (teamId: string, updates: UpdateTeamRequest) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<TeamsSnapshot>(
        `/api/teams/${encodeURIComponent(teamId)}`,
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

  deleteTeam: async (teamId: string) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<TeamsSnapshot>(
        `/api/teams/${encodeURIComponent(teamId)}`,
        { method: 'DELETE' }
      );
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  addMember: async (teamId: string, agentId: string) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }

    // Add member if not already present
    const memberIds = team.memberIds.includes(agentId)
      ? team.memberIds
      : [...team.memberIds, agentId];

    await get().updateTeam(teamId, { memberIds });
  },

  removeMember: async (teamId: string, agentId: string) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }

    // Remove member from list
    const memberIds = team.memberIds.filter((id) => id !== agentId);

    await get().updateTeam(teamId, { memberIds });
  },

  clearError: () => set({ error: null }),
}));
