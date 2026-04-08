import type { IncomingMessage, ServerResponse } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  parseJsonBody: vi.fn(async (req: IncomingMessage & { __body?: unknown }) => req.__body ?? {}),
}));

vi.mock('@electron/api/route-utils', () => ({
  sendJson: mocks.sendJson,
  parseJsonBody: mocks.parseJsonBody,
}));

function createRequest(
  method: string,
  body?: unknown,
): IncomingMessage & { __body?: unknown } {
  return {
    method,
    __body: body,
  } as IncomingMessage & { __body?: unknown };
}

describe('session runtime routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('spawns and lists subagent runtime sessions through async runtime manager', async () => {
    const { SessionRuntimeManager } = await import('@electron/services/session-runtime-manager');
    const { handleSessionRoutes } = await import('@electron/api/routes/sessions');
    let runtimeSessionKey = '';
    const gatewayRpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.send') {
        runtimeSessionKey = String(params?.sessionKey ?? '');
        return { runId: 'run-spawn-route' };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [{ key: runtimeSessionKey, state: 'running' }],
        };
      }
      if (method === 'chat.history') {
        return { history: [{ role: 'assistant', content: 'history-from-gateway' }] };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });
    const manager = new SessionRuntimeManager({ rpc: gatewayRpcMock } as never);
    const ctx = { sessionRuntimeManager: manager } as never;

    const spawnHandled = await handleSessionRoutes(
      createRequest('POST', {
        parentSessionKey: 'agent:main:main',
        prompt: 'Investigate costs anomaly',
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/sessions/spawn'),
      ctx,
    );

    expect(spawnHandled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      session: expect.objectContaining({
        parentSessionKey: 'agent:main:main',
        status: 'running',
        transcript: ['history-from-gateway'],
      }),
    });

    const listHandled = await handleSessionRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/sessions/subagents'),
      ctx,
    );

    expect(listHandled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      sessions: [expect.objectContaining({ parentSessionKey: 'agent:main:main' })],
    });

    const spawnedSession = (mocks.sendJson.mock.calls[0]?.[2] as { session?: { id: string } })?.session;
    expect(spawnedSession?.id).toBeDefined();

    const detailHandled = await handleSessionRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL(`http://127.0.0.1:3210/api/sessions/subagents/${spawnedSession?.id}`),
      ctx,
    );

    expect(detailHandled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      session: expect.objectContaining({
        id: spawnedSession?.id,
        history: [expect.objectContaining({ role: 'assistant', content: 'history-from-gateway' })],
      }),
    });
  });

  it('supports steer, wait, and kill routes for a spawned runtime session', async () => {
    const { SessionRuntimeManager } = await import('@electron/services/session-runtime-manager');
    const { handleSessionRoutes } = await import('@electron/api/routes/sessions');
    let runtimeSessionKey = '';
    let runtimeStateField: 'state' | 'status' = 'state';
    let runtimeState = 'running';
    const gatewayRpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.send') {
        runtimeSessionKey = String(params?.sessionKey ?? runtimeSessionKey);
        return { runId: 'run-steer-route' };
      }
      if (method === 'chat.abort') {
        return { ok: true };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [{ sessionKey: runtimeSessionKey, [runtimeStateField]: runtimeState }],
        };
      }
      if (method === 'chat.history') {
        return { messages: [{ role: 'assistant', content: `history-${runtimeState}` }] };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });
    const manager = new SessionRuntimeManager({ rpc: gatewayRpcMock } as never);
    const record = await manager.spawn({
      parentSessionKey: 'agent:main:main',
      prompt: 'Initial task',
    });
    const ctx = { sessionRuntimeManager: manager } as never;

    await handleSessionRoutes(
      createRequest('POST', { input: 'Follow-up' }),
      {} as ServerResponse,
      new URL(`http://127.0.0.1:3210/api/sessions/subagents/${record.id}/steer`),
      ctx,
    );
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      session: expect.objectContaining({
        transcript: ['history-running'],
      }),
    });

    runtimeStateField = 'status';
    runtimeState = 'waiting_approval';
    await handleSessionRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL(`http://127.0.0.1:3210/api/sessions/subagents/${record.id}/wait`),
      ctx,
    );
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      session: expect.objectContaining({ id: record.id, status: 'waiting_approval' }),
    });

    await handleSessionRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL(`http://127.0.0.1:3210/api/sessions/subagents/${record.id}/kill`),
      ctx,
    );
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      session: expect.objectContaining({ status: 'killed' }),
    });
    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.abort', { sessionKey: record.sessionKey });
  });

  it('resolves wait/kill routes after manager restart when runtime sessions are persisted', async () => {
    const { SessionRuntimeManager } = await import('@electron/services/session-runtime-manager');
    const { handleSessionRoutes } = await import('@electron/api/routes/sessions');
    let runtimeSessionKey = '';
    let runtimeStatus = 'running';
    let persistedRecords: Array<Record<string, unknown>> = [];

    const persistence = {
      load: vi.fn(async () => persistedRecords),
      save: vi.fn(async (records: Array<Record<string, unknown>>) => {
        persistedRecords = records.map((record) => ({ ...record }));
      }),
    };

    const gatewayRpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.send') {
        runtimeSessionKey = String(params?.sessionKey ?? runtimeSessionKey);
        return { runId: 'run-route-persist' };
      }
      if (method === 'chat.abort') {
        return { ok: true };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [{ sessionKey: runtimeSessionKey, status: runtimeStatus }],
        };
      }
      if (method === 'chat.history') {
        return {
          messages: [{ role: 'assistant', content: `persisted-route-${runtimeStatus}` }],
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    const manager1 = new (SessionRuntimeManager as unknown as new (...args: unknown[]) => InstanceType<typeof SessionRuntimeManager>)(
      { rpc: gatewayRpcMock },
      {},
      persistence,
    );
    const spawned = await manager1.spawn({
      parentSessionKey: 'agent:main:main',
      prompt: 'Keep this runtime',
    });

    const manager2 = new (SessionRuntimeManager as unknown as new (...args: unknown[]) => InstanceType<typeof SessionRuntimeManager>)(
      { rpc: gatewayRpcMock },
      {},
      persistence,
    );
    const restartedCtx = { sessionRuntimeManager: manager2 } as never;

    runtimeStatus = 'waiting_approval';
    const waitHandled = await handleSessionRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL(`http://127.0.0.1:3210/api/sessions/subagents/${spawned.id}/wait`),
      restartedCtx,
    );

    expect(waitHandled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      session: expect.objectContaining({
        id: spawned.id,
        status: 'waiting_approval',
      }),
    });

    const killHandled = await handleSessionRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL(`http://127.0.0.1:3210/api/sessions/subagents/${spawned.id}/kill`),
      restartedCtx,
    );

    expect(killHandled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      session: expect.objectContaining({
        id: spawned.id,
        status: 'killed',
      }),
    });
    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.abort', { sessionKey: spawned.sessionKey });
  });

  it('spawns child runtime sessions through parentRuntimeId linkage', async () => {
    const { SessionRuntimeManager } = await import('@electron/services/session-runtime-manager');
    const { handleSessionRoutes } = await import('@electron/api/routes/sessions');

    const historyBySessionKey = new Map<string, string[]>();
    const gatewayRpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.send') {
        const sessionKey = String(params?.sessionKey ?? '');
        const message = String(params?.message ?? '');
        historyBySessionKey.set(sessionKey, [message]);
        return { runId: `run-${sessionKey.split(':').at(-1)}` };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [...historyBySessionKey.keys()].map((sessionKey) => ({
            sessionKey,
            status: 'running',
          })),
        };
      }
      if (method === 'chat.history') {
        const sessionKey = String(params?.sessionKey ?? '');
        return {
          messages: (historyBySessionKey.get(sessionKey) ?? []).map((content) => ({
            role: 'assistant',
            content,
          })),
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    const manager = new SessionRuntimeManager({ rpc: gatewayRpcMock } as never);
    const root = await manager.spawn({
      parentSessionKey: 'agent:main:main',
      prompt: 'Initial root work',
    });
    const ctx = { sessionRuntimeManager: manager } as never;

    const handled = await handleSessionRoutes(
      createRequest('POST', {
        parentSessionKey: 'agent:main:main',
        parentRuntimeId: root.id,
        prompt: 'Retry as child work',
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/sessions/spawn'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      session: expect.objectContaining({
        parentRuntimeId: root.id,
        rootRuntimeId: root.id,
        depth: 1,
        parentSessionKey: root.sessionKey,
      }),
    });
  });

  it('returns a rooted runtime tree from the tree route', async () => {
    const { SessionRuntimeManager } = await import('@electron/services/session-runtime-manager');
    const { handleSessionRoutes } = await import('@electron/api/routes/sessions');

    const historyBySessionKey = new Map<string, string[]>();
    const gatewayRpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.send') {
        const sessionKey = String(params?.sessionKey ?? '');
        const message = String(params?.message ?? '');
        historyBySessionKey.set(sessionKey, [message]);
        return { runId: `run-${sessionKey.split(':').at(-1)}` };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [...historyBySessionKey.keys()].map((sessionKey) => ({
            sessionKey,
            status: 'running',
          })),
        };
      }
      if (method === 'chat.history') {
        const sessionKey = String(params?.sessionKey ?? '');
        return {
          messages: (historyBySessionKey.get(sessionKey) ?? []).map((content) => ({
            role: 'assistant',
            content,
          })),
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    const manager = new SessionRuntimeManager({ rpc: gatewayRpcMock } as never);
    const root = await manager.spawn({
      parentSessionKey: 'agent:main:main',
      prompt: 'Initial root work',
    });
    const child = await manager.spawn({
      parentSessionKey: 'agent:main:main',
      parentRuntimeId: root.id,
      prompt: 'Retry as child work',
    });
    const ctx = { sessionRuntimeManager: manager } as never;

    const handled = await handleSessionRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL(`http://127.0.0.1:3210/api/sessions/subagents/${root.id}/tree`),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      tree: {
        root: expect.objectContaining({ id: root.id }),
        descendants: [
          expect.objectContaining({ id: child.id, parentRuntimeId: root.id }),
        ],
      },
    });
  });
});
