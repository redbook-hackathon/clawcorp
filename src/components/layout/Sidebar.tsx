import { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  Bot,
  ChevronRight,
  LayoutDashboard,
  MessageSquare,
  Network,
  PanelLeft,
  PanelLeftClose,
  Pin,
  Plus,
  Radio,
  Search,
  Settings as SettingsIcon,
  Store,
  Trash2,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GlobalSearchModal } from '@/components/search/GlobalSearchModal';
import { SessionItem } from '@/components/sessions/SessionItem';
import { SessionSearchModal } from '@/components/sessions/SessionSearchModal';
import { cn } from '@/lib/utils';
import { usePinnedSessions } from '@/lib/pinned-sessions';
import { resolveSessionDisplayLabel } from '@/lib/session-label';
import { useAgentsStore } from '@/stores/agents';
import { useChannelsStore } from '@/stores/channels';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useSettingsStore } from '@/stores/settings';
import { useRightPanelStore } from '@/stores/rightPanelStore';
import { CHANNEL_ICONS, type Channel } from '@/types/channel';
import { ChannelIcon } from '@/components/channels/ChannelIcon';

const CHAT_REQUEST_FILE_UPLOAD_EVENT = 'chat:request-file-upload';
const CHAT_UPLOAD_PENDING_KEY = 'clawcorp:pending-upload';
const NICKNAME_STORAGE_KEY = 'clawcorp-user-nickname';
const LEGACY_NICKNAME_STORAGE_KEY = 'clawx-user-nickname';
const AVATAR_STORAGE_KEY = 'clawcorp-user-avatar';
const LEGACY_AVATAR_STORAGE_KEY = 'clawx-user-avatar';
const HIDE_SIDEBAR_CHANNELS = true;

type NavItemConfig = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
};

function SectionHeader({
  icon: Icon,
  label,
  open,
  onToggle,
  collapsed,
}: {
  icon: typeof Radio;
  label: string;
  open: boolean;
  onToggle: () => void;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'flex h-12 w-full items-center gap-4 rounded-2xl px-4 text-sm font-bold transition-all duration-300 text-gray-400 hover:bg-white hover:text-[#1A1C1E]',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-gray-300 transition-transform',
              open && 'rotate-90',
            )}
          />
        </>
      ) : null}
    </button>
  );
}

function SessionSectionHeader({
  label,
  open,
  collapsed,
  newSessionLabel,
  onToggle,
  onNewSession,
}: {
  label: string;
  open: boolean;
  collapsed: boolean;
  newSessionLabel: string;
  onToggle: () => void;
  onNewSession: () => void;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={onToggle}
        className="flex h-12 w-full items-center justify-center rounded-2xl px-2 text-sm font-bold transition-all duration-300 text-gray-400 hover:bg-white hover:text-[#1A1C1E]"
      >
        <MessageSquare className="h-5 w-5 shrink-0" />
      </button>
    );
  }

  return (
    <div className="group/sessions-header flex items-center gap-2">
      <button
        type="button"
        aria-label={label}
        onClick={onToggle}
        className="flex h-12 min-w-0 flex-1 items-center gap-4 rounded-2xl px-4 text-sm font-bold transition-all duration-300 text-gray-400 hover:bg-white hover:text-[#1A1C1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD233]/40"
      >
        <MessageSquare className="h-5 w-5 shrink-0" />
        <span className="truncate text-left">{label}</span>
        <ChevronRight
          data-testid="sessions-section-chevron"
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-gray-300 transition-all opacity-0 group-hover/sessions-header:opacity-100 group-focus-within/sessions-header:opacity-100',
            open && 'rotate-90',
          )}
        />
      </button>

      <button
        type="button"
        aria-label={newSessionLabel}
        title={newSessionLabel}
        onClick={onNewSession}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/50 text-gray-400 shadow-sm transition-all hover:bg-white hover:text-[#1A1C1E] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD233]/40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function NavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItemConfig;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      aria-label={item.label}
      onClick={onClick}
      className={cn(
        'flex h-14 w-full items-center gap-4 rounded-2xl px-4 text-sm font-bold transition-all duration-300',
        active
          ? 'bg-[#FFD233] text-[#1A1C1E] shadow-md'
          : 'text-gray-400 hover:bg-white hover:text-[#1A1C1E]',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.5} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </button>
  );
}

