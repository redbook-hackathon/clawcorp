import { create } from 'zustand';

export type NotificationLevel = 'info' | 'warn' | 'error' | 'success';

export interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  source?: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

function makeId() {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) => {
    const notif: Notification = {
      ...n,
      id: makeId(),
      timestamp: Date.now(),
      read: false,
    };
    set((s) => ({
      notifications: [notif, ...s.notifications].slice(0, 100),
      unreadCount: s.unreadCount + 1,
    }));
  },

  markRead: (id) => {
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    });
  },

  markAllRead: () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  dismiss: (id) => {
    set((s) => {
      const notifications = s.notifications.filter((n) => n.id !== id);
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

// Wire gateway events → notifications
export function wireGatewayNotifications(
  gatewayStore: { subscribe: (fn: (s: { status: { state: string } }) => void) => () => void },
) {
  let prevState = '';
  return gatewayStore.subscribe((s) => {
    const state = s.status.state;
    if (state === prevState) return;
    prevState = state;
    const store = useNotificationsStore.getState();
    if (state === 'running') {
      store.addNotification({ level: 'success', title: 'Gateway 已启动', source: 'gateway' });
    } else if (state === 'error') {
      store.addNotification({ level: 'error', title: 'Gateway 连接错误', source: 'gateway' });
    } else if (state === 'stopped') {
      store.addNotification({ level: 'warn', title: 'Gateway 已停止', source: 'gateway' });
    }
  });
}
