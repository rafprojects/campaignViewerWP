# Future Tasks & Enhancements

This document tracks deferred and exploratory work remaining. Items promoted to active phase execution are moved into dedicated phase reports and removed from this backlog.

---

## Builder

### URL-Based Image Inputs (Mask, Overlay, Background)

**Context:** All URL-based image inputs (paste URL for mask, overlay library, background image) were disabled in Phase 20 and replaced with upload-only workflows. This simplifies the security surface (no external URL fetching, no CORS issues, no SSRF risk) and keeps all assets in the WP media library.

**What was removed:**
- `SlotPropertiesPanel`: "Paste mask URL…" TextInput for adding masks, editable URL field for existing masks.
- `LayoutBuilderMediaPanel`/`AssetUploader`: URL TextInput for graphic layer library and background image sections.
- `LayoutBuilderModal`: `handleAddUrlToLibrary()` callback that POSTed external URLs to the overlay-library endpoint.
- `BuilderDockContext`: `handleAddUrlToLibrary` from the shared context interface.

**To re-enable (if needed):**
- `AssetUploader.onUrlSubmit` is already optional — simply pass the callback to re-show the URL TextInput.
- For masks, restore the TextInput in `SlotPropertiesPanel` mask section and the URL editing field.
- Add server-side URL validation and proxying: fetch the remote image via PHP, validate its content type and size, store it in the WP uploads directory, and return the local URL. This avoids CORS and SSRF issues.
- Consider a URL allowlist or domain whitelist for additional security.

**Effort:** Medium | **Impact:** Low — upload-only covers the primary use case; URL import is a convenience feature for advanced users.

---

### LayoutBuilder — History Persistence Across Sessions

**Origin:** Phase 58 planning (2026-06-26). Surfaced while scoping the LayoutBuilder enhancements; future-task'd per user direction.

**Context:** The undo/redo stack (`useLayoutBuilderHistory`) is fresh on every edit session — reopening a template loses its history. Persisting it with the existing local draft would let users undo across sessions.

**What to implement:** Persist the history stack (or a bounded slice) alongside the localStorage draft and restore it on builder open, reconciling with the draft-restore/conflict path.

**Files:** `src/hooks/useLayoutBuilderState.ts` (history composition), the draft-restore hook.

**Effort:** Medium | **Impact:** Low-Medium — quality-of-life; not a headline capability.

---

### LayoutBuilder — Reusable "Symbol" / Linked-Component Slots

**Origin:** Phase 58 planning (2026-06-26). Surfaced while scoping the LayoutBuilder enhancements; future-task'd per user direction.

**Context:** Slots and groups are all independent — there is no Figma-style "component/symbol" concept where editing one instance updates every linked instance. Useful for repeated layout motifs (e.g. a captioned card reused across a template).

**What to implement:** A symbol definition + linked-instance model (shared source, per-instance position overrides), instance sync on edit, and persistence in the template schema. Significant editor + schema work.

**Files:** `src/hooks/useLayoutBuilderState.ts` (schema + sync), the Layers panel, the canvas render path.

**Effort:** High | **Impact:** Medium — power-user efficiency; large surface for a niche-but-loved feature.

---

### LayoutBuilder — Slot Constraints / Pinning (Anchor-to-Edge)

**Origin:** Phase 58 planning (2026-06-26). Surfaced while scoping the LayoutBuilder enhancements; future-task'd per user direction.

**Context:** Slots are positioned in percentages with no constraint model — they cannot be pinned to a canvas edge so they reflow predictably on resize. A constraints/pinning system is the deeper responsive model that complements the per-breakpoint overrides in [PHASE58_REPORT.md](archive/phases/PHASE58_REPORT.md) P58-B.

**What to implement:** Per-slot anchor constraints (pin to left/right/top/bottom/center, fixed vs. stretch), resolved at render and on canvas resize, persisted in the template schema.

**Files:** `src/hooks/useLayoutBuilderState.ts` (schema + resolution), `LayoutCanvas.tsx`, the LayoutBuilder render path.

**Effort:** High | **Impact:** Medium — robust responsive behavior beyond discrete breakpoints.

---

### LayoutBuilder — Align/Distribute Keyboard Shortcuts

**Origin:** Deferred from [PHASE58_REPORT.md](archive/phases/PHASE58_REPORT.md) P58-A (Editor UX Polish) during batch-1 execution (2026-06-26), per user direction — the binding scheme needs design before implementation. The rest of P58-A (clipboard, slot opacity, nudge steps) ships in batch 1.

**Context:** Align and distribute exist only as Layers-panel buttons (`src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx`); there are no keyboard equivalents (unlike Figma). The blocker is binding choice: nearly all single keys are taken (`N`/`H`/`V`/`F`/`?`/`[`/`]`, plus `Ctrl+Z`/`D`/`G`/`S`), and the obvious `Ctrl+Alt+Arrows` collides with OS shortcuts (Linux workspace switch, Intel-GPU screen rotation). Two candidate schemes surfaced in planning: an **"A-chord"** (press `A`, then a direction / `H` / `V`) which is conflict-free but two-step, or a single-press `Ctrl+Alt+…` combo which is faster but unreliable cross-OS.

**What to implement:**
- Decide the binding scheme (A-chord vs. single-press combo) and document it in `src/components/Admin/LayoutBuilder/BuilderKeyboardShortcutsModal.tsx`.
- Extract the group-aware alignment closure at `LayoutBuilderLayersPanel.tsx:110-168` into a reusable `src/hooks/useSlotAlignment.ts` (`useSlotAlignment(builder)`) so both the Layers panel and `useLayoutBuilderKeyboardHandlers.ts` call the same logic.
- Wire the chosen bindings in `src/hooks/useLayoutBuilderKeyboardHandlers.ts`, gated on `selectedSlotIds.size >= 2` and `!isPreview`.

**Acceptance:** align/distribute invokable from the keyboard, matching the Layers-panel buttons, with 2+ slots selected.

**Effort:** Small-Medium | **Impact:** Low-Medium — power-user efficiency; the buttons already cover the capability.

---

### LayoutBuilder — Published Responsive Canvas Sizing (Breakpoint Render Model)

**Origin:** Deferred from [PHASE58_REPORT.md](archive/phases/PHASE58_REPORT.md) P58-B during implementation (2026-06-29), per user direction — needs an extensive manual-testing pass plus careful planning before committing to a model.

**Context:** P58-B ships per-breakpoint slot overrides + a builder boundary guide, and the published gallery now renders a non-desktop breakpoint as the **centered device-width band** of the design canvas, **scaled to fill** the container (`computeBreakpointBand` in `packages/shared-utils/src/breakpointViewport.ts`) — a "full-height vertical slice, scale-to-fill" model. It works, but on-page sizing is still imperfect: the layout is constrained left/right (the band is centered and the rest of the design canvas is hidden), and because tablet/mobile scale the band to the container, **slots get progressively smaller as the breakpoint narrows**. There is no per-breakpoint canvas aspect/height — mobile inherits the desktop canvas height as a tall, narrow slice. A better model would let the published layout size itself to the page more naturally across breakpoints.

**What to implement:** Define and validate a published responsive sizing model that avoids the "everything shrinks" effect and the rigid left/right constraint. Candidate directions: per-breakpoint canvas height/aspect on the template schema; container-relative sizing with min/max clamps; or integration with the **Slot Constraints / Pinning** entry above (the deeper responsive complement). Requires a broad manual-testing matrix (real devices + container widths × fixed-width vs fit-to-container templates × aspect ratios) and careful planning before code.

**Files:** `packages/shared-utils/src/breakpointViewport.ts`, `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`, the template `canvas*` / `breakpointOverrides` schema, `src/hooks/useLayoutBuilderState.ts`.

**Effort:** High | **Impact:** Medium-High — directly governs how published layouts look on real devices.

---

### LayoutBuilder — Faithful Preview (Breakpoint Render + Runtime Effects)

**Origin:** Deferred from [PHASE58_REPORT.md](archive/phases/PHASE58_REPORT.md) P58-B (2026-06-29), per user direction.

**Context:** Two preview gaps. **(1)** The builder's internal **Preview** mode (`LayoutCanvas` in `isPreview`, inside the device-frame) is a *separate* render path from the published `LayoutBuilderGallery`. After the P58-B publish-at-breakpoint fix the published/campaign render shows the centered band correctly, but the builder's Preview toggle does not necessarily match — it renders the design canvas inside the device frame rather than reusing the gallery's crop+scale band model. **(2)** Preview does not exercise the runtime effects the published gallery applies — per-slot glow, hover bounce/pop, entrance (scroll-reveal) animations, tilt — so the user cannot quickly validate a layout's interactive feel without actually publishing.

**What to implement:** (a) Align the builder Preview render with the published gallery's breakpoint model (centered band, scale-to-fill) so **Preview = published**; reusing `LayoutBuilderGallery` (or its crop+scale logic via `computeBreakpointBand`) in Preview mode is the cleanest path. (b) Render the runtime effects (glow, bounce/hover, entrance animations, tilt) in Preview the same way the gallery does (`buildTileStyles` / `buildBoxShadowStyles`, `buildSlotEntranceCss`, `TiltWrapper`) so effects are validatable in-builder.

**Files:** `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx`, `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx`, sharing with `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`, `src/utils/slotEntrance.ts`, and `src/components/Galleries/Adapters/_shared/tileHoverStyles.ts`.

**Effort:** Medium-High | **Impact:** Medium — faster design iteration and correctness confidence before publish.

---

### LayoutBuilder — Clickable / Linking CTA Text Layer

**Origin:** Deferred from [PHASE59_REPORT.md](archive/phases/PHASE59_REPORT.md) during P59 planning (2026-06-29), per user direction — Phase 59 ships single-style text layers with semantic roles (heading/subheading/paragraph/caption) rendered as real DOM text (Decision B: single-style text for v1); the linking/CTA variant was split off to keep v1 to pure, non-interactive text.

**Context:** Phase 59 text layers (`LayoutTextLayer` in `src/types/index.ts`; render path in `LayoutBuilderGallery.tsx`, P59-C) render as non-interactive semantic text — a heading or caption, not a link. A common layout need is a **call-to-action**: text that navigates somewhere when clicked (e.g. "Shop now"). That requires a link target on the layer plus interactive, accessible rendering — more than "style a string."

**What to implement:**
- Add an optional `href` (+ link behavior, e.g. same-tab/new-tab) to `LayoutTextLayer`; absent = plain text, so existing text layers stay back-compatible.
- Render a CTA layer as a real anchor (`<a>` / `role="link"`) with correct keyboard focus + Enter/Space activation and an accessible name — reuse the slot click/keydown a11y pattern already in `LayoutBuilderGallery.tsx` (`role`/`tabIndex`/key handling).
- Add a URL field + link controls to `TextPropertiesPanel.tsx` (the P59-B panel), and decide Pro-gating placement (text layers are flagged as a natural Pro feature in P59 Decision D / [PHASE62_REPORT.md](PHASE62_REPORT.md)).
- Sanitize the URL on save and on render.

