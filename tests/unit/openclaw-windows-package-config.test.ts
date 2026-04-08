import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('windows packaging config', () => {
  it('disables executable sign/edit work for unsigned Windows builds', () => {
    const builderConfig = readFileSync(resolve(process.cwd(), 'electron-builder.yml'), 'utf8');

    expect(builderConfig).toContain('verifyUpdateCodeSignature: false');
    expect(builderConfig).toContain('signAndEditExecutable: false');
  });
});
