# Mantine 9.1+ React Upgrade Audit

**Status:** Audit Complete (Pass 1 - static source review)
**Created:** May 6, 2026
**Reviewed scope:** `package.json`, `src/**` React/Mantine usage, Mantine `7.x -> 8.x` and `8.x -> 9.x` migration guides, Mantine `9.0` and `9.1` changelogs

---

## Executive Summary

- The current baseline is `React 18.3.1` plus Mantine `7.17.8`. Mantine `9.1+` requires `React 19.2+`, so the dependency jump is a hard prerequisite, not an optional cleanup.
- The codebase is in better shape than a typical Mantine `7 -> 9` migration. I did **not** find usage of several documented breaking APIs, including `Grid gutter`, `Collapse in`, `Spoiler initialState`, `TypographyStylesProvider`, `positionDependencies`, or the old fullscreen/mouse/mutation-observer hooks.
- The real migration risk is concentrated in two repo-specific areas:
  1. Wide visual surface area that depends on Mantine defaults and `variant="light"` usage.
  2. Custom shadow DOM, portal, dropdown, modal, and z-index behavior layered on top of Mantine.
- Conclusion: this upgrade is feasible, but it is not a low-risk package bump. The main work is dependency alignment, visual compatibility choices, and focused runtime QA rather than a large JSX prop-rename sweep.

### Tracks

| Track | Description | Necessity | Status | Effort |
|-------|-------------|-----------|--------|--------|
| M9-A | React 19.2+ and Mantine 9.1 dependency baseline | Necessary | Pending | Large |
| M9-B | Freeze or intentionally adopt Mantine 9 visual and behavioral defaults | Necessary | Pending | Medium |
| M9-C | Validate and harden shadow DOM, overlay, portal, and modal-stack behavior | Necessary | Pending | Large |
| M9-D | Run a React 19 compatibility sweep across the surrounding React ecosystem | Necessary | Pending | Medium |
| M9-E | Enable Mantine 9 provider and styling improvements | Preferred | Proposed | Small-Medium |
| M9-F | Adopt targeted Mantine 9 features where they simplify current code | Preferred | Proposed | Small-Medium |

---

## Method

This pass was a static audit, not a live migration branch. Findings are based on:

1. Direct review of `package.json` and Mantine usage in `src/**`.
2. Official Mantine `7.x -> 8.x` and `8.x -> 9.x` migration guides.
3. Mantine `9.0` and `9.1` changelog review.
4. File-level review of the repo's provider setup, theme system, modal wrappers, and overlay-heavy screens.

No Mantine `9.1` install, build, or runtime test was performed in this pass. Any item below that is validation-heavy should be treated as an upgrade-branch task, not as already-verified behavior.

---

## Track M9-A - React 19.2+ and Mantine 9.1 Dependency Baseline

### Problem

`package.json` is still on `React 18.3.1` and Mantine `7.17.8`. Mantine `9.1+` has a hard peer dependency on `React 19.2+`.

### Current evidence

- `react` and `react-dom` are `^18.3.1`.
- All installed Mantine packages are `^7.17.8`:
  - `@mantine/core`
  - `@mantine/dates`
  - `@mantine/form`
  - `@mantine/hooks`
  - `@mantine/modals`
  - `@mantine/notifications`
- React type packages are still on the React 18 line:
  - `@types/react`
  - `@types/react-dom`

### Why this is necessary

Mantine `9.1+` cannot be adopted cleanly until the app is moved to React `19.2+`. This is the highest-confidence hard blocker in the entire audit.

### Required changes

1. Upgrade `react` and `react-dom` to `19.2+`.
2. Upgrade `@types/react` and `@types/react-dom` to the React 19 line.
3. Upgrade every installed Mantine package together to the same `9.1.x` version.
4. Refresh the lockfile and rerun typecheck, unit tests, and the main build.

### Actionable tasklist

- [ ] Upgrade `react` and `react-dom` to `19.2+`.
- [ ] Upgrade `@types/react` and `@types/react-dom` to `19.x`.
- [ ] Upgrade `@mantine/core`, `@mantine/dates`, `@mantine/form`, `@mantine/hooks`, `@mantine/modals`, and `@mantine/notifications` to the same `9.1.x` version.
- [ ] Reinstall dependencies and regenerate the lockfile.
- [ ] Run `npm run build`.
- [ ] Run `npm run test`.
- [ ] Rebuild the WordPress plugin bundle and smoke-test the hosted app path.

---

## Track M9-B - Visual and Behavioral Compatibility Strategy

### Problem

The repo already avoids most documented JSX prop removals, but it has a broad visual surface area that depends on Mantine defaults and on `variant="light"`.

