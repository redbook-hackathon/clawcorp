import { EventEmitter } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { logger } from '../../utils/logger';

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  transport: 'stdio' | 'sse' | 'http';
  url?: string;
  addedAt: string;
}

export interface McpToolDescriptor {
  server: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServerLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'stderr';
  message: string;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError: boolean;
}

export interface McpServerSnapshot extends McpServerConfig {
  status: 'stopped' | 'starting' | 'running' | 'error';
  connected: boolean;
  toolCount: number;
  tools: McpToolDescriptor[];
  lastError: string | null;
  pid: number | null;
}

type SupportedTransport =
  | StdioClientTransport
  | SSEClientTransport
  | StreamableHTTPClientTransport;

interface ServerRuntimeState {
  config: McpServerConfig;
  client: Client;
  transport: SupportedTransport;
  tools: McpToolDescriptor[];
}

interface SnapshotCache {
  config: McpServerConfig;
  status: McpServerSnapshot['status'];
  connected: boolean;
  tools: McpToolDescriptor[];
  lastError: string | null;
  pid: number | null;
  logs: McpServerLogEntry[];
}

const LOG_LIMIT = 400;

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toToolDescriptors(serverName: string, tools: unknown): McpToolDescriptor[] {
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools.flatMap((tool) => {
    if (!tool || typeof tool !== 'object') {
      return [];
    }

    const value = tool as Record<string, unknown>;
    const name = typeof value.name === 'string' ? value.name : '';
    if (!name) {
      return [];
    }

    return [{
      server: serverName,
      name,
      description: typeof value.description === 'string' ? value.description : '',
      inputSchema: value.inputSchema && typeof value.inputSchema === 'object'
        ? value.inputSchema as Record<string, unknown>
        : {},
    }];
  });
}

export class McpRuntimeManager {
  private readonly runtimes = new Map<string, ServerRuntimeState>();
  private readonly snapshots = new Map<string, SnapshotCache>();
  private readonly pendingConnections = new Map<string, Promise<McpServerSnapshot>>();

  private ensureSnapshot(config: McpServerConfig): SnapshotCache {
    const existing = this.snapshots.get(config.name);
    if (existing) {
      existing.config = config;
      return existing;
    }

    const created: SnapshotCache = {
      config,
      status: 'stopped',
      connected: false,
      tools: [],
      lastError: null,
      pid: null,
      logs: [],
    };
    this.snapshots.set(config.name, created);
    return created;
  }

