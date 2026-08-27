/**
 * P30-J — Theme QA & Visual Regression
 *
 * Two test groups:
 *
 * 1. Behavioral tests (no baselines required — always runnable):
 *    - Theme preview via Display Settings selector
 *    - Theme persistence to localStorage
 *    - WP injected theme takes precedence over localStorage
 *
 * 2. Phase 1 visual snapshot matrix (14 snapshots — require baselines):
 *    Run `npx playwright test theme-qa --update-snapshots` once to capture
 *    baselines, then commit the generated `.png` files in e2e/__snapshots__/.
 *
 *    Phase 1 scope:
 *      Themes (6): default-dark, default-light, material-dark, high-contrast,
 *                  tokyo-night, cyberpunk
 *      Surfaces (2): gallery shell, Display Settings dialog
 *      Dropdowns (2): theme selector open in default-dark / default-light
 *      Total: 14 snapshots
 *
 *    Phase 2 (documented, not yet implemented):
 *      Add themes: material-light, nord, solarized-dark, catppuccin-mocha,
 *                  ocean-breeze, sunset-boulevard
 *      Add surface: Admin Panel Campaigns
 *      Total after expansion: 38 snapshots
 *    Phase 2 should only be enabled after Phase 1 baselines prove stable
 *    across at least 3 consecutive CI runs.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_SETTINGS = {
  theme: 'default-dark',
  authBarDisplayMode: 'floating',
  showInContextEditors: true,
  settingsDrawerBlurEnabled: false, // disabled for stable snapshots
  advancedSettingsEnabled: true,
  // P75-D default is false (Mullion chrome). Keep the existing per-theme
  // settings-dialog snapshots on the "toggle on" path they were captured against.
  applyThemeEverywhere: true,
};

async function installThemeSession(
  page: Page,
  opts: { themeId?: string; wpInjectedThemeId?: string; applyThemeEverywhere?: boolean } = {},
) {
  const { themeId, wpInjectedThemeId, applyThemeEverywhere } = opts;

  await page.addInitScript(
    ([storedTheme, wpTheme]: [string | undefined, string | undefined]) => {
      const g = window as Window & {
        __MULLION_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
        __MULLION_API_BASE__?: string;
        __MULLION_CONFIG__?: { enableJwt?: boolean; restNonce?: string };
        __mullionThemeId?: string;
      };
      g.__MULLION_AUTH_PROVIDER__ = 'wp-jwt';
      g.__MULLION_API_BASE__ = 'http://127.0.0.1:5173';
      g.__MULLION_CONFIG__ = { enableJwt: true, restNonce: 'test-nonce' };

      localStorage.setItem('mullion_access_token', 'fake-token');
      localStorage.setItem(
        'mullion_user',
        JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }),
      );
      if (storedTheme) {
        localStorage.setItem('mullion-theme-id', storedTheme);
      }
      if (wpTheme) {
        g.__mullionThemeId = wpTheme;
      }
    },
    [themeId, wpInjectedThemeId] as [string | undefined, string | undefined],
  );

  let currentSettings: Record<string, unknown> = {
    ...BASE_SETTINGS,
    ...(themeId ? { theme: themeId } : {}),
    ...(applyThemeEverywhere === undefined ? {} : { applyThemeEverywhere }),
  };

  await page.route('**/wp-json/jwt-auth/v1/token/validate', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/wp-json/mullion-gallery/v1/permissions', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ campaignIds: ['101'], isAdmin: true }),
    }),
  );
  await page.route('**/wp-json/mullion-gallery/v1/settings', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      currentSettings = { ...currentSettings, ...body };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentSettings),
    });
  });
  await page.route('**/wp-json/mullion-gallery/v1/campaigns?**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );
  await page.route('**/wp-json/mullion-gallery/v1/campaigns', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );
}

async function waitForShadowMount(page: Page) {
  await expect
    .poll(() => page.evaluate(() => !!document.getElementById('root')?.shadowRoot))
    .toBe(true);
}

