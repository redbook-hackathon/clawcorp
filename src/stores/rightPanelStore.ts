import { create } from 'zustand';

export type RightPanelType = 'file' | 'agent' | 'task' | null;

interface RightPanelState {
  open: boolean;
  type: RightPanelType;
  agentId: string | null;
  taskId: string | null;
  activeChannelId: string | null;
  pendingBotSettings: string | null;
  pendingAddChannel: boolean;
  openPanel: (type: Exclude<RightPanelType, null>, id?: string) => void;
  closePanel: () => void;
  setActiveChannelId: (channelId: string | null) => void;
  setPendingBotSettings: (botId: string | null) => void;
  setPendingAddChannel: (pending: boolean) => void;
}

export const useRightPanelStore = create<RightPanelState>((set) => ({
  open: false,
  type: null,
  agentId: null,
  taskId: null,
  activeChannelId: null,
  pendingBotSettings: null,
  pendingAddChannel: false,
  openPanel: (type, id) => {
    if (type === 'task') {
      set({ open: true, type, taskId: id ?? null, agentId: null });
    } else {
      set({ open: true, type, agentId: id ?? null, taskId: null });
    }
  },
  closePanel: () => set({ open: false, type: null, agentId: null, taskId: null }),
  setActiveChannelId: (channelId) => set({ activeChannelId: channelId }),
  setPendingBotSettings: (botId) => set({ pendingBotSettings: botId }),
  setPendingAddChannel: (pending) => set({ pendingAddChannel: pending }),
}));
