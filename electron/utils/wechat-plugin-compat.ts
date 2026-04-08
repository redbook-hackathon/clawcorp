import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NORMALIZE_IMPORT = 'import { normalizeAccountId } from "openclaw/plugin-sdk/account-id";';
const SHIM_MARKER = '// ClawCorp compatibility shim for OpenClaw 2026.3.22';
const NORMALIZE_SHIM = `${SHIM_MARKER}
function normalizeAccountId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const normalized = trimmed
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "");
  return normalized || "default";
}`;

export function patchWeChatPluginCompatibilitySource(source: string): string {
  if (!source.includes(NORMALIZE_IMPORT)) {
    return source;
  }
  if (source.includes(SHIM_MARKER)) {
    return source;
  }
  return source.replace(NORMALIZE_IMPORT, NORMALIZE_SHIM);
}

export function patchInstalledWeChatPluginCompatibility(pluginRoot: string): boolean {
  const candidateFiles = [
    join(pluginRoot, 'src', 'channel.ts'),
    join(pluginRoot, 'src', 'channel.js'),
  ];

  let patched = false;
  for (const filePath of candidateFiles) {
    if (!existsSync(filePath)) continue;
    const original = readFileSync(filePath, 'utf8');
    const next = patchWeChatPluginCompatibilitySource(original);
    if (next !== original) {
      writeFileSync(filePath, next, 'utf8');
      patched = true;
    }
  }

  return patched;
}

