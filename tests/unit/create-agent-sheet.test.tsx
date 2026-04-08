import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamSummary } from '@/types/team';
import { CreateAgentSheet } from '@/components/agents/CreateAgentSheet';

const {
  agentsStoreState,
  teamsStoreState,
  providerStoreState,
} = vi.hoisted(() => ({
  agentsStoreState: {
    createAgent: vi.fn(async () => ({ createdAgentId: 'new-worker' })),
    updateAgent: vi.fn(async () => undefined),
  },
  teamsStoreState: {
    teams: [] as TeamSummary[],
    addMember: vi.fn(async () => undefined),
  },
  providerStoreState: {
    accounts: [] as Array<{ id: string; vendorId: string; label: string; model?: string; enabled: boolean }>,
    vendors: [] as Array<{ id: string; name: string; defaultModelId?: string }>,
    refreshProviderSnapshot: vi.fn(async () => undefined),
  },
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: () => agentsStoreState,
}));

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => teamsStoreState,
}));

vi.mock('@/stores/providers', () => ({
  useProviderStore: () => providerStoreState,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CreateAgentSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    teamsStoreState.teams = [
      {
        id: 'team-alpha',
        name: 'Alpha Team',
        leaderId: 'main',
        memberIds: [],
        description: '',
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
        memberCount: 1,
        activeTaskCount: 1,
        lastActiveTime: undefined,
        leaderName: 'Main',
        memberAvatars: [],
      },
    ];

    providerStoreState.accounts = [
      {
        id: 'openai-primary',
        vendorId: 'openai',
        label: 'OpenAI Primary',
        model: 'gpt-5.4',
        enabled: true,
      },
    ];
    providerStoreState.vendors = [
      {
        id: 'openai',
        name: 'OpenAI',
        defaultModelId: 'gpt-5.4',
      },
    ];
  });

  it('requires a name before submit', () => {
    render(<CreateAgentSheet open onOpenChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Create Agent' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Researcher' } });

    expect(screen.getByRole('button', { name: 'Create Agent' })).not.toBeDisabled();
  });

  it('creates an agent, optionally attaches it to a team, and updates reportsTo', async () => {
    const onOpenChange = vi.fn();

    render(<CreateAgentSheet open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Researcher' } });
    fireEvent.change(screen.getByLabelText('Persona'), { target: { value: 'Finds supporting evidence' } });
    fireEvent.change(screen.getByLabelText('Team role'), { target: { value: 'worker' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'openai/gpt-5.4' } });
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 'team-alpha' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }));

    await waitFor(() => {
      expect(agentsStoreState.createAgent).toHaveBeenCalledWith({
        name: 'Researcher',
        persona: 'Finds supporting evidence',
        teamRole: 'worker',
        model: 'openai/gpt-5.4',
      });
    });

    expect(teamsStoreState.addMember).toHaveBeenCalledWith('team-alpha', 'new-worker');
    expect(agentsStoreState.updateAgent).toHaveBeenCalledWith('new-worker', {
      reportsTo: 'main',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
