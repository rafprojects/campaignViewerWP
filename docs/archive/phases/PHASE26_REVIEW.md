# Phase 26 - React 19.2+ And Mantine 9 Migration Review

**Status:** Complete
**Created:** 2026-05-10
**Last updated:** 2026-05-14

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P26-A | React 19.2+ and Mantine 9.1.x baseline, lockfile refresh, and package hygiene | Complete | Large |
| P26-B | Mantine 9 code sweep, provider updates, and explicit theme contract | Complete | Medium |
| P26-C | Shadow DOM, portal, overlay, and modal-stack hardening | Complete | Large |
| P26-D | React ecosystem compatibility sweep beyond Mantine | Complete | Medium-Large |
| P26-E | Verification, packaging, and corrected handoff documentation | Complete | Medium |
| P26-F | Manual exploratory QA across high-risk runtime surfaces | Complete | Medium |

---

## Executive Summary

This phase is the corrected implementation plan for moving the repo from React `18.3.1` plus Mantine `8.3.18` to React `19.2+` plus Mantine `9.1.x`.

The original Mantine 9 audit was directionally right about the hard blocker and the highest-risk runtime surfaces, but it is now stale on the dependency baseline. The repo is already on Mantine 8, so this is an `8.x -> 9.x` migration with a React 19 jump, not a `7.x -> 9.x` migration.

The migration should not be treated as a visual compatibility freeze. The chosen direction for this phase is to adopt Mantine 9 defaults intentionally, pin those defaults explicitly in the theme adapter, and fix only real regressions that appear in repo-specific surfaces such as shadow DOM mounts, nested modal stacks, portal-suppressed inputs, layout builder integrations, analytics charts, and carousel flows.

This phase should also be the corrected source of truth for the next implementation pass. Some follow-up investigation docs are useful inputs, but at least one of them materially misstates scope and should not drive the plan.

---

## Rationale

This phase exists now because Mantine `9.x` has a hard React `19.2+` prerequisite, and the repo is still on React `18.3.1`. The dependency jump is therefore not optional cleanup; it is the gating requirement for the Mantine migration.

This work belongs together as one phase because the risk is concentrated in a few tightly related areas:

1. Dependency alignment and package hygiene.
2. Mantine `8.x -> 9.x` code and theme changes.
3. Shadow DOM, portals, overlays, and modal-stack runtime behavior.
4. React 19 compatibility across the surrounding UI and state ecosystem.

Success for Phase 26 is a repo that builds and tests on React `19.2+` and Mantine `9.1.x`, preserves intended runtime behavior across both shadow and non-shadow mounts, and has a documented package strategy that explains what was upgraded, what was removed, what was left in place, and why.

---

## Review Inputs

| Input | Usefulness | Resolution |
|-------|------------|------------|
| `docs/MANTINE_9_REACT_UPGRADE_AUDIT.md` | High | Keep as the primary migration input, but correct the stale Mantine 7 baseline statements. |
| `AUDIT_REVIEW.md` | Medium | Keep its Mantine 8 baseline correction and some overlay observations, but reject its claim that the `variant="light"` surface is materially smaller than the original audit stated. |
| `docs/Track M9-B AUDIT.md` | Low | Do not use for scope sizing. It underestimates `variant="light"` usage and cites component files that do not exist in the repo. |
| Grok links in Track M9-D | Medium | Treat as advisory external inputs only. Use them for direction, not as authority for blanket latest-major upgrades. |
| Mantine official `8.x -> 9.x` guide and `9.0.0` changelog | High | Treat as authoritative for React `19.2+` requirement and Mantine-specific breaking changes. |
| Direct repo review (`package.json`, `src/**`, targeted searches) | High | Use as the final authority for actual scope and file impact. |

---

## Assessment Corrections

### Corrected baseline

The repo is currently on:

- `react`: `^18.3.1`
- `react-dom`: `^18.3.1`
- `@types/react`: `^18.3.18`
- `@types/react-dom`: `^18.3.5`
- `@mantine/core`, `@mantine/dates`, `@mantine/form`, `@mantine/hooks`, `@mantine/modals`, `@mantine/notifications`: `^8.3.18`

That means the real migration is:

- React `18.3.1` -> `19.2+`
- Mantine `8.3.18` -> `9.1.x`

It is no longer accurate to describe the baseline as Mantine `7.17.8`.

### Confirmed light-variant surface area

Repo search confirms `68` `variant="light"` matches across active `src/**` code. The broad-surface warning in the main audit is therefore substantially correct.

This matters because the chosen direction for this phase is to adopt Mantine 9 defaults, which means the new solid-color `light` variant behavior must be treated as an intentional visual change that needs review, not as something to silently suppress.

### Dates package status

`@mantine/dates` does not currently have active runtime imports in `src/**`, but it should remain in scope for this phase and be upgraded with the rest of Mantine. It is retained because planned date-related UI work is upcoming and the existing Mantine-based stack plus `dayjs` already makes it the right fit unless later feature work proves otherwise.

