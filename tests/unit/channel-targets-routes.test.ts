import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const sendJsonMock = vi.fn();
const parseJsonBodyMock = vi.fn().mockResolvedValue({});
const proxyAwareFetchMock = vi.fn();
const readOpenClawConfigMock = vi.fn();
const sdkMocks = vi.hoisted(() => ({
  listDiscordDirectoryGroupsFromConfig: vi.fn(async () => []),
  listDiscordDirectoryPeersFromConfig: vi.fn(async () => []),
  normalizeDiscordMessagingTarget: vi.fn((target: string) => target),
  listTelegramDirectoryGroupsFromConfig: vi.fn(async () => []),
  listTelegramDirectoryPeersFromConfig: vi.fn(async () => []),
  normalizeTelegramMessagingTarget: vi.fn((target: string) => target),
  listSlackDirectoryGroupsFromConfig: vi.fn(async () => []),
  listSlackDirectoryPeersFromConfig: vi.fn(async () => []),
  normalizeSlackMessagingTarget: vi.fn((target: string) => target),
  normalizeWhatsAppMessagingTarget: vi.fn((target: string) => target),
}));
const testOpenClawConfigDir = join(tmpdir(), 'clawx-tests', 'channel-targets-openclaw');

vi.mock('@electron/utils/channel-config', () => ({
  cleanupDanglingWeChatPluginState: vi.fn(async () => ({ cleanedDanglingState: false })),
  deleteChannelAccountConfig: vi.fn(),
  deleteChannelConfig: vi.fn(),
  getChannelFormValues: vi.fn(),
  listConfiguredChannelAccounts: vi.fn(async () => ({})),
  listConfiguredChannels: vi.fn(async () => []),
  readOpenClawConfig: (...args: unknown[]) => readOpenClawConfigMock(...args),
  saveChannelConfig: vi.fn(),
  setChannelDefaultAccount: vi.fn(),
  setChannelEnabled: vi.fn(),
  validateChannelConfig: vi.fn(),
  validateChannelCredentials: vi.fn(),
}));

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelAccountToAgent: vi.fn(),
  assignChannelToAgent: vi.fn(),
  clearAllBindingsForChannel: vi.fn(),
  clearChannelBinding: vi.fn(),
  listAgentsSnapshot: vi.fn(async () => ({ agents: [], channelOwners: {}, configuredChannelTypes: [], defaultAgentId: 'main' })),
  listConfiguredAgentIds: vi.fn(async () => ['main']),
}));

vi.mock('@electron/utils/whatsapp-login', () => ({
  whatsAppLoginManager: { start: vi.fn(), stop: vi.fn() },
}));

vi.mock('@electron/utils/proxy-fetch', () => ({
  proxyAwareFetch: (...args: unknown[]) => proxyAwareFetchMock(...args),
}));

vi.mock('@electron/utils/openclaw-sdk', () => ({
  listDiscordDirectoryGroupsFromConfig: (...args: unknown[]) => sdkMocks.listDiscordDirectoryGroupsFromConfig(...args),
  listDiscordDirectoryPeersFromConfig: (...args: unknown[]) => sdkMocks.listDiscordDirectoryPeersFromConfig(...args),
  normalizeDiscordMessagingTarget: (...args: unknown[]) => sdkMocks.normalizeDiscordMessagingTarget(...args as [string]),
  listTelegramDirectoryGroupsFromConfig: (...args: unknown[]) => sdkMocks.listTelegramDirectoryGroupsFromConfig(...args),
  listTelegramDirectoryPeersFromConfig: (...args: unknown[]) => sdkMocks.listTelegramDirectoryPeersFromConfig(...args),
  normalizeTelegramMessagingTarget: (...args: unknown[]) => sdkMocks.normalizeTelegramMessagingTarget(...args as [string]),
  listSlackDirectoryGroupsFromConfig: (...args: unknown[]) => sdkMocks.listSlackDirectoryGroupsFromConfig(...args),
  listSlackDirectoryPeersFromConfig: (...args: unknown[]) => sdkMocks.listSlackDirectoryPeersFromConfig(...args),
  normalizeSlackMessagingTarget: (...args: unknown[]) => sdkMocks.normalizeSlackMessagingTarget(...args as [string]),
  normalizeWhatsAppMessagingTarget: (...args: unknown[]) => sdkMocks.normalizeWhatsAppMessagingTarget(...args as [string]),
}));

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/utils/paths', () => ({
  getOpenClawConfigDir: () => testOpenClawConfigDir,
  getOpenClawDir: () => testOpenClawConfigDir,
  getOpenClawResolvedDir: () => testOpenClawConfigDir,
  getDataDir: () => join(testOpenClawConfigDir, 'user-data'),
  ensureDir: vi.fn(),
}));

