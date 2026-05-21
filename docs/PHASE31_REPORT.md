# Phase 31 — Gallery Reliability, Adapter Coverage, Config Hardening & Targeted Capability Expansion

**Status:** Planned
**Created:** 2026-05-19
**Last updated:** 2026-05-19

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P31-A | Gallery reliability hardening: settings merge, lightbox scroll lock, breakpoint first-render contract | Planned | Small-Medium |
| P31-B | Adapter resolution integration coverage | Planned | Medium |
| P31-C | Gallery config editor update-path optimization | Planned | Medium |
| P31-D | Adapter settings single-source-of-truth pre-evaluation | Pre-Evaluation | Large |
| P31-E | Spotlight / Hero adapter delivery | Planned | Small-Medium |
| P31-F | Vertical Scroll Snap adapter, scoped to bounded gallery sections | Planned | Medium |
| P31-G | Waterfall entrance animation as a Masonry enhancement | Planned | Small |
| P31-H | Media payload foundations for future timeline/filter work | Pre-Evaluation | Medium |

---

## Rationale

1. The gallery/framework review on 2026-05-19 surfaced legitimate gallery work,
  but it also mixed in broader plugin infrastructure drift. This phase captures
  the gallery-specific work without widening Phase 30 further.
2. Phase 30 already carries builder and theme lanes. Adding gallery reliability,
  adapter-resolution testing, config-editor optimization, and small adapter
  follow-ons there would make that phase too broad to execute coherently.
3. Phase 31 still begins with correctness and confidence. Settings hydration,
  body-scroll locking, breakpoint behavior, and adapter-resolution coverage are
  the foundation that should land before broader gallery behavior grows.
4. The current adapter system is mature enough to support a narrow capability
  lane without reopening the architecture. The shared `GalleryAdapterProps`
  contract, registry metadata, lazy-loading pattern, and common lightbox/image
  infrastructure can absorb a few low-risk additions cleanly.
5. Only the lowest-risk gallery additions belong here. Spotlight / Hero fits the
  current contract directly, Vertical Scroll Snap is viable when scoped to the
  existing bounded gallery sections rather than a raw full-viewport story UI,
  and Waterfall is more accurately a Masonry enhancement than a new adapter
  family.
6. Higher-risk concepts remain out of scope for this phase. Stacked / Deck and
  Coverflow / 3D need shared gesture infrastructure, Mosaic / Pinterest still
  carries real layout-assignment risk, and Timeline depends on unresolved media
  chronology semantics.
7. The filterable-grid idea remains valuable, but it should not enter as an
  adapter track. Media tags already exist in the backend taxonomy layer, yet
  gallery media payloads do not currently expose per-item tag data and the
  wrapper/orchestration boundary is still undefined.
8. The adapter-resolution path is a critical contract. It contributed to the
  Phase 24 theme-preview regression and still lacks one end-to-end test path
  that validates real resolution behavior under breakpoint changes.
9. The config-editor cloning concern is worth addressing, but it needs measured
  update-path optimization rather than a large state-management rewrite or an
  overstated algorithmic claim.
10. The adapter settings single-source-of-truth problem is real, but it is a
  design/build-infrastructure concern. It belongs in this phase only as
  pre-evaluation so the migration boundary is explicit before generator work
  starts.
11. The same review also exposed metadata drift around `dateUploaded` and
  `filesize` references in media sorting, plus ambiguity about whether future
  per-item filtering should rely on attachment tags or new relationship-level
  metadata. That belongs here only as pre-evaluation, not as a hidden
  dependency inside new adapter work.
