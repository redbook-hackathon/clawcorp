import { hostApiFetch } from '@/lib/host-api';

type MemoryFileCategory = 'evergreen' | 'daily' | 'other';

export interface MemoryFileHighlight {
  start: number;
  end: number;
  snippet: string;
}

export interface MemoryFileSearch {
  hitCount: number;
  highlights: MemoryFileHighlight[];
}

export interface MemoryClientFile {
  name: string;
  label?: string;
  path: string;
  relativePath: string;
  size: number;
  sizeBytes?: number;
  mtime: number;
  lastModified?: string;
  content?: string;
  category?: MemoryFileCategory;
  writable?: boolean;
  search?: MemoryFileSearch;
}

export interface MemoryScopeInfo {
  id: string;
  label: string;
  agentName?: string;
  workspaceDir: string;
}

export interface MemorySearchSummary {
  query: string;
  totalHits: number;
  resultCount?: number;
  totalFiles?: number;
}

export interface MemoryOverviewStats {
  totalFiles?: number;
  totalSizeBytes?: number;
}

export interface MemoryOverviewResponse {
  files: Array<Partial<MemoryClientFile>>;
  workspaceDir?: string;
  activeScope?: string;
  scopes?: MemoryScopeInfo[];
  search?: MemorySearchSummary;
  stats?: MemoryOverviewStats;
  [key: string]: unknown;
}

export interface MemoryFileResponse {
  content: string;
  [key: string]: unknown;
}

export interface SaveMemoryFileInput {
  relativePath: string;
  content: string;
  expectedMtime?: string;
  scope?: string;
}

function buildMemoryOverviewPath(params?: { scope?: string; query?: string }): string {
  const searchParams = new URLSearchParams();

  if (params?.scope) {
    searchParams.set('scope', params.scope);
  }

  if (params?.query?.trim()) {
    searchParams.set('q', params.query.trim());
  }

  return searchParams.size > 0 ? `/api/memory?${searchParams.toString()}` : '/api/memory';
}

function toIsoString(timestamp: number): string {
  if (timestamp > 0) {
    return new Date(timestamp).toISOString();
  }

  return new Date(0).toISOString();
}

export function normalizeMemoryFile(file: Partial<MemoryClientFile>): MemoryClientFile {
  const relativePath = file.relativePath ?? file.path ?? file.name ?? file.label ?? '';
  const path = file.path ?? relativePath;
  const name = file.name ?? file.label ?? relativePath.split('/').pop() ?? relativePath;
  const size = typeof file.size === 'number' ? file.size : typeof file.sizeBytes === 'number' ? file.sizeBytes : 0;
  const mtime = typeof file.mtime === 'number'
    ? file.mtime
    : typeof file.lastModified === 'string'
      ? new Date(file.lastModified).getTime()
      : 0;

  return {
    ...file,
    name,
    label: file.label ?? name,
    path,
    relativePath,
    size,
    sizeBytes: typeof file.sizeBytes === 'number' ? file.sizeBytes : size,
    mtime,
    lastModified: file.lastModified ?? toIsoString(mtime),
  };
}

export function normalizeMemoryFiles(response: Pick<MemoryOverviewResponse, 'files'>): MemoryClientFile[] {
  return response.files.map((file) => normalizeMemoryFile(file));
}

export async function getMemoryOverview(params?: { scope?: string; query?: string }) {
  return hostApiFetch<MemoryOverviewResponse>(buildMemoryOverviewPath(params));
}

export async function getMemoryFile(path: string) {
  return hostApiFetch<MemoryFileResponse>(`/api/memory/file?name=${encodeURIComponent(path)}`);
}

export async function saveMemoryFile(payload: SaveMemoryFileInput) {
  return hostApiFetch<{ ok?: boolean; success?: boolean }>('/api/memory/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function reindexMemory() {
  return hostApiFetch<{ ok: boolean }>('/api/memory/reindex', { method: 'POST' });
}
