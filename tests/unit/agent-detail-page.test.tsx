import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AgentDetail } from '@/pages/AgentDetail';

const mockCronJobs = [
  {
    id: 'job-status-report',
    name: 'Status Report',
    message: 'Send a morning status update',
    schedule: '0 9 * * 1-5',
    sessionTarget: 'researcher',
    enabled: true,
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-02-01T08:00:00Z',
    lastRun: {
      time: '2026-03-24T08:00:00Z',
      success: true,
    },
  },
];

const { agentsStoreState, hostApiFetchMock } = vi.hoisted(() => ({
  agentsStoreState: {
    agents: [] as Array<{
      id: string;
      name: string;
      persona: string;
      isDefault: boolean;
      model: string;
      modelDisplay: string;
      inheritedModel: boolean;
      workspace: string;
      agentDir: string;
      mainSessionKey: string;
      channelTypes: string[];
      teamRole?: 'leader' | 'worker';
      chatAccess?: 'direct' | 'leader_only';
      responsibility?: string;
      reportsTo?: string | null;
      directReports?: string[];
    }>,
    loading: false,
    error: null as string | null,
    fetchAgents: vi.fn(async () => undefined),
    updateAgent: vi.fn(async () => undefined),
  },
  hostApiFetchMock: vi.fn(),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: () => agentsStoreState,
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: string | { defaultValue?: string; [key: string]: unknown }) => {
      if (typeof options === 'string') return options;
      return options?.defaultValue ?? _key;
    },
  }),
}));

describe('AgentDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path.includes('/workspace/skills')) {
        return { success: true, skills: [] };
      }
      if (path === '/api/agents/researcher/cron-relations') {
        return {
          relations: [
            {
              relationReason: 'session-target',
              deepLink: '/cron?jobId=job-status-report&agentId=researcher&tab=pipelines',
              job: mockCronJobs[0],
            },
          ],
        };
      }
      if (path === '/api/agents/main/cron-relations') {
        return { relations: [] };
      }
      throw new Error(`Unexpected hostApiFetch path: ${path}`);
    });

    agentsStoreState.loading = false;
    agentsStoreState.error = null;
    agentsStoreState.agents = [
      {
        id: 'main',
        name: 'Main',
        persona: 'Primary coordinator',
        isDefault: true,
        model: 'gpt-5.4',
        modelDisplay: 'GPT-5.4',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main',
        mainSessionKey: 'agent:main:main',
        channelTypes: ['feishu'],
        teamRole: 'leader',
        chatAccess: 'direct',
        responsibility: 'Coordinate the team',
        reportsTo: null,
        directReports: ['researcher'],
      },
      {
        id: 'researcher',
        name: 'Researcher',
        persona: 'Finds supporting evidence',
        isDefault: false,
        model: 'claude-sonnet-4',
        modelDisplay: 'Claude Sonnet 4',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace-researcher',
        agentDir: '~/.openclaw/agents/researcher',
        mainSessionKey: 'agent:researcher:main',
        channelTypes: ['telegram', 'discord'],
        teamRole: 'worker',
        chatAccess: 'leader_only',
        responsibility: 'Research and evidence synthesis',
        reportsTo: 'main',
        directReports: [],
      },
    ];
  });

  it('renders read-only metadata and derived hierarchy for an agent', async () => {
    render(
      <MemoryRouter initialEntries={['/agents/researcher']}>
        <Routes>
          <Route path="/agents/:agentId" element={<AgentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: 'Researcher' })).toBeInTheDocument();
    expect(screen.getByText('Finds supporting evidence')).toBeInTheDocument();
    expect(screen.getByText('researcher')).toBeInTheDocument();
    expect(screen.getAllByText('Claude Sonnet 4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('main').length).toBeGreaterThan(0);
    expect(screen.getByText('Researcher reports to Main')).toBeInTheDocument();
    expect(screen.getByText('telegram')).toBeInTheDocument();
    expect(screen.getByText('discord')).toBeInTheDocument();
    expect(screen.getByDisplayValue('worker')).toBeInTheDocument();
    expect(screen.getByDisplayValue('leader_only')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Research and evidence synthesis')).toBeInTheDocument();
    expect(
      screen.getByText('This agent is blocked from normal direct chat and should be contacted through its leader.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/agents/researcher/cron-relations');
    });
    expect(await screen.findByText('Status Report')).toBeInTheDocument();
    expect(screen.getByText('0 9 * * 1-5')).toBeInTheDocument();
    expect(screen.getByText('session-target')).toBeInTheDocument();
  });

  it('shows a not-found state for unknown agents', async () => {
    render(
      <MemoryRouter initialEntries={['/agents/ghost']}>
        <Routes>
          <Route path="/agents/:agentId" element={<AgentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: 'Agent not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to agents' })).toHaveAttribute('href', '/agents');
  });

  it('saves editable team configuration through the agents store', async () => {
    render(
      <MemoryRouter initialEntries={['/agents/researcher']}>
        <Routes>
          <Route path="/agents/:agentId" element={<AgentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Team role'), { target: { value: 'leader' } });
    fireEvent.change(screen.getByLabelText('Chat access'), { target: { value: 'direct' } });
    fireEvent.change(screen.getByLabelText('Responsibility'), { target: { value: 'Lead investigations' } });
    fireEvent.change(screen.getByLabelText('Reports to'), { target: { value: 'main' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save team settings' }));

    await waitFor(() => {
      expect(agentsStoreState.updateAgent).toHaveBeenCalledWith('researcher', {
        teamRole: 'leader',
        chatAccess: 'direct',
        responsibility: 'Lead investigations',
        reportsTo: 'main',
      });
    });
  });

  it('renders Skills section with skill buttons', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path.includes('/workspace/skills') && !path.match(/\/workspace\/skills\/[^/]+$/)) {
        return { success: true, skills: ['researcher', 'code-review'] };
      }
      if (path.includes('/cron-relations')) return { relations: [] };
      return { success: true };
    });

    render(
      <MemoryRouter initialEntries={['/agents/main']}>
        <Routes>
          <Route path="/agents/:agentId" element={<AgentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));

    // 'code-review' is only in the skills panel, so use it as anchor
    expect(await screen.findByText('code-review')).toBeInTheDocument();
    // 'researcher' appears as skill chip button (role="button")
    const skillButtons = screen.getAllByRole('button', { name: 'researcher' });
    expect(skillButtons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no skills', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path.includes('/workspace/skills')) return { success: true, skills: [] };
      if (path.includes('/cron-relations')) return { relations: [] };
      return { success: true };
    });

    render(
      <MemoryRouter initialEntries={['/agents/main']}>
        <Routes>
          <Route path="/agents/:agentId" element={<AgentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));

    expect(await screen.findByText('No skills configured.')).toBeInTheDocument();
  });
});