**Files:** `src/types/index.ts` (`LayoutTextLayer`), `src/components/Admin/LayoutBuilder/TextPropertiesPanel.tsx`, `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`.

**Depends on:** the Phase 59 text-layer schema + render path (P59-A landed 2026-06-30; P59-B/P59-C pending).

**Effort:** Small-Medium | **Impact:** Medium — unlocks CTA/banner layouts (a primary reason to put text on a gallery) without an external image editor.

---

### LayoutBuilder — Right-Click / Long-Press Contextual Menu

**Origin:** Raised by the user during [PHASE59_REPORT.md](archive/phases/PHASE59_REPORT.md) P59-F planning (2026-07-01) as a follow-on idea, explicitly not urgent — sized as a future UX investment rather than something to build now.

**Context:** The LayoutBuilder currently exposes actions through two menu surfaces only: the top `Menu`-bar dropdowns (`LayoutBuilderMenuBar.tsx` — File/Edit/View, global scope) and the per-row `Menu` inside `LayerRow.tsx` (Layers-panel row actions). There is **no context menu anywhere on the canvas itself** — verified during P59-F research. A right-click (or long-press, for touch) menu on a canvas object is a standard design-tool convention (Figma, Photoshop, Canva) for fast, targeted actions without leaving the canvas or hunting through a side panel.

**What to implement:**
- A contextual menu component triggered by right-click (`onContextMenu`) and long-press on canvas targets, positioned at the cursor/touch point.
- Per-target-type action sets — the menu contents vary by what's under the cursor: a slot, overlay, text layer, group, or guide. Likely shared actions (delete, duplicate, bring-to-front/send-to-back, lock/hide) plus type-specific ones.
- Needs to compose with the builder's existing single-selection-per-type model (`selectedOverlayId`/`selectedTextId`/`selectedSlotIds`/etc. in `LayoutBuilderModal.tsx`) — right-clicking an unselected item should likely select it first, mirroring how most design tools handle this.
- Reuse the existing action handlers already wired to the Edit menu and Layers-panel rows (`handleDeleteSelected`, `handleDuplicateSelected`, `bringToFront`/`sendToBack`, etc. in `LayoutBuilderModal.tsx`/`useLayoutBuilderState.ts`) rather than duplicating logic — the contextual menu should be a new *trigger surface* for actions that already exist, not a new action-implementation layer.

**Files:** New component under `src/components/Admin/LayoutBuilder/` (e.g. a `LayoutBuilderContextMenu.tsx`); wiring touches `LayoutCanvas.tsx` (attach `onContextMenu`/long-press handlers per target) and `LayoutBuilderModal.tsx` (action dispatch, selection-on-right-click).

**Depends on:** No hard dependency, but [PHASE59_REPORT.md](archive/phases/PHASE59_REPORT.md) P59-F (guide delete-icon + keyboard delete) is a natural first candidate action this menu would eventually expose for guides — P59-F solves guide deletion directly rather than waiting on this larger system.

**Effort:** Medium-Large (new UI infrastructure: positioning, per-type action-set logic, touch long-press handling, keyboard/a11y for the menu itself) | **Impact:** Medium — meaningful workflow speedup for power users, matches conventions from professional design tools, but existing menu surfaces (Edit menu, Layers-panel row actions) already cover the same actions today, just less directly.

---

## Code Quality & Refactoring

### Roll Out `UnitScrubField` to Remaining Ad Hoc Numeric/Unit Inputs

**Origin:** Surfaced during [PHASE59_REPORT.md](archive/phases/PHASE59_REPORT.md) P59-D planning (2026-06-30), per user direction — P59-D itself stays scoped to `TypographyEditor`'s 8 CSS-unit fields; the app-wide rollout is explicitly deferred.

**Context:** P59-D extracts `UnitScrubField` (`src/components/Common/UnitScrubField.tsx`) — a shared `NumberInput` + unit `Select` + drag-to-scrub control — and migrates `DimensionInput` (`src/components/Settings/DimensionInput.tsx`) and the new `CssValueInput` (`src/components/Common/CssValueInput.tsx`, used by `TypographyEditor`) onto it as thin, contract-preserving adapters. That leaves at least one known ad hoc numeric input outside the new pattern, and likely others not yet inventoried.

**What to implement:**
- Migrate the bespoke rotation-degree scrub in `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx:567-613` onto a `UnitScrubField`-based adapter. This is a different value domain (plain degrees, not a CSS unit) so it needs its own thin adapter — not `CssValueInput`, which is CSS-string-shaped.
- Audit Settings and LayoutBuilder property panels (`src/components/Settings/`, `src/components/Admin/LayoutBuilder/`) for any other free-text CSS-value inputs or raw `NumberInput`s without unit safety that predate P59-D, and migrate the good candidates onto `DimensionInput`/`CssValueInput`/`UnitScrubField` for visual consistency and scrub support.

**Files:** `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx` (rotation scrub), `src/components/Common/UnitScrubField.tsx`, `src/components/Common/CssValueInput.tsx`, `src/components/Settings/DimensionInput.tsx`.

**Effort:** Small-Medium (rotation migration is contained; the audit scope depends on what the sweep finds) | **Impact:** Low-Medium — consistency and scrub-everywhere polish, not a functional gap.

---

*"`AdminPanel.tsx` — Extract the Remaining Tab-State Concerns (P70-H remainder)" was promoted to [PHASE72_REPORT.md](PHASE72_REPORT.md) track **P72-E** (2026-07-23) and removed from this backlog.*

---

### `ApiClient` Facade → Namespaces

**Origin:** [PHASE70_REPORT.md](archive/phases/PHASE70_REPORT.md) Follow-On Candidates, track **P70-E** (Planning Decision C, deferred 2026-07-21).

**Context:** `ApiClient` is a single flat facade class with ~70 call sites across the front end. Splitting it into per-domain namespaces (e.g. `apiClient.campaigns.*`, `apiClient.media.*`) would improve discoverability and file size, but is a long-tail incremental codemod behind deprecated shims — not a single bounded change.

**Effort:** Medium-Large (spread across ~70 call sites) | **Impact:** Low-Medium — maintainability only, nothing broken today. **Start whenever convenient**, not phase-scheduled; a natural fit for opportunistic touch-ups alongside unrelated work in files that import `ApiClient`.

---

### Promote Inline Sub-Components (large-file decomposition, opportunistic)

**Origin:** [PHASE70_REPORT.md](archive/phases/PHASE70_REPORT.md) Follow-On Candidates, track **P70-I** (Planning Decision C, deferred 2026-07-21).

**Context:** Several 900+-line files (e.g. `AdminPanel.tsx`, others surfaced during Phase 70 planning) define sub-components inline rather than as extracted, independently-testable files. Deferred deliberately as **opportunistic by design** — "do each file as it's next touched" — rather than a big-bang decomposition across all six candidate files in one pass, which would create churn without a behavior benefit.

**Effort:** Medium, spread thin across many files | **Impact:** Low — maintainability/readability only. No phase scheduling intended; revisit per-file whenever that file is next substantially touched for an unrelated reason.

---

### Vacuous e2e test — `theme-qa` "changing theme … persists to localStorage"

**Origin:** [PHASE75_REPORT.md](PHASE75_REPORT.md) § Branch Review, "Reviewed and deliberately not changed" (2026-08-25). Pre-existing before Phase 75; P75-D touched the test but did not cause the defect.

**Context:** `e2e/theme-qa.spec.ts`'s `changing theme in Display Settings persists to localStorage` cannot fail. Three compounding problems:

1. Its only assertion is `expect(typeof saved === 'string' || saved === null).toBe(true)` — a tautology over `localStorage.getItem`'s own return type. It is true whether or not the theme was written.
2. The test never changes a theme. It opens Display Settings, asserts the combobox is visible, and saves. The removed comment said as much: *"may be default-dark if unchanged."*
3. P75-D additionally made the save conditional (`if (await save.isEnabled()) await save.click()`), because the panel's Save button is disabled until the draft is dirty — which, given (2), it never is. So the test now usually does not even click Save.

Net effect: a green test asserting nothing, sitting in the suite that is supposed to protect theme persistence. The adjacent behavioral test (`Display Settings shows the active theme`) is real and does assert a value; this one is the only vacuous case in the file.

**What to implement:** Make the test do what its name says — select a *different* theme in the combobox (the P75-D-era locator is the display name, e.g. `Tokyo Night`, not the id), wait for the Save button to enable, click it, then assert `localStorage.getItem('mullion-theme-id')` equals the newly selected **id**. Drop the conditional click: if Save is disabled after changing the theme, that is the failure the test exists to catch. Consider a second assertion after a reload, since "persists" is the claim.

**Dependencies / risk:** needs a working Playwright run against wp-env (`npx playwright test theme-qa`) to author — the Phase 75 branch review flagged rather than fixed it precisely because rewriting an unexecutable browser test is worse than leaving it visibly marked. Pairs naturally with any track that already has to recapture theme-qa baselines.

**Effort:** Small (one test body, ~15 lines) | **Impact:** Medium — theme persistence is currently unguarded end-to-end despite appearing covered, which is worse than a known gap.

---

### `global.scss` rules aimed at portaled admin chrome are dead in shadow mode

**Origin:** [PHASE76_REPORT.md](PHASE76_REPORT.md) Track **P76-I-2**, found 2026-08-28 while implementing the focus-ring override. Pre-existing; confirmed by direct measurement, not inference.

**Context:** `main.tsx` loads `styles/global.scss` into the document **only when the app mounts without a shadow root**:

```ts
if (!useShadowDom) { import('./styles/global.scss') }
```

In the shipped default — shadow DOM — it is concatenated into the shadow root by `shadowStyles.ts` instead. But Mantine's `Portal` appends its target to `document.body`, so every Drawer, Modal, Menu and Popover renders *outside* that shadow root. Any `global.scss` rule meant to style portaled admin chrome therefore never applies in the configuration we actually ship.

Measured in a browser with the Display Settings drawer open (shadow mount, shipped default) — whether each selector is present in `document.styleSheets`:

| Rule | Reaches portaled chrome |
|---|---|
| `.mullion-mantine-select-option[data-selected]` | **No** |
| `.mullion-mantine-tabs-tab` | **No** |
| `.mantine-focus-auto…` (P76-I-2, `chrome-portable.scss`) | Yes |
| `.mullion-mantine-checkbox-input` (P76-I-2, `chrome-portable.scss`) | Yes |

