# Phase 49 - Quality & Infrastructure: A11y, Performance, i18n, Testing & Storybook

**Status:** In progress
**Created:** 2026-06-09
**Last updated:** 2026-06-09

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P49-A | Accessibility audit — keyboard nav, ARIA roles, focus trapping, screen-reader labels | To do | Medium |
| P49-B | Bundle size / perf audit — profile bundle, fix heavy imports, chunk-split unlazy adapters | To do | Medium |
| P49-C | i18n groundwork — `wp_localize_script` + `i18next`; English strings become default namespace | To do | Medium |
| P49-D | Automated visual regression — Playwright screenshot tests per adapter at 3 viewport widths | To do | Medium |
| P49-E | Storybook — install `@storybook/react-vite`; stories for AssetUploader, LayoutCanvas, all adapters | To do | Medium |
| P49-F | Thumbnail Cache Index scalability — per-hash `wp_options` entries instead of single autoloaded row | To do | Medium |
| P49-G | `get_campaigns_for_attachment_id()` N+1 audit + test — O(1) rewrite deferred to Phase 50+ | To do | Small-Medium |

---

## Rationale

1. After three feature-heavy phases (P45–P48), the quality and infrastructure baseline needs attention before the Phase 50 feature sprint: a11y gaps, an unaudited bundle, and zero visual regression coverage are the highest-risk items standing between the codebase and confident external contributions.
2. i18n scaffolding is cheap to add early and expensive to retrofit later; establishing the translation layer before Phase 50 adds more user-visible strings (Spaces UI, new adapters) avoids a retroactive string-extraction sweep.
3. Storybook and visual regression are co-located in the same phase intentionally: the story fixtures become the screenshot baselines, so both are set up and validated together rather than leaving baselines stale from day one.
4. The two PHP infrastructure items (thumbnail cache index, N+1 audit) are self-contained with no frontend impact; co-locating them here avoids a dedicated PHP-only phase and pairs them with the PHP-side i18n work.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | i18n library | `wp_localize_script` for PHP→JS injection + `i18next` / `react-i18next` on the React side — matches the WP plugin idiom without requiring a third-party WP i18n plugin. |
| B | Visual regression tooling | Playwright screenshot tests committed to the repo — avoids a paid Chromatic/cloud dependency while still providing CI-enforced baselines. |
| C | Storybook scope | `AssetUploader`, `GraphicLayerPropertiesPanel`, `LayoutCanvas` (mock slots), and every registered gallery adapter with a fixed 9-item media fixture; adapter stories double as the P49-D visual regression source. |
| D | N+1 fix gating | The full O(1) rewrite of `get_campaigns_for_attachment_id()` requires extending `wpsg_media_refs` with an attachment-ID index, which is out of scope for Phase 49. P49-G delivery is the test harness + code comment; the rewrite is a Phase 50+ item once the mapping table is designed. |

## Execution Priority

1. **P49-B** — Bundle audit first: surfaces any adapter lazy-loading gaps that would affect P49-D snapshot sizes.
2. **P49-F** — Pure PHP, no dependencies; quick win.
3. **P49-G** — Pure PHP audit + test; no frontend work.
4. **P49-A** — a11y spans both frontend and PHP-rendered markup; done before Storybook so stories reflect fixed aria attributes.
5. **P49-E** — Storybook tooling setup; needed before visual regression baselines can be captured.
6. **P49-D** — Visual regression; depends on P49-E stories.
7. **P49-C** — i18n string extraction is easier after the a11y pass has touched all UI labels.

---

## Track P49-A — Accessibility Audit

### Problem

No systematic a11y pass has been performed. The highest-risk areas are:
- **Focus trapping** in `Modal` and `Lightbox` — keyboard users can tab out of open overlays.
- **Keyboard navigation** in gallery adapters — tile grids are not roving-tabindex navigable; arrow keys do nothing.
- **Icon-only buttons** in the builder toolbar have no `aria-label` or `title`.
- **Live regions** — async operations (upload progress, export status, space-switcher loading) have no `aria-live` announcements.
- **ARIA roles** on dynamic content — the admin tab panel, space switcher, and drag-drop zones may lack correct roles.

### Fix

