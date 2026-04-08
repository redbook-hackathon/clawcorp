import { describe, expect, it } from 'vitest';
import i18n, { SUPPORTED_LANGUAGES } from '@/i18n';

describe('i18n exposed languages', () => {
  it('only exposes zh/en in the supported language list', () => {
    const exposed = SUPPORTED_LANGUAGES.map((entry) => entry.code);
    expect(exposed).toEqual(['zh', 'en']);
  });

  it('registers zh/en in i18next supportedLngs', () => {
    const supported = Array.isArray(i18n.options.supportedLngs) ? i18n.options.supportedLngs : [];
    expect(supported).toEqual(expect.arrayContaining(['zh', 'en']));
    expect(supported).not.toContain('ja');
  });
});
