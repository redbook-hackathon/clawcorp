import { describe, expect, it, vi } from 'vitest';
import { deriveTeamWorkVisibility } from '@/lib/team-work-visibility';
import type { AgentSummary } from '@/types/agent';
import type { KanbanTask } from '@/types/task';

function createAgent(overrides: Partial<AgentSummary>): AgentSummary {
  return {
    id: 'main',
    name: 'Main',
    persona: 'Coordinates the team',
    isDefault: true,
    model: 'openai/gpt-5.4',
    modelDisplay: 'GPT-5.4',
    inheritedModel: false,
    workspace: '~/.openclaw/workspace',
    agentDir: '~/.openclaw/agents/main/agent',
    mainSessionKey: 'agent:main:main',
    channelTypes: [],
    avatar: null,
    teamRole: 'leader',
    chatAccess: 'direct',
    responsibility: 'Coordinate work',
    reportsTo: null,
    directReports: [],
    ...overrides,
  };
}

describe('deriveTeamWorkVisibility', () => {
  it('derives blocked work from canonical task snapshots instead of browser storage', () => {
    const visibility = deriveTeamWorkVisibility(
      [createAgent({ id: 'researcher', name: 'Researcher', mainSessionKey: 'agent:researcher:main' })],
      {},
      undefined,
      [
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
          isTeamTask: true,
          teamId: 'team-1',
          teamName: 'Alpha Team',
          canonicalExecution: null,
          createdAt: '2026-04-07T00:00:00.000Z',
          updatedAt: '2026-04-07T00:05:00.000Z',
        } satisfies KanbanTask,
      ],
    );

    expect(visibility.researcher.statusKey).toBe('blocked');
    expect(visibility.researcher.currentWorkTitles).toContain('Investigate OAuth callback');
    expect(visibility.researcher.activeTaskCount).toBe(1);
  });

  it('prioritizes runtime sessions but preserves canonical task summaries', () => {
    const visibility = deriveTeamWorkVisibility(
      [createAgent({ id: 'researcher', name: 'Researcher', mainSessionKey: 'agent:researcher:main' })],
      {},
      {
        researcher: [{ status: 'running', prompt: 'Investigate OAuth callback lineage' }],
      },
      [
        {
          id: 'task-1',
          title: 'Investigate OAuth callback',
          description: 'Track the failing redirect',
          status: 'in-progress',
          priority: 'high',
          assigneeId: 'researcher',
          workState: 'working',
          isTeamTask: true,
          teamId: 'team-1',
          teamName: 'Alpha Team',
          canonicalExecution: null,
          createdAt: '2026-04-07T00:00:00.000Z',
          updatedAt: '2026-04-07T00:05:00.000Z',
        } satisfies KanbanTask,
      ],
    );

    expect(visibility.researcher.statusKey).toBe('working');
    expect(visibility.researcher.currentWorkTitles).toEqual(
      expect.arrayContaining(['Investigate OAuth callback lineage', 'Investigate OAuth callback']),
    );
  });
});
