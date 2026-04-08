import { describe, expect, it } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';
import {
  getTeamMapLeader,
  getTeamMapMembers,
  getTeamMapState,
} from '@/components/team-map/team-map-selectors';

const agents: AgentSummary[] = [
  {
    id: 'main',
    name: 'Main',
    persona: 'Primary agent',
    isDefault: true,
    model: 'gpt-5.4',
    modelDisplay: 'GPT-5.4',
    inheritedModel: false,
    workspace: '~/workspace',
    agentDir: '~/agents/main',
    mainSessionKey: 'agent:main:main',
    channelTypes: ['feishu'],
    teamRole: 'leader',
    chatAccess: 'direct',
    responsibility: 'Coordinate team operations',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    persona: 'Finds information',
    isDefault: false,
    model: 'claude-sonnet-4',
    modelDisplay: 'Claude Sonnet 4',
    inheritedModel: true,
    workspace: '~/workspace-researcher',
    agentDir: '~/agents/researcher',
    mainSessionKey: 'agent:researcher:main',
    channelTypes: [],
    teamRole: 'worker',
    chatAccess: 'leader_only',
    responsibility: 'Finds information',
    reportsTo: 'main',
  },
  {
    id: 'operator',
    name: 'Operator',
    persona: 'Executes operations',
    isDefault: false,
    model: 'gpt-5-mini',
    modelDisplay: 'GPT-5 Mini',
    inheritedModel: true,
    workspace: '~/workspace-operator',
    agentDir: '~/agents/operator',
    mainSessionKey: 'agent:operator:main',
    channelTypes: [],
    teamRole: 'worker',
    chatAccess: 'direct',
    responsibility: 'Runs tasks',
    reportsTo: 'main',
  },
];

const team: TeamSummary = {
  id: 'team-alpha',
  name: 'Alpha Team',
  leaderId: 'main',
  memberIds: ['researcher'],
  description: 'Handles research',
  status: 'active',
  createdAt: 1,
  updatedAt: 1,
  memberCount: 2,
  activeTaskCount: 1,
  lastActiveTime: Date.now(),
  leaderName: 'Main',
  memberAvatars: [],
};

describe('team-map selectors', () => {
  it('finds the leader from the current team', () => {
    expect(getTeamMapLeader(agents, team)?.id).toBe('main');
  });

  it('returns only team members and excludes the leader', () => {
    const members = getTeamMapMembers(agents, team);
    expect(members.map((agent) => agent.id)).toEqual(['researcher']);
  });

  it('ignores missing ids without throwing', () => {
    const state = getTeamMapState(agents, {
      ...team,
      memberIds: ['researcher', 'missing-agent'],
    });

    expect(state.leader?.id).toBe('main');
    expect(state.members.map((agent) => agent.id)).toEqual(['researcher']);
    expect(state.scopedAgents.map((agent) => agent.id)).toEqual(['main', 'researcher']);
  });

  it('does not leak agents that are outside the current team', () => {
    const state = getTeamMapState(agents, team);
    expect(state.scopedAgents.find((agent) => agent.id === 'operator')).toBeUndefined();
  });
});
