# P25-X Implementation Review

**Track:** P25-X  
**Title:** Multi-unit CSS dimension support + campaign card breakpoint overrides  
**Reviewer:** GPT-5.4  
**Review date:** 2026-04-03  
**Scope reviewed:** Phases 1 through 4 only  
**Out of scope:** Phase 5 card breakpoint types, PHP, UI, rendering, and final full-suite verification work not yet started

---

## Summary

The overall direction for P25-X is good. The shared unit model, the reusable `DimensionInput`, the TS and PHP defaults, and the general effort to move dimension rendering away from hardcoded pixel strings are all defensible choices.

The main problem is not the design intent. The main problem is that phase 4 expanded unit support into several rendering paths that still operate in pixel space internally. That creates a split implementation state:

- some settings are now genuinely unit-aware end to end,
- some settings are only unit-aware in the UI and persistence layer,
- some settings are unit-aware in storage but still clamped or interpreted as raw pixels at render time.

Because of that, the feature is currently mixed in quality. It builds cleanly, and several targeted tests pass, but there are real runtime issues that should be resolved before work continues into phase 5.

---

## Review Method

This review was based on:

- source audit of the React implementation across the helper, types, settings UI, renderers, and bridges,
- source audit of the WordPress registry and sanitizer chain for the new `*Unit` fields,
- targeted test execution for the unit helper, `DimensionInput`, `Lightbox`, and the shared adapter suite,
- production build validation with `npm run build`.

Files audited include:

- `src/utils/cssUnits.ts`
- `src/components/Settings/DimensionInput.tsx`
- `src/types/index.ts`
- `src/components/Admin/SettingsPanel.tsx`
- `src/services/apiClient.ts`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/CampaignGallery/CampaignCard.tsx`
- `src/components/CardViewer/CampaignViewer.tsx`
- `src/components/CardViewer/GallerySectionWrapper.tsx`
- `src/components/Galleries/Adapters/MediaCarouselAdapter.tsx`
- `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx`
- `src/components/Galleries/Adapters/justified/JustifiedGallery.tsx`
- `src/components/Galleries/Adapters/circular/CircularGallery.tsx`
- `src/components/Galleries/Adapters/hexagonal/HexagonalGallery.tsx`
- `src/components/Galleries/Adapters/diamond/DiamondGallery.tsx`
- `src/components/Galleries/Shared/Lightbox.tsx`
- `src/utils/campaignGalleryRenderPlan.ts`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php`

---

## Findings

### 1. Relative-unit support is incorrect in several renderers that still clamp values as pixels

**Severity:** High  
**Status:** Confirmed runtime issue

The largest problem in the current implementation is that several dimension fields now accept `%`, `vw`, `vh`, `em`, `rem`, and similar units, but the renderer still runs pixel-based math before converting the result back to CSS.

This is visible in at least three places:

#### `CampaignViewer.tsx`

`modalMaxWidth` is still clamped numerically before unit conversion:

- `const clampedWidth = Math.max(MODAL_MIN_WIDTH, Math.min(MODAL_MAX_WIDTH, s.modalMaxWidth || 1200));`
- `const modalSize = useFullscreen ? '100%' : toCss(clampedWidth, s.modalMaxWidthUnit ?? 'px');`

That is only correct for pixel-based values. If a user selects `90%`, `80vw`, or `60rem`, the numeric clamp is still treating the value like a pixel count before reattaching the new unit.

Examples of incorrect outcomes:

- `90` with `%` can become `600%`
- `80` with `vw` can be forced up to `600vw`

#### `GallerySectionWrapper.tsx`

Section min and max dimensions are scaled and clamped numerically before unit conversion:

- `scaledMaxWidth`, `scaledMinWidth`, `scaledMaxHeight`, `scaledMinHeight`
- `clampDimension(...)`
- `toCss(..., widthUnit)` and `toCss(..., heightUnit)`

That is safe for `px`. It is not safe for relative units. A relative unit field cannot be meaningfully clamped against a measured pixel container width by just comparing raw numbers.

#### `MediaCarouselAdapter.tsx`

Viewport height is still pixel-clamped before conversion:

- `const baseHeight = dominantType === 'image' ? settings.imageViewportHeight : settings.videoViewportHeight;`
- `const base = Math.max(180, Math.min(900, baseHeight));`
- `return toCss(Math.round(base * heightMultiplier), baseHeightUnit);`

This again assumes the underlying value is pixels.

#### Impact

This is not a cosmetic concern. It means some non-px values will render materially wrong.

#### Recommendation

