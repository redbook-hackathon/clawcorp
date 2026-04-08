import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  probeGatewayReadyMock,
  execMock,
  createServerMock,
  wsAutoOpenState,
} = vi.hoisted(() => ({
  probeGatewayReadyMock: vi.fn(),
  execMock: vi.fn(),
  createServerMock: vi.fn(),
  wsAutoOpenState: { value: true },
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}));

vi.mock('@electron/gateway/ws-client', () => ({
  probeGatewayReady: (...args: unknown[]) => probeGatewayReadyMock(...args),
}));

vi.mock('child_process', () => ({
  exec: (...args: unknown[]) => execMock(...args),
}));

vi.mock('net', () => ({
  createServer: (...args: unknown[]) => createServerMock(...args),
}));

vi.mock('ws', () => {
  class MockWebSocket {
    private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

    constructor(_url: string) {
      if (wsAutoOpenState.value) {
        setImmediate(() => this.emit('open'));
      }
    }

    on(event: string, handler: (...args: unknown[]) => void): void {
      const existing = this.listeners.get(event) ?? [];
      existing.push(handler);
      this.listeners.set(event, existing);
    }

    emit(event: string, ...args: unknown[]): void {
      for (const handler of this.listeners.get(event) ?? []) {
        handler(...args);
      }
    }

    close(): void {
      // no-op for tests
    }
  }

  return {
    default: MockWebSocket,
  };
});

const originalPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
  });
}

function createMockServer() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  return {
    once(event: string, handler: (...args: unknown[]) => void) {
      listeners.set(event, handler);
      return this;
    },
    listen() {
      setImmediate(() => {
        listeners.get('listening')?.();
      });
    },
    close(callback?: () => void) {
      callback?.();
    },
  };
}

describe('gateway supervisor stability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setPlatform(originalPlatform);
    probeGatewayReadyMock.mockResolvedValue(true);
    execMock.mockImplementation((command: string, _options: unknown, callback: (error: Error | null, stdout: string) => void) => {
      if (command.includes('netstat') || command.includes('lsof')) {
        callback(new Error('not found'), '');
        return;
      }
      callback(null, '');
    });
    createServerMock.mockImplementation(() => createMockServer());
    wsAutoOpenState.value = true;
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it('does not treat plain WebSocket open as ready without connect.challenge probe', async () => {
    probeGatewayReadyMock.mockResolvedValue(false);

    const { findExistingGatewayProcess } = await import('@electron/gateway/supervisor');
    const existing = await findExistingGatewayProcess({ port: 18789 });

    expect(existing).toBeNull();
    expect(probeGatewayReadyMock).toHaveBeenCalledWith(18789, expect.any(Number));
  });

  it('uses taskkill /T on Windows when terminating owned gateway process', async () => {
    setPlatform('win32');
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    const emit = (event: string, ...args: unknown[]) => {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }
    };
    const child = {
      pid: 4321,
      kill: vi.fn(),
      once: (event: string, handler: (...args: unknown[]) => void) => {
        const wrapped = (...args: unknown[]) => {
          const entries = listeners.get(event) ?? [];
          listeners.set(
            event,
            entries.filter((entry) => entry !== wrapped),
          );
          handler(...args);
        };
        const entries = listeners.get(event) ?? [];
        entries.push(wrapped);
        listeners.set(event, entries);
      },
    } as unknown as Electron.UtilityProcess;

    execMock.mockImplementation((command: string, _options: unknown, callback: () => void) => {
      callback();
      setImmediate(() => {
        emit('exit', 0);
      });
      return;
    });

    const { terminateOwnedGatewayProcess } = await import('@electron/gateway/supervisor');
    await terminateOwnedGatewayProcess(child);

    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('taskkill /F /PID 4321 /T'),
      expect.any(Object),
      expect.any(Function),
    );
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('waits for port release after orphan cleanup on Windows', async () => {
    setPlatform('win32');
    execMock.mockImplementation((command: string, _options: unknown, callback: (error: Error | null, stdout: string) => void) => {
      if (command.includes('netstat')) {
        callback(null, '  TCP    127.0.0.1:18789    0.0.0.0:0    LISTENING    9988');
        return;
      }
      callback(null, '');
    });

    const { findExistingGatewayProcess } = await import('@electron/gateway/supervisor');
    const existing = await findExistingGatewayProcess({ port: 18789 });

    expect(existing).toBeNull();
    expect(createServerMock).toHaveBeenCalled();
  });
});
