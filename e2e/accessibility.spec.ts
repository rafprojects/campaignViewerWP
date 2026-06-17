import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CAMPAIGNS_URL = '**/wp-json/wp-super-gallery/v1/campaigns**';

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
        body: JSON.stringify({ items: [publicCampaign] }),
      });
    });

    await page.goto('/');
    // Wait for the campaign card to appear
    await expect(page.getByText('A11y Test Campaign')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
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
        body: JSON.stringify({ items: [publicCampaign] }),
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

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });

  test('campaign carousel has no critical/serious axe violations', async ({ page }) => {
    await page.route(CAMPAIGNS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [publicCampaign] }),
      });
    });
    await page.route('**/wp-json/wp-super-gallery/v1/campaigns/201/media', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(imageMedia),
      });
    });

    await page.goto('/');
    await expect(page.getByText('A11y Test Campaign')).toBeVisible();

    // Open campaign detail (click the campaign card/title)
    await page.getByText('A11y Test Campaign').click();

    // Wait for carousel region to appear
    await expect(page.getByRole('region', { name: /View image|Video \d/i }).first()).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });

  test('lightbox has no critical/serious axe violations', async ({ page }) => {
    await page.route(CAMPAIGNS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [publicCampaign] }),
      });
    });
    await page.route('**/wp-json/wp-super-gallery/v1/campaigns/201/media', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(imageMedia),
      });
    });

    await page.goto('/');
    await expect(page.getByText('A11y Test Campaign')).toBeVisible();
    await page.getByText('A11y Test Campaign').click();

    // Wait for carousel then click the zoom / image to open lightbox
    await expect(page.getByRole('region').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Open lightbox' }).click();

    // Wait for lightbox dialog
    await expect(page.getByRole('dialog', { name: 'Media lightbox' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"][aria-label="Media lightbox"]')
      .analyze();
    expect(criticalViolations(results.violations)).toEqual([]);
  });
});
