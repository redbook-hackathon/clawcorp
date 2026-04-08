import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentDetail } from '@/pages/AgentDetail';

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
    t: (key: string, options?: string | { defaultValue?: string; [key: string]: unknown }) => {
      if (typeof options === 'string') return options;
      return options?.defaultValue ?? key;
    },
  }),
}));

describe('AgentDetail tab routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostApiFetchMock.mockResolvedValue({ relations: [] });
    agentsStoreState.agents = [
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
        channelTypes: ['telegram'],
        teamRole: 'worker',
        chatAccess: 'leader_only',
        responsibility: 'Research and evidence synthesis',
        reportsTo: 'main',
        directReports: [],
      },
      {
        id: 'main',
        name: 'Main',
        persona: 'Coordinates the team',
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
    ];
  });

  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agents/:agentId" element={<AgentDetail />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('defaults to overview and renders the dossier tabs', async () => {
    renderAt('/agents/researcher');

    await waitFor(() => {
      expect(agentsStoreState.fetchAgents).toHaveBeenCalled();
    });

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Memory' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument();
  });

  it('honors the ?tab=memory deep link', async () => {
    renderAt('/agents/researcher?tab=memory');

    expect(await screen.findByRole('tab', { name: 'Memory' })).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to overview for invalid tab values', async () => {
    renderAt('/agents/researcher?tab=unknown');

    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });
});
