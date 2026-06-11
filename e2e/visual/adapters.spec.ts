/**
 * P49-D: Visual regression tests for all registered gallery adapters.
 *
 * Each adapter is rendered in isolation via its Storybook story iframe
 * at three viewport widths (375 mobile, 768 tablet, 1280 desktop).
 * Screenshots are compared against committed baselines in __snapshots__/.
 *
 * Update baselines after intentional visual changes:
 *   npx playwright test --config=playwright.visual.config.ts --update-snapshots
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

const ADAPTERS: Array<{ id: string; storyId: string }> = [
  { id: 'carousel',    storyId: 'adapters-mediacarousel-classic--default' },
  { id: 'compact-grid', storyId: 'adapters-compactgrid--default' },
  { id: 'justified',   storyId: 'adapters-justified--default' },
  { id: 'masonry',     storyId: 'adapters-masonry--default' },
  { id: 'hexagonal',   storyId: 'adapters-hexagonal--default' },
  { id: 'circular',    storyId: 'adapters-circular--default' },
  { id: 'diamond',     storyId: 'adapters-diamond--default' },
  { id: 'scroll-snap', storyId: 'adapters-scrollsnap--default' },
  { id: 'coverflow',   storyId: 'adapters-coverflow--default' },
  { id: 'pinterest',   storyId: 'adapters-pinterest--default' },
  { id: 'spotlight',   storyId: 'adapters-spotlight--default' },
];

for (const adapter of ADAPTERS) {
  for (const viewport of VIEWPORTS) {
    test(`${adapter.id} @ ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const url = `/iframe.html?id=${adapter.storyId}&viewMode=story`;
      await page.goto(url);

      // Wait for images: the story renders picsum.photos thumbnails;
      // wait for the first visible img to finish loading (or 3 s max).
      await page.waitForFunction(
        () => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs.length === 0 || imgs.some((img) => img.complete && img.naturalWidth > 0);
        },
        { timeout: 8_000 },
      ).catch(() => { /* continue even if no image loads in time */ });

      // Additional settle time for CSS transitions / lazy renders.
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${adapter.id}-${viewport.name}.png`, {
        fullPage: false,
        clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
      });
    });
  }
}
