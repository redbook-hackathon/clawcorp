import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type MiniMaxRegion = 'global' | 'cn';

export interface OAuthProgress {
  update: (message: string) => void;
  stop: (message?: string) => void;
}

export interface MiniMaxOAuthToken {
  access: string;
  refresh: string;
  expires: number;
  resourceUrl?: string;
  notification_message?: string;
}

export interface QwenOAuthToken {
  access: string;
  refresh: string;
  expires: number;
  resourceUrl?: string;
}

type OpenUrlHandler = (url: string) => Promise<void>;
type NoteHandler = (message: string, title?: string) => Promise<void>;

export interface MiniMaxPortalOAuthModule {
  loginMiniMaxPortalOAuth: (params: {
    region?: MiniMaxRegion;
    openUrl: OpenUrlHandler;
    note: NoteHandler;
    progress: OAuthProgress;
  }) => Promise<MiniMaxOAuthToken>;
}

export interface QwenPortalOAuthModule {
  loginQwenPortalOAuth: (params: {
    openUrl: OpenUrlHandler;
    note: NoteHandler;
    progress: OAuthProgress;
  }) => Promise<QwenOAuthToken>;
}

type OAuthRuntimeExportName = keyof MiniMaxPortalOAuthModule | keyof QwenPortalOAuthModule;

const runtimeCache = new Map<string, Promise<unknown>>();

function listOauthRuntimeFiles(openClawDir: string): string[] {
  const distDir = join(openClawDir, 'dist');
  if (!existsSync(distDir)) {
    throw new Error(`OpenClaw dist directory not found: ${distDir}`);
  }

  const runtimeFiles = readdirSync(distDir)
    .filter((name) => /^oauth\.runtime-.*\.js$/.test(name))
    .sort()
    .map((name) => join(distDir, name));

  if (runtimeFiles.length === 0) {
    throw new Error(`No OpenClaw OAuth runtime bundles found under ${distDir}`);
  }

  return runtimeFiles;
}

function resolveRuntimeFile(openClawDir: string, exportName: OAuthRuntimeExportName): string {
  const runtimeFiles = listOauthRuntimeFiles(openClawDir);

  for (const file of runtimeFiles) {
    const content = readFileSync(file, 'utf8');
    if (content.includes(`export { ${exportName} };`) || content.includes(`function ${exportName}(`)) {
      return file;
    }
  }

  throw new Error(`OpenClaw OAuth runtime export "${exportName}" not found under ${join(openClawDir, 'dist')}`);
}

async function loadRuntimeModule<T>(openClawDir: string, exportName: OAuthRuntimeExportName): Promise<T> {
  const cacheKey = `${openClawDir}:${exportName}`;
  const cached = runtimeCache.get(cacheKey);
  if (cached) {
    return cached as Promise<T>;
  }

  const pending = (async () => {
    const file = resolveRuntimeFile(openClawDir, exportName);
    const moduleUrl = pathToFileURL(file).href;
    const runtimeModule = await import(moduleUrl) as Record<string, unknown>;
    if (typeof runtimeModule[exportName] === 'function') {
      return runtimeModule as T;
    }

    throw new Error(`OpenClaw OAuth runtime export "${exportName}" was not callable in ${file}`);
  })();

  runtimeCache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    runtimeCache.delete(cacheKey);
    throw error;
  }
}

export async function loadMiniMaxPortalOAuthModule(openClawDir: string): Promise<MiniMaxPortalOAuthModule> {
  return await loadRuntimeModule<MiniMaxPortalOAuthModule>(openClawDir, 'loginMiniMaxPortalOAuth');
}

export async function loadQwenPortalOAuthModule(openClawDir: string): Promise<QwenPortalOAuthModule> {
  return await loadRuntimeModule<QwenPortalOAuthModule>(openClawDir, 'loginQwenPortalOAuth');
}