12. Shared infrastructure items from the same review — `ApiClient`
  modularization, PHP settings-facade cleanup, and scheduled archive batching —
  remain follow-on candidates outside this phase.

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Where the gallery review findings belong | Keep Phase 30 bounded and spin the gallery reliability/configuration lane into Phase 31. |
| B | Where to place `mergeSettingsWithDefaults` typing cleanup | Keep it in the gallery lane because it sits directly on gallery settings hydration and already has gallery-facing tests. |
| C | How to fix nested lightbox scroll locking | Use a shared body-scroll lock manager with module-level reference counting and overflow restoration, not a per-instance hook ref that cannot coordinate across multiple hook instances. |
| D | How to frame the `useBreakpoint` issue | Treat it as a first-render and late-bound-ref contract problem rather than only an initial-state problem. |
| E | What test layer should own adapter-resolution coverage first | Prefer RTL/Vitest integration coverage first because the contract is primarily React/container-width driven and can be validated deterministically without full browser e2e setup. |
| F | How to approach gallery-config optimization | Require before/after measurement and keep the public utility shape stable; do not jump straight to Immer or store migration without evidence. |
| G | How much of the single-source-of-truth work Phase 31 should commit to | Pre-evaluate and define migration boundaries only; full generator rollout is not phase-committed. |
| H | What to do with the smaller drifted review items | Keep `ApiClient`, PHP settings-facade, and auto-archive batching out of Phase 31; demote carousel normalization to opportunistic cleanup rather than a planned track. |
| I | How much new gallery surface area Phase 31 should absorb | Add only bounded capability work that fits the current adapter contract: Spotlight / Hero, a section-bounded Scroll Snap adapter, and Waterfall as a Masonry enhancement. |
| J | How Vertical Scroll Snap should be framed in this codebase | Design it around `GallerySectionWrapper` and measured `containerDimensions`; reject a raw `100dvh` story-view contract as the default implementation target. |
| K | How to handle Waterfall | Treat it as a Masonry-specific entrance-animation option, not a new adapter id or registry family. |
| L | How to handle future timeline/filter prerequisites | Add a MediaItem/REST payload pre-evaluation track to define `dateUploaded`, `filesize`, and optional media-tag exposure without folding Phase 34 admin media-sort UI work into Phase 31. |
| M | What to do with the higher-risk adapter concepts | Keep Stacked, Coverflow, Mosaic / Pinterest, Timeline, and filterable-wrapper follow-ons out of Phase 31 delivery pending gesture, layout, or metadata decisions. |

---

## Execution Priority

1. P31-A — Quick correctness and contract hardening first so gallery behavior is
  stable before broader test, expansion, and performance work lands.
2. P31-B — Lock the adapter-resolution path down with real integration coverage
  before adding new adapter surface area on top of it.
3. P31-E — Land the lowest-risk new adapter once the base gallery contract is
  better protected.
4. P31-G — Add the Masonry-scoped Waterfall enhancement after registry and
  contract coverage are in place; it is small and largely independent of the
  metadata work.
5. P31-F — Tackle Scroll Snap after the lower-risk adapter additions so the
  section-bounded behavior and viewer-integration tradeoffs are addressed
  deliberately.
6. P31-C — Optimize the gallery-config edit path once behavior and regression
  coverage are stable enough to protect the refactor.
7. P31-D and P31-H — Close with pre-evaluation so future generator work and
  metadata-dependent adapter ideas start from explicit decisions rather than
  implicit drift.

## Track P31-A — Gallery Reliability Hardening

### Problem

Several small but high-value reliability issues sit on central gallery runtime
paths:

- `mergeSettingsWithDefaults` still uses `as any` assignment in the settings
  hydration path.
- `useLightbox` body-scroll locking is not safe across multiple hook instances.
- `useBreakpoint` can render an initial width/breakpoint contract that is wrong
  until the post-paint measurement effect runs.

None of these items is large on its own, but together they create avoidable
fragility in gallery rendering and editing flows.

### Fix

Bundle the three issues into one reliability track and tighten the contracts
without changing public gallery behavior:

- remove untyped assignment from the gallery settings merge path,
- introduce shared scroll-lock coordination for nested lightbox consumers,
- make container-sourced breakpoint resolution more deterministic on first render
  and late ref attachment.

### Implementation Details

**Settings merge typing**

- Keep `galleryConfig` and `cardConfig` merge semantics unchanged.
- Replace index-based `any` writes with typed helpers or narrowed assignment
  branches.
- Preserve special handling for `typographyOverrides` parsing and the migrated
  `viewerBgGradient` payload shape.

**Shared lightbox scroll lock**

- Move locking responsibility into a module-scoped manager that tracks open
  consumers across hook instances.
