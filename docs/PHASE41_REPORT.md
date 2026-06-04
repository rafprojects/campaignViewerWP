# Phase 41 — Export UX, Multi-Select, Bulk Actions, Backlog Cleanup

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
| P41-EX2 | Consolidate per-row JSON + ZIP export into a single dropdown button | Complete | XS |
| P41-EX3 | Bulk export selected campaigns as a single multi-campaign ZIP | Complete | M |
| P41-BA1 | Fix BulkActionsBar Archive/Restore trigger logic for mixed selections | Complete | XS |
| P41-IM1 | ZIP import support — expose binary import endpoint in the UI, add v3 multi-campaign handling | Complete | M |

### Follow-up fixes (no dedicated track)

- **Export SSL fix (P41-SSL1):** `build_zip()` now detects same-origin media URLs and respects the `https_local_ssl_verify` WordPress filter, so self-signed-cert dev environments can export media without entries landing in `skipped_media.json`. Production sites with valid certs are unaffected. Dev workaround: `add_filter('https_local_ssl_verify', '__return_false')` in `wp-config.php`.

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

---

## Track P41-EX2 — Per-Row Export Dropdown

### Problem

P41-EX1 added a second "Export ZIP" button alongside the existing "Export" (JSON) button.
Two side-by-side export buttons consume horizontal space and will grow unwieldy if more formats
are added. A single dropdown consolidates them without losing either option.

### Changes

**`src/hooks/useCampaignsRows.tsx`** and **`src/components/Admin/CampaignsMobileList.tsx`**
- Replaced both separate export buttons with a single Mantine `Menu`-based trigger.
- Main button: "Export" + `IconDownload` chevron; `loading={binaryExportingIds.has(cid)}` while a ZIP job is running for that row.
- Dropdown items: "Export as ZIP (includes media)" and "Export as JSON (data only)".

---

## Track P41-EX3 — Bulk Export Selected Campaigns as ZIP

### Problem

`BulkActionsBar` had Archive + Restore but no export capability. There was also no backend
endpoint for multi-campaign ZIP export — the single-campaign handler
(`handleBinaryExportCampaign`) only accepts one `AdminCampaign` at a time, and triggering N
parallel browser downloads is unreliable.

### Design

One download for the full selection: a single ZIP built from a v3 multi-campaign manifest, reusing
`WPSG_Export_Engine` unchanged. Media goes into a flat shared `media/` pool (deduped by URL);
the manifest records which files belong to which campaign.

**ZIP structure:**
```
campaigns-export-{jobId}.zip
├── manifest.json    ← version=3, type="multi", campaigns=[…]
└── media/
    ├── photo1.jpg
    └── photo2.png
```

**Manifest v3 shape:**
```json
{
  "version": 3,
  "type": "multi",
  "exported_at": "…",
  "campaigns": [
    { "campaign": {…}, "layout_template": {…}|null, "media_references": [{…}] }
  ]
}
```

### Changes

**`wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`**
- New route: `POST /campaigns/batch/export/binary` with `{ ids: integer[], minItems: 1, maxItems: 50 }`.
- Handler `batch_export_binary()`: loops IDs, builds v3 manifest, calls `WPSG_Export_Engine::create_job('multi_campaign', …)`, adds one audit entry, returns `202 { jobId, status: 'pending' }`.
- No changes to `WPSG_Export_Engine` itself.

**`src/services/api/exportApi.ts`** — `startBulkBinaryExport(ids: string[])`

**`src/services/apiClient.ts`** — expose on facade

