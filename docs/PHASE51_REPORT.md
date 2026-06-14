# Phase 51 - Shared Package Extraction, Decoupling & Abstraction Audit + Front-end Fixes

**Status:** Planning
**Created:** 2026-06-12
**Last updated:** 2026-06-14

This phase carries **two track groups**:

- **Abstraction work (P51-A…D)** — the shared-package extraction spike and its follow-on extraction/decoupling tracks. Planning-stage; B/C/D are sequenced after the spike.
- **Front-end fixes & admin quick wins (P51-E…H)** — small, ship-now bug fixes and polish, ready to execute independently of the spike. P51-E is also the first concrete input to the spike: it extracts a shared adapter tile-size/geometry helper that P51-A then folds into its candidate list (see the recalibration note in P51-A).

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P51-A | Abstraction Spike — Opus/Fable audit of the full codebase for package candidates, WordPress-coupling points, and decoupling paths | To do | Medium |
| P51-B | `packages/shared-utils/` — extract pure utility and primitive hook modules | To do | Medium |
| P51-C | `packages/shared-ui/` — extract decoupled Auth, Lightbox, and generic UI components | To do | Medium-High |
| P51-D | WordPress coupling audit & decoupling — replace or wrap all hardcoded WP assumptions in library code | To do | Medium |
| P51-E | Gallery adapter bug fixes — Spotlight thumbnail cap, Hexagon/Diamond %-unit height + row reflow, Scroll-snap infinite growth; extract a shared tile-size/geometry helper | To do | Medium |
| P51-F | Campaign listing card — uniform hover scale (card + image grow together) | To do | Small |
| P51-G | WP admin IA quick wins — rename top-level menu to "SuperGallery"; fix Companies taxonomy labels ("Add Tag") + clarify "Count" column | To do | Small |
| P51-H | Access-grant role editing — inline role dropdown in the grant row (currently delete-only) | To do | Small |

---

## Rationale

P50-G scoped the shared-package extraction to five `src/lib/` modules and the Auth/Lightbox components that were already confirmed clean by P46-D/E. That scope was deliberately conservative — the extraction was sequenced last in P50, and the audit needed to start somewhere. With P50 closed, the question is: **what else in this codebase could be extracted?**

There is almost certainly more than the P50-G list suggests. The project now has:

- 60+ utility functions in `src/utils/` — most are pure or nearly pure; only a handful import WPSG-specific types
- 60+ hooks in `src/hooks/` — some are tightly WordPress- or WPSG-specific; others (breakpoint, carousel, idle timeout, online status, tab visibility, viewport height, swipe, media dimensions) appear to be generic browser/React primitives buried in an application tree
- A layered HTTP transport (`HttpTransport` interface + `HttpTransportImpl`) and auth provider abstraction (`AuthProvider` / `WpJwtProvider`) that already follow an interface/implementation split suggesting they were designed to be replaceable
- A theme engine (`src/themes/`) with color generation, CSS variable emission, and validation that operates on plain JSON — no WP runtime dependency is immediately obvious
- Components where WordPress-specific behaviour (nonce heartbeats, `window.__WPSG_CONFIG__` reads, `wp_localize_script`-injected config) is co-located with generic UI logic that would work in any React context

Before committing to a package topology (how many packages, what goes where, what the public API surface looks like), a thorough human+model audit of the full source tree is warranted. P51-A is that audit.

---

## Track P51-A — Abstraction Spike (Opus/Fable Codebase Audit)

> **Recalibration (2026-06-14):** Two changes from the original P50-G-derived scope. (1) **`src/components/Galleries/Adapters/` is now in scope** — the adapter tree was never surveyed and is a strong source of pure-geometry/units candidates. (2) **Sequencing with P51-E:** run P51-E first. It extracts a shared tile-size-resolution + row-split helper from the hexagonal/diamond adapters (fixing the %-unit bugs in the process); that helper, plus the `cssUnits` helpers it builds on, are pre-classified `shared-utils` candidates the spike inherits rather than rediscovers. The spike's job for the adapters is to find the *rest* of the candidates around that seed.

### Problem

The P50-G plan named a conservative set of extraction candidates based on prior Phase 46 analysis. The codebase has grown significantly since then (P47–P50 added gallery spaces, adapters, the Layout Builder, the asset library, and the service worker). Several new modules may be ready for extraction; others that looked coupled in P46 may have since been cleaned up. More importantly, the P50-G plan says nothing about:

- Utils in `src/utils/` beyond the `src/lib/` five
- Hooks in `src/hooks/` beyond `useSwipe`
- The HTTP/auth service layer (`HttpTransport`, `WpJwtProvider`, `AuthProvider`)
- The theme engine (`src/themes/`)
- Layout engine utilities (`canvasMeasurement`, `smartGuides`, `groupGeometry`, `alignSlots`, `graphicLayerTransform`, `clipPath`, `layerList`)
- Generic UI component pieces inside the Layout Builder (canvas grid, rulers, measurement overlay, smart guides overlay)
- WordPress coupling points embedded in otherwise-generic code (nonce management, `window.__WPSG_CONFIG__`, `wp-json` URL patterns, `WpJwtProvider`)