- Snapshot and restore the previous `document.body.style.overflow` value rather
  than assuming the empty string is always correct.
- Clamp unlock behavior so repeated close/unmount paths cannot drive the lock
  state negative.

**Breakpoint first-render contract**

- Preserve the existing viewport-mode behavior.
- Reconcile three cases explicitly: container ref already mounted on first
  render, container ref attaching after first render, and steady-state
  ResizeObserver updates.
- Avoid introducing a heavier external-store abstraction unless a simpler
  contract-preserving approach proves insufficient.

### Acceptance criteria

- `mergeSettingsWithDefaults` no longer requires `as any` for field assignment. ( )
- Two concurrent lightbox consumers keep body scroll locked until the final one
  closes or unmounts. ( )
- Container-sourced `useBreakpoint` produces deterministic first-render behavior
  with documented fallback behavior when no container is available yet. ( )
- Existing gallery hydration and runtime behavior stays backward compatible. ( )

### Validation

- Extend `src/utils/defaultsAndMerge.test.ts` with typed-merge regression cases.
- Extend `src/hooks/useLightbox.test.ts` with nested open/close ordering and
  unmount cleanup coverage.
- Extend `src/hooks/useBreakpoint.test.tsx` with first-render and late-ref
  attachment cases.
- Manual QA: verify nested modal/lightbox flows and masonry/carousel surfaces do
  not regress.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/utils/mergeSettingsWithDefaults.ts` | Typed assignment cleanup on settings hydration path |
| `src/utils/defaultsAndMerge.test.ts` | Regression coverage for typed merge behavior |
| `src/hooks/useLightbox.ts` | Shared body-scroll lock coordination |
| `src/hooks/useLightbox.test.ts` | Nested lightbox and unmount ordering tests |
| `src/hooks/useBreakpoint.ts` | First-render / late-ref breakpoint contract hardening |
| `src/hooks/useBreakpoint.test.tsx` | Contract and regression coverage |

### Effort Estimate

~3-5 hours.

---

## Track P31-B — Adapter Resolution Integration Coverage

### Problem

The adapter registry and resolution utilities have unit coverage, but the
end-to-end path from gallery settings to rendered adapter still lacks one real
integration test. That leaves a gap across the contract:

`settings -> resolveGalleryConfig -> resolveAdapterId -> resolveAdapter -> render`

This is the kind of path that failed during the Phase 24 theme-preview issue,
and it should not remain protected only by smaller unit tests and broader smoke
coverage.

### Fix

Add deterministic integration coverage around the real adapter-resolution path,
preferably at the RTL/Vitest layer where container width and breakpoint changes
can be controlled without a full Playwright setup.

### Implementation Details

- Use real gallery settings fixtures rather than mocking adapter-resolution
  helpers.
- Cover at least one breakpoint-specific per-type configuration that changes the
  selected adapter across widths.
- Assert rendered adapter identity through stable test markers or other explicit
  adapter-visible output rather than fragile DOM-shape assumptions.
- Keep the first track scoped to one reliable resolution path; broader matrix
  expansion can follow after the first end-to-end case lands.

### Acceptance criteria

- A test exercises the real adapter-resolution path without mocking the core
  resolver chain. ( )
- The test validates adapter changes across at least desktop/tablet/mobile width
  states or equivalent container-width transitions. ( )
- The Phase 24-style regression surface is explicitly represented by a stable
  fixture or test scenario. ( )

### Validation

- Add RTL/Vitest integration coverage in an existing gallery viewer surface.
- Re-run relevant adapter and gallery viewer tests after the new fixture lands.
- Manual QA: change container width in a representative campaign/gallery surface
  and confirm the same adapter choices the test encodes.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/CampaignGallery/CardGallery.test.tsx` | Candidate home for width-driven adapter-resolution integration coverage |
| `src/components/CardViewer/CampaignViewer.test.tsx` | Alternate or supplementary viewer-path integration coverage |
| `src/utils/resolveAdapterId.test.ts` | Keep utility coverage aligned with integration expectations |
| `src/components/CampaignGallery/CardGallery.tsx` | Stable adapter test markers if needed |
| `src/components/CardViewer/CampaignViewer.tsx` | Stable adapter test markers if needed |

