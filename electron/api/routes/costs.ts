import type { IncomingMessage, ServerResponse } from 'http';
import { getRecentTokenUsageHistory } from '../../utils/token-usage';
import type { HostApiContext } from '../context';
import { sendJson } from '../route-utils';

interface DaySummary {
  date: string; // YYYY-MM-DD
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  costUsd: number;
  sessions: number;
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
  avgTokensPerRun: number;
  avgCostUsdPerRun: number;
  lastRunAt: string | null;
}

interface AnalysisWindowSummary {
  totalTokens: number;
  costUsd: number;
  sessions: number;
  cacheTokens: number;
}

interface CostsAnalysisResponse {
  optimizationScore: number;
  anomalies: Array<{
    date: string;
    totalTokens: number;
    costUsd: number;
    zScore: number;
    reason: string;
  }>;
  weekOverWeek: {
    previous: AnalysisWindowSummary;
    current: AnalysisWindowSummary;
    deltas: {
      totalTokensPct: number;
      costUsdPct: number;
      sessionsPct: number;
      cacheTokensPct: number;
    };
  };
  cacheSavings: {
    cacheTokens: number;
    estimatedCostUsd: number;
    savingsRatePct: number;
  };
  insights: string[];
}

function roundTo(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computePctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return roundTo(((current - previous) / previous) * 100, 1);
}

function summarizeWindow(days: DaySummary[]): AnalysisWindowSummary {
  return days.reduce<AnalysisWindowSummary>(
    (acc, day) => ({
      totalTokens: acc.totalTokens + day.totalTokens,
      costUsd: acc.costUsd + day.costUsd,
      sessions: acc.sessions + day.sessions,
      cacheTokens: acc.cacheTokens + day.cacheTokens,
    }),
    { totalTokens: 0, costUsd: 0, sessions: 0, cacheTokens: 0 },
  );
}

async function getCronNameById(ctx: HostApiContext): Promise<Map<string, string>> {
  try {
    const result = await ctx.gatewayManager.rpc<{ jobs?: Array<{ id?: string; name?: string }> }>(
      'cron.list',
      { includeDisabled: true },
    );
    return new Map(
      (result.jobs ?? [])
        .filter((job): job is { id: string; name?: string } => typeof job?.id === 'string' && job.id.trim().length > 0)
        .map((job) => [job.id, job.name?.trim() || job.id]),
    );
  } catch {
    // Fall back to raw job ids when cron metadata is unavailable.
    return new Map<string, string>();
  }
}

