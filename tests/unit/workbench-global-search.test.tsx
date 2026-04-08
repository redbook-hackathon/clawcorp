import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { invokeIpc } from '@/lib/api-client';

const mockSetSidebarCollapsed = vi.fn();
const mockSwitchSession = vi.fn();
const mockDeleteSession = vi.fn(async () => {});
const mockLoadSessions = vi.fn(async () => {});
const mockLoadHistory = vi.fn(async () => {});
const mockFetchAgents = vi.fn(async () => {});
const mockFetchChannels = vi.fn(async () => {});

const mockSettingsState = {
  sidebarCollapsed: false,
  setSidebarCollapsed: mockSetSidebarCollapsed,
};

const mockChatState = {
  sessions: [
    { key: 'session-alpha', label: 'Session Alpha' },
    { key: 'session-beta', label: 'Session Beta' },
  ],
  currentSessionKey: 'session-alpha',
  sessionLabels: {
    'session-alpha': 'Session Alpha',
    'session-beta': 'Session Beta',
  },
  sessionLastActivity: {
    'session-alpha': Date.now() - 1_000,
    'session-beta': Date.now(),
  },
  switchSession: mockSwitchSession,
  deleteSession: mockDeleteSession,
  loadSessions: mockLoadSessions,
  loadHistory: mockLoadHistory,
  messages: [],
};

const mockGatewayState = {
  status: {
    state: 'stopped',
    port: 18789,
  },
};

const mockAgentsState = {
  agents: [
    {
      id: 'planner',
      name: 'Planner Agent',
      mainSessionKey: 'agent:planner:main',
      modelDisplay: 'gpt-5',
      isDefault: false,
      chatAccess: 'direct' as const,
      reportsTo: 'main',
    },
    {
      id: 'researcher',
      name: 'Research Worker',
      mainSessionKey: 'agent:researcher:main',
      modelDisplay: 'claude-sonnet-4',
      isDefault: false,
      chatAccess: 'leader_only' as const,
      reportsTo: 'planner',
    },
  ],
  fetchAgents: mockFetchAgents,
};

const mockChannelsState = {
  channels: [],
  fetchChannels: mockFetchChannels,
};

const mockNotificationsState = {
  notifications: [],
  unreadCount: 0,
  markAllRead: vi.fn(),
  dismiss: vi.fn(),
};

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof mockSettingsState) => unknown) => selector(mockSettingsState),
}));

vi.mock('@/stores/chat', () => {
  const useChatStore = (selector: (state: typeof mockChatState) => unknown) => selector(mockChatState);
  (useChatStore as typeof useChatStore & { getState: () => typeof mockChatState }).getState = () => mockChatState;
  return { useChatStore };
});

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof mockGatewayState) => unknown) => selector(mockGatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof mockAgentsState) => unknown) => selector(mockAgentsState),
}));

vi.mock('@/stores/channels', () => ({
  useChannelsStore: () => mockChannelsState,
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: (selector: (state: typeof mockNotificationsState) => unknown) => selector(mockNotificationsState),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common:sidebar.taskBoard': 'Task board',
        'common:sidebar.teamOverview': 'Team overview',
        'common:sidebar.employeeSquare': 'Employee square',
        'common:sidebar.channels': 'Channels',
        'common:sidebar.sessions': 'Sessions',
        'common:sidebar.searchSessions': 'Search sessions...',
        'common:sidebar.uploadFile': 'Upload file',
      }[key] ?? key),
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function renderSidebar(initialRoute = '/settings') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Sidebar />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('workbench global search from sidebar', () => {
  beforeEach(() => {
    mockSettingsState.sidebarCollapsed = false;
    vi.clearAllMocks();
    vi.mocked(invokeIpc).mockResolvedValue({ messages: [] });
  });

  it('opens via Ctrl/Cmd+K and can jump to an agent session', async () => {
    renderSidebar();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('textbox', { name: /search all/i });
    fireEvent.change(input, { target: { value: 'planner' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSwitchSession).toHaveBeenCalledWith('agent:planner:main');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
  });

  it('matches conversation history content and routes to the session', async () => {
    vi.mocked(invokeIpc).mockImplementation(async (_channel, method, payload) => {
      if (method !== 'chat.history') return { messages: [] };
      const sessionKey = (payload as { sessionKey?: string })?.sessionKey;
      if (sessionKey === 'session-beta') {
        return {
          success: true,
          result: {
            messages: [
              { role: 'user', content: 'Please prepare the quarterly budget review' },
              { role: 'assistant', content: 'Quarterly budget draft is ready for approval' },
            ],
          },
        };
      }
      return { success: true, result: { messages: [] } };
    });

    renderSidebar();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = await screen.findByRole('textbox', { name: /search all/i });
    fireEvent.change(input, { target: { value: 'budget draft' } });

    const dialog = screen.getByRole('dialog', { name: /global search/i });
    expect(await within(dialog).findByText('Session Beta')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSwitchSession).toHaveBeenCalledWith('session-beta');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
  });

  it('does not jump into a leader-only worker main session from search results', async () => {
    renderSidebar();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('textbox', { name: /search all/i });
    fireEvent.change(input, { target: { value: 'research worker' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSwitchSession).not.toHaveBeenCalledWith('agent:researcher:main');
  });
});