### Effort Estimate

~3-5 hours.

---

## Track P31-C — Gallery Config Editor Update-Path Optimization

### Problem

The review correctly identified unnecessary cloning in the gallery-config edit
path, but the original framing overstated the algorithmic problem. The current
issue is not true `O(n^3)` growth; it is repeated whole-config cloning and broad
scope iteration in helpers that run during settings edits.

This is worth addressing because the gallery settings editor should not pay for
untouched branches on every change, but the work should stay grounded in actual
measurement rather than theory.

### Fix

Optimize the update path in `galleryConfig` utilities while preserving their
public behavior and current call sites. Prefer structural sharing for untouched
breakpoints/scopes and keep the first pass focused on measurable edit-path wins.

### Implementation Details

- Capture a before/after baseline for the hot edit-path helpers before changing
  implementation details.
- Focus first on `setGalleryAdapterSetting`,
  `setRepresentativeGalleryCommonSetting`, and
  `setScopeGalleryCommonSetting`.
- Preserve identity for untouched branches where practical rather than cloning
  the full config tree unconditionally.
- Avoid a broader store migration or `useImmer` adoption unless measurement
  shows the utility-level optimization is insufficient.

### Acceptance criteria

- Gallery-config helpers preserve current functional behavior. ( )
- Untouched config branches keep stable references where the new implementation
  allows it. ( )
- The settings edit path shows a measured reduction in unnecessary cloning or
  update work. ( )
- Existing gallery-config tests continue to pass with added regression coverage
  for the optimized paths. ( )

### Validation

- Extend `src/utils/galleryConfig.test.ts` with identity-sensitive and behavior
  regression cases.
- Extend `src/components/Common/GalleryConfigEditorModal.test.tsx` if the editor
  surface needs behavioral protection.
- Capture simple profiling evidence before and after the optimization.
- Manual QA: edit adapter settings repeatedly in the gallery configuration UI
  and confirm behavior is unchanged.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/utils/galleryConfig.ts` | Structural-sharing and update-path optimization |
| `src/utils/galleryConfig.test.ts` | Identity and behavior regression coverage |
| `src/components/Common/GalleryConfigEditorModal.test.tsx` | UI-level regression coverage if needed |

### Effort Estimate

~4-6 hours.

---

## Track P31-D — Adapter Settings Single-Source-of-Truth Pre-Evaluation

### Problem

Adapter settings currently span multiple manually synchronized definitions:

- TypeScript-side adapter setting group definitions,
- Zod validation,
- Type definitions,
- PHP settings registry data.

That cross-stack duplication is the real maintenance problem. The right answer
may be code generation, but committing directly to generator implementation would
be premature without a canonical-source decision and parity plan.

### Fix

Run a design-first pre-evaluation that determines whether one canonical adapter
settings source can safely generate or drive the other artifacts.

### Implementation Details

- Inventory what metadata exists only in TypeScript, only in Zod, and only in
  PHP today.
- Decide whether the canonical source should remain TypeScript-based or move to
  a more neutral schema/JSON representation.
- Define what can be generated safely in the first rollout and what should stay
  hand-authored longer.
- Produce a parity checklist and rollout order before implementation work begins.

### Acceptance criteria

- A canonical-source proposal exists with clear generated and hand-authored
  boundaries. ( )
- The proposal documents how TypeScript validation, runtime defaults, and PHP
  registry data stay in sync. ( )
- The phase ends with a go/no-go decision on generator implementation rather
  than an assumed rollout. ( )

### Validation

- Perform a parity audit across the current TypeScript and PHP definitions.
- Prototype the smallest useful generation path if needed to validate the
  proposal.
- Review the migration plan against packaging/build constraints before any broad
  adoption.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/adapterRegistry.ts` | Canonical-source candidate and metadata inventory |
