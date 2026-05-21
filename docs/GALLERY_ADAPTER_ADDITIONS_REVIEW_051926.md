# Deferred Gallery Adapter Additions — Feasibility Review

> **Date:** 2026-05-20
> **Source:** `docs/archive/FUTURE_TASKS.md` § "Deferred Gallery Adapters" (origin: Phase 8 brainstorm, P22)
> **Scope:** 9 deferred gallery adapter concepts evaluated against the current codebase
> **Contract:** `GalleryAdapterProps` / `registerAdapter` in `src/components/Galleries/Adapters/`
> **Outcome sync:** `P31-E` owns Spotlight / Hero, `P31-F` owns Vertical Scroll Snap after re-scoping it to bounded gallery sections, `P31-G` owns Waterfall as a Masonry enhancement, and `P31-H` owns the metadata foundations needed by Timeline / filterable follow-ons. Stacked, Coverflow, Timeline, and Mosaic / Pinterest remain deferred; Isotope remains a future wrapper direction; Variable Aspect-Ratio Grid is pruned.

---

## Current Adapter Landscape

The plugin currently ships **8 built-in registry entries** across these layout families:

| Family | Adapters |
|---|---|
| **Carousel** | `classic` (Embla-based, `MediaCarouselAdapter`) |
| **Grid — uniform** | `compact-grid` (flex-wrap, configurable card size) |
| **Grid — fluid** | `justified` (Flickr-style rows, `react-photo-album`), `masonry` (multi-column, `react-photo-album`) |
| **Grid — shaped** | `hexagonal` (honeycomb, clip-path), `circular` (dot-matrix, `border-radius: 50%`), `diamond` (rhombus, clip-path) |
| **Custom** | `layout-builder` (registry option plus special-case lazy render path when a template is assigned) |

Adapter metadata is declared in `adapterRegistry.ts`, while `layout-builder` is rendered through the special-case lazy path in `CampaignGalleryAdapterRenderer.tsx` when a template is assigned. Shared infrastructure includes `LazyImage`, `Lightbox`, `useCarousel`, `runtimeCommon.ts` (shell styles, heading, common settings), `tileHoverStyles.ts` (bounce/glow), and `overlayStyles.ts` (badge constants). All grid adapters are lazy-loaded; adding a new grid adapter still has effectively zero initial bundle impact if it follows the same pattern.

**Registration cost:** ~15 lines in `adapterRegistry.ts` (lazy import + `AdapterRegistration` object + optional setting group definition).

---

## Evaluation Criteria

Per `docs/archive/FUTURE_TASKS.md`:

1. **User impact** — how many users, how much workflow improvement
2. **Implementation effort** — realistic dev time including tests and docs
3. **Maintenance burden** — ongoing upkeep surface area
4. **Alignment with core mission** — gallery management vs. scope creep
5. **Open questions resolved** — key design decisions answered
6. **Dependencies satisfied** — prerequisite features or data

---

## Adapter-by-Adapter Assessment

### 1. Spotlight / Hero Adapter

> Large featured item (hero) with a row/grid of smaller thumbnails below or beside it. Clicking a thumbnail promotes it to the hero position with a crossfade transition. Good for campaign highlights.

**Verdict: DOABLE — Phase 31 owned as `P31-E`**

| Criterion | Assessment |
|---|---|
| Architecture fit | Direct mapping to `GalleryAdapterProps`. Two-zone layout (hero region + thumbnail strip) is structurally trivial — a `Stack` with a hero `Box` and a horizontal scroll row. |
| Existing infrastructure | Reuses `LazyImage`, `Lightbox`, `useCarousel` for thumbnail navigation. Crossfade is a simple CSS opacity transition on state change. |
| New dependencies | **None.** |
| Setting groups needed | 1 new group `spotlight` with ~3 fields: hero aspect ratio, hero transition duration, thumbnail size. |
| Complexity benchmark | Slightly more complex than `CircularGallery` (~140 lines) due to state management for the hero index and transition. Estimate: **200-250 lines.** |
| Video support | Straightforward — hero can embed a `<video>` or `<iframe>` (same pattern as `MediaCarouselAdapter`). |
| LOE | **Low** (2-3 hours) |
| Impact | **Medium** — directly useful for campaign highlights and featured content |
| Risks | None material. This is the simplest deferred adapter. |

