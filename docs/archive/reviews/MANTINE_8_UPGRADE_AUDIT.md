# Mantine 8 Upgrade Audit

**Status:** Audit complete
**Created:** May 6, 2026
**Goal:** Move from Mantine `7.17.8` to Mantine `8.x` without changing the React `18.3.1` baseline, while unlocking newer component `attributes` support for better DevTools traceability.

---

## Executive Summary

- The current baseline is React `18.3.1` with Mantine `7.17.8`.
- Mantine `8.x` supports both React `18` and React `19`, so this upgrade can be done now without coupling it to the later React `19` work.
- The repo is a good candidate for a Mantine `8` upgrade. I did not find runtime usage of `@mantine/dates`, `@mantine/carousel`, or CSS selectors that rely on Mantine `7`'s removed `data-hovered` behavior.
- The main risk is not broad API churn. The real risk is the repo's custom shadow-DOM, portal, modal, drawer, popover, and z-index behavior.
- Recommendation: target the latest Mantine `8.3.x` line, use a compatibility-first rollout, and treat overlay/shadow-DOM QA as the primary gate.

### Decision Snapshot

1. Commit the current debug-marker rollout before the Mantine `8` branch.
2. Keep the first Mantine `8` pass compatibility-first visually.
3. Keep `@mantine/dates` for future scheduled-campaign date pickers.
4. Limit the first post-upgrade `attributes` rollout to `Modal` and `Drawer`.

### Why Mantine 8 is the right immediate target

1. It keeps the React `18` baseline intact.
2. It unlocks the `attributes` capability introduced in Mantine `8.2.0`, which is directly relevant to the current DevTools visibility initiative.
3. It avoids mixing two risk sources in one branch: Mantine major changes and React major changes.

---

## Current Baseline

### Dependency baseline

- `react` and `react-dom`: `^18.3.1`
- Mantine packages: `^7.17.8`
  - `@mantine/core`
  - `@mantine/dates`
  - `@mantine/form`
  - `@mantine/hooks`
  - `@mantine/modals`
  - `@mantine/notifications`

### Provider and theming baseline

- `src/main.tsx` mounts `MantineProvider` with:
  - `cssVariablesSelector={isShadowDom ? ':host' : ':root'}`
  - `getRootElement()` wired to either the shadow host or `document.documentElement`
- `src/main.tsx` imports `@mantine/core/styles.css`, which remains valid in Mantine `8`.
- `src/themes/adapter.ts` generates a substantial custom theme layer on top of Mantine defaults.
- `src/test/test-utils.tsx` uses `MantineProvider` with `env="test"`, so test harness compatibility also needs verification.

### Overlay and portal baseline

- `src/components/Admin/SettingsPanel.tsx` uses `Drawer` with `withinPortal={false}` and explicit z-index and body styling.
- `src/components/Common/ModalSelect.tsx` forces `comboboxProps.withinPortal = false`.
- `src/components/Common/ModalColorInput.tsx` forces `popoverProps.withinPortal = false`.
- `src/components/Admin/ThemeSelector.tsx` and `src/components/Settings/DimensionInput.tsx` also keep comboboxes inside the current tree.
- `src/components/Galleries/Shared/Lightbox.tsx` uses Mantine `Portal` directly.
- Popover-heavy surfaces include `InContextEditor`, `MediaUsageBadge`, access management comboboxes, and floating auth/admin menus.

---

## Audit Findings

## Finding A - React 18 can remain in place

### Evidence

- Published Mantine `8.x` peer dependencies allow `react` and `react-dom` on `^18.x || ^19.x`.

### Assessment

This is the key reason to do Mantine `8` now and defer Mantine `9`. There is no React-major dependency blocker for Mantine `8`.

### Recommendation

Upgrade Mantine independently from React. Do not fold React `19` into the same branch.

---

## Finding B - The repo is not heavily exposed to Mantine 8 API breakage

### Evidence

