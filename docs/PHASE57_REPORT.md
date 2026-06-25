# Phase 57 - UI & Editor Polish

**Status:** In progress
**Created:** 2026-06-23
**Last updated:** 2026-06-25

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P57-A | Settings panel open/close animation variants | Done | Small |
| P57-B | SettingsPanel space-badge dark-mode color parity | Done | Small-Medium |
| P57-C | LayoutBuilder saved color swatches + eyedropper | Planned | Small |
| P57-D | LayoutBuilder layer search/filter in the Layers panel | Planned | Small |
| P57-E | LayoutBuilder persistent (draggable/lockable) guides | Planned | Medium |
| P57-F | LayoutBuilder slot rotation handles + `rotation` field | Planned | Medium |

---

## Rationale

A grab-bag of independently shippable polish, drawn from the Settings & Admin UI backlog and the splittable LayoutBuilder "Design-Tool Affordances" / "Editor UX Polish" items. None is launch-gating; each narrows a perceived-quality gap (motion options, exact dark-mode color, design-tool affordances) without adding a headline capability.

1. **What triggered it.** Two small Settings items (animation variants, badge color parity) plus four LayoutBuilder affordances (swatches/eyedropper, layer search, persistent guides, rotation) were parked in FUTURE_TASKS as polish. Bundled here they form one focused "make it feel finished" phase.
2. **Why it belongs together.** All six are low-risk, independently revertible polish on existing surfaces. The two LayoutBuilder *schema/canvas* tracks (E, F) deliberately follow Phase 55's decomposition of `LayoutBuilderModal.tsx` / `useLayoutBuilderState.ts`, which gives them a cleaner base to extend.
3. **Success.** Admins can match or disable the Settings panel motion; the space badge is pixel-correct in dark mode; the LayoutBuilder gains saved swatches + an eyedropper, a layer filter for large layouts, persistent guides, and slot rotation — each shippable on its own.

> **Depends on Phase 55.** P57-E and P57-F touch the LayoutBuilder template/slot schema and canvas render path; sequence them after the P55-D/E decomposition.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Phase identity | **Broadened from "Settings & Admin UI Polish" to "UI & Editor Polish"** to absorb the four LayoutBuilder affordances the user added. (User direction, 2026-06-23.) |
| B | Badge dark-mode approach | **Portal inside the shadow DOM** (`portalProps.target = shadowHost`) so Mantine `:host` CSS variables resolve, removing the hardcoded-shade workaround — chosen over the global `:root` CSS-var bridge to avoid polluting the host page. |
| C | Eyedropper support | **Native `EyeDropper` API with graceful no-op fallback** where unsupported — no heavyweight polyfill for a polish feature. |
| D | Rotation scope | **Single-slot rotation field + canvas handle** in this phase; deeper group-rotation interplay is a Follow-On. |

## Execution Priority

1. **P57-A / P57-B (Settings)** — smallest, fully self-contained, no LayoutBuilder dependency; land first.
2. **P57-C / P57-D (LayoutBuilder, no-schema)** — swatches/eyedropper and layer filter touch only UI; no template-schema change.
3. **P57-E / P57-F (LayoutBuilder, schema/canvas)** — last; require the P55 decomposition and add template/slot schema fields, so they carry the most risk.

---

## Track P57-A - Settings panel animation variants

### Problem

The Settings panel Drawer uses a hardcoded transition — `{ transition: 'slide-left', duration: 200 }` at `src/components/Admin/SettingsPanel.tsx:593`. Admins can't match their site's motion style or disable animation for accessibility/performance.

### Fix

- Add `settingsPanelAnimation` (`slide-left | fade | scale | none`, default `slide-left`) to `GalleryBehaviorSettings` (`src/types/index.ts:732`; default at `:1279`).
- Add Zod validation in `src/types/settingsSchemas.ts` following the existing `optionalEnum` pattern.
- Wire the resolved value into the Drawer `transitionProps`; map `none` → `{ duration: 0 }` so the panel opens instantly without a flash.

