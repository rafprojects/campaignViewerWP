# Phase 12 — Gallery Extensibility & Advanced Experience

**Status:** Complete ✅  
**Version target:** v0.10.0  
**Created:** February 17, 2026
**Last updated:** February 19, 2026

---

## Overview

Phase 12 focuses on extensibility and advanced gallery UX. The goal is to promote high-impact architecture and UX work from `docs/FUTURE_TASKS.md` into a cohesive execution phase.

This phase centers on four promoted tracks:

1. Advanced video gallery controls/UX
2. Advanced image gallery controls/UX
3. Pluggable gallery implementation + layout builder foundation
4. Modularized embed provider handlers

And six new enhancement tracks identified during Phase 12 implementation:

5. Settings panel modal redesign (HIGHEST PRIORITY — before pluggable gallery)
6. Gallery card border radius controls
7. Transition fade-in/out for entering/exiting cards
8. Navigation overlay arrows with admin controls
9. Dot navigator with admin controls
10. Image/video shadow & depth controls

---

## Track P12-A — Advanced Video Gallery ✅ COMPLETE

### Objectives

- Standardize viewport behavior across mixed-dimension videos (uploaded + external)
- Expose admin-configurable controls for advanced playback/gallery UX
- Preserve safe defaults and backwards compatibility for existing embeds

### Deliverables

- **Configurable video thumbnail dimensions** (`videoThumbnailWidth`/`videoThumbnailHeight`, 30–200px) replacing hardcoded 60×45
- **Thumbnail gap** (`thumbnailGap`, 0–24px) replacing hardcoded 6px
- **Wheel scroll toggle** (`thumbnailWheelScrollEnabled`) to opt-out mouse wheel horizontal scrolling
- **Drag-to-scroll** (`thumbnailDragScrollEnabled`) — new pointer-capture-based drag scrolling with grab cursor and hasMoved guard
- **Strip scroll buttons** (`thumbnailScrollButtonsVisible`) — optional chevron buttons at strip edges for page-based scrolling
- Gallery/player height, scroll speed, animation style/duration/easing already existed and were verified working

**Effort:** Medium  
**Impact:** High  
**Commit:** `4cb3058`

---

## Track P12-B — Advanced Image Gallery ✅ COMPLETE

### Objectives

- Bring image gallery control depth to parity with video gallery controls
- Improve consistency of admin customization across both media types

### Deliverables

- **Configurable image thumbnail dimensions** (`imageThumbnailWidth`/`imageThumbnailHeight`, 30–200px) replacing hardcoded 60×60
- All shared thumbnail strip controls (gap, wheel, drag, scroll buttons) apply to image gallery identically
- Gallery viewport height, scroll speed, animation controls already existed and were verified working
- Full parity with video gallery P12-A controls achieved

**Effort:** Medium  
**Impact:** High  
**Commit:** `4cb3058`

---

## Track P12-C — Pluggable Gallery + Layout Builder (Epic Slice) ✅ COMPLETE

### Objectives

- Introduce a gallery adapter architecture for interchangeable gallery implementations
- Enable runtime gallery selection per media type
- Lay groundwork for manual layout authoring

### Deliverables (Completed)

- ✅ **Adapter contract** (`src/gallery-adapters/GalleryAdapter.ts`): `ImageAdapterProps`, `VideoAdapterProps`, `AdapterRegistration<T>`, `AdapterCapability` types
- ✅ **Adapter registry** (`src/gallery-adapters/adapterRegistry.ts`): `register/resolve` with hard fallback to `classic` for unknown ids
- ✅ **Compact Grid adapter** (`src/gallery-adapters/compact-grid/CompactGridGallery.tsx`): responsive `auto-fill` CSS grid, configurable card dimensions (default 160×224 px, 5:7 playing-card ratio), per-card hover scale + zoom-icon overlay, click-to-lightbox
- ✅ **Portal-based Lightbox** (`src/components/Campaign/Lightbox.tsx`): fixes broken nested-Modal lightbox — Portal renders at z-index 9999 above CampaignViewer's fullscreen Modal; works in shadow DOM + normal DOM; keyboard nav (ESC/arrows), swipe, caption/counter
- ✅ **ImageCarousel lightbox fixed**: replaced nested Mantine Modal (broken z-index) with `<Lightbox>` component
- ✅ **4 new settings**: `imageGalleryAdapterId` (`classic`|`compact-grid`), `videoGalleryAdapterId` (`classic`), `gridCardWidth`, `gridCardHeight`
- ✅ **Settings UI**: Gallery Adapter divider section in SettingsPanel Gallery tab; conditional card-size controls when compact-grid selected; video adapter select (disabled, future use)
- ✅ **CampaignViewer**: adapter-conditional lazy render (`ImageCarousel` vs `CompactGridGallery`)
- ✅ **Full stack**: `types/index.ts`, `apiClient.ts`, `App.tsx`, `SettingsPanel.tsx`, PHP settings defaults/sanitization (`classic`|`compact-grid` whitelist), REST API (admin + public response + update_settings)
- ✅ 178 tests / 0 failures; updated lightbox test assertions for Portal model
- ✅ Committed `7f7cef7`

