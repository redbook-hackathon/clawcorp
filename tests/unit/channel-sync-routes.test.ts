import type { IncomingMessage, ServerResponse } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  parseJsonBody: vi.fn(),
  listConfiguredChannels: vi.fn(async () => ['feishu']),
  listConfiguredAgentIds: vi.fn(async () => ['main', 'agent-a']),
  listAgentsSnapshot: vi.fn(async () => ({
    agents: [
      { id: 'main', mainSessionKey: 'agent:main:main' },
      { id: 'agent-a', mainSessionKey: 'agent:agent-a:desk' },
    ],
    defaultAgentId: 'main',
    configuredChannelTypes: ['feishu'],
    channelOwners: { feishu: 'main' },
  })),
  deleteChannelConfig: vi.fn(),
  deleteChannelAccountConfig: vi.fn(),
  clearAllBindingsForChannel: vi.fn(),
  clearChannelBinding: vi.fn(),
  cleanupDanglingWeChatPluginState: vi.fn(async () => ({ cleanedDanglingState: false })),
  getChannelFormValues: vi.fn(),
  saveChannelConfig: vi.fn(),
  whatsAppStart: vi.fn(),
  weChatStart: vi.fn(),
  weChatStop: vi.fn(),
  weChatGetState: vi.fn(() => null),
  sendFeishuViaPreferredPath: vi.fn(),
  bindingGet: vi.fn(),
  bindingUpsert: vi.fn(),
}));

const TEST_FEISHU_SNAPSHOT_KEY = '__clawcorpTestFeishuWorkbenchSnapshot';
const TEST_DERIVED_WORKBENCH_RECORDS_KEY = '__clawcorpTestDerivedWorkbenchRecords';

vi.mock('@electron/api/route-utils', () => ({
  sendJson: mocks.sendJson,
  parseJsonBody: mocks.parseJsonBody,
}));

vi.mock('@electron/utils/channel-config', () => ({
  cleanupDanglingWeChatPluginState: mocks.cleanupDanglingWeChatPluginState,
  listConfiguredChannels: mocks.listConfiguredChannels,
  deleteChannelConfig: mocks.deleteChannelConfig,
  deleteChannelAccountConfig: mocks.deleteChannelAccountConfig,
  getChannelFormValues: mocks.getChannelFormValues,
  saveChannelConfig: mocks.saveChannelConfig,
  setChannelEnabled: vi.fn(),
  validateChannelConfig: vi.fn(),
  validateChannelCredentials: vi.fn(),
}));

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelToAgent: vi.fn(),
  clearAllBindingsForChannel: mocks.clearAllBindingsForChannel,
  clearChannelBinding: mocks.clearChannelBinding,
  listConfiguredAgentIds: mocks.listConfiguredAgentIds,
  listAgentsSnapshot: mocks.listAgentsSnapshot,
}));

vi.mock('@electron/utils/whatsapp-login', () => ({
  whatsAppLoginManager: {
    start: mocks.whatsAppStart,
    stop: vi.fn(),
  },
}));

vi.mock('@electron/utils/wechat-login', () => ({
  weChatLoginManager: {
    start: mocks.weChatStart,
    stop: mocks.weChatStop,
    getState: mocks.weChatGetState,
  },
}));

