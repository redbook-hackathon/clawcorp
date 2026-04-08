import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Cron } from '@/pages/Cron';
import cronLocaleZh from '@/i18n/locales/zh/cron.json';

const hostApiFetchMock = vi.fn();

const getCronTranslation = (key: string): string => {
  const segments = key.split('.');
  const value = segments.reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, cronLocaleZh as unknown);
  return typeof value === 'string' ? value : key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => getCronTranslation(key),
    i18n: {
      resolvedLanguage: 'zh-CN',
    },
  }),
}));

const jobs = [
  {
    id: 'job-release-check',
    name: 'Release Check',
    message: 'Generate release readiness summary',
    schedule: { kind: 'cron', expr: '0 9 * * 1', tz: 'Asia/Shanghai' },
    enabled: true,
    createdAt: '2026-03-24T08:00:00.000Z',
    updatedAt: '2026-03-24T08:30:00.000Z',
    nextRun: '2026-03-31T01:00:00.000Z',
    sessionTarget: 'isolated',
    delivery: { mode: 'announce', channel: 'feishu', to: 'release-room' },
    lastRun: {
      time: '2026-03-24T08:10:00.000Z',
      success: false,
      error: 'Channel delivery failed: feishu webhook timeout',
      duration: 4200,
    },
  },
  {
    id: 'job-daily-digest',
    name: 'Daily Digest',
    message: 'Summarize yesterday updates',
    schedule: '0 7 * * *',
    enabled: true,
    createdAt: '2026-03-24T07:00:00.000Z',
    updatedAt: '2026-03-24T07:10:00.000Z',
    nextRun: '2026-03-25T07:00:00.000Z',
    sessionTarget: 'isolated',
    delivery: { mode: 'none' },
    lastRun: {
      time: '2026-03-24T07:05:00.000Z',
      success: true,
      duration: 1500,
    },
  },
];

const cronStoreState = {
  jobs,
  loading: false,
  error: null as string | null,
  fetchJobs: vi.fn(async () => {}),
  createJob: vi.fn(async () => jobs[0]),
  updateJob: vi.fn(async () => {}),
  deleteJob: vi.fn(async () => {}),
  toggleJob: vi.fn(async () => {}),
  triggerJob: vi.fn(async () => {}),
  setJobs: vi.fn(),
};

