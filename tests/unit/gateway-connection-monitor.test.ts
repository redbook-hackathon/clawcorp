import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayConnectionMonitor } from '@electron/gateway/connection-monitor';

describe('GatewayConnectionMonitor heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers heartbeat timeout after configured consecutive misses', () => {
    const monitor = new GatewayConnectionMonitor();
    const sendPing = vi.fn();
    const onHeartbeatTimeout = vi.fn();

    monitor.startPing({
      sendPing,
      onHeartbeatTimeout,
      intervalMs: 100,
      timeoutMs: 40,
      maxConsecutiveMisses: 2,
    });

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);

    expect(sendPing).toHaveBeenCalledTimes(2);
    expect(onHeartbeatTimeout).toHaveBeenCalledTimes(1);
    expect(onHeartbeatTimeout).toHaveBeenCalledWith({
      consecutiveMisses: 2,
      timeoutMs: 40,
    });
  });

  it('resets heartbeat miss counter when alive is observed', () => {
    const monitor = new GatewayConnectionMonitor();
    const onHeartbeatTimeout = vi.fn();

    monitor.startPing({
      sendPing: vi.fn(),
      onHeartbeatTimeout,
      intervalMs: 100,
      timeoutMs: 40,
      maxConsecutiveMisses: 4,
    });

    vi.advanceTimersByTime(200);
    expect(monitor.getConsecutiveMisses()).toBe(1);

    monitor.markAlive('pong');
    expect(monitor.getConsecutiveMisses()).toBe(0);

    monitor.handlePong();
    expect(monitor.getConsecutiveMisses()).toBe(0);
    expect(onHeartbeatTimeout).not.toHaveBeenCalled();
  });
});
