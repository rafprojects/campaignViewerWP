# Testing Quickstart

This is the shortest reliable path to get the repo's tests running from a fresh checkout. It reflects the recent validation and stability work, including the extra setup and triage steps that were needed to get PHPUnit and the broader suite working cleanly.

## Before You Start

- Commands below assume you start in the repo root.
- Use `npx wp-env ...` from the repo root because `.wp-env.json` lives there.
- Use `composer ...` from `wp-plugin/wp-super-gallery` because that is where `composer.json`, `vendor/`, and `phpunit.xml.dist` live.
- Docker must be running before any `wp-env` command.
- The plugin directory is mounted into the `tests-cli` container from your host checkout. If `vendor/` is missing on the host, PHPUnit will also be missing in the container.
- In this repo, the most reliable PHPUnit entrypoint is `php ./vendor/bin/phpunit ...`. The Composer shim may be present without the executable bit inside the mounted container, so do not rely on `./vendor/bin/phpunit` being directly runnable.
- The first `npx wp-env start` can take a few minutes and print `Installing...`; that is normal.
- Node 18+ is the expected baseline for the frontend tooling.

## From Scratch: Get PHPUnit Working

### 1. Install repo dependencies

```bash
npm install
```

### 2. Install the plugin's Composer dependencies

```bash
cd wp-plugin/wp-super-gallery
composer install
cd ../..
```

Heads up:

- Do not run `composer install` from the repo root. The PHPUnit binary and polyfills are only defined in `wp-plugin/wp-super-gallery/composer.json`.
- If Composer is blocked by local platform checks, try `composer install --ignore-platform-reqs`. If the install already exists but autoloading looks stale, run `composer dump-autoload --ignore-platform-reqs` from the same directory.

### 3. Start wp-env

```bash
npx wp-env start
```

Heads up:

- Run this from the repo root, not from `wp-plugin/wp-super-gallery`.
- If Docker is not running, fix that first. Do not debug PHPUnit before `wp-env` can start cleanly.

### 4. Sanity-check the mounted plugin files

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ls phpunit.xml.dist tests/bootstrap.php && php ./vendor/bin/phpunit -c phpunit.xml.dist --version"
```

This should print the file paths and a PHPUnit version line without errors. If it does not, the problem is still environment setup, not the test suite itself.

### 5. Run the full PHPUnit suite

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist"
```

Expected shape of the output:

```text
Installing...
Running as single site...
PHPUnit 9.x by Sebastian Bergmann and contributors.
...
OK (N tests, M assertions)
```

The exact counts will change over time. The important signal is that the run ends with `OK (...)` and exit code `0`.

## Canonical PHPUnit Commands

### Full suite

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist"
```

### Focused settings slice

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist tests/WPSG_Settings_Test.php tests/WPSG_Settings_Extended_Test.php tests/WPSG_Settings_Rest_Test.php"
```

### Single file

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist tests/WPSG_Settings_Rest_Test.php"
```

### Filter one test method

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist --filter test_settings_rest_response"
```

### Verbose output

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist -v"
```

## PHP Troubleshooting

### Docker or `wp-env` will not start

Common signs:

- Docker daemon errors
- `Could not find docker-compose.yml`
- `wp-env` exits before creating containers

What to do:

```bash
npx wp-env stop
npx wp-env start
```

If the environment is still wedged, reset it fully:

```bash
npx wp-env destroy
npx wp-env start
```

### `vendor/bin/phpunit` is missing in the container

That usually means Composer dependencies were never installed on the host checkout.

Fix:

```bash
cd wp-plugin/wp-super-gallery
composer install
cd ../..
```

Then rerun the sanity check and the full PHPUnit command.

### `Permission denied` when running `./vendor/bin/phpunit`

The mounted Composer shim may not have the executable bit inside `wp-env` even when the file exists.

Fix:

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist"
```

If you want to repair the local file mode as well, run:

```bash
chmod +x wp-plugin/wp-super-gallery/vendor/bin/phpunit
```

### `No such file or directory` for `/var/www/html/wp-content/plugins/wp-super-gallery`

That usually means `wp-env` was started from the wrong directory or not started at all.

Fix:

1. Go back to the repo root.
2. Run `npx wp-env start`.
3. Rerun the canonical PHPUnit command.

### `0 tests found` or `Class ... cannot be found`

The repo is already configured for PHPUnit 9 plus Yoast polyfills, so this is usually an environment drift problem rather than a code problem.

Check all of the following:

1. `vendor/` exists under `wp-plugin/wp-super-gallery`.
2. The test file ends in `Test.php`.
3. `phpunit.xml.dist` and `tests/bootstrap.php` are present.
4. You are running the command inside `tests-cli`, not directly on the host.

If autoloading looks stale:

```bash
cd wp-plugin/wp-super-gallery
composer dump-autoload
cd ../..
```

### `wp-env` is not a recognized command

Use `npx wp-env`, not bare `wp-env`, unless you intentionally installed it globally.

## Broader Validation Workflow

Once PHPUnit is working, this is the recommended repo-wide validation order.

### 1. Production build

```bash
npm run build:wp
```

### 2. Frontend unit and integration suite

```bash
npm run test:silent
```

### 3. If Vitest looks hung or reports worker-pressure timeouts, switch to serial triage

Fast stable verdict:

```bash
npm run test:quieter-triage
```

More verbose serial triage:

```bash
npm run test:triage
```

Single-file serial diagnosis:

```bash
npx vitest run --reporter=verbose --reporter=hanging-process --no-file-parallelism src/path/to/file.test.tsx
```

Heads up:

- If the failure signature is `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`, treat that as runner-pressure or heavyweight-suite instability first, not as immediate evidence of a product regression.
- The recent stabilization work made serial triage the trustworthy fallback when the default parallel runner is noisy.

### 4. Playwright browser suite

Install Chromium once per machine:

```bash
npx playwright install --with-deps chromium
```

Run the suite:

```bash
npm run test:e2e
```

Heads up:

- `playwright.config.ts` auto-starts the Vite dev server.
- The current browser specs mock their network dependencies, so you normally do not need `wp-env` running for `npm run test:e2e`.

### 5. Full PHPUnit run

```bash
npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist"
```

## Current Stable Baseline

The latest local stabilization pass reached this green checkpoint on `2026-04-30`:

- `npm run build:wp` passed.
- Full serial Vitest passed: `97` files, `1318` tests.
- Full PHPUnit in `wp-env` passed: `527` tests, `1575` assertions.
- Playwright passed: `5` tests.

These counts will drift as coverage grows, but this is the reference shape for a known-good broad validation sweep.

## Stability Notes

- The historical Vitest instability in this repo was mostly caused by heavyweight jsdom integration suites, not by one permanently broken feature path.
- When a full parallel Vitest run is noisy, prefer serial triage before assuming a regression.
- If you add new high-level UI tests, keep them focused. Redundant modal-heavy coverage tends to be the first thing that makes the runner noisy again.

## When You Are Done

Stop `wp-env` if you do not need it anymore:

```bash
npx wp-env stop
```

Only use `destroy` when you intentionally want to reset the WordPress test environment:

```bash
npx wp-env destroy
```

For the longer historical setup/debug story behind the PHPUnit bootstrap and naming conventions, see [PHPUNIT_SETUP.md](PHPUNIT_SETUP.md).
