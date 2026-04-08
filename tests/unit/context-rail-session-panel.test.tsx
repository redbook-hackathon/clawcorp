import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContextRail } from '@/components/workbench/context-rail';
import { useSettingsStore } from '@/stores/settings';

const {
  hostApiFetchMock,
  toastInfoMock,
  toastSuccessMock,
  toastErrorMock,
  deleteSessionMock,
  newSessionMock,
} = vi.hoisted(() => ({
  hostApiFetchMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  deleteSessionMock: vi.fn(async () => {}),
  newSessionMock: vi.fn(),
}));

const chatState = {
  currentAgentId: 'main',
  currentSessionKey: 'agent:main:session-42',
  sessions: [{ key: 'agent:main:session-42', label: 'Release Session', updatedAt: 1711111111111 }],
  sessionLabels: { 'agent:main:session-42': 'Release Session' },
  sessionLastActivity: { 'agent:main:session-42': 1711111111111 },
  messages: [
    { role: 'user', content: 'Export this current session' },
    { role: 'assistant', content: 'Ready to export' },
  ],
  deleteSession: deleteSessionMock,
  newSession: newSessionMock,
};

const agentsState = {
  agents: [
    {
      id: 'main',
      name: 'KaiTianClaw',
      modelDisplay: 'GLM-5-Turbo',
      channelTypes: [],
      isDefault: true,
      inheritedModel: false,
      mainSessionKey: 'agent:main:main',
    },
  ],
  defaultAgentId: 'main',
};

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

vi.mock('sonner', () => ({
  toast: {
    info: toastInfoMock,
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe('context rail session panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSettingsStore.setState({ rightPanelMode: 'session' as never });
  });

  it('renders current session metadata plus session-management actions', () => {
    render(<ContextRail />);

    expect(screen.getByText('会话详情')).toBeInTheDocument();
    expect(screen.getByText('Release Session')).toBeInTheDocument();
    expect(screen.getByText('agent:main:session-42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建会话' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '置顶会话' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除会话' })).toBeInTheDocument();
  });

  it('exports and deletes the current session from the session panel', async () => {
    hostApiFetchMock.mockResolvedValueOnce({ success: true, savedPath: 'C:/tmp/release-session.md' });

    render(<ContextRail />);

    fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/files/save-image',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '删除会话' }));

    await waitFor(() => {
      expect(deleteSessionMock).toHaveBeenCalledWith('agent:main:session-42');
    });
    expect(useSettingsStore.getState().rightPanelMode).toBe(null);
  });
});
