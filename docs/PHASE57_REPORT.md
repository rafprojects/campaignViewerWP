# Phase 57 - UI & Editor Polish

**Status:** Planned
**Created:** 2026-06-23
**Last updated:** 2026-06-23

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P57-A | Settings panel open/close animation variants | Planned | Small |
| P57-B | SettingsPanel space-badge dark-mode color parity | Planned | Small-Medium |
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
