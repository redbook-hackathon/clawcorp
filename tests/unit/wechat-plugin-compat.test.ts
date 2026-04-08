// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  patchFeishuPluginCompatibilitySource,
  patchWeChatPluginCompatibilitySource,
} from '@electron/utils/wechat-plugin-compat';

describe('wechat plugin compatibility shim', () => {
  it('replaces normalizeAccountId sdk import with local shim', () => {
    const source = [
      'import type { OpenClawConfig } from "openclaw/plugin-sdk/core";',
      'import { normalizeAccountId } from "openclaw/plugin-sdk/account-id";',
      'const normalized = normalizeAccountId(accountId);',
    ].join('\n');

    const patched = patchWeChatPluginCompatibilitySource(source);

    expect(patched).toContain('ClawCorp compatibility shim');
    expect(patched).not.toContain('openclaw/plugin-sdk/account-id');
    expect(patched).toContain('const normalized = normalizeAccountId(accountId);');
  });

  it('rewrites feishu runtime dynamic import to a static import compatible with Windows file URLs', () => {
    const source = [
      'import { FEISHU_CONFIG_JSON_SCHEMA } from \'../core/config-schema.js\';',
      'const pluginLog = larkLogger(\'channel/plugin\');',
      'async function startAccount() {',
      '  const { monitorFeishuProvider } = await import(\'./monitor.js\');',
      '  return monitorFeishuProvider({});',
      '}',
    ].join('\n');

    const patched = patchFeishuPluginCompatibilitySource(source);

    expect(patched).toContain("import { monitorFeishuProvider } from './monitor.js';");
    expect(patched).not.toContain("await import('./monitor.js')");
    expect(patched).toContain('return monitorFeishuProvider({});');
  });

  it('rewrites feishu plugin-sdk named imports to namespace fallbacks', () => {
    const source = [
      "import { DEFAULT_ACCOUNT_ID, PAIRING_APPROVED_MESSAGE } from 'openclaw/plugin-sdk';",
      'const accountId = DEFAULT_ACCOUNT_ID;',
      'const text = PAIRING_APPROVED_MESSAGE;',
    ].join('\n');

    const patched = patchFeishuPluginCompatibilitySource(source);

    expect(patched).toContain("import * as pluginSdk from 'openclaw/plugin-sdk';");
    expect(patched).not.toContain("import { DEFAULT_ACCOUNT_ID, PAIRING_APPROVED_MESSAGE } from 'openclaw/plugin-sdk';");
    expect(patched).toContain("const DEFAULT_ACCOUNT_ID = typeof pluginSdk.DEFAULT_ACCOUNT_ID === 'string'");
    expect(patched).toContain("const PAIRING_APPROVED_MESSAGE = typeof pluginSdk.PAIRING_APPROVED_MESSAGE === 'string'");
    expect(patched).toContain('const accountId = DEFAULT_ACCOUNT_ID;');
    expect(patched).toContain('const text = PAIRING_APPROVED_MESSAGE;');
  });

  it('rewrites feishu onboarding helpers to local fallbacks', () => {
    const source = [
      "import { DEFAULT_ACCOUNT_ID, formatDocsLink } from 'openclaw/plugin-sdk';",
      "const docs = formatDocsLink('/channels/feishu', 'feishu');",
      'return DEFAULT_ACCOUNT_ID;',
    ].join('\n');

    const patched = patchFeishuPluginCompatibilitySource(source);

    expect(patched).toContain("import * as pluginSdk from 'openclaw/plugin-sdk';");
    expect(patched).toContain("const formatDocsLink = typeof pluginSdk.formatDocsLink === 'function'");
    expect(patched).toContain("const DEFAULT_ACCOUNT_ID = typeof pluginSdk.DEFAULT_ACCOUNT_ID === 'string'");
    expect(patched).toContain("const docs = formatDocsLink('/channels/feishu', 'feishu');");
    expect(patched).toContain('return DEFAULT_ACCOUNT_ID;');
  });
});
