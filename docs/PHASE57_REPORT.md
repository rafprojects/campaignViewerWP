# Phase 57 - UI & Editor Polish

**Status:** In progress (A, B, C, D, F done)
**Created:** 2026-06-23
**Last updated:** 2026-06-25 (C+D)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P57-A | Settings panel open/close animation variants | Done | Small |
| P57-B | SettingsPanel space-badge dark-mode color parity | Done | Small-Medium |
| P57-C | LayoutBuilder saved color swatches + eyedropper | Done | Small |
| P57-D | LayoutBuilder layer search/filter in the Layers panel | Done | Small |
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
- The transition map lives in its own module (not inline in `SettingsPanel.tsx`) to avoid a `react-refresh/only-export-components` lint warning and keep it unit-testable. `none` → `{ transition: 'fade', duration: 0 }` (instant, no flash); `scale` → `scale-x` initially, later replaced by a custom corner-origin scale (see [Round 2 Bug 5](#bug-5-polish--scale-now-expands-from-the-lower-right-corner)).
- **Note:** the actual open/close animation did **not** work as shipped in round 1 — see [Round 2 Bug 1](#round-2--manual-qa-bugs--final-implementation-2026-06-25) for the root cause and the `requestAnimationFrame` fix that made it play.
- Wired `transitionProps={resolveSettingsPanelTransition(settings.settingsPanelAnimation)}` on the Drawer (`SettingsPanel.tsx`).
- Added a `Select` (Slide / Fade / Scale / None) to the "Settings Drawer" accordion in `AdvancedSettingsSection.tsx`, beside the width/blur controls, using `comboboxProps={{ withinPortal: false }}` to match the sibling DimensionInput so the dropdown stays styled inside the shadow DOM.
- Tests: default + merge cases in `defaultsAndMerge.test.ts`; full mapping (incl. `none`→0 and unknown→slide-left fallback) in `resolveSettingsPanelTransition.test.ts`.

### Manual QA (2026-06-25, round 1)

> **Superseded — see [Round 2](#round-2--manual-qa-bugs--final-implementation-2026-06-25) below.** Round-1 QA wrongly assumed the panel animated and could not reach the animation `Select` at all (the System & Admin tab was hidden in space mode). Round 2 found the animation **never** played, the tab was unreachable for admins, and the setting did not persist — all fixed there.

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

### Implementation (2026-06-25, round 1 — shadow-portal approach, SUPERSEDED)

> **This approach was reverted in [Round 2](#round-2--manual-qa-bugs--final-implementation-2026-06-25).** Portaling the Drawer into the shadow tree achieved badge parity but **broke the open/close animation** (it moved the Drawer's Mantine `Transition` and remounted it when `withinPortal` toggled). The final approach keeps the `document.body` portal and reads `:host` values via `getComputedStyle(shadowHost)` — the very fallback flagged below. Retained here for history.

- **Deviation from plan:** the plan/report suggested resolving the shadow host via `document.getElementById(useRootId())`. Verified this is wrong twice: (1) `rootId` only equals the host element id when the host *has* an id — un-id'd shortcode mounts get a synthesized path slug (`getRootId`, `src/main.tsx`) with no matching element; and (2) the host element is in the **light** DOM, so portaling into it renders outside the shadow tree (host light-DOM children aren't displayed once a shadow root is attached), and `:host` CSS variables still wouldn't resolve.
- **Approach used (then reverted) — `getRootNode()` + shadow-tree portal:** an inline hidden `<span ref={shadowSentinelRef}>` resolves its `getRootNode()`; when a `ShadowRoot`, a dedicated `<div data-wpsg-drawer-portal>` was appended to it and passed as `portalProps={{ target }}`. With the Drawer inside the shadow tree, `:host` vars resolved and the badge used plain `variant="light"`.
- **QA risk that materialized differently:** the flagged concern was `position: fixed` clipping. The actual failure was the **animation** — see Round 2.

## Round 2 — manual-QA bugs & final implementation (2026-06-25)

Manual QA of the deployed plugin surfaced four real bugs that the round-1 unit tests missed, plus two polish items. Each is documented below with symptom → root cause → fix, including the dead-ends, because several were non-obvious and future changes to the settings panel or Mantine upgrades could regress them.

Files touched in round 2: `src/components/Admin/SettingsPanel.tsx`, `src/components/Admin/settingsPanelTransition.ts`, `src/components/Settings/tabs/SettingsSystemAdminTab.tsx`, `src/components/Settings/tabs/SettingsAppearanceTab.tsx`, `src/components/Settings/GeneralSettingsSection.tsx`, `wp-plugin/.../includes/settings/class-wpsg-settings-registry.php`, `wp-plugin/.../includes/rest/class-wpsg-space-controller.php`, and the corresponding tests.

### Bug 1 — The open/close animation never played (it never had, even pre-P57)

**Symptom.** The Settings panel opened and closed instantly. Cycling the new `settingsPanelAnimation` values changed nothing. The user confirmed it had *never* animated, even with the old hardcoded `{ transition: 'slide-left', duration: 200 }`.

**Root cause (two layers).**
1. **Mounts already-open.** The panel is conditionally rendered by its parent (`App.tsx`: `{isSettingsOpen && <SettingsPanel opened={isSettingsOpen} … />}`), so the Mantine `Drawer` always receives `opened=true` on its *first* render. Mantine's `useTransition` (`@mantine/core/.../Transition/use-transition.mjs`) initializes status with `useState(mounted ? 'entered' : 'exited')` and only animates via `useDidUpdate` on a **subsequent** `mounted` change. A Transition that first renders open starts at `'entered'` and never plays the enter animation.
2. **Sub-frame flip.** The first fix — an `internalOpened` state that starts `false` and is set to `opened` in a `useEffect` — was proven (via commit-phase logging) to genuinely commit `false → true`. But the two commits landed **~14 ms apart (< one 16.7 ms frame)**, so the browser never *painted* the closed "from" state, and a CSS transition with no painted start frame does not run. A per-frame `requestAnimationFrame` recorder confirmed the drawer's `transform` was stuck at `translateX(0)` the entire time.

**Dead-ends ruled out (don't re-try these):**
- *Shadow-DOM CSS isolation* — Mantine's `Transition` writes the transform/transition as **inline styles**, so the animation does not depend on the shadow-root stylesheet. Portal location is irrelevant to whether it animates. (This is why the Track B shadow-portal approach was both unnecessary for animation and harmful — see Bug 4.)
- *`keepMounted`* — keeping the content mounted while closed did not help; the problem was the unpainted frame, not a missing element.
- *`prefers-reduced-motion`* — verified off; not the cause.

**Fix.** Defer the open across **two** `requestAnimationFrame`s so the closed state is painted before flipping open (`SettingsPanel.tsx`):
```ts
const [internalOpened, setInternalOpened] = useState(false);
useEffect(() => {
  if (!opened) { setInternalOpened(false); return; }
  let raf2 = 0;
  const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setInternalOpened(true)); });
  return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
}, [opened]);
```
The `Drawer` uses `opened={internalOpened}`. **Verified** in a production (`vite preview`) build: the transform sweeps `translateX(600 → 466 → 354 → … → 2 → 0)`.

> **Watch-outs for future devs:** (a) keep the Drawer's structural props (esp. `withinPortal`) stable across the flip — toggling them remounts the Mantine `Transition` and resets it to `'entered'`; (b) jsdom advances rAF, so tests must `await` the panel opening rather than querying synchronously (see test changes below).

### Bug 2 — System & Admin tab unreachable for admins (so the animation control couldn't be found)

**Symptom.** Logged in as a WordPress admin, the "System & Admin" tab (which hosts the animation `Select`, via `AdvancedSettingsSection`) never appeared.

**Root cause.** The tab was gated `!isSpaceMode && isSystemAdmin && settings.advancedSettingsEnabled`. On a site where every gallery is space-scoped, `!isSpaceMode` is always false, so the tab is permanently hidden. Separately, the "Enable Advanced Settings" toggle in `GeneralSettingsSection` was visible to **all** users, not just admins.

**Fix.** Removed the `!isSpaceMode` guard from both the tab trigger and panel (`SettingsPanel.tsx`); the tab now shows for `isSystemAdmin && advancedSettingsEnabled` in any mode. Gated the "Enable Advanced Settings" toggle on `isSystemAdmin`, threaded `isSystemAdmin` through `SettingsAppearanceTab → GeneralSettingsSection`.

### Bug 3 — The animation setting never persisted (always reverted to `slide-left`)

**Symptom.** Choosing Fade/Scale/None, saving, and reopening always showed `slide-left`.

**Root cause (two layers).**
1. **Not in the PHP registry.** `settings_panel_animation` was never added to `WPSG_Settings_Registry`. The generic sanitizer (`WPSG_Settings_Sanitizer::sanitize_settings`) **drops any key not present in `$defaults`**, so the value was stripped on every global save.
2. **Wrong save path for a global setting (the dominant cause).** Because the panel was opened space-scoped, the save went to `PUT /spaces/{id}/settings` (`update_space_settings`), which keeps only `get_space_overridable_fields()` and drops the rest. The animation — like all "Advanced"/System settings — is **global**, not space-overridable, so it was silently discarded.

**Architectural clarification (decision record).** The Advanced settings are global because of their **nature** (settings-drawer chrome, cache TTLs, image-optimization, magic-link page) — not merely because they are admin-only. *Access control* (who may edit) and *value scope* (global vs per-space) are orthogonal: e.g. `theme` and per-type background settings are admin/editor-set yet deliberately **space-overridable**. The governing question is "does this value meaningfully vary per space?" — for these settings, no.

**Fix (chosen approach: "split-save").**
1. Registered `settings_panel_animation` in `WPSG_Settings_Registry`: added to `$defaults` (`'slide-left'`) and `$valid_options` (`['slide-left','fade','scale','none']`) so it persists and validates as an enum globally. (It is **not** added to `$space_overridable_fields` — it is intentionally global.)
2. `update_space_settings` now **splits** the incoming payload (`class-wpsg-space-controller.php`): overridable keys → the space override (unchanged); the remaining global-only keys that **actually changed** → the global option via `update_option`, gated on `current_user_can('manage_options')` (system-level write; the System & Admin tab is already manage_options-gated client-side) and audited. The frontend save path is unchanged — it already POSTs the full settings blob, and the backend (sole owner of the registry) classifies each key.
3. Removed the `showGlobalOnlySettings` gating added mid-round-1 so the whole System & Admin tab (incl. the magic-link picker) is editable from the space drawer and split-saves.

> **Watch-out:** the panel sends the *entire* settings object on save, so the split only writes global keys whose value **differs from the current global value** — avoids clobbering global settings or audit-log noise on every per-space save.

### Bug 4 — Badge dark-mode parity: shadow-portal approach reverted for `getComputedStyle`

**Symptom.** The round-1 Track B approach (portal the Drawer into the shadow tree) gave correct badge colors but **broke the animation** (Bug 1): the `withinPortal` toggle and shadow-tree relocation remounted the Mantine `Transition`.

**Fix.** Keep the Drawer portaling to `document.body` (stable, proven positioning) and obtain exact colors by reading the shadow host's resolved `:host` CSS variables from light-DOM JS:
```ts
const colorHex  = shadowHost ? getComputedStyle(shadowHost).getPropertyValue(`--mantine-color-${color}-5`).trim() : `var(--mantine-color-${color}-5)`;
const badgeBg   = shadowHost ? getComputedStyle(shadowHost).getPropertyValue(`--mantine-color-${color}-light`).trim() : undefined;
const badgeText = shadowHost ? getComputedStyle(shadowHost).getPropertyValue(`--mantine-color-${color}-light-color`).trim() : undefined;
```
The `shadowHost` element is still found via the inline sentinel's `getRootNode()`. These exact values are applied as inline styles on the badge (`variant="light"` base + inline override) and the left-border accent. In non-shadow mounts (dev/tests) `shadowHost` is null and it falls back to `variant="light"` / the CSS-var string. This is the refined form of the *original* hardcoded-shade workaround — but it reads the **exact** computed values instead of guessing shade indices, so parity is pixel-perfect. **Verified** in dark mode (`iso-space`, Halloween theme): badge `rgb(22,69,31)`/`rgb(235,251,238)`, border `rgb(81,207,102)`.

### Bug 5 (polish) — "Scale" now expands from the lower-right corner

`scale` mapped to Mantine's built-in `scale-x`, which scales horizontally from the edge (left edge renders first, expands right). Replaced with a custom `MantineTransition` (`settingsPanelTransition.ts`): `scale(0) → scale(1)` with `transformOrigin: 'bottom right'`, so the panel grows out of the lower-right corner — visually as if emerging from the floating auth menu anchored there.

### Bug 6 (polish) — Close animation

The panel unmounted instantly on close because the parent removes it the moment `onClose()` runs, cutting off any exit transition. Now `handleClose` reverts the theme preview and sets `internalOpened = false` to play the exit animation; the real `onClose()` (which unmounts) fires from the Drawer's **`onExitTransitionEnd`** once the exit finishes.

> **Subtle bug fixed here:** the first attempt wired the unmount to `transitionProps.onExited`, which Mantine invokes from **both** the overlay *and* content transitions → `onClose` fired **twice**. The top-level `onExitTransitionEnd` prop is called only from the content transition (`ModalBaseContent`), so it fires exactly once. `none` (duration 0) resolves `onExited` synchronously, so it still closes instantly.

### Round-2 verification

- Unit/integration: `SettingsPanel.test.tsx` (incl. async-open and async-`onClose` updates), `resolveSettingsPanelTransition.test.ts` (incl. the custom scale object), `defaultsAndMerge.test.ts`, plus the badge regression guard. tsc + eslint clean; PHP files pass `php -l`.
- Browser (production `vite preview`, per-frame rAF capture): open slide `600 → 0`; close slide `0 → 600 → unmount`.
- Live deploy (`see-wp`): user-confirmed open animation, all four variants persist & play, scale emerges from the corner, close animates, and dark-mode badge parity.
- Test-env note: because the open is now deferred by rAF, two tests that assumed synchronous open were updated to `await` the panel (`clickTabAndWait` now uses `findByRole`; the "renders without a loading spinner" test awaits the tabs), and the close test now `await`s `onClose`.

### Follow-up

- ~~Add a PHP unit test for the `update_space_settings` split-save~~ **Done** — `tests/WPSG_P57A_Settings_Split_Save_Test.php` (5 tests, 18 assertions): registry contract; global key routed to the global option; mixed-payload split; invalid-enum fallback; and a space-admin editor (manage_wpsg + space grant, no manage_options) saving overridable keys while being blocked from the global write.

## Track P57-D - LayoutBuilder layer search/filter

### Problem

The Layers panel in the LayoutBuilder has no search/filter, making large layouts (many named slots and groups) hard to navigate.

### Fix

- Added optional `filterText?: string` prop to `LayerPanel.tsx`. When non-empty, the layer list computed by `buildLayerList(template)` is narrowed: leaf items (slot, graphic, background, mask) whose display name (`getLayerName`) contains the query (case-insensitive) are kept; their ancestor groups are kept visible; all other items are hidden.
- Collapse-hide is bypassed when a filter is active so matched items inside collapsed groups still surface.
- Keyboard navigation (ArrowUp/Down, Space, L, F, B) operates on the filtered list.
- Added a `TextInput` search box (with magnifier icon and clear × button) to `LayoutBuilderLayersPanel.tsx` above the layer list. `filterQuery` is purely local `useState` — no hook or context change.

### Implementation notes

- Filtering is a derived view: `buildLayerList` is still called with the full template; the filter is applied client-side before render. Drag/drop cross-type detection still uses the full `layers` list so group reparent checks never mis-classify a dragged item.
- `getLayerName` (existing utility) is the single source of truth for display names — slots without a `name` field match on "Media Layer N", graphics on "Graphic Layer N", etc.

### Acceptance criteria met

- Typing narrows the list to matching layers; ancestor groups remain visible.
- Clearing (× button or deleting query) restores the full hierarchy; selection and interaction are unaffected.

### Validation

- 4 new tests in `LayerPanel.test.tsx` (match, no-match, clear, ancestor-group). All 27 LayerPanel tests pass.

---

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

### Implementation (2026-06-25)

- **`useBuilderWorkspacePrefs.ts`**: Added `savedSwatches: string[]` and `addSwatch(color: string): void`. `addSwatch` validates non-empty / non-bare-`#`, deduplicates (moves to front), limits to 30 entries, and persists as JSON under `wpsg_builder_{rootId}_color_swatches`. Loaded from localStorage on mount.
- **`BuilderDockContext.tsx`**: Added `savedSwatches` and `addSwatch` to `BuilderDockContextValue`.
- **`LayoutBuilderModal.tsx`**: Destructured `savedSwatches, addSwatch` from `useBuilderWorkspacePrefs` and added both to `contextValue`.
- **New `BuilderColorInput.tsx`**: Builder-specific wrapper around `ModalColorInput`. Reads `savedSwatches`/`addSwatch` from `useBuilderDock()`, passes `swatches={savedSwatches}` (Mantine renders them in the picker dropdown), sets `withEyeDropper={true}` by default (Mantine v9 handles the native EyeDropper API — no-op in unsupported browsers), and hooks `onChangeEnd` (not `onChange`) to call `addSwatch`. `onChangeEnd` fires on mouse-up after a drag and on blur after manual hex entry, so incremental drag ticks do not flood the swatch list.
- **Three property panels** (`BackgroundPropertiesPanel`, `SlotPropertiesPanel`, `GraphicLayerPropertiesPanel`): swapped `import { ModalColorInput as ColorInput }` for `import { BuilderColorInput as ColorInput }` — drop-in replacement, no call-site changes needed.

### Validation

- 6 new tests in `useBuilderWorkspacePrefs.test.ts` (init, load, add, dedup, limit, ignore-invalid) and 3 new tests in `BuilderColorInput.test.tsx` (renders, onChange triggers addSwatch, empty input skips addSwatch). All new tests pass.

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

### Implementation (P57-F — done)

**Schema:** `rotation?: number | undefined` added to `LayoutSlot` in `src/types/index.ts`; `undefined` means 0°, which avoids emitting zero-value noise in serialized JSON. PHP `sanitize_slots()` extended to include `rotation` (clamped 0–359, `null` when absent) — the field was being silently dropped on every save before this fix.

**Builder canvas (`LayoutSlotComponent.tsx`):**
- Inner rotation wrapper div applies `transform: rotate(Xdeg)` inside the Rnd bounding box so drag/resize handles stay axis-aligned.
- `liveRotation` state allows smooth drag feedback; committed via `onSlotUpdate` on mouseup.
- Rotation handle: blue circle with rotate SVG icon, positioned at `top: 6 / left: 50%` inside the slot bounding box. Previous design placed the handle 40 px above the slot top edge, which was clipped by `overflow: hidden` on the modal canvas container; moving it inside the slot bounds was the correct fix. Visible only when `isSelected && !isHandTool && !slot.locked`. `atan2` converts mouse position relative to slot center into degrees.
- Selection ring (`boxShadow`) moved to Rnd `style` prop (from inner content divs) so it stays axis-aligned regardless of inner rotation.
- Zero-rotation guard: rotation wrapper uses full shorthand only when `(liveRotation ?? slot.rotation ?? 0) !== 0` to avoid creating an unnecessary CSS stacking context.

**SlotPropertiesPanel:** `NumberInput` (0–359°) with `IconRefresh` reset button (visible when `rotation` is non-zero). The Rotation section header is a scrub target: pointer-capture drag left/right adjusts degrees (Adobe-style). Uses `onPointerDown` + `setPointerCapture` + `onPointerMove` rather than `document.addEventListener` for reliability inside the modal.

**Front-end renderer (`LayoutBuilderGallery.tsx`):** `transform:rotate(Xdeg);transform-origin:center center` appended to slot CSS class only when `slot.rotation` is truthy — same zero-stacking-context guard as builder.

**Tests:** 15 new tests across `LayoutSlotComponent.test.tsx`, `SlotPropertiesPanel.test.tsx`, `LayoutBuilderGallery.test.tsx`. Also patched pre-existing `SlotPropertiesPanel.test.tsx` failure (all 51 tests were broken since P57-C because `BuilderColorInput` requires `BuilderDockContext`; added `vi.mock('./BuilderDockContext')` to unblock them). Full suite: 3435/3435 pass. Manual QA confirmed rotation saves and renders correctly across builder and front-end.

**Status: complete.**

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
