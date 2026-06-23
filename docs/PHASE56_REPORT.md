# Phase 56 - Gallery Admin-Control Additions

**Status:** Planned
**Created:** 2026-06-23
**Last updated:** 2026-06-23

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P56-A | Client-side range/enum validation in the adapter settings UI (consumes the P55-C schema) | Planned | Low-Medium |
| P56-B | Configurable breakpoint pixel thresholds (today hardcoded) | Planned | Low-Medium |
| P56-C | Mobile-support visibility — explain why an adapter is disabled on mobile | Planned | Low |
| P56-D | Listing-mode exposure — make the listing surface admin-configurable | Planned | Medium |
| P56-E | Adapter capability badges in the adapter picker | Planned | Small-Medium |
| P56-F | Per-field reset-to-default + schema-driven help hints | Planned | Small |
| P56-G | Import/export gallery adapter settings as JSON | Planned | Medium |

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

- Record completed work here as tracks land; keep it factual.
- A–F center on `GalleryAdapterSettingsSection.tsx`; coordinate edits to avoid churn (do A's schema wiring first, then reuse it).
- PHP test/build execution is delegated to Haiku subagents; tests are authored in this repo.

## Outcome

_To be completed when the phase lands._
