import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const WINDOWS_DEV_CACHE_DIR_NAMES = [
  'Cache',
  'GPUCache',
  'Code Cache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
];

export function applyWindowsStartupSwitches(app: {
  commandLine?: { appendSwitch: (name: string, value?: string) => void };
  platform?: NodeJS.Platform;
}): void {
  if (app.platform !== 'win32' || !app.commandLine) {
    return;
  }

  app.commandLine.appendSwitch('disable-direct-composition');
  app.commandLine.appendSwitch('disable-direct-composition-video-overlays');
}

export function clearDevChromiumCaches(options: {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  userDataDir: string;
}): string[] {
  if (options.isPackaged || options.platform !== 'win32') {
    return [];
  }

  const removed: string[] = [];

  for (const dirName of WINDOWS_DEV_CACHE_DIR_NAMES) {
    const fullPath = join(options.userDataDir, dirName);
    if (!existsSync(fullPath)) {
      continue;
    }
    try {
      rmSync(fullPath, { recursive: true, force: true });
      removed.push(dirName);
    } catch {
      // Cache dir may be locked by a lingering Electron process — skip it.
    }
  }

  return removed;
}