- Audit using axe-core (via `@axe-core/playwright` in the Playwright suite and browser DevTools). Target: zero WCAG 2.1 AA violations.
- **Lightbox / Modal:** verify Mantine's `FocusTrap` is active; ensure `aria-modal="true"` and `role="dialog"` are present; confirm `Escape` closes and focus returns to the trigger element.
- **Adapter grids:** implement a roving tabindex pattern on tile containers; `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` move focus; `Enter`/`Space` open the lightbox.
- **Builder toolbar:** add `aria-label` to all `ActionIcon` components that use icons without visible text.
- **Live regions:** add `aria-live="polite"` regions for upload progress notifications and export job status.
- **Drag-drop zone:** `role="region"` + `aria-label="File drop zone"` on the `MediaAddModal` dropzone.

**Files:** `src/components/Galleries/Shared/Lightbox.tsx`, all adapter tile components, builder toolbar (`src/components/Builder/`), `src/components/Admin/MediaAddModal.tsx`, notification/upload progress components.

### Acceptance criteria

- Automated: `@axe-core/playwright` reports zero WCAG 2.1 AA violations on the gallery public view and the admin SPA main surfaces.
- Manual: keyboard-only session through the gallery (tab, arrow, Enter/Escape) completes without a focus escape; screen reader (VoiceOver or NVDA) announces modal open/close and upload completion.

### Validation

- Playwright a11y test (`axe.run()` on gallery and admin page fixtures).
- Manual keyboard walkthrough; screen-reader smoke test.

---

## Track P49-B — Bundle Size / Performance Audit

### Problem

No bundle baseline exists. Concerns:
- Adapters introduced after the initial lazy-loading refactor may not all be behind `React.lazy`.
- Settings/builder code paths may have heavy transitive imports (date libraries, icon sets) that could be tree-shaken or split.
- No gzip-size budget is enforced; regressions go undetected.

### Fix

- Add `rollup-plugin-visualizer` to `vite.config.ts` (dev/analyze mode only).
- Run `vite build --mode analyze`; inspect the treemap for any synchronously-bundled adapter or oversize chunk.
- Ensure every adapter in `adapterRegistry.ts` is loaded via `React.lazy(() => import(...))` — audit all nine current adapters plus the two coming in Phase 48.
- Identify and fix any heavy transitive import (e.g. replace a full icon library import with a named sub-path import).
- Establish size budgets in `vite.config.ts` `build.chunkSizeWarningLimit` and document targets: each adapter chunk < 50 kB gzipped, main entry < 200 kB gzipped.
- Add a CI step (`vite build && size-limit` or equivalent) that fails on budget breach.

**Files:** `vite.config.ts`, `src/components/Galleries/Adapters/adapterRegistry.ts`, any identified heavy modules.

### Acceptance criteria

- All registered adapters are lazy-loaded (`React.lazy`); none appear in the main entry chunk.
- Main entry chunk ≤ 200 kB gzipped; no adapter chunk > 50 kB gzipped.
- CI build step enforces budget and fails with a clear message on regression.

### Validation

- `vite build --mode analyze` treemap reviewed; no synchronous adapter imports visible in main chunk.
- `size-limit` (or equivalent) output in CI passes.

---

## Track P49-C — i18n Groundwork

### Problem

All user-visible strings are hardcoded English literals scattered across the React SPA and PHP templates. Retrofitting i18n at scale (100+ components) after Phase 50 would require a multi-week pass touching every file; scaffolding now costs one focused phase.

### Fix

**React side:**
- Install `i18next` and `react-i18next` as production dependencies.
- Add `src/i18n.ts`: initialise `i18next` with a `wpsg` namespace; load string values from `window.wpsgI18n.strings` (injected by PHP). Fall back to the key itself so the UI degrades gracefully if the PHP data is missing.
- Bootstrap `i18next` in `src/main.tsx` before the React tree renders.
- Replace all hardcoded JSX string literals with `t('namespace:key')` across the admin SPA. English literals become the default namespace values — no new `.po` files needed yet.
- Add an ESLint rule (e.g. `eslint-plugin-i18next`) that flags raw string literals in JSX so future contributors can't accidentally bypass the translation layer.

