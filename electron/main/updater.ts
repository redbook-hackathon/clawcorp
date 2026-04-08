/**
 * Auto-Updater Module
 * Handles automatic application updates using electron-updater
 *
 * Update providers are configured in electron-builder.yml (OSS primary, GitHub fallback).
 */
import { autoUpdater, UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from 'electron-updater';
import { BrowserWindow, app, ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { setQuitting } from './app-state';
import { getSetting, normalizeUpdateChannel, setSetting, type UpdateChannel } from '../utils/store';

/** Base CDN URL (without trailing channel path) */
const OSS_BASE_URL = 'https://oss.intelli-spectrum.com';
type FeedChannel = 'latest' | 'beta' | 'alpha';

const FEED_CHANNEL_BY_UPDATE_CHANNEL: Record<UpdateChannel, FeedChannel> = {
  stable: 'latest',
  beta: 'beta',
  dev: 'alpha',
};

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: UpdateInfo;
  progress?: ProgressInfo;
  error?: string;
}

export type UpdateCheckReason = 'manual' | 'startup';

export interface UpdateCheckOptions {
  reason?: UpdateCheckReason;
  respectPolicy?: boolean;
}

export interface PersistedUpdatePolicyState {
  attemptCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastCheckReason: UpdateCheckReason | null;
  lastCheckError: string | null;
  lastCheckChannel: UpdateChannel;
  nextEligibleAt: string | null;
  rolloutDelayMs: number;
}

export interface UpdatePolicySnapshot extends PersistedUpdatePolicyState {
  channel: UpdateChannel;
  checkIntervalMs: number;
}

export interface UpdaterEvents {
  'status-changed': (status: UpdateStatus) => void;
  'checking-for-update': () => void;
  'update-available': (info: UpdateInfo) => void;
  'update-not-available': (info: UpdateInfo) => void;
  'download-progress': (progress: ProgressInfo) => void;
  'update-downloaded': (event: UpdateDownloadedEvent) => void;
  'auto-install-countdown': (payload: { seconds: number; cancelled?: boolean }) => void;
  'error': (error: Error) => void;
}

const CHECK_INTERVAL_MS_BY_CHANNEL: Record<UpdateChannel, number> = {
  stable: 12 * 60 * 60 * 1000,
  beta: 4 * 60 * 60 * 1000,
  dev: 60 * 60 * 1000,
};

const ROLLOUT_JITTER_WINDOW_MS_BY_CHANNEL: Record<UpdateChannel, number> = {
  stable: 60 * 60 * 1000,
  beta: 15 * 60 * 1000,
  dev: 5 * 60 * 1000,
};

function normalizePolicyState(
  input: unknown,
  channel: UpdateChannel,
  rolloutDelayMs: number,
): PersistedUpdatePolicyState {
  const value = input && typeof input === 'object'
    ? input as Partial<PersistedUpdatePolicyState>
    : {};

  return {
    attemptCount: typeof value.attemptCount === 'number' && value.attemptCount >= 0
      ? value.attemptCount
      : 0,
    lastAttemptAt: typeof value.lastAttemptAt === 'string' ? value.lastAttemptAt : null,
    lastSuccessAt: typeof value.lastSuccessAt === 'string' ? value.lastSuccessAt : null,
    lastFailureAt: typeof value.lastFailureAt === 'string' ? value.lastFailureAt : null,
    lastCheckReason: value.lastCheckReason === 'startup' || value.lastCheckReason === 'manual'
      ? value.lastCheckReason
      : null,
    lastCheckError: typeof value.lastCheckError === 'string' ? value.lastCheckError : null,
    lastCheckChannel: normalizeUpdateChannel(value.lastCheckChannel ?? channel),
    nextEligibleAt: typeof value.nextEligibleAt === 'string' ? value.nextEligibleAt : null,
    rolloutDelayMs: typeof value.rolloutDelayMs === 'number' && value.rolloutDelayMs >= 0
      ? value.rolloutDelayMs
      : rolloutDelayMs,
  };
}

function hashSeedToInt(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Detect update channel from app version.
 * e.g. "1.0.0-beta.1" -> beta, "1.0.0-alpha.1" -> dev, "1.0.0" -> stable
 */
function detectChannel(version: string): UpdateChannel {
  const match = version.match(/-([a-zA-Z]+)/);
  if (!match) return 'stable';
  const prerelease = match[1].toLowerCase();
  if (prerelease === 'beta') return 'beta';
  if (prerelease === 'stable' || prerelease === 'latest') return 'stable';
  return 'dev';
}

function getFeedChannel(channel: UpdateChannel): FeedChannel {
  return FEED_CHANNEL_BY_UPDATE_CHANNEL[channel];
}

function getFeedUrl(channel: UpdateChannel): string {
  return `${OSS_BASE_URL}/${getFeedChannel(channel)}`;
}

export class AppUpdater extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = { status: 'idle' };
  private autoInstallTimer: NodeJS.Timeout | null = null;
  private autoInstallCountdown = 0;
  private currentUpdateChannel: UpdateChannel = 'stable';
  private policySeed = app.getVersion();
  private policyState: PersistedUpdatePolicyState = normalizePolicyState(null, 'stable', 0);
  private readonly readyPromise: Promise<void>;

  /** Delay (in seconds) before auto-installing a downloaded update. */
  private static readonly AUTO_INSTALL_DELAY_SECONDS = 5;

  constructor() {
    super();

    // EventEmitter treats an unhandled 'error' event as fatal. Keep a default
    // listener so updater failures surface in logs/UI without terminating main.
    this.on('error', (error: Error) => {
      logger.error('[Updater] AppUpdater emitted error:', error);
    });

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.logger = {
      info: (msg: string) => logger.info('[Updater]', msg),
      warn: (msg: string) => logger.warn('[Updater]', msg),
      error: (msg: string) => logger.error('[Updater]', msg),
      debug: (msg: string) => logger.debug('[Updater]', msg),
    };

    const version = app.getVersion();
    const derivedChannel = detectChannel(version);
    this.applyChannel(derivedChannel, false);
    logger.info(
      `[Updater] Version: ${version}, channel: ${derivedChannel}, feedChannel: ${getFeedChannel(derivedChannel)}, feedUrl: ${getFeedUrl(derivedChannel)}`
    );

    // Replay persisted update channel and update policy state so runtime
    // behavior matches Settings and survives restarts.
    this.readyPromise = this.bootstrapPersistedState();

    this.setupListeners();
  }

  private applyChannel(channel: UpdateChannel, persist: boolean): void {
    const normalized = normalizeUpdateChannel(channel);
    this.currentUpdateChannel = normalized;
    const feedChannel = getFeedChannel(normalized);
    autoUpdater.channel = feedChannel;
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: getFeedUrl(normalized),
      useMultipleRangeRequest: false,
    });

    if (!persist) return;
    void setSetting('updateChannel', normalized).catch((error) => {
      logger.warn('[Updater] Failed to persist update channel:', error);
    });
  }

  private async bootstrapPersistedState(): Promise<void> {
    await this.bootstrapChannelFromSettings();
    await this.bootstrapPolicyStateFromSettings();
  }

  private async bootstrapChannelFromSettings(): Promise<void> {
    try {
      const explicit = await getSetting('updateChannelExplicit');
      if (!explicit) {
        return;
      }
      const persisted = await getSetting('updateChannel');
      this.applyChannel(persisted, false);
    } catch (error) {
      logger.warn('[Updater] Failed to load persisted update channel:', error);
    }
  }

  private async bootstrapPolicyStateFromSettings(): Promise<void> {
    try {
      const [persistedPolicy, machineId] = await Promise.all([
        getSetting('updatePolicyState').catch(() => null),
        getSetting('machineId').catch(() => ''),
      ]);
      this.policySeed = typeof machineId === 'string' && machineId.trim().length > 0
        ? machineId
        : app.getVersion();
      const rolloutDelayMs = this.computeRolloutDelayMs(this.currentUpdateChannel);
      this.policyState = normalizePolicyState(persistedPolicy, this.currentUpdateChannel, rolloutDelayMs);
      if (this.policyState.lastCheckChannel !== this.currentUpdateChannel || this.policyState.rolloutDelayMs !== rolloutDelayMs) {
        this.policyState = {
          ...this.policyState,
          lastCheckChannel: this.currentUpdateChannel,
          nextEligibleAt: this.recomputeNextEligibleAt(this.currentUpdateChannel),
          rolloutDelayMs,
        };
        await this.persistPolicyState();
      }
    } catch (error) {
      logger.warn('[Updater] Failed to load persisted update policy state:', error);
      this.policyState = normalizePolicyState(null, this.currentUpdateChannel, this.computeRolloutDelayMs(this.currentUpdateChannel));
    }
  }

  private async ensureReady(): Promise<void> {
    await this.readyPromise;
  }

  private computeCheckIntervalMs(channel = this.currentUpdateChannel): number {
    return CHECK_INTERVAL_MS_BY_CHANNEL[channel];
  }

  private computeRolloutDelayMs(channel = this.currentUpdateChannel): number {
    const windowMs = ROLLOUT_JITTER_WINDOW_MS_BY_CHANNEL[channel];
    if (windowMs <= 0) return 0;
    return hashSeedToInt(`${this.policySeed}:${channel}`) % windowMs;
  }

  private computeNextEligibleAt(nowMs: number, channel = this.currentUpdateChannel): string {
    return new Date(nowMs + this.computeCheckIntervalMs(channel) + this.computeRolloutDelayMs(channel)).toISOString();
  }

  private recomputeNextEligibleAt(channel = this.currentUpdateChannel): string | null {
    if (!this.policyState.lastAttemptAt) return null;
    const lastAttemptMs = Date.parse(this.policyState.lastAttemptAt);
    return Number.isFinite(lastAttemptMs) ? this.computeNextEligibleAt(lastAttemptMs, channel) : null;
  }

  private shouldSkipPolicyCheck(nowMs: number): boolean {
    if (!this.policyState.nextEligibleAt) return false;
    const nextEligibleMs = Date.parse(this.policyState.nextEligibleAt);
    return Number.isFinite(nextEligibleMs) && nextEligibleMs > nowMs;
  }

  private async persistPolicyState(): Promise<void> {
    try {
      await setSetting('updatePolicyState', this.policyState);
    } catch (error) {
      logger.warn('[Updater] Failed to persist update policy state:', error);
    }
  }

  /**
   * Set the main window for sending update events
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Get current update status
   */
  getStatus(): UpdateStatus {
    return this.status;
  }

  async waitUntilReady(): Promise<void> {
    await this.ensureReady();
  }

  getPolicySnapshot(): UpdatePolicySnapshot {
    return {
      ...this.policyState,
      channel: this.currentUpdateChannel,
      checkIntervalMs: this.computeCheckIntervalMs(),
    };
  }

  /**
   * Setup auto-updater event listeners
   */
  private setupListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({ status: 'checking' });
      this.emit('checking-for-update');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateStatus({ status: 'available', info });
      this.emit('update-available', info);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.updateStatus({ status: 'not-available', info });
      this.emit('update-not-available', info);
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.updateStatus({ status: 'downloading', progress });
      this.emit('download-progress', progress);
    });

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      this.updateStatus({ status: 'downloaded', info: event });
      this.emit('update-downloaded', event);

      if (autoUpdater.autoDownload) {
        this.startAutoInstallCountdown();
      }
    });

    autoUpdater.on('error', (error: Error) => {
      this.updateStatus({ status: 'error', error: error.message });
      this.emit('error', error);
    });
  }

  /**
   * Update status and notify renderer
   */
  private updateStatus(newStatus: Partial<UpdateStatus>): void {
    this.status = {
      status: newStatus.status ?? this.status.status,
      info: newStatus.info,
      progress: newStatus.progress,
      error: newStatus.error,
    };
    this.sendToRenderer('update:status-changed', this.status);
    this.emit('status-changed', this.status);
  }

  /**
   * Send event to renderer process
   */
  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Check for updates.
   * electron-updater automatically tries providers defined in electron-builder.yml in order.
   *
   * In dev mode (not packed), autoUpdater.checkForUpdates() silently returns
   * null without emitting any events, so we must detect this and force a
   * final status so the UI never gets stuck in 'checking'.
   */
  async checkForUpdates(options: UpdateCheckOptions = {}): Promise<UpdateInfo | null> {
    await this.ensureReady();
    const reason = options.reason ?? 'manual';
    const respectPolicy = options.respectPolicy ?? reason === 'startup';
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();

    if (respectPolicy && this.shouldSkipPolicyCheck(startedAtMs)) {
      logger.info(`[Updater] Skipping ${reason} update check until ${this.policyState.nextEligibleAt}`);
      return null;
    }

    this.policyState = {
      ...this.policyState,
      attemptCount: this.policyState.attemptCount + 1,
      lastAttemptAt: startedAtIso,
      lastCheckReason: reason,
      lastCheckChannel: this.currentUpdateChannel,
      lastCheckError: null,
      rolloutDelayMs: this.computeRolloutDelayMs(),
      nextEligibleAt: this.computeNextEligibleAt(startedAtMs),
    };
    await this.persistPolicyState();

    try {
      const result = await autoUpdater.checkForUpdates();

      // In dev mode (app not packaged), autoUpdater silently returns null
      // without emitting ANY events (not even checking-for-update).
      // Detect this and force an error so the UI never stays silent.
      if (result == null) {
        this.policyState = {
          ...this.policyState,
          lastFailureAt: startedAtIso,
          lastCheckError: 'Update check skipped (dev mode - app is not packaged)',
        };
        await this.persistPolicyState();
        this.updateStatus({
          status: 'error',
          error: 'Update check skipped (dev mode - app is not packaged)',
        });
        return null;
      }

      // Safety net: if events somehow didn't fire, force a final state.
      if (this.status.status === 'checking' || this.status.status === 'idle') {
        this.updateStatus({ status: 'not-available' });
      }

      this.policyState = {
        ...this.policyState,
        lastSuccessAt: startedAtIso,
        lastCheckError: null,
        lastCheckChannel: this.currentUpdateChannel,
      };
      await this.persistPolicyState();

      return result.updateInfo || null;
    } catch (error) {
      logger.error('[Updater] Check for updates failed:', error);
      this.policyState = {
        ...this.policyState,
        lastFailureAt: startedAtIso,
        lastCheckError: (error as Error).message || String(error),
      };
      await this.persistPolicyState();
      this.updateStatus({ status: 'error', error: (error as Error).message || String(error) });
      throw error;
    }
  }

  /**
   * Download available update
   */
  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      logger.error('[Updater] Download update failed:', error);
      throw error;
    }
  }

  /**
   * Install update and restart.
   *
   * On macOS, electron-updater delegates to Squirrel.Mac (ShipIt). The
   * native quitAndInstall() spawns ShipIt then internally calls app.quit().
   * However, the tray close handler in index.ts intercepts window close
   * and hides to tray unless isQuitting is true. Squirrel's internal quit
   * sometimes fails to trigger before-quit in time, so we set isQuitting
   * BEFORE calling quitAndInstall(). This lets the native quit flow close
   * the window cleanly while ShipIt runs independently to replace the app.
   */
  quitAndInstall(): void {
    logger.info('[Updater] quitAndInstall called');
    setQuitting();
    autoUpdater.quitAndInstall();
  }

  /**
   * Start a countdown that auto-installs the downloaded update.
   * Sends `update:auto-install-countdown` events to the renderer each second.
   */
  private startAutoInstallCountdown(): void {
    this.clearAutoInstallTimer();
    this.autoInstallCountdown = AppUpdater.AUTO_INSTALL_DELAY_SECONDS;
    this.sendToRenderer('update:auto-install-countdown', { seconds: this.autoInstallCountdown });
    this.emit('auto-install-countdown', { seconds: this.autoInstallCountdown });

    this.autoInstallTimer = setInterval(() => {
      this.autoInstallCountdown--;
      this.sendToRenderer('update:auto-install-countdown', { seconds: this.autoInstallCountdown });
      this.emit('auto-install-countdown', { seconds: this.autoInstallCountdown });

      if (this.autoInstallCountdown <= 0) {
        this.clearAutoInstallTimer();
        this.quitAndInstall();
      }
    }, 1000);
  }

  cancelAutoInstall(): void {
    this.clearAutoInstallTimer();
    this.sendToRenderer('update:auto-install-countdown', { seconds: -1, cancelled: true });
    this.emit('auto-install-countdown', { seconds: -1, cancelled: true });
  }

  private clearAutoInstallTimer(): void {
    if (this.autoInstallTimer) {
      clearInterval(this.autoInstallTimer);
      this.autoInstallTimer = null;
    }
  }

  /**
   * Set update channel (stable, beta, dev)
   */
  setChannel(channel: 'stable' | 'beta' | 'dev'): void {
    const normalizedChannel = normalizeUpdateChannel(channel);
    this.applyChannel(normalizedChannel, true);
    this.policyState = {
      ...this.policyState,
      lastCheckChannel: normalizedChannel,
      nextEligibleAt: this.recomputeNextEligibleAt(normalizedChannel),
      rolloutDelayMs: this.computeRolloutDelayMs(normalizedChannel),
    };
    void this.persistPolicyState();
  }

  /**
   * Set auto-download preference
   */
  setAutoDownload(enable: boolean): void {
    autoUpdater.autoDownload = enable;
  }

  /**
   * Get current version
   */
  getCurrentVersion(): string {
    return app.getVersion();
  }
}