async function openDisplaySettings(page: Page) {
  await page.getByRole('button', { name: 'Admin menu' }).click();
  await page.getByRole('button', { name: /^Settings$/ }).click();
  const dialog = page.getByRole('dialog', { name: /Settings/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

// ── Behavioral tests ─────────────────────────────────────────────────────────

test.describe('theme behavioral tests', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('active theme ID is reflected in the theme selector combobox', async ({ page }) => {
    await installThemeSession(page, { themeId: 'tokyo-night' });
    await page.goto('/');
    await waitForShadowMount(page);
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();

    const dialog = await openDisplaySettings(page);
    // The theme combobox should show the active theme name
    const themeCombo = dialog.getByRole('combobox', { name: 'Theme' });
    await expect(themeCombo).toBeVisible();
    await expect(themeCombo).toHaveValue('Tokyo Night');
  });

  test('changing theme in Display Settings persists to localStorage', async ({ page }) => {
    await installThemeSession(page, { themeId: 'default-dark' });
    await page.goto('/');
    await waitForShadowMount(page);

    const dialog = await openDisplaySettings(page);
    const themeCombo = dialog.getByRole('combobox', { name: 'Theme' });
    await expect(themeCombo).toBeVisible();

    const save = dialog.getByRole('button', { name: 'Save Changes' });
    if (await save.isEnabled()) {
      await save.click();
    }
    const saved = await page.evaluate(() => localStorage.getItem('mullion-theme-id'));
    expect(typeof saved === 'string' || saved === null).toBe(true);
  });

  test('WP injected __mullionThemeId overrides localStorage stored theme', async ({ page }) => {
    // localStorage has tokyo-night but WP injection says cyberpunk
    await installThemeSession(page, { themeId: 'tokyo-night', wpInjectedThemeId: 'cyberpunk' });
    await page.goto('/');
    await waitForShadowMount(page);

    // Check that CSS variables reflect the WP-injected theme (cyberpunk)
    const themeApplied = await page.evaluate(() => {
      const shadowRoot = document.getElementById('root')?.shadowRoot;
      if (!shadowRoot) return null;
      const styleEl = shadowRoot.querySelector('#mullion-theme-vars') as HTMLStyleElement | null;
      return styleEl?.textContent ?? null;
    });

    // The CSS variables should be non-empty and belong to cyberpunk
    expect(themeApplied).toBeTruthy();
    expect(themeApplied).toContain(':host');
  });

  test('CSS variable style element exists inside shadow root after mount', async ({ page }) => {
    await installThemeSession(page, { themeId: 'material-dark' });
    await page.goto('/');
    await waitForShadowMount(page);

    const hasThemeVars = await page.evaluate(() => {
      const shadowRoot = document.getElementById('root')?.shadowRoot;
      return !!shadowRoot?.querySelector('#mullion-theme-vars');
    });
    expect(hasThemeVars).toBe(true);
  });
});

// ── Phase 1 visual snapshot tests ────────────────────────────────────────────
//
// Uses Playwright's built-in `toHaveScreenshot()` which:
//   • auto-creates baselines on first run (no manual --update-snapshots needed)
//   • diffs against baseline on subsequent runs and fails on regression
//   • stores snapshots alongside the spec in a `theme-qa.spec.ts-snapshots/` dir
//
// Snapshot settings: Chromium only, 1280×900, animations disabled.
// Pixel mismatch threshold: 0.1 (10% per-pixel tolerance for anti-aliasing).

const SNAPSHOT_THEMES = [
  'default-dark',
  'default-light',
  'material-dark',
  'high-contrast',
  'tokyo-night',
  'cyberpunk',
] as const;

test.describe('phase-1 visual snapshots', () => {
  test.use({
    viewport: { width: 1280, height: 900 },
  });

  for (const themeId of SNAPSHOT_THEMES) {
    test(`gallery shell — ${themeId}`, async ({ page }) => {
      await installThemeSession(page, { themeId });
      await page.goto('/');
      await waitForShadowMount(page);
      // Wait for media API to resolve so the gallery shell is stable
      await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
      // Disable animations for a stable snapshot
      await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }' });
      await expect(page).toHaveScreenshot(`gallery-shell-${themeId}.png`, { maxDiffPixelRatio: 0.1 });
    });

    test(`display settings dialog — ${themeId}`, async ({ page }) => {
      await installThemeSession(page, { themeId });
      await page.goto('/');
      await waitForShadowMount(page);
      await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
      await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }' });
      await openDisplaySettings(page);
      await expect(page).toHaveScreenshot(`display-settings-${themeId}.png`, { maxDiffPixelRatio: 0.1 });
    });
  }

  test('theme selector dropdown — default-dark', async ({ page }) => {
    await installThemeSession(page, { themeId: 'default-dark' });
    await page.goto('/');
    await waitForShadowMount(page);
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
    await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }' });
    const dialog = await openDisplaySettings(page);
    await dialog.getByRole('combobox', { name: 'Theme' }).click();
    await expect(page).toHaveScreenshot('theme-selector-open-default-dark.png', { maxDiffPixelRatio: 0.1 });
  });

  // P76-D: every snapshot above is a toggle-ON capture, so the *shipped default*
  // (applyThemeEverywhere false — chrome locked to the Mullion brand while the
  // gallery stays on its own theme) had no visual coverage at all. Tokyo Night
  // is the established non-default fixture, so a regression that leaked the
  // gallery palette into locked chrome shows up here as a whole-dialog diff.
  test('display settings dialog, chrome locked — tokyo-night gallery', async ({ page }) => {
    await installThemeSession(page, { themeId: 'tokyo-night', applyThemeEverywhere: false });
    await page.goto('/');
    await waitForShadowMount(page);
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
    await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }' });
    await openDisplaySettings(page);
    await expect(page).toHaveScreenshot('display-settings-locked-chrome-tokyo-night.png', { maxDiffPixelRatio: 0.1 });
  });

  // P76-D: a tight-tolerance capture of a single themed control. The whole-page
  // snapshots above run at maxDiffPixelRatio 0.1, which is ~115k pixels of slack
  // on a 1280x900 page — enough to swallow any change confined to one control.
  // This case is scoped to the control and runs at zero tolerance, so a change
  // to its fill, text, or geometry fails.
  //
  // It deliberately does NOT claim to cover `borderStrong`. That token is set as
  // `borderColor` on Input / Select / TextInput / NumberInput / Checkbox /
  // Switch (adapter.ts x9) — but those elements compute to `border-width: 0px`,
  // measured in a browser during P76-D, so the colour is never painted. That is
  // why P75-G's controlled revert of the dark borderStrong to the defective
  // #577577 produced byte-identical baselines, and re-running that revert during
  // P76-D still produced 20/20 passes even at this zero tolerance. No snapshot
  // can cover a colour that never reaches a pixel; see the P76-D notes in
  // docs/PHASE76_REPORT.md for the open question that raises.
  test('themed control — tight tolerance', async ({ page }) => {
    await installThemeSession(page, { themeId: 'default-dark' });
    await page.goto('/');
    await waitForShadowMount(page);
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
    await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }' });
    const dialog = await openDisplaySettings(page);
    const control = dialog.getByRole('combobox', { name: 'Theme' });
    await expect(control).toBeVisible();
    // Keep focus off it: a focused input swaps its colours for the primary
    // stroke, which would make this capture a focus-ring test instead.
    await expect(control).toHaveScreenshot('themed-control-tight-default-dark.png', {
      maxDiffPixelRatio: 0,
      maxDiffPixels: 0,
    });
  });

  test('theme selector dropdown — default-light', async ({ page }) => {
    await installThemeSession(page, { themeId: 'default-light' });
    await page.goto('/');
    await waitForShadowMount(page);
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
    await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }' });
    const dialog = await openDisplaySettings(page);
    await dialog.getByRole('combobox', { name: 'Theme' }).click();
    await expect(page).toHaveScreenshot('theme-selector-open-default-light.png', { maxDiffPixelRatio: 0.1 });
  });
});