vi.mock('@/stores/cron', () => ({
  useCronStore: (selector?: (state: typeof cronStoreState) => unknown) =>
    typeof selector === 'function' ? selector(cronStoreState) : cronStoreState,
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

describe('Cron page richer detail views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostApiFetchMock.mockResolvedValue({
      runs: [
        {
          sessionId: 'run-1',
          status: 'error',
          summary: 'Feishu delivery did not acknowledge within timeout window',
          error: 'webhook timeout',
          durationMs: 4200,
          ts: Date.parse('2026-03-24T08:10:00.000Z'),
          model: 'glm-5-turbo',
          provider: 'zhipu',
        },
      ],
    });
  });

  it('shows delivery and failure context in the overview cards', async () => {
    const { container } = render(<Cron />);

    expect(screen.getByText('Release Check')).toBeInTheDocument();
    expect(screen.getAllByText('Delivery:').length).toBeGreaterThan(0);
    expect(screen.getByText(/feishu → release-room/i)).toBeInTheDocument();
    expect(screen.getByText(/release-room/i)).toBeInTheDocument();
    expect(screen.getByText(/Channel delivery failed/i)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('supports status filtering and shows update and error overview banners', () => {
    render(<Cron />);

    expect(screen.getByText(/最近更新时间/)).toBeInTheDocument();
    expect(screen.getByText(/配置或执行异常/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '仅失败' }));

    expect(screen.getByText('Release Check')).toBeInTheDocument();
    expect(screen.queryByText('Daily Digest')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '全部状态' }));
    expect(screen.getByText('Daily Digest')).toBeInTheDocument();
  });

  it('opens a richer detail panel from pipelines and loads run context', async () => {
    render(<Cron />);

    fireEvent.click(screen.getByRole('button', { name: '流水线 Pipelines' }));
    fireEvent.click(screen.getAllByRole('button', { name: '详情' })[0]);

    expect(await screen.findByText('运行详情')).toBeInTheDocument();
    expect(screen.getAllByText('Delivery:').length).toBeGreaterThan(0);
    expect(screen.getByText('isolated')).toBeInTheDocument();

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/cron/runs/job-release-check');
    });
    expect(screen.getByText(/glm-5-turbo/i)).toBeInTheDocument();
    expect(screen.getByText(/Feishu delivery did not acknowledge/i)).toBeInTheDocument();
  });

  it('creates a cron job through the pipeline wizard with delivery and alert fields', async () => {
    render(<Cron />);

    fireEvent.click(screen.getByRole('button', { name: '+ 新建任务' }));
    expect(screen.getByRole('heading', { name: '创建任务' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('例如：早间简报'), {
      target: { value: 'Pipeline Digest' },
    });
    fireEvent.change(screen.getByPlaceholderText('AI 应该做什么？例如：给我一份今天的新闻和天气摘要'), {
      target: { value: 'Build a release digest' },
    });
    fireEvent.change(screen.getByPlaceholderText('0 7 * * *'), {
      target: { value: '0 9 * * 1' },
    });
    fireEvent.change(screen.getByLabelText(/^(Delivery mode|投递模式)$/), {
      target: { value: 'announce' },
    });
    fireEvent.change(screen.getByPlaceholderText('feishu'), {
      target: { value: 'feishu' },
    });
    fireEvent.change(screen.getByPlaceholderText('release-room'), {
      target: { value: 'release-room' },
    });
    fireEvent.change(screen.getByPlaceholderText('3'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByPlaceholderText('600'), {
      target: { value: '900' },
    });
    fireEvent.change(screen.getByPlaceholderText('ops-alerts'), {
      target: { value: 'ops-alerts' },
    });
    fireEvent.click(screen.getByLabelText(/^(Best effort delivery|尽力投递)$/));
    fireEvent.click(screen.getByRole('button', { name: '确认创建' }));

    await waitFor(() => {
      expect(cronStoreState.createJob).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Pipeline Digest',
        message: 'Build a release digest',
        schedule: '0 9 * * 1',
        delivery: {
          mode: 'announce',
          channel: 'feishu',
          to: 'release-room',
        },
        failureAlertAfter: 2,
        failureAlertCooldownSeconds: 900,
        failureAlertChannel: 'ops-alerts',
        deliveryBestEffort: true,
      }));
    });
  });

  it('shows pipeline graph metadata and supports editing an existing cron pipeline', async () => {
    render(<Cron />);

    fireEvent.click(screen.getByRole('button', { name: '流水线 Pipelines' }));
    expect(screen.getAllByText(/Trigger → Agent → Delivery/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: '编辑' })[0]);
    expect(await screen.findByRole('heading', { name: '编辑任务' })).toBeInTheDocument();

    expect(screen.getByDisplayValue('Release Check')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Release Check'), {
      target: { value: 'Release Check Updated' },
    });
    fireEvent.change(screen.getByDisplayValue('feishu'), {
      target: { value: 'wecom' },
    });
    fireEvent.change(screen.getByDisplayValue('release-room'), {
      target: { value: 'platform-room' },
    });
    fireEvent.change(screen.getByDisplayValue('3'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByDisplayValue('600'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByDisplayValue('ops-alerts'), {
      target: { value: 'security-alerts' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(() => {
      expect(cronStoreState.updateJob).toHaveBeenCalledWith(
        'job-release-check',
        expect.objectContaining({
          name: 'Release Check Updated',
          delivery: {
            mode: 'announce',
            channel: 'wecom',
            to: 'platform-room',
          },
          failureAlertAfter: 5,
          failureAlertCooldownSeconds: 1200,
          failureAlertChannel: 'security-alerts',
        }),
      );
    });
  });

  it('opens the pipelines tab and expands the targeted job from a deep link', async () => {
    window.history.pushState({}, '', '/cron?jobId=job-release-check&agentId=researcher&tab=pipelines');

    render(<Cron />);

    expect(await screen.findByText('运行详情')).toBeInTheDocument();
    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/cron/runs/job-release-check');
    });
    expect(screen.getByText(/Feishu delivery did not acknowledge/i)).toBeInTheDocument();
  });
});
