/**
 * SessionGroup Component
 * Collapsible session group with persistent state (team sessions vs personal sessions).
 */

import { useEffect, useState } from 'react';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionItem } from './SessionItem';
import type { ChatSession } from '@/stores/chat';

const SESSION_GROUPS_STATE_KEY = 'clawcorp-session-groups-state';

interface SessionGroupState {
  teamSessions: boolean;
  personalSessions: boolean;
}

function readGroupState(): SessionGroupState {
  try {
    const raw = localStorage.getItem(SESSION_GROUPS_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        teamSessions: parsed.teamSessions ?? true,
        personalSessions: parsed.personalSessions ?? true,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { teamSessions: true, personalSessions: true };
}

function writeGroupState(state: SessionGroupState): void {
  localStorage.setItem(SESSION_GROUPS_STATE_KEY, JSON.stringify(state));
}

interface SessionGroupProps {
  title: string;
  sessions: ChatSession[];
  groupKey: 'teamSessions' | 'personalSessions';
  currentSessionKey: string | null;
  pinnedSessionKeySet: Set<string>;
  sessionLabels: Record<string, string>;
  sessionMessages: Map<string, any[]>;
  onSessionClick: (key: string) => void;
  onPinToggle: (key: string) => void;
  onDelete: (key: string) => void;
  collapsed: boolean;
}

export function SessionGroup({
  title,
  sessions,
  groupKey,
  currentSessionKey,
  pinnedSessionKeySet,
  sessionLabels,
  sessionMessages,
  onSessionClick,
  onPinToggle,
  onDelete,
  collapsed,
}: SessionGroupProps) {
  const [groupState, setGroupState] = useState<SessionGroupState>(readGroupState);
  const isOpen = groupState[groupKey];

  useEffect(() => {
    const state = readGroupState();
    setGroupState(state);
  }, []);

  const toggleOpen = () => {
    const newState = { ...groupState, [groupKey]: !isOpen };
    setGroupState(newState);
    writeGroupState(newState);
  };

  // Sort sessions: pinned first, then by updatedAt descending
  const sortedSessions = [...sessions].sort((a, b) => {
    const aPinned = pinnedSessionKeySet.has(a.key);
    const bPinned = pinnedSessionKeySet.has(b.key);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    const aTime = a.updatedAt || 0;
    const bTime = b.updatedAt || 0;
    return bTime - aTime;
  });

  // Extract message preview for each session
  const getMessagePreview = (sessionKey: string): string => {
    const messages = sessionMessages.get(sessionKey) || [];
    if (messages.length === 0) return '';
    const lastMessage = messages[messages.length - 1];
    const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';
    return content.length > 50 ? content.slice(0, 50) + '...' : content;
  };

  return (
    <div className="space-y-2">
      {/* Section Header */}
      <button
        type="button"
        aria-label={title}
        onClick={toggleOpen}
        className={cn(
          'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-[#e5e5ea]',
          collapsed && 'justify-center px-2',
        )}
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        {!collapsed ? (
          <>
            <span className="flex-1 truncate text-left">{title}</span>
            <ChevronRight
              className={cn(
                'h-4 w-4 shrink-0 text-[#8e8e93] transition-transform',
                isOpen && 'rotate-90',
              )}
            />
          </>
        ) : null}
      </button>

      {/* Session List */}
      {!collapsed && isOpen ? (
        <div className="space-y-2">
          {sortedSessions.length > 0 ? (
            sortedSessions.map((session) => {
              const label =
                sessionLabels[session.key] ??
                session.label ??
                session.displayName ??
                session.key;
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
                  onClick={() => onSessionClick(session.key)}
                  onPinToggle={() => onPinToggle(session.key)}
                  onDelete={() => onDelete(session.key)}
                />
              );
            })
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              暂无会话
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
