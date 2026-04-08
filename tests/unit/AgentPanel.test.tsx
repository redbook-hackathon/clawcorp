import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AgentPanel } from '@/components/team/AgentPanel';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';

vi.mock('@/stores/agents');
vi.mock('@/stores/teams');
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

const mockAgents: AgentSummary[] = [
  {
    id: 'agent-1',
    name: 'Alice',
    persona: 'Frontend Developer',
    isDefault: false,
    model: 'gpt-4',
    modelDisplay: 'GPT-4',
    inheritedModel: false,
    workspace: '/workspace',
    agentDir: '/agents/alice',
    mainSessionKey: 'session-1',
    channelTypes: [],
    teamRole: 'worker',
    chatAccess: 'direct',
    responsibility: 'Build UI',
    avatar: null,
  },
  {
    id: 'agent-2',
    name: 'Bob',
    persona: 'Backend Developer',
    isDefault: false,
    model: 'gpt-4',
    modelDisplay: 'GPT-4',
    inheritedModel: false,
    workspace: '/workspace',
    agentDir: '/agents/bob',
    mainSessionKey: 'session-2',
    channelTypes: [],
    teamRole: 'worker',
    chatAccess: 'direct',
    responsibility: 'Build API',
    avatar: null,
  },
];

const mockTeams: TeamSummary[] = [
  {
    id: 'team-1',
    name: 'Team Alpha',
    leaderId: 'agent-1',
    memberIds: ['agent-2'],
    description: 'Test team',
    status: 'idle',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    memberCount: 2,
    activeTaskCount: 0,
    lastActiveTime: undefined,
    leaderName: 'Alice',
    memberAvatars: [],
  },
];

describe('AgentPanel', () => {
  beforeEach(() => {
    vi.mocked(useAgentsStore).mockReturnValue({
      agents: mockAgents,
      fetchAgents: vi.fn(),
      loading: false,
      error: null,
    } as any);

    vi.mocked(useTeamsStore).mockReturnValue({
      teams: mockTeams,
    } as any);

    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => null);
    Storage.prototype.setItem = vi.fn();
  });

  it('renders all agents', () => {
    render(<AgentPanel />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays team badge for agents in teams', () => {
    render(<AgentPanel />);
    // Both Alice (leader) and Bob (member) are in 1 team
    const badges = screen.getAllByText('1 个团队');
    expect(badges).toHaveLength(2);
  });

  it('can be collapsed and expanded', async () => {
    render(<AgentPanel />);

    // Find collapse button
    const collapseButton = screen.getByRole('button', { name: /collapse|expand/i });
    fireEvent.click(collapseButton);

    // Panel should be collapsed (agents not visible)
    await waitFor(() => {
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });
  });

  it('persists collapse state to localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<AgentPanel />);

    const collapseButton = screen.getByRole('button', { name: /collapse|expand/i });
    fireEvent.click(collapseButton);

    expect(setItemSpy).toHaveBeenCalledWith('agentPanelCollapsed', 'true');
  });

  it('fetches agents on mount', () => {
    const fetchAgents = vi.fn();
    vi.mocked(useAgentsStore).mockReturnValue({
      agents: [],
      fetchAgents,
      loading: false,
      error: null,
    } as any);

    render(<AgentPanel />);
    expect(fetchAgents).toHaveBeenCalled();
  });
});