Without this broader scan, P51-B and P51-C risk carving the wrong boundaries and leaving obvious candidates on the table.

### Goal of the Spike

Produce a **ranked, categorized candidate list** covering every module that is either:

1. **Ready now** — no WPSG/WP-specific imports; could move to a package today with only path changes
2. **Ready with light decoupling** — 1–3 WPSG-specific dependencies that can be injected as props/parameters or replaced with a generic interface
3. **Requires refactoring** — meaningfully coupled to WP or WPSG concerns, but the underlying logic is reusable enough that extraction with a refactor is worth considering
4. **Informative only** — tightly coupled but worth noting because a future abstraction boundary would naturally land nearby

For each candidate, the spike should capture:
- Current file path
- Category (pure util / hook / service / component / theme)
- WordPress/WPSG coupling points (specific symbols, imports, or runtime globals that tie it to this host)
- Proposed decoupling strategy if in category 2 or 3
- Target package (`shared-utils`, `shared-ui`, a new `shared-layout` package, or none)
- Confidence (high / medium / low)

### Scope

**Areas to survey:**

- `src/lib/` — the P50-G baseline; confirm still clean; nothing to discover but good calibration
- `src/utils/` — every file; classify pure vs. WPSG-coupled
- `src/hooks/` — every file; generic browser hooks vs. admin/WP hooks vs. genuinely mixed
- `src/services/http/` and `src/services/auth/` — the interface/impl split; assess portability
- `src/themes/` — color generation, CSS variable emission, adapter, types, validation
- `src/components/Admin/LayoutBuilder/` — canvas primitives (CanvasGrid, CanvasRulers, MeasurementOverlay, SmartGuides, GraphicLayerContent) that may be geometry/rendering utilities wearing component clothes
- `src/components/Galleries/Adapters/` — **added 2026-06-14.** The adapters are a large, previously-unsurveyed area. P51-E (see below) lands a shared tile-size resolution + row-split geometry helper extracted from `hexagonal/` and `diamond/`; that helper is a pre-seeded `shared-utils` candidate the spike should classify. Beyond it, survey the adapter registry (`adapterRegistry.ts`), the `GalleryAdapterProps` contract (`GalleryAdapter.ts`), and per-adapter rendering helpers for further pure-geometry/units candidates vs. WPSG-coupled rendering.
- `src/contexts/` and `src/services/queryClient.ts` — context providers; are any context shapes generic?
- `src/i18n/` and `src/lib/` (already listed) — for completeness

**WordPress coupling to flag specifically:**
- Direct `window.__WPSG_CONFIG__` reads
- `window.wp.*` accesses (WP media frame, WP API settings)
- Hardcoded `/wp-json/` URL prefixes
- `WpJwtProvider` — the nonce/cookie auth model is WP-specific; flag the shape of a generic JWT/token interface it could be abstracted from
- `useNonceHeartbeat` — WP nonce refresh; entirely WP-specific but worth noting if the underlying "token refresh" pattern could be generic
- WordPress admin CSS bleeding (e.g. `wpAdminFormReset.css`) — flag that this is WP-specific glue

**Packages to consider (beyond the P50-G two):**
- `@wp-super-gallery/shared-utils` — pure utilities and generic hooks (confirmed P50-G scope + new candidates)
- `@wp-super-gallery/shared-ui` — decoupled React components (Auth, Lightbox + new candidates)
- `@wp-super-gallery/canvas-primitives` — layout-builder canvas utilities if the geometry/rendering helpers are dense enough to warrant their own package
- `@wp-super-gallery/theme-engine` — if the theme system has no runtime WP deps and is self-contained enough to be independently published and consumed

### Output

The spike should produce a structured report (appended to this section as "Spike Findings") with:

1. **Executive summary** — how many modules found in each category; which packages make sense; any surprising coupling or surprising cleanliness discovered
2. **Candidate table** — one row per module: path | category | WP coupling points | decoupling strategy | target package | confidence
3. **Recommended package topology** — which packages to create in P51-B / P51-C / beyond, with rationale
4. **Decoupling playbook** — a concise description of each recurring coupling pattern found and the standard fix (e.g., "inject base URL as parameter instead of reading from `window.__WPSG_CONFIG__`")

### How to run the spike

Invoke an Opus or Fable agent with read access to the full `src/` tree. The agent should read each candidate file in its entirety — not just the top — because coupling often appears in a single import or runtime global read buried in an otherwise-clean file. For components, it should read both the `.tsx` and any co-located `.test.tsx` to understand what the test stubs out (stubbed globals are a coupling signal).