### Deferred Beyond Phase 12 (Confirmed — moved to FUTURE_TASKS)

- Full manual canvas layout editor UX
- Rich layout migration tooling across multiple schema versions
- Advanced preset authoring/management workflows
- Layout preset persistence schema (PHP table creation)

These items are now tracked in `docs/FUTURE_TASKS.md` under **Layout Builder Epic (Post-Phase 12 Carryover)**.

**Effort:** High  
**Impact:** High

---

## Track P12-D — Modular Embed Provider Handlers ✅ COMPLETE

### Objectives

- Refactor provider-specific embed logic into modular handlers
- Improve maintainability and extensibility for current/future providers

### Deliverables (Completed)

- ✅ `WPSG_Provider_Handler` interface contract (can_handle, fetch, get_name, get_priority)
- ✅ 4 modular handler classes: Rumble, WPCore, Direct oEmbed, OG Fallback
- ✅ `WPSG_Provider_Registry` with priority-based resolution, register/deregister/reset
- ✅ `WPSG_OEmbed_Providers` refactored as thin facade (backwards compatible)
- ✅ `wpsg_register_providers` action hook for third-party extensibility
- ✅ Committed `db45335`

**Effort:** Medium  
**Impact:** Medium

---

## Track P12-E — Settings Panel Modal Redesign ✅ COMPLETE

### Objectives

- Restructure the current inline SettingsPanel into a full modal dialog
- Organize settings into tabbed sections for improved discoverability and scalability
- Must be completed before pluggable gallery work to establish the settings architecture

### Deliverables (Completed)

- ✅ Mantine Modal wrapper replacing inline Card-based panel (`6853c40`)
- ✅ 4-tab system: General, Gallery, Transitions, Navigation
- ✅ Preserved save/reset/dirty-tracking behavior across all tabs
- ✅ Close button via Mantine Modal header, overlay click to close
- ✅ All 11 SettingsPanel tests passing (3 new tests added)
- ✅ Settings loading delay eliminated — `initialSettings` prop seeds from SWR cache (`8863676`)
- ✅ Background revalidation with `hasChangesRef` to prevent overwriting user edits
- ✅ Foundation ready for adding new settings without panel restructuring

**Effort:** Medium  
**Impact:** Very High (unblocks all subsequent settings-heavy tracks)

---

## Track P12-F — Gallery Card Border Radius Controls ✅ COMPLETE

### Objectives

- Provide admin-configurable border radius for images and videos independently
- Allow different radius values per media type for design flexibility

### Deliverables (Completed)

- ✅ `imageBorderRadius` and `videoBorderRadius` settings (0–48px slider, default 8px)
- ✅ End-to-end wiring: React UI → SWR → PHP REST API → WP settings
- ✅ Applied to video player and image viewer viewport containers
- ✅ NumberInput controls in Gallery tab under "Border Radius" divider
- ✅ Committed `db45335`

**Effort:** Low–Medium  
**Impact:** Medium

---

## Track P12-G — Transition Fade for Entering/Exiting Cards ✅ COMPLETE

### Objectives

- Address the current slide-off UX where cards vanish abruptly before reaching viewport edge
- Add optional opacity fade on entering and exiting cards during transitions

### Deliverables (Completed)

- ✅ `transitionFadeEnabled` boolean setting (default: true)
- ✅ Opacity fade applied to enter/exit layers during ALL transition types when enabled
- ✅ Switch control at top of Transitions tab in Settings modal
- ✅ Wired through `galleryAnimations.ts` `TransitionOpts` interface
- ✅ Both VideoCarousel and ImageCarousel (including lightbox) pass setting through
- ✅ Committed `db45335`

**Effort:** Low  
**Impact:** High (significant UX polish)

---

## Track P12-H — Navigation Overlay Arrows ✅ COMPLETE

### Objectives

