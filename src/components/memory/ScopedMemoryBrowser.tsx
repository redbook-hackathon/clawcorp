import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Code, Eye, FolderOpen, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { useTranslation } from 'react-i18next';

type MemoryFileCategory = 'evergreen' | 'daily' | 'other';

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

interface MemorySearchSummary {
  query: string;
  totalHits: number;
  resultCount?: number;
  totalFiles?: number;
}

interface MemoryApiResponse {
  files: MemoryFileInfo[];
  scopes?: MemoryScopeInfo[];
  activeScope?: string;
  workspaceDir: string;
  search?: MemorySearchSummary;
}

type FileTab = 'config' | 'logs';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

function useRelativeTime() {
  const { t } = useTranslation('common');
  return (iso: string): string => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return t('time.justNow');
    if (diff < 3600) return t('time.minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) });
    return t('time.daysAgo', { count: Math.floor(diff / 86400) });
  };
}

function MarkdownViewer({ content }: { content: string }) {
  if (!content.trim()) {
    return <span className="text-[12px] text-[#8e8e93]">（空文件）</span>;
  }

  return (
    <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-[#000000]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

interface ScopedMemoryBrowserProps {
  scopeId: string;
  showScopeSwitcher?: boolean;
}

export function ScopedMemoryBrowser({
  scopeId,
  showScopeSwitcher = true,
}: ScopedMemoryBrowserProps) {
  const { t } = useTranslation('common');
  const relativeTime = useRelativeTime();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeScope, setActiveScope] = useState(scopeId);
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<MemoryApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileTab, setFileTab] = useState<FileTab>('config');
  const [selected, setSelected] = useState<MemoryFileInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [rawView, setRawView] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = async (nextScope: string, nextQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextScope) params.set('scope', nextScope);
      if (nextQuery.trim()) params.set('q', nextQuery.trim());
      const path = params.size > 0 ? `/api/memory?${params.toString()}` : '/api/memory';
      const response = await hostApiFetch<MemoryApiResponse>(path);
      setData(response);
      setActiveScope(response.activeScope || nextScope);
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveScope(scopeId);
    void load(scopeId, '');
  }, [scopeId]);

  useEffect(() => {
    if (!selected || !data) return;
    const latest = data.files.find((file) => file.relativePath === selected.relativePath);
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
  }, [data, editing, selected]);

  const configFiles = useMemo(() => (
    (data?.files ?? [])
      .filter((file) => file.category === 'evergreen')
      .sort((left, right) => {
        if (left.relativePath === 'MEMORY.md') return -1;
        if (right.relativePath === 'MEMORY.md') return 1;
        return left.label.localeCompare(right.label);
      })
  ), [data]);

  const logFiles = useMemo(() => (
    (data?.files ?? [])
      .filter((file) => file.category === 'daily')
      .sort((left, right) => new Date(right.lastModified).getTime() - new Date(left.lastModified).getTime())
  ), [data]);

  const visibleFiles = fileTab === 'config' ? configFiles : logFiles;
  const hasUnsavedChanges = editing && selected !== null && draft !== selected.content;
  const isMarkdownFile = selected ? /\.md$/i.test(selected.relativePath) : false;

  const handleSelect = (file: MemoryFileInfo) => {
    setSelected(file);
    setEditing(false);
    setRawView(false);
    setDraft(file.content);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await hostApiFetch('/api/memory/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relativePath: selected.relativePath,
          content: draft,
          expectedMtime: selected.lastModified,
          scope: activeScope || data?.activeScope || undefined,
        }),
      });
      await hostApiFetch('/api/memory/reindex', { method: 'POST' });
      setEditing(false);
      await load(activeScope || scopeId, searchQuery);
    } catch (saveFailure) {
      setSaveError(String(saveFailure));
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

  return (
    <div className="flex h-full min-h-0 gap-3" style={{ height: 'calc(100vh - 200px)' }}>
      <div className="flex w-[220px] shrink-0 flex-col gap-2">
        {showScopeSwitcher ? (
          <select
            aria-label="Agent Scope"
            value={activeScope}
            onChange={(event) => {
              const nextScope = event.target.value;
              setActiveScope(nextScope);
              void load(nextScope, searchQuery);
            }}
            className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] outline-none focus:border-clawx-ac"
          >
            {(data?.scopes ?? []).map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.agentName ?? scope.label}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="text"
          aria-label="Search Memory"
          placeholder={t('memory.searchPlaceholder')}
          value={searchQuery}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setSearchQuery(nextQuery);
            void load(activeScope || scopeId, nextQuery);
          }}
          className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[12px] outline-none focus:border-clawx-ac"
        />
        {data?.search?.query ? <div className="text-[11px] text-[#8e8e93]">{data.search.totalHits} hits</div> : null}

        <div className="flex rounded-lg bg-[#f2f2f7] p-0.5">
          {([
            ['config', '配置文件'],
            ['logs', '记忆日志'],
          ] as [FileTab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFileTab(key);
                setSelected(null);
                setEditing(false);
                setRawView(false);
                setDraft('');
                setSaveError(null);
              }}
              className={cn(
                'flex-1 rounded-md py-1.5 text-[11px] font-medium transition-all',
                fileTab === key
                  ? 'bg-white text-[#000000] shadow-sm'
                  : 'text-[#8e8e93] hover:text-[#3c3c43]',
              )}
            >
              {label}
              <span className={cn('ml-1 text-[10px]', fileTab === key ? 'text-clawx-ac' : 'text-[#c6c6c8]')}>
                {key === 'config' ? configFiles.length : logFiles.length}
              </span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-1">
          {loading ? (
            <div className="py-8 text-center text-[12px] text-[#8e8e93]">{t('status.loading')}</div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 px-3 py-2 text-[12px] text-[#ef4444]">
              {error}
            </div>
          ) : null}
          {!loading && !error && visibleFiles.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#8e8e93]">
              {fileTab === 'config' ? '暂无配置文件' : '暂无记忆日志'}
            </div>
          ) : null}
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
                  style={{ color: selected?.relativePath === file.relativePath ? 'white' : file.category === 'evergreen' ? '#10b981' : file.category === 'daily' ? '#007aff' : '#8e8e93' }}
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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#8e8e93]">
            <FolderOpen className="h-10 w-10 opacity-30" />
            <span className="text-[13px]">{t('memory.selectFile')}</span>
          </div>
        ) : (
          <>
            {hasUnsavedChanges ? (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">Unsaved changes</div>
            ) : null}
            {saveError ? (
              <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-700">{saveError}</div>
            ) : null}
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[#000000]">{selected.label}</div>
                <div className="text-[11px] text-[#8e8e93]">{selected.relativePath} · {formatBytes(selected.sizeBytes)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isMarkdownFile && !editing ? (
                  <button
                    type="button"
                    onClick={() => setRawView((value) => !value)}
                    className="flex items-center gap-1 rounded-lg bg-[#f2f2f7] px-2.5 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea]"
                  >
                    {rawView ? <Eye className="h-3 w-3" /> : <Code className="h-3 w-3" />}
                    {rawView ? '渲染' : '原文'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea]"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea]"
                >
                  Download
                </button>
                {!editing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setDraft(selected.content);
                      setSaveError(null);
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                    disabled={selected.writable === false}
                    className="rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea] disabled:opacity-50"
                  >
                    {t('actions.edit')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setRawView(false);
                        setDraft(selected.content);
                        setSaveError(null);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-medium text-[#3c3c43] hover:bg-[#e5e5ea]"
                    >
                      <X className="h-3 w-3" /> {t('actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="flex items-center gap-1 rounded-lg bg-clawx-ac px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> {saving ? t('status.saving') : t('actions.save')}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {editing ? (
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-full min-h-[240px] w-full resize-none p-4 font-mono text-[12px] leading-5 text-[#000000] outline-none"
                  spellCheck={false}
                />
              ) : isMarkdownFile && !rawView ? (
                <div className="p-4 overflow-auto">
                  <MarkdownViewer content={selected.content} />
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
