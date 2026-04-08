/**
 * Costs Page — 费用 / Token 用量统计 + 监控大盘
 * 合并原 SettingsMonitoringPanel 的全部功能
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import { RefreshCw, TrendingUp, Zap, DollarSign, BarChart3, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { SkeletonText } from '@/components/ui/Skeleton';

/* ─── Types ─── */

interface TokenUsageEntry {
  timestamp: string;
  sessionId: string;
  agentId: string;
  model?: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd?: number;
}

interface DaySummary {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  costUsd: number;
  sessions: number;
}

interface CostsSummary {
  timeline: DaySummary[];
  totals: { inputTokens: number; outputTokens: number; cacheTokens: number; totalTokens: number; costUsd: number; sessions: number };
}

interface AgentSummary {
  agentId: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  sessions: number;
}

interface ModelSummary {
  model: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  count: number;
}

interface CronSummary {
  cronJobId: string;
  cronName: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  sessions: number;
  avgTokensPerRun?: number;
  avgCostUsdPerRun?: number;
  lastRunAt?: string | null;
}

interface CostsAnalysis {
  optimizationScore: number;
  cacheSavings: {
    cacheTokens: number;
    estimatedCostUsd: number;
    savingsRatePct: number;
  };
  weekOverWeek: {
    previous: { totalTokens: number; costUsd: number; sessions: number; cacheTokens: number };
    current: { totalTokens: number; costUsd: number; sessions: number; cacheTokens: number };
    deltas: { totalTokensPct: number; costUsdPct: number; sessionsPct: number; cacheTokensPct: number };
  };
  anomalies: Array<{
    date: string;
    totalTokens: number;
    costUsd: number;
    zScore: number;
    reason: string;
  }>;
  insights: string[];
}

interface AlertRule {
  id: string;
  name: string;
  type: 'daily_token' | 'cost_usd' | 'session_count';
  threshold: number;
  enabled: boolean;
  createdAt: string;
}

type TabId = 'realtime' | 'dashboard' | 'usage' | 'alerts';

const TAB_IDS: TabId[] = ['realtime', 'dashboard', 'usage', 'alerts'];
const TAB_LABEL_KEYS: Record<TabId, string> = {
  realtime: 'costs.tabRealtime',
  dashboard: 'costs.tabDashboard',
  usage: 'costs.tabUsage',
  alerts: 'costs.tabAlerts',
};

/* ─── Helpers ─── */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd?: number): string {
  if (usd == null) return '—';
  if (usd < 0.001) return '<$0.001';
  return `$${usd.toFixed(4)}`;
}

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readUsageNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function extractRealtimeUsageEntry(payload: unknown): TokenUsageEntry | null {
  const notification = asRecord(payload);
  if (!notification || notification.method !== 'agent') return null;

  const params = asRecord(notification.params);
  if (!params) return null;

  const data = asRecord(params.data) ?? {};
  const message = asRecord(params.message) ?? asRecord(data.message);
  const details = asRecord(params.details) ?? asRecord(data.details) ?? asRecord(message?.details);
  const timestamp = typeof params.timestamp === 'string'
    ? params.timestamp
    : typeof data.timestamp === 'string'
      ? data.timestamp
      : new Date().toISOString();
  const sessionIdSource = params.sessionKey ?? data.sessionKey;
  const sessionId = typeof sessionIdSource === 'string' && sessionIdSource.trim().length > 0
    ? sessionIdSource
    : `realtime-${timestamp}`;
  const agentIdSource = params.agentId ?? data.agentId ?? params.agentName ?? data.agentName;
  const agentId = typeof agentIdSource === 'string' && agentIdSource.trim().length > 0
    ? agentIdSource
    : 'unknown';

  const assistantUsage = asRecord(message?.usage);
  if (message?.role === 'assistant' && assistantUsage) {
    const inputTokens = readUsageNumber(assistantUsage.input ?? assistantUsage.promptTokens);
    const outputTokens = readUsageNumber(assistantUsage.output ?? assistantUsage.completionTokens);
    const cacheReadTokens = readUsageNumber(assistantUsage.cacheRead);
    const cacheWriteTokens = readUsageNumber(assistantUsage.cacheWrite);
    const totalTokens = readUsageNumber(assistantUsage.total ?? assistantUsage.totalTokens)
      || inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
    if (totalTokens <= 0) return null;

    const cost = asRecord(assistantUsage.cost);
    return {
      timestamp,
      sessionId,
      agentId,
      model: typeof message.model === 'string' ? message.model : undefined,
      provider: typeof message.provider === 'string' ? message.provider : undefined,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalTokens,
      costUsd: typeof cost?.total === 'number' ? cost.total : undefined,
    };
  }

  const detailUsage = asRecord(details?.usage);
  if (!detailUsage) return null;

  const inputTokens = readUsageNumber(detailUsage.input ?? detailUsage.promptTokens);
  const outputTokens = readUsageNumber(detailUsage.output ?? detailUsage.completionTokens);
  const cacheReadTokens = readUsageNumber(detailUsage.cacheRead);
  const cacheWriteTokens = readUsageNumber(detailUsage.cacheWrite);
  const totalTokens = readUsageNumber(detailUsage.total ?? detailUsage.totalTokens)
    || inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  if (totalTokens <= 0) return null;

  const cost = asRecord(detailUsage.cost);
  return {
    timestamp,
    sessionId,
    agentId,
    model: typeof details?.model === 'string'
      ? details.model
      : typeof message?.model === 'string'
        ? message.model
        : undefined,
    provider: typeof details?.provider === 'string'
      ? details.provider
      : typeof message?.provider === 'string'
        ? message.provider
        : undefined,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    costUsd: typeof cost?.total === 'number' ? cost.total : undefined,
  };
}

