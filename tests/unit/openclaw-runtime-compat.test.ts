// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function parseOpenClawDateVersion(value: string): number[] {
  const match = value.match(/^(\d{4})\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unexpected OpenClaw version format: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareDateVersions(left: string, right: string): number {
  const leftParts = parseOpenClawDateVersion(left);
  const rightParts = parseOpenClawDateVersion(right);
  for (let i = 0; i < leftParts.length; i += 1) {
    const diff = leftParts[i] - rightParts[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

describe('OpenClaw runtime compatibility', () => {
  it('keeps the bundled openclaw host compatible with the installed wechat plugin minimum host version', () => {
    const root = process.cwd();
    const appPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>;
    };
    const wechatPkg = JSON.parse(readFileSync(join(root, 'node_modules', '@tencent-weixin', 'openclaw-weixin', 'package.json'), 'utf8')) as {
      openclaw?: { install?: { minHostVersion?: string } };
    };

    const hostVersion = appPkg.devDependencies?.openclaw;
    const minHostVersion = wechatPkg.openclaw?.install?.minHostVersion?.replace(/^>=/, '');

    expect(hostVersion).toBeTruthy();
    expect(minHostVersion).toBeTruthy();
    expect(compareDateVersions(hostVersion!, minHostVersion!)).toBeGreaterThanOrEqual(0);
  });
});