**Implementation sketch:** State tracks `heroIndex`. Thumbnails in a flex-wrap row. Clicking a thumbnail sets `heroIndex` → hero region crossfades. Hero uses `object-fit: cover` with configurable aspect ratio. Lightbox on hero click.

**Recommendation: Promote first.** This is now owned by `P31-E` in `PHASE31_REPORT.md` and remains the highest impact/lowest effort ratio among the deferred concepts.

---

### 2. Vertical Scroll Snap Adapter

> Mobile-first full-screen vertical carousel using CSS `scroll-snap-type: y mandatory`. Each media item occupies the full viewport height. Swiping vertically snaps to the next item. Ideal for story-style or Instagram-reel-like campaign presentations.

**Verdict: DOABLE — Phase 31 owned as `P31-F` with scope change**

| Criterion | Assessment |
|---|---|
| Architecture fit | Clean `GalleryAdapterProps` mapping **once scoped to the existing bounded gallery-section contract**. The adapter should snap inside `GallerySectionWrapper`, not assume browser-viewport ownership. |
| Existing infrastructure | Reuses `LazyImage`, `Lightbox`, `runtimeCommon.ts`, and measured `containerDimensions` from the current viewer shell. No carousel logic is required, but the implementation must integrate with section sizing and modal scroll behavior. |
| New dependencies | **None.** Pure CSS scroll-snap. |
| Setting groups needed | 1 new group `scroll-snap` with ~2 fields: snap alignment (`start`/`center`), show/hide page indicator. |
| Complexity benchmark | Still CSS-forward, but slightly more involved than the original sketch because it must respect bounded gallery sections and per-type layout rules. Estimate: **220-300 lines.** |
| Video support | Each snap page can contain a `<video>` element. Need to pause non-visible videos (IntersectionObserver — lightweight). |
| LOE | **Medium** (4-6 hours) |
| Impact | **Medium** — growing mobile importance, story-style presentations |
| Risks | Browser support is fine, but the product-fit risk is in layout ownership: per-type equal-height side-by-side layouts, nested modal scroll behavior, and video visibility/pause handling all need explicit treatment. |

**Implementation sketch:** A bounded section container with `scroll-snap-type: y mandatory`, `overflow-y: auto`, and height derived from the current gallery section sizing contract rather than hard-coded `100dvh`. Each child uses `scroll-snap-align`, fills the measured section height, and preserves the existing click/lightbox interaction model. Per-type layouts should stack vertically rather than producing two competing side-by-side snap containers.

**Recommendation: Promote with the Phase 31 scope change.** This is now owned by `P31-F`, but the full-viewport story-view sketch is rejected in favor of section-bounded behavior.

---

### 3. Waterfall Adapter

> Vertical masonry variant where items drop in sequence with staggered CSS animation (`@keyframes` with incremental `animation-delay`). Content-driven heights. Essentially masonry with entrance animations.

**Verdict: DOABLE — Phase 31 owned as `P31-G` (Masonry enhancement)**

| Criterion | Assessment |
|---|---|
| Architecture fit | This is literally `MasonryGallery` + CSS entrance animations. The layout engine is already implemented via `react-photo-album`'s `MasonryPhotoAlbum`. |
| Existing infrastructure | Can directly compose or fork `MasonryGallery`. Staggered `@keyframes` with `animation-delay` per item. |
| New dependencies | **None.** |
| Setting groups needed | Reuses `masonry` group entirely. 1 additional field: animation style selector (none/fade-slide/fade-scale). |
| Complexity benchmark | Delta over `MasonryGallery` is ~40 lines of animation CSS + stagger logic. Estimate: **250 lines total** (mostly copied from `MasonryGallery`). |
| Video support | Inherits from masonry. |
| LOE | **Low** (1-2 hours) |
| Impact | **Low** — cosmetic differentiator only |
| Risks | After initial load, it's indistinguishable from masonry. May not justify a separate adapter registration. |

**Implementation sketch:** Same as `MasonryGallery` but each tile gets `animation: waterfall-enter 0.5s ease-out forwards` with `animation-delay: ${index * 80}ms`. Items start with `opacity: 0; transform: translateY(20px)`.

**Recommendation: Fold into Masonry as a setting toggle** rather than a separate adapter. This is now owned by `P31-G` in `PHASE31_REPORT.md`.

---

