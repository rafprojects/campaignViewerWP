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
    // Nested package build output (e.g. packages/shared-utils/dist) — built
    // artifacts, never linted (mirrors the gitignored `dist/`).
    '**/dist',
    // Editor/agent tooling + transient git worktrees — not project source.
    '.claude',
    'coverage',
    'node_modules',
    'wp-plugin/wp-super-gallery/admin/build/**',
    'wp-plugin/wp-super-gallery/assets',
    'wp-plugin/wp-super-gallery/vendor',
    'storybook-static',
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
  // P49-C / P54-B: i18n rule — globally off for src/ (admin panel strings deferred).
  files: ['src/**/*.{ts,tsx}'],
  plugins: { i18next },
  rules: {
    'i18next/no-literal-string': 'off',
  },
}, {
  // P54-B / P60-I: Enforce no-literal-string on harvested dirs (JSX text only)
  // so future regressions are caught. P60-I promoted the whole admin panel
  // (src/components/Admin/**, incl. LayoutBuilder) into the harvested set.
  // P60-I sweep: src/hooks/** (admin-row hooks like useCampaignsRows render JSX)
  // and src/components/Campaign/** joined the enforced set — these bypassed the
  // bridge and shipped raw English (campaign-row actions, media picker labels).
  // P61-A/B: contexts/** + Galleries/Shared/** (pre-verified 0 violations) and
  // the near-zero-cost App.tsx / ErrorBoundary.tsx / Settings/** trio joined the
  // enforced set as the front-end-completeness sweep closed the remaining gaps.
  files: [
    'src/components/Galleries/Adapters/**/*.{ts,tsx}',
    'src/components/Galleries/Shared/**/*.{ts,tsx}',
    'src/components/Admin/**/*.{ts,tsx}',
    'src/components/Campaign/**/*.{ts,tsx}',
    'src/components/Settings/**/*.{ts,tsx}',
    'src/contexts/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'src/App.tsx',
    'src/components/ErrorBoundary.tsx',
    'packages/shared-ui/src/**/*.{ts,tsx}',
  ],
  // Test/story fixtures render literal JSX intentionally — keep them exempt.
  ignores: [
    '**/*.test.{ts,tsx}',
    '**/*.stories.{ts,tsx}',
  ],
  plugins: { i18next },
  rules: {
    // `jsx-text-only` is the supported option in eslint-plugin-i18next v6:
    // it flags literal JSX text children only (not attribute strings, which
    // carry role/data-testid/style noise). The earlier `markupOnly` key was
    // not in the v6 schema and was silently ignored.
    'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
  },
});