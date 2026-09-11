/**
 * P77-B: overlay behaviour under a hostile host page, per portal mode.
 *
 * The host page here is what a WordPress theme routinely does to the
 * shortcode's container: an element-selector stylesheet, a sticky header with
 * a large z-index, and a wrapper with a transform (any animation or
 * `will-change` does this), which makes the wrapper the containing block for
 * every `position: fixed` descendant. The gallery mounts inside that wrapper
 * and the page is scrolled before the Settings drawer opens.
 *
 * `overlay-root` must keep the drawer in the viewport, keep host CSS off it,
 * and keep dismissal working. The same checks against `?portal=shadow` show
 * the drawer 500px above the viewport, which is why that option was rejected;
 * that measurement is recorded in docs/PHASE77_REPORT.md rather than asserted
 * here, because a test that pins a defect is a trap for whoever fixes it.
 */

import { test, expect, type Page } from '@playwright/test';

async function installHostileHost(page: Page) {
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
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = `
        button { background: rgb(255, 0, 0) !important; border-radius: 0 !important; }
        .host-header { position: sticky; top: 0; height: 60px; background: rgb(0, 0, 255); z-index: 9999; }
        .host-wrap { transform: translateZ(0); position: relative; z-index: 1; overflow: hidden; margin-top: 40px; }
      `;
      document.head.appendChild(style);
      const header = document.createElement('div');
      header.className = 'host-header';
      const wrap = document.createElement('div');
      wrap.className = 'host-wrap';
      const root = document.getElementById('root');
      if (!root?.parentNode) return;
      document.body.insertBefore(header, document.body.firstChild);
      root.parentNode.insertBefore(wrap, root);
      wrap.appendChild(root);
      const spacer = document.createElement('div');
      spacer.style.height = '1500px';
      document.body.appendChild(spacer);
    });
  });
  const json = (body: unknown) => (route: { fulfill: (r: { status: number; contentType: string; body: string }) => Promise<void> }) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/wp-json/jwt-auth/v1/token/validate', json({}));
  await page.route('**/wp-json/mullion-gallery/v1/permissions', json({ campaignIds: [], isAdmin: true }));
  await page.route('**/wp-json/mullion-gallery/v1/settings', json({
    theme: 'default-dark',
    authBarDisplayMode: 'floating',
    settingsDrawerBlurEnabled: false,
    applyThemeEverywhere: false,
  }));
  await page.route('**/wp-json/mullion-gallery/v1/campaigns**', json({ items: [] }));
}

test.describe('portal mode: overlay-root under a hostile host page', () => {
  test('drawer stays in the viewport, isolated from host CSS, and dismisses', async ({ page }) => {
    await installHostileHost(page);
    await page.goto('/?portal=overlay-root');
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
    const wrapped = await page.evaluate(() => !!document.querySelector('.host-wrap')?.contains(document.getElementById('root')));
    expect(wrapped, 'the fixture must wrap the mount, or the test proves nothing').toBe(true);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.getByRole('button', { name: 'Admin menu' }).click();
    await page.getByRole('button', { name: /^Settings$/ }).click();
    const dialog = page.getByRole('dialog', { name: /^Settings/ });
    await expect(dialog.getByRole('tab', { name: 'Appearance' })).toBeVisible();

    const drawer = await dialog.evaluate((el) => {
      const inner = el.closest('.mantine-Drawer-inner') ?? el.parentElement!;
      const r = inner.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const host = (el.getRootNode() as ShadowRoot).host as HTMLElement | undefined;
      return {
        rootIsOverlay: !!host?.hasAttribute('data-mullion-overlay-root'),
        top: Math.round(r.top),
        height: Math.round(r.height),
        mullionPrimary: cs.getPropertyValue('--mullion-color-primary').trim(),
        mantinePrimary: cs.getPropertyValue('--mantine-primary-color-filled').trim(),
      };
    });
    expect(drawer.rootIsOverlay).toBe(true);
    expect(drawer.top, 'a fixed overlay anchored to the transformed wrapper would sit above the viewport').toBe(0);
    expect(drawer.height).toBe(await page.evaluate(() => window.innerHeight));
    expect(drawer.mullionPrimary).toMatch(/^#/);
    expect(drawer.mantinePrimary).toMatch(/^#/);

    const cancel = await dialog.getByRole('button', { name: 'Cancel' }).evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius };
    });
    expect(cancel.bg, 'the host page paints every <button> red; the drawer must not see that rule').not.toBe('rgb(255, 0, 0)');
    expect(cancel.radius).not.toBe('0px');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Admin menu' }).click();
    await page.getByRole('button', { name: /^Settings$/ }).click();
    await expect(dialog.getByRole('tab', { name: 'Appearance' })).toBeVisible();
    await page.mouse.click(200, 500);
    await expect(dialog).toBeHidden();
  });

  test('light mount ignores the portal mode and keeps overlays in the document', async ({ page }) => {
    await installHostileHost(page);
    await page.goto('/?shadow=0&portal=overlay-root');
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Admin menu' }).click();
    await page.getByRole('button', { name: /^Settings$/ }).click();
    const dialog = page.getByRole('dialog', { name: /^Settings/ });
    await expect(dialog.getByRole('tab', { name: 'Appearance' })).toBeVisible();
    expect(await dialog.evaluate((el) => el.getRootNode() === document)).toBe(true);
    expect(await page.evaluate(() => document.querySelectorAll('[data-mullion-overlay-root]').length)).toBe(0);
  });
});

test.describe('portal mode: overlay-root carries the builder sheets', () => {
  // The Layout Builder chunk is compiled on first request by the dev server.
  test.setTimeout(150_000);

  test('the Layout Builder is styled inside the overlay root', async ({ page }) => {
    await installHostileHost(page);
    await page.route('**/wp-json/mullion-gallery/v1/**layout-templates**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/wp-json/mullion-gallery/v1/**assets**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/?portal=overlay-root');
    await page.getByRole('button', { name: 'Admin menu' }).click();
    await page.getByRole('button', { name: 'Admin Panel' }).click();
    await page.getByRole('tab', { name: 'Layouts' }).click();
    await page.getByRole('button', { name: 'New Layout' }).click();

    // Dockview and builder.css are document stylesheets in main.tsx; the
    // overlay root must carry its own copy or the builder renders unstyled
    // (measured: zero `.dv-` rules, tabs with no padding).
    const builder = await page.waitForFunction(() => {
      const overlay = document.querySelector('[data-mullion-overlay-root]')?.shadowRoot;
      const tab = overlay?.querySelector('.dv-tab');
      if (!tab) return null;
      let dvRules = 0;
      for (const s of overlay!.styleSheets) for (const r of s.cssRules) if ((r as CSSStyleRule).selectorText?.includes('.dv-')) dvRules++;
      const cs = getComputedStyle(tab);
      return { dvRules, padding: cs.padding, background: cs.backgroundColor };
    }, null, { timeout: 120_000 });
    const result = await builder.jsonValue();
    expect(result.dvRules).toBeGreaterThan(100);
    expect(result.padding).not.toBe('0px');
    expect(result.background).not.toBe('rgba(0, 0, 0, 0)');
  });
});
