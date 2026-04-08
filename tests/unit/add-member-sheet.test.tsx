import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import { AddMemberSheet } from '@/components/team-map/AddMemberSheet';

const { agentsStoreState, teamsStoreState } = vi.hoisted(() => ({
  agentsStoreState: {
    agents: [] as AgentSummary[],
    fetchAgents: vi.fn(async () => {}),
  },
  teamsStoreState: {
    addMember: vi.fn(async () => {}),
  },
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: () => agentsStoreState,
}));

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => teamsStoreState,
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

describe('AddMemberSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        channelTypes: [],
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
      },
    ];
  });

  it('filters by search and disables agents already in the current team', async () => {
    render(
      <AddMemberSheet
        open
        onOpenChange={vi.fn()}
        teamId="team-alpha"
        leaderId="main"
        memberIds={['researcher']}
      />,
    );

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    expect(screen.getByText('Researcher')).toBeInTheDocument();
    expect(screen.getAllByText('Already in Team').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Search agents'), {
      target: { value: 'Operator' },
    });

    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.queryByText('Researcher')).not.toBeInTheDocument();
  });

  it('supports batch add and stays open after save', async () => {
    const onOpenChange = vi.fn();

    render(
      <AddMemberSheet
        open
        onOpenChange={onOpenChange}
        teamId="team-alpha"
        leaderId="main"
        memberIds={[]}
      />,
    );

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select Researcher' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Operator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Team Member' }));

    await waitFor(() => {
      expect(teamsStoreState.addMember).toHaveBeenCalledTimes(2);
    });

    expect(teamsStoreState.addMember).toHaveBeenNthCalledWith(1, 'team-alpha', 'researcher');
    expect(teamsStoreState.addMember).toHaveBeenNthCalledWith(2, 'team-alpha', 'operator');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('offers a reset action when the search has no matches', async () => {
    render(
      <AddMemberSheet
        open
        onOpenChange={vi.fn()}
        teamId="team-alpha"
        leaderId="main"
        memberIds={[]}
      />,
    );

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText('Search agents'), {
      target: { value: 'NoSuchAgent' },
    });

    expect(screen.getByText('No matching agents')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('Researcher')).toBeInTheDocument();
  });
});
