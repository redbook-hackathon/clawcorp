import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '@/pages/Settings';
import { SETTINGS_NAV_GROUPS, type SettingsSectionId } from '@/components/settings-center/settings-shell-data';
import { hostApiFetch } from '@/lib/host-api';

const { gatewayState, updateState, invokeIpcMock } = vi.hoisted(() => ({
  gatewayState: {
    status: { state: 'running', port: 18789 },
    restart: vi.fn(),
  },
  updateState: {
    currentVersion: '1.0.0',
    status: 'idle',
    updateInfo: null,
    progress: null,
    error: null,
    policy: {
      channel: 'stable',
      attemptCount: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastCheckReason: null,
      lastCheckError: null,
      lastCheckChannel: 'stable',
      nextEligibleAt: null,
      rolloutDelayMs: 0,
      checkIntervalMs: 12 * 60 * 60 * 1000,
    },
    setAutoDownload: vi.fn(),
    setChannel: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    init: vi.fn(),
  },
  invokeIpcMock: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: () => gatewayState,
}));

vi.mock('@/stores/update', () => ({
  useUpdateStore: (selector: (state: typeof updateState) => unknown) => selector(updateState),
}));

vi.mock('@/stores/skills', () => ({
  useSkillsStore: () => ({
    skills: [],
    loading: false,
    fetchSkills: vi.fn(),
    enableSkill: vi.fn(),
    disableSkill: vi.fn(),
  }),
}));

vi.mock('@/components/settings/ProvidersSettings', () => ({
  ProvidersSettings: () => <div>Providers Settings Mock</div>,
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: invokeIpcMock,
  toUserMessage: (error: unknown) => String(error),
  getGatewayWsDiagnosticEnabled: () => false,
  setGatewayWsDiagnosticEnabled: vi.fn(),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/telemetry', () => ({
  clearUiTelemetry: vi.fn(),
  getUiTelemetrySnapshot: vi.fn(() => []),
  subscribeUiTelemetry: vi.fn(() => () => undefined),
  trackUiEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) => {
      if (typeof options === 'string') {
        return options;
      }
      return options?.defaultValue ?? key;
    },
  }),
}));

function getNavLabel(id: SettingsSectionId): string {
  const item = SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`Missing nav item for ${id}`);
  }
  return item.labelKey;
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="settings-location">{location.pathname}{location.search}</div>;
}

function renderSettingsAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/settings"
          element={
            <>
              <LocationProbe />
              <Settings />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Settings route convergence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hostApiFetch).mockResolvedValue({});
  });

  it.each([
    ['/settings?section=memory-knowledge', 'memory-knowledge'],
    ['/settings?section=skills-mcp', 'skills-mcp'],
    ['/settings?section=about', 'about'],
  ] as const)('activates the requested canonical section for %s', async (entry, sectionId) => {
    renderSettingsAt(entry);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: getNavLabel(sectionId) })).toHaveAttribute('aria-current', 'page');
    });
  });

  it('falls back to costs-usage when the section query is invalid', async () => {
    renderSettingsAt('/settings?section=legacy-settings');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: getNavLabel('costs-usage') })).toHaveAttribute('aria-current', 'page');
    });

    expect(screen.getByTestId('settings-location')).toHaveTextContent('/settings?section=costs-usage');
  });

  it('keeps the URL query in sync when the user selects a different section', async () => {
    renderSettingsAt('/settings');

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('about') }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: getNavLabel('about') })).toHaveAttribute('aria-current', 'page');
    });

    expect(screen.getByTestId('settings-location')).toHaveTextContent('/settings?section=about');
  });
});