  private appendLog(name: string, level: McpServerLogEntry['level'], message: string): void {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    snapshot.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message: trimmed,
    });
    if (snapshot.logs.length > LOG_LIMIT) {
      snapshot.logs.splice(0, snapshot.logs.length - LOG_LIMIT);
    }
  }

  private updateSnapshot(name: string, update: Partial<Omit<SnapshotCache, 'config' | 'logs'>>): SnapshotCache | null {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      return null;
    }

    if (update.status) snapshot.status = update.status;
    if (typeof update.connected === 'boolean') snapshot.connected = update.connected;
    if (update.tools) snapshot.tools = update.tools;
    if ('lastError' in update) snapshot.lastError = update.lastError ?? null;
    if ('pid' in update) snapshot.pid = update.pid ?? null;
    return snapshot;
  }

  private attachStdioLogging(serverName: string, transport: StdioClientTransport): void {
    const stderr = transport.stderr;
    if (!(stderr instanceof EventEmitter)) {
      return;
    }

    stderr.on('data', (chunk) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      for (const line of text.split(/\r?\n/)) {
        this.appendLog(serverName, 'stderr', line);
      }
    });
  }

  private attachTransportEvents(serverName: string, transport: SupportedTransport): void {
    const onerrorTarget = transport as SupportedTransport & { onerror?: (error: unknown) => void };
    const oncloseTarget = transport as SupportedTransport & { onclose?: () => void };

    onerrorTarget.onerror = (error) => {
      const message = normalizeError(error);
      this.appendLog(serverName, 'error', message);
      this.updateSnapshot(serverName, {
        status: 'error',
        connected: false,
        lastError: message,
      });
    };

    oncloseTarget.onclose = () => {
      this.appendLog(serverName, 'info', 'Connection closed');
      this.updateSnapshot(serverName, {
        status: 'stopped',
        connected: false,
        pid: null,
      });
      this.runtimes.delete(serverName);
    };
  }

  private createTransport(config: McpServerConfig): SupportedTransport {
    if (config.transport === 'stdio') {
      if (!config.command.trim()) {
        throw new Error(`MCP server "${config.name}" is missing a command`);
      }
      return new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
        stderr: 'pipe',
      });
    }

    if (!config.url?.trim()) {
      throw new Error(`MCP server "${config.name}" is missing a URL`);
    }

    const url = new URL(config.url);
    if (config.transport === 'sse') {
      return new SSEClientTransport(url);
    }

    return new StreamableHTTPClientTransport(url);
  }

  private async establishConnection(config: McpServerConfig): Promise<McpServerSnapshot> {
    const cached = this.runtimes.get(config.name);
    if (cached) {
      return this.toSnapshot(this.ensureSnapshot(config));
    }

    const pending = this.pendingConnections.get(config.name);
    if (pending) {
      return pending;
    }

    const connectionPromise = this.connectInternalCore(config);
    this.pendingConnections.set(config.name, connectionPromise);
    connectionPromise.finally(() => {
      if (this.pendingConnections.get(config.name) === connectionPromise) {
        this.pendingConnections.delete(config.name);
      }
    });
    return connectionPromise;
  }

  private async connectInternalCore(config: McpServerConfig): Promise<McpServerSnapshot> {
    const snapshot = this.ensureSnapshot(config);
    snapshot.status = 'starting';
    snapshot.connected = false;
    snapshot.lastError = null;
    snapshot.pid = null;
    this.appendLog(config.name, 'info', `Connecting via ${config.transport}`);

    const transport = this.createTransport(config);
    const client = new Client(
      { name: 'clawcorp-mcp-runtime', version: '0.1.0' },
      { capabilities: {} },
    );

    this.attachTransportEvents(config.name, transport);
    if (transport instanceof StdioClientTransport) {
      this.attachStdioLogging(config.name, transport);
    }

    try {
      await client.connect(transport);
      const discovered = await client.listTools();
      const tools = toToolDescriptors(config.name, discovered?.tools);

      this.runtimes.set(config.name, {
        config,
        client,
        transport,
        tools,
      });
      this.updateSnapshot(config.name, {
        status: 'running',
        connected: true,
        tools,
        lastError: null,
        pid: transport instanceof StdioClientTransport ? transport.pid : null,
      });
      this.appendLog(config.name, 'info', `Connected (${tools.length} tool${tools.length === 1 ? '' : 's'} discovered)`);
      logger.info('[mcp-runtime] connected', { server: config.name, transport: config.transport, tools: tools.length });
      return this.toSnapshot(this.ensureSnapshot(config));
    } catch (error) {
      const message = normalizeError(error);
      this.updateSnapshot(config.name, {
        status: 'error',
        connected: false,
        tools: [],
        lastError: message,
        pid: null,
      });
      this.appendLog(config.name, 'error', message);
      logger.warn('[mcp-runtime] failed to connect', { server: config.name, error: message });
      try {
        await client.close();
      } catch {
        // Ignore cleanup failures after startup error.
      }
      try {
        await transport.close();
      } catch {
        // Ignore cleanup failures after startup error.
      }
      throw error;
    }
  }

  private async connectInternal(config: McpServerConfig): Promise<McpServerSnapshot> {
    return this.establishConnection(config);
  }

  private toSnapshot(snapshot: SnapshotCache): McpServerSnapshot {
    return {
      ...snapshot.config,
      status: snapshot.status,
      connected: snapshot.connected,
      toolCount: snapshot.tools.length,
      tools: [...snapshot.tools],
      lastError: snapshot.lastError,
      pid: snapshot.pid,
    };
  }

  getServerRuntime(name: string): ServerRuntimeState | null {
    return this.runtimes.get(name) ?? null;
  }

  listServers(configs: McpServerConfig[]): McpServerSnapshot[] {
    return configs.map((config) => this.toSnapshot(this.ensureSnapshot(config)));
  }

  async startServer(config: McpServerConfig): Promise<McpServerSnapshot> {
    return this.connectInternal(config);
  }

  async connectServer(config: McpServerConfig): Promise<McpServerSnapshot> {
    return this.connectInternal(config);
  }

  getServerLogs(name: string, tailLines = 200): McpServerLogEntry[] {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      return [];
    }
    return snapshot.logs.slice(-Math.max(1, tailLines));
  }

  listTools(name: string): McpToolDescriptor[] {
    return [...(this.snapshots.get(name)?.tools ?? [])];
  }

  async refreshTools(name: string): Promise<McpToolDescriptor[]> {
    const runtime = this.runtimes.get(name);
    if (!runtime) {
      return this.listTools(name);
    }

    this.appendLog(name, 'info', 'Refreshing tool inventory');

    try {
      const discovered = await runtime.client.listTools();
      const tools = toToolDescriptors(name, discovered?.tools);
      runtime.tools = tools;
      this.updateSnapshot(name, {
        tools,
        lastError: null,
      });
      this.appendLog(name, 'info', `Tool inventory refreshed (${tools.length} tool${tools.length === 1 ? '' : 's'})`);
      return [...tools];
    } catch (error) {
      const message = normalizeError(error);
      this.appendLog(name, 'error', message);
      this.updateSnapshot(name, {
        lastError: message,
      });
      return this.listTools(name);
    }
  }

  async callTool(name: string, toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    const runtime = this.runtimes.get(name);
    if (!runtime) {
      const message = `MCP server "${name}" is not connected`;
      this.appendLog(name, 'error', message);
      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }

    this.appendLog(name, 'info', `Calling tool "${toolName}"`);
    try {
      const result = await runtime.client.callTool({
        name: toolName,
        arguments: args,
      });
      return {
        content: Array.isArray(result.content)
          ? result.content as Array<{ type: string; text?: string }>
          : [{ type: 'text', text: String(result.content) }],
        isError: result.isError === true,
      };
    } catch (error) {
      const message = normalizeError(error);
      this.appendLog(name, 'error', message);
      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }
  }

  async stopServer(name: string): Promise<McpServerSnapshot | null> {
    const runtime = this.runtimes.get(name);
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      return null;
    }

    if (runtime) {
      try {
        await runtime.client.close();
      } catch {
        // Best-effort close.
      }
      try {
        await runtime.transport.close();
      } catch {
        // Best-effort close.
      }
      this.runtimes.delete(name);
    }

    this.updateSnapshot(name, {
      status: 'stopped',
      connected: false,
      tools: [],
      pid: null,
    });
    this.appendLog(name, 'info', 'Stopped');
    return this.toSnapshot(snapshot);
  }

  async shutdown(): Promise<void> {
    const runningNames = [...this.runtimes.keys()];
    for (const name of runningNames) {
      await this.stopServer(name);
    }
  }
}
