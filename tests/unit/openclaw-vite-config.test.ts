import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('vite packaging config', () => {
  it('does not force React or markdown into separate vendor chunks that can cycle with the main vendor bundle', () => {
    const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    expect(viteConfig).not.toContain("return 'vendor-react'");
    expect(viteConfig).not.toContain("return 'vendor-markdown'");
  });

  it('uses externalized main-process dependencies during dev to avoid rebundling the whole Electron runtime graph', () => {
    const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    expect(viteConfig).toContain("function isMainProcessExternal");
    expect(viteConfig).toContain("command === 'serve'");
    expect(viteConfig).toContain('external: mainProcessExternal');
  });
});
