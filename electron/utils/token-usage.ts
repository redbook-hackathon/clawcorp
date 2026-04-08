import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { getOpenClawConfigDir } from './paths';
import { logger } from './logger';
import {
  extractSessionIdFromTranscriptFileName,
  parseUsageEntriesFromJsonl,
  type TokenUsageHistoryEntry,
} from './token-usage-core';
import { listConfiguredAgentIds } from './agent-config';

export {
  extractSessionIdFromTranscriptFileName,
  parseUsageEntriesFromJsonl,
  type TokenUsageHistoryEntry,
} from './token-usage-core';

async function listAgentIdsWithSessionDirs(): Promise<string[]> {
  const openclawDir = getOpenClawConfigDir();
  const agentsDir = join(openclawDir, 'agents');
  const agentIds = new Set<string>();

  try {
    for (const agentId of await listConfiguredAgentIds()) {
      const normalized = agentId.trim();
      if (normalized) {
        agentIds.add(normalized);
      }
    }
  } catch {
    // Ignore config discovery failures and fall back to disk scan.
  }

  try {
    const agentEntries = await readdir(agentsDir, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (entry.isDirectory()) {
        const normalized = entry.name.trim();
        if (normalized) {
          agentIds.add(normalized);
        }
      }
    }
  } catch {
    // Ignore disk discovery failures and return whatever we already found.
  }

  return [...agentIds];
}

async function listRecentSessionFiles(): Promise<Array<{ filePath: string; sessionId: string; agentId: string; mtimeMs: number }>> {
  const openclawDir = getOpenClawConfigDir();
  const agentsDir = join(openclawDir, 'agents');

  try {
    const agentEntries = await listAgentIdsWithSessionDirs();
    const files: Array<{ filePath: string; sessionId: string; agentId: string; mtimeMs: number }> = [];

    for (const agentId of agentEntries) {
      const sessionsDir = join(agentsDir, agentId, 'sessions');
      try {
        const sessionEntries = await readdir(sessionsDir);

        for (const fileName of sessionEntries) {
          const sessionId = extractSessionIdFromTranscriptFileName(fileName);
          if (!sessionId) continue;
          const filePath = join(sessionsDir, fileName);
          try {
            const fileStat = await stat(filePath);
            files.push({
              filePath,
              sessionId,
              agentId,
              mtimeMs: fileStat.mtimeMs,
            });
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return files;
  } catch {
    return [];
  }
}

async function readCronRunSessionIndex(): Promise<Map<string, string>> {
  const cronRunsDir = join(getOpenClawConfigDir(), 'cron', 'runs');
  const mapping = new Map<string, string>();

  try {
    const files = await readdir(cronRunsDir);
    for (const fileName of files) {
      if (!fileName.endsWith('.jsonl')) continue;
      const fallbackJobId = fileName.replace(/\.jsonl$/, '');
      const filePath = join(cronRunsDir, fileName);
      const raw = await readFile(filePath, 'utf8').catch(() => '');
      if (!raw.trim()) continue;

      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId.trim() : '';
          const jobId = typeof parsed.jobId === 'string' && parsed.jobId.trim()
            ? parsed.jobId.trim()
            : fallbackJobId;
          if (sessionId && jobId) {
            mapping.set(sessionId, jobId);
          }
        } catch {
          // Ignore malformed cron run log lines.
        }
      }
    }
  } catch {
    // Ignore missing or unreadable cron run logs.
  }

  return mapping;
}

export async function getRecentTokenUsageHistory(limit?: number): Promise<TokenUsageHistoryEntry[]> {
  const files = await listRecentSessionFiles();
  const cronJobBySessionId = await readCronRunSessionIndex();
  const results: TokenUsageHistoryEntry[] = [];
  const maxEntries = typeof limit === 'number' && Number.isFinite(limit)
    ? Math.max(Math.floor(limit), 0)
    : Number.POSITIVE_INFINITY;

  for (const file of files) {
    if (results.length >= maxEntries) break;
    try {
      const content = await readFile(file.filePath, 'utf8');
      const entries = parseUsageEntriesFromJsonl(content, {
        sessionId: file.sessionId,
        agentId: file.agentId,
      }, Number.isFinite(maxEntries) ? maxEntries - results.length : undefined)
        .map((entry) => {
          const cronJobId = cronJobBySessionId.get(entry.sessionId);
          return cronJobId ? { ...entry, cronJobId } : entry;
        });
      results.push(...entries);
    } catch (error) {
      logger.debug(`Failed to read token usage transcript ${file.filePath}:`, error);
    }
  }

  results.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return Number.isFinite(maxEntries) ? results.slice(0, maxEntries) : results;
}