### 4. Stacked / Deck Adapter

> Cards stacked on top of each other with slight offset/rotation. Swipe or click to move the top card to the back (Tinder-like). Touch-optimized for mobile previews.

**Verdict: DOABLE — Defer (niche impact, gesture risk)**

| Criterion | Assessment |
|---|---|
| Architecture fit | Fits `GalleryAdapterProps`. Stack of absolutely-positioned cards with z-index layering. |
| Existing infrastructure | `LazyImage` for card thumbnails. Touch/swipe gestures need implementation from scratch — no existing touch handler in the adapter layer. `MediaCarouselAdapter` uses Embla for touch but that's a different interaction model (horizontal, not Tinder-style dismiss). |
| New dependencies | Touch-swipe handling: could use a lightweight library (`@use-gesture/react`) or implement with raw `touchstart`/`touchmove`/`touchend`. This is the main uncertainty. |
| Setting groups needed | 1 new group `stacked` with ~4 fields: stack depth (visible cards), offset angle/px, swipe threshold, animation duration. |
| Complexity benchmark | More stateful than `CircularGallery` — needs gesture tracking, card reordering on swipe, and z-index management. Estimate: **300-400 lines.** |
| Video support | Problematic — stacked cards obscure video controls. Would need to expand the top card to play video, changing the interaction model mid-flow. |
| LOE | **Medium** (4-6 hours) |
| Impact | **Low-Medium** — niche interaction for gallery browsing |
| Risks | Touch gesture implementation quality is critical — bad swipe handling makes the adapter unusable. Video support is awkward. Desktop mouse-drag support also needed for parity. |

**Implementation sketch:** Render N cards absolutely positioned with incremental `translateY` and `rotate` offsets. On swipe/drag, animate top card out, shift remaining cards up, set the dismissed card to the bottom with z-index update.

**Recommendation: Keep deferred.** The Tinder-like interaction is niche for a gallery plugin. Video support is awkward. The touch gesture work has quality risks.

---

### 5. Coverflow / 3D Adapter

> CSS 3D perspective carousel where side items are rotated and scaled down. Classic Apple-style cover flow effect. Uses `transform: perspective() rotateY()` and z-index layering. Navigation via click, keyboard, or drag.

**Verdict: DOABLE — Defer (functional overlap with carousel)**

| Criterion | Assessment |
|---|---|
| Architecture fit | Fits `GalleryAdapterProps`. Central focused card + side cards with CSS `transform: perspective() rotateY()`. |
| Existing infrastructure | `useCarousel` for index tracking, `Lightbox` for full view. `LazyImage` for thumbnails. The 3D transforms are pure CSS. |
| New dependencies | **None** for basic version. Drag-to-navigate would need gesture handling (same concern as Stacked). |
| Setting groups needed | 1 new group `coverflow` with ~4 fields: perspective depth, side-card rotation angle, side-card scale, show/hide reflection. |
| Complexity benchmark | More complex than `CircularGallery` due to 3D perspective math and multi-card rendering. Estimate: **250-350 lines.** |
| Video support | Side video cards with play indicators work. Focused video card can expand to play. Same pattern as `MediaCarouselAdapter`. |
| LOE | **Medium** (4-6 hours) |
| Impact | **Medium** — visually impressive but functionally similar to carousel |
| Risks | 3D CSS transforms have occasional rendering quirks in Firefox/Safari. `perspective` and `rotateY` on elements with `object-fit` images can produce clipped results. The reflection effect (if included) requires `transform: scaleY(-1)` which compounds the rendering complexity. Touch drag needs to map horizontal distance to rotation angle smoothly. |

**Implementation sketch:** Render 3-5 visible cards. Center card at `rotateY(0deg) scale(1)`. Side cards at `rotateY(±60deg) scale(0.8)` with reduced opacity. Click/drag changes the center index with CSS transition.

**Recommendation: Keep deferred.** Visually impressive but functionally similar to the existing carousel adapter. The existing `MediaCarouselAdapter` with `carouselDarkenUnfocused` + `edgeFade` achieves a similar focused-card effect without 3D rendering risks.

---

### 6. Timeline Adapter

> Chronological layout with items on alternating sides of a vertical center line. Date/caption labels at each node. Good for event-based or campaign-chronology galleries.

**Verdict: DOABLE — Defer (blocked by unresolved media payload contract)**

