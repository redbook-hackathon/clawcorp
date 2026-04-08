/**
 * Session Search Utilities
 * Provides search logic for sessions (name, agent, message content) and time formatting.
 */

import type { ChatSession, RawMessage } from '@/stores/chat';
import type { AgentSummary } from '@/types/agent';

export interface MessageMatch {
  messageIndex: number;
  content: string;
  matchStart: number;
  matchEnd: number;
  contextBefore: string;
  contextAfter: string;
}

export interface SessionSearchResult {
  session: ChatSession;
  matchType: 'name' | 'agent' | 'content';
  messageMatches?: MessageMatch[];
}

/**
 * Search sessions and return detailed match information.
 * @param sessions - All sessions to search
 * @param query - Search query string
 * @param agents - All agents (for agent name search)
 * @param sessionMessages - Map of session key to messages (for content search)
 * @returns Array of search results with match details
 */
export function searchSessionsWithContext(
  sessions: ChatSession[],
  query: string,
  agents: AgentSummary[],
  sessionMessages: Map<string, RawMessage[]>,
): SessionSearchResult[] {
  if (!query.trim()) {
    return sessions.map((session) => ({
      session,
      matchType: 'name' as const,
    }));
  }

  const lowerQuery = query.toLowerCase();
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const results: SessionSearchResult[] = [];

  for (const session of sessions) {
    // 1. Search session name (label/displayName)
    const sessionName = (session.label || session.displayName || '').toLowerCase();
    if (sessionName.includes(lowerQuery)) {
      results.push({
        session,
        matchType: 'name',
      });
      continue;
    }

    // 2. Search agent name
    const agent = session.agentId ? agentMap.get(session.agentId) : undefined;
    if (agent && agent.name.toLowerCase().includes(lowerQuery)) {
      results.push({
        session,
        matchType: 'agent',
      });
      continue;
    }

    // 3. Search message content
    const messages = sessionMessages.get(session.key) || [];
    const recentMessages = messages.slice(-100); // Limit to last 100 messages
    const messageMatches: MessageMatch[] = [];

    for (let i = 0; i < recentMessages.length; i++) {
      const msg = recentMessages[i];
      const content = extractTextContent(msg);
      const lowerContent = content.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        // Found a match - extract context
        const contextLength = 50; // Characters before/after match
        const matchStart = matchIndex;
        const matchEnd = matchIndex + query.length;

        // Extract context before match
        const beforeStart = Math.max(0, matchStart - contextLength);
        const contextBefore = content.slice(beforeStart, matchStart);

        // Extract context after match
        const afterEnd = Math.min(content.length, matchEnd + contextLength);
        const contextAfter = content.slice(matchEnd, afterEnd);

        messageMatches.push({
          messageIndex: i,
          content,
          matchStart,
          matchEnd,
          contextBefore: beforeStart > 0 ? '...' + contextBefore : contextBefore,
          contextAfter: afterEnd < content.length ? contextAfter + '...' : contextAfter,
        });

        // Limit to 3 matches per session
        if (messageMatches.length >= 3) break;
      }
    }

    if (messageMatches.length > 0) {
      results.push({
        session,
        matchType: 'content',
        messageMatches,
      });
    }
  }

  return results;
}

/**
 * Search sessions by name, agent name, or message content.
 * @param sessions - All sessions to search
 * @param query - Search query string
 * @param agents - All agents (for agent name search)
 * @param sessionMessages - Map of session key to messages (for content search)
 * @returns Filtered sessions
 */
export function searchSessions(
  sessions: ChatSession[],
  query: string,
  agents: AgentSummary[],
  sessionMessages: Map<string, RawMessage[]>,
): ChatSession[] {
  if (!query.trim()) {
    return sessions;
  }

  const lowerQuery = query.toLowerCase();
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return sessions.filter((session) => {
    // 1. Search session name (label/displayName)
    const sessionName = (session.label || session.displayName || '').toLowerCase();
    if (sessionName.includes(lowerQuery)) {
      return true;
    }

    // 2. Search agent name
    const agent = session.agentId ? agentMap.get(session.agentId) : undefined;
    if (agent && agent.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 3. Search message content (synchronous - only search loaded messages)
    const messages = sessionMessages.get(session.key) || [];
    const recentMessages = messages.slice(-100); // Limit to last 100 messages

    const hasMatchingMessage = recentMessages.some((msg) => {
      const content = extractTextContent(msg);
      return content.toLowerCase().includes(lowerQuery);
    });

    return hasMatchingMessage;
  });
}

/**
 * Extract text content from a message for searching.
 */
function extractTextContent(message: RawMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((block: any) => {
        if (block.type === 'text' && block.text) return block.text;
        if (block.type === 'thinking' && block.thinking) return block.thinking;
        return '';
      })
      .join(' ');
  }

  return '';
}

/**
 * Format relative time from timestamp.
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚刚';
  }

  if (minutes < 60) {
    return `${minutes}分钟前`;
  }

  if (hours < 24) {
    return `${hours}小时前`;
  }

  if (days === 1) {
    return '昨天';
  }

  // Format as MM-DD
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

/**
 * Extract message preview from recent messages.
 * @param messages - Array of messages
 * @returns Preview text (max 50 chars)
 */
export function extractMessagePreview(messages: RawMessage[]): string {
  if (!messages || messages.length === 0) {
    return '';
  }

  // Get the last message
  const lastMessage = messages[messages.length - 1];
  const content = extractTextContent(lastMessage);

  // Truncate to 50 characters
  if (content.length > 50) {
    return content.slice(0, 50) + '...';
  }

  return content;
}
