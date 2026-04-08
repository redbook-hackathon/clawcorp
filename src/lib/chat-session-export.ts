import type { RawMessage } from '@/stores/chat';
import { extractText } from '@/pages/Chat/message-utils';

export type ChatHistoryResponse = {
  messages?: RawMessage[];
};

export type GatewayRpcEnvelope<T> = {
  success?: boolean;
  result?: T;
  error?: string;
};

function formatExportRole(role: RawMessage['role']): string {
  switch (role) {
    case 'user':
      return 'User';
    case 'assistant':
      return 'Assistant';
    case 'system':
      return 'System';
    case 'toolresult':
      return 'Tool Result';
    default:
      return 'Message';
  }
}

export function buildConversationMarkdownExport(messages: RawMessage[], sessionKey: string): string {
  const exportedAt = new Date().toISOString();
  const sections = messages.map((message, index) => {
    const extracted = extractText(message);
    const fallback = message.content != null
      ? (typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2))
      : '';
    const body = (extracted || fallback || '[no text content]').trim();
    return `## ${index + 1}. ${formatExportRole(message.role)}\n\n${body}`;
  });

  return [
    '# Chat Conversation Export',
    '',
    `- Session: \`${sessionKey}\``,
    `- Exported At: ${exportedAt}`,
    '',
    '---',
    '',
    ...sections,
    '',
  ].join('\n');
}

export function encodeUtf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

export function buildConversationExportFileName(sessionKey: string): string {
  const normalized = sessionKey.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const suffix = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
  const base = normalized || 'session';
  return `${base}-${suffix}.md`;
}

export function unwrapChatHistoryResponse(
  response: ChatHistoryResponse | GatewayRpcEnvelope<ChatHistoryResponse> | null | undefined,
): ChatHistoryResponse {
  if (
    response
    && typeof response === 'object'
    && 'success' in response
    && typeof (response as GatewayRpcEnvelope<ChatHistoryResponse>).success === 'boolean'
  ) {
    return (response as GatewayRpcEnvelope<ChatHistoryResponse>).result ?? {};
  }
  return (response as ChatHistoryResponse | null | undefined) ?? {};
}