/* ─── Main component ─── */

type CostsProps = {
  embedded?: boolean;
};

export function Costs({ embedded = false }: CostsProps) {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<TabId>('realtime');
  const [entries, setEntries] = useState<TokenUsageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(200);
  const [summary, setSummary] = useState<CostsSummary | null>(null);
  const [agentRows, setAgentRows] = useState<AgentSummary[]>([]);
  const [modelSummaryRows, setModelSummaryRows] = useState<ModelSummary[]>([]);
  const [cronRows, setCronRows] = useState<CronSummary[]>([]);
  const [analysis, setAnalysis] = useState<CostsAnalysis | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hostApiFetch<TokenUsageEntry[]>(
        `/api/usage/recent-token-history?limit=${limit}`,
      );
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const fetchSummary = useCallback(async () => {
    try {
      const [s, a, m, c, analysisData] = await Promise.all([
        hostApiFetch<CostsSummary>('/api/costs/summary?days=30'),
        hostApiFetch<AgentSummary[]>('/api/costs/by-agent'),
        hostApiFetch<ModelSummary[]>('/api/costs/by-model'),
        hostApiFetch<CronSummary[]>('/api/costs/by-cron'),
        hostApiFetch<CostsAnalysis>('/api/costs/analysis'),
      ]);
      setSummary(s);
      setAgentRows(Array.isArray(a) ? a : []);
      setModelSummaryRows(Array.isArray(m) ? m : []);
      setCronRows(Array.isArray(c) ? c : []);
      setAnalysis(analysisData ?? null);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { void fetchSummary(); }, [fetchSummary]);
  useEffect(() => {
    return subscribeHostEvent('gateway:notification', (payload) => {
      const entry = extractRealtimeUsageEntry(payload);
      if (!entry) return;
      setEntries((prev) => {
        const duplicate = prev.some((existing) =>
          existing.timestamp === entry.timestamp
          && existing.sessionId === entry.sessionId
          && existing.agentId === entry.agentId
          && existing.totalTokens === entry.totalTokens,
        );
        if (duplicate) return prev;
        return [entry, ...prev].slice(0, limit);
      });
    });
  }, [limit]);
  useEffect(() => {
    if (activeTab !== 'realtime' || !autoRefreshEnabled) {
      return;
    }

    const timerId = window.setInterval(() => {
      void fetchData();
    }, autoRefreshIntervalSec * 1000);
    return () => window.clearInterval(timerId);
  }, [activeTab, autoRefreshEnabled, autoRefreshIntervalSec, fetchData]);

  const totalInput = entries.reduce((s, e) => s + e.inputTokens, 0);
  const totalOutput = entries.reduce((s, e) => s + e.outputTokens, 0);
  const totalCache = entries.reduce((s, e) => s + e.cacheReadTokens + e.cacheWriteTokens, 0);
  const totalCost = entries.reduce((s, e) => s + (e.costUsd ?? 0), 0);

  const modelMap = new Map<string, { tokens: number; cost: number; count: number }>();
  for (const e of entries) {
    const key = e.model ?? t('costs.unknownModel');
    const prev = modelMap.get(key) ?? { tokens: 0, cost: 0, count: 0 };
    modelMap.set(key, { tokens: prev.tokens + e.totalTokens, cost: prev.cost + (e.costUsd ?? 0), count: prev.count + 1 });
  }
  const modelRows = [...modelMap.entries()].sort((a, b) => b[1].tokens - a[1].tokens);

  return (
    <div className={cn('flex h-full flex-col', embedded ? 'bg-transparent' : 'bg-[#f2f2f7]')}>
      {!embedded ? (
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#c6c6c8] bg-white px-5">
          <h1 className="text-[15px] font-semibold text-[#000000]">{t('costs.title')}</h1>
          <div className="flex items-center gap-3">
            {activeTab === 'realtime' && (
              <>
                <label className="flex items-center gap-1.5 text-[12px] text-[#3c3c43]">
                  <input
                    type="checkbox"
                    aria-label="Auto refresh"
                    checked={autoRefreshEnabled}
                    onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#c6c6c8]"
                  />
                  Auto refresh
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-[#3c3c43]">
                  <span>Interval</span>
                  <select
                    aria-label="Refresh interval"
                    value={autoRefreshIntervalSec}
                    onChange={(event) => setAutoRefreshIntervalSec(Number(event.target.value))}
                    className="h-8 rounded-lg border border-[#c6c6c8] bg-[#f2f2f7] px-2 text-[12px] text-[#3c3c43] outline-none"
                  >
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="h-8 rounded-lg border border-[#c6c6c8] bg-[#f2f2f7] px-2 text-[12px] text-[#3c3c43] outline-none"
                >
                  <option value={50}>{t('costs.recent50')}</option>
                  <option value={200}>{t('costs.recent200')}</option>
                  <option value={500}>{t('costs.recent500')}</option>
                </select>
              </>
            )}
            <button
              type="button"
              onClick={() => { void fetchData(); void fetchSummary(); }}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] text-[#3c3c43] transition-colors hover:bg-[#f2f2f7] disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {t('actions.refresh')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex shrink-0 gap-6 border-b border-[#c6c6c8] bg-white px-5">
        {TAB_IDS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={cn(
              'border-b-2 pb-3 pt-3 text-[13px] font-medium transition-colors',
              activeTab === tabId
                ? 'border-clawx-ac text-clawx-ac'
                : 'border-transparent text-[#8e8e93] hover:text-[#000000]',
            )}
          >
            {t(TAB_LABEL_KEYS[tabId])}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="mb-4 rounded-xl bg-[#fef2f2] px-4 py-3 text-[13px] text-[#ef4444]">{error}</div>
        )}

        {activeTab === 'realtime' && (
          <RealtimeTab
            entries={entries}
            loading={loading}
            totalInput={totalInput}
            totalOutput={totalOutput}
            totalCache={totalCache}
            totalCost={totalCost}
            modelRows={modelRows}
          />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab
            summary={summary}
            agentRows={agentRows}
            modelRows={modelSummaryRows}
            cronRows={cronRows}
            analysis={analysis}
          />
        )}
        {activeTab === 'usage' && <UsageTab agentRows={agentRows} />}
        {activeTab === 'alerts' && <AlertsTab />}
      </div>
    </div>
  );
}

/* ─── Realtime Tab ─── */

function RealtimeTab({
  entries, loading, totalInput, totalOutput, totalCache, totalCost, modelRows,
}: {
  entries: TokenUsageEntry[];
  loading: boolean;
  totalInput: number;
  totalOutput: number;
  totalCache: number;
  totalCost: number;
  modelRows: [string, { tokens: number; cost: number; count: number }][];
}) {
  const { t } = useTranslation('common');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: <Zap className="h-4 w-4" />, label: t('costs.inputTokens'), value: formatTokens(totalInput), color: '#007aff' },
          { icon: <TrendingUp className="h-4 w-4" />, label: t('costs.outputTokens'), value: formatTokens(totalOutput), color: '#10b981' },
          { icon: <BarChart3 className="h-4 w-4" />, label: t('costs.cacheTokens'), value: formatTokens(totalCache), color: '#f59e0b' },
          { icon: <DollarSign className="h-4 w-4" />, label: t('costs.totalCostUsd'), value: formatCost(totalCost), color: '#ff6a00' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-2" style={{ color: card.color }}>
              {card.icon}
              <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#8e8e93]">{card.label}</span>
            </div>
            <p className="text-[22px] font-semibold text-[#000000]">{card.value}</p>
          </div>
        ))}
      </div>

      {modelRows.length > 0 && (
        <div className="rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="border-b border-[#f2f2f7] px-5 py-3">
            <span className="text-[13px] font-semibold text-[#000000]">{t('costs.modelDistribution')}</span>
          </div>
          <div className="divide-y divide-[#f2f2f7]">
            {modelRows.map(([model, stats]) => {
              const total = modelRows.reduce((s, [, v]) => s + v.tokens, 0);
              const pct = total > 0 ? Math.round((stats.tokens / total) * 100) : 0;
              return (
                <div key={model} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-[180px] truncate text-[13px] font-medium text-[#000000]">{model}</span>
                  <div className="flex-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f2f2f7]">
                      <div className="h-full rounded-full bg-clawx-ac" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="w-[60px] text-right text-[12px] text-[#8e8e93]">{pct}%</span>
                  <span className="w-[70px] text-right text-[12px] text-[#3c3c43]">{formatTokens(stats.tokens)}</span>
                  <span className="w-[80px] text-right text-[12px] text-[#8e8e93]">{formatCost(stats.cost)}</span>
                  <span className="w-[50px] text-right text-[11px] text-[#c6c6c8]">{stats.count}次</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="border-b border-[#f2f2f7] px-5 py-3">
          <span className="text-[13px] font-semibold text-[#000000]">{t('costs.recentRecords')} ({entries.length})</span>
        </div>
        {entries.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-[28px] opacity-30">💸</span>
            <span className="text-[13px] text-[#8e8e93]">{t('costs.noUsageData')}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f2f2f7] text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-[#8e8e93]">
                  <th className="px-5 py-2.5">{t('costs.time')}</th>
                  <th className="px-3 py-2.5">Agent</th>
                  <th className="px-3 py-2.5">{t('costs.model')}</th>
                  <th className="px-3 py-2.5 text-right">{t('costs.input')}</th>
                  <th className="px-3 py-2.5 text-right">{t('costs.output')}</th>
                  <th className="px-3 py-2.5 text-right">{t('costs.cache')}</th>
                  <th className="px-5 py-2.5 text-right">{t('costs.cost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f2f7]">
                {entries.map((e, i) => (
                  <tr key={`${e.timestamp}-${i}`} className="hover:bg-[#f9f9fb]">
                    <td className="px-5 py-2.5 text-[#8e8e93]">{formatDate(e.timestamp)}</td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 text-[#3c3c43]">{e.agentId}</td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 text-[#3c3c43]">{e.model ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-[#000000]">{formatTokens(e.inputTokens)}</td>
                    <td className="px-3 py-2.5 text-right text-[#000000]">{formatTokens(e.outputTokens)}</td>
                    <td className="px-3 py-2.5 text-right text-[#8e8e93]">{formatTokens(e.cacheReadTokens + e.cacheWriteTokens)}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-[#ff6a00]">{formatCost(e.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Dashboard Tab ─── */

function DashboardTab({
  summary,
  agentRows,
  modelRows,
  cronRows,
  analysis,
}: {
  summary: CostsSummary | null;
  agentRows: AgentSummary[];
  modelRows: ModelSummary[];
  cronRows: CronSummary[];
  analysis: CostsAnalysis | null;
}) {
  const { t } = useTranslation('common');
  const [expandedCronId, setExpandedCronId] = useState<string | null>(null);
  const timeline = summary?.timeline ?? [];
  const totals = summary?.totals;

  // Build KPI cards from real data when available
  const kpiCards = totals
    ? [
        { label: t('costs.totalTokenUsage'), value: formatTokens(totals.totalTokens), meta: `${totals.sessions} ${t('costs.sessions')}`, tone: 'text-[#667085]' },
        { label: t('costs.inputTokens'), value: formatTokens(totals.inputTokens), meta: `${t('costs.proportion')} ${totals.totalTokens > 0 ? Math.round(totals.inputTokens / totals.totalTokens * 100) : 0}%`, tone: 'text-[#667085]' },
        { label: t('costs.cacheSavingsLabel'), value: formatTokens(totals.cacheTokens), meta: `Hit Rate: ${totals.totalTokens > 0 ? Math.round(totals.cacheTokens / totals.totalTokens * 100) : 0}%`, tone: 'text-emerald-600' },
        { label: t('costs.estimatedCost'), value: formatCost(totals.costUsd), meta: '30 days', tone: 'text-[#ff6a00]' },
      ]
    : null;

  // Bar chart: last 7 days from timeline
  const last7 = timeline.slice(-7);
  const maxTokens = Math.max(...last7.map((d) => d.totalTokens), 1);

  // Top agents
  const topAgents = agentRows.slice(0, 5);
  const totalAgentTokens = agentRows.reduce((s, a) => s + a.totalTokens, 0);
  const topCrons = cronRows.slice(0, 5);

  return (
    <div className="space-y-5">
      {kpiCards ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {kpiCards.map((item) => (
            <div key={item.label} className="rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="text-[13px] text-[#8e8e93]">{item.label}</div>
              <div className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#111827]">{item.value}</div>
              <div className={cn('mt-2 text-[12px] font-medium', item.tone)}>{item.meta}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {[t('costs.totalTokenUsage'), t('costs.inputTokens'), t('costs.cacheSavingsLabel'), t('costs.estimatedCost')].map((label) => (
            <div key={label} className="rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="text-[13px] text-[#8e8e93]">{label}</div>
              <div className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#c6c6c8]">—</div>
              <div className="mt-2 text-[12px] text-[#c6c6c8]">{t('status.noData')}</div>
            </div>
          ))}
        </div>
      )}

      {analysis && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-[#c6c6c8] bg-white p-4">
            <p className="text-[13px] text-[#8e8e93]">Optimization Score</p>
            <p className="mt-2 text-[30px] font-semibold text-[#111827]">{analysis.optimizationScore}</p>
          </div>
          <div className="rounded-xl border border-[#c6c6c8] bg-white p-4">
            <p className="text-[13px] text-[#8e8e93]">Cache Savings</p>
            <p className="mt-2 text-[24px] font-semibold text-[#111827]">{formatCost(analysis.cacheSavings.estimatedCostUsd)}</p>
            <p className="mt-1 text-[12px] text-[#667085]">
              {formatTokens(analysis.cacheSavings.cacheTokens)} tokens ({analysis.cacheSavings.savingsRatePct}%)
            </p>
          </div>
          <div className="rounded-xl border border-[#c6c6c8] bg-white p-4">
            <p className="text-[13px] text-[#8e8e93]">Week-over-week</p>
            <p className="mt-2 text-[24px] font-semibold text-[#111827]">
              {analysis.weekOverWeek.deltas.totalTokensPct > 0 ? '+' : ''}
              {analysis.weekOverWeek.deltas.totalTokensPct}%
            </p>
            <p className="mt-1 text-[12px] text-[#667085]">
              Cost {analysis.weekOverWeek.deltas.costUsdPct > 0 ? '+' : ''}
              {analysis.weekOverWeek.deltas.costUsdPct}%
            </p>
          </div>
        </div>
      )}

      {analysis && (analysis.anomalies.length > 0 || analysis.insights.length > 0) && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-[#c6c6c8] bg-white p-4">
            <p className="mb-3 text-[14px] font-semibold text-[#334155]">Anomalies</p>
            {analysis.anomalies.length > 0 ? (
              <div className="space-y-2">
                {analysis.anomalies.map((row) => (
                  <div key={`${row.date}-${row.reason}`} className="rounded-lg border border-[#f2f2f7] px-3 py-2">
                    <p className="text-[12px] font-medium text-[#111827]">{row.date}</p>
                    <p className="text-[12px] text-[#667085]">{row.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#8e8e93]">No anomalies detected.</p>
            )}
          </div>
          <div className="rounded-xl border border-[#c6c6c8] bg-white p-4">
            <p className="mb-3 text-[14px] font-semibold text-[#334155]">Insights</p>
            <div className="space-y-2">
              {analysis.insights.map((insight) => (
                <p key={insight} className="rounded-lg border border-[#f2f2f7] px-3 py-2 text-[12px] text-[#334155]">
                  {insight}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="rounded-xl border border-[#c6c6c8] bg-white p-5">
          <p className="mb-4 text-[14px] font-semibold text-[#334155]">
            {t('costs.dailyTokenUsage')} {last7.length > 0 ? `(${last7.length}d)` : '(7 Days)'}
          </p>
          <div className="relative flex h-48 items-end gap-4 border-b border-[#eef2f6] pb-4">
            {[32, 72, 112, 152].map((offset) => (
              <div key={offset} className="absolute inset-x-0 border-t border-dashed border-[#eef2f6]" style={{ top: `${offset}px` }} />
            ))}
            {last7.length > 0 ? last7.map((bar) => {
              const h = Math.max(4, Math.round((bar.totalTokens / maxTokens) * 152));
              return (
                <div key={bar.date} className="relative z-[1] flex flex-1 flex-col items-center justify-end gap-2">
                  <div className="w-7 rounded-t-[6px] bg-clawx-ac/85" style={{ height: `${h}px` }} />
                  <span className="text-[10px] text-[#8e8e93]">{bar.date.slice(5)}</span>
                </div>
              );
            }) : (
              <div className="flex flex-1 items-center justify-center text-[13px] text-[#c6c6c8]">{t('status.noData')}</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#c6c6c8] bg-white p-5">
          <p className="mb-4 text-[14px] font-semibold text-[#334155]">{t('costs.tokenDistribution')}</p>
          {totals && totals.totalTokens > 0 ? (
            <div className="flex flex-col items-center gap-5">
              <div
                className="relative h-32 w-32 rounded-full"
                style={{
                  background: `conic-gradient(
                    #0a7aff 0% ${Math.round(totals.inputTokens / totals.totalTokens * 100)}%,
                    #10b981 ${Math.round(totals.inputTokens / totals.totalTokens * 100)}% ${Math.round((totals.inputTokens + totals.outputTokens) / totals.totalTokens * 100)}%,
                    #dbe2ea ${Math.round((totals.inputTokens + totals.outputTokens) / totals.totalTokens * 100)}% 100%
                  )`,
                }}
              >
                <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-[20px] font-bold text-[#111827]">{formatTokens(totals.totalTokens)}</span>
                  <span className="text-[10px] text-[#8e8e93]">Tokens</span>
                </div>
              </div>
              <div className="w-full space-y-3">
                {[
                  { label: 'Input', value: `${Math.round(totals.inputTokens / totals.totalTokens * 100)}% (${formatTokens(totals.inputTokens)})`, color: '#0a7aff' },
                  { label: 'Output', value: `${Math.round(totals.outputTokens / totals.totalTokens * 100)}% (${formatTokens(totals.outputTokens)})`, color: '#10b981' },
                  { label: 'Cache', value: `${Math.round(totals.cacheTokens / totals.totalTokens * 100)}% (${formatTokens(totals.cacheTokens)})`, color: '#dbe2ea' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 text-[12px]">
                    <span className="flex items-center gap-2 text-[#667085]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <span className="font-semibold text-[#111827]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="text-[28px] opacity-30">📊</span>
              <span className="text-[13px] text-[#8e8e93]">{t('costs.noUsageData')}</span>
            </div>
          )}
        </div>
      </div>

      {topAgents.length > 0 && (
        <div className="rounded-xl border border-[#c6c6c8] bg-white p-5">
          <p className="mb-4 text-[14px] font-semibold text-[#334155]">{t('costs.agentUsageRanking')}</p>
          <div className="overflow-x-auto">
            <table aria-label="Agent usage ranking table" className="min-w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#eef2f6] text-[#8e8e93]">
                  <th className="py-3 font-medium">Agent</th>
                  <th className="py-3 font-medium">{t('costs.sessions')}</th>
                  <th className="py-3 font-medium">{t('costs.input')}</th>
                  <th className="py-3 font-medium">{t('costs.output')}</th>
                  <th className="py-3 font-medium">{t('costs.proportion')}</th>
                  <th className="py-3 text-right font-medium">{t('costs.costUsd')}</th>
                </tr>
              </thead>
              <tbody>
                {topAgents.map((row) => {
                  const pct = totalAgentTokens > 0 ? Math.round(row.totalTokens / totalAgentTokens * 100) : 0;
                  return (
                    <tr key={row.agentId} className="border-b border-[#f7f8fa] last:border-b-0">
                      <td className="py-3 font-medium text-[#111827]">{row.agentId}</td>
                      <td className="py-3 text-[#667085]">{row.sessions}</td>
                      <td className="py-3 text-[#667085]">{formatTokens(row.inputTokens)}</td>
                      <td className="py-3 text-[#667085]">{formatTokens(row.outputTokens)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#f2f2f7]">
                            <div className="h-full rounded-full bg-clawx-ac" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-[#8e8e93]">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold text-[#111827]">{formatCost(row.costUsd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modelRows.length > 0 && (
        <div className="rounded-xl border border-[#c6c6c8] bg-white p-5">
          <p className="mb-4 text-[14px] font-semibold text-[#334155]">Model Costs</p>
          <div className="overflow-x-auto">
            <table aria-label="Model cost table" className="min-w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#eef2f6] text-[#8e8e93]">
                  <th className="py-3 font-medium">Model</th>
                  <th className="py-3 font-medium">Calls</th>
                  <th className="py-3 font-medium">{t('costs.input')}</th>
                  <th className="py-3 font-medium">{t('costs.output')}</th>
                  <th className="py-3 font-medium">Total Tokens</th>
                  <th className="py-3 text-right font-medium">{t('costs.costUsd')}</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((row) => (
                  <tr key={row.model} className="border-b border-[#f7f8fa] last:border-b-0">
                    <td className="py-3 font-medium text-[#111827]">{row.model}</td>
                    <td className="py-3 text-[#667085]">{row.count}</td>
                    <td className="py-3 text-[#667085]">{formatTokens(row.inputTokens)}</td>
                    <td className="py-3 text-[#667085]">{formatTokens(row.outputTokens)}</td>
                    <td className="py-3 text-[#111827]">{formatTokens(row.totalTokens)}</td>
                    <td className="py-3 text-right font-semibold text-[#111827]">{formatCost(row.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {topCrons.length > 0 && (
        <div className="rounded-xl border border-[#c6c6c8] bg-white p-5">
          <p className="mb-4 text-[14px] font-semibold text-[#334155]">Top Crons</p>
          <div className="space-y-3">
            {topCrons.map((row) => (
              <div
                key={row.cronJobId}
                className="flex items-center gap-4 rounded-xl border border-[#f2f2f7] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[#111827]">{row.cronName}</p>
                  <p className="mt-1 text-[11px] text-[#8e8e93]">
                    {row.sessions} runs · {formatTokens(row.inputTokens)} in · {formatTokens(row.outputTokens)} out
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-[#111827]">{formatTokens(row.totalTokens)}</p>
                  <p className="mt-1 text-[11px] text-[#ff6a00]">{formatCost(row.costUsd)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cronRows.length > 0 && (
        <div className="rounded-xl border border-[#c6c6c8] bg-white p-5">
          <p className="mb-4 text-[14px] font-semibold text-[#334155]">Cron Job Costs</p>
          <div className="overflow-x-auto">
            <table aria-label="Cron job costs table" className="min-w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#eef2f6] text-[#8e8e93]">
                  <th className="py-3 font-medium">Job</th>
                  <th className="py-3 font-medium">Runs</th>
                  <th className="py-3 font-medium">Input</th>
                  <th className="py-3 font-medium">Output</th>
                  <th className="py-3 font-medium">Total Tokens</th>
                  <th className="py-3 text-right font-medium">Cost ($)</th>
                  <th className="py-3 text-right font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {cronRows.map((row) => {
                  const avgTokensPerRun = row.avgTokensPerRun ?? (row.sessions > 0 ? Math.round(row.totalTokens / row.sessions) : 0);
                  const avgCostUsdPerRun = row.avgCostUsdPerRun ?? (row.sessions > 0 ? row.costUsd / row.sessions : 0);
                  const expanded = expandedCronId === row.cronJobId;
                  return (
                    <Fragment key={row.cronJobId}>
                      <tr className="border-b border-[#f7f8fa]">
                        <td className="py-3 font-medium text-[#111827]">{row.cronName}</td>
                        <td className="py-3 text-[#667085]">{row.sessions}</td>
                        <td className="py-3 text-[#667085]">{formatTokens(row.inputTokens)}</td>
                        <td className="py-3 text-[#667085]">{formatTokens(row.outputTokens)}</td>
                        <td className="py-3 text-[#111827]">{formatTokens(row.totalTokens)}</td>
                        <td className="py-3 text-right font-semibold text-[#111827]">{formatCost(row.costUsd)}</td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            aria-label={`Show details for ${row.cronName}`}
                            onClick={() => setExpandedCronId(expanded ? null : row.cronJobId)}
                            className="text-[12px] font-medium text-clawx-ac hover:underline"
                          >
                            {expanded ? 'Hide' : 'Show'}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-[#f7f8fa] bg-[#f8fafc]">
                          <td className="py-2 text-[12px] text-[#667085]" colSpan={7}>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                              <span>Job ID: {row.cronJobId}</span>
                              <span>Last run: {row.lastRunAt ? formatDate(row.lastRunAt) : 'N/A'}</span>
                              <span>Avg/run: {avgTokensPerRun} tokens 路 {formatCost(avgCostUsdPerRun)}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {topAgents.length === 0 && (
        <div className="rounded-xl border border-[#c6c6c8] bg-white p-5">
          <p className="mb-4 text-[14px] font-semibold text-[#334155]">{t('costs.agentUsageRanking')}</p>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="text-[28px] opacity-30">🤖</span>
            <span className="text-[13px] text-[#8e8e93]">{t('costs.noAgentData')}</span>
            <span className="text-[12px] text-[#c6c6c8]">{t('costs.noAgentDataDesc')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Usage Tab ─── */

function UsageTab({ agentRows }: { agentRows: AgentSummary[] }) {
  const { t } = useTranslation('common');
  const totalTokens = agentRows.reduce((s, a) => s + a.totalTokens, 0);

  if (agentRows.length === 0) {
    return (
      <div className="rounded-xl border border-[#c6c6c8] bg-white p-6">
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="text-[40px] opacity-30">📊</span>
          <p className="text-[14px] text-[#8e8e93]">{t('costs.noUsageAnalysis')}</p>
          <p className="text-[12px] text-[#c6c6c8]">{t('costs.noUsageAnalysisDesc')}</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#0ea5e9', '#64748b'];
  const gradientStops = agentRows.slice(0, 10).reduce(
    (acc, a, i) => {
      const pct = totalTokens > 0 ? (a.totalTokens / totalTokens) * 100 : 0;
      const stop = `${COLORS[i % COLORS.length]} ${acc.cumPct.toFixed(1)}% ${(acc.cumPct + pct).toFixed(1)}%`;
      return {
        stops: [...acc.stops, stop],
        cumPct: acc.cumPct + pct,
      };
    },
    { stops: [] as string[], cumPct: 0 },
  ).stops;

  return (
    <div className="rounded-xl border border-[#c6c6c8] bg-white p-6">
      <p className="text-[12px] text-[#8e8e93]">{t('costs.statsScope')}</p>
      <div className="mt-1 text-[28px] font-bold tracking-[-0.04em] text-[#111827]">{formatTokens(totalTokens)} Total Tokens</div>
      <div className="mt-6 grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div
          className="relative mx-auto h-[280px] w-[280px] rounded-full"
          style={{ background: `conic-gradient(${gradientStops.join(', ')})` }}
        >
          <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-[14px] font-semibold text-[#667085]">Agent</span>
            <span className="mt-1 text-[20px] font-bold text-[#111827]">{agentRows.length}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {agentRows.slice(0, 10).map((item, i) => {
            const pct = totalTokens > 0 ? (item.totalTokens / totalTokens * 100).toFixed(1) : '0';
            return (
              <div key={item.agentId} className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors hover:bg-[#f8fafc]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="flex-1 font-medium text-[#111827]">{item.agentId}</span>
                <span className="text-[#8e8e93]">{pct}% ({formatTokens(item.totalTokens)})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Alerts Tab ─── */

function AlertsTab() {
  const { t } = useTranslation('common');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<AlertRule['type']>('daily_token');
  const [addThreshold, setAddThreshold] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hostApiFetch<AlertRule[]>('/api/alerts');
      setRules(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchRules(); }, [fetchRules]);

  const handleAdd = async () => {
    if (!addName.trim() || !addThreshold.trim()) return;
    setAdding(true);
    try {
      await hostApiFetch('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({ name: addName.trim(), type: addType, threshold: Number(addThreshold) }),
      });
      setAddName('');
      setAddThreshold('');
      await fetchRules();
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (rule: AlertRule) => {
    await hostApiFetch(`/api/alerts/${encodeURIComponent(rule.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    await fetchRules();
  };

  const handleDelete = async (id: string) => {
    await hostApiFetch(`/api/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await fetchRules();
  };

  const TYPE_LABELS: Record<AlertRule['type'], string> = {
    daily_token: t('costs.dailyToken'),
    cost_usd: t('costs.costUsdLabel'),
    session_count: t('costs.sessionCount'),
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <h3 className="mb-4 text-[15px] font-semibold text-[#000000]">{t('costs.newAlertRule')}</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <p className="mb-1 text-[12px] font-medium text-[#3c3c43]">{t('costs.ruleName')}</p>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="如：日均 Token 超限"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
            />
          </div>
          <div className="w-[140px]">
            <p className="mb-1 text-[12px] font-medium text-[#3c3c43]">类型</p>
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as AlertRule['type'])}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
            >
              <option value="daily_token">{t('costs.dailyToken')}</option>
              <option value="cost_usd">{t('costs.costUsdLabel')}</option>
              <option value="session_count">{t('costs.sessionCount')}</option>
            </select>
          </div>
          <div className="w-[120px]">
            <p className="mb-1 text-[12px] font-medium text-[#3c3c43]">阈值</p>
            <input
              value={addThreshold}
              onChange={(e) => setAddThreshold(e.target.value)}
              placeholder="200000"
              type="number"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={adding || !addName.trim() || !addThreshold.trim()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-clawx-ac px-3 text-[13px] text-white hover:bg-[#0056b3] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('actions.add')}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <h3 className="mb-4 text-[15px] font-semibold text-[#000000]">告警规则列表</h3>
        {loading ? (
          <div className="space-y-2 py-2">
            <SkeletonText lines={3} />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="text-[28px] opacity-30">🔔</span>
            <p className="text-[13px] text-[#8e8e93]">暂无告警规则</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f2f2f7]">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 py-3">
                <Switch checked={rule.enabled} onCheckedChange={() => void handleToggle(rule)} />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[#000000]">{rule.name}</p>
                  <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                    {TYPE_LABELS[rule.type]} &gt; {rule.threshold.toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(rule.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#8e8e93] hover:bg-[#fef2f2] hover:text-[#ef4444]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
