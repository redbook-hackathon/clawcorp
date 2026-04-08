import { describe, expect, it } from 'vitest';
import { collectLocaleParityProblems } from '../../scripts/i18n/check-parity.mjs';

describe('locale parity', () => {
  it('keeps all locale namespaces and keys aligned with zh', () => {
    const report = collectLocaleParityProblems();
    expect(report.problems).toEqual([]);
  });
});
