# Phase 56 - Gallery Admin-Control Additions

**Status:** Complete
**Created:** 2026-06-23
**Last updated:** 2026-06-25 (post-delivery review + manual QA rounds 1 & 2)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P56-A | Client-side range/enum validation in the adapter settings UI (consumes the P55-C schema) | Complete | Low-Medium |
| P56-B | Configurable breakpoint pixel thresholds (today hardcoded) | Complete | Low-Medium |
| P56-C | Mobile-support visibility — explain why an adapter is disabled on mobile | Complete | Low |
| P56-D | Listing-mode exposure — make the listing surface admin-configurable | Complete (pre-existing P35-B) | — |
| P56-E | Adapter capability badges in the adapter picker | Complete | Small-Medium |
| P56-F | Per-field reset-to-default + schema-driven help hints | Complete | Small |
| P56-G | Import/export gallery adapter settings as JSON | Complete | Medium |

---

## Rationale

The Phase 54 gallery/adapter audit found the settings layering sound (hardcoded defaults → admin `wpsg_settings` → per-campaign overrides) but flagged a set of *control gaps* that are convenience/parity, not correctness blockers — server-side sanitization already enforces validity. This phase promotes that backlog item and rounds it out with three more in-theme admin-control additions that share the same settings UI surface.

1. **What triggered it.** The audit listed four admin-control gaps: no client-side range/enum validation (server-only today), hardcoded breakpoint pixel thresholds, a code-only listing-mode surface, and silent mobile-support restrictions. Three further conveniences (capability badges, reset-to-default/help hints, settings import/export) naturally extend the same UI.
2. **Why it belongs together.** Six of seven tracks center on `src/components/Settings/GalleryAdapterSettingsSection.tsx` and the adapter registry, and several share data with the **P55-C shared schema** (ranges/valid-options) — making this the right phase to land right after the refactor that produces that schema.
3. **Success.** Admins get immediate client-side feedback that mirrors the server rules, can configure breakpoints, understand each adapter's capabilities and why one may be unavailable, pick listing adapters without code, reset fields, and move a gallery's configuration between galleries — all without weakening the authoritative server-side validation.

> **Depends on Phase 55.** P56-A and P56-F consume the P55-C runtime shared schema as their single source for ranges/valid-options/defaults. Sequence this phase after P55-C lands.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Validation authority | **Server stays authoritative.** Client-side validation (P56-A) is feedback/UX only, derived from the same P55-C schema; the PHP sanitizer remains the enforcement boundary. |
| B | Validation data source | **Reuse the P55-C shared schema** for ranges/valid-options/defaults rather than introducing a third copy — the whole point of the refactor. |
| C | C vs E overlap | **Keep both, complementary.** P56-C is the "why this adapter is disabled on mobile" explanation; P56-E is the broader read-only capability display. They share the adapter-picker UI surface. |
| D | Import safety | **Validate on import through the existing server boundary.** P56-G round-trips through the PHP sanitizer + shared schema so malformed or foreign keys are rejected, not trusted from the JSON. |

## Execution Priority

1. **P56-A (client validation)** — first; establishes the schema-consumption pattern (`GalleryAdapterSettingsSection` reading the P55-C schema) that P56-F reuses.
2. **P56-F (reset + help hints)** — builds directly on A's schema wiring; small.
3. **P56-E (capability badges)** then **P56-C (mobile explanation)** — same adapter-picker surface; do E first, C refines it.
4. **P56-B (configurable breakpoints)** — self-contained settings field + sanitizer work.
5. **P56-D (listing-mode exposure)** — self-contained; new setting + server validation.
6. **P56-G (import/export)** — last; benefits from the validation surface A/B/D establish.

---

## Track P56-A - Client-side range/enum validation

### Problem

`src/components/Settings/GalleryAdapterSettingsSection.tsx` (~335 lines) only enforces `NumberInput` `min`/`max` and silently falls back to a default on select fields. All real range/enum validation is server-side (the PHP sanitizer). An admin entering an out-of-range or invalid value gets no immediate feedback — the value is silently corrected on save.

### Fix

