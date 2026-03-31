# Phase 24 — Flat-Field Deprecation, Gallery Selection Parity & UX Fixes

**Status:** Complete
**Version:** v0.23.0
**Created:** March 30, 2026
**Last updated:** March 31, 2026

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P24-A | Flat-to-nested gallery field deprecation | Completed ✅ | Large (2-4 days) |
| P24-B | Per-breakpoint gallery adapter selection parity | Completed ✅ | Medium-Large (1-2 days) |
| P24-C | Theme live preview and selection UX | Completed ✅ | Medium (0.5-1 day) |
| P24-D | Gallery config editor accessibility | Completed ✅ | Medium (0.5-1 day) |
| P24-E | Deferred review cleanup | Completed ✅ | Small-Medium (0.5 day) |

---

## Table of Contents

- [Phase 24 — Flat-Field Deprecation, Gallery Selection Parity \& UX Fixes](#phase-24--flat-field-deprecation-gallery-selection-parity--ux-fixes)
    - [Tracks](#tracks)
  - [Table of Contents](#table-of-contents)
  - [Rationale](#rationale)
  - [Key Decisions (Pre-Resolved)](#key-decisions-pre-resolved)
  - [Architecture Decisions](#architecture-decisions)
  - [Execution Priority](#execution-priority)
  - [Track P24-A — Flat-to-Nested Gallery Field Deprecation COMPLETE](#track-p24-a--flat-to-nested-gallery-field-deprecation-complete)
    - [Problem](#problem)
    - [Fix](#fix)
    - [Subtasks](#subtasks)
    - [Files to modify](#files-to-modify)
    - [Acceptance criteria](#acceptance-criteria)
  - [Track P24-B — Per-Breakpoint Gallery Adapter Selection Parity COMPLETE](#track-p24-b--per-breakpoint-gallery-adapter-selection-parity-complete)
    - [Problem](#problem-1)
    - [Fix](#fix-1)
    - [Subtasks](#subtasks-1)
    - [Files to modify](#files-to-modify-1)
    - [Acceptance criteria](#acceptance-criteria-1)
  - [Track P24-C — Theme Live Preview and Selection UX COMPLETE](#track-p24-c--theme-live-preview-and-selection-ux-complete)
    - [Problem](#problem-2)
    - [Fix](#fix-2)
    - [Subtasks](#subtasks-2)
    - [Files to modify](#files-to-modify-2)
    - [Acceptance criteria](#acceptance-criteria-2)
  - [Track P24-D — Gallery Config Editor Accessibility COMPLETE](#track-p24-d--gallery-config-editor-accessibility-complete)
    - [Problem](#problem-3)
    - [Fix](#fix-3)
    - [Subtasks](#subtasks-3)
    - [Files to modify](#files-to-modify-3)
    - [Acceptance criteria](#acceptance-criteria-3)
  - [Track P24-E — Deferred Review Cleanup COMPLETE](#track-p24-e--deferred-review-cleanup-complete)
    - [Problem](#problem-4)
    - [Fix](#fix-4)
    - [Subtasks](#subtasks-4)
    - [Files to modify](#files-to-modify-4)
    - [Acceptance criteria](#acceptance-criteria-4)
  - [Testing Strategy](#testing-strategy)
    - [Automated](#automated)
    - [Manual verification](#manual-verification)
  - [Planned File Inventory](#planned-file-inventory)
    - [Primary implementation targets](#primary-implementation-targets)
    - [Phase 24 docs](#phase-24-docs)
  - [Addendum — Theme Preview Debugging Deep Dive](#addendum--theme-preview-debugging-deep-dive)
    - [Symptoms We Saw](#symptoms-we-saw)
    - [What We Tried First](#what-we-tried-first)
    - [What Did Not Work and Why](#what-did-not-work-and-why)
    - [What Actually Worked](#what-actually-worked)
    - [Testing Approaches Used](#testing-approaches-used)
    - [PR Review Follow-Up (PR #39)](#pr-review-follow-up-pr-39)

---

## Rationale

Phase 23 introduced the nested responsive `galleryConfig` model alongside the legacy flat adapter fields (`imageGalleryAdapterId`, `videoGalleryAdapterId`, `desktopImageAdapterId`, etc.) as a deliberate bridge strategy. That bridge has been validated: the nested model now drives the shared editor, runtime resolver, and backend sanitization. It is time to complete the transition by deprecating the flat fields and resolving the remaining UI gaps that Phase 23 deferred.

There are four concrete problems this phase addresses:

1. **Flat-field debt.** Every settings save still writes legacy flat fields alongside nested `galleryConfig`. The adapter registry, resolver, and bridge utilities carry duplicate code paths just to keep both representations in sync. This increases surface area for new bugs and makes future gallery changes more expensive.

2. **Inconsistent per-breakpoint selection.** The Settings panel exposes per-breakpoint adapter selection only in per-type mode, but not in unified mode. The Campaign Edit modal has no per-breakpoint selectors at all — only flat quick selectors. Users must open the full responsive editor for any breakpoint-level campaign customization, making the quick selectors misleading.

3. **Broken theme UX.** The theme selector always displays "Default Dark" regardless of the actual saved theme, and theme changes do not take effect visually until the page is saved and reloaded. Live preview on selection was an original design goal.

4. **Gallery config editor access friction.** Editing campaign gallery settings requires navigating to Admin Panel → Edit Campaign → Settings Tab → Edit Responsive Config. There is no direct access from within the CampaignViewer while actively viewing a campaign, despite the auth bar already providing "Edit Campaign" and "Manage Media" shortcuts.

Additionally, two deferred review items (D-16: settings sanitization consolidation, RD-6: window.confirm replacement) are directly relevant to the settings pipeline changes in this phase.

---

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | Flat-field removal strategy | **Stop writing, keep reading.** Phase 24 stops writing legacy flat adapter fields on save. The read path retains flat-field fallback for one additional release cycle so sites that downgrade do not lose their configuration. Full removal of the read path is deferred to Phase 25. |
| B | Per-breakpoint unified mode | **Always breakpoint.** Unified gallery mode gets the same 3-breakpoint selector grid as per-type mode. The "Unified" vs "Per Breakpoint" toggle in Settings is removed — breakpoint selection is the only mode. |
| C | Campaign quick selectors | **Match Settings.** Campaign Edit inherits the same always-breakpoint selection grid as the global Settings panel, with "Default (inherited)" as the clearable default for each cell. |
| D | Theme preview behavior | **Live preview on selection, persist on save.** Selecting a theme immediately applies it to the UI via `setPreviewTheme()`. Saving persists to backend + localStorage. Canceling reverts to the previously saved theme. |
| E | Gallery config viewer access | **Auth bar menu + optional toolbar icon.** Add "Edit Gallery Config" to the auth bar campaign menu for all admin users. Optionally surface an icon button in the CampaignViewer header when admin controls are visible. |

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | Remove flat-field writes before removing flat-field reads | Allows a rollback window: if a site downgrades to v0.22.0, the nested data is authoritative and the stale flat fields are ignored by the resolver. |
| AD-2 | Keep `gallerySelectionMode` setting only for legacy sites | Sites that have never opened the new editor keep their flat-field behavior. Once settings are saved with the new editor, the selection mode is retired. |
| AD-3 | ThemeSelector becomes a controlled component | The component must accept a `value` prop from the settings state and use context only for preview application, not for display value. |
| AD-4 | Campaign gallery config access uses the existing auth bar menu pattern | No new UI surface (floating icon, toolbar) is needed if the auth bar menu already has the right affordances. An icon shortcut is additive polish, not a requirement. |

---

## Execution Priority

1. **P24-C** Theme live preview and selection UX — isolated, no dependencies, quick win
2. **P24-D** Gallery config editor accessibility — isolated, no dependencies, quick win
3. **P24-B** Per-breakpoint gallery adapter selection parity — sets up the UI that flat-field deprecation will simplify
4. **P24-A** Flat-to-nested gallery field deprecation — largest track, benefits from P24-B being done first
5. **P24-E** Deferred review cleanup — can run in parallel with P24-A subtasks

---

## Track P24-A — Flat-to-Nested Gallery Field Deprecation COMPLETE

### Problem

The current settings pipeline writes both legacy flat adapter fields and nested `galleryConfig` on every save. The compatibility bridge in `mergeSettingsWithDefaults()`, the flat-to-nested builder in `buildGalleryConfigFromLegacySettings()`, the campaign adapter normalization in `normalizeCampaignLegacyAdapterFields()`, and the flat-field projection in the SettingsPanel save handler all exist solely to keep two representations in sync. This duplication:

- Doubles the validation surface for gallery changes.
- Makes it easy to introduce inconsistencies when adding new adapter fields.
- Prevents the resolver from trusting a single source of truth.
- Bloats the settings REST payload with redundant flat keys.

### Fix

Deprecate flat gallery adapter fields in three phases:

1. **Stop writing.** Remove flat-field projection from the global settings save path and campaign save path. The nested `galleryConfig` / `galleryOverrides` becomes the only written representation.
2. **Migrate on read.** When loading settings, if `galleryConfig` is empty or missing but flat fields are present, promote the flat fields into nested form (one-time migration per installation). Write the result back on the next explicit save.
3. **Mark for removal.** Add deprecation markers (`@deprecated`) to flat-field types, defaults, and registry entries. Document the removal timeline (Phase 25).

Completed implementation summary:

- Global settings now save nested `galleryConfig` only; legacy flat gallery keys are removed from the outbound payload and pruned from stored options when nested config is posted.
- Campaign create/update now save nested `galleryOverrides` only; legacy flat campaign adapter meta remains readable for migration and is deleted on the next nested override save.
- Load paths promote legacy flat settings and campaign adapter overrides into nested config before runtime resolution, while still rehydrating flat compatibility values in memory for current editor surfaces.
- Resolver/runtime logic now treats nested config as authoritative, with legacy fallbacks limited to migration and one-release compatibility reads.

### Subtasks

| # | Subtask | Description |
|---|---------|-------------|
| A1 | Remove flat-field writes from Settings save | Stop `SettingsPanel` from projecting nested gallery state back into legacy flat keys on save. The REST payload should contain only `galleryConfig`. |
| A2 | Remove flat-field writes from Campaign save | Stop `UnifiedCampaignModal` from syncing flat `imageAdapterId` / `videoAdapterId` on campaign create/update. Campaigns already persist `galleryOverrides`. |
| A3 | Add one-time migration on settings load | In `mergeSettingsWithDefaults()`, detect when `galleryConfig` is empty but flat adapter fields are populated. Build nested config from flat fields and flag for write-back. |
| A4 | Add one-time migration on campaign load | In campaign REST read handler or `mapCampaignFromResponse()`, detect when `galleryOverrides` is empty but flat adapter meta is populated. Promote to nested form. |
| A5 | Prune flat-field bridge from resolver | Remove `buildGalleryConfigFromLegacySettings()` fallback from the resolver chain. Resolver trusts nested config as the sole source. |
| A6 | Remove flat-field sync utilities | Delete `normalizeCampaignLegacyAdapterFields()`, `syncCampaignScopeAdapterOverride()` flat-field side effects, and related bridge helpers that exist only for two-way sync. |
| A7 | Deprecation markers | Add `@deprecated` JSDoc tags to flat adapter field types in `src/types/index.ts`, flat defaults in `class-wpsg-settings-registry.php`, and flat post meta in `class-wpsg-cpt.php`. |
| A8 | Backend flat-meta compatibility | Keep registered post meta for `imageAdapterId` and `videoAdapterId` so existing DB rows are readable. Do not write them in `apply_campaign_meta()`. |
| A9 | Update tests | Update frontend and backend tests that assert flat-field round-trip behavior. Add migration-path tests for flat-only → nested promotion. |
| A10 | Documentation | Update `GALLERY_CONFIG_DATA_MODEL.md` and `GALLERY_CONFIG_UI_FLOW.md` with deprecation notes. |

### Files to modify

**Frontend:**
- `src/components/Admin/SettingsPanel.tsx` — remove flat projection on save
- `src/components/Campaign/UnifiedCampaignModal.tsx` — remove flat-field sync in form state
- `src/utils/mergeSettingsWithDefaults.ts` — add migration-on-load
- `src/utils/campaignGalleryOverrides.ts` — prune flat-field sync helpers
- `src/utils/resolveAdapterId.ts` — remove flat-field fallback from resolver
- `src/types/index.ts` — add @deprecated markers to flat adapter types
- Test files for the above

**Backend:**
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` — stop writing flat adapter meta on campaign save; add read-migration
- `wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php` — deprecation markers on flat post meta
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php` — deprecation markers
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php` — prune flat-field sanitization
- Test files for the above

### Acceptance criteria

- Global settings save payload does not contain flat adapter keys.
- Campaign create/update payloads do not contain flat `imageAdapterId` / `videoAdapterId` in REST body.
- Sites with existing flat-only settings are promoted to nested config on first load.
- Sites with existing flat-only campaign meta are promoted to `galleryOverrides` on first load.
- Resolver produces identical effective config before and after migration.
- All existing tests pass or are updated to reflect nested-only semantics.
- Flat field types and registry entries carry `@deprecated` markers.

---

## Track P24-B — Per-Breakpoint Gallery Adapter Selection Parity COMPLETE

### Problem

Gallery adapter selection is inconsistent across contexts:

1. **Settings > Gallery Layout (unified mode):** Shows a single `unifiedGalleryAdapterId` selector covering all breakpoints. There is no way to choose different unified adapters per breakpoint without opening the full responsive editor.

2. **Settings > Gallery Layout (per-type mode):** Has a "Unified" vs "Per Breakpoint" toggle. In "Unified" mode, shows single image/video selectors. In "Per Breakpoint" mode, shows a 3×2 grid (desktop/tablet/mobile × image/video). This toggle is confusing — "unified" here means "same adapter across breakpoints," not "unified gallery mode."

3. **Campaign Edit modal:** Shows only flat quick selectors — one selector for unified mode, or one each for image/video in per-type mode. No per-breakpoint grid at all. Breakpoint-level overrides require opening the separate "Edit Responsive Config" modal.

The result is that users cannot set breakpoint-specific adapters from the primary selection surfaces. The quick selectors are misleading because they suggest adapter choice is a single global decision, when the architecture already supports per-breakpoint configuration.

### Fix

Make per-breakpoint selection the standard adapter selection UX everywhere:

1. **Unified mode:** Show a 3×1 grid (desktop/tablet/mobile) with a single unified adapter selector per breakpoint.
2. **Per-type mode:** Show a 3×2 grid (desktop/tablet/mobile × image/video) with separate selectors per breakpoint and scope.
3. **Both Settings and Campaign Edit:** Use the same breakpoint grid layout. Campaign selectors default to "Inherited" (clearable) while Settings selectors default to `classic`.
4. **Remove the "Unified / Per Breakpoint" toggle** from Settings per-type mode. Breakpoint selection is always active.

### Subtasks

| # | Subtask | Description |
|---|---------|-------------|
| B1 | Unified mode breakpoint grid in Settings | Replace the single `unifiedGalleryAdapterId` selector in `GalleryAdapterSettingsSection` with a 3×1 breakpoint grid (desktop/tablet/mobile) for unified adapters. Write to `galleryConfig.breakpoints[bp].unified.adapterId`. |
| B2 | Remove selection mode toggle in Settings | Remove the `gallerySelectionMode` SegmentedControl from `GalleryAdapterSettingsSection`. Per-type mode always shows the 3×2 breakpoint grid. Keep the per-type "Unified" flat selector path only as a migration fallback for sites that have not yet saved with the new grid. |
| B3 | Per-breakpoint campaign quick selectors (unified) | In `UnifiedCampaignModal`, replace the single unified adapter quick selector with a 3×1 breakpoint grid. Each cell is clearable with placeholder "Inherited." |
| B4 | Per-breakpoint campaign quick selectors (per-type) | In `UnifiedCampaignModal`, replace the flat image/video quick selectors with a 3×2 breakpoint grid. Each cell is clearable with placeholder "Inherited." |
| B5 | Update nested config write path | Ensure breakpoint grid selections write directly to `galleryConfig.breakpoints[bp].{scope}.adapterId` for global settings and `galleryOverrides.breakpoints[bp].{scope}.adapterId` for campaigns. |
| B6 | Prune stale selection mode code | Remove `gallerySelectionMode` from settings types, defaults, registry, and sanitizer after the UI no longer references it. |
| B7 | Update tests | Update `GalleryAdapterSettingsSection` and `UnifiedCampaignModal` tests to cover breakpoint grid rendering and per-cell value changes. |

### Files to modify

- `src/components/Settings/GalleryAdapterSettingsSection.tsx` — replace unified selector + selection mode toggle with breakpoint grids
- `src/components/Campaign/UnifiedCampaignModal.tsx` — replace flat quick selectors with breakpoint grids
- `src/types/index.ts` — deprecate `gallerySelectionMode`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php` — deprecate `gallerySelectionMode`
- Test files for the above

### Acceptance criteria

- Settings unified mode shows a 3×1 breakpoint grid for adapter selection.
- Settings per-type mode shows a 3×2 breakpoint grid without a selection mode toggle.
- Campaign Edit shows the corresponding breakpoint grid (3×1 or 3×2) with "Inherited" defaults.
- Breakpoint grid selections write to nested `galleryConfig` / `galleryOverrides` directly.
- The `gallerySelectionMode` setting is deprecated and no longer referenced in active UI code.
- Tests cover breakpoint grid rendering, value changes, and inherited-mode clearing.

---

## Track P24-C — Theme Live Preview and Selection UX COMPLETE

### Problem

Two bugs affect the theme selection experience:

1. **"Always says Default Dark."** The `ThemeSelector` component reads its displayed value from `useTheme().themeId` (the context state) rather than from the settings data. When the settings state has `theme: 'solarized-dark'` but the context initialized from localStorage with `default-dark`, the dropdown shows the wrong value. The component is uncontrolled — it never receives a `value` prop synced with settings.

2. **"Doesn't switch until save and reload."** The theme is only persisted to context (and thus applied to the UI) inside the save handler via `setTheme()`. Selecting a theme in the dropdown calls `setPreviewTheme()` on the context, which should apply a temporary preview, but the visual effect is broken because the component's local state and the context state diverge.

**Root cause summary:**
- `ThemeSelector` initializes local state from `useTheme().themeId` on mount and never syncs with the `settings.theme` value from SettingsPanel.
- `GeneralSettingsSection` does not pass a `value` prop to `ThemeSelector`.
- The `SettingsData` TypeScript interface does not include `theme`, leading to unsafe type coercion in the save handler.

### Fix

1. Make `ThemeSelector` a controlled component: accept a `value` prop that overrides local state.
2. Pass `settings.theme` from `GeneralSettingsSection` into `ThemeSelector` as the `value` prop.
3. On selection change, call `setPreviewTheme()` for immediate visual application AND call `onThemeChange()` to update settings state.
4. On save, persist the settings-state theme value to context via `setTheme()` (already happens).
5. On cancel/close, revert the preview to the previously saved theme.
6. Add `theme` to the `SettingsData` interface and remove the unsafe type coercion in the save path.

### Subtasks

| # | Subtask | Description |
|---|---------|-------------|
| C1 | Make ThemeSelector controlled | Add `value?: string` prop to `ThemeSelector`. When provided, use it as the display value instead of context `themeId`. |
| C2 | Pass settings.theme to ThemeSelector | In `GeneralSettingsSection`, pass `value={settings.theme}` and `onThemeChange` to `ThemeSelector`. |
| C3 | Live preview on selection | On dropdown change, call `setPreviewTheme(value)` for immediate context update (visual preview) and `onThemeChange(value)` for settings state update. |
| C4 | Revert preview on cancel | When SettingsPanel is closed without saving, call `setPreviewTheme(null)` or `setTheme(savedTheme)` to revert the visual preview to the last persisted theme. |
| C5 | Add theme to SettingsData type | Add `theme?: string` to the `SettingsData` interface. Remove the `as unknown as Record<string, unknown>` coercion in the save handler. |
| C6 | Update tests | Add/update ThemeSelector tests for controlled mode, live preview on change, and revert on cancel. |

### Files to modify

- `src/components/Admin/ThemeSelector.tsx` — accept and use `value` prop
- `src/components/Settings/GeneralSettingsSection.tsx` — pass `value={settings.theme}`
- `src/components/Admin/SettingsPanel.tsx` — revert preview on cancel, add `theme` to `SettingsData`
- Test files for the above

### Acceptance criteria

- Theme dropdown displays the actual saved theme, not "Default Dark."
- Selecting a theme immediately applies it visually (live preview).
- Saving persists the theme; canceling reverts to the previously saved theme.
- No unsafe type coercions remain in the theme save/load path.
- Tests cover controlled display, live preview, and cancel reversion.

---

## Track P24-D — Gallery Config Editor Accessibility COMPLETE

### Problem

Two access issues limit the usefulness of the shared Gallery Config editor:

1. **"Edit Responsive Config" in Campaign Edit may appear non-functional.** The button correctly sets `galleryConfigEditorOpen` to `true`, which lazy-loads and opens `GalleryConfigEditorModal`. However, users report it "does nothing." Possible causes: the lazy Suspense fallback is `null` (no loading indicator), the modal may fail to render in the campaign context, or there may be a race condition between Suspense resolution and Mantine modal animation.

2. **No gallery config access from CampaignViewer.** When viewing a campaign, the auth bar floating menu offers "Edit Campaign" and "Manage Media" but not "Edit Gallery Config." Admins must navigate to Admin Panel → Edit Campaign → Settings Tab → Edit Responsive Config — four clicks from the viewer. The original Phase 23 design goal was that campaign gallery settings should be editable from the campaign context.

### Fix

1. **Add a loading indicator** to the Suspense fallback when lazy-loading the gallery config editor from campaign edit. If the modal fails to open, investigate and fix the underlying cause.
2. **Add "Edit Gallery Config" to the auth bar campaign menu** so admins can open the gallery config editor directly from CampaignViewer without navigating to the admin panel.
3. **Optionally**, add a subtle gear/config icon to the CampaignViewer header area that opens the same editor (parallel access path for discoverability).

### Subtasks

| # | Subtask | Description |
|---|---------|-------------|
| D1 | Diagnose "Edit Responsive Config" non-response | Test the campaign modal's lazy-loaded gallery config editor in a fresh wp-env environment. If Suspense fallback `null` causes a perceived no-op, add a `<Loader>` fallback. If the modal genuinely fails, trace and fix the render path. |
| D2 | Add loading indicator for lazy editor | Replace `<Suspense fallback={null}>` with `<Suspense fallback={<Center><Loader /></Center>}>` in `UnifiedCampaignModal` and `SettingsPanel` lazy editor entry points for consistent feedback. |
| D3 | Add "Edit Gallery Config" to auth bar menu | In `AuthBarFloating.tsx`, add a new button under the Campaign section that opens the `GalleryConfigEditorModal` for the active campaign. Requires threading a callback from the CampaignViewer context or lifting the modal to the viewer level. |
| D4 | Wire gallery config modal from viewer | Mount a lazy `GalleryConfigEditorModal` at the `CampaignViewer` level, controlled by state set from the auth bar menu callback. The modal receives the campaign's `galleryOverrides` and saves through the existing campaign update API. |
| D5 | Update tests | Add coverage for the auth bar gallery config entry point and the lazy-load indicator. |

### Files to modify

- `src/components/Campaign/UnifiedCampaignModal.tsx` — add Suspense Loader fallback
- `src/components/Admin/SettingsPanel.tsx` — add Suspense Loader fallback
- `src/components/Auth/AuthBarFloating.tsx` — add "Edit Gallery Config" menu item
- `src/components/CardViewer/CampaignViewer.tsx` — mount gallery config editor modal, wire auth bar callback
- Test files for the above

### Acceptance criteria

- "Edit Responsive Config" in Campaign Edit visibly opens the gallery config editor or shows a loading indicator.
- Auth bar campaign menu in CampaignViewer includes "Edit Gallery Config" for admin users.
- Gallery config editor opened from CampaignViewer correctly loads and saves the campaign's gallery overrides.
- Lazy-load fallbacks show a loading indicator in all entry points.

---

## Track P24-E — Deferred Review Cleanup COMPLETE

### Problem

Two deferred review items from the PHP and React implementation reviews are directly relevant to the Phase 24 settings pipeline:

1. **D-16: Consolidate Settings Sanitization to Generic Handler.** There are 150+ redundant per-field sanitization blocks in the settings pipeline. Phase 23 introduced schema-driven nested sanitization, but the flat-field sanitization still has many one-off blocks. With flat fields being deprecated, this is the right time to consolidate.

2. **RD-6: Replace `window.confirm` with Mantine Modal.** Several admin components use native `window.confirm()` for destructive actions. This is jarring in a Mantine-based UI and does not match the design language of the Gallery Config editor's reset/clear actions.

### Fix

1. Consolidate flat-field sanitization blocks into the generic handler. As flat fields are deprecated (P24-A), many of these blocks can simply be removed rather than consolidated.
2. Replace `window.confirm()` calls in admin components with Mantine `modals.openConfirmModal()` using the Mantine modals manager.

### Subtasks

| # | Subtask | Description |
|---|---------|-------------|
| E1 | Audit remaining per-field sanitization blocks | Identify which flat-field sanitization blocks in `class-wpsg-settings-sanitizer.php` are made redundant by P24-A deprecation vs which cover still-active non-gallery settings. |
| E2 | Remove redundant flat-gallery sanitization | Delete sanitization blocks for deprecated flat gallery adapter fields. |
| E3 | Consolidate remaining sanitization | Where non-gallery settings still have one-off sanitization blocks, merge into the generic handler using the existing registry metadata (valid_options, field_ranges). |
| E4 | Audit window.confirm usage | Find all `window.confirm` calls in the frontend codebase. |
| E5 | Replace with Mantine modals | Replace each `window.confirm` with `modals.openConfirmModal()` or an equivalent Mantine confirmation dialog. |
| E6 | Update tests | Update PHP sanitization tests and frontend interaction tests for the new confirmation modals. |

### Files to modify

**Backend:**
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php` — consolidate/remove blocks
- `wp-plugin/wp-super-gallery/tests/WPSG_Settings_Test.php` — update assertions

**Frontend:**
- `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` — replace window.confirm
- `src/components/Admin/LayoutBuilder/BuilderKeyboardShortcuts.test.tsx` — verify confirm modal flow

### Acceptance criteria

- No redundant per-field sanitization blocks remain for deprecated flat gallery fields.
- Non-gallery settings use the generic handler where possible.
- No `window.confirm()` calls remain in admin UI components.
- All confirmation dialogs use Mantine's modal system.
- Tests cover the consolidated sanitization path and confirm modal interactions.

---

## Testing Strategy

### Automated

**Frontend:**
- Breakpoint grid rendering tests for `GalleryAdapterSettingsSection` (unified 3×1, per-type 3×2)
- Breakpoint grid rendering tests for `UnifiedCampaignModal` quick selectors (unified 3×1, per-type 3×2)
- ThemeSelector controlled mode tests (display, preview, revert)
- Gallery config editor lazy-load indicator tests
- Auth bar gallery config menu entry tests
- Flat-to-nested migration path tests (empty nested + populated flat → nested promotion)
- Resolver tests with nested-only data (no flat fallback)

**Backend:**
- Settings save payload no longer contains flat adapter keys
- Campaign save payload no longer contains flat adapter meta
- Settings load migration: flat-only → nested promotion
- Campaign load migration: flat-only → nested promotion
- Sanitizer consolidation coverage

### Manual verification

- Open Settings > Gallery Layout in unified mode — verify 3×1 breakpoint grid
- Open Settings > Gallery Layout in per-type mode — verify 3×2 breakpoint grid, no toggle
- Open Edit Campaign — verify breakpoint grids match mode
- Select a theme — verify live preview and correct dropdown value
- Cancel settings — verify theme reverts
- View a campaign — verify auth bar has "Edit Gallery Config" option
- Click "Edit Gallery Config" from viewer — verify modal opens and saves
- Upgrade from v0.22.0 with flat-only config — verify auto-migration

---

## Planned File Inventory

### Primary implementation targets

| File | Track | Change |
|------|-------|--------|
| `src/components/Settings/GalleryAdapterSettingsSection.tsx` | P24-B | Breakpoint grids, remove toggle |
| `src/components/Campaign/UnifiedCampaignModal.tsx` | P24-A, P24-B | Remove flat sync, add breakpoint grids |
| `src/components/Admin/ThemeSelector.tsx` | P24-C | Controlled component |
| `src/components/Settings/GeneralSettingsSection.tsx` | P24-C | Pass value prop |
| `src/components/Admin/SettingsPanel.tsx` | P24-A, P24-C | Remove flat projection, theme type, Suspense fallback |
| `src/components/Auth/AuthBarFloating.tsx` | P24-D | Gallery config menu item |
| `src/components/CardViewer/CampaignViewer.tsx` | P24-D | Mount gallery config editor |
| `src/utils/mergeSettingsWithDefaults.ts` | P24-A | Migration-on-load |
| `src/utils/campaignGalleryOverrides.ts` | P24-A | Prune flat-field sync |
| `src/utils/resolveAdapterId.ts` | P24-A | Remove flat fallback |
| `src/types/index.ts` | P24-A, P24-B, P24-C | Deprecation markers, type updates |
| `wp-plugin/.../class-wpsg-rest.php` | P24-A | Stop flat meta writes, add read migration |
| `wp-plugin/.../class-wpsg-cpt.php` | P24-A | Deprecation markers |
| `wp-plugin/.../settings/class-wpsg-settings-registry.php` | P24-A, P24-B | Deprecation markers |
| `wp-plugin/.../settings/class-wpsg-settings-sanitizer.php` | P24-A, P24-E | Prune/consolidate |

### Phase 24 docs

| File | Purpose |
|------|---------|
| `docs/PHASE24_REPORT.md` | This document |
| `docs/GALLERY_CONFIG_DATA_MODEL.md` | Updated with deprecation notes (P24-A10) |
| `docs/GALLERY_CONFIG_UI_FLOW.md` | Updated with breakpoint grid UX (P24-B) |

---

## Addendum — Theme Preview Debugging Deep Dive

### Symptoms We Saw

The Phase 24 theme work initially looked correct in source, but the live WordPress settings dialog still behaved incorrectly in two distinct ways:

1. The selector could display the wrong saved theme.
2. Picking a new theme did not visibly update the UI until after saving and reloading.

The misleading part was that some of the state changes were real. The settings form could receive the newly selected theme, yet the rendered UI stayed on the old palette. That made the bug look like a simple controlled-input problem at first, even though the remaining failure was deeper in the runtime.

### What We Tried First

The first round of fixes focused on the most obvious React-side problems.

1. We made `ThemeSelector` controlled.
   Previously, the dropdown display could derive its value from `useTheme().themeId`, which meant context or localStorage state could disagree with the actual `settings.theme` value being edited in the settings form. Passing `settings.theme` down from `GeneralSettingsSection` fixed the incorrect displayed value and made the staged form state authoritative.

2. We wired live preview and cancel/revert behavior through the settings flow.
   Selecting a theme now updates staged settings state and calls `setPreviewTheme()` immediately, while cancel/reset paths revert the temporary preview back to the previously saved theme.

3. We kept the Mantine combobox inside the current render tree.
   Because this admin UI can run inside a Shadow DOM host, Mantine portal behavior was an obvious suspect. Setting `comboboxProps={{ withinPortal: false }}` was the right defensive change and remains important because it keeps the dropdown inside the active gallery/modal subtree instead of rendering elsewhere in the document.

Those changes fixed real UX issues, but they did not fully resolve the live preview failure on the actual WordPress page.

### What Did Not Work and Why

Several early explanations were directionally reasonable but incomplete.

- Treating the bug as purely a Mantine portal or Shadow DOM scoping problem.
  That explained why keeping the dropdown in-tree was safer, but it did not explain why preview state changes still failed to affect the visible theme after the portal issue was addressed.

- Treating the bug as a duplicate-provider mistake in the source tree.
  Source inspection did not show multiple `ThemeProvider` instances wrapped around different app regions. The eventual problem was not duplicate provider code in the repo; it was duplicate module instantiation at runtime.

- Relying only on component/unit tests.
  Focused Vitest coverage can prove that `ThemeSelector` calls the right handlers and keeps the dropdown inside the current tree, but those tests do not execute through WordPress asset registration or Vite's real lazy-chunk loading path. The remaining bug only appeared when the built plugin was loaded by WordPress itself.

### What Actually Worked

The breakthrough came from debugging the real WordPress page directly instead of staying inside isolated React tests.

We opened the local site, authenticated into the admin experience, and inspected the live settings modal while changing themes. From there, we used three concrete signals:

1. Shadow-root CSS variable inspection.
   We read the injected `#wpsg-theme-vars` style and watched the effective CSS variables before and after changing the theme.

2. Live React hook/provider inspection.
   We inspected the React fiber/hook state in the browser to see whether the saved theme and preview theme were changing inside the same provider instance.

3. Real asset URL comparison.
   We compared the module URLs WordPress was serving with the URLs used by Vite lazy imports.

That final comparison exposed the actual root cause:

- WordPress was registering the Vite entry asset with `WPSG_VERSION`, producing a URL like `index-<hash>.js?ver=0.22.0`.
- Lazy-loaded chunks imported the same main module as `./index-<hash>.js`, without the query string.
- Browsers treat those as different ES module URLs.
- The result was two instantiations of what should have been the same main module.

Once that happened, singleton/module state split in two. React contexts defined in the main entry path were duplicated, so the lazy-loaded settings code could end up reading and writing a different `ThemeContext` instance than the one driving the visible app shell. In practice, that meant `setPreviewTheme()` looked wired correctly in source, but the lazy-loaded settings panel was not talking to the same runtime context instance as the rendered gallery UI.

The real fix was therefore in the WordPress embed layer, not just the React UI:

- In `WPSG_Embed::register_assets()`, manifest-based hashed JS and CSS assets now register with `null` version instead of `WPSG_VERSION`.
- That keeps the entry module URL queryless.
- Because Vite filenames are already content-hashed, cache busting still works.
- With matching module URLs, the entry script and lazy chunks share one module instance again, so the lazy-loaded settings UI and the main app finally use the same `ThemeContext`.

We kept the React-side theme UX fixes because they solved real staging/display problems. But the release-blocking preview bug was only fully fixed after removing the `?ver=` query from hashed ES module entry assets.

### Testing Approaches Used

This issue needed multiple layers of verification because no single test style exposed the whole failure.

- Source inspection.
  We traced the flow through `ThemeSelector`, `GeneralSettingsSection`, `SettingsPanel`, `ThemeContext`, and the WordPress embed/asset registration path.

- Focused frontend tests.
  We used targeted Vitest coverage to verify selector behavior and to confirm that the dropdown stays inside the current render tree rather than escaping through a portal.

- Direct debugging on the real website.
  We went into the actual local WordPress site at `https://192.168.1.220/test/` instead of relying only on local component rendering. That mattered because the root cause depended on how WordPress emitted the built Vite entry script.

- Browser/runtime inspection.
  We inspected the shadow-root theme style element, compared effective CSS variables before and after selection, and checked live React provider/hook state inside the browser.

- Post-fix live verification.
  After the WordPress asset registration change, we re-tested on the live site and confirmed the behavior end to end. Starting from a saved `catppuccin-latte` theme, previewing `material-dark` changed the injected background variable from `#eff1f5` to `#121212` and flipped the effective scheme from light to dark immediately, without saving. Resetting the preview restored the saved theme.

- Backend regression coverage.
  We added a focused PHP regression test asserting that the manifest-based entry script is registered with a `null` version so WordPress does not append the query string that caused the duplicate-module problem.

### PR Review Follow-Up (PR #39)

After the initial Phase 24 merge work, Copilot review on PR #39 surfaced five follow-up observations. We evaluated each against the live code path and the current tests.

| Issue | File | Choice | Rationale |
|------|------|--------|-----------|
| Theme scope token and selector escaping | `src/main.tsx` | Accept | The existing selector builder trusted `host.id` / `data-wpsg-key` too directly. That was low-probability in normal WP usage, but still the wrong trust boundary for a selector interpolated into scoped CSS. We now normalize the stored scope token to a safe charset and build selectors from that sanitized token. |
| Scoped non-shadow theme style cleanup | `src/contexts/ThemeContext.tsx` | Accept | The non-shadow path created a document-head style tag without cleanup. That could leak stale tags across gallery mount/unmount cycles. We added explicit lifecycle cleanup and test coverage for unmount removal. |
| Global replacement of `:host` in scoped CSS injection | `src/contexts/ThemeContext.tsx` | Accept | `replace(':host', ...)` was only robust while the generated CSS contained a single `:host` selector. Switching to a global replacement removes that hidden assumption and costs essentially nothing. |
| Prevent caller override of `withinPortal: false` | `src/components/Admin/ThemeSelector.tsx` | Accept | The shadow/modal scoping fix only holds if the dropdown stays in-tree. Allowing `selectProps` to silently override that behavior would make the fix fragile, so `withinPortal: false` is now enforced last. |
| Legacy settings pruning condition should check camelCase `galleryConfig` directly | `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Reject | The review concern assumed the raw request body was being checked directly. In reality `update_settings()` first runs `WPSG_Settings::from_js($body)`, which converts `galleryConfig` into `gallery_config` before the pruning condition is evaluated. Existing PHP coverage already verifies `from_js()` carries `gallery_config`, so the current guard is correct and did not need a code change. |

Focused validation after these follow-ups covered `ThemeSelector.test.tsx`, `ThemeContext.test.tsx`, and the new `themeScope.test.ts`, all passing locally.