### Acceptance criteria

- The four variants apply to the Settings panel open/close; default reproduces today's slide-left/200 ms.
- `none` opens instantly (no transition flash).
- The field validates server- and client-side like other behavior settings.

### Validation

- `npm run test` for the new field + default; manual QA cycling all four variants.

### Implementation (2026-06-25)

- Added `settingsPanelAnimation: 'slide-left' | 'fade' | 'scale' | 'none'` to `GalleryBehaviorSettings` (`src/types/index.ts`) with default `'slide-left'` in `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`.
- **Deviation from plan:** the plan called for Zod validation in `src/types/settingsSchemas.ts`. Verified that file only validates *gallery config* (adapters/typography/breakpoints) — the sibling behavior settings (`settingsPanelWidth`, `settingsDrawerBlurEnabled`, the `*Unit` enums) are **not** Zod-validated. They flow through the generic `mergeSettingsWithDefaults` (`src/utils/mergeSettingsWithDefaults.ts`), which uses `??` defaults but no per-field enum check. To stay consistent with siblings and still harden against bad stored values, validation happens at the **point of use** instead: `resolveSettingsPanelTransition()` (`src/components/Admin/settingsPanelTransition.ts`) maps known values to Mantine `transitionProps` and falls back to `slide-left` for unknown/legacy/`undefined`. No `settingsSchemas.ts` change.
- The transition map lives in its own module (not inline in `SettingsPanel.tsx`) to avoid a `react-refresh/only-export-components` lint warning and keep it unit-testable. `none` → `{ transition: 'fade', duration: 0 }` (instant, no flash); `scale` → `scale-x` (right-anchored).
- Wired `transitionProps={resolveSettingsPanelTransition(settings.settingsPanelAnimation)}` on the Drawer (`SettingsPanel.tsx`).
- Added a `Select` (Slide / Fade / Scale / None) to the "Settings Drawer" accordion in `AdvancedSettingsSection.tsx`, beside the width/blur controls, using `comboboxProps={{ withinPortal: false }}` to match the sibling DimensionInput so the dropdown stays styled inside the shadow DOM.
- Tests: default + merge cases in `defaultsAndMerge.test.ts`; full mapping (incl. `none`→0 and unknown→slide-left fallback) in `resolveSettingsPanelTransition.test.ts`.

### Manual QA (2026-06-25, `see-wp`)

- The Drawer visibly animates on open (default slide-left reproduced) during the Track B shadow-DOM session.
- The animation `Select` UI itself was **not** visually confirmed in-app: it lives in the SettingsPanel "System & Admin" tab, which renders only for a **non-space** panel with `advancedSettingsEnabled` — every gallery on the dev site is space-scoped (the tab is hidden in space mode), and the standalone wp-admin "Super Gallery Settings" page is a separate UI that does not mount `AdvancedSettingsSection`. The control is covered by unit tests and wired identically to its proven sibling drawer controls; visual confirmation is deferred until a non-space gallery is available.

## Track P57-B - SettingsPanel space-badge dark-mode parity

### Problem

The SettingsPanel Drawer renders via `withinPortal` to `document.body`, outside the shadow DOM, so Mantine's `:host` CSS variables are unavailable. The current workaround (`SettingsPanel.tsx:346-351`) hardcodes shade indices via `useMantineTheme` + `useComputedColorScheme`, producing a close-but-not-identical badge shade in dark mode versus the AuthBar/AdminPanel badges (which use `variant="light"` inside the shadow DOM).

### Fix

- Render the Drawer's portal **inside the shadow DOM** via `portalProps={{ target: shadowHost }}`, obtaining the host element from `useRootId()` + `document.getElementById`.
- With `:host` variables available, switch the badge back to Mantine `variant="light"` and remove the `useMantineTheme`/`useComputedColorScheme` hardcoded-shade workaround.

### Acceptance criteria

