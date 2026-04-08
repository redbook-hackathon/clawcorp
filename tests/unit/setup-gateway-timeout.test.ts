import { describe, expect, it } from 'vitest';
import { SETUP_GATEWAY_CHECK_TIMEOUT_MS } from '@/pages/Setup';

describe('setup gateway timeout budget', () => {
  it('keeps setup runtime gateway check timeout bounded', () => {
    expect(SETUP_GATEWAY_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(180_000);
  });
});
