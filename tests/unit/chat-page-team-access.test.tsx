import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Chat } from '@/pages/Chat';

const { toastInfoMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastInfoMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

const chatState = {
  messages: [] as Array<Record<string, unknown>>,
  currentSessionKey: 'agent:main:main',
  loading: false,
  sending: false,
  error: null as string | null,
  showThinking: true,
  streamingMessage: null as unknown,
  streamingTools: [] as unknown[],
  pendingFinal: false,
  currentAgentId: 'main',
  sendMessage: vi.fn(),
  abortRun: vi.fn(),
  clearError: vi.fn(),
  cleanupEmptySession: vi.fn(),
  switchSession: vi.fn(),
  sessionLastActivity: {} as Record<string, number>,
};

const settingsState = {
  rightPanelMode: null as 'files' | 'session' | 'agent' | null,
  setRightPanelMode: vi.fn(),
};

const gatewayState = {
  status: {
    state: 'running',
    port: 18789,
  },
};

const agentsState = {
  agents: [] as Array<Record<string, unknown>>,
  fetchAgents: vi.fn(async () => {}),
};

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: {
    getState: () => ({
      addNotification: vi.fn(),
    }),
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

vi.mock('@/hooks/use-stick-to-bottom-instant', () => ({
  useStickToBottomInstant: () => ({
    contentRef: { current: null },
    scrollRef: { current: null },
  }),
}));

vi.mock('@/hooks/use-min-loading', () => ({
  useMinLoading: (value: boolean) => value,
}));

vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>loading-spinner</div>,
}));

vi.mock('@/components/workbench/workbench-empty-state', () => ({
  WorkbenchEmptyState: () => <div>empty-state</div>,
}));

vi.mock('@/components/workbench/context-rail', () => ({
  ContextRail: () => <div>context-rail</div>,
}));

vi.mock('@/pages/Chat/ChatMessage', () => ({
  ChatMessage: () => <div>chat-message</div>,
}));

vi.mock('@/pages/Chat/ChatInput', () => ({
  ChatInput: () => <div>chat-input</div>,
}));

vi.mock('@/pages/Chat/message-utils', () => ({
  extractImages: () => [],
  extractText: () => '',
  extractThinking: () => '',
  extractToolUse: () => [],
  isSystemInjectedUserMessage: () => false,
  extractReminderContent: () => '',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    info: toastInfoMock,
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe('Chat page team access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatState.currentAgentId = 'main';
    chatState.currentSessionKey = 'agent:main:main';
    agentsState.agents = [
      { id: 'main', name: 'Main', mainSessionKey: 'agent:main:main', isDefault: true, chatAccess: 'direct', reportsTo: null },
      { id: 'researcher', name: 'Researcher', mainSessionKey: 'agent:researcher:main', isDefault: false, chatAccess: 'leader_only', reportsTo: 'main' },
    ];
  });

  it('blocks selecting a leader-only worker from the header agent picker', () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /main/i }));
    fireEvent.click(screen.getByText('Researcher'));

    expect(chatState.switchSession).not.toHaveBeenCalledWith('agent:researcher:main');
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it('shows a team brief entry point for leader chats and opens the panel', () => {
    window.localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-brief',
        title: 'Review launch checklist',
        description: 'Waiting on decision',
        status: 'review',
        priority: 'medium',
        assigneeId: 'researcher',
        workState: 'waiting_approval',
        createdAt: '2026-03-27T09:00:00Z',
        updatedAt: '2026-03-27T09:20:00Z',
      },
    ]));

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /team brief|common:teamBrief\.open/i }));

    expect(screen.getByText('common:teamBrief.title')).toBeInTheDocument();
    expect(screen.getByText('common:teamBrief.activeWork')).toBeInTheDocument();
    expect(screen.getByText('common:teamBrief.blockers')).toBeInTheDocument();
    expect(screen.getByText('common:teamBrief.nextSteps')).toBeInTheDocument();
    expect(screen.getAllByText('common:teamBrief.openMember').length).toBeGreaterThan(0);
    expect(screen.getAllByText('common:teamBrief.openKanban').length).toBeGreaterThan(0);
    expect(screen.getByText('Review launch checklist')).toBeInTheDocument();
  });
});
