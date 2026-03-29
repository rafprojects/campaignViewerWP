# Phase 23 Progress Journal

Purpose: pragmatic, agent-readable checkpoint notes for continuing Phase 23 work without re-deriving recent decisions from git history or the larger report.

## Entry - 2026-03-28 13:53:19 UTC

### Snapshot

- Branch: `feat/phase23-settings-refactor`
- HEAD before this journal entry: `1973996 feat: add schema-driven classic navigation colors`
- Current Phase 23 position:
  - `P23-F` shared editor architecture is effectively complete. Remaining work is UX polish and parity follow-through, not foundational editor design.
  - `P23-C` has advanced materially. The classic adapter now has schema-driven carousel settings covering behavior and color controls, including boolean and text schema field support.
  - `P23-G` campaign parity is usable at the shared-editor level. Remaining work is deeper persistence/render-path cleanup rather than basic capability.
  - `P23-E`, `P23-H`, and `P23-I` have the core nested/resolver/sanitization path in place. Remaining work is finishing the remaining legacy-owned settings surface and tightening final parity edges.
  - `P23-J` is active. The report is current, targeted coverage exists, and current effort is now focused on keeping validation stable as the remaining parity slices land.

### Done

- Recent feature checkpoints already landed on this branch:
  - `44cb303 feat: expose shared gallery presentation settings`
  - `f832da4 feat: expose shared gallery height controls`
  - `7fc0a5e feat: add schema-driven classic carousel settings`
  - `fa2d182 feat: add classic navigation behavior settings`
  - `1973996 feat: add schema-driven classic navigation colors`
- Shared responsive gallery editor now supports:
  - nested shared presentation fields
  - nested shared gallery height controls
  - schema-driven classic carousel behavior fields
  - schema-driven classic navigation behavior fields
  - schema-driven classic navigation color fields
- Current test-fix slice completed and validated:
  - stabilized lazy-loaded responsive-editor integration coverage in `SettingsPanel` and `UnifiedCampaignModal`
  - replaced expensive `SettingsPanel` modal interactions with a lightweight modal stub where the test intent is seed/projection verification rather than full modal UI exercise
  - kept campaign tests on the real modal path, but tightened dialog scoping so nested modal assertions target the correct dialog reliably
  - reduced the slowest `SettingsPanel` projection case to a representative adapter-setting subset while preserving coverage for number/select/boolean/text schema control classes

### Validation State

- Previously validated focused frontend suite for the classic schema slices: 6 files, 89 tests passed.
- Validation for the current test-fix slice:
  - `src/components/Admin/SettingsPanel.test.tsx` and `src/components/Campaign/UnifiedCampaignModal.test.tsx` both pass together
  - full affected-file run result: 2 files passed, 41 tests passed
- Practical outcome: current failures were test harness/readiness issues, not a confirmed product regression in the shared editor.

### Challenges Faced

1. Lazy-loaded modal readiness in tests
   - Problem: tests were racing the `Suspense` boundary and nested modal mount, causing missing-dialog failures and incorrect scoping against the parent settings dialog.
   - Solution: campaign tests now wait on the actual nested modal title and scope assertions to the nested dialog; `SettingsPanel` tests that only needed seed/projection coverage were shifted to a lightweight mock instead of driving the full lazy modal DOM.

2. Extremely slow `SettingsPanel` integration tests
   - Problem: the real responsive editor path was pushing single tests into 80s-200s territory, causing timeouts and low-signal failures.
   - Solution: `SettingsPanel` tests now capture modal `value` and `onSave` directly from a thin mock component. This keeps the test focused on seed/projection bridge behavior and cuts cost dramatically without dropping the real modal coverage that already exists in `GalleryConfigEditorModal.test.tsx` and campaign tests.

3. Nested dialog ambiguity
   - Problem: when both parent and child dialogs existed, label/text queries could accidentally hit the wrong container, producing duplicate-label failures.
   - Solution: explicit dialog scoping was added for campaign modal tests; `SettingsPanel` no longer depends on ambiguous nested-dialog DOM for bridge tests.

4. Schema expansion regressions during recent Phase 23 work
   - Problem: adding boolean and text schema field support required every schema-driven renderer to stay aligned, not just the shared editor.
   - Solution: both the shared editor and the legacy inline adapter-settings renderer were updated when schema field unions widened, which prevented drift between paths.

### Current Assessment

- The major architecture gamble of Phase 23 has paid off: nested config, shared editor, shared resolver, and shared sanitization are all real and in use.
- The remaining frontend work is mostly parity completion against the still-flat legacy settings surface.
- The next best slices should remain small and ownership-driven. The project is at the stage where avoiding ambiguous ownership matters more than adding raw field count quickly.

### Guardrails

- Do not revert to testing the full lazy modal through `SettingsPanel` for every seed/projection case. That path is too expensive and duplicates coverage already present elsewhere.
- Keep `GalleryConfigEditorModal.test.tsx` as the place for real modal UI coverage. Keep `SettingsPanel.test.tsx` focused on seed/projection bridge behavior.
- When expanding the adapter schema again, update all schema-driven renderers together:
  - shared responsive editor
  - inline adapter settings section
  - any tests that assume the previous union shape
- Prefer the next parity slice only when ownership is clear:
  - shared presentation/common setting
  - adapter-specific runtime setting
  - campaign override inheritance behavior
- Preserve the compatibility bridge until the remaining flat settings are intentionally retired. Do not remove flat projection logic opportunistically.
- Avoid large mixed slices that combine ownership clarification, schema expansion, and runtime changes in one step.

### Handoff