const FEISHU_PLUGIN_SDK_NAMESPACE_IMPORT = "import * as pluginSdk from 'openclaw/plugin-sdk';";
const FEISHU_PLUGIN_SDK_IMPORT_RE = /import\s*\{\s*([^}]+?)\s*\}\s*from\s*['"]openclaw\/plugin-sdk['"];?/;
const FEISHU_PLUGIN_IMPORT_JS = "import { FEISHU_CONFIG_JSON_SCHEMA } from '../core/config-schema.js';";
const FEISHU_PLUGIN_IMPORT_TS = "import { FEISHU_CONFIG_JSON_SCHEMA } from '../core/config-schema';";
const FEISHU_MONITOR_STATIC_IMPORT_JS = "import { monitorFeishuProvider } from './monitor.js';";
const FEISHU_MONITOR_STATIC_IMPORT_TS = "import { monitorFeishuProvider } from './monitor';";
const FEISHU_MONITOR_DYNAMIC_IMPORT_JS = "const { monitorFeishuProvider } = await import('./monitor.js');";
const FEISHU_MONITOR_DYNAMIC_IMPORT_TS = "const { monitorFeishuProvider } = await import('./monitor');";

function getImportedLocalName(specifier: string): string {
  const trimmed = specifier.trim().replace(/^type\s+/, '');
  const aliasIndex = trimmed.indexOf(' as ');
  return aliasIndex >= 0 ? trimmed.slice(aliasIndex + 4).trim() : trimmed;
}

function buildFeishuSdkCompatibilityShim(specifiersRaw: string): string {
  const specifiers = specifiersRaw.split(',').map((part) => part.trim()).filter(Boolean);
  const importedLocalNames = new Set(specifiers.map(getImportedLocalName));
  const passthroughSpecifiers = specifiers.filter((specifier) => {
    const localName = getImportedLocalName(specifier);
    return !['DEFAULT_ACCOUNT_ID', 'normalizeAccountId', 'PAIRING_APPROVED_MESSAGE', 'formatDocsLink'].includes(localName);
  });

  const parts = [`${SHIM_MARKER}`, FEISHU_PLUGIN_SDK_NAMESPACE_IMPORT];
  if (passthroughSpecifiers.length > 0) {
    parts.push(`import { ${passthroughSpecifiers.join(', ')} } from 'openclaw/plugin-sdk';`);
  }

  if (importedLocalNames.has('DEFAULT_ACCOUNT_ID')) {
    parts.push(`const DEFAULT_ACCOUNT_ID = typeof pluginSdk.DEFAULT_ACCOUNT_ID === 'string'
    ? pluginSdk.DEFAULT_ACCOUNT_ID
    : 'default';`);
  }

  if (importedLocalNames.has('normalizeAccountId')) {
    parts.push(`function normalizeAccountId(raw: string): string {
  if (typeof pluginSdk.normalizeAccountId === 'function') {
    return pluginSdk.normalizeAccountId(raw);
  }
  const trimmed = String(raw ?? '').trim().toLowerCase();
  const normalized = trimmed
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
  return normalized || DEFAULT_ACCOUNT_ID;
}`);
  }

  if (importedLocalNames.has('PAIRING_APPROVED_MESSAGE')) {
    parts.push(`const PAIRING_APPROVED_MESSAGE = typeof pluginSdk.PAIRING_APPROVED_MESSAGE === 'string'
    ? pluginSdk.PAIRING_APPROVED_MESSAGE
    : 'Pairing approved.';`);
  }

  if (importedLocalNames.has('formatDocsLink')) {
    parts.push(`const formatDocsLink = typeof pluginSdk.formatDocsLink === 'function'
    ? pluginSdk.formatDocsLink
    : ((path, label) => \`\${label}: \${path}\`);`);
  }

  return parts.join('\n');
}

export function patchFeishuPluginCompatibilitySource(source: string): string {
  let next = source;

  if (!next.includes(SHIM_MARKER) && !next.includes(FEISHU_PLUGIN_SDK_NAMESPACE_IMPORT)) {
    const importMatch = next.match(FEISHU_PLUGIN_SDK_IMPORT_RE);
    if (importMatch) {
      next = next.replace(importMatch[0], buildFeishuSdkCompatibilityShim(importMatch[1]));
    }
  }

  if (next.includes(FEISHU_MONITOR_DYNAMIC_IMPORT_JS) && !next.includes(FEISHU_MONITOR_STATIC_IMPORT_JS)) {
    next = next.replace(
      FEISHU_PLUGIN_IMPORT_JS,
      `${FEISHU_PLUGIN_IMPORT_JS}\n${FEISHU_MONITOR_STATIC_IMPORT_JS}`,
    );
    next = next.replace(FEISHU_MONITOR_DYNAMIC_IMPORT_JS, '');
  }

  if (next.includes(FEISHU_MONITOR_DYNAMIC_IMPORT_TS) && !next.includes(FEISHU_MONITOR_STATIC_IMPORT_TS)) {
    next = next.replace(
      FEISHU_PLUGIN_IMPORT_TS,
      `${FEISHU_PLUGIN_IMPORT_TS}\n${FEISHU_MONITOR_STATIC_IMPORT_TS}`,
    );
    next = next.replace(FEISHU_MONITOR_DYNAMIC_IMPORT_TS, '');
  }

  return next;
}

export function patchInstalledFeishuPluginCompatibility(pluginRoot: string): boolean {
  const candidateFiles = [
    join(pluginRoot, 'src', 'core', 'accounts.js'),
    join(pluginRoot, 'src', 'core', 'accounts.ts'),
    join(pluginRoot, 'src', 'channel', 'config-adapter.js'),
    join(pluginRoot, 'src', 'channel', 'config-adapter.ts'),
    join(pluginRoot, 'src', 'channel', 'plugin.js'),
    join(pluginRoot, 'src', 'channel', 'plugin.ts'),
    join(pluginRoot, 'src', 'channel', 'onboarding.js'),
    join(pluginRoot, 'src', 'channel', 'onboarding.ts'),
  ];

  let patched = false;
  for (const filePath of candidateFiles) {
    if (!existsSync(filePath)) continue;
    const original = readFileSync(filePath, 'utf8');
    const next = patchFeishuPluginCompatibilitySource(original);
    if (next !== original) {
      writeFileSync(filePath, next, 'utf8');
      patched = true;
    }
  }

  return patched;
}