Do not continue adding unit support on top of this state. First decide which dimensions are truly CSS-token fields and which are layout-algorithm inputs.

- CSS-token fields can stay multi-unit.
- Layout-algorithm inputs should either remain px-only for now, or be resolved with an explicit basis and unit-aware math.

---

### 2. Several new unit controls currently have no runtime effect

**Severity:** High  
**Status:** Confirmed implementation gap

Some of the new unit fields are present in types, registry, sanitizer, and settings UI, but the renderer that should consume them has not actually been updated.

#### `Lightbox.tsx`

The settings UI exposes:

- `lightboxVideoMaxWidth`
- `lightboxVideoMaxWidthUnit`
- `lightboxVideoHeight`
- `lightboxVideoHeightUnit`

But the lightbox renderer still uses hardcoded values:

- embedded video iframe `maxWidth: 1100`
- embedded video iframe `height: '70dvh'`
- native video `maxHeight: '85dvh'`
- image `maxHeight: '85dvh'`

So the new unit controls currently do nothing in runtime behavior.

#### `CompactGridGallery.tsx`

`gridCardHeightUnit` is exposed, but the adapter uses:

- numeric `cardHeight`
- numeric `cardWidth`
- `aspectRatio: `${cardWidth} / ${cardHeight}``

That means the unit companion for height is not participating in layout. It is effectively dead configuration at the moment.

#### `JustifiedGallery.tsx`

The adapter still treats these settings as raw numbers:

- `mosaicTargetRowHeight`
- `photoNormalizeHeight`

Their unit companions exist in the schema and adapter registry, but the renderer does not consume them.

#### Shape adapter per-type tile size units

`campaignGalleryRenderPlan.ts` forwards per-type values into the shared `tileSize` field:

- `tileSize: settings.imageTileSize ?? settings.tileSize`
- `tileSize: settings.videoTileSize ?? settings.tileSize`

But it does not forward the matching unit fields:

- `imageTileSizeUnit`
- `videoTileSizeUnit`

So per-type shape size values are bridged, while their units are silently dropped.

#### Recommendation

Before phase 5, audit every new `*Unit` field and classify it into one of three buckets:

1. Fully wired end to end
2. UI and persistence only, runtime still missing
3. Fundamentally unsuitable for unit expansion without a redesign

Any field in bucket 2 should either be fully completed now or removed from the current UI until the renderer is ready.

---

### 3. The API-facing settings interface is stale and currently bypassed with a cast

**Severity:** Medium  
**Status:** Confirmed type-contract drift

The frontend settings flow works today because `SettingsPanel.tsx` maps the response through:

- `mergeSettingsWithDefaults(response as Partial<GalleryBehaviorSettings>)`

That cast is doing real work because `src/services/apiClient.ts` still has a lagging `SettingsResponse` shape. It includes many numeric settings but not the matching unit companions that now exist in the canonical gallery settings surface.

This does not appear to be causing the primary runtime bugs above. The build still passes, and the settings flow is effectively leaning on the canonical settings defaults and merge helper. But it is still a real maintenance problem because the client contract is no longer the authoritative source of truth.

#### Recommendation

Refactor `SettingsResponse` so it derives from or mirrors the canonical settings model rather than keeping a second manually maintained partial copy.

This is especially important before adding `cardConfig` in phase 5. Otherwise the card breakpoint surface will be added on top of an already drifting API type layer.

---

### 4. The overall approach is good, but the scope was too broad for one pass

**Severity:** Medium  
**Status:** Architectural assessment

The underlying strategy is sound in principle:

- introduce unit types,
- centralize CSS conversion in `toCss()` and related helpers,
- use a reusable compound input instead of bespoke unit pickers,
- preserve backward compatibility by defaulting missing unit fields to `px`.

Those are all good decisions.

Where the implementation became risky was scope. The phase tried to unitize both:

- direct CSS-value fields, and
- fields that participate in layout math, clamping, ratios, algorithmic sizing, or container-derived calculations.

Those are not the same class of problem.

The CSS-value fields are straightforward. The algorithmic fields need a stronger model:

- either explicit px-only treatment,
- or basis-aware resolution rules,
- or a different setting shape entirely.

#### Recommendation

Narrow the unitized surface before expanding the feature. Treat P25-X as two sub-tracks instead of one:

1. Safe CSS-token unitization
2. Layout-algorithm-aware unitization

Only the first track is truly mature in the current implementation.

---

## Fields That Appear Healthy

Not everything in the implementation is problematic. Several parts of the work are in good shape.

### Shared unit infrastructure

The following pieces look solid:

