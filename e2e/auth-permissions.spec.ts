import { test, expect } from '@playwright/test';

test.describe('auth and permissions', () => {
  test('login flow shows campaigns with permissions', async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & {
        __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
        __WPSG_API_BASE__?: string;
      }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
      (window as Window & {
        __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
        __WPSG_API_BASE__?: string;
      }).__WPSG_API_BASE__ = 'http://localhost:5173';
    });

    await page.route('**/wp-json/jwt-auth/v1/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'fake-token',
          user_id: 1,
          user_email: 'viewer@example.com',
        }),
      });
    });

    await page.route('**/wp-json/jwt-auth/v1/token/validate', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.route('**/wp-json/wp-super-gallery/v1/permissions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ campaignIds: ['2'], isAdmin: false }),
      });
    });

    await page.route('**/wp-json/wp-super-gallery/v1/campaigns**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              companyId: 'acme',
              title: 'Public Campaign',
              description: 'Public description',
              thumbnail: 'https://example.com/thumb.jpg',
              coverImage: 'https://example.com/cover.jpg',
              status: 'active',
              visibility: 'public',
              tags: ['launch'],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
            {
              id: '2',
              companyId: 'acme',
              title: 'Private Campaign',
              description: 'Private description',
              thumbnail: 'https://example.com/thumb.jpg',
              coverImage: 'https://example.com/cover.jpg',
              status: 'active',
              visibility: 'private',
              tags: ['private'],
              createdAt: '2026-01-03T00:00:00.000Z',
              updatedAt: '2026-01-04T00:00:00.000Z',
            },
          ],
        }),
      });
    });

    await page.route('**/wp-json/wp-super-gallery/v1/campaigns/2/media', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await page.getByLabel('Email').fill('viewer@example.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Public Campaign')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Private Campaign' })).toBeVisible();
  });

  test('hide mode removes private campaigns without access', async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & {
        __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
        __WPSG_API_BASE__?: string;
        __WPSG_ACCESS_MODE__?: 'lock' | 'hide';
      }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
      (window as Window & {
        __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
        __WPSG_API_BASE__?: string;
        __WPSG_ACCESS_MODE__?: 'lock' | 'hide';
      }).__WPSG_API_BASE__ = 'http://localhost:5173';
      (window as Window & {
        __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
        __WPSG_API_BASE__?: string;
        __WPSG_ACCESS_MODE__?: 'lock' | 'hide';
      }).__WPSG_ACCESS_MODE__ = 'hide';
      localStorage.setItem('wpsg_access_mode', 'hide');
      localStorage.removeItem('wpsg_access_token');
      localStorage.removeItem('wpsg_user');
      localStorage.removeItem('wpsg_permissions');
    });

    await page.route('**/wp-json/jwt-auth/v1/token/validate', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.route('**/wp-json/wp-super-gallery/v1/permissions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ campaignIds: [], isAdmin: false }),
      });
    });

    await page.route('**/wp-json/wp-super-gallery/v1/campaigns**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              companyId: 'acme',
              title: 'Public Campaign',
              description: 'Public description',
              thumbnail: 'https://example.com/thumb.jpg',
              coverImage: 'https://example.com/cover.jpg',
              status: 'active',
              visibility: 'public',
              tags: ['launch'],
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
            {
              id: '2',
              companyId: 'acme',
              title: 'Private Campaign',
              description: 'Private description',
              thumbnail: 'https://example.com/thumb.jpg',
              coverImage: 'https://example.com/cover.jpg',
              status: 'active',
              visibility: 'private',
              tags: ['private'],
              createdAt: '2026-01-03T00:00:00.000Z',
              updatedAt: '2026-01-04T00:00:00.000Z',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    await expect(page.getByText('Public Campaign')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Private Campaign' })).toHaveCount(0);
    await expect(page.getByText(/hidden by access mode/i)).toBeVisible();
  });
});