The agent should **not** write any code. Output is research only. P51-B and P51-C will use the findings to define their implementation scope.

### Acceptance criteria

- Every file in `src/lib/`, `src/utils/`, `src/hooks/`, `src/services/http/`, `src/services/auth/`, and `src/themes/` has an entry in the candidate table.
- Every Layout Builder canvas primitive (`CanvasGrid`, `CanvasRulers`, `MeasurementOverlay`, `SmartGuides`, `GraphicLayerContent`) has an entry.
- The adapter tree (`src/components/Galleries/Adapters/`) is surveyed: the P51-E tile-size/geometry helper is classified, and any further geometry/units candidates across the adapters have entries.
- All WordPress coupling points are listed by file and symbol, not summarized.
- The recommended package topology includes a concrete `package.json` name + proposed contents for each package, and explicitly argues against any package that doesn't make the cut.
- The decoupling playbook names the concrete symbol or pattern to replace in each case.

---

## Track P51-B — `packages/shared-utils/` extraction

> **Blocked on P51-A.** Scope defined by spike findings.

Baseline from P50-G: `src/lib/sanitizeCss.ts`, `cssUnits.ts`, `safeLocalStorage.ts`, `useSwipe.ts`, `scrollLock.ts`. The spike may expand this to include generic hooks and pure utils from `src/utils/` and `src/hooks/`, plus the adapter tile-size/geometry helper landed by P51-E (a pure, framework-agnostic function over `cssUnits`).

---

## Track P51-C — `packages/shared-ui/` extraction

> **Blocked on P51-A.** Scope defined by spike findings.

Baseline from P50-G: Auth components (`LoginForm`, `AuthBarFloating`, `AuthBarMinimal`) and Lightbox (`Lightbox`, `KeyboardHintOverlay`). The spike may expand this to include Layout Builder canvas primitives or theme engine components if they prove sufficiently decoupled.

---

## Track P51-D — WordPress coupling audit & decoupling

> **Blocked on P51-A.** Specific WP coupling points identified by the spike.

For any module targeted for extraction that has WordPress coupling, this track applies the decoupling playbook: replacing direct runtime global reads with injected parameters, replacing WP-specific interfaces with generic interface contracts, and removing or isolating WP admin CSS assumptions.

---

# Front-end Fixes & Admin Quick Wins (P51-E…H)

These tracks are independent of the abstraction spike and ready to execute. They are grouped into Phase 51 as small, ship-now fixes (the larger net-new features and the RBAC audit live in PHASE52_REPORT.md).

## Track P51-E — Gallery adapter bug fixes

### Problem
Four adapter bugs, all front-end-only:

1. **Spotlight thumbnail cap too low.** The `spotlightThumbnailSize` dimension control caps at `max: 200` in `src/components/Galleries/Adapters/adapterRegistry.ts` (~line 879). Consumed in `spotlight/SpotlightGallery.tsx` (`thumbSize`, ~line 67) — no logic change, just the cap.
2. **Hexagon %-unit height + row reflow broken.** In `src/components/Galleries/Adapters/hexagonal/HexagonalGallery.tsx`: `tSize` is computed in px (~line 68) but applied to both width and height via `toCssOrNumber(tSize, tileSizeUnit)` (~lines 134–135), so non-`px` units flatten the hexagons. The tiles-per-row math (~line 80, `Math.floor((containerWidth + gapX) / (tSize + gapX))`) compares a px container width against a non-px tile value, so for `%`/`vw`/`em`/`rem` nothing ever wraps and tiles overflow offscreen.
3. **Diamond — same two bugs**, copy-pasted in `src/components/Galleries/Adapters/diamond/DiamondGallery.tsx` (~lines 69, 80, 134–135; `V_OVERLAP = 0.5`).
4. **Scroll-snap infinite growth.** In `src/components/Galleries/Adapters/scroll-snap/ScrollSnapGallery.tsx`, the scroll container (~lines 140–266) holds N slides each `height: snapHeightCss` + `flexShrink: 0` (~lines 186, 192) without a bounded column track, so intrinsic height grows with item count and the viewport balloons.

### Goal / approach
- **Spotlight:** raise the `max` (e.g. 400–600) at `adapterRegistry.ts:879`.
- **Hexagon + Diamond:** resolve `tileSize` to an actual px width before geometry — using `containerWidth` for `%`, viewport for `vw`, font metrics for `em`/`rem` — then drive width/height/overlap/row-split from the resolved px value, preserving the clip's aspect ratio. **Extract this as a shared helper** (e.g. `resolveTileLayout(tileSize, unit, containerWidth, gap) → { pxSize, tilesPerRow, rows }`) so hexagon and diamond share one implementation instead of two copies. This helper is the seed candidate handed to the P51-A spike.
- **Scroll-snap:** rebuild the container as a bounded vertical scroll-snap pager — explicit `flexDirection: column`, fixed container height, `scrollSnapType: 'y mandatory'`, slides carrying `scrollSnapAlign`. Reference: the standard CSS scroll-snap vertical-pager pattern the user provided.

