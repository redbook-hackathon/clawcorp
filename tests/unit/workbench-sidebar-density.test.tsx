import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';

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
  sessions: [{ key: 'session-main', label: 'Main Session' }],
  currentSessionKey: 'session-main',
  sessionLabels: { 'session-main': 'Main Session' },
  sessionLastActivity: { 'session-main': Date.now() },
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
  agents: [],
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
        'common:sidebar.toggleSidebar': 'Toggle sidebar',
      }[key] ?? key),
  }),
}));

describe('workbench sidebar density', () => {
  beforeEach(() => {
    mockSettingsState.sidebarCollapsed = false;
    vi.clearAllMocks();
  });

  it('renders the approved 260px sidebar width when expanded', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveClass('w-[260px]');
  });

  it('renders fixed nav items in the approved order', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const taskButton = screen.getByRole('button', { name: 'Task board' });
    const teamButton = screen.getByRole('button', { name: 'Team overview' });
    const employeeButton = screen.getByRole('button', { name: 'Employee square' });

    expect(taskButton.compareDocumentPosition(teamButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(teamButton.compareDocumentPosition(employeeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the header toggle button lightweight and fetches sidebar dependencies on mount', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const toggleButton = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(screen.getByRole('button', { name: 'Upload file' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common:sidebar.selectAvatar' })).not.toBeInTheDocument();
    expect(toggleButton).not.toHaveClass('border');
    expect(mockFetchAgents).toHaveBeenCalledTimes(1);
    expect(mockFetchChannels).toHaveBeenCalledTimes(1);
  });
});
