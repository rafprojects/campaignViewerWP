import { test, expect } from '@playwright/test';

test('admin actions call REST endpoints', async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & {
      __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
      __WPSG_API_BASE__?: string;
    }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    (window as Window & {
      __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
      __WPSG_API_BASE__?: string;
    }).__WPSG_API_BASE__ = 'http://localhost:5173';
    localStorage.setItem('wpsg_access_token', 'fake-token');
    localStorage.setItem(
      'wpsg_user',
      JSON.stringify({ id: '1', email: 'admin@example.com', role: 'viewer' }),
    );
  });

  const counts = { put: 0, postArchive: 0, postMedia: 0 };

  await page.route('**/wp-json/jwt-auth/v1/token/validate', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ campaignIds: ['101'], isAdmin: true }),
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/**/media**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    counts.postMedia += 1;
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/101/archive', async (route) => {
    counts.postArchive += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/101', async (route) => {
    if (route.request().method() === 'PUT') {
      counts.put += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  const campaignsPayload = {
    items: [
      {
        id: '101',
        companyId: 'acme',
        title: 'Admin Campaign',
        description: 'Admin description',
        thumbnail: 'https://example.com/thumb.jpg',
        coverImage: 'https://example.com/cover.jpg',
        status: 'active',
        visibility: 'private',
        tags: ['admin'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
  };

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(campaignsPayload),
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(campaignsPayload),
    });
  });

  const promptValues = [
    'Updated Title',
    'Updated Description',
    'video',
    'https://example.com/video',
    'Caption',
    'https://example.com/thumb.jpg',
  ];

  page.on('dialog', async (dialog) => {
    const type = dialog.type();
    if (type === 'confirm') {
      await dialog.accept();
      return;
    }
    if (type === 'prompt') {
      const value = promptValues.shift() ?? '';
      await dialog.accept(value);
      return;
    }
    await dialog.accept();
  });

  const openCampaign = async () => {
    const closeViewer = page.getByRole('button', { name: 'Close campaign viewer' });
    if (await closeViewer.isVisible()) {
      await closeViewer.click();
    }
    await page.getByText('Admin Campaign').click();
  };

  await page.goto('/');

  await openCampaign();

  await page.getByRole('button', { name: 'Edit Campaign' }).click();
  await expect(page.getByText('Campaign updated.')).toBeVisible();

  await openCampaign();
  await page.getByRole('button', { name: 'Manage Media' }).click();
  await expect(page.getByText('Media added.')).toBeVisible();

  await openCampaign();
  await page.getByRole('button', { name: 'Archive Campaign' }).click();
  await expect(page.getByText('Campaign archived.')).toBeVisible();

  await expect.poll(() => counts.put).toBeGreaterThan(0);
  await expect.poll(() => counts.postMedia).toBeGreaterThan(0);
  await expect.poll(() => counts.postArchive).toBeGreaterThan(0);
});