The select-option rule is the sharpest case, because its own comment states the reason it exists: *"Select dropdowns may render in a portal, so selected option styling cannot rely on the `.mullion-gallery` ancestor being present."* The ancestor problem was correctly identified; the delivery problem underneath it was not. The selected-option highlight in every themed dropdown has been falling back to Mantine's default.

**Why the snapshots never caught it:** `theme-qa`'s `theme selector dropdown` captures exist and pass — they simply baked the unstyled appearance in as correct from the beginning.

**What to implement:** Audit `global.scss` for every rule that targets a Mantine class (`.mullion-mantine-*`) or otherwise expects to style portaled chrome, and move those into `src/styles/chrome-portable.scss`, which P76-I-2 added precisely for this and which is imported unconditionally in `main.tsx` *and* concatenated into `shadowStyles.ts`. Keep genuinely gallery-scoped structural rules where they are — `chrome-portable.scss` leaks into the host WordPress page, so it must stay small and contain only Mantine class overrides, never element selectors or resets.

**Dependencies / risk:** Moving these rules makes currently-dead styling live, so it **will** change appearance — the `theme selector dropdown` baselines will need deliberate recapture, and the diff should be reviewed rather than auto-accepted. That is the whole reason this is filed rather than folded into P76-I-2, which was scoped to the focus ring and two specific control fixes.

**Effort:** Small (a move plus a baseline review) | **Impact:** Medium — restores theming that the code already claims to apply, and removes a class of silently-dead CSS that has now bitten twice in Phase 76 (P76-H's variables, P76-I-2's focus ring).

---

### Three e2e specs fail on a clean tree (`mantine8-runtime-qa` x2, `accessibility` login modal)

**Origin:** [PHASE76_REPORT.md](PHASE76_REPORT.md) § Track I, found while verifying **P76-I-1** (2026-08-27). Pre-existing — reproduced on a stashed, unmodified tree at `13598e13`, so nothing in Phase 76 caused them.

**Context:** Three browser tests fail against the Vite dev server on a clean checkout, and none were tracked anywhere:

1. `mantine8-runtime-qa.spec.ts:173` — *shadow DOM settings drawer and nested gallery editor remain usable*
2. `mantine8-runtime-qa.spec.ts:230` — *campaign viewer nested overlays stay usable in shadow DOM*

   Both wait on `[data-mullion-component="…"][data-mullion-slot="overlay"]` locators. Those attributes are **debug-gated**: `src/utils/mullionDebug.ts` only emits them when the debug-markers setting is on (see `AdvancedSettingsSection.tsx`, `set_adv_debug_markers_desc`). The tests assume they are always present, so they cannot pass unless the flag is enabled in the fixture. A selector/fixture problem, not a product defect — but as written these two specs have no chance of guarding the shadow-DOM behaviour they are named for.

3. `accessibility.spec.ts:65` — *login modal has no critical/serious axe violations*, reporting ~187 `color-contrast` violations (e.g. ratio **1.23** on `#10242f`). Order-dependent: it fails when the spec runs alone and passed in one combined run, which suggests the modal is being sampled before its theme resolves rather than genuinely shipping 187 violations. Needs confirming before it is treated as a real contrast bug.

Also observed: `accessibility.spec.ts:258` (*settings panel*) is **flaky** — it failed in one combined run and passed in the next with identical code. Worth stabilising alongside the above.

**What to implement:** For (1)/(2), either enable the debug-marker flag in the e2e fixture or re-point the locators at stable roles/test ids. For (3), determine whether the violations are real or a timing artifact (wait for the themed mount before running axe), then fix or re-baseline. For the flake, identify the cross-spec interference — all four share one dev server via `reuseExistingServer`.

**Dependencies / risk:** none blocking; needs a Playwright run. Low risk, but until it is done the e2e suite has a permanently red floor, which trains everyone to ignore failures — the reason this is filed rather than mentioned in passing.

**Effort:** Small–Medium | **Impact:** Medium — three specs currently guard nothing, and a red baseline erodes the value of every other e2e test.

---

### Contract Tests — Frontend Request Payloads vs. REST Route-Arg Enums

**Origin:** [PHASE75_REPORT.md](PHASE75_REPORT.md) § Follow-On Candidates, from track **P75-I** (2026-08-26).

**Context:** P75-I was a two-phase-old, always-reproducible bug — every space access grant failed with `Invalid parameter(s): access_level` — that **both** test suites were green through, because neither suite can see the other side:

- **Vitest** asserts frontend payloads against a mocked `apiClient`. Whatever the component POSTs is "correct" by construction. `SpaceManagementView.test.tsx` did not merely miss the bug, it *asserted* it: `expect(apiClient.post).toHaveBeenCalledWith(…, { userId: 42, access_level: 'owner' })` — the exact body the server answers with `rest_invalid_param`.
- **PHPUnit** asserts the route args (`Mullion_P53D_Grant_Model_Test`: "the grant endpoint rejects non-viewer levels"). Correct, and blind to what the UI actually sends.

The failure mode is structural, not specific to `access_level`: whenever a `register_rest_route` `'enum'` narrows, nothing tells the TypeScript that sends those literals. There are currently **24 enum declarations across 6 controllers** — `access_level` (`['viewer']` ×4), `isolation_mode` (`['open','delegated']` ×2), `source` (`['company','campaign']`), `action` (`['grant','deny']`), `assetType` (`['asset','font']` ×2), `visibility`, `status`, campaign bulk `action` (`['archive','restore','delete']`), media `sort` / `type` / `source`, alert `scope` / `severity`, analytics event type, and the user-create `role` (`['subscriber','mullion_editor']`, itself renamed during the Phase 74 rebrand). Each is a live instance of the same trap.

**What to implement:** One shared, machine-checked source of truth for request-parameter enums, asserted from **both** sides. The likely shape:

1. A checked-in manifest (e.g. `docs/api/rest-enums.json`, or a TS module under `src/types/`) listing route → parameter → allowed values.
2. A **PHPUnit** test that walks the registered routes (`rest_get_server()->get_routes()`, already available in the test bootstrap — no new harness) and asserts every `'enum'` in the route args matches the manifest. This fails the moment a controller narrows or widens an enum without updating the manifest.
3. A **Vitest** guard (or a lint rule) that the frontend's literals for those parameters come from the manifest — importing the TS constants rather than typing `'owner'` inline. Making the values importable is most of the fix on its own: `spaceRoleOptions` built from a shared constant could not have drifted.

Scope decision worth settling first: whether the manifest is **hand-maintained and asserted** (simplest, catches drift at PR time, requires the PHP test to be the gate) or **generated** from the PHP routes at build time (no dual maintenance, but adds a PHP-run step to the frontend build). Hand-maintained-and-asserted is the smaller first move and does not couple the builds.

**Files:** `wp-plugin/mullion-gallery/tests/` (new route-enum test), `src/types/` (shared constants), `src/components/Admin/SpaceManagementView.tsx` + `src/components/Admin/AccessTab.tsx` + `src/hooks/useAdminAccessState.ts` (consume rather than inline), plus the other call sites for whichever enums are covered.

**Dependencies / risk:** Cross-artifact parity checks rot if they are not wired into CI — this repo has the precedent: `scripts/validate-adapter-settings-parity.mjs` broke silently in a refactor and was deleted in [PHASE76_REPORT.md](PHASE76_REPORT.md) **P76-G**, superseded by a Vitest guard that says so in its own header. So the check belongs in the existing PHPUnit + Vitest runs, not in a standalone script nobody runs. Start with the four `access_level` routes (the ones with a demonstrated failure) and widen from there rather than manifesting all 24 in one pass.

**Effort:** Medium | **Impact:** Medium-High — this is the class of bug that reaches users through a fully green pipeline, and P75-I proved it can survive two phases of active development on adjacent code.

---

### Portal Admin Chrome Into the Shadow Root (remove the CSS-variable boundary)

**Origin:** Deferred from [PHASE76_REPORT.md](PHASE76_REPORT.md) **P76-H** Key Decision B (2026-08-27). P76-H ships option (b) — inlining the variables — and explicitly keeps this option open rather than rejecting it.

**Context:** The Settings Panel `Drawer` and Layout Builder `Modal` are portaled by Mantine to `document.body` (`Portal.mjs:17-32`, `reuseTargetNode` default `true`). In a shadow mount — the shipped default (`main.tsx:30`) — that puts the chrome in the light DOM while every stylesheet that should theme it lives in the shadow root. A `<style>` inside a shadow root only styles that shadow tree, so nothing scoped there reaches the chrome: not Mantine's `.mullion-admin-chrome[data-mantine-color-scheme="…"]` block, and not `ThemeContext`'s `--mullion-color-*` at `:host`.

The codebase works around this per-consumer rather than structurally, and has already paid for it once: `src/styles/builder.css` themes Dockview through 22 `--mullion-builder-*` properties, so `LayoutBuilderModal` derives them via `useBuilderShellColors` and writes them as **inline styles** on a div inside the Modal. P76-H generalises that workaround; it does not remove the boundary. Each future component themed by CSS variables — an editor, a chart library, a date picker — keeps paying a smaller version of the same tax.

**What to implement:** Give the Drawer/Modal `portalProps={{ target }}` pointing at a node inside the shadow root, so chrome and stylesheets share a tree. `SettingsPanel` already resolves the shadow root for its badge sentinel (`shadowSentinelRef` → `shadowHost`), but that is the *host* element for reading computed variables, not a portal target — this needs new wiring, not a hookup. On success, `useBuilderShellColors` and the `--mullion-builder-*` inline bridge become deletable, and P76-H's `adminChromeStyles()` likely does too.

**Dependencies / risk:** This is the reason it was deferred rather than taken. The Drawer portals to `document.body` specifically to escape the host page's stacking context, so moving it inside the shadow root changes **z-index behaviour against wp-admin** — including against whatever plugins a given customer has installed — plus **focus trapping** and **click-outside** detection. That failure mode surfaces in support tickets, not in CI, which is a poor trade for closing a gap P76-D measured at 3 of 58 painted colour combinations. Re-evaluate when the variable-consuming surface grows enough to justify it; P76-H makes that cheaper, not harder, by centralising the mechanism it would replace.

**Effort:** Medium-Large (small diff, large validation surface — needs real wp-admin testing across plugin combinations) | **Impact:** Medium — architectural cleanup that removes a recurring tax, not a user-visible fix.

---

## Internationalization

### ~~Full Admin-Panel i18n Migration~~ — ✅ RESOLVED (Phase 60-I + Phase 61)

**Origin:** Phase 54 (P54-B harvests **user-facing** strings only; admin deferred here).

