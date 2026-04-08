import { beforeEach, describe, expect, it, vi } from 'vitest';

const exposeInMainWorldMock = vi.fn();
const ipcInvokeMock = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (...args: unknown[]) => exposeInMainWorldMock(...args),
  },
  ipcRenderer: {
    invoke: (...args: unknown[]) => ipcInvokeMock(...args),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

describe('preload security', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not expose sensitive IPC channels to the renderer allowlist', async () => {
    await import('@electron/preload/index');
    const electronApi = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => unknown };
    };

    expect(() => electronApi.ipcRenderer.invoke('provider:getApiKey', 'openai')).toThrow(
      'Invalid IPC channel: provider:getApiKey',
    );
    expect(() => electronApi.ipcRenderer.invoke('gateway:getControlUiUrl')).toThrow(
      'Invalid IPC channel: gateway:getControlUiUrl',
    );
  });
});
