import type { IncomingMessage, ServerResponse } from 'http';
import { readFile, readdir, writeFile, stat, mkdir, rename, unlink } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join, basename, dirname, resolve, relative, isAbsolute, posix, win32 } from 'path';
import { homedir } from 'os';
import { execFile, spawnSync } from 'child_process';
import type { HostApiContext } from '../context';
import { sendJson, parseJsonBody } from '../route-utils';
import { extractMemoryFromMessages, extractMemoryWithLlm, type MemoryGuardLevel, type LlmProviderConfig } from './memory-extract';
import { listAgentsSnapshot } from '../../utils/agent-config';
import { expandPath } from '../../utils/paths';
import { getDefaultProviderAccountId, getProviderAccount } from '../../services/providers/provider-store';
import { getApiKey } from '../../utils/secure-storage';

// ── Types ────────────────────────────────────────────────────────

type MemoryFileCategory = 'evergreen' | 'daily' | 'other';
type HealthSeverity = 'critical' | 'warning' | 'info' | 'ok';

interface MemoryFileHighlight {
  start: number;
  end: number;
  snippet: string;
}

interface MemoryFileSearch {
  hitCount: number;
  highlights: MemoryFileHighlight[];
}

interface MemoryFileInfo {
  label: string;
  path: string;
  relativePath: string;
  content: string;
  lastModified: string;
  sizeBytes: number;
  category: MemoryFileCategory;
  scopeId: string;
  writable: boolean;
  search?: MemoryFileSearch;
}

interface MemoryScopeInfo {
  id: string;
  label: string;
  agentName: string;
  workspaceDir: string;
}

interface MemoryConfig {
  memorySearch: {
    enabled: boolean;
    provider: string | null;
    model: string | null;
    hybrid: {
      enabled: boolean;
      vectorWeight: number;
      textWeight: number;
      temporalDecay: { enabled: boolean; halfLifeDays: number };
      mmr: { enabled: boolean; lambda: number };
    };
    cache: { enabled: boolean; maxEntries: number };
    extraPaths: string[];
  };
  qmdCollections: Array<{
    name: string;
    path: string;
    pattern: string;
  }>;
  memoryFlush: { enabled: boolean; softThresholdTokens: number };
  configFound: boolean;
}

interface MemoryStatus {
  indexed: boolean;
  lastIndexed: string | null;
  totalEntries: number | null;
  vectorAvailable: boolean | null;
  embeddingProvider: string | null;
  raw: string;
}

interface MemoryStats {
  totalFiles: number;
  totalSizeBytes: number;
  dailyLogCount: number;
  evergreenCount: number;
  oldestDaily: string | null;
  newestDaily: string | null;
  dailyTimeline: Array<{ date: string; sizeBytes: number } | null>;
}

interface MemoryHealthCheck {
  id: string;
  severity: HealthSeverity;
  title: string;
  description: string;
  affectedFiles: string[] | null;
  action: string | null;
}

interface StaleDailyLogInfo {
  relativePath: string;
  label: string;
  date: string;
  ageDays: number;
  sizeBytes: number;
}

interface MemoryHealthSummary {
  score: number;
  checks: MemoryHealthCheck[];
  staleDailyLogs: StaleDailyLogInfo[];
}

// ── Workspace path ───────────────────────────────────────────────

const COMPANION_FILES = ['AGENTS.md', 'HEARTBEAT.md', 'IDENTITY.md', 'SOUL.md', 'TOOLS.md', 'USER.md'] as const;

function getWorkspaceDir(): string {
  // Try current layout first, then legacy
  const current = join(homedir(), '.openclaw', 'agents', 'main', 'workspace');
  if (existsSync(current)) return current;
  return join(homedir(), '.openclaw', 'workspace');
}

function isAbsolutePath(target: string): boolean {
  return isAbsolute(target) || posix.isAbsolute(target) || win32.isAbsolute(target);
}

function normalizeRelativePath(requested: string): string | null {
  const trimmed = requested.trim();
  if (!trimmed) return null;
  if (trimmed.includes('\0')) return null;
  if (isAbsolutePath(trimmed)) return null;
  const normalized = posix.normalize(trimmed.replace(/[\\]+/g, '/'));
  if (!normalized || normalized === '.' || normalized === '..') return null;
  if (normalized.startsWith('../')) return null;
  return normalized.replace(/^\.\/+/, '');
}

function resolveWorkspaceFilePath(workspaceDir: string, requested: string): string | null {
  const normalized = normalizeRelativePath(requested);
  if (!normalized) return null;
  const workspaceRoot = resolve(workspaceDir);
  const fullPath = resolve(workspaceRoot, normalized);
  const rel = relative(workspaceRoot, fullPath).replace(/[\\/]+/g, '/');
  if (rel === '' || (!rel.startsWith('../') && rel !== '..')) {
    return fullPath;
  }
  return null;
}

function toRelativeWorkspacePath(workspaceDir: string, fullPath: string): string | null {
  const workspaceRoot = resolve(workspaceDir);
  const rel = relative(workspaceRoot, resolve(fullPath)).replace(/[\\/]+/g, '/');
  if (!rel || rel === '.' || rel === '..' || rel.startsWith('../')) return null;
  return rel;
}

