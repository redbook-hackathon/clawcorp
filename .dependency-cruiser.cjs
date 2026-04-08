/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      comment: 'Prevent cyclic dependencies in the focused a11y-governance slice.',
      from: {
        path: '^(src/pages/Activity/|src/pages/Settings/|src/components/workbench/)',
      },
      to: {
        circular: true,
      },
    },
    {
      name: 'renderer-must-not-import-electron-main',
      severity: 'error',
      comment: 'Renderer code must call host-api/api-client instead of importing electron main code.',
      from: {
        path: '^src/',
      },
      to: {
        path: '^electron/',
      },
    },
    {
      name: 'electron-main-must-not-import-renderer',
      severity: 'error',
      comment: 'Main process code should stay isolated from renderer internals.',
      from: {
        path: '^electron/',
      },
      to: {
        path: '^src/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: '(^|/)(build|continue|dist|dist-electron|docs|openclaw|reference|release|resources|runtime|test-results)(/|$)',
    includeOnly: '^(src|electron|shared)/',
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
  },
};