/**
 * Register IPC handlers for update operations
 */
export function registerUpdateHandlers(
  updater: AppUpdater,
  mainWindow: BrowserWindow
): void {
  updater.setMainWindow(mainWindow);

  // Get current update status
  ipcMain.handle('update:status', () => {
    return updater.getStatus();
  });

  // Get current version
  ipcMain.handle('update:version', () => {
    return updater.getCurrentVersion();
  });

  // Check for updates - always return final status so the renderer
  // never gets stuck in 'checking' waiting for a push event.
  ipcMain.handle('update:check', async () => {
    try {
      await updater.checkForUpdates();
      return { success: true, status: updater.getStatus() };
    } catch (error) {
      return { success: false, error: String(error), status: updater.getStatus() };
    }
  });

  // Download update
  ipcMain.handle('update:download', async () => {
    try {
      await updater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Install update and restart
  ipcMain.handle('update:install', () => {
    updater.quitAndInstall();
    return { success: true };
  });

  // Set update channel
  ipcMain.handle('update:setChannel', (_, channel: 'stable' | 'beta' | 'dev') => {
    updater.setChannel(channel);
    return { success: true };
  });

  // Set auto-download preference
  ipcMain.handle('update:setAutoDownload', (_, enable: boolean) => {
    updater.setAutoDownload(enable);
    return { success: true };
  });

  // Cancel pending auto-install countdown
  ipcMain.handle('update:cancelAutoInstall', () => {
    updater.cancelAutoInstall();
    return { success: true };
  });
}

// Export singleton instance
export const appUpdater = new AppUpdater();
