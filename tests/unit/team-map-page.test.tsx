import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';
import { TeamMap } from '@/pages/TeamMap';

const {
  agentsStoreState,
  teamsStoreState,
  chatStoreState,
  runtimeState,
} = vi.hoisted(() => ({
  agentsStoreState: {
    agents: [] as AgentSummary[],
    loading: false,
    defaultAgentId: 'main',
    configuredChannelTypes: [] as string[],
    channelOwners: {} as Record<string, string>,
    fetchAgents: vi.fn(async () => {}),
  },
  teamsStoreState: {
    teams: [] as TeamSummary[],
    loading: false,
    error: null as string | null,
    fetchTeams: vi.fn(async () => {}),
    addMember: vi.fn(async () => {}),
    removeMember: vi.fn(async () => {}),
  },
  chatStoreState: {
    sessionLastActivity: {} as Record<string, number>,
    openDirectAgentSession: vi.fn(() => 'agent:researcher:private-research'),
  },
  runtimeState: {
    byAgent: {} as Record<string, unknown[]>,
  },
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: () => agentsStoreState,
}));

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => teamsStoreState,
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatStoreState) => unknown) => selector(chatStoreState),
}));

vi.mock('@/hooks/use-team-runtime', () => ({
  useTeamRuntime: () => runtimeState,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.defaultValue && typeof options.defaultValue === 'string') {
        return options.defaultValue;
      }
      return key;
    },
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/team-map/:teamId" element={<TeamMap />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TeamMap page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    agentsStoreState.loading = false;
    teamsStoreState.loading = false;
    agentsStoreState.defaultAgentId = 'main';
    agentsStoreState.configuredChannelTypes = ['feishu'];
    agentsStoreState.channelOwners = { feishu: 'main' };
    agentsStoreState.agents = [
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

    teamsStoreState.teams = [
      {
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
      },
    ];

    chatStoreState.sessionLastActivity = {
      'agent:main:main': Date.now(),
      'agent:researcher:main': Date.now(),
    };

    runtimeState.byAgent = {};
  });

  it('renders the phase-04 header and only the selected team members', async () => {
    renderAt('/team-map/team-alpha');

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
      expect(teamsStoreState.fetchTeams).toHaveBeenCalled();
    });

    expect(screen.getByRole('button', { name: 'Back to Team Overview' })).toBeInTheDocument();
    expect(screen.getByText('Alpha Team')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Team Member' })).toBeInTheDocument();

    expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Researcher').length).toBeGreaterThan(0);
    expect(screen.queryByText('Operator')).not.toBeInTheDocument();

    expect(screen.queryByText('teamMap.rail.title')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'teamMap.tabs.teams' })).not.toBeInTheDocument();
  });

  it('shows a recoverable team-not-found state for invalid routes', async () => {
    renderAt('/team-map/missing-team');

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalled();
    });

    expect(screen.getByText('Team not found')).toBeInTheDocument();
    expect(
      screen.getByText('Return to Team Overview and choose a valid team.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Team Overview' })).toHaveAttribute(
      'href',
      '/team-overview',
    );
  });

  it('shows a dedicated loading state instead of the empty-team helper while stores are loading', () => {
    agentsStoreState.loading = true;
    teamsStoreState.loading = true;
    teamsStoreState.teams = [];

    renderAt('/team-map/team-alpha');

    expect(screen.getByText('Loading team map...')).toBeInTheDocument();
    expect(screen.queryByText('No members in this team yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Team Member' })).toBeDisabled();
  });

  it('opens the add-member sheet from the page header', async () => {
    renderAt('/team-map/team-alpha');

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Team Member' }));
    expect(screen.getByText('Select agents to add them to this team.')).toBeInTheDocument();
  });

  it('opens the member detail sheet when a node is selected', async () => {
    renderAt('/team-map/team-alpha');

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Researcher/ })[0]);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Chat' })).toBeInTheDocument();
  });

  it('shows a delayed hover summary for team members', async () => {
    renderAt('/team-map/team-alpha');

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalled();
    });

    vi.useFakeTimers();
    const researcherNode = screen.getAllByRole('button', { name: /Researcher/ })[0];
    fireEvent.mouseEnter(researcherNode);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Check the latest update from Researcher')).toBeInTheDocument();
  });

  it('restores focus to the previously selected node when the detail sheet closes', async () => {
    renderAt('/team-map/team-alpha');

    await waitFor(() => {
      expect(teamsStoreState.fetchTeams).toHaveBeenCalled();
    });

    const researcherNode = screen.getAllByRole('button', { name: /Researcher/ })[0];
    fireEvent.click(researcherNode);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: 'Overview' })).not.toBeInTheDocument();
    });

    expect(researcherNode).toHaveFocus();
  });
});
