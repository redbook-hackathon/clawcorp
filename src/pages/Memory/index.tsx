import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, BookOpen, Code, Eye, FolderOpen, GitCommit, Info, Plus, RefreshCw, RotateCw, Save, Trash2, X, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { getMemoryOverview, reindexMemory, saveMemoryFile } from '@/lib/memory-client';

type MemoryFileCategory = 'evergreen' | 'daily' | 'other';
type HealthSeverity = 'critical' | 'warning' | 'info' | 'ok';
type Tab = 'overview' | 'browser' | 'guide' | 'extras';
type FileTab = 'config' | 'logs';

interface SnapshotResult {
  success: boolean;
  commitHash: string | null;
  message: string;
}

interface AnalysisResult {
  healthScore: number;
  staleFiles: string[];
  largeFiles: string[];
  emptyFiles: string[];
  recommendations: string[];
  totalFiles: number;
  lastModified: string | null;
}

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
  writable?: boolean;
  search?: MemoryFileSearch;
}

interface MemoryScopeInfo {
  id: string;
  label: string;
  agentName?: string;
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

interface MemorySearchSummary {
  query: string;
  totalHits: number;
  resultCount?: number;
  totalFiles?: number;
}

interface MemoryApiResponse {
  files: MemoryFileInfo[];
  config: MemoryConfig;
  status: MemoryStatus;
  stats: MemoryStats;
  health: MemoryHealthSummary;
  workspaceDir: string;
  scopes?: MemoryScopeInfo[];
  activeScope?: string;
  search?: MemorySearchSummary;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

function useRelativeTime() {
  const { t } = useTranslation('common');
  return useCallback((iso: string): string => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return t('time.justNow');
    if (diff < 3600) return t('time.minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) });
    return t('time.daysAgo', { count: Math.floor(diff / 86400) });
  }, [t]);
}

const SEVERITY_COLOR: Record<HealthSeverity, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#007aff',
  ok: '#10b981',
};

const CATEGORY_COLOR: Record<MemoryFileCategory, string> = {
  evergreen: '#10b981',
  daily: '#007aff',
  other: '#8e8e93',
};

function HealthCheckItem({ check }: { check: MemoryHealthCheck }) {
  const Icon = check.severity === 'critical' ? AlertCircle : check.severity === 'warning' ? AlertTriangle : Info;
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SEVERITY_COLOR[check.severity] }} />
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[#000000]">{check.title}</div>
          <p className="text-[12px] leading-5 text-[#3c3c43]">{check.description}</p>
          {check.action && <p className="mt-1 text-[11px] text-clawx-ac">→ {check.action}</p>}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  data,
  onReindex,
  reindexing,
  onSnapshot,
  snapshotting,
  snapshotResult,
  onAnalyze,
  analyzing,
  analysisResult,
  scopeId: _scopeId,
}: {
  data: MemoryApiResponse;
  onReindex: () => void;
  reindexing: boolean;
  onSnapshot: () => void;
  snapshotting: boolean;
  snapshotResult: SnapshotResult | null;
  onAnalyze: () => void;
  analyzing: boolean;
  analysisResult: AnalysisResult | null;
  scopeId: string;
}) {
  const { t } = useTranslation('common');
  const relativeTime = useRelativeTime();
  void _scopeId;
  const { stats, status, health } = data;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
        <div className="text-[16px] font-semibold text-[#000000]">{t('memory.healthScore')}: {health.score}</div>
        <div className="mt-2 text-[12px] text-[#8e8e93]">
          {t('memory.files')}: {stats.totalFiles} · {t('memory.fileSize')}: {formatBytes(stats.totalSizeBytes)} · {t('memory.index')}: {status.indexed ? t('memory.indexed') : t('memory.notIndexed')}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReindex}
            disabled={reindexing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-clawx-ac px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <RotateCw className={cn('h-3 w-3', reindexing && 'animate-spin')} />
            {reindexing ? t('memory.reindexing') : t('memory.reindex')}
          </button>
          <button
            type="button"
            onClick={onSnapshot}
            disabled={snapshotting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3c3c43] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-80 disabled:opacity-50"
          >
            <GitCommit className={cn('h-3 w-3', snapshotting && 'animate-spin')} />
            {snapshotting ? t('memory.snapshotting') : t('memory.gitSnapshot')}
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea] disabled:opacity-50"
          >
            <Zap className={cn('h-3 w-3', analyzing && 'animate-spin')} />
            {analyzing ? t('memory.analyzing') : t('memory.aiAnalysis')}
          </button>
        </div>
        {snapshotResult && (
          <div className={cn('mt-3 rounded-lg px-3 py-2 text-[12px]', snapshotResult.success ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ef4444]/10 text-[#ef4444]')}>
            {snapshotResult.success
              ? `${t('memory.snapshotSuccess')}${snapshotResult.commitHash ? ` · ${snapshotResult.commitHash}` : ''} · ${snapshotResult.message}`
              : `${t('memory.snapshotFailed')}: ${snapshotResult.message}`}
          </div>
        )}
      </div>

      {analysisResult && (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-semibold text-[#000000]">{t('memory.analysisResult')}</div>
            <div className={cn('text-[13px] font-bold', analysisResult.healthScore >= 80 ? 'text-[#10b981]' : analysisResult.healthScore >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]')}>
              {t('memory.healthDegree')} {analysisResult.healthScore}
            </div>
          </div>
          <div className="text-[12px] text-[#8e8e93]">
            {t('memory.totalFiles', { count: analysisResult.totalFiles })}
            {analysisResult.lastModified ? ` · ${t('time.lastModified')}: ${relativeTime(analysisResult.lastModified)}` : ''}
          </div>
          {analysisResult.emptyFiles.length > 0 && (
            <div className="rounded-lg bg-[#ef4444]/5 px-3 py-2">
              <div className="text-[12px] font-medium text-[#ef4444]">{t('memory.emptyFiles')} ({analysisResult.emptyFiles.length})</div>
              {analysisResult.emptyFiles.map((f) => <div key={f} className="text-[11px] text-[#8e8e93]">{f}</div>)}
            </div>
          )}
          {analysisResult.largeFiles.length > 0 && (
            <div className="rounded-lg bg-[#f59e0b]/5 px-3 py-2">
              <div className="text-[12px] font-medium text-[#f59e0b]">{t('memory.largeFiles')} ({analysisResult.largeFiles.length})</div>
              {analysisResult.largeFiles.map((f) => <div key={f} className="text-[11px] text-[#8e8e93]">{f}</div>)}
            </div>
          )}
          {analysisResult.staleFiles.length > 0 && (
            <div className="rounded-lg bg-[#007aff]/5 px-3 py-2">
              <div className="text-[12px] font-medium text-[#007aff]">{t('memory.staleFiles')} ({analysisResult.staleFiles.length})</div>
              {analysisResult.staleFiles.slice(0, 5).map((f) => <div key={f} className="text-[11px] text-[#8e8e93]">{f}</div>)}
              {analysisResult.staleFiles.length > 5 && <div className="text-[11px] text-[#8e8e93]">{t('memory.moreFiles', { count: analysisResult.staleFiles.length - 5 })}</div>}
            </div>
          )}
          <div className="space-y-1">
            {analysisResult.recommendations.map((r, i) => (
              <div key={i} className="text-[12px] text-[#3c3c43]">→ {r}</div>
            ))}
          </div>
        </div>
      )}

      {health.checks.length > 0 ? (
        <div className="space-y-2">
          {health.checks.map((check) => (
            <HealthCheckItem key={`${check.id}-${check.title}`} check={check} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-6 text-center text-[13px] text-[#10b981]">
          {t('memory.allChecksPassed')}
        </div>
      )}
    </div>
  );
}

function MarkdownViewer({ content, highlights }: { content: string; highlights?: MemoryFileHighlight[] }) {
  void highlights; // future: overlay highlight spans
  if (!content.trim()) {
    return <span className="text-[#8e8e93] text-[12px]">（空文件）</span>;
  }
  return (
    <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-[#000000]
      [&_h1]:text-[17px] [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
      [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5
      [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
      [&_p]:my-1.5 [&_p]:leading-relaxed
      [&_ul]:my-1.5 [&_ul]:pl-5 [&_li]:my-0.5
      [&_ol]:my-1.5 [&_ol]:pl-5
      [&_code]:bg-[#f2f2f7] [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:font-mono
      [&_pre]:bg-[#f2f2f7] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto
      [&_pre_code]:bg-transparent [&_pre_code]:p-0
      [&_blockquote]:border-l-2 [&_blockquote]:border-[#007aff] [&_blockquote]:pl-3 [&_blockquote]:text-[#3c3c43]
      [&_hr]:border-[#e5e5ea]
      [&_table]:text-[12px] [&_table]:border-collapse
      [&_th]:border [&_th]:border-[#c6c6c8] [&_th]:px-2 [&_th]:py-1 [&_th]:bg-[#f2f2f7]
      [&_td]:border [&_td]:border-[#c6c6c8] [&_td]:px-2 [&_td]:py-1
      [&_a]:text-[#007aff] [&_a]:underline
      [&_strong]:font-semibold
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function BrowserTab({
  files,
  scopes,
  activeScope,
  searchQuery,
  searchSummary,
  onScopeChange,
  onSearchQueryChange,
  onSave,
  onRefresh,
}: {
  files: MemoryFileInfo[];
  scopes: MemoryScopeInfo[];
  activeScope: string;
  searchQuery: string;
  searchSummary?: MemorySearchSummary;
  onScopeChange: (scope: string) => void;
  onSearchQueryChange: (query: string) => void;
  onSave: (relativePath: string, content: string, expectedMtime?: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('common');
  const relativeTime = useRelativeTime();
  const [fileTab, setFileTab] = useState<FileTab>('config');
  const [selected, setSelected] = useState<MemoryFileInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [rawView, setRawView] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Config files: evergreen category (MEMORY.md, SOUL.md, AGENTS.md, etc.)
  const configFiles = useMemo(() => {
    return files
      .filter((f) => f.category === 'evergreen' || (f.category === 'other' && f.writable === false))
      .sort((a, b) => {
        // MEMORY.md always first
        if (a.relativePath === 'MEMORY.md') return -1;
        if (b.relativePath === 'MEMORY.md') return 1;
        return a.label.localeCompare(b.label);
      });
  }, [files]);

  // Memory logs: daily category (YYYY-MM-DD.md)
  const logFiles = useMemo(() => {
    return files
      .filter((f) => f.category === 'daily')
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  }, [files]);

  const visibleFiles = fileTab === 'config' ? configFiles : logFiles;

  useEffect(() => {
    if (!selected) return;
    const latest = files.find((file) => file.relativePath === selected.relativePath);
    if (!latest) {
      setSelected(null);
      setEditing(false);
      setDraft('');
      return;
    }
    setSelected(latest);
    if (!editing) {
      setDraft(latest.content);
    }
  }, [files, selected, editing]);

  const handleSelect = (file: MemoryFileInfo) => {
    setSelected(file);
    setEditing(false);
    setRawView(false);
    setDraft(file.content);
    setSaveError(null);
  };

  const handleFileTabChange = (tab: FileTab) => {
    setFileTab(tab);
    setSelected(null);
    setEditing(false);
    setRawView(false);
    setDraft('');
    setSaveError(null);
  };

  const handleEdit = () => {
    setEditing(true);
    setDraft(selected?.content ?? '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCancel = () => {
    setEditing(false);
    setRawView(false);
    setDraft(selected?.content ?? '');
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(selected.relativePath, draft, selected.lastModified);
      setEditing(false);
      onRefresh();
    } catch (error) {
      setSaveError(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!selected || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(editing ? draft : selected.content);
  };

  const handleDownload = () => {
    if (!selected) return;
    const blob = new Blob([editing ? draft : selected.content], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = selected.relativePath.split('/').pop() || 'memory.txt';
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const hasUnsavedChanges = editing && selected !== null && draft !== selected.content;

  const isMarkdownFile = selected ? /\.md$/i.test(selected.relativePath) : false;

  return (
    <div className="flex h-full min-h-0 gap-3" style={{ height: 'calc(100vh - 200px)' }}>
      <div className="flex w-[220px] shrink-0 flex-col gap-2">
        <select
          aria-label="Agent Scope"
          value={activeScope}
          onChange={(event) => onScopeChange(event.target.value)}
          className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] outline-none focus:border-clawx-ac"
        >
          {scopes.map((scope) => (
            <option key={scope.id} value={scope.id}>
              {scope.agentName ?? scope.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Search Memory"
          placeholder={t('memory.searchPlaceholder')}
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] outline-none focus:border-clawx-ac"
        />
        {searchSummary?.query && <div className="text-[11px] text-[#8e8e93]">{searchSummary.totalHits} hits</div>}

        {/* Sub-tabs: 配置文件 / 记忆日志 */}
        <div className="flex rounded-lg bg-[#f2f2f7] p-0.5">
          {([['config', '配置文件'], ['logs', '记忆日志']] as [FileTab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleFileTabChange(key)}
              className={cn(
                'flex-1 rounded-md py-1.5 text-[11px] font-medium transition-all',
                fileTab === key
                  ? 'bg-white text-[#000000] shadow-sm'
                  : 'text-[#8e8e93] hover:text-[#3c3c43]',
              )}
            >
              {label}
              <span className={cn(
                'ml-1 text-[10px]',
                fileTab === key ? 'text-clawx-ac' : 'text-[#c6c6c8]',
              )}>
                {key === 'config' ? configFiles.length : logFiles.length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {visibleFiles.length === 0 && (
            <div className="py-8 text-center text-[12px] text-[#8e8e93]">
              {fileTab === 'config' ? '暂无配置文件' : '暂无记忆日志'}
            </div>
          )}
          {visibleFiles.map((file) => (
            <button
              key={file.relativePath}
              type="button"
              onClick={() => handleSelect(file)}
              className={cn(
                'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
                selected?.relativePath === file.relativePath ? 'bg-clawx-ac text-white' : 'bg-white hover:bg-[#f2f2f7]',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[13px]"
                  style={{ color: selected?.relativePath === file.relativePath ? 'white' : CATEGORY_COLOR[file.category] }}
                >
                  ●
                </span>
                <span className="flex-1 truncate text-[12px] font-medium">{file.label}</span>
              </div>
              <div
                className={cn(
                  'mt-0.5 flex items-center justify-between text-[10px]',
                  selected?.relativePath === file.relativePath ? 'text-white/70' : 'text-[#8e8e93]',
                )}
              >
                <span>{formatBytes(file.sizeBytes)}</span>
                <span>{(file.search?.hitCount ?? 0) > 0 ? `${file.search?.hitCount} hits` : relativeTime(file.lastModified)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-w-0 flex-col rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#8e8e93]">
            <FolderOpen className="h-10 w-10 opacity-30" />
            <span className="text-[13px]">{t('memory.selectFile')}</span>
          </div>
        ) : (
          <>
            {hasUnsavedChanges && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">Unsaved changes</div>
            )}
            {saveError && (
              <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-700">{saveError}</div>
            )}
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[#000000]">{selected.label}</div>
                <div className="text-[11px] text-[#8e8e93]">{selected.relativePath} · {formatBytes(selected.sizeBytes)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Rendered / Raw toggle for markdown files */}
                {isMarkdownFile && !editing && (
                  <button
                    type="button"
                    onClick={() => setRawView((v) => !v)}
                    title={rawView ? '切换渲染视图' : '切换原始文本'}
                    className="flex items-center gap-1 rounded-lg bg-[#f2f2f7] px-2.5 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea]"
                  >
                    {rawView ? <Eye className="h-3 w-3" /> : <Code className="h-3 w-3" />}
                    {rawView ? '渲染' : '原文'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="flex items-center gap-1 rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea]"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1 rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea]"
                >
                  Download
                </button>
                {!editing ? (
                  <button
                    type="button"
                    onClick={handleEdit}
                    disabled={selected.writable === false}
                    className="flex items-center gap-1 rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea] disabled:opacity-50"
                  >
                    {t('actions.edit')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex items-center gap-1 rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea]"
                    >
                      <X className="h-3 w-3" /> {t('actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 rounded-lg bg-clawx-ac px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> {saving ? t('status.saving') : t('actions.save')}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              {editing ? (
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-full w-full resize-none p-4 font-mono text-[12px] leading-5 text-[#000000] outline-none"
                  spellCheck={false}
                />
              ) : isMarkdownFile && !rawView ? (
                <div className="p-4 overflow-auto">
                  <MarkdownViewer content={selected.content} highlights={selected.search?.highlights} />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-5 text-[#000000]">
                  {selected.content || <span className="text-[#8e8e93]">{t('memory.emptyFile')}</span>}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExtrasTab({ extraPaths, onAdd, onRemove }: {
  extraPaths: string[];
  onAdd: (path: string) => void;
  onRemove: (path: string) => void;
}) {
  const [newPath, setNewPath] = useState('');
  const { t } = useTranslation('common');

  const handleAdd = () => {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewPath('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
        <div className="text-[14px] font-semibold text-[#000000]">{t('memory.extraSources')}</div>
        <p className="mt-1 text-[12px] text-[#8e8e93]">{t('memory.extraSourcesDesc')}</p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={t('memory.pathPlaceholder')}
            className="flex-1 rounded-lg border border-black/[0.08] bg-[#f2f2f7] px-3 py-2 text-[12px] outline-none focus:border-clawx-ac"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newPath.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-clawx-ac px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> {t('actions.add')}
          </button>
        </div>
      </div>
      {extraPaths.length === 0 ? (
        <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-6 text-center text-[13px] text-[#8e8e93]">
          {t('memory.noExtraPaths')}
        </div>
      ) : (
        <div className="space-y-2">
          {extraPaths.map((p) => (
            <div key={p} className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-4 py-3">
              <span className="flex-1 truncate font-mono text-[12px] text-[#3c3c43]">{p}</span>
              <button
                type="button"
                onClick={() => onRemove(p)}
                aria-label={t('memory.removeExtraPath', { path: p })}
                className="ml-3 shrink-0 rounded-lg p-1.5 text-[#ef4444] hover:bg-[#ef4444]/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuideTab({ config }: { config: MemoryConfig }) {
  const { t } = useTranslation('common');
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
        <div className="text-[13px] font-semibold text-[#000000]">{t('memory.usageTips')}</div>
        <ul className="mt-2 space-y-2 text-[12px] leading-5 text-[#3c3c43]">
          <li>{t('memory.tip1')}</li>
          <li>{t('memory.tip2')}</li>
          <li>{t('memory.tip3')}</li>
        </ul>
      </div>
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 text-[12px] text-[#3c3c43]">
        {t('memory.vectorSearch')}: {config.memorySearch.enabled ? t('status.enabled') : t('status.notEnabled')} ·
        Provider: {config.memorySearch.provider ?? 'default'}
      </div>
    </div>
  );
}

export function Memory() {
  const { t } = useTranslation('common');
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<MemoryApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [scopeId, setScopeId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<SnapshotResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [extraPaths, setExtraPaths] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('memory_extra_paths') ?? '[]') as string[]; } catch { return []; }
  });

  const load = useCallback(async (nextScope = scopeId, nextQuery = searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const json = await getMemoryOverview({
        scope: nextScope || undefined,
        query: nextQuery.trim() || undefined,
      }) as unknown as MemoryApiResponse;
      setData(json);
      if (!scopeId && json.activeScope) {
        setScopeId(json.activeScope);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [scopeId, searchQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async (relativePath: string, content: string, expectedMtime?: string) => {
    await saveMemoryFile({
      relativePath,
      content,
      expectedMtime,
      scope: scopeId || data?.activeScope || undefined,
    });
    await reindexMemory();
    await load(scopeId, searchQuery);
  }, [scopeId, data?.activeScope, load, searchQuery]);

  const handleReindex = useCallback(async () => {
    setReindexing(true);
    try {
      await reindexMemory();
      await load();
    } finally {
      setReindexing(false);
    }
  }, [load]);

  const handleSnapshot = useCallback(async () => {
    setSnapshotting(true);
    setSnapshotResult(null);
    try {
      const result = await hostApiFetch<SnapshotResult>('/api/memory/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: scopeId || data?.activeScope || undefined }),
      });
      setSnapshotResult(result);
    } catch (e) {
      setSnapshotResult({ success: false, commitHash: null, message: String(e) });
    } finally {
      setSnapshotting(false);
    }
  }, [scopeId, data?.activeScope]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await hostApiFetch<AnalysisResult>('/api/memory/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: scopeId || data?.activeScope || undefined }),
      });
      setAnalysisResult(result);
    } catch (e) {
      console.error('analyze failed', e);
    } finally {
      setAnalyzing(false);
    }
  }, [scopeId, data?.activeScope]);

  const handleAddExtraPath = useCallback((path: string) => {
    setExtraPaths((prev) => {
      if (prev.includes(path)) return prev;
      const next = [...prev, path];
      localStorage.setItem('memory_extra_paths', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleRemoveExtraPath = useCallback((path: string) => {
    setExtraPaths((prev) => {
      const next = prev.filter((p) => p !== path);
      localStorage.setItem('memory_extra_paths', JSON.stringify(next));
      return next;
    });
  }, []);

  const tabs: { key: Tab; label: string; Icon: typeof FolderOpen }[] = [
    { key: 'overview', label: t('memory.tabOverview'), Icon: Info },
    { key: 'browser', label: t('memory.tabBrowser'), Icon: FolderOpen },
    { key: 'extras', label: t('memory.tabExtras'), Icon: Plus },
    { key: 'guide', label: t('memory.tabGuide'), Icon: BookOpen },
  ];

  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <div className="flex items-center justify-between border-b border-black/[0.06] bg-white px-6 py-4">
        <div>
          <h1 className="text-[17px] font-semibold text-[#000000]">{t('memory.title')}</h1>
          <p className="mt-0.5 text-[12px] text-[#8e8e93]">
            {data ? data.workspaceDir : t('memory.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-[#f2f2f7] px-3 py-2 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea] disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {t('actions.refresh')}
        </button>
      </div>

      <div className="flex gap-1 border-b border-black/[0.06] bg-white px-6">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium transition-colors',
              tab === key ? 'border-clawx-ac text-clawx-ac' : 'border-transparent text-[#8e8e93] hover:text-[#3c3c43]',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
              <SkeletonText lines={4} />
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 text-[13px] text-[#ef4444]">
            {t('status.loadFailed')}：{error}
          </div>
        )}
        {data && !loading && (
          <>
            {tab === 'overview' && <OverviewTab data={data} onReindex={handleReindex} reindexing={reindexing} onSnapshot={handleSnapshot} snapshotting={snapshotting} snapshotResult={snapshotResult} onAnalyze={handleAnalyze} analyzing={analyzing} analysisResult={analysisResult} scopeId={scopeId} />}
            {tab === 'browser' && (
              <BrowserTab
                files={data.files}
                scopes={data.scopes ?? [{ id: data.activeScope ?? 'main', label: data.activeScope ?? 'main', workspaceDir: data.workspaceDir }]}
                activeScope={scopeId || data.activeScope || 'main'}
                searchQuery={searchQuery}
                searchSummary={data.search}
                onScopeChange={(nextScope) => {
                  setScopeId(nextScope);
                  void load(nextScope, searchQuery);
                }}
                onSearchQueryChange={(nextQuery) => {
                  setSearchQuery(nextQuery);
                  void load(scopeId || data.activeScope || '', nextQuery);
                }}
                onSave={handleSave}
                onRefresh={() => {
                  void load();
                }}
              />
            )}
            {tab === 'guide' && <GuideTab config={data.config} />}
            {tab === 'extras' && <ExtrasTab extraPaths={extraPaths} onAdd={handleAddExtraPath} onRemove={handleRemoveExtraPath} />}
          </>
        )}
      </div>
    </div>
  );
}
