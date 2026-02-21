# Phase 13 — UX Polish, Performance & Campaign Scheduling

**Status:** In Progress  
**Version target:** v0.11.0  
**Created:** February 20, 2026  
**Last updated:** February 21, 2026

---

## Overview

Phase 13 focuses on UX polish, frontend performance, and campaign lifecycle management. Four tracks were promoted from `docs/FUTURE_TASKS.md`:

1. **P13-A — Modal CampaignViewer + Card Settings** ✅ COMPLETE
2. **P13-F — Card Gallery Pagination** ✅ COMPLETE
3. **P13-E — Mobile Readiness Audit** ✅ COMPLETE
4. **P13-B — Lazy Loading for Large Galleries**
5. **P13-C — Admin Panel Loading Performance**
6. **P13-D — Campaign Scheduling**

---

## Track P13-A — Modal CampaignViewer + Card Settings  ✅ COMPLETE

### Problem

CampaignViewer opened via `<Modal fullScreen>`, taking over the entire viewport. The "Back" button pattern felt like page navigation rather than a contextual preview. Additionally, card appearance and modal behavior had no admin-configurable settings.

### Delivered

- [x] Converted `<Modal fullScreen>` to centered `<Modal size="xl">` with `radius="lg"`
- [x] Modal transitions animate correctly (pop/fade/slide-up) via `opened` prop toggling
- [x] Component stays mounted during close animation (ref pattern)
- [x] Close button (X) replaces "Back" button; click-outside and Escape work
- [x] Cover image height reduced for modal context, Title demoted h1→h3
- [x] 13 configurable settings in "Campaign Card" settings tab (full stack):
  - Card: border radius, width, border mode (auto/single/individual), border color, shadow preset, thumbnail height, thumbnail fit
  - Grid: columns, gap
  - Modal: cover height, transition, duration, max height
- [x] Border color 3-mode system with per-card ColorInput in Edit Campaign
- [x] Theme persistence fix (localStorage priority over WP injection)
- [x] Theme form element contrast fix (surface2 inputs, autoContrast buttons)
- [x] CampaignViewer + CardGallery + SettingsPanel + PHP REST/Settings all updated
- [x] All 178 tests pass, build clean

**Commits:** `04f0167`, `4202fe4`

---

## Track P13-B — Lazy Loading for Large Galleries

### Problem

Galleries with many media items render all DOM elements upfront, causing slow initial paint and high memory usage for campaigns with 50+ items.

### Objectives

- Implement virtualized or intersection-observer-based lazy rendering for gallery adapters
- Load thumbnails/media only when scrolled into view
- Preserve adapter architecture — lazy loading should be opt-in per adapter or handled at the adapter dispatch layer
- Add a configurable threshold (e.g., items > N triggers lazy mode)

### Deliverables

- [ ] Add `IntersectionObserver`-based lazy image loading for classic carousel thumbnails
- [ ] Add progressive rendering for grid-based adapters (compact-grid, masonry, justified)
- [ ] Add placeholder/skeleton while media loads
- [ ] Test with large media sets (100+ items)
- [ ] Ensure lightbox still works correctly with lazy-loaded items

**Effort:** Medium  
**Impact:** High

---

## Track P13-C — Admin Panel Loading Performance

### Problem

Admin panel REST calls are sequential and uncached, causing noticeable load time when switching tabs or opening the panel repeatedly.

### Objectives

- Profile admin REST call waterfall (settings, campaigns, media, access)
- Introduce SWR or equivalent caching for hot paths (settings, campaign list)
- Parallelize non-blocking requests at panel open
- Add loading skeleton states for perceived performance

### Deliverables

- [ ] Audit and document current admin REST call sequence and timings
- [ ] Migrate settings fetch to SWR with stale-while-revalidate
- [ ] Parallelize campaign list + settings fetch on panel open
- [ ] Add skeleton/shimmer loading states for campaign list and media grids
- [ ] Measure improvement (before/after)

