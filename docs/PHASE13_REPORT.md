# Phase 13 — UX Polish, Performance & Campaign Scheduling

**Status:** In Progress  
**Version target:** v0.11.0  
**Created:** February 20, 2026  
**Last updated:** February 20, 2026

---

## Overview

Phase 13 focuses on UX polish, frontend performance, and campaign lifecycle management. Four tracks were promoted from `docs/FUTURE_TASKS.md`:

1. **P13-A — Modal CampaignViewer** (HIGHEST PRIORITY)
2. **P13-B — Lazy Loading for Large Galleries**
3. **P13-C — Admin Panel Loading Performance**
4. **P13-D — Campaign Scheduling**

---

## Track P13-A — Modal CampaignViewer  ⬅️ IN PROGRESS

### Problem

CampaignViewer currently opens via `<Modal fullScreen>`, which takes over the entire viewport and feels like a page navigation rather than a contextual preview. The "Back" button reinforces this disconnected pattern.

### Objectives

- Replace `fullScreen` modal with a standard centered Mantine `<Modal>` (large but not full-viewport)
- Add smooth open/close animation (scale-up + fade) for polished UX
- Preserve all existing content: cover image header, metadata, media galleries, stats, admin actions
- Ensure responsive behavior (near-fullscreen on mobile, ~900px max on desktop)
- Replace "Back" button with standard modal close affordances (X button, click-outside, Escape)
- Maintain scroll within modal body for long campaigns

### Deliverables

- [ ] Convert `<Modal fullScreen>` to centered `<Modal size="xl">` with max-width constraint
- [ ] Add `transitionProps` for animated open (pop/scale transition)
- [ ] Replace "Back" button with `withCloseButton`
- [ ] Adjust cover image height for modal context
- [ ] Verify CampaignViewer tests pass with modal changes
- [ ] Verify CardGallery integration tests still work

**Effort:** Low–Medium  
**Impact:** High

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

## Execution Order

| Priority | Track | Status |
|----------|-------|--------|
| 1 | P13-A — Modal CampaignViewer + Card Settings | In Progress |
| 2 | P13-E — Mobile Readiness Audit | Not Started |
| 3 | P13-B — Lazy Loading | Not Started |
| 4 | P13-C — Admin Panel Performance | Not Started |
| 5 | P13-D — Campaign Scheduling | Not Started |

---

## Progress Log

- **2026-02-20:** Phase 13 initiated. Four tracks promoted from FUTURE_TASKS. P13-A prioritized.
- **2026-02-20:** P13-A: Campaign Card settings tab (11 settings) + modal/card wiring complete. P13-E mobile readiness track added.

---

*Document format follows Phase 12 conventions.*
