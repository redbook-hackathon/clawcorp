import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Chat } from '@/pages/Chat';

const chatState = {
  messages: [] as Array<Record<string, unknown>>,
  currentSessionKey: '',
  loading: false,
  sending: false,
  error: null as string | null,
  showThinking: false,
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

const gatewayState = {
  status: {
    state: 'running',
    port: 18789,
  },
};

const agentsState = {
  agents: [
    {
      id: 'main',
      name: 'Main',
      mainSessionKey: 'agent:main:main',
      isDefault: true,
      chatAccess: 'direct',
      reportsTo: null,
    },
  ] as Array<Record<string, unknown>>,
  fetchAgents: vi.fn(async () => {}),
  configuredChannelTypes: [] as string[],
  channelOwners: {} as Record<string, string>,
};

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
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
  useMinLoading: () => false,
}));

vi.mock('@/pages/Chat/ChatInput', () => ({
  ChatInput: () => <div>chat-input</div>,
}));

vi.mock('@/pages/Chat/ChatMessage', () => ({
  ChatMessage: () => <div>chat-message</div>,
}));

vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>loading-spinner</div>,
}));

vi.mock('@/components/workbench/workbench-empty-state', () => ({
  WorkbenchEmptyState: () => <div>empty-state</div>,
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
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Chat main session init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatState.currentSessionKey = '';
  });

  it('switches to the main agent session when no current session is active', async () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(chatState.switchSession).toHaveBeenCalledWith('agent:main:main');
    });
  });
});
