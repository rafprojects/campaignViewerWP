# Contributing to WP Super Gallery

## Development Setup

```bash
# Clone and install dependencies (this also activates git hooks via `prepare`)
npm install
```

That's it. The pre-commit, commit-msg, and pre-push hooks are active automatically
after `npm install` because of the `prepare` script in `package.json`.

---

## Git Hooks

Three hooks are managed by [husky](https://typicode.github.io/husky):

| Hook | Runs | Blocks on |
|------|------|-----------|
| `pre-commit` | `lint-staged` | ESLint errors, TypeScript errors (project-wide) |
| `commit-msg` | `commitlint` | Non-conventional commit message format |
| `pre-push` | `vitest run` | Any failing Vitest test |

### Bypassing hooks

For emergencies only — do not bypass routinely:

```bash
git commit --no-verify -m "chore: emergency hotfix"
git push --no-verify
```

---

## Commit Message Format

This project enforces [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Allowed types

| Type | Use for |
|------|---------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that is neither a bug fix nor a feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (dependency updates, config) |
| `docs` | Documentation changes only |
| `perf` | Performance improvement |
| `build` | Build system or external dependency changes |
| `style` | Formatting, whitespace — no logic change |
| `ci` | CI/CD pipeline changes |
| `revert` | Revert a previous commit |

### Scope (optional but encouraged)

Use the Phase/track identifier or a short component name as scope:

```
feat(P19-A): add builder keyboard shortcuts
test(P19-QA): add coverage for useAdminAccessState
fix(MediaTab): resolve drag-reorder crash on empty list
docs(CONTRIBUTING): add hook bypass instructions
```

### Subject line

- Max 120 characters
- Lower-case type (enforced)
- Present tense ("add" not "added")
- No period at the end

---

## Lint Rules

ESLint is configured in `eslint.config.js`. The pre-commit hook runs `eslint --fix`
on staged TypeScript files and blocks if any errors remain after auto-fix.

To run lint manually:

```bash
npm run lint
```

To check TypeScript types manually:

```bash
npx tsc --noEmit --skipLibCheck
```

---

## Running Tests

The fastest reliable broad validation sweep is:

```bash
npm run build:wp
npm run test:silent
npm run test:e2e
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit -c phpunit.xml.dist"
```

If the default Vitest runner is noisy or looks hung, switch to the serial triage commands before assuming a product regression:

```bash
npm run test:quieter-triage
npm run test:triage
```

For PHPUnit from a fresh checkout:

```bash
npm install
cd wp-plugin/wp-super-gallery
composer install
cd ../..
npx wp-env start
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ls vendor/bin/phpunit phpunit.xml.dist tests/bootstrap.php"
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit -c phpunit.xml.dist"
```

Key points:

- Run `npx wp-env ...` from the repo root because `.wp-env.json` lives there.
- Run `composer ...` from `wp-plugin/wp-super-gallery` because that is where `composer.json` and `vendor/` live.
- Docker must be running before `npx wp-env start`.
- The `pre-push` hook only runs `npx vitest run`; it does not cover Playwright or PHPUnit.

For the full troubleshooting runbook, use `docs/testing/TESTING_QUICKSTART.md`.

---

## Branch Naming

```
feat/phase<N>-<short-description>     # feature work
fix/<short-description>               # hotfix
chore/<short-description>             # maintenance
```

---

## Code Style

- TypeScript strict mode is enabled — no `any` without an explanatory comment
- Mantine v7 for all UI components — do not introduce parallel UI libraries
- Follow the existing data-fetching pattern for the feature you are editing: SWR remains in older app flows, while the settings refactor uses TanStack Query for settings-scoped server state
- No `console.log` in committed code (ESLint `no-console` rule is active)
