import { withConfigLock } from './config-mutex';
import { readOpenClawConfig, writeOpenClawConfig } from './channel-config';

export type ChannelOwnerBindingRecord = {
  channelType: string;
  accountId: string;
  agentId?: string;
  teamId?: string;
  responsiblePerson?: string;
  updatedAt: number;
};

type OwnerBindingsSection = {
  bindings?: ChannelOwnerBindingRecord[];
};

type ConfigDocument = {
  channelOwnerBindings?: OwnerBindingsSection;
  [key: string]: unknown;
};

const DEFAULT_ACCOUNT_ID = 'default';

function normalizeKey(value: string | null | undefined, fallback = DEFAULT_ACCOUNT_ID): string {
  const trimmed = (value ?? '').trim();
  return trimmed || fallback;
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed || undefined;
}

function isValidBinding(record: unknown): record is ChannelOwnerBindingRecord {
  if (!record || typeof record !== 'object') return false;
  const candidate = record as Partial<ChannelOwnerBindingRecord>;
  return (
    typeof candidate.channelType === 'string'
    && typeof candidate.accountId === 'string'
    && typeof candidate.updatedAt === 'number'
  );
}

function makeKey(channelType: string, accountId: string): string {
  return `${channelType}:${accountId}`;
}

function readBindingsFromConfig(config: ConfigDocument): ChannelOwnerBindingRecord[] {
  const entries = config.channelOwnerBindings?.bindings;
  if (!Array.isArray(entries)) return [];
  return entries.filter(isValidBinding);
}

function writeBindingsToConfig(config: ConfigDocument, bindings: ChannelOwnerBindingRecord[]): void {
  if (bindings.length === 0) {
    delete config.channelOwnerBindings;
    return;
  }
  config.channelOwnerBindings = { bindings };
}

export async function listChannelOwnerBindings(): Promise<ChannelOwnerBindingRecord[]> {
  const config = await readOpenClawConfig() as ConfigDocument;
  return readBindingsFromConfig(config);
}

export async function upsertChannelOwnerBinding(input: {
  channelType: string;
  accountId?: string;
  agentId?: string;
  teamId?: string;
  responsiblePerson?: string;
}): Promise<void> {
  const channelType = normalizeKey(input.channelType, '');
  if (!channelType) {
    throw new Error('channelType is required');
  }

  const accountId = normalizeKey(input.accountId);
  const agentId = normalizeOptional(input.agentId);
  const teamId = normalizeOptional(input.teamId);
  const responsiblePerson = normalizeOptional(input.responsiblePerson);

  await withConfigLock(async () => {
    const config = await readOpenClawConfig() as ConfigDocument;
    const current = readBindingsFromConfig(config);
    const targetKey = makeKey(channelType, accountId);
    const next = current.filter((entry) => makeKey(entry.channelType, entry.accountId) !== targetKey);

    if (agentId || teamId || responsiblePerson) {
      next.push({
        channelType,
        accountId,
        ...(agentId ? { agentId } : {}),
        ...(teamId ? { teamId } : {}),
        ...(responsiblePerson ? { responsiblePerson } : {}),
        updatedAt: Date.now(),
      });
    }

    writeBindingsToConfig(config, next);
    await writeOpenClawConfig(config);
  });
}

export async function clearChannelOwnerBinding(channelType: string, accountId?: string): Promise<void> {
  const targetChannelType = normalizeKey(channelType, '');
  if (!targetChannelType) return;
  const targetAccountId = normalizeKey(accountId);

  await withConfigLock(async () => {
    const config = await readOpenClawConfig() as ConfigDocument;
    const current = readBindingsFromConfig(config);
    const next = current.filter(
      (entry) => !(entry.channelType === targetChannelType && entry.accountId === targetAccountId),
    );
    writeBindingsToConfig(config, next);
    await writeOpenClawConfig(config);
  });
}

export async function clearAllChannelOwnerBindingsForChannel(channelType: string): Promise<void> {
  const targetChannelType = normalizeKey(channelType, '');
  if (!targetChannelType) return;

  await withConfigLock(async () => {
    const config = await readOpenClawConfig() as ConfigDocument;
    const current = readBindingsFromConfig(config);
    const next = current.filter((entry) => entry.channelType !== targetChannelType);
    writeBindingsToConfig(config, next);
    await writeOpenClawConfig(config);
  });
}

export async function clearChannelOwnerBindingsForTeam(teamId: string): Promise<void> {
  const targetTeamId = normalizeOptional(teamId);
  if (!targetTeamId) return;

  await withConfigLock(async () => {
    const config = await readOpenClawConfig() as ConfigDocument;
    const current = readBindingsFromConfig(config);
    const next = current.filter((entry) => entry.teamId !== targetTeamId);
    writeBindingsToConfig(config, next);
    await writeOpenClawConfig(config);
  });
}
