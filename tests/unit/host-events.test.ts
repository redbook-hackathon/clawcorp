import { beforeEach, describe, expect, it, vi } from 'vitest';

const addEventListenerMock = vi.fn();
const removeEventListenerMock = vi.fn();
const eventSourceMock = {
  addEventListener: addEventListenerMock,
  removeEventListener: removeEventListenerMock,
} as unknown as EventSource;

const createHostEventSourceMock = vi.fn(() => eventSourceMock);

vi.mock('@/lib/host-api', () => ({
  createHostEventSource: () => createHostEventSourceMock(),
}));

describe('host-events', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete (window.electron as { __clawcorpBrowserPreviewShim?: boolean }).__clawcorpBrowserPreviewShim;
  });

  it('subscribes through IPC for mapped host events', async () => {
    const onMock = vi.mocked(window.electron.ipcRenderer.on);
    const offMock = vi.mocked(window.electron.ipcRenderer.off);
    const captured: Array<(...args: unknown[]) => void> = [];
    onMock.mockImplementation((_, cb: (...args: unknown[]) => void) => {
      captured.push(cb);
      return () => {};
    });

    const { subscribeHostEvent } = await import('@/lib/host-events');
    const handler = vi.fn();
    const unsubscribe = subscribeHostEvent('gateway:status', handler);

    expect(onMock).toHaveBeenCalledWith('gateway:status-changed', expect.any(Function));
    expect(createHostEventSourceMock).not.toHaveBeenCalled();

    captured[0]({ state: 'running' });
    expect(handler).toHaveBeenCalledWith({ state: 'running' });

    unsubscribe();
    expect(offMock).toHaveBeenCalledWith('gateway:status-changed', expect.any(Function));
  });

  it('maps update status host events onto the existing renderer channel bridge', async () => {
    const onMock = vi.mocked(window.electron.ipcRenderer.on);
    const offMock = vi.mocked(window.electron.ipcRenderer.off);
    const captured: Array<(...args: unknown[]) => void> = [];
    onMock.mockImplementation((_, cb: (...args: unknown[]) => void) => {
      captured.push(cb);
      return () => {};
    });

    const { subscribeHostEvent } = await import('@/lib/host-events');
    const handler = vi.fn();
    const unsubscribe = subscribeHostEvent('update:status', handler);

    expect(onMock).toHaveBeenCalledWith('update:status-changed', expect.any(Function));
    captured[0]({ status: 'available' });
    expect(handler).toHaveBeenCalledWith({ status: 'available' });

    unsubscribe();
    expect(offMock).toHaveBeenCalledWith('update:status-changed', expect.any(Function));
  });

  it('does not use SSE fallback by default for unknown events', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { subscribeHostEvent } = await import('@/lib/host-events');
    const unsubscribe = subscribeHostEvent('unknown:event', vi.fn());
    expect(createHostEventSourceMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[host-events] no IPC mapping for event "unknown:event", SSE fallback disabled',
    );
    unsubscribe();
    warnSpy.mockRestore();
  });

  it('uses SSE fallback in browser preview mode', async () => {
    (window.electron as { __clawcorpBrowserPreviewShim?: boolean }).__clawcorpBrowserPreviewShim = true;
    const onMock = vi.mocked(window.electron.ipcRenderer.on);
    const { subscribeHostEvent } = await import('@/lib/host-events');
    const handler = vi.fn();
    const unsubscribe = subscribeHostEvent('gateway:status', handler);

    expect(onMock).not.toHaveBeenCalled();
    expect(createHostEventSourceMock).toHaveBeenCalled();
    expect(addEventListenerMock).toHaveBeenCalledWith('gateway:status', expect.any(Function));

    const listener = addEventListenerMock.mock.calls[0]?.[1] as (event: MessageEvent) => void;
    listener({ data: JSON.stringify({ state: 'running' }) } as MessageEvent);
    expect(handler).toHaveBeenCalledWith({ state: 'running' });

    unsubscribe();
    expect(removeEventListenerMock).toHaveBeenCalledWith('gateway:status', expect.any(Function));
  });
});
