# Phase 12 — Gallery Extensibility & Advanced Experience

**Status:** In Progress  
**Version target:** v0.10.0 (planning target)  
**Created:** February 17, 2026
**Last updated:** February 18, 2026

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

## Track P12-A — Advanced Video Gallery

### Objectives

- Standardize viewport behavior across mixed-dimension videos (uploaded + external)
- Expose admin-configurable controls for advanced playback/gallery UX
- Preserve safe defaults and backwards compatibility for existing embeds

### Candidate Deliverables

- Gallery/player height controls
- Thumbnail strip scroll speed controls
- Scroll animation style/duration/easing controls
- Gallery card styling controls (radius, spacing, border/shadow presets)
- Enhanced scroll interactions (buttons, drag, wheel behavior)

**Effort:** Medium–High  
**Impact:** High

---

## Track P12-B — Advanced Image Gallery

### Objectives

- Bring image gallery control depth to parity with video gallery controls
- Improve consistency of admin customization across both media types

### Candidate Deliverables

- Gallery viewport height controls
- Thumbnail strip scroll speed controls
- Scroll animation style/duration/easing controls
- Gallery card styling controls (radius, spacing, border/shadow presets)
- Enhanced image gallery scroll controls

**Effort:** Medium–High  
**Impact:** High

---

## Track P12-C — Pluggable Gallery + Layout Builder (Epic Slice)

### Objectives

- Introduce a gallery adapter architecture for interchangeable gallery implementations
- Enable runtime gallery selection per media type
- Lay groundwork for manual layout authoring

### Proposed Phase 12 Scope Slice

1. Gallery adapter contract (capabilities + schema)
2. Runtime gallery selector setting (image/video)
3. At least one alternate implementation path (POC-level)
4. Persistence contract for layout presets (foundation)

### Deferred Beyond Phase 12 (Likely)

- Full manual canvas layout editor UX
- Rich migration tooling for multiple layout schema versions

**Effort:** High  
**Impact:** High

---

## Track P12-D — Modular Embed Provider Handlers

### Objectives

- Refactor provider-specific embed logic into modular handlers
- Improve maintainability and extensibility for current/future providers

### Candidate Deliverables

- Provider handler contract
- Registry/factory wiring for provider resolution
- Robust fallback thumbnail strategies for providers without reliable oEmbed
- Revisit non-oEmbed providers (including Rumble) for consistent preview behavior

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

## Track P12-F — Gallery Card Border Radius Controls

### Objectives

- Provide admin-configurable border radius for images and videos independently
- Allow different radius values per media type for design flexibility

### Candidate Deliverables

- Separate `imageBorderRadius` and `videoBorderRadius` settings (px or rem slider)
- End-to-end wiring: React UI → SWR → PHP REST API → WP settings
- Applied to both main viewport and thumbnail strip items
- Safe defaults (e.g., 8px) preserving current appearance

**Effort:** Low–Medium  
**Impact:** Medium

---

## Track P12-G — Transition Fade for Entering/Exiting Cards

### Objectives

- Address the current slide-off UX where cards vanish abruptly before reaching viewport edge
- Add optional opacity fade on entering and exiting cards during transitions

### Candidate Deliverables

- New `transitionFadeEnabled` boolean setting (default: true)
- Opacity fade applied to both enter and exit layers during slide transitions
- Configurable fade intensity or kept as a polished default
- Works in combination with existing slide/slide-fade/fade transition types

**Effort:** Low  
**Impact:** High (significant UX polish)

---

## Track P12-H — Navigation Overlay Arrows

### Objectives

- Move prev/next navigation arrows from below the viewport to overlaid on the media viewport
- Provide comprehensive admin controls for arrow appearance and behavior

### Candidate Deliverables

- Overlay arrow positioning (left/right edges of viewport)
- Admin controls for:
  - Arrow position (vertical alignment: top, center, bottom)
  - Arrow size (px slider)
  - Arrow color and background color
  - Border style and width
  - Hover grow effect (scale factor)
  - Activity fade timing (auto-hide delay in ms, 0 = always visible)
- Touch-friendly sizing on mobile
- Accessibility: keyboard navigation, ARIA labels maintained

**Effort:** Medium–High  
**Impact:** High

---

## Track P12-I — Dot Navigator

### Objectives

- Add a dot-style page indicator common in modern carousels/sliders
- Provide admin controls for dot appearance and behavior

### Candidate Deliverables

- Dot navigator component rendered below (or overlaid on) the viewport
- Click/tap to navigate to specific slide
- Admin controls for:
  - Dot position (below viewport, overlaid bottom, overlaid top)
  - Dot size, active color, inactive color
  - Dot shape (circle, pill, square)
  - Spacing between dots
  - Active dot scale factor
- Truncation strategy for large galleries (e.g., show 5 + ellipsis)

**Effort:** Medium  
**Impact:** Medium–High

---

## Track P12-J — Image/Video Shadow & Depth Controls

### Objectives

- Allow admins to control box-shadow and depth effects on gallery media cards
- Provide visual depth to gallery items for a more polished presentation

### Candidate Deliverables

- Shadow preset selector (none, subtle, medium, strong, custom)
- Custom shadow controls: offsetX, offsetY, blur, spread, color
- Separate controls for images and videos
- Optional inner shadow / inset option
- Applied to both main viewport and optionally to thumbnails
- CSS `filter: drop-shadow()` option for non-rectangular content

**Effort:** Medium  
**Impact:** Medium

---

## Initial Execution Order

1. ~~**Track P12-E: Settings panel modal redesign**~~ ✅ COMPLETE (`6853c40`, `8863676`)
2. Track P12-D: Modular embed provider handlers (enables cleaner provider extensibility)
3. Track P12-F: Gallery card border radius controls
4. Track P12-G: Transition fade-in/out for entering/exiting cards
5. Track P12-H: Navigation overlay arrows with admin controls
6. Track P12-I: Dot navigator with admin controls
7. Track P12-J: Image/video shadow & depth controls
8. Track P12-C: Gallery adapter contract + runtime selector foundation
9. Track P12-A: Advanced video gallery controls
10. Track P12-B: Advanced image gallery controls

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

---

*Document created: February 17, 2026*
