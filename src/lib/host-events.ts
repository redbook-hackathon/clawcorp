import { createHostEventSource } from './host-api';
import { isBrowserPreviewMode } from './browser-preview';

const HOST_EVENT_TO_IPC_CHANNEL: Record<string, string> = {
  'gateway:status': 'gateway:status-changed',
  'gateway:error': 'gateway:error',
  'gateway:notification': 'gateway:notification',
  'gateway:chat-message': 'gateway:chat-message',
  'gateway:channel-status': 'gateway:channel-status',
  'gateway:exit': 'gateway:exit',
  'update:status': 'update:status-changed',
  'update:auto-install-countdown': 'update:auto-install-countdown',
  'oauth:code': 'oauth:code',
  'oauth:success': 'oauth:success',
  'oauth:error': 'oauth:error',
  'channel:whatsapp-qr': 'channel:whatsapp-qr',
  'channel:whatsapp-success': 'channel:whatsapp-success',
  'channel:whatsapp-error': 'channel:whatsapp-error',
};

function parseBrowserPreviewEvent(event: MessageEvent): unknown {
  const data = event?.data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return data;
    }
  }
  return data;
}

export function subscribeHostEvent<T = unknown>(
  eventName: string,
  handler: (payload: T) => void,
): () => void {
  if (isBrowserPreviewMode()) {
    const source = createHostEventSource();
    const listener = (event: MessageEvent) => {
      handler(parseBrowserPreviewEvent(event) as T);
    };
    source.addEventListener(eventName, listener as EventListener);
    return () => {
      source.removeEventListener(eventName, listener as EventListener);
      source.close?.();
    };
  }

  const ipc = window.electron?.ipcRenderer;
  const ipcChannel = HOST_EVENT_TO_IPC_CHANNEL[eventName];
  if (ipcChannel && ipc?.on && ipc?.off) {
    const listener = (payload: unknown) => {
      handler(payload as T);
    };
    ipc.on(ipcChannel, listener);
    return () => {
      ipc.off(ipcChannel, listener);
    };
  }

  console.warn(`[host-events] no IPC mapping for event "${eventName}", SSE fallback disabled`);
  return () => {};
}
