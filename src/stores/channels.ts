/**
 * Channels State Store
 * Manages messaging channel state
 */
import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import {
  pickChannelRuntimeStatus,
  type ChannelRuntimeAccountSnapshot,
} from '@/lib/channel-status';
import { toOpenClawChannelType, toUiChannelType } from '@/lib/channel-alias';
import { useGatewayStore } from './gateway';
import { CHANNEL_NAMES, type Channel, type ChannelType } from '../types/channel';

interface AddChannelParams {
  type: ChannelType;
  name: string;
  token?: string;
}

interface ChannelsState {
  channels: Channel[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchChannels: () => Promise<void>;
  addChannel: (params: AddChannelParams) => Promise<Channel>;
  deleteChannel: (channelId: string) => Promise<void>;
  connectChannel: (channelId: string) => Promise<void>;
  disconnectChannel: (channelId: string) => Promise<void>;
  requestQrCode: (channelType: ChannelType) => Promise<{ qrCode: string; sessionId: string }>;
  setChannels: (channels: Channel[]) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  clearError: () => void;
}

function splitChannelId(channelId: string): { channelType: string; accountId?: string } {
  const separatorIndex = channelId.indexOf('-');
  if (separatorIndex === -1) {
    return { channelType: channelId };
  }
  return {
    channelType: channelId.slice(0, separatorIndex),
    accountId: channelId.slice(separatorIndex + 1),
  };
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  loading: false,
  error: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      const [data, channelAccountsPayload] = await Promise.all([
        useGatewayStore.getState().rpc<{
          channelOrder?: string[];
          channels?: Record<string, unknown>;
          channelAccounts?: Record<string, Array<{
            accountId?: string;
            configured?: boolean;
            connected?: boolean;
            running?: boolean;
            lastError?: string;
            name?: string;
            linked?: boolean;
            lastConnectedAt?: number | null;
            lastInboundAt?: number | null;
            lastOutboundAt?: number | null;
            lastProbeAt?: number | null;
            probe?: {
              ok?: boolean;
            } | null;
          }>>;
          channelDefaultAccountId?: Record<string, string>;
        }>('channels.status', { probe: true }),
        hostApiFetch<{
          success?: boolean;
          channels?: Array<{
            channelType: string;
            accounts: Array<{
              accountId: string;
              agentId?: string;
              teamId?: string;
              responsiblePerson?: string;
            }>;
          }>;
        }>('/api/channels/accounts').catch(() => ({ channels: [] })),
      ]);

      const ownerByAccountKey = new Map<string, { agentId?: string; teamId?: string; responsiblePerson?: string }>();
      for (const channelEntry of channelAccountsPayload.channels || []) {
        for (const account of channelEntry.accounts || []) {
          ownerByAccountKey.set(`${channelEntry.channelType}:${account.accountId || 'default'}`, {
            ...(account.agentId ? { agentId: account.agentId } : {}),
            ...(account.teamId ? { teamId: account.teamId } : {}),
            ...(account.responsiblePerson ? { responsiblePerson: account.responsiblePerson } : {}),
          });
        }
      }

      if (data) {
        const channels: Channel[] = [];

        // Parse the complex channels.status response into simple Channel objects
        const channelOrder = data.channelOrder || Object.keys(data.channels || {});
        for (const channelId of channelOrder) {
          const uiChannelId = toUiChannelType(channelId) as ChannelType;
          const gatewayChannelId = toOpenClawChannelType(channelId);
          const summary = (data.channels as Record<string, unknown> | undefined)?.[channelId] as Record<string, unknown> | undefined;
          const configured =
            typeof summary?.configured === 'boolean'
              ? summary.configured
              : typeof (summary as { running?: boolean })?.running === 'boolean'
                ? true
                : false;
          if (!configured) continue;

          const accounts = data.channelAccounts?.[channelId] || [];
          const defaultAccountId = data.channelDefaultAccountId?.[channelId];
          const summarySignal = summary as { error?: string; lastError?: string } | undefined;
          const status: Channel['status'] = pickChannelRuntimeStatus(accounts as ChannelRuntimeAccountSnapshot[], summarySignal);
          const summaryError =
            typeof summarySignal?.error === 'string'
              ? summarySignal.error
              : typeof summarySignal?.lastError === 'string'
                ? summarySignal.lastError
                : undefined;
          const accountEntries = accounts.length > 0
            ? [...accounts].sort((left, right) => {
                const leftAccountId = left.accountId || defaultAccountId || 'default';
                const rightAccountId = right.accountId || defaultAccountId || 'default';
                if (leftAccountId === defaultAccountId && rightAccountId !== defaultAccountId) return -1;
                if (rightAccountId === defaultAccountId && leftAccountId !== defaultAccountId) return 1;
                return leftAccountId.localeCompare(rightAccountId);
              })
            : [{
                accountId: defaultAccountId || 'default',
                name: CHANNEL_NAMES[uiChannelId] || uiChannelId,
                configured: true,
              }];

          for (const account of accountEntries) {
            const accountId = account.accountId || defaultAccountId || 'default';
            const accountStatus = pickChannelRuntimeStatus([account as ChannelRuntimeAccountSnapshot], summarySignal);
            const owner = ownerByAccountKey.get(`${uiChannelId}:${accountId}`);
            channels.push({
              id: `${uiChannelId}-${accountId}`,
              type: uiChannelId,
              name: account.name || CHANNEL_NAMES[uiChannelId] || uiChannelId,
              status: accountStatus,
              accountId,
              ...(owner?.agentId ? { boundAgentId: owner.agentId } : {}),
              ...(owner?.teamId ? { boundTeamId: owner.teamId } : {}),
              ...(owner?.responsiblePerson ? { responsiblePerson: owner.responsiblePerson } : {}),
              error:
                (typeof account.lastError === 'string' ? account.lastError : undefined) ||
                (typeof summaryError === 'string' ? summaryError : undefined),
              metadata: {
                gatewayChannelId,
                isDefault: accountId === defaultAccountId,
                aggregateStatus: status,
              },
            });
          }
        }

        set({ channels, loading: false });
      } else {
        set((state) => ({
          channels: state.channels,
          loading: false,
          error: 'Gateway returned empty channel status',
        }));
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Failed to load channels';
      try {
        const configured = await hostApiFetch<{ success?: boolean; channels?: string[] }>('/api/channels/configured');
        const fallbackChannels = Array.isArray(configured.channels)
          ? configured.channels
              .map((channelType) => toUiChannelType(channelType) as ChannelType)
              .map((channelType) => ({
                id: `${channelType}-default`,
                type: channelType,
                name: CHANNEL_NAMES[channelType] || channelType,
                status: 'disconnected' as const,
                accountId: 'default',
                metadata: {
                  gatewayChannelId: toOpenClawChannelType(channelType),
                },
              }))
          : [];
        if (fallbackChannels.length > 0) {
          set({
            channels: fallbackChannels,
            loading: false,
            error: null,
          });
          return;
        }
      } catch {
        // ignore fallback errors and keep the original runtime error
      }
      set((state) => ({
        channels: state.channels,
        loading: false,
        error: message,
      }));
    }
  },

