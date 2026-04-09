import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { getOpenClawConfigDir } from './paths';
import { logger } from './logger';
import type { Team } from '../../src/types/team';

const METADATA_VERSION = 1;
const RUNTIME_METADATA_FILE = join(getOpenClawConfigDir(), 'clawcorp-runtime-metadata.json');

type AgentTeamRole = 'leader' | 'worker';
type AgentChatAccess = 'direct' | 'leader_only';

export interface AgentRuntimeMetadata {
  avatar?: string | null;
  teamRole?: AgentTeamRole;
  reportsTo?: string | null;
  chatAccess?: AgentChatAccess;
  responsibility?: string;
}

interface RuntimeMetadataDocument {
  version: number;
  teams?: Team[];
  agents?: Record<string, AgentRuntimeMetadata>;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureMetadataDir(): Promise<void> {
  const configDir = getOpenClawConfigDir();
  if (!(await fileExists(configDir))) {
    await mkdir(configDir, { recursive: true });
  }
}

async function readMetadataDocument(): Promise<RuntimeMetadataDocument> {
  try {
    if (!(await fileExists(RUNTIME_METADATA_FILE))) {
      return { version: METADATA_VERSION, teams: [], agents: {} };
    }
    const raw = await readFile(RUNTIME_METADATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as RuntimeMetadataDocument;
    return {
      version: typeof parsed.version === 'number' ? parsed.version : METADATA_VERSION,
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      agents: parsed.agents && typeof parsed.agents === 'object' ? parsed.agents : {},
    };
  } catch (error) {
    logger.warn('[runtime-metadata] Failed to read metadata sidecar, falling back to empty state:', error);
    return { version: METADATA_VERSION, teams: [], agents: {} };
  }
}

async function writeMetadataDocument(document: RuntimeMetadataDocument): Promise<void> {
  await ensureMetadataDir();
  await writeFile(
    RUNTIME_METADATA_FILE,
    JSON.stringify(
      {
        version: METADATA_VERSION,
        teams: Array.isArray(document.teams) ? document.teams : [],
        agents: document.agents && typeof document.agents === 'object' ? document.agents : {},
      },
      null,
      2,
    ),
    'utf8',
  );
}

function normalizeAgentRuntimeMetadata(value: unknown): AgentRuntimeMetadata {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const next: AgentRuntimeMetadata = {};

  if (typeof source.avatar === 'string') next.avatar = source.avatar;
  if (source.avatar === null) next.avatar = null;
  if (source.teamRole === 'leader' || source.teamRole === 'worker') next.teamRole = source.teamRole;
  if (typeof source.reportsTo === 'string') next.reportsTo = source.reportsTo;
  if (source.reportsTo === null) next.reportsTo = null;
  if (source.chatAccess === 'direct' || source.chatAccess === 'leader_only') next.chatAccess = source.chatAccess;
  if (typeof source.responsibility === 'string' && source.responsibility.trim()) {
    next.responsibility = source.responsibility.trim();
  }

  return next;
}

function hasMetadataValues(metadata: AgentRuntimeMetadata): boolean {
  return metadata.avatar !== undefined
    || metadata.teamRole !== undefined
    || metadata.reportsTo !== undefined
    || metadata.chatAccess !== undefined
    || metadata.responsibility !== undefined;
}

export async function readStoredTeams(): Promise<Team[]> {
  const document = await readMetadataDocument();
  return Array.isArray(document.teams) ? document.teams : [];
}

export async function writeStoredTeams(teams: Team[]): Promise<void> {
  const document = await readMetadataDocument();
  document.teams = Array.isArray(teams) ? teams : [];
  await writeMetadataDocument(document);
}

export async function readStoredAgentMetadata(): Promise<Record<string, AgentRuntimeMetadata>> {
  const document = await readMetadataDocument();
  const source = document.agents && typeof document.agents === 'object' ? document.agents : {};
  const normalized: Record<string, AgentRuntimeMetadata> = {};

  for (const [agentId, value] of Object.entries(source)) {
    if (!agentId.trim()) continue;
    const metadata = normalizeAgentRuntimeMetadata(value);
    if (hasMetadataValues(metadata)) {
      normalized[agentId] = metadata;
    }
  }

  return normalized;
}

export async function writeStoredAgentMetadata(metadataMap: Record<string, AgentRuntimeMetadata>): Promise<void> {
  const document = await readMetadataDocument();
  const normalized: Record<string, AgentRuntimeMetadata> = {};

  for (const [agentId, value] of Object.entries(metadataMap)) {
    if (!agentId.trim()) continue;
    const metadata = normalizeAgentRuntimeMetadata(value);
    if (hasMetadataValues(metadata)) {
      normalized[agentId] = metadata;
    }
  }

  document.agents = normalized;
  await writeMetadataDocument(document);
}

/**
 * Move ClawCorp-only extensions out of openclaw.json so OpenClaw CLI/Gateway
 * strict schema validation won't reject the config.
 */
export async function migrateClawCorpExtensionsOutOfOpenClawConfig(
  config: Record<string, unknown>,
): Promise<boolean> {
  let configModified = false;
  let metadataModified = false;

  const document = await readMetadataDocument();
  const agentMetadata: Record<string, AgentRuntimeMetadata> = {
    ...(document.agents && typeof document.agents === 'object' ? document.agents : {}),
  };

  if ('teams' in config) {
    const teamsRoot = config.teams;
    if (teamsRoot && typeof teamsRoot === 'object') {
      const maybeTeams = (teamsRoot as Record<string, unknown>).teams;
      if (Array.isArray(maybeTeams)) {
        document.teams = maybeTeams as Team[];
        metadataModified = true;
      }
    }
    delete config.teams;
    configModified = true;
    logger.info('[runtime-metadata] Migrated legacy root "teams" out of openclaw.json');
  }

  const agentsRoot = config.agents;
  if (agentsRoot && typeof agentsRoot === 'object') {
    const list = Array.isArray((agentsRoot as Record<string, unknown>).list)
      ? (agentsRoot as Record<string, unknown>).list as Array<Record<string, unknown>>
      : [];

    for (const entry of list) {
      const id = typeof entry.id === 'string' ? entry.id.trim() : '';
      if (!id) continue;
      const next = normalizeAgentRuntimeMetadata(agentMetadata[id]);
      let consumed = false;

      if ('avatar' in entry) {
        const value = entry.avatar;
        if (typeof value === 'string') next.avatar = value;
        if (value === null) next.avatar = null;
        delete entry.avatar;
        consumed = true;
      }

      if ('teamRole' in entry) {
        const value = entry.teamRole;
        if (value === 'leader' || value === 'worker') next.teamRole = value;
        delete entry.teamRole;
        consumed = true;
      }

      if ('reportsTo' in entry) {
        const value = entry.reportsTo;
        if (typeof value === 'string') next.reportsTo = value;
        if (value === null) next.reportsTo = null;
        delete entry.reportsTo;
        consumed = true;
      }

      if ('chatAccess' in entry) {
        const value = entry.chatAccess;
        if (value === 'direct' || value === 'leader_only') next.chatAccess = value;
        delete entry.chatAccess;
        consumed = true;
      }

      if ('responsibility' in entry) {
        const value = entry.responsibility;
        if (typeof value === 'string' && value.trim()) {
          next.responsibility = value.trim();
        } else {
          delete next.responsibility;
        }
        delete entry.responsibility;
        consumed = true;
      }

      if (consumed) {
        configModified = true;
        if (hasMetadataValues(next)) {
          agentMetadata[id] = next;
        } else {
          delete agentMetadata[id];
        }
        metadataModified = true;
      }
    }
  }

  if (metadataModified) {
    document.agents = agentMetadata;
    await writeMetadataDocument(document);
  }

  return configModified;
}