- `src/utils/cssUnits.ts`
- `src/components/Settings/DimensionInput.tsx`
- corresponding targeted tests for both

The helper model is minimal and readable. The `DimensionInput` behavior around clamping on unit switch is also consistent with the planned UX.

### Many direct CSS consumers

Several render paths are using the new helpers in a straightforward and correct way for direct CSS emission, for example:

- card grid gap output
- card container padding and app width
- card border radius and min-height output
- section padding and content offset transforms
- shape tile sizing where `tileSize` is directly converted to CSS

These are the stronger parts of the implementation and are worth preserving.

### WordPress registry and sanitizer coverage

The PHP registry and sanitizer work appears broadly complete for the new unit companion fields. Defaults and allowlists were added consistently, and backward compatibility through default `'px'` handling is intact.

---

## Gaps in Test Coverage

The current targeted tests pass, but they do not adequately cover the broken paths described above.

### What was validated in this review

These passed during review:

- `src/utils/cssUnits.test.ts`
- `src/components/Settings/DimensionInput.test.tsx`
- `src/components/Galleries/Shared/Lightbox.test.tsx`
- `src/components/Galleries/Adapters/__tests__/adapters.test.tsx`
- `npm run build`

### What the current tests do not prove

They do not currently prove that:

- non-px `modalMaxWidth` renders correctly,
- non-px section min and max sizing behaves correctly,
- non-px carousel viewport heights behave correctly,
- lightbox sizing settings actually affect runtime output,
- per-type shape size units survive the render-plan bridge,
- justified-row unit fields have runtime effect,
- compact-grid height units have runtime effect.

#### Recommendation

Add focused tests before continuing with phase 5. The minimum useful set would be:

1. one `CampaignViewer` test covering non-px modal width,
2. one `GallerySectionWrapper` test covering non-px section width or height,
3. one `MediaCarouselAdapter` test covering non-px viewport height,
4. one `Lightbox` test proving the new video size settings are actually consumed,
5. one render-plan test proving per-type shape value and unit bridging,
6. one adapter test or unit test for justified row height unit behavior.

---

## Recommended Adjustments Before Any Further Implementation

### 1. Freeze phase 5 until the multi-unit base is stabilized

Do not layer card breakpoints onto the current mixed unit state. The card breakpoint work will multiply the number of paths that depend on this behavior.

### 2. Split unitized settings into safe and unsafe groups

Safe group:

- app width and padding
- gaps, margins, offsets
- border radii
- any setting that is emitted directly as a CSS token without internal numeric layout math

Unsafe group:

- modal width clamping
- gallery section min and max sizing
- viewport height settings for carousel media
- justified row height and photo normalization inputs
- compact-grid height behavior
- lightbox size settings that currently still rely on fixed runtime constants

For the unsafe group, choose one of two approaches per field:

- revert to px-only for now, or
- implement explicit unit-aware resolution rules with a defined basis.

### 3. Remove or complete any dead controls

The current settings surface should not expose unit controls that do nothing.

The clearest candidates are:

- `lightboxVideoMaxWidthUnit`
- `lightboxVideoHeightUnit`
- `gridCardHeightUnit`
- `mosaicTargetRowHeightUnit`
- `photoNormalizeHeightUnit`
- `imageTileSizeUnit` and `videoTileSizeUnit` without matching render-plan forwarding

### 4. Align the API type layer with the canonical settings model

This is not the most urgent runtime fix, but it should be addressed before adding `cardConfig`.

### 5. Add missing runtime tests before expanding scope

The next phase should not rely on helper-level tests alone. It needs renderer-level coverage for non-px behavior.

---

## Suggested Correction Order

If the team wants the smallest-risk path forward, I would recommend this sequence:

1. Fix or temporarily narrow unit support on the algorithmic layout fields.
2. Complete the dead runtime consumers so the UI only exposes working controls.
3. Forward both value and unit through any shared bridges, especially the per-type shape path.
4. Update the client API type surface to match the canonical settings model.
5. Add the missing renderer-level tests.
6. Only then begin phase 5 card breakpoint work.

---

## Final Assessment

P25-X is not in a failed state, but it is not yet in a safe state to build on without adjustment.

The implementation so far demonstrates that the helper architecture and persistence model are viable. The weakness is the attempt to apply the same unitization strategy to settings that are not simple CSS tokens.

If the next pass narrows the risky fields, completes the dead renderers, and adds focused runtime coverage, the track can recover cleanly and still support the broader card breakpoint work planned for phase 5.

Without that correction pass, phase 5 will be built on top of behavior that is currently inconsistent across UI, storage, and runtime rendering.

---

