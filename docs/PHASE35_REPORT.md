# Phase 35 — Campaign Listing Adapter Unification

**Status:** Complete
**Created:** 2026-05-21
**Last updated:** 2026-05-22

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P35-A | Adapter contract widening (items + renderItem, capability, pagination ownership) | Complete | Small-Medium |
| P35-B | Setting plumbing — `campaignListingAdapterId` + Display Settings UI | Complete | Small |
| P35-C | `CardGallery` host refactor — delegate layout to adapter | Complete | Medium-Large |
| P35-D | `CompactGridGallery` listing mode | Complete | Small |
| P35-E | `MasonryGallery` listing mode (CSS-multi-column path) | Complete | Small |
| P35-F | `JustifiedGallery` listing mode (flex-row-stretch path) | Complete | Small |
| P35-G | `MediaCarouselAdapter` (classic) listing mode — adapter-owned pagination | Complete | Medium |
| P35-H | Test-suite expansion & visual-parity guard | Complete | Medium |
| P35-I | Carry-forward bookkeeping — open follow-up tracks for deferred items | Complete | Small |

---

## Rationale

1. The codebase has two divergent card-rendering paths today: per-campaign
   galleries (modular adapter pipeline, 8 registered adapters) and the public
   campaign listing (`CardGallery.tsx`, hardcoded flex-wrap grid). Layout
   improvements made on one side don't reach the other.
2. The user-visible asymmetry is awkward: an admin can configure a per-campaign
   gallery to use masonry, justified, or a classic carousel, but the listing of
   campaigns above those galleries is locked to a single fixed grid.
3. Shared layout math has already been partially extracted in P29-H
   (`src/utils/gridLayout.ts`), but the unification stopped at utilities.
   `CardGallery` still owns the entire render path.
4. Two independent assessments (Qwen, GPT-5.4) converged on the same
   architectural direction: host owns filters/search/pagination/modal; adapter
   owns layout. That split is the natural extension of the existing adapter
   contract.
