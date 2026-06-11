/**
 * P49-D: Visual regression Playwright config.
 * Runs screenshot tests against the Storybook static build served locally.
 *
 * Usage:
 *   npm run build-storybook        # build static site first
 *   npx playwright test --config=playwright.visual.config.ts
 *
 * Update baselines after intentional visual changes:
 *   npx playwright test --config=playwright.visual.config.ts --update-snapshots
 *
 * Snapshots are stored in e2e/visual/__snapshots__/ and committed to git.
 * NOTE: Baselines are platform-sensitive. Generate them on the CI image
 * (Linux) for reproducible diffs. Running locally on a different OS may
 * produce pixel-level font/antialiasing differences.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/visual',
  snapshotDir: './e2e/visual/__snapshots__',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:6007',
    trace: 'on-first-retry',
  },
  expect: {
    toHaveScreenshot: {
      // 0.1% pixel diff threshold — catches meaningful regressions while
      // tolerating sub-pixel antialiasing noise.
      maxDiffPixelRatio: 0.001,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx serve storybook-static -l 6007 --no-clipboard',
    url: 'http://localhost:6007',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
