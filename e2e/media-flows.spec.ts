import { test, expect } from '@playwright/test';

test('admin media flows: upload, external add, edit, delete, reorder', async ({ page }) => {
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
      JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }),
    );
  });

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

  const mediaItems: any[] = [];
  let lastReorderItems: any[] = [];

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/101/media', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mediaItems) });
      return;
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON();
      const item = { id: `m${mediaItems.length + 1}`, order: mediaItems.length + 1, ...body };
      mediaItems.push(item);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(item) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/101/media/**', async (route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      const update = route.request().postDataJSON();
      const id = route.request().url().split('/').pop() ?? '';
      const existing = mediaItems.find((item) => item.id === id) ?? {};
      const updated = { ...existing, ...update };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) });
      return;
    }
    if (method === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/101/media/reorder', async (route) => {
    try {
      const body = route.request().postDataJSON();
      const items = Array.isArray(body?.items) ? body.items : [];
      if (items.length) {
        lastReorderItems = items;
        const orderMap = new Map(items.map((it: any) => [it.id, it.order]));
        mediaItems.sort((a, b) => (orderMap.get(a.id) ?? a.order) - (orderMap.get(b.id) ?? b.order));
        mediaItems.forEach((it, i) => { it.order = i + 1; });
      }
    } catch (e) {
      // ignore
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/media/upload', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ attachmentId: '99', url: 'https://example.com/file.jpg', mimeType: 'image/jpeg' }),
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/oembed?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Example Video', thumbnail_url: 'https://example.com/thumb.jpg', provider_name: 'YouTube' }),
    });
  });

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.goto('/');

  await page.getByRole('button', { name: 'Admin Panel' }).click();
  await page.getByRole('tab', { name: 'Media' }).click();

  // Upload flow
  await page.getByRole('button', { name: 'Add Media' }).click();
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Choose file' }).click(),
  ]);
  await fileChooser.setFiles({
    name: 'upload.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('upload'),
  });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText('Media uploaded and added to campaign.')).toBeVisible();

  // External add flow
  await page.getByRole('button', { name: 'Add Media' }).click();
  await page.getByPlaceholder('https://youtube.com/...').fill('https://youtube.com/watch?v=dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('Preview loaded')).toBeVisible();
  await page.getByRole('dialog', { name: 'Add Media' }).getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('External media added.')).toBeVisible();

  // Edit flow
  const editButtons = page.getByRole('button', { name: 'Edit' });
  await editButtons.first().click();
  await page.getByLabel('Caption').fill('Updated caption');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Media updated.')).toBeVisible();

  // Reorder flow
  const downButtons = page.getByRole('button', { name: 'Move media down' });
  if (await downButtons.count()) {
    await downButtons.first().click();
  }

  // Verify reorder succeeded: expect success notification and that the
  // server received an items array for reordering.
  await expect(page.getByText('Reordered')).toBeVisible();
  expect(lastReorderItems.length).toBeGreaterThan(0);

  // Delete flow
  await page.getByRole('button', { name: 'Delete media' }).first().click();
  await expect(page.getByText('Media removed.')).toBeVisible();
});
