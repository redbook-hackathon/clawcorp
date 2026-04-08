import type { IncomingMessage, ServerResponse } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  parseJsonBody: vi.fn(),
  listConfiguredChannels: vi.fn(async () => ['feishu']),
  listConfiguredChannelAccounts: vi.fn(async () => ({})),
  listConfiguredAgentIds: vi.fn(async () => ['main', 'agent-a']),
  listAgentsSnapshot: vi.fn(async () => ({ agents: [], channelOwners: {}, configuredChannelTypes: [], defaultAgentId: 'main' })),
  assignChannelAccountToAgent: vi.fn(),
  deleteChannelConfig: vi.fn(),
  deleteChannelAccountConfig: vi.fn(),
  clearAllBindingsForChannel: vi.fn(),
  clearChannelBinding: vi.fn(),
  getChannelFormValues: vi.fn(),
  saveChannelConfig: vi.fn(),
  setChannelDefaultAccount: vi.fn(),
  whatsAppStart: vi.fn(),
}));

vi.mock('@electron/api/route-utils', () => ({
  sendJson: mocks.sendJson,
  parseJsonBody: mocks.parseJsonBody,
}));

vi.mock('@electron/utils/channel-config', () => ({
  listConfiguredChannels: mocks.listConfiguredChannels,
  listConfiguredChannelAccounts: mocks.listConfiguredChannelAccounts,
  deleteChannelConfig: mocks.deleteChannelConfig,
  deleteChannelAccountConfig: mocks.deleteChannelAccountConfig,
  getChannelFormValues: mocks.getChannelFormValues,
  saveChannelConfig: mocks.saveChannelConfig,
  setChannelDefaultAccount: mocks.setChannelDefaultAccount,
  setChannelEnabled: vi.fn(),
  validateChannelConfig: vi.fn(),
  validateChannelCredentials: vi.fn(),
}));

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelToAgent: vi.fn(),
  assignChannelAccountToAgent: mocks.assignChannelAccountToAgent,
  clearAllBindingsForChannel: mocks.clearAllBindingsForChannel,
  clearChannelBinding: mocks.clearChannelBinding,
  listAgentsSnapshot: mocks.listAgentsSnapshot,
  listConfiguredAgentIds: mocks.listConfiguredAgentIds,
}));

vi.mock('@electron/utils/whatsapp-login', () => ({
  whatsAppLoginManager: {
    start: mocks.whatsAppStart,
    stop: vi.fn(),
  },
}));

vi.mock('@electron/utils/openclaw-sdk', () => ({
  listDiscordDirectoryGroupsFromConfig: vi.fn(async () => []),
  listDiscordDirectoryPeersFromConfig: vi.fn(async () => []),
  normalizeDiscordMessagingTarget: vi.fn(),
  listTelegramDirectoryGroupsFromConfig: vi.fn(async () => []),
  listTelegramDirectoryPeersFromConfig: vi.fn(async () => []),
  normalizeTelegramMessagingTarget: vi.fn(),
  normalizeWhatsAppMessagingTarget: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => 'C:/test-app',
    getPath: () => 'C:/test-user-data',
  },
}));

vi.mock('node:http', async () => {
  const { EventEmitter } = await vi.importActual<typeof import('node:events')>('node:events');
  const request = vi.fn((options: unknown, cb: (r: unknown) => void) => {
    const res = new EventEmitter();
    Object.assign(res, {
      resume: vi.fn(),
    });
    process.nextTick(() => {
      res.emit('data', Buffer.alloc(0));
      res.emit('end');
    });
    cb(res);
    return {
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };
  });
  return { request };
});

function createRequest(method: string): IncomingMessage {
  return { method } as IncomingMessage;
}