| Criterion | Assessment |
|---|---|
| Architecture fit | Fits `GalleryAdapterProps` structurally, but the timeline concept requires **date metadata** on media items. |
| Existing infrastructure | `MediaItem` currently has **no typed date/time field** — only `id`, `type`, `source`, `url`, `embedUrl`, `provider`, `attachmentId`, `thumbnail`, `title`, `caption`, `order`, `width`, `height`. The REST media-sort path references `dateUploaded`, but that payload contract is not currently formalized on the frontend. |
| Gap identified | **Chronology is unresolved.** `P31-H` now owns the pre-evaluation needed to decide whether future timeline work should rely on attachment upload date, relationship-level metadata, manual order, or a new explicit field. |
| New dependencies | **None** for layout. |
| Setting groups needed | 1 new group `timeline` with ~3 fields: line color, node size, alternate direction (left/right/centered). |
| Complexity benchmark | Layout is moderate — alternating sides of a center line with connecting lines and date labels. Estimate: **250-300 lines** frontend only. |
| Video support | Same as other adapters — thumbnail with play overlay. |
| LOE | **Medium-High** (6-8 hours total including backend) |
| Impact | **Low-Medium** — specialized use case (events, chronologies) |
| Risks | The backend work is the blocker. WP attachment metadata doesn't naturally store a "campaign media date" — the date would need to be stored as post meta on the relationship. Also, chronological ordering conflicts with the existing `order` field — does timeline sort by date or by manual order? |

**Implementation sketch:** Vertical center line. Items alternate left/right. Each item has a date label node on the line, a connecting line to the media card. Cards show `LazyImage`/video thumbnail. Click opens lightbox.

**Recommendation: Keep deferred until `P31-H` resolves canonical chronology and payload shape.** The backend/frontend dependency remains real, but the blocker is now documented as a contract decision rather than only a missing field.

---

### 7. Mosaic / Pinterest Adapter

> Irregular tile sizes (large hero + small surrounding grid) based on aspect ratios or media importance. Similar to Google Photos' auto-layout algorithm. Tiles are assigned sizes dynamically (e.g., 2x2, 1x1, 2x1) to maximize area coverage while respecting aspect ratios.

**Verdict: DOABLE — Defer (layout algorithm risk)**

| Criterion | Assessment |
|---|---|
| Architecture fit | Fits `GalleryAdapterProps`. Irregular grid with variable-size tiles (2x2, 1x1, 2x1, 1x2). |
| Existing infrastructure | The `justified` adapter (`RowsPhotoAlbum`) already does aspect-ratio-preserving layout. The `compact-grid` adapter already does a grid with configurable card sizing. **Neither does the "hero + surrounding grid" pattern described here.** |
| New dependencies | Layout algorithm needs a bin-packing or grid-assignment algorithm. `react-photo-album` doesn't do irregular grid sizes. Could use CSS Grid with `grid-template-areas` or a library like `muuri` or `gridust`. |
| Setting groups needed | 1 new group `mosaic-grid` with ~4 fields: hero count (items that get 2x2), grid columns, gap, assignment strategy (importance/random/aspect-ratio). |
| Complexity benchmark | The hardest layout algorithm of all deferred adapters. The tile assignment algorithm (deciding which items get which grid span) is non-trivial and needs to be responsive. Estimate: **400-500 lines.** |
| Video support | Videos as large tiles work. But the algorithm needs to handle mixed content density. |
| LOE | **Medium-High** (6-8 hours) |
| Impact | **Medium** — visually distinctive layout |
| Risks | The layout algorithm is the main risk. Responsive behavior (re-flowing on resize) with variable tile sizes is notoriously difficult. CSS Grid can handle it but needs `grid-template-areas` recalculation on every resize. Google Photos' algorithm is proprietary and complex. A simple "first N items are 2x2, rest are 1x1" is feasible but limited. |

**Implementation sketch:** Assign first K items a 2x2 span, rest get 1x1. Use CSS Grid with `grid-auto-flow: dense`. On resize, recalculate K based on container width.

**Recommendation: Keep deferred.** The existing `justified` and `masonry` adapters already provide the dense-packing behavior that's the core value of a mosaic layout. The "hero + grid" variant overlaps significantly with the Spotlight adapter.

---

### 8. Isotope / Filterable Grid Adapter

