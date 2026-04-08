import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TeamCard } from '@/components/team/TeamCard';
import type { TeamSummary } from '@/types/team';

const mockTeam: TeamSummary = {
  id: 'team-1',
  name: 'Engineering Team',
  leaderId: 'leader-1',
  memberIds: ['member-1', 'member-2', 'member-3'],
  description:
    'This is a test team description that should be truncated to two lines when it exceeds the maximum length allowed for display in the card component.',
  status: 'active',
  createdAt: Date.now() - 86_400_000,
  updatedAt: Date.now(),
  memberCount: 4,
  activeTaskCount: 5,
  lastActiveTime: Date.now() - 300_000,
  leaderName: 'Alice',
  memberAvatars: [
    { id: 'leader-1', name: 'Alice', avatar: undefined },
    { id: 'member-1', name: 'Bob', avatar: undefined },
    { id: 'member-2', name: 'Charlie', avatar: undefined },
    { id: 'member-3', name: 'David', avatar: undefined },
  ],
};

function renderTeamCard(team: TeamSummary = mockTeam, onDelete = vi.fn()) {
  return render(
    <BrowserRouter>
      <TeamCard team={team} onDelete={onDelete} />
    </BrowserRouter>,
  );
}

describe('TeamCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the team name and leader information', () => {
    renderTeamCard();

    expect(screen.getByText('Engineering Team')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders member count, status, and task count', () => {
    renderTeamCard();

    expect(screen.getByText(/4.*成员/)).toBeInTheDocument();
    expect(screen.getByText('活跃')).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes('5') && content.includes('任务')),
    ).toBeInTheDocument();
  });

  it('renders description with line clamp when provided', () => {
    renderTeamCard();

    const description = screen.getByText(/This is a test team description/);
    expect(description).toHaveClass('line-clamp-2');
  });

  it('omits the description block when no description is provided', () => {
    renderTeamCard({ ...mockTeam, description: '' });

    expect(screen.queryByText(/This is a test team description/)).not.toBeInTheDocument();
  });

  it('shows the first three avatars and an overflow badge for remaining members', () => {
    const { container } = renderTeamCard();

    const avatarNodes = Array.from(container.querySelectorAll('[title]')).map((node) =>
      node.getAttribute('title'),
    );

    expect(avatarNodes).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('computes overflow against the displayed avatar budget', () => {
    renderTeamCard({
      ...mockTeam,
      memberCount: 8,
      memberAvatars: [
        ...mockTeam.memberAvatars,
        { id: 'member-4', name: 'Eve', avatar: undefined },
        { id: 'member-5', name: 'Frank', avatar: undefined },
      ],
    });

    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('navigates to the team map when the card body is clicked', () => {
    renderTeamCard();

    expect(screen.getByRole('link')).toHaveAttribute('href', '/team-map/team-1');
  });

  it('reveals delete actions through the overflow menu', () => {
    renderTeamCard();

    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));

    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
  });

  it('puts the team name into edit mode when the overflow menu edit action is chosen', () => {
    renderTeamCard();

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));

    expect(screen.getByDisplayValue('Engineering Team')).toBeInTheDocument();
  });

  it('opens an in-app confirm dialog before deleting', () => {
    const onDelete = vi.fn();

    renderTeamCard(mockTeam, onDelete);
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDelete after the user confirms deletion in the dialog', async () => {
    const onDelete = vi.fn();

    renderTeamCard(mockTeam, onDelete);
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button')[1]);
    });

    expect(onDelete).toHaveBeenCalledWith('team-1');
  });

  it('does not delete when the confirmation dialog is cancelled', async () => {
    const onDelete = vi.fn();

    renderTeamCard(mockTeam, onDelete);
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button')[0]);
    });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('renders idle status styling', () => {
    renderTeamCard({ ...mockTeam, status: 'idle' });

    expect(screen.getByText('空闲')).toBeInTheDocument();
  });

  it('renders blocked status styling', () => {
    renderTeamCard({ ...mockTeam, status: 'blocked' });

    expect(screen.getByText('阻塞')).toBeInTheDocument();
  });

  it('formats last active time as a relative label', () => {
    renderTeamCard();

    expect(screen.getByText(/分钟前/)).toBeInTheDocument();
  });
});
