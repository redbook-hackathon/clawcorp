import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import { buildLeaderProgressBrief } from '@/lib/team-progress-brief';

describe('team progress brief', () => {
  const agents: AgentSummary[] = [
    {
      id: 'main',
      name: 'Main',
      persona: 'Leader',
      isDefault: true,
      model: 'gpt-5.4',
      modelDisplay: 'GPT-5.4',
      inheritedModel: false,
      workspace: '~/workspace-main',
      agentDir: '~/agents/main',
      mainSessionKey: 'agent:main:main',
      channelTypes: ['feishu'],
      teamRole: 'leader',
      chatAccess: 'direct',
      responsibility: 'Coordinate delivery',
      reportsTo: null,
    },
    {
      id: 'researcher',
      name: 'Researcher',
      persona: 'Worker',
      isDefault: false,
      model: 'claude-sonnet-4',
      modelDisplay: 'Claude Sonnet 4',
      inheritedModel: true,
      workspace: '~/workspace-researcher',
      agentDir: '~/agents/researcher',
      mainSessionKey: 'agent:researcher:main',
      channelTypes: ['telegram'],
      teamRole: 'worker',
      chatAccess: 'leader_only',
      responsibility: 'Find evidence',
      reportsTo: 'main',
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('builds a structured leader brief from kanban and team ownership state', () => {
    window.localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-1',
        title: 'Unblock data review',
        description: 'Waiting on approval',
        status: 'review',
        priority: 'high',
        assigneeId: 'researcher',
        workState: 'waiting_approval',
        createdAt: '2026-03-27T09:00:00Z',
        updatedAt: '2026-03-27T09:15:00Z',
      },
    ]));

    const brief = buildLeaderProgressBrief({
      leaderId: 'main',
      agents,
      sessionLastActivity: {
        'agent:main:main': Date.now(),
        'agent:researcher:main': Date.now(),
      },
      configuredChannelTypes: ['feishu', 'telegram'],
      channelOwners: {
        feishu: 'main',
      },
    });

    expect(brief.overallStatus).toBe('waiting_approval');
    expect(brief.summaryText).toContain('1 member needs approval');
    expect(brief.dashboard.activeMemberCount).toBe(1);
    expect(brief.dashboard.waitingApprovalCount).toBe(1);
    expect(brief.dashboard.primaryNextAction).toContain('Review approval');
    expect(brief.dashboard.activeWorkItems[0]).toMatchObject({
      memberName: 'Researcher',
      title: 'Unblock data review',
      statusKey: 'waiting_approval',
    });
    expect(brief.members.find((member) => member.id === 'main')?.ownedEntryPoints).toEqual(['feishu']);
    expect(brief.members.find((member) => member.id === 'researcher')?.currentWorkTitles).toContain('Unblock data review');
    expect(brief.nextSteps.length).toBeGreaterThan(0);
  });
});