### Current evidence

- `variant="light"` appears in **68** JSX locations across admin, auth, gallery, and campaign-viewer surfaces.
- `MantineProvider` in `src/main.tsx` is mounted without Mantine `9` compatibility toggles.
- The custom theme adapter in `src/themes/adapter.ts` defines colors, spacing, radius scales, and component overrides, but it does **not** pin `defaultRadius` or `fontWeights`.
- Notifications are mounted as plain `<Notifications />` with default behavior.

### Why this is necessary

Mantine `9` changes several defaults that may not fail compilation but will change behavior or visuals across the app:

- `theme.defaultRadius` changes from `sm` to `md`
- medium font weight moves from `500` to `600`
- `light` variant uses solid values instead of transparency-based values
- notifications pause all visible timers on hover by default instead of only the hovered notification

Because the app leans heavily on `light` badges, alerts, buttons, and action icons, these default changes will be visible immediately.

### Recommended approach

Use a compatibility-first strategy on the first upgrade branch, then deliberately remove compatibility shims later if the new Mantine 9 visual language is desired.

### Changes to consider

- Set `defaultRadius: 'sm'` if preserving the current shape language matters.
- Set `fontWeights: { medium: '500' }` if preserving current label/control weight matters.
- Use `v8CssVariablesResolver` at `MantineProvider` if current transparent `light` surfaces should remain close to the current app during the migration window.
- Set `pauseResetOnHover="notification"` on `<Notifications />` if current per-notification hover behavior should remain unchanged.

### Actionable tasklist

- [ ] Decide whether the first Mantine 9 branch should preserve current visuals or adopt Mantine 9 defaults immediately.
- [ ] If preserving visuals, add `defaultRadius: 'sm'` to the generated Mantine theme.
- [ ] If preserving visuals, add `fontWeights: { medium: '500' }` to the generated Mantine theme.
- [ ] If preserving visuals, add `v8CssVariablesResolver` to `MantineProvider`.
- [ ] If preserving current notification behavior, set `pauseResetOnHover="notification"` on `<Notifications />`.
- [ ] Re-review the 68 `variant="light"` surfaces after the upgrade, with extra focus on badges, alerts, action icons, and secondary buttons.

### Primary files to spot-check

- `src/main.tsx`
- `src/themes/adapter.ts`
- `src/App.tsx`
- `src/components/Admin/AccessTab.tsx`
- `src/components/Admin/AdminPanel.tsx`
- `src/components/Campaign/UnifiedCampaignModal.tsx`
- `src/components/Galleries/Shared/Lightbox.tsx`
- `src/components/Common/TypographyEditor.tsx`

---

## Track M9-C - Shadow DOM, Portals, Overlays, and Modal Stacks

### Problem

This app does not use Mantine in a default document-root-only configuration. It depends on custom shadow-DOM theming, intentionally suppressed portals, and explicit modal/dropdown stacking.

### Current evidence

- `src/main.tsx` configures `MantineProvider` with `cssVariablesSelector` and `getRootElement` so Mantine state and CSS variables can target either `:root` or `:host`.
- `src/contexts/ThemeContext.tsx` injects custom theme CSS variables into either a shadow root or a scoped style tag in `document.head`.
- `src/shadowStyles.ts` inlines Mantine core and notifications styles into shadow roots.
- `src/components/Common/ModalSelect.tsx` forces `comboboxProps.withinPortal = false`.
- `src/components/Common/ModalColorInput.tsx` forces `popoverProps.withinPortal = false`.
- `src/components/Settings/DimensionInput.tsx` and `src/components/Admin/ThemeSelector.tsx` also force comboboxes to remain inside the active tree.
- `src/components/Admin/SettingsPanel.tsx` uses `withinPortal={false}`, explicit `zIndex`, `overlayProps`, `scrollAreaComponent`, and body styling on a `Drawer`.
- `src/components/CardViewer/CampaignViewer.tsx` applies custom `Modal` header/content/body styles and custom transitions.
- `src/components/Common/InContextEditor.tsx` and `src/components/Auth/AuthBarFloating.tsx` rely on Popover positioning plus custom dropdown styling.
- `src/components/Common/GalleryConfigEditorModal.tsx`, `src/components/Campaign/UnifiedCampaignModal.tsx`, `src/components/Campaign/AddExternalMediaModal.tsx`, `src/components/Admin/MediaAddModal.tsx`, and related modals rely on explicit z-index ordering.

### Why this is necessary

The official migration guides do not point to one mandatory rewrite here, but this repo is heavily invested in exactly the Mantine areas that tend to surface runtime regressions on major upgrades:

