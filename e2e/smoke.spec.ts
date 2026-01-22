import { test, expect } from '@playwright/test';

test('renders campaign gallery with mocked API', async ({ page }) => {
  await page.route('**/wp-json/wp-super-gallery/v1/campaigns**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '101',
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
        ],
      }),
    });
  });

  await page.goto('/');

  await expect(page.getByText('Campaign Gallery')).toBeVisible();
  await expect(page.getByText('Public Campaign')).toBeVisible();
});
