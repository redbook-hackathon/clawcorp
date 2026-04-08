import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChannelConfigModal } from '@/components/channels/ChannelConfigModal';

const { hostApiFetchMock, channelsStoreState, agentsStoreState } = vi.hoisted(() => ({
  hostApiFetchMock: vi.fn(),
  channelsStoreState: {
    channels: [],
    addChannel: vi.fn(async () => ({ id: 'feishu-default', type: 'feishu', name: 'Feishu', status: 'disconnected' })),
    fetchChannels: vi.fn(async () => undefined),
  },
  agentsStoreState: {
    agents: [
      { id: 'main', name: 'Main Agent' },
      { id: 'agent-a', name: 'Agent A' },
    ],
    fetchAgents: vi.fn(async () => undefined),
  },
}));

vi.mock('@/stores/channels', () => ({
  useChannelsStore: () => channelsStoreState,
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsStoreState) => unknown) => selector(agentsStoreState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(async () => undefined),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: vi.fn(() => () => undefined),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => params?.name || params?.accountId || key,
  }),
}));

describe('ChannelConfigModal agent binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelsStoreState.channels = [];
  });

  it('shows an agent selector and persists the chosen binding on save', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/channels/config') {
        return { success: true };
      }
      if (path === '/api/channels/binding') {
        return { success: true };
      }
      return { success: true };
    });

    render(
      <ChannelConfigModal
        initialSelectedType="feishu"
        configuredTypes={[]}
        onClose={() => undefined}
        onChannelSaved={async () => undefined}
      />,
    );

    fireEvent.change(screen.getByTestId('channel-name-input'), { target: { value: 'Ops Feishu' } });
    fireEvent.change(screen.getByTestId('channel-field-appId'), { target: { value: 'app-id' } });
    fireEvent.change(screen.getByTestId('channel-field-appSecret'), { target: { value: 'app-secret' } });
    fireEvent.change(screen.getByTestId('channel-agent-select'), { target: { value: 'agent-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'dialog.saveAndConnect' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/channels/binding',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ channelType: 'feishu', accountId: 'default', agentId: 'agent-a' }),
        }),
      );
    });
  });
});