async function getMemoryScopes(): Promise<MemoryScopeInfo[]> {
  const scopes: MemoryScopeInfo[] = [];
  const seenWorkspace = new Set<string>();

  // Primary source: read real agent list from openclaw.json config
  let agentNameMap = new Map<string, string>();
  let agentWorkspaceMap = new Map<string, string>();
  try {
    const snapshot = await listAgentsSnapshot();
    for (const agent of snapshot.agents) {
      agentNameMap.set(agent.id, agent.name);
      try {
        const expandedWorkspace = expandPath(agent.workspace);
        agentWorkspaceMap.set(agent.id, expandedWorkspace);
      } catch {
        // ignore individual expansion errors
      }
    }
  } catch {
    // listAgentsSnapshot may fail if config is missing; fall through to filesystem scan
  }

  // Add scopes from agent workspace map (config-driven, with real names)
  for (const [agentId, workspaceDir] of agentWorkspaceMap) {
    if (!existsSync(workspaceDir)) continue;
    const resolvedPath = resolve(workspaceDir);
    if (seenWorkspace.has(resolvedPath)) continue;
    seenWorkspace.add(resolvedPath);
    const agentName = agentNameMap.get(agentId) ?? agentId;
    scopes.push({ id: agentId, label: agentName, agentName, workspaceDir });
  }

  // Fallback: scan ~/.openclaw/agents/*/workspace for any agents not already found
  const openclawHome = join(homedir(), '.openclaw');
  const agentsDir = join(openclawHome, 'agents');
  if (existsSync(agentsDir)) {
    try {
      const entries = await readdir(agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const scopeId = entry.name;
        const workspaceDir = join(agentsDir, scopeId, 'workspace');
        if (!existsSync(workspaceDir)) continue;
        const resolvedPath = resolve(workspaceDir);
        if (seenWorkspace.has(resolvedPath)) continue;
        seenWorkspace.add(resolvedPath);
        const agentName = agentNameMap.get(scopeId) ?? scopeId;
        scopes.push({ id: scopeId, label: agentName, agentName, workspaceDir });
      }
    } catch {
      // Ignore unreadable agent directories.
    }
  }

  const fallbackWorkspace = getWorkspaceDir();
  if (existsSync(fallbackWorkspace)) {
    const resolvedFallback = resolve(fallbackWorkspace);
    if (!seenWorkspace.has(resolvedFallback)) {
      const agentName = agentNameMap.get('main') ?? 'Main';
      scopes.push({ id: 'main', label: agentName, agentName, workspaceDir: fallbackWorkspace });
    }
  }

  if (scopes.length === 0) {
    const agentName = agentNameMap.get('main') ?? 'Main';
    scopes.push({ id: 'main', label: agentName, agentName, workspaceDir: fallbackWorkspace });
  }

  scopes.sort((a, b) => {
    if (a.id === 'main' && b.id !== 'main') return -1;
    if (b.id === 'main' && a.id !== 'main') return 1;
    return a.label.localeCompare(b.label);
  });

  return scopes;
}

function selectScope(scopes: MemoryScopeInfo[], requestedScope: string | null): MemoryScopeInfo {
  const requested = requestedScope?.trim();
  if (requested) {
    const match = scopes.find((scope) => scope.id === requested);
    if (match) return match;
  }
  return scopes[0] ?? { id: 'main', label: 'main', workspaceDir: getWorkspaceDir() };
}

// ── Daily log helpers ────────────────────────────────────────────

const DAILY_PATTERN = /^\d{4}-\d{2}-\d{2}\.md$/;

function isDaily(filename: string): boolean {
  return DAILY_PATTERN.test(filename);
}

function humanizeFilename(filename: string): string {
  const name = filename.replace(/\.(md|json)$/, '');
  return name.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function labelForFile(filename: string, fullPath: string, workspacePath: string): string {
  if (fullPath === join(workspacePath, 'MEMORY.md')) return 'Long-Term Memory';
  if (isDaily(filename)) {
    const dateStr = filename.replace('.md', '');
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dateStr === today) return 'Daily Log (Today)';
    if (dateStr === yesterday) return 'Daily Log (Yesterday)';
    return `Daily Log (${dateStr})`;
  }
  return humanizeFilename(filename);
}

// ── File listing ─────────────────────────────────────────────────

function categoryForRelativePath(relativePath: string): MemoryFileCategory {
  const file = basename(relativePath);
  if (isDaily(file)) return 'daily';
  if (/\.(md|json)$/i.test(file)) return 'evergreen';
  return 'other';
}

