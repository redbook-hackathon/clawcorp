import { startTransition, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { SettingsMemoryBrowser } from './settings-memory-browser';
import { SettingsMemoryStrategy } from './settings-memory-strategy';
import { getMemoryOverview, normalizeMemoryFiles } from '@/lib/memory-client';

type MemoryTabId = 'strategy' | 'browser';

const MEMORY_TABS: MemoryTabId[] = ['strategy', 'browser'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

export function SettingsMemoryKnowledgePanel() {
  const { t } = useTranslation('settings');
  const [activeTab, setActiveTab] = useState<MemoryTabId>('strategy');
  const [workspaceDir, setWorkspaceDir] = useState('');
  const [activeScope, setActiveScope] = useState('');
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSizeBytes, setTotalSizeBytes] = useState(0);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      setOverviewError(null);

      try {
        const response = await getMemoryOverview();
        const files = normalizeMemoryFiles(response);
        const derivedSize = files.reduce((sum, file) => sum + (file.sizeBytes ?? file.size), 0);

        if (cancelled) {
          return;
        }

        setWorkspaceDir(typeof response.workspaceDir === 'string' ? response.workspaceDir : '');
        setActiveScope(typeof response.activeScope === 'string' ? response.activeScope : '');
        setTotalFiles(typeof response.stats?.totalFiles === 'number' ? response.stats.totalFiles : files.length);
        setTotalSizeBytes(
          typeof response.stats?.totalSizeBytes === 'number' ? response.stats.totalSizeBytes : derivedSize,
        );
      } catch (error) {
        if (!cancelled) {
          setOverviewError(String(error));
        }
      }
    };

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  const overviewItems = useMemo(() => ([
    {
      label: t('memoryKnowledge.overview.filesLabel', { defaultValue: 'Tracked files' }),
      value: String(totalFiles),
    },
    {
      label: t('memoryKnowledge.overview.sizeLabel', { defaultValue: 'Workspace size' }),
      value: formatBytes(totalSizeBytes),
    },
    {
      label: t('memoryKnowledge.overview.scopeLabel', { defaultValue: 'Active scope' }),
      value: activeScope || t('memoryKnowledge.overview.scopeFallback', { defaultValue: 'main' }),
    },
  ]), [activeScope, t, totalFiles, totalSizeBytes]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/[0.08] bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#8e8e93]">
              {t('memoryKnowledge.overview.eyebrow', { defaultValue: 'Shared memory spine' })}
            </p>
            <h2 className="text-[18px] font-semibold text-[#111827]">
              {t('memoryKnowledge.overview.title', { defaultValue: 'Shared memory spine' })}
            </h2>
            <p className="max-w-2xl text-[13px] leading-6 text-[#4b5563]">
              {t('memoryKnowledge.overview.description', {
                defaultValue:
                  'Settings and Team Map both edit the same memory files, save contract, and reindex pipeline.',
              })}
            </p>
          </div>

          <div className="rounded-xl border border-black/[0.06] bg-[#f8fafc] px-4 py-3 text-right">
            <div className="text-[11px] font-medium uppercase tracking-[0.4px] text-[#8e8e93]">
              {t('memoryKnowledge.overview.workspaceLabel', { defaultValue: 'Workspace root' })}
            </div>
            <div className="mt-1 max-w-[320px] break-all text-[12px] font-medium text-[#111827]">
              {workspaceDir || t('memoryKnowledge.overview.workspaceFallback', { defaultValue: 'Loading workspace...' })}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {overviewItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-black/[0.06] bg-[#fbfbfc] px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.4px] text-[#8e8e93]">{item.label}</div>
              <div className="mt-2 text-[18px] font-semibold text-[#111827]">{item.value}</div>
            </div>
          ))}
        </div>

        {overviewError ? (
          <div className="mt-3 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 px-4 py-3 text-[12px] text-[#ef4444]">
            {overviewError}
          </div>
        ) : null}
      </section>

      <div className="border-b border-black/[0.08]">
        <div role="tablist" aria-label={t('memoryKnowledge.tabsAriaLabel')} className="flex flex-wrap gap-6">
          {MEMORY_TABS.map((tabId) => {
            const active = tabId === activeTab;

            return (
              <button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  startTransition(() => setActiveTab(tabId));
                }}
                className={cn(
                  'border-b-2 pb-3 text-[13px] font-medium transition-colors',
                  active
                    ? 'border-[#0a7aff] text-[#0a7aff]'
                    : 'border-transparent text-[#8e8e93] hover:text-[#111827]',
                )}
              >
                {tabId === 'strategy'
                  ? t('memoryKnowledge.tabs.strategy')
                  : t('memoryKnowledge.tabs.browser')}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'browser' ? <SettingsMemoryBrowser /> : null}
      {activeTab === 'strategy' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-5 py-4 text-[13px] leading-6 text-[#1d4ed8]">
            {t('memoryKnowledge.overview.syncHint', {
              defaultValue: 'Team Map member memory and Settings memory remain two editors over one shared knowledge base.',
            })}
          </div>
          <SettingsMemoryStrategy />
        </div>
      ) : null}
    </div>
  );
}
