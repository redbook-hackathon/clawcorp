// @vitest-environment node

import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExistsSync,
  mockGetAppPath,
  mockGetPath,
  mockGetVersion,
  mockApp,
} = vi.hoisted(() => {
  const getAppPath = vi.fn();
  const getPath = vi.fn();
  const getVersion = vi.fn();
  const app = {
    isPackaged: false,
    getAppPath,
    getPath,
    getVersion,
  };

  return {
    mockExistsSync: vi.fn(),
    mockGetAppPath: getAppPath,
    mockGetPath: getPath,
    mockGetVersion: getVersion,
    mockApp: app,
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: mockExistsSync,
    default: {
      ...actual,
      existsSync: mockExistsSync,
    },
  };
});

vi.mock('electron', () => ({
  app: mockApp,
}));

async function importPathsModule() {
  return await import('@electron/utils/paths');
}

describe('OpenClaw path resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockApp.isPackaged = false;
    mockGetAppPath.mockReturnValue('D:/runtime/app');
    mockGetPath.mockReturnValue('C:/Users/test/AppData/Roaming/ClawCorp-dev');
    mockGetVersion.mockReturnValue('0.0.0-test');
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers app.getAppPath() node_modules in dev when that package exists', async () => {
    const preferredDir = join('D:/runtime/app', 'node_modules', 'openclaw');
    const preferredPkg = join(preferredDir, 'package.json');
    mockExistsSync.mockImplementation((target) => target === preferredPkg);

    const { getOpenClawDir } = await importPathsModule();

    expect(getOpenClawDir()).toBe(preferredDir);
  });

  it('falls back to process.cwd() node_modules in dev when app.getAppPath() package is missing', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('E:/workspace');
    const fallbackDir = join('E:/workspace', 'node_modules', 'openclaw');
    const fallbackPkg = join(fallbackDir, 'package.json');
    mockExistsSync.mockImplementation((target) => target === fallbackPkg);

    const { getOpenClawDir, getOpenClawEntryPath } = await importPathsModule();

    expect(getOpenClawDir()).toBe(fallbackDir);
    expect(getOpenClawEntryPath()).toBe(join(fallbackDir, 'openclaw.mjs'));

    cwdSpy.mockRestore();
  });
});
