import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTeamsStore } from '@/stores/teams';
import type { TeamSummary, CreateTeamRequest, UpdateTeamRequest } from '@/types/team';

// Mock hostApiFetch
vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

import { hostApiFetch } from '@/lib/host-api';

describe('Teams Store', () => {
  beforeEach(() => {
    // Reset store state
    useTeamsStore.setState({
      teams: [],
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should have empty teams array', () => {
      const state = useTeamsStore.getState();
      expect(state.teams).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchTeams', () => {
    it('should load teams from API', async () => {
      const mockTeams: TeamSummary[] = [
        {
          id: 'team-1',
          name: 'Team Alpha',
          leaderId: 'agent-1',
          memberIds: ['agent-2'],
          description: 'Test team',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          memberCount: 2,
          activeTaskCount: 3,
          lastActiveTime: Date.now(),
          leaderName: 'Alice',
          memberAvatars: [],
        },
      ];

      vi.mocked(hostApiFetch).mockResolvedValueOnce({ teams: mockTeams });

      const { fetchTeams } = useTeamsStore.getState();
      await fetchTeams();

      const state = useTeamsStore.getState();
      expect(state.teams).toEqual(mockTeams);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set loading state during fetch', async () => {
      vi.mocked(hostApiFetch).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ teams: [] }), 100))
      );

      const { fetchTeams } = useTeamsStore.getState();
      const promise = fetchTeams();

      // Check loading state immediately
      expect(useTeamsStore.getState().loading).toBe(true);

      await promise;
      expect(useTeamsStore.getState().loading).toBe(false);
    });

    it('should handle fetch errors', async () => {
      const errorMessage = 'Network error';
      vi.mocked(hostApiFetch).mockRejectedValueOnce(new Error(errorMessage));

      const { fetchTeams } = useTeamsStore.getState();
      await fetchTeams();

      const state = useTeamsStore.getState();
      expect(state.error).toBe(`Error: ${errorMessage}`);
      expect(state.loading).toBe(false);
    });
  });

  describe('createTeam', () => {
    it('should create a new team', async () => {
      const request: CreateTeamRequest = {
        leaderId: 'agent-1',
        memberIds: ['agent-2', 'agent-3'],
        name: 'New Team',
        description: 'A new team',
      };

      const mockResponse: TeamSummary = {
        id: 'team-new',
        name: 'New Team',
        leaderId: 'agent-1',
        memberIds: ['agent-2', 'agent-3'],
        description: 'A new team',
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        memberCount: 3,
        activeTaskCount: 0,
        lastActiveTime: undefined,
        leaderName: 'Alice',
        memberAvatars: [],
      };

      vi.mocked(hostApiFetch).mockResolvedValueOnce({ teams: [mockResponse] });

      const { createTeam } = useTeamsStore.getState();
      await createTeam(request);

      const state = useTeamsStore.getState();
      expect(state.teams).toHaveLength(1);
      expect(state.teams[0].name).toBe('New Team');
      expect(state.error).toBeNull();
    });

    it('should handle create errors', async () => {
      const request: CreateTeamRequest = {
        leaderId: 'agent-1',
        memberIds: [],
      };

      const errorMessage = 'Agent not found';
      vi.mocked(hostApiFetch).mockRejectedValueOnce(new Error(errorMessage));

      const { createTeam } = useTeamsStore.getState();

      await expect(createTeam(request)).rejects.toThrow();

      const state = useTeamsStore.getState();
      expect(state.error).toBe(`Error: ${errorMessage}`);
    });
  });

  describe('updateTeam', () => {
    it('should update team properties', async () => {
      const initialTeam: TeamSummary = {
        id: 'team-1',
        name: 'Old Name',
        leaderId: 'agent-1',
        memberIds: [],
        description: 'Old description',
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        memberCount: 1,
        activeTaskCount: 0,
        lastActiveTime: undefined,
        leaderName: 'Alice',
        memberAvatars: [],
      };

      useTeamsStore.setState({ teams: [initialTeam] });

      const updates: UpdateTeamRequest = {
        name: 'New Name',
        description: 'New description',
      };

      const updatedTeam = { ...initialTeam, ...updates };
      vi.mocked(hostApiFetch).mockResolvedValueOnce({ teams: [updatedTeam] });

      const { updateTeam } = useTeamsStore.getState();
      await updateTeam('team-1', updates);

      const state = useTeamsStore.getState();
      expect(state.teams[0].name).toBe('New Name');
      expect(state.teams[0].description).toBe('New description');
    });
  });

  describe('deleteTeam', () => {
    it('should remove team from store', async () => {
      const team: TeamSummary = {
        id: 'team-1',
        name: 'Team to Delete',
        leaderId: 'agent-1',
        memberIds: [],
        description: '',
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        memberCount: 1,
        activeTaskCount: 0,
        lastActiveTime: undefined,
        leaderName: 'Alice',
        memberAvatars: [],
      };

      useTeamsStore.setState({ teams: [team] });

      vi.mocked(hostApiFetch).mockResolvedValueOnce({ teams: [] });

      const { deleteTeam } = useTeamsStore.getState();
      await deleteTeam('team-1');

      const state = useTeamsStore.getState();
      expect(state.teams).toHaveLength(0);
    });
  });

  describe('addMember', () => {
    it('should add member to team', async () => {
      const team: TeamSummary = {
        id: 'team-1',
        name: 'Team',
        leaderId: 'agent-1',
        memberIds: ['agent-2'],
        description: '',
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        memberCount: 2,
        activeTaskCount: 0,
        lastActiveTime: undefined,
        leaderName: 'Alice',
        memberAvatars: [],
      };

      useTeamsStore.setState({ teams: [team] });

      const updatedTeam = {
        ...team,
        memberIds: ['agent-2', 'agent-3'],
        memberCount: 3,
      };

      vi.mocked(hostApiFetch).mockResolvedValueOnce({ teams: [updatedTeam] });

      const { addMember } = useTeamsStore.getState();
      await addMember('team-1', 'agent-3');

      const state = useTeamsStore.getState();
      expect(state.teams[0].memberIds).toContain('agent-3');
      expect(state.teams[0].memberCount).toBe(3);
    });
  });

  describe('removeMember', () => {
    it('should remove member from team', async () => {
      const team: TeamSummary = {
        id: 'team-1',
        name: 'Team',
        leaderId: 'agent-1',
        memberIds: ['agent-2', 'agent-3'],
        description: '',
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        memberCount: 3,
        activeTaskCount: 0,
        lastActiveTime: undefined,
        leaderName: 'Alice',
        memberAvatars: [],
      };

      useTeamsStore.setState({ teams: [team] });

      const updatedTeam = {
        ...team,
        memberIds: ['agent-2'],
        memberCount: 2,
      };

      vi.mocked(hostApiFetch).mockResolvedValueOnce({ teams: [updatedTeam] });

      const { removeMember } = useTeamsStore.getState();
      await removeMember('team-1', 'agent-3');

      const state = useTeamsStore.getState();
      expect(state.teams[0].memberIds).not.toContain('agent-3');
      expect(state.teams[0].memberCount).toBe(2);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useTeamsStore.setState({ error: 'Some error' });

      const { clearError } = useTeamsStore.getState();
      clearError();

      const state = useTeamsStore.getState();
      expect(state.error).toBeNull();
    });
  });
});