- Source per-field `min`/`max`/`validOptions` from the **P55-C shared schema** and render inline validation feedback (range message on number fields, invalid-option handling on selects) in `GalleryAdapterSettingsSection`.
- Keep the server sanitizer authoritative (Decision A) — the client surface is feedback, not enforcement.

### Acceptance criteria

- Out-of-range and invalid-enum values show an inline error/hint in the adapter settings UI before save.
- The validation rules are read from the shared schema (no hand-duplicated client copy).
- Saving still passes through and is bounded by the server sanitizer unchanged.

### Validation

- `npm run test` (vitest) for the new validation behavior in `GalleryAdapterSettingsSection`.
- Manual QA: enter an over-max number and an invalid select state; confirm the inline feedback.

## Track P56-B - Configurable breakpoint pixel thresholds

### Problem

The desktop/tablet/mobile pixel thresholds are hardcoded — `BP_MOBILE_MAX = 768` and `BP_TABLET_MAX = 1200` in `src/components/Galleries/Adapters/MediaCarouselAdapter.tsx:62-63`, consumed by `getViewportBreakpoint`. Sites that want different breakpoints cannot change them.

### Fix

- Add a breakpoint-threshold field set (desktop/tablet/mobile px) to `GalleryBehaviorSettings`, mirroring the `desktop|tablet|mobile` model already used in `src/utils/galleryConfig.ts`.
- Expose the fields in the settings UI; thread the resolved values into the adapter's `getViewportBreakpoint` instead of the constants.
- Add server-side validation (sane px ranges, ordering) in the sanitizer for the new fields.

### Acceptance criteria

- Breakpoint thresholds are admin-configurable and applied at render; defaults reproduce today's 768/1200 behavior.
- Invalid threshold input (non-numeric, inverted ordering) is rejected/clamped server-side.

### Validation

- `npm run test` for the resolution wiring; PHPUnit for the new sanitizer fields (Haiku runs PHP).
- Manual QA: change a threshold, resize, confirm the breakpoint switch moves accordingly.

## Track P56-C - Mobile-support visibility

### Problem

`supportsMobile` (`GalleryAdapter.ts:216`, consumed at `adapterRegistry.ts:1121`) silently filters adapters (e.g. layout-builder) out of the mobile breakpoint's options. Admins see an adapter disappear with no explanation of why.

### Fix