| `src/types/settingsSchemas.ts` | Validation-output candidate during parity audit |
| `src/types/index.ts` | Type-definition parity audit |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-settings-registry.php` | PHP registry parity audit |
| `scripts/` | Possible prototype generator or validation script |
| `docs/` | Supporting design note if the pre-evaluation needs a deeper artifact |

### Effort Estimate

~5-8 hours.

---

## Track P31-E — Spotlight / Hero Adapter

### Problem

The current adapter set covers carousel, dense photo grids, shaped tile grids,
and the layout-builder path, but it still lacks a simple featured-media layout:
one dominant hero item with secondary items acting as the promotion strip.

This is the cleanest deferred adapter concept because it fits the existing
adapter contract directly, reuses the current gallery infrastructure, and adds a
meaningfully different presentation without introducing gesture or metadata
dependencies.

### Fix

Add a new Spotlight / Hero adapter that renders one active hero item above or
beside a supporting thumbnail strip, with the active index shared between the
inline hero and the lightbox entry point.

### Implementation Details

- Add a new adapter id and lazy-loaded adapter component that accepts the
  standard `GalleryAdapterProps` contract.
- Reuse the existing shared pieces: `LazyImage` for image rendering,
  `useCarousel` for index control, `Lightbox` for full-view navigation, and the
  current common-heading/runtime helpers for shell styling.
- Keep one source of truth for the selected hero item. Thumbnail selection,
  prev/next navigation, and lightbox open state should all derive from the same
  index rather than maintaining separate hero and modal cursors.
- Keep the first pass preview-first. Video items may appear as active hero
  surfaces with the existing thumbnail/play affordances, but full playback
  should continue to flow through the existing lightbox behavior rather than
  adding a second inline playback model.
- Add one bounded setting group for the first pass: hero aspect ratio,
  thumbnail size, and transition duration. Do not widen this into a general
  builder-like slot editor or a full layout-composition surface.
- Use current container width and existing common settings to choose the most
  appropriate strip orientation responsively rather than adding a separate
  breakpoint-specific placement feature in the first pass.
- Wire the new keys through the full current settings path in the same change:
  TypeScript settings/types, Zod validation, registry field definitions, and
  PHP nested-gallery sanitization.

### Acceptance criteria

- The Spotlight / Hero adapter appears in the real adapter selector and resolves
  through the normal adapter registry path. ( )
- Selecting a thumbnail updates the active hero item and opens the same index in
  the lightbox when clicked. ( )
- The adapter behaves correctly in unified and per-type gallery sections across
  common widths without breaking the current viewer shell. ( )
- Image and video media both render gracefully in the hero position without
  introducing a second inline playback contract. ( )
- New Spotlight settings round-trip correctly through TypeScript and PHP
  validation/sanitization. ( )

### Validation

- Add targeted adapter coverage for hero selection, empty-state handling, and
  mixed image/video rendering.
- Extend registry coverage for the new adapter id and its setting group.
- Extend nested-gallery settings sanitization coverage for the new Spotlight
  keys.
- Manual QA: verify Spotlight rendering in unified and per-type viewer flows at
  desktop and mobile widths.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/spotlight/SpotlightGallery.tsx` | New Spotlight / Hero adapter component |
| `src/components/Galleries/Adapters/GalleryAdapter.ts` | Add the new adapter id and setting-group union entry |
| `src/components/Galleries/Adapters/adapterRegistry.ts` | Lazy import, registration metadata, and Spotlight field definitions |
| `src/types/index.ts` | Add Spotlight settings keys and defaults |
| `src/types/settingsSchemas.ts` | Zod validation for Spotlight settings |
| `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php` | Nested gallery-config sanitizer map updates for Spotlight keys |
| `src/components/Galleries/Adapters/__tests__/adapters.test.tsx` | Shared adapter smoke coverage or targeted Spotlight rendering cases |
| `src/components/Galleries/Adapters/adapterRegistry.test.ts` | Registry and setting-group coverage for Spotlight |
| `wp-plugin/wp-super-gallery/tests/WPSG_Settings_Test.php` | Nested gallery-config sanitization coverage for Spotlight settings |

### Effort Estimate

~3-5 hours.

---

## Track P31-F — Vertical Scroll Snap Adapter (Section-Bounded)

### Problem

The deferred review correctly identified a mobile-first sequential gallery mode
as a real gap, but the original concept assumed browser-viewport ownership:
full-screen `100dvh` panels with story-like vertical paging.