**Resolved (2026-07-05, [PHASE61_REPORT.md](archive/phases/PHASE61_REPORT.md)):** P60-I completed the admin-panel harvest; **Phase 61** swept every remaining front-end family (`Common`, `CampaignGallery`, `CardViewer`, `Auth`, `Settings`, `contexts`, `Galleries/Shared`, `App.tsx`, `ErrorBoundary.tsx`) and flipped `i18next/no-literal-string` to a single **blanket `'error'` for all of `src/**` + `packages/shared-ui/src/**`** — the terminal state, with no per-directory allow-list left to maintain. All newly-harvested strings are translated into the five shipped packs (fr/es/de/zh/ru). The WP.org public-listing i18n gate this entry described is now met.

---

### ~~i18n Review Follow-Ons — Sentence Composition + Locale Re-Translation~~ — ✅ RESOLVED (Phase 61-G, one caveat)

**Origin:** Phase 60 post-phase PR/code-review (2026-07-05), deferred from [PHASE60_REPORT.md](archive/phases/PHASE60_REPORT.md) → "Post-Phase PR / Code-Review Pass". Folded into Phase 61 Track G.

**Resolved (2026-07-05):**

1. **Sentence composition (F3).** ✅ `ArchiveCompanyModal.tsx` now composes its confirmation with a single `<Trans>` (`admin_archco_msg` / `_other`, `<strong>{{name}}</strong>` inline) — one reorderable, plural-aware unit. The pre/post fragment keys were removed. Other split-sentence cases surfaced during the P61 sweep (`NearDuplicateWarning`, `RequestAccessForm`) were also migrated to `<Trans>`.
2. **Locale re-translation.** ✅ The changed media-import toast strings (`admin_media_imported[_skipped]` + `_other` siblings) are now translated with proper singular/plural forms in all five packs; `.pot`/`.po`/`.mo`/`.l10n.php` regenerated (0 pot msgids untranslated).

**Remaining caveat (architectural, not actionable via re-translation):** the `ru_RU` **3-form** plural (`_few`/`_many`) for count-bearing strings (password-length, media counts) is **not achievable through the current i18next↔gettext bridge** — the bridge resolves translations by English string, so `_few`/`_many` (identical English to `_other`) collapse to one msgid. This is already documented in [`docs/guides/TRANSLATING.md`](guides/TRANSLATING.md) ("Russian plural nuance"); ru uses the `_other` form for counts 2–4. True 3-form correctness needs a source-layer redesign (distinct keys resolved by key, not English) and is out of scope here.

---

## Accessibility

### Structural a11y (axe) gate — grow coverage beyond `LayoutTemplateList`

**Origin:** [PHASE62_REPORT.md](PHASE62_REPORT.md) P62-H (component structural axe harness, 2026-07-11) — the automatable half of the structural work, deferred here after the harness landed. *The concrete `LayoutTemplateList` fixes this entry used to include (icon-only SegmentedControl accessible names; nested-interactive Card/Menu button) were promoted to [PHASE72_REPORT.md](PHASE72_REPORT.md) track **P72-G** (2026-07-23) — this entry now covers only the open-ended remainder below.*

**Context:** A jsdom axe harness (`src/test/axe.ts` → `expectNoA11yViolations`) runs structural WCAG A/AA checks (roles/names/labels/ARIA; contrast excluded) in the blocking Vitest CI, and `test-utils` mirrors the app's global Mantine CloseButton `aria-label`. Two clean surfaces are gated (`ConfirmModal`, `LayoutBuilderLayersPanel`); `LayoutTemplateList` becomes a third once P72-G lands. Growing the gate further is a living, component-by-component effort — the full backlog + the "how to add coverage" pattern are in [guides/ACCESSIBILITY.md](guides/ACCESSIBILITY.md) ("structural a11y backlog").

**What to implement:** Extend `expectNoA11yViolations` coverage to the remaining high-value surfaces — the LayoutBuilder property panels (Slot/Text/Graphic/Mask/Background/Image), the modals (`GalleryConfigEditorModal`, `UnifiedCampaignModal`, campaign/admin modals), `AdminPanel`, `SettingsPanel`, and the gallery adapters — fixing what each surfaces (typically missing form labels or nested interactives).

The **manual** assistive-tech audit ([guides/ACCESSIBILITY_MANUAL_AUDIT.md](guides/ACCESSIBILITY_MANUAL_AUDIT.md)) is the separate human half of P62-H.

**Status:** harness + 2 gated surfaces done (P62-H); `LayoutTemplateList` fixes scheduled as P72-G; further coverage growth remains open-ended here. **WCAG AA is a quality bar, not a hard WP.org submission gate**, so this can grow post-launch.

**Effort:** Medium (ongoing/incremental; per-surface fixes often pull in the i18n pipeline or an interaction restructure) | **Impact:** Medium — raises the public-listing a11y bar and prevents structural-a11y regressions via CI.

---

### Two-Tone ("Halo") Focus Ring — revisit as a layer on top of P76-I-2 Option A

**Origin:** [PHASE76_REPORT.md](PHASE76_REPORT.md) Track **P76-I-2**, deferred 2026-08-28. Option A (re-point Mantine's global focus ring at `primaryStroke`) was chosen; this was Option D in that decision, and the two are **complementary, not alternatives**.

**Context:** Mantine draws every non-input focus ring as a single flat outline:

```css
.mantine-focus-auto:focus-visible {
  outline: 2px solid var(--mantine-primary-color-filled);
  outline-offset: 2px;
}
```

A single-colour ring can only ever be as visible as its contrast against whatever sits behind it, which is why 13 of 23 bundled themes measured below the 3:1 WCAG 1.4.11 floor before Option A. Option A fixes that by choosing a better colour, but it remains a **one-colour** ring: any future theme, or any surface it was not measured against, can put it back under the floor.

The two-tone technique used by Chrome, Firefox and GitHub sidesteps the problem entirely — a brand-coloured inner ring plus a contrasting outer halo, so at least one of the two always contrasts with the background regardless of the surface:

```css
outline: 2px solid var(--ring-core);
box-shadow: 0 0 0 4px var(--ring-halo);
```

**What to implement:** Add the halo to the focus-ring rule Option A already introduces, with `--ring-halo` resolved per colour-scheme (a light halo on dark themes, dark on light). Then decide what `uiContrastAudit` should assert — the halo changes the guarantee from "the ring contrasts with the surface" to "the ring pair contrasts with itself and the surface", so `KNOWN_FOCUS_RING_GAPS` and the `primaryFill`/`primaryStroke` checks would need re-modelling rather than simple deletion.

**Rationale for deferring:** Option A alone brings all 23 bundled themes over 3:1 (minimum 3.64 on `surface`, 3.01 on `surfaceRaised`), so the compliance problem is solved without it. The halo's value is **robustness for themes that do not exist yet** — including user-authored themes via `registerCustomTheme`, which no build-time audit can see. That is a real but non-urgent benefit, and it is much easier to judge once Option A's brighter rings have been seen in the product.

**Dependencies / risk:** Depends on P76-I-2 Option A having landed. Main risks: the thicker footprint interacts with `outline-offset` and tight layouts (toolbars, table cells, segmented controls) and needs a visual pass; `box-shadow` on a focused element can be clipped by an ancestor's `overflow: hidden`, which single outlines are immune to. Both are why this deserves its own look rather than being bolted on during I-2.

**Effort:** Small–Medium (one CSS rule plus a visual sweep and an audit re-model) | **Impact:** Medium — converts focus-ring contrast from "measured correct for the themes we ship" into "structurally correct for any theme".

---

## Monetization & Distribution

Nothing yet.

---

## Privacy & Compliance

**Origin:** [PHASE60_REPORT.md](archive/phases/PHASE60_REPORT.md) P60-E — surfaced while auditing data handling for `docs/PRIVACY.md`. These are documented honestly in `PRIVACY.md`'s "Follow-Ons" as **known gaps**, not present features; each is a code change deferred out of the P60-E content track.

*"WordPress Core Privacy Integration (DSAR Export/Erase)" and "Retention / Auto-Purge for Email & Audit-Log Tables" were promoted to [PHASE72_REPORT.md](PHASE72_REPORT.md) tracks **P72-B** and **P72-F** (2026-07-23) and removed from this backlog.*

### Google Fonts Self-Host Variant

**Origin:** Deferred from [PHASE69_REPORT.md](archive/phases/PHASE69_REPORT.md) Follow-On Candidates (2026-07-21) — the docs-only fix (P69-A, documenting the existing Google Fonts data flow in `PRIVACY.md`) shipped; this is the both-sides code change split off from it.

**Files:** server-side font-file download/caching at settings-save time; client-side `loadGoogleFont.ts` (serve locally instead of injecting a Google-hosted `<link>`/`@font-face`); a system-font-stack fallback.

**Context:** The plugin's Google Fonts integration currently fires a third-party request (server-side `wp_enqueue_style` `<link>`, or client-side injection) whenever a Google Font is selected, disclosing the visitor's IP to Google. `PRIVACY.md §3` documents this data flow and its opt-outs, but a self-hosted variant — download the selected font files server-side at settings-save time, serve them locally — would eliminate the third-party request entirely for GDPR-conscious deployments.

**Effort:** Medium (a real, both-sides feature, not a documentation fix) | **Impact:** Low-Medium today — revisit if GDPR-conscious buyers specifically ask for a zero-third-party-request option.

---

### Server-Side (PHP) Sentry PII Scrubber

**Files:** `class-mullion-sentry.php` (parity with the browser-side `beforeSend` scrubber in `src/services/monitoring/sentry.ts`).

**Context:** The browser Sentry path strips `Authorization` headers and `user.ip_address`; the PHP path sends `$context` verbatim. Sentry is off by default (requires a DSN), so this is low-likelihood, but a scrubber should exist before recommending server-side error reporting.

**Effort:** Small | **Impact:** Low (off by default) but removes a footgun.

### Per-Day Salt Rotation for Analytics Visitor Hash

**Files:** `class-mullion-analytics-controller.php` (`record_analytics_event`).

**Context:** `visitor_hash = sha256(IP + wp_salt('auth'))` uses a static, non-rotating salt, so a given IP always hashes the same value — good for unique-visitor counts but re-identifiable for the small IPv4 space. Rotating the salt per day (bucketing the hash by date) reduces re-identifiability while preserving same-day uniqueness. Trade-off: cross-day unique counts become approximate.

**Effort:** Small | **Impact:** Low-Medium — hardens an already-pseudonymised field.

---

## Campaign Management

### Full Server-Driven `CardGallery` Host Pagination

**Origin:** [PHASE68_REPORT.md](archive/phases/PHASE68_REPORT.md) Follow-On Candidates (2026-07-21). P68-A's fix loops all pages of `fetchCampaigns`/`fetchAllCampaignOptions` up front (via the shared `fetchAllPages` helper in `src/services/pagination.ts`) rather than truly paging the UI — that closed the original data-loss bug (only page 1 was ever fetched) without the larger UX change of true infinite/paged public browsing.

**Context:** `fetchAllPages`'s current usage still has a hard cap (`DEFAULT_MAX_PAGES × 50 = 1,000` campaigns/space) — structurally the same class of truncation as the original bug, just at a 100× higher, currently-unhit threshold, and with no user-facing signal if it is ever hit. True server-driven host pagination in `CardGallery` (fetch one page at a time as the visitor scrolls/pages, not all pages up front) would remove this cap entirely and reduce initial-load payload for large campaign counts.

**Effort:** Medium-Large (new host-pagination UX in the public gallery component, not just the data-fetching layer) | **Impact:** Low today — revisit only if a site's campaign count grows large enough that fetching all pages up front becomes its own performance concern.

---

### Campaign Binary Export — Stream Large Media Sets

**Files:** `class-mullion-export-engine.php`

P39-CM1 ships background ZIP generation via `Mullion_Export_Engine` with a 100 MB size limit. For larger campaigns, add chunked/streamed media fetching (write directly to the ZIP via `curl CURLOPT_FILE` rather than buffering each media body in memory) and a configurable size ceiling in settings. Most campaigns fall within the current 100 MB limit today.

**Dependencies:** `Mullion_Export_Engine` (shipped P39-CM1). `ext-zip` required.

**Effort:** Medium (4-6 hours) | **Impact:** Low — only relevant for campaigns exceeding the current 100 MB size ceiling

---

### Campaign-Filtered Media Export Misses Pre-Phase-65 ZIP-Imported Campaigns

**Origin:** Phase 65 post-landing PR review (2026-07-18) — [PHASE65_REPORT.md](PHASE65_REPORT.md) "Post-Landing PR Review & Fix Pass".

**Context:** P65-B fixed `export_media_library_binary()` to filter a campaign's media by `attachmentId` instead of the always-zero `id`. But any campaign whose media was sideloaded via ZIP import **before** Phase 65 landed (when `attachmentId` was never stamped on sideloaded items) still has no `attachmentId` on those items — the campaign-filtered export silently returns an empty archive for exactly those campaigns, same symptom P65-B fixed, different root cause (stale data vs. wrong filter key). This is consistent with an existing codebase convention — `Mullion_CLI::media_orphans()` has the identical blind spot today, items without `attachmentId` are already invisible to it — but there is no signal anywhere distinguishing "campaign genuinely has no media" from "media exists but predates the `attachmentId` fix."

**What to implement:** Either (a) a one-time backfill/migration that stamps `attachmentId` on legacy sideloaded media items by matching `url` to an existing attachment, or (b) a softer fix: have `export_media_library_binary()`'s empty-result branch distinguish "campaign has zero `media_items`" from "campaign has `media_items` but none resolved an `attachmentId`," surfacing the latter as a warning instead of a silent empty export.

**Files:** `includes/rest/class-mullion-media-controller.php` (`export_media_library_binary()`); a backfill migration would also touch `includes/class-mullion-campaign-io.php`.

**Effort:** Small (warning signal) to Medium (backfill migration) | **Impact:** Low — only affects campaigns imported via ZIP before Phase 65; new imports are unaffected.

---

### Binary Campaign Export Downloads Non-File URLs for Embed/External Media

**Origin:** Surfaced during the Phase 65 post-landing PR review (2026-07-18) while verifying a fix for dropped `embedUrl`/`provider` fields — [PHASE65_REPORT.md](PHASE65_REPORT.md) "Post-Landing PR Review & Fix Pass".

**Context:** `Mullion_Export_Engine::build_zip()` treats every `media_items[].url` as a downloadable file and fetches it via `wp_safe_remote_get()`. For `source:"external"`/`"oembed"` items (YouTube, Vimeo, etc.) `url` is the original webpage link, not a media file — `normalize_external_media()` deliberately keeps the real embeddable link in a separate `embedUrl` field. So a binary (ZIP) campaign export either downloads garbage bytes (an HTML page) and stores them under a made-up filename, or the entry fails WordPress's file-type validation on re-import and silently lands in `media_skipped` — a video/embed item never meaningfully round-trips through the ZIP transport, only through JSON (where P65-D's fix already works, since JSON never touches `build_zip()`). This predates Phase 65 — the `build_zip()` download loop wasn't touched by the P65 commits — and is a deeper change than the metadata-preservation fix that shipped in the post-landing pass, so it was documented rather than fixed on the spot.

