// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  patchFeishuPluginCompatibilitySource,
  patchWeChatPluginCompatibilitySource,
} from '../../electron/utils/wechat-plugin-compat';

describe('plugin compatibility shim output', () => {
  it('emits JS-safe normalizeAccountId shim for WeChat plugin sources', () => {
    const source = `import { normalizeAccountId } from "openclaw/plugin-sdk/account-id";\nconst id = normalizeAccountId(input);`;
    const patched = patchWeChatPluginCompatibilitySource(source);

    expect(patched).toContain('function normalizeAccountId(raw) {');
    expect(patched).not.toContain('raw: string');
    expect(patched).not.toContain('): string');
  });

  it('emits JS-safe normalizeAccountId shim for Feishu plugin sources', () => {
    const source = `import { DEFAULT_ACCOUNT_ID, normalizeAccountId, formatDocsLink } from 'openclaw/plugin-sdk';\nexport const noop = 1;`;
    const patched = patchFeishuPluginCompatibilitySource(source);

    expect(patched).toContain('function normalizeAccountId(raw) {');
    expect(patched).not.toContain('raw: string');
    expect(patched).not.toContain('): string');
  });

  it('repairs legacy typed shim signatures when marker already exists', () => {
    const legacy = `// ClawCorp compatibility shim for OpenClaw 2026.3.22
function normalizeAccountId(raw: string): string {
  return raw;
}`;
    const patched = patchFeishuPluginCompatibilitySource(legacy);

    expect(patched).toContain('function normalizeAccountId(raw) {');
    expect(patched).not.toContain('raw: string');
    expect(patched).not.toContain('): string');
  });
});
