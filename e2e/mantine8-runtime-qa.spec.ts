import { test, expect, type Locator, type Page } from '@playwright/test';

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

const mediaPayload = [
  {
    id: 'm1',
    type: 'image',
    source: 'upload',
    url: 'https://example.com/gallery-image.jpg',
    thumbnail: 'https://example.com/gallery-thumb.jpg',
    title: 'Gallery image',
    caption: 'Gallery caption',
    order: 1,
    width: 1200,
    height: 800,
  },
];

async function installAdminSession(page: Page) {
  await page.addInitScript(() => {
    const globals = window as Window & {
      __WPSG_AUTH_PROVIDER__?: 'wp-jwt' | 'none';
      __WPSG_API_BASE__?: string;
      __WPSG_CONFIG__?: {
        enableJwt?: boolean;
        restNonce?: string;
      };
    };

    globals.__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    globals.__WPSG_API_BASE__ = 'http://127.0.0.1:5173';
    globals.__WPSG_CONFIG__ = {
      enableJwt: true,
      restNonce: 'test-nonce',
    };

    localStorage.setItem('wpsg_access_token', 'fake-token');
    localStorage.setItem(
      'wpsg_user',
      JSON.stringify({
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
      }),
    );
  });
}

async function installAppRoutes(page: Page) {
  let currentSettings: Record<string, unknown> = {
    theme: 'default-dark',
    authBarDisplayMode: 'floating',
    showInContextEditors: true,
    settingsDrawerBlurEnabled: true,
    advancedSettingsEnabled: true,
  };

  await page.route('**/wp-json/jwt-auth/v1/token/validate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        campaignIds: ['101'],
        isAdmin: true,
      }),
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/settings', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      currentSettings = {
        ...currentSettings,
        ...body,
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentSettings),
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(campaignsPayload),
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(campaignsPayload),
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/101/media', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mediaPayload),
    });
  });

  await page.route('**/wp-json/wp-super-gallery/v1/campaigns/101', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...campaignsPayload.items[0],
          ...body,
          updatedAt: '2026-01-03T00:00:00.000Z',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(campaignsPayload.items[0]),
    });
  });
}

async function prepareApp(page: Page) {
  await installAdminSession(page);
  await installAppRoutes(page);
}

async function selectOption(page: Page, scope: Locator, label: string, option: string) {
  await scope.getByRole('textbox', { name: label, exact: true }).click();
  const listbox = page.getByRole('listbox').last();
  await expect(listbox).toBeVisible();
  await listbox.getByRole('option', { name: option, exact: true }).click();
}

async function openAdminMenu(page: Page) {
  await page.getByRole('button', { name: 'Admin menu' }).click();
}

test('shadow DOM settings drawer and nested gallery editor remain usable', async ({ page }) => {
  await prepareApp(page);

  await page.goto('/');

  await expect.poll(async () => page.evaluate(() => !!document.getElementById('root')?.shadowRoot)).toBe(true);
  await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();

  await openAdminMenu(page);
  await page.getByRole('button', { name: /^Settings$/ }).click();

  const settingsPanel = page.getByRole('dialog', { name: 'Display Settings' });
  await expect(settingsPanel).toBeVisible();
  await expect(page.locator('[data-wpsg-component="SettingsPanel"][data-wpsg-slot="overlay"]')).toBeVisible();

  await settingsPanel.getByRole('tab', { name: 'Gallery & Media' }).click();
  await settingsPanel.getByRole('button', { name: 'Viewport Backgrounds' }).click();

  await selectOption(page, settingsPanel, 'Image Gallery Background', 'Solid Color');
  await expect(settingsPanel.getByLabel('Background Color', { exact: true })).toBeVisible();
  await settingsPanel.getByLabel('Background Color', { exact: true }).fill('#123456');

  await settingsPanel.getByRole('button', { name: 'Gallery Adapters' }).click();
  await settingsPanel.getByRole('button', { name: 'Edit Responsive Config' }).click();

  const galleryConfigEditor = page.getByRole('dialog', { name: 'Responsive Gallery Config' });
  await expect(galleryConfigEditor).toBeVisible();
  await expect(settingsPanel).toBeVisible();
  await expect(page.locator('[data-wpsg-component="GalleryConfigEditorModal"][data-wpsg-slot="overlay"]')).toBeVisible();

  await selectOption(page, galleryConfigEditor, 'Gallery Mode', 'Unified');
  await expect(galleryConfigEditor.getByText('Each breakpoint tab controls its own unified adapter and responsive settings.')).toBeVisible();
  await galleryConfigEditor.getByRole('button', { name: 'Apply Gallery Config' }).click();

  await expect(galleryConfigEditor).toBeHidden();
  await expect(settingsPanel).toBeVisible();

  await settingsPanel.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Settings saved successfully.')).toBeVisible();

  await page.locator('[data-wpsg-component="SettingsPanel"][data-wpsg-slot="close"]').click();
  await expect(settingsPanel).toBeHidden();
});