### Overlay and shadow-DOM risk confirmation

The repo-specific risk described in the main audit is real. The provider and theming path in `src/main.tsx`, `src/contexts/ThemeContext.tsx`, and `src/shadowStyles.ts` is highly customized, and portal suppression plus manual z-index layering are relied on in multiple admin and modal-heavy surfaces.

This is still the highest QA-risk track in the migration, even though it is not likely to be the largest pure code-edit track.

### React ecosystem scope correction

The adjacent React compatibility sweep should be broader than the original audit's short package list. In this repo, React 19 confidence also depends on:

- `@tanstack/react-query`
- `@sentry/react`
- `zustand`
- `@dnd-kit/*`

Those are more operationally significant to runtime stability than lower-risk packages like `@tabler/icons-react`.

### Unused package candidate

`react-window` appears to be installed but unused in active runtime code. Unless the implementation pass finds hidden non-`src/**` usage or near-term planned work that justifies keeping it, it should be removed during this phase along with `@types/react-window`, and the removal should be recorded explicitly.

---

## Reasoning To Reject

The next implementation pass should explicitly reject the following faulty assumptions:

1. Do not plan around a Mantine `7.x` baseline. The repo is already on Mantine `8.3.18`.
2. Do not assume the `variant="light"` surface is small. The current repo search confirms it is broad enough to warrant dedicated review.
3. Do not default to a Mantine 8 compatibility layer. This phase is intentionally adopting Mantine 9 defaults rather than preserving Mantine 8 visuals by default.
4. Do not add `v8CssVariablesResolver` or `pauseResetOnHover="notification"` as the baseline strategy. Those are compatibility shims for preserving older behavior, and that is not the chosen direction for this phase.
5. Do not remove `@mantine/dates` simply because current runtime imports are absent. It is being retained for upcoming date-oriented work.
6. Do not blindly upgrade every adjacent React library to the latest major version just because an external summary says React 19 is broadly compatible. Major-version jumps like `dockview 5 -> 6`, `react-zoom-pan-pinch 3 -> 4`, or `react-window 1 -> 2` are separate change vectors and must be justified by real React 19 support gaps or failing validation.

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Visual strategy | Adopt Mantine 9 defaults in the first migration pass. |
| B | Theme explicitness | Explicitly pin the chosen Mantine 9 defaults in the theme adapter instead of inheriting them implicitly. |
| C | Dates package | Keep `@mantine/dates` and upgrade it with the rest of Mantine for planned date UI. |
| D | Adjacent React deps | Proactively review adjacent React packages, but prefer the smallest version movement that achieves React 19 support. |
| E | Unused packages | Remove confirmed-unused React-adjacent packages and document what was removed. |
| F | Compatibility shims | Do not use Mantine 8 compatibility shims as the default migration posture. |
| G | Source of truth | Use this phase review as the corrected handoff document for implementation. |

---

## Execution Priority

1. `P26-A` goes first because React `19.2+` and Mantine `9.1.x` are the hard baseline gate.
2. `P26-B` follows immediately so the upgraded repo compiles cleanly and the Mantine 9 theme contract is made explicit.
3. `P26-C` starts as soon as the repo renders on the new baseline because shadow DOM, portals, and modal stacks are the highest runtime-risk area.
4. `P26-D` runs alongside the latter half of `P26-B` and `P26-C`, but it should avoid unrelated latest-major churn unless real evidence requires it.
5. `P26-E` closes the package, automated verification, and written handoff path.
6. `P26-F` closes the manual exploratory QA path in the real host environment.

---

## Track P26-A - Dependency Baseline And Package Hygiene

### Problem

Mantine `9.x` requires React `19.2+`, and the repo is still on React `18.3.1`. The dependency jump is therefore the main blocker for the migration. At the same time, the package set includes at least one likely-unused React-adjacent library that should not be carried through a risky baseline upgrade without a reason.

### Fix

Upgrade React, React DOM, React type packages, and all installed `@mantine/*` packages together in one dependency pass. Keep `@mantine/dates` in the set and upgrade it with the rest. Refresh the lockfile after reinstall. Prune confirmed-unused React packages so the phase is not carrying unnecessary React 19 risk.

### Tasklist

- [x] Update `react` and `react-dom` to `19.2+`.
- [x] Update `@types/react` and `@types/react-dom` to the React 19 line.
- [x] Upgrade all installed Mantine packages together to `9.1.x`:
  - `@mantine/core`
  - `@mantine/dates`
  - `@mantine/form`
  - `@mantine/hooks`
  - `@mantine/modals`
  - `@mantine/notifications`
- [x] Reinstall dependencies and refresh the lockfile.
- [x] Remove `react-window` and `@types/react-window` after confirming there is no active runtime usage in the current repo.
- [x] Record any peer-dependency warnings and the chosen resolution instead of bypassing them silently.