**What to implement:** In `Mullion_Export_Engine::build_zip()` (or upstream, before media items reach `create_job()`), skip items whose `source` is `external`/`oembed` — no real attachment bytes to fetch — rather than attempting to download `url`. The manifest already carries `embedUrl`/`provider` for these items (P65-D); a ZIP export should include them in the JSON manifest only, with no corresponding `media/` file, and `Mullion_Campaign_IO::sideload_media_items()` should recognize a media reference with no `filename` and route it through the URL-only path `build_url_media_items()` already uses for JSON imports, instead of trying (and failing) to find it in the archive.

**Files:** `includes/class-mullion-export-engine.php` (`build_zip()`), `includes/class-mullion-campaign-io.php` (`build_entry()`'s `filename` assignment, `sideload_media_items()`'s embed-ref handling).

**Effort:** Medium — touches the shared export engine and the P65-A service's import branching; needs new fixture coverage for a video/embed item through a real binary export→import | **Impact:** Medium — today the only transport where a video/embed campaign item survives a full round-trip is JSON; ZIP export/import of a campaign with embedded video content silently loses that item.

---

### Consolidate Duplicated Sanitization / Truncation-Flag Logic in the Campaign IO / Export Paths

**Origin:** Phase 65 post-landing PR review (2026-07-18) — [PHASE65_REPORT.md](PHASE65_REPORT.md) "Post-Landing PR Review & Fix Pass". Noted but not fixed in that pass, to avoid widening the diff's blast radius on freshly-landed, already-tested consolidation code.

**Context:** Four small duplication/indirection items surfaced during the review, none a correctness bug:
1. `Mullion_Campaign_IO::build_url_media_items()`/`upload_media_item()`/`normalize_media_type()` re-derive the same type/source whitelisting `Mullion_Cpt::sanitize_media_items()` already implements as the registered meta sanitizer.
2. `Mullion_Campaign_IO::apply_scalar_meta()`'s inline `strtotime()`/`gmdate()` datetime normalization duplicates `Mullion_Cpt::sanitize_datetime()`.
3. The `total_available`/`truncated` truncation-flag computation (P65-C) is implemented near-identically in both `class-mullion-media-controller.php` and `class-mullion-campaign-controller.php`, with no shared helper.
4. `Mullion_Campaign_IO::import_entry()`'s `$opts['via']`/`$opts['format']` derivation is a residual per-transport special case — every call site already passes both explicitly, so the `??` defaults are unreachable, and `format` is fully derivable from whether `$zip` is passed.

**What to implement:** Route (1)/(2) through the existing `Mullion_Cpt` sanitizers instead of re-implementing them; extract (3) into a shared helper (alongside `Mullion_REST_Base::paginated_response()`/`parse_pagination()`); simplify (4) by having each call site pass an explicit `source` string instead of the `via`/`format` ternary.

**Files:** `includes/class-mullion-campaign-io.php`, `includes/class-mullion-cpt.php`, `includes/rest/class-mullion-media-controller.php`, `includes/rest/class-mullion-campaign-controller.php`.

**Effort:** Small-Medium | **Impact:** Low — maintainability only; no observed behavioral bug today.

---

## Access Control

Phase-owned follow-on in this area: per-campaign RBAC now lives in [PHASE33_REPORT.md](archive/phases/PHASE33_REPORT.md). The remaining backlog items here are all prerequisites or components of the standalone cross-origin deployment scenario.

*Per-space authorization scoping of ephemeral export-job resources was promoted out of this backlog into Phase 63 and **completed** on 2026-07-15 — see [PHASE63_REPORT.md](PHASE63_REPORT.md) Track **P63-I** (follow-on to P63-E / P63-E-2). Export-job read/download now enforces tier + creator-ownership + all-contributing-spaces.*

### Granular Custom-Role Permission Engine (GitHub-style)

**Files:** `includes/class-mullion-permissions.php` (introduced in P52-A), role/cap setup in `mullion-gallery.php`, a new admin UI + storage.

