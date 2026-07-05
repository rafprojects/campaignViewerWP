import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CAMPAIGNS_URL = '**/wp-json/wp-super-gallery/v1/campaigns**';

const imageMedia = [
  {
    id: 'm1',
    type: 'image',
    url: 'https://picsum.photos/seed/a11y1/800/600',
    caption: 'First image',
    order: 1,
    attachmentId: 1,
  },
  {
    id: 'm2',
    type: 'image',
    url: 'https://picsum.photos/seed/a11y2/800/600',
    caption: 'Second image',
    order: 2,
    attachmentId: 2,
  },
];

const publicCampaign = {
  id: '201',
  companyId: 'acme',
  title: 'A11y Test Campaign',
  description: 'Accessibility test',
  thumbnail: 'https://picsum.photos/seed/a11y/400/300',
  coverImage: 'https://picsum.photos/seed/a11y/1200/600',
  status: 'active',
  visibility: 'public',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

/** Only report critical and serious axe violations. */
function criticalViolations(violations: { impact?: string }[]) {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

test.describe('accessibility baseline', () => {
  test('gallery listing page has no critical/serious axe violations', async ({ page }) => {
    await page.route(CAMPAIGNS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [publicCampaign], mediaByCampaign: { '201': imageMedia } }),
      });
    });

    await page.goto('/');
    // Wait for the campaign card to appear
    await expect(page.getByText('A11y Test Campaign')).toBeVisible();

    // color-contrast is intentionally excluded: the full WCAG-AA contrast audit
    // is a deferred WP.org-tier follow-on (Phase 60 Key Decision C). This gate
    // enforces the structural critical/serious set (roles, names, labels, ARIA).
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });

  test('login modal has no critical/serious axe violations', async ({ page }) => {
    // JWT mode so the sign-in flow is available
    await page.addInitScript(() => {
      (window as Window & {
        __WPSG_AUTH_PROVIDER__?: string;
        __WPSG_API_BASE__?: string;
        __WPSG_CONFIG__?: Record<string, unknown>;
      }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
      (window as Window & {
        __WPSG_AUTH_PROVIDER__?: string;
        __WPSG_API_BASE__?: string;
        __WPSG_CONFIG__?: Record<string, unknown>;
      }).__WPSG_API_BASE__ = 'http://127.0.0.1:5173';
      (window as Window & {
        __WPSG_AUTH_PROVIDER__?: string;
        __WPSG_API_BASE__?: string;
        __WPSG_CONFIG__?: Record<string, unknown>;
      }).__WPSG_CONFIG__ = { enableJwt: true };
    });

    // Token-validate returns 401 → unauthenticated state
    await page.route('**/wp-json/jwt-auth/v1/token/validate', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });
    await page.route(CAMPAIGNS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [publicCampaign], mediaByCampaign: { '201': imageMedia } }),
      });
    });

    await page.goto('/');
    await expect(page.getByText('A11y Test Campaign')).toBeVisible();

    // Open the floating auth bar menu
    await page.getByRole('button', { name: 'Admin menu' }).click();
    // Click "Sign in" inside the popover
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for the login modal
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible();

    // Full-page analyze: axe traverses the open shadow root the app mounts in
    // (a scoped `.include()` CSS selector cannot cross the shadow boundary).
    // color-contrast is intentionally excluded: the full WCAG-AA contrast audit
    // is a deferred WP.org-tier follow-on (Phase 60 Key Decision C). This gate
    // enforces the structural critical/serious set (roles, names, labels, ARIA).
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });

  test('campaign carousel has no critical/serious axe violations', async ({ page }) => {
    await page.route(CAMPAIGNS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [publicCampaign], mediaByCampaign: { '201': imageMedia } }),
      });
    });
    await page.route('**/wp-json/wp-super-gallery/v1/campaigns/201/media**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(imageMedia),
      });
    });

    await page.goto('/');
    await expect(page.getByText('A11y Test Campaign')).toBeVisible();

    // Open campaign detail (click the campaign card/title)
    await page.getByRole('button', { name: 'Open campaign A11y Test Campaign' }).click();

    // Wait for carousel region to appear
    await expect(page.getByRole('region', { name: /View image|Video \d/i }).first()).toBeVisible({ timeout: 10_000 });

    // color-contrast is intentionally excluded: the full WCAG-AA contrast audit
    // is a deferred WP.org-tier follow-on (Phase 60 Key Decision C). This gate
    // enforces the structural critical/serious set (roles, names, labels, ARIA).
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });

  test('lightbox has no critical/serious axe violations', async ({ page }) => {
    await page.route(CAMPAIGNS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [publicCampaign], mediaByCampaign: { '201': imageMedia } }),
      });
    });
    await page.route('**/wp-json/wp-super-gallery/v1/campaigns/201/media**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(imageMedia),
      });
    });

    await page.goto('/');
    await expect(page.getByText('A11y Test Campaign')).toBeVisible();
    await page.getByRole('button', { name: 'Open campaign A11y Test Campaign' }).click();

    // Wait for carousel then click the zoom / image to open lightbox
    await expect(page.getByRole('region').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Open lightbox' }).click();

    // Wait for lightbox dialog
    await expect(page.getByRole('dialog', { name: 'Media lightbox' })).toBeVisible();

    // color-contrast is intentionally excluded: the full WCAG-AA contrast audit
    // is a deferred WP.org-tier follow-on (Phase 60 Key Decision C). This gate
    // enforces the structural critical/serious set (roles, names, labels, ARIA).
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });
});

