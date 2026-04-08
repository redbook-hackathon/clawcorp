import { describe, it, expect } from 'vitest';
import type { Team, TeamStatus, TeamSummary, CreateTeamRequest, UpdateTeamRequest } from '@/types/team';

describe('Team Types', () => {
  describe('TeamStatus', () => {
    it('should accept valid status values', () => {
      const validStatuses: TeamStatus[] = ['active', 'idle', 'blocked'];
      expect(validStatuses).toHaveLength(3);
    });
  });

  describe('Team interface', () => {
    it('should have all required fields', () => {
      const team: Team = {
        id: 'team-123',
        name: 'Test Team',
        leaderId: 'agent-1',
        memberIds: ['agent-2', 'agent-3'],
        description: 'A test team',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(team.id).toBe('team-123');
      expect(team.name).toBe('Test Team');
      expect(team.leaderId).toBe('agent-1');
      expect(team.memberIds).toEqual(['agent-2', 'agent-3']);
      expect(team.description).toBe('A test team');
      expect(team.status).toBe('active');
      expect(typeof team.createdAt).toBe('number');
      expect(typeof team.updatedAt).toBe('number');
    });
  });

  describe('TeamSummary interface', () => {
    it('should extend Team with additional display fields', () => {
      const teamSummary: TeamSummary = {
        id: 'team-123',
        name: 'Test Team',
        leaderId: 'agent-1',
        memberIds: ['agent-2', 'agent-3'],
        description: 'A test team',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        memberCount: 3,
        activeTaskCount: 5,
        lastActiveTime: Date.now(),
        leaderName: 'Alice',
        memberAvatars: [
          { id: 'agent-1', name: 'Alice', avatar: '/avatars/alice.png' },
          { id: 'agent-2', name: 'Bob' },
        ],
      };

      expect(teamSummary.memberCount).toBe(3);
      expect(teamSummary.activeTaskCount).toBe(5);
      expect(typeof teamSummary.lastActiveTime).toBe('number');
      expect(teamSummary.leaderName).toBe('Alice');
      expect(teamSummary.memberAvatars).toHaveLength(2);
    });

    it('should allow optional lastActiveTime', () => {
      const teamSummary: TeamSummary = {
        id: 'team-123',
        name: 'Test Team',
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

      expect(teamSummary.lastActiveTime).toBeUndefined();
    });
  });

  describe('CreateTeamRequest interface', () => {
    it('should require leaderId and memberIds', () => {
      const request: CreateTeamRequest = {
        leaderId: 'agent-1',
        memberIds: ['agent-2', 'agent-3'],
      };

      expect(request.leaderId).toBe('agent-1');
      expect(request.memberIds).toEqual(['agent-2', 'agent-3']);
    });

    it('should allow optional name and description', () => {
      const request: CreateTeamRequest = {
        leaderId: 'agent-1',
        memberIds: ['agent-2'],
        name: 'Custom Team Name',
        description: 'Custom description',
      };

      expect(request.name).toBe('Custom Team Name');
      expect(request.description).toBe('Custom description');
    });
  });

  describe('UpdateTeamRequest interface', () => {
    it('should allow partial updates', () => {
      const updateName: UpdateTeamRequest = {
        name: 'New Name',
      };

      const updateDescription: UpdateTeamRequest = {
        description: 'New description',
      };

      const updateMembers: UpdateTeamRequest = {
        memberIds: ['agent-4', 'agent-5'],
      };

      expect(updateName.name).toBe('New Name');
      expect(updateDescription.description).toBe('New description');
      expect(updateMembers.memberIds).toEqual(['agent-4', 'agent-5']);
    });
  });
});