**Effort:** Medium  
**Impact:** Medium

---

## Track P13-D — Campaign Scheduling

### Problem

Campaigns are either active or archived — there is no way to schedule future publish or automatic unpublish dates.

### Objectives

- Add `publishAt` and `unpublishAt` optional date fields to campaigns
- Enforce scheduling rules in the REST layer (campaign not visible before publishAt, auto-hidden after unpublishAt)
- Add admin UI for setting/clearing schedule dates
- Add visual indicators in gallery cards for scheduled/expired campaigns

### Deliverables

- [ ] Add `publishAt` / `unpublishAt` fields to campaign types (TS + PHP)
- [ ] Add scheduling logic in REST responses (filter by current date)
- [ ] Add DatePicker UI in admin campaign edit form
- [ ] Add schedule badge on campaign cards (e.g., "Scheduled", "Expired")
- [ ] Add PHP cron or lazy-check for auto-archiving past unpublishAt
- [ ] Add unit tests for schedule filtering logic

**Effort:** Medium–High  
**Impact:** Medium

---

## Track P13-E — Mobile Readiness Audit  ✅ COMPLETE

### Problem

The application has not been systematically verified for mobile viewports. Touch targets, responsive layouts, scroll behavior, and modal interactions may not work properly on phones and small tablets.

### Audit Findings & Fixes

#### CRITICAL (all fixed)

| # | Component | Issue | Fix |
|---|-----------|-------|-----|
| 1 | CampaignViewer | `vh` for maxHeight broken on mobile Safari (address bar) | Changed to `dvh` |
| 2 | DotNavigator | Dot buttons as small as 8×8px — untappable | 44px transparent touch area wrapping visual dot |
| 3 | ImageCarousel / VideoCarousel | Fixed pixel height doesn't adapt to mobile | Scale to 55% on <576px, 75% on <768px |
| 4 | SettingsPanel | Modal `size="lg"` (800px) overflows 768px tablet | Responsive: `100%` <768px, `fullScreen` <576px |
| 5 | MediaAddModal | URL input crushed by inline buttons | Stacked layout: TextInput above button Group |
| 6 | Lightbox | iframe/video/image use `vh` — broken on mobile | Changed all to `dvh` |

#### MODERATE (all fixed)

| # | Component | Issue | Fix |
|---|-----------|-------|-----|
| 7 | CampaignViewer | Not fullScreen on phones | `fullScreen` when <576px |
| 8 | EditCampaignModal | Not fullScreen on phones | `fullScreen` + `size="100%"` when <576px |
| 9 | KeyboardHintOverlay | Keyboard shortcuts shown on touch devices | Early return when `ontouchstart` or `maxTouchPoints > 0` |
| 10 | MediaCard | Compact action icons at `size="xs"` (~24px) | Upgraded to `size="sm"` |
| 11 | OverlayArrows | Arrow size can be below 44px touch target | Enforce `Math.max(44, navArrowSize)` |
| 12 | CardGallery | Search input `minWidth: 200` causes overflow on <480px | Changed to `min(200px, 100%)` |
| 13 | MediaLightboxModal | Image max-height uses `vh` | Changed to `dvh` |
| 14 | Global SCSS | Button `min-width` not 44px on mobile | Added `min-width: 44px` to <576px media query |
| 15 | CampaignCard | Media stat font-size at 0.75rem (12px) | Increased to 0.8125rem (13px) |

#### MINOR (fixed)

| # | Component | Issue | Fix |
|---|-----------|-------|-----|
| 16 | CampaignCard | Company badge overflows on narrow screens | Added `maw="70%"` with text-overflow ellipsis |
| 17 | Lightbox | Caption area lacks safe-area-inset for iPhone home bar | Added `env(safe-area-inset-bottom)` padding |

### Pre-existing Good Patterns

