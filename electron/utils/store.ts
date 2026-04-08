/**
 * Persistent Storage
 * Electron-store wrapper for application settings
 */

import { randomBytes } from 'crypto';
import { app } from 'electron';
import { resolveSupportedLanguage } from '../../shared/language';

// Lazy-load electron-store (ESM module)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let settingsStoreInstance: any = null;

export type UpdateChannel = 'stable' | 'beta' | 'dev';

const UPDATE_CHANNELS = new Set<UpdateChannel>(['stable', 'beta', 'dev']);

export function normalizeUpdateChannel(channel: unknown): UpdateChannel {
  if (typeof channel !== 'string') return 'stable';
  const normalized = channel.trim().toLowerCase();
  if (normalized === 'latest') return 'stable';
  if (normalized === 'alpha') return 'dev';
  if (UPDATE_CHANNELS.has(normalized as UpdateChannel)) {
    return normalized as UpdateChannel;
  }
  return 'stable';
}

/**
 * Generate a random token for gateway authentication
 */
function generateToken(): string {
  return `clawcorp-${randomBytes(16).toString('hex')}`;
}

/**
 * Application settings schema
 */
export interface AppSettings {
  // General
  theme: 'light' | 'dark' | 'system';
  language: string;
  startMinimized: boolean;
  launchAtStartup: boolean;
  telemetryEnabled: boolean;
  machineId: string;
  hasReportedInstall: boolean;

  // Gateway
  gatewayAutoStart: boolean;
  gatewayPort: number;
  gatewayToken: string;
  proxyEnabled: boolean;
  proxyServer: string;
  proxyHttpServer: string;
  proxyHttpsServer: string;
  proxyAllServer: string;
  proxyBypassRules: string;

  // Update
  updateChannel: UpdateChannel;
  updateChannelExplicit: boolean;
  autoCheckUpdate: boolean;
  autoDownloadUpdate: boolean;
  skippedVersions: string[];
  updatePolicyState: {
    attemptCount: number;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastCheckReason: 'manual' | 'startup' | null;
    lastCheckError: string | null;
    lastCheckChannel: UpdateChannel;
    nextEligibleAt: string | null;
    rolloutDelayMs: number;
  };

  // UI State
  sidebarCollapsed: boolean;
  devModeUnlocked: boolean;
  setupComplete: boolean;

  // Presets
  selectedBundles: string[];
  enabledSkills: string[];
  disabledSkills: string[];
}

/**
 * Default settings
 */
function getSystemLocale(): string {
  const preferredLanguages = typeof app.getPreferredSystemLanguages === 'function'
    ? app.getPreferredSystemLanguages()
    : [];
  return preferredLanguages[0]
    || (typeof app.getLocale === 'function' ? app.getLocale() : '')
    || Intl.DateTimeFormat().resolvedOptions().locale
    || 'en';
}

function createDefaultSettings(): AppSettings {
  return {
    // General
    theme: 'system',
    language: resolveSupportedLanguage(getSystemLocale()),
    startMinimized: false,
    launchAtStartup: false,
    telemetryEnabled: true,
    machineId: '',
    hasReportedInstall: false,

    // Gateway
    gatewayAutoStart: true,
    gatewayPort: 18789,
    gatewayToken: generateToken(),
    proxyEnabled: false,
    proxyServer: '',
    proxyHttpServer: '',
    proxyHttpsServer: '',
    proxyAllServer: '',
    proxyBypassRules: '<local>;localhost;127.0.0.1;::1',

    // Update
    updateChannel: 'stable',
    updateChannelExplicit: false,
    autoCheckUpdate: true,
    autoDownloadUpdate: false,
    skippedVersions: [],
    updatePolicyState: {
      attemptCount: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastCheckReason: null,
      lastCheckError: null,
      lastCheckChannel: 'stable',
      nextEligibleAt: null,
      rolloutDelayMs: 0,
    },

    // UI State
    sidebarCollapsed: false,
    devModeUnlocked: false,
    setupComplete: false,

    // Presets
    selectedBundles: ['productivity', 'developer'],
    enabledSkills: [],
    disabledSkills: [],
  };
}

/**
 * Get the settings store instance (lazy initialization)
 */
async function getSettingsStore() {
  if (!settingsStoreInstance) {
    const Store = (await import('electron-store')).default;
    settingsStoreInstance = new Store<AppSettings>({
      name: 'settings',
      defaults: createDefaultSettings(),
    });
  }
  return settingsStoreInstance;
}

/**
 * Get a setting value
 */
export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const store = await getSettingsStore();
  const rawValue = store.get(key);
  if (key === 'updateChannel') {
    const normalized = normalizeUpdateChannel(rawValue);
    if (normalized !== rawValue) {
      store.set('updateChannel', normalized);
    }
    return normalized as AppSettings[K];
  }
  return rawValue;
}

/**
 * Set a setting value
 */
export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const store = await getSettingsStore();
  if (key === 'updateChannel') {
    store.set('updateChannel', normalizeUpdateChannel(value));
    store.set('updateChannelExplicit', true);
    return;
  }
  if (key === 'updateChannelExplicit') {
    store.set('updateChannelExplicit', Boolean(value));
    return;
  }
  store.set(key, value);
}

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<AppSettings> {
  const store = await getSettingsStore();
  const settings = store.store as AppSettings;
  const normalizedChannel = normalizeUpdateChannel(settings.updateChannel);
  if (settings.updateChannel !== normalizedChannel) {
    store.set('updateChannel', normalizedChannel);
    settings.updateChannel = normalizedChannel;
  }
  return settings;
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<void> {
  const store = await getSettingsStore();
  store.clear();
}

/**
 * Export settings to JSON
 */
export async function exportSettings(): Promise<string> {
  const store = await getSettingsStore();
  return JSON.stringify(store.store, null, 2);
}

/**
 * Import settings from JSON
 */
export async function importSettings(json: string): Promise<void> {
  try {
    const settings = JSON.parse(json);
    const store = await getSettingsStore();
    store.set(settings);
  } catch {
    throw new Error('Invalid settings JSON');
  }
}
