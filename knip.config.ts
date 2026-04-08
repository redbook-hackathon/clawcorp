import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'tests/setup.ts',
    'tests/unit/settings-center.test.tsx',
    'tests/unit/workbench-empty-state.test.tsx',
    'tests/unit/activity-page.test.tsx',
    'src/pages/Settings/index.tsx',
    'src/pages/Activity/index.tsx',
    'src/components/workbench/workbench-empty-state.tsx',
  ],
  project: [
    'tests/setup.ts',
    'tests/unit/settings-center.test.tsx',
    'tests/unit/workbench-empty-state.test.tsx',
    'tests/unit/activity-page.test.tsx',
    'src/pages/Settings/index.tsx',
    'src/pages/Activity/index.tsx',
    'src/components/workbench/workbench-empty-state.tsx',
  ],
};

export default config;
