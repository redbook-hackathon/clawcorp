import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';

const mockSetSidebarCollapsed = vi.fn();
const mockSwitchSession = vi.fn();
const mockNewSession = vi.fn();
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
    { key: 'session-alpha', label: 'Alpha Session' },
    { key: 'session-beta', label: 'Beta Session' },
  ],
  currentSessionKey: 'session-alpha',
  sessionLabels: {
    'session-alpha': 'Alpha Session',
    'session-beta': 'Beta Session',
  },
  sessionLastActivity: {
    'session-alpha': 200,
    'session-beta': 100,
  },
  switchSession: mockSwitchSession,
  newSession: mockNewSession,
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
  agents: [],
  fetchAgents: mockFetchAgents,
};

const mockChannelsState = {
  channels: [{ id: 'feishu-default', type: 'feishu', name: 'Feishu Bot', status: 'connected' as const }],
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
        'common:sidebar.noChannels': 'No channels configured',
        'common:sidebar.noSessions': 'No sessions',
        'common:sidebar.newSession': 'New session',
        'common:sidebar.toggleSidebar': 'Toggle sidebar',
        'common:sidebar.pin': 'Pin',
        'common:sidebar.unpin': 'Unpin',
        'common:sidebar.delete': 'Delete',
        'common:sidebar.pinnedSession': 'Pinned session',
      }[key] ?? key),
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function renderSidebar(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Sidebar />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('workbench sidebar', () => {
  beforeEach(() => {
    mockSettingsState.sidebarCollapsed = false;
    mockChatState.sessions = [
      { key: 'session-alpha', label: 'Alpha Session' },
      { key: 'session-beta', label: 'Beta Session' },
    ];
    mockChatState.currentSessionKey = 'session-alpha';
    mockChatState.newSession = mockNewSession;
    mockChatState.sessionLabels = {
      'session-alpha': 'Alpha Session',
      'session-beta': 'Beta Session',
    };
    mockChatState.sessionLastActivity = {
      'session-alpha': 200,
      'session-beta': 100,
    };
    mockChannelsState.channels = [{ id: 'feishu-default', type: 'feishu', name: 'Feishu Bot', status: 'connected' as const }];
    vi.clearAllMocks();
  });

  it('renders fixed nav items, keeps channels collapsed by default, and shows sessions expanded', () => {
    renderSidebar();

    expect(screen.getByRole('button', { name: 'Task board' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Team overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Employee square' })).toBeInTheDocument();
    expect(screen.getByText('Alpha Session')).toBeInTheDocument();
    expect(screen.queryByText('Feishu Bot')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search sessions...' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common:sidebar.notifications' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common:sidebar.selectAvatar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common:sidebar.settingsAria' })).toBeInTheDocument();
    expect(screen.queryByText('Add clone')).not.toBeInTheDocument();
  });

  it('renders a dedicated new-session header action and keeps the chevron hover-revealed', () => {
    renderSidebar();

    expect(screen.getByRole('button', { name: 'New session' })).toBeInTheDocument();
    expect(screen.getByTestId('sessions-section-chevron')).toHaveClass(
      'opacity-0',
      'group-hover/sessions-header:opacity-100',
      'group-focus-within/sessions-header:opacity-100',
    );
  });

  it('toggles channels independently and keeps session content visible', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Channels' }));

    expect(screen.getByText('Feishu Bot')).toBeInTheDocument();
    expect(screen.getByText('Alpha Session')).toBeInTheDocument();
  });

  it('shows configured non-workbench channels in the channels section', () => {
    mockChannelsState.channels = [
      { id: 'telegram-default', type: 'telegram', name: 'Ops Telegram', status: 'connected' as const },
    ];

    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Channels' }));

    expect(screen.getByText('Ops Telegram')).toBeInTheDocument();
  });

  it('prefixes channel-backed sessions in the global session list', () => {
    mockChatState.sessions = [
      { key: 'agent:main:feishu:group:oc_001', label: '渠道群聊' },
      { key: 'agent:main:wechat:group:wx_001', label: '客户微信群' },
    ];
    mockChatState.sessionLabels = {
      'agent:main:feishu:group:oc_001': '渠道群聊',
      'agent:main:wechat:group:wx_001': '客户微信群',
    };
    mockChatState.sessionLastActivity = {
      'agent:main:feishu:group:oc_001': 200,
      'agent:main:wechat:group:wx_001': 100,
    };
    mockChatState.currentSessionKey = 'agent:main:feishu:group:oc_001';

    renderSidebar();

    expect(screen.getByText('[飞书] 渠道群聊')).toBeInTheDocument();
    expect(screen.getByText('[微信] 客户微信群')).toBeInTheDocument();
  });

  it('still offers an add-channel action when no workbench channels are configured', () => {
    mockChannelsState.channels = [];
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Channels' }));

    expect(screen.getByText('No channels configured')).toBeInTheDocument();
    expect(screen.getByText('添加渠道')).toBeInTheDocument();
  });

  it('navigates from fixed nav items and switches sessions from the list', () => {
    renderSidebar('/settings');

    fireEvent.click(screen.getByRole('button', { name: 'Team overview' }));
    expect(screen.getByTestId('pathname')).toHaveTextContent('/team-overview');

    fireEvent.click(screen.getByRole('button', { name: 'Task board' }));
    expect(screen.getByTestId('pathname')).toHaveTextContent('/kanban');

    fireEvent.click(screen.getByText('Beta Session'));
    expect(mockSwitchSession).toHaveBeenCalledWith('session-beta');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
  });

  it('creates a new session from the header plus without toggling collapse, and reopens sessions when needed', () => {
    renderSidebar('/settings');

    expect(screen.getByText('Alpha Session')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(mockNewSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Alpha Session')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/');

    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(screen.queryByText('Alpha Session')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(mockNewSession).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Alpha Session')).toBeInTheDocument();
  });

  it('keeps a collapsed icon rail and a scrollable content region', () => {
    mockSettingsState.sidebarCollapsed = true;
    const { container } = renderSidebar();

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-16');
    expect(screen.queryByText('Task board')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Task board' })).toBeInTheDocument();

    const scrollRegion = container.querySelector('aside .overflow-y-auto');
    expect(scrollRegion).toBeInTheDocument();
  });
});
