import { existsSync } from 'node:fs';
import { app } from 'electron';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { patchInstalledWeChatPluginCompatibility } from './wechat-plugin-compat';

const EXTENSION_ROOT = join(homedir(), '.openclaw', 'extensions');
const WECHAT_PLUGIN_DIR_CANDIDATES = ['openclaw-weixin', 'wechat'];
const WECHAT_PLUGIN_ENTRY_CANDIDATES = ['index.js', 'index.ts'];

function buildRootCandidates(): string[] {
  const roots: string[] = [];

  if (!app.isPackaged) {
    roots.push(
      join(app.getAppPath(), 'build', 'openclaw-plugins', 'openclaw-weixin'),
      join(app.getAppPath(), 'build', 'openclaw-plugins', 'wechat'),
      join(process.cwd(), 'build', 'openclaw-plugins', 'openclaw-weixin'),
      join(process.cwd(), 'build', 'openclaw-plugins', 'wechat'),
      join(process.cwd(), 'node_modules', '@tencent-weixin', 'openclaw-weixin'),
    );
  }

  roots.push(...WECHAT_PLUGIN_DIR_CANDIDATES.map((dirName) => join(EXTENSION_ROOT, dirName)));

  return roots;
}

export function resolveWeChatPluginImportPath(relativePath: string): string {
  const requested = relativePath.trim();
  const relativeCandidates = requested === 'index.js'
    ? WECHAT_PLUGIN_ENTRY_CANDIDATES
    : [requested];

  for (const root of buildRootCandidates()) {
    for (const candidate of relativeCandidates) {
      const fullPath = join(root, candidate);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return join(EXTENSION_ROOT, 'openclaw-weixin', requested);
}

export async function importWeChatPluginModule(relativePath: string): Promise<Record<string, unknown>> {
  const fullPath = resolveWeChatPluginImportPath(relativePath);
  const pluginRoot = join(fullPath, '..', '..');
  try {
    patchInstalledWeChatPluginCompatibility(pluginRoot);
  } catch {
    // best-effort
  }
  return import(pathToFileURL(fullPath).href) as Promise<Record<string, unknown>>;
}
