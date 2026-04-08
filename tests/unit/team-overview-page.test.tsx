import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { TeamSummary } from '@/types/team';

const { teamsStoreState, agentsStoreState } = vi.hoisted(() => ({
  teamsStoreState: {
    teams: [] as TeamSummary[],
    loading: false,
    error: null as string | null,
    fetchTeams: vi.fn(async () => {}),
    createTeam: vi.fn(async () => {}),
    updateTeam: vi.fn(async () => {}),
    deleteTeam: vi.fn(async () => {}),
  },
  agentsStoreState: {
    agents: [] as Array<{ id: string; name: string }>,
    fetchAgents: vi.fn(async () => {}),
    loading: false,
    error: null as string | null,
  },
}));

vi.mock('@/stores/teams', () => ({
  useTeamsStore: (selector?: (state: typeof teamsStoreState) => unknown) =>
    selector ? selector(teamsStoreState) : teamsStoreState,
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector?: (state: typeof agentsStoreState) => unknown) =>
    selector ? selector(agentsStoreState) : agentsStoreState,
}));

vi.mock('@/components/team/TeamGrid', async () => {
  const React = await import('react');
  return {
    TeamGrid: ({
      teams,
      onDeleteTeam,
    }: {
      teams: TeamSummary[];
      loading: boolean;
      onDeleteTeam: (teamId: string) => Promise<void>;
    }) => (
      <div data-testid="team-grid">
        <div>team-count:{teams.length}</div>
        {teams.map((team) => (
          <div key={team.id}>{team.name}</div>
        ))}
        <button type="button" onClick={() => void onDeleteTeam(teams[0]?.id ?? '')}>
          delete-first-team
        </button>
      </div>
    ),
  };
});

vi.mock('@/components/team/AgentPanel', async () => {
  const React = await import('react');
  return {
    AgentPanel: ({ onClose }: { onClose: () => void }) => (
      <div data-testid="agent-panel">
        <button type="button" aria-label="close-agent-panel" onClick={onClose}>
          close-agent-panel
        </button>
      </div>
    ),
  };
});

vi.mock('@/components/team/CreateTeamZone', async () => {
  const React = await import('react');
  type CreateTeamZoneProps = {
    onCancel?: () => void;
    onSuccess?: () => void;
    isDragging?: boolean;
  };
  const CreateTeamZone = React.forwardRef<
    { handleLeaderDrop: (agentId: string) => void; handleMemberDrop: (agentId: string) => void },
    CreateTeamZoneProps
  >(({ onCancel, onSuccess, isDragging = false }, ref) => {
    React.useImperativeHandle(ref, () => ({
      handleLeaderDrop: vi.fn(),
      handleMemberDrop: vi.fn(),
    }));

    return (
      <div data-testid="create-team-zone" data-dragging={isDragging ? 'yes' : 'no'}>
        <button type="button" onClick={onCancel}>
          cancel-create
        </button>
        <button type="button" onClick={onSuccess}>
          success-create
        </button>
      </div>
    );
  });
  CreateTeamZone.displayName = 'MockCreateTeamZone';
  return { CreateTeamZone };
});

import { TeamOverview } from '@/pages/TeamOverview';

const sampleTeam: TeamSummary = {
  id: 'team-1',
  name: 'Engineering Team',
  leaderId: 'leader-1',
  memberIds: ['member-1', 'member-2'],
  description: 'Coordinate execution',
  status: 'active',
  createdAt: Date.now() - 86_400_000,
  updatedAt: Date.now(),
  memberCount: 3,
  activeTaskCount: 2,
  lastActiveTime: Date.now() - 60_000,
  leaderName: 'Alice',
  memberAvatars: [
    { id: 'leader-1', name: 'Alice', avatar: undefined },
    { id: 'member-1', name: 'Bob', avatar: undefined },
  ],
};

describe('TeamOverview page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamsStoreState.teams = [];
    teamsStoreState.loading = false;
    teamsStoreState.error = null;
    agentsStoreState.agents = [];
  });

  it('fetches teams on mount and shows the empty state when there are no teams', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: '团队总览' })).toBeInTheDocument();
    expect(screen.getByText('共 0 个团队')).toBeInTheDocument();
    expect(screen.getByText('还没有团队')).toBeInTheDocument();
    expect(screen.queryByTestId('team-grid')).not.toBeInTheDocument();
  });

  it('renders the team grid when teams already exist', async () => {
    teamsStoreState.teams = [sampleTeam];

    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('team-grid')).toBeInTheDocument();
    expect(screen.getByText('Engineering Team')).toBeInTheDocument();
    expect(screen.queryByText('还没有团队')).not.toBeInTheDocument();
  });

  it('enters create mode and shows the create zone plus agent panel', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '新建团队' }));

    expect(screen.getByTestId('create-team-zone')).toBeInTheDocument();
    expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建团队' })).toBeDisabled();
  });

  it('leaves create mode when the create zone cancels', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '新建团队' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel-create' }));

    await waitFor(() => {
      expect(screen.queryByTestId('create-team-zone')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-panel')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '新建团队' })).not.toBeDisabled();
  });

  it('leaves create mode when the agent panel closes', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '新建团队' }));
    fireEvent.click(screen.getByRole('button', { name: 'close-agent-panel' }));

    await waitFor(() => {
      expect(screen.queryByTestId('create-team-zone')).not.toBeInTheDocument();
      expect(screen.queryByTestId('agent-panel')).not.toBeInTheDocument();
    });
  });

  it('refetches teams and exits create mode after a successful team creation', async () => {
    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '新建团队' }));
    fireEvent.click(screen.getByRole('button', { name: 'success-create' }));

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByTestId('create-team-zone')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-panel')).not.toBeInTheDocument();
  });

  it('wires the grid delete callback to the teams store', async () => {
    teamsStoreState.teams = [sampleTeam];

    render(
      <MemoryRouter>
        <TeamOverview />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'delete-first-team' }));

    expect(teamsStoreState.deleteTeam).toHaveBeenCalledWith('team-1');
  });
});
