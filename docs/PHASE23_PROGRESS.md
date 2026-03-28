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