- Move prev/next navigation arrows from below the viewport to overlaid on the media viewport
- Provide comprehensive admin controls for arrow appearance and behavior

### Deliverables

- **OverlayArrows component** (`src/components/Campaign/OverlayArrows.tsx`): standalone overlay nav with plain `<button>` elements
- Configurable vertical position (top/center/bottom), size, color, bgColor, border width
- Hover-scale effect with CSS transition
- Auto-hide timer (onMouseMove/onTouchStart triggers visibility, fades after configurable ms)
- `pointerEvents: 'none'` on wrapper, `'auto'` on visible buttons only
- Distinct `aria-label` values (`"(overlay)"` suffix) to avoid conflicts with CarouselNavigation
- Wired into both ImageCarousel and VideoCarousel viewports
- 7 admin settings: navArrowPosition, navArrowSize, navArrowColor, navArrowBgColor, navArrowBorderWidth, navArrowHoverScale, navArrowAutoHideMs

**Effort:** Medium–High  
**Impact:** High  
**Commit:** `d3669e3`

---

## Track P12-I — Dot Navigator ✅ COMPLETE

### Objectives

- Add a dot-style page indicator common in modern carousels/sliders
- Provide admin controls for dot appearance and behavior

### Deliverables

- **DotNavigator component** (`src/components/Campaign/DotNavigator.tsx`): standalone dot-style page indicator
- Supports circle, pill, square shapes via CSS borderRadius
- Configurable colors (active/inactive), size, spacing, active-dot scale factor
- Smart truncation for >7 items: shows first, last, current±1, with `…` ellipsis buttons
- Positioning: `below` (normal flow after viewport) or `overlay-bottom`/`overlay-top` (position: absolute)
- Full a11y: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-label="Go to slide N"`
- Wired into both ImageCarousel and VideoCarousel
- 8 admin settings: dotNavEnabled, dotNavPosition, dotNavSize, dotNavActiveColor, dotNavInactiveColor, dotNavShape, dotNavSpacing, dotNavActiveScale

**Effort:** Medium  
**Impact:** Medium–High  
**Commit:** `d3669e3`

---

## Track P12-J — Image/Video Shadow & Depth Controls ✅ COMPLETE

### Objectives

- Allow admins to control box-shadow and depth effects on gallery media cards
- Provide visual depth to gallery items for a more polished presentation

### Deliverables

- **resolveBoxShadow utility** (`src/utils/shadowPresets.ts`): maps preset names to CSS box-shadow values
- Presets: none, subtle (`0 2px 8px`), medium (`0 4px 16px`), strong (`0 8px 30px`), custom (pass-through)
- Applied to ImageCarousel viewer Box and VideoCarousel player Box inline styles
- Separate controls for images and videos in Settings panel (Gallery tab → Shadow & Depth section)
- Custom CSS text input revealed when preset is "custom"
- 4 admin settings: imageShadowPreset, videoShadowPreset, imageShadowCustom, videoShadowCustom

**Effort:** Medium  
**Impact:** Medium  
**Commit:** `d3669e3`

---

## Initial Execution Order

1. ~~**Track P12-E: Settings panel modal redesign**~~ ✅ COMPLETE (`6853c40`, `8863676`)
2. ~~Track P12-D: Modular embed provider handlers~~ ✅ COMPLETE (`db45335`)
3. ~~Track P12-F: Gallery card border radius controls~~ ✅ COMPLETE (`db45335`)
4. ~~Track P12-G: Transition fade-in/out for entering/exiting cards~~ ✅ COMPLETE (`db45335`)
5. ~~Track P12-H: Navigation overlay arrows with admin controls~~ ✅ COMPLETE (`d3669e3`)
6. ~~Track P12-I: Dot navigator with admin controls~~ ✅ COMPLETE (`d3669e3`)
7. ~~Track P12-J: Image/video shadow & depth controls~~ ✅ COMPLETE (`d3669e3`)
8. ~~Track P12-C: Gallery adapter contract + runtime selector foundation~~ ✅ COMPLETE (`7f7cef7`)
9. ~~Track P12-A: Advanced video gallery controls~~ ✅ COMPLETE (`4cb3058`)
10. ~~Track P12-B: Advanced image gallery controls~~ ✅ COMPLETE (`4cb3058`)

---

## Acceptance Criteria (Phase-Level)

- Advanced controls are configurable from admin and preserve current default behavior
- Gallery adapter contract supports at least default + one alternate implementation path
- Embed provider logic is modularized with explicit provider contracts
- Existing embeds remain backwards compatible with no breaking schema changes

---

## Risks & Mitigations

- **Scope creep risk (very high):** keep layout-builder as a phased epic with explicit Phase 12 slice
- **UX complexity risk:** ship safe defaults + progressive disclosure in admin settings
- **Backwards compatibility risk:** include migration guards and fallback behavior for missing config

---

## Progress Log

- **2026-02-17:** Phase 12 planning doc created and tracks promoted from `FUTURE_TASKS.md`.
- **2026-02-18:** Imperative CSS transitions implemented and verified (replaced failing CSS @keyframes approach). `scrollTransitionType` setting added end-to-end. Debug logs cleaned, unused keyframes removed, plugin version bumped to 0.9.1. Six new enhancement tracks (P12-E through P12-J) added. Settings panel modal redesign designated as highest priority.
- **2026-02-18:** **P12-E COMPLETE.** Settings panel converted from inline Card to Mantine Modal with 4 tabs (General, Gallery, Transitions, Navigation). All save/reset/dirty-tracking preserved. Committed `6853c40`.
- **2026-02-18:** Settings loading delay eliminated. Added `initialSettings` prop seeded from SWR cache for instant rendering. Background revalidation with `hasChangesRef` prevents overwriting user edits. 178 tests passing. Committed `8863676`.
- **2026-02-18:** **P12-F, P12-G, P12-D COMPLETE.** Border radius controls (imageBorderRadius/videoBorderRadius, 0–48px), transition fade toggle (transitionFadeEnabled), and modular embed provider system (handler interface, registry, 4 handler classes). 17 files changed, 598 insertions. Committed `db45335`.
- **2026-02-18:** **P12-H, P12-I, P12-J COMPLETE.** OverlayArrows component (7 settings), DotNavigator component (8 settings), shadow presets utility (4 settings) — 19 new settings total, full end-to-end wiring (types → apiClient → SettingsPanel → App.tsx → PHP defaults/sanitization/REST). 3 new files, 8 modified. 178 tests passing. Committed `d3669e3`.
- **2026-02-18:** **P12-H bugfix.** Fixed overlay arrows Y-axis drop (translateY/-50% conflict with hover scale) and auto-hide timer (pointer-events:none wrapper couldn't receive mousemove). Committed `5cd8be1`.
- **2026-02-18:** **P12-A, P12-B COMPLETE.** Advanced thumbnail strip controls: configurable dimensions (video 60×45, image 60×60 defaults), gap, wheel scroll toggle, drag-to-scroll with pointer capture, optional strip scroll buttons. CarouselNavigation upgraded with drag handlers and scroll buttons. 8 new settings end-to-end. 178 tests passing. Committed `4cb3058`.
- **2026-02-19:** **P12-C planning decisions locked.** Scope constrained to adapter foundation (no canvas editor), runtime adapter settings per media type (`videoGalleryAdapterId`, `imageGalleryAdapterId`) with hard fallback to `classic`, one alternate image adapter as POC path, and layout preset persistence contract (schema foundation only).
- **2026-02-19:** **P12-C COMPLETE.** Adapter contract + registry, Portal-based Lightbox (fixes broken nested-Modal z-index), CompactGridGallery adapter (responsive auto-fill grid, playing-card proportions, hover scale, zoom overlay). 4 new settings end-to-end (frontend + PHP). ImageCarousel lightbox fixed. 178 tests / 0 failures. Committed `7f7cef7`.
- **2026-02-19:** **P12-C extension: advanced adapter set completed.** Fixed justified rows bug root cause (`display:block` conflict), added true masonry adapter, and added hexagonal/circular/diamond shape adapters with shared tile appearance controls (gap/border/glow/bounce + masonry columns). Committed `0d3daa8`.
- **2026-02-19:** Dead legacy mosaic adapter file removed after justified replacement (`src/gallery-adapters/mosaic/MosaicGallery.tsx`). Committed `cf07bcc`.
- **2026-02-19:** Added per-media viewport background controls for image/video/unified galleries (none/solid/gradient/image), wired end-to-end through React settings, CampaignViewer rendering, PHP settings defaults/sanitization, and REST responses. Committed `3ed74e5`.

---

## Phase 12 Close-out Summary

Phase 12 is complete and productionized through **v0.10.0** scope.

- Tracks **P12-A through P12-J** are complete.
- Adapter system moved from foundation to practical extensibility with multiple shipping gallery styles.
- Remaining layout-builder epic work is intentionally deferred and now detailed in `docs/FUTURE_TASKS.md`.

---

*Document created: February 17, 2026*
