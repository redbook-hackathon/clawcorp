import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, FileText, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getMemoryFile,
  getMemoryOverview,
  normalizeMemoryFiles,
  reindexMemory,
  saveMemoryFile,
  type MemoryClientFile,
} from '@/lib/memory-client';

type MemoryFile = MemoryClientFile;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

function formatRelativeTime(ms: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return t('memoryBrowser.time.justNow');
  if (diff < 3600) return t('memoryBrowser.time.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('memoryBrowser.time.hoursAgo', { count: Math.floor(diff / 3600) });
  return t('memoryBrowser.time.daysAgo', { count: Math.floor(diff / 86400) });
}

export function SettingsMemoryBrowser() {
  const { t } = useTranslation('settings');
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMemoryOverview();
      setFiles(normalizeMemoryFiles(data).sort((a, b) => b.mtime - a.mtime));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  const openFile = useCallback(async (file: MemoryFile) => {
    setSelectedFile(file);
    setEditing(false);
    setSaveMsg('');
    setFileLoading(true);
    try {
      const data = await getMemoryFile(file.path);
      setFileContent(data.content);
      setDraft(data.content);
    } catch (e) {
      setFileContent(t('memoryBrowser.readFailed', { error: String(e) }));
    } finally {
      setFileLoading(false);
    }
  }, [t]);

  const saveFile = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await saveMemoryFile({
        relativePath: selectedFile.relativePath,
        content: draft,
      });
      await reindexMemory();
      setFileContent(draft);
      setEditing(false);
      setSaveMsg(t('memoryBrowser.saved'));
      void fetchFiles();
    } catch (e) {
      setSaveMsg(t('memoryBrowser.saveFailed', { error: String(e) }));
    } finally {
      setSaving(false);
    }
  }, [selectedFile, draft, fetchFiles, t]);

  return (
    <div className="flex min-h-[540px] gap-0 overflow-hidden rounded-xl border border-black/[0.08]">
      {/* Left panel */}
      <section
        role="region"
        aria-label={t('memoryBrowser.fileListAria')}
        className="flex w-[220px] shrink-0 flex-col border-r border-black/[0.06] bg-white"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#8e8e93]">
            {t('memoryBrowser.filesLabel', { count: files.length })}
          </span>
          <button
            type="button"
            aria-label={t('memoryBrowser.refreshAria')}
            onClick={() => void fetchFiles()}
            disabled={loading}
            className="flex h-5 w-5 items-center justify-center rounded text-[#8e8e93] hover:text-[#000000] disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {error && (
            <div className="px-3 py-2 text-[11px] text-[#ef4444]">{error}</div>
          )}
          {!error && files.length === 0 && !loading && (
            <div className="px-3 py-6 text-center text-[12px] text-[#8e8e93]">{t('memoryBrowser.empty')}</div>
          )}
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => void openFile(file)}
              className={cn(
                'flex flex-col items-start gap-0.5 border-b border-black/[0.04] px-3 py-3 text-left transition-colors',
                selectedFile?.path === file.path ? 'bg-[#e8f1ff]' : 'hover:bg-[#f2f2f7]',
              )}
            >
              <div className="flex w-full items-center gap-1.5">
                <FileText className="h-3 w-3 shrink-0 text-clawx-ac" />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#000000]">{file.name}</span>
              </div>
              <span className="pl-4 text-[11px] text-[#8e8e93]">
                {formatBytes(file.size)} · {formatRelativeTime(file.mtime, t)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Right panel */}
      <section
        role="region"
        aria-label={t('memoryBrowser.previewAria')}
        className="flex flex-1 flex-col overflow-hidden bg-white"
      >
        {!selectedFile ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-[#8e8e93]">
            {t('memoryBrowser.selectFile')}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
              <span className="text-[12px] font-medium text-[#000000]">{selectedFile.name}</span>
              <div className="flex items-center gap-2">
                {saveMsg && (
                  <span className={cn('text-[11px]', saveMsg.startsWith(t('memoryBrowser.saveFailedPrefix')) ? 'text-[#ef4444]' : 'text-[#10b981]')}>
                    {saveMsg}
                  </span>
                )}
                {editing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setDraft(fileContent); setSaveMsg(''); }}
                      className="flex h-6 items-center gap-1 rounded px-2 text-[11px] text-[#8e8e93] hover:bg-[#f2f2f7]"
                    >
                      <X className="h-3 w-3" /> {t('memoryBrowser.actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveFile()}
                      disabled={saving}
                      className="flex h-6 items-center gap-1 rounded bg-clawx-ac px-2 text-[11px] font-medium text-white hover:bg-[#0062cc] disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> {saving ? t('memoryBrowser.actions.saving') : t('memoryBrowser.actions.save')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditing(true); setSaveMsg(''); }}
                    className="flex h-6 items-center gap-1 rounded px-2 text-[11px] text-[#3c3c43] hover:bg-[#f2f2f7]"
                  >
                    {t('memoryBrowser.actions.edit')}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {fileLoading ? (
                <div className="text-[13px] text-[#8e8e93]">{t('memoryBrowser.loading')}</div>
              ) : editing ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-full min-h-[400px] w-full resize-none rounded-xl border border-black/[0.06] bg-[#fafafa] px-5 py-4 font-mono text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
                  spellCheck={false}
                />
              ) : (
                <div className="rounded-xl border border-black/[0.06] bg-[#fafafa] px-6 py-5">
                  <pre className="whitespace-pre-wrap font-sans text-[13px] leading-7 text-[#111827]">
                    {fileContent}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