vi.mock('@electron/services/channel-conversation-bindings', () => ({
  createChannelConversationBindingStore: vi.fn(() => ({
    get: vi.fn(),
    upsert: vi.fn(),
    deleteByChannel: vi.fn(),
  })),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => 'C:/test-app',
    getPath: () => 'C:/test-user-data',
  },
}));

function createRequest(method: string): IncomingMessage {
  return { method } as IncomingMessage;
}

describe('channel target routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rmSync(testOpenClawConfigDir, { recursive: true, force: true });
    readOpenClawConfigMock.mockResolvedValue({ channels: {} });
    sdkMocks.listDiscordDirectoryGroupsFromConfig.mockResolvedValue([]);
    sdkMocks.listDiscordDirectoryPeersFromConfig.mockResolvedValue([]);
    sdkMocks.normalizeDiscordMessagingTarget.mockImplementation((target: string) => target);
    sdkMocks.listTelegramDirectoryGroupsFromConfig.mockResolvedValue([]);
    sdkMocks.listTelegramDirectoryPeersFromConfig.mockResolvedValue([]);
    sdkMocks.normalizeTelegramMessagingTarget.mockImplementation((target: string) => target);
    sdkMocks.listSlackDirectoryGroupsFromConfig.mockResolvedValue([]);
    sdkMocks.listSlackDirectoryPeersFromConfig.mockResolvedValue([]);
    sdkMocks.normalizeSlackMessagingTarget.mockImplementation((target: string) => target);
    sdkMocks.normalizeWhatsAppMessagingTarget.mockImplementation((target: string) => target);
  });

  afterAll(() => {
    rmSync(testOpenClawConfigDir, { recursive: true, force: true });
  });

  it('lists QQ Bot known targets for a configured account', async () => {
    const knownUsersPath = join(testOpenClawConfigDir, 'qqbot', 'data');
    mkdirSync(knownUsersPath, { recursive: true });
    writeFileSync(join(knownUsersPath, 'known-users.json'), JSON.stringify([
      {
        openid: '207A5B8339D01F6582911C014668B77B',
        type: 'c2c',
        nickname: 'Alice',
        accountId: 'default',
        lastSeenAt: 200,
      },
      {
        openid: 'member-openid',
        type: 'group',
        nickname: 'Weather Group',
        groupOpenid: 'GROUP_OPENID_123',
        accountId: 'default',
        lastSeenAt: 100,
      },
    ]), 'utf8');

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/targets?channelType=qqbot&accountId=default'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channelType: 'qqbot',
        accountId: 'default',
        targets: expect.arrayContaining([
          expect.objectContaining({
            value: 'qqbot:c2c:207A5B8339D01F6582911C014668B77B',
            kind: 'user',
          }),
          expect.objectContaining({
            value: 'qqbot:group:GROUP_OPENID_123',
            kind: 'group',
          }),
        ]),
      }),
    );
  });

  it('lists Feishu live targets for a configured account', async () => {
    readOpenClawConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          appId: 'cli_app_id',
          appSecret: 'cli_app_secret',
          allowFrom: ['ou_config_user'],
          groups: {
            oc_config_group: {},
          },
        },
      },
    });

    proxyAwareFetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/tenant_access_token/internal')) {
        const body = JSON.parse(String(init?.body || '{}')) as { app_id?: string };
        if (body.app_id === 'cli_app_id') {
          return {
            ok: true,
            json: async () => ({
              code: 0,
              tenant_access_token: 'tenant-token',
            }),
          };
        }
      }

      if (url.includes('/applications/cli_app_id')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              app: {
                creator_id: 'ou_owner',
                owner: {
                  owner_type: 2,
                  owner_id: 'ou_owner',
                },
              },
            },
          }),
        };
      }

      if (url.includes('/contact/v3/users')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              items: [
                { open_id: 'ou_live_user', name: 'Alice Feishu' },
              ],
            },
          }),
        };
      }

      if (url.includes('/im/v1/chats')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              items: [
                { chat_id: 'oc_live_chat', name: 'Project Chat' },
              ],
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/targets?channelType=feishu&accountId=default'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channelType: 'feishu',
        accountId: 'default',
        targets: expect.arrayContaining([
          expect.objectContaining({ value: 'user:ou_live_user', kind: 'user' }),
          expect.objectContaining({ value: 'chat:oc_live_chat', kind: 'group' }),
        ]),
      }),
    );
  });

  it('lists WeCom targets from reqid cache and session history', async () => {
    mkdirSync(join(testOpenClawConfigDir, 'wecom'), { recursive: true });
    writeFileSync(
      join(testOpenClawConfigDir, 'wecom', 'reqid-map-default.json'),
      JSON.stringify({
        'chat-alpha': { reqId: 'req-1', ts: 100 },
      }),
      'utf8',
    );
    mkdirSync(join(testOpenClawConfigDir, 'agents', 'main', 'sessions'), { recursive: true });
    writeFileSync(
      join(testOpenClawConfigDir, 'agents', 'main', 'sessions', 'sessions.json'),
      JSON.stringify({
        'agent:main:wecom:chat-bravo': {
          updatedAt: 200,
          chatType: 'group',
          displayName: 'Ops Group',
          deliveryContext: {
            channel: 'wecom',
            accountId: 'default',
            to: 'wecom:chat-bravo',
          },
        },
      }),
      'utf8',
    );

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/targets?channelType=wecom&accountId=default'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channelType: 'wecom',
        accountId: 'default',
        targets: expect.arrayContaining([
          expect.objectContaining({ value: 'wecom:chat-bravo', kind: 'group' }),
          expect.objectContaining({ value: 'wecom:chat-alpha', kind: 'channel' }),
        ]),
      }),
    );
  });

  it('lists DingTalk targets from session history', async () => {
    mkdirSync(join(testOpenClawConfigDir, 'agents', 'main', 'sessions'), { recursive: true });
    writeFileSync(
      join(testOpenClawConfigDir, 'agents', 'main', 'sessions', 'sessions.json'),
      JSON.stringify({
        'agent:main:dingtalk:cid-group': {
          updatedAt: 300,
          chatType: 'group',
          displayName: 'DingTalk Dev Group',
          deliveryContext: {
            channel: 'dingtalk',
            accountId: 'default',
            to: 'cidDeVGroup=',
          },
        },
      }),
      'utf8',
    );

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/targets?channelType=dingtalk&accountId=default'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channelType: 'dingtalk',
        accountId: 'default',
        targets: [
          expect.objectContaining({
            value: 'cidDeVGroup=',
            kind: 'group',
          }),
        ],
      }),
    );
  });

  it('lists WeChat targets from session history via the UI alias', async () => {
    mkdirSync(join(testOpenClawConfigDir, 'agents', 'main', 'sessions'), { recursive: true });
    writeFileSync(
      join(testOpenClawConfigDir, 'agents', 'main', 'sessions', 'sessions.json'),
      JSON.stringify({
        'agent:main:wechat:wxid_target': {
          updatedAt: 400,
          chatType: 'direct',
          displayName: 'Alice WeChat',
          deliveryContext: {
            channel: 'openclaw-weixin',
            accountId: 'wechat-bot',
            to: 'wechat:wxid_target',
          },
        },
      }),
      'utf8',
    );

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/targets?channelType=wechat&accountId=wechat-bot'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channelType: 'wechat',
        accountId: 'wechat-bot',
        targets: [
          expect.objectContaining({
            value: 'wechat:wxid_target',
            kind: 'user',
          }),
        ],
      }),
    );
  });

  it('lists Telegram targets from directory providers', async () => {
    sdkMocks.listTelegramDirectoryPeersFromConfig.mockResolvedValueOnce([
      { kind: 'user', id: 'telegram:user:alice', name: 'Alice Telegram' },
    ]);
    sdkMocks.listTelegramDirectoryGroupsFromConfig.mockResolvedValueOnce([
      { kind: 'group', id: 'telegram:group:ops', name: 'Ops Group' },
    ]);

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/targets?channelType=telegram&accountId=default'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channelType: 'telegram',
        targets: expect.arrayContaining([
          expect.objectContaining({ value: 'telegram:user:alice', kind: 'user' }),
          expect.objectContaining({ value: 'telegram:group:ops', kind: 'group' }),
        ]),
      }),
    );
  });

  it('lists Discord targets from directory providers', async () => {
    sdkMocks.listDiscordDirectoryPeersFromConfig.mockResolvedValueOnce([
      { kind: 'user', id: 'discord:user:alice', name: 'Alice Discord' },
    ]);
    sdkMocks.listDiscordDirectoryGroupsFromConfig.mockResolvedValueOnce([
      { kind: 'channel', id: 'discord:channel:ops', name: 'Ops Channel' },
    ]);

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/targets?channelType=discord&accountId=default'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channelType: 'discord',
        targets: expect.arrayContaining([
          expect.objectContaining({ value: 'discord:user:alice', kind: 'user' }),
          expect.objectContaining({ value: 'discord:channel:ops', kind: 'channel' }),
        ]),
      }),
    );
  });

  it('lists WhatsApp targets from directory providers', async () => {
    sdkMocks.normalizeWhatsAppMessagingTarget.mockImplementationOnce((target: string) => target);
    sdkMocks.listSlackDirectoryPeersFromConfig.mockResolvedValueOnce([]);
    sdkMocks.listSlackDirectoryGroupsFromConfig.mockResolvedValueOnce([]);

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/targets?channelType=whatsapp&accountId=default'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalled();
  });
});
