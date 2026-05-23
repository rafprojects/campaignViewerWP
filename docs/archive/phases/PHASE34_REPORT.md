# Phase 34 — Admin Analytics Refresh & Advanced Media Sorting

**Status:** Complete
**Created:** 2026-05-19
**Last updated:** 2026-05-22

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P34-A | Analytics dashboard live refresh with visibility-aware polling | ✅ Complete | Small-Medium |
| P34-B | Advanced media sort modes and local preference persistence | ✅ Complete | Medium |

---

## Rationale

1. The 2026-05-19 FUTURE_TASKS reconciliation showed that the larger analytics
   and media-sorting initiatives mostly shipped in Phase 28.
2. What remains is smaller admin-surface follow-on work rather than a new
   backend-capability wave.
3. These tracks fit together because they both refine already-working admin
   views without widening back into access-governance or infrastructure work.
4. The analytics work should stay polling-based and visibility-aware rather
   than opening a new real-time transport track.
5. The sorting work should only add the missing sort signals that still matter
   for large media libraries; it should not rewrite the current sorting system
   that already covers order, title, and created date.
6. Success means analytics stays fresh during long admin sessions and media
   libraries gain richer ordering for high-volume workflows.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | How to refresh analytics data | Use polling rather than WebSocket/SSE. |
| B | When analytics polling should run | Poll only while the analytics surface is visible and the browser is online; resume on focus/reconnect. |
| C | How much of media sorting should be revisited | Add only the missing file-size and usage-count modes; preserve existing sort semantics. |
| D | Where sort preference should live first | Use browser-local persistence before introducing WordPress user-meta settings. |
| E | How to handle heavy usage-count sorting | Prefer a dedicated server-side summary/query path when client-side sorting would be too expensive or incomplete. |

## Execution Priority

1. P34-A — Small, high-confidence UX improvement on top of already-shipped
   analytics surfaces.
2. P34-B — Slightly broader follow-up that may require new query paths and
   preference handling once the analytics refresh work is out of the way.

## Track P34-A — Analytics Dashboard Live Refresh with Visibility-Aware Polling

### Problem

The analytics dashboard now has the right data, but it becomes stale when the
tab stays open during an active admin session.

### Fix

Add bounded polling and explicit freshness cues to the analytics dashboard.

### Implementation Details

- Poll the selected-campaign analytics query and the summary query every 30–60
  seconds while the analytics tab is visible.
- Pause polling when the tab is hidden or the browser goes offline.
- Resume on tab focus and reconnect events.
- Add a small manual refresh affordance and last-updated label so operators can
  tell whether they are looking at fresh data.
- Keep WebSocket/SSE out of scope.

### Acceptance criteria

- Analytics data refreshes automatically while the dashboard is visible. (✓)
- Polling pauses when the tab is hidden or the browser is offline. (✓)
- Operators can manually refresh and see when data was last updated. (✓)
- Existing analytics charts and tables remain behavior-preserving outside the
  new refresh behavior. (✓)

### Validation

- Add focused frontend coverage for polling enable/disable behavior.
- Manual QA: leave the analytics tab open, generate new events, and confirm the
  dashboard updates without a full page reload.
- Manual QA: hide the tab and go offline, then verify polling pauses cleanly.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/AnalyticsDashboard.tsx` | Polling lifecycle, refresh affordance, and freshness label |
| `src/services/adminQuery.ts` | Visibility-aware polling/query options |
| `src/hooks/` | Optional helper for tab visibility or reconnect behavior if needed |

### Effort Estimate

~2-4 hours.

---

## Track P34-B — Advanced Media Sort Modes and Local Preference Persistence

### Problem

Media sorting now covers order, title, and created date, but large libraries
still lack two useful sort signals: file size and usage count.

### Fix

Add the missing sort modes and persist the admin's last-used choice locally.

### Implementation Details

- Add file-size and usage-count sort options to the existing media sort UI.
- Keep file-size sorting client-side when metadata is already available and the
  list size is modest.
- Use a server-side query or summary path for usage-count sorting when client
  data is incomplete or too large to sort reliably in memory.
- Persist the last-used sort mode in `localStorage` for the current browser.
- Preserve the existing order/title/created sort behavior and defaults.

### Acceptance criteria

- File-size and usage-count sort modes are available in the media UI. (✓)
- The selected sort preference persists across reloads in the same browser. (✓)
- Large-library behavior remains responsive and does not regress current sort
  modes. (✓)
- Existing sort options remain backward compatible. (✓)

### Validation

- Add focused frontend coverage for sort-option rendering and local persistence.
- Add backend/query coverage if a new server-side usage-count path is required.
- Manual QA: sort a representative media library by each mode and confirm the
  order is stable and intuitive.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/MediaTab.tsx` | New sort options and local preference handling |