```text
STATUS
- Branch is in a good continuation state.
- Shared editor foundations are in place and the classic adapter's schema-driven carousel surface is substantially covered.
- Current unstaged work after this entry should only be the validated test-fix slice plus this progress journal until committed.

WHAT TO KEEP IN MIND
- The highest remaining value is finishing the remaining legacy settings that obviously belong in nested shared editor ownership.
- The lowest-risk next work is not backend-heavy; it is frontend/shared-editor parity on settings that already have clear runtime consumers.
- Test cost matters now. Keep bridge tests narrow and modal UI tests purposeful.

LIKELY NEXT PRODUCT SLICES
1. Viewport background settings parity
   - likely keys: `imageBgType`, `imageBgColor`, `imageBgGradient`, `imageBgImageUrl`, `videoBgType`, `videoBgColor`, `videoBgGradient`, `videoBgImageUrl`, and possibly unified variants if they are still active in runtime
   - likely ownership: shared presentation/common settings

2. Viewport height controls parity
   - likely keys: `imageViewportHeight`, `videoViewportHeight`
   - likely ownership: shared common settings, but confirm whether they should remain scope-level only or become responsive per-breakpoint

3. Tile/border/shadow appearance audit
   - likely keys include border radius and shadow presets/custom values
   - this is the first slice with real ownership ambiguity; resolve semantics before implementing

TESTING APPROACH FOR NEXT SLICES
- Keep using focused frontend validation around:
  - `adapterRegistry.test.ts`
  - `GalleryConfigEditorModal.test.tsx`
  - `SettingsPanel.test.tsx`
  - campaign modal tests when campaign entry points change
  - resolver/runtime tests when nested settings feed live rendering
```

### Most Logical Next Steps

1. Commit the current validated test-fix slice and this journal entry together.
2. Take the next smallest parity slice: viewport background settings into the shared editor and bridge path.
3. Update `docs/PHASE23_REPORT.md` after that slice lands so the high-level report stays aligned with the finer-grained journal.
4. Only after the next parity slice, reassess whether viewport height controls are still the next best target or whether campaign/render-path evidence changes the priority.

## Entry - 2026-03-28 14:56:49 UTC

### Snapshot

- Purpose of this checkpoint: validate the codebase against `PHASE23_REPORT.md`, `GALLERY_CONFIG_DATA_MODEL.md`, and `GALLERY_CONFIG_UI_FLOW.md` before resuming implementation.
- Overall read: `P23-B` through `P23-I` are materially real in code, not just report-level claims. Shared editor, nested config, resolver/runtime wiring, and backend sanitization/REST round-trips all validated on the focused contract surface.
- Most defensible continuation point: viewport background settings parity. This remains the clearest shared-editor/common-setting gap still stranded on the flat compatibility path.

### Validation Run

- Focused frontend suite passed:
  - `src/components/Galleries/Adapters/adapterRegistry.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - `src/components/Campaign/UnifiedCampaignModal.test.tsx`
  - `src/components/CardViewer/GallerySections.test.tsx`
  - result: 6 files passed, 91 tests passed
- Production build passed:
  - `npm run build:wp`
- Focused backend `wp-env` suite passed after starting the local test environment:
  - `tests/WPSG_Settings_Test.php`
  - `tests/WPSG_Settings_Rest_Test.php`
  - `tests/WPSG_Settings_Extended_Test.php`
  - `tests/WPSG_Campaign_Rest_Test.php`
  - result: 15 tests passed, 93 assertions

### Confirmed Matches

- `P23-B` settings-panel decomposition is real. The extracted settings modules exist and `SettingsPanel` now acts mainly as orchestration plus compatibility bridge.
- `P23-C` adapter schema expansion is real. The registry owns the active schema-driven classic carousel/navigation fields and the shared editor consumes those definitions.
- `P23-D` and `P23-E` nested config plus resolver layers are real. `galleryConfig`, campaign `galleryOverrides`, merge precedence, and runtime common-setting projection all exist and are covered by focused tests.
- `P23-F` and `P23-G` shared editor plus campaign parity are materially in place. The modal is lazy-loaded from both entry points and campaign nested overrides round-trip through REST/meta.
- `P23-H` and `P23-I` shared runtime and sanitization paths are real. Viewer sections use the shared resolver path, and backend sanitizer/tests cover nested settings plus campaign overrides.

### Findings

1. Viewport background settings are still outside the nested shared editor/common-setting model.
   - Current keys still live on the flat settings path: `imageBgType`, `imageBgColor`, `imageBgGradient`, `imageBgImageUrl`, `videoBgType`, `videoBgColor`, `videoBgGradient`, `videoBgImageUrl`, `unifiedBgType`, `unifiedBgColor`, `unifiedBgGradient`, `unifiedBgImageUrl`.
   - Evidence from code:
     - `GalleryPresentationSections` still edits them directly as flat settings.
     - `GalleryCommonSettings` does not define them.
     - `buildGalleryCommonSettingsFromLegacy()` and `COMMON_SETTING_FIELD_MAP` do not seed/project them.
     - runtime sections still pass them through directly from the resolved flat settings contract.
   - Practical implication: campaign/gallery nested parity is not yet complete for viewport presentation, even though gallery labels/visibility are already nested.

2. Viewport height controls are still ownership-ambiguous and remain outside shared common-setting parity.
   - `imageViewportHeight` and `videoViewportHeight` are sanitized on the backend and consumed by the classic runtime, but they are not part of `GalleryCommonSettings`, not exposed in the shared editor, and not projected through the shared common-setting map.
   - This is the next-most-obvious parity gap after backgrounds, but it should follow only after deciding whether these remain adapter-specific classic runtime settings or move into shared responsive ownership.

3. Current `shared presentation` wording needs to be read narrowly.
   - The nested/shared-editor presentation slice currently covers gallery labels and label visibility/justification.
   - It does not yet cover full viewport presentation parity.

### Assessment

- No new regression surfaced in the currently claimed Phase 23 validation surface.
- The broad report direction still holds.
- The remaining gap is not architectural uncertainty anymore; it is a bounded parity follow-through problem on a still-flat legacy-owned setting slice.

### Recommended Next Slice

1. Implement viewport background settings parity first.
   - Why first:
     - ownership is clearer than tile/border/shadow styling
     - the runtime consumers already exist
     - it closes the most obvious mismatch between the documented shared-editor architecture and the actual code
   - Minimum implementation expectation:
     - extend nested gallery common-setting ownership or explicitly define per-scope presentation ownership
     - seed from legacy flat settings
     - expose in `GalleryConfigEditorModal`
     - project back through the global save bridge
     - resolve/project through runtime consumers
     - add focused editor, settings bridge, resolver/runtime, and campaign tests

2. Reassess viewport height controls only after the background slice lands.
   - If heights stay classic-only, treat them as adapter/runtime-owned schema work.
   - If heights become shared responsive presentation, move them intentionally rather than as a side effect.

### Handoff

```text
READYNESS
- Yes: the branch is in a stable continuation state.
- Focused frontend validation, production build, and targeted wp-env backend validation are all green.

