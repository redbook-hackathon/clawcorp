import { join } from 'node:path';

export const WINDOWS_APP_USER_MODEL_ID = 'app.clawcorp.desktop';
export const WINDOWS_DEV_APP_USER_MODEL_ID = 'app.clawcorp.desktop.dev';
export const PACKAGED_LOCK_NAME = 'clawcorp';
export const DEV_LOCK_NAME = 'clawcorp-dev';

export interface AppInstanceScope {
  lockName: string;
  useElectronSingleInstanceLock: boolean;
  forceCleanProcessLock: boolean;
  userDataDir?: string;
  windowsAppUserModelId: string;
}

export function resolveAppInstanceScope(params: {
  isPackaged: boolean;
  appDataDir: string;
}): AppInstanceScope {
  if (params.isPackaged) {
    return {
      lockName: PACKAGED_LOCK_NAME,
      useElectronSingleInstanceLock: true,
      forceCleanProcessLock: true,
      windowsAppUserModelId: WINDOWS_APP_USER_MODEL_ID,
    };
  }

  return {
    lockName: DEV_LOCK_NAME,
    useElectronSingleInstanceLock: false,
    forceCleanProcessLock: false,
    userDataDir: join(params.appDataDir, 'ClawCorp-dev'),
    windowsAppUserModelId: WINDOWS_DEV_APP_USER_MODEL_ID,
  };
}

export function configureAppInstanceScope(app: Pick<Electron.App, 'isPackaged' | 'getPath' | 'setPath'>): AppInstanceScope {
  const scope = resolveAppInstanceScope({
    isPackaged: app.isPackaged,
    appDataDir: app.getPath('appData'),
  });

  if (scope.userDataDir) {
    app.setPath('userData', scope.userDataDir);
  }

  return scope;
}
