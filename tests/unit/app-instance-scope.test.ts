// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  configureAppInstanceScope,
  DEV_LOCK_NAME,
  PACKAGED_LOCK_NAME,
  WINDOWS_APP_USER_MODEL_ID,
  WINDOWS_DEV_APP_USER_MODEL_ID,
} from '@electron/main/app-instance-scope';

describe('app instance scope', () => {
  it('keeps packaged builds on the stable single-instance scope', () => {
    const setPath = vi.fn();
    const scope = configureAppInstanceScope({
      isPackaged: true,
      getPath: vi.fn(() => 'C:/Users/test/AppData/Roaming'),
      setPath,
    });

    expect(scope.lockName).toBe(PACKAGED_LOCK_NAME);
    expect(scope.useElectronSingleInstanceLock).toBe(true);
    expect(scope.windowsAppUserModelId).toBe(WINDOWS_APP_USER_MODEL_ID);
    expect(scope.forceCleanProcessLock).toBe(true);
    expect(setPath).not.toHaveBeenCalled();
  });

  it('isolates development builds into a separate userData directory and lock scope', () => {
    const setPath = vi.fn();
    const scope = configureAppInstanceScope({
      isPackaged: false,
      getPath: vi.fn(() => 'C:/Users/test/AppData/Roaming'),
      setPath,
    });
    const expected = 'C:\\Users\\test\\AppData\\Roaming\\ClawCorp-dev';

    expect(scope.lockName).toBe(DEV_LOCK_NAME);
    expect(scope.useElectronSingleInstanceLock).toBe(false);
    expect(scope.userDataDir).toBe(expected);
    expect(scope.windowsAppUserModelId).toBe(WINDOWS_DEV_APP_USER_MODEL_ID);
    expect(scope.forceCleanProcessLock).toBe(false);
    expect(setPath).toHaveBeenCalledWith('userData', expected);
  });
});
