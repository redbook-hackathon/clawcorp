import { describe, expect, it, vi } from 'vitest';
import { SessionRuntimeManager } from '@electron/services/session-runtime-manager';

describe('SessionRuntimeManager', () => {
  it('spawns runtime sessions through gateway RPC and refreshes metadata from aliases', async () => {
    let runtimeSessionKey = '';
    const gatewayRpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.send') {
        runtimeSessionKey = String(params?.sessionKey ?? '');
        return { runId: 'run-spawn-1' };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [
            {
              key: runtimeSessionKey,
              state: 'waiting_approval',
              runId: 'run-session-list-2',
              lastError: 'needs-human-approval',
            },
          ],
        };
      }
      if (method === 'chat.history') {
        return {
          history: [
            { role: 'user', content: 'Investigate failing tests' },
            { role: 'assistant', content: [{ type: 'text', text: 'Waiting for approval from reviewer' }] },
          ],
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });
    const manager = new SessionRuntimeManager(
      { rpc: gatewayRpcMock } as never,
      {
        listMcpTools: () => [{ server: 'docs-server', name: 'write_docs' }],
        listEnabledSkills: async () => ['brainstorming', 'test-driven-development'],
      },
    );

    const record = await manager.spawn({
      parentSessionKey: 'agent:main:main',
      prompt: 'Investigate failing tests',
      agentName: 'reviewer',
    });

    expect(record.sessionKey).toBe(`agent:main:main:subagent:${record.id}`);
    expect(record.status).toBe('waiting_approval');
    expect(record.runId).toBe('run-session-list-2');
    expect(record.lastError).toBe('needs-human-approval');
    expect(record.toolSnapshot).toEqual([{ server: 'docs-server', name: 'write_docs' }]);
    expect(record.skillSnapshot).toEqual(['brainstorming', 'test-driven-development']);
    expect(record.history).toEqual([
      { role: 'user', content: 'Investigate failing tests' },
      { role: 'assistant', content: [{ type: 'text', text: 'Waiting for approval from reviewer' }] },
    ]);
    expect(record.transcript).toEqual([
      'Investigate failing tests',
      'Waiting for approval from reviewer',
    ]);
    expect(gatewayRpcMock).toHaveBeenCalledWith(
      'chat.send',
      expect.objectContaining({
        sessionKey: record.sessionKey,
        message: 'Investigate failing tests',
      }),
    );
  });

  it('supports steer/wait/kill via gateway and maps runtime states', async () => {
    let runtimeSessionKey = '';
    let runtimeStateField: 'state' | 'status' = 'status';
    let runtimeState = 'running';
    const gatewayRpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.send') {
        runtimeSessionKey = String(params?.sessionKey ?? runtimeSessionKey);
        return { runId: 'run-send-1' };
      }
      if (method === 'chat.abort') {
        return { ok: true };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [
            {
              sessionKey: runtimeSessionKey,
              [runtimeStateField]: runtimeState,
            },
          ],
        };
      }
      if (method === 'chat.history') {
        return {
          messages: [{ role: 'assistant', content: `gateway-history-${runtimeState}` }],
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });
    const manager = new SessionRuntimeManager({ rpc: gatewayRpcMock } as never);
    const record = await manager.spawn({
      parentSessionKey: 'agent:main:main',
      prompt: 'Initial task',
    });

    const steered = await manager.steer(record.id, 'Follow-up instruction');
    expect(steered?.transcript).toEqual(['gateway-history-running']);
    expect(gatewayRpcMock).toHaveBeenCalledWith(
      'chat.send',
      expect.objectContaining({
        sessionKey: record.sessionKey,
        message: 'Follow-up instruction',
      }),
    );

    const cases: Array<{ input: string; field: 'state' | 'status'; expected: string }> = [
      { input: 'running', field: 'status', expected: 'running' },
      { input: 'blocked', field: 'state', expected: 'blocked' },
      { input: 'waiting_approval', field: 'status', expected: 'waiting_approval' },
      { input: 'failed', field: 'state', expected: 'error' },
      { input: 'done', field: 'status', expected: 'completed' },
      { input: 'aborted', field: 'state', expected: 'killed' },
    ];

    for (const item of cases) {
      runtimeStateField = item.field;
      runtimeState = item.input;
      const waited = await manager.wait(record.id);
      expect(waited?.status).toBe(item.expected);
      expect(waited?.transcript).toEqual([`gateway-history-${item.input}`]);
    }

    const listed = await manager.list();
    expect(listed[0]?.id).toBe(record.id);
    expect(listed[0]?.status).toBe('killed');

    const killed = await manager.kill(record.id);
    expect(killed?.status).toBe('killed');
    expect(gatewayRpcMock).toHaveBeenCalledWith(
      'chat.abort',
      { sessionKey: record.sessionKey },
    );
  });

  it('restores persisted runtime sessions across manager restart for list/wait/kill', async () => {
    let runtimeSessionKey = '';
    let runtimeState = 'running';
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
        return { runId: 'run-persisted' };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [{ sessionKey: runtimeSessionKey, status: runtimeState }],
        };
      }
      if (method === 'chat.history') {
        return {
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'tool-call-1',
                  name: 'search_docs',
                  arguments: { query: 'runtime execution restore' },
                },
              ],
            },
            {
              role: 'toolResult',
              toolCallId: 'tool-call-1',
              toolName: 'search_docs',
              details: {
                status: 'completed',
                durationMs: 240,
                aggregated: 'Found runtime execution docs\nReady for summary',
              },
              content: 'Found runtime execution docs\nReady for summary',
            },
            { role: 'assistant', content: `persisted-${runtimeState}` },
          ],
        };
      }
      if (method === 'chat.abort') {
        return { ok: true };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    const manager1 = new (SessionRuntimeManager as unknown as new (...args: unknown[]) => SessionRuntimeManager)(
      { rpc: gatewayRpcMock },
      {},
      persistence,
    );
    const spawned = await manager1.spawn({
      parentSessionKey: 'agent:main:main',
      prompt: 'Persist this runtime',
    });

    expect(persistence.save).toHaveBeenCalled();
    expect(spawned.sessionKey).toContain(':subagent:');
    expect(persistedRecords[0]?.executionRecords).toEqual([
      expect.objectContaining({
        toolCallId: 'tool-call-1',
        toolName: 'search_docs',
        status: 'completed',
        durationMs: 240,
        summary: 'Found runtime execution docs / Ready for summary',
      }),
    ]);

    const manager2 = new (SessionRuntimeManager as unknown as new (...args: unknown[]) => SessionRuntimeManager)(
      { rpc: gatewayRpcMock },
      {},
      persistence,
    );

    const listed = await manager2.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(spawned.id);

    runtimeState = 'waiting_approval';
    const waited = await manager2.wait(spawned.id);
    expect(waited?.status).toBe('waiting_approval');
    expect(waited?.transcript).toContain('persisted-waiting_approval');
    expect(waited?.executionRecords).toEqual([
      expect.objectContaining({
        toolCallId: 'tool-call-1',
        toolName: 'search_docs',
        status: 'completed',
        durationMs: 240,
        summary: 'Found runtime execution docs / Ready for summary',
      }),
    ]);

    const killed = await manager2.kill(spawned.id);
    expect(killed?.status).toBe('killed');
    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.abort', { sessionKey: spawned.sessionKey });
  });

  it('links child runtime sessions to a parent runtime session tree', async () => {
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
      parentSessionKey: 'agent:planner-1:main',
      prompt: 'Root task',
    });
    const child = await manager.spawn({
      parentSessionKey: 'agent:planner-1:main',
      parentRuntimeId: root.id,
      prompt: 'Child task',
    });

    expect(child.parentRuntimeId).toBe(root.id);
    expect(child.rootRuntimeId).toBe(root.id);
    expect(child.depth).toBe(1);
    expect(child.parentSessionKey).toBe(root.sessionKey);
    expect(child.sessionKey).toBe(`${root.sessionKey}:subagent:${child.id}`);

    const listed = await manager.list();
    const listedRoot = listed.find((record) => record.id === root.id);
    const listedChild = listed.find((record) => record.id === child.id);

    expect(listedRoot?.childRuntimeIds).toEqual([child.id]);
    expect(listedChild).toEqual(expect.objectContaining({
      id: child.id,
      parentRuntimeId: root.id,
      rootRuntimeId: root.id,
      depth: 1,
      parentSessionKey: root.sessionKey,
    }));
  });

  it('links a parent skill execution record to the spawned child runtime', async () => {
    const historyBySessionKey = new Map<string, unknown[]>();
    const gatewayRpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.send') {
        const sessionKey = String(params?.sessionKey ?? '');
        const message = String(params?.message ?? '');
        if (message === 'Root task') {
          historyBySessionKey.set(sessionKey, [
            {
              role: 'assistant',
              content: [
                { type: 'tool_use', id: 'tool-skill-1', name: 'skill:planner-review', input: { prompt: 'Review the plan' } },
                { type: 'tool_result', id: 'tool-skill-1', name: 'skill:planner-review', content: 'Delegated planner review.' },
              ],
            },
          ]);
        } else {
          historyBySessionKey.set(sessionKey, [{ role: 'assistant', content: message }]);
        }
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
          messages: historyBySessionKey.get(sessionKey) ?? [],
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    const manager = new SessionRuntimeManager({ rpc: gatewayRpcMock } as never);
    const root = await manager.spawn({
      parentSessionKey: 'agent:planner-1:main',
      prompt: 'Root task',
    });
    const child = await manager.spawn({
      parentSessionKey: 'agent:planner-1:main',
      parentRuntimeId: root.id,
      prompt: 'Child task',
    });

    const listed = await manager.list();
    const linkedRoot = listed.find((record) => record.id === root.id);

    expect(linkedRoot?.executionRecords).toEqual([
      expect.objectContaining({
        toolName: 'skill:planner-review',
        linkedRuntimeId: child.id,
      }),
    ]);
  });

  it('returns a rooted runtime tree with descendants in creation order', async () => {
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
      parentSessionKey: 'agent:planner-1:main',
      prompt: 'Root task',
    });
    const childA = await manager.spawn({
      parentSessionKey: 'agent:planner-1:main',
      parentRuntimeId: root.id,
      prompt: 'Child task A',
    });
    const childB = await manager.spawn({
      parentSessionKey: 'agent:planner-1:main',
      parentRuntimeId: root.id,
      prompt: 'Child task B',
    });
    const grandchild = await manager.spawn({
      parentSessionKey: 'agent:planner-1:main',
      parentRuntimeId: childA.id,
      prompt: 'Grandchild task',
    });

    const tree = await manager.getTree(root.id);

    expect(tree?.root.id).toBe(root.id);
    expect(tree?.descendants.map((record) => record.id)).toEqual([
      childA.id,
      childB.id,
      grandchild.id,
    ]);
  });
});