**PHP side:**
- Declare `wpsg` as the plugin text domain in the main plugin file (`load_plugin_textdomain('wpsg', ...)`).
- Audit all `__()` / `_e()` / `esc_html__()` calls in PHP templates and REST response strings; ensure they use `'wpsg'` as domain.
- Collect all PHP-side strings that the React SPA needs (e.g. nonce labels, server-generated error messages) and expose them via `wp_localize_script('wpsg-app', 'wpsgI18n', ['strings' => [...]])`.

**Files:** `src/i18n.ts` (new), `src/main.tsx`, representative high-string-count components (e.g. `src/components/Admin/`, `src/components/Settings/`), `wp-super-gallery.php`, `wp-plugin/wp-super-gallery/includes/` PHP controllers that return user-visible strings.

### Acceptance criteria

- `i18next` initialises without errors; `t('key')` calls resolve to English text from the injected namespace.
- PHP text domain is declared; `load_plugin_textdomain` runs; `wp i18n make-pot` produces a valid `.pot` file with all `wpsg`-domain strings.
- ESLint rule active; a bare JSX string literal triggers a lint error.
- No user-visible regressions — all strings display correctly in English.

### Validation

- Unit test: `i18n.ts` bootstrap with a mock `window.wpsgI18n` resolves keys correctly.
- Manual: run the app; all UI text renders; no `[missing: wpsg:key]` placeholders.
- `wp i18n make-pot` succeeds with a non-empty `.pot` file.
- Introduce a bare JSX string literal; confirm lint fails.

---

## Track P49-D — Automated Visual Regression

### Problem

Layout regressions in gallery adapters go undetected until manual review. Each adapter has distinct CSS Grid / transform / perspective logic that is fragile to style changes; no automated baseline exists.

### Fix

- Add a `e2e/visual/` directory with Playwright screenshot tests.
- For each registered adapter, render it at three viewport widths (375 px, 768 px, 1280 px) with a fixed 9-item media fixture (stable filenames, consistent aspect ratios — mix of landscape, portrait, square).
- Capture screenshots as committed PNG baselines (`e2e/visual/__snapshots__/`).
- CI runs `playwright test e2e/visual` and fails on pixel diff above a 0.1% threshold.
- Document the `npx playwright test --update-snapshots` command for intentional baseline updates.

**Files:** `e2e/visual/` (new), `playwright.config.ts` (or extend existing), `e2e/visual/fixtures/` (stable test media), `e2e/visual/__snapshots__/`.

### Acceptance criteria

- All registered adapters have snapshot tests at all three breakpoints.
- Introducing a 1 px off-by-one margin regression causes at least one test to fail.
- Baseline update command is documented and produces clean diffs in git.

### Validation

- `playwright test e2e/visual` passes on a clean checkout.
- Introduce a deliberate CSS change to one adapter; confirm the test fails with a diff image.

---

## Track P49-E — Storybook

### Problem

Contributors must run the full WordPress + PHP stack to work on or inspect React components. There is no isolated component development environment, no consistent fixture-driven rendering, and no visual catalogue.

### Fix

- Install `@storybook/react-vite` as a devDependency (adds ~200 MB to `node_modules` — acceptable for dev-only).
- Configure `.storybook/main.ts` to reuse the existing Vite config (path aliases, CSS Modules).
- Write stories:
  - `AssetUploader.stories.tsx` — idle, file-selected, uploading (mocked progress), error states.
  - `GraphicLayerPropertiesPanel.stories.tsx` — mock slot with representative graphic layer props.
  - `LayoutCanvas.stories.tsx` — mock slot grid (3×3) with selectable/draggable states.
  - One story per registered gallery adapter with the same 9-item media fixture used in P49-D; adapter stories function as the visual regression snapshot source.
- Add `"storybook": "storybook dev -p 6006"` and `"build-storybook": "storybook build"` to `package.json` scripts.

**Files:** `.storybook/` (new), `src/components/Admin/AssetUploader.stories.tsx` (new), `src/components/Builder/LayoutCanvas.stories.tsx` (new), `src/components/Galleries/Adapters/*/stories.tsx` (new, one per adapter).

### Acceptance criteria

- `npm run storybook` starts without errors; all stories render in the browser.
- No story imports the WordPress REST API or any live WP context — all data is mocked via story args or fixtures.
- Adapter stories display the same 9-item fixture used in P49-D visual regression tests.