That does not map directly onto the current gallery architecture. Adapters live
inside bounded gallery sections, may render inside a viewer modal, and already
inherit section sizing from `GallerySectionWrapper`. Shipping a Scroll Snap
adapter without respecting that container model would create an architectural
mismatch from day one.

### Fix

Add a Vertical Scroll Snap adapter, but scope it explicitly to the current
bounded gallery-section contract. The scroll container should snap inside the
measured gallery section rather than assuming ownership of the whole browser
viewport.

### Implementation Details

- Add a new adapter id and lazy-loaded adapter component that uses CSS
  `scroll-snap-type: y mandatory` inside the adapter shell.
- Use the measured section dimensions and the current common section-height
  settings as the authoritative sizing inputs. Do not hard-code the adapter to
  `100dvh` as its primary contract.
- Preserve the existing viewer/lightbox model: the first pass should stay
  preview-first, with click/lightbox interaction remaining authoritative rather
  than layering in autoplay or story-style inline media playback.
- In per-type layouts, do not allow two competing side-by-side snap containers
  to become the default behavior. If a per-type render plan resolves to Scroll
  Snap, the viewer should opt out of equal-height side-by-side layout and stack
  the sections vertically for predictable gesture ownership.
- Add only a small first-pass setting group: snap alignment and page-indicator
  visibility. Reuse existing common sizing/background controls instead of adding
  a second section-sizing system inside the adapter.
- Treat nested scroll and modal interaction explicitly: the adapter should not
  regress body-scroll locking, wheel/touch behavior, or lightbox entry/exit.
- Wire new setting keys through the existing TypeScript/Zod/PHP settings path in
  the same pass.

### Acceptance criteria

- The Vertical Scroll Snap adapter renders a bounded snap container inside the
  current gallery section instead of assuming full-browser viewport ownership. ( )
- Unified and per-type gallery flows render correctly with the new adapter. ( )
- Per-type layouts opt out of side-by-side equal-height presentation when Scroll
  Snap is selected so the user does not get two competing vertical snap
  surfaces at once. ( )
- Existing click/lightbox behavior and scroll-lock behavior remain compatible
  with the adapter. ( )
- New Scroll Snap settings round-trip correctly through TypeScript and PHP
  validation/sanitization. ( )

### Validation

- Add targeted adapter coverage for bounded snap rendering and empty-state
  handling.
- Extend viewer-path tests so per-type layouts assert the intended stacked
  behavior when Scroll Snap is selected.