- portals
- overlays
- floating positioning
- nested modal stacks
- shadow-root CSS scoping

This is the highest QA-risk area in the codebase even though it is not the largest mechanical refactor area.

### Expected shape of the work

This track is primarily validation plus targeted fixes, not a blanket API rewrite.

### Actionable tasklist

- [ ] Upgrade on a feature branch and smoke-test both shadow DOM and non-shadow DOM mounts.
- [ ] Verify `ModalSelect`, `ModalColorInput`, `ThemeSelector`, and `DimensionInput` still suppress portals correctly.
- [ ] Verify `SettingsPanel` opens above the active campaign/admin layer and that nested selects and color inputs remain usable.
- [ ] Verify `CampaignViewer`, `GalleryConfigEditorModal`, `UnifiedCampaignModal`, and `MediaAddModal` still layer in the intended z-index order.
- [ ] Verify `InContextEditor` and `AuthBarFloating` popovers still position, dismiss, and trap interaction correctly.
- [ ] Verify notifications still render correctly for both shadow-root and normal DOM mounts.
- [ ] Verify theme switching still updates both `:root` and `:host` scoped mounts.

### QA priority surfaces

1. Settings drawer and its nested controls.
2. Campaign viewer modal, including in-context editor popovers.
3. Gallery config editor, unified campaign modal, and manage-media modal stack.
4. Auth floating menu.
5. Access-tab combobox search and all modal-safe select/color-input wrappers.
6. Theme switching and notifications inside shadow DOM mounts.

---

## Track M9-D - React 19 Compatibility Sweep Beyond Mantine

### Problem

Mantine `9.1+` forces the repo onto React `19`, but Mantine is not the only React-heavy dependency in this workspace.

### Current evidence

From `package.json`, the surrounding React-adjacent surface includes:

- `dockview`
- `embla-carousel-react`
- `react-photo-album`
- `react-rnd`
- `react-window`
- `react-zoom-pan-pinch`
- `recharts`
- `@tabler/icons-react`

### Why this is necessary

Even if Mantine itself upgrades cleanly, the React `19` bump can still be blocked or destabilized by peer dependency or lifecycle issues in adjacent UI packages.

### Actionable tasklist

- [ ] Check each React-adjacent dependency for React 19 support.
- [ ] Update packages that are still pinned to React 18 peer ranges.
- [ ] Re-run carousel, layout builder, analytics, lightbox, and admin-media flows after the React 19 bump.
- [ ] Pay extra attention to `react-window`, `react-rnd`, `dockview`, and `react-zoom-pan-pinch`, since they tend to be sensitive to lifecycle and rendering changes.

### Notes
- Analysis shows these packages should be compatible with React 19 with minimal issues: https://grok.com/share/bGVnYWN5_94a92f08-74f8-4a89-bdb9-68e87d8716cd
- We *should* upgrade to React 19.2+ as Mantine has issues with versions prior to 19.2: https://grok.com/share/bGVnYWN5_86c38f2a-9229-4a7d-9304-a75345a0982f

---

## Track M9-E - Preferred Provider and Styling Improvements

### Opportunity E1 - Enable `deduplicateInlineStyles`

**Necessity:** Preferred

Mantine `9.1` adds `deduplicateInlineStyles` on `MantineProvider`. That is relevant here because the repo uses responsive style props across many high-traffic surfaces, including `CampaignCard`, `CardGallery`, `CampaignViewer`, `MediaLibraryPicker`, `MediaTab`, `AnalyticsDashboard`, `UnifiedCampaignModal`, and `AccessTab`.

This is a good fit for the codebase because the upgrade already requires React `19`, which is the environment where this optimization matters.

**Actionable tasklist**

- [ ] Enable `deduplicateInlineStyles` on `MantineProvider` after the React 19 + Mantine 9 jump.
- [ ] Compare heavy pages before and after enabling it, especially `CampaignViewer`, `CardGallery`, and the admin tabs.

### Opportunity E2 - Make compatibility defaults explicit instead of relying on Mantine defaults

**Necessity:** Preferred, but strongly recommended

The custom theme adapter already owns a large amount of design behavior. Explicitly setting `defaultRadius` and `fontWeights` will make future Mantine upgrades less surprising, even if the team eventually decides to keep Mantine 9's defaults.

**Actionable tasklist**

- [ ] Add explicit `defaultRadius` once the team decides whether the current or Mantine 9 radius language is preferred.
- [ ] Add explicit `fontWeights` once the team decides whether the current or Mantine 9 weight language is preferred.
- [ ] Treat these as deliberate design choices, not as inherited library defaults.

### Opportunity E3 - Remove unused Mantine packages if they are truly dead