### Validation

- `npm run storybook`; browse all stories; no console errors.
- `npm run build-storybook`; static build succeeds.

---

## Track P49-F — Thumbnail Cache Index Scalability

### Problem

`WPSG_Thumbnail_Cache` stores its entire index in a **single `wp_options` row** with `autoload=yes`. Every WordPress page load fetches this row as part of the autoload batch. On large sites with many unique image/dimension combinations (high-volume media libraries, many distinct thumbnail sizes) the row grows large, bloating the autoload query.

### Fix

- Replace the single-row index with individual `wp_options` entries:
  - Key pattern: `wpsg_thumb_<md5_of_hash>` with `autoload='no'`.
  - On first write after upgrade, the old single-row index (if present) is read, individual entries are written, and the old row is deleted.
  - Cache reads use `get_option('wpsg_thumb_<hash>')` directly; no in-memory index array needed.
- The cache is self-healing (a miss simply regenerates the thumbnail) so any migration failure is non-destructive.
- Add `autoload='no'` explicitly to avoid any future WordPress autoload regression.

**Files:** `wp-plugin/wp-super-gallery/includes/class-wpsg-thumbnail-cache.php`

### Acceptance criteria

- After a populated-DB upgrade, the old `wpsg_thumbnail_index` `wp_options` row no longer exists.
- Per-hash rows exist with `autoload=no`; thumbnails resolve correctly on cache hit.
- A cold cache (all rows deleted) regenerates on demand — no fatal errors.
- Idempotent: running the migration twice is a no-op.

### Validation

- PHP: migration test — populate old-format index, run migration, assert individual rows exist and old row is gone.
- Manual: clear cache, load a gallery, confirm thumbnails render.

---

## Track P49-G — `get_campaigns_for_attachment_id()` N+1 Audit

### Problem

`get_campaigns_for_attachment_id()` in `class-wpsg-db.php` fetches every campaign ID from `wp_posts`, then calls `get_post_meta()` once per campaign to scan its `media_items` serialized array in PHP. On sites with many campaigns this is O(campaigns) in both queries and memory. The function is only called when an uploaded file matches an existing attachment's MD5 or pHash (409 conflict enrichment), so real-world cost is negligible today — but the pattern should be fixed before the mapping table opportunity closes.

The full O(1) fix requires a dedicated WP-attachment-ID → campaign mapping column or table (extending `wpsg_media_refs`) that does not exist yet. Phase 49 delivery is the audit harness; the rewrite is Phase 50+.

### Fix

- Add a PHPUnit test fixture with N campaigns (N = 10, 50, 100) each containing a known attachment ID.
- Assert that `get_campaigns_for_attachment_id($attachment_id)` with N=50 triggers ≤ N+2 database queries (the current expected O(N) bound).
- Add a `_doing_it_wrong()` / `error_log` warning inside the function when `count($campaign_ids) > 50`, flagging the performance cliff.
- Add a `// TODO(P50): replace with wpsg_media_refs attachment-ID index once mapping table is extended` comment with a link to this track.

**Files:** `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php`, relevant PHPUnit test file.

### Acceptance criteria

- New test passes and quantifies the query count at N = 10, 50, 100.
- The `> 50` warning fires during the test (assertable via `$this->setExpectedDeprecated` or log capture).
- No behavior change visible to users.

### Validation

- `composer test` passes; new test visible in output with query-count assertions.

---

## Phase 50 Preview

Phase 50 will be a feature phase drawing from:

**Gallery Spaces follow-ons (both depend on Phase 47 core):**
- Cross-Space Campaign Move — atomic `space_id` re-stamp across all four campaign-scoped tables in a transaction.
- Per-Space Library Isolation (Overlays / Fonts) — `wpsg_space_library_assoc` join table; visible-to-space filtering in delegated mode.

**Gallery adapters:**
- Stacked / Deck — cards stacked with offset/rotation; swipe to cycle.
- Isotope / Filterable Grid — FLIP-animated filter/sort transitions; extends adapter interface to accept filter/sort props.

**Remaining deferred adapters** (Waterfall, Timeline, Grid with Variable Aspect-Ratio Tiles) are candidates for Phase 50 or a later adapter-focused phase depending on scope.