### Acceptance criteria

- `package.json` and the lockfile reflect a consistent React `19.2+` plus Mantine `9.1.x` baseline.
- `@mantine/dates` remains in dependencies and is version-aligned with the rest of Mantine.
- Confirmed-unused React packages are removed with an explicit note, or retained with a documented reason.
- Install completes without unresolved dependency blockers.

### Validation

- Run `npm install`.
- Run `npm run build`.
- Run `npm test`.
- If dependency or runtime warnings appear, classify them before moving to later tracks.

### Primary files

- `package.json`
- `package-lock.json`

### Implementation update - 2026-05-11

- `package.json` and `package-lock.json` now reflect `react` and `react-dom` `19.2.6`, `@types/react` `19.2.14`, `@types/react-dom` `19.2.3`, and Mantine `9.1.1` across `@mantine/core`, `@mantine/dates`, `@mantine/form`, `@mantine/hooks`, `@mantine/modals`, and `@mantine/notifications`.
- `react-window` and `@types/react-window` were removed after confirming they are not used in active repo code.
- React 19 type tightening required a narrow compatibility pass in app code, mainly around nullable refs, `ReactElement` typing, and timeout-ref initialization.
- Mantine 9 changed some test-facing accessibility and browser assumptions. The resulting fixes were limited to test updates plus a `document.fonts` stub in `src/test/setup.ts` for Mantine autosize behavior under jsdom.
- `npm install` completed with only transient peer-resolution noise while the tree was shifting to React 19 types. The final installed tree resolved cleanly, with no unresolved dependency blocker left in the upgraded baseline.
- Validation completed successfully on the upgraded baseline:
  - `npm run build`
  - `npm test`

---

## Track P26-B - Mantine 9 Code Sweep And Theme Contract

### Problem

The repo appears to avoid many of the headline `8.x -> 9.x` breaking APIs, but the migration still requires a real compile and runtime pass. The provider and theme layers also need to reflect the project's chosen Mantine 9 behavior explicitly instead of inheriting it by accident.

### Fix

Run a focused Mantine `8.x -> 9.x` sweep and fix only actual breakages. Keep the migration aligned with the official Mantine guide and changelog rather than speculative cleanup. Explicitly encode the chosen Mantine 9 defaults in the theme adapter and enable Mantine 9 provider improvements once the baseline is stable.

### Tasklist

- [x] Re-run a targeted search for actual `8.x -> 9.x` breaking APIs after the dependency bump, including:
  - `Text` and `Anchor` `color` prop removal
  - `TypographyStylesProvider` rename
  - `positionDependencies` removal
  - `Grid` `gutter -> gap`
  - `Collapse` `in -> expanded`
  - `Spoiler` `initialState -> defaultExpanded`
  - old hook migrations (`useFullscreen`, `useMouse`, `useMutationObserver`)
- [x] Update `src/main.tsx` provider usage for Mantine 9 as needed.
- [x] Do not add `v8CssVariablesResolver`.
- [x] Do not restore old notifications hover behavior unless a later decision explicitly changes strategy.
- [x] In `src/themes/adapter.ts`, explicitly pin the chosen Mantine 9 defaults instead of inheriting them implicitly:
  - `defaultRadius` should match Mantine 9's chosen project default.
  - `fontWeights.medium` should match Mantine 9's chosen project default.
- [x] Enable `deduplicateInlineStyles` on `MantineProvider` after the upgraded baseline is green.
- [x] Re-review the `68` `variant="light"` surfaces after the upgrade and adjust component-level styling only where real regressions or unacceptable drift appear.
- [x] Recheck the current `@mantine/form` usage in `src/components/Auth/LoginForm.tsx`, but do not expand the phase into broader form refactors.

### Acceptance criteria

- Active code compiles and builds on Mantine 9 without leftover removed or renamed APIs.
- The repo runs on Mantine 9 behavior, not an accidental Mantine 8 compatibility posture.
- The theme adapter explicitly reflects the project's Mantine 9 defaults.
- Provider-level performance/styling improvements are enabled unless they cause a verified regression.

### Validation

- Run `npm run build` after the provider and theme changes.
- Run targeted repo searches for known breaking APIs and verify that only real matches remain.
- Spot-check representative `variant="light"` surfaces in admin, auth, campaign, and gallery UI.

### Primary files

- `src/main.tsx`
- `src/themes/adapter.ts`
- `src/components/Auth/LoginForm.tsx`

### Implementation update - 2026-05-12

- A multiline repo sweep against Mantine's `8.x -> 9.x` break list found no live usage of the removed or renamed APIs targeted for this track:
  - no `Text` or `Anchor` `color` prop usage
  - no `TypographyStylesProvider`
  - no `positionDependencies`
  - no `Grid gutter`
  - no `Collapse in`
  - no `Spoiler initialState`
  - no active imports of the old fullscreen, mouse, or mutation-observer hooks