START HERE
- Take viewport background settings parity as the next implementation slice.
- Avoid combining that work with viewport height ownership cleanup in the same change.

WHY THIS IS THE RIGHT START
- It is the clearest remaining gap between the documented shared-editor architecture and the actual code.
- It has existing runtime consumers, so the slice is high-value without being architecture-heavy.
```

## Entry - 2026-03-28 15:20:01 UTC

### Snapshot

- Viewport background settings parity is now implemented through the nested shared-editor/common-setting path.
- The slice landed end-to-end across frontend types, legacy seeding, resolver/runtime projection, global save bridge, shared editor UI, backend sanitization, and focused tests.
- Next most sensible continuation point is now viewport height ownership/parity, not backgrounds.

### Work Done

- Added nested scope-aware viewport background common-setting fields to the Phase 23 gallery config model:
  - `viewportBgType`
  - `viewportBgColor`
  - `viewportBgGradient`
  - `viewportBgImageUrl`
- Updated the legacy-to-nested compatibility bridge so image/video/unified flat background settings now seed into the matching nested scope common config.
- Updated the shared resolver/runtime projection so nested viewport background settings now flow back onto the existing flat runtime contract used by `UnifiedGallerySection`, `PerTypeGallerySection`, and `GallerySectionWrapper`.
- Updated the global settings save bridge so shared-editor viewport background changes now project back into the flat settings surface during the migration.
- Expanded `GalleryConfigEditorModal` to edit viewport background settings directly for the active gallery scopes.
- Updated backend nested common-setting sanitization to treat scope-aware viewport background fields as first-class known nested fields instead of compatibility-only unknown keys.

### Validation Run

- Focused frontend suite passed:
  - `src/utils/galleryConfig.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - `src/components/CardViewer/GallerySections.test.tsx`
  - `src/components/Campaign/UnifiedCampaignModal.test.tsx`
  - result: 6 files passed, 88 tests passed
- Focused backend `wp-env` suite passed:
  - `tests/WPSG_Settings_Test.php`
  - `tests/WPSG_Settings_Rest_Test.php`
  - `tests/WPSG_Campaign_Rest_Test.php`
  - result: 15 tests passed, 103 assertions
- Production build passed:
  - `npm run build:wp`

### Assessment

- The previously identified background parity gap is closed.
- Shared-editor/common-setting ownership now includes both gallery labels/visibility and viewport background presentation.
- The highest-value remaining parity question is now whether `imageViewportHeight` and `videoViewportHeight` should remain adapter/runtime-owned classic settings or move into explicit shared responsive ownership.

### Recommended Next Slice

1. Resolve viewport height ownership and parity.
   - Confirm whether `imageViewportHeight` and `videoViewportHeight` remain classic runtime fields or become nested shared/common settings.
   - Once ownership is settled, thread them through the same end-to-end path now used by viewport backgrounds.

2. Keep tile/border/shadow work deferred until after height ownership is clear.
   - That slice still has more semantic ambiguity than viewport heights.

### Handoff

```text
STATUS
- Viewport background settings parity is complete.
- The branch remains green on focused frontend validation, focused wp-env PHP validation, and build:wp.

START HERE NEXT
- Take viewport height ownership/parity as the next implementation slice.
- Avoid mixing it with tile/border/shadow semantics in the same change.
```

## Entry - 2026-03-28 15:53:48 UTC

### Snapshot

- Viewport height ownership is now resolved: `imageViewportHeight` and `videoViewportHeight` remain classic adapter-owned settings, not nested common settings.
- The shared editor now exposes those base heights through the schema-driven classic `carousel` adapter group, including unified classic galleries where both media-type heights still matter at runtime.
- This closes the previously identified height parity gap without broadening the common-setting surface beyond `gallerySizingMode` and `galleryManualHeight`.

### Work Done

- Added scope-array applicability support to the adapter schema helpers so a single adapter field can apply to `image + unified` or `video + unified` contexts without showing in irrelevant scopes.
- Extended the classic `carousel` adapter setting group to include:
  - `imageViewportHeight`
  - `videoViewportHeight`
- Kept shared height behavior ownership unchanged:
  - `gallerySizingMode`
  - `galleryManualHeight`
  remain nested common settings.
- Verified the legacy-to-nested seed path now carries the classic viewport height fields into nested adapter settings for matching classic scopes, with unified classic config retaining both media-type base heights.
- Verified the existing SettingsPanel adapter-setting collector continues projecting those nested adapter settings back into flat fields on save, so the compatibility bridge remains intact.

