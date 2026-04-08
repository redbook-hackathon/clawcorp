import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import Settings from '@/pages/Settings';
import { TitleBar } from '@/components/layout/TitleBar';
import enSettings from '@/i18n/locales/en/settings.json';
import { SETTINGS_NAV_GROUPS, type SettingsSectionId } from '@/components/settings-center/settings-shell-data';
import { hostApiFetch } from '@/lib/host-api';
import { useSettingsStore } from '@/stores/settings';
import { toast } from 'sonner';

const { gatewayState, updateState, navigateMock, invokeIpcMock } = vi.hoisted(() => ({
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
  navigateMock: vi.fn(),
  invokeIpcMock: vi.fn((channel: string) => {
    if (channel === 'window:isMaximized') {
      return Promise.resolve(false);
    }
    return Promise.resolve(undefined);
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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

vi.mock('@/components/settings/UpdateSettings', () => ({
  UpdateSettings: () => <div>Update Settings Mock</div>,
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

function getTopLevelNavItems() {
  return SETTINGS_NAV_GROUPS.flatMap((group) => group.items);
}

const LEGACY_TOP_LEVEL_IDS = [
  'team-role-strategy',
  'channel-advanced',
  'automation-defaults',
  'agent-avatars',
  'feedback-developer',
] as const;

describe('Settings center', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSettingsStore.getState().resetSettings();
    vi.mocked(hostApiFetch).mockImplementation(async (path) => {
      if (path === '/api/agents') {
        return {
          agents: [
            { id: 'researcher', name: 'Researcher', avatar: 'data:image/png;base64,existing' },
            { id: 'planner', name: 'Planner' },
          ],
        };
      }
      return {};
    });
  });

  it('renders the canonical 9-item settings IA without legacy top-level groups', async () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    const topLevelItems = getTopLevelNavItems();
    expect(topLevelItems).toHaveLength(9);
    expect(topLevelItems[0]?.id).toBe('costs-usage');
    expect(enSettings.settingsShell.items['costs-usage'].label).toBe('Costs & Usage');
    expect(topLevelItems.at(-1)?.id).toBe('about');
    expect(enSettings.settingsShell.items.about.label).toBe('About');

    expect(screen.getByRole('button', { name: getNavLabel('costs-usage') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: getNavLabel('about') })).toBeInTheDocument();

    for (const groupId of ['basic', 'workflow', 'capability', 'governance'] as const) {
      expect(screen.queryByText(`settings:settingsShell.groups.${groupId}`)).not.toBeInTheDocument();
    }

    for (const legacyId of LEGACY_TOP_LEVEL_IDS) {
      expect(
        screen.queryByRole('button', { name: `settings:settingsShell.items.${legacyId}.label` }),
      ).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('migration-backup') }));
    expect(screen.getByRole('button', { name: 'migrationPanel.migrate.cta' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('memory-knowledge') }));
    expect(screen.getByRole('tab', { name: 'memoryKnowledge.tabs.strategy' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'memoryKnowledge.tabs.browser' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('about') }));
    expect(screen.getByRole('button', { name: '运行诊断' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新运行初始化' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置所有设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除服务器数据' })).toBeInTheDocument();

    expect(
      await axe(container, {
        rules: {
          'heading-order': { enabled: false },
        },
      }),
    ).toHaveNoViolations();
  });

  it('splits the Skills and MCP settings surface into tabbed panels', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('skills-mcp') }));

    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('tab', { name: 'MCP' })).toBeInTheDocument();
    expect(screen.getByText(/Native Skills/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'MCP' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'MCP' })).toHaveAttribute('data-state', 'active');
    });
    expect(screen.getByText('MCP services')).toBeInTheDocument();
  });

  it('persists developer toggles through the host settings api', () => {
    const hostApiFetchMock = vi.mocked(hostApiFetch);
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('about') }));

    fireEvent.click(screen.getByRole('switch', { name: /API RPC/ }));
    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/settings/remoteRpcEnabled',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ value: true }),
      }),
    );

    fireEvent.click(screen.getByRole('switch', { name: /P2P/ }));
    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/settings/p2pSyncEnabled',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ value: true }),
      }),
    );
  });

  it('provides maintenance actions for setup re-entry, settings reset, and server data clear', async () => {
    const hostApiFetchMock = vi.mocked(hostApiFetch);
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('about') }));

    fireEvent.click(screen.getByRole('button', { name: '重新运行初始化' }));
    expect(navigateMock).toHaveBeenCalledWith('/setup');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '重置所有设置' }));
    });
    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/settings/reset',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('settings:maintenance.resetSuccess');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '清除服务器数据' }));
    });
    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/app/clear-server-data',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('settings:maintenance.clearSuccess');
  });

  it('allows changing the update channel from the auto-update section', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('app-updates') }));
    fireEvent.change(screen.getByRole('combobox', { name: '更新渠道' }), {
      target: { value: 'beta' },
    });

    expect(updateState.setChannel).toHaveBeenCalledWith('beta');
    expect(screen.getByText('更新策略')).toBeInTheDocument();
  });

  it('uploads and clears custom brand logo/icon data urls', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('general') }));

    const logoInput = screen.getByLabelText('上传品牌 Logo');
    const iconInput = screen.getByLabelText('上传品牌图标');

    fireEvent.change(logoInput, {
      target: { files: [new File(['logo'], 'logo.png', { type: 'image/png' })] },
    });
    fireEvent.change(iconInput, {
      target: { files: [new File(['icon'], 'icon.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(useSettingsStore.getState().brandLogoDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(useSettingsStore.getState().brandIconDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    fireEvent.click(screen.getByRole('button', { name: '清除品牌 Logo' }));
    fireEvent.click(screen.getByRole('button', { name: '清除品牌图标' }));

    expect(useSettingsStore.getState().brandLogoDataUrl).toBe(null);
    expect(useSettingsStore.getState().brandIconDataUrl).toBe(null);
  });

  it('renders custom brand icon and name in the title bar', () => {
    const originalElectron = window.electron;
    Object.defineProperty(window, 'electron', {
      value: {
        ...(originalElectron ?? {}),
        platform: 'win32',
      },
      configurable: true,
      writable: true,
    });

    useSettingsStore.setState({
      brandName: 'Acme Control',
      brandIconDataUrl: 'data:image/png;base64,abc123',
    });

    render(<TitleBar />);

    expect(screen.getByText('Acme Control')).toBeInTheDocument();
    expect(screen.getByAltText('Brand icon')).toHaveAttribute('src', 'data:image/png;base64,abc123');

    Object.defineProperty(window, 'electron', {
      value: originalElectron,
      configurable: true,
      writable: true,
    });
  });

  it('manages agent avatar uploads and removals through the host api', async () => {
    const OriginalFileReader = globalThis.FileReader;
    class MockFileReader {
      result: string | ArrayBuffer | null = 'data:image/png;base64,uploaded';
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL(_file: Blob) {
        this.onload?.call(this as unknown as FileReader, new ProgressEvent('load'));
      }
    }
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      writable: true,
      value: MockFileReader,
    });

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('general') }));

    expect(await screen.findByText('Researcher')).toBeInTheDocument();

    fireEvent.change(document.getElementById('agent-avatar-researcher') as HTMLInputElement, {
      target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/agents/researcher',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    expect(screen.getByRole('button', { name: 'settings:removeAvatar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'settings:removeAvatar' }));

    await waitFor(() => {
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/agents/researcher',
        expect.objectContaining({ body: JSON.stringify({ avatar: null }) }),
      );
    });

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      writable: true,
      value: OriginalFileReader,
    });
  });

  it('localizes agent avatar validation errors', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: getNavLabel('general') }));
    await screen.findByText('Researcher');

    fireEvent.change(document.getElementById('agent-avatar-researcher') as HTMLInputElement, {
      target: { files: [new File(['note'], 'note.txt', { type: 'text/plain' })] },
    });

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('settings:avatarImageRequired');
  });
});
