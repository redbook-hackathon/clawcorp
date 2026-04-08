import { defineConfig, defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const nodeTestInclude = [
  'tests/unit/agent-config.test.ts',
  'tests/unit/channel-config.test.ts',
  'tests/unit/comms-scripts.test.ts',
  'tests/unit/env-path.test.ts',
  'tests/unit/gateway-*.test.ts',
  'tests/unit/i18n-parity.test.ts',
  'tests/unit/mcp-*.test.ts',
  'tests/unit/session-*.test.ts',
  'tests/unit/openclaw-*.test.ts',
  'tests/unit/preinstalled-skills-script.test.ts',
  'tests/unit/ralph-codex-*.test.ts',
  'tests/unit/team-rollup-summary.test.ts',
  'tests/unit/task-runtime-linkage.test.ts',
  'tests/unit/task-store.test.ts',
  'tests/unit/token-usage*.test.ts',
  'tests/unit/uv-download-script.test.ts',
];

const sharedResolve = {
  alias: {
    '@': resolve(__dirname, 'src'),
    '@electron': resolve(__dirname, 'electron'),
  },
};

const sharedSetupFiles = ['./tests/setup.ts'];

export default defineConfig({
  plugins: [react()],
  resolve: sharedResolve,
  test: {
    globals: true,
    projects: [
      defineProject({
        extends: true,
        resolve: sharedResolve,
        test: {
          name: 'node',
          environment: 'node',
          include: nodeTestInclude,
          setupFiles: sharedSetupFiles,
        },
      }),
      defineProject({
        extends: true,
        resolve: sharedResolve,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
          exclude: nodeTestInclude,
          setupFiles: sharedSetupFiles,
        },
      }),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
});