async function getMemoryFiles(scope: MemoryScopeInfo, config: MemoryConfig): Promise<MemoryFileInfo[]> {
  const files: MemoryFileInfo[] = [];
  const seen = new Set<string>();
  const workspacePath = scope.workspaceDir;
  const qmdRootPath = join(dirname(workspacePath), 'qmd');

  const addFile = async (
    fullPath: string,
    relativePath: string,
    writable: boolean,
    labelOverride?: string,
  ): Promise<void> => {
    const normalizedRelativePath = relativePath.replace(/[\\]+/g, '/');
    if (seen.has(normalizedRelativePath)) return;
    try {
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) return;
      const content = await readFile(fullPath, 'utf-8');
      files.push({
        label: labelOverride ?? labelForFile(basename(fullPath), fullPath, workspacePath),
        path: fullPath,
        relativePath: normalizedRelativePath,
        content,
        lastModified: fileStat.mtime.toISOString(),
        sizeBytes: fileStat.size,
        category: categoryForRelativePath(normalizedRelativePath),
        scopeId: scope.id,
        writable,
      });
      seen.add(normalizedRelativePath);
    } catch {
      // Skip unreadable file entries.
    }
  };

  const walkFiles = async (rootPath: string): Promise<string[]> => {
    try {
      const fileStat = await stat(rootPath);
      if (fileStat.isFile()) return [rootPath];
      if (!fileStat.isDirectory()) return [];
    } catch {
      return [];
    }

    const pending = [rootPath];
    const results: string[] = [];
    while (pending.length > 0) {
      const current = pending.pop()!;
      const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) {
          pending.push(fullPath);
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    }
    return results;
  };

  const matchesQmdPattern = (relativeFilePath: string, pattern: string): boolean => {
    const normalizedPattern = pattern.trim().replace(/[\\]+/g, '/').toLowerCase();
    const normalizedFilePath = relativeFilePath.replace(/[\\]+/g, '/').toLowerCase();
    if (!normalizedPattern || normalizedPattern === '**/*') return true;
    if (normalizedPattern.includes('{') && normalizedPattern.includes('}')) {
      const extGroup = normalizedPattern.match(/\{([^}]+)\}/)?.[1];
      if (extGroup) {
        const extensions = extGroup.split(',').map((item) => item.trim().replace(/^\./, ''));
        const ext = basename(normalizedFilePath).split('.').at(-1) ?? '';
        return extensions.includes(ext);
      }
    }
    if (normalizedPattern.startsWith('**/*.')) {
      return normalizedFilePath.endsWith(normalizedPattern.slice(4));
    }
    if (normalizedPattern.startsWith('*.')) {
      return basename(normalizedFilePath).endsWith(normalizedPattern.slice(1));
    }
    if (!normalizedPattern.includes('*')) {
      return basename(normalizedFilePath) === normalizedPattern || normalizedFilePath === normalizedPattern;
    }
    return normalizedFilePath.endsWith(normalizedPattern.replace(/^\*\*\//, '').replace(/^\*/, ''));
  };

  await addFile(join(workspacePath, 'MEMORY.md'), 'MEMORY.md', true, 'Long-Term Memory');
  for (const companion of COMPANION_FILES) {
    await addFile(join(workspacePath, companion), companion, true, humanizeFilename(companion));
  }

  const memoryDir = join(workspacePath, 'memory');
  if (existsSync(memoryDir)) {
    try {
      const entries = await readdir(memoryDir);
      for (const entry of entries) {
        if (!/\.(md|json)$/i.test(entry)) continue;
        await addFile(join(memoryDir, entry), `memory/${entry}`, true);
      }
    } catch {
      // Ignore unreadable memory directory.
    }
  }

  for (const rawExtraPath of config.memorySearch.extraPaths) {
    if (typeof rawExtraPath !== 'string') continue;
    const trimmed = rawExtraPath.trim();
    if (!trimmed) continue;

    let fullPath: string;
    let relativePath: string;
    let writable = false;
    const normalizedRelative = normalizeRelativePath(trimmed);
    if (normalizedRelative) {
      fullPath = resolve(workspacePath, normalizedRelative);
      relativePath = normalizedRelative;
      writable = true;
    } else if (isAbsolutePath(trimmed)) {
      fullPath = resolve(trimmed);
      relativePath = trimmed.replace(/[\\]+/g, '/');
      const workspaceRelative = toRelativeWorkspacePath(workspacePath, fullPath);
      if (workspaceRelative) {
        relativePath = workspaceRelative;
        writable = true;
      }
    } else {
      continue;
    }

    await addFile(fullPath, relativePath, writable, humanizeFilename(basename(relativePath)));
  }

  for (const collection of config.qmdCollections) {
    const collectionRoot = isAbsolutePath(collection.path)
      ? resolve(collection.path)
      : resolve(workspacePath, collection.path);
    const collectionFiles = await walkFiles(collectionRoot);
    for (const fullPath of collectionFiles) {
      const relativeInsideCollection = relative(collectionRoot, fullPath).replace(/[\\]+/g, '/');
      if (!relativeInsideCollection || relativeInsideCollection.startsWith('../')) continue;
      if (!matchesQmdPattern(relativeInsideCollection, collection.pattern)) continue;
      await addFile(
        fullPath,
        `qmd/${collection.name}/${relativeInsideCollection}`,
        false,
        `${collection.name}: ${humanizeFilename(basename(relativeInsideCollection))}`,
      );
    }
  }

  const qmdSessionsDir = join(qmdRootPath, 'sessions');
  if (existsSync(qmdSessionsDir)) {
    const qmdSessionFiles = await walkFiles(qmdSessionsDir);
    for (const fullPath of qmdSessionFiles) {
      const relativeInsideSessions = relative(qmdSessionsDir, fullPath).replace(/[\\]+/g, '/');
      if (!relativeInsideSessions || relativeInsideSessions.startsWith('../')) continue;
      await addFile(
        fullPath,
        `qmd/sessions/${relativeInsideSessions}`,
        false,
        `QMD Sessions: ${humanizeFilename(basename(relativeInsideSessions))}`,
      );
    }
  }

  files.sort((a, b) => {
    if (a.category !== b.category) {
      if (a.category === 'evergreen') return -1;
      if (b.category === 'evergreen') return 1;
    }
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });

  return files;
}

function collectSearchMetadata(content: string, query: string): MemoryFileSearch {
  const needle = query.trim().toLowerCase();
  if (!needle) return { hitCount: 0, highlights: [] };
  const haystack = content.toLowerCase();
  const highlights: MemoryFileHighlight[] = [];
  let hitCount = 0;
  let cursor = 0;

  while (cursor < haystack.length) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) break;
    hitCount += 1;
    if (highlights.length < 8) {
      const start = Math.max(0, index - 32);
      const end = Math.min(content.length, index + needle.length + 32);
      const snippet = content.slice(start, end).replace(/\s+/g, ' ');
      highlights.push({
        start: index,
        end: index + needle.length,
        snippet,
      });
    }
    cursor = index + needle.length;
  }

  return { hitCount, highlights };
}

