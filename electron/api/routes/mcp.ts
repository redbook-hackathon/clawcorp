/**
 * MCP Server Management Routes
 * Stores MCP server configs in ~/.openclaw/mcp-servers.json
 * and forwards runtime lifecycle actions to the main-process manager.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  McpServerConfig,
  McpServerLogEntry,
  McpServerSnapshot,
  McpRuntimeManager,
  McpToolCallResult,
  McpToolDescriptor,
} from '@electron/services/mcp/runtime-manager';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

interface McpConfig {
  servers: McpServerConfig[];
}

type LegacyMcpServerEntry = Partial<{
  command: string;
  args: unknown;
  env: Record<string, string>;
  enabled: boolean;
  transport: McpServerConfig['transport'];
  url: string;
  addedAt: string;
}>;

function configPath(): string {
  return join(homedir(), '.openclaw', 'mcp-servers.json');
}

export function loadMcpConfig(): McpConfig {
  const path = configPath();
  if (!existsSync(path)) {
    return { servers: [] };
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (raw && typeof raw === 'object' && Array.isArray((raw as McpConfig).servers)) {
      return raw as McpConfig;
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const entries = Object.entries(raw as Record<string, LegacyMcpServerEntry>);
      return {
        servers: entries.map(([name, entry]) => ({
          name,
          command: entry.command ?? '',
          args: Array.isArray(entry.args)
            ? entry.args.filter((item): item is string => typeof item === 'string')
            : [],
          env: entry.env && typeof entry.env === 'object' ? entry.env : {},
          enabled: entry.enabled !== false,
          transport: entry.transport ?? 'stdio',
          url: entry.url,
          addedAt: entry.addedAt ?? new Date().toISOString(),
        })),
      };
    }
  } catch {
    // Fall through to empty config on malformed files.
  }

  return { servers: [] };
}

export function saveMcpConfig(config: McpConfig): void {
  const path = configPath();
  mkdirSync(join(homedir(), '.openclaw'), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf8');
}

function getManager(ctx: HostApiContext): McpRuntimeManager | null {
  return ctx.mcpRuntimeManager ?? null;
}

function toStoppedSnapshot(server: McpServerConfig): McpServerSnapshot {
  return {
    ...server,
    status: 'stopped',
    connected: false,
    toolCount: 0,
    tools: [],
    lastError: null,
    pid: null,
  };
}

function listServerSnapshots(ctx: HostApiContext, servers: McpServerConfig[]): McpServerSnapshot[] {
  const manager = getManager(ctx);
  return manager ? manager.listServers(servers) : servers.map(toStoppedSnapshot);
}

function findServerConfig(name: string): { config: McpConfig; server: McpServerConfig | null; index: number } {
  const config = loadMcpConfig();
  const index = config.servers.findIndex((server) => server.name === name);
  return {
    config,
    server: index >= 0 ? config.servers[index] : null,
    index,
  };
}

function normalizeServerInput(body: Partial<McpServerConfig>, existing?: McpServerConfig | null): McpServerConfig {
  const name = String(body.name ?? existing?.name ?? '').trim();
  return {
    name,
    command: String(body.command ?? existing?.command ?? ''),
    args: Array.isArray(body.args)
      ? body.args.filter((item): item is string => typeof item === 'string')
      : (existing?.args ?? []),
    env: body.env && typeof body.env === 'object'
      ? body.env as Record<string, string>
      : (existing?.env ?? {}),
    enabled: body.enabled ?? existing?.enabled ?? true,
    transport: body.transport ?? existing?.transport ?? 'stdio',
    url: typeof body.url === 'string' ? body.url : existing?.url,
    addedAt: existing?.addedAt ?? body.addedAt ?? new Date().toISOString(),
  };
}

async function startConfiguredServer(ctx: HostApiContext, server: McpServerConfig): Promise<McpServerSnapshot> {
  const manager = getManager(ctx);
  if (!manager) {
    return toStoppedSnapshot(server);
  }

  if (server.transport === 'stdio') {
    return await manager.startServer(server);
  }

  return await manager.connectServer(server);
}

async function stopConfiguredServer(ctx: HostApiContext, name: string, server?: McpServerConfig | null): Promise<McpServerSnapshot | null> {
  const manager = getManager(ctx);
  if (!manager) {
    return server ? toStoppedSnapshot(server) : null;
  }
  return await manager.stopServer(name);
}

export async function handleMcpRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  const { pathname } = url;
  const method = req.method ?? 'GET';

  if (method === 'GET' && pathname === '/api/mcp') {
    const config = loadMcpConfig();
    sendJson(res, 200, { servers: listServerSnapshots(ctx, config.servers) });
    return true;
  }

  if (method === 'POST' && pathname === '/api/mcp') {
    const body = await parseJsonBody<Partial<McpServerConfig>>(req);
    const name = String(body.name ?? '').trim();
    if (!name) {
      sendJson(res, 400, { error: 'name is required' });
      return true;
    }

    const { config, server: existing, index } = findServerConfig(name);
    const server = normalizeServerInput(body, existing);
    if (index >= 0) {
      config.servers[index] = server;
    } else {
      config.servers.push(server);
    }
    saveMcpConfig(config);

    let snapshot = listServerSnapshots(ctx, [server])[0] ?? toStoppedSnapshot(server);
    if (server.enabled) {
      snapshot = await startConfiguredServer(ctx, server);
    } else {
      await stopConfiguredServer(ctx, server.name, server);
    }

    sendJson(res, 200, { success: true, server: snapshot });
    return true;
  }

  const toggleMatch = pathname.match(/^\/api\/mcp\/([^/]+)\/toggle$/);
  if (method === 'PATCH' && toggleMatch) {
    const name = decodeURIComponent(toggleMatch[1]);
    const { config, server, index } = findServerConfig(name);
    if (!server || index < 0) {
      sendJson(res, 404, { error: 'Server not found' });
      return true;
    }

    const updated = { ...server, enabled: !server.enabled };
    config.servers[index] = updated;
    saveMcpConfig(config);

    const snapshot = updated.enabled
      ? await startConfiguredServer(ctx, updated)
      : await stopConfiguredServer(ctx, name, updated);

    sendJson(res, 200, {
      success: true,
      enabled: updated.enabled,
      server: snapshot ?? toStoppedSnapshot(updated),
    });
    return true;
  }

  const startMatch = pathname.match(/^\/api\/mcp\/([^/]+)\/start$/);
  if (method === 'POST' && startMatch) {
    const name = decodeURIComponent(startMatch[1]);
    const { server } = findServerConfig(name);
    if (!server) {
      sendJson(res, 404, { error: 'Server not found' });
      return true;
    }
    const snapshot = await getManager(ctx)?.startServer(server) ?? toStoppedSnapshot(server);
    sendJson(res, 200, { server: snapshot });
    return true;
  }

  const connectMatch = pathname.match(/^\/api\/mcp\/([^/]+)\/connect$/);
  if (method === 'POST' && connectMatch) {
    const name = decodeURIComponent(connectMatch[1]);
    const { server } = findServerConfig(name);
    if (!server) {
      sendJson(res, 404, { error: 'Server not found' });
      return true;
    }
    const snapshot = await getManager(ctx)?.connectServer(server) ?? toStoppedSnapshot(server);
    sendJson(res, 200, { server: snapshot });
    return true;
  }

  const stopMatch = pathname.match(/^\/api\/mcp\/([^/]+)\/stop$/);
  if (method === 'POST' && stopMatch) {
    const name = decodeURIComponent(stopMatch[1]);
    const { server } = findServerConfig(name);
    if (!server) {
      sendJson(res, 404, { error: 'Server not found' });
      return true;
    }
    const snapshot = await stopConfiguredServer(ctx, name, server);
    sendJson(res, 200, { server: snapshot ?? toStoppedSnapshot(server) });
    return true;
  }

  const toolsMatch = pathname.match(/^\/api\/mcp\/([^/]+)\/tools$/);
  if (method === 'GET' && toolsMatch) {
    const name = decodeURIComponent(toolsMatch[1]);
    const manager = getManager(ctx);
    const tools: McpToolDescriptor[] = manager
      ? await manager.refreshTools(name)
      : [];
    sendJson(res, 200, { tools });
    return true;
  }

  const logsMatch = pathname.match(/^\/api\/mcp\/([^/]+)\/logs$/);
  if (method === 'GET' && logsMatch) {
    const name = decodeURIComponent(logsMatch[1]);
    const tail = Number(url.searchParams.get('tail') ?? url.searchParams.get('tailLines') ?? '200');
    const logs: McpServerLogEntry[] = getManager(ctx)?.getServerLogs(name, Number.isFinite(tail) ? tail : 200) ?? [];
    sendJson(res, 200, { logs });
    return true;
  }

  const callMatch = pathname.match(/^\/api\/mcp\/([^/]+)\/call$/);
  if (method === 'POST' && callMatch) {
    const name = decodeURIComponent(callMatch[1]);
    const body = await parseJsonBody<{ toolName?: string; arguments?: Record<string, unknown> }>(req);
    if (!body.toolName) {
      sendJson(res, 400, { error: 'toolName is required' });
      return true;
    }
    const result: McpToolCallResult = await getManager(ctx)?.callTool(name, body.toolName, body.arguments ?? {}) ?? {
      content: [{ type: 'text', text: 'MCP runtime manager unavailable' }],
      isError: true,
    };
    sendJson(res, 200, result);
    return true;
  }

  const deleteMatch = pathname.match(/^\/api\/mcp\/([^/]+)$/);
  if (method === 'DELETE' && deleteMatch) {
    const name = decodeURIComponent(deleteMatch[1]);
    const config = loadMcpConfig();
    const before = config.servers.length;
    const deleted = config.servers.find((server) => server.name === name) ?? null;
    config.servers = config.servers.filter((server) => server.name !== name);
    if (config.servers.length === before) {
      sendJson(res, 404, { error: 'Server not found' });
      return true;
    }
    saveMcpConfig(config);
    await stopConfiguredServer(ctx, name, deleted);
    sendJson(res, 200, { success: true });
    return true;
  }

  return false;
}
