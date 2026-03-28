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