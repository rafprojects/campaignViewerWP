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

## Outcome

All three tracks complete. The campaigns tab now always shows checkboxes (no toggle gate), has
both JSON and ZIP export buttons per row, and the `mod+shift+a` shortcut now selects/deselects
all. The `FUTURE_TASKS.md` backlog correctly reflects that the Alignment Variants work is
unblocked.
