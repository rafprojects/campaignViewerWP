// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
// P49-C: i18n lint rule — flags raw JSX string literals that should use t().
// Set to 'off' globally until the string-migration sprint completes; flip to
// 'error' once all components use t() so regressions are caught at lint time.
import i18next from 'eslint-plugin-i18next'

export default tseslint.config({
  ignores: [
    'dist',
    'coverage',
    'node_modules',
    'wp-plugin/wp-super-gallery/admin/build/**',
    'wp-plugin/wp-super-gallery/assets',
    'wp-plugin/wp-super-gallery/vendor',
  ],
}, {
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
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
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
}, {
  files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/test-utils.{ts,tsx}'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'react-refresh/only-export-components': 'off',
  },
}, {
  files: ['**/contexts/**/*.{ts,tsx}'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, {
  files: ['**/*.{js,cjs,mjs}'],
  extends: [js.configs.recommended],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
}, {
  files: ['scripts/**/*.{js,cjs,mjs}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.node,
  },
}, storybook.configs["flat/recommended"], {
  // P49-C: i18n groundwork — rule is installed and wired up; currently off
  // to avoid CI failures on the ~300 existing unharvested string literals.
  // After the migration sprint, change to 'error' here to enforce going forward.
  files: ['src/**/*.{ts,tsx}'],
  plugins: { i18next },
  rules: {
    'i18next/no-literal-string': 'off',
  },
});