function applySearchQuery(
  files: MemoryFileInfo[],
  query: string,
): { files: MemoryFileInfo[]; totalHits: number } {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { files, totalHits: 0 };
  }

  let totalHits = 0;
  const filtered = files
    .map((file) => {
      const search = collectSearchMetadata(file.content, normalizedQuery);
      totalHits += search.hitCount;
      return { ...file, search };
    })
    .filter((file) => (file.search?.hitCount ?? 0) > 0);

  return { files: filtered, totalHits };
}

// ── Config ───────────────────────────────────────────────────────

const SEARCH_DEFAULTS: MemoryConfig['memorySearch'] = {
  enabled: false,
  provider: null,
  model: null,
  hybrid: {
    enabled: true,
    vectorWeight: 0.7,
    textWeight: 0.3,
    temporalDecay: { enabled: true, halfLifeDays: 30 },
    mmr: { enabled: true, lambda: 0.7 },
  },
  cache: { enabled: true, maxEntries: 256 },
  extraPaths: [],
};

function normalizeQmdCollections(value: unknown): MemoryConfig['qmdCollections'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string' && entry.trim()) {
      return [{
        name: humanizeFilename(basename(entry.trim())),
        path: entry.trim(),
        pattern: '**/*.md',
      }];
    }
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const pathValue = typeof row.path === 'string' ? row.path.trim() : '';
    if (!pathValue) return [];
    const pattern = typeof row.pattern === 'string' && row.pattern.trim() ? row.pattern.trim() : '**/*.md';
    const name = typeof row.name === 'string' && row.name.trim()
      ? row.name.trim()
      : humanizeFilename(basename(pathValue));
    return [{ name, path: pathValue, pattern }];
  });
}

function getMemoryConfig(workspacePath: string): MemoryConfig {
  const configPath = join(dirname(workspacePath), 'openclaw.json');
  if (!existsSync(configPath)) {
    return { memorySearch: SEARCH_DEFAULTS, qmdCollections: [], memoryFlush: { enabled: false, softThresholdTokens: 80000 }, configFound: false };
  }
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    const ad = raw?.agents?.defaults ?? {};
    const ms = ad.memorySearch ?? {};
    const hybrid = ms.hybrid ?? {};
    const decay = hybrid.temporalDecay ?? {};
    const mmr = hybrid.mmr ?? {};
    const cache = ms.cache ?? {};
    const flush = ad.compaction?.memoryFlush ?? {};
    return {
      memorySearch: {
        enabled: ms.enabled ?? false,
        provider: ms.provider ?? null,
        model: ms.model ?? null,
        hybrid: {
          enabled: hybrid.enabled ?? true,
          vectorWeight: hybrid.vectorWeight ?? 0.7,
          textWeight: hybrid.textWeight ?? 0.3,
          temporalDecay: { enabled: decay.enabled ?? true, halfLifeDays: decay.halfLifeDays ?? 30 },
          mmr: { enabled: mmr.enabled ?? true, lambda: mmr.lambda ?? 0.7 },
        },
        cache: { enabled: cache.enabled ?? true, maxEntries: cache.maxEntries ?? 256 },
        extraPaths: ms.extraPaths ?? [],
      },
      qmdCollections: normalizeQmdCollections(raw?.memory?.qmd?.paths),
      memoryFlush: { enabled: flush.enabled ?? false, softThresholdTokens: flush.softThresholdTokens ?? 80000 },
      configFound: 'memorySearch' in ad,
    };
  } catch {
    return { memorySearch: SEARCH_DEFAULTS, qmdCollections: [], memoryFlush: { enabled: false, softThresholdTokens: 80000 }, configFound: false };
  }
}

// ── Status ───────────────────────────────────────────────────────

function getWhitelistedRelativePaths(config: MemoryConfig): Set<string> {
  const allowed = new Set<string>(['MEMORY.md']);
  for (const companion of COMPANION_FILES) {
    allowed.add(companion);
  }
  for (const extraPath of config.memorySearch.extraPaths) {
    if (typeof extraPath !== 'string') continue;
    const normalized = normalizeRelativePath(extraPath);
    if (normalized) {
      allowed.add(normalized);
    }
  }
  return allowed;
}

function isWritePathAllowed(relativePath: string, config: MemoryConfig): boolean {
  if (/^memory\/.+\.(md|json)$/i.test(relativePath)) {
    return true;
  }
  return getWhitelistedRelativePaths(config).has(relativePath);
}

function normalizeMemoryContent(rawContent: string): string {
  return rawContent.replace(/\r\n?/g, '\n');
}

async function writeFileAtomically(targetPath: string, content: string): Promise<void> {
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tempPath, content, 'utf-8');
  try {
    await rename(tempPath, targetPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

const OPENCLAW_MAX_BUFFER = 1024 * 1024;

function execOpenclaw(args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'openclaw',
      args,
      { timeout, encoding: 'utf-8', maxBuffer: OPENCLAW_MAX_BUFFER },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout ?? '');
      },
    );
  });
}

