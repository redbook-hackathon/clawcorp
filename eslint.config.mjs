import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

const jsxA11yRecommendedRules =
  jsxA11y.flatConfigs?.recommended?.rules ?? jsxA11y.configs.recommended.rules;

export default [
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'openclaw/**',
      'release/**',
      'build/**',
      '.superpowers/**',
      'continue/auto-coding-agent-demo-main/**',
      'reference/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // TypeScript handles these checks natively, disable ESLint duplicates
      'no-undef': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: [
      'src/pages/Activity/index.tsx',
      'src/pages/Cron/index.tsx',
      'src/pages/Settings/index.tsx',
      'src/components/workbench/workbench-empty-state.tsx',
    ],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...jsxA11yRecommendedRules,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='invoke'][callee.object.type='MemberExpression'][callee.object.property.name='ipcRenderer'][callee.object.object.type='MemberExpression'][callee.object.object.property.name='electron'][callee.object.object.object.name='window']",
          message: 'Use invokeIpc from @/lib/api-client instead of window.electron.ipcRenderer.invoke.',
        },
        {
          selector: "CallExpression[callee.name='fetch'] Literal[value=/^https?:\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?\\//]",
          message: 'Do not call local endpoints directly from renderer. Route through host-api/api-client proxies.',
        },
      ],
    },
  },
  {
    files: ['src/lib/api-client.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