test('campaign viewer nested overlays stay usable in shadow DOM', async ({ page }) => {
  await prepareApp(page);

  await page.goto('/');

  await expect.poll(async () => page.evaluate(() => !!document.getElementById('root')?.shadowRoot)).toBe(true);
  await page.getByRole('button', { name: 'Open campaign Admin Campaign' }).click();

  const campaignViewer = page.locator('[data-wpsg-component="CampaignViewer"][data-wpsg-slot="content-shell"]');
  await expect(campaignViewer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close campaign viewer' })).toBeVisible();

  const inContextToggle = campaignViewer.locator('[data-wpsg-component="InContextEditor"][data-wpsg-slot="toggle"]').first();
  await expect(inContextToggle).toBeVisible();
  await inContextToggle.click();
  await expect(page.getByText('About Section')).toBeVisible();

  await openAdminMenu(page);
  await page.getByRole('button', { name: 'Edit gallery config for Admin Campaign' }).click();

  const galleryConfigEditor = page.getByRole('dialog', { name: 'Campaign Gallery Config' });
  await expect(galleryConfigEditor).toBeVisible();
  await expect(campaignViewer).toBeVisible();
  await expect(page.locator('[data-wpsg-component="GalleryConfigEditorModal"][data-wpsg-slot="overlay"]')).toBeVisible();

  await selectOption(page, galleryConfigEditor, 'Gallery Mode', 'Unified');
  await galleryConfigEditor.getByRole('button', { name: 'Save Campaign Gallery Config' }).click();

  await expect(page.getByText('Campaign gallery config updated.')).toBeVisible();
  await expect(galleryConfigEditor).toBeHidden();
  await expect(campaignViewer).toBeVisible();

  await page.locator('[data-wpsg-component="CampaignViewer"][data-wpsg-slot="close"]').click();
  await expect(campaignViewer).toBeHidden();
});

test('non-shadow mount still renders viewer flow', async ({ page }) => {
  await prepareApp(page);

  await page.goto('/?shadow=0');

  await expect.poll(async () => page.evaluate(() => !!document.getElementById('root')?.shadowRoot)).toBe(false);
  await expect(page.getByRole('button', { name: 'Admin menu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open campaign Admin Campaign' })).toBeVisible();

  await page.getByRole('button', { name: 'Open campaign Admin Campaign' }).click();

  const campaignViewer = page.locator('[data-wpsg-component="CampaignViewer"][data-wpsg-slot="content-shell"]');
  await expect(campaignViewer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close campaign viewer' })).toBeVisible();
  await expect(campaignViewer.getByText('Admin description')).toBeVisible();

  await page.locator('[data-wpsg-component="CampaignViewer"][data-wpsg-slot="close"]').click();
  await expect(campaignViewer).toBeHidden();
});