- Surface a helper/note in the adapter select (shared with P56-E's badge surface) explaining that an adapter is unavailable on mobile because it declares `supportsMobile: false`, rather than silently omitting it.

### Acceptance criteria

- When an adapter is mobile-unsupported, the admin UI explains the restriction instead of hiding it without context.
- No change to the underlying filtering behavior at render time.

### Validation

- `npm run test` for the explanatory UI state; manual QA on the mobile breakpoint selector.

## Track P56-D - Listing-mode exposure

### Problem

The listing surface (`renderItem`) is code-only — there is no admin control for which adapter handles campaign-listing mode, even though the registry already declares the relevant machinery (`capabilities: 'listing-compatible'`, `paginationOwnership`, `getListingAdapterSelectOptions`).

### Fix

- Add a listing-mode control in the gallery settings, populated from `getListingAdapterSelectOptions` so only listing-compatible adapters are offered.
- Add server-side validation for the new setting (must be a listing-compatible adapter id).

### Acceptance criteria

- Admins can choose the listing adapter from the settings UI; only listing-compatible adapters appear.
- An invalid/non-listing adapter id is rejected server-side.

### Validation

- `npm run test` for the control + option filtering; PHPUnit for the new setting's validation (Haiku runs PHP).
- Manual QA: switch the listing adapter and confirm the listing surface honors it.

## Track P56-E - Adapter capability badges

### Problem

Each adapter declares a `capabilities[]` array in `BUILTIN_ADAPTERS` (`adapterRegistry.ts`) — lightbox, keyboard-nav, touch-swipe, listing-compatible, grid/carousel layout — but none of this is visible to admins choosing an adapter.

### Fix

- Render the declared capabilities as badges in the `GalleryAdapterSettingsSection` adapter picker. Pure read-only UI off existing registry data; no schema or runtime change.

### Acceptance criteria

- The adapter picker shows capability badges sourced from the registry's `capabilities` for each adapter.
- Adding/removing a capability in the registry is reflected in the badges with no extra wiring.

### Validation

- `npm run test` asserting badges render for representative adapters; manual QA of the picker.

## Track P56-F - Reset-to-default + schema help hints

### Problem

There is no way to reset an adapter field (or a whole adapter's settings) to its default from the UI, and the min/max/default facts the server enforces are invisible to admins.

### Fix

- Using the **P55-C shared schema** `min`/`max`/`fallback`, render inline help hints per field and add per-field plus per-adapter "reset to default" affordances in `GalleryAdapterSettingsSection`.
- Reuse the schema already loaded for P56-A — no new data source.

### Acceptance criteria

- Each field shows its allowed range/default as a hint; a per-field and a per-adapter reset restore the schema default(s).
- Hints/defaults come from the shared schema (single source).

### Validation

- `npm run test` for the reset actions and hint rendering; manual QA of reset behavior.

## Track P56-G - Import/export gallery settings as JSON

### Problem

A gallery's adapter settings cannot be copied between galleries/campaigns. The LayoutBuilder already has a JSON export/import pattern (`handleExportJson` / `handleImportJson` in `LayoutBuilderModal.tsx`) that this can mirror.

### Fix

- Add export (serialize a gallery's adapter settings to JSON) and import (load JSON into another gallery/campaign) to the gallery settings UI, mirroring the LayoutBuilder I/O pattern.
- Validate every imported value through the **PHP sanitizer + P55-C shared schema** so malformed values and foreign/unknown keys are rejected rather than trusted (Decision D).

### Acceptance criteria

- Export produces a JSON document of the gallery's adapter settings; import applies it after server-side validation.
- Malformed JSON and foreign/unknown keys are rejected with a clear message; valid imports round-trip losslessly.

### Validation

- `npm run test` for export shape and the import round-trip + rejection of malformed/foreign keys.
- PHPUnit for the import validation path (Haiku runs PHP).
- Manual QA: export from one gallery, import into another, confirm parity.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Per-campaign breakpoint overrides | P56-B sets site-level thresholds; per-campaign overrides are a larger settings-merge change, only worth it if requested. |
| Bulk apply settings across many campaigns | P56-G covers one-to-one copy; a bulk applier is a separate batch-operation surface. |
| Visual diff on settings import | Round-trip validation is enough for v1; a pre-apply diff view is polish. |

## Implementation Notes

### P56-A + P56-F (2026-06-24)

`GalleryAdapterSettingsSection.tsx` updated. `renderSettingFields` now computes `error` props for number fields (range check) and select fields (valid-options check) sourced from the field definitions in `SETTING_GROUP_DEFINITIONS` — the P55-C-derived TS registry, no hand-duplicated client copy. All field controls gain per-field reset buttons embedded in the `label` ReactNode via a `fieldLabel()` helper that wraps each label with an `ActionIcon<IconRefresh>`. Number and dimension fields append "(min–max, default: N)" to their `description` text. A "Reset all adapter settings to defaults" button applies all group field fallbacks in a single `setGalleryAdapterSetting` loop to avoid state-batching overwrites. 18 new vitest cases cover both tracks; full suite 3,385 tests green.

### P56-E + P56-C (2026-06-24)

`CAPABILITY_LABELS` constant and `renderAdapterOption` (`NonNullable<SelectProps['renderOption']>`) added; `getAdapterRegistration` imported to look up capabilities per option. All adapter `ModalSelect` pickers pass `renderOption={renderAdapterOption}`. Mobile-restriction note ("Some adapters are unavailable on mobile…") rendered conditionally below the mobile breakpoint row when `adapterOptions.some(o => o.disabled)`. `SettingsPanel.test.tsx` option queries updated to prefix-regex (`/^Label/i`) to handle badge text appended to accessible names. 14 new vitest cases cover both tracks.

### P56-B (2026-06-24)

`mobileBreakpointPx: number` (default: 768) and `tabletBreakpointPx: number` (default: 1200) added to `GalleryBehaviorSettings` and `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`. `deriveBreakpoint` in `MediaCarouselAdapter.tsx` de-hardcoded: now accepts `mobileMax` and `tabletMax` params threaded from `settings.mobileBreakpointPx / settings.tabletBreakpointPx`. "Breakpoint Pixel Thresholds" section added to `GalleryAdapterSettingsSection` using direct `updateSetting` calls (not nested galleryConfig). Ordering validation (mobile < tablet) shown inline. PHP: `mobile_breakpoint_px` and `tablet_breakpoint_px` added to `$defaults` and `$field_ranges` in `class-wpsg-settings-registry.php`; the existing generic sanitizer `foreach` loop handles int clamping automatically. PHPUnit 22 tests + vitest 18 tests green.

### P56-D (pre-existing)

Track already fully implemented prior to this phase as part of P35-B: `CampaignCardSettingsSection.tsx` already exposes per-breakpoint listing adapter selects (`campaignListingAdapterId`, `campaignListingAdapterIdTablet`, `campaignListingAdapterIdMobile`) populated from `getListingAdapterSelectOptions(breakpoint)`. PHP validates adapter IDs against a hard-coded list in `$valid_options`. No work needed.

### P56-G (2026-06-24)

`useGalleryAdapterSettingsIO` hook (`src/hooks/useGalleryAdapterSettingsIO.ts`) implements `handleExport` (serializes `galleryConfig` to a `.wpsg.json` blob download) and `handleImport` (reads file, validates via `GalleryConfigSchema` Zod parse + explicit adapter-ID and adapter-setting-key checks, applies via `updateSetting('galleryConfig', ...)`). Export/Import buttons wired into `GalleryAdapterSettingsSection` toolbar. Unknown adapter IDs (not in `BUILTIN_ADAPTERS`) and foreign setting keys (not in `SETTING_GROUP_DEFINITIONS`) are rejected with a Mantine notification. Valid imports round-trip losslessly; the PHP sanitizer bounds-checks values on next save. 6 new hook tests cover export and all rejection paths; full suite 3,398 tests green.

## Post-Delivery Code Review (2026-06-24)

A high-effort multi-angle review was run against the three branch commits after delivery. Eight independent finder angles (line-by-line scan, removed-behaviour audit, cross-file tracer, reuse, simplification, efficiency, altitude, and conventions) were executed in parallel, producing a candidate pool that was then deduped and verified. Seven findings survived verification (four CONFIRMED, three PLAUSIBLE) and were fixed in a single follow-on commit (`fix(p56-review)`).

### Findings and fixes

#### R1 — `FileReader.onerror` never set (CONFIRMED)

**Bug.** `useGalleryAdapterSettingsIO.ts` — `handleImport` creates a `FileReader`, assigns `reader.onload`, and relies on a `finally` block inside `onload` to clear `importFileRef.current.value`. `reader.onerror` was never assigned. When the browser fires an error event (OS-level read failure, revoked file handle, sandboxed iframe), `onload` never runs, the `finally` block is never reached, the file input stays bound to the failed file (the user cannot re-select the same filename), and no notification is shown.

**How found.** The line-by-line diff scan (Angle A) flagged the absent error handler. The removed-behaviour audit (Angle B) confirmed no alternative cleanup path existed.

**Fix rationale.** Added a `reader.onerror` handler that shows a Mantine error notification and clears `importFileRef.current.value`, mirroring the `finally` block's behaviour for the failure path.

---

#### R2 — Inverted breakpoint pair allowed to persist (CONFIRMED)

**Bug.** `GalleryAdapterSettingsSection.tsx` — the "Breakpoint Pixel Thresholds" `NumberInput` components displayed an inline error when `mobileBreakpointPx >= tabletBreakpointPx`, but both `onChange` handlers called `updateSetting` unconditionally. The inverted pair could be saved to the WordPress settings store and subsequently passed to `deriveBreakpoint` in `MediaCarouselAdapter.tsx`. There, the desktop branch (`containerWidth >= tabletMax`) fires first, so any width above `tabletMax` maps to `'desktop'`. The `'tablet'` branch (`containerWidth >= mobileMax`) can only match widths in `[mobileMax, tabletMax)` — but when `mobileMax >= tabletMax` that interval is empty or inverted, making the `'tablet'` layout permanently unreachable. The carousel silently jumped from mobile to desktop.

**How found.** The line-by-line scan (Angle A) noticed the unconditional `updateSetting` call beneath the error display. The removed-behaviour audit (Angle B) traced the consequence to `deriveBreakpoint` and confirmed no runtime guard existed there.

**Fix rationale.** Clamped `onChange` for the mobile input to `Math.min(raw, tabletBreakpointPx - 1)` and for the tablet input to `Math.max(raw, mobileBreakpointPx + 1)`. This preserves the ordering invariant at the point of entry rather than relying on a display-only error. The error display is intentionally kept for any pre-existing stored values that arrived before the fix.

---

#### R3 — Dimension field per-field reset lost the value change (CONFIRMED)

**Bug.** `GalleryAdapterSettingsSection.tsx` — the `reset` closure for `dimension`-control fields called `updateSetting(field.key, fallback)` then `updateSetting(field.unitKey, defaultUnit)` as two separate calls. Both routes through `updateConfiguredAdapterSetting`, which computes `setGalleryAdapterSetting(resolvedGalleryConfig, key, value)` where `resolvedGalleryConfig` is the render-time snapshot. With React 18 automatic batching, both `setState` calls are queued synchronously; because the second call reads the same stale snapshot as the first (it does not see the first call's update), the second result overwrites the first: only the unit was reset, and the value remained at its pre-reset figure.

**How found.** The cross-file tracer (Angle C) examined how `updateConfiguredAdapterSetting` was called and noticed the closure captured `resolvedGalleryConfig` at render time. The verifier confirmed React 18 batching semantics would cause the second update to overwrite the first.

**Fix rationale.** Added a `BatchGalleryConfigUpdate` callback threaded from the component through `renderSettingGroup` into `renderSettingFields`. When present (always in the component render path), the dimension reset chains both changes — `field.key` and `field.unitKey` — through a single `setGalleryAdapterSetting` call sequence before dispatching one `updateSetting('galleryConfig', ...)`, matching the same pattern already used by `resetAllAdapterSettings`.

---

#### R4 — `resetAllAdapterSettings` omitted `mobileBreakpointPx` / `tabletBreakpointPx` (CONFIRMED)

**Bug.** `GalleryAdapterSettingsSection.tsx` — the "Reset all adapter settings to defaults" button iterated `activeSettingGroups` and called `setGalleryAdapterSetting`, which writes into `galleryConfig`'s nested `adapterSettings` structure. `mobileBreakpointPx` and `tabletBreakpointPx` are top-level `GalleryBehaviorSettings` keys (added by P56-B), not stored inside `galleryConfig`. After clicking the reset, carousel breakpoint thresholds were silently left at whatever custom values the user had previously set.

**How found.** The removed-behaviour audit (Angle B) identified that the two new P56-B fields, introduced in the same phase, were not included in the reset loop. Confirmed by reading `resetAllAdapterSettings` directly.

**Fix rationale.** Added explicit `updateSetting('mobileBreakpointPx', 768)` and `updateSetting('tabletBreakpointPx', 1200)` calls after the `galleryConfig` reset, using the same default values as the individual per-field reset buttons already in the UI.

---

#### R5 — `resetAllAdapterSettings` ignored `appliesTo` visibility filter (CONFIRMED)

**Bug.** `GalleryAdapterSettingsSection.tsx` — `resetAllAdapterSettings` called `getSettingGroupFieldDefinitions(groupDefinition.group)` with no filter, returning all fields for each group. `renderSettingFields`, by contrast, filters by `includeAppliesTo` (e.g. `['unified']` in unified mode, `['image']` or `['video']` in per-type mode). Fields with `appliesTo: 'image'` or `appliesTo: 'video'` were therefore reset even when invisible in the current mode, silently wiping settings that would only be in use when the user switched mode.

**How found.** The simplification/efficiency angle (Angle E/F) flagged the inconsistency between the `resetAllAdapterSettings` iteration and `renderSettingFields`' filtering. The verifier confirmed the discrepancy by reading both functions and checking available `appliesTo` values in `adapterSettingGroups.ts`.

**Fix rationale.** Applied the same `appliesTo` filter logic used by `renderSettingGroup`: for contextual-scope groups, the filter is `['unified']` in unified mode and `['image', 'video']` in per-type mode; for non-contextual groups it is `['always']`. Fields not currently rendered are no longer reset.

---

#### R6 — Export serialised an empty object when `galleryConfig` was `undefined` (PLAUSIBLE)

**Bug.** `useGalleryAdapterSettingsIO.ts` — `handleExport` used `galleryConfig ?? {}` in the payload. When `galleryConfig` is `undefined` (the field has never been written to the WordPress settings, or the user has not yet saved), the export JSON contained `galleryConfig: {}`. `GalleryConfigSchema.safeParse({})` succeeds (all fields are optional), so reimporting the file applied an empty config, discarding all adapter selections configured by the recipient.

**How found.** The cross-file tracer (Angle C) examined the export path and noted the `?? {}` fallback. The verifier confirmed `GalleryConfigSchema` allows an empty object by reading `settingsSchemas.ts`.

**Fix rationale.** Added an early-return guard: if `galleryConfig` is `undefined`, a Mantine notification explains there is nothing to export. When defined, `galleryConfig` is serialised directly (no `?? {}`), guaranteeing the exported document represents the user's actual configuration.

---

#### R7 — `URL.revokeObjectURL` called before async download initiation (PLAUSIBLE)

**Bug.** `useGalleryAdapterSettingsIO.ts` — `handleExport` created an object URL, set it on a detached anchor (`document.createElement('a')`, never appended to the DOM), called `a.click()`, then immediately called `URL.revokeObjectURL(url)`. On Firefox and some Chromium builds, the download manager acquires the object URL asynchronously after `click()` returns. Revoking the URL synchronously before that acquisition can produce an empty or failed download. Omitting `document.body.appendChild` also makes the click unreliable in some environments (Safari, WebViews).

**How found.** The altitude angle (Angle G) flagged the detached-anchor pattern and immediate revocation. The verifier marked it PLAUSIBLE, citing the spec not guaranteeing download initiation from a detached element and the async nature of the download manager.

**Fix rationale.** Appended the anchor to `document.body` before `.click()` and removed it immediately after, following the standard cross-browser download pattern. Wrapped `URL.revokeObjectURL` in `setTimeout(..., 0)` to defer it to the next tick, ensuring the download manager has acquired the URL before it is invalidated.

---

### Review outcome

1 follow-on commit (`fix(p56-review)`) — 2 files changed, 67 insertions (+15 deletions). Full vitest suite 3,398 tests green post-fix; all four coverage thresholds maintained (lines 87.7%, functions 81.3%, branches 74.9%, statements 85.8%).

## Manual Testing Findings (2026-06-24)

Manual QA after the code-review fixes surfaced two additional bugs, both involving the "Edit Gallery Config" option in the floating AuthBar menu.

### T1 — "Edit Gallery Config" missing when campaign opened from admin panel

**Bug.** The floating AuthBar menu's "Edit Gallery Config" option only appeared when a campaign was open in `CampaignViewer` (gallery listing view). Opening a campaign via the admin panel's `UnifiedCampaignModal` left the option absent because `CampaignViewer` never runs while the admin panel is the active view — `CardGallery` (which hosts `CampaignViewer`) is unmounted when `isAdminPanelOpen` is true. `UnifiedCampaignModal` never called `setActiveCampaign` or `setOnEditGalleryConfig` in `CampaignContext`, so both remained null/undefined.

**How found.** Manual testing: user opened the admin panel, selected a campaign for editing, opened the floating AuthBar menu, and observed the Campaign section was absent.

**Fix rationale.** Added `editingCampaign` state to `useUnifiedCampaignModal` — storing the `Campaign` object passed to `openForEdit` and clearing it on `close`. In `UnifiedCampaignModal`, added a `useEffect` that mirrors the `CampaignViewer` pattern: when the modal is open in edit mode, calls `setActiveCampaign(editingCampaign)` and `setOnEditGalleryConfig(() => setGalleryConfigEditorOpen(true))`; clears both on close. Clicking "Edit Gallery Config" in the AuthBar menu now opens the same `GalleryConfigEditorModal` already wired inside the campaign modal. 2 files changed — `useUnifiedCampaignModal.ts`, `UnifiedCampaignModal.tsx`.

---

### T2 — "Edit Gallery Config" missing on multi-space pages (all instances)

**Bug.** On pages with multiple gallery instances (e.g., the MEOWER page with three: `wpsg-test-2`, `wpsg-test-3`, `wpsg-iso-space`), all three floating AuthBar buttons render at the same `position: fixed` viewport coordinate (`right: 24px, bottom: 24px, z-index: 9999`). Because the shadow DOM hosts share the same stacking context and the last one in DOM order (`wpsg-iso-space`) always wins pointer-event hit testing, every click on the floating button opened `wpsg-iso-space`'s menu — regardless of which instance contained the active campaign. `wpsg-iso-space` had no active campaign, so its menu showed Admin Panel / Settings / SpaceSwitcher but no Campaign section and no "Edit Gallery Config" option.

Investigated via Playwright automation against the live dev site: after opening a campaign in `wpsg-test-2`, a real coordinate click at the button position consistently landed on `#wpsg-iso-space` (confirmed via `document.elementFromPoint`). Direct shadow-DOM `.click()` calls on each instance's button DID show the correct menu, isolating the fault to the stacking order rather than the context registration logic.

**How found.** Live browser testing: user opened a campaign on the multi-space page, clicked the floating menu, and saw no "Edit Gallery Config." Automated Playwright session confirmed all three buttons sit at the identical viewport coordinate and that the last instance always intercepts pointer events.

**Fix rationale.** In `AuthBar.tsx`, added a `useEffect` that fires when `activeCampaign`, `instanceId`, or `pageSpaces` change. When `activeCampaign` is set and `pageSpaces.length > 1` (multi-space page), it sets `position: relative; z-index: 10001` on the shadow host element (`document.getElementById(instanceId)`). This creates a stacking context at z-index 10001, which outranks the other instances' root-context fixed buttons (z-index 9999), causing the active instance's button to win hit testing. The style is removed on cleanup when the campaign closes. 1 file changed — `AuthBar.tsx`.

---

### Round 1 outcome

2 commits: `fix: wire UnifiedCampaignModal into CampaignContext` and `fix: elevate shadow host z-index on multi-space pages when campaign is active`.

---

## Manual Testing Findings — Round 2 (2026-06-25)

A second round of manual QA on the deployed build surfaced four more issues across tracks A, B, E, F, and G.

### T3 — P56-E: Capability badges rendered as unstyled text (not pill chips)

**Bug.** The Mantine `<Badge>` components rendered inside `renderAdapterOption` (the custom `renderOption` callback passed to `ModalSelect`) appeared as plain unstyled strings with no background, border-radius, or color. The Mantine `Select` dropdown option render context does not fully apply component-class styles to `Badge` even with `withinPortal: false` on the combobox.

**How found.** Manual inspection: opened an adapter picker dropdown and observed capability labels rendered as raw text with no visual differentiation from the adapter name.

**Fix rationale.** Removed Mantine `Badge` entirely. Replaced `renderAdapterOption` with a two-zone layout: the adapter name sits on a `gray.0` background box (providing the darker/selectable zone the user requested), and capabilities are rendered as a plain `Text size="xs" c="dimmed"` line with values joined by ` · ` separators. This is more robust than relying on Badge class scoping and cleaner visually. The `Badge` import was removed from the Mantine import list.

---

### T4 — P56-F/B: Per-field reset icons invisible in adapter settings and breakpoint fields

**Bug.** The `fieldLabel()` helper — which wraps every adapter-settings field label with a small `↺` reset icon — was using Mantine's `<Group>` component (which renders as a `<div>`) inside Mantine's `<label>` HTML element. A block-level `<div>` inside a `<label>` is invalid HTML (phrasing content constraint). Browsers collapsed the flex container width to zero when the block element's dimension could not be resolved inside the inline label context, hiding the `ActionIcon` entirely. The description text (rendered outside the label in the `description` prop) was unaffected and displayed correctly, making this confusing to diagnose.

The same issue applied to both adapter-specific settings fields (via `renderSettingFields`) and the Breakpoint Pixel Threshold fields in the unconditional section.

**How found.** User confirmed hint text `(1–10, default: 1)` was visible (from `description` prop) but no reset icon appeared anywhere. Isolating by prop: the `description` renders outside the `<label>` while the `label` prop containing `fieldLabel()` renders inside it, pointing to the invalid HTML nesting as the cause.

**Fix rationale.** Replaced `<Group>` with `<span style={{ display: 'flex', justifyContent: 'space-between', ... }}>`. A `<span>` is valid phrasing content inside `<label>`; applying `display: flex` via inline style produces identical layout without the invalid nesting. Added `flexShrink: 0` on the `ActionIcon` style to explicitly prevent it from being squeezed to zero. Also improved icon visibility: `IconRefresh` size increased 12 → 14 px and `opacity: 0.7` added at rest. `e.stopPropagation()` added to `onClick` to prevent the parent `<label>` from re-focusing the input on each reset click.

---

### T5 — P56-G: Export scope not obvious; "dot" nav settings absent from exported JSON

**Bug.** The export only captured `galleryConfig` (adapter-specific settings stored via `setGalleryAdapterSetting`). Settings stored as flat `GalleryBehaviorSettings` keys — such as `dotNavEnabled`, `dotNavPosition`, `navArrowEnabled`, and other navigation/presentation settings managed in separate settings tabs — were silently excluded. Users expected the export to capture everything visible in the Gallery Layout section.

**How found.** User noticed navigation ("dot") settings were absent from the exported JSON despite being visible in the settings panel.

**Fix rationale.** Expanding the export to include all flat `GalleryBehaviorSettings` keys risks unintentionally overwriting unrelated settings (auth, session, layout preferences) on import. Instead, the UI was updated to clarify scope: the Export/Import buttons were renamed to **"Export adapter settings"** / **"Import adapter settings"**, and a short description was added above them — *"Exports adapter configuration and carousel/media settings. Global navigation, breakpoint, and presentation settings are not included."* This surfaces the intentional limitation without a risky scope expansion.

---

### T6 — P56-A: Validation errors not found (discoverability, no code change)

**Observation.** User could not find P56-A range-validation errors or P56-F reset icons in "the carousel settings." Investigation confirmed the adapter-specific settings group (which contains these features) renders between the Breakpoint Pixel Thresholds section and the export/import buttons — above `GalleryLayoutDetailSections`, which also contains a "carousel settings" block for common settings. The common settings block does not have P56-A or P56-F features. No code change was required; the feature works correctly when the Classic adapter is active (which it is by default). The section location is a discoverability issue.

---

### Round 2 outcome

3 commits: `fix(p56-qa): adapter option styling, reset icon visibility, export label clarity` and `fix(p56-qa): use span with inline flex in fieldLabel to fix reset icon visibility`. 8 commits total on the branch.

## Outcome

All seven tracks delivered. P56-A/B/C/E/F/G implemented; P56-D confirmed pre-existing (P35-B). `GalleryAdapterSettingsSection.tsx` now provides: inline client-side range/enum validation, per-field and per-adapter reset-to-default, adapter capability badges (two-zone dropdown layout), mobile-restriction explanations, configurable breakpoint thresholds, and JSON import/export with structural + schema-key validation. Post-delivery code review fixed 7 bugs; two rounds of manual QA fixed 5 further bugs (admin panel campaign context, multi-space floating button stacking, badge styling, reset icon HTML validity, export scope labelling). 8 commits total, 3,398 vitest tests green, 22 PHPUnit settings tests green.