**Shared infra:** `Adapters/GalleryAdapter.ts` (`GalleryAdapterProps`); `adapterRegistry.ts`; unit helpers `packages/shared-utils/src/cssUnits.ts` (`toCss`, `toCssOrNumber`, `CSS_WIDTH_UNITS`).

### Acceptance criteria
- Spotlight thumbnails render above 200px when configured.
- Hexagon and Diamond render correct aspect ratios and wrap into rows for every supported unit (`px`, `%`, `vw`, `em`, `rem`); none overflow the container horizontally.
- Hexagon and Diamond share a single tile-layout helper (no copy-paste).
- Scroll-snap renders a fixed-height pager that snaps between items and does not grow unbounded; covered by a test asserting bounded container height for N items.

## Track P51-F — Campaign listing card uniform hover scale

### Problem
`src/components/CampaignGallery/CampaignCard.module.scss` (~lines 5–12): on hover the card gets `translateY(-2px)` while a separate rule scales only `.thumbnailImage` (`transform: scale(1.02)`), producing a "zoom through a window" effect — the image grows but the card chrome does not.

### Approach
Apply the scale to the whole card (scale `.card`, or wrap image + chrome in one transformed element) and remove the image-only transform so card and image grow together uniformly. Component: `CampaignGallery/CampaignCard.tsx`.

### Acceptance criteria
- On hover, the entire card (border, chrome, and image) scales as one unit; the image no longer scales independently of its frame.

## Track P51-G — WP admin IA quick wins

### Problem & approach
PHP, `wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php`:

1. **Rename top-level menu to "SuperGallery"** (keep the inner "Campaigns" list item). The `wpsg_campaign` CPT (~lines 61–70) drives both the top-level menu and its "All Campaigns" submenu from a bare `label`. Provide a `labels` array instead: `menu_name => 'SuperGallery'` and `all_items => 'Campaigns'` (plus `name`/`singular_name`), so only the top-level menu is renamed. Confirm the Settings/Spaces submenus still nest under `edit.php?post_type=wpsg_campaign` (`includes/settings/class-wpsg-settings-renderer.php` ~line 43; `includes/class-wpsg-space-admin-renderer.php` ~line 30).
2. **Fix Companies taxonomy "Add Tag" + "Count".** `register_taxonomy('wpsg_company', …)` (~lines 72–78) is registered with only `label`, so WP falls back to default non-hierarchical strings ("Add New Tag", etc.). Add a proper `labels` array (`add_new_item => 'Add New Company'`, `new_item_name => 'New Company Name'`, …). The ambiguous "Count" column is a fixed WP taxonomy column — rename/clarify it to "Campaigns" via a `manage_edit-wpsg_company_columns` / `manage_wpsg_company_custom_column` filter pair.

### Acceptance criteria
- WP sidebar shows a "SuperGallery" top-level menu with a "Campaigns" item beneath it (plus existing Settings/Spaces).
- The Companies taxonomy screen reads "Add New Company" (no "Add Tag" wording) and the count column is clearly labeled.

## Track P51-H — Access-grant role editing (dropdown)

### Problem & approach
The access-grant row supports delete only; add an inline role `Select` (viewer / editor / owner).
- Row renderer `src/hooks/useAccessRows.tsx` (~lines 62–76): replace the static role `Badge` with a Mantine `Select`.
- On change, upsert via the existing endpoints (no schema change): `POST …/campaigns/{id}/access` and `POST …/companies/{id}/access` both accept `access_level` and use `upsert_grant()` (`includes/rest/class-wpsg-access-controller.php`), which replaces the existing entry for that user.
- Add an update mutation in `src/services/adminQuery.ts` (alongside the existing grant mutations) and invalidate the grants query on success. Grant shape: `CompanyAccessGrant` (`adminQuery.ts` ~lines 111–125).

### Acceptance criteria
- Each grant row exposes a role dropdown; changing it persists the new `access_level` and the row reflects it after refetch.
- No regression to the existing delete/revoke action.

---

*Updated: 2026-06-12 (P51-A spike track written; P51-B/C/D stubs blocked on spike findings)*
*Updated: 2026-06-14 — Added front-end fix tracks P51-E…H (adapter bugs, card hover, WP menu/taxonomy labels, access-grant role dropdown). Recalibrated P51-A: added `src/components/Galleries/Adapters/` to the spike's survey scope and sequenced P51-E first so its extracted tile-layout helper seeds the spike candidate list. Larger net-new features and the RBAC audit split into PHASE52_REPORT.md.*
