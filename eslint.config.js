import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'artifacts', 'test-results', 'playwright-report'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'playwright.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/visual/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: [
      'src/services/real/**/*.{ts,tsx}',
      'src/pages/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/mocks/*', '**/mocks/*'],
          message: 'Real adapters, pages, and features must not depend on mock fixtures.',
        }],
      }],
    },
  },
)
