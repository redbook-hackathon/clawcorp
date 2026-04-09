/**
 * SessionItem Component
 * Displays a rich session item with avatar, name, preview, time, unread badge, and agent status.
 * Optimized layout following D-15 to D-21 design decisions.
 */

import { Crown, Pin, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ChatSession } from '@/stores/chat';
import { formatRelativeTime } from '@/lib/session-search';

interface SessionItemProps {
  session: ChatSession;
  label: string;
  isPinned: boolean;
  isActive: boolean;
  messagePreview?: string;
  agentAvatar?: string | null;
  onClick: () => void;
  onPinToggle: () => void;
  onDelete: () => void;
}

export function SessionItem({
  session,
  label,
  isPinned,
  isActive,
  messagePreview,
  agentAvatar,
  onClick,
  onPinToggle,
  onDelete,
}: SessionItemProps) {
  const initials = label.slice(0, 1).toUpperCase();
  const displayName = session.isTeamSession && session.teamName
    ? `团队${session.teamName}：${label}`
    : label;
  const relativeTime = formatRelativeTime(session.updatedAt);

  // Agent status color (D-18)
  const statusColor = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-yellow-500',
  }[session.agentStatus || 'offline'];

  // Show unread badge only when count > 0 (D-17)
  const showUnreadBadge = session.unreadCount && session.unreadCount > 0;

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={`Open session ${label}`}
        className={cn(
          'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
          isActive
            ? 'bg-accent border-l-2 border-primary'
            : 'hover:bg-[#f2f2f7]',
        )}
        onClick={onClick}
      >
        {/* Avatar with status indicator (D-18) */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            {agentAvatar ? (
              <img src={agentAvatar} alt="" className="object-cover" />
            ) : (
              <AvatarFallback className="bg-muted text-sm font-medium">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          {/* Agent status dot with white ring */}
          <div
            className={cn(
              'absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white',
              statusColor,
            )}
          />
        </div>

        {/* Content - Two-row structure (D-15, D-16) */}
        <div className="min-w-0 flex-1">
          {/* Row 1: Title + Time (D-21: title must truncate) */}
          <div className="flex items-center gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate text-sm font-medium text-[#000000]">
                {displayName}
              </span>
              {session.isPrivateChat && session.isLeaderChat && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  <Crown className="h-3 w-3" />
                  Leader Chat
                </span>
              )}
              {isPinned && (
                <Pin
                  className="h-3 w-3 shrink-0 text-[#007aff]"
                  fill="currentColor"
                  aria-label="Pinned"
                />
              )}
            </div>
            {/* Time - hidden on hover when action buttons appear */}
            {relativeTime && (
              <span className="text-xs text-[#8e8e93] shrink-0 group-hover:opacity-0 transition-opacity">
                {relativeTime}
              </span>
            )}
          </div>

          {/* Row 2: Message preview + Unread badge (D-15, D-17) */}
          <div className="flex items-center gap-2">
            {messagePreview && (
              <p className="truncate text-xs text-[#8e8e93] flex-1">
                {messagePreview}
              </p>
            )}
            {showUnreadBadge && (
              <Badge
                variant="destructive"
                className="h-5 min-w-[20px] px-1.5 text-[11px] font-medium shrink-0"
              >
                {session.unreadCount! > 99 ? '99+' : session.unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </button>

      {/* Action buttons with gradient mask (D-21: visible on hover) */}
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Gradient mask to prevent text overlap */}
        <div className="absolute inset-y-0 -left-8 w-8 bg-gradient-to-r from-transparent to-[#f2f2f7] pointer-events-none" />

        <button
          type="button"
          aria-label={isPinned ? 'Unpin' : 'Pin'}
          className="relative z-10 rounded-md p-1.5 text-[#8e8e93] bg-white shadow-sm hover:bg-[#e5e5ea] hover:text-[#3c3c43] transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onPinToggle();
          }}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete"
          className="relative z-10 rounded-md p-1.5 text-[#8e8e93] bg-white shadow-sm hover:bg-[#e5e5ea] hover:text-[#ef4444] transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
