import { describe, expect, it } from 'vitest';

import { getBundleRootPackages } from '../../scripts/bundle-openclaw-lib.mjs';

describe('bundle openclaw script', () => {
  it('includes explicit runtime packages that ClawCorp resolves from the OpenClaw context', () => {
    expect(getBundleRootPackages()).toEqual(
      expect.arrayContaining([
        'openclaw',
        '@whiskeysockets/baileys',
      ]),
    );
  });
});