**Context:** P52-A establishes the authorization foundation as a centralized `Mullion_Permissions` action→requirement map — every protected action declares its required tier (`manage_options` / `manage_mullion` / per-space grant level) and scope in one place, with the named tiers (viewer / editor / owner / mullion_editor / admin) acting as fixed **presets** over that map. This future task is the optional **builder layer** on top of that foundation: let site admins compose **custom roles** from atomic capabilities (à la GitHub's Read/Triage/Write/Maintain/Admin presets plus Enterprise custom repository roles), with optional **per-space role overrides**.

**What it would take:**
- Promote the implicit atomic actions in the `Mullion_Permissions` map to first-class, individually grantable capabilities.
- A storage schema for custom role definitions (composition of base preset + added/removed atomic caps), and optional per-space scoping of those definitions.
- An admin UI to create/edit custom roles and assign them, plus a migration path from the fixed presets.
- Permission resolution that layers custom roles over the preset map without breaking the existing tier checks or the P52-A regression matrix.

**Rationale for deferral:** A full custom-role engine is a self-contained system (storage + UI + migration + resolution) whose cost is the management surface, not the enforcement. With only a handful of actor archetypes today, it is premature (YAGNI). The P52-A centralized map deliberately makes this work **additive rather than a rewrite** — revisit only if a concrete multi-tenant or custom-role requirement emerges. Deferred from [PHASE52_REPORT.md](archive/phases/PHASE52_REPORT.md) Track P52-A (decided 2026-06-15).

**Effort:** High (multi-track / likely its own phase) | **Impact:** Low today; High if a multi-tenant custom-role need appears.

---

### CORS Origin Allow-List & Admin UI

**Files:** `mullion-gallery.php`, `class-mullion-settings.php`

Add a CORS allowed-origins admin setting and enforce it on REST API responses, rejecting wildcard (`*`) when credentials are used. Only affects cross-origin REST API usage; standard same-origin WordPress shortcode deployments are unaffected (WP core already reflects the request origin unconditionally for those).

**P39-CO1 deferral note (2026-06-01):** P39-CO1 attempted to promote this to a first-party settings-backed surface. Work was rolled back because CORS restriction provides no meaningful value for the primary use case — the plugin is embedded via WordPress shortcode and runs same-origin. This track becomes relevant only when Mullion is deployed as a standalone SPA on a different origin, which requires preparatory work (auth model, build changes, deployment docs) that is not yet in scope. Prerequisite for the JWT work below.

**Effort:** Medium (4-6 hours) | **Impact:** Low — meaningful only for standalone SPA deployments

---

### JWT In-Memory Token Auth (Standalone SPA)

**Context:** Phase 20 (P20-K) defaulted the plugin to nonce-only authentication and gated the JWT `localStorage` flow behind an opt-in flag (`MULLION_ENABLE_JWT_AUTH`) to eliminate the XSS → token-theft vector for the default deployment. However, if Mullion is ever deployed as a **standalone SPA on a different origin** (i.e. not embedded via shortcode), WP nonces are unavailable because they require a same-origin page load. In that scenario, JWT auth is required.

The JWT code (`src/services/auth/WpJwtProvider.ts`) is **live, working code today** — not commented out. It is simply not instantiated unless the site opts in: `getAuthProvider()` in `src/App.tsx` returns a `WpJwtProvider` only when `enableJwt === true` (backed by the `MULLION_ENABLE_JWT_AUTH` constant), otherwise a cookie/nonce `WpNonceProvider`. It stores tokens in `localStorage`, which is accessible to any script on the page. The secure alternative is:

1. **In-memory access token** — stored in a module-scoped variable (not `localStorage`). Survives only for the tab's lifetime.
2. **httpOnly refresh cookie** — issued by a new `/mullion/v1/token/refresh` endpoint with `SameSite=Strict; Secure; HttpOnly`. The browser sends it automatically; JS cannot read it.
3. **Silent refresh** — on app boot and before access-token expiry, `POST /mullion/v1/token/refresh` returns a fresh short-lived access token.

**What it would take:**
- New PHP endpoint: `POST /mullion/v1/token/refresh` — validates the httpOnly cookie, issues a new JWT with a 15-minute TTL.
- Modify `WpJwtProvider.ts` (live today, flag-gated — not commented out): replace `localStorage.setItem/getItem` with a module-scoped `let accessToken: string | null`.
- **Permissions-cache staleness (from the 2026-07-13 React review, § B-4, tracked as Phase 69 P69-E):** `WpJwtProvider.getPermissions()` returns the cached `mullion_permissions` `localStorage` entry with **no TTL** — it is only cleared on logout, so a revoked grant persists in the client UI until the user logs out (display-only; the server still enforces on every request). Fold the fix into this rework: add a TTL to the cache, or drop it entirely since the `/permissions` endpoint is cheap. See [PHASE69_REPORT.md → P69-E](PHASE69_REPORT.md#track-p69-e---jwt-providers-localstorage-permissions-cache-never-expires-tracking-only).
- Add a `useTokenRefresh` hook that calls the refresh endpoint 1 minute before expiry and on window `focus` events.
- `apiClient.ts`: attach `Authorization: Bearer <in-memory-token>` only when the env-var opt-in `Mullion_ENABLE_JWT=1` is set.
- Server-side: set the refresh cookie on `POST /mullion/v1/token` (login) and clear it on `DELETE /mullion/v1/token` (logout).
- CORS configuration for the cross-origin case (`Access-Control-Allow-Credentials: true`, explicit origin).

**Open questions:**
- Q1: Should refresh-token rotation be implemented (invalidate old refresh cookie on each use)? This limits replay but adds a revocation table.
- Q2: What is the refresh-cookie TTL? 7 days (convenience) vs. 24 hours (security) — should it be admin-configurable?
- Q3: Is a `/mullion/v1/token/revoke-all` endpoint needed for the "log out everywhere" use case?

**Prerequisites:** P20-K must be complete (nonce-only default + JWT provider behind the `MULLION_ENABLE_JWT_AUTH` env-var gate). D-1 (CORS allow-list) must ship first to define the accepted cross-origin policy.

**P39-AU1 deferral note (2026-06-01):** P39-AU1 was gated on P39-CO1. Both tracks were deferred together — the CORS restriction work itself was rolled back because the primary deployment model (embedded WordPress shortcode) is same-origin and does not need cross-origin auth. The standalone SPA path requires the app to be prepared for that deployment model first (routing, build config, deployment documentation, CORS policy). Revisit when there is a concrete standalone SPA deployment requirement.

**Effort:** High (2–4 days) | **Impact:** High for cross-origin standalone SPA deployments; Low for standard WordPress shortcode usage

---

### JWT Token Refresh (Frontend)

**Files:** `src/services/apiClient.ts`, `src/hooks/useAuth.ts`

Transparent silent refresh of the in-memory JWT access token before expiry via a `useTokenRefresh` hook that posts to `/mullion/v1/token/refresh`. **Blocked on the JWT In-Memory Token Auth work above** (requires the in-memory token architecture and the `/token/refresh` PHP endpoint to exist first). Standard nonce-auth deployments are unaffected.

**Effort:** Medium | **Impact:** Low — only relevant for standalone SPA JWT deployments

---

## Settings & Admin UI

> Two prior entries — "Admin Notice on Unresolved Shortcode Space Reference" and "Unify settings-write authorization behavior (space-panel silent drop vs. explicit 403)" — were promoted to [PHASE72_REPORT.md](PHASE72_REPORT.md) tracks **P72-D** and **P72-C** (2026-07-23) and removed from this backlog.

### Spaces Admin — UX Pass, Including Restore-Archived-Spaces

**Origin:** [PHASE75_REPORT.md](PHASE75_REPORT.md) § Follow-On Candidates, from track **P75-J** (2026-08-26). The restore gap is what forced P75-J's decision (a) — a slug collision with an archived space had to be resolved by suffixing (`test` → `test-2`) rather than by pointing the user at the archived original, because there is no way to see or restore one. Widened to a full UX pass at the user's direction after manual QA of P75-I/J: *"currently it's a bit cumbersome, for one selecting a space, then switching tabs to change its configuration."*

**Context:** `SpaceManagementView` (rendered both in the admin-panel modal and standalone on the WP-admin **Spaces** page) is a four-tab surface — Spaces / Settings / Access / Library — where three of the four tabs are `disabled` until a space is selected, and selection happens only by clicking a row in the Spaces tab's table. Every configuration action therefore costs a tab round-trip. The specific frictions, in the order a user meets them:

1. **Select-then-switch-tabs.** The table row is the only way to choose a space, and the row offers no entry point of its own — no per-row "Settings" / "Access" / "Library" action, no expandable detail. Configuring a space is always: Spaces tab → click row → click a different tab. Doing two spaces in a row means going back to Spaces and repeating.
2. **The Settings tab holds a single button.** Its whole body is one `Configure display settings` button that opens the `SettingsPanel` **Drawer**. A tab whose only content is a button that opens another surface is a level of indirection with nothing in it — three interactions (tab, button, drawer) to reach a setting.
3. **Row selection is a bare `<tr onClick>`.** No `role`, no `tabIndex`, no keyboard path, and the only selected-state affordance is a background tint (`--mantine-color-blue-light`) plus `cursor: pointer`. This is an a11y gap as much as a UX one — the primary control of the screen cannot be reached from the keyboard.
4. **Archived spaces are invisible and unrecoverable.** The table filters `!s.archived`, and no filter, toggle, or restore action exists. `Mullion_Space_Controller::list_spaces` already accepts `include_archived` and `format_space` already returns `archived`, so the data side is done; there is no unarchive endpoint and no UI.
5. **The archive affordance misdescribes its outcome.** The trash icon is tooltipped "Archive space" and notifies `Space "…" archived` — both accurate — but the row then disappears with no archive to visit, which reads as a delete. P75-J's ambiguous "Failed to create space" was surprising precisely because of this: the user believed the space was gone.
6. **The create form is always-expanded at the bottom of the table** (for system admins), so the list and the creation flow compete for the same scroll position, and the form grows further when Delegated mode is switched on (it adds an `Alert`).
7. **Data already fetched is not shown.** `format_space` returns `grantCount` and the requesting user's `effectiveLevel` per space; the table shows neither, so "which spaces have grants?" needs a per-space tab visit.

**What to implement:** Treat this as a redesign pass, not a patch list — the items above mostly follow from one decision (list-plus-tabs vs. list-plus-detail), so settle that first:

- **Pick the navigation model.** The likely shape is a master/detail: the Spaces list stays the left/primary column, and selecting a space opens a detail region that carries Settings / Access / Library as *its* tabs, so selection and configuration are not separated by a tab switch. Per-row quick actions (a menu, or icon buttons) that jump straight to a specific detail tab would remove the round-trip for the common case.
- **Collapse the Settings indirection** — either inline the settings form into the detail region, or drop the tab and make it a row action that opens the Drawer directly.
- **Restore-archived-spaces.** Add an "Archived" filter/toggle to the list (the `include_archived` query param exists), show archived rows visibly distinct, and add an unarchive path: a `POST /spaces/{id}/restore` (or a `PUT` accepting `archived: false`) gated on `space.update`, plus the mutation and cache-bust wiring. Decide what a restore does when the slug has since been claimed by a suffixed successor — the most likely answer is restore-under-a-new-slug with the same message P75-J's 409 uses, but it must be decided rather than discovered.
- **Rename the archive affordance** to match what it does now that an archive exists to visit (or keep "Archive" and let the archived view be the thing that makes it true).
- **Keyboard/a11y for row selection** — a real control (radio, button, or `role="row"` + `tabIndex` + key handling) with a visible focus ring, not a tinted `<tr>`.
- **Surface `grantCount` / `effectiveLevel`** in the list columns.

**Files:** `src/components/Admin/SpaceManagementView.tsx` (the whole surface), `src/components/Admin/SpaceManagementModal.tsx`, `src/components/Admin/SpaceAssetLibrary.tsx`, `src/services/adminQuery.ts` (`useSpaces`), `wp-plugin/mullion-gallery/includes/rest/class-mullion-space-controller.php` (restore endpoint), `wp-plugin/mullion-gallery/includes/class-mullion-permissions.php` (gate for it).

**Dependencies / risk:** The component has two mount points (admin-panel modal and the standalone WP-admin page) with different widths — a master/detail layout has to work in both, which is the main design constraint and the reason this is a pass rather than a quick fix. `SpaceManagementView.test.tsx` drives the current tab structure directly (`clickTab('Access')`, `selectSpace(name)`), so the suite will need rewriting alongside, not after. The restore endpoint is additive and independently shippable — it can land before the layout work if the UX decision stalls.

**Effort:** Medium-Large (Medium for the restore endpoint + archived filter alone) | **Impact:** Medium-High — Spaces is the top-level organizing concept of the plugin and its admin surface is the most-used multi-step flow; the archived-space gap is also a correctness-adjacent hole users can fall into (P75-J).

---

### Opt-In "Mirror the Theme" Mode for Gallery Content Styling

**Origin:** Raised while scoping [PHASE76_REPORT.md](PHASE76_REPORT.md) **P76-I** (2026-08-27), from the observation that the gallery's border settings are user-controlled *by design* — "as much control over how your gallery looks as possible" is the point of the product, so wiring those settings to the theme system automatically would be a mistake.

**Context:** There is currently **no** path from the theme system to gallery *content* styling, in either direction. The theme engine's tokens (`border`, `borderStrong`, `surface`, `primaryFill`, …) reach Mantine chrome via `adapter.ts` and the gallery shell via `--mullion-color-*`, but campaign cards, tiles, media, nav arrows, and the viewer are styled entirely from user settings with fixed defaults — `card_border_color` defaults to `#1ad1c4`, `tile_border_color` to `#ffffff`, and so on.

The nearest existing thing is not a precedent. `cardBorderMode` already selects a colour *source* — `'auto'` (the campaign's company `brandColor`), `'single'` (`settings.cardBorderColor`), `'individual'` (`campaign.borderColor`) — but none of the three consults the theme. `ResetLink` in the settings sections is a different axis entirely: it clears a responsive **breakpoint override** back to the desktop value, not to any theme.

So a site owner who picks a theme they like has no way to say "and make the gallery follow it" short of hand-copying hex values out of the theme and into a dozen settings, where they immediately go stale the moment the theme changes.

**What to implement:** An opt-in mode, per setting or per group, that *sources* the value from the active theme instead of from a stored constant. `cardBorderMode` shows the shape to copy: add a fourth mode (e.g. `'theme'`) alongside `auto` / `single` / `individual`, and generalise the same idea to the other content-styling colours.

**The design decision that matters: mirror, not copy.** A one-shot "Reset to theme" button that writes current theme values into the settings is the obvious implementation and the wrong one — the values are stale the instant the user switches theme, and nothing records that they were ever meant to track it. A *live* mode keeps the link, so changing theme restyles the gallery, and the user can drop back to a fixed colour whenever they want. It also keeps this compatible with the product's premise: mirroring is a choice the user makes and can revoke, not a default that quietly removes control.

Worth deciding at planning time: whether the granularity is per-field, per-group (all card colours), or a single global "gallery follows theme" switch; and which theme token each setting maps to (`card_border_color` → `primaryStroke`? `border`? `borderStrong`?), which is a design question per setting, not a mechanical one.

**Dependencies / risk:** Touches the settings schema (a new enum value or a companion "source" field per setting), the sanitizer, the PHP defaults, the adapter-fields schema, and the settings UI. The `adapterSettingsParity` guard will need the new keys. Space-level overrides and breakpoint overrides both already layer on these settings, so the resolution order — theme → setting → space override → breakpoint override — needs stating explicitly before implementation, not discovered during it. No accessibility coupling: **P76-I** deliberately does not depend on this, and its audit scope is theme-derived chrome only.

**Effort:** Medium-Large | **Impact:** Medium-High — it is the missing half of the theme feature. Themes currently restyle the admin and the gallery shell but stop at the content the user actually came to look at.

---

## Integration

### Third-Party OAuth Providers

**Context:** Authentication supports WP native + JWT. Google and GitHub OAuth would reduce friction for organizations whose members already have Google Workspace or GitHub accounts.

**Open questions:**
- Q1: Should OAuth be implemented directly in the plugin or via a WP OAuth hook (e.g. integrating with an existing OAuth plugin)? Direct implementation adds maintenance burden.
- Q2: The OAuth redirect lands on the WP host, not the embedding page — is a popup-window OAuth flow the right model when the gallery is embedded as a Web Component on a non-WP page?
- Q3: Which providers are highest priority? (Survey/feedback required before committing scope.)

**Effort:** High | **Impact:** Medium — valuable for SSO deployments, complex to implement correctly

---


### GraphQL API Alternative

**Context:** The REST API is adequate for the admin SPA but is verbose for external integrations that need only specific fields. A GraphQL endpoint allows consumers to request exactly the data they need.

**Open questions:**
- Q1: Is there sufficient external-integrator demand for a GraphQL API? This is a significant investment with unclear ROI unless there is a concrete use case.
- Q2: Build on `WPGraphQL` (broad adoption, reduces code) or a custom GraphQL endpoint (more control, adds a third-party dependency)?
- Q3: Would a GraphQL API make the REST API redundant, or would both coexist? Coexistence adds documentation and maintenance burden.

**Effort:** High | **Impact:** Low for current users, potentially High for ecosystem adoption

---

## Deferred Gallery Adapters

> **Origin:** Phase 8 brainstorm (P22). These gallery adapter concepts were identified as valuable additions but deferred from the active Phase 8 scope. They follow the existing `GalleryAdapterProps` contract and register via `registerAdapter` like all current adapters.

### Timeline Adapter
Chronological layout with items on alternating sides of a vertical center line. Date/caption labels at each node. Good for event-based or campaign-chronology galleries.
LOE: Medium | Impact: Low-Medium

### Grid with Variable Aspect-Ratio Tiles Adapter
Auto-assigns tile sizes (1×1, 2×1, 1×2, 2×2) based on media metadata (aspect ratio, resolution). Creates a densely packed, visually varied grid without manual configuration. Similar to Google Photos or Flickr's justified grid but with explicit CSS Grid tracks.
LOE: Medium-High | Impact: Medium

---

## Evaluation Criteria

When promoting future tasks to an active phase:

1. **User impact** — How many users does this affect, and how much does it improve their workflow?
2. **Implementation effort** — What is the realistic development time, including tests and documentation?
3. **Maintenance burden** — Does this add surface area that will need ongoing upkeep?
4. **Alignment with core mission** — Does this serve the gallery-management use case, or is it scope creep?
5. **Open questions resolved** — A task should not be promoted until its key design questions have answers.
6. **Dependencies satisfied** — Note which other features must ship first.

---

*Document created: February 1, 2026*
*Last updated: June 1, 2026 — Reconciled against current code and Phase 28 completions; removed shipped backlog items in two passes, moved promoted work fully into Phases 32–34, audited the remaining deferred review list, retired stale deferred entries (D-10, D-17, RD-4), removed entries queued into Phase 38, and kept the rest as long-tail reference material. Added D-15 (`get_campaigns_for_attachment_id` N+1 meta reads) from P38 PR review. Updated D-1 and JWT entries with P39-CO1/P39-AU1 deferral rationale after both tracks were rolled back — CORS restriction is unnecessary for the primary same-origin embedded WP use case.*

*Updated: June 3, 2026 (P39-CL1) — Removed "Webhook Support for Campaign Events" (shipped P39-IN1) and "Redis/Memcached Object Cache" (shipped P39-OC1); retired D-12 (rate-limiter object-cache docs, now covered by P39-OC1); added P39-IN1 and P39-OC1 to the ownership snapshot; updated Infrastructure & Performance section intro.*

*Updated: June 3, 2026 (P40-QA1) — Reconciled audit-domain backlog against Phase 40 outcome. "Audit Log Binary Export" (Campaign Management section) remains correctly deferred — `Mullion_Export_Engine` exists but the compliance use case is not yet active enough to justify promotion. No other audit-domain items require movement or promotion.*

*Updated: June 3, 2026 (P41-FT1) — Updated "Alignment Variants" (Builder section): P30-K (alignment spike) and P30-G (nested group hierarchy) are both complete as of Phase 30; removed the blocking-dependency language and marked the item as unblocked.*

*Updated: June 3, 2026 (P41-OL1/UN1/RD15) — D-2 (Overlay Library DB migration), D-5 (Pre-uninstall confirmation gate), and RD-15 (SlotPropertiesPanel IIFE extraction) marked complete; D-7 targeted for Phase 42.*

*Updated: June 3, 2026 (P42/P43 planning) — RD-2 targeted for Phase 43; line-count corrected from ~1822 to ~736 (heavy section components already extracted to `src/components/Settings/`); LOE revised to Medium (3-5 hours).*

*Updated: June 4, 2026 (P43/P44 planning) — D-7, RD-2, RD-9, RD-21 graduated to phase plans (PHASE42_REPORT.md, PHASE43_REPORT.md); Phase 44 audit plan created (PHASE44_REPORT.md).*

*Updated: June 4, 2026 (reorg) — Dissolved "Deferred Review Tasks" section; D-1, D-13, D-14, D-15, RD-17 moved to domain sections (Access Control, Infrastructure & Performance, Campaign Management); completed entries (D-2, D-5, RD-15) and already-addressed entries (D-10, D-17, RD-4) dropped.*

*Updated: June 7, 2026 (P47 planning) — Added "Gallery Spaces" section with four Phase 47 follow-on candidates: Cross-Space Campaign Move, Per-Instance Full-Bleed CSS Scoping, Per-Space Library Isolation (Overlays/Fonts), and Space-Scoped Rate-Limit Buckets.*

*Updated: June 7, 2026 (P46-D/E) — Auth components and Lightbox are now genuinely decoupled from all Mullion-internal imports. `safeLocalStorage`, `useSwipe`, and `scrollLock` moved from `@/utils/`/`@/hooks/` to `src/lib/`. `AuthBarFloating` Campaign type replaced with local generic `AuthBarCampaignItem`. The monorepo infrastructure step (npm workspaces, `packages/shared-utils/`, `packages/shared-ui/`) remains the open follow-on before actual npm package publication.*

*Updated: June 9, 2026 (P48 planning) — Promoted to Phase 48: "Accumulative Multi-File Selection with Per-File Preview" (P48-A), "Alignment Variants" (P48-B), "Per-Instance Full-Bleed CSS Scoping" (P48-C), "Space-Scoped Rate-Limit Buckets" (P48-D), "Audit Log Binary Export" (P48-E), "Media Library Binary Export" (P48-F), "Coverflow / 3D Adapter" (P48-G), "Mosaic / Pinterest Adapter" (P48-H). Retired as already shipped: "Spotlight / Hero Adapter" (`spotlight/SpotlightGallery.tsx`) and "Vertical Scroll Snap Adapter" (`scroll-snap/ScrollSnapGallery.tsx`) — both fully registered in `adapterRegistry.ts`.*

*Updated: June 9, 2026 (P49 planning) — Promoted to Phase 49: "Contributor Tooling & Documentation / Storybook" (P49-E), "Thumbnail Cache Index Scalability" (P49-F), "`get_campaigns_for_attachment_id()` N+1 Meta Reads" (P49-G). Developer Experience and Infrastructure & Performance sections removed as all entries are now promoted. Four new tracks promoted directly from planning suggestions (not previously in this doc): a11y audit (P49-A), bundle/perf audit (P49-B), i18n groundwork (P49-C), automated visual regression (P49-D).*

*Updated: June 9, 2026 (P50 planning) — Promoted to Phase 50: "Full Audit and Extraction to Shared Package" (P50-G), "Cross-Space Campaign Move" (P50-A), "Per-Space Library Isolation" (P50-B), "Service Worker Metadata Caching Enhancements" (P50-F), "Stacked / Deck Adapter" (P50-C), "Waterfall Adapter" (P50-E), "Isotope / Filterable Grid Adapter" (P50-D). Removed now-empty sections: Reusable Component / Utility Library, Gallery Spaces, Build & Bundle.*

*Updated: June 12, 2026 (P50-F follow-on) — Re-added Build & Bundle section with "Service Worker — Offline Support (App Shell Pattern)": deferred from P50-F after manual testing confirmed offline mode is unsupported by design (SW intentionally skips navigation/HTML caching to avoid stale-chunk failures after deploys). Full offline support requires a versioned app-shell cache with deploy-time busting.*

*Updated: June 17, 2026 (P54 planning) — Added the Phase 54 production-readiness review follow-ons (deferred from [PHASE54_REPORT.md](archive/phases/PHASE54_REPORT.md), which is tight must-fix only): four LayoutBuilder enhancements (Editor UX Polish, Responsive/Per-Breakpoint Editing, Text/Caption Layers, Design-Tool Affordances) under Builder, ordered by user priority; "Gallery — Admin-Control Additions"; a new Code Quality & Refactoring section (adapter data extraction / registration-seam / field-map unification; large-file decomposition); Internationalization (full admin i18n migration — P54-B does user-facing only); Accessibility (full WCAG AA — P54-C does the front-end critical/serious baseline); and Monetization & Distribution (licensing/update infra), cross-linked to the new [MONETIZATION_OPTIONS.md](MONETIZATION_OPTIONS.md).*

*Updated: June 23, 2026 (P55/P56/P57 planning) — Promoted the entire **Code Quality & Refactoring** section (adapter data-extraction / registration-seam / field-map unification + large-file decomposition) to [PHASE55_REPORT.md](archive/phases/PHASE55_REPORT.md); **Gallery — Admin-Control Additions** (all four pieces, incl. listing-mode exposure) to [PHASE56_REPORT.md](archive/phases/PHASE56_REPORT.md); and the two **Settings & Admin UI** items plus the LayoutBuilder **Design-Tool Affordances** (swatches/eyedropper, persistent guides, rotation handles) and the layer-search slice of **Editor UX Polish** to [PHASE57_REPORT.md](archive/phases/PHASE57_REPORT.md). Emptied sections (Code Quality & Refactoring, Settings & Admin UI) keep their headers with a "No tasks here yet" placeholder. Trimmed "Editor UX Polish" to its remaining deferred clipboard + alignment-shortcut pieces.*

*Updated: June 26, 2026 (P58–P61 planning) — Promoted LayoutBuilder **Editor UX Polish** → [PHASE58_REPORT.md](archive/phases/PHASE58_REPORT.md) P58-A, **Responsive / Per-Breakpoint Editing** → P58-B, and **Text / Caption Layers** → [PHASE59_REPORT.md](archive/phases/PHASE59_REPORT.md). Added four net-new LayoutBuilder tracks directly from planning (Starter Template Library, Marquee Multi-Select, Slot Entrance Animations, Auto-Grid Generator — P58-C/D/E/F). Added three new Builder backlog entries in their place (History Persistence, Reusable Symbol/Linked Slots, Slot Constraints/Pinning). Scoped the `.pot`/user-facing i18n slice and the admin-flow a11y slice into [PHASE60_REPORT.md](archive/phases/PHASE60_REPORT.md) P60-B/P60-D while keeping the **full** admin i18n migration and **full** WCAG AA audit deferred as the WP.org public-listing gate. Promoted **Licensing + Update Infrastructure** → [PHASE62_REPORT.md](PHASE62_REPORT.md) (Freemius premium target chosen); the free WP.org "lite" tier stays deferred.*

*Updated: June 26, 2026 (P58-A batch-1 execution) — Added Builder entry "LayoutBuilder — Align/Distribute Keyboard Shortcuts", deferred from [PHASE58_REPORT.md](archive/phases/PHASE58_REPORT.md) P58-A during implementation (binding scheme needs design); the remaining P58-A pieces — clipboard, slot opacity, nudge steps — ship in batch 1.*

*Updated: June 29, 2026 (P58-B execution) — Added two Builder entries deferred from [PHASE58_REPORT.md](archive/phases/PHASE58_REPORT.md) P58-B: "Published Responsive Canvas Sizing (Breakpoint Render Model)" (the on-page sizing / progressive-shrink problem needs a manual-testing pass + careful planning) and "Faithful Preview (Breakpoint Render + Runtime Effects)" (align the builder Preview path with the published render and surface glow/bounce/entrance/tilt effects in Preview).*

*Updated: July 10, 2026 (P62 freemium expansion) — The distribution model expanded from premium-only to **freemium** (free WP.org "lite" build + premium via Freemius). Promoted **Full WCAG AA Audit** → [PHASE62_REPORT.md](PHASE62_REPORT.md) P62-H and **Store Listing Artwork** → P62-I and **removed both from the queue** (the Accessibility and Monetization & Distribution sections are now empty placeholders); the previously-deferred free WP.org "lite" tier is now **in scope** as P62-F–I (spike → code split → WCAG AA → WP.org submission).*

*Updated: July 11, 2026 (P62-H) — Added Accessibility entry "Structural a11y (axe) gate — grow coverage + fix found issues", deferred from P62-H after the component axe harness landed (the automatable half; the manual AT audit is a separate human task). Concrete backlog seeded from the harness's first findings in `LayoutTemplateList`.*

*Updated: June 30, 2026 (P59-A execution) — Added Builder entry "LayoutBuilder — Clickable / Linking CTA Text Layer", deferred from [PHASE59_REPORT.md](archive/phases/PHASE59_REPORT.md) per user direction — Phase 59 ships single-style, non-interactive text layers; the linking/CTA variant (href + accessible anchor rendering + URL control) is split off as a follow-on.*

*Updated: June 30, 2026 (P59-D planning) — Added Code Quality & Refactoring entry "Roll Out `UnitScrubField` to Remaining Ad Hoc Numeric/Unit Inputs", deferred from [PHASE59_REPORT.md](archive/phases/PHASE59_REPORT.md) P59-D per user direction — P59-D itself stays scoped to `TypographyEditor`'s fields; the rotation-scrub migration and a broader Settings/LayoutBuilder sweep are future-tasked.*

*Updated: July 5, 2026 (P60 post-phase PR review) — Added Internationalization entry "i18n Review Follow-Ons — Sentence Composition + Locale Re-Translation", deferred from the [PHASE60_REPORT.md](archive/phases/PHASE60_REPORT.md) post-phase code-review pass: `ArchiveCompanyModal` sentence-fragment composition (needs `<Trans>`) and re-translating the four changed media-import toast strings across the five packs (fold in the `ru_RU` 3-plural). Both English-safe; the review's material fix (i18next colon-key resolution) shipped on-branch.*

*Updated: July 18, 2026 (Phase 65 post-landing PR review) — Added three Campaign Management entries deferred from the [PHASE65_REPORT.md](PHASE65_REPORT.md) "Post-Landing PR Review & Fix Pass": "Campaign-Filtered Media Export Misses Pre-Phase-65 ZIP-Imported Campaigns" (legacy sideloaded media lacks `attachmentId`, narrow/consistent with an existing `media_orphans()` limitation), "Binary Campaign Export Downloads Non-File URLs for Embed/External Media" (a deeper, pre-existing gap surfaced while verifying the embedUrl/provider fix — video/embed items don't meaningfully round-trip through the ZIP transport), and "Consolidate Duplicated Sanitization / Truncation-Flag Logic in the Campaign IO / Export Paths" (four small reuse findings, no correctness bug). The two actual bugs found in that review (binary import dropping `embedUrl`/`provider`; multi-campaign batch export filename mismatch) were fixed on-branch, not deferred here.*

*Updated: July 23, 2026 (Phase 72 planning) — Created [PHASE72_REPORT.md](PHASE72_REPORT.md) (Planned, 7 mixed-domain tracks). **Promoted and removed from this backlog:** "WordPress Core Privacy Integration (DSAR Export/Erase)" → P72-B, "Retention / Auto-Purge for Email & Audit-Log Tables" → P72-F, "Admin Notice on Unresolved Shortcode Space Reference" → P72-D, "Unify settings-write authorization behavior" → P72-C (Settings & Admin UI is now an empty placeholder), "`AdminPanel.tsx` — Extract the Remaining Tab-State Concerns" → P72-E, and the `LayoutTemplateList`-fix half of "Structural a11y (axe) gate — grow coverage + fix found issues" → P72-G (the "extend coverage further" half stays here, retitled). **Backfilled** (Follow-On Candidates from Phases 68-70 that were never recorded here — found while verifying the backlog is current, cross-checked every archived phase report's Follow-On Candidates table against this doc): "Full Server-Driven `CardGallery` Host Pagination" (PHASE68_REPORT.md, under Campaign Management), "Google Fonts Self-Host Variant" (PHASE69_REPORT.md, under Privacy & Compliance), "`ApiClient` Facade → Namespaces" and "Promote Inline Sub-Components" (both PHASE70_REPORT.md, under Code Quality & Refactoring) — none of the four were promoted into Phase 72, since each is explicitly conditional/opportunistic in its own origin phase's deferral rationale, not bounded phase-shaped work.*

*Updated: August 27, 2026 (P76-I-1) — Added Code Quality & Refactoring entry "Three e2e specs fail on a clean tree", found while verifying P76-I-1 and confirmed pre-existing against an unmodified tree. Not deferred work from Phase 76; filed so a permanently-red e2e floor has an owner.*

*Updated: August 28, 2026 (P76-I-2 decision) — Added Accessibility entry "Two-Tone (Halo) Focus Ring", deferred from P76-I-2 after Option A (re-point the ring at `primaryStroke`) was selected. Recorded as a complementary layer on top of A, not a competing option; Options B (lift `primaryFill`) and C (accept the gap) were dropped outright and are deliberately not carried here.*

*Updated: August 28, 2026 (P76-I-2 implementation) — Added Code Quality & Refactoring entry "`global.scss` rules aimed at portaled admin chrome are dead in shadow mode", found while implementing the focus-ring override and confirmed by measuring which selectors reach `document.styleSheets`. Two rules are affected (`select-option[data-selected]`, `tabs-tab`); fixing them changes appearance, so it is deliberately not folded into P76-I-2.*
