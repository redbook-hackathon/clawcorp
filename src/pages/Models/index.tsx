import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway';
import { useSettingsStore } from '@/stores/settings';
import { hostApiFetch } from '@/lib/host-api';
import { trackUiEvent } from '@/lib/telemetry';
import { ProvidersSettings } from '@/components/settings/ProvidersSettings';
import { FeedbackState } from '@/components/common/FeedbackState';
import {
  filterUsageHistoryByWindow,
  groupUsageHistory,
  type UsageGroupBy,
  type UsageHistoryEntry,
  type UsageWindow,
} from './usage-history';
const DEFAULT_USAGE_FETCH_MAX_ATTEMPTS = 6;
const WINDOWS_USAGE_FETCH_MAX_ATTEMPTS = 10;
const USAGE_FETCH_RETRY_DELAY_MS = 1500;

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'gpt-5.4', label: 'GPT-5.4' },
  { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
];

type ModelsProps = {
  embedded?: boolean;
};

export function Models({ embedded = false }: ModelsProps) {
  const { t } = useTranslation(['dashboard', 'settings']);
  const gatewayStatus = useGatewayStore((state) => state.status);
  const restartGateway = useGatewayStore((state) => state.restart);
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);
  const defaultModel = useSettingsStore((state) => state.defaultModel);
  const setDefaultModel = useSettingsStore((state) => state.setDefaultModel);
  const contextLimit = useSettingsStore((state) => state.contextLimit);
  const setContextLimit = useSettingsStore((state) => state.setContextLimit);
  const gatewayPort = useSettingsStore((state) => state.gatewayPort);
  const setGatewayPort = useSettingsStore((state) => state.setGatewayPort);
  const isGatewayRunning = gatewayStatus.state === 'running';
  const usageFetchMaxAttempts = window.electron.platform === 'win32'
    ? WINDOWS_USAGE_FETCH_MAX_ATTEMPTS
    : DEFAULT_USAGE_FETCH_MAX_ATTEMPTS;

  const [usageHistory, setUsageHistory] = useState<UsageHistoryEntry[]>([]);
  const [usageGroupBy, setUsageGroupBy] = useState<UsageGroupBy>('model');
  const [usageWindow, setUsageWindow] = useState<UsageWindow>('7d');
  const [usagePage, setUsagePage] = useState(1);
  const [selectedUsageEntry, setSelectedUsageEntry] = useState<UsageHistoryEntry | null>(null);
  const [gatewayPortDraft, setGatewayPortDraft] = useState(() => String(gatewayPort));
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [doctorSummary, setDoctorSummary] = useState<string | null>(null);
  const usageFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usageFetchGenerationRef = useRef(0);
  const defaultModelSelectId = useId();
  const contextLimitId = useId();
  const gatewayPortId = useId();

  useEffect(() => {
    trackUiEvent('models.page_viewed');
  }, []);

  useEffect(() => {
    setGatewayPortDraft(String(gatewayPort));
  }, [gatewayPort]);

  useEffect(() => {
    if (usageFetchTimerRef.current) {
      clearTimeout(usageFetchTimerRef.current);
      usageFetchTimerRef.current = null;
    }

    if (!isGatewayRunning) return;

    const generation = usageFetchGenerationRef.current + 1;
    usageFetchGenerationRef.current = generation;
    const restartMarker = `${gatewayStatus.pid ?? 'na'}:${gatewayStatus.connectedAt ?? 'na'}`;
    trackUiEvent('models.token_usage_fetch_started', {
      generation,
      restartMarker,
    });

    const fetchUsageHistoryWithRetry = async (attempt: number) => {
      trackUiEvent('models.token_usage_fetch_attempt', {
        generation,
        attempt,
        restartMarker,
      });
      try {
        const entries = await hostApiFetch<UsageHistoryEntry[]>('/api/usage/recent-token-history');
        if (usageFetchGenerationRef.current !== generation) return;

        const normalized = Array.isArray(entries) ? entries : [];
        setUsageHistory(normalized);
        setUsagePage(1);
        trackUiEvent('models.token_usage_fetch_succeeded', {
          generation,
          attempt,
          records: normalized.length,
          restartMarker,
        });

        if (normalized.length === 0 && attempt < usageFetchMaxAttempts) {
          trackUiEvent('models.token_usage_fetch_retry_scheduled', {
            generation,
            attempt,
            reason: 'empty',
            restartMarker,
          });
          usageFetchTimerRef.current = setTimeout(() => {
            void fetchUsageHistoryWithRetry(attempt + 1);
          }, USAGE_FETCH_RETRY_DELAY_MS);
        } else if (normalized.length === 0) {
          trackUiEvent('models.token_usage_fetch_exhausted', {
            generation,
            attempt,
            reason: 'empty',
            restartMarker,
          });
        }
      } catch (error) {
        if (usageFetchGenerationRef.current !== generation) return;
        trackUiEvent('models.token_usage_fetch_failed_attempt', {
          generation,
          attempt,
          restartMarker,
          message: error instanceof Error ? error.message : String(error),
        });
        if (attempt < usageFetchMaxAttempts) {
          trackUiEvent('models.token_usage_fetch_retry_scheduled', {
            generation,
            attempt,
            reason: 'error',
            restartMarker,
          });
          usageFetchTimerRef.current = setTimeout(() => {
            void fetchUsageHistoryWithRetry(attempt + 1);
          }, USAGE_FETCH_RETRY_DELAY_MS);
          return;
        }
        setUsageHistory([]);
        trackUiEvent('models.token_usage_fetch_exhausted', {
          generation,
          attempt,
          reason: 'error',
          restartMarker,
        });
      }
    };

    void fetchUsageHistoryWithRetry(1);

    return () => {
      if (usageFetchTimerRef.current) {
        clearTimeout(usageFetchTimerRef.current);
        usageFetchTimerRef.current = null;
      }
    };
  }, [isGatewayRunning, gatewayStatus.connectedAt, gatewayStatus.pid, usageFetchMaxAttempts]);

  const visibleUsageHistory = isGatewayRunning ? usageHistory : [];
  const filteredUsageHistory = filterUsageHistoryByWindow(visibleUsageHistory, usageWindow);
  const usageGroups = groupUsageHistory(filteredUsageHistory, usageGroupBy);
  const usagePageSize = 5;
  const usageTotalPages = Math.max(1, Math.ceil(filteredUsageHistory.length / usagePageSize));
  const safeUsagePage = Math.min(usagePage, usageTotalPages);
  const pagedUsageHistory = filteredUsageHistory.slice((safeUsagePage - 1) * usagePageSize, safeUsagePage * usagePageSize);
  const usageLoading = isGatewayRunning && visibleUsageHistory.length === 0;
  const modelOptions = MODEL_OPTIONS.some((option) => option.value === defaultModel)
    ? MODEL_OPTIONS
    : [{ value: defaultModel, label: defaultModel }, ...MODEL_OPTIONS];
  const gatewayStateLabel = isGatewayRunning
    ? '已连接'
    : gatewayStatus.state === 'starting' || gatewayStatus.state === 'reconnecting'
      ? '连接中'
      : '已断开';

  const handleGatewayPortSave = () => {
    const nextPort = Number.parseInt(gatewayPortDraft, 10);
    if (Number.isNaN(nextPort) || nextPort < 1024 || nextPort > 65535) {
      setDoctorSummary('Gateway port must be between 1024 and 65535.');
      return;
    }

    setGatewayPort(nextPort);
    setDoctorSummary(`Gateway port updated to ${nextPort}.`);
  };

  const handleRunDoctor = async () => {
    setDoctorRunning(true);
    try {
      const result = await hostApiFetch<{
        success: boolean;
        exitCode?: number;
        stderr?: string;
      }>('/api/app/openclaw-doctor', {
        method: 'POST',
        body: JSON.stringify({ mode: 'diagnose' }),
      });
      setDoctorSummary(
        result.success
          ? `Doctor completed successfully (exit=${result.exitCode ?? 0}).`
          : `Doctor failed (exit=${result.exitCode ?? 'n/a'}) ${result.stderr ?? ''}`.trim(),
      );
    } catch (error) {
      setDoctorSummary(error instanceof Error ? error.message : String(error));
    } finally {
      setDoctorRunning(false);
    }
  };

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', embedded ? 'bg-transparent' : 'dark:bg-background')}>
      <div className={cn('flex h-full w-full flex-col', embedded ? '' : 'mx-auto max-w-5xl p-10 pt-16')}>
        {!embedded ? (
          <div className="mb-12 flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="mb-3 text-5xl font-normal tracking-tight text-foreground md:text-6xl" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                {t('dashboard:models.title')}
              </h1>
              <p className="text-[17px] font-medium text-foreground/70">
                {t('dashboard:models.subtitle')}
              </p>
            </div>
          </div>
        ) : null}

        <div className={cn('flex-1 min-h-0 overflow-y-auto', embedded ? 'space-y-8' : '-mr-2 space-y-12 pr-2 pb-10')}>
          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-card/80">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-serif font-normal tracking-tight text-foreground" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                  默认模型与回退路由
                </h2>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted-foreground">
                  在这里选择全局默认模型。各个提供方卡片上的回退模型 ID 和回退链会与设置中心和运行时共用同一套配置。
                </p>
              </div>
              <div className="flex-1 space-y-5">
                <div className="space-y-2">
                  <label htmlFor={defaultModelSelectId} className="block text-[13px] font-medium text-foreground">
                    全局默认模型
                  </label>
                  <select
                    id={defaultModelSelectId}
                    value={defaultModel}
                    onChange={(event) => setDefaultModel(event.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-[#0a84ff] dark:border-white/10"
                  >
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3 rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={contextLimitId} className="text-[13px] font-medium text-foreground">
                      上下文窗口
                    </label>
                    <span className="text-[12px] text-muted-foreground">
                      {contextLimit.toLocaleString()} Token
                    </span>
                  </div>
                  <input
                    id={contextLimitId}
                    type="range"
                    min={8000}
                    max={128000}
                    step={1000}
                    value={contextLimit}
                    onChange={(event) => setContextLimit(Number(event.target.value))}
                    className="w-full"
                    style={{ accentColor: 'var(--ac)' }}
                  />
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    与提供方相关的回退模型 ID 和回退链路，直接在各自的提供方卡片中编辑。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-card/80">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-serif font-normal tracking-tight text-foreground" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
                    网关连接
                  </h2>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                      isGatewayRunning
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                    )}
                  >
                    {gatewayStateLabel}
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted-foreground">
                  保持运行时网关可用，以支持提供方验证和用量历史读取。重新连接和诊断都复用统一的网关与 host-api 通道。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => { void restartGateway(); }}
                >
                  重新连接网关
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => { void handleRunDoctor(); }}
                  disabled={doctorRunning}
                >
                  {doctorRunning ? '诊断运行中...' : '运行诊断'}
                </Button>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <label htmlFor={gatewayPortId} className="block text-[13px] font-medium text-foreground">
                  网关端口
                </label>
                <p className="text-[12px] leading-5 text-muted-foreground">
                  这里的端口配置会通过统一设置仓库持久化，确保设置中心与 `/models` 视图保持一致。
                </p>
              </div>
              <div className="flex w-full gap-3 md:w-auto">
                <input
                  id={gatewayPortId}
                  type="number"
                  value={gatewayPortDraft}
                  onChange={(event) => setGatewayPortDraft(event.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-[#0a84ff] dark:border-white/10 md:w-[140px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={handleGatewayPortSave}
                  disabled={gatewayPortDraft === String(gatewayPort)}
                >
                  保存端口
                </Button>
              </div>
            </div>
            {doctorSummary ? (
              <p className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-[12px] leading-5 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
                {doctorSummary}
              </p>
            ) : null}
          </section>

          <ProvidersSettings />

          {/* Token Usage History Section */}
          <div>
            <h2 className="text-3xl font-serif text-foreground mb-6 font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
              {t('dashboard:recentTokenHistory.title', 'Token Usage History')}
            </h2>
            <div>
              {usageLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground bg-black/5 dark:bg-white/5 rounded-3xl border border-transparent border-dashed">
                  <FeedbackState state="loading" title={t('dashboard:recentTokenHistory.loading')} />
                </div>
              ) : visibleUsageHistory.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground bg-black/5 dark:bg-white/5 rounded-3xl border border-transparent border-dashed">
                  <FeedbackState state="empty" title={t('dashboard:recentTokenHistory.empty')} />
                </div>
              ) : filteredUsageHistory.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground bg-black/5 dark:bg-white/5 rounded-3xl border border-transparent border-dashed">
                  <FeedbackState state="empty" title={t('dashboard:recentTokenHistory.emptyForWindow')} />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex rounded-xl bg-transparent p-1 border border-black/10 dark:border-white/10">
                        <Button
                          variant={usageGroupBy === 'model' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setUsageGroupBy('model');
                            setUsagePage(1);
                          }}
                          className={usageGroupBy === 'model' ? "rounded-lg bg-black/5 dark:bg-white/10 text-foreground" : "rounded-lg text-muted-foreground"}
                        >
                          {t('dashboard:recentTokenHistory.groupByModel')}
                        </Button>
                        <Button
                          variant={usageGroupBy === 'day' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setUsageGroupBy('day');
                            setUsagePage(1);
                          }}
                          className={usageGroupBy === 'day' ? "rounded-lg bg-black/5 dark:bg-white/10 text-foreground" : "rounded-lg text-muted-foreground"}
                        >
                          {t('dashboard:recentTokenHistory.groupByTime')}
                        </Button>
                      </div>
                      <div className="flex rounded-xl bg-transparent p-1 border border-black/10 dark:border-white/10">
                        <Button
                          variant={usageWindow === '7d' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setUsageWindow('7d');
                            setUsagePage(1);
                          }}
                          className={usageWindow === '7d' ? "rounded-lg bg-black/5 dark:bg-white/10 text-foreground" : "rounded-lg text-muted-foreground"}
                        >
                          {t('dashboard:recentTokenHistory.last7Days')}
                        </Button>
                        <Button
                          variant={usageWindow === '30d' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setUsageWindow('30d');
                            setUsagePage(1);
                          }}
                          className={usageWindow === '30d' ? "rounded-lg bg-black/5 dark:bg-white/10 text-foreground" : "rounded-lg text-muted-foreground"}
                        >
                          {t('dashboard:recentTokenHistory.last30Days')}
                        </Button>
                        <Button
                          variant={usageWindow === 'all' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setUsageWindow('all');
                            setUsagePage(1);
                          }}
                          className={usageWindow === 'all' ? "rounded-lg bg-black/5 dark:bg-white/10 text-foreground" : "rounded-lg text-muted-foreground"}
                        >
                          {t('dashboard:recentTokenHistory.allTime')}
                        </Button>
                      </div>
                    </div>
                    <p className="text-[13px] font-medium text-muted-foreground">
                      {t('dashboard:recentTokenHistory.showingLast', { count: filteredUsageHistory.length })}
                    </p>
                  </div>

                  <UsageBarChart
                    groups={usageGroups}
                    emptyLabel={t('dashboard:recentTokenHistory.empty')}
                    totalLabel={t('dashboard:recentTokenHistory.totalTokens')}
                    inputLabel={t('dashboard:recentTokenHistory.inputShort')}
                    outputLabel={t('dashboard:recentTokenHistory.outputShort')}
                    cacheLabel={t('dashboard:recentTokenHistory.cacheShort')}
                  />

                  <div className="space-y-3 pt-2">
                    {pagedUsageHistory.map((entry) => (
                      <div
                        key={`${entry.sessionId}-${entry.timestamp}`}
                        className="rounded-2xl bg-transparent border border-black/10 dark:border-white/10 p-5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-[15px] text-foreground truncate">
                              {entry.model || t('dashboard:recentTokenHistory.unknownModel')}
                            </p>
                            <p className="text-[13px] text-muted-foreground truncate mt-0.5">
                              {[entry.provider, entry.agentId, entry.sessionId].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-[15px]">{formatTokenCount(entry.totalTokens)}</p>
                            <p className="text-[12px] text-muted-foreground mt-0.5">
                              {formatUsageTimestamp(entry.timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] font-medium text-muted-foreground">
                          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-sky-500"></div>{t('dashboard:recentTokenHistory.input', { value: formatTokenCount(entry.inputTokens) })}</span>
                          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500"></div>{t('dashboard:recentTokenHistory.output', { value: formatTokenCount(entry.outputTokens) })}</span>
                          {entry.cacheReadTokens > 0 && (
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div>{t('dashboard:recentTokenHistory.cacheRead', { value: formatTokenCount(entry.cacheReadTokens) })}</span>
                          )}
                          {entry.cacheWriteTokens > 0 && (
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div>{t('dashboard:recentTokenHistory.cacheWrite', { value: formatTokenCount(entry.cacheWriteTokens) })}</span>
                          )}
                          {typeof entry.costUsd === 'number' && Number.isFinite(entry.costUsd) && (
                            <span className="flex items-center gap-1.5 ml-auto text-foreground/80 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md">{t('dashboard:recentTokenHistory.cost', { amount: entry.costUsd.toFixed(4) })}</span>
                          )}
                          {devModeUnlocked && entry.content && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 rounded-full px-2.5 text-[11.5px] border-black/10 dark:border-white/10"
                              onClick={() => setSelectedUsageEntry(entry)}
                            >
                              {t('dashboard:recentTokenHistory.viewContent')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-[13px] font-medium text-muted-foreground">
                      {t('dashboard:recentTokenHistory.page', { current: safeUsagePage, total: usageTotalPages })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUsagePage((page) => Math.max(1, page - 1))}
                        disabled={safeUsagePage <= 1}
                        className="rounded-full px-4 h-9 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {t('dashboard:recentTokenHistory.prev')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUsagePage((page) => Math.min(usageTotalPages, page + 1))}
                        disabled={safeUsagePage >= usageTotalPages}
                        className="rounded-full px-4 h-9 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        {t('dashboard:recentTokenHistory.next')}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      {devModeUnlocked && selectedUsageEntry && (
        <UsageContentPopup
          entry={selectedUsageEntry}
          onClose={() => setSelectedUsageEntry(null)}
          title={t('dashboard:recentTokenHistory.contentDialogTitle')}
          closeLabel={t('dashboard:recentTokenHistory.close')}
          unknownModelLabel={t('dashboard:recentTokenHistory.unknownModel')}
        />
      )}
    </div>
  );
}

function formatTokenCount(value: number): string {
  return Intl.NumberFormat().format(value);
}

function formatUsageTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function UsageBarChart({
  groups,
  emptyLabel,
  totalLabel,
  inputLabel,
  outputLabel,
  cacheLabel,
}: {
  groups: Array<{
    label: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheTokens: number;
  }>;
  emptyLabel: string;
  totalLabel: string;
  inputLabel: string;
  outputLabel: string;
  cacheLabel: string;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center text-[14px] font-medium text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const maxTokens = Math.max(...groups.map((group) => group.totalTokens), 1);

  return (
    <div className="space-y-4 bg-transparent p-5 rounded-2xl border border-black/10 dark:border-white/10">
      <div className="flex flex-wrap gap-4 text-[13px] font-medium text-muted-foreground mb-2">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
          {inputLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
          {outputLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          {cacheLabel}
        </span>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="truncate font-semibold text-foreground">{group.label}</span>
            <span className="text-muted-foreground font-medium">
              {totalLabel}: {formatTokenCount(group.totalTokens)}
            </span>
          </div>
          <div className="h-3.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
            <div
              className="flex h-full overflow-hidden rounded-full"
              style={{
                width: group.totalTokens > 0
                  ? `${Math.max((group.totalTokens / maxTokens) * 100, 6)}%`
                  : '0%',
              }}
            >
              {group.inputTokens > 0 && (
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${(group.inputTokens / group.totalTokens) * 100}%` }}
                />
              )}
              {group.outputTokens > 0 && (
                <div
                  className="h-full bg-violet-500"
                  style={{ width: `${(group.outputTokens / group.totalTokens) * 100}%` }}
                />
              )}
              {group.cacheTokens > 0 && (
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${(group.cacheTokens / group.totalTokens) * 100}%` }}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Models;

function UsageContentPopup({
  entry,
  onClose,
  title,
  closeLabel,
  unknownModelLabel,
}: {
  entry: UsageHistoryEntry;
  onClose: () => void;
  title: string;
  closeLabel: string;
  unknownModelLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-2xl border border-black/10 dark:border-white/10 bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/10 dark:border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {(entry.model || unknownModelLabel)} • {formatUsageTimestamp(entry.timestamp)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap break-words text-sm text-foreground font-mono">
            {entry.content}
          </pre>
        </div>
        <div className="flex justify-end border-t border-black/10 dark:border-white/10 px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
