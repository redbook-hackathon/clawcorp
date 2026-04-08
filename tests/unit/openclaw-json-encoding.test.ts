// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const JSON_FILES = [
  'package.json',
  'src/i18n/locales/en/common.json',
  'src/i18n/locales/zh/common.json',
] as const;

function hasUtf8Bom(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

describe('json encoding guardrails', () => {
  it('keeps critical JSON files free of UTF-8 BOM bytes', () => {
    for (const relativePath of JSON_FILES) {
      const fullPath = resolve(process.cwd(), relativePath);
      const buffer = readFileSync(fullPath);
      expect(hasUtf8Bom(buffer), `${relativePath} should not start with a UTF-8 BOM`).toBe(false);
      expect(() => JSON.parse(buffer.toString('utf8')), `${relativePath} should parse as JSON`).not.toThrow();
    }
  });
});
