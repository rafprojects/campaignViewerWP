import { defineConfig } from '@playwright/test';

// P77-I: the port is deliberately not Vite's default 5173. `reuseExistingServer`
// cannot tell whose server it found, so when another project happened to be
// serving 5173 the whole suite ran against that app and failed 45 of 46 tests
// with errors that all looked like application defects. A distinctive port makes
// that collision unlikely; `E2E_BASE_URL` still overrides for a hand-started server.
const DEV_PORT = 5180;
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${DEV_PORT}`;

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
    command: `npm run dev -- --host 127.0.0.1 --port ${DEV_PORT}`,
    url: baseURL,
    reuseExistingServer: true,
  },
});