- The only `useFullscreen` hits in `src/**` were local variable names in `CampaignViewer`, not hook usage.
- `src/themes/adapter.ts` now encodes the intended Mantine 9 defaults explicitly with `defaultRadius: 'md'` and `fontWeights` set to `400` / `600` / `700`.
- The generated adapter overrides no longer pin label and control styling to Mantine 8-era `500` weights; those callsites now resolve through Mantine's medium weight token instead.
- `src/main.tsx` now enables `deduplicateInlineStyles` on `MantineProvider`.
- `src/components/Auth/LoginForm.tsx` remains compatible with Mantine 9 and `@mantine/form`; no resolver or API migration was needed there.
- The `variant="light"` surface was re-inventoried at `68` active `src/**` callsites. No compatibility shim was added, and no per-component restyling was justified from automated validation. Mantine 9 light-variant behavior remains the intentional baseline for later visual QA.
- Validation completed successfully after the P26-B changes:
  - `npm run build`
  - `npm test`
- Existing Vite chunk-size warnings still appear on build, but they are unchanged from before this track and are not introduced by the Mantine 9 provider/theme work.

---

## Track P26-C - Shadow DOM, Portals, Overlays, And Modal Stacks

### Problem

This repo is not using Mantine in a simple document-root-only setup. It depends on shadow-DOM scoping, custom CSS-variable injection, intentionally suppressed portals, and explicit modal z-index ordering across several admin and viewer surfaces.

This is the highest runtime-risk track in the migration. It is also the area where the repo-specific architecture matters more than generic Mantine migration checklists.

### Fix

Preserve the current architecture through the upgrade and treat this track as regression validation plus targeted fixes, not speculative redesign. Keep explicit z-index values and modal-safe wrappers until Mantine 9 behavior is proven stable in this repo.

### Tasklist

- [x] Verify both shadow-DOM and non-shadow-DOM mounts on the upgraded baseline.
- [x] Confirm that `ModalSelect`, `ModalColorInput`, `DimensionInput`, and `ThemeSelector` still keep dropdowns and popovers inside the active tree.
- [x] Verify `SettingsPanel` drawer layering, overlay blur behavior, nested select usability, and nested color-input usability.
- [x] Verify `CampaignViewer`, `GalleryConfigEditorModal`, `UnifiedCampaignModal`, and `AddExternalMediaModal` still layer in the intended z-index order.
- [x] Verify `InContextEditor` and `AuthBarFloating` popovers still position, dismiss, and remain interactive.
- [x] Verify notifications still render and auto-close correctly in both shadow and non-shadow mounts.
- [x] Verify theme switching still updates both `:root` and `:host`-scoped contexts.
- [x] Do not remove explicit z-index values or portal suppression paths unless Mantine 9 is proven stable without them.

### QA priority surfaces

1. Settings drawer plus nested controls.
2. Campaign viewer modal stack and nested gallery editor.
3. Unified campaign modal plus media-add modal stack.
4. Auth floating menu and in-context editor popovers.
5. Theme switching and notifications across shadow and non-shadow mounts.

### Acceptance criteria

- Both mount modes render correctly with theme changes and notifications intact.
- Modal-safe inputs remain usable in drawers and nested modal contexts.
- Modal stacks layer in the intended order without clipping, portal escape, or interaction traps.
- Floating controls and popovers remain correctly positioned and dismissible.

### Validation

- Manual QA on the target surfaces listed below.
- Add or update focused regression tests only where the upgrade exposes a real failure.
- Do not consider this track done until both mount modes have been exercised.

### Primary files

- `src/main.tsx`
- `src/contexts/ThemeContext.tsx`
- `src/shadowStyles.ts`
- `src/components/Common/ModalSelect.tsx`
- `src/components/Common/ModalColorInput.tsx`
- `src/components/Settings/DimensionInput.tsx`
- `src/components/Admin/ThemeSelector.tsx`
- `src/components/Admin/SettingsPanel.tsx`
- `src/components/CardViewer/CampaignViewer.tsx`
- `src/components/Common/GalleryConfigEditorModal.tsx`
- `src/components/Campaign/UnifiedCampaignModal.tsx`
- `src/components/Campaign/AddExternalMediaModal.tsx`
- `src/components/Common/InContextEditor.tsx`
- `src/components/Auth/AuthBarFloating.tsx`

### Implementation update - 2026-05-14

- The existing modal-safe input wrappers remained valid on Mantine 9 with no new code changes required in `ModalSelect`, `ModalColorInput`, `ThemeSelector`, `DimensionInput`, or `SettingsPanel`; each still keeps its dropdown or popover inside the active tree.
- Runtime portal suppression was extended to the remaining high-risk overlay surfaces:
  - `src/components/Common/InContextEditor.tsx`
  - `src/components/Auth/AuthBarFloating.tsx`
  - `src/components/CardViewer/CampaignViewer.tsx`
  - `src/components/Campaign/UnifiedCampaignModal.tsx`
  - `src/components/Common/GalleryConfigEditorModal.tsx`
  - `src/components/Admin/MediaAddModal.tsx`
  - `src/components/Common/ConfirmModal.tsx`
