import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readOpenClawConfig: vi.fn(),
  writeOpenClawConfig: vi.fn(),
  listAgentsSnapshot: vi.fn(),
  listTaskSnapshots: vi.fn(),
}));

vi.mock('@electron/utils/channel-config', () => ({
  readOpenClawConfig: mocks.readOpenClawConfig,
  writeOpenClawConfig: mocks.writeOpenClawConfig,
}));

vi.mock('@electron/utils/agent-config', () => ({
  listAgentsSnapshot: mocks.listAgentsSnapshot,
}));

vi.mock('@electron/utils/task-config', () => ({
  listTaskSnapshots: mocks.listTaskSnapshots,
}));

describe('team rollup summary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.readOpenClawConfig.mockResolvedValue({
      teams: {
        teams: [
          {
            id: 'team-1',
            name: 'Alpha Team',
            leaderId: 'main',
            memberIds: ['researcher'],
            description: '',
            status: 'idle',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
    });

    mocks.listAgentsSnapshot.mockResolvedValue({
      agents: [
        {
          id: 'main',
          name: 'Main',
          avatar: null,
        },
        {
          id: 'researcher',
          name: 'Researcher',
          avatar: null,
        },
      ],
    });

    mocks.listTaskSnapshots.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Investigate OAuth callback',
        description: 'Track the failing redirect',
        status: 'in-progress',
        priority: 'high',
        assigneeId: 'researcher',
        workState: 'working',
        teamId: 'team-1',
        teamName: 'Alpha Team',
        isTeamTask: true,
        canonicalExecution: null,
        createdAt: '2026-04-07T00:00:00.000Z',
        updatedAt: '2026-04-07T00:05:00.000Z',
      },
      {
        id: 'task-2',
        title: 'Approve rollout',
        description: 'Handle the blocker',
        status: 'review',
        priority: 'medium',
        assigneeId: 'main',
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
        updatedAt: '2026-04-07T00:07:00.000Z',
      },
    ]);
  });

  it('computes active task count, last active time, and blocked status from canonical tasks', async () => {
    const { listTeamsSnapshot } = await import('@electron/utils/team-config');

    const [team] = await listTeamsSnapshot();

    expect(team.activeTaskCount).toBe(2);
    expect(typeof team.lastActiveTime).toBe('number');
    expect(team.status).toBe('blocked');
  });
});