**`src/hooks/useAdminCampaignActions.ts`**
- New `isBulkExporting: boolean` state (separate from `isBulkLoading` so Archive/Restore buttons don't show as loading during an export).
- New `handleBulkBinaryExport()`: polls + downloads with the same 3 s / 5 min pattern as `handleBinaryExportCampaign`.

**`src/components/Admin/BulkActionsBar.tsx`** — `onExport` + `isExporting` props; "Export ZIP" button before Archive.

**`src/components/Admin/AdminPanel.tsx`** — pass `onExport` + `isExporting` to `BulkActionsBar`.

---

## Track P41-BA1 — BulkActionsBar Archive/Restore Logic Fix

### Problem

`allSelectedArchived = sel.every((c) => c.status === 'archived')` is `false` for any non-all-archived selection, including all-active selections. This caused Restore to render even when no selected campaign was archived — meaningless and confusing. The batch restore backend is correct and idempotent (sets `status = 'active'` for all); the issue is purely presentational.

### Changes

**`src/components/Admin/AdminPanel.tsx`** — replace `allSelectedArchived` with:
```tsx
hasActiveSelected={sel.some((c) => c.status !== 'archived')}
hasArchivedSelected={sel.some((c) => c.status === 'archived')}
```

**`src/components/Admin/BulkActionsBar.tsx`**
- Props: remove `allSelectedArchived`; add `hasActiveSelected: boolean` and `hasArchivedSelected: boolean`.
- Archive renders when `hasActiveSelected`; Restore renders when `hasArchivedSelected`.
- Mixed selection: both buttons show (Archive primary orange/light, Restore secondary teal/subtle).
- All active: Archive only. All archived: Restore only.

---

---

## Track P41-IM1 — ZIP Import Support

### Problem

ZIP exports (v2 single-campaign, v3 multi-campaign) could not be round-tripped back in. The binary import backend endpoint (`POST /campaigns/import/binary`) existed and handled v2 ZIPs, but was never wired to the frontend import modal. The modal only accepted `.json` files and called the JSON `POST /campaigns/import` endpoint. v3 (bulk) ZIPs had no import path at all.

### Changes

**`wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`**
- Extracted per-campaign sideload logic from `import_campaign_binary()` into a private `import_single_campaign_from_zip(ZipArchive $zip, array $entry): array` helper.
- Removed the hard `version !== 2` rejection. Handler now branches:
  - v2 → existing single-campaign path (unchanged), returns `{ id, title }`.
  - v3 `type=multi` → loops `manifest.campaigns[]` calling the shared helper for each; returns `{ imported: [{ id, title }, …] }`.
  - Other versions → `400` error as before.

**`src/services/api/campaignsApi.ts`**
- Added `importCampaignBinary(file: File)` — sends `FormData` (field `file`) to `POST /wp-json/wp-super-gallery/v1/campaigns/import/binary`. Return type is a union of the v2 and v3 response shapes.

**`src/services/apiClient.ts`** — exposed `importCampaignBinary` on the facade.

**`src/components/Admin/CampaignImportModal.tsx`**
- `<FileButton>` now accepts `.zip,application/zip` in addition to `.json`.
- When a `.zip` file is selected, calls `apiClient.importCampaignBinary(file)` and bypasses the JSON parse step.
  - v2 response: `onCampaignsUpdated()` + success notification "Campaign imported."
  - v3 response: `onCampaignsUpdated()` + notification "N campaigns imported."
- JSON path unchanged.

---

## Post-Merge Review — PR #56

Five issues identified by Copilot review and addressed:

**`class-wpsg-rest.php` — `import_single_campaign_from_zip` missing campaign validation.** A v3 manifest entry whose `campaign` key was absent or non-array fell back to `$src = []`, silently creating an empty post titled "Imported Campaign". Added an early guard: if `$entry['campaign']` is missing or not an array, the function returns a `WP_Error('wpsg_invalid_entry', …, 400)` so the entry is skipped cleanly rather than imported as phantom data.

**`class-wpsg-rest.php` — dead `$exported_ids` variable in bulk export.** `$exported_ids` was computed immediately after `WPSG_Export_Engine::create_job()` but never referenced again; `array_column(…, null)` also returned full row objects rather than IDs. Removed the three dead lines.

**`class-wpsg-overlay-library.php` — `get_all()` returning SQL DATETIME for `uploadedAt`.** The query result column `uploaded_at` was surfaced verbatim as `YYYY-MM-DD HH:MM:SS`, diverging from the ISO-8601 format (`gmdate('c')`) used by the rest of the API and by `WPSG_Font_Library`. Changed to `gmdate( 'c', (int) strtotime( $r['uploaded_at'] . ' UTC' ) )` so the API consistently returns RFC 3339 timestamps and JS `Date` parsing is reliable.

**`class-wpsg-overlay-library.php` — `add()` returning SQL DATETIME for `uploadedAt`.** The freshly-generated `$uploaded_at` string (stored in the DB as SQL DATETIME) was also used as the return value's `uploadedAt`. Changed the return to derive the ISO-8601 string via the same `gmdate('c', strtotime(…))` pattern, keeping DB storage and API output independent.

**`class-wpsg-overlay-library.php` — `add()` ignored `$wpdb->insert()` return value.** On a DB error (missing table, duplicate key, etc.) the insert silently failed but the method still returned a successful-looking record that would never appear in `get_all()`. Added result checking: `$wpdb->insert()` result is now stored and tested; `false` returns `WP_Error('wpsg_db_error', …, 500)`. The REST handler (`upload_overlay`) was updated to check `is_wp_error($entry)` and propagate a 500 response, and `add()`'s return type annotation updated to `array|WP_Error`.

---

## Outcome

Ten tracks and one follow-up fix complete. Each campaign row now shows a single "Export" dropdown (ZIP primary, JSON secondary). Selecting multiple campaigns surfaces "Export ZIP" in BulkActionsBar, downloading all selected campaigns as one ZIP (manifest v3, flat media pool). Both v2 single-campaign and v3 multi-campaign ZIPs can now be imported via the Import modal. Archive/Restore visibility in BulkActionsBar is correctly gated on whether the selection actually contains archivable or restorable campaigns. The export engine respects `https_local_ssl_verify` for same-origin media URLs, fixing `skipped_media.json` entries in self-signed-cert dev environments.
