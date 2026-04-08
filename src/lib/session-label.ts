import type { ChatSession } from '@/stores/chat';

type SessionLabelSession = Pick<ChatSession, 'key' | 'agentId' | 'targetAgentId'>;
type SessionLabelAgent = { id: string; name: string };

function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const parts = sessionKey.split(':');
  return (parts[1] || 'main').trim().toLowerCase();
}

/**
 * Keep session naming consistent with chat top header:
 * session title resolves to the bound/current agent name.
 */
export function resolveSessionDisplayLabel(
  session: SessionLabelSession | null | undefined,
  agents: SessionLabelAgent[],
  fallback = 'ClawCorp',
): string {
  if (!session) return fallback;
  const candidateId = (
    session.targetAgentId
    ?? session.agentId
    ?? getAgentIdFromSessionKey(session.key)
  ).trim().toLowerCase();

  const matched = agents.find((agent) => agent.id.trim().toLowerCase() === candidateId);
  return matched?.name ?? fallback;
}
