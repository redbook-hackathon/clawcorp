import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('E2E / release smoke guardrails', () => {
  it('does not allow the e2e script to silently pass with zero tests', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['test:e2e']).toBeDefined();
    expect(packageJson.scripts?.['test:e2e']).not.toContain('--pass-with-no-tests');
    expect(packageJson.scripts?.['test:e2e:headed']).not.toContain('--pass-with-no-tests');
  });

  it('includes Playwright config and multiple real smoke specs', () => {
    expect(existsSync(resolve(process.cwd(), 'playwright.config.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'tests/e2e/app-smoke.spec.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'tests/e2e/routes-smoke.spec.ts'))).toBe(true);
  });

  it('keeps release packaging scripts aligned with preinstalled-skills bundling', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    expect(scripts['package:prepare']).toContain('bundle:openclaw');
    expect(scripts['package:prepare']).toContain('bundle:openclaw-plugins');
    expect(scripts['package:prepare']).toContain('bundle:preinstalled-skills');

    expect(scripts['package:mac:ci']).toContain('--publish never');
    expect(scripts['package:win:ci']).toContain('--publish never');
    expect(scripts['package:linux:ci']).toContain('--publish never');
    expect(scripts['smoke:linux']).toContain('package:linux:smoke');
  });

  it('includes Linux release/install smoke scripts', () => {
    expect(existsSync(resolve(process.cwd(), 'scripts/smoke/release-smoke.mjs'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'scripts/smoke/install-smoke-linux.mjs'))).toBe(true);
  });

  it('runs Playwright and Linux release/install smoke in the main CI workflow', () => {
    const checkWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/check.yml'), 'utf8');

    expect(checkWorkflow).toContain('playwright install');
    expect(checkWorkflow).toContain('pnpm run test:e2e');
    expect(checkWorkflow).toContain('pnpm run smoke:linux');
  });

  it('uses aligned CI packaging scripts in release workflows', () => {
    const releaseWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/release.yml'), 'utf8');
    const packageWinManualWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/package-win-manual.yml'), 'utf8');

    expect(releaseWorkflow).toContain('pnpm run package:mac:ci');
    expect(releaseWorkflow).toContain('pnpm run package:win:ci');
    expect(releaseWorkflow).toContain('pnpm run package:linux:ci');
    expect(releaseWorkflow).toContain('pnpm run smoke:release:linux');
    expect(releaseWorkflow).toContain('pnpm run smoke:install:linux');

    expect(packageWinManualWorkflow).toContain('pnpm run package:win:ci');
  });
});