> Grid layout with animated filtering, sorting, and category transitions. Items shuffle positions with smooth FLIP animations when filter criteria change. Requires extending the adapter interface to accept filter/sort props.

**Verdict: NOT FEASIBLE as an adapter — implement as wrapper instead**

| Criterion | Assessment |
|---|---|
| Architecture fit | **Does NOT fit `GalleryAdapterProps` as-is.** The current interface passes a flat `MediaItem[]` with no category/filter metadata. Filtering requires either: (a) a `category` field on `MediaItem`, or (b) extending the adapter interface to accept filter/sort props. |
| Existing infrastructure | Gallery media payloads currently expose **no per-item category/tag field**. Media tags do exist in the backend taxonomy layer, but they are not surfaced on `MediaItem` in the current viewer payload. The FLIP animation requirement needs a new dependency (`react-flip-toolkit` or `@formkit/auto-animate`). |
| Gap identified | **Two blockers:** (1) the gallery media payload does not yet expose per-item tag/filter data, and `P31-H` now owns that pre-evaluation; (2) `GalleryAdapterProps` is still the wrong layer for filter state and sort orchestration, which is why this should move toward a wrapper rather than an adapter. |
| New dependencies | FLIP animation library (`react-flip-toolkit` ~8KB or `@formkit/auto-animate` ~2KB). Plus backend work for category data. |
| Setting groups needed | 1 new group `filterable-grid` with ~3 fields: filter bar position, animation duration, show/hide category pills. |
| Complexity benchmark | The filtering/sorting logic + FLIP animations make this the most complex deferred adapter. Estimate: **500-600 lines** frontend + backend changes. |
| Video support | Filtering works the same for videos. |
| LOE | **High** (10-16 hours total including backend) |
| Impact | **Medium** — valuable for large campaign galleries |
| Risks | Interface change is the primary risk — modifying `GalleryAdapterProps` affects ALL existing adapters. FLIP animations with CSS Grid or flexbox are fragile and require careful DOM structure. The category metadata on media items requires schema migration. |

**Implementation sketch:** Category pill bar at top. Clicking a pill filters the media array. FLIP animation handles the position transitions. Falls back to `CompactGridGallery`-style rendering for the visible items.

**Recommendation: Do not promote as an adapter.** The filtering capability is valuable but should be implemented at a **higher level** after `P31-H` resolves the media payload contract — a `FilterableGallery` wrapper component that sits above the adapter layer and filters the media array before passing it to any existing adapter. This avoids interface changes entirely. The FLIP animation can be a separate enhancement.

---

### 9. Grid with Variable Aspect-Ratio Tiles Adapter

> Auto-assigns tile sizes (1x1, 2x1, 1x2, 2x2) based on media metadata (aspect ratio, resolution). Creates a densely packed, visually varied grid without manual configuration. Similar to Google Photos or Flickr's justified grid but with explicit CSS Grid tracks.

**Verdict: PRUNE — already shipped as `justified`**

| Criterion | Assessment |
|---|---|
| Architecture fit | Fits `GalleryAdapterProps` and uses existing `MediaItem.width`/`MediaItem.height`. |
| Existing infrastructure | The `justified` adapter (Flickr-style, `RowsPhotoAlbum`) **already does this** — it auto-assigns tile widths based on aspect ratio to fill each row. The `masonry` adapter also preserves aspect ratios naturally. |
| Gap identified | The described behavior ("auto-assigns tile sizes based on aspect ratio") is a restatement of what `justified` and `masonry` already do. The only differentiator would be "explicit CSS Grid tracks" vs. "`react-photo-album` algorithm," which is an implementation detail, not a user-facing distinction. |
| LOE | **N/A** |
| Impact | **N/A** |
| Risks | **N/A** |

**Recommendation: Prune from FUTURE_TASKS.** This is a duplicate of the `justified` adapter's capabilities.

---

## Summary Matrix