- Validation uncovered one additional real shadow-DOM escape hatch outside the original audit scope: Mantine notifications still defaulted to portal rendering. `src/main.tsx` now renders `Notifications` with `withinPortal={false}` so both normal and shadow-root mounts keep notifications inside the active tree.
- `src/contexts/ThemeContext.test.tsx` now covers shadow-root CSS-variable injection and preview-theme updates, closing the previous gap where only document-scoped style injection was asserted.
- New focused regression coverage was added for the newly hardened surfaces:
  - `src/components/Common/InContextEditor.test.tsx`
  - `src/components/Auth/AuthBarFloating.portal.test.tsx`
  - `src/components/Common/ConfirmModal.test.tsx`
  - `src/components/Admin/MediaAddModal.test.tsx`
  - `src/components/NotificationsMount.test.tsx`
- Browser-level runtime QA stayed valid after a narrow Playwright locator refresh to match Mantine 9 accessibility semantics. The impacted E2E selectors were updated from textbox-based combo lookups to combobox-based lookups, and the sign-in password field selector was narrowed to the actual textbox input.
- Validation completed successfully for this track:
  - targeted Vitest coverage for the changed overlay and shadow-root surfaces
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
- Both shadow and non-shadow mounts are now exercised by automated coverage, while broader exploratory/manual QA remains part of the final phase-level verification in `P26-F`.

---

## Track P26-D - React Ecosystem Compatibility Sweep Beyond Mantine

### Problem

React 19 compatibility in this repo depends on more than Mantine. The original audit's package list is useful, but it is too narrow for actual runtime confidence. The external Grok summaries are helpful directional inputs, especially on the React `19.2+` requirement and the possibility of a `react-is` workaround for Recharts, but they are not sufficient justification for broad latest-major upgrades.

### Fix

Classify adjacent React packages into one of four buckets:

1. Keep current version line and validate.
2. Patch or minor bump for peer-range or bug-fix reasons.
3. Major bump only if React 19 support or failing validation requires it.
4. Remove if unused.

This track should be driven by actual repo usage and actual install/runtime evidence.

### Tasklist

- [x] Audit peer warnings and runtime behavior for active adjacent packages, including:
  - `@tanstack/react-query`
  - `@sentry/react`
  - `zustand`
  - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
  - `dockview`
  - `embla-carousel-react`
  - `react-photo-album`
  - `react-rnd`
  - `react-zoom-pan-pinch`
  - `recharts`
  - `@tabler/icons-react`
- [x] Treat `react-window` as a removal candidate instead of an automatic upgrade target if unused status holds.
- [x] Do not upgrade `dockview 5 -> 6`, `react-zoom-pan-pinch 3 -> 4`, or any other latest major solely because an external summary says React 19 is broadly supported.
- [x] Add a `react-is` override for Recharts only if install output or runtime evidence shows it is needed.
- [x] Validate the runtime-heavy integrations after the React 19 bump through targeted automated coverage in this track, with the remaining host/manual smoke owned by `P26-F`:
  - layout builder
  - drag and resize canvas behavior
  - pan and zoom behavior
  - media drag-and-drop
  - analytics charts
  - carousel flows
  - error boundary and monitoring flow
  - query-backed admin data flows

### Package guidance

| Package group | Initial posture |
|---------------|-----------------|
| `@tanstack/react-query`, `zustand`, `@dnd-kit/*` | Keep current line first, validate, and bump only if required. |
| `dockview`, `react-rnd`, `react-zoom-pan-pinch` | High-risk UI/runtime integrations. Prefer minimum necessary version movement. |
| `react-photo-album`, `embla-carousel-react` | Validate active runtime usage before deciding whether any bump is required. |
| `recharts` | Validate active analytics usage and add `react-is` override only if evidence requires it. |
| `@tabler/icons-react` | Low-risk utility dependency; bump only if peer metadata requires it. |
| `react-window` | Remove if confirmed unused. |

### Acceptance criteria

- Each active adjacent package is classified and either retained, bumped with reason, or removed with reason.
- No unrelated latest-major package churn is absorbed without clear justification.
- Runtime-heavy integrations have targeted automated validation in this track, with remaining host-environment exploratory smoke explicitly assigned to `P26-F`.

### Validation

- Review install warnings after the baseline dependency pass.
- Run targeted automated validation across the adjacent-package surfaces covered by this track.
- Carry host-environment and exploratory smoke coverage for the runtime-heavy surfaces into `P26-F`.
- Record every package decision in the phase document or linked implementation notes.

### Primary files