- Safe area inset on sticky header (CardGallery)
- `font-size: 16px` on mobile (prevents iOS input zoom)
- Responsive thumbnail heights via Mantine breakpoints
- Responsive grid columns (`base: 1, sm: 2, lg: 3`)
- `useSwipe` hook with `touchAction: 'pan-y'` on carousels
- `Group wrap="wrap"` used extensively to prevent overflow
- `prefers-reduced-motion` media query for animation opt-out
- `word-wrap: break-word` on headings
- `-webkit-overflow-scrolling: touch` for smooth mobile scrolling
- `loading="lazy"` on images throughout
- Responsive media grid spans in admin MediaTab

### Deliverables

- [x] Document audit findings per component/view
- [x] Fix touch target sizing issues (DotNavigator, OverlayArrows, MediaCard, global SCSS)
- [x] Fix modal/overlay viewport issues on mobile (CampaignViewer, SettingsPanel, EditCampaignModal, Lightbox, MediaLightboxModal)
- [x] Fix any horizontal overflow or layout breaks (CardGallery search, MediaAddModal, CampaignCard badge)
- [x] Verify card grid responsive behavior (already good — base:1/sm:2/lg:3)
- [x] Test gallery carousel swipe on touch viewports (already good — useSwipe hook)
- [x] Verify admin settings panel usability on tablet (responsive modal sizing)
- [x] Hide keyboard hints on touch devices (KeyboardHintOverlay)
- [x] Add safe-area-inset support (Lightbox caption)

### Post-Audit Additions

#### CampaignViewer modal & filter fixes
- CampaignViewer: `useMediaQuery` for reactive `fullScreen` (≤768px), radius=0 on mobile, 100dvh maxHeight
- CardGallery: fix filter tab strip overflow with `minWidth:0` + `overflow:hidden`
- AuthBar: mobile redesign — collapsed overflow Menu on ≤576px

#### Header visibility toggles
5 new boolean settings with full-stack wiring (types → apiClient → App → SettingsPanel → PHP):
- `showGalleryTitle`, `showGallerySubtitle`, `showAccessMode`, `showFilterTabs`, `showSearchBox`

#### App layout controls
- **appMaxWidth** (0–3000px, default 1200): Container max-width. Set to 0 for full-width using Mantine `fluid` prop.
- **appPadding** (0–100px, default 16): Overrides Mantine Container's default `padding-inline` on all containers (App, CardGallery, AuthBar). Set to 0 for true edge-to-edge content.
- **Compact grid mobile scaling**: CSS `min()` clamps card sizes on mobile
- **Sticky settings footer**: `position: sticky; bottom: 0` for save/reset buttons
- **Justified/masonry fix**: Normalized photo dimensions to consistent reference height
- **Per-gallery tile sizes**: Split `tileSize` into `imageTileSize` / `videoTileSize`

#### Lightbox animation
- 250ms fade+scale open/close via 4-phase state machine (closed→entering→open→exiting→closed)

#### WP Full Bleed — responsive breakpoints
WordPress block themes apply `.has-global-padding` with `padding-left/right` to the container housing the shortcode. The `is-layout-constrained` class also enforces `max-width` on direct children. To counteract this:
- Wrapper div with `class="alignfull wpsg-full-bleed"` overrides constrained layout
- Injected `<style>` block applies negative margins via media queries per breakpoint
- 3 independent switch settings in Settings → General tab:
  - `wpFullBleedDesktop` (≥ 1024px)
  - `wpFullBleedTablet` (768–1023px)
  - `wpFullBleedMobile` (< 768px)
- Uses WP's own CSS variables (`--wp--style--root--padding-left/right`) so it adapts to any theme

**Commits:** `25e4f63`, `f65559e`, `42997d4`, `f108692`, (current)

**Effort:** Medium  
**Impact:** High

---

## Track P13-F — Card Gallery Pagination  ✅ COMPLETE

