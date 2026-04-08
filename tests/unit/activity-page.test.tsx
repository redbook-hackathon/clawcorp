import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Activity } from '@/pages/Activity';
import { hostApiFetch } from '@/lib/host-api';

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

describe('Activity page structured log view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('parses logs, supports filters, and toggles raw details', async () => {
    const deferred = createDeferred<{ content: string }>();
    vi.mocked(hostApiFetch).mockReturnValueOnce(deferred.promise);

    const { container } = render(<Activity />);
    expect(screen.getByTestId('activity-loading-skeleton')).toBeInTheDocument();

    deferred.resolve({
      content: [
        '2026-03-24T10:00:00Z [INFO] System boot completed',
        '2026-03-24T10:01:10Z [WARN] cron heartbeat delayed by 12s',
        '2026-03-24T10:02:30Z [ERROR] agent planner failed: tool timeout',
        '2026-03-24T10:03:40Z [DEBUG] channel feishu inbound id=abc123',
      ].join('\n'),
    });

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(4);

    const searchInput = screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'planner' } });
    expect(screen.getByText('agent planner failed')).toBeInTheDocument();
    expect(screen.queryByText('System boot completed')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });

    const [levelSelect, categorySelect] = screen.getAllByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'channel' } });
    expect(screen.getByText('channel feishu inbound id=abc123')).toBeInTheDocument();
    expect(screen.queryByText('cron heartbeat delayed by 12s')).not.toBeInTheDocument();

    fireEvent.change(categorySelect, { target: { value: 'error' } });
    expect(screen.getByText('agent planner failed')).toBeInTheDocument();
    expect(screen.queryByText('channel feishu inbound id=abc123')).not.toBeInTheDocument();

    fireEvent.change(categorySelect, { target: { value: 'all' } });
    fireEvent.change(levelSelect, { target: { value: 'error' } });
    expect(screen.getByText('agent planner failed')).toBeInTheDocument();
    expect(screen.queryByText('channel feishu inbound id=abc123')).not.toBeInTheDocument();

    fireEvent.change(levelSelect, { target: { value: 'all' } });

    const firstArticle = screen.getAllByRole('article')[0];
    fireEvent.click(within(firstArticle).getByRole('button'));
    expect(
      await screen.findByText('2026-03-24T10:00:00Z [INFO] System boot completed'),
    ).toBeInTheDocument();
    expect(
      await axe(container, {
        rules: {
          'heading-order': { enabled: false },
        },
      }),
    ).toHaveNoViolations();
  });

  it('groups multiline log continuations into a single structured entry', async () => {
    vi.mocked(hostApiFetch).mockResolvedValueOnce({
      content: [
        '2026-03-24T10:00:00Z [INFO] System boot completed',
        '2026-03-24T10:02:30Z [ERROR] agent planner failed: tool timeout',
        'Error: tool timeout while waiting for shell result',
        '    at runTool (planner.ts:42:13)',
      ].join('\n'),
    });

    render(<Activity />);

    expect(await screen.findByText('agent planner failed')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);

    const secondArticle = screen.getAllByRole('article')[1];
    fireEvent.click(within(secondArticle).getByRole('button'));

    expect(
      await screen.findByText(/Error: tool timeout while waiting for shell result/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/at runTool \(planner\.ts:42:13\)/i).length).toBeGreaterThan(0);
  });

  it('shows live auto-refresh state, polls logs when live, and cleans up interval timers', async () => {
    vi.useFakeTimers();
    vi.mocked(hostApiFetch).mockResolvedValue({
      content: '2026-03-24T10:00:00Z [INFO] System boot completed',
    });

    const { unmount } = render(<Activity />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('System boot completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();
    expect(hostApiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(hostApiFetch).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { pressed: true }));
    expect(screen.getByRole('button', { pressed: false })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(hostApiFetch).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { pressed: false }));
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(hostApiFetch).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(hostApiFetch).toHaveBeenCalledTimes(3);
  });

  it('renders an empty state when api logs content is blank', async () => {
    vi.mocked(hostApiFetch).mockResolvedValueOnce({ content: '  \n  ' });

    render(<Activity />);

    expect(await screen.findByTestId('activity-feedback-empty')).toBeInTheDocument();
  });

  it('renders an error state when logs request fails', async () => {
    vi.mocked(hostApiFetch).mockRejectedValueOnce(new Error('network down'));

    render(<Activity />);

    expect(await screen.findByTestId('activity-feedback-error')).toBeInTheDocument();
    expect(screen.getByText('network down')).toBeInTheDocument();
  });
});