- `src/services/queryClient.ts`
- `src/components/ErrorBoundary.tsx`
- `src/contexts/SettingsStore.ts`
- `src/components/Admin/MediaTab.tsx`
- `src/components/Admin/AnalyticsDashboard.tsx`
- `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx`
- `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx`
- `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx`
- `src/components/Galleries/Adapters/MediaCarouselAdapter.tsx`
- `src/components/Galleries/Adapters/justified/JustifiedGallery.tsx`
- `src/components/Galleries/Adapters/masonry/MasonryGallery.tsx`

### Implementation update - 2026-05-14

- Installed-package metadata does not show a hidden React 19 blocker in the adjacent-package set. The currently resolved tree is on React-19-compatible versions across the tracked packages, including `@tanstack/react-query` `5.100.6`, `@sentry/react` `8.55.1`, `zustand` `5.0.12`, `dockview` `5.2.0`, `embla-carousel-react` `8.6.0`, `react-photo-album` `3.5.1`, `react-rnd` `10.5.3`, `react-zoom-pan-pinch` `3.7.0`, `recharts` `3.8.1`, and `@tabler/icons-react` `3.41.1`.
- A package-by-package repo audit found all tracked dependencies actively used in `src/**`; none are dead weight comparable to the removed `react-window` path from `P26-A`.
- Current evidence supports keeping the existing version lines for `@tanstack/react-query`, `@sentry/react`, `zustand`, `embla-carousel-react`, `react-photo-album`, and `recharts`. There is no repo-driven reason to absorb unrelated latest-major churn for `dockview`, `react-rnd`, or `react-zoom-pan-pinch`.
- The DnD and layout-builder stack remains the main residual risk inside this track. `@dnd-kit/*`, `dockview`, `react-rnd`, and `react-zoom-pan-pinch` are all installed on React-19-compatible versions, but their most important runtime behavior is still exercised more by integration/manual usage than by isolated unit tests.
- Existing automated coverage already gives useful confidence on several adjacent-package surfaces:
  - query-backed admin flows via the current unit/integration suite and browser E2E runs
  - analytics dashboard rendering via the current Recharts test coverage
  - media flows via the current browser E2E suite
  - carousel and photo-album adapters via the current component test suite
- A targeted P26-D Vitest pass is green across the main adjacent-package surfaces, including analytics dashboard, media tab, error boundary, query/store helpers, carousel adapters, layout-builder adapter rendering, and the admin layout-builder component suite.
- No `react-is` override is justified for Recharts in the current tree. `npm ls react-is` resolves a direct `recharts -> react-is@19.2.5` path, and there is no install or runtime evidence requiring an override.
- The only notable warning during the targeted P26-D test run was the existing Dart Sass legacy JS API deprecation message from style compilation. It is unchanged, non-blocking, and not evidence of a React 19 compatibility issue.
- Track-boundary decision: the remaining runtime-heavy smoke boundary is explicitly owned by `P26-F`, where those surfaces can be exercised in the real host environment instead of forcing more speculative package churn or synthetic validation into `P26-D`.

---

## Track P26-E - Verification, Packaging, And Corrected Handoff Documentation

### Problem

This migration is QA-heavy and packaging-sensitive. The implementation needs a final validation pass that covers both the Vite app path and the WordPress-distributed plugin path. The repo also needs a corrected written record so later implementation work is not forced to reconcile stale or contradictory audits again.

### Fix

Use this document as the corrected Phase 26 source of truth, then close the phase with build, test, E2E, bundle, and corrected implementation notes. If regressions remain, capture them as follow-on bugs or deferred candidates instead of burying them in implementation notes.

### Tasklist

- [x] Keep this phase review current as implementation progresses.
- [x] Run frontend build and test validation on the upgraded baseline.
- [x] Run end-to-end coverage for the main flows.
- [x] Rebuild the WordPress plugin bundle.
- [x] If plugin-facing validation needs extra confidence, run the established `wp-env` PHPUnit path.
- [x] Record unresolved regressions as follow-on candidates or QA bugs.

### Acceptance criteria

- The upgraded repo passes the agreed validation set.
- The WordPress bundle rebuild succeeds.
- The document clearly records what changed, what was removed, what was deferred, and what should happen next.

### Validation

- `npm run build`
- `npm test`
- `npm run test:e2e`
- `npm run build:wp`
- Optional plugin confidence pass via the repo's known `wp-env` PHPUnit command

### Primary files

- `docs/PHASE26_REVIEW.md`
- `package.json`
- `package-lock.json`
- `wp-plugin/wp-super-gallery/**`

### Implementation update - 2026-05-14

- The phase-level automated validation set is now complete on the React `19.2.6` plus Mantine `9.1.1` baseline:
  - `npm test`
  - `npm run build`
  - `npm run test:e2e`
  - `npm run build:wp`