export async function handleCostsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/costs/')) return false;

  const entries = await getRecentTokenUsageHistory(2000);

  if (url.pathname === '/api/costs/summary' && req.method === 'GET') {
    const days = Number(url.searchParams.get('days') ?? '30');
    const cutoff = Date.now() - days * 86_400_000;

    const dayMap = new Map<string, DaySummary>();
    const sessionSet = new Set<string>();

    for (const e of entries) {
      const ts = new Date(e.timestamp).getTime();
      if (ts < cutoff) continue;
      const date = e.timestamp.slice(0, 10);
      const prev = dayMap.get(date) ?? {
        date,
        inputTokens: 0,
        outputTokens: 0,
        cacheTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        sessions: 0,
      };
      const sessionKey = `${date}:${e.sessionId}`;
      if (!sessionSet.has(sessionKey)) {
        sessionSet.add(sessionKey);
        prev.sessions += 1;
      }
      prev.inputTokens += e.inputTokens;
      prev.outputTokens += e.outputTokens;
      prev.cacheTokens += e.cacheReadTokens + e.cacheWriteTokens;
      prev.totalTokens += e.totalTokens;
      prev.costUsd += e.costUsd ?? 0;
      dayMap.set(date, prev);
    }

    const timeline = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const totals = timeline.reduce(
      (acc, d) => ({
        inputTokens: acc.inputTokens + d.inputTokens,
        outputTokens: acc.outputTokens + d.outputTokens,
        cacheTokens: acc.cacheTokens + d.cacheTokens,
        totalTokens: acc.totalTokens + d.totalTokens,
        costUsd: acc.costUsd + d.costUsd,
        sessions: acc.sessions + d.sessions,
      }),
      { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, sessions: 0 },
    );

    sendJson(res, 200, { timeline, totals });
    return true;
  }

  if (url.pathname === '/api/costs/by-agent' && req.method === 'GET') {
    const agentMap = new Map<string, AgentSummary>();
    const sessionSet = new Set<string>();

    for (const e of entries) {
      const key = e.agentId || 'unknown';
      const prev = agentMap.get(key) ?? {
        agentId: key,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        sessions: 0,
      };
      const sessionKey = `${key}:${e.sessionId}`;
      if (!sessionSet.has(sessionKey)) {
        sessionSet.add(sessionKey);
        prev.sessions += 1;
      }
      prev.totalTokens += e.totalTokens;
      prev.inputTokens += e.inputTokens;
      prev.outputTokens += e.outputTokens;
      prev.costUsd += e.costUsd ?? 0;
      agentMap.set(key, prev);
    }

    const rows = [...agentMap.values()].sort((a, b) => b.totalTokens - a.totalTokens);
    sendJson(res, 200, rows);
    return true;
  }

  if (url.pathname === '/api/costs/by-model' && req.method === 'GET') {
    const modelMap = new Map<string, ModelSummary>();

    for (const e of entries) {
      const key = e.model ?? 'unknown';
      const prev = modelMap.get(key) ?? {
        model: key,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        count: 0,
      };
      prev.totalTokens += e.totalTokens;
      prev.inputTokens += e.inputTokens;
      prev.outputTokens += e.outputTokens;
      prev.costUsd += e.costUsd ?? 0;
      prev.count += 1;
      modelMap.set(key, prev);
    }

    const rows = [...modelMap.values()].sort((a, b) => b.totalTokens - a.totalTokens);
    sendJson(res, 200, rows);
    return true;
  }

  if (url.pathname === '/api/costs/analysis' && req.method === 'GET') {
    const dayMap = new Map<string, DaySummary>();
    const dayCronTokenMap = new Map<string, Map<string, number>>();
    const sessionSet = new Set<string>();

    for (const entry of entries) {
      const date = entry.timestamp.slice(0, 10);
      const prev = dayMap.get(date) ?? {
        date,
        inputTokens: 0,
        outputTokens: 0,
        cacheTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        sessions: 0,
      };

      const sessionKey = `${date}:${entry.sessionId}`;
      if (!sessionSet.has(sessionKey)) {
        sessionSet.add(sessionKey);
        prev.sessions += 1;
      }

      prev.inputTokens += entry.inputTokens;
      prev.outputTokens += entry.outputTokens;
      prev.cacheTokens += entry.cacheReadTokens + entry.cacheWriteTokens;
      prev.totalTokens += entry.totalTokens;
      prev.costUsd += entry.costUsd ?? 0;
      dayMap.set(date, prev);

      if (entry.cronJobId) {
        const cronTokens = dayCronTokenMap.get(date) ?? new Map<string, number>();
        cronTokens.set(entry.cronJobId, (cronTokens.get(entry.cronJobId) ?? 0) + entry.totalTokens);
        dayCronTokenMap.set(date, cronTokens);
      }
    }

    const timeline = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const last14Days = timeline.slice(-14);
    const previous = summarizeWindow(last14Days.slice(0, 7));
    const current = summarizeWindow(last14Days.slice(-7));

    const deltas = {
      totalTokensPct: computePctDelta(current.totalTokens, previous.totalTokens),
      costUsdPct: computePctDelta(current.costUsd, previous.costUsd),
      sessionsPct: computePctDelta(current.sessions, previous.sessions),
      cacheTokensPct: computePctDelta(current.cacheTokens, previous.cacheTokens),
    };

    const totalTokens = last14Days.reduce((acc, day) => acc + day.totalTokens, 0);
    const totalCostUsd = last14Days.reduce((acc, day) => acc + day.costUsd, 0);
    const cacheTokens = last14Days.reduce((acc, day) => acc + day.cacheTokens, 0);
    const avgCostPerToken = totalTokens > 0 ? totalCostUsd / totalTokens : 0;
    const estimatedCostUsd = roundTo(avgCostPerToken * cacheTokens, 6);
    const savingsRatePct = totalCostUsd + estimatedCostUsd > 0
      ? roundTo((estimatedCostUsd / (totalCostUsd + estimatedCostUsd)) * 100, 1)
      : 0;

    const tokenValues = last14Days.map((day) => day.totalTokens);
    const meanTokens = tokenValues.length > 0
      ? tokenValues.reduce((acc, value) => acc + value, 0) / tokenValues.length
      : 0;
    const stdDev = tokenValues.length > 0
      ? Math.sqrt(tokenValues.reduce((acc, value) => acc + ((value - meanTokens) ** 2), 0) / tokenValues.length)
      : 0;

    const cronNameById = await getCronNameById(ctx);
    const anomalies = last14Days
      .map((day) => {
        if (stdDev === 0) return null;
        const zScore = (day.totalTokens - meanTokens) / stdDev;
        if (zScore < 1.5) return null;

        const cronTokens = dayCronTokenMap.get(day.date);
        let reason = 'Token usage significantly above baseline.';
        if (cronTokens && cronTokens.size > 0) {
          const topCron = [...cronTokens.entries()].sort((a, b) => b[1] - a[1])[0];
          if (topCron) {
            const cronName = cronNameById.get(topCron[0]) ?? topCron[0];
            reason = `Usage spike linked to ${cronName}.`;
          }
        }

        return {
          date: day.date,
          totalTokens: day.totalTokens,
          costUsd: roundTo(day.costUsd, 6),
          zScore: roundTo(zScore, 2),
          reason,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.zScore - a.zScore)
      .slice(0, 5);

    const cacheHitRate = totalTokens > 0 ? cacheTokens / totalTokens : 0;
    const trendPenalty = deltas.costUsdPct > 0
      ? Math.min(20, deltas.costUsdPct / 2)
      : -Math.min(20, Math.abs(deltas.costUsdPct) / 2);
    const anomalyPenalty = Math.min(20, anomalies.length * 8);
    const optimizationScore = clamp(
      Math.round(70 + cacheHitRate * 20 - trendPenalty - anomalyPenalty),
      0,
      100,
    );

    const insights = [
      `Token usage is ${deltas.totalTokensPct >= 0 ? 'up' : 'down'} ${Math.abs(deltas.totalTokensPct)}% week over week.`,
      `Cache activity avoided about $${estimatedCostUsd.toFixed(4)} in spend.`,
    ];
    if (anomalies.length > 0) {
      const topAnomaly = anomalies[0];
      insights.push(`${topAnomaly.date} is an outlier: ${topAnomaly.reason}`);
    }

    const response: CostsAnalysisResponse = {
      optimizationScore,
      anomalies,
      weekOverWeek: {
        previous: {
          ...previous,
          costUsd: roundTo(previous.costUsd, 6),
        },
        current: {
          ...current,
          costUsd: roundTo(current.costUsd, 6),
        },
        deltas,
      },
      cacheSavings: {
        cacheTokens,
        estimatedCostUsd,
        savingsRatePct,
      },
      insights,
    };
    sendJson(res, 200, response);
    return true;
  }

  if (url.pathname === '/api/costs/by-cron' && req.method === 'GET') {
    const cronMap = new Map<string, CronSummary>();
    const sessionSet = new Set<string>();

    const cronNameById = await getCronNameById(ctx);

    for (const entry of entries) {
      if (!entry.cronJobId) continue;
      const key = entry.cronJobId;
      const prev = cronMap.get(key) ?? {
        cronJobId: key,
        cronName: cronNameById.get(key) ?? key,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        sessions: 0,
        avgTokensPerRun: 0,
        avgCostUsdPerRun: 0,
        lastRunAt: null,
      };
      const sessionKey = `${key}:${entry.sessionId}`;
      if (!sessionSet.has(sessionKey)) {
        sessionSet.add(sessionKey);
        prev.sessions += 1;
      }
      prev.totalTokens += entry.totalTokens;
      prev.inputTokens += entry.inputTokens;
      prev.outputTokens += entry.outputTokens;
      prev.costUsd += entry.costUsd ?? 0;
      if (!prev.lastRunAt || new Date(entry.timestamp).getTime() > new Date(prev.lastRunAt).getTime()) {
        prev.lastRunAt = entry.timestamp;
      }
      cronMap.set(key, prev);
    }

    const rows = [...cronMap.values()]
      .map((row) => ({
        ...row,
        avgTokensPerRun: row.sessions > 0 ? Math.round(row.totalTokens / row.sessions) : 0,
        avgCostUsdPerRun: row.sessions > 0 ? Number((row.costUsd / row.sessions).toFixed(6)) : 0,
        costUsd: Number(row.costUsd.toFixed(6)),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
    sendJson(res, 200, rows);
    return true;
  }

  return false;
}
