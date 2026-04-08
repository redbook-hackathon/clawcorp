import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import { AgentMemoryTab } from '@/components/agents/detail/AgentMemoryTab';

const { hostApiFetchMock, scopedMemoryBrowserSpy } = vi.hoisted(() => ({
  hostApiFetchMock: vi.fn(),
  scopedMemoryBrowserSpy: vi.fn(),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

vi.mock('@/components/memory/ScopedMemoryBrowser', () => ({
  ScopedMemoryBrowser: (props: { scopeId: string }) => {
    scopedMemoryBrowserSpy(props);
    return <div data-testid="scoped-memory-browser">{props.scopeId}</div>;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));

const agent: AgentSummary = {
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
};

describe('AgentMemoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the current agent scope and renders the shared browser with that scope', async () => {
    hostApiFetchMock.mockResolvedValue({
      files: [],
      scopes: [
        { id: 'main', label: 'Main', workspaceDir: '/workspace/main' },
        { id: 'researcher', label: 'Researcher', agentName: 'Researcher', workspaceDir: '/workspace/researcher' },
      ],
      activeScope: 'main',
      workspaceDir: '/workspace/main',
    });

    render(<AgentMemoryTab agent={agent} />);

    expect(await screen.findByTestId('scoped-memory-browser')).toHaveTextContent('researcher');
    expect(scopedMemoryBrowserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeId: 'researcher',
      }),
    );
  });

  it('shows a fallback state when no matching scope exists', async () => {
    hostApiFetchMock.mockResolvedValue({
      files: [],
      scopes: [{ id: 'main', label: 'Main', workspaceDir: '/workspace/main' }],
      activeScope: 'main',
      workspaceDir: '/workspace/main',
    });

    render(<AgentMemoryTab agent={agent} />);

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalled();
    });

    expect(await screen.findByText('No shared memory scope found for this agent.')).toBeInTheDocument();
  });
});