export function Sidebar() {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const gatewayStatus = useGatewayStore((state) => state.status);

  const sessions = useChatStore((state) => state.sessions);
  const currentSessionKey = useChatStore((state) => state.currentSessionKey);
  const sessionLabels = useChatStore((state) => state.sessionLabels);
  const sessionLastActivity = useChatStore((state) => state.sessionLastActivity);
  const messages = useChatStore((state) => state.messages);
  const switchSession = useChatStore((state) => state.switchSession);
  const newSession = useChatStore((state) => state.newSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const loadSessions = useChatStore((state) => state.loadSessions);
  const loadHistory = useChatStore((state) => state.loadHistory);

  const agents = useAgentsStore((state) => state.agents);
  const fetchAgents = useAgentsStore((state) => state.fetchAgents);
  const { channels, fetchChannels } = useChannelsStore();
  const { pinnedSessionKeySet, toggleSessionPinned } = usePinnedSessions();
  const activeChannelId = useRightPanelStore((state) => state.activeChannelId);
  const setActiveChannelId = useRightPanelStore((state) => state.setActiveChannelId);
  const setPendingBotSettings = useRightPanelStore((state) => state.setPendingBotSettings);
  const setPendingAddChannel = useRightPanelStore((state) => state.setPendingAddChannel);

  const [channelsOpen, setChannelsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [sessionSearchOpen, setSessionSearchOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [avatarPopupOpen, setAvatarPopupOpen] = useState(false);
  const [nickname, setNickname] = useState(() => {
    try {
      const current = localStorage.getItem(NICKNAME_STORAGE_KEY);
      if (current) return current;
      const legacy = localStorage.getItem(LEGACY_NICKNAME_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(NICKNAME_STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_NICKNAME_STORAGE_KEY);
        return legacy;
      }
    } catch {
      // ignore storage access issues
    }
    return 'Administrator';
  });
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    try {
      const current = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (current) return current;
      const legacy = localStorage.getItem(LEGACY_AVATAR_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(AVATAR_STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_AVATAR_STORAGE_KEY);
        return legacy;
      }
    } catch {
      // ignore storage access issues
    }
    return '👤';
  });

  const tSidebar = (key: string, defaultValue?: string) =>
    t(`common:sidebar.${key}`, { defaultValue });

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    if (gatewayStatus.state !== 'running') return;
    void loadSessions();
    void loadHistory(true);
  }, [gatewayStatus.state, loadHistory, loadSessions]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navItems: NavItemConfig[] = [
    {
      label: tSidebar('marketplace', 'Marketplace'),
      path: '/marketplace',
      icon: Store,
    },
    {
      label: tSidebar('humanAssets', 'Human Assets'),
      path: '/team-overview',
      icon: Users,
    },
    // {
    //   label: tSidebar('employeeSquare', 'Employee square'),
    //   path: '/agents',
    //   icon: Bot,
    // },
    {
      label: tSidebar('taskBoard', 'Task board'),
      path: '/kanban',
      icon: LayoutDashboard,
    },
    {
      label: tSidebar('gateway', '生态网关'),
      path: '/gateway',
      icon: Network,
    },
  ];

  // Build message map for current session only (for message preview)
  const sessionMessagesMap = useMemo(() => {
    const map = new Map();
    if (currentSessionKey && messages.length > 0) {
      map.set(currentSessionKey, messages);
    }
    return map;
  }, [currentSessionKey, messages]);

  // Sort sessions (pinned first, then by activity)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((left, right) => {
      const leftPinned = pinnedSessionKeySet.has(left.key);
      const rightPinned = pinnedSessionKeySet.has(right.key);
      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }

      return (
        (sessionLastActivity[right.key] ?? right.updatedAt ?? 0) -
        (sessionLastActivity[left.key] ?? left.updatedAt ?? 0)
      );
    });
  }, [sessions, pinnedSessionKeySet, sessionLastActivity]);

  // Get message preview for each session
  const getMessagePreview = (sessionKey: string): string => {
    const messages = sessionMessagesMap.get(sessionKey) || [];
    if (messages.length === 0) return '';
    const lastMessage = messages[messages.length - 1];
    const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';
    return content.length > 50 ? content.slice(0, 50) + '...' : content;
  };

  const searchSessionsData = sessions.map((session) => ({
    key: session.key,
    label: resolveSessionDisplayLabel(session, sessionLabels),
  }));

  const searchAgents = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    mainSessionKey: agent.mainSessionKey,
    modelDisplay: agent.modelDisplay,
    chatAccess: agent.chatAccess,
    reportsTo: agent.reportsTo,
    isDefault: agent.isDefault,
  }));

  const handleUploadClick = () => {
    try {
      sessionStorage.setItem(CHAT_UPLOAD_PENDING_KEY, '1');
    } catch {
      // ignore storage write issues
    }
    navigate('/');
    window.dispatchEvent(new CustomEvent(CHAT_REQUEST_FILE_UPLOAD_EVENT));
  };

  const handleNewSession = () => {
    setSessionsOpen(true);
    newSession();
    navigate('/');
  };

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col bg-[#F2F0E9] transition-all duration-300 dark:bg-background',
        sidebarCollapsed ? 'w-16 px-2 py-4' : 'w-[260px] px-3 py-4',
      )}
    >
      <div className={cn('flex items-center gap-2', sidebarCollapsed ? 'justify-center' : 'justify-between')}>
        <button
          type="button"
          aria-label={tSidebar('toggleSidebar', 'Toggle sidebar')}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/50 text-gray-400 shadow-sm transition-all hover:bg-white hover:text-[#1A1C1E] hover:shadow-md"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
        {!sidebarCollapsed && (
          <button
            type="button"
            aria-label={tSidebar('searchSessions', 'Search sessions')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/50 text-gray-400 shadow-sm transition-all hover:bg-white hover:text-[#1A1C1E] hover:shadow-md"
            onClick={() => setSessionSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className={cn(
        'mt-4 space-y-1 rounded-[32px] border border-white/40 bg-white/50 p-3 shadow-sm backdrop-blur-md',
        sidebarCollapsed && 'rounded-2xl p-2',
      )}>
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={location.pathname === item.path}
            collapsed={sidebarCollapsed}
            onClick={() => navigate(item.path)}
          />
        ))}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto custom-scrollbar">
        <div className={cn('space-y-1', HIDE_SIDEBAR_CHANNELS && 'hidden')}>
          <SectionHeader
            icon={Radio}
            label={tSidebar('channels', 'Channels')}
            open={channelsOpen}
            onToggle={() => setChannelsOpen((current) => !current)}
            collapsed={sidebarCollapsed}
          />
          {!sidebarCollapsed && channelsOpen ? (
            <div className="space-y-1 pl-4 pr-2 py-1">
              {(() => {
                const sortedBots = [...channels].sort((a, b) => {
                  if (a.status === 'connected' && b.status !== 'connected') return -1;
                  if (a.status !== 'connected' && b.status === 'connected') return 1;
                  return a.name.localeCompare(b.name);
                });

                if (sortedBots.length === 0) {
                  return (
                    <>
                      <p className="px-4 py-2 text-[13px] text-gray-400">
                        {tSidebar('noChannels', 'No channels configured')}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAddChannel(true);
                          navigate('/channels');
                        }}
                        className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold text-gray-400 transition-all hover:bg-white hover:text-[#1A1C1E]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>添加渠道</span>
                      </button>
                    </>
                  );
                }

                return (
                  <>
                    {sortedBots.map((bot) => {
                      const isActive = bot.id === activeChannelId;
                      const statusDotColor =
                        bot.status === 'connected'
                          ? 'bg-[#10b981]'
                          : bot.status === 'connecting'
                            ? 'bg-[#f59e0b]'
                            : bot.status === 'error'
                              ? 'bg-[#ef4444]'
                              : 'bg-[#94a3b8]';
                      const boundAgent = bot.boundAgentId
                        ? agents.find((a) => a.id === bot.boundAgentId)
                        : null;

                      return (
                        <div
                          key={bot.id}
                          className={cn(
                            'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] transition-all duration-300',
                            isActive
                              ? 'bg-[#FFD233]/20 text-[#1A1C1E] font-bold'
                              : 'text-gray-400 hover:bg-white hover:text-[#1A1C1E]',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChannelId(bot.id);
                              navigate('/channels');
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2"
                          >
                            <ChannelIcon type={bot.type} size={16} />
                            <span className="truncate text-[13px]">{bot.name}</span>
                            {boundAgent && (
                              <span className="shrink-0 truncate text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full max-w-[60px]">
                                {boundAgent.name}
                              </span>
                            )}
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDotColor)} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChannelId(bot.id);
                              setPendingBotSettings(bot.id);
                              navigate('/channels');
                            }}
                            className="shrink-0 text-[12px] text-gray-300 hover:text-[#1A1C1E]"
                            aria-label="设置"
                          >
                            ⚙
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAddChannel(true);
                        navigate('/channels');
                      }}
                      className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold text-gray-400 transition-all hover:bg-white hover:text-[#1A1C1E]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>添加渠道</span>
                    </button>
                  </>
                );
              })()}
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-1">
          <SessionSectionHeader
            label={tSidebar('sessions', 'Sessions')}
            open={sessionsOpen}
            collapsed={sidebarCollapsed}
            newSessionLabel={tSidebar('newSession', 'New session')}
            onToggle={() => setSessionsOpen((current) => !current)}
            onNewSession={handleNewSession}
          />
          {!sidebarCollapsed && sessionsOpen ? (
            <div className="space-y-2">
              {sortedSessions.length > 0 ? (
                <div className="space-y-2">
                  {sortedSessions.map((session) => {
                    const label = resolveSessionDisplayLabel(session, sessionLabels);
                    const isPinned = pinnedSessionKeySet.has(session.key);
                    const isActive = currentSessionKey === session.key;
                    const messagePreview = getMessagePreview(session.key);

                    return (
                      <SessionItem
                        key={session.key}
                        session={session}
                        label={label}
                        isPinned={isPinned}
                        isActive={isActive}
                        messagePreview={messagePreview}
                        agentAvatar={agents.find((a) => a.id === (session.targetAgentId ?? session.agentId))?.avatar}
                        onClick={() => {
                          switchSession(session.key);
                          navigate('/');
                        }}
                        onPinToggle={() => toggleSessionPinned(session.key)}
                        onDelete={() => void deleteSession(session.key)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="px-4 py-2 text-sm text-gray-400">
                  {tSidebar('noSessions', 'No sessions')}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto pt-3">
        {/* User Info Section */}
        <div className="flex h-[56px] shrink-0 items-center gap-3 rounded-2xl px-4 transition-all hover:bg-white/50">
          {!sidebarCollapsed && (
            <>
              <button
                type="button"
                aria-label={tSidebar('selectAvatar', 'Select avatar')}
                onClick={() => setAvatarPopupOpen(true)}
                className="h-10 w-10 shrink-0 rounded-xl bg-white/50 flex items-center justify-center text-[20px] shadow-sm transition-all hover:scale-110 hover:shadow-md"
              >
                {selectedAvatar}
              </button>
              <span className="flex-1 truncate text-[13px] font-bold text-[#1A1C1E]">{nickname}</span>
              <button
                type="button"
                aria-label={tSidebar('settingsAria', 'Settings')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/50 text-gray-400 shadow-sm transition-all hover:bg-white hover:text-[#1A1C1E] hover:shadow-md"
                onClick={() => navigate('/settings')}
                title={tSidebar('settings', 'Settings')}
              >
                <SettingsIcon className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {avatarPopupOpen && (
        <AvatarPopup
          nickname={nickname}
          avatar={selectedAvatar}
          onNicknameChange={(v) => {
            setNickname(v);
            localStorage.setItem(NICKNAME_STORAGE_KEY, v);
            localStorage.removeItem(LEGACY_NICKNAME_STORAGE_KEY);
          }}
          onAvatarChange={(v) => {
            setSelectedAvatar(v);
            localStorage.setItem(AVATAR_STORAGE_KEY, v);
            localStorage.removeItem(LEGACY_AVATAR_STORAGE_KEY);
          }}
          onClose={() => setAvatarPopupOpen(false)}
        />
      )}

      {searchOpen ? (
        <GlobalSearchModal
          onOpenChange={setSearchOpen}
          sessions={searchSessionsData}
          agents={searchAgents}
          onSelectSession={(sessionKey) => switchSession(sessionKey)}
          onNavigate={(path) => navigate(path)}
        />
      ) : null}

      <SessionSearchModal
        isOpen={sessionSearchOpen}
        onClose={() => setSessionSearchOpen(false)}
      />
    </aside>
  );
}

const AVATAR_OPTIONS = [
  { emoji: '🐱', label: 'avatarCat' },
  { emoji: '🐶', label: 'avatarDog' },
  { emoji: '🦊', label: 'avatarFox' },
  { emoji: '🐻', label: 'avatarBear' },
  { emoji: '🐼', label: 'avatarPanda' },
  { emoji: '🐰', label: 'avatarRabbit' },
  { emoji: '🦁', label: 'avatarLion' },
  { emoji: '🐯', label: 'avatarTiger' },
  { emoji: '🐸', label: 'avatarFrog' },
];

function AvatarPopup({
  nickname,
  avatar,
  onNicknameChange,
  onAvatarChange,
  onClose,
}: {
  nickname: string;
  avatar: string;
  onNicknameChange: (v: string) => void;
  onAvatarChange: (v: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('common');
  const tSidebar = (key: string, options?: Record<string, unknown>) => t(`sidebar.${key}`, options);
  const [selectedAvatar, setSelectedAvatar] = useState(avatar);
  const [draft, setDraft] = useState(nickname);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-start" onClick={onClose}>
      <div
        className="absolute bottom-[68px] left-3 w-[260px] overflow-hidden rounded-[24px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-white/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="text-[14px] font-bold text-[#1A1C1E]">{tSidebar('profile')}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2F0E9] text-[12px] text-gray-400 hover:bg-gray-200 hover:text-[#1A1C1E]"
          >
            ✕
          </button>
        </div>

        {/* Current avatar preview */}
        <div className="flex flex-col items-center py-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2F0E9] text-[36px] shadow-sm">
            {selectedAvatar}
          </div>
          <span className="mt-2 text-[14px] font-bold text-[#1A1C1E]">{draft || nickname}</span>
        </div>

        {/* Avatar grid */}
        <div className="grid grid-cols-3 gap-2 px-5 pb-3">
          {AVATAR_OPTIONS.map((opt) => (
            <button
              key={opt.emoji}
              type="button"
              onClick={() => setSelectedAvatar(opt.emoji)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[24px] transition-all',
                selectedAvatar === opt.emoji
                  ? 'bg-[#FFD233]/20 ring-2 ring-[#FFD233]/40 shadow-sm'
                  : 'hover:bg-[#F2F0E9]',
              )}
            >
              {opt.emoji}
              <span className="text-[10px] font-bold text-gray-400">{tSidebar(opt.label)}</span>
            </button>
          ))}
        </div>

        {/* Nickname input */}
        <div className="border-t border-gray-100 px-5 py-4">
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            {tSidebar('nickname')}
          </label>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tSidebar('nicknamePlaceholder')}
            className="w-full rounded-2xl border border-gray-100 bg-[#F2F0E9]/50 px-4 py-2.5 text-[13px] font-bold text-[#1A1C1E] outline-none focus:border-[#FFD233] focus:ring-2 focus:ring-[#FFD233]/20 focus:bg-white"
          />
        </div>

        {/* Save button */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={() => {
              if (draft.trim()) onNicknameChange(draft.trim());
              onAvatarChange(selectedAvatar);
              onClose();
            }}
            className="w-full rounded-full bg-[#1A1C1E] py-3 text-[13px] font-bold text-white shadow-xl transition-all hover:scale-[1.02] hover:bg-[#FF6B4A]"
          >
            {t('common:actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
