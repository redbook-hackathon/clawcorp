import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TeamGrid } from '@/components/team/TeamGrid';
import type { TeamSummary } from '@/types/team';

const mockTeams: TeamSummary[] = [
  {
    id: 'team-1',
    name: 'Team Alpha',
    leaderId: 'leader-1',
    memberIds: ['member-1', 'member-2'],
    description: 'First team',
    status: 'active',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    memberCount: 3,
    activeTaskCount: 5,
    lastActiveTime: Date.now() - 300000,
    leaderName: 'Alice',
    memberAvatars: [
      { id: 'leader-1', name: 'Alice', avatar: undefined },
      { id: 'member-1', name: 'Bob', avatar: undefined },
    ],
  },
  {
    id: 'team-2',
    name: 'Team Beta',
    leaderId: 'leader-2',
    memberIds: ['member-3'],
    description: 'Second team',
    status: 'idle',
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now(),
    memberCount: 2,
    activeTaskCount: 2,
    lastActiveTime: Date.now() - 600000,
    leaderName: 'Charlie',
    memberAvatars: [{ id: 'leader-2', name: 'Charlie', avatar: undefined }],
  },
  {
    id: 'team-3',
    name: 'Team Gamma',
    leaderId: 'leader-3',
    memberIds: [],
    description: 'Third team',
    status: 'blocked',
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now(),
    memberCount: 1,
    activeTaskCount: 1,
    lastActiveTime: Date.now() - 900000,
    leaderName: 'David',
    memberAvatars: [{ id: 'leader-3', name: 'David', avatar: undefined }],
  },
];

function renderTeamGrid(teams: TeamSummary[] = mockTeams, loading = false, onDeleteTeam = vi.fn()) {
  return render(
    <BrowserRouter>
      <TeamGrid teams={teams} loading={loading} onDeleteTeam={onDeleteTeam} />
    </BrowserRouter>,
  );
}

describe('TeamGrid', () => {
  it('renders all teams in grid layout', () => {
    renderTeamGrid();
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
    expect(screen.getByText('Team Gamma')).toBeInTheDocument();
  });

  it('applies responsive grid classes', () => {
    const { container } = renderTeamGrid();
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('lg:grid-cols-3');
  });

  it('sorts teams by creation time (newest first)', () => {
    renderTeamGrid();
    const teamNames = screen.getAllByRole('heading', { level: 3 });
    expect(teamNames[0]).toHaveTextContent('Team Gamma');
    expect(teamNames[1]).toHaveTextContent('Team Alpha');
    expect(teamNames[2]).toHaveTextContent('Team Beta');
  });

  it('shows empty state when no teams exist', () => {
    renderTeamGrid([]);
    expect(screen.getByText('还没有团队')).toBeInTheDocument();
    expect(screen.getByText(/Agent/)).toBeInTheDocument();
  });

  it('does not show empty state when teams exist', () => {
    renderTeamGrid();
    expect(screen.queryByText('还没有团队')).not.toBeInTheDocument();
  });

  it('passes onDeleteTeam callback to TeamCard', async () => {
    const onDeleteTeam = vi.fn();
    renderTeamGrid(mockTeams, false, onDeleteTeam);

    fireEvent.click(screen.getAllByRole('button', { name: '更多操作' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    const dialog = screen.getByRole('dialog');

    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button')[1]);
    });

    expect(onDeleteTeam).toHaveBeenCalledWith('team-3');
  });

  it('renders loading state', () => {
    renderTeamGrid([], true);
    expect(screen.queryByText('还没有团队')).not.toBeInTheDocument();
  });

  it('applies gap spacing between cards', () => {
    const { container } = renderTeamGrid();
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('gap-6');
  });

  it('derives leader display aliases per team when the same leader owns multiple teams', () => {
    const duplicatedLeaderTeams: TeamSummary[] = [
      {
        ...mockTeams[0],
        id: 'team-a',
        name: 'Main 的团队',
        leaderId: 'leader-main',
        leaderName: 'Main',
        createdAt: 1,
      },
      {
        ...mockTeams[1],
        id: 'team-b',
        name: 'Main 的团队-1',
        leaderId: 'leader-main',
        leaderName: 'Main',
        createdAt: 2,
      },
    ];

    renderTeamGrid(duplicatedLeaderTeams);

    expect(screen.getAllByText('Main')).toHaveLength(1);
    expect(screen.getByText('Main-1')).toBeInTheDocument();
  });
});