### Problem

The card gallery currently uses a "Load more" progressive pattern that appends 12 cards at a time. For galleries with many campaigns, this creates an ever-growing page. Admins need the option to show a fixed number of card rows per page with arrow navigation, similar to the classic gallery carousel.

### Design

**Three display modes** (admin-configurable in Campaign Card settings tab):

| Mode | Behavior |
|------|----------|
| `show-all` | All cards rendered at once, no pagination |
| `load-more` | Current behavior — 12 cards initially, "Load more" button appends batches |
| `paginated` | Fixed rows per page with arrow navigation |

**Rows-per-page calculation:**
- The setting controls **rows per page** (e.g., 2, 3, 4), not card count
- Actual cards per page = `rowsPerPage × currentColumnCount`
- Column count is determined by the existing responsive `cardGridColumns` setting (auto = 1/2/3 at base/sm/lg, or fixed 2–4)
- When the viewport changes, cards reflow and the page boundary adjusts automatically
- Default: 3 rows per page

**Pagination navigation:**
- Overlay arrows on left/right edges of the card grid (same OverlayArrow component used by classic gallery carousel)
- Optional dot navigator below the grid (reuse existing DotNavigator component, default off)
- Page indicator text (e.g., "Page 2 of 5") shown near dots/arrows when paginated
- Keyboard: left/right arrow keys navigate pages when grid area has focus

**Page transition:**
- Slide animation (cards slide left/right between pages)
- Duration controlled by `cardPageTransitionMs` setting

### New Settings (Campaign Card tab)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cardDisplayMode` | `'show-all' \| 'load-more' \| 'paginated'` | `'load-more'` | Card gallery display behavior |
| `cardRowsPerPage` | `number (1–10)` | `3` | Rows visible per page in paginated mode |
| `cardPageDotNav` | `boolean` | `false` | Show dot navigator below grid in paginated mode |
| `cardPageTransitionMs` | `number (100–800)` | `300` | Slide animation duration between pages |

### Implementation Plan

#### F-1. Settings layer
- Add 4 new fields to `GalleryBehaviorSettings` interface + defaults
- Add to `SettingsResponse` / `SettingsUpdateRequest` in apiClient
- Add to `App.tsx` fetch/mutate mapping
- Add to `SettingsPanel` Campaign Card tab (display mode Select, conditional rows/dots/duration inputs)
- Add to PHP `class-wpsg-settings.php` defaults + sanitization
- Add to PHP `class-wpsg-rest.php` all 4 response/parser blocks

#### F-2. CardGallery pagination logic
- Track `currentPage` state (reset to 0 on filter/search change)
- Compute `effectiveColumns` from settings + current breakpoint (Mantine `useMatches` or `window.matchMedia`)
- Compute `cardsPerPage = rowsPerPage × effectiveColumns`
- Compute `totalPages = ceil(filteredCampaigns.length / cardsPerPage)`
- Slice `filteredCampaigns` for current page
- Wire `prevPage` / `nextPage` handlers

#### F-3. Pagination UI (arrows + dots)
- Render OverlayArrows flanking the `SimpleGrid` container (conditionally when paginated + totalPages > 1)
- Render DotNavigator below grid when `cardPageDotNav` is true
- Add page indicator text ("Page N of M")
- Add keyboard navigation (left/right arrow keys)
- Hide arrows on first/last page (or wrap around — TBD based on UX feel)

#### F-4. Slide transition
- Wrap the `SimpleGrid` in a transition container
- On page change, slide the outgoing page out (left or right based on direction) and slide the incoming page in
- Use CSS `transform: translateX()` + `transition` for performant GPU-accelerated animation
- Duration controlled by `cardPageTransitionMs`

#### F-5. Responsive edge cases
- When viewport resizes mid-pagination, recalculate `cardsPerPage` and clamp `currentPage` to valid range
- If `totalPages` shrinks below `currentPage`, snap to last valid page
- On mobile (1 column), each "row" = 1 card, so 3 rows = 3 cards per page

