import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CreateTeamZone, type CreateTeamZoneRef } from '@/components/team/CreateTeamZone';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

vi.mock('@/stores/teams', () => ({
  useTeamsStore: vi.fn(),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: vi.fn(),
}));

describe('CreateTeamZone', () => {
  const mockCreateTeam = vi.fn();
  const mockTeams = [
    {
      id: 'team-1',
      name: 'Main 的团队',
      leaderId: 'agent-1',
      memberIds: ['agent-2'],
      description: '',
      status: 'idle',
      createdAt: 1,
      updatedAt: 1,
      memberCount: 2,
      activeTaskCount: 0,
      lastActiveTime: undefined,
      leaderName: 'Main',
      memberAvatars: [],
    },
  ];
  const mockAgents = [
    { id: 'agent-1', name: 'Main', avatar: null },
    { id: 'agent-2', name: 'Echo', avatar: null },
  ];
  type MockTeamsStore = {
    teams: typeof mockTeams;
    createTeam: typeof mockCreateTeam;
  };
  type MockAgentsStore = {
    agents: typeof mockAgents;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTeamsStore).mockImplementation((selector?: (state: MockTeamsStore) => unknown) => {
      const state: MockTeamsStore = {
        teams: mockTeams,
        createTeam: mockCreateTeam,
      };
      return selector ? selector(state) : state;
    });

    vi.mocked(useAgentsStore).mockImplementation((selector?: (state: MockAgentsStore) => unknown) => {
      const state: MockAgentsStore = {
        agents: mockAgents,
      };
      return selector ? selector(state) : state;
    });
  });

  it('uses a full-width create zone container instead of a narrow centered wrapper', () => {
    render(<CreateTeamZone />);

    const zone = screen.getByTestId('create-team-zone');
    expect(zone).toHaveClass('w-full');
    expect(zone).not.toHaveClass('max-w-3xl');
  });

  it('applies the leader suffix before opening confirmation and uses it for the default team name', async () => {
    const ref = createRef<CreateTeamZoneRef>();
    render(<CreateTeamZone ref={ref} />);

    await act(async () => {
      ref.current?.handleLeaderDrop('agent-1');
    });

    expect(await screen.findByText('Main-1')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    });

    expect(screen.getByDisplayValue('Main 的团队-1')).toBeInTheDocument();
  });

  it('submits the suffixed default team name when creating a second team for the same leader', async () => {
    const ref = createRef<CreateTeamZoneRef>();
    mockCreateTeam.mockResolvedValueOnce(undefined);

    render(<CreateTeamZone ref={ref} />);

    await act(async () => {
      ref.current?.handleLeaderDrop('agent-1');
      ref.current?.handleMemberDrop('agent-2');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: '确认创建' }));
    });

    expect(mockCreateTeam).toHaveBeenCalledWith({
      leaderId: 'agent-1',
      memberIds: ['agent-2'],
      name: 'Main 的团队-1',
      description: undefined,
    });
  });
  it('deduplicates member drops and ignores dropping the leader into the member zone', async () => {
    const ref = createRef<CreateTeamZoneRef>();
    mockCreateTeam.mockResolvedValueOnce(undefined);

    render(<CreateTeamZone ref={ref} />);

    await act(async () => {
      ref.current?.handleLeaderDrop('agent-1');
      ref.current?.handleMemberDrop('agent-1');
      ref.current?.handleMemberDrop('agent-2');
      ref.current?.handleMemberDrop('agent-2');
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button').at(-1)!);
    });

    await act(async () => {
      fireEvent.click((await screen.findAllByRole('button')).at(-1)!);
    });

    expect(mockCreateTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        leaderId: 'agent-1',
        memberIds: ['agent-2'],
      }),
    );
  });
});
