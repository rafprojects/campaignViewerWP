# Phase 41 — ZIP Export UI, Multi-Select Simplification, Backlog Cleanup

**Status:** Complete
**Created:** 2026-06-03
**Last updated:** 2026-06-03

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P41-EX1 | Wire binary (ZIP) campaign export to the campaigns UI | Complete | XS |
| P41-UX1 | Remove multi-select mode gate; always show checkboxes | Complete | S |
| P41-FT1 | FUTURE_TASKS.md cleanup — stale dependency note for Alignment Variants | Complete | XS |
| P41-UN1 | Pre-uninstall confirmation gate (Danger Zone section, default flip) | Complete | S |
| P41-RD15 | SlotPropertiesPanel IIFE extraction into named sub-components | Complete | S |
| P41-OL1 | Migrate Overlay Library from wp_options to custom DB table | Complete | M |

---

## Rationale

Phase 41 addresses three independent improvements identified after Phase 40 shipped.

**P41-EX1 — Binary export was built but never exposed.** `WPSG_Export_Engine` shipped in P39-CM1
and `handleBinaryExportCampaign()` was wired into the `useAdminCampaignActions` hook and its
returned `CampaignActionsHandle` type. However, no button in the campaigns UI ever called it.
The existing "Export" action only produced a JSON file. The ZIP path — background job, polling,
streamed download, cleanup — was fully functional but completely invisible. P41-EX1 adds the
"Export ZIP" button alongside the existing JSON export.

**P41-UX1 — Multi-select mode gate was unnecessary friction.** The campaigns tab required
clicking a "Select" toggle button before checkboxes appeared. This was a two-step interaction for
a feature that has no reason to be hidden: checkboxes take up one narrow column, the `BulkActionsBar`
already only renders when `selectedCampaignIds.size > 0`, and the `selectMode` concept added
code complexity (an extra state flag, a toggle handler, a keyboard shortcut, and conditional
rendering in four locations). Removing the gate simplifies both the UX and the code. The
`bulkSelect` keyboard shortcut (`mod+shift+a`) is repurposed as select-all / deselect-all.

**P41-FT1 — Stale dependency note in FUTURE_TASKS.** The "Alignment Variants" backlog entry
stated that both P30-K (alignment spike) and P30-G (nested group hierarchy) were required before
it could be implemented, and listed both as incomplete. Both tracks shipped in Phase 30 and are
marked Complete in `docs/archive/phases/PHASE30_REPORT.md`. The note was updated to reflect
that the item is now unblocked.

---

## Track P41-EX1 — Binary Campaign Export UI

### What already existed

- `handleBinaryExportCampaign(campaign)` in `src/hooks/useAdminCampaignActions.ts` — a fully
  implemented hook function that starts a background ZIP job, polls for completion, streams the
  download, then deletes the job.
- `binaryExportingIds: Set<string>` — tracks in-progress exports for per-campaign loading state.
- Both were already included in the `CampaignActionsHandle` return type.
- Backend: `class-wpsg-export-engine.php` with POST/GET/DELETE job endpoints.

### Change

Added an "Export ZIP" button to `src/components/Admin/CampaignsMobileList.tsx` immediately after
the existing JSON export button. The button uses `IconFileZip` from `@tabler/icons-react`, shows a
loading spinner via `binaryExportingIds.has(cid)`, and calls `handleBinaryExportCampaign(c)`.

### Files modified

- `src/components/Admin/CampaignsMobileList.tsx`

---

## Track P41-UX1 — Remove Multi-Select Mode Gate

### Changes

**`src/hooks/useAdminCampaignActions.ts`**
- Removed `selectMode` state (`useState(false)`) and `handleToggleSelectMode` callback.
- Removed both from the returned object.
- Repurposed the `bulkSelect` hotkey (`mod+shift+a`): now toggles select-all / deselect-all
  (selects all current campaigns when none are selected; deselects all when any are selected).

**`src/hooks/useShortcutConfig.ts`**
- Updated `bulkSelect` label from `'Toggle bulk select mode'` to `'Select all / deselect all'`.

**`src/components/Admin/CampaignsTab.tsx`**
- Removed the `<Group>` / toggle button block entirely.
- Removed `selectMode` and `onToggleSelectMode` from `CampaignsTabProps` interface and destructuring.
- Removed `{selectMode && ...}` conditional on the checkbox column header — header checkbox always rendered.
- Changed `<CampaignSkeletonRows withCheckbox={selectMode} />` → `withCheckbox={true}`.

**`src/components/Admin/CampaignsMobileList.tsx`**
- Removed `selectMode` from `campaignActions` destructuring.
- Removed `{selectMode && ...}` conditional around the per-card checkbox — always rendered.
- Removed `selectMode` from the `useMemo` dependency array.

**`src/components/Admin/AdminPanel.tsx`**
- Removed `selectMode={campaignActions.selectMode}` and `onToggleSelectMode` props from `<CampaignsTab>`.
- Changed `BulkActionsBar` render guard from `campaignActions.selectMode && campaignActions.selectedCampaignIds.size > 0` → `campaignActions.selectedCampaignIds.size > 0`.

---

## Track P41-FT1 — FUTURE_TASKS Cleanup

Updated the "Alignment Variants" entry in `docs/FUTURE_TASKS.md`:
- Replaced the "Why deferred" paragraph that cited P30-K and P30-G as incomplete blockers.
- Added a clear "Status: Unblocked" note referencing Phase 30 completion.
- Updated the "Last updated" footer.

