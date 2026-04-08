import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';

const PINNED_STORAGE_KEY = 'clawcorp-sidebar-pinned-sessions';

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
    { key: 'session-recent-unpinned', label: 'Recent Unpinned' },
    { key: 'session-pinned-old', label: 'Pinned Old' },
    { key: 'session-pinned-new', label: 'Pinned New' },
    { key: 'session-unpinned-old', label: 'Unpinned Old' },
  ],
  currentSessionKey: 'session-recent-unpinned',
  sessionLabels: {
    'session-recent-unpinned': 'Recent Unpinned',
    'session-pinned-old': 'Pinned Old',
    'session-pinned-new': 'Pinned New',
    'session-unpinned-old': 'Unpinned Old',
  },
  sessionLastActivity: {
    'session-recent-unpinned': 400,
    'session-pinned-old': 100,
    'session-pinned-new': 300,
    'session-unpinned-old': 50,
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
        'common:sidebar.noSessions': 'No sessions',
        'common:sidebar.pin': 'Pin',
        'common:sidebar.unpin': 'Unpin',
        'common:sidebar.pinnedSession': 'Pinned session',
        'common:sidebar.delete': 'Delete',
        'common:sidebar.toggleSidebar': 'Toggle sidebar',
      }[key] ?? key),
  }),
}));

function parsePinnedStorage() {
  const raw = localStorage.getItem(PINNED_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

function getSessionButton(label: string) {
  const textNode = screen.getByText(label);
  const button = textNode.closest('button');
  expect(button).not.toBeNull();
  return button as HTMLElement;
}

describe('sidebar session pinning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('keeps pinned sessions above unpinned while preserving recency inside each group', () => {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(['session-pinned-old', 'session-pinned-new']));

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const pinnedNewButton = getSessionButton('Pinned New');
    const pinnedOldButton = getSessionButton('Pinned Old');
    const recentUnpinnedButton = getSessionButton('Recent Unpinned');

    expect(pinnedNewButton.compareDocumentPosition(pinnedOldButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pinnedOldButton.compareDocumentPosition(recentUnpinnedButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByLabelText('Pinned')).toHaveLength(2);
  });

  it('toggles pin state from the session action button and persists the update', () => {
    mockChatState.sessions = [{ key: 'session-one', label: 'Session One' }];
    mockChatState.sessionLabels = { 'session-one': 'Session One' };
    mockChatState.sessionLastActivity = { 'session-one': 1 };
    mockChatState.currentSessionKey = 'session-one';

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Pin'));
    expect(parsePinnedStorage()).toEqual(['session-one']);

    fireEvent.click(screen.getByLabelText('Unpin'));
    expect(parsePinnedStorage()).toEqual([]);
  });
});
