export type ChannelSyncSessionType = 'group' | 'private';

export interface ChannelSyncSession {
  id: string;
  channelId: string;
  channelType: string;
  sessionType: ChannelSyncSessionType;
  title: string;
  pinned: boolean;
  syncState: string;
  latestActivityAt?: string;
  previewText?: string;
  participantSummary?: string;
  visibleAgentId?: string;
}

export interface ChannelSyncConversation {
  id: string;
  title: string;
  syncState: string;
  participantSummary?: string;
  visibleAgentId?: string;
}

export type ChannelSyncMessageType =
  | 'text'
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'sticker'
  | 'post'
  | 'card'
  | 'unknown';

export interface ChannelSyncFileInfo {
  /** Original filename */
  name?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
  /** Download URL (may be proxied) */
  downloadUrl?: string;
}

export interface ChannelSyncMessage {
  id: string;
  role: 'human' | 'agent' | 'tool' | 'system';
  authorName?: string;
  createdAt?: string;
  content?: string;
  toolName?: string;
  durationMs?: number;
  summary?: string;
  internal?: boolean;
  /** True when this message was sent by the currently-active agent/user (renders right-aligned) */
  isSelf?: boolean;
  /** Proxied image URL for inline display */
  imageUrl?: string;
  /** Metadata for file-type messages */
  fileInfo?: ChannelSyncFileInfo;
  /** Feishu message type; defaults to 'text' when absent */
  messageType?: ChannelSyncMessageType;
  /** True when this is an optimistic (not-yet-confirmed) message */
  optimistic?: boolean;
  /** True when the optimistic send failed */
  sendError?: boolean;
  /** The original text of an optimistic send, used for retry */
  sendText?: string;
}
