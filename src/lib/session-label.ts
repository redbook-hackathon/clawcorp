import type { ChatSession } from '@/stores/chat';

type SessionLabelSession = Pick<ChatSession, 'key' | 'label' | 'displayName' | 'isTeamSession' | 'teamName'>;

/**
 * Keep session naming consistent across sidebar, search and detail panels.
 */
export function resolveSessionDisplayLabel(
  session: SessionLabelSession | null | undefined,
  sessionLabels: Record<string, string>,
): string {
  if (!session) return '';
  const baseLabel = sessionLabels[session.key] ?? session.label ?? session.displayName ?? session.key;
  if (session.isTeamSession && session.teamName) {
    return `团队${session.teamName}：${baseLabel}`;
  }
  return baseLabel;
}
