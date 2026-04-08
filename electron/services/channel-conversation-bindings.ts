import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensureDir, getDataDir } from '../utils/paths';

export interface ChannelConversationBindingRecord {
  channelType: string;
  accountId: string;
  externalConversationId: string;
  agentId: string;
  sessionKey: string;
  displayTitle?: string;
  hidden?: boolean;
  updatedAt: number;
}

export interface ChannelConversationBindingStore {
  get(channelType: string, accountId: string, externalConversationId: string): Promise<ChannelConversationBindingRecord | null>;
  upsert(record: Omit<ChannelConversationBindingRecord, 'updatedAt'>): Promise<ChannelConversationBindingRecord>;
  deleteByChannel(channelType: string, accountId?: string): Promise<void>;
}

const DEFAULT_FILE_NAME = 'channel-conversation-bindings.json';

function makeKey(record: Pick<ChannelConversationBindingRecord, 'channelType' | 'accountId' | 'externalConversationId'>): string {
  return `${record.channelType}:${record.accountId}:${record.externalConversationId}`;
}

function loadBindings(filePath: string): ChannelConversationBindingRecord[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse channel conversation bindings at ${filePath}: ${String(error)}`,
      { cause: error },
    );
  }

  if (Array.isArray((parsed as { bindings?: unknown })?.bindings)) {
    return (parsed as { bindings: ChannelConversationBindingRecord[] }).bindings;
  }

  if (Array.isArray(parsed)) {
    return parsed as ChannelConversationBindingRecord[];
  }

  throw new Error(`Invalid channel conversation bindings format at ${filePath}`);
}

function saveBindings(filePath: string, bindings: ChannelConversationBindingRecord[]): void {
  writeFileSync(filePath, JSON.stringify({ bindings }, null, 2));
}

function ensureStorage(filePath?: string): string {
  const target = filePath ?? join(getDataDir(), DEFAULT_FILE_NAME);
  ensureDir(dirname(target));
  return target;
}

export function createChannelConversationBindingStore(filePath?: string): ChannelConversationBindingStore {
  const storagePath = ensureStorage(filePath);

  return {
    async get(channelType, accountId, externalConversationId) {
      const key = makeKey({ channelType, accountId, externalConversationId });
      const bindings = loadBindings(storagePath);
      return bindings.find((entry) => makeKey(entry) === key) ?? null;
    },

    async upsert(record) {
      const bindings = loadBindings(storagePath);
      const key = makeKey(record);
      const updated: ChannelConversationBindingRecord = {
        ...record,
        updatedAt: Date.now(),
      };
      const existingIndex = bindings.findIndex((entry) => makeKey(entry) === key);
      if (existingIndex >= 0) {
        bindings[existingIndex] = updated;
      } else {
        bindings.push(updated);
      }
      saveBindings(storagePath, bindings);
      return updated;
    },

    async deleteByChannel(channelType, accountId) {
      const bindings = loadBindings(storagePath);
      const filtered = bindings.filter((entry) => {
        if (entry.channelType !== channelType) {
          return true;
        }
        if (accountId && entry.accountId !== accountId) {
          return true;
        }
        return false;
      });
      if (filtered.length !== bindings.length) {
        saveBindings(storagePath, filtered);
      }
    },
  };
}
