/**
 * P77-A: style-delivery contract, checked against the live page.
 *
 * `chrome-portable.scss` is the one stylesheet the contract says must reach
 * BOTH trees: the document (for portaled Drawer / Modal / Menu chrome) and the
 * shadow root (for the same components rendered `withinPortal={false}`, and
 * for the gallery itself). It gets there by two independent imports, one in
 * main.tsx and one in shadowStyles.ts, and nothing else ties them together.
 * Losing either import is invisible in the source and only shows up as a
 * missing focus ring or checkbox border on one surface (the P76-I-2 class of
 * defect). This spec asserts, with the Settings drawer open, that every
 * selector compiled from that file is present in `document.styleSheets` and
 * in the shadow root's sheets. It compiles the file at test time, so there is
 * no hand-maintained selector list to drift.
 *
 * It also pins the contract's reach claims for `global.scss`: present in the
 * shadow root and absent from the document under the shipped mount, and the
 * reverse under `?shadow=0`.
 */

import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const STYLES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles');

function compiledSelectors(file: string): string[] {
  const full = path.join(STYLES_DIR, file);
  const css = sass.compileString(readFileSync(full, 'utf8'), { loadPaths: [STYLES_DIR] }).css;
  const out: string[] = [];
  let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') {
      const prelude = buf.trim();
      if (prelude && !prelude.startsWith('@')) out.push(prelude.replace(/\s+/g, ' '));
      buf = '';
    } else if (ch === '}' || ch === ';') {
      buf = '';
    } else {
      buf += ch;
    }
  }
  return out;
}

const CHROME_PORTABLE = compiledSelectors('chrome-portable.scss');
const GLOBAL = compiledSelectors('global.scss');

async function installAdminSession(page: Page) {
  await page.addInitScript(() => {
    const g = window as Window & {
      __MULLION_AUTH_PROVIDER__?: string;
      __MULLION_API_BASE__?: string;
      __MULLION_CONFIG__?: Record<string, unknown>;
    };
    g.__MULLION_AUTH_PROVIDER__ = 'wp-jwt';
    g.__MULLION_API_BASE__ = 'http://127.0.0.1:5173';
    g.__MULLION_CONFIG__ = { enableJwt: true, restNonce: 'test-nonce' };
    localStorage.setItem('mullion_access_token', 'fake-token');
    localStorage.setItem('mullion_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));
  });
  const json = (body: unknown) => (route: { fulfill: (r: { status: number; contentType: string; body: string }) => Promise<void> }) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/wp-json/jwt-auth/v1/token/validate', json({}));
  await page.route('**/wp-json/mullion-gallery/v1/permissions', json({ campaignIds: [], isAdmin: true }));
  // The shipped default: chrome locked to the brand palette. See the
  // theme-qa fixture trap noted in e2e/theme-qa.spec.ts.
  await page.route('**/wp-json/mullion-gallery/v1/settings', json({
    theme: 'default-dark',
    authBarDisplayMode: 'floating',
    settingsDrawerBlurEnabled: false,
    advancedSettingsEnabled: true,
    applyThemeEverywhere: false,
  }));
  await page.route('**/wp-json/mullion-gallery/v1/campaigns**', json({ items: [] }));
}

async function openSettingsDrawer(page: Page) {
  await page.getByRole('button', { name: 'Admin menu' }).click();
  await page.getByRole('button', { name: /^Settings$/ }).click();
  await expect(page.getByRole('tab', { name: 'Appearance' })).toBeVisible();
}

/** Every selector text reachable from a tree's stylesheets, whitespace-normalised. */
async function selectorsIn(page: Page, tree: 'document' | 'shadow'): Promise<string[]> {
  return page.evaluate((which) => {
    const out: string[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const r of rules) {
        if ('selectorText' in r && typeof r.selectorText === 'string') out.push(r.selectorText.replace(/\s+/g, ' ').trim());
        if ('cssRules' in r) walk((r as CSSGroupingRule).cssRules);
      }
    };
    const sheets = which === 'document'
      ? document.styleSheets
      : document.getElementById('root')?.shadowRoot?.styleSheets;
    for (const s of sheets ?? []) {
      try { walk(s.cssRules); } catch { /* cross-origin sheet */ }
    }
    return out;
  }, tree);
}