- The SettingsPanel space badge color matches the AuthBar/AdminPanel badge exactly in both light and dark mode.
- The hardcoded-shade workaround is removed; the Drawer still escapes any host transform/stacking context correctly.

### Validation

- `npm run test` for the badge rendering; manual QA comparing all three badge locations in light and dark mode (`see-wp` flow).

### Implementation (2026-06-25)

- **Deviation from plan:** the plan/report suggested resolving the shadow host via `document.getElementById(useRootId())`. Verified this is wrong twice: (1) `rootId` only equals the host element id when the host *has* an id — un-id'd shortcode mounts get a synthesized path slug (`getRootId`, `src/main.tsx`) with no matching element; and (2) the host element is in the **light** DOM, so portaling into it renders outside the shadow tree (host light-DOM children aren't displayed once a shadow root is attached), and `:host` CSS variables still wouldn't resolve.
- **Approach used — `getRootNode()`:** an inline hidden `<span ref={shadowSentinelRef}>` (rendered as a sibling of the Drawer, so it lives in the shadow tree) resolves its `getRootNode()`. When that is a `ShadowRoot`, a dedicated `<div data-wpsg-drawer-portal>` is created once and appended to the shadow root, and passed as `portalProps={{ target }}`. A dedicated sibling container (rather than the React mount node) keeps the Drawer out of React's managed subtree. Outside the shadow DOM (tests, non-shadow mounts) the target stays `null` and the Drawer keeps its default `document.body` portal.
- With the Drawer now inside the shadow tree, `:host` Mantine CSS variables resolve, so the badge reverted to plain `variant="light"` and the `useMantineTheme`/`useComputedColorScheme` + `colorHex`/`badgeBg`/`badgeText` hardcoded-shade workaround was removed. The left-border accent (also previously `colorHex`) now uses `var(--mantine-color-${color}-5)`.
- **QA risk (carry into manual QA):** moving the Drawer off `document.body` makes its `position: fixed` overlay viewport-relative only if no ancestor between the shadow-root container and the Drawer has a `transform`/`filter`/`perspective`. The container is a direct child of the shadow root, so this is expected to be safe — confirm in `see-wp` that the overlay covers the full viewport and the drawer is not clipped/offset. Fallback if it breaks: keep the `document.body` portal and instead read `:host` values via `getComputedStyle(shadowHost)`.
- Tests: `SettingsPanel.test.tsx` asserts the badge renders with `data-variant="light"` and no inline `background-color`/`color` override (regression guard for the removed workaround).

### Manual QA (2026-06-25, `see-wp`)

Verified on the live dev site (`/meower`, the dark/Halloween-themed `iso-space` gallery) via a Playwright probe that pierces the shadow DOM. With the Settings drawer open:

- **Portal location:** exactly one `[data-wpsg-drawer-portal]` container, created **inside the shadow root** (`portalsInShadow: 1, portalsInLight: 0`) — the Drawer is no longer in `document.body`.
- **Badge:** renders `data-variant="light"` with `--badge-bg: var(--mantine-color-green-light)` / `--badge-color: var(--mantine-color-green-light-color)` (computed `rgb(22,69,31)` / `rgb(235,251,238)` in dark mode) — the same Mantine variable mechanism as the AuthBar/AdminPanel badges, with **no** hardcoded inline color. Confirms dark-mode parity.
- **Border accent:** `var(--mantine-color-green-5)` resolves to `rgb(81,207,102)`.
- **Positioning (the flagged risk):** drawer rect `x=800 w=600 h=1000` against a `1400×1000` viewport — full-height, right-anchored, not clipped/offset. The `position: fixed` ancestor-transform concern does not materialize.

## Track P57-C - LayoutBuilder swatches + eyedropper

### Problem

The LayoutBuilder color pickers (background, slot, graphic-layer, mask properties panels) have no saved swatches/palettes and no eyedropper — admins re-enter colors and can't sample an existing one.

### Fix

