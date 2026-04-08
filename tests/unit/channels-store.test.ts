import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChannelsStore } from '@/stores/channels';
import { hostApiFetch } from '@/lib/host-api';

const { gatewayRpcMock } = vi.hoisted(() => ({
  gatewayRpcMock: vi.fn(),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: gatewayRpcMock,
    }),
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

describe('channels store fetchChannels', () => {
  beforeEach(() => {
    gatewayRpcMock.mockReset();
    vi.mocked(hostApiFetch).mockReset();
    useChannelsStore.setState({
      channels: [],
      loading: false,
      error: null,
    });
  });

  it('preserves an error state when initial fetch fails', async () => {
    gatewayRpcMock.mockRejectedValueOnce(new Error('gateway unavailable'));
    vi.mocked(hostApiFetch).mockRejectedValueOnce(new Error('config unavailable'));

    await useChannelsStore.getState().fetchChannels();

    const state = useChannelsStore.getState();
    expect(state.channels).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toContain('gateway unavailable');
  });

  it('deletes only the scoped channel account when channelId includes an account id', async () => {
    useChannelsStore.setState({
      channels: [
        {
          id: 'feishu-agent-a',
          type: 'feishu',
          name: 'Agent A Feishu',
          status: 'connected',
          accountId: 'agent-a',
        },
        {
          id: 'feishu-default',
          type: 'feishu',
          name: 'Default Feishu',
          status: 'connected',
          accountId: 'default',
        },
      ],
    });

    vi.mocked(hostApiFetch).mockResolvedValue({ success: true });
    gatewayRpcMock.mockResolvedValue({ success: true });

    await useChannelsStore.getState().deleteChannel('feishu-agent-a');

    expect(hostApiFetch).toHaveBeenCalledWith('/api/channels/config/feishu?accountId=agent-a', {
      method: 'DELETE',
    });
    expect(gatewayRpcMock).toHaveBeenCalledWith('channels.delete', {
      channelId: 'feishu',
      accountId: 'agent-a',
    });
    expect(useChannelsStore.getState().channels).toEqual([
      expect.objectContaining({ id: 'feishu-default' }),
    ]);
  });

  it('connects a scoped channel account with channel type and account id', async () => {
    useChannelsStore.setState({
      channels: [
        {
          id: 'feishu-agent-a',
          type: 'feishu',
          name: 'Agent A Feishu',
          status: 'disconnected',
          accountId: 'agent-a',
        },
      ],
    });

    gatewayRpcMock.mockResolvedValue({ success: true });

    await useChannelsStore.getState().connectChannel('feishu-agent-a');

    expect(gatewayRpcMock).toHaveBeenCalledWith('channels.connect', {
      channelId: 'feishu',
      accountId: 'agent-a',
    });
    expect(useChannelsStore.getState().channels[0]).toEqual(expect.objectContaining({
      id: 'feishu-agent-a',
      status: 'connected',
    }));
  });

  it('disconnects a scoped channel account with channel type and account id', async () => {
    useChannelsStore.setState({
      channels: [
        {
          id: 'feishu-agent-a',
          type: 'feishu',
          name: 'Agent A Feishu',
          status: 'connected',
          accountId: 'agent-a',
        },
      ],
    });

    gatewayRpcMock.mockResolvedValue({ success: true });

    await useChannelsStore.getState().disconnectChannel('feishu-agent-a');

    expect(gatewayRpcMock).toHaveBeenCalledWith('channels.disconnect', {
      channelId: 'feishu',
      accountId: 'agent-a',
    });
    expect(useChannelsStore.getState().channels[0]).toEqual(expect.objectContaining({
      id: 'feishu-agent-a',
      status: 'disconnected',
    }));
  });

  it('maps openclaw-weixin runtime ids back to the wechat UI channel type', async () => {
    gatewayRpcMock.mockResolvedValueOnce({
      channelOrder: ['openclaw-weixin'],
      channels: {
        'openclaw-weixin': { configured: true, running: true },
      },
      channelAccounts: {
        'openclaw-weixin': [
          {
            accountId: 'default',
            configured: true,
            connected: true,
            name: 'WeChat Bot',
          },
        ],
      },
      channelDefaultAccountId: {
        'openclaw-weixin': 'default',
      },
    });

    await useChannelsStore.getState().fetchChannels();

    expect(useChannelsStore.getState().channels).toEqual([
      expect.objectContaining({
        id: 'wechat-default',
        type: 'wechat',
        name: 'WeChat Bot',
        status: 'connected',
        accountId: 'default',
        metadata: expect.objectContaining({
          gatewayChannelId: 'openclaw-weixin',
        }),
      }),
    ]);
  });

  it('returns one channel entry per configured account instead of collapsing to one primary account', async () => {
    gatewayRpcMock.mockResolvedValueOnce({
      channelOrder: ['feishu'],
      channels: {
        feishu: { configured: true, running: true },
      },
      channelAccounts: {
        feishu: [
          {
            accountId: 'default',
            configured: true,
            connected: true,
            name: 'Feishu Main',
          },
          {
            accountId: 'agent-a',
            configured: true,
            connected: true,
            name: 'Feishu Agent A',
          },
        ],
      },
      channelDefaultAccountId: {
        feishu: 'default',
      },
    });

    await useChannelsStore.getState().fetchChannels();

    expect(useChannelsStore.getState().channels).toEqual([
      expect.objectContaining({
        id: 'feishu-default',
        type: 'feishu',
        name: 'Feishu Main',
        accountId: 'default',
      }),
      expect.objectContaining({
        id: 'feishu-agent-a',
        type: 'feishu',
        name: 'Feishu Agent A',
        accountId: 'agent-a',
      }),
    ]);
  });

  it('falls back to configured channel ids when runtime channel status is unavailable', async () => {
    gatewayRpcMock.mockRejectedValueOnce(new Error('gateway unavailable'));
    vi.mocked(hostApiFetch).mockResolvedValueOnce({
      success: true,
      channels: ['feishu', 'wechat'],
    });

    await useChannelsStore.getState().fetchChannels();

    expect(hostApiFetch).toHaveBeenCalledWith('/api/channels/configured');
    expect(useChannelsStore.getState().channels).toEqual([
      expect.objectContaining({
        id: 'feishu-default',
        type: 'feishu',
        status: 'disconnected',
      }),
      expect.objectContaining({
        id: 'wechat-default',
        type: 'wechat',
        status: 'disconnected',
      }),
    ]);
  });
});