## Decision Resolution Addendum

The following decisions were reviewed after the initial write-up. These are the recommended calls based on the current code state.

### Decision 1. How to handle the unsafe clamped fields

**Recommendation:** Approve the proposed direction with one refinement.

The proposed rule is correct for:

- `CampaignViewer.modalMaxWidth`
- `MediaCarouselAdapter.imageViewportHeight`
- `MediaCarouselAdapter.videoViewportHeight`

For those fields, the cleanest correction is:

- apply numeric safety clamps only when the unit is `px`,
- for relative units, emit the configured CSS value directly and let CSS resolve it.

That keeps the multi-unit UI alive without forcing an unnecessary retreat to px-only controls.

#### Refinement for `GallerySectionWrapper`

`GallerySectionWrapper` is slightly different because it is not only emitting CSS. It is also producing measured `containerDimensions` for child adapters.

That means the correct fix is not just “stop clamping for non-px units.” It is:

1. emit raw CSS values for relative units,
2. keep numeric runtime clamps only for px values,
3. derive child `containerDimensions` from the measured rendered box rather than from the raw configured number when relative units are involved.

This preserves the multi-unit feature while keeping downstream layout consumers grounded in actual rendered dimensions.

#### Final call

- **Approve** unit-aware handling for these fields.
- **Do not** revert them to px-only.
- **Do** separate CSS emission from measured numeric layout data where container measurement is involved.

### Decision 2. Reclassify genuinely px-only algorithm inputs

**Recommendation:** Approve.

The following fields should not be treated as multi-unit CSS dimensions:

- `mosaicTargetRowHeight`
- `photoNormalizeHeight`
- `gridCardHeight`

#### Why

`mosaicTargetRowHeight` and `photoNormalizeHeight` feed react-photo-album’s layout math as numeric algorithm inputs. They are not CSS tokens.

`gridCardHeight` currently participates only in an aspect-ratio calculation in `CompactGridGallery`; its unit companion does not carry meaningful runtime semantics.

#### Recommended action

- change these controls in `adapterRegistry.ts` from `control: 'dimension'` to `control: 'number'`,
- remove the unit selector UI for those fields,
- keep the type and PHP `*Unit` fields for zero-migration compatibility if desired,
- document that those companion unit fields are intentionally inactive compatibility baggage until or unless a future redesign gives them a valid runtime meaning.

#### Final call

- **Approve** reclassifying these three fields as px-only numeric controls.

### Decision 3. Lightbox dead controls

**Recommendation:** Approve.

The current controls:

- `lightboxVideoMaxWidth`
- `lightboxVideoHeight`

are exposed in the settings UI but ignored by the runtime lightbox implementation.

That should be fixed by wiring them through, not by removing them.

#### Recommended action

- add a settings prop to `Lightbox`,
- pass the relevant settings down from the adapters that already have access to gallery settings,
- apply the settings to the video paths only,
- leave image sizing semantics unchanged unless there is a separate product decision to broaden them.

This is the most straightforward way to eliminate the dead-control problem without inventing a new settings model.

#### Additional note

If `Lightbox` is being touched anyway, it is worth checking whether `lightboxMediaMaxHeight` should also be honored consistently in the same pass, since that setting sits in the same part of the surface.

#### Final call

- **Approve** wiring the existing lightbox video sizing controls into runtime behavior.

### Decision 4. `SettingsResponse` type drift

**Recommendation:** Strongly approve.

The current `SettingsResponse` type has drifted away from the canonical settings surface, and the frontend is already compensating with a cast through `mergeSettingsWithDefaults`.

That is a maintainability problem now, and it will become more expensive once `cardConfig` is added.

#### Recommended action

- define a shared application-settings type in the canonical type layer,
- derive the API response and update request types from that shared type instead of maintaining a second field-by-field interface,
- keep the non-gallery extras such as `theme`, `galleryLayout`, `itemsPerPage`, `enableLightbox`, and `enableAnimations` in that shared model.

The key point is that the API surface should derive from the real settings model, not the other way around.

#### Final call

- **Approve** replacing the drifting duplicate interface with a canonical derived settings type.

### Recommended implementation order

If these decisions are accepted, the lowest-risk execution order is:

1. Reclassify the three genuinely px-only algorithm inputs.
2. Fix unit-aware handling for the unsafe clamped fields.
3. Wire the lightbox video size controls into runtime behavior.
4. Align the API type layer with the canonical settings surface.

That order reduces misleading UI first, fixes the most important runtime correctness issue second, closes the dead-control gap third, and finishes with the type-system cleanup before phase 5 begins.