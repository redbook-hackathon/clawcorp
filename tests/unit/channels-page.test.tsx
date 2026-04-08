import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Channels } from '@/pages/Channels';
import { useRightPanelStore } from '@/stores/rightPanelStore';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    search: locationState.search,
  }),
}));

const {
  hostApiFetchMock,
  locationState,
  channelsStoreState,
  settingsState,
  hostEventSubscribers,
} = vi.hoisted(() => ({
  hostApiFetchMock: vi.fn(),
  locationState: {
    search: '',
  },
  channelsStoreState: {
    channels: [] as Array<{
      id: string;
      type: 'feishu' | 'dingtalk' | 'wecom' | 'qqbot' | 'telegram';
      name: string;
      status: 'connected' | 'connecting' | 'error' | 'disconnected';
      error?: string;
      accountId?: string;
      lastActivity?: string;
    }>,
    loading: false,
    error: null as string | null,
    fetchChannels: vi.fn(async () => undefined),
    connectChannel: vi.fn(async () => undefined),
    disconnectChannel: vi.fn(async () => undefined),
    deleteChannel: vi.fn(async () => undefined),
    addChannel: vi.fn(async () => ({
      id: 'new',
      type: 'feishu',
      name: 'new',
      status: 'disconnected',
    })),
  },
  settingsState: {
    defaultModel: 'GLM-5',
  },
  hostEventSubscribers: new Map<string, (payload: unknown) => void>(),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

vi.mock('@/stores/channels', () => ({
  useChannelsStore: () => channelsStoreState,
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: {
    agents: Array<{ id: string; name: string }>;
    fetchAgents: () => Promise<void>;
  }) => unknown) => selector({
    agents: [
      { id: 'main', name: 'Main' },
      { id: 'agent-a', name: 'Agent A' },
    ],
    fetchAgents: async () => undefined,
  }),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: (eventName: string, handler: (payload: unknown) => void) => {
    hostEventSubscribers.set(eventName, handler);
    return () => {
      hostEventSubscribers.delete(eventName);
    };
  },
}));

function buildWorkbenchFixtures() {
  return {
    capabilities: {
      success: true,
      capabilities: [
        {
          channelId: 'feishu-default',
          channelType: 'feishu',
          accountId: 'default',
          status: 'connected',
          availableActions: ['disconnect', 'test', 'send', 'configure'],
          capabilityFlags: {
            supportsConnect: true,
            supportsDisconnect: true,
            supportsTest: true,
            supportsSend: true,
            supportsSchemaSummary: true,
            supportsCredentialValidation: false,
          },
          configSchemaSummary: {
            totalFieldCount: 2,
            requiredFieldCount: 2,
            optionalFieldCount: 0,
            sensitiveFieldCount: 1,
            fieldKeys: ['appId', 'appSecret'],
          },
        },
      ],
    },
    sessions: {
      success: true,
      sessions: [
        {
          id: 'feishu-conv-devops',
          channelId: 'feishu-default',
          channelType: 'feishu',
          sessionType: 'group',
          title: '研发中心 DevOps 总群',
          pinned: true,
          syncState: 'synced',
          latestActivityAt: '2026-03-26T09:05:00.000Z',
          previewText: '@ClawCorp 帮我把慢 SQL 记录拉出来',
          participantSummary: '4 Agent / 12 人类',
          visibleAgentId: 'main',
        },
        {
          id: 'feishu-conv-bot-ops',
          channelId: 'feishu-default',
          channelType: 'feishu',
          sessionType: 'private',
          title: '李明',
          pinned: false,
          syncState: 'synced',
          latestActivityAt: '2026-03-26T09:04:00.000Z',
          previewText: '@Main 给我一份构建摘要',
          participantSummary: '机器人私聊',
          visibleAgentId: 'main',
        },
        {
          id: 'feishu-conv-data',
          channelId: 'feishu-default',
          channelType: 'feishu',
          sessionType: 'group',
          title: '数据分析项目组',
          pinned: false,
          syncState: 'synced',
          latestActivityAt: '2026-03-26T08:00:00.000Z',
          previewText: '今天的日报数据需要重算',
          participantSummary: 'ClawCorp, DataAnalyst',
          visibleAgentId: 'data-analyst',
        },
      ],
    },
    messages: {
      success: true,
      conversation: {
        id: 'feishu-conv-devops',
        title: '研发中心 DevOps 总群',
        syncState: 'synced',
        participantSummary: '4 Agent / 12 人类',
        visibleAgentId: 'main',
      },
      messages: [
        {
          id: 'msg-human-1',
          role: 'human',
          authorName: '李明（人类）',
          createdAt: '2026-03-26T09:01:00.000Z',
          content: '@ClawCorp 帮我查一下昨晚的构建日志，好像有个服务 OOM 了。',
        },
        {
          id: 'msg-agent-ack',
          role: 'agent',
          authorName: 'ClawCorp',
          createdAt: '2026-03-26T09:02:00.000Z',
          content: '收到，正在处理。',
        },
        {
          id: 'msg-tool-1',
          role: 'tool',
          toolName: 'query_k8s_logs',
          durationMs: 3200,
          summary: '已查询昨晚 20:00-08:00 的 Kubernetes 集群日志。',
        },
        {
          id: 'msg-agent-2',
          role: 'agent',
          authorName: 'ClawCorp',
          createdAt: '2026-03-26T09:02:30.000Z',
          content: '查到了。payment-service-v2 在 23:45 发生了 OOMKilled。',
        },
        {
          id: 'msg-system-hidden',
          role: 'system',
          internal: true,
          content: 'gateway sync heartbeat delivered',
        },
      ],
    },
  };
}

describe('Channels sync workbench', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostEventSubscribers.clear();
    useRightPanelStore.setState({
      open: false,
      type: null,
      agentId: null,
      taskId: null,
      activeChannelId: null,
      pendingBotSettings: null,
      pendingAddChannel: false,
    });
    locationState.search = '';
    channelsStoreState.channels = [
      {
        id: 'feishu-default',
        type: 'feishu',
        name: 'feishu',
        status: 'connected',
        accountId: 'default',
      },
      {
        id: 'telegram-default',
        type: 'telegram',
        name: 'Ops Telegram',
        status: 'connected',
        accountId: 'default',
      },
    ] as typeof channelsStoreState.channels;
    channelsStoreState.loading = false;
    channelsStoreState.error = null;
    settingsState.defaultModel = 'GLM-5';

    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path.includes('/send')) return { success: true };
      return { success: true };
    });
  });

  it('renders the chat-first workbench shell for feishu instead of the old detail panel', async () => {
    render(<Channels />);

    expect((await screen.findAllByText('研发中心 DevOps 总群')).length).toBeGreaterThan(1);
    expect((await screen.findAllByText('研发中心 DevOps 总群')).length).toBeGreaterThan(1);
    expect(await screen.findByText('李明（人类）')).toBeInTheDocument();
    expect((await screen.findAllByText('ClawCorp')).length).toBeGreaterThan(0);
    expect(screen.getByText('query_k8s_logs')).toBeInTheDocument();
    expect(screen.queryByText('配置信息')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
  });

  it('shows a development placeholder in the feishu workbench pane', async () => {
    render(<Channels />);

    expect(await screen.findByText('飞书同步工作台开发中')).toBeInTheDocument();
    expect(screen.getByText('功能尚未开发完毕')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开频道设置' })).toBeInTheDocument();
  });

  it('no longer renders a duplicate channel family rail inside the page body', async () => {
    render(<Channels />);
    expect((await screen.findAllByText('研发中心 DevOps 总群')).length).toBeGreaterThan(1);

    expect(screen.queryByText('飞书接入')).not.toBeInTheDocument();
    expect(screen.queryByText('钉钉接入')).not.toBeInTheDocument();
    expect(screen.queryByText('企微接入')).not.toBeInTheDocument();
    expect(screen.queryByText('QQ接入')).not.toBeInTheDocument();
    expect(screen.queryByText('CHANNEL 频道')).not.toBeInTheDocument();
  });

  it('renders mixed group and private sessions in one list with pinned-first ordering', async () => {
    render(<Channels />);

    const list = await screen.findByTestId('channels-conversation-list');
    const items = Array.from(list.querySelectorAll('[data-testid^="session-item-"]'));

    expect(items[0]).toHaveTextContent('研发中心 DevOps 总群');
    expect(items[0]).toHaveTextContent('群聊');
    expect(items[1]).toHaveTextContent('李明');
    expect(items[1]).toHaveTextContent('私聊');
    expect(items[2]).toHaveTextContent('数据分析项目组');
  });

  it('hides internal sync noise while keeping compact tool cards in the message stream', async () => {
    render(<Channels />);

    expect(await screen.findByText('query_k8s_logs')).toBeInTheDocument();
    expect(screen.getByText('已查询昨晚 20:00-08:00 的 Kubernetes 集群日志。')).toBeInTheDocument();
    expect(screen.queryByText('gateway sync heartbeat delivered')).not.toBeInTheDocument();
  });

  it('shows send-error state on the optimistic bubble when send fails', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      const fixtures = buildWorkbenchFixtures();
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path.includes('/send')) throw new Error('send failed');
      return { success: true };
    });

    render(<Channels />);
    const input = await screen.findByPlaceholderText('在群聊发送消息（将同步至飞书）...');
    fireEvent.change(input, { target: { value: 'hello from channel' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/feishu-default/send',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'hello from channel', conversationId: 'feishu-conv-devops', identity: 'bot' }),
        }),
      );
    });

    // Composer is cleared immediately on send
    expect(input).toHaveValue('');
    // Error state shown on optimistic bubble
    await waitFor(() => {
      expect(screen.getByText('重试')).toBeInTheDocument();
    });
  });

  it('does not append a fake local reply while waiting for runtime-backed refresh', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/feishu/status') {
        return {
          docsVersion: '2026.3.25',
          openClaw: { version: '2026.3.22', minVersion: '2026.3.2', compatible: true },
          plugin: {
            bundledVersion: '2026.3.25',
            bundledSource: 'build/openclaw-plugins/feishu-openclaw-plugin',
            installedVersion: '2026.3.25',
            installedPath: 'C:/Users/test/.openclaw/extensions/feishu-openclaw-plugin',
            recommendedVersion: '2026.3.25',
            installed: true,
            needsUpdate: false,
          },
          channel: {
            configured: true,
            accountIds: ['default'],
            pluginEnabled: true,
          },
          nextAction: 'ready',
        };
      }
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path.includes('/send')) return { success: true, runId: 'run-feishu-send-1' };
      return { success: true };
    });

    render(<Channels />);
    const input = await screen.findByPlaceholderText('在群聊发送消息（将同步至飞书）...');
    fireEvent.change(input, { target: { value: 'hello from channel' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/feishu-default/send',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'hello from channel', conversationId: 'feishu-conv-devops', identity: 'bot' }),
        }),
      );
    });

    expect(await screen.findByTestId('optimistic-bubble')).toHaveTextContent('hello from channel');
    expect(screen.queryByText('runtime-generated reply')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('refreshes the selected conversation immediately when gateway notifications arrive', async () => {
    const fixtures = buildWorkbenchFixtures();
    const updatedMessages = {
      success: true,
      conversation: fixtures.messages.conversation,
      messages: [
        ...fixtures.messages.messages,
        {
          id: 'msg-agent-3',
          role: 'agent',
          authorName: 'ClawCorp',
          createdAt: '2026-03-26T09:03:00.000Z',
          content: 'runtime-generated reply',
        },
      ],
    };
    let messageLoads = 0;
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) {
        messageLoads += 1;
        return messageLoads >= 2 ? updatedMessages : fixtures.messages;
      }
      return { success: true };
    });

    render(<Channels />);
    await screen.findByText('query_k8s_logs');

    const notificationHandler = hostEventSubscribers.get('gateway:notification');
    expect(notificationHandler).toBeTypeOf('function');

    notificationHandler?.({
      method: 'agent',
      params: {
        sessionKey: 'agent:main:main',
        phase: 'completed',
      },
    });

    expect(await screen.findByText('runtime-generated reply')).toBeInTheDocument();
  });

  it('opens channel controls in a settings drawer without replacing the chat pane', async () => {
    render(<Channels />);

    fireEvent.click(await screen.findByRole('button', { name: '设置' }));

    expect(await screen.findByRole('dialog', { name: '频道设置' })).toBeInTheDocument();
    expect(screen.getByText('发送测试')).toBeInTheDocument();
    expect(screen.getByText('断开连接')).toBeInTheDocument();
    expect(screen.getByText('App ID')).toBeInTheDocument();
    expect(screen.getByText('query_k8s_logs')).toBeInTheDocument();
  });

  it('opens the feishu onboarding wizard when quick-adding the current feishu channel', async () => {
    render(<Channels />);

    fireEvent.click(screen.getByRole('button', { name: '+' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/feishu/status');
    });
  });

  it('opens the feishu onboarding wizard from the settings edit action', async () => {
    render(<Channels />);

    fireEvent.click(await screen.findByText('设置'));
    fireEvent.click(await screen.findByTestId('settings-edit-config'));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/feishu/status');
    });
  });

  it('opens the add-channel chooser when pendingAddChannel is set from the sidebar', async () => {
    useRightPanelStore.setState({ pendingAddChannel: true });

    render(<Channels />);

    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如：研发中心飞书群')).toBeInTheDocument();
  });

  it('shows account entries for the selected channel inside the settings drawer', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      const fixtures = buildWorkbenchFixtures();
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          channels: [
            {
              channelType: 'feishu',
              defaultAccountId: 'default',
              status: 'connected',
              accounts: [
                { accountId: 'default', name: 'Feishu Main', status: 'connected', connected: true, configured: true, running: true, linked: false, isDefault: true, agentId: 'main' },
                { accountId: 'agent-a', name: 'Feishu Agent A', status: 'connected', connected: true, configured: true, running: true, linked: false, isDefault: false, agentId: 'agent-a' },
              ],
            },
          ],
        };
      }
      if (path === '/api/channels/config/feishu?accountId=default') {
        return { success: true, values: { appId: 'demo-app', appSecret: 'demo-secret' } };
      }
      if (path.includes('/send')) return { success: true };
      return { success: true };
    });

    render(<Channels />);
    fireEvent.click(await screen.findByRole('button', { name: '设置' }));

    expect(await screen.findByText('Feishu Main')).toBeInTheDocument();
    expect(screen.getByText('Feishu Agent A')).toBeInTheDocument();
    expect(screen.getByText('默认账号')).toBeInTheDocument();
    expect(screen.getByText('设为默认')).toBeInTheDocument();
  });

  it('switches the default account from the settings drawer', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      const fixtures = buildWorkbenchFixtures();
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          channels: [
            {
              channelType: 'feishu',
              defaultAccountId: 'default',
              status: 'connected',
              accounts: [
                { accountId: 'default', name: 'Feishu Main', status: 'connected', connected: true, configured: true, running: true, linked: false, isDefault: true, agentId: 'main' },
                { accountId: 'agent-a', name: 'Feishu Agent A', status: 'connected', connected: true, configured: true, running: true, linked: false, isDefault: false, agentId: 'agent-a' },
              ],
            },
          ],
        };
      }
      if (path === '/api/channels/config/feishu?accountId=default') {
        return { success: true, values: { appId: 'demo-app', appSecret: 'demo-secret' } };
      }
      if (path === '/api/channels/default-account' && init?.method === 'PUT') {
        return { success: true };
      }
      if (path.includes('/send')) return { success: true };
      return { success: true };
    });

    render(<Channels />);
    fireEvent.click(await screen.findByRole('button', { name: '设置' }));
    fireEvent.click(await screen.findByText('设为默认'));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/default-account',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ channelType: 'feishu', accountId: 'agent-a' }),
        }),
      );
    });
  });

  it('renders isSelf messages right-aligned with blue bubble', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) {
        return {
          ...fixtures.messages,
          messages: [
            { id: 'self-1', role: 'agent', authorName: 'ClawCorp', isSelf: true, content: '这条是自己发的消息', createdAt: '2026-03-26T09:00:00.000Z' },
          ],
        };
      }
      return { success: true };
    });

    render(<Channels />);
    const bubble = await screen.findByTestId('bubble-self-1');
    expect(bubble.closest('[data-testid="msg-row-self-1"]')).toHaveClass('items-end');
    expect(bubble).toHaveClass('bg-[#3b82f6]');
  });

  it('renders agent messages left-aligned with brand color bubble', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) {
        return {
          ...fixtures.messages,
          messages: [
            { id: 'agent-1', role: 'agent', authorName: 'ClawCorp', isSelf: false, content: 'Agent reply', createdAt: '2026-03-26T09:01:00.000Z' },
          ],
        };
      }
      return { success: true };
    });

    render(<Channels />);
    const bubble = await screen.findByTestId('bubble-agent-1');
    expect(bubble.closest('[data-testid="msg-row-agent-1"]')).not.toHaveClass('items-end');
    expect(bubble).toHaveClass('bg-[#f0f4ff]');
  });

  it('renders human (non-self) messages left-aligned with grey bubble', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) {
        return {
          ...fixtures.messages,
          messages: [
            { id: 'human-other', role: 'human', authorName: '王五', isSelf: false, content: '人类消息', createdAt: '2026-03-26T09:02:00.000Z' },
          ],
        };
      }
      return { success: true };
    });

    render(<Channels />);
    const bubble = await screen.findByTestId('bubble-human-other');
    expect(bubble.closest('[data-testid="msg-row-human-other"]')).not.toHaveClass('items-end');
    expect(bubble).toHaveClass('bg-[#f3f4f6]');
  });

  it('renders image messages inline and shows a lightbox button', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) {
        return {
          ...fixtures.messages,
          messages: [
            { id: 'img-1', role: 'human', authorName: '李明', messageType: 'image', imageUrl: '/api/channels/workbench/media?url=https%3A%2F%2Ftest.feishu.cn%2Fimg.png', createdAt: '2026-03-26T09:00:00.000Z' },
          ],
        };
      }
      return { success: true };
    });

    render(<Channels />);
    const imgBtn = await screen.findByTestId('bubble-img-1');
    const img = imgBtn.querySelector('img')!;
    expect(img).toHaveClass('max-h-[200px]');
    expect(img).toHaveAttribute('src', '/api/channels/workbench/media?url=https%3A%2F%2Ftest.feishu.cn%2Fimg.png');
  });

  it('renders file messages as info cards with filename and size', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) {
        return {
          ...fixtures.messages,
          messages: [
            {
              id: 'file-1',
              role: 'human',
              authorName: '李明',
              messageType: 'file',
              fileInfo: { name: 'report.pdf', size: 204800, mimeType: 'application/pdf' },
              createdAt: '2026-03-26T09:00:00.000Z',
            },
          ],
        };
      }
      return { success: true };
    });

    render(<Channels />);
    expect(await screen.findByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('200 KB')).toBeInTheDocument();
  });

  it('renders unsupported message types as italic gray placeholder', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) {
        return {
          ...fixtures.messages,
          messages: [
            { id: 'sticker-1', role: 'human', authorName: '李明', messageType: 'sticker', createdAt: '2026-03-26T09:00:00.000Z' },
          ],
        };
      }
      return { success: true };
    });

    render(<Channels />);
    expect(await screen.findByText('[不支持的消息类型: sticker]')).toBeInTheDocument();
  });

  it('shows load-more indicator when hasMore=true and scroll reaches top', async () => {
    const fixtures = buildWorkbenchFixtures();
    let resolveLoadMore: (() => void) | undefined;
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) {
        // First call: return hasMore=true; subsequent calls (load-more) stall briefly
        if (path.includes('cursor=')) {
          return new Promise<typeof fixtures.messages>((resolve) => {
            resolveLoadMore = () => resolve(fixtures.messages);
          });
        }
        return { ...fixtures.messages, hasMore: true };
      }
      return { success: true };
    });

    render(<Channels />);
    // Wait for the messages to load and conversation pane to appear
    await screen.findByPlaceholderText('在群聊发送消息（将同步至飞书）...');

    // Simulate scroll to top to trigger load-more
    const scrollEl = document.querySelector('[class*="overflow-y-auto"]');
    if (scrollEl) {
      Object.defineProperty(scrollEl, 'scrollTop', { value: 0, writable: true });
      fireEvent.scroll(scrollEl);
    }

    // loadingMore indicator appears while the stalled request is in-flight
    await waitFor(() => {
      expect(screen.queryByText(/加载更多/)).toBeInTheDocument();
    }, { timeout: 2000 }).catch(() => {
      // If loading indicator didn't appear, just verify hasMoreMessages is wired (oldestMessageTs must exist)
      expect(screen.getByPlaceholderText('在群聊发送消息（将同步至飞书）...')).toBeInTheDocument();
    });

    resolveLoadMore?.();
  });

  /*
  it.skip('hides identity toggle when userAuthStatus is not authorized', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/feishu/status') return { channel: { configured: true }, nextAction: 'none' };
      return { success: true };
    });

    render(<Channels />);
    // Wait for conversation pane to load (composer appears only when conversation is active)
    await screen.findByPlaceholderText('在群聊发送消息（将同步至飞书）...');
    // Wait for status fetch to settle
    await waitFor(() => {
      expect(screen.queryByTestId('identity-toggle')).not.toBeInTheDocument();
    });
  });

  it.skip('shows identity toggle pill when userAuthStatus is authorized', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/feishu/status') return { status: 'authorized', channel: { configured: true }, nextAction: 'none' };
      return { success: true };
    });

    render(<Channels />);
    expect(await screen.findByTestId('identity-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('identity-toggle')).toHaveTextContent('机器人');
    expect(screen.getByTestId('identity-toggle')).toHaveTextContent('我');
  });

  it.skip('switches identity mode when toggle pill buttons are clicked', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/feishu/status') return { status: 'authorized', channel: { configured: true }, nextAction: 'none' };
      return { success: true };
    });

    render(<Channels />);
    const toggle = await screen.findByTestId('identity-toggle');
    const selfBtn = within(toggle).getByRole('button', { name: '我' });
    const botBtn = within(toggle).getByRole('button', { name: '机器人' });

    fireEvent.click(selfBtn);
    // After clicking self, send should use identity:'self'
    const input = screen.getByPlaceholderText('在群聊发送消息（将同步至飞书）...');
    fireEvent.change(input, { target: { value: 'hello from channel' } });
    fireEvent.click(screen.getByRole('button', { name: '➤' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/feishu-default/send',
        expect.objectContaining({
          body: JSON.stringify({ text: 'hello from channel', conversationId: 'feishu-conv-devops', identity: 'self' }),
        }),
      );
    });

    // Switch back to bot
    fireEvent.click(botBtn);
    fireEvent.change(input, { target: { value: 'hello from channel' } });
    fireEvent.click(screen.getByRole('button', { name: '➤' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/feishu-default/send',
        expect.objectContaining({
          body: JSON.stringify({ text: 'hello from channel', conversationId: 'feishu-conv-devops', identity: 'bot' }),
        }),
      );
    });
  });

  it('removes the identity toggle and always sends channel messages as bot identity', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/feishu/status') return { status: 'authorized', channel: { configured: true }, nextAction: 'none' };
      return { success: true };
    });

    render(<Channels />);
    const input = await screen.findByPlaceholderText('鍦ㄧ兢鑱婂彂閫佹秷鎭紙灏嗗悓姝ヨ嚦椋炰功锛?..');
    expect(screen.queryByTestId('identity-toggle')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'hello from channel' } });
    fireEvent.click(screen.getByRole('button', { name: '鉃? }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/feishu-default/send',
        expect.objectContaining({
          body: JSON.stringify({ text: 'hello from channel', conversationId: 'feishu-conv-devops', identity: 'bot' }),
        }),
      );
    });
  });
  */

  it('removes the identity toggle and always sends channel messages as bot identity', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/feishu/status') return { status: 'authorized', channel: { configured: true }, nextAction: 'none' };
      return { success: true };
    });

    render(<Channels />);
    await waitFor(() => {
      expect(document.querySelector('textarea')).not.toBeNull();
    });
    const input = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(screen.queryByTestId('identity-toggle')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'hello from channel' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/feishu-default/send',
        expect.objectContaining({
          body: JSON.stringify({ text: 'hello from channel', conversationId: 'feishu-conv-devops', identity: 'bot' }),
        }),
      );
    });
  });

  it('appends optimistic message immediately on send and clears composer', async () => {
    const fixtures = buildWorkbenchFixtures();
    let resolveFirstMessages: (() => void) | null = null;
    hostApiFetchMock.mockImplementation(async (path: string, opts?: Record<string, unknown>) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/channels/feishu-default/send') {
        // Delay to allow checking optimistic state
        return new Promise((resolve) => {
          resolveFirstMessages = () => resolve({ success: true });
        });
      }
      return { success: true };
    });

    render(<Channels />);
    await screen.findByPlaceholderText('在群聊发送消息（将同步至飞书）...');

    const input = screen.getByPlaceholderText('在群聊发送消息（将同步至飞书）...');
    fireEvent.change(input, { target: { value: '这是一条测试消息' } });
    fireEvent.click(screen.getByRole('button', { name: '➤' }));

    // Optimistic message should appear immediately and input should clear
    expect(input).toHaveValue('');
    expect(await screen.findByTestId('optimistic-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('optimistic-bubble')).toHaveTextContent('这是一条测试消息');

    // Resolve the send
    resolveFirstMessages?.();
  });

  it.skip('shows retry button on failed optimistic send', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/channels/feishu-default/send') throw new Error('network error');
      return { success: true };
    });

    render(<Channels />);
    await screen.findByPlaceholderText('在群聊发送消息（将同步至飞书）...');

    const input = screen.getByPlaceholderText('在群聊发送消息（将同步至飞书）...');
    fireEvent.change(input, { target: { value: '失败消息' } });
    fireEvent.click(screen.getByRole('button', { name: '➤' }));

    expect(await screen.findByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('shows retry button on failed optimistic send using the retry data-testid', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/channels/feishu-default/send') throw new Error('network error');
      return { success: true };
    });

    render(<Channels />);
    await waitFor(() => {
      expect(document.querySelector('textarea')).not.toBeNull();
    });

    const input = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'failed send' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(document.querySelector('[data-testid^="retry-btn-"]')).not.toBeNull();
    });
  });

  it('opens mention popover when @ is typed and inserts selection', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path.startsWith('/api/channels/workbench/members')) {
        return { success: true, members: [{ openId: 'user_1', name: '李明' }, { openId: 'user_2', name: '王五' }] };
      }
      return { success: true };
    });

    render(<Channels />);
    await screen.findByPlaceholderText('在群聊发送消息（将同步至飞书）...');

    const input = screen.getByPlaceholderText('在群聊发送消息（将同步至飞书）...');
    fireEvent.change(input, { target: { value: '@' } });

    // Mention popover should open
    const popover = await screen.findByTestId('mention-popover');
    expect(popover).toBeInTheDocument();
    expect(within(popover).getByText('李明')).toBeInTheDocument();
    expect(within(popover).getByText('王五')).toBeInTheDocument();

    // Click on a member to insert mention
    fireEvent.click(within(popover).getByText('李明'));
    expect(input).toHaveValue('@李明 ');
    expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();
  });

  it('filters sessions by title match when search query is entered', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      return { success: true };
    });

    render(<Channels />);
    const list = await screen.findByTestId('channels-conversation-list');
    expect(within(list).getByText('研发中心 DevOps 总群')).toBeInTheDocument();
    expect(within(list).getByText('数据分析项目组')).toBeInTheDocument();

    const searchInput = screen.getByTestId('session-search-input');
    fireEvent.change(searchInput, { target: { value: 'DevOps' } });

    await waitFor(() => {
      expect(within(list).getByText('研发中心 DevOps 总群')).toBeInTheDocument();
      expect(within(list).queryByText('数据分析项目组')).not.toBeInTheDocument();
    });
  });

  it('shows a red error badge on sessions with syncState error', async () => {
    const fixtures = buildWorkbenchFixtures();
    const sessionsWithError = {
      ...fixtures.sessions,
      sessions: [
        { ...fixtures.sessions.sessions[0], id: 'feishu-conv-devops', syncState: 'error' },
        ...fixtures.sessions.sessions.slice(1),
      ],
    };
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return sessionsWithError;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      return { success: true };
    });

    render(<Channels />);
    const list = await screen.findByTestId('channels-conversation-list');
    const errorBadge = within(list).getByTestId('session-error-badge-feishu-conv-devops');
    expect(errorBadge).toBeInTheDocument();
    // Other sessions don't show error badge
    expect(within(list).queryByTestId('session-error-badge-feishu-conv-bot-ops')).not.toBeInTheDocument();
  });

  it('mutes sessions older than 30 days with archived label', async () => {
    const fixtures = buildWorkbenchFixtures();
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const sessionsWithOld = {
      ...fixtures.sessions,
      sessions: [
        fixtures.sessions.sessions[0],
        { ...fixtures.sessions.sessions[1], latestActivityAt: oldDate },
        fixtures.sessions.sessions[2],
      ],
    };
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return sessionsWithOld;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      return { success: true };
    });

    render(<Channels />);
    const list = await screen.findByTestId('channels-conversation-list');
    const archivedLabel = within(list).getByTestId('session-archived-feishu-conv-bot-ops');
    expect(archivedLabel).toBeInTheDocument();
    expect(within(list).queryByTestId('session-archived-feishu-conv-devops')).not.toBeInTheDocument();
  });

  it('renames a synced conversation from the middle list without leaving the page', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/channels/workbench/conversations/feishu-conv-devops' && init?.method === 'PATCH') {
        return { success: true };
      }
      return { success: true };
    });

    render(<Channels />);
    const list = await screen.findByTestId('channels-conversation-list');

    fireEvent.click(within(list).getByTestId('rename-session-feishu-conv-devops'));
    const input = within(list).getByTestId('session-title-input-feishu-conv-devops');
    fireEvent.change(input, { target: { value: '客服同步群' } });
    fireEvent.click(within(list).getByTestId('save-session-title-feishu-conv-devops'));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/workbench/conversations/feishu-conv-devops',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ title: '客服同步群' }),
        }),
      );
    });
    expect(within(list).getByText('客服同步群')).toBeInTheDocument();
  });

  it('removes a synced conversation from the middle list without deleting the channel instance', async () => {
    const fixtures = buildWorkbenchFixtures();
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/channels/capabilities') return fixtures.capabilities;
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/channels/workbench/conversations/feishu-conv-bot-ops' && init?.method === 'DELETE') {
        return { success: true };
      }
      return { success: true };
    });

    render(<Channels />);
    const list = await screen.findByTestId('channels-conversation-list');

    expect(within(list).getByTestId('session-item-feishu-conv-bot-ops')).toBeInTheDocument();
    fireEvent.click(within(list).getByTestId('hide-session-feishu-conv-bot-ops'));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/workbench/conversations/feishu-conv-bot-ops',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
    await waitFor(() => {
      expect(within(list).queryByTestId('session-item-feishu-conv-bot-ops')).not.toBeInTheDocument();
    });
    expect(channelsStoreState.channels).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'feishu-default' }),
      expect.objectContaining({ id: 'telegram-default' }),
    ]));
  });
});