// ── P60-D: admin-flow a11y coverage ────────────────────────────────────────
// Extends the P54-C front-end baseline to the primary admin surfaces (the
// tabbed Admin Panel + the Settings panel), per Phase 60 Key Decision C.

const adminCampaign = {
  id: '101',
  companyId: 'acme',
  title: 'Admin Campaign',
  description: 'Admin description',
  thumbnail: 'https://picsum.photos/seed/adm/400/300',
  coverImage: 'https://picsum.photos/seed/adm/1200/600',
  status: 'active',
  visibility: 'private',
  tags: ['admin'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

/** Authenticated-admin session + the REST mocks the admin surfaces need to render. */
async function prepareAdminApp(page: Page) {
  await page.addInitScript(() => {
    const g = window as Window & {
      __WPSG_AUTH_PROVIDER__?: string;
      __WPSG_API_BASE__?: string;
      __WPSG_CONFIG__?: Record<string, unknown>;
    };
    g.__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    g.__WPSG_API_BASE__ = 'http://127.0.0.1:5173';
    g.__WPSG_CONFIG__ = { enableJwt: true, restNonce: 'test-nonce' };
    localStorage.setItem('wpsg_access_token', 'fake-token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));
  });

  const settings = {
    theme: 'default-dark',
    authBarDisplayMode: 'floating',
    showInContextEditors: true,
    advancedSettingsEnabled: true,
  };

  await page.route('**/wp-json/jwt-auth/v1/token/validate', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/wp-json/wp-super-gallery/v1/permissions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaignIds: ['101'], isAdmin: true }) }));
  await page.route('**/wp-json/wp-super-gallery/v1/settings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings) }));
  // General campaigns list — registered BEFORE the specific routes below so the
  // later, more-specific handlers win (Playwright checks most-recent first).
  await page.route('**/wp-json/wp-super-gallery/v1/campaigns**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [adminCampaign] }) }));
  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/101/media', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('accessibility - admin flows', () => {
  test('admin panel (campaigns tab) has no critical/serious axe violations', async ({ page }) => {
    await prepareAdminApp(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();

    await page.getByRole('button', { name: 'Admin menu' }).click();
    await page.getByRole('button', { name: 'Admin Panel' }).click();

    // Campaigns is the default tab; wait for the tablist + the mocked row.
    await expect(page.getByRole('tab', { name: 'Campaigns' })).toBeVisible();
    await expect(page.getByText('Admin Campaign').first()).toBeVisible();

    // color-contrast is intentionally excluded: the full WCAG-AA contrast audit
    // is a deferred WP.org-tier follow-on (Phase 60 Key Decision C). This gate
    // enforces the structural critical/serious set (roles, names, labels, ARIA).
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });

  test('settings panel has no critical/serious axe violations', async ({ page }) => {
    await prepareAdminApp(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();

    await page.getByRole('button', { name: 'Admin menu' }).click();
    await page.getByRole('button', { name: /^Settings$/ }).click();

    // The settings dialog's accessible name drifts with its header; wait on a
    // settings-panel-specific control (its first tab) to confirm it opened.
    await expect(page.getByRole('tab', { name: 'Appearance' })).toBeVisible();

    // color-contrast is intentionally excluded: the full WCAG-AA contrast audit
    // is a deferred WP.org-tier follow-on (Phase 60 Key Decision C). This gate
    // enforces the structural critical/serious set (roles, names, labels, ARIA).
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });
});