| `src/services/apiClient.ts` | New sort param support if a server-side path is required |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Server-side usage-count sorting or summary path if needed |
| `src/services/adminQuery.ts` | Query-key updates if sort persistence changes the fetch contract |

### Effort Estimate

~3-5 hours.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Real-time analytics transport | Polling is sufficient for the first refresh pass; WebSocket/SSE adds unnecessary complexity. |
| WordPress user-meta sort preferences | Browser-local persistence is the smaller first step; cross-device persistence can follow if there is demand. |
| Broader analytics retention/performance tuning | Not required to land the UI-refresh slice. |

## Implementation Notes

- Keep this phase intentionally light and admin-surface focused.
- Do not let these smaller follow-ons widen back into a second analytics or
  media-architecture phase.

---

## PR Review — 2026-05-22

Reviewer: Claude Sonnet 4.6 · Commit reviewed: `b2f4334`

### Issues Found

| # | Severity | Area | Description | Resolution |
|---|----------|------|-------------|------------|
| 1 | 🔴 Bug | P34-B `MediaCard` | Drag handle rendered unconditionally in grid/large view when `dragDisabled=true`. `SortableGridItem` passes `dragHandleProps={undefined}` to `MediaCard`, but `MediaCard` spreads it with `{...(undefined as any)}` — a no-op — and renders the button regardless. Result: grip icon with `cursor:grab` and `aria-label="Drag media to reorder"` appears in grid view for non-order sort modes but has no DnD listeners (ghost button). `SortableListRow` correctly gates the entire button with `{!dragDisabled && (...)}`. | Fixed: wrapped the `ActionIcon` in `MediaCard` with `{dragHandleProps !== undefined && (...)}`. Updated `MediaCard.test.tsx`: renamed "renders drag handle button" to "renders drag handle button when dragHandleProps is provided" (passes `{}`), added "does not render drag handle button when dragHandleProps is absent". |
| 2 | 🔴 Test gap | P34-B tests | `'hides drag handles when not in order sort mode'` in `MediaTab.test.tsx` explicitly switches to list view before asserting. The grid-view path — where Issue 1 lives — was not exercised. The test was green despite the bug. | Fixed: renamed to `(list view)`, added a parallel `(grid view)` test that stays in default grid view and asserts handles disappear after switching to "Title A–Z" sort. |
| 3 | 🟡 UX | P34-B sort | When `sortMode === 'usage'` and `usageSummaryLoading === true`, `applySortMode` runs with an empty `usageSummary`, scoring all items at 0. Items appear stable but in an arbitrary order, then silently re-sort when the fetch completes. No loading signal is shown in the toolbar. Contrast with the orphan filter, which explicitly holds the unfiltered view while `usageSummaryLoading`. | Fixed: added `disabled: usageSummaryLoading` to the "Usage count" option in `sortModeData`. Option is greyed-out until the summary is available. |

### Test Results

| Suite | Before (b2f4334) | After (9961197) |
|-------|-----------------|-----------------|
| Vitest files | 137 passed | 137 passed |
| Vitest tests | 1864 passed | 1866 passed (+2) |

### Issues Investigated but Not Raised

| Area | Finding | Disposition |
|------|---------|-------------|
| `ADMIN_QUERY_OPTIONS` spread removed from analytics hooks | All three options (`retry: false`, `refetchOnWindowFocus`, `refetchOnReconnect`) are explicitly set in each hook. No option dropped. | ✅ Correct |
| `sharedSortableProps` not wrapped in `useMemo` | Pre-existing pattern; `SortableListRow`/`SortableGridItem` are not `React.memo`-wrapped, so a fresh object per render was already the case before P34-B. Not a regression. | ✅ No change needed |
| `wpsg_media_sortMode` localStorage key shared across campaigns | Intentional — inline comment documents the design choice: "shared across campaigns so the user's preferred sort style persists regardless of which campaign they switch to." | ✅ Intentional by design |
| `lastUpdatedAt = Math.min(...)` | Uses the oldest timestamp among three queries as the freshness indicator (staleness floor). Comment says "oldest non-zero timestamp = last time all queries were fresh simultaneously" — this is the most conservative and correct semantic. `Math.max` would overstate freshness when only one query has refreshed. | ✅ Correct |
| `useTabVisibility` SSR guard | `typeof document === 'undefined' ? true : …` correctly defaults to visible in test/SSR environments. | ✅ Correct |
| `applySortMode` immutability | `[...items]` copy before every sort path. Verified by dedicated unit test "does not mutate the original array". | ✅ Correct |
| `title` sort using `caption ?? title` | Matches `MediaTab`'s display logic (`item.caption \|\| '—'`), so sort order aligns with what the operator sees. | ✅ Correct |
| `useOnlineStatus` mock state across analytics tests | Each test that mutates `useOnlineStatus` mock explicitly re-sets it; no leakage across test boundaries. | ✅ Correct |