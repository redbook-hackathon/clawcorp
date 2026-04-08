import { describe, expect, it } from 'vitest';
import {
  buildLeaderTeamNaming,
  getLeaderReuseCount,
} from '@/components/team/team-creation-utils';

describe('team-creation-utils', () => {
  it('returns the base leader and team name when the agent has not led another team yet', () => {
    expect(buildLeaderTeamNaming('Main', 0)).toEqual({
      leaderDisplayName: 'Main',
      defaultTeamName: 'Main 的团队',
    });
  });

  it('adds a numeric suffix when the agent already leads another team', () => {
    expect(buildLeaderTeamNaming('Main', 1)).toEqual({
      leaderDisplayName: 'Main-1',
      defaultTeamName: 'Main 的团队-1',
    });
    expect(buildLeaderTeamNaming('Main', 2)).toEqual({
      leaderDisplayName: 'Main-2',
      defaultTeamName: 'Main 的团队-2',
    });
  });

  it('counts only teams where the agent is the leader', () => {
    const teams = [
      { id: 'team-1', leaderId: 'agent-1', memberIds: ['agent-2'] },
      { id: 'team-2', leaderId: 'agent-3', memberIds: ['agent-1'] },
      { id: 'team-3', leaderId: 'agent-1', memberIds: [] },
    ];

    expect(getLeaderReuseCount(teams, 'agent-1')).toBe(2);
    expect(getLeaderReuseCount(teams, 'agent-3')).toBe(1);
    expect(getLeaderReuseCount(teams, 'agent-9')).toBe(0);
  });
});