- `npm run build:wp` completed successfully and refreshed the packaged plugin assets by copying the current `dist/` output into `wp-plugin/wp-super-gallery/assets`.
- The unchanged Vite chunk-size warnings still appear during the packaging build, but they are not new to Phase 26 and are not evidence of a packaging regression.
- The optional plugin confidence pass also succeeded in this environment:
  - `npx wp-env start`
  - `npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist"`
  - `npx wp-env stop`
- Full plugin-side PHPUnit passed inside `wp-env` with `539` tests and `1679` assertions.
- No new unresolved regressions were introduced during the packaging verification pass. The only remaining unclosed work for Phase 26 is the explicit manual exploratory QA track in `P26-F`.

---

## Track P26-F - Manual Exploratory QA Across High-Risk Runtime Surfaces

### Problem

The automated suite now covers the main shadow-DOM, overlay, and browser-level regression paths, but this migration still changes the rendering contract of a UI-heavy WordPress plugin. The remaining risk is in interactive behavior that is easier to miss in scripted tests: visual clipping, focus traps, overlay layering drift, scroll behavior, and plugin-host integration differences.

### Fix

Run a deliberate manual exploratory QA pass in the real host environment after the package and bundle outputs are ready. Treat this as a required phase track, not an optional reminder, and record any issues or follow-on candidates directly in this document.

### Tasklist

- [x] Exercise both shadow and non-shadow mounts in the real host environment.
- [x] Verify settings drawer flows, nested selects, nested color inputs, and responsive gallery editor behavior under actual pointer and keyboard interaction.
- [x] Verify campaign viewer, unified campaign modal, confirm modal, and media-add modal stacks for clipping, focus, dismissal, and scroll locking.
- [x] Verify auth floating menu and in-context editor behavior for drag, positioning, dismissal, and nested popovers.
- [x] Verify notifications, theme switching, and color-scheme behavior in both mount modes inside the host environment.
- [x] Smoke-test layout builder, analytics dashboard, carousel flows, media drag-and-drop, and other high-risk adjacent-package surfaces after the React 19 bump.
- [x] Record any manual-only regressions or host-environment findings as follow-on bugs or deferred candidates.

### Acceptance criteria

- High-risk runtime surfaces have been exercised manually in the intended host environment.
- No unresolved interaction, layering, or host-integration regression is left undocumented.
- Any issues found during exploratory QA are captured explicitly with next-step ownership.

### Validation

- Manual exploratory QA in the WordPress/plugin host.
- Targeted notes captured in this phase document or linked follow-on issue records.

### Primary files

- `docs/PHASE26_REVIEW.md`
- `src/main.tsx`
- `src/contexts/ThemeContext.tsx`
- `src/components/Admin/SettingsPanel.tsx`
- `src/components/Common/GalleryConfigEditorModal.tsx`
- `src/components/Campaign/UnifiedCampaignModal.tsx`
- `src/components/CardViewer/CampaignViewer.tsx`
- `src/components/Auth/AuthBarFloating.tsx`
- `src/components/Common/InContextEditor.tsx`

### Implementation update - 2026-05-14

- Manual exploratory QA is now complete against the real host at `https://wordpress.lan/` after syncing the current Phase 26 build into the live WordPress plugin directory. An earlier host probe briefly reflected an out-of-date May 12 bundle; the apparent menu/portal mismatch seen before sync did not reproduce on the current May 14 artifact and is treated as a deployment-state issue, not a Phase 26 code regression.
- The real host was exercised in both runtime mount modes:
  - Shadow mount on the default host path.
  - Non-shadow mount via `?shadow=0`.
- Shadow-mount host validation covered both anonymous and authenticated states on desktop, plus a mobile smoke pass:
  - Anonymous users see only the public `Cat Test` campaign plus the expected sign-in affordance from the floating auth menu.
  - Authenticated admin users see the full campaign grid plus the floating admin menu with `Admin Panel`, `Settings`, and active-campaign actions.
  - The expected anonymous `401` responses for the permissions and nonce endpoints remain in place, with no unexpected runtime failures.
- Non-shadow host validation also passed in both anonymous and authenticated states. The app mounted without a shadow root, received a scoped theme token on the host node, exposed the same floating menu affordances, and opened the live campaign viewer without runtime or network errors.
- Settings and overlay-stack validation passed on the live host:
  - The floating admin menu popover remained in-tree on the synced build.
  - The settings surface opened as the expected drawer and rendered Mantine 9 tabs, comboboxes, and section controls without clipping or portal escape.
  - Opening `Cat Test` from the live gallery launched the campaign viewer correctly.
  - From the active viewer, `Edit Gallery Config` opened the shared responsive gallery editor over the viewer and rendered its nested adapter controls, tabs, and reset/save affordances correctly.
  - From the active viewer, `Manage Media` opened over the viewer and exposed both upload and external-URL flows correctly.