  addChannel: async (params) => {
    try {
      const result = await useGatewayStore.getState().rpc<Channel>('channels.add', params);

      if (result) {
        set((state) => ({
          channels: [...state.channels, result],
        }));
        return result;
      } else {
        // If gateway is not available, create a local channel for now
        const newChannel: Channel = {
          id: `local-${Date.now()}`,
          type: params.type,
          name: params.name,
          status: 'disconnected',
        };
        set((state) => ({
          channels: [...state.channels, newChannel],
        }));
        return newChannel;
      }
    } catch {
      // Create local channel if gateway unavailable
      const newChannel: Channel = {
        id: `local-${Date.now()}`,
        type: params.type,
        name: params.name,
        status: 'disconnected',
      };
      set((state) => ({
        channels: [...state.channels, newChannel],
      }));
      return newChannel;
    }
  },

  deleteChannel: async (channelId) => {
    const targetChannel = get().channels.find((channel) => channel.id === channelId);
    const channelType = targetChannel?.type ?? (channelId.split('-')[0] as ChannelType);
    const gatewayChannelType = toOpenClawChannelType(channelType);
    const accountId = targetChannel?.accountId;
    const deletePath = accountId
      ? `/api/channels/config/${encodeURIComponent(channelType)}?accountId=${encodeURIComponent(accountId)}`
      : `/api/channels/config/${encodeURIComponent(channelType)}`;

    try {
      await hostApiFetch(deletePath, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete channel config:', error);
    }

    try {
      await useGatewayStore.getState().rpc('channels.delete', {
        channelId: gatewayChannelType,
        ...(accountId ? { accountId } : {}),
      });
    } catch (error) {
      // Continue with local deletion even if gateway fails
      console.error('Failed to delete channel from gateway:', error);
    }

    // Remove from local state
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
    }));
  },

  connectChannel: async (channelId) => {
    const { updateChannel } = get();
    const targetChannel = get().channels.find((channel) => channel.id === channelId);
    const { channelType, accountId: parsedAccountId } = splitChannelId(channelId);
    const rpcChannelId = toOpenClawChannelType(targetChannel?.type ?? channelType);
    const accountId = targetChannel?.accountId;
    updateChannel(channelId, { status: 'connecting', error: undefined });

    try {
      await useGatewayStore.getState().rpc('channels.connect', {
        channelId: rpcChannelId,
        ...((accountId ?? parsedAccountId) ? { accountId: accountId ?? parsedAccountId } : {}),
      });
      updateChannel(channelId, { status: 'connected' });
    } catch (error) {
      updateChannel(channelId, { status: 'error', error: String(error) });
    }
  },

  disconnectChannel: async (channelId) => {
    const { updateChannel } = get();
    const targetChannel = get().channels.find((channel) => channel.id === channelId);
    const { channelType, accountId: parsedAccountId } = splitChannelId(channelId);
    const rpcChannelId = toOpenClawChannelType(targetChannel?.type ?? channelType);
    const accountId = targetChannel?.accountId ?? parsedAccountId;

    try {
      await useGatewayStore.getState().rpc('channels.disconnect', {
        channelId: rpcChannelId,
        ...(accountId ? { accountId } : {}),
      });
    } catch (error) {
      console.error('Failed to disconnect channel:', error);
    }

    updateChannel(channelId, { status: 'disconnected', error: undefined });
  },

  requestQrCode: async (channelType) => {
    return await useGatewayStore.getState().rpc<{ qrCode: string; sessionId: string }>(
      'channels.requestQr',
      { type: toOpenClawChannelType(channelType) },
    );
  },

  setChannels: (channels) => set({ channels }),

  updateChannel: (channelId, updates) => {
    set((state) => ({
      channels: state.channels.map((channel) =>
        channel.id === channelId ? { ...channel, ...updates } : channel
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
