import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  // P77-D: e2e/visual/ is the Storybook screenshot suite and runs only through
  // playwright.visual.config.ts against a static Storybook build. Under this
  // config it has no server and fails 33 times with "snapshot doesn't exist".
  testIgnore: ['**/visual/**'],
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: baseURL,
    reuseExistingServer: true,
  },
});