vi.mock('@electron/utils/feishu-send-path', () => ({
  sendFeishuViaPreferredPath: mocks.sendFeishuViaPreferredPath,
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

vi.mock('@electron/services/channel-conversation-bindings', () => ({
  createChannelConversationBindingStore: vi.fn(() => ({
    get: mocks.bindingGet,
    upsert: mocks.bindingUpsert,
    deleteByChannel: vi.fn(),
  })),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => 'C:/test-app',
  },
}));

function createRequest(method: string): IncomingMessage {
  return { method } as IncomingMessage;
}

describe('channel sync workbench routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>)[TEST_FEISHU_SNAPSHOT_KEY];
    delete (globalThis as Record<string, unknown>)[TEST_DERIVED_WORKBENCH_RECORDS_KEY];
    mocks.weChatGetState.mockReturnValue(null);
    mocks.bindingGet.mockResolvedValue(null);
    mocks.bindingUpsert.mockImplementation(async (record: Record<string, unknown>) => ({
      ...record,
      updatedAt: Date.now(),
    }));
    mocks.sendFeishuViaPreferredPath.mockImplementation(async (params: {
      runtimeSend?: () => Promise<unknown>;
      directSend?: () => Promise<unknown>;
    }) => {
      if (params.runtimeSend) return params.runtimeSend();
      if (params.directSend) return params.directSend();
      throw new Error('No Feishu send path is available');
    });
  });

  it('returns feishu-first synchronized sessions derived from configured accounts', async () => {
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
                    name: 'R&D DevOps Group',
                    lastInboundAt: Date.parse('2026-03-26T09:05:00.000Z'),
                  },
                  {
                    accountId: 'agent-a',
                    configured: true,
                    connected: true,
                    name: 'Alice',
                    lastOutboundAt: Date.parse('2026-03-26T09:04:00.000Z'),
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
      new URL('http://127.0.0.1:3210/api/channels/workbench/sessions?channelType=feishu'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      sessions: [
        expect.objectContaining({
          id: 'feishu-default',
          sessionType: 'group',
          title: 'R&D DevOps Group',
          pinned: true,
          syncState: 'synced',
        }),
        expect.objectContaining({
          id: 'feishu-agent-a',
          sessionType: 'private',
          title: 'Alice',
          pinned: false,
          syncState: 'synced',
        }),
      ],
    });
  });

  it('returns runtime-backed messages for a bound feishu conversation', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.bindingGet.mockResolvedValue({
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'oc_123',
      agentId: 'main',
      sessionKey: 'agent:main:feishu:group:oc_123',
      updatedAt: Date.now(),
    });

    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'chat.history') {
        return {
          messages: [
            {
              id: 'msg-user-1',
              role: 'user',
              content: 'Feishu user: test message',
              timestamp: Date.parse('2026-03-26T09:05:00.000Z'),
            },
            {
              id: 'msg-assistant-1',
              role: 'assistant',
              content: 'ClawCorp: received, handling now',
              timestamp: Date.parse('2026-03-26T09:05:03.000Z'),
            },
          ],
        };
      }
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
                name: 'R&D DevOps Group',
              },
            ],
          },
          channelDefaultAccountId: {
            feishu: 'default',
          },
        };
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    });

    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: gatewayRpc,
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/messages?conversationId=feishu:default:oc_123'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(gatewayRpc).toHaveBeenCalledWith('chat.history', {
      sessionKey: 'agent:main:feishu:group:oc_123',
      limit: 200,
    });
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      conversation: expect.objectContaining({
        id: 'feishu:default:oc_123',
        visibleAgentId: 'main',
      }),
      messages: [
        expect.objectContaining({
          id: 'msg-user-1',
          role: 'human',
          content: 'Feishu user: test message',
        }),
        expect.objectContaining({
          id: 'msg-assistant-1',
          role: 'agent',
          content: 'ClawCorp: received, handling now',
        }),
      ],
    });
  });

  it('keeps unbound conversations readable through fallback metadata', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    (globalThis as Record<string, unknown>)[TEST_FEISHU_SNAPSHOT_KEY] = {
      sessions: [
        {
          id: 'feishu:default:oc_unbound',
          channelId: 'feishu-default',
          channelType: 'feishu',
          sessionType: 'group',
          title: 'Discovered Group',
          pinned: true,
          syncState: 'synced',
          participantSummary: 'synced group chat',
          visibleAgentId: 'main',
        },
      ],
      messagesByConversationId: new Map([
        ['feishu:default:oc_unbound', [
          { id: 'snapshot-message-1', role: 'human', content: 'snapshot fallback message' },
        ]],
      ]),
    };
    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'chat.history') {
        throw new Error('runtime unavailable');
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    });
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: gatewayRpc,
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/messages?conversationId=feishu:default:oc_unbound'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.bindingUpsert).toHaveBeenCalledWith(expect.objectContaining({
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'oc_unbound',
      agentId: 'main',
      sessionKey: 'agent:main:feishu:group:oc_unbound',
    }));
    expect(gatewayRpc).toHaveBeenCalledWith('chat.history', {
      sessionKey: 'agent:main:feishu:group:oc_unbound',
      limit: 200,
    });
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      conversation: expect.objectContaining({
        id: 'feishu:default:oc_unbound',
        title: 'Discovered Group',
        syncState: 'synced',
      }),
      messages: [
        expect.objectContaining({
          id: 'snapshot-message-1',
          role: 'human',
          content: 'snapshot fallback message',
        }),
      ],
    });
  });

  it('uses feishu channel ownership to derive default session key when creating a new binding', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    (globalThis as Record<string, unknown>)[TEST_FEISHU_SNAPSHOT_KEY] = {
      sessions: [
        {
          id: 'feishu:default:oc_create',
          channelId: 'feishu-default',
          channelType: 'feishu',
          sessionType: 'group',
          title: 'Discovered For Binding',
          pinned: true,
          syncState: 'synced',
          participantSummary: 'synced group chat',
          visibleAgentId: 'main',
        },
      ],
      messagesByConversationId: new Map(),
    };
    mocks.listAgentsSnapshot.mockResolvedValue({
      agents: [
        { id: 'main', mainSessionKey: 'agent:main:main' },
        { id: 'agent-a', mainSessionKey: 'agent:agent-a:desk-main' },
      ],
      defaultAgentId: 'main',
      configuredChannelTypes: ['feishu'],
      channelOwners: { feishu: 'agent-a' },
    });

    const gatewayRpc = vi.fn(async (method: string) => {
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
                name: 'R&D DevOps Group',
              },
            ],
          },
          channelDefaultAccountId: {
            feishu: 'default',
          },
        };
      }
      if (method === 'chat.history') {
        return {
          messages: [
            { id: 'msg-assistant-2', role: 'assistant', content: 'owner-routed message' },
          ],
        };
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    });

    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: gatewayRpc,
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/messages?conversationId=feishu:default:oc_create'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.bindingUpsert).toHaveBeenCalledWith(expect.objectContaining({
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'oc_create',
      agentId: 'agent-a',
      sessionKey: 'agent:agent-a:feishu:group:oc_create',
    }));
    expect(gatewayRpc).toHaveBeenCalledWith('chat.history', {
      sessionKey: 'agent:agent-a:feishu:group:oc_create',
      limit: 200,
    });
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      conversation: expect.objectContaining({
        id: 'feishu:default:oc_create',
        visibleAgentId: 'agent-a',
      }),
      messages: [
        expect.objectContaining({
          id: 'msg-assistant-2',
          role: 'agent',
          content: 'owner-routed message',
        }),
      ],
    });
  });

  it('returns neutral payload for synthetic unknown feishu ids without binding/runtime calls', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const gatewayRpc = vi.fn(async (method: string) => {
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
                name: 'R&D DevOps Group',
              },
            ],
          },
          channelDefaultAccountId: {
            feishu: 'default',
          },
        };
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    });
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: gatewayRpc,
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/messages?conversationId=feishu:default:ghost-default'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.bindingUpsert).not.toHaveBeenCalled();
    expect(gatewayRpc).not.toHaveBeenCalledWith('chat.history', expect.anything());
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      conversation: null,
      messages: [],
    });
  });

  it('prefers direct feishu send over runtime chat.send when the plugin path is available', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.bindingGet.mockResolvedValue({
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'oc_bound_send',
      agentId: 'main',
      sessionKey: 'agent:main:feishu:group:oc_bound_send',
      updatedAt: Date.now(),
    });
    mocks.parseJsonBody.mockResolvedValue({
      text: '你好',
      conversationId: 'feishu:default:oc_bound_send',
    });
    mocks.sendFeishuViaPreferredPath.mockResolvedValue({
      transport: 'direct',
      messageId: 'om_direct_1',
      chatId: 'oc_bound_send',
    });

    const gatewayRpc = vi.fn(async (method: string) => {
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
                name: 'R&D DevOps Group',
              },
            ],
          },
          channelDefaultAccountId: {
            feishu: 'default',
          },
        };
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    });

    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: gatewayRpc,
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/feishu-default/send'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendFeishuViaPreferredPath).toHaveBeenCalledTimes(1);
    expect(gatewayRpc).not.toHaveBeenCalledWith('chat.send', expect.anything());
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
      messageId: 'om_direct_1',
      chatId: 'oc_bound_send',
    }));
  });

  it('falls back to runtime-derived feishu sessions when live snapshot is empty', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    (globalThis as Record<string, unknown>)[TEST_DERIVED_WORKBENCH_RECORDS_KEY] = [
      {
        sessionKey: 'agent:main:main',
        channelType: 'feishu',
        accountId: 'default',
        target: 'user:ou_runtime_1',
        title: '一位男子的智能助手',
        sessionType: 'private',
        latestActivityAt: '2026-04-04T08:43:00.000Z',
        updatedAt: Date.parse('2026-04-04T08:43:00.000Z'),
        visibleAgentId: 'main',
      },
    ];
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
                    name: 'Feishu Bot',
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
      new URL('http://127.0.0.1:3210/api/channels/workbench/sessions?channelType=feishu'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      sessions: [
        expect.objectContaining({
          id: 'feishu:default:user:ou_runtime_1',
          channelId: 'feishu-default',
          channelType: 'feishu',
          sessionType: 'private',
          title: '一位男子的智能助手',
          visibleAgentId: 'main',
        }),
      ],
    });
  });

  it('reads feishu runtime-derived conversations from session-backed records when live snapshot is empty', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    (globalThis as Record<string, unknown>)[TEST_DERIVED_WORKBENCH_RECORDS_KEY] = [
      {
        sessionKey: 'agent:main:main',
        channelType: 'feishu',
        accountId: 'default',
        target: 'user:ou_runtime_1',
        title: '一位男子的智能助手',
        sessionType: 'private',
        latestActivityAt: '2026-04-04T08:43:00.000Z',
        updatedAt: Date.parse('2026-04-04T08:43:00.000Z'),
        visibleAgentId: 'main',
      },
    ];
    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'chat.history') {
        return {
          messages: [
            {
              id: 'msg-user-runtime',
              role: 'user',
              content: 'ou_abc123def456: 你好哇',
              timestamp: Date.parse('2026-04-04T08:43:00.000Z'),
            },
            {
              id: 'msg-agent-runtime',
              role: 'assistant',
              content: '你好哇钱哥！',
              timestamp: Date.parse('2026-04-04T08:43:10.000Z'),
            },
          ],
        };
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    });
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: gatewayRpc,
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/conversations/feishu%3Adefault%3Auser%3Aou_runtime_1/messages?limit=50'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.bindingUpsert).toHaveBeenCalledWith(expect.objectContaining({
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'user:ou_runtime_1',
      agentId: 'main',
      sessionKey: 'agent:main:main',
    }));
    expect(gatewayRpc).toHaveBeenCalledWith('chat.history', {
      sessionKey: 'agent:main:main',
      limit: 500,
    });
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
      conversation: expect.objectContaining({
        id: 'feishu:default:user:ou_runtime_1',
        title: '一位男子的智能助手',
        visibleAgentId: 'main',
      }),
      messages: [
        expect.objectContaining({
          id: 'msg-user-runtime',
          role: 'human',
          content: '你好哇',
        }),
        expect.objectContaining({
          id: 'msg-agent-runtime',
          role: 'agent',
          content: '你好哇钱哥！',
        }),
      ],
      hasMore: false,
    }));
  });

  it('returns paginated messages with hasMore=true when more messages exist', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    (globalThis as Record<string, unknown>)[TEST_FEISHU_SNAPSHOT_KEY] = {
      sessions: [{ id: 'feishu:default:oc_pg', channelId: 'feishu-default', channelType: 'feishu', sessionType: 'group', title: 'PG Group', pinned: false, syncState: 'synced' }],
      messagesByConversationId: new Map([
        ['feishu:default:oc_pg', [
          { id: 'msg-1', role: 'human', content: 'oldest', createdAt: '2026-03-01T00:00:00.000Z' },
          { id: 'msg-2', role: 'human', content: 'middle', createdAt: '2026-03-02T00:00:00.000Z' },
          { id: 'msg-3', role: 'agent', content: 'newest', createdAt: '2026-03-03T00:00:00.000Z' },
        ]],
      ]),
    };
    mocks.bindingGet.mockResolvedValue({ sessionKey: 'agent:main:main', agentId: 'main' });
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(async () => { throw new Error('not used'); }),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/conversations/feishu:default:oc_pg/messages?limit=2'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
      hasMore: true,
    }));
  });

  it('paginates messages older than the cursor timestamp', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    (globalThis as Record<string, unknown>)[TEST_FEISHU_SNAPSHOT_KEY] = {
      sessions: [{ id: 'feishu:default:oc_cursor', channelId: 'feishu-default', channelType: 'feishu', sessionType: 'group', title: 'Cursor Group', pinned: false, syncState: 'synced' }],
      messagesByConversationId: new Map([
        ['feishu:default:oc_cursor', [
          { id: 'msg-old', role: 'human', content: 'before cursor', createdAt: '2026-03-01T00:00:00.000Z' },
          { id: 'msg-new', role: 'human', content: 'after cursor', createdAt: '2026-03-10T00:00:00.000Z' },
        ]],
      ]),
    };
    mocks.bindingGet.mockResolvedValue({ sessionKey: 'agent:main:main', agentId: 'main' });
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(async () => { throw new Error('not used'); }),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/conversations/feishu:default:oc_cursor/messages?cursor=2026-03-05T00:00:00.000Z'),
      ctx,
    );

    expect(handled).toBe(true);
    const call = mocks.sendJson.mock.lastCall;
    const body = call?.[2] as { messages?: Array<{ id: string }> };
    expect(body.messages?.map((m) => m.id)).toEqual(['msg-old']);
  });

  it('media proxy rejects non-Feishu URLs with 403', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const writtenChunks: string[] = [];
    let writtenStatusCode = 0;
    const mockRes = {
      writeHead: vi.fn((code: number) => { writtenStatusCode = code; }),
      end: vi.fn((chunk: string) => { writtenChunks.push(chunk); }),
    } as unknown as ServerResponse;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      mockRes,
      new URL('http://127.0.0.1:3210/api/channels/workbench/media?url=' + encodeURIComponent('https://evil.example.com/img.png')),
      ctx,
    );

    expect(handled).toBe(true);
    expect(writtenStatusCode).toBe(403);
    const body = JSON.parse(writtenChunks[0] ?? '{}') as { error?: string };
    expect(body.error).toBeTruthy();
  });

  it('members endpoint returns 400 when sessionId is missing', async () => {
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
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/members'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 400, expect.objectContaining({ error: expect.any(String) }));
  });

  it('members endpoint returns members array for a known session', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    (globalThis as Record<string, unknown>)[TEST_FEISHU_SNAPSHOT_KEY] = {
      sessions: [{ id: 'feishu:default:oc_members', channelId: 'feishu-default', channelType: 'feishu', sessionType: 'group', title: 'Members Group', pinned: false, syncState: 'synced' }],
      messagesByConversationId: new Map(),
    };
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: vi.fn(),
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/members?sessionId=feishu:default:oc_members'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
      members: expect.any(Array),
    }));
  });

  it('send with identity=self falls back to bot send with warning when feishu user auth unavailable', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.parseJsonBody.mockResolvedValue({ text: '你好', conversationId: 'feishu:default:oc_test', identity: 'self' });
    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'chat.send') return { success: true };
      if (method === 'channels.status') return { channels: { feishu: { configured: true, running: true } }, channelAccounts: { feishu: [{ accountId: 'default', configured: true, connected: true, name: 'R&D Bot' }] }, defaultAgentId: 'main', channelOwners: { feishu: 'main' } };
      throw new Error(`Unexpected: ${method}`);
    });
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: gatewayRpc,
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/feishu-default/send'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({ success: true }));
  });
  it('renames a workbench conversation by persisting displayTitle metadata', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.parseJsonBody.mockResolvedValue({ title: '客服群' });
    mocks.bindingUpsert.mockResolvedValue({
      channelType: 'wechat',
      accountId: 'default',
      externalConversationId: 'gc_001',
      agentId: 'main',
      sessionKey: 'agent:main:wechat:group:gc_001',
      displayTitle: '客服群',
      updatedAt: Date.now(),
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
      createRequest('PATCH'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/conversations/wechat%3Adefault%3Agc_001'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.bindingUpsert).toHaveBeenCalledWith(expect.objectContaining({
      channelType: 'wechat',
      accountId: 'default',
      externalConversationId: 'gc_001',
      displayTitle: '客服群',
    }));
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
    }));
  });

  it('hides a workbench conversation without deleting the channel account', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.bindingUpsert.mockResolvedValue({
      channelType: 'wechat',
      accountId: 'default',
      externalConversationId: 'gc_001',
      agentId: 'main',
      sessionKey: 'agent:main:wechat:group:gc_001',
      hidden: true,
      updatedAt: Date.now(),
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
      new URL('http://127.0.0.1:3210/api/channels/workbench/conversations/wechat%3Adefault%3Agc_001'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.bindingUpsert).toHaveBeenCalledWith(expect.objectContaining({
      channelType: 'wechat',
      accountId: 'default',
      externalConversationId: 'gc_001',
      hidden: true,
    }));
    expect(mocks.deleteChannelAccountConfig).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
    }));
  });
  it('labels inbound wechat human messages as 微信用户 in runtime-backed conversation history', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.bindingGet.mockResolvedValue({
      channelType: 'wechat',
      accountId: 'default',
      externalConversationId: 'test_chat_id',
      agentId: 'main',
      sessionKey: 'agent:main:wechat:group:test_chat_id',
      updatedAt: Date.now(),
    });

    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'channels.status') {
        return {
          channels: { 'openclaw-weixin': { configured: true, running: true } },
          channelAccounts: { 'openclaw-weixin': [{ accountId: 'default', configured: true, connected: true, name: 'WeChat' }] },
          channelDefaultAccountId: { 'openclaw-weixin': 'default' },
        };
      }
      if (method === 'chat.history') {
        return {
          messages: [
            {
              id: 'wx-user-1',
              role: 'user',
              content: '你好',
              timestamp: Date.parse('2026-04-04T07:10:00.000Z'),
            },
          ],
        };
      }
      throw new Error(`Unexpected: ${method}`);
    });

    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: gatewayRpc, debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/conversations/wechat%3Adefault%3Atest_chat_id/messages?limit=50'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
      messages: [
        expect.objectContaining({
          id: 'wx-user-1',
          role: 'human',
          authorName: '微信用户',
          content: '你好',
        }),
      ],
    }));
  });

  it('reuses an existing wechat main-session binding when sending from the workbench', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.listConfiguredChannels.mockResolvedValueOnce(['wechat']);
    mocks.parseJsonBody.mockResolvedValue({ text: 'from desktop', conversationId: 'wechat:default:test_chat_id' });
    mocks.bindingGet.mockResolvedValue({
      channelType: 'wechat',
      accountId: 'default',
      externalConversationId: 'test_chat_id',
      agentId: 'main',
      sessionKey: 'agent:main:main',
      updatedAt: Date.now(),
    });

    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'chat.send') return { success: true };
      if (method === 'channels.status') {
        return {
          channels: { 'openclaw-weixin': { configured: true, running: true } },
          channelAccounts: { 'openclaw-weixin': [{ accountId: 'default', configured: true, connected: true, name: 'WeChat' }] },
          channelDefaultAccountId: { 'openclaw-weixin': 'default' },
          defaultAgentId: 'main',
          channelOwners: {},
        };
      }
      throw new Error(`Unexpected: ${method}`);
    });

    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: gatewayRpc, debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/wechat-default/send'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(gatewayRpc).toHaveBeenCalledWith('chat.send', expect.objectContaining({
      sessionKey: 'agent:main:main',
      message: 'from desktop',
      idempotencyKey: expect.any(String),
    }));
    expect(mocks.bindingUpsert).not.toHaveBeenCalledWith(expect.objectContaining({
      sessionKey: 'agent:main:wechat:group:test_chat_id',
    }));
  });

  it('applies persisted displayTitle to wechat conversation payloads', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.bindingGet.mockResolvedValue({
      channelType: 'wechat',
      accountId: 'default',
      externalConversationId: 'test_chat_id',
      agentId: 'main',
      sessionKey: 'agent:main:main',
      displayTitle: '小飞',
      updatedAt: Date.now(),
    });

    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'channels.status') {
        return {
          channels: { 'openclaw-weixin': { configured: true, running: true } },
          channelAccounts: { 'openclaw-weixin': [{ accountId: 'default', configured: true, connected: true, name: 'WeChat Bot' }] },
          channelDefaultAccountId: { 'openclaw-weixin': 'default' },
        };
      }
      if (method === 'chat.history') {
        return {
          messages: [
            {
              id: 'wx-user-1',
              role: 'user',
              content: 'hello',
              timestamp: Date.parse('2026-04-04T07:10:00.000Z'),
            },
          ],
        };
      }
      throw new Error(`Unexpected: ${method}`);
    });

    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: gatewayRpc, debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/conversations/wechat%3Adefault%3Atest_chat_id/messages?limit=50'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({
      success: true,
      conversation: expect.objectContaining({
        id: 'wechat:default:test_chat_id',
        title: '小飞',
      }),
    }));
  });
});

