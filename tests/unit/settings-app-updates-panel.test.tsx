import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsAppUpdatesPanel } from '@/components/settings-center/settings-app-updates-panel';

const {
  updateState,
  settingsState,
  clipboardWriteText,
} = vi.hoisted(() => ({
  updateState: {
    currentVersion: '1.0.0',
    status: 'available',
    updateInfo: {
      version: '1.1.0',
      releaseDate: '2026-04-03T00:00:00.000Z',
      releaseNotes: 'Improved settings convergence.',
    },
    progress: null,
    error: null,
    policy: {
      channel: 'stable',
      attemptCount: 2,
      lastAttemptAt: '2026-04-03T01:00:00.000Z',
      lastSuccessAt: '2026-04-03T01:00:05.000Z',
      lastFailureAt: null,
      lastCheckReason: 'manual',
      lastCheckError: null,
      lastCheckChannel: 'stable',
      nextEligibleAt: '2026-04-03T13:00:00.000Z',
      rolloutDelayMs: 15 * 60 * 1000,
      checkIntervalMs: 12 * 60 * 60 * 1000,
    },
    autoInstallCountdown: null,
    init: vi.fn(),
    clearError: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    cancelAutoInstall: vi.fn(),
    setChannel: vi.fn(),
    setAutoDownload: vi.fn(),
  },
  settingsState: {
    autoCheckUpdate: true,
    setAutoCheckUpdate: vi.fn(),
    autoDownloadUpdate: false,
    setAutoDownloadUpdate: vi.fn(),
  },
  clipboardWriteText: vi.fn(),
}));

vi.mock('@/stores/update', () => ({
  useUpdateStore: (selector: (state: typeof updateState) => unknown) => selector(updateState),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; version?: string; seconds?: number }) => {
      if (key === 'updates.status.available') {
        return `Update available: v${options?.version}`;
      }
      if (key === 'updates.status.autoInstalling') {
        return `Restarting to install update in ${options?.seconds}s...`;
      }
      return options?.defaultValue ?? key;
    },
  }),
}));

describe('SettingsAppUpdatesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
  });

  it('renders version status, update policy, and changelog actions from the update store', () => {
    render(<SettingsAppUpdatesPanel />);

    expect(screen.getByText('ClawCorp v1.0.0')).toBeInTheDocument();
    expect(screen.getByText(/Improved settings convergence\./)).toBeInTheDocument();
    expect(screen.getByText('检查次数')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Update' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制更新日志' })).toBeInTheDocument();
  });

  it('triggers update actions and policy changes', () => {
    render(<SettingsAppUpdatesPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Download Update' }));
    expect(updateState.downloadUpdate).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Check for Updates' }));
    expect(updateState.clearError).toHaveBeenCalledOnce();
    expect(updateState.checkForUpdates).toHaveBeenCalledWith({ reason: 'manual' });

    fireEvent.click(screen.getByRole('switch', { name: 'Auto-check for updates' }));
    expect(settingsState.setAutoCheckUpdate).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('switch', { name: 'Auto-update' }));
    expect(settingsState.setAutoDownloadUpdate).toHaveBeenCalledWith(true);
    expect(updateState.setAutoDownload).toHaveBeenCalledWith(true);

    fireEvent.change(screen.getByRole('combobox', { name: '更新渠道' }), {
      target: { value: 'beta' },
    });
    expect(updateState.setChannel).toHaveBeenCalledWith('beta');
  });

  it('copies the changelog when release notes are available', () => {
    render(<SettingsAppUpdatesPanel />);

    fireEvent.click(screen.getByRole('button', { name: '复制更新日志' }));
    expect(clipboardWriteText).toHaveBeenCalledWith('Improved settings convergence.');
  });
});
