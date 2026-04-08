import { describe, expect, it } from 'vitest';
import { buildEmployeeSquareCardModels } from '@/lib/agent-square-view-model';
import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';
import type { KanbanTask } from '@/types/task';

function createTeam(overrides: Partial<TeamSummary>): TeamSummary {
  return {
    id: 'team-1',
    name: 'Alpha Team',
    leaderId: 'main',
    memberIds: [],
    description: '',
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    memberCount: 1,
    activeTaskCount: 2,
    lastActiveTime: undefined,
    leaderName: 'Main',
    memberAvatars: [],
    ...overrides,
  };
}

function createAgent(overrides: Partial<AgentSummary>): AgentSummary {
  return {
    id: 'main',
    name: 'Main',
    persona: 'Coordinates the team',
    isDefault: false,
    model: 'openai/gpt-5.4',
    modelDisplay: 'GPT-5.4',
    inheritedModel: false,
    workspace: '~/.openclaw/workspace',
    agentDir: '~/.openclaw/agents/main/agent',
    mainSessionKey: 'agent:main:main',
    channelTypes: ['feishu'],
    avatar: null,
    teamRole: 'leader',
    chatAccess: 'direct',
    responsibility: 'Coordinate work',
    reportsTo: null,
    directReports: [],
    ...overrides,
  };
}

describe('buildEmployeeSquareCardModels', () => {
  it('sorts leaders before workers, then by recency, then by name', () => {
    const now = Date.UTC(2026, 3, 3, 12, 0, 0);
    const agents = [
      createAgent({
        id: 'zoe',
        name: 'Zoe',
        mainSessionKey: 'agent:zoe:main',
        teamRole: 'worker',
      }),
      createAgent({
        id: 'alice',
        name: 'Alice',
        mainSessionKey: 'agent:alice:main',
        teamRole: 'worker',
      }),
      createAgent({
        id: 'lead',
        name: 'Lead',
        mainSessionKey: 'agent:lead:main',
        teamRole: 'leader',
      }),
    ];

    const models = buildEmployeeSquareCardModels({
      agents,
      teams: [],
      sessionLastActivity: {
        'agent:alice:main': now - 30_000,
        'agent:lead:main': now - 90_000,
        'agent:zoe:main': now - 120_000,
      },
      now,
    });

    expect(models.map((model) => model.id)).toEqual(['lead', 'alice', 'zoe']);
  });

  it('derives team labels, direct-chat flags, and detail links from team/session state', () => {
    const now = Date.UTC(2026, 3, 3, 12, 0, 0);
    const agents = [
      createAgent({
        id: 'main',
        name: 'Main',
        mainSessionKey: 'agent:main:main',
        teamRole: 'leader',
      }),
      createAgent({
        id: 'researcher',
        name: 'Researcher',
        mainSessionKey: 'agent:researcher:main',
        teamRole: 'worker',
        chatAccess: 'leader_only',
      }),
      createAgent({
        id: 'analyst',
        name: 'Analyst',
        mainSessionKey: 'agent:analyst:main',
        teamRole: 'leader',
      }),
    ];

    const teams = [
      createTeam({
        id: 'alpha',
        name: 'Alpha Team',
        leaderId: 'main',
        memberIds: ['researcher'],
        memberCount: 2,
      }),
      createTeam({
        id: 'beta',
        name: 'Beta Team',
        leaderId: 'analyst',
        memberIds: ['researcher'],
        memberCount: 2,
      }),
    ];

    const models = buildEmployeeSquareCardModels({
      agents,
      teams,
      sessionLastActivity: {
        'agent:main:main': now - 60_000,
      },
      now,
    });

    const main = models.find((model) => model.id === 'main');
    const researcher = models.find((model) => model.id === 'researcher');

    expect(main?.teamLabels).toEqual(['Alpha Team']);
    expect(researcher?.teamLabels).toEqual(['Alpha Team', 'Beta Team']);
    expect(researcher?.isDirectChatBlocked).toBe(true);
    expect(researcher?.detailsHref).toBe('/agents/researcher');
    expect(researcher?.memoryHref).toBe('/agents/researcher?tab=memory');
    expect(researcher?.lastActiveLabel).toBe('最近暂无活动');
    expect(main?.activityTone).toBe('active');
    expect(researcher?.activityTone).toBe('idle');
  });

  it('uses canonical task summaries to promote blocked activity tone and current work summary', () => {
    const models = buildEmployeeSquareCardModels({
      agents: [
        createAgent({
          id: 'researcher',
          name: 'Researcher',
          mainSessionKey: 'agent:researcher:main',
          teamRole: 'worker',
        }),
      ],
      teams: [],
      sessionLastActivity: {},
      tasks: [
        {
          id: 'task-1',
          title: 'Investigate OAuth callback',
          description: 'Track the failing redirect',
          status: 'in-progress',
          priority: 'high',
          assigneeId: 'researcher',
          workState: 'blocked',
          blocker: {
            state: 'blocked',
            summary: 'Waiting on leader approval',
          },
          teamId: 'team-1',
          teamName: 'Alpha Team',
          isTeamTask: true,
          canonicalExecution: null,
          createdAt: '2026-04-07T00:00:00.000Z',
          updatedAt: '2026-04-07T00:05:00.000Z',
        } satisfies KanbanTask,
      ],
    });

    expect(models[0]?.activityTone).toBe('blocked');
    expect(models[0]?.currentWorkSummary).toBe('Investigate OAuth callback');
  });
});