#### F-6. Tests
- Unit test pagination math (cardsPerPage, totalPages, page clamping)
- Test display mode switching (show-all / load-more / paginated)
- Test page navigation (arrow clicks, keyboard)
- Test responsive recalculation

### Deliverables

- [x] F-1: Settings layer (types → apiClient → App → SettingsPanel → PHP)
- [x] F-2: CardGallery pagination state and slicing logic
- [x] F-3: OverlayArrows + DotNavigator integration for pages
- [x] F-4: Slide transition animation between pages
- [x] F-5: Responsive edge case handling
- [x] F-6: Tests for pagination logic and UI
- [x] F-7: Settings panel reorganized (5 tabs → 3 tabs with Accordion sections)

**Commits:** `fdbeecc` (pagination), `ecd7c58` (settings reorg)

**Effort:** Medium  
**Impact:** High

---

## Execution Order

| Priority | Track | Status |
|----------|-------|--------|
| 1 | P13-A — Modal CampaignViewer + Card Settings | ✅ Complete |
| 2 | P13-F — Card Gallery Pagination | ✅ Complete |
| 3 | P13-E — Mobile Readiness Audit | ✅ Complete |
| 4 | P13-B — Lazy Loading | Not Started |
| 5 | P13-C — Admin Panel Performance | In Progress |
| 6 | P13-D — Campaign Scheduling | Not Started |

---

## Progress Log

- **2026-02-20:** Phase 13 initiated. Four tracks promoted from FUTURE_TASKS. P13-A prioritized.
- **2026-02-20:** P13-A complete — Modal conversion, 13 card settings (full stack), border color 3-mode system, modal animation fix, theme persistence fix, theme contrast fix. Commits: `04f0167`, `4202fe4`.
- **2026-02-20:** P13-F card gallery pagination track added. Design finalized: 3 display modes (show-all/load-more/paginated), rows-per-page setting, OverlayArrows + optional DotNavigator, slide transition.
- **2026-02-20:** P13-F complete — Full implementation: 3 display modes, rows×columns pagination math, OverlayArrows, DotNavigator, slide animation, keyboard nav, responsive recalc. 4 new settings full stack. 9 new tests (187 total). Commit: `fdbeecc`.
- **2026-02-20:** Settings panel reorganized from 5 tabs (General/Gallery/Transitions/Navigation/Cards) to 3 tabs (General/Campaign Cards/Media Gallery) with Accordion sections. Transitions + Navigation absorbed into Media Gallery. Commit: `ecd7c58`.
- **2026-02-20:** P13-E mobile readiness audit — 17 issues found (6 critical, 9 moderate, 2 minor), all fixed. Touch targets (44px min), dvh viewport units, responsive modals, safe-area-insets, touch-device detection. 14 files changed, 187 tests passing, build clean.
- **2026-02-20:** P13-E post-audit — CampaignViewer modal offscreen fix, filter strip overflow fix, AuthBar mobile redesign, 5 header visibility toggles, app width control, compact grid scaling, sticky settings footer, justified/masonry fix, per-gallery tile sizes.
- **2026-02-21:** P13-E fix appMaxWidth=0 full-width (Container `fluid` prop), add lightbox 250ms fade+scale animation.
- **2026-02-21:** P13-E add `appPadding` setting (override Mantine Container padding-inline), `wpFullBleed` responsive breakpoints (desktop/tablet/mobile) to counteract WordPress `.has-global-padding` via negative-margin wrapper with `alignfull` class and media-query `<style>` injection. Detailed code documentation added to `class-wpsg-embed.php` explaining the 3-part alignfull + negative-margin + re-constrain approach.
- **2026-02-21:** P13-C — Admin Panel Loading Performance — track started.

---

*Document format follows Phase 12 conventions.*