- `@mantine/core/styles.css` is already the import path in `src/main.tsx`, and Mantine `8` keeps that path working.
- No runtime usage of `@mantine/dates` components was found in `src/**`.
- No runtime usage of `@mantine/carousel` was found in `src/**`.
- No `data-hovered` selector usage was found in the app code.

### Assessment

This does not look like a migration dominated by mechanical prop renames. Most of the work should be validation and a smaller set of targeted fixes.

### Recommendation

Treat this as a compatibility and QA project, not a mass JSX rewrite.

---

## Finding C - Overlay and shadow-DOM behavior are the real risk surface

### Evidence

- The app supports both normal DOM and shadow-DOM mounting.
- The provider uses custom `cssVariablesSelector` and `getRootElement` behavior.
- Multiple components intentionally suppress portals to keep dropdowns and popovers inside active modal or shadow trees.
- The repo has several stacked overlay flows: settings drawer, campaign viewer, gallery config editor, media modals, auth menus, popovers, and the lightbox.

### Assessment

This is the highest-risk track. Mantine `8` changes some overlay defaults that could surface regressions even when the code still typechecks.

### Relevant Mantine 8 behavior changes

- `Portal` now enables `reuseTargetNode` by default.
- `Popover` enables `hideDetached` by default.
- `Switch` visual defaults changed to include a thumb indicator.
- `SegmentedControl` and some scroll-area behavior changed subtly.

### Recommendation

Do not preemptively add broad compatibility shims. Upgrade first, then harden only the behaviors that actually regress in repo-specific QA.

---

## Finding D - Mantine 8 directly helps the DevTools visibility work

### Evidence

- The current debug-marker rollout was constrained by Mantine `7` not supporting the newer `attributes` pattern on key overlay components such as `Modal` and `Drawer`.
- The rollout already includes a helper that can support slot-level attribute maps later.
- Mantine `8.2.0+` adds the `attributes` capability that is relevant to this use case.

### Assessment

Mantine `8` is not just a dependency cleanup. It provides a concrete ergonomic benefit for the current debugging and introspection work.

### Recommendation

Use Mantine `8` as the point where overlay components gain first-class `data-wpsg-*` slot attributes instead of relying only on outer wrapper markers.

---

## Finding E - `@mantine/dates` is currently dead weight

### Evidence

- `@mantine/dates` is installed in `package.json`.
- No usage was found in `src/**`.
- Historical docs mention planned or earlier date-picker work, but that does not represent active runtime usage.

### Assessment

Keeping it is harmless, but it expands the dependency surface and invites unnecessary migration review.

### Recommendation

Keep `@mantine/dates` in the Mantine `8` branch because scheduled-campaign date pickers are planned work.

### Better alternative?

For this repo, not really. The only lower-surface-area option is native `date` or `datetime-local` inputs, which are easier to serialize but are a downgrade in consistency, validation ergonomics, and theming.

Because the app is already Mantine-based and already has `dayjs`, `@mantine/dates` remains the best fit unless the future scheduling UI needs advanced timezone handling that would justify a more specialized date stack.

---

## Recommended Plan

## Phase 1 - Stabilize the current baseline

1. Commit the current Mantine `7`-compatible debug-marker rollout first.
2. Keep that commit separate from the Mantine `8` branch.

### Reasoning

- The debug-marker work is already validated on the current stack.
- A separate commit makes it easier to distinguish existing app behavior from upgrade regressions.
- If Mantine `8` later lets some markers move from wrapper nodes to native component slots, that follow-up stays reviewable.

---

## Phase 2 - Upgrade dependencies only

1. Upgrade all Mantine packages together to the same latest `8.3.x` version.
2. Keep React on `18.3.1`.
3. Keep `@mantine/dates` and upgrade it with the rest of the Mantine packages.
4. Refresh the lockfile.

### Package targets

- `@mantine/core`
- `@mantine/dates`
- `@mantine/form`
- `@mantine/hooks`
- `@mantine/modals`
- `@mantine/notifications`

### Validation gate

- `npm run build`
- relevant Vitest suites for overlay wrappers, settings panel, and viewer flows

---

