import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  homeDir: '',
  sendJson: vi.fn(),
  parseJsonBody: vi.fn(async (req: IncomingMessage & { __body?: unknown }) => req.__body ?? {}),
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => mocks.homeDir,
  };
});

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: mocks.parseJsonBody,
  sendJson: mocks.sendJson,
}));

interface FakeManager {
  listServers: ReturnType<typeof vi.fn>;
  startServer: ReturnType<typeof vi.fn>;
  connectServer: ReturnType<typeof vi.fn>;
  stopServer: ReturnType<typeof vi.fn>;
  refreshTools: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
  getServerLogs: ReturnType<typeof vi.fn>;
}

function createManager(): FakeManager {
  return {
    listServers: vi.fn(),
    startServer: vi.fn(),
    connectServer: vi.fn(),
    stopServer: vi.fn(),
    refreshTools: vi.fn(),
    listTools: vi.fn(),
    callTool: vi.fn(),
    getServerLogs: vi.fn(),
  };
}

function createRequest(
  method: string,
  url: string,
  body?: unknown,
): IncomingMessage & { __body?: unknown } {
  return {
    method,
    __body: body,
  } as IncomingMessage & { __body?: unknown };
}

function writeConfig(homeDir: string, payload: unknown): void {
  const dir = join(homeDir, '.openclaw');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'mcp-servers.json'), JSON.stringify(payload, null, 2), 'utf8');
}