### Validation Run

- Focused frontend suite passed:
  - `src/utils/galleryConfig.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 4 files passed, 69 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- The viewport height parity gap is closed on the frontend path.
- Ownership is now clearer and more defensible:
  - shared/common settings own gallery-wide height mode/manual-height behavior
  - classic adapter settings own per-media base viewport heights
- This avoids turning an adapter-specific runtime detail into a misleading common setting.

### Recommended Next Slice

1. Take the next adapter-owned classic appearance slice.
   - Best candidates: `imageBorderRadius`, `videoBorderRadius`, `imageShadowPreset`, `videoShadowPreset`, and related classic-only appearance controls still outside the shared editor schema surface.

2. Keep tile/border/shadow work scoped carefully.
   - Do not mix shape-adapter tile styling and classic-carousel viewport styling into one wide refactor.

### Handoff

```text
STATUS
- Viewport height ownership/parity is now implemented through classic adapter settings.
- The shared editor no longer needs a common-setting expansion for this slice.

START HERE NEXT
- Extend the shared schema/editor surface for the next adapter-owned classic appearance controls.
- Preserve the ownership split: common for shared gallery behavior, adapterSettings for classic-only runtime details.
```

## Entry - 2026-03-28 21:27:01 UTC

### Snapshot

- Classic shadow parity is now implemented through the schema-driven shared editor path.
- `imageShadowPreset`, `imageShadowCustom`, `videoShadowPreset`, and `videoShadowCustom` are now exposed from nested classic `adapterSettings` instead of remaining inline flat-only controls.
- Border radius is now the clearer remaining appearance ownership question because it is consumed outside the classic runtime as well.

### Work Done

- Extended the classic `carousel` adapter schema group to include:
  - `imageShadowPreset`
  - `imageShadowCustom`
  - `videoShadowPreset`
  - `videoShadowCustom`
- Reused the existing scope-array applicability support so unified classic galleries still expose both image and video shadow controls while per-type mode only shows the matching scope fields.
- Added shared-editor conditional rendering for the custom shadow text inputs so they only appear when the corresponding shadow preset is set to `custom`.
- Verified the existing legacy-to-nested compatibility builder now seeds classic shadow settings into nested adapter settings automatically through the schema path.
- Verified the existing SettingsPanel adapter-setting collector still projects those nested shadow settings back into the flat compatibility fields on save.

### Validation Run

- Focused frontend suite passed:
  - `src/utils/galleryConfig.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 4 files passed, 69 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- The remaining classic depth-control gap is closed.
- No backend changes were required for this slice because nested adapter-setting sanitization already owned the shadow fields.
- The next unresolved appearance slice is broader than classic-only behavior: `imageBorderRadius` / `videoBorderRadius` are consumed by wrappers and non-classic adapters as well, so they need an explicit ownership decision before moving further.

### Recommended Next Slice

1. Resolve border-radius ownership/parity.
   - Determine whether `imageBorderRadius` and `videoBorderRadius` should remain adapter-owned, become scope-specific common settings, or move into a new multi-adapter appearance group.
   - Validate that decision against `GallerySectionWrapper`, classic runtime, and the non-classic adapters that already read those flat fields.

2. Keep thumbnail-gap and broader tile appearance out of the same change.
   - Those fields cross different adapter families and will be easier to reason about after border-radius ownership is settled.

### Handoff

```text
STATUS
- Classic shadow preset/custom parity is complete through the shared schema/editor path.
- The branch is green on the focused frontend contract and build:wp.

START HERE NEXT
- Take border-radius ownership/parity as the next dedicated slice.
- Avoid mixing it with thumbnail-gap or shape-tile appearance in the same change.
```

## Entry - 2026-03-28 22:27:24 UTC

### Snapshot

- Border-radius parity is now implemented through a shared schema-driven adapter group rather than being left as a flat-only appearance control.
- `imageBorderRadius` and `videoBorderRadius` now round-trip through nested `adapterSettings` for classic, compact-grid, justified, and masonry.
- Mixed-media runtime parity is now explicit: non-classic rectangular adapters use the matching image/video radius per tile, and unified wrappers use the larger of the two resolved radii.

### Work Done

- Added a new shared `media-frame` adapter setting group to the registry and attached it to the classic, compact-grid, justified, and masonry adapters.
- Exposed `imageBorderRadius` / `videoBorderRadius` through the shared gallery config editor under a dedicated `Media Frame` group instead of treating them as shared `common` settings.
- Verified the existing legacy-to-nested compatibility builder and SettingsPanel save bridge already seed/project those values correctly once the schema group is registered.
- Updated compact-grid, justified, and masonry runtime rendering so mixed-media galleries now apply `imageBorderRadius` to image tiles and `videoBorderRadius` to video tiles instead of always using the image radius.
- Updated unified section wrapper resolution so nested unified configs use the larger resolved media radius for the outer wrapper instead of under-rounding mixed-media galleries.

### Validation Run

- Focused frontend suite passed:
  - `src/utils/galleryConfig.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - `src/components/CardViewer/GallerySections.test.tsx`
  - `src/components/Galleries/Adapters/__tests__/adapters.test.tsx`
  - result: 6 files passed, 147 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- Border radius now has an explicit ownership model: adapter-owned through a shared multi-adapter `media-frame` group, not promoted into nested `common` settings and not limited to classic-only behavior.
- No backend changes were required for this slice because nested adapter-setting sanitization already recognized the border-radius fields.
- The next clean parity gap is smaller and more local: `thumbnailGap` is still flat-only while justified and masonry continue to consume it directly at runtime.

### Recommended Next Slice

1. Resolve `thumbnailGap` ownership/parity for justified and masonry.
   - Decide whether it belongs in a shared grid-spacing adapter group or another narrow adapter-owned schema surface.
   - Validate shared-editor seeding/projection plus justified/masonry runtime consumption without pulling broader tile appearance into the same change.

2. Keep tile border/glow and card-border styling separate.
   - Those controls span different adapter families and non-gallery UI, so they remain a worse bundling target than the justified/masonry gap field.

### Handoff

```text
STATUS
- Border-radius parity is complete through the shared schema/editor path.
- The branch is green on the focused frontend contract and build:wp.