const missingFrom = (haystack: string[], needles: string[]) => needles.filter((n) => !haystack.includes(n));

test.describe('style delivery contract', () => {
  test('the compiled fixtures are non-trivial', () => {
    expect(CHROME_PORTABLE.length).toBeGreaterThan(1);
    expect(GLOBAL.length).toBeGreaterThan(10);
  });

  test('shadow mount: chrome-portable reaches both trees, global.scss only the shadow root', async ({ page }) => {
    await installAdminSession(page);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => !!document.getElementById('root')?.shadowRoot)).toBe(true);
    await openSettingsDrawer(page);

    // The drawer really is portaled outside the shadow root; otherwise the
    // document-side assertion below would prove nothing.
    const dialogInDocument = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog && dialog.getRootNode() === document;
    });
    expect(dialogInDocument, 'Settings drawer must render under document.body for this test to mean anything').toBe(true);

    const doc = await selectorsIn(page, 'document');
    const shadow = await selectorsIn(page, 'shadow');

    expect(missingFrom(doc, CHROME_PORTABLE), 'chrome-portable.scss selectors missing from the document (main.tsx import)').toEqual([]);
    expect(missingFrom(shadow, CHROME_PORTABLE), 'chrome-portable.scss selectors missing from the shadow root (shadowStyles.ts entry)').toEqual([]);

    expect(missingFrom(shadow, GLOBAL), 'global.scss selectors missing from the shadow root').toEqual([]);
    expect(GLOBAL.filter((s) => doc.includes(s)), 'global.scss must not be loaded into the document under a shadow mount').toEqual([]);
  });

  // P77-C: the rules moved out of global.scss must not only be present in the
  // document, they must paint. The Theme select's checked option and the
  // drawer's active tab are the two parts a reader can see.
  test('shadow mount: the moved state rules paint on portaled chrome', async ({ page }) => {
    await installAdminSession(page);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => !!document.getElementById('root')?.shadowRoot)).toBe(true);
    await openSettingsDrawer(page);
    const dialog = page.getByRole('dialog', { name: /^Settings/ });

    const activeTab = dialog.getByRole('tab', { name: 'Appearance' });
    await expect(activeTab).toHaveAttribute('data-active', 'true');
    const tab = await activeTab.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        color: cs.color,
        borderBottomColor: cs.borderBottomColor,
        activeVar: cs.getPropertyValue('--mullion-tabs-tab-active-color').trim(),
        tabsColor: cs.getPropertyValue('--tabs-color').trim(),
      };
    });
    const hexToRgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
    expect(tab.activeVar, 'the adapter must put the active colour on the Tabs root').toMatch(/^#/);
    expect(tab.color).toBe(hexToRgb(tab.activeVar));
    expect(tab.borderBottomColor).toBe(hexToRgb(tab.tabsColor));

    await dialog.getByRole('combobox', { name: 'Theme' }).click();
    const checked = page.locator('.mullion-mantine-select-option[data-checked]').first();
    await expect(checked).toBeVisible();
    const option = await checked.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        color: cs.color,
        bgVar: cs.getPropertyValue('--mullion-select-option-checked-bg').trim(),
        colorVar: cs.getPropertyValue('--mullion-select-option-checked-color').trim(),
      };
    });
    expect(option.bgVar, 'the adapter must put the checked pair on the dropdown').toMatch(/^#/);
    expect(option.background).toBe(hexToRgb(option.bgVar));
    expect(option.color).toBe(hexToRgb(option.colorVar));
  });

  test('light mount: chrome-portable and global.scss both reach the document', async ({ page }) => {
    await installAdminSession(page);
    await page.goto('/?shadow=0');
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
    await openSettingsDrawer(page);

    const hasShadow = await page.evaluate(() => !!document.getElementById('root')?.shadowRoot);
    expect(hasShadow).toBe(false);

    const doc = await selectorsIn(page, 'document');
    expect(missingFrom(doc, CHROME_PORTABLE)).toEqual([]);
    expect(missingFrom(doc, GLOBAL), 'global.scss is dynamically imported for light mounts in main.tsx').toEqual([]);
  });
});
