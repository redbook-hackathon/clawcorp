import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAutoUpdater,
  mockAppGetVersion,
  mockGetSetting,
  mockSetSetting,
} = vi.hoisted(() => ({
  mockAutoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    channel: '',
    logger: undefined as unknown,
    on: vi.fn(),
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
  mockAppGetVersion: vi.fn(() => '1.0.0'),
  mockGetSetting: vi.fn(),
  mockSetSetting: vi.fn(),
}));

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

vi.mock('electron', () => ({
  app: {
    getVersion: mockAppGetVersion,
  },
  BrowserWindow: class {},
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@electron/utils/store', () => ({
  getSetting: mockGetSetting,
  setSetting: mockSetSetting,
  normalizeUpdateChannel: (channel: unknown) => {
    if (typeof channel !== 'string') return 'stable';
    const normalized = channel.trim().toLowerCase();
    if (normalized === 'latest') return 'stable';
    if (normalized === 'beta') return 'beta';
    if (normalized === 'dev' || normalized === 'alpha') return 'dev';
    return 'stable';
  },
}));

vi.mock('@electron/main/app-state', () => ({
  setQuitting: vi.fn(),
}));

describe('updater channel semantics and persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockAppGetVersion.mockReturnValue('1.0.0');
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'updateChannelExplicit') return Promise.resolve(true);
      if (key === 'updatePolicyState') {
        return Promise.resolve({
          attemptCount: 0,
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastCheckReason: null,
          lastCheckError: null,
          lastCheckChannel: 'stable',
          nextEligibleAt: null,
          rolloutDelayMs: 0,
        });
      }
      if (key === 'machineId') return Promise.resolve('machine-1');
      return Promise.resolve('stable');
    });
    mockSetSetting.mockResolvedValue(undefined);
  });

  it('maps stable to latest for updater feeds on startup', async () => {
    const { AppUpdater } = await import('@electron/main/updater');
    mockAutoUpdater.setFeedURL.mockClear();

    new AppUpdater();

    expect(mockAutoUpdater.channel).toBe('latest');
    expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://oss.intelli-spectrum.com/latest' }),
    );
  });

  it('replays persisted channel from settings using feed mapping', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'updateChannelExplicit') return Promise.resolve(true);
      if (key === 'updateChannel') return Promise.resolve('dev');
      return Promise.resolve(undefined);
    });
    const { AppUpdater } = await import('@electron/main/updater');
    mockAutoUpdater.setFeedURL.mockClear();

    new AppUpdater();

    await vi.waitFor(() => {
      expect(mockGetSetting).toHaveBeenCalledWith('updateChannel');
    });
    await vi.waitFor(() => {
      expect(mockAutoUpdater.channel).toBe('alpha');
    });
    expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://oss.intelli-spectrum.com/alpha' }),
    );
  });

  it('keeps prerelease-derived channel when no explicit setting exists', async () => {
    mockAppGetVersion.mockReturnValue('1.2.3-beta.1');
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'updateChannelExplicit') return Promise.resolve(false);
      if (key === 'updateChannel') return Promise.resolve('stable');
      return Promise.resolve(undefined);
    });
    const { AppUpdater } = await import('@electron/main/updater');
    mockAutoUpdater.setFeedURL.mockClear();

    new AppUpdater();

    await vi.waitFor(() => {
      expect(mockGetSetting).toHaveBeenCalledWith('updateChannelExplicit');
    });
    expect(mockGetSetting).not.toHaveBeenCalledWith('updateChannel');
    await vi.waitFor(() => {
      expect(mockAutoUpdater.channel).toBe('beta');
    });
    expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://oss.intelli-spectrum.com/beta' }),
    );
  });

  it('setChannel recalculates feed URL and persists canonical channel', async () => {
    const originalNextEligibleAt = '2026-03-26T12:00:00.000Z';
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'updateChannelExplicit') return Promise.resolve(true);
      if (key === 'updateChannel') return Promise.resolve('stable');
      if (key === 'machineId') return Promise.resolve('machine-1');
      if (key === 'updatePolicyState') {
        return Promise.resolve({
          attemptCount: 1,
          lastAttemptAt: '2026-03-26T00:00:00.000Z',
          lastSuccessAt: null,
          lastFailureAt: null,
          lastCheckReason: 'startup',
          lastCheckError: null,
          lastCheckChannel: 'stable',
          nextEligibleAt: originalNextEligibleAt,
          rolloutDelayMs: 30 * 60 * 1000,
        });
      }
      return Promise.resolve('stable');
    });
    const { AppUpdater } = await import('@electron/main/updater');
    const updater = new AppUpdater();
    mockAutoUpdater.setFeedURL.mockClear();
    mockSetSetting.mockClear();

    await updater.waitUntilReady();
    updater.setChannel('beta');

    expect(mockAutoUpdater.channel).toBe('beta');
    expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://oss.intelli-spectrum.com/beta' }),
    );
    await vi.waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('updateChannel', 'beta');
    });
    await vi.waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith(
        'updatePolicyState',
        expect.objectContaining({
          lastCheckChannel: 'beta',
          nextEligibleAt: expect.any(String),
        }),
      );
    });
    const persistedPolicyState = [...mockSetSetting.mock.calls]
      .reverse()
      .find(([key, value]) => key === 'updatePolicyState' && value && typeof value === 'object')
      ?.[1] as { nextEligibleAt: string; lastCheckChannel: string } | undefined;
    expect(persistedPolicyState?.lastCheckChannel).toBe('beta');
    expect(persistedPolicyState?.nextEligibleAt).not.toBe(originalNextEligibleAt);
  });

  it('loads persisted update policy state and skips startup checks before the next eligible time', async () => {
    const lastAttemptAt = new Date(Date.now() - 30_000).toISOString();
    const nextEligibleAt = new Date(Date.now() + 60_000).toISOString();
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'updateChannelExplicit') return Promise.resolve(true);
      if (key === 'updateChannel') return Promise.resolve('stable');
      if (key === 'machineId') return Promise.resolve('machine-1');
      if (key === 'updatePolicyState') {
        return Promise.resolve({
          attemptCount: 2,
          lastAttemptAt,
          lastSuccessAt: lastAttemptAt,
          lastFailureAt: null,
          lastCheckReason: 'startup',
          lastCheckError: null,
          lastCheckChannel: 'stable',
          nextEligibleAt,
          rolloutDelayMs: 12_345,
        });
      }
      return Promise.resolve(undefined);
    });
    const { AppUpdater } = await import('@electron/main/updater');
    const updater = new AppUpdater();

    await updater.waitUntilReady();
    expect(mockGetSetting).toHaveBeenCalledWith('updatePolicyState');
    expect(updater.getPolicySnapshot()).toEqual(
      expect.objectContaining({
        attemptCount: 2,
        nextEligibleAt: expect.any(String),
      }),
    );
    expect(updater.getPolicySnapshot().rolloutDelayMs).toBeGreaterThan(0);
    expect(updater.getPolicySnapshot().nextEligibleAt).not.toBe(nextEligibleAt);

    const result = await updater.checkForUpdates({ reason: 'startup', respectPolicy: true });

    expect(result).toBeNull();
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(updater.getPolicySnapshot()).toEqual(
      expect.objectContaining({
        attemptCount: 2,
        nextEligibleAt: updater.getPolicySnapshot().nextEligibleAt,
      }),
    );
  });

  it('persists update policy attempt state after a startup update check', async () => {
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({
      updateInfo: {
        version: '1.2.3',
        releaseDate: '2026-03-26T00:00:00.000Z',
      },
    });

    const { AppUpdater } = await import('@electron/main/updater');
    const updater = new AppUpdater();

    await updater.checkForUpdates({ reason: 'startup', respectPolicy: true });

    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith(
        'updatePolicyState',
        expect.objectContaining({
          attemptCount: 1,
          lastCheckReason: 'startup',
          lastCheckChannel: 'stable',
          lastCheckError: null,
          nextEligibleAt: expect.any(String),
          rolloutDelayMs: expect.any(Number),
        }),
      );
    });
  });
});
