# Phase 13 — UX Polish, Performance & Campaign Scheduling

**Status:** In Progress  
**Version target:** v0.11.0  
**Created:** February 20, 2026  
**Last updated:** February 20, 2026

---

## Overview

Phase 13 focuses on UX polish, frontend performance, and campaign lifecycle management. Four tracks were promoted from `docs/FUTURE_TASKS.md`:

1. **P13-A — Modal CampaignViewer + Card Settings** ✅ COMPLETE
2. **P13-F — Card Gallery Pagination** (NEXT PRIORITY)
3. **P13-B — Lazy Loading for Large Galleries**
4. **P13-C — Admin Panel Loading Performance**
5. **P13-D — Campaign Scheduling**
6. **P13-E — Mobile Readiness Audit**

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

## Track P13-E — Mobile Readiness Audit

### Problem

The application has not been systematically verified for mobile viewports. Touch targets, responsive layouts, scroll behavior, and modal interactions may not work properly on phones and small tablets.

### Objectives

- Audit every user-facing view on mobile breakpoints (320px, 375px, 414px, 768px)
- Ensure touch targets meet 44px minimum (WCAG 2.5.5)
- Verify all modals, overlays, and drawers are usable on mobile
- Fix any overflow, truncation, or layout-breaking issues
- Test swipe gestures (gallery carousel) on actual touch devices or emulation
- Ensure admin panel is functional on tablet (768px+) at minimum

### Deliverables

- [ ] Document audit findings per component/view
- [ ] Fix touch target sizing issues
- [ ] Fix modal/overlay viewport issues on mobile
- [ ] Fix any horizontal overflow or layout breaks
- [ ] Verify card grid responsive behavior
- [ ] Test gallery carousel swipe on touch viewports
- [ ] Verify admin settings panel usability on tablet

**Effort:** Medium  
**Impact:** High

---

## Track P13-F — Card Gallery Pagination  ⬅️ NEXT

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

- [ ] F-1: Settings layer (types → apiClient → App → SettingsPanel → PHP)
- [ ] F-2: CardGallery pagination state and slicing logic
- [ ] F-3: OverlayArrows + DotNavigator integration for pages
- [ ] F-4: Slide transition animation between pages
- [ ] F-5: Responsive edge case handling
- [ ] F-6: Tests for pagination logic and UI

**Effort:** Medium  
**Impact:** High

---

## Execution Order

| Priority | Track | Status |
|----------|-------|--------|
| 1 | P13-A — Modal CampaignViewer + Card Settings | ✅ Complete |
| 2 | P13-F — Card Gallery Pagination | Not Started |
| 3 | P13-E — Mobile Readiness Audit | Not Started |
| 4 | P13-B — Lazy Loading | Not Started |
| 5 | P13-C — Admin Panel Performance | Not Started |
| 6 | P13-D — Campaign Scheduling | Not Started |

---

## Progress Log

- **2026-02-20:** Phase 13 initiated. Four tracks promoted from FUTURE_TASKS. P13-A prioritized.
- **2026-02-20:** P13-A complete — Modal conversion, 13 card settings (full stack), border color 3-mode system, modal animation fix, theme persistence fix, theme contrast fix. Commits: `04f0167`, `4202fe4`.
- **2026-02-20:** P13-F card gallery pagination track added. Design finalized: 3 display modes (show-all/load-more/paginated), rows-per-page setting, OverlayArrows + optional DotNavigator, slide transition.

---

*Document format follows Phase 12 conventions.*
