// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const fsAccessMock = vi.fn();
const fsReadFileMock = vi.fn();

const {
  mockGetAllSettings,
  mockGetSetting,
  mockProviderService,
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
  },
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
    quit: vi.fn(),
    relaunch: vi.fn(),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({
      isEmpty: () => true,
      getSize: () => ({ width: 0, height: 0 }),
      resize: () => ({ toPNG: () => Buffer.from('') }),
    })),
  },
}));

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    access: (...args: unknown[]) => fsAccessMock(...args),
    readFile: (...args: unknown[]) => fsReadFileMock(...args),
  };
});

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

const gatewayManager = {
  getStatus: vi.fn(),
  isConnected: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  rpc: vi.fn(),
  on: vi.fn(),
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

describe('app:request security', () => {
  beforeEach(async () => {
    handlers.clear();
    vi.clearAllMocks();
    gatewayManager.getStatus.mockReturnValue({ state: 'stopped', port: 18789 });
    fsAccessMock.mockResolvedValue(undefined);
    fsReadFileMock.mockResolvedValue(Buffer.from('file'));
    const { registerIpcHandlers } = await import('@electron/main/ipc-handlers');
    registerIpcHandlers(
      gatewayManager,
      clawHubService,
      mainWindow,
      'session-token',
    );
  }, 40000);

  it('sanitizes gatewayToken for unified settings:get', async () => {
    const handler = handlers.get('app:request');
    expect(handler).toBeDefined();
    mockGetSetting.mockResolvedValueOnce('super-secret-token');

    const response = await handler?.({}, {
      id: 'req-1',
      module: 'settings',
      action: 'get',
      payload: { key: 'gatewayToken' },
    });

    expect(response).toEqual({
      id: 'req-1',
      ok: true,
      data: '',
    });
  });

  it('sanitizes gatewayToken for unified settings:getAll', async () => {
    const handler = handlers.get('app:request');
    expect(handler).toBeDefined();
    mockGetAllSettings.mockResolvedValueOnce({
      gatewayToken: 'super-secret-token',
      language: 'en',
    });

    const response = await handler?.({}, {
      id: 'req-2',
      module: 'settings',
      action: 'getAll',
    });

    expect(response).toEqual({
      id: 'req-2',
      ok: true,
      data: {
        gatewayToken: '',
        language: 'en',
      },
    });
  });

  it('blocks unified provider.getApiKey from returning raw secrets', async () => {
    const handler = handlers.get('app:request');
    expect(handler).toBeDefined();

    const response = await handler?.({}, {
      id: 'req-3',
      module: 'provider',
      action: 'getApiKey',
      payload: { providerId: 'openai' },
    });

    expect(mockProviderService.getLegacyProviderApiKey).not.toHaveBeenCalled();
    expect(response).toEqual({
      id: 'req-3',
      ok: false,
      error: {
        code: 'UNSUPPORTED',
        message: 'APP_REQUEST_UNSUPPORTED:provider.getApiKey',
      },
    });
  });

  it('rejects non-staged media paths for chat:sendWithMedia', async () => {
    const handler = handlers.get('chat:sendWithMedia');
    expect(handler).toBeDefined();
    const filePath = join(homedir(), 'not-staged.png');

    const response = await handler?.({}, {
      sessionKey: 'session-1',
      message: 'hello',
      idempotencyKey: 'idem-1',
      media: [
        {
          filePath,
          mimeType: 'image/png',
          fileName: 'not-staged.png',
        },
      ],
    });

    expect(gatewayManager.rpc).not.toHaveBeenCalled();
    expect(fsReadFileMock).not.toHaveBeenCalled();
    expect(response).toEqual({
      success: false,
      error: 'MEDIA_PATH_NOT_STAGED',
      filePath,
    });
  });
});