START HERE NEXT
- Take thumbnail-gap ownership/parity as the next dedicated slice.
- Keep tile border/glow and broader card styling out of that change.
```

## Entry - 2026-03-28 22:42:08 UTC

### Snapshot

- `thumbnailGap` parity is now implemented through a shared schema-driven adapter group for justified and masonry.
- The field stays adapter-owned instead of being folded into nested `common.adapterItemGap`, preserving the narrower justified/masonry spacing contract.
- Shared-editor seeding, rendering, save projection, and resolver/runtime projection are now aligned for the remaining justified/masonry gap field.

### Work Done

- Added a new shared `photo-grid` adapter setting group to the registry and attached it to the justified and masonry adapters.
- Exposed `thumbnailGap` through the shared gallery config editor under a dedicated `Photo Grid` group instead of leaving it as an inline flat-only setting.
- Verified the existing legacy-to-nested compatibility builder now seeds `thumbnailGap` into nested adapter settings automatically for justified/masonry selections once the shared group is registered.
- Verified the existing SettingsPanel save bridge still projects nested `thumbnailGap` values back into the flat compatibility field on save.
- Added focused resolver coverage to confirm nested justified adapter settings still project `thumbnailGap` back onto the legacy runtime field consumed by the live adapters.

### Validation Run

- Focused frontend suite passed:
  - `src/utils/galleryConfig.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 4 files passed, 73 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- `thumbnailGap` now has explicit nested ownership as a shared justified/masonry adapter setting, not a generic common spacing field.
- No backend changes were required for this slice because nested adapter-setting sanitization already recognized the field.
- The next remaining gallery appearance gap is broader tile styling: tile border and glow controls are still flat-only while multiple gallery adapters consume them through the shared tile-style helpers.

### Recommended Next Slice

1. Resolve tile border/glow ownership/parity.
   - Audit `tileBorderWidth`, `tileBorderColor`, `tileGlowEnabled`, `tileGlowColor`, and `tileGlowSpread` across the shape adapters plus justified/masonry.
   - Move them into a shared adapter-owned appearance group only if the affected adapter families align cleanly enough to share one schema surface.

2. Keep campaign card border styling separate.
   - `cardBorderWidth` and `cardBorderColor` belong to broader non-gallery UI and should not be bundled into the next gallery adapter parity slice.

### Handoff

```text
STATUS
- Thumbnail-gap parity is complete through the shared schema/editor path.
- The branch is green on the focused frontend contract and build:wp.

START HERE NEXT
- Take tile border/glow ownership-parity as the next dedicated slice.
- Keep campaign card border styling out of that change.
```

## Entry - 2026-03-28 23:02:25 UTC

### Snapshot

- Tile-appearance parity is now implemented through a shared schema-driven adapter group instead of remaining on the inline flat-only settings path.
- `tileBorderWidth`, `tileBorderColor`, `tileHoverBounce`, `tileGlowEnabled`, `tileGlowColor`, and `tileGlowSpread` now round-trip through nested `adapterSettings` for the shape adapters plus justified and masonry.
- Hover bounce moved with border/glow in the same slice because all six fields share the same tile-style helper contract and conditional editor behavior.

### Work Done

- Added a new shared `tile-appearance` adapter setting group to the registry and attached it to justified, masonry, hexagonal, circular, and diamond.
- Exposed those fields through the shared gallery config editor under a dedicated `Tile Appearance` group instead of leaving them as inline flat-only controls.
- Added shared-editor conditional visibility for nested tile appearance details so border color only appears when border width is greater than 0, and glow color/spread only appear when hover glow is enabled.
- Verified the existing legacy-to-nested compatibility builder now seeds those tile appearance fields into nested adapter settings automatically for the adapters that consume them.
- Verified the existing SettingsPanel save bridge and shared resolver still project those nested adapter settings back onto the legacy flat runtime contract consumed by the live adapters.

### Validation Run

- Focused frontend suite passed:
  - `src/utils/galleryConfig.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 4 files passed, 77 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- Tile appearance now has an explicit nested ownership model for the adapters that actually consume the shared tile-style helper contract.
- No backend changes were required for this slice because nested adapter-setting sanitization already recognized these fields.
- The next clean gallery-only parity gap is now shape-specific spacing: `tileGapX` and `tileGapY` remain flat-only and are only consumed by the shape adapters.

### Recommended Next Slice

1. Resolve shape tile-gap parity.
   - Move `tileGapX` and `tileGapY` into the existing shape adapter-owned schema surface.
   - Keep the change limited to shape adapters and their shared editor/save-bridge coverage.

2. Keep layout-builder slot-effect defaults separate.
   - Layout builder only borrows glow color/spread as fallback slot defaults, so that ownership question is not the same thing as the shared tile-appearance contract.

### Handoff

```text
STATUS
- Tile-appearance parity is complete through the shared schema/editor path.
- The branch is green on the focused frontend contract and build:wp.