describe('handleMcpRoutes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.homeDir = join(tmpdir(), `clawx-mcp-route-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    rmSync(mocks.homeDir, { recursive: true, force: true });
  });

  it('returns runtime-aware server snapshots for GET /api/mcp', async () => {
    writeConfig(mocks.homeDir, {
      servers: [{
        name: 'docs-server',
        command: 'npx',
        args: ['-y', '@example/docs-mcp'],
        env: {},
        enabled: true,
        transport: 'stdio',
        addedAt: '2026-03-25T12:00:00.000Z',
      }],
    });
    const manager = createManager();
    manager.listServers.mockReturnValueOnce([{
      name: 'docs-server',
      command: 'npx',
      args: ['-y', '@example/docs-mcp'],
      env: {},
      enabled: true,
      transport: 'stdio',
      addedAt: '2026-03-25T12:00:00.000Z',
      status: 'running',
      connected: true,
      toolCount: 2,
      tools: [{ server: 'docs-server', name: 'search_docs', description: '', inputSchema: {} }],
      lastError: null,
      pid: 1234,
    }]);

    const { handleMcpRoutes } = await import('@electron/api/routes/mcp');
    const handled = await handleMcpRoutes(
      createRequest('GET', '/api/mcp'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/mcp'),
      { mcpRuntimeManager: manager } as never,
    );

    expect(handled).toBe(true);
    expect(manager.listServers).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'docs-server' }),
    ]));
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      servers: expect.arrayContaining([
        expect.objectContaining({
          name: 'docs-server',
          status: 'running',
          toolCount: 2,
        }),
      ]),
    });
  });

  it('starts a saved server through POST /api/mcp/:name/start', async () => {
    writeConfig(mocks.homeDir, {
      servers: [{
        name: 'docs-server',
        command: 'npx',
        args: ['-y', '@example/docs-mcp'],
        env: {},
        enabled: true,
        transport: 'stdio',
        addedAt: '2026-03-25T12:00:00.000Z',
      }],
    });
    const manager = createManager();
    manager.startServer.mockResolvedValueOnce({
      name: 'docs-server',
      command: 'npx',
      args: ['-y', '@example/docs-mcp'],
      env: {},
      enabled: true,
      transport: 'stdio',
      addedAt: '2026-03-25T12:00:00.000Z',
      status: 'running',
      connected: true,
      toolCount: 1,
      tools: [{ server: 'docs-server', name: 'search_docs', description: '', inputSchema: {} }],
      lastError: null,
      pid: 1234,
    });

    const { handleMcpRoutes } = await import('@electron/api/routes/mcp');
    const handled = await handleMcpRoutes(
      createRequest('POST', '/api/mcp/docs-server/start'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/mcp/docs-server/start'),
      { mcpRuntimeManager: manager } as never,
    );

    expect(handled).toBe(true);
    expect(manager.startServer).toHaveBeenCalledWith(expect.objectContaining({ name: 'docs-server' }));
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      server: expect.objectContaining({ name: 'docs-server', status: 'running' }),
    });
  });

  it('proxies tool calls through POST /api/mcp/:name/call', async () => {
    writeConfig(mocks.homeDir, {
      servers: [{
        name: 'docs-server',
        command: 'npx',
        args: ['-y', '@example/docs-mcp'],
        env: {},
        enabled: true,
        transport: 'stdio',
        addedAt: '2026-03-25T12:00:00.000Z',
      }],
    });
    const manager = createManager();
    manager.callTool.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'search_docs:gateway auth' }],
      isError: false,
    });

    const { handleMcpRoutes } = await import('@electron/api/routes/mcp');
    const handled = await handleMcpRoutes(
      createRequest('POST', '/api/mcp/docs-server/call', {
        toolName: 'search_docs',
        arguments: { query: 'gateway auth' },
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/mcp/docs-server/call'),
      { mcpRuntimeManager: manager } as never,
    );

    expect(handled).toBe(true);
    expect(manager.callTool).toHaveBeenCalledWith('docs-server', 'search_docs', { query: 'gateway auth' });
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      content: [{ type: 'text', text: 'search_docs:gateway auth' }],
      isError: false,
    });
  });

  it('connects a saved remote server through POST /api/mcp/:name/connect', async () => {
    writeConfig(mocks.homeDir, {
      servers: [{
        name: 'remote-docs',
        command: '',
        args: [],
        env: {},
        enabled: true,
        transport: 'http',
        url: 'https://example.com/mcp',
        addedAt: '2026-03-25T12:00:00.000Z',
      }],
    });
    const manager = createManager();
    manager.connectServer.mockResolvedValueOnce({
      name: 'remote-docs',
      command: '',
      args: [],
      env: {},
      enabled: true,
      transport: 'http',
      url: 'https://example.com/mcp',
      addedAt: '2026-03-25T12:00:00.000Z',
      status: 'running',
      connected: true,
      toolCount: 1,
      tools: [{ server: 'remote-docs', name: 'search_docs', description: '', inputSchema: {} }],
      lastError: null,
      pid: null,
    });

    const { handleMcpRoutes } = await import('@electron/api/routes/mcp');
    const handled = await handleMcpRoutes(
      createRequest('POST', '/api/mcp/remote-docs/connect'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/mcp/remote-docs/connect'),
      { mcpRuntimeManager: manager } as never,
    );

    expect(handled).toBe(true);
    expect(manager.connectServer).toHaveBeenCalledWith(expect.objectContaining({ name: 'remote-docs' }));
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      server: expect.objectContaining({ name: 'remote-docs', status: 'running' }),
    });
  });

  it('refreshes tools through GET /api/mcp/:name/tools', async () => {
    writeConfig(mocks.homeDir, {
      servers: [{
        name: 'docs-server',
        command: 'npx',
        args: ['-y', '@example/docs-mcp'],
        env: {},
        enabled: true,
        transport: 'stdio',
        addedAt: '2026-03-25T12:00:00.000Z',
      }],
    });
    const manager = createManager();
    manager.refreshTools.mockResolvedValueOnce([
      { server: 'docs-server', name: 'write_docs', description: '', inputSchema: {} },
    ]);

    const { handleMcpRoutes } = await import('@electron/api/routes/mcp');
    const handled = await handleMcpRoutes(
      createRequest('GET', '/api/mcp/docs-server/tools'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/mcp/docs-server/tools'),
      { mcpRuntimeManager: manager } as never,
    );

    expect(handled).toBe(true);
    expect(manager.refreshTools).toHaveBeenCalledWith('docs-server');
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      tools: [{ server: 'docs-server', name: 'write_docs', description: '', inputSchema: {} }],
    });
  });

  it('returns per-server logs through GET /api/mcp/:name/logs', async () => {
    writeConfig(mocks.homeDir, {
      servers: [{
        name: 'docs-server',
        command: 'npx',
        args: ['-y', '@example/docs-mcp'],
        env: {},
        enabled: true,
        transport: 'stdio',
        addedAt: '2026-03-25T12:00:00.000Z',
      }],
    });
    const manager = createManager();
    manager.getServerLogs.mockReturnValueOnce([
      { timestamp: '2026-03-25T12:00:00.000Z', level: 'stderr', message: 'first warning' },
    ]);

    const { handleMcpRoutes } = await import('@electron/api/routes/mcp');
    const handled = await handleMcpRoutes(
      createRequest('GET', '/api/mcp/docs-server/logs'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/mcp/docs-server/logs?tail=20'),
      { mcpRuntimeManager: manager } as never,
    );

    expect(handled).toBe(true);
    expect(manager.getServerLogs).toHaveBeenCalledWith('docs-server', 20);
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      logs: [{ timestamp: '2026-03-25T12:00:00.000Z', level: 'stderr', message: 'first warning' }],
    });
  });

  it('stops runtime when toggling a server off', async () => {
    writeConfig(mocks.homeDir, {
      servers: [{
        name: 'docs-server',
        command: 'npx',
        args: ['-y', '@example/docs-mcp'],
        env: {},
        enabled: true,
        transport: 'stdio',
        addedAt: '2026-03-25T12:00:00.000Z',
      }],
    });
    const manager = createManager();
    manager.stopServer.mockResolvedValueOnce({
      name: 'docs-server',
      command: 'npx',
      args: ['-y', '@example/docs-mcp'],
      env: {},
      enabled: false,
      transport: 'stdio',
      addedAt: '2026-03-25T12:00:00.000Z',
      status: 'stopped',
      connected: false,
      toolCount: 0,
      tools: [],
      lastError: null,
      pid: null,
    });

    const { handleMcpRoutes } = await import('@electron/api/routes/mcp');
    const handled = await handleMcpRoutes(
      createRequest('PATCH', '/api/mcp/docs-server/toggle'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/mcp/docs-server/toggle'),
      { mcpRuntimeManager: manager } as never,
    );

    expect(handled).toBe(true);
    expect(manager.stopServer).toHaveBeenCalledWith('docs-server');
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      enabled: false,
      server: expect.objectContaining({ status: 'stopped' }),
    });
  });

  it('stops a saved server through POST /api/mcp/:name/stop', async () => {
    writeConfig(mocks.homeDir, {
      servers: [{
        name: 'docs-server',
        command: 'npx',
        args: ['-y', '@example/docs-mcp'],
        env: {},
        enabled: true,
        transport: 'stdio',
        addedAt: '2026-03-25T12:00:00.000Z',
      }],
    });
    const manager = createManager();
    manager.stopServer.mockResolvedValueOnce({
      name: 'docs-server',
      command: 'npx',
      args: ['-y', '@example/docs-mcp'],
      env: {},
      enabled: true,
      transport: 'stdio',
      addedAt: '2026-03-25T12:00:00.000Z',
      status: 'stopped',
      connected: false,
      toolCount: 0,
      tools: [],
      lastError: null,
      pid: null,
    });

    const { handleMcpRoutes } = await import('@electron/api/routes/mcp');
    const handled = await handleMcpRoutes(
      createRequest('POST', '/api/mcp/docs-server/stop'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/mcp/docs-server/stop'),
      { mcpRuntimeManager: manager } as never,
    );

    expect(handled).toBe(true);
    expect(manager.stopServer).toHaveBeenCalledWith('docs-server');
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      server: expect.objectContaining({ status: 'stopped' }),
    });
  });
});