- Extend registry and settings sanitization coverage for the new adapter keys.
- Manual QA: verify scroll behavior in unified and per-type surfaces at mobile
  and desktop widths, including modal/lightbox interaction.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/scroll-snap/ScrollSnapGallery.tsx` | New section-bounded Vertical Scroll Snap adapter |
| `src/components/Galleries/Adapters/GalleryAdapter.ts` | Add the new adapter id and setting-group union entry |
| `src/components/Galleries/Adapters/adapterRegistry.ts` | Lazy import, registration metadata, and Scroll Snap field definitions |
| `src/components/CardViewer/PerTypeGallerySection.tsx` | Opt out of side-by-side equal-height layout when Scroll Snap is selected |
| `src/types/index.ts` | Add Scroll Snap settings keys and defaults |
| `src/types/settingsSchemas.ts` | Zod validation for Scroll Snap settings |
| `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php` | Nested gallery-config sanitizer map updates for Scroll Snap keys |
| `src/components/Galleries/Adapters/adapterRegistry.test.ts` | Registry and setting-group coverage for Scroll Snap |
| `src/components/CardViewer/GallerySections.test.tsx` | Viewer-path coverage for unified/per-type Scroll Snap behavior |
| `wp-plugin/wp-super-gallery/tests/WPSG_Settings_Test.php` | Nested gallery-config sanitization coverage for Scroll Snap settings |

### Effort Estimate

~4-6 hours.

---

## Track P31-G — Waterfall Entrance Animation as a Masonry Enhancement

### Problem

The deferred Waterfall concept is visually distinct on first load, but it is
not architecturally distinct enough to justify a separate adapter id, separate
documentation surface, and separate QA matrix.

After initial render, the concept collapses back into ordinary Masonry. Keeping
it as a standalone adapter would add avoidable registry and maintenance surface
for a mostly cosmetic delta.

### Fix

Implement Waterfall as a bounded Masonry enhancement: an optional entrance
animation mode layered onto the existing Masonry adapter rather than a new
registered adapter family.

### Implementation Details

- Keep the Masonry adapter id and rendering model intact.
- Add a small Masonry-scoped animation option for initial entrance behavior,
  with at most one companion stagger/duration control if the implementation
  needs it.
- Scope the feature to initial mount or real media-array changes only. Do not
  animate on every resize, reflow, or lightbox interaction.
- Use CSS keyframes and per-item delay rather than introducing layout-shuffle or
  FLIP-style animation machinery.
- Respect reduced-motion preferences by disabling or minimizing the effect when
  `prefers-reduced-motion` is active.
- Keep the default behavior unchanged when the animation option is off.
- Wire any new keys through the existing TypeScript/Zod/PHP settings path in the
  same pass.

### Acceptance criteria

- Masonry can opt into a Waterfall-style entrance animation without introducing
  a new adapter id. ( )
- The animation applies only to the intended entry path and does not replay on
  ordinary layout recalculation. ( )
- Reduced-motion users are not forced through the effect. ( )
- Masonry behavior is unchanged when the animation option is disabled. ( )
- New Masonry animation settings round-trip correctly through TypeScript and PHP
  validation/sanitization. ( )

### Validation

- Extend adapter coverage for Masonry with animation enabled and disabled.
- Extend registry coverage for the additional Masonry setting fields.
- Extend nested-gallery settings sanitization coverage for the new Masonry
  animation keys.
- Manual QA: verify first-render animation, reduced-motion behavior, and no
  replay on ordinary resize or lightbox interaction.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Galleries/Adapters/masonry/MasonryGallery.tsx` | Add optional Waterfall-style entrance animation behavior |
| `src/components/Galleries/Adapters/adapterRegistry.ts` | Extend Masonry field definitions with the animation option |
| `src/types/index.ts` | Add Masonry animation settings keys and defaults |
| `src/types/settingsSchemas.ts` | Zod validation for the new Masonry animation settings |
| `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php` | Nested gallery-config sanitizer map updates for Masonry animation keys |
| `src/components/Galleries/Adapters/__tests__/adapters.test.tsx` | Masonry coverage for animation-enabled and disabled states |
| `src/components/Galleries/Adapters/adapterRegistry.test.ts` | Registry and setting-group coverage for Masonry animation settings |
| `wp-plugin/wp-super-gallery/tests/WPSG_Settings_Test.php` | Nested gallery-config sanitization coverage for Masonry animation settings |

### Effort Estimate

~2-3 hours.

---

## Track P31-H — Media Payload Foundations Pre-Evaluation

### Problem

The deferred review correctly identified that Timeline and future filterable
gallery work need richer media metadata, but the current state is less clean
than a simple "field missing" diagnosis.

Today, the TypeScript `MediaItem` contract does not formally expose
`dateUploaded`, `filesize`, or per-item tags, yet the REST media sort path still
references `dateUploaded` and `filesize`. Media tags also already exist in the
backend taxonomy layer, but gallery media payloads do not surface them per item.
That leaves future metadata-driven gallery work sitting on ambiguous and partly
drifted assumptions.

### Fix

Run an explicit pre-evaluation that defines the canonical media-item payload
contract for future metadata-driven gallery features without turning Phase 31
into a broad backend-delivery phase.

### Implementation Details

- Audit the current media-item write/read path end to end:
  `build_media_item_from_payload`, the media list response, dimension
  enrichment, and the sort behavior that references `dateUploaded` and
  `filesize`.
- Decide whether `dateUploaded` and `filesize` are real shipped payload fields
  that should be populated and typed, or whether the current sort logic should
  be re-scoped so Phase 34 does not inherit a misleading contract.
- Distinguish the date concepts that future Timeline work could mean: attachment
  upload date, campaign-media relationship date, and manual order. Timeline
  should not proceed until one of those is chosen as the canonical chronology
  signal.