| # | Adapter | Verdict | LOE | Impact | Promote? |
|---|---|---|---|---|---|
| 1 | **Spotlight / Hero** | DOABLE | Low (2-3h) | Medium | **`P31-E`** |
| 2 | **Vertical Scroll Snap** | DOABLE WITH SCOPE CHANGE | Medium (4-6h) | Medium | **`P31-F` (section-bounded)** |
| 3 | **Waterfall** | DOABLE AS MASONRY ENHANCEMENT | Low (2-3h) | Low | **`P31-G` (not a new adapter)** |
| 4 | **Stacked / Deck** | DOABLE | Medium (4-6h) | Low-Medium | Defer (niche, gesture risk) |
| 5 | **Coverflow / 3D** | DOABLE | Medium (4-6h) | Medium | Defer (carousel overlap) |
| 6 | **Timeline** | DOABLE | Med-High (6-8h) | Low-Medium | Defer (`P31-H` first) |
| 7 | **Mosaic / Pinterest** | DOABLE | Med-High (6-8h) | Medium | Defer (layout algorithm risk) |
| 8 | **Isotope / Filterable** | REFRAME | High (10-16h) | Medium | Future wrapper after `P31-H`, not an adapter |
| 9 | **Variable Aspect-Ratio Grid** | OVERLAPS | N/A | N/A | **Prune** (justified already does this) |

### By recommendation:

| Action | Adapters |
|---|---|
| **Promoted to Phase 31** | Spotlight/Hero (`P31-E`), Vertical Scroll Snap (`P31-F`, section-bounded) |
| **Fold into existing / Phase 31** | Waterfall → Masonry setting toggle (`P31-G`) |
| **Pre-evaluate in Phase 31** | Media payload foundations for Timeline / filter follow-ons (`P31-H`) |
| **Prune** | Variable Aspect-Ratio Grid |
| **Reframe** | Isotope → future `FilterableGallery` wrapper after `P31-H`, not adapter |
| **Keep deferred** | Stacked/Deck, Coverflow/3D, Timeline, Mosaic/Pinterest |

---

## Key Architectural Observations

### The adapter contract is mature

The `GalleryAdapterProps` interface (`media`, `settings`, `runtime?`, `containerDimensions?`) is well-designed. **5 of 9** deferred adapters plug in directly with zero interface changes. The `registerAdapter()` system in `adapterRegistry.ts` makes registration trivial (~15 lines).

### Shared infrastructure covers ~80% of adapter needs

Every new adapter reuses the same building blocks:
- `LazyImage` — progressive image rendering (skeleton → fade-in → error)
- `Lightbox` — shared portal-based lightbox with navigation
- `useCarousel` — index tracking with prev/next
- `runtimeCommon.ts` — `resolveAdapterShellStyle`, `resolveGalleryComponentCommonSettings`, `resolveGalleryHeading`
- `tileHoverStyles.ts` — per-scope bounce/glow CSS generation
- `overlayStyles.ts` — shared badge overlay constants (`OVERLAY_BG`, `OVERLAY_TEXT`)

New adapters are primarily layout logic + JSX rendering. The pattern established by `CircularGallery` (~140 lines) and `CompactGridGallery` (~220 lines) is the baseline.

### The two main blockers for future promotion

1. **Unresolved media payload contract.** Timeline still needs canonical chronology semantics, and filterable follow-ons still need a decision on whether existing backend media tags should be surfaced on `MediaItem`. `P31-H` now owns that pre-evaluation boundary.

2. **Touch gesture handling.** Stacked and Coverflow need quality swipe/drag handling. No existing gesture infrastructure exists in the adapter layer. `MediaCarouselAdapter` uses Embla Carousel for touch, but that's a horizontal carousel model, not the Tinder-style dismiss (Stacked) or angle-mapped rotation (Coverflow).

### Bundle impact is zero

All grid adapters are lazy-loaded via React `lazy()`. Adding new adapters has no impact on initial bundle size. Only the registry metadata (~15 lines per adapter) ships in the main chunk.

### Setting group precedent

The `SETTING_GROUP_DEFINITIONS` map in `adapterRegistry.ts` establishes the pattern: each adapter declares its setting groups (e.g., `['media-frame', 'compact-grid']`), and the definitions map provides schema-driven field rendering (number, dimension, select, boolean, text, color controls). New adapters follow the same pattern — define a group, add fields with `control`, `key`, `label`, `description`, `fallback`, and constraints.

---

*Generated: 2026-05-20*
*Evaluated against: `src/components/Galleries/Adapters/` (8 built-in registry entries plus the special-case layout-builder renderer), `src/types/index.ts` (`MediaItem`), `docs/archive/FUTURE_TASKS.md` § "Deferred Gallery Adapters"*
