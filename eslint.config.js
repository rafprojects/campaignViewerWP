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
// [P71-E] Local rule: flags hardcoded string/template literals in a notification
// title/message. The i18next rule above runs jsx-text-only and cannot see these
// (they live in plain-object args inside .ts/.tsx hooks, not JSX text), so this
// closes that gap precisely — see eslint-rules/no-untranslated-notification.js.
import noUntranslatedNotification from './eslint-rules/no-untranslated-notification.js'

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
  // P61-G: TERMINAL STATE — blanket enforcement. The front-end-completeness
  // sweep (P61-A–F) closed the last raw-literal gaps, so the whole front end
  // (all of src/** plus the shared-ui package) is now enforced with ONE glob
  // instead of the per-directory allow-list that had to be extended by hand for
  // every new component family. No future directory needs manual registration:
  // a new file anywhere under src/ is protected the moment it is created.
  //
  // History: P49-C/P54-B introduced the rule (off) and enforced the first
  // harvested dirs; P60-I added Admin/**, hooks/**, Campaign/**; P61 swept the
  // remaining families (Common, CampaignGallery, CardViewer, Auth, Settings,
  // contexts, Galleries/Shared, App.tsx, ErrorBoundary.tsx) and flipped to this
  // blanket rule.
  files: [
    'src/**/*.{ts,tsx}',
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
}, {
  // [P71-E] The notification-string gate. Applies wherever a Mantine
  // notification can be raised (all of src/), so a hardcoded title/message
  // literal can't silently ship in a .ts hook again (the P60/61 i18n milestone
  // regressed exactly because the jsx-text-only rule doesn't cover these).
  files: ['src/**/*.{ts,tsx}'],
  ignores: [
    '**/*.test.{ts,tsx}',
    '**/*.stories.{ts,tsx}',
  ],
  plugins: { wpsg: { rules: { 'no-untranslated-notification': noUntranslatedNotification } } },
  rules: {
    'wpsg/no-untranslated-notification': 'error',
  },
});