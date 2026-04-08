/**
 * Update State Store
 * Manages application update state
 */
import { create } from 'zustand';
import { useSettingsStore } from './settings';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

export interface ProgressInfo {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

export type UpdateStatus = 
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdatePolicySnapshot {
  attemptCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastCheckReason: 'manual' | 'startup' | null;
  lastCheckError: string | null;
  lastCheckChannel: 'stable' | 'beta' | 'dev';
  nextEligibleAt: string | null;
  rolloutDelayMs: number;
  channel: 'stable' | 'beta' | 'dev';
  checkIntervalMs: number;
}

type UpdateStatusResponse = {
  currentVersion: string;
  status: {
    status: UpdateStatus;
    info?: UpdateInfo;
    progress?: ProgressInfo;
    error?: string;
  };
  policy?: UpdatePolicySnapshot;
};

type UpdateMutationResponse = {
  success: boolean;
  error?: string;
  status?: {
    status: UpdateStatus;
    info?: UpdateInfo;
    progress?: ProgressInfo;
    error?: string;
  };
  policy?: UpdatePolicySnapshot;
};

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  progress: ProgressInfo | null;
  error: string | null;
  policy: UpdatePolicySnapshot | null;
  isInitialized: boolean;
  _cleanup: (() => void) | null;
  /** Seconds remaining before auto-install, or null if inactive. */
  autoInstallCountdown: number | null;

  // Actions
  init: () => Promise<void>;
  checkForUpdates: (options?: { reason?: 'manual' | 'startup'; respectPolicy?: boolean }) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;
  cancelAutoInstall: () => Promise<void>;
  setChannel: (channel: 'stable' | 'beta' | 'dev') => Promise<void>;
  setAutoDownload: (enable: boolean) => Promise<void>;
  clearError: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: 'idle',
  currentVersion: '0.0.0',
  updateInfo: null,
  progress: null,
  error: null,
  policy: null,
  isInitialized: false,
  _cleanup: null,
  autoInstallCountdown: null,

  init: async () => {
    if (get().isInitialized) return;

    try {
      const snapshot = await hostApiFetch<UpdateStatusResponse>('/api/app/update/status');
      set({
        currentVersion: snapshot.currentVersion,
        status: snapshot.status.status,
        updateInfo: snapshot.status.info || null,
        progress: snapshot.status.progress || null,
        error: snapshot.status.error || null,
        policy: snapshot.policy || null,
      });
    } catch (error) {
      console.error('Failed to initialize update status:', error);
    }

    const onStatusChanged = (data: unknown) => {
      const status = data as {
        status: UpdateStatus;
        info?: UpdateInfo;
        progress?: ProgressInfo;
        error?: string;
      };
      set({
        status: status.status,
        updateInfo: status.info || null,
        progress: status.progress || null,
        error: status.error || null,
      });
    };
    const unsubscribeStatus = subscribeHostEvent('update:status', onStatusChanged);

    const onCountdown = (data: unknown) => {
      const { seconds, cancelled } = data as { seconds: number; cancelled?: boolean };
      set({ autoInstallCountdown: cancelled ? null : seconds });
    };
    const unsubscribeCountdown = subscribeHostEvent('update:auto-install-countdown', onCountdown);

    set({
      isInitialized: true,
      _cleanup: () => {
        unsubscribeStatus();
        unsubscribeCountdown();
      },
    });

    // Apply persisted settings from the settings store
    const { autoCheckUpdate, autoDownloadUpdate } = useSettingsStore.getState();

    // Sync auto-download preference to the main process
    if (autoDownloadUpdate) {
      hostApiFetch('/api/app/update/auto-download', {
        method: 'PUT',
        body: JSON.stringify({ enabled: true }),
      }).catch(() => {});
    }

    // Auto-check for updates on startup (respects user toggle)
    if (autoCheckUpdate) {
      setTimeout(() => {
        get().checkForUpdates({ reason: 'startup', respectPolicy: true }).catch(() => {});
      }, 10000);
    }
  },

  checkForUpdates: async (options?: { reason?: 'manual' | 'startup'; respectPolicy?: boolean }) => {
    set({ status: 'checking', error: null });
    
    try {
      const result = await Promise.race([
        hostApiFetch<UpdateMutationResponse>('/api/app/update/check', {
          method: 'POST',
          body: JSON.stringify({
            reason: options?.reason ?? 'manual',
            respectPolicy: options?.respectPolicy === true,
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Update check timed out')), 30000))
      ]) as UpdateMutationResponse;
      
      if (result.status) {
        set({
          status: result.status.status,
          updateInfo: result.status.info || null,
          progress: result.status.progress || null,
          error: result.status.error || null,
          policy: result.policy || get().policy,
        });
      } else if (!result.success) {
        set({ status: 'error', error: result.error || 'Failed to check for updates' });
      }
    } catch (error) {
      set({ status: 'error', error: String(error) });
    } finally {
      // In dev mode autoUpdater skips without emitting events, so the
      // status may still be 'checking' or even 'idle'. Catch both.
      const currentStatus = get().status;
      if (options?.respectPolicy !== true && (currentStatus === 'checking' || currentStatus === 'idle')) {
        set({ status: 'error', error: 'Update check completed without a result. This usually means the app is running in dev mode.' });
      }
    }
  },

  downloadUpdate: async () => {
    set({ status: 'downloading', error: null });
    
    try {
      const result = await hostApiFetch<UpdateMutationResponse>('/api/app/update/download', {
        method: 'POST',
      });
      
      if (!result.success) {
        set({ status: 'error', error: result.error || 'Failed to download update' });
      }
    } catch (error) {
      set({ status: 'error', error: String(error) });
    }
  },

  installUpdate: () => {
    void hostApiFetch('/api/app/update/install', {
      method: 'POST',
    });
  },

  cancelAutoInstall: async () => {
    try {
      await hostApiFetch('/api/app/update/cancel-auto-install', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to cancel auto-install:', error);
    }
  },

  setChannel: async (channel) => {
    try {
      const result = await hostApiFetch<UpdateMutationResponse>('/api/app/update/channel', {
        method: 'PUT',
        body: JSON.stringify({ channel }),
      });
      set({ policy: result.policy || get().policy });
    } catch (error) {
      console.error('Failed to set update channel:', error);
    }
  },

  setAutoDownload: async (enable) => {
    try {
      await hostApiFetch('/api/app/update/auto-download', {
        method: 'PUT',
        body: JSON.stringify({ enabled: enable }),
      });
    } catch (error) {
      console.error('Failed to set auto-download:', error);
    }
  },

  clearError: () => set({ error: null, status: 'idle' }),
}));
