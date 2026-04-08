import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { FeedbackBanner } from '@/components/common/FeedbackBanner';
import { FeedbackState } from '@/components/common/FeedbackState';
import { SkeletonActivityFeed } from '@/components/ui/Skeleton';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogLevelFilter = LogLevel | 'all';
type EventCategory = 'system' | 'agent' | 'cron' | 'channel' | 'error';
type EventCategoryFilter = EventCategory | 'all';

interface ActivityEntry {
  id: string;
  raw: string;
  timestamp: string | null;
  level: LogLevel;
  category: EventCategory;
  title: string;
  detail: string;
}

interface LogsResponse {
  content: string;
}

const LEVEL_RE = /\[(INFO|WARN|ERROR|DEBUG)\]|\b(INFO|WARN|ERROR|DEBUG)\b/i;
const TIMESTAMP_RE =
  /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/;

const LEVEL_BADGE: Record<LogLevel, string> = {
  info: 'bg-[#eff6ff] text-[#1d4ed8]',
  warn: 'bg-[#fffbeb] text-[#b45309]',
  error: 'bg-[#fef2f2] text-[#b91c1c]',
  debug: 'bg-[#f5f3ff] text-[#6d28d9]',
};
const LIVE_REFRESH_INTERVAL_MS = 5000;

function detectLevel(line: string): LogLevel {
  const match = line.match(LEVEL_RE);
  const token = (match?.[1] ?? match?.[2] ?? '').toLowerCase();
  if (token === 'warn') return 'warn';
  if (token === 'error') return 'error';
  if (token === 'debug') return 'debug';
  return 'info';
}

function detectTimestamp(line: string): string | null {
  const match = line.match(TIMESTAMP_RE);
  return match?.[0] ?? null;
}

function splitTitleAndDetail(message: string): { title: string; detail: string } {
  const normalized = message.trim();
  if (!normalized) return { title: '日志事件', detail: '' };

  const dashIndex = normalized.indexOf(' - ');
  if (dashIndex > 0) {
    return {
      title: normalized.slice(0, dashIndex).trim(),
      detail: normalized.slice(dashIndex + 3).trim(),
    };
  }

  const colonIndex = normalized.indexOf(': ');
  if (colonIndex > 0) {
    return {
      title: normalized.slice(0, colonIndex).trim(),
      detail: normalized.slice(colonIndex + 2).trim(),
    };
  }

  return { title: normalized, detail: normalized };
}

function detectCategory(rawLine: string, level: LogLevel): EventCategory {
  const source = rawLine.toLowerCase();

  if (
    level === 'error'
    || source.includes('error')
    || source.includes('fail')
    || source.includes('exception')
    || source.includes('timeout')
  ) {
    return 'error';
  }
  if (source.includes('cron') || source.includes('scheduler') || source.includes('heartbeat')) {
    return 'cron';
  }
  if (source.includes('agent') || source.includes('planner') || source.includes('worker')) {
    return 'agent';
  }
  if (
    source.includes('channel')
    || source.includes('feishu')
    || source.includes('dingtalk')
    || source.includes('wecom')
    || source.includes('qq')
  ) {
    return 'channel';
  }
  return 'system';
}

function collectRawEntries(content: string): string[] {
  const rawLines = content.split('\n').map((line) => line.replace(/\r$/, ''));
  const entries: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const startsNewEntry = !!detectTimestamp(trimmed)
      || /^\[(INFO|WARN|ERROR|DEBUG)\]/i.test(trimmed);

    if (startsNewEntry || entries.length === 0) {
      entries.push(trimmed);
      continue;
    }

    entries[entries.length - 1] = `${entries[entries.length - 1]}\n${trimmed}`;
  }

  return entries;
}

function normalizeMessage(rawLine: string, timestamp: string | null): string {
  let message = rawLine;
  if (timestamp) {
    message = message.replace(timestamp, '');
  }
  message = message.replace(/\[(INFO|WARN|ERROR|DEBUG)\]/gi, '');
  message = message.replace(/\b(INFO|WARN|ERROR|DEBUG)\b/i, '');
  message = message.replace(/^[\s\-:|]+/, '').trim();
  return message;
}

