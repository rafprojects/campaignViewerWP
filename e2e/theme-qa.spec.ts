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

  // P77-D: this used to assert `typeof saved === 'string' || saved === null`,
  // a tautology over localStorage.getItem, and never changed the theme. It
  // now picks a different theme, requires Save to enable (a disabled Save
  // after a theme change is exactly the failure to catch), and asserts the
  // stored id. Verified to fail when persistence is broken.
  test('changing theme in Display Settings persists to localStorage', async ({ page }) => {
    await installThemeSession(page, { themeId: 'default-dark' });
    await page.goto('/');
    await waitForShadowMount(page);

    const dialog = await openDisplaySettings(page);
    const themeCombo = dialog.getByRole('combobox', { name: 'Theme' });
    await expect(themeCombo).toBeVisible();
    await expect(themeCombo).toHaveValue('Mullion');

    await themeCombo.click();
    // Option names carry the theme description, so match on the leading name only.
    await page.getByRole('option', { name: /^Tokyo Night/ }).click();
    await expect(themeCombo).toHaveValue('Tokyo Night');

    const save = dialog.getByRole('button', { name: 'Save Changes' });
    await expect(save).toBeEnabled();
    await save.click();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('mullion-theme-id')))
      .toBe('tokyo-night');
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

// P76-I-2 (Option A): Mantine draws every non-input focus ring from
// `--mantine-primary-color-filled` (primaryFill), which fell under WCAG
// 1.4.11's 3:1 floor on 13 of 23 bundled themes. `src/styles/global.scss`
// re-points it at `primaryStroke`.
//
// This asserts the *painted* result rather than the stylesheet, because the
// override is a list of selectors and a list can be incomplete: several
// components (Switch, Checkbox, Chip, SegmentedControl) draw their ring on a
// sibling element, so a component whose selector is missing would silently
// keep the old colour. Tabbing the real panel is the only way to catch that.
test.describe('focus ring colour', () => {
  // P77-F: the ring is a pair. Every painted ring must carry the 2px core in
  // primaryStroke and a 6px halo in the theme's focus-halo token, with the
  // same geometry everywhere, in both mount modes and both chrome modes (the
  // P76-D/H trap: the shipped default is applyThemeEverywhere false).
  for (const mount of ['shadow', 'light'] as const) {
    for (const applyThemeEverywhere of [false, true]) {
      test(`no painted focus ring uses primaryFill, and every ring carries the halo (${mount} mount, applyThemeEverywhere ${applyThemeEverywhere})`, async ({ page }) => {
        const FILL = 'rgb(0, 120, 112)';   // default-dark primaryFill  #007870
        const STROKE = 'rgb(0, 142, 133)'; // default-dark primaryStroke #008e85

        await installThemeSession(page, { themeId: 'default-dark', applyThemeEverywhere });
        await page.goto(mount === 'shadow' ? '/' : '/?shadow=0');
        if (mount === 'shadow') await waitForShadowMount(page);
        await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
        await openDisplaySettings(page);
        await page.addStyleTag({
          content: '*,*::before,*::after{transition:none !important;animation:none !important}',
        });

        type Ring = { where: string; colour: string; width: string; halo: string; haloVar: string };
        const rings: Ring[] = [];
        for (let i = 0; i < 45; i++) {
          await page.keyboard.press('Tab');
          const found = await page.evaluate(() => {
            const deepActive = (): Element | null => {
              let a: Element | null = document.activeElement;
              while (a && (a as HTMLElement).shadowRoot?.activeElement) {
                a = (a as HTMLElement).shadowRoot!.activeElement;
              }
              return a;
            };
            const el = deepActive() as HTMLElement | null;
            if (!el) return null;
            const out: Ring[] = [];
            // The ring may be painted on the focused element or on its sibling.
            for (const [label, node] of [
              ['self', el],
              ['sibling', el.nextElementSibling],
            ] as const) {
              if (!node) continue;
              const cs = getComputedStyle(node as HTMLElement);
              // Only Mantine's ring, not the 1px UA default some inputs keep
              // underneath a sibling-drawn ring.
              if (cs.outlineStyle === 'solid' && parseFloat(cs.outlineWidth) >= 2) {
                const cls = typeof (node as HTMLElement).className === 'string'
                  ? (node as HTMLElement).className : '';
                out.push({
                  where: `${label}:${cls.split(' ')[1] ?? cls.split(' ')[0] ?? '?'}`,
                  colour: cs.outlineColor,
                  width: cs.outlineWidth,
                  halo: cs.boxShadow,
                  haloVar: cs.getPropertyValue('--mullion-color-focus-halo').trim(),
                });
              }
            }
            return out.length ? out : null;
          });
          if (found) rings.push(...found);
        }

        // The tab order must actually have produced rings, or this proves nothing.
        expect(rings.length, 'no focus rings were painted — the walk found nothing to check').toBeGreaterThan(5);

        const stillFill = rings.filter((r) => r.colour === FILL);
        expect(
          stillFill,
          `these focus rings still paint primaryFill:\n${stillFill.map((r) => '  - ' + r.where).join('\n')}`,
        ).toEqual([]);

        // And they resolve to the intended token rather than to the fallback.
        expect(rings.every((r) => r.colour === STROKE)).toBe(true);

        // The halo: the token must reach the element (a missing token paints a
        // transparent halo, which is the P76 class of defect), and the painted
        // box-shadow must be that colour at exactly 6px spread on every ring.
        const hexToRgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
        const noToken = rings.filter((r) => !/^#[0-9a-f]{6}$/i.test(r.haloVar));
        expect(noToken, `the focus-halo token did not reach:\n${noToken.map((r) => '  - ' + r.where).join('\n')}`).toEqual([]);
        const badHalo = rings.filter((r) => r.halo !== `${hexToRgb(r.haloVar)} 0px 0px 0px 6px`);
        expect(
          badHalo,
          `these rings do not paint the 6px halo in the theme token:\n${badHalo.map((r) => `  - ${r.where}: ${r.halo}`).join('\n')}`,
        ).toEqual([]);
        expect(rings.every((r) => r.width === '2px'), 'ring core geometry must stay 2px on every control').toBe(true);
      });
    }
  }
});

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
  // RETRACTED (P76-H): this comment used to say the capture could not cover
  // `borderStrong` because the controls computed to `border-width: 0px`. That
  // measurement was taken in follow mode only — BASE_SETTINGS below sets
  // `applyThemeEverywhere: true`, the opposite of the shipped default — and
  // follow mode was itself the bug. In the shipped default the border is
  // painted (`1px solid #648284`), and this capture does cover it.
  //
  // The tolerance point above still stands, and is why this case exists: the
  // six whole-page `display-settings-*` captures did not move when the border
  // was restored.
  //
  // P76-I: the control is captured at REST. Focus state is not covered by any
  // snapshot — which is how text inputs and selects came to have no focus
  // indicator at all without a baseline noticing. That is guarded by unit
  // tests in src/themes/__tests__/adapter.test.ts instead, because the fix
  // lives in `vars` (CSS custom properties) where a config-level assertion can
  // actually see it.
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