describe('WeChat workbench routes', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((m) => typeof m === 'function' && m.mockReset?.());
    mocks.listConfiguredChannels.mockResolvedValue(['wechat']);
    mocks.weChatGetState.mockReturnValue(null);
  });

  function createRequest(method: string): IncomingMessage {
    return { method } as IncomingMessage;
  }

  it('wechat qr endpoint returns contract fields required by onboarding wizard', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.weChatGetState.mockReturnValue({
      qrcode: 'base64-qrcode',
      qrcodeUrl: 'https://wechat.test/qr.png',
      sessionKey: 'wechat-login',
      status: 'pending',
      connected: false,
    });

    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: vi.fn(), debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/wechat/qr'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.weChatStart).toHaveBeenCalledTimes(1);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      qrcode: 'base64-qrcode',
      qrcodeUrl: 'https://wechat.test/qr.png',
      sessionKey: 'wechat-login',
      connected: false,
      status: 'pending',
    });
  });

  it('wechat qr status endpoint includes connected/sessionKey/account contract fields', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.weChatGetState.mockReturnValue({
      qrcode: 'base64-qrcode',
      qrcodeUrl: 'https://wechat.test/qr.png',
      sessionKey: 'wechat-login',
      status: 'confirmed',
      connected: true,
      accountId: 'default',
    });

    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: vi.fn(), debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/wechat/qr/status'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      sessionKey: 'wechat-login',
      status: 'confirmed',
      connected: true,
      accountId: 'default',
      error: undefined,
    });
  });

  it('builds wechat sessions with namespaced conversation ids', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'channels.status') {
        return {
          channels: {
            'openclaw-weixin': { configured: true, running: true },
          },
          channelAccounts: {
            'openclaw-weixin': [
              {
                accountId: 'default',
                configured: true,
                connected: true,
                name: 'WeChat Workspace',
              },
            ],
          },
          channelDefaultAccountId: {
            'openclaw-weixin': 'default',
          },
        };
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    });

    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', port: 18789 }),
        rpc: gatewayRpc,
        debouncedRestart: vi.fn(),
        debouncedReload: vi.fn(),
      },
    } as never;

    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/sessions?channelType=wechat'),
      ctx,
    );

    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, {
      success: true,
      sessions: [
        expect.objectContaining({
          id: 'wechat:default:default',
          channelId: 'wechat-default',
          channelType: 'wechat',
          sessionType: 'group',
          title: 'WeChat Workspace',
        }),
      ],
    });
  });

  it('wechat media proxy rejects non-WeChat URLs with 400', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: vi.fn(), debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/wechat/media?url=https%3A%2F%2Fevil.com%2Fimage.jpg'),
      ctx,
    );
    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 400, expect.objectContaining({ success: false }));
  });

  it('wechat members endpoint returns 400 when sessionId is missing', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: vi.fn(), debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/wechat/members'),
      ctx,
    );
    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 400, expect.objectContaining({ success: false }));
  });

  it('wechat members endpoint returns empty array when plugin unavailable', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: vi.fn(), debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/workbench/wechat/members?sessionId=wechat-default'),
      ctx,
    );
    expect(handled).toBe(true);
    expect(mocks.sendJson).toHaveBeenLastCalledWith(expect.anything(), 200, expect.objectContaining({ success: true, members: expect.any(Array) }));
  });

  it('wechat send routes through gateway chat.send', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    mocks.parseJsonBody.mockResolvedValue({ text: '你好微信', conversationId: 'wechat:default:test_chat_id' });
    mocks.bindingGet.mockResolvedValue({ sessionKey: 'agent:main:wechat:group:test_chat_id', agentId: 'main' });
    const gatewayRpc = vi.fn(async (method: string) => {
      if (method === 'chat.send') return { success: true };
      if (method === 'channels.status') return { channels: { wechat: { configured: true, running: true } }, channelAccounts: { wechat: [{ accountId: 'default', configured: true, connected: true, name: 'WeChat' }] }, defaultAgentId: 'main', channelOwners: {} };
      throw new Error(`Unexpected: ${method}`);
    });
    const ctx = { gatewayManager: { getStatus: () => ({ state: 'running', port: 18789 }), rpc: gatewayRpc, debouncedRestart: vi.fn(), debouncedReload: vi.fn() } } as never;
    const handled = await handleChannelRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/wechat-default/send'),
      ctx,
    );
    expect(handled).toBe(true);
    expect(gatewayRpc).toHaveBeenCalledWith('chat.send', expect.objectContaining({
      sessionKey: 'agent:main:wechat:group:test_chat_id',
      idempotencyKey: expect.any(String),
      message: '你好微信',
    }));
  });
});