function parseLogContent(content: string): ActivityEntry[] {
  return collectRawEntries(content)
    .map((raw, index) => {
      const level = detectLevel(raw);
      const timestamp = detectTimestamp(raw);
      const message = normalizeMessage(raw, timestamp);
      const structured = splitTitleAndDetail(message);
      return {
        id: `${index}-${raw.slice(0, 20)}`,
        raw,
        timestamp,
        level,
        category: detectCategory(raw, level),
        title: structured.title || '日志事件',
        detail: structured.detail,
      };
    });
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return '无时间戳';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return parsed.toLocaleString('zh-CN');
}

function formatCategoryLabel(value: EventCategory): string {
  switch (value) {
    case 'system':
      return '系统';
    case 'agent':
      return '分身';
    case 'cron':
      return '定时任务';
    case 'channel':
      return '频道';
    case 'error':
      return '错误';
    default:
      return value;
  }
}

export function Activity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<EventCategoryFilter>('all');
  const [expandedRaw, setExpandedRaw] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async (options?: { showLoading?: boolean }) => {
    const shouldShowLoading = options?.showLoading ?? true;
    if (shouldShowLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await hostApiFetch<LogsResponse>('/api/logs?tailLines=400');
      const parsed = parseLogContent(typeof response?.content === 'string' ? response.content : '');
      setEntries(parsed);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : String(fetchError ?? 'Unknown error');
      setError(message);
      setEntries([]);
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!isLive) return undefined;

    const intervalId = window.setInterval(() => {
      void fetchLogs({ showLoading: false });
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchLogs, isLive]);

  const filteredEntries = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (!keyword) return true;
      const searchable = `${entry.title} ${entry.detail} ${entry.raw}`.toLowerCase();
      return searchable.includes(keyword);
    });
  }, [categoryFilter, entries, levelFilter, search]);

  const totalCount = entries.length;
  const errorCount = entries.filter((entry) => entry.level === 'error').length;
  const levelSummary = entries.reduce<Record<LogLevel, number>>(
    (summary, entry) => {
      summary[entry.level] += 1;
      return summary;
    },
    { info: 0, warn: 0, error: 0, debug: 0 },
  );

  const toggleRaw = useCallback((id: string) => {
    setExpandedRaw((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#c6c6c8] bg-white px-5">
        <h1 className="text-[15px] font-semibold text-[#000000]">活动日志</h1>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#6b7280]">
            {isLive ? '每 5 秒自动刷新' : '自动刷新已暂停'}
          </span>
          <button
            type="button"
            aria-pressed={isLive}
            onClick={() => setIsLive((previous) => !previous)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[13px] transition-colors',
              isLive
                ? 'bg-[#e8f1ff] text-[#1d4ed8] hover:bg-[#dbe9ff]'
                : 'bg-[#f2f2f7] text-[#3c3c43] hover:bg-[#e6e6eb]',
            )}
          >
            {isLive ? '实时刷新：开启' : '实时刷新：关闭'}
          </button>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-[13px] text-[#3c3c43] transition-colors hover:bg-[#f2f2f7] disabled:opacity-60"
          >
            刷新
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard title="总条目" value={String(totalCount)} subtitle="已解析原始日志" />
          <SummaryCard title="错误" value={String(errorCount)} subtitle="潜在失败" />
          <SummaryCard
            title="级别概览"
            value={`显示 ${filteredEntries.length} 条`}
            subtitle={`I:${levelSummary.info} W:${levelSummary.warn} E:${levelSummary.error} D:${levelSummary.debug}`}
          />
        </div>

        <section className="mt-4 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-[12px] font-medium text-[#3c3c43]">
              搜索日志
              <input
                aria-label="搜索日志"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索标题、详情或原始日志"
                className="mt-1 h-9 w-full rounded-lg border border-[#d1d1d6] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-clawx-ac"
              />
            </label>
            <label className="text-[12px] font-medium text-[#3c3c43]">
              级别筛选
              <select
                aria-label="级别筛选"
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value as LogLevelFilter)}
                className="mt-1 h-9 w-full rounded-lg border border-[#d1d1d6] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-clawx-ac"
              >
                <option value="all">全部级别</option>
                <option value="info">信息</option>
                <option value="warn">警告</option>
                <option value="error">错误</option>
                <option value="debug">调试</option>
              </select>
            </label>
            <label className="text-[12px] font-medium text-[#3c3c43]">
              分类筛选
              <select
                aria-label="分类筛选"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as EventCategoryFilter)}
                className="mt-1 h-9 w-full rounded-lg border border-[#d1d1d6] bg-white px-3 text-[13px] text-[#111827] outline-none focus:border-clawx-ac"
              >
                <option value="all">全部分类</option>
                <option value="system">系统</option>
                <option value="agent">分身</option>
                <option value="cron">定时任务</option>
                <option value="channel">频道</option>
                <option value="error">错误</option>
              </select>
            </label>
          </div>
        </section>

        <section className="mt-4 rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          {loading && (
            <div className="px-4 py-4">
              <SkeletonActivityFeed testId="activity-loading-skeleton" />
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3 px-4 py-4">
              <FeedbackBanner
                bannerId="activity-logs-fetch-error"
                tone="error"
                title="活动日志请求失败"
                description={error}
              />
              <FeedbackState
                state="error"
                title="加载活动日志失败。"
                description="请稍后重试或检查网关状态。"
                align="start"
                testId="activity-feedback-error"
                className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-5"
                action={(
                  <button
                    type="button"
                    onClick={() => void fetchLogs()}
                    className="rounded-lg border border-[#fca5a5] bg-white px-3 py-1.5 text-[12px] font-medium text-[#b91c1c] hover:bg-[#fef2f2]"
                  >
                    重试
                  </button>
                )}
              />
            </div>
          )}

          {!loading && !error && totalCount === 0 && (
            <FeedbackState
              state="empty"
              title="暂无活动日志。"
              testId="activity-feedback-empty"
              className="px-4 py-8"
            />
          )}

          {!loading && !error && totalCount > 0 && filteredEntries.length === 0 && (
            <FeedbackState
              state="empty"
              title="没有符合当前筛选条件的日志。"
              className="px-4 py-8"
            />
          )}

          {!loading && !error && filteredEntries.length > 0 && (
            <div className="divide-y divide-[#f2f2f7]">
              {filteredEntries.map((entry) => {
                const expanded = expandedRaw.has(entry.id);
                return (
                  <article key={entry.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-[#8e8e93]">{formatTimestamp(entry.timestamp)}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px]',
                          LEVEL_BADGE[entry.level],
                        )}
                      >
                        {entry.level}
                      </span>
                      <span className="rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[10px] font-medium uppercase text-[#3c3c43]">
                        {formatCategoryLabel(entry.category)}
                      </span>
                    </div>

                    <h3 className="mt-2 text-[14px] font-semibold text-[#111827]">{entry.title}</h3>
                    {entry.detail && entry.detail !== entry.title && (
                      <p className="mt-1 text-[12px] text-[#4b5563]">{entry.detail}</p>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleRaw(entry.id)}
                      className="mt-2 text-[12px] font-medium text-clawx-ac hover:underline"
                    >
                      {expanded ? '隐藏原始日志' : '查看原始日志'}
                    </button>

                    {expanded && (
                      <div className="mt-2 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#64748b]">
                          原始日志
                        </p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[12px] text-[#111827]">
                          {entry.raw}
                        </pre>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <p className="text-[12px] font-medium text-[#8e8e93]">{title}</p>
      <p className="mt-1 text-[22px] font-semibold text-[#111827]">{value}</p>
      <p className="mt-1 text-[11px] text-[#9ca3af]">{subtitle}</p>
    </div>
  );
}
