import { app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function getFeishuPluginSourceDir(): string {
  const candidates = app.isPackaged
    ? [
      join(process.resourcesPath, 'openclaw-plugins', 'feishu-openclaw-plugin'),
      join(process.resourcesPath, 'app.asar.unpacked', 'build', 'openclaw-plugins', 'feishu-openclaw-plugin'),
      join(process.resourcesPath, 'app.asar.unpacked', 'openclaw-plugins', 'feishu-openclaw-plugin'),
    ]
    : [
      join(process.cwd(), 'build', 'openclaw-plugins', 'feishu-openclaw-plugin'),
      join(typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd(), 'build', 'openclaw-plugins', 'feishu-openclaw-plugin'),
      join(process.cwd(), 'node_modules', '@larksuite', 'openclaw-lark'),
    ];

  const matched = candidates.find((candidate) => existsSync(join(candidate, 'index.js')));
  if (!matched) {
    throw new Error('Feishu plugin source not found');
  }
  return matched;
}

async function importFeishuModule<T = unknown>(sourceDir: string, relativePath: string): Promise<T> {
  return await import(pathToFileURL(join(sourceDir, relativePath)).href) as T;
}

export async function loadFeishuAuthRuntime() {
  const sourceDir = getFeishuPluginSourceDir();
  const accounts = await importFeishuModule<{
    getLarkAccount: (cfg: Record<string, unknown>, accountId?: string) => {
      configured: boolean;
      appId?: string;
      appSecret?: string;
      brand?: string;
      accountId: string;
    };
  }>(sourceDir, 'src/core/accounts.js');
  const larkClient = await importFeishuModule<{
    LarkClient: {
      fromAccount: (account: unknown) => { sdk: unknown };
    };
  }>(sourceDir, 'src/core/lark-client.js');
  const scopeChecker = await importFeishuModule<{
    getAppGrantedScopes: (sdk: unknown, appId: string, tokenType?: string) => Promise<string[]>;
  }>(sourceDir, 'src/core/app-scope-checker.js');
  const toolScopes = await importFeishuModule<{
    REQUIRED_APP_SCOPES: string[];
    filterSensitiveScopes: (scopes: string[]) => string[];
  }>(sourceDir, 'src/core/tool-scopes.js');
  const deviceFlow = await importFeishuModule<{
    requestDeviceAuthorization: (params: { appId: string; appSecret: string; brand?: string; scope?: string }) => Promise<{
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      verificationUriComplete: string;
      expiresIn: number;
      interval: number;
    }>;
    pollDeviceToken: (params: {
      appId: string;
      appSecret: string;
      brand?: string;
      deviceCode: string;
      interval: number;
      expiresIn: number;
      signal?: AbortSignal;
    }) => Promise<
      | {
        ok: true;
        token: {
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
          refreshExpiresIn: number;
          scope: string;
        };
      }
      | {
        ok: false;
        error: string;
        message: string;
      }
    >;
  }>(sourceDir, 'src/core/device-flow.js');
  const tokenStore = await importFeishuModule<{
    setStoredToken: (token: {
      userOpenId: string;
      appId: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      refreshExpiresAt: number;
      scope: string;
      grantedAt: number;
    }) => Promise<void>;
  }>(sourceDir, 'src/core/token-store.js');

  return {
    getLarkAccount: accounts.getLarkAccount,
    createSdk: (account: unknown) => larkClient.LarkClient.fromAccount(account).sdk,
    getAppGrantedScopes: scopeChecker.getAppGrantedScopes,
    requestDeviceAuthorization: deviceFlow.requestDeviceAuthorization,
    pollDeviceToken: deviceFlow.pollDeviceToken,
    setStoredToken: tokenStore.setStoredToken,
    requiredAppScopes: toolScopes.REQUIRED_APP_SCOPES,
    filterSensitiveScopes: toolScopes.filterSensitiveScopes,
  };
}