async function getMemoryStatus(): Promise<MemoryStatus> {
  const defaults: MemoryStatus = {
    indexed: false, lastIndexed: null, totalEntries: null,
    vectorAvailable: null, embeddingProvider: null, raw: 'Memory status unavailable',
  };
  try {
    const output = (await execOpenclaw(['memory', 'status', '--deep'], 8000)).trim();
    try {
      const data = JSON.parse(output);
      return {
        indexed: data.indexed ?? false,
        lastIndexed: data.lastIndexed ?? null,
        totalEntries: data.totalEntries ?? null,
        vectorAvailable: data.vectorAvailable ?? null,
        embeddingProvider: data.embeddingProvider ?? null,
        raw: output,
      };
    } catch {
      return { ...defaults, raw: output };
    }
  } catch {
    return defaults;
  }
}

// ── Stats ────────────────────────────────────────────────────────

function computeStats(files: MemoryFileInfo[]): MemoryStats {
  const daily = files.filter((f) => f.category === 'daily');
  const evergreen = files.filter((f) => f.category === 'evergreen');
  const dailyDates = daily
    .map((f) => { const m = basename(f.path).match(/^(\d{4}-\d{2}-\d{2})\.md$/); return m ? m[1] : null; })
    .filter((d): d is string => d !== null)
    .sort();
  const timeline: MemoryStats['dailyTimeline'] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const file = daily.find((f) => basename(f.path) === `${dateStr}.md`);
    timeline.push(file ? { date: dateStr, sizeBytes: file.sizeBytes } : null);
  }
  return {
    totalFiles: files.length,
    totalSizeBytes: files.reduce((s, f) => s + f.sizeBytes, 0),
    dailyLogCount: daily.length,
    evergreenCount: evergreen.length,
    oldestDaily: dailyDates[0] ?? null,
    newestDaily: dailyDates[dailyDates.length - 1] ?? null,
    dailyTimeline: timeline,
  };
}

// ── Health ───────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<HealthSeverity, number> = { critical: 0, warning: 1, info: 2, ok: 3 };
const SEVERITY_DEDUCTIONS: Record<Exclude<HealthSeverity, 'ok'>, number> = { critical: 20, warning: 10, info: 3 };

function computeStaleDailyLogs(files: MemoryFileInfo[], now = Date.now()): StaleDailyLogInfo[] {
  const results: StaleDailyLogInfo[] = [];
  for (const file of files) {
    if (file.category !== 'daily') continue;
    const filename = file.relativePath.split('/').pop() ?? '';
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (!match) continue;
    const ageDays = Math.floor((now - new Date(match[1] + 'T00:00:00Z').getTime()) / 86400000);
    if (ageDays < 30) continue;
    results.push({ relativePath: file.relativePath, label: file.label, date: match[1], ageDays, sizeBytes: file.sizeBytes });
  }
  return results.sort((a, b) => b.ageDays - a.ageDays);
}

function computeHealth(files: MemoryFileInfo[], config: MemoryConfig, status: MemoryStatus, stats: MemoryStats): MemoryHealthSummary {
  const checks: MemoryHealthCheck[] = [];
  const now = Date.now();

  // MEMORY.md line count
  const memMd = files.find((f) => f.relativePath === 'MEMORY.md');
  if (memMd) {
    const lines = memMd.content.split('\n').length;
    if (lines > 200) checks.push({ id: 'memory-md-lines', severity: 'critical', title: 'MEMORY.md exceeds 200 lines', description: `MEMORY.md has ${lines} lines. Lines after 200 are truncated in agent context.`, affectedFiles: ['MEMORY.md'], action: 'Split MEMORY.md into topic files and link from MEMORY.md.' });
    else if (lines > 150) checks.push({ id: 'memory-md-lines', severity: 'warning', title: 'MEMORY.md approaching 200 line limit', description: `MEMORY.md has ${lines} lines. Consider splitting less-critical sections.`, affectedFiles: ['MEMORY.md'], action: 'Move detailed sections into separate topic files.' });
  }

  // File sizes
  const critical100 = files.filter((f) => f.sizeBytes > 100 * 1024).map((f) => f.relativePath);
  const warn50 = files.filter((f) => f.sizeBytes > 50 * 1024 && f.sizeBytes <= 100 * 1024).map((f) => f.relativePath);
  if (critical100.length > 0) checks.push({ id: 'file-size', severity: 'critical', title: `${critical100.length} file(s) over 100KB`, description: 'Large memory files dilute retrieval quality.', affectedFiles: critical100, action: 'Split large files into smaller, focused topic files.' });
  else if (warn50.length > 0) checks.push({ id: 'file-size', severity: 'warning', title: `${warn50.length} file(s) over 50KB`, description: 'Files approaching the 100KB threshold.', affectedFiles: warn50, action: 'Review large files and split if they cover multiple distinct topics.' });

  // Stale daily logs
  const stale = computeStaleDailyLogs(files, now);
  if (stale.length > 0) {
    const over60 = stale.filter((s) => s.ageDays > 60);
    checks.push({ id: 'stale-daily-logs', severity: over60.length > 0 ? 'warning' : 'info', title: `${stale.length} stale daily log(s)`, description: `${over60.length} log(s) over 60 days old. Old logs add noise to search results.`, affectedFiles: stale.map((s) => s.relativePath), action: 'Review old daily logs: promote useful patterns to evergreen files, then delete stale logs.' });
  }

  // Total size
  if (stats.totalSizeBytes > 1024 * 1024) checks.push({ id: 'total-size', severity: 'critical', title: 'Total memory exceeds 1MB', description: `Total: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(1)}MB. Large stores degrade search quality.`, affectedFiles: null, action: 'Prune old daily logs and split or trim oversized files.' });
  else if (stats.totalSizeBytes > 500 * 1024) checks.push({ id: 'total-size', severity: 'warning', title: 'Total memory approaching 1MB', description: `Total: ${(stats.totalSizeBytes / 1024).toFixed(0)}KB.`, affectedFiles: null, action: 'Review and prune low-value content to stay under 500KB.' });

  // Vector search
  if (!config.memorySearch.enabled) checks.push({ id: 'vector-search-disabled', severity: 'warning', title: 'Vector search is disabled', description: 'Agents can only read MEMORY.md directly. Enable vector search for semantic search across all files.', affectedFiles: null, action: 'Enable memorySearch in openclaw.json and run "openclaw memory reindex".' });
  else if (!status.indexed) checks.push({ id: 'unindexed-vector', severity: 'critical', title: 'Vector search enabled but not indexed', description: 'Memory search is enabled but no index exists.', affectedFiles: null, action: 'Run "openclaw memory reindex" to build the search index.' });
  else if (status.lastIndexed) {
    const lastMs = new Date(status.lastIndexed).getTime();
    const modifiedAfter = files.filter((f) => new Date(f.lastModified).getTime() > lastMs);
    const hoursSince = (now - lastMs) / 3600000;
    if (modifiedAfter.length > 0 && hoursSince >= 1) checks.push({ id: 'stale-index', severity: 'warning', title: 'Search index is stale', description: `${modifiedAfter.length} file(s) modified after last index (${Math.floor(hoursSince)}h ago).`, affectedFiles: modifiedAfter.map((f) => f.relativePath), action: 'Reindex memory so agents see your latest changes.' });
  }

  // Stale evergreen
  const ninetyDaysAgo = now - 90 * 86400000;
  const staleEvergreen = files.filter((f) => f.category === 'evergreen' && new Date(f.lastModified).getTime() < ninetyDaysAgo);
  if (staleEvergreen.length > 0) checks.push({ id: 'stale-evergreen', severity: 'info', title: `${staleEvergreen.length} evergreen file(s) not updated in 90+ days`, description: 'Evergreen files may contain outdated facts.', affectedFiles: staleEvergreen.map((f) => f.relativePath), action: 'Review evergreen files for outdated information.' });

  // Config
  if (!config.configFound) checks.push({ id: 'no-config', severity: 'info', title: 'No explicit memory configuration', description: 'Using OpenClaw defaults. Add memorySearch config in openclaw.json to tune search behavior.', affectedFiles: null, action: 'Add a memorySearch section to openclaw.json.' });
  if (config.memorySearch.enabled && !config.memorySearch.hybrid.temporalDecay.enabled) checks.push({ id: 'decay-disabled', severity: 'info', title: 'Temporal decay is disabled', description: 'Without temporal decay, old daily logs rank equally with recent ones.', affectedFiles: null, action: 'Enable temporalDecay in openclaw.json.' });

  checks.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  let score = 100;
  for (const c of checks) {
    if (c.severity !== 'ok') score -= SEVERITY_DEDUCTIONS[c.severity];
  }
  score = Math.max(0, Math.min(100, score));

  return { score, checks, staleDailyLogs: stale };
}