**Necessity:** Preferred

`@mantine/dates` is installed, but no React usage was found in `src/**` during this pass. Keeping an unused Mantine package is harmless, but trimming dead packages reduces the upgrade surface and future maintenance cost.

**Actionable tasklist**

- [ ] Confirm whether `@mantine/dates` is used outside `src/**` or reserved for imminent work.
- [ ] If not, remove it from dependencies instead of carrying it through the upgrade.

---

## Track M9-F - Targeted Mantine 9 Features That Fit This Repo

### Opportunity F1 - `schemaResolver` with Zod 4

**Necessity:** Preferred

The repo already depends on Zod 4, but current Mantine form usage is minimal and simple. If more admin/settings forms move onto Mantine form state in the future, Mantine 9's built-in `schemaResolver` support is a good fit and removes the need for dedicated resolver packages.

**Actionable tasklist**

- [ ] Keep the current simple `LoginForm` implementation as-is during migration.
- [ ] Use `schemaResolver` only when larger forms are moved to schema-driven validation.

### Opportunity F2 - `Scroller` for horizontal overflow surfaces

**Necessity:** Preferred

The admin UI currently uses manual horizontal overflow patterns such as `Tabs.List` with `overflowX: auto` and `flexWrap: nowrap`. Mantine 9 `Scroller` could improve these surfaces if the admin chrome keeps growing.

**Actionable tasklist**

- [ ] Re-evaluate `AdminPanel` tab overflow after the Mantine 9 migration.
- [ ] If the current horizontal overflow UX still feels cramped, test `Scroller` on tabs or chip rows.

### Opportunity F3 - `FloatingWindow` or `use-floating-window` for draggable utility UI

**Necessity:** Preferred and speculative

`AuthBarFloating` currently implements its own draggable fixed-position behavior. Mantine 9 adds first-class floating-window primitives that could eventually reduce bespoke pointer handling if that control becomes more complex.

**Actionable tasklist**

- [ ] Do not refactor `AuthBarFloating` as part of the initial migration.
- [ ] Revisit Mantine `FloatingWindow` only if the floating admin affordance continues to expand in scope.

---

## Items Explicitly Reviewed and Currently Not Blocking

These migration-guide items do **not** appear to create current work in `src/**`:

- No `Grid gutter` usage found.
- No `Collapse in` usage found.
- No `Spoiler initialState` usage found.
- No `TypographyStylesProvider` usage found.
- No `Popover` or `Tooltip` `positionDependencies` usage found.
- No `@mantine/dates` React component usage found.
- No old `useFullscreen`, `useMouse`, or `useMutationObserver` hook imports found.
- `useLocalStorage` usage already supplies `defaultValue` in the real callsites reviewed (`App`, `AdminPanel`), so the Mantine 9 return-type correction should not create new undefined-handling work.
- No confirmed `Text color` or `Anchor color` migration issue was found during this pass. Reviewed callsites already use `c="dimmed"` or apply `color` only to components where the prop remains valid.
- `@mantine/form` usage is currently limited and simple. The only reviewed form usage (`LoginForm`) relies on plain `initialValues`, synchronous validators, and `form.getInputProps`, with no removed resolver APIs or transform generics involved.

This is important because it means the migration does **not** currently look like a long, mechanical prop-rename exercise.

---

## Recommended Execution Order

1. Create a dedicated upgrade branch.
2. Do Tracks `M9-A` and `M9-D` together so React `19` and Mantine `9.1` land in one dependency pass.
3. Immediately add the visual compatibility defaults from `M9-B` before broad QA.
4. Run the portal, overlay, and shadow-DOM regression sweep from `M9-C`.
5. Decide whether to keep or remove compatibility toggles after the app is stable.
6. Only after stabilization, consider `M9-E` and `M9-F` improvements.

---

## Overall Assessment

### Feasibility

High. The repo does not appear to depend on many of the documented API removals, so the code-change surface is smaller than a naive Mantine `7 -> 9` jump suggests.

### Risk

Medium-high. The risk is concentrated, not widespread:

1. React `19` adoption and adjacent dependency compatibility.
2. Visual drift from Mantine 9 defaults.
3. Shadow DOM, dropdown, portal, and overlay behavior on admin and campaign surfaces.

### Expected shape of the migration

This is likely to be a compatibility-heavy and QA-heavy upgrade rather than a branch dominated by hundreds of JSX edits.

### Suggested follow-up pass

If this work is split into multiple passes, the next pass should be an actual upgrade branch that performs `M9-A`, applies the recommended `M9-B` compatibility settings immediately, then triages the runtime regressions uncovered by `M9-C`.