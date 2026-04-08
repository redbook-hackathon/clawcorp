import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpServerConfig } from '@electron/services/mcp/runtime-manager';

const mocks = vi.hoisted(() => {
  const clientInstances: FakeClient[] = [];
  let connectImpl: null | (() => Promise<void>) = null;

  class FakeStdioTransport {
    command: string;
    args: string[];
    env: Record<string, string>;
    stderr: EventEmitter;
    pid: number | null;
    close = vi.fn(async () => undefined);

    constructor(options: { command: string; args?: string[]; env?: Record<string, string>; stderr?: string }) {
      this.command = options.command;
      this.args = options.args ?? [];
      this.env = options.env ?? {};
      this.stderr = new EventEmitter();
      this.pid = 4321;
      if (options.stderr !== 'pipe') {
        this.stderr = new EventEmitter();
      }
    }
  }

  class FakeRemoteTransport {
    url: URL;
    close = vi.fn(async () => undefined);

    constructor(url: URL) {
      this.url = url;
    }
  }

  class FakeClient {
    constructor() {
      clientInstances.push(this);
    }

    connect = vi.fn(async () => {
      if (connectImpl) {
        await connectImpl();
      }
    });
    listTools = vi.fn(async () => ({
      tools: [
        {
          name: 'search_docs',
          description: 'Search project docs',
          inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        },
      ],
    }));
    callTool = vi.fn(async ({ name, arguments: args }: { name: string; arguments: Record<string, unknown> }) => ({
      content: [{ type: 'text', text: `${name}:${JSON.stringify(args)}` }],
      isError: false,
    }));
    close = vi.fn(async () => undefined);
  }

  return {
    clientInstances,
    getConnectImpl: () => connectImpl,
    setConnectImpl: (impl: null | (() => Promise<void>)) => {
      connectImpl = impl;
    },
    FakeStdioTransport,
    FakeRemoteTransport,
    FakeClient,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: mocks.FakeClient,
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: mocks.FakeStdioTransport,
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: mocks.FakeRemoteTransport,
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: mocks.FakeRemoteTransport,
}));

vi.mock('@electron/utils/logger', () => ({
  logger: mocks.logger,
}));

import {
  McpRuntimeManager,
} from '@electron/services/mcp/runtime-manager';

function createServer(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    name: 'docs-server',
    command: 'npx',
    args: ['-y', '@example/docs-mcp'],
    env: { DOCS_TOKEN: 'secret' },
    enabled: true,
    transport: 'stdio',
    addedAt: '2026-03-25T12:00:00.000Z',
    ...overrides,
  };
}

describe('McpRuntimeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clientInstances.length = 0;
    mocks.setConnectImpl(null);
  });

  it('starts a stdio server, discovers tools, and exposes runtime snapshot state', async () => {
    const manager = new McpRuntimeManager();

    const snapshot = await manager.startServer(createServer());

    expect(snapshot.status).toBe('running');
    expect(snapshot.connected).toBe(true);
    expect(snapshot.toolCount).toBe(1);
    expect(snapshot.pid).toBe(4321);
    expect(snapshot.tools[0]?.name).toBe('search_docs');

    const listed = manager.listServers([createServer()]);
    expect(listed[0]?.status).toBe('running');
    expect(listed[0]?.toolCount).toBe(1);
  });

  it('captures per-server stderr logs and returns newest entries first-in-order', async () => {
    const manager = new McpRuntimeManager();
    await manager.startServer(createServer());

    const runtime = manager.getServerRuntime('docs-server');
    const transport = runtime?.transport as InstanceType<typeof mocks.FakeStdioTransport> | undefined;
    transport?.stderr.emit('data', Buffer.from('first warning\nsecond warning\n'));

    const logs = manager.getServerLogs('docs-server', 10);
    expect(logs.some((entry) => entry.message.includes('first warning'))).toBe(true);
    expect(logs.some((entry) => entry.message.includes('second warning'))).toBe(true);
  });

  it('calls a discovered tool through the connected client', async () => {
    const manager = new McpRuntimeManager();
    await manager.startServer(createServer());

    const result = await manager.callTool('docs-server', 'search_docs', { query: 'gateway auth' });

    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toContain('search_docs');
    expect(result.content[0]?.text).toContain('gateway auth');
  });

  it('uses remote transports for http and sse servers', async () => {
    const manager = new McpRuntimeManager();

    const httpSnapshot = await manager.connectServer(createServer({
      name: 'http-docs',
      transport: 'http',
      command: '',
      url: 'https://example.com/mcp',
    }));
    const sseSnapshot = await manager.connectServer(createServer({
      name: 'sse-docs',
      transport: 'sse',
      command: '',
      url: 'https://example.com/sse',
    }));

    expect(httpSnapshot.status).toBe('running');
    expect(sseSnapshot.status).toBe('running');
    expect((manager.getServerRuntime('http-docs')?.transport as { url: URL }).url.href).toBe('https://example.com/mcp');
    expect((manager.getServerRuntime('sse-docs')?.transport as { url: URL }).url.href).toBe('https://example.com/sse');
  });

  it('stops an active server and clears runtime tool cache', async () => {
    const manager = new McpRuntimeManager();
    await manager.startServer(createServer());

    const stopped = await manager.stopServer('docs-server');

    expect(stopped?.status).toBe('stopped');
    expect(manager.getServerRuntime('docs-server')).toBeNull();
    expect(manager.listServers([createServer()])[0]?.toolCount).toBe(0);
  });

  it('deduplicates concurrent start attempts for the same server', async () => {
    const manager = new McpRuntimeManager();
    let resolveConnect: (() => void) | null = null;
    const pendingConnect = new Promise<void>((resolve) => {
      resolveConnect = resolve;
    });
    mocks.setConnectImpl(async () => {
      await pendingConnect;
    });

    const first = manager.startServer(createServer());
    const second = manager.startServer(createServer());

    expect(mocks.clientInstances.length).toBe(1);

    resolveConnect?.();
    const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);

    expect(firstSnapshot.status).toBe('running');
    expect(secondSnapshot.status).toBe('running');
    expect(mocks.clientInstances.length).toBe(1);
  });

  it('refreshes tools against the running client instead of only returning cached values', async () => {
    const manager = new McpRuntimeManager();
    await manager.startServer(createServer());

    const runtime = manager.getServerRuntime('docs-server');
    const client = runtime?.client as InstanceType<typeof mocks.FakeClient> | undefined;
    client?.listTools.mockResolvedValueOnce({
      tools: [
        {
          name: 'write_docs',
          description: 'Write docs',
          inputSchema: { type: 'object' },
        },
      ],
    });

    const tools = await manager.refreshTools('docs-server');

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('write_docs');
    expect(manager.listTools('docs-server')[0]?.name).toBe('write_docs');
    expect(manager.listServers([createServer()])[0]?.toolCount).toBe(1);
  });
});