---

---

## Track P41-UN1 — Pre-Uninstall Confirmation Gate

### Problem

The `preserveDataOnUninstall` setting defaulted to `false`, meaning a plugin removal would
silently wipe all campaigns, layout templates, overlay library, analytics events, access grants,
and uploaded thumbnails. The FUTURE_TASKS entry explicitly flagged "Default preserves data — low
risk, severe consequences when disabled." The setting was also buried in the Data Maintenance
accordion alongside routine options, with no framing around its severity.

### Changes

**`src/components/Settings/AdvancedSettingsSection.tsx`**
- Removed `preserveDataOnUninstall` Switch from the "Data Maintenance" accordion.
- Added a new "Danger Zone" accordion item at the end of the settings list, with a red header label.
- The panel renders a red `Alert` describing which data is permanently deleted, followed by the switch.
- The panel uses `mounted.has('danger-zone')` (lazy mounting) to avoid rendering until opened.

**`src/types/index.ts`**
- Changed `preserveDataOnUninstall: false` → `preserveDataOnUninstall: true` in `DEFAULT_SETTINGS`.

**`wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`**
- Changed `'preserve_data_on_uninstall' => false` → `'preserve_data_on_uninstall' => true` in the
  settings schema default.

---

## Track P41-RD15 — SlotPropertiesPanel IIFE Extraction

### Problem

The "Effects" accordion panel in `SlotPropertiesPanel.tsx` contained four Immediately Invoked
Function Expressions (IIFEs) that rendered the filter sliders, shadow controls, overlay effect,
and tilt effect sub-panels inline. IIFEs are not React components — they can't be memoized, can't
receive display names, and hinder readability. Each IIFE was ~20–40 lines of JSX.

### Changes

**`src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`**
- Added `type EffectSectionProps = Pick<SlotPropertiesPanelProps, 'slot' | 'onUpdate'>`.
- Extracted four named function components after the existing `SectionHeader` definition:
  - `FilterEffectsSection` — 8 filter sliders (brightness, contrast, saturate, blur, grayscale, sepia, hue-rotate, invert)
  - `ShadowSection` — shadow enable toggle + offset X/Y, blur, color controls
  - `OverlayEffectSection` — overlay mode + intensity/hover controls
  - `TiltEffectSection` — tilt enable toggle + max-angle, perspective, reset-speed
- Replaced the 4 IIFEs in the Effects accordion panel with `<ComponentName slot={slot} onUpdate={onUpdate} />`.

---

## Track P41-OL1 — Overlay Library Migration to Custom DB Table

### Problem

The overlay library was stored in a single WordPress option (`wpsg_overlay_library`) as a
serialized PHP array. wp_options is not designed for growing collections: autoloading large blobs
degrades every page load, and the entire option must be read and rewritten for every add/remove.
FUTURE_TASKS D-2 identified this as a scalability concern.

### Schema

New table `{prefix}wpsg_overlays`:
```
id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
overlay_id  VARCHAR(36)   UNIQUE NOT NULL          -- UUID
url         VARCHAR(2083) NOT NULL DEFAULT ''
name        VARCHAR(255)  NOT NULL DEFAULT ''
uploaded_at DATETIME      NOT NULL
KEY (uploaded_at)
```

### Migration path

`WPSG_DB::maybe_create_overlays_table()` creates the table via `dbDelta()` on first run. If the
`wpsg_overlays_migrated` option is absent, `migrate_overlays_from_options()` reads the existing
`wpsg_overlay_library` option (if any), inserts each entry into the new table, then deletes the
option. The migration guard prevents re-runs. `DB_VERSION` was bumped from `'9'` to `'10'` so the
table is created on all existing installs via the standard `maybe_upgrade()` path.

### Files modified

- `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php` — `DB_VERSION` bump, `maybe_create_overlays_table()`, `migrate_overlays_from_options()`, `get_overlays_table()` added; `maybe_upgrade()` call added
- `wp-plugin/wp-super-gallery/includes/class-wpsg-overlay-library.php` — `get_all()`, `add()`, `remove()` rewritten to query `wpsg_overlays`; `OPTION_KEY` constant removed
- `wp-plugin/wp-super-gallery/uninstall.php` — `wpsg_overlays` added to DROP list; `wpsg_overlays_migrated` added to options cleanup
- `wp-plugin/wp-super-gallery/tests/WPSG_Overlay_Library_Test.php` — tests rewritten for DB-backed storage
- `wp-plugin/wp-super-gallery/tests/WPSG_DB_Test.php` — tearDown drops overlays table; overlays table existence asserted in `test_maybe_upgrade_creates_tables_and_sets_version`
- `wp-plugin/wp-super-gallery/tests/WPSG_REST_Extended_Test.php` — `maybe_create_overlays_table()` added to `setUp`

---

## Outcome

Six tracks complete. The campaigns tab always shows checkboxes with both JSON and ZIP export
buttons per row; `mod+shift+a` selects/deselects all. The uninstall setting defaults to data
preservation and is visually isolated in a Danger Zone section. SlotPropertiesPanel Effects
sub-panels are named React components. The overlay library now reads and writes individual rows
from a dedicated DB table with a transparent one-time migration from wp_options. All 1991 frontend
tests and 853 PHP tests pass.