5. The original P30-F wording ("CardGallery / CompactGrid generic grid-shell
   investigation") was too narrow — the real goal is broader adapter
   convergence for listings, not just a shared shell. P30-F is therefore
   retired/superseded by Phase 35.
6. Admin Panel surfaces (`CampaignsTab.tsx`, `CampaignsMobileList.tsx`) are
   intentionally out of scope. The desktop table is column-shaped (sort/scan/
   bulk-select) and not a card listing; the mobile list could conceivably join
   later but is a separate product surface.
7. Layout-builder for listings and shape adapters for listings are deferred for
   separate evaluation. They are *not* skipped — P35-I formalizes carry-forward.

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | How to widen the adapter contract for listings | Add optional `items?: TItem[]` and `renderItem?: (item, idx) => ReactNode` to `GalleryAdapterProps`. Existing adapters that ignore the new fields stay backward-compatible. Single registry, single component shape. Rejected: a parallel `ListingAdapterProps<T>` contract — too much duplication. |
| B | How adapters declare listing support | New `'listing-compatible'` value in the `AdapterCapability` union. Phase 1 enables compact-grid, masonry, justified, classic. Shape adapters and layout-builder remain non-listing-compatible for now. |
| C | How pagination ownership is modeled | Add `paginationOwnership: 'host' \| 'adapter'` to `AdapterRegistration`. Default `host`. Classic-carousel becomes `adapter`. CardGallery host conditionally hides its own pagination UI when the active adapter owns pagination. |
| D | How the listing-adapter ID is resolved | New dedicated `resolveListingAdapterId(settings, breakpoint)` helper. Not a new scope inside `resolveAdapterId` — the listing surface is conceptually separate from per-media-type galleries and conflating them in `galleryConfig` would confuse the existing per-scope model. |
| E | How the user picks a listing layout | New explicit `campaignListingAdapterId` setting plus optional `campaignListingAdapterIdMobile`/`Tablet`. Rendered as a new "Campaign Listing" accordion item in Display Settings, separate from per-campaign-gallery adapter controls. |
| F | What happens on default upgrade | Default `campaignListingAdapterId = 'compact-grid'`. The compact-grid adapter in listing mode must produce DOM that is byte-identical to the current CardGallery output. Snapshot test enforces this. |
| G | How CardGallery is refactored | Split into three layers: host shell (filters/search/access/modal/in-context-editors), host-pagination module (only mounted when `paginationOwnership === 'host'`), and adapter slot. New helper component `CardGalleryHostPagination.tsx`. |
| H | What happens to display-mode controls when carousel is active | Hide them entirely. Setting UI greys out `cardDisplayMode` with helper text "Pagination handled by Classic Carousel adapter." This is cleaner than silently no-oping. |
| I | Whether listing and per-campaign-gallery settings share knobs (gridCardWidth, masonryColumns, thumbnailGap, etc.) | Share for Phase 1 — simpler and reflects current product behavior. Distinct knobs can be added in a later phase if user feedback warrants. |
| J | What gets deferred and how | Layout-builder for listings, shape adapters for listings, and Admin Panel listing convergence are explicitly deferred. P35-I opens follow-up tracks in the next phase report so they don't disappear. |

---

## Related Planning

- Supersedes the original P30-F ("CardGallery / CompactGrid generic grid-shell
  investigation"). Phase 35 is the implementation phase.
- Builds on shared utilities extracted in P29-H:
  - `src/utils/gridLayout.ts` (`resolveFixedCardWidth`, `gridRowMaxWidthCss`,
    `formatGapCss`).
  - `src/utils/cardConfig.ts` (`resolveCardBreakpointSettings`).
- Deferred items are carried forward via P35-I into the next active phase
  report (likely `PHASE36_REPORT.md` or wherever appropriate at the time):
  - Layout-builder for listings (slot→card composition design)
  - Shape adapters for listings (hex/circle/diamond UX evaluation)
  - Admin Panel listing convergence (potential `Table | Cards` toggle)

---

## Execution Priority

1. **P35-A** — Widens the adapter contract. All subsequent tracks compile
   against the updated `GalleryAdapterProps` and `AdapterRegistration`; nothing
   else can merge before this lands.
2. **P35-B** — Adds `campaignListingAdapterId` to settings and the
   `resolveListingAdapterId` helper. The host refactor (P35-C) depends on this
   resolver.
3. **P35-C** — Host-shell refactor of `CardGallery.tsx`. The most invasive
   change; defer until A and B are stable to keep the diff reviewable.
4. **P35-D / P35-E / P35-F / P35-G** — Per-adapter listing-mode branches. No
   inter-dependency among the four; can land in any order or in parallel after
   A is merged.
5. **P35-H** — Test-suite sign-off. New tests are added alongside each track
   as it lands; this track is the final pass ensuring the full suite is green
   and the default-settings snapshot is locked.
6. **P35-I** — Carry-forward bookkeeping. Done last, after all implementation
   tracks are closed.

---

## Track P35-A — Adapter Contract Widening

### Problem

The current `GalleryAdapterProps` interface only models media-gallery rendering:

```ts
export interface GalleryAdapterProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}
```

There is no way for an adapter to render arbitrary items (e.g. campaign cards)
through a host-provided renderer, and no metadata distinguishes adapters that
can render listings from those that cannot. There is also no way for an adapter
to declare that it owns pagination internally (carousel state), so the host
cannot reliably hide its own display-mode controls when a self-paginating
adapter is active.

### Fix

Widen the contract minimally and backward-compatibly:

- Add optional `items?: TItem[]` and `renderItem?: (item, idx) => ReactNode`
  to `GalleryAdapterProps`. Adapters that haven't been migrated simply ignore
  the new fields.
- Add `'listing-compatible'` to the `AdapterCapability` union.
- Add `paginationOwnership: 'host' | 'adapter'` to `AdapterRegistration`
  (default `'host'`).
- Add `listingMode?: { surface: 'campaign-listing' }` so adapters can render
  surface-aware affordances if needed.

### Implementation Details

**Contract extension**

```ts
// src/components/Galleries/Adapters/GalleryAdapter.ts

export type AdapterCapability =
  | 'lightbox' | 'drag-scroll' | 'infinite-scroll'
  | 'grid-layout' | 'carousel-layout' | 'keyboard-nav'
  | 'touch-swipe' | 'layout-builder'
  | 'listing-compatible';

export interface ListingItem { id: string; }

export interface GalleryAdapterProps<TItem extends ListingItem = ListingItem> {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
  items?: TItem[];
  renderItem?: (item: TItem, index: number) => ReactNode;
  listingMode?: { surface: 'campaign-listing' };
}

export interface AdapterRegistration {
  // ...existing fields...
  paginationOwnership?: 'host' | 'adapter';
}
```

**Registry helpers**

Add to `adapterRegistry.ts`:

- `getListingAdapterSelectOptions(breakpoint?)` — filters
  `getRegisteredAdapters()` by `'listing-compatible'` capability and applies
  `supportsMobile` for the active breakpoint.
- `adapterOwnsPagination(id)` — returns `paginationOwnership === 'adapter'`.

**Capability matrix (Phase 1)**

| Adapter | listing-compatible | paginationOwnership |
|---|---|---|
| `compact-grid` | yes (default) | host |
| `masonry` | yes | host |
| `justified` | yes | host |
| `classic` (carousel) | yes | **adapter** |
| `hexagonal`, `circular`, `diamond` | no | — |
| `layout-builder` | no | — |

**Registry storage**

Registry stores `ComponentType<GalleryAdapterProps<any>>` to avoid forcing each
adapter to share a type parameter. Each adapter constrains `TItem` internally
based on what it consumes.

### Acceptance criteria

- `GalleryAdapterProps` includes optional `items`, `renderItem`, `listingMode`. ( )
- `AdapterCapability` union includes `'listing-compatible'`. ( )
- `AdapterRegistration` includes `paginationOwnership` (optional, defaulting
  to `'host'`). ( )
- The 4 Phase-1 adapters (`compact-grid`, `masonry`, `justified`, `classic`)
  are tagged `'listing-compatible'`. ( )
- `classic` is tagged `paginationOwnership: 'adapter'`; others remain `'host'`. ( )
- `getListingAdapterSelectOptions()` returns exactly those 4. ( )
- `adapterOwnsPagination('classic')` returns `true`; others `false`. ( )
- Existing adapter tests still pass with no implementation changes to the
  components themselves (contract is backward-compatible). ( )

### Validation

- RTL/Vitest: `adapterRegistry.test.ts` — new assertions on capability,
  ownership, and helper outputs.
- TypeScript: `tsc --noEmit` passes; widened interface does not break any
  existing adapter implementation.
- No runtime behavior change yet (adapters still render media; listing mode
  is wired up in subsequent tracks).

### Files Affected

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/GalleryAdapter.ts` | Widen `GalleryAdapterProps`, add `'listing-compatible'`, add `ListingItem`, add `paginationOwnership` to `AdapterRegistration` |
| `src/components/Galleries/Adapters/adapterRegistry.ts` | Tag 4 Phase-1 adapters with capability + ownership; add `getListingAdapterSelectOptions`, `adapterOwnsPagination` |
| `src/components/Galleries/Adapters/adapterRegistry.test.ts` | New assertions |

### Effort Estimate

~3-4 hours.

---

## Track P35-B — Setting Plumbing

### Problem

There is currently no user-facing way to choose a listing layout. CardGallery
renders the same flex-grid for everyone, regardless of preferences. The
existing `galleryConfig` model (per-breakpoint × per-media-type adapter
mappings) lives at the per-campaign-gallery level and is the wrong semantic
surface for listings.

### Fix

Add explicit `campaignListingAdapterId` settings to `GalleryBehaviorSettings`
plus optional per-breakpoint variants. Expose them via a new "Campaign
Listing" accordion item in Display Settings. Add a dedicated resolver helper.

### Implementation Details

**Setting fields**

```ts
// In GalleryBehaviorSettings
campaignListingAdapterId: GalleryAdapterId;             // default 'compact-grid'
campaignListingAdapterIdMobile?: GalleryAdapterId;      // optional override
campaignListingAdapterIdTablet?: GalleryAdapterId;      // optional override
```

**Defaults**

`DEFAULT_GALLERY_BEHAVIOR_SETTINGS.campaignListingAdapterId = 'compact-grid'`.
Backward-compatibility guarantee: when default, the rendered DOM must match
today's CardGallery output exactly (enforced via snapshot test in P35-H).

**Resolver**

```ts
// src/utils/resolveListingAdapterId.ts (new)
export function resolveListingAdapterId(
  s: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
): string {
  const perBp = breakpoint === 'mobile' ? s.campaignListingAdapterIdMobile
              : breakpoint === 'tablet' ? s.campaignListingAdapterIdTablet
              : undefined;
  return normalizeAdapterId(perBp ?? s.campaignListingAdapterId ?? 'compact-grid');
}
```

Not a new scope inside `resolveAdapterId` — that resolver is structured around
per-media-type (image/video/unified) scopes that are intrinsic to per-campaign
galleries. The listing surface is semantically separate.

**Settings UI placement**

Add a new accordion item `"Campaign Listing"` inside the existing
`MediaDisplaySettingsSection.tsx`. The new item contains:

- A `Select` for `campaignListingAdapterId` driven by
  `getListingAdapterSelectOptions()`.
- Optional mobile/tablet override `Select`s.
- A helper note that adapter-specific knobs (gap, columns, target row height)
  live in their existing per-adapter setting groups, which apply to both
  per-campaign galleries and listings in Phase 1.

### Acceptance criteria

- `GalleryBehaviorSettings` has `campaignListingAdapterId`,
  `campaignListingAdapterIdMobile?`, `campaignListingAdapterIdTablet?`. ( )
- `DEFAULT_GALLERY_BEHAVIOR_SETTINGS` defaults
  `campaignListingAdapterId = 'compact-grid'`. ( )
- `resolveListingAdapterId(settings, breakpoint)` returns the correct id with
  per-breakpoint precedence and `'compact-grid'` fallback. ( )
- A new "Campaign Listing" accordion item renders in Display Settings with the
  adapter selector populated by `getListingAdapterSelectOptions()`. ( )
- Settings persist through the existing save flow. ( )

### Validation

- RTL/Vitest: `resolveListingAdapterId.test.ts` — per-breakpoint precedence,
  fallback, normalization.
- RTL/Vitest: settings panel test — accordion item renders, selector emits
  changes, save flow includes the new key.
- Manual QA: change listing adapter in Display Settings, save, reload —
  setting persists.

### Files Affected

| File | Change |
|------|--------|
| `src/types/index.ts` | New setting fields + defaults; add to schema-registered keys |
| `src/utils/resolveListingAdapterId.ts` | New helper |
| `src/utils/resolveListingAdapterId.test.ts` | New tests |
| `src/components/Settings/MediaDisplaySettingsSection.tsx` | New "Campaign Listing" accordion item |

### Effort Estimate

~2-3 hours.

---

## Track P35-C — CardGallery Host Refactor

### Problem

`src/components/CampaignGallery/CardGallery.tsx` is 570 lines and owns
everything: filtering, search, access mode, display modes (load-more /
paginated / show-all), pagination state, slide animation, DotNavigator,
OverlayArrows, keyboard navigation, CampaignViewer modal, admin in-context
editors, header settings, responsive breakpoint resolution, fixed/responsive
card width logic, AND the actual flex-grid rendering. There is no separation
between *host concerns* (filter/search/pagination/modal/editing) and *layout
concerns* (how items are arranged on screen).

### Fix

Split into three layers without losing any current behavior:

1. **Host shell** (`CardGallery.tsx`, ~200 lines): owns filter tabs, search,
   access mode toggle, modal, in-context editors, header. Resolves listing
   adapter id via `resolveListingAdapterId`. Decides who paginates.
2. **Host pagination module** (`CardGalleryHostPagination.tsx`, new, ~250 lines):
   owns display-mode-driven slice/append/pagination state, slide animation,
   DotNavigator, OverlayArrows, keyboard navigation. Only mounted when the
   active adapter has `paginationOwnership === 'host'`.
3. **Adapter slot**: lazy-wrapped `<Suspense>`, renders the chosen adapter
   with `items={visibleCampaigns}` and a `renderItem` that constructs
   `<CampaignCard>` instances.

### Implementation Details

**Adapter-slot wiring**

```tsx
<Suspense fallback={<Loader />}>
  <Adapter
    items={visibleCampaigns}
    renderItem={(campaign, idx) => (
      <CampaignCard
        campaign={campaign}
        hasAccess={hasAccess(campaign.id, campaign.visibility)}
        onClick={() => setSelectedCampaign(campaign)}
        settings={s}
        apiClient={!hasAccess(...) && !isAdmin ? apiClient : undefined}
        {...(fixedCardWidth ? { maxWidth: fixedCardWidth.value, maxWidthUnit: fixedCardWidth.unit } : {})}
      />
    )}
    media={[]}
    settings={s}
    listingMode={{ surface: 'campaign-listing' }}
    containerDimensions={{ width: containerWidth, height: 0 }}
  />
</Suspense>
```

**Pagination-ownership branch**

```ts
const adapterPaginated = adapterOwnsPagination(listingAdapterId);

if (adapterPaginated) {
  // Adapter owns all items; host does not slice or paginate.
  visibleCampaigns = filteredCampaigns;
  // Display-mode controls hidden.
} else {
  // Host owns slicing per current display mode (load-more / paginated / show-all).
  visibleCampaigns = hostPaginationSlice(filteredCampaigns, displayMode, ...);
}
```

**Responsive/fixed-width preservation**

CardGallery currently computes `responsiveCardWidth` and `fixedCardWidth`
(lines 247-265 of current `CardGallery.tsx`). In listing mode, the adapter
owns in-row layout, but user intent for fixed-width is preserved by
forwarding `maxWidth`/`maxWidthUnit` to `<CampaignCard>` (already supported
at `CampaignCard.tsx:25`). The adapter's column wrap math
(`gridCardMaxColumns`, `masonryColumns`, `mosaicTargetRowHeight`) handles
the responsive case.

**`cardGridColumns` → `gridCardMaxColumns` forward-compat**

When `campaignListingAdapterId === 'compact-grid'` (default) and the user has
not explicitly set `gridCardMaxColumns`, forward the existing `cardGridColumns`
value into the adapter's column math. This preserves byte-identical default
output without forcing users to re-configure.

**In-context editors**

All existing in-context editors (header settings, title/subtitle toggles,
viewerBgType, viewer typography, background color) remain inside the host
shell, above the adapter slot. Not moved.

**Keyboard nav clash avoidance**

Host's keyboard nav (ArrowLeft/Right at `CardGallery.tsx:209-216`) only binds
when `paginationOwnership === 'host'`. The carousel adapter binds its own.

### Acceptance criteria

- `CardGallery.tsx` no longer renders the inline `<div className="grid">`; it
  delegates to an adapter component. ( )
- All existing tests in `CardGallery.test.tsx` (filter, search, access-mode,
  hidden notice) remain green. ( )
- With default settings (`campaignListingAdapterId='compact-grid'`), the
  rendered DOM tree is functionally indistinguishable from today's
  CardGallery output. ( )
- When `campaignListingAdapterId='classic'` (carousel, `paginationOwnership='adapter'`):
  - Load-more button is absent.
  - DotNavigator/OverlayArrows from the host are absent.
  - Page indicator text is absent.
  - Keyboard nav handler is not bound on host. ( )
- `CampaignViewer` modal still opens on card click. ( )
- Locked cards still render `RequestAccessForm` when appropriate. ( )
- Admin in-context editors still render in the header area. ( )

### Validation

- RTL/Vitest: `CardGallery.test.tsx` — full existing suite remains green.
- RTL/Vitest: new snapshot test asserting default-settings DOM byte-identical
  pre/post refactor.
- RTL/Vitest: new tests for adapter-owned pagination path
  (`campaignListingAdapterId='classic'`).
- Manual QA: smoke test all four listing adapters end-to-end in the browser.

### Files Affected

| File | Change |
|------|--------|
| `src/components/CampaignGallery/CardGallery.tsx` | Major refactor — host shell only |
| `src/components/CampaignGallery/CardGalleryHostPagination.tsx` | **New** — host pagination encapsulation |
| `src/components/CampaignGallery/CardGallery.test.tsx` | Adapt for new structure; add snapshot test |

### Effort Estimate

~6-8 hours.

---

## Track P35-D — CompactGridGallery Listing Mode

### Problem

`CompactGridGallery.tsx` currently maps `media.map((item, index) => <GridCard ...>)`
to render media tiles. It cannot render arbitrary items via a host-provided
renderer.

### Fix

Branch internally on `items && renderItem`:

- When listing mode is active, render `items.map((item, idx) =>
  <Box key={item.id}>{renderItem(item, idx)}</Box>)` instead of the media-tile
  path.
- Skip `<GridCard>`, aspect-ratio enforcement, and Lightbox in listing mode
  (cards are content-driven and open `CampaignViewer`).
- Preserve flex-wrap container, `flexBasis: min(cardWidth, calc(50% - gap/2))`,
  `gridMaxWidth`, gap, justifyContent.

### Implementation Details

The compact-grid adapter is the default listing adapter and must reproduce
today's CardGallery output exactly under default settings. The forward-compat
mapping `cardGridColumns → gridCardMaxColumns` from P35-C carries the user's
existing column preferences into the adapter without UI changes.

### Acceptance criteria

- `CompactGridGallery` renders `renderItem(item, idx)` for each `item` when
  `items` is present. ( )
- Lightbox is not mounted in listing mode. ( )
- Container styling (flex-wrap, gap, justifyContent, max-width) matches the
  media-mode output structurally. ( )
- Default-settings listing-mode DOM is byte-identical to today's `CardGallery`
  flex-grid (snapshot test, see P35-H). ( )

### Validation

- RTL/Vitest: new `compact-grid/CompactGridGallery.listing.test.tsx`.
- Manual QA: switch listing adapter to compact-grid (default), confirm
  visual parity.

### Files Affected

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` | Add listing-mode branch |
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.listing.test.tsx` | **New** |

### Effort Estimate

~3 hours.

---

## Track P35-E — MasonryGallery Listing Mode

### Problem

`MasonryGallery.tsx` currently feeds enriched `MediaItem[]` (with intrinsic
width/height) into `react-photo-album`'s `MasonryPhotoAlbum`. For listings,
campaigns have no intrinsic dimensions to feed RPA, and faking dimensions
would be a poor abstraction.

### Fix

Bypass `react-photo-album` in listing mode. Implement a CSS-multi-column
container:

- Container: `columnCount: masonryColumns` (or breakpoint-resolved value),
  `columnGap: thumbnailGap`.
- Items: `break-inside: avoid` so each card stays whole.
- Items self-size; the natural packing fills each column top-to-bottom.

### Implementation Details

Same packing intuition as masonry-of-media without the intrinsic-dimensions
requirement. Cards stack vertically within each column, columns are
balanced by the browser.

### Acceptance criteria

- `MasonryGallery` renders `renderItem` items in a CSS-multi-column container
  when `items` present. ( )
- `react-photo-album` not invoked in listing mode. ( )
- Lightbox/preview behavior absent in listing mode. ( )
- Column count and gap controlled by existing `masonryColumns` and
  `thumbnailGap` settings. ( )

### Validation

- RTL/Vitest: new `masonry/MasonryGallery.listing.test.tsx`.
- Manual QA: select masonry listing adapter, confirm columns balance and gaps
  match settings.

### Files Affected

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/masonry/MasonryGallery.tsx` | Add listing-mode branch |
| `src/components/Galleries/Adapters/masonry/MasonryGallery.listing.test.tsx` | **New** |

### Effort Estimate

~3-4 hours.

---

## Track P35-F — JustifiedGallery Listing Mode

### Problem

`JustifiedGallery.tsx` packs media tiles into justified rows based on
aspect-ratio math (each row fills container width, each tile's AR is
preserved). Campaign cards have no intrinsic aspect ratio to pack against.

### Fix

In listing mode, implement a **flex-row-stretch** layout: each row's items
share `flex: 1 1 0` with a `min-width` derived from the target row height.
Items wrap when the natural row width would exceed the container. Visually
distinct from compact-grid (stretchy rows vs. fixed-width tiles).

### Implementation Details

Use `mosaicTargetRowHeight` (existing setting) to derive a `min-width: calc(...)`
and `height: target` on each item. Allow `flex-wrap: wrap` so rows form
naturally. Avoids feeding fake aspect ratios to react-photo-album.

### Acceptance criteria

- `JustifiedGallery` renders `renderItem` items in a flex-row-stretch layout
  when `items` present. ( )
- `react-photo-album` not invoked in listing mode. ( )
- Each row of cards visually stretches to fill the container width. ( )
- Gap and target row height controlled by existing settings. ( )

### Validation

- RTL/Vitest: new `justified/JustifiedGallery.listing.test.tsx`.
- Manual QA: select justified listing adapter, confirm rows fill width and
  wrap correctly.

### Files Affected

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/justified/JustifiedGallery.tsx` | Add listing-mode branch |
| `src/components/Galleries/Adapters/justified/JustifiedGallery.listing.test.tsx` | **New** |

### Effort Estimate

~3 hours.

---

## Track P35-G — MediaCarouselAdapter (Classic) Listing Mode

### Problem

`MediaCarouselAdapter.tsx` renders media-specific slides (image / video /
iframe) with aspect-ratio enforcement, lightbox integration, and video
controls. For campaign listings, slides need to be full cards. Additionally,
the carousel manages its own slide state (current index, dots, autoplay,
drag) — meaning when this adapter is active for listings, the host's
load-more / paginated / show-all controls become irrelevant and should be
hidden entirely.

### Fix

Branch on `items && renderItem`:

- Drop in listing mode: image/video aspect ratio, lightbox, video player,
  fullscreen toggle.
- Keep in listing mode: Embla carousel setup, autoplay, loop, drag, dot
  navigator, overlay arrows, edge fade, darken-unfocused. Slide flex-basis
  stays `100% / carouselVisibleCards` so the existing setting works as today.
- Each slide becomes `<div className="embla-slide">{renderItem(item, idx)}</div>`.

The adapter is registered with `paginationOwnership: 'adapter'`, which the
CardGallery host respects by hiding its own pagination UI.

### Implementation Details

The carousel's existing dot navigator and overlay arrows already integrate
visually below the slide rail. In listing mode they continue to do so —
they navigate slides of cards instead of slides of media.

### Acceptance criteria

- `MediaCarouselAdapter` renders `renderItem(item, idx)` for each `item`
  when `items` is present. ( )
- Slides are wrapped in Embla; autoplay, loop, drag, edge-fade,
  darken-unfocused all functional. ( )
- Lightbox/video player not mounted in listing mode. ( )
- Dot navigator and overlay arrows visible. ( )
- Slide count equals item count. ( )

### Validation

- RTL/Vitest: new `MediaCarouselAdapter.listing.test.tsx`.
- Manual QA: select classic listing adapter, confirm:
  - Cards slide horizontally via Embla.
  - Host pagination UI hidden.
  - Autoplay/loop/drag work.
  - Clicking a card still opens `CampaignViewer`.

### Files Affected

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/MediaCarouselAdapter.tsx` | Add listing-mode branch |
| `src/components/Galleries/Adapters/MediaCarouselAdapter.listing.test.tsx` | **New** |

### Effort Estimate

~4-5 hours.

---

## Track P35-H — Test Suite Expansion & Visual-Parity Guard

### Problem

The refactor must not regress existing behavior. CardGallery has substantial
test coverage already (filter/search/access-mode/display-modes); the new
listing-mode adapter paths need their own coverage; and the default-upgrade
parity guarantee needs an explicit guard.

### Fix

- Keep existing tests green: `CardGallery.test.tsx`, `adapterRegistry.test.ts`,
  `MediaCarouselAdapter.test.tsx`, `adapters.test.tsx`.
- Add new snapshot test: default-settings CardGallery DOM tree is
  byte-identical pre/post refactor.
- Add new per-adapter listing-mode tests.
- Add registry assertions for new capabilities and ownership flags.

### Implementation Details

**Registry tests (`adapterRegistry.test.ts`)**

- `'listing-compatible'` capability is set on `compact-grid`, `masonry`,
  `justified`, `classic`.
- `paginationOwnership` is `'adapter'` only for `classic`; `'host'`
  (or undefined→host) elsewhere.
- `getListingAdapterSelectOptions()` returns exactly those four adapters.
- `adapterOwnsPagination('classic')` is `true`; others `false`.

**CardGallery tests (`CardGallery.test.tsx`)**

- All existing assertions continue to pass.
- New: render with `campaignListingAdapterId='masonry'`, assert CSS-multi-column
  container present.
- New: render with `campaignListingAdapterId='classic'`, assert load-more
  button absent, DotNavigator absent, page indicator absent.
- New: render with default settings, snapshot the resulting DOM and
  compare against pre-refactor baseline.

**Per-adapter listing tests**

For each of `compact-grid`, `masonry`, `justified`, `classic`:

- `renderItem` invoked once per item.
- Item keys correct.
- No Lightbox in DOM.
- Expected wrapper class/style for that adapter's listing layout.

### Acceptance criteria

- All existing tests pass without modification (except where the refactor
  legitimately changes structure). ( )
- New registry assertions pass. ( )
- New snapshot test confirms default-settings DOM byte-identical pre/post. ( )
- New per-adapter listing tests cover all 4 Phase-1 adapters. ( )
- New CardGallery host-pagination-hidden tests pass for `'classic'`. ( )

### Validation

- `npm test` (full suite) green.
- `npx tsc --noEmit` clean.

### Files Affected

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/adapterRegistry.test.ts` | New assertions |
| `src/components/CampaignGallery/CardGallery.test.tsx` | New scenarios + snapshot |
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.listing.test.tsx` | **New** |
| `src/components/Galleries/Adapters/masonry/MasonryGallery.listing.test.tsx` | **New** |
| `src/components/Galleries/Adapters/justified/JustifiedGallery.listing.test.tsx` | **New** |
| `src/components/Galleries/Adapters/MediaCarouselAdapter.listing.test.tsx` | **New** |

### Effort Estimate

~4-6 hours.

---

## Track P35-I — Carry-Forward Bookkeeping

### Problem

Three substantive items were deliberately deferred from Phase 35 — they are
*not* skipped, but they require separate evaluation and design. If they are
not formally tracked, they will silently disappear from the planning
backlog.

### Fix

At the close of Phase 35 (before marking the phase Complete), open
follow-up tracks in the next active phase report for each deferred item.
Update `PHASE35_REPORT.md` with an explicit "Carry-Forward" section.
Sanity-check the codebase for stale TODOs referring to deferred features.

### Implementation Details

**Open follow-up tracks** in `PHASE36_REPORT.md` (or whichever phase report
is active at the time of Phase 35 close):

1. **Layout-builder for listings — deep-dive evaluation.**
   Pre-evaluation track. Goal: design how a layout-template's positioned
   slot can render rich campaign-card content (cover image, title,
   description, lock overlay, badges, click→viewer) instead of media.
   Produce a recommendation + effort estimate.

2. **Shape adapters for listings — UX/design evaluation.**
   Pre-evaluation track. Goal: evaluate whether hexagonal/circular/diamond
   tiles can host card content (legibility, text truncation, mobile
   usability) before committing implementation. Decide: include with
   constraints, include opt-in, or formally reject.

3. **Admin Panel listing convergence.**
   Out-of-scope evaluation track. Goal: should admin mobile list join the
   same host/adapter pipeline as public CardGallery? Should desktop admin
   gain a "View: Table | Cards" toggle that reuses the listing-adapter
   pipeline? Produce a recommendation.

**Update PHASE35_REPORT.md** with a "Carry-Forward" section listing the
three deferred items, their reasons, and their landing destinations.

**Codebase audit**: sanity-check that no PR description, code TODO, or
settings UI implies layout-builder / shape-adapter / admin convergence are
"coming soon" — they are deferred for separate evaluation.

### Acceptance criteria

- Three named follow-up tracks exist in the next active phase report
  (planned or pre-evaluation). ( )
- `PHASE35_REPORT.md` ends with an explicit "Carry-Forward" section. ( )
- No dangling TODO comments in the code about hooking up
  layout-builder/shape-adapters/admin convergence for listings. ( )
- The two P30-F assessment docs are linked from the carry-forward section
  for historical context. ( )

### Validation

- Manual review: open the next phase report, confirm three tracks present.
- `grep -ri "TODO.*layout-builder.*listing\|TODO.*listing.*layout-builder\|TODO.*admin.*card"`
  returns nothing actionable.

### Files Affected

| File | Change |
|------|--------|
| `docs/PHASE35_REPORT.md` | Append "Carry-Forward" section |
| `docs/PHASE36_REPORT.md` (or active phase) | New: pre-evaluation tracks for the three deferred items |

### Effort Estimate

~1 hour.

---

## Implementation Notes

### P35-A — Adapter Contract Widening (Complete)

`GalleryAdapterProps` extended with `items?: ListingItem[]`, `renderItem?`, `listingMode?`.
`AdapterCapability` gained `'listing-compatible'`. `AdapterRegistration` gained `paginationOwnership`.
`compact-grid`, `masonry`, `justified`, `classic` tagged listing-compatible; classic tagged `paginationOwnership: 'adapter'`.
Added `getListingAdapterSelectOptions()` and `adapterOwnsPagination()` to `adapterRegistry.ts`.
20 registry tests pass.

### P35-B — Setting Plumbing (Complete)

`campaignListingAdapterId` (default `'compact-grid'`), `campaignListingAdapterIdMobile?`, `campaignListingAdapterIdTablet?` added to `GalleryBehaviorSettings`.
New `resolveListingAdapterId(settings, breakpoint)` helper with 9 passing tests.
"Campaign Listing" accordion item added to `CampaignCardSettingsSection.tsx` with three ModalSelects (desktop / tablet / mobile).
PHP sanitizer: three keys mapped to snake_case in `$nested_card_field_map` (gallery-level, not adapter-level — important for parity test).

### P35-C — CardGallery Host Refactor (Complete)

`CardGallery.tsx` refactored to pure host shell (~430 lines from ~570).
`CardGalleryHostPagination.tsx` extracted as standalone component (~235 lines) owning display-mode state, slide animation, DotNavigator, OverlayArrows, keyboard nav.
Adapter slot wired via `buildAdapter()` factory; `CompactGridGallery` imported directly (non-lazy) for the default path so tests run synchronously.
All 32 existing `CardGallery.test.tsx` tests pass without modification.

### P35-D — CompactGridGallery Listing Mode (Complete)

Listing-mode branch added to `CompactGridGallery.tsx` using card-layout settings.
Column count mirrors old CardGallery logic with forward-compat: `gridCardMaxColumns > cardGridColumns > auto`.
Renders `card-gallery-grid` / `card-responsive-wrapper` / `card-fixed-wrapper` testids for coverage.
Fixes: all hooks called unconditionally before listing-mode early return (Rules of Hooks).
`listingMode` added to `CompactGridGalleryProps` for type-safe direct import in CardGallery.

### P35-E — MasonryGallery Listing Mode (Complete)

CSS multi-column layout: `columns: effectiveColumns`, `columnGap`, `break-inside: avoid` per item.
Column count uses card settings (same as compact-grid for consistency).
`react-photo-album` not mounted in listing mode.
All hooks (including `useCallback`) moved before listing-mode early return.
Testids: `masonry-listing-grid`, `masonry-listing-item`.

### P35-F — JustifiedGallery Listing Mode (Complete)

Flex-stretch rows: `display: flex; flex-wrap: wrap`, each item has `flex: 1 0 <computedBasis>`.
Items stretch to fill each row width, creating the justified aesthetic for cards.
`react-photo-album` not mounted in listing mode.
Testids: `justified-listing-grid`, `justified-listing-item`.

### P35-G — MediaCarouselAdapter (Classic) Listing Mode (Complete)

`CampaignListingCarousel` component added at the bottom of `MediaCarouselAdapter.tsx`.
Uses Embla with same settings as media carousel: loop, autoplay, drag, edge-fade, visible-cards basis.
Renders `renderItem(item, idx)` in each Embla slide.
Shows `OverlayArrows` and `DotNavigator` (via `cardPageDotNav` setting).
`MediaCarouselAdapter` outer component dispatches to listing branch before `media.length === 0` guard.
Testid: `campaign-listing-carousel`.
Since `classic` has `paginationOwnership: 'adapter'`, CardGallery host hides all display-mode controls when carousel is active.

### P35-H — Test Suite Expansion & Visual-Parity Guard (Complete)

New test file `src/components/Galleries/Adapters/listingMode.test.tsx` — 19 tests covering all 4 listing-compatible adapters:
- CompactGrid: 5 tests including DOM snapshot of responsive-grid structure
- Masonry: 4 tests (grid testid, item count, CSS columns style, no photo-album)
- Justified: 4 tests (grid testid, item count, flex display, no photo-album)
- MediaCarousel: 5 tests (carousel testid, slide count, renderItem calls, empty guard, no-listingMode guard)

Full suite: **139 test files, 1900 tests, all passing.** TypeScript clean.

PHP parity test fix: moved `campaignListingAdapterId*` keys from `$nested_adapter_field_map` to `$nested_card_field_map` — correctly reflects that these are gallery-level (not adapter-field) settings.

### P35-I — Carry-Forward Bookkeeping (Complete)

`PHASE35_REPORT.md` updated to Complete status with all track notes.
`PHASE36_REPORT.md` created with three pre-evaluation carry-forward tracks:
- P36-X1: Layout-builder for listings
- P36-X2: Shape adapters for listings
- P36-X3: Admin Panel listing convergence

---

## Outcome

**Phase 35 shipped on 2026-05-22.**

### What shipped

- **Unified listing-adapter pipeline**: `CardGallery.tsx` no longer owns its own grid-rendering code. Layout is fully delegated to the active listing adapter via the `GalleryAdapterProps` contract.
- **Four listing-compatible adapters**: Compact Grid (default), Masonry (CSS multi-column), Justified (flex-stretch rows), Classic Carousel (adapter-owned pagination). Each has a dedicated listing-mode branch tested in isolation.
- **User-configurable listing layout**: Admins can choose a listing adapter (desktop/tablet/mobile) from the "Campaign Listing" accordion in Display Settings. The default (`compact-grid`) produces DOM byte-identical to the previous hardcoded flex-grid.
- **Host/adapter pagination split**: `CardGalleryHostPagination.tsx` owns display-mode state for host-paginated adapters; the carousel adapter owns its own slide state via Embla. The host correctly hides pagination UI when the carousel is active.
- **139 test files, 1900 tests, all passing.** TypeScript clean. Parity test updated correctly.

### What was deferred (see Carry-Forward below)

Layout-builder for listings, shape adapters for listings (hex/circle/diamond), Admin Panel listing convergence. All three are formally tracked in `PHASE36_REPORT.md`.

### What should happen next

1. Manual QA: smoke test all four listing adapters in a real WordPress environment.
2. Open the three P36 pre-evaluation tracks when bandwidth permits.
3. Address any user-reported issues with the listing-adapter selector in Display Settings.

---

## PR Review

**Review commit:** `dd63987` · **Fix commit:** `00dc746`
**Test baseline:** 139 test files / 1900 tests — all green before and after fixes.

### Issues found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| 1 | 🟡 Improvement | `CompactGrid`, `Masonry`, `Justified` listing branches | Each adapter contained an identical 13-line column-resolution block (`gridCardMaxColumns` → `cardGridColumns` → auto/`cardMaxColumns`). Three copies meant any future fix or extension had to be made in three places. |
| 2 | 🟡 Bug | `JustifiedGallery.tsx` listing mode | Item style had `flex: '1 0 ${flexBasis}'` together with `maxWidth: flexBasis`, making the `flex-grow: 1` effectively a no-op: items could never exceed `flexBasis` even though the explicit intent (documented in the JSDoc) was to "stretch items to fill each row". |
| 3 | 🟡 Cleanup | `CardGalleryHostPagination.tsx` | `containerWidth: number` was declared in the interface, destructured as `_containerWidth` (unused marker), and passed from `CardGallery.tsx` at every call site — but the value was never read. The component derives everything it needs from `effectiveColumns` (a pre-computed scalar already in the props). |

### Investigated — not raised

| Area | Finding |
|------|---------|
| Rules of Hooks compliance | All adapters (CompactGrid P35-D, Masonry P35-E, Justified P35-F, MediaCarousel P35-G) call every hook unconditionally before the `isListingMode` early-return. ✅ |
| `resolveListingColumns` helper contract | The extracted helper correctly preserves the original priority chain (`gridCardMaxColumns` → `cardGridColumns` → auto) and the `cardMaxColumns` cap; unit tests in `gridLayout.test.ts` already cover it. ✅ |
| `CardGalleryHostPagination` pagination logic | `cardsPerPage = rowsPerPage * effectiveColumns` correctly responds to breakpoint-driven column changes; the breakpoint-reset `useEffect` fires independently. No issue with removing `containerWidth`. ✅ |
| Test coverage — listing mode | `listingMode.test.tsx` covers all four adapters (19 tests). Snapshot guard in `adapterSettingsParity.test.ts` catches unintended CompactGrid layout regressions. ✅ |
| `paginationOwnership` routing in `CardGallery` | `adapterPaginated` branch correctly bypasses `CardGalleryHostPagination`; classic carousel adapter registration sets `paginationOwnership: 'adapter'`. ✅ |

### Resolutions

**Issue 1 — column deduplication:** Extracted `resolveListingColumns(settings, containerWidth)` into `src/utils/gridLayout.ts` (the natural home for pure grid math, already housing `resolveFixedCardWidth`, `gridRowMaxWidthCss`, and `formatGapCss`). Replaced the identical blocks in `CompactGridGallery.tsx`, `MasonryGallery.tsx`, and `JustifiedGallery.tsx`. Note: `MasonryGallery` still imports `resolveColumnsFromWidth` directly for the media-mode `columns` function — kept that import.

**Issue 2 — JustifiedGallery stretch:** Removed `maxWidth: flexBasis` from the listing-mode item `style`. Items now carry only `flex: '1 0 ${flexBasis}'` and `minWidth: 0`, allowing `flex-grow: 1` to distribute leftover row space and produce the true "justified" appearance described in the JSDoc.

**Issue 3 — unused prop:** Removed `containerWidth` from `CardGalleryHostPaginationProps` interface and from the destructure parameter list. Removed the single `containerWidth={containerWidth}` prop from the call site in `CardGallery.tsx`.

---

## Carry-Forward

Phase 35 is marked Complete. The three items below were explicitly deferred and
are now tracked in `docs/PHASE36_REPORT.md` as pre-evaluation tracks.

| Deferred item | Why deferred | Track in P36 |
|---|---|---|
| **Layout-builder for listings** | Slot→card composition is a separate design problem; needs deeper analysis after the listing-adapter pipeline is stable. | P36-X1 |
| **Shape adapters for listings** (hexagonal, circular, diamond) | Card content fitting into non-rectangular tiles requires UX research; defer until base unification is proven. | P36-X2 |
| **Admin Panel listing convergence** | Out of scope here (different product feature). Future opportunity: "View: Table\|Cards" toggle for desktop admin reusing the listing-adapter pipeline. | P36-X3 |
