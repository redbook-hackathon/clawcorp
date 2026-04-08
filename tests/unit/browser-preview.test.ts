import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureBrowserPreviewElectronShim, isBrowserPreviewMode } from '@/lib/browser-preview';

describe('browser preview shim', () => {
  const originalElectron = window.electron;

  beforeEach(() => {
    window.electron = undefined as never;
  });

  afterEach(() => {
    window.electron = originalElectron;
  });

  it('installs a safe shim when electron is unavailable', async () => {
    expect(window.electron).toBeUndefined();
    expect(isBrowserPreviewMode()).toBe(false);

    ensureBrowserPreviewElectronShim();

    expect(window.electron).toBeDefined();
    expect(isBrowserPreviewMode()).toBe(true);
    await expect(window.electron.ipcRenderer.invoke('app:request', {})).resolves.toBeUndefined();
    expect(typeof window.electron.ipcRenderer.on('navigate', () => undefined)).toBe('function');
  });
});