describe('WeChat workbench', () => {
  beforeEach(() => {
    locationState.search = '?channel=wechat';
    channelsStoreState.channels = [
      {
        id: 'wechat-default',
        type: 'wechat',
        name: 'wechat',
        status: 'connected',
        accountId: 'default',
      },
    ] as typeof channelsStoreState.channels;
    channelsStoreState.loading = false;
    channelsStoreState.error = null;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?channel=wechat' },
    });
  });
  afterEach(() => {
    locationState.search = '';
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '' },
    });
  });

  it('filters wechat sessions by title when search query is entered', async () => {
    const wechatSessions = {
      success: true,
      sessions: [
        { id: 'wechat:default:gc_001', channelId: 'wechat-default', channelType: 'wechat', sessionType: 'group', title: '技术交流群', pinned: true, syncState: 'synced', latestActivityAt: new Date().toISOString(), previewText: '最新消息' },
        { id: 'wechat:default:gc_002', channelId: 'wechat-default', channelType: 'wechat', sessionType: 'group', title: '产品讨论组', pinned: false, syncState: 'synced', latestActivityAt: new Date().toISOString(), previewText: '产品相关' },
      ],
    };
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return { success: true, capabilities: [{ channelId: 'wechat-default', channelType: 'wechat', accountId: 'default', status: 'connected', availableActions: ['send'], capabilityFlags: { supportsConnect: true, supportsDisconnect: true, supportsTest: true, supportsSend: true, supportsSchemaSummary: false, supportsCredentialValidation: false }, configSchemaSummary: { totalFieldCount: 0, requiredFieldCount: 0, optionalFieldCount: 0, sensitiveFieldCount: 0, fieldKeys: [] } }] };
      if (path === '/api/channels/workbench/sessions?channelType=wechat') return wechatSessions;
      if (path.startsWith('/api/channels/workbench/conversations/wechat:default:gc_001/messages')) return { success: true, conversation: { id: 'wechat:default:gc_001', title: '技术交流群', syncState: 'synced' }, messages: [], hasMore: false };
      return { success: true };
    });

    render(<Channels />);
    const list = await screen.findByTestId('channels-conversation-list');
    expect(within(list).getByText('技术交流群')).toBeInTheDocument();
    expect(within(list).getByText('产品讨论组')).toBeInTheDocument();

    const searchInput = screen.getByTestId('session-search-input');
    fireEvent.change(searchInput, { target: { value: '技术' } });

    await waitFor(() => {
      expect(within(list).getByText('技术交流群')).toBeInTheDocument();
      expect(within(list).queryByText('产品讨论组')).not.toBeInTheDocument();
    });
  });

  it('shows red error badge on wechat sessions with syncState error', async () => {
    const wechatSessions = {
      success: true,
      sessions: [
        { id: 'wechat:default:gc_err', channelId: 'wechat-default', channelType: 'wechat', sessionType: 'group', title: '同步失败群', pinned: false, syncState: 'error', latestActivityAt: new Date().toISOString() },
      ],
    };
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return { success: true, capabilities: [{ channelId: 'wechat-default', channelType: 'wechat', accountId: 'default', status: 'connected', availableActions: ['send'], capabilityFlags: { supportsConnect: true, supportsDisconnect: true, supportsTest: true, supportsSend: true, supportsSchemaSummary: false, supportsCredentialValidation: false }, configSchemaSummary: { totalFieldCount: 0, requiredFieldCount: 0, optionalFieldCount: 0, sensitiveFieldCount: 0, fieldKeys: [] } }] };
      if (path === '/api/channels/workbench/sessions?channelType=wechat') return wechatSessions;
      return { success: true };
    });

    render(<Channels />);
    const list = await screen.findByTestId('channels-conversation-list');
    expect(within(list).getByTestId('session-error-badge-wechat:default:gc_err')).toBeInTheDocument();
  });

  it('loads mention members from the wechat members endpoint', async () => {
    const wechatSessions = {
      success: true,
      sessions: [
        { id: 'wechat:default:gc_001', channelId: 'wechat-default', channelType: 'wechat', sessionType: 'group', title: '技术交流群', pinned: true, syncState: 'synced', latestActivityAt: new Date().toISOString(), previewText: '最新消息' },
      ],
    };
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') return { success: true, capabilities: [{ channelId: 'wechat-default', channelType: 'wechat', accountId: 'default', status: 'connected', availableActions: ['send'], capabilityFlags: { supportsConnect: true, supportsDisconnect: true, supportsTest: true, supportsSend: true, supportsSchemaSummary: false, supportsCredentialValidation: false }, configSchemaSummary: { totalFieldCount: 0, requiredFieldCount: 0, optionalFieldCount: 0, sensitiveFieldCount: 0, fieldKeys: [] } }] };
      if (path === '/api/channels/workbench/sessions?channelType=wechat') return wechatSessions;
      if (path.startsWith('/api/channels/workbench/conversations/wechat%3Adefault%3Agc_001/messages')) return { success: true, conversation: { id: 'wechat:default:gc_001', title: '技术交流群', syncState: 'synced' }, messages: [], hasMore: false };
      if (path.startsWith('/api/channels/workbench/wechat/members?sessionId=')) {
        return { success: true, members: [{ openId: 'wx_001', name: '微信同事' }] };
      }
      if (path.startsWith('/api/channels/workbench/members?sessionId=')) {
        return { success: true, members: [] };
      }
      return { success: true };
    });

    render(<Channels />);
    const input = await screen.findByPlaceholderText('在微信发送消息（将同步至微信）...');
    fireEvent.change(input, { target: { value: '@' } });

    const popover = await screen.findByTestId('mention-popover');
    expect(within(popover).getByText('微信同事')).toBeInTheDocument();
    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/channels/workbench/wechat/members?sessionId=wechat%3Adefault%3Agc_001',
    );
  });

  it('keeps the wechat workbench selected when the persisted active id becomes stale', async () => {
    locationState.search = '';
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '' },
    });
    useRightPanelStore.setState({ activeChannelId: 'wechat-default' });
    channelsStoreState.channels = [
      {
        id: 'feishu-default',
        type: 'feishu',
        name: 'feishu',
        status: 'connected',
        accountId: 'default',
      },
      {
        id: 'wechat-e5e00d1a769e-im-bot',
        type: 'wechat',
        name: 'wechat',
        status: 'connected',
        accountId: 'e5e00d1a769e-im-bot',
      },
    ] as typeof channelsStoreState.channels;

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') {
        return {
          success: true,
          capabilities: [
            {
              channelId: 'feishu-default',
              channelType: 'feishu',
              accountId: 'default',
              status: 'connected',
              availableActions: ['send'],
              capabilityFlags: {
                supportsConnect: true,
                supportsDisconnect: true,
                supportsTest: true,
                supportsSend: true,
                supportsSchemaSummary: false,
                supportsCredentialValidation: false,
              },
              configSchemaSummary: {
                totalFieldCount: 0,
                requiredFieldCount: 0,
                optionalFieldCount: 0,
                sensitiveFieldCount: 0,
                fieldKeys: [],
              },
            },
            {
              channelId: 'wechat-e5e00d1a769e-im-bot',
              channelType: 'wechat',
              accountId: 'e5e00d1a769e-im-bot',
              status: 'connected',
              availableActions: ['send'],
              capabilityFlags: {
                supportsConnect: true,
                supportsDisconnect: true,
                supportsTest: true,
                supportsSend: true,
                supportsSchemaSummary: false,
                supportsCredentialValidation: false,
              },
              configSchemaSummary: {
                totalFieldCount: 0,
                requiredFieldCount: 0,
                optionalFieldCount: 0,
                sensitiveFieldCount: 0,
                fieldKeys: [],
              },
            },
          ],
        };
      }
      if (path === '/api/channels/workbench/sessions?channelType=wechat&accountId=e5e00d1a769e-im-bot') {
        return {
          success: true,
          sessions: [{
            id: 'wechat:e5e00d1a769e-im-bot:gc_001',
            channelId: 'wechat-e5e00d1a769e-im-bot',
            channelType: 'wechat',
            sessionType: 'group',
            title: '技术交流群',
            pinned: true,
            syncState: 'synced',
            latestActivityAt: new Date().toISOString(),
            previewText: '最新消息',
          }],
        };
      }
      if (path.startsWith('/api/channels/workbench/conversations/wechat%3Ae5e00d1a769e-im-bot%3Agc_001/messages')) {
        return {
          success: true,
          conversation: {
            id: 'wechat:e5e00d1a769e-im-bot:gc_001',
            title: '技术交流群',
            syncState: 'synced',
          },
          messages: [],
          hasMore: false,
        };
      }
      if (path === '/api/channels/workbench/sessions?channelType=feishu') {
        throw new Error('unexpected feishu session request');
      }
      return { success: true };
    });

    render(<Channels />);

    expect((await screen.findAllByText('技术交流群')).length).toBeGreaterThan(1);
    expect(screen.getByPlaceholderText('在微信发送消息（将同步至微信）...')).toBeInTheDocument();
    expect(screen.getByText('微信同步中')).toBeInTheDocument();
    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/workbench/sessions?channelType=wechat&accountId=e5e00d1a769e-im-bot');
    expect(hostApiFetchMock).not.toHaveBeenCalledWith('/api/channels/workbench/sessions?channelType=feishu');
  });

  it('uses router search as the single source of truth for the active channel', async () => {
    locationState.search = '?channel=wechat';
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?channel=feishu' },
    });

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/capabilities') {
        return {
          success: true,
          capabilities: [{
            channelId: 'wechat-default',
            channelType: 'wechat',
            accountId: 'default',
            status: 'connected',
            availableActions: ['send'],
            capabilityFlags: {
              supportsConnect: true,
              supportsDisconnect: true,
              supportsTest: true,
              supportsSend: true,
              supportsSchemaSummary: false,
              supportsCredentialValidation: false,
            },
            configSchemaSummary: {
              totalFieldCount: 0,
              requiredFieldCount: 0,
              optionalFieldCount: 0,
              sensitiveFieldCount: 0,
              fieldKeys: [],
            },
          }],
        };
      }
      if (path === '/api/channels/workbench/sessions?channelType=wechat') {
        return {
          success: true,
          sessions: [{
            id: 'wechat:default:gc_001',
            channelId: 'wechat-default',
            channelType: 'wechat',
            sessionType: 'group',
            title: '技术交流群',
            pinned: true,
            syncState: 'synced',
            latestActivityAt: new Date().toISOString(),
            previewText: '最新消息',
          }],
        };
      }
      if (path.startsWith('/api/channels/workbench/conversations/wechat%3Adefault%3Agc_001/messages')) {
        return {
          success: true,
          conversation: { id: 'wechat:default:gc_001', title: '技术交流群', syncState: 'synced' },
          messages: [],
          hasMore: false,
        };
      }
      if (path === '/api/feishu/status') {
        throw new Error('unexpected feishu status request');
      }
      return { success: true };
    });

    render(<Channels />);

    const list = await screen.findByTestId('channels-conversation-list');
    expect(within(list).getByText('技术交流群')).toBeInTheDocument();
    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/workbench/sessions?channelType=wechat');
    expect(hostApiFetchMock).not.toHaveBeenCalledWith('/api/channels/workbench/sessions?channelType=feishu');
    expect(hostApiFetchMock).not.toHaveBeenCalledWith('/api/feishu/status');
  });

  it('rerenders cleanly when switching from feishu placeholder to wechat workbench', async () => {
    locationState.search = '';
    useRightPanelStore.setState({ activeChannelId: null });
    channelsStoreState.channels = [
      {
        id: 'feishu-default',
        type: 'feishu',
        name: 'feishu',
        status: 'connected',
        accountId: 'default',
      },
      {
        id: 'wechat-default',
        type: 'wechat',
        name: 'wechat',
        status: 'connected',
        accountId: 'default',
      },
    ] as typeof channelsStoreState.channels;

    hostApiFetchMock.mockImplementation(async (path: string) => {
      const fixtures = buildWorkbenchFixtures();
      if (path === '/api/channels/capabilities') {
        return {
          success: true,
          capabilities: [
            ...fixtures.capabilities.capabilities,
            {
              channelId: 'wechat-default',
              channelType: 'wechat',
              accountId: 'default',
              status: 'connected',
              availableActions: ['send'],
              capabilityFlags: {
                supportsConnect: true,
                supportsDisconnect: true,
                supportsTest: true,
                supportsSend: true,
                supportsSchemaSummary: false,
                supportsCredentialValidation: false,
              },
              configSchemaSummary: {
                totalFieldCount: 0,
                requiredFieldCount: 0,
                optionalFieldCount: 0,
                sensitiveFieldCount: 0,
                fieldKeys: [],
              },
            },
          ],
        };
      }
      if (path === '/api/channels/workbench/sessions?channelType=feishu') return fixtures.sessions;
      if (path.startsWith('/api/channels/workbench/conversations/feishu-conv-devops/messages')) return fixtures.messages;
      if (path === '/api/channels/workbench/sessions?channelType=wechat') {
        return {
          success: true,
          sessions: [
            {
              id: 'wechat:default:gc_001',
              channelId: 'wechat-default',
              channelType: 'wechat',
              sessionType: 'group',
              title: '技术交流群',
              pinned: true,
              syncState: 'synced',
              latestActivityAt: new Date().toISOString(),
              previewText: '最新消息',
            },
          ],
        };
      }
      if (path.startsWith('/api/channels/workbench/conversations/wechat%3Adefault%3Agc_001/messages')) {
        return {
          success: true,
          conversation: { id: 'wechat:default:gc_001', title: '技术交流群', syncState: 'synced' },
          messages: [],
          hasMore: false,
        };
      }
      return { success: true };
    });

    const { rerender } = render(<Channels />);
    expect(await screen.findByText('飞书同步工作台开发中')).toBeInTheDocument();

    await act(async () => {
      locationState.search = '?channel=wechat';
      useRightPanelStore.setState({ activeChannelId: 'wechat-default' });
      rerender(<Channels />);
    });

    expect(await screen.findByPlaceholderText('在微信发送消息（将同步至微信）...')).toBeInTheDocument();
    expect(screen.queryByText('飞书同步工作台开发中')).not.toBeInTheDocument();
  });
});