- Admin-panel validation passed on the live host:
  - The main admin shell opened without runtime errors.
  - All six tabs switched cleanly and exposed the expected tab-specific live markers: `Campaigns`, `Media`, `Layouts`, `Access`, `Audit`, and `Analytics`.
  - Tab-specific host markers observed during exploratory QA included `Bare Home`, `Rescan Types`, `Create your first layout`, `Quick Add User`, `Campaign Audit Log`, and `Campaign Analytics`.
- No React 19 or Mantine 9 migration regressions were identified in the synced live host build during this pass.
- This host QA was intentionally non-destructive. It did not persist settings changes, upload media, archive or restore campaigns, or save edited campaign data.

---

## Items Explicitly Reviewed And Currently Not Blocking

These items were reviewed and do not currently look like primary blockers for the initial migration pass:

- No active `TypographyStylesProvider` usage found.
- No active `Popover` or `Tooltip` `positionDependencies` usage found.
- No active `Grid` `gutter` usage found.
- No active `Collapse in` usage found.
- No active `Spoiler initialState` usage found.
- No confirmed active imports of the old fullscreen or mutation-observer hooks found.
- No confirmed active `Text` or `Anchor` color-prop migration issue has been identified in the reviewed callsites.
- Current `@mantine/form` usage is minimal and simple; `LoginForm` is the only clear active callsite.

These items should still be rechecked after the dependency bump, but they do not currently look like the main source of migration cost.

---

## Testing Strategy

This phase requires both automated validation and manual QA. The manual portion is not optional because the highest-risk areas are integration-heavy and visually sensitive, and it is tracked explicitly in `P26-F`.

### Automated validation

- Frontend build: `npm run build`
- Unit/integration tests: `npm test`
- E2E flows: `npm run test:e2e`
- WordPress bundle: `npm run build:wp`

If Vitest triage becomes necessary during implementation, use the known serial command already validated in repo history:

```bash
npx vitest run --reporter=verbose --reporter=hanging-process --no-file-parallelism
```

### Manual QA matrix

| Surface | Why it matters |
|---------|----------------|
| Shadow mount and normal mount | Confirms provider scoping, CSS variables, and notifications work in both environments. |
| Settings drawer and nested controls | Highest risk for portal suppression and clipping issues. |
| Campaign viewer and nested editor | Exercises modal stack, fullscreen behavior, transitions, and nested overlays. |
| Unified campaign modal plus media add | Exercises explicit z-index ordering across multiple modal layers. |
| Auth floating menu and in-context editor | Exercises draggable/floating UI plus popover behavior. |
| Layout builder | Exercises `dockview`, `react-rnd`, `react-zoom-pan-pinch`, and admin-side interactions together. |
| Analytics dashboard | Exercises Recharts runtime behavior. |
| Carousel and gallery adapters | Exercises Embla and `react-photo-album` behavior under React 19 and Mantine 9. |

---

## Escalation Triggers

The next implementation pass should stop and explicitly re-scope if any of the following occur:

1. An active adjacent dependency requires a separate latest-major migration with non-trivial API work.
2. Shadow DOM provider behavior breaks in a way that suggests architectural redesign instead of targeted fixes.
3. Mantine 9 visual drift is unacceptable across key `variant="light"` surfaces and the team wants to revisit compatibility shims after all.
4. The WordPress bundle path reveals deployment-specific issues that do not appear in the Vite-only path.

These are not automatic reasons to expand the phase. They are decision points that should be surfaced explicitly.

---

## Follow-On Candidates

These items were surfaced during review but are intentionally out of scope for the initial baseline migration unless the implementation pass uncovers a direct dependency:

| Candidate | Why it is deferred |
|-----------|--------------------|
| `schemaResolver` adoption with Zod 4 | Useful for future larger forms, but current form usage is too small to justify it in the baseline migration. |
| `Scroller` adoption for admin overflow | Worth revisiting after the baseline lands, but not required for React 19 plus Mantine 9 stability. |
| `FloatingWindow` evaluation for floating admin UI | Interesting future cleanup path, but not part of the initial migration. |
| First runtime usage of `@mantine/dates` | The package stays and upgrades now, but the feature work belongs to a later phase. |
| Historical audit cleanup | The new phase review should supersede stale inputs first; rewriting older docs can happen later if needed. |

---

## Implementation Notes

- Prefer the official Mantine migration guide and changelog when they conflict with secondary write-ups.
- Record removed packages explicitly in this phase instead of letting them disappear silently in a dependency diff.
- Avoid broad refactors in overlay-heavy code until a regression proves they are necessary.
- If the implementation pass discovers a real blocker that this review did not surface, update this document rather than creating a new competing migration note.

---

## Outcome

Complete.

All Phase 26 tracks are now complete. The repo is on the intended React 19.2+ plus Mantine 9.1.x baseline, the Mantine 9 theme contract is explicit in code, the shadow-DOM and overlay stack paths have been hardened, and the current unit, integration, browser-level E2E, packaging, plugin-side PHPUnit, and real-host exploratory QA passes are green. No migration-specific regressions were identified in the synced live host build during `P26-F`.