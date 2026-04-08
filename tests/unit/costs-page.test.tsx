import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Costs } from '@/pages/Costs';
import { SettingsCostsUsagePanel } from '@/components/settings-center/settings-costs-usage-panel';
import { hostApiFetch } from '@/lib/host-api';

const { subscribeHostEventMock } = vi.hoisted(() => ({
  subscribeHostEventMock: vi.fn(),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: subscribeHostEventMock,
}));

describe('Costs page usage display', () => {
  const recentEntries = [
    {
      timestamp: '2026-03-23T12:34:00Z',
      sessionId: 'session-1',
      agentId: 'planner-agent',
      model: 'gpt-5.2',
      provider: 'openai',
      inputTokens: 1200,
      outputTokens: 800,
      cacheReadTokens: 100,
      cacheWriteTokens: 50,
      totalTokens: 2150,
      costUsd: 0.1234,
    },
    {
      timestamp: '2026-03-23T13:20:00Z',
      sessionId: 'session-2',
      agentId: 'research-agent',
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      inputTokens: 300,
      outputTokens: 400,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      totalTokens: 715,
      costUsd: 0.0044,
    },
  ];

  const summary = {
    timeline: [
      { date: '2026-03-17', inputTokens: 120, outputTokens: 80, cacheTokens: 10, totalTokens: 210, costUsd: 0.12, sessions: 1 },
      { date: '2026-03-18', inputTokens: 180, outputTokens: 120, cacheTokens: 15, totalTokens: 315, costUsd: 0.2, sessions: 2 },
      { date: '2026-03-19', inputTokens: 200, outputTokens: 140, cacheTokens: 20, totalTokens: 360, costUsd: 0.25, sessions: 2 },
      { date: '2026-03-20', inputTokens: 240, outputTokens: 160, cacheTokens: 25, totalTokens: 425, costUsd: 0.3, sessions: 2 },
      { date: '2026-03-21', inputTokens: 280, outputTokens: 200, cacheTokens: 30, totalTokens: 510, costUsd: 0.32, sessions: 2 },
      { date: '2026-03-22', inputTokens: 200, outputTokens: 160, cacheTokens: 20, totalTokens: 380, costUsd: 0.28, sessions: 2 },
      { date: '2026-03-23', inputTokens: 280, outputTokens: 200, cacheTokens: 30, totalTokens: 510, costUsd: 0.29, sessions: 1 },
    ],
    totals: {
      inputTokens: 1500,
      outputTokens: 900,
      cacheTokens: 100,
      totalTokens: 2500,
      costUsd: 1.2345,
      sessions: 12,
    },
  };

  const agentRows = [
    {
      agentId: 'planner-agent',
      totalTokens: 2000,
      inputTokens: 1200,
      outputTokens: 800,
      costUsd: 0.9,
      sessions: 8,
    },
    {
      agentId: 'research-agent',
      totalTokens: 500,
      inputTokens: 300,
      outputTokens: 200,
      costUsd: 0.3,
      sessions: 4,
    },
  ];

  const modelSummaryRows = [
    {
      model: 'gpt-5.2',
      totalTokens: 2150,
      inputTokens: 1200,
      outputTokens: 800,
      costUsd: 0.1234,
      count: 1,
    },
    {
      model: 'claude-sonnet-4',
      totalTokens: 715,
      inputTokens: 300,
      outputTokens: 400,
      costUsd: 0.0044,
      count: 1,
    },
  ];

  const cronRows = [
    {
      cronJobId: 'job-nightly-digest',
      cronName: 'Nightly Digest',
      totalTokens: 900,
      inputTokens: 500,
      outputTokens: 400,
      costUsd: 0.42,
      sessions: 3,
      avgTokensPerRun: 300,
      avgCostUsdPerRun: 0.14,
      lastRunAt: '2026-03-23T08:00:00.000Z',
    },
    {
      cronJobId: 'job-hourly-cleanup',
      cronName: 'Hourly Cleanup',
      totalTokens: 200,
      inputTokens: 120,
      outputTokens: 80,
      costUsd: 0.08,
      sessions: 4,
      avgTokensPerRun: 50,
      avgCostUsdPerRun: 0.02,
      lastRunAt: '2026-03-23T09:00:00.000Z',
    },
  ];

  const analysis = {
    optimizationScore: 74,
    cacheSavings: {
      cacheTokens: 340,
      estimatedCostUsd: 0.21,
      savingsRatePct: 12.6,
    },
    weekOverWeek: {
      previous: { totalTokens: 2000, costUsd: 0.9, sessions: 7, cacheTokens: 180 },
      current: { totalTokens: 2600, costUsd: 1.1, sessions: 9, cacheTokens: 240 },
      deltas: { totalTokensPct: 30, costUsdPct: 22.2, sessionsPct: 28.6, cacheTokensPct: 33.3 },
    },
    anomalies: [
      {
        date: '2026-03-22',
        totalTokens: 980,
        costUsd: 0.31,
        zScore: 2.4,
        reason: 'Nightly Digest spike',
      },
    ],
    insights: [
      'Costs climbed week over week; consider tuning prompts.',
      'Cache usage avoided measurable spend this period.',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    subscribeHostEventMock.mockImplementation(() => () => undefined);
    vi.mocked(hostApiFetch).mockImplementation(async (path) => {
      if (path === '/api/usage/recent-token-history?limit=200') {
        return recentEntries;
      }
      if (path === '/api/costs/summary?days=30') {
        return summary;
      }
      if (path === '/api/costs/by-agent') {
        return agentRows;
      }
      if (path === '/api/costs/by-model') {
        return modelSummaryRows;
      }
      if (path === '/api/costs/by-cron') {
        return cronRows;
      }
      if (path === '/api/costs/analysis') {
        return analysis;
      }
      throw new Error(`Unexpected hostApiFetch call: ${String(path)}`);
    });
  });

  it('renders recent usage, summary KPIs, and by-agent breakdown', async () => {
    render(<Costs />);

    expect(await screen.findByText('最近记录 (2)')).toBeInTheDocument();
    const realtimeTable = screen.getByRole('table');
    const realtimeCells = within(realtimeTable);
    expect(realtimeCells.getByText('planner-agent')).toBeInTheDocument();
    expect(realtimeCells.getByText('gpt-5.2')).toBeInTheDocument();
    expect(realtimeCells.getByText('$0.1234')).toBeInTheDocument();
    expect(screen.getByText('$0.1278')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '大盘监控' }));
    expect(await screen.findByText('12 次会话')).toBeInTheDocument();
    expect(screen.getByText('$1.2345')).toBeInTheDocument();
    expect(screen.getByText('Top Crons')).toBeInTheDocument();
    expect(screen.getAllByText('Nightly Digest').length).toBeGreaterThan(0);
    const agentTable = screen.getByRole('table', { name: 'Agent usage ranking table' });
    const dashboardCells = within(agentTable);
    expect(dashboardCells.getByText('planner-agent')).toBeInTheDocument();
    expect(dashboardCells.getByText('$0.9000')).toBeInTheDocument();
    expect(screen.getByText('Model Costs')).toBeInTheDocument();
    const modelTable = screen.getByRole('table', { name: 'Model cost table' });
    const modelCells = within(modelTable);
    expect(modelCells.getByText('gpt-5.2')).toBeInTheDocument();
    expect(modelCells.getByText('$0.1234')).toBeInTheDocument();
    expect(screen.getByText('Cron Job Costs')).toBeInTheDocument();
    const cronTable = screen.getByRole('table', { name: 'Cron job costs table' });
    const cronCells = within(cronTable);
    expect(cronCells.getByText('Nightly Digest')).toBeInTheDocument();
    expect(cronCells.getByText('Hourly Cleanup')).toBeInTheDocument();
    expect(cronCells.getByText('900')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show details for Nightly Digest' }));
    expect(screen.getByText('Avg/run: 300 tokens 路 $0.1400')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '用量分析' }));
    expect(await screen.findByText('统计范围: 全部 Agent 累计')).toBeInTheDocument();
    expect(screen.getByText('planner-agent')).toBeInTheDocument();
    expect(screen.getByText('80.0% (2.0K)')).toBeInTheDocument();
  });

  it('renders dashboard analysis cards and supports realtime auto-refresh polling', async () => {
    vi.useFakeTimers();
    try {
      render(<Costs />);
      await act(async () => {
        await Promise.resolve();
      });

      const toggle = screen.getByRole('checkbox', { name: 'Auto refresh' });
      expect(toggle).toBeInTheDocument();

      fireEvent.click(toggle);
      fireEvent.change(screen.getByLabelText('Refresh interval'), { target: { value: '15' } });

      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });

      const usageCalls = vi.mocked(hostApiFetch).mock.calls.filter(
        ([path]) => path === '/api/usage/recent-token-history?limit=200',
      );
      expect(usageCalls.length).toBeGreaterThanOrEqual(2);

      fireEvent.click(screen.getByRole('button', { name: '大盘监控' }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText('Optimization Score')).toBeInTheDocument();
      expect(screen.getByText('74')).toBeInTheDocument();
      expect(screen.getByText('Cache Savings')).toBeInTheDocument();
      expect(screen.getByText('$0.2100')).toBeInTheDocument();
      expect(screen.getByText('Week-over-week')).toBeInTheDocument();
      expect(screen.getByText('2026-03-22')).toBeInTheDocument();
      expect(screen.getByText('Nightly Digest spike')).toBeInTheDocument();
      expect(screen.getByText('Costs climbed week over week; consider tuning prompts.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('appends realtime usage from gateway notifications without waiting for the polling timer', async () => {
    let gatewayNotificationHandler: ((payload: unknown) => void) | undefined;
    subscribeHostEventMock.mockImplementation((eventName: string, handler: (payload: unknown) => void) => {
      if (eventName === 'gateway:notification') {
        gatewayNotificationHandler = handler;
      }
      return () => undefined;
    });

    render(<Costs />);

    expect(await screen.findByText('planner-agent')).toBeInTheDocument();
    expect(vi.mocked(hostApiFetch).mock.calls.filter(
      ([path]) => path === '/api/usage/recent-token-history?limit=200',
    )).toHaveLength(1);

    act(() => {
      gatewayNotificationHandler?.({
        method: 'agent',
        params: {
          sessionKey: 'session-live',
          agentId: 'live-agent',
          timestamp: '2026-03-23T14:00:00Z',
          message: {
            role: 'assistant',
            model: 'gpt-5.4',
            provider: 'openai',
            usage: {
              input: 100,
              output: 50,
              cacheRead: 0,
              cacheWrite: 0,
              total: 150,
              cost: { total: 0.05 },
            },
          },
        },
      });
    });

    expect(screen.getByText('live-agent')).toBeInTheDocument();
    expect(screen.getAllByText('gpt-5.4').length).toBeGreaterThan(0);
    expect(screen.getByText('$0.1778')).toBeInTheDocument();
    expect(vi.mocked(hostApiFetch).mock.calls.filter(
      ([path]) => path === '/api/usage/recent-token-history?limit=200',
    )).toHaveLength(1);
  });

  it('renders the reusable settings panel without the standalone page header', async () => {
    render(<SettingsCostsUsagePanel />);

    expect(await screen.findByText('planner-agent')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