START HERE NEXT
- Take shape tile-gap parity as the next dedicated slice.
- Keep layout-builder slot-effect defaults separate from that change.
```

## Entry - 2026-03-29 01:33:15 UTC

### Snapshot

- Shape tile-gap parity is now implemented through the existing shared `shape` adapter group instead of remaining on the inline flat-only settings path.
- `tileGapX` and `tileGapY` now round-trip through nested `adapterSettings` for the hexagonal, circular, and diamond adapters.
- The shared editor now exposes those shape-only spacing controls under `Shape Layout`, keeping them aligned with the existing shape tile-size schema surface.

### Work Done

- Extended the shared `shape` adapter setting group to include `tileGapX` and `tileGapY` for the shape adapters.
- Exposed those fields through the shared gallery config editor under `Shape Layout` instead of leaving them as inline flat-only controls.
- Verified the existing legacy-to-nested compatibility builder now seeds shape tile-gap values into nested adapter settings automatically for shape selections.
- Verified the existing SettingsPanel save bridge and shared resolver still project those nested shape settings back onto the legacy flat runtime contract consumed by the live adapters.

### Validation Run

- Focused frontend suite passed:
  - `src/utils/galleryConfig.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 4 files passed, 77 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- Shape-specific spacing now has explicit nested adapter ownership instead of remaining on the flat compatibility path.
- No backend changes were required for this slice because nested adapter-setting sanitization already recognized `tileGapX` and `tileGapY`.
- The remaining gallery-specific parity work is now narrower: layout-builder-specific appearance defaults still need their own ownership audit because they do not map cleanly onto the shared tile-appearance contract.

### Recommended Next Slice

1. Audit layout-builder-specific appearance defaults.
   - Keep the change limited to slot-effect fallback settings that are genuinely layout-builder-owned.

2. Keep broader non-gallery appearance work separate.
   - Campaign card styling and other non-gallery appearance fields should not be bundled into the next adapter parity slice.

### Handoff

```text
STATUS
- Shape tile-gap parity is complete through the shared schema/editor path.
- The branch is green on the focused frontend contract and build:wp.

START HERE NEXT
- Audit layout-builder-specific appearance defaults as the next dedicated slice.
- Keep broader non-gallery appearance work out of that change.
```

## Entry - 2026-03-29 02:28:42 UTC

### Snapshot

- Layout-builder glow-default parity is now implemented through the existing `layout-builder` adapter group instead of remaining on the flat-only compatibility path.
- `tileGlowColor` and `tileGlowSpread` now round-trip through nested `adapterSettings` for layout-builder selections as slot-default fallbacks.
- The follow-up implementation also made both schema-driven adapter renderers understand `color` fields, because the shared editor and inline adapter settings had only previously handled number, boolean, select, and text controls.

### Work Done

- Extended the shared `layout-builder` adapter setting group to include default glow color and glow spread alongside the existing scope selector.
- Exposed those fields through the shared gallery config editor under `Layout Builder` so slot-default glow behavior no longer depends on flat-only settings ownership.
- Added generic adapter-setting support for schema-defined `color` fields in both `GalleryConfigEditorModal` and `GalleryAdapterSettingsSection`.
- Adjusted conditional adapter-field rendering so glow detail fields stay conditional in `tile-appearance` but render normally in groups that only reuse the glow keys as defaults.
- Verified the existing legacy-to-nested compatibility builder, SettingsPanel save bridge, and shared resolver now seed and project layout-builder glow defaults correctly.

### Validation Run

- Focused frontend suite passed:
  - `src/components/Galleries/Adapters/adapterRegistry.test.ts`
  - `src/utils/galleryConfig.test.ts`
  - `src/utils/resolveAdapterId.test.ts`
  - `src/components/Common/GalleryConfigEditorModal.test.tsx`
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 5 files passed, 92 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- Layout-builder-specific glow defaults now have explicit nested adapter ownership instead of borrowing the flat tile-appearance path indirectly.
- No backend changes were required for this slice because nested adapter-setting sanitization already recognized `tileGlowColor` and `tileGlowSpread`.
- The remaining parity work is now broader and less gallery-specific: the obvious adapter-owned gaps are effectively closed, and the next slices should focus on non-gallery appearance ownership or other remaining flat settings that still lack a clear nested home.

### Recommended Next Slice

1. Audit the remaining non-gallery appearance fields.
   - Keep campaign card styling and other non-gallery UI concerns separate from the gallery adapter contract.

2. Preserve the schema-driven renderers as the only place new adapter field types are introduced.
   - If another adapter-specific field family needs a new control type, update the shared and inline renderers together.

### Handoff

```text
STATUS
- Layout-builder default glow parity is complete through the shared schema/editor path.
- The branch is green on the focused frontend contract and build:wp.

START HERE NEXT
- Move to the remaining non-gallery appearance ownership audit.
- Keep future adapter control-type additions synchronized across both schema-driven renderers.
```

## Entry - 2026-03-29 02:49:41 UTC

### Snapshot

- The next non-gallery slice is now underway as a frontend decomposition task rather than a forced `galleryConfig` expansion.
- The entire Campaign Cards tab has been extracted out of `SettingsPanel` into a dedicated `CampaignCardSettingsSection` module.
- Card appearance, card grid, and card pagination controls still behave the same, but the settings shell now delegates another large non-gallery settings domain.

### Work Done

- Added a dedicated `CampaignCardSettingsSection` component under `src/components/Settings/`.
- Moved the inline card appearance controls into that module, including border mode/color, shadow preset, thumbnail sizing, and card element visibility toggles.
- Moved the inline card grid and pagination controls into the same module, including responsive column selection, gap/max-width controls, aspect ratio/min-height, and paginated card navigation settings.
- Replaced the inline Campaign Cards tab body in `SettingsPanel` with the extracted section component so the panel continues trending toward orchestration rather than owning each settings subtree directly.