## Phase 3 - Resolve migration breakages

Focus only on issues that actually appear after the dependency bump.

### Highest-priority checks

1. `SettingsPanel` drawer layering, scrolling, and nested controls.
2. `ModalSelect`, `ModalColorInput`, `ThemeSelector`, and `DimensionInput` portal suppression.
3. `CampaignViewer` plus nested overlays and lightbox behavior.
4. `InContextEditor`, `MediaUsageBadge`, and auth/admin popovers.
5. Shadow-DOM theme scoping and notification rendering.
6. Test harness behavior with `MantineProvider env="test"`.

### Compatibility shims to consider only if needed

- Disable `Portal` `reuseTargetNode` globally if overlay stacking regresses.
- Disable `Popover` `hideDetached` globally if current dropdown behavior in scrollable regions must be preserved.
- Disable `Switch` `withThumbIndicator` if the new default looks out of place in the current UI.

---

## Phase 4 - Use Mantine 8 features deliberately

1. Upgrade the debug-marker rollout to use component `attributes` where Mantine `8.2+` now allows it.
2. Keep the existing helper API and extend usage incrementally.
3. Avoid rewriting all debug markers in the same commit as the package bump.

### Good first candidates

- `Modal`
- `Drawer`
- possibly other overlay or compound components where slot-level `data-wpsg-*` markers improve DevTools clarity

---

## Suggested QA Matrix

### Must-pass runtime checks

1. Standard DOM mount.
2. Shadow DOM mount.
3. Settings drawer with nested select and color input.
4. Campaign viewer with gallery adapter rendering.
5. Lightbox open, close, and z-index behavior.
6. Access tab combobox open, keyboard nav, and option selection.
7. In-context editor popover behavior.
8. Auth/admin floating menu behavior.

### Must-pass automated checks

1. `npm run build`
2. focused Vitest runs for:
   - modal-safe wrappers
   - settings panel
   - viewer/gallery overlay behavior
   - theme adapter and test utils

---

## Decisions Needed

## Decision 1 - Commit order for the current debug-marker rollout

### Options

- Commit it before the Mantine `8` work.
- Fold it into the Mantine `8` branch.

### Recommendation

Commit it first.

### Why

- Cleaner blame and rollback.
- Easier regression analysis.
- No need to mix a validated feature slice with dependency-upgrade noise.

---

## Decision 2 - Visual strategy on the first Mantine 8 branch

### Options

- Compatibility-first: preserve current visuals unless a change is intentional.
- Adopt Mantine `8` defaults wherever they differ.

### Recommendation

Compatibility-first.

### Why

- The repo already has a substantial custom theme system.
- The immediate goal is capability and maintainability, not a design refresh.
- It keeps QA focused on behavior, not subjective appearance drift.

---

## Decision 3 - What to do with `@mantine/dates`

### Options

- Remove it in the upgrade branch.
- Keep it installed for future analytics or scheduling work.

### Recommendation

Keep it for scheduled-campaign date pickers.

### Why

- There is already planned near-term usage for scheduled-campaign pickers.
- It is a better fit than introducing a second date-picker library.
- Native date inputs remain a fallback, but they are a UX and styling compromise rather than a better default.

---

## Decision 4 - Scope of the first `attributes` rollout after Mantine 8

### Options

- Minimal: upgrade only `Modal` and `Drawer` markers.
- Broader: expand `attributes` adoption across more Mantine compound components immediately.

### Recommendation

Minimal first.

### Why

- `Modal` and `Drawer` are the highest-value improvement points.
- It proves the pattern before expanding it.
- It keeps the post-upgrade diff reviewable.

---

## Final Recommendation

Proceed with a Mantine `8.3.x` upgrade on React `18`, using a compatibility-first strategy and separate commits for:

1. the already-validated debug-marker rollout,
2. the Mantine dependency bump and migration fixes,
3. the follow-up `attributes` enhancement pass.

That is the lowest-risk route that still unlocks the DevTools improvements you want now, while keeping the later Mantine `9` plus React `19` migration as a separate decision.