- Add saved color swatches/palettes to the existing color-picker surfaces across the LayoutBuilder properties panels; persist via workspace prefs.
- Add an eyedropper using the native `EyeDropper` API where available, with a graceful no-op fallback where unsupported (Decision C).
- Color-picker UI only — no canvas or template-schema change.

### Acceptance criteria

- Saved swatches appear in and apply from each LayoutBuilder color picker and persist across sessions.
- The eyedropper samples a color where the browser supports it and is hidden/no-op where it doesn't.

### Validation

- `npm run test` for swatch persistence/apply; manual QA of swatches + eyedropper across the properties panels.

## Track P57-D - LayoutBuilder layer search/filter

### Problem

The Layers panel has no search/filter, making large layouts hard to navigate. (The clipboard copy/paste and align/distribute keyboard-shortcut pieces of the "Editor UX Polish" backlog item remain deferred.)

### Fix

- Add a search/filter box to `LayoutBuilderLayersPanel.tsx` filtering the list from `buildLayerList(template)`.
- Match on a name substring across groups/slots/overlays/masks; keep ancestor groups of matches visible so the hierarchy still reads.
- Self-contained UI; no state-hook change.

### Acceptance criteria

- Typing in the filter narrows the layer list to matching layers, keeping their ancestor groups visible.
- Clearing the filter restores the full hierarchy; selection/interaction is unaffected.

### Validation

- `npm run test` for the filter behavior; manual QA on a large layout.

## Track P57-E - LayoutBuilder persistent guides

### Problem

Smart guides today are transient-only (`SmartGuides.tsx`) — there are no persistent, draggable guide lines an admin can place and keep, unlike Figma/Photoshop.

### Fix

- Add a `guides` array to the LayoutBuilder template schema (`useLayoutBuilderState.ts`) for draggable, lockable guide lines distinct from the transient SmartGuides.
- Render + drag/lock handling in `LayoutCanvas.tsx`; persist through the existing draft/save path.
- Reuse the SmartGuides geometry for snapping to the persistent guides.

### Acceptance criteria

- Admins can add, drag, lock, and remove guide lines that persist with the template across save/reload.
- Slots snap to persistent guides using the existing snapping geometry; locked guides don't move.

### Validation

- `npm run test` for the `guides` schema mutations + persistence; manual QA of add/drag/lock/snap on the canvas (`see-wp`).

## Track P57-F - LayoutBuilder slot rotation

### Problem

Slots cannot be rotated — there is no rotation transform on the canvas and no `rotation` field on slots.

### Fix

- Add a `rotation` (degrees) field to the slot schema.
- Add a rotation transform handle on the canvas (`LayoutCanvas.tsx` / slot render path) and apply the transform at render time in both the builder and the front-end LayoutBuilder render path.
- Ensure nudge/resize and group transforms account for rotation; mark deeper group-rotation interplay a Follow-On (Decision D).

### Acceptance criteria

- A slot can be rotated via a canvas handle; the `rotation` value persists and renders identically in builder and front-end.
- Nudge/resize behave sensibly on a rotated slot; group operations don't corrupt rotated members.

### Validation

- `npm run test` for the `rotation` schema field + transform; manual QA of rotate + render parity (`see-wp`).

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| LayoutBuilder true clipboard copy/paste + align/distribute keyboard shortcuts | The remaining slice of "Editor UX Polish"; P57-D ships only the layer search piece. |
| Group rotation / nested-rotation transforms | P57-F scopes single-slot rotation; group-rotation interplay is a larger transform-math problem (Decision D). |
| Eyedropper polyfill for non-supporting browsers | Native-API-with-fallback is sufficient for a polish feature (Decision C). |
| Per-breakpoint / responsive slot overrides | Separate headline capability (FUTURE_TASKS "Responsive / Per-Breakpoint Editing"), not polish. |

## Implementation Notes

- Record completed work here as tracks land; keep it factual.
- A/B are Settings-only and have no LayoutBuilder dependency; C–F depend on the Phase 55 LayoutBuilder decomposition for E/F's schema/canvas work.

## Outcome

_To be completed when the phase lands._
