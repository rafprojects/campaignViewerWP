// commitlint.config.cjs
// Enforces Conventional Commits format: https://www.conventionalcommits.org
// Valid types: feat, fix, refactor, test, chore, docs, perf, build, style, ci, revert
// Scope is optional but encouraged: feat(P19-A): add builder keyboard shortcuts
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow longer subject lines (default is 72 — too short for descriptive messages)
    'header-max-length': [1, 'always', 120],
    // Allow lowercase type (default enforcement)
    'type-case': [2, 'always', 'lower-case'],
    // Allow empty body — not every commit needs one
    'body-leading-blank': [1, 'always'],
    // Extend the allowed types with our phase-convention abbreviations
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'test',
        'chore',
        'docs',
        'perf',
        'build',
        'style',
        'ci',
        'revert',
      ],
    ],
  },
};