describe('channels routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns normalized runtime capabilities for configured channels', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(async (method: string) => {
          if (method === 'channels.status') {
            return {
              channels: {
                feishu: { configured: true, running: true },
              },
              channelAccounts: {
                feishu: [
                  {
                    accountId: 'default',
                    configured: true,
                    connected: true,
                  },
                ],
              },
              channelDefaultAccountId: {
                feishu: 'default',
              },
            };
          }
          throw new Error(`Unexpected RPC method: ${method}`);
        }),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/capabilities'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      capabilities: [
        expect.objectContaining({
          channelId: 'feishu-default',
          channelType: 'feishu',
          status: 'connected',
          availableActions: ['disconnect', 'test', 'send', 'configure'],
          capabilityFlags: expect.objectContaining({
            supportsSchemaSummary: true,
          }),
          configSchemaSummary: expect.objectContaining({
            totalFieldCount: 2,
            requiredFieldCount: 2,
          }),
        }),
      ],
    });
  });

  it('returns channel accounts view merged from config and runtime state', async () => {
    mocks.listConfiguredChannels.mockResolvedValueOnce(['feishu', 'wechat']);
    mocks.listConfiguredChannelAccounts.mockResolvedValueOnce({
      feishu: {
        defaultAccountId: 'default',
        accountIds: ['default', 'agent-a'],
      },
      'openclaw-weixin': {
        defaultAccountId: 'default',
        accountIds: ['default'],
      },
    });
    mocks.listAgentsSnapshot.mockResolvedValueOnce({
      agents: [],
      defaultAgentId: 'main',
      configuredChannelTypes: ['feishu', 'wechat'],
      channelOwners: {
        'feishu:default': 'main',
        'feishu:agent-a': 'agent-a',
        'openclaw-weixin:default': 'main',
      },
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(async (method: string) => {
          if (method === 'channels.status') {
            return {
              channels: {
                feishu: { configured: true, running: true },
                'openclaw-weixin': { configured: true, running: true },
              },
              channelAccounts: {
                feishu: [
                  { accountId: 'default', configured: true, connected: true, name: 'Feishu Main' },
                  { accountId: 'agent-a', configured: true, connected: false, running: true, name: 'Feishu Agent A' },
                ],
                'openclaw-weixin': [
                  { accountId: 'default', configured: true, connected: true, name: 'WeChat Main' },
                ],
              },
              channelDefaultAccountId: {
                feishu: 'default',
                'openclaw-weixin': 'default',
              },
            };
          }
          throw new Error(`Unexpected RPC method: ${method}`);
        }),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/accounts'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
      channels: expect.arrayContaining([
        expect.objectContaining({
          channelType: 'feishu',
          defaultAccountId: 'default',
          accounts: expect.arrayContaining([
            expect.objectContaining({ accountId: 'default', name: 'Feishu Main', isDefault: true }),
            expect.objectContaining({ accountId: 'agent-a', agentId: 'agent-a' }),
          ]),
        }),
        expect.objectContaining({
          channelType: 'wechat',
          defaultAccountId: 'default',
          accounts: expect.arrayContaining([
            expect.objectContaining({ accountId: 'default', name: 'WeChat Main' }),
          ]),
        }),
      ]),
    }));
  });

  it('sets the default channel account through the dedicated route', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.parseJsonBody.mockResolvedValueOnce({
      channelType: 'feishu',
      accountId: 'agent-a',
    });

    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('PUT'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/default-account'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.setChannelDefaultAccount).toHaveBeenCalledWith('feishu', 'agent-a');
    expect(ctx.gatewayManager.debouncedReload).toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, { success: true });
  });

  it('binds a scoped channel account to an agent through the binding route', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.parseJsonBody.mockResolvedValueOnce({
      channelType: 'wechat',
      accountId: 'default',
      agentId: 'main',
    });

    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('PUT'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/binding'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.assignChannelAccountToAgent).toHaveBeenCalledWith('main', 'openclaw-weixin', 'default');
    expect(ctx.gatewayManager.debouncedReload).toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, { success: true });
  });

  it('clears a scoped channel binding through the binding delete route', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.parseJsonBody.mockResolvedValueOnce({
      channelType: 'wechat',
      accountId: 'default',
    });

    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('DELETE'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/binding'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.clearChannelBinding).toHaveBeenCalledWith('openclaw-weixin', 'default');
    expect(ctx.gatewayManager.debouncedReload).toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, { success: true });
  });

  it('rate limits channel test requests per channel/account', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const url = new URL('http://127.0.0.1:3210/api/channels/feishu-default/test');
    const res = {} as ServerResponse;

    await handleChannelRoutes(createRequest('POST'), res, url, ctx);
    await handleChannelRoutes(createRequest('POST'), res, url, ctx);
    await handleChannelRoutes(createRequest('POST'), res, url, ctx);

    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 429, {
      success: false,
      error: 'Rate limit exceeded',
      retryAfterSeconds: expect.any(Number),
    });
    const lastCall = mocks.sendJson.mock.calls[mocks.sendJson.mock.calls.length - 1];
    expect(lastCall[2].retryAfterSeconds).toBeGreaterThan(0);
  });

  it('rate limits channel send requests per channel/account', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const url = new URL('http://127.0.0.1:3210/api/channels/feishu-default/send');
    const res = {} as ServerResponse;
    mocks.parseJsonBody.mockResolvedValue({ text: 'hello' });

    for (let i = 0; i < 8; i += 1) {
      await handleChannelRoutes(createRequest('POST'), res, url, ctx);
    }
    await handleChannelRoutes(createRequest('POST'), res, url, ctx);

    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 429, {
      success: false,
      error: 'Rate limit exceeded',
      retryAfterSeconds: expect.any(Number),
    });
    const lastCall = mocks.sendJson.mock.calls[mocks.sendJson.mock.calls.length - 1];
    expect(lastCall[2].retryAfterSeconds).toBeGreaterThan(0);
  });

  it('deletes only the targeted account binding when accountId is provided', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('DELETE'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/config/feishu?accountId=agent-a'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.deleteChannelAccountConfig).toHaveBeenCalledWith('feishu', 'agent-a');
    expect(mocks.clearChannelBinding).toHaveBeenCalledWith('feishu', 'agent-a');
    expect(mocks.deleteChannelConfig).not.toHaveBeenCalled();
    expect(mocks.clearAllBindingsForChannel).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, { success: true });
  });

  it('rejects send requests for unknown scoped channel ids', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(async (method: string) => {
          if (method === 'channels.status') {
            return {
              channels: {
                feishu: { configured: true, running: true },
              },
              channelAccounts: {
                feishu: [
                  {
                    accountId: 'default',
                    configured: true,
                    connected: true,
                  },
                ],
              },
              channelDefaultAccountId: {
                feishu: 'default',
              },
            };
          }
          throw new Error(`Unexpected RPC method: ${method}`);
        }),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const res = {} as ServerResponse;
    mocks.parseJsonBody.mockResolvedValue({ text: 'hello' });

    const handled = await handleChannelRoutes(
      createRequest('POST'),
      res,
      new URL('http://127.0.0.1:3210/api/channels/feishu-agent-a/send'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 404, {
      success: false,
      error: 'Channel not found',
    });
  });

  it('rejects ambiguous bare channel ids when multiple scoped accounts exist', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(async (method: string) => {
          if (method === 'channels.status') {
            return {
              channels: {
                feishu: { configured: true, running: true },
              },
              channelAccounts: {
                feishu: [
                  {
                    accountId: 'default',
                    configured: true,
                    connected: true,
                  },
                  {
                    accountId: 'agent-a',
                    configured: true,
                    connected: true,
                  },
                ],
              },
              channelDefaultAccountId: {
                feishu: 'default',
              },
            };
          }
          throw new Error(`Unexpected RPC method: ${method}`);
        }),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const res = {} as ServerResponse;
    mocks.parseJsonBody.mockResolvedValue({ text: 'hello' });

    const handled = await handleChannelRoutes(
      createRequest('POST'),
      res,
      new URL('http://127.0.0.1:3210/api/channels/feishu/send'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 409, {
      success: false,
      error: 'Channel account is ambiguous',
    });
  });

  it('rejects config save for unknown scoped account ids', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.parseJsonBody.mockResolvedValue({
      channelType: 'feishu',
      accountId: 'ghost-agent',
      config: { webhook: 'https://example.test/hook' },
    });

    const handled = await handleChannelRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/config'),
      {
        gatewayManager: {
          getStatus: () => ({ state: 'running', port: 18789 }),
          rpc: vi.fn(),
          debouncedRestart: vi.fn(),
          debouncedReload: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(mocks.saveChannelConfig).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 404, {
      success: false,
      error: 'Scoped channel account not found',
    });
  });

  it('rejects config read for unknown scoped account ids', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/config/feishu?accountId=ghost-agent'),
      {
        gatewayManager: {
          getStatus: () => ({ state: 'running', port: 18789 }),
          rpc: vi.fn(),
          debouncedRestart: vi.fn(),
          debouncedReload: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(mocks.getChannelFormValues).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 404, {
      success: false,
      error: 'Scoped channel account not found',
    });
  });

  it('rejects config delete for unknown scoped account ids', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');

    const handled = await handleChannelRoutes(
      createRequest('DELETE'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/config/feishu?accountId=ghost-agent'),
      {
        gatewayManager: {
          getStatus: () => ({ state: 'running', port: 18789 }),
          rpc: vi.fn(),
          debouncedRestart: vi.fn(),
          debouncedReload: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(mocks.deleteChannelAccountConfig).not.toHaveBeenCalled();
    expect(mocks.clearChannelBinding).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 404, {
      success: false,
      error: 'Scoped channel account not found',
    });
  });

  it('rejects WhatsApp login start for unknown scoped account ids', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.parseJsonBody.mockResolvedValue({ accountId: 'ghost-agent' });

    const handled = await handleChannelRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/whatsapp/start'),
      {
        gatewayManager: {
          getStatus: () => ({ state: 'running', port: 18789 }),
          rpc: vi.fn(),
          debouncedRestart: vi.fn(),
          debouncedReload: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(mocks.whatsAppStart).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 404, {
      success: false,
      error: 'Scoped channel account not found',
    });
  });

  it('allows known scoped account ids for config save and whatsapp login', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    mocks.parseJsonBody.mockResolvedValueOnce({
      channelType: 'feishu',
      accountId: 'agent-a',
      config: { webhook: 'https://example.test/hook' },
    });
    let handled = await handleChannelRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/config'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.saveChannelConfig).toHaveBeenCalledWith('feishu', { webhook: 'https://example.test/hook' }, 'agent-a');

    mocks.parseJsonBody.mockResolvedValueOnce({ accountId: 'agent-a' });
    handled = await handleChannelRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/whatsapp/start'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.whatsAppStart).toHaveBeenCalledWith('agent-a');
  });
});