### Validation Run

- Focused frontend suite passed:
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 2 suites passed, 33 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- This keeps the non-gallery appearance work separate from the adapter schema and nested gallery-config ownership path, which matches the earlier audit conclusion.
- `SettingsPanel` is now thinner on another large tab without changing runtime ownership or introducing a new settings model for campaign-card behavior.
- The most obvious remaining inline surface is now the General tab, especially the viewer background, auth bar, security, and developer groups that still sit directly inside `SettingsPanel`.

### Recommended Next Slice

1. Extract the remaining General tab body into a dedicated settings module.
   - Keep viewer background, auth bar, security, and developer controls out of `galleryConfig` and treat them as separate panel domains.

2. Continue the non-gallery ownership audit only where a clearer shared model actually exists.
   - Avoid forcing campaign-card or viewer-wrapper settings into the gallery adapter contract just because they are appearance-related.

### Handoff

```text
STATUS
- Campaign Cards settings now live in a dedicated section component.
- The branch is green on the focused SettingsPanel suite and build:wp.

START HERE NEXT
- Extract the remaining General tab body into its own settings module.
- Keep non-gallery appearance work separate from galleryConfig ownership.
```

## Entry - 2026-03-29 03:07:08 UTC

### Snapshot

- The remaining General tab body has now been extracted out of `SettingsPanel` into a dedicated `GeneralSettingsSection` module.
- Theme selection, app-container controls, viewer-wrapper appearance, auth-bar settings, security, and developer toggles now live outside the main settings shell.
- The extraction stayed structural, but the first build caught two real cleanup issues: a stale `ThemeSelector` import and a too-narrow section prop type.

### Work Done

- Added a dedicated `GeneralSettingsSection` component under `src/components/Settings/`.
- Moved the inline General tab control tree into that component, including theme selection, default layout, app container sizing, WordPress full-bleed toggles, viewer header visibility, viewer background, auth-bar behavior, idle timeout, and developer toggles.
- Wired `SettingsPanel` to pass the existing state updater plus a dedicated theme-change callback into the new section so save state and preview behavior remain owned by the shell.
- Fixed the build-discovered follow-up issues by removing the stale `ThemeSelector` import from `SettingsPanel` and widening the extracted section's local settings type to match the panel updater contract.

### Validation Run

- Focused frontend suite passed:
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 2 suites passed, 33 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- `SettingsPanel` now delegates both non-gallery top-level tabs that were still obvious monolith candidates: Campaign Cards and General.
- The build-only type mismatch confirmed that section extraction components need prop types aligned with the panel updater contract, even when some keys are not used directly in the extracted subtree.
- The most obvious remaining inline surface in `SettingsPanel` is now the Media Display tab body.

### Recommended Next Slice

1. Extract the remaining Media Display tab body into a dedicated settings section.
   - Keep it as a structural refactor first, then continue any deeper gallery-config migration work separately.

2. Continue treating build failures after extraction as useful contract checks.
   - They are catching stale imports and prop-shape drift that the focused tests alone will not surface.

### Handoff

```text
STATUS
- General settings now live in a dedicated section component.
- The branch is green on the focused SettingsPanel suite and build:wp.

START HERE NEXT
- Extract the remaining inline Media Display tab body.
- Keep extraction work structural unless a field has a clearer shared gallery-config home.
```

## Entry - 2026-03-29 03:38:47 UTC

### Snapshot

- The entire Media Display tab body has now been extracted out of `SettingsPanel` into a dedicated `MediaDisplaySettingsSection` module.
- The extracted section owns the remaining legacy gallery viewport, tile appearance, thumbnail-strip, transition, and navigation accordions without changing their runtime ownership.
- As with the General extraction, the build surfaced a useful contract mismatch: the extracted section's local prop type was narrower than the panel updater contract and had to be widened.

### Work Done

- Added a dedicated `MediaDisplaySettingsSection` component under `src/components/Settings/`.
- Moved the full inline Media Display accordion into that module, including lightbox/animation toggles, viewport height mode, border radius, shadow controls, tile appearance, thumbnail-strip controls, transitions, and overlay-arrow/dot-navigation settings.
- Replaced the inline Media Display tab body in `SettingsPanel` with the new delegated section component while preserving tooltip rendering for the remaining legacy height controls.
- Fixed the build-discovered follow-up by widening the extracted section's local settings type so it matches the `SettingsPanel` updater contract instead of assuming only the visibly used keys matter.

### Validation Run

- Focused frontend suite passed:
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 2 suites passed, 33 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- `SettingsPanel` is now mostly a shell and coordinator: the General, Campaign Cards, Campaign Viewer, Advanced, Typography, and Media Display tab bodies all live in dedicated modules, while gallery-layout subtrees were already partially extracted earlier.
- The repeated updater-type mismatch on extracted components is now a concrete pattern: section-local prop types should match the panel updater contract, even if some fields are not read directly by that section.
- Further decomposition inside `SettingsPanel` is now a lower-yield cleanup compared with the remaining Phase 23 parity and consolidation work.

### Recommended Next Slice

1. Reassess whether another `SettingsPanel` extraction is still worth it.
   - The remaining inline surface is comparatively small and mostly orchestration, gallery-layout entry wiring, and footer controls.

2. Shift back toward the remaining non-decomposition Phase 23 tracks unless a clearly bounded shell extraction remains.
   - Render-path parity, campaign parity, and final ownership cleanup are likely higher-yield than continuing to split already-thin orchestration code.

### Handoff

```text
STATUS
- Media Display settings now live in a dedicated section component.
- The branch is green on the focused SettingsPanel suite and build:wp.

START HERE NEXT
- Decide whether to do one final low-yield SettingsPanel shell extraction or shift back to the remaining Phase 23 parity/consolidation tracks.
- Keep extracted section prop types aligned with the panel updater contract.
```

