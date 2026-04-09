// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

const {
  mockGetAllSettings,
  mockGetSetting,
  mockProviderService,
  mockListMarketplaceTemplates,
  mockHireFromMarketplaceTemplate,
  mockHireTeamFromMarketplaceTemplate,
} = vi.hoisted(() => ({
  mockGetAllSettings: vi.fn(),
  mockGetSetting: vi.fn(),
  mockProviderService: {
    listLegacyProvidersWithKeyInfo: vi.fn(),
    getLegacyProvider: vi.fn(),
    getDefaultLegacyProvider: vi.fn(),
    hasLegacyProviderApiKey: vi.fn(),
    getLegacyProviderApiKey: vi.fn(),
    validateLegacyProviderApiKey: vi.fn(),
    saveLegacyProvider: vi.fn(),
    deleteLegacyProvider: vi.fn(),
    setLegacyProviderApiKey: vi.fn(),
    deleteLegacyProviderApiKey: vi.fn(),
    listVendors: vi.fn(),
    listAccounts: vi.fn(),
    getAccount: vi.fn(),
    setDefaultLegacyProvider: vi.fn(),
  },
  mockListMarketplaceTemplates: vi.fn(),
  mockHireFromMarketplaceTemplate: vi.fn(),
  mockHireTeamFromMarketplaceTemplate: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
  },
  BrowserWindow: class {},
  shell: {
    openExternal: vi.fn(),
    showItemInFolder: vi.fn(),
    openPath: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'ClawX'),
    getPath: vi.fn(() => '/tmp'),
    getAppPath: vi.fn(() => '/tmp/app'),
    quit: vi.fn(),
    relaunch: vi.fn(),
    isPackaged: false,
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      isEmpty: () => true,
      getSize: () => ({ width: 0, height: 0 }),
      resize: () => ({ toPNG: () => Buffer.from('') }),
    })),
  },
}));

vi.mock('@electron/utils/store', () => ({
  getAllSettings: mockGetAllSettings,
  getSetting: mockGetSetting,
  resetSettings: vi.fn(),
  setSetting: vi.fn(),
}));

vi.mock('@electron/services/providers/provider-service', () => ({
  getProviderService: () => mockProviderService,
}));

vi.mock('@electron/main/updater', () => ({
  appUpdater: {
    getStatus: vi.fn(),
    getCurrentVersion: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    setChannel: vi.fn(),
    setAutoDownload: vi.fn(),
    cancelAutoInstall: vi.fn(),
  },
}));

vi.mock('@electron/utils/openclaw-workspace', () => ({
  listMarketplaceTemplates: mockListMarketplaceTemplates,
  hireFromMarketplaceTemplate: mockHireFromMarketplaceTemplate,
  hireTeamFromMarketplaceTemplate: mockHireTeamFromMarketplaceTemplate,
}));

const gatewayManager = {
  getStatus: vi.fn(() => ({ state: 'stopped', port: 18789 })),
  isConnected: vi.fn(() => false),
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  rpc: vi.fn(),
  on: vi.fn(),
  debouncedRestart: vi.fn(),
};

const clawHubService = {
  search: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  listInstalled: vi.fn(),
  openSkillReadme: vi.fn(),
};

const mainWindow = {
  minimize: vi.fn(),
  maximize: vi.fn(),
  unmaximize: vi.fn(),
  isMaximized: vi.fn(() => false),
  close: vi.fn(),
  isDestroyed: vi.fn(() => false),
  webContents: { send: vi.fn() },
};

describe('marketplace IPC handlers', () => {
  beforeEach(async () => {
    handlers.clear();
    vi.clearAllMocks();
    const { registerIpcHandlers } = await import('@electron/main/ipc-handlers');
    registerIpcHandlers(
      gatewayManager,
      clawHubService,
      mainWindow,
      'session-token',
    );
  });

  it('registers marketplace:listTemplates and returns template data', async () => {
    const templates = [
      {
        id: 'data-analyst',
        name: 'Data Analyst',
        description: 'Analyzes metrics',
        emoji: '📊',
        vibe: 'Sharp',
        role: 'Analyst',
        hireType: 'single',
        capabilities: ['Analyze reports'],
        tags: ['数据分析'],
        price: '$19/mo',
        avatar: 'data:image/png;base64,abc',
        rating: 4.9,
        hiredCount: 12,
      },
    ];
    mockListMarketplaceTemplates.mockResolvedValueOnce(templates);

    const handler = handlers.get('marketplace:listTemplates');
    expect(handler).toBeDefined();

    const result = await handler?.({});

    expect(mockListMarketplaceTemplates).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      templates,
    });
  });
});