- Decide whether future filtering should expose existing `wpsg_media_tag`
  taxonomy data on `MediaItem`, and if so whether the shape should be ids,
  names, slugs, or a compact tag object.
- Keep ownership boundaries explicit: this track defines payload and contract
  prerequisites, not the Phase 34 admin media-sort UI or a broad new filtering
  surface.

### Acceptance criteria

- A written proposal exists for the canonical `MediaItem`/REST payload contract
  around `dateUploaded`, `filesize`, and optional per-item media tags. ( )
- The proposal explicitly states which date concept future Timeline work should
  rely on. ( )
- The proposal explicitly states whether filterable-gallery follow-on work
  should rely on `wpsg_media_tag` exposure, a wrapper-only transform, or new
  relationship-level metadata. ( )
- Phase 31 exits with a clear go/no-go prerequisite list for Timeline and
  Filterable follow-on work. ( )

### Validation

- Audit frontend types against live REST/media behavior and existing tests.
- Identify missing or misleading test coverage around media sorting and media
  payload shape.
- Record unresolved migration or backfill concerns explicitly rather than
  hiding them inside later adapter tracks.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `docs/PHASE31_REPORT.md` | Canonical payload proposal and prerequisite boundary |
| `src/types/index.ts` | Current `MediaItem` contract audit target |
| `src/services/apiClient.ts` | Frontend media payload consumption audit target |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Media read/write/sort path audit target |
| `wp-plugin/wp-super-gallery/tests/` | Existing PHP media payload and sorting coverage audit target |
| `src/components/CardViewer/` | Viewer-path audit target for future metadata consumption |

### Effort Estimate

~4-6 hours.

---

## Follow-On Candidates

Shared-infrastructure follow-ons from the 2026-05-19 review now live in
`PHASE32_REPORT.md`. Higher-risk adapter ideas and metadata-dependent gallery
work remain follow-on candidates here.

| Candidate | Why it is deferred |
|-----------|--------------------|
| `ApiClient` modularization | Planned in `PHASE32_REPORT.md`; valuable shared-infrastructure refactor, but materially larger than the gallery lane and not required for Phase 31 correctness. |
| PHP settings facade cleanup | Planned in `PHASE32_REPORT.md`; legitimate cleanup, but intentionally kept out of the gallery phase. |
| Scheduled archive batching | Planned in `PHASE32_REPORT.md`; good small backend maintenance item, but outside gallery configuration/runtime planning. |
| Carousel visible-card helper cleanup | The review overstated this item because `MediaCarouselAdapter` already normalizes `visibleCards` at the callsite; keep it opportunistic rather than phase-planned. |
| Store-level gallery editor rewrite (`useImmer`/proxy state) | Not justified until utility-level optimization is measured and proven insufficient. |
| Stacked / Deck and Coverflow / 3D adapters | Both remain gesture-heavy interaction ideas that need shared swipe/drag infrastructure and stronger product justification than this phase should absorb. |
| Timeline adapter | Wait for `P31-H` to define canonical media chronology and payload shape before scoping frontend delivery. |
| Mosaic / Pinterest adapter | Dense-packing value already overlaps Justified/Masonry; irregular grid assignment remains a higher-risk layout problem than this phase should take on. |
| Filterable gallery wrapper | A valid future orchestration direction, but it depends on `P31-H` payload decisions and should not enter as an adapter track. |

## Implementation Notes

- Keep this phase focused on gallery correctness, coverage, targeted
  optimization, and a small bounded capability lane; do not let it absorb the
  broader service/PHP cleanup backlog.
- Shared infrastructure follow-ons from the same review are tracked separately in
  `PHASE32_REPORT.md` so this phase stays bounded.
- If P31-B exposes additional adapter-resolution bugs, record them as follow-on
  fixes rather than silently widening P31-A.
- New adapter work in this phase should continue to honor the current adapter
  contract and section-bounded viewer model; anything that requires gesture
  infrastructure or unresolved metadata should remain deferred.
- If P31-D grows beyond a parity audit and recommendation, split its detailed
  design into a dedicated addendum doc and keep this report as the executive
  plan.