## Entry - 2026-03-29 10:09:21 UTC

### Snapshot

- The remaining Gallery Layout tab shell has now been extracted out of `SettingsPanel` into a dedicated `GalleryLayoutSettingsSection` module.
- `SettingsPanel` now owns shell/orchestration concerns, the lazy shared-editor bridge, save/reset footer actions, and the legacy compatibility projection path rather than another inline tab subtree.
- The build surfaced the only follow-up issue: stale imports left behind after the extraction.

### Work Done

- Added a dedicated `GalleryLayoutSettingsSection` component under `src/components/Settings/`.
- Moved the inline Gallery Adapters wrapper, the shared responsive-editor entry button, and delegation to `GalleryPresentationSections` plus `GalleryLayoutDetailSections` into that new module.
- Replaced the inline layout-tab body in `SettingsPanel` with the extracted section component while preserving the existing callback that opens the lazy shared editor.
- Removed the stale `Text` and `GalleryAdapterSettingsSection` imports from `SettingsPanel` after the production build surfaced them as dead code.

### Validation Run

- Focused frontend suite passed:
  - `src/components/Admin/SettingsPanel.test.tsx`
  - result: 2 suites passed, 33 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- P23-B frontend settings decomposition is now complete.
- `SettingsPanel` has reached the intended end state for this phase: a shell/coordinator with shared update helpers, modal/editor wiring, save/reset handling, and compatibility-bridge projection rather than a monolithic collection of inline tab trees.
- Further decomposition inside `SettingsPanel` would now be churn, not leverage; the higher-yield work has shifted back to the remaining Phase 23 parity and consolidation tracks.

### Recommended Next Slice

1. Shift back to the remaining non-decomposition Phase 23 tracks.
   - Campaign parity, render-path cleanup, and the remaining shared sanitization/ownership slices are higher-yield than more shell extraction.

2. Keep build validation on every shell or extraction change.
   - The build is still catching stale imports and updater-contract drift that focused tests do not necessarily surface.

### Handoff

```text
STATUS
- Frontend decomposition is wrapped: the last layout-tab shell now lives in a dedicated section component.
- The branch is green on the focused SettingsPanel suite and build:wp.

START HERE NEXT
- Move back to the remaining Phase 23 parity/consolidation tracks.
- Treat further SettingsPanel decomposition as out-of-scope unless a genuinely new inline subtree appears.
```

## Entry - 2026-03-29 11:07:01 UTC

### Snapshot

- The campaign settings tab now exposes live gallery override summaries plus an inline inherited-reset path instead of hiding that state entirely behind the shared responsive editor.
- Unified and per-type viewer sections now consume a shared campaign gallery render-plan path, so adapter resolution, wrapper props, tile-size projection, and layout-builder branching no longer diverge across two separate section implementations.
- The first focused run caught a summary-label regression for non-adapter scope customizations; the helper was tightened so the summaries describe actual adapter overrides versus deeper responsive-setting customizations correctly.

### Work Done

- Added inline campaign gallery override summary badges to `UnifiedCampaignModal`, including inherited-versus-custom state and a top-level `Use Inherited Gallery Settings` action for fast reset without reopening the shared editor.
- Expanded the campaign override summary helper so non-adapter nested overrides surface as responsive-setting customizations rather than being misreported as adapter-choice changes.
- Added shared `campaignGalleryRenderPlan` utilities that resolve section media, effective settings, wrapper backgrounds, border radii, tile-size projection, and per-type equal-height state for campaign viewer sections.
- Added `CampaignGalleryAdapterRenderer` and rewired `UnifiedGallerySection` plus `PerTypeGallerySection` to use the shared render-plan/adapter-render path instead of keeping duplicate layout-builder and adapter rendering branches in both section files.

### Validation Run

- Focused frontend suite passed:
  - `src/utils/campaignGalleryOverrides.test.ts`
  - `src/components/Campaign/UnifiedCampaignModal.test.tsx`
  - `src/utils/campaignGalleryRenderPlan.test.ts`
  - `src/components/CardViewer/GallerySections.test.tsx`
  - `src/components/CardViewer/CampaignViewer.test.tsx`
  - `src/utils/resolveAdapterId.test.ts`
  - result: 21 suites passed, 70 tests passed
- Production build passed:
  - `npm run build:wp`

### Assessment

- P23-G moved past basic shared-editor parity into better inheritance-first UX: campaign editors can now see and clear custom gallery state from the top-level settings surface instead of only from inside the modal.
- P23-H now has a materially more centralized section render path: unified/per-type section planning and adapter rendering are shared rather than being reassembled in parallel implementations.
- Remaining G/H work is now narrower: final parity coverage, any last-mile viewer-shell cleanup, and persistence/UX edges discovered during broader end-to-end verification.

### Recommended Next Slice

1. Continue with final render-parity and campaign persistence edges.
   - The remaining leverage is in end-to-end parity gaps, not more structural refactoring of already-shared section planning.

2. Keep focused resolver/viewer/campaign tests paired with `build:wp`.
   - This slice again showed that small summary/helper changes can regress behavior in ways the UI alone does not immediately reveal.

### Handoff

```text
STATUS
- Campaign settings now surface live gallery override state plus an inline inherited reset path.
- Viewer sections now share a central render-plan and adapter-render path.
- The branch is green on the focused G/H suite and build:wp.

START HERE NEXT
- Keep pushing the remaining campaign parity and render-path endgame rather than returning to decomposition work.
- Treat remaining G/H work as parity/persistence verification and final viewer-shell cleanup, not section-level resolution refactors.
```