import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('openclaw-weixin inbound session routing', () => {
  it('forces per-account-channel-peer dmScope when resolving inbound routes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'build/openclaw-plugins/openclaw-weixin/src/messaging/process-message.ts'),
      'utf-8',
    );

    expect(source).toContain('dmScope: "per-account-channel-peer"');
  });
});