// ── HTTP helpers ─────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ── Route handler ────────────────────────────────────────────────

export async function handleMemoryRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  // GET /api/memory — full dashboard response
  if (url.pathname === '/api/memory' && req.method === 'GET') {
    const scopes = await getMemoryScopes();
    const activeScope = selectScope(scopes, url.searchParams.get('scope'));
    const query = (url.searchParams.get('q') ?? '').trim();
    const config = getMemoryConfig(activeScope.workspaceDir);
    const allFiles = await getMemoryFiles(activeScope, config);
    const searchResult = applySearchQuery(allFiles, query);
    const status = await getMemoryStatus();
    const stats = computeStats(allFiles);
    const health = computeHealth(allFiles, config, status, stats);
    sendJson(res, 200, {
      files: searchResult.files,
      config,
      status,
      stats,
      health,
      workspaceDir: activeScope.workspaceDir,
      scopes,
      activeScope: activeScope.id,
      search: {
        query,
        totalHits: searchResult.totalHits,
        resultCount: searchResult.files.length,
        totalFiles: allFiles.length,
      },
    });
    return true;
  }

  // GET /api/memory/file?name=FILENAME — read single file
  if (url.pathname === '/api/memory/file' && req.method === 'GET') {
    const name = url.searchParams.get('name');
    const scopes = await getMemoryScopes();
    const activeScope = selectScope(scopes, url.searchParams.get('scope'));
    const workspaceDir = activeScope.workspaceDir;
    const fullPath = name ? resolveWorkspaceFilePath(workspaceDir, name) : null;
    if (!name || !fullPath) {
      sendJson(res, 400, { error: 'Invalid file name' });
      return true;
    }
    // Support both root files and memory/ subdirectory
    try {
      const content = await readFile(fullPath, 'utf-8');
      sendJson(res, 200, { name, content });
    } catch {
      sendJson(res, 404, { error: 'File not found' });
    }
    return true;
  }

  // PUT /api/memory/file — write file content
  if (url.pathname === '/api/memory/file' && req.method === 'PUT') {
    let body: {
      relativePath?: string;
      name?: string;
      content?: string;
      expectedMtime?: string;
      scope?: string;
    };
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    const relPath = body.relativePath ?? body.name;
    const normalizedRelPath = typeof relPath === 'string' ? normalizeRelativePath(relPath) : null;
    const { content } = body;
    if (!relPath || typeof relPath !== 'string' || typeof content !== 'string') {
      sendJson(res, 400, { error: 'Invalid request' });
      return true;
    }
    const scopes = await getMemoryScopes();
    const activeScope = selectScope(scopes, body.scope ?? url.searchParams.get('scope'));
    const config = getMemoryConfig(activeScope.workspaceDir);
    if (!normalizedRelPath) {
      sendJson(res, 400, { error: 'Invalid request' });
      return true;
    }
    if (!isWritePathAllowed(normalizedRelPath, config)) {
      sendJson(res, 400, { error: 'Path is not allowed for writes' });
      return true;
    }
    const fullPath = resolveWorkspaceFilePath(activeScope.workspaceDir, normalizedRelPath);
    if (!fullPath) {
      sendJson(res, 400, { error: 'Invalid request' });
      return true;
    }
    try {
      const expectedMtime = typeof body.expectedMtime === 'string' ? body.expectedMtime.trim() : '';
      if (expectedMtime) {
        const expectedMs = new Date(expectedMtime).getTime();
        if (!Number.isFinite(expectedMs)) {
          sendJson(res, 400, { error: 'Invalid expectedMtime' });
          return true;
        }
        try {
          const currentStat = await stat(fullPath);
          if (Math.abs(currentStat.mtime.getTime() - expectedMs) > 1) {
            sendJson(res, 409, {
              error: 'Stale write conflict: file has changed',
              currentMtime: currentStat.mtime.toISOString(),
            });
            return true;
          }
        } catch (error) {
          if ((error as { code?: string }).code === 'ENOENT') {
            sendJson(res, 409, {
              error: 'Stale write conflict: file no longer exists',
              currentMtime: null,
            });
            return true;
          }
          throw error;
        }
      }
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFileAtomically(fullPath, normalizeMemoryContent(content));
      const updated = await stat(fullPath);
      sendJson(res, 200, { ok: true, lastModified: updated.mtime.toISOString() });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // POST /api/memory/extract — heuristic or LLM extraction from conversation
  if (url.pathname === '/api/memory/extract' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        messages?: Array<{ role: string; content: unknown }>;
        sessionKey?: string;
        label?: string;
        scope?: string;
        agentId?: string;
        useLlm?: boolean;
      }>(req);

      const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
      const sessionKey = typeof body?.sessionKey === 'string' ? body.sessionKey.trim() : '';
      const label = typeof body?.label === 'string' ? body.label.trim() : '';
      const scopeHint = (typeof body?.scope === 'string' ? body.scope.trim() : '')
        || (typeof body?.agentId === 'string' ? body.agentId.trim() : '');
      const useLlm = body?.useLlm === true;

      const extendedBody = body as typeof body & {
        guardLevel?: string;
        judge?: {
          enabled?: boolean;
          endpoint?: string;
          model?: string;
          apiKey?: string;
          timeoutMs?: number;
        };
      };
      const guardLevelRaw = typeof extendedBody.guardLevel === 'string' ? extendedBody.guardLevel.trim().toLowerCase() : '';
      const guardLevel: MemoryGuardLevel = (guardLevelRaw === 'strict' || guardLevelRaw === 'standard' || guardLevelRaw === 'relaxed')
        ? guardLevelRaw
        : 'standard';

      // Resolve scope (workspace) first
      const scopes = await getMemoryScopes();
      const activeScope = selectScope(scopes, scopeHint || url.searchParams.get('scope'));
      const workspacePath = activeScope.workspaceDir;

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const title = label || sessionKey || 'Conversation';

      let extractedItems: string[] = [];
      let usedLlm = false;

      // ── LLM path ──────────────────────────────────────────────
      if (useLlm) {
        try {
          // Look up the default provider account and its API key
          const defaultAccountId = await getDefaultProviderAccountId();
          const account = defaultAccountId ? await getProviderAccount(defaultAccountId) : null;
          const apiKey = defaultAccountId ? (await getApiKey(defaultAccountId)) ?? '' : '';

          if (account && apiKey) {
            // Determine provider base URL and protocol
            const providerDef = account.vendorId;
            const protocol: LlmProviderConfig['protocol'] = (account.apiProtocol === 'anthropic-messages' || providerDef === 'anthropic')
              ? 'anthropic-messages'
              : 'openai-completions';

            let endpoint = account.baseUrl ?? '';
            if (!endpoint) {
              if (providerDef === 'deepseek') endpoint = 'https://api.deepseek.com/v1';
              else if (providerDef === 'openai') endpoint = 'https://api.openai.com/v1';
              else if (providerDef === 'anthropic') endpoint = 'https://api.anthropic.com';
              else endpoint = 'https://api.openai.com/v1';
            }
            const model = account.model ?? 'gpt-4o-mini';

            const llmResult = await extractMemoryWithLlm(rawMessages, { endpoint, model, apiKey, protocol });
            if (llmResult.items.length > 0) {
              extractedItems = llmResult.items;
              usedLlm = true;
            }
          }
        } catch {
          // LLM failed — fall through to rule-based extraction below
        }
      }

      // ── Rule-based path (fallback or default) ─────────────────
      if (extractedItems.length === 0) {
        const judgeInput = extendedBody.judge;
        const extractedResult = await extractMemoryFromMessages(rawMessages, {
          guardLevel,
          judge: {
            enabled: Boolean(judgeInput?.enabled),
            endpoint: typeof judgeInput?.endpoint === 'string' ? judgeInput.endpoint : undefined,
            model: typeof judgeInput?.model === 'string' ? judgeInput.model : undefined,
            apiKey: typeof judgeInput?.apiKey === 'string' ? judgeInput.apiKey : undefined,
            timeoutMs: typeof judgeInput?.timeoutMs === 'number' ? judgeInput.timeoutMs : undefined,
          },
        });

        if (extractedResult.candidates.length === 0) {
          sendJson(res, 200, {
            ok: true,
            skipped: true,
            reason: useLlm ? 'llm_no_memories_found' : 'no_durable_memory_candidates',
          });
          return true;
        }
        extractedItems = extractedResult.candidates.slice(0, 6).map((c) => {
          const prefix = c.action === 'delete' ? '[DELETE] ' : '';
          return `${prefix}${c.text}`;
        });
      }

      // ── Write to daily log ────────────────────────────────────
      const lines: string[] = [`## ${dateStr} ${timeStr} | ${title}`, ''];
      for (const item of extractedItems) {
        lines.push(`- ${item}`);
      }
      lines.push('');
      const extracted = lines.join('\n');

      const memDir = join(workspacePath, 'memory');
      await mkdir(memDir, { recursive: true });
      const targetPath = join(memDir, `${dateStr}.md`);

      let existing = '';
      try { existing = await readFile(targetPath, 'utf-8'); } catch { /* new file */ }
      if (!existing.startsWith('# ')) {
        existing = `# Memory Extract - ${dateStr}\n\n${existing}`;
      }
      await writeFile(targetPath, `${existing}${extracted}`, 'utf-8');

      sendJson(res, 200, {
        ok: true,
        extracted,
        filePath: targetPath,
        scopeId: activeScope.id,
        candidateCount: extractedItems.length,
        usedLlm,
      });


    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // POST /api/memory/reindex — trigger reindex
  if (url.pathname === '/api/memory/reindex' && req.method === 'POST') {
    try {
      await execOpenclaw(['memory', 'reindex'], 30000);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // POST /api/memory/snapshot — git commit all memory files
  if (url.pathname === '/api/memory/snapshot' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ scope?: string }>(req);
      const scopes = await getMemoryScopes();
      const activeScope = selectScope(scopes, body?.scope ?? null);
      const workspaceDir = activeScope.workspaceDir;

      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const commitMsg = `memory snapshot ${timestamp}`;

      const addResult = spawnSync('git', ['add', '-A'], { cwd: workspaceDir, encoding: 'utf-8', timeout: 15000 });
      if (addResult.status !== 0) {
        const errText = (addResult.stderr ?? '').trim() || 'git add failed';
        sendJson(res, 500, { success: false, message: errText });
        return true;
      }

      const commitResult = spawnSync('git', ['commit', '-m', commitMsg], { cwd: workspaceDir, encoding: 'utf-8', timeout: 15000 });
      if (commitResult.status !== 0) {
        const stderr = (commitResult.stderr ?? '').trim();
        const stdout = (commitResult.stdout ?? '').trim();
        // "nothing to commit" is not an error
        if (stdout.includes('nothing to commit') || stderr.includes('nothing to commit')) {
          sendJson(res, 200, { success: true, message: 'Nothing to commit', commitHash: null });
          return true;
        }
        sendJson(res, 500, { success: false, message: stderr || stdout || 'git commit failed' });
        return true;
      }

      const logResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: workspaceDir, encoding: 'utf-8', timeout: 5000 });
      const commitHash = (logResult.stdout ?? '').trim() || null;
      sendJson(res, 200, { success: true, commitHash, message: commitMsg });
    } catch (err) {
      sendJson(res, 500, { success: false, message: String(err) });
    }
    return true;
  }

  // POST /api/memory/analyze — heuristic analysis of memory files
  if (url.pathname === '/api/memory/analyze' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ scope?: string }>(req);
      const scopes = await getMemoryScopes();
      const activeScope = selectScope(scopes, body?.scope ?? null);
      const config = getMemoryConfig(activeScope.workspaceDir);
      const files = await getMemoryFiles(activeScope, config);

      const now = Date.now();
      const sevenDaysAgo = now - 7 * 86400000;
      const tenKB = 10 * 1024;

      const staleFiles: string[] = [];
      const largeFiles: string[] = [];
      const emptyFiles: string[] = [];

      for (const f of files) {
        if (new Date(f.lastModified).getTime() < sevenDaysAgo) staleFiles.push(f.relativePath);
        if (f.sizeBytes > tenKB) largeFiles.push(f.relativePath);
        if (f.sizeBytes === 0 || f.content.trim() === '') emptyFiles.push(f.relativePath);
      }

      const recommendations: string[] = [];
      if (emptyFiles.length > 0) recommendations.push(`Remove or populate ${emptyFiles.length} empty file(s).`);
      if (largeFiles.length > 0) recommendations.push(`Split ${largeFiles.length} large file(s) (>10KB) into focused topic files.`);
      if (staleFiles.length > 0) recommendations.push(`Review ${staleFiles.length} stale file(s) not modified in 7+ days.`);
      if (files.length === 0) recommendations.push('No memory files found. Create MEMORY.md to get started.');
      if (recommendations.length === 0) recommendations.push('Memory files look healthy.');

      const deductions = emptyFiles.length * 5 + largeFiles.length * 10 + Math.min(staleFiles.length * 3, 30);
      const healthScore = Math.max(0, Math.min(100, 100 - deductions));

      const lastModifiedMs = files.reduce((max, f) => Math.max(max, new Date(f.lastModified).getTime()), 0);
      const lastModified = lastModifiedMs > 0 ? new Date(lastModifiedMs).toISOString() : null;

      sendJson(res, 200, {
        healthScore,
        staleFiles,
        largeFiles,
        emptyFiles,
        recommendations,
        totalFiles: files.length,
        lastModified,
      });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  return false;
}
