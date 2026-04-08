import { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  Bot,
  ChevronRight,
  LayoutDashboard,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Pin,
  Plus,
  Radio,
  Search,
  Settings as SettingsIcon,
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
import { useAgentsStore } from '@/stores/agents';
import { useChannelsStore } from '@/stores/channels';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useSettingsStore } from '@/stores/settings';
import { useRightPanelStore } from '@/stores/rightPanelStore';
import { CHANNEL_ICONS, type Channel } from '@/types/channel';

const CHAT_REQUEST_FILE_UPLOAD_EVENT = 'chat:request-file-upload';
const CHAT_UPLOAD_PENDING_KEY = 'clawcorp:pending-upload';
const NICKNAME_STORAGE_KEY = 'clawcorp-user-nickname';
const LEGACY_NICKNAME_STORAGE_KEY = 'clawx-user-nickname';
const AVATAR_STORAGE_KEY = 'clawcorp-user-avatar';
const LEGACY_AVATAR_STORAGE_KEY = 'clawx-user-avatar';

type NavItemConfig = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
};

function prefixChannelSessionLabel(sessionKey: string, label: string): string {
  if (label.startsWith('[')) {
    return label;
  }
  if (/^agent:[^:]+:feishu:/.test(sessionKey)) {
    return `[飞书] ${label}`;
  }
  if (/^agent:[^:]+:wechat:/.test(sessionKey)) {
    return `[微信] ${label}`;
  }
  return label;
}

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
        'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-[#e5e5ea]',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-[#8e8e93] transition-transform',
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
        className="flex h-11 w-full items-center justify-center rounded-xl px-2 text-sm font-medium transition-colors hover:bg-[#e5e5ea]"
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
      </button>
    );
  }

  return (
    <div className="group/sessions-header flex items-center gap-2">
      <button
        type="button"
        aria-label={label}
        onClick={onToggle}
        className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-[#e5e5ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]/40"
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="truncate text-left">{label}</span>
        <ChevronRight
          data-testid="sessions-section-chevron"
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-[#8e8e93] transition-all opacity-0 group-hover/sessions-header:opacity-100 group-focus-within/sessions-header:opacity-100',
            open && 'rotate-90',
          )}
        />
      </button>

      <button
        type="button"
        aria-label={newSessionLabel}
        title={newSessionLabel}
        onClick={onNewSession}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#3c3c43] transition-colors hover:bg-[#e5e5ea] hover:text-[#000000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]/40"
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
        'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
        active
          ? 'bg-white text-[#000000] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)]'
          : 'text-[#000000] hover:bg-[#e5e5ea]',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
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
      label: tSidebar('taskBoard', 'Task board'),
      path: '/kanban',
      icon: LayoutDashboard,
    },
    {
      label: tSidebar('teamOverview', 'Team overview'),
      path: '/team-overview',
      icon: Users,
    },
    {
      label: tSidebar('employeeSquare', 'Employee square'),
      path: '/agents',
      icon: Bot,
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
    label: sessionLabels[session.key] ?? session.label ?? session.displayName ?? session.key,
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
        'flex shrink-0 flex-col border-r border-black/[0.06] bg-[#f2f2f7] transition-all duration-300 dark:border-white/10 dark:bg-background',
        sidebarCollapsed ? 'w-16 px-2 py-2' : 'w-[260px] px-2 py-2',
      )}
    >
      <div className={cn('flex items-center gap-2', sidebarCollapsed ? 'justify-center' : 'justify-between')}>
        <button
          type="button"
          aria-label={tSidebar('toggleSidebar', 'Toggle sidebar')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#3c3c43] transition-colors hover:bg-[#e5e5ea] hover:text-[#000000]"
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
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#000000] transition-colors hover:bg-[#e5e5ea]"
            onClick={() => setSessionSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
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

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="space-y-2">
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
                      <p className="px-3 py-2 text-[13px] text-muted-foreground">
                        {tSidebar('noChannels', 'No channels configured')}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAddChannel(true);
                          navigate('/channels');
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-[#8e8e93] transition-colors hover:bg-[#e5e5ea] hover:text-[#3c3c43]"
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
                      const icon = CHANNEL_ICONS[bot.type] ?? '🔌';
                      const statusDotColor =
                        bot.status === 'connected'
                          ? 'bg-[#10b981]'
                          : bot.status === 'connecting'
                            ? 'bg-[#f59e0b]'
                            : bot.status === 'error'
                              ? 'bg-[#ef4444]'
                              : 'bg-[#94a3b8]';

                      return (
                        <div
                          key={bot.id}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] transition-colors',
                            isActive
                              ? 'bg-[#EEF2FF] text-[#6366f1] font-medium'
                              : 'text-[#000000] hover:bg-[#e5e5ea]',
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
                            <span className="shrink-0 text-[14px]">{icon}</span>
                            <span className="truncate text-[13px]">{bot.name}</span>
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDotColor)} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChannelId(bot.id);
                              setPendingBotSettings(bot.id);
                              navigate('/channels');
                            }}
                            className="shrink-0 text-[12px] text-[#8e8e93] hover:text-[#3c3c43]"
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
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-[#8e8e93] transition-colors hover:bg-[#e5e5ea] hover:text-[#3c3c43]"
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

        <div className="mt-4 space-y-2">
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
                    const label =
                      prefixChannelSessionLabel(
                        session.key,
                        sessionLabels[session.key] ??
                        session.label ??
                        session.displayName ??
                        session.key,
                      );
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
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {tSidebar('noSessions', 'No sessions')}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto border-t border-[#c6c6c8] dark:border-white/10">
        {/* User Info Section */}
        <div className="flex h-[52px] shrink-0 items-center gap-[10px] px-4 transition-colors hover:bg-[#e5e5ea] dark:hover:bg-white/[0.04]">
          {!sidebarCollapsed && (
            <>
              <button
                type="button"
                aria-label={tSidebar('selectAvatar', 'Select avatar')}
                onClick={() => setAvatarPopupOpen(true)}
                className="h-7 w-7 shrink-0 rounded-full bg-[#d9d9d9] flex items-center justify-center text-[18px] transition-colors hover:ring-2 hover:ring-clawcorp-ac/40"
              >
                {selectedAvatar}
              </button>
              <span className="flex-1 truncate text-[13px] font-medium">{nickname}</span>
              <button
                type="button"
                aria-label={tSidebar('settingsAria', 'Settings')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[16px] transition-colors hover:bg-[#e5e5ea]"
                onClick={() => navigate('/settings')}
                title={tSidebar('settings', 'Settings')}
              >
                <SettingsIcon className="h-4 w-4" />
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
        className="absolute bottom-[60px] left-2 w-[260px] overflow-hidden rounded-[18px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
          <span className="text-[14px] font-semibold text-[#000000]">{tSidebar('profile')}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f2f2f7] text-[12px] text-[#3c3c43] hover:bg-[#e5e5ea]"
          >
            ✕
          </button>
        </div>

        {/* Current avatar preview */}
        <div className="flex flex-col items-center py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f2f2f7] text-[32px]">
            {selectedAvatar}
          </div>
          <span className="mt-2 text-[13px] font-medium text-[#000000]">{draft || nickname}</span>
        </div>

        {/* Avatar grid */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          {AVATAR_OPTIONS.map((opt) => (
            <button
              key={opt.emoji}
              type="button"
              onClick={() => setSelectedAvatar(opt.emoji)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl py-2 text-[22px] transition-colors',
                selectedAvatar === opt.emoji
                  ? 'bg-clawcorp-ac/10 ring-1 ring-clawcorp-ac/40'
                  : 'hover:bg-[#f2f2f7]',
              )}
            >
              {opt.emoji}
              <span className="text-[10px] text-[#8e8e93]">{tSidebar(opt.label)}</span>
            </button>
          ))}
        </div>

        {/* Nickname input */}
        <div className="border-t border-black/[0.06] px-4 py-3">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.5px] text-[#8e8e93]">
            {tSidebar('nickname')}
          </label>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tSidebar('nicknamePlaceholder')}
            className="w-full rounded-lg border border-black/10 bg-[#f2f2f7] px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawcorp-ac focus:bg-white"
          />
        </div>

        {/* Save button */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => {
              if (draft.trim()) onNicknameChange(draft.trim());
              onAvatarChange(selectedAvatar);
              onClose();
            }}
            className="w-full rounded-full bg-clawcorp-ac py-2 text-[13px] font-semibold text-white hover:bg-[#0062cc]"
          >
            {t('common:actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
