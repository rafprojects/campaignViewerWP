# Phase 29 — Campaign Media Delete Bug Fix

**Status:** Complete
**Created:** 2026-05-18
**Last updated:** 2026-05-18

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P29-A | Fix campaign media delete wiping all items | Complete ✅ | Small |

---

## Rationale

1. A critical data-loss bug was reported: clicking the delete button on any single
   media item in the campaign editor's Media tab removed every item from the
   campaign instead of only the targeted one.
2. The fix touches both the PHP REST layer and the React hook in a single, tightly
   coupled change set — appropriate to land together as one phase.
3. Success: individual media items can be deleted without touching any other item;
   legacy campaigns whose items lack IDs are automatically repaired on next access.

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Fix route regex or reject UUID-format IDs | Fix the regex — UUIDs are already in production data; the regex was simply too narrow. |
| B | Where to backfill missing IDs | Inside `list_media` on read, so legacy items are repaired automatically the first time the Media tab is opened — no separate migration script needed. |

---

## Track P29-A — Campaign Media Delete Wipes All Items

### Problem

Two bugs compounded to produce a complete data-loss event on every media delete
attempt in a campaign that carried legacy media items (stored without an `id`
field):

**Bug 1 — Route regex excluded hyphens.**
`wp_generate_uuid4()` produces IDs like `550e8400-e29b-41d4-a716-446655440000`.
The `DELETE /campaigns/{id}/media/{mediaId}` route pattern used
`[a-zA-Z0-9_]+` — no hyphen — so no UUID-based media item could ever match the
route. The frontend built the URL as:

```
DELETE /campaigns/123/media/undefined
```

because JavaScript coerces `undefined` (the value of `media.id` for legacy items
that arrived without an `id` field) to the literal string `"undefined"`.
`"undefined"` contains only alphabetic characters, so it **did** match the route.

**Bug 2 — `delete_media` called `update_post_meta` unconditionally.**
The PHP handler filtered the `$media_items` array and then always called
`update_post_meta`, even when no item was removed by the filter. WordPress's
`sanitize_meta` pipeline runs the `sanitize_media_items` callback on every
`update_post_meta` call for the `media_items` key. That callback **drops any
item whose `id` field is empty or absent**. Legacy items with no `id` were
silently discarded — all of them at once.

The frontend then ran its own filter:
```typescript
prev.filter((m) => m.id !== mediaItem.id)
// m.id === undefined, mediaItem.id === undefined → false for every item
```
All items were removed from React state, matching the backend erasure.

### Fix

Four changes across two files:

**1. Route regex — allow hyphens (`class-wpsg-rest.php`)**

Changed `[a-zA-Z0-9_]+` → `[a-zA-Z0-9_-]+` in both the route registration and
the custom-ID validation regex inside `build_media_item_from_payload`, so UUID
IDs produced by `wp_generate_uuid4()` can be routed and validated correctly.

**2. `delete_media` — validate and guard (`class-wpsg-rest.php`)**

- Return `400` immediately if `$media_id` is empty.
- Count items before and after the filter; return `404` if the count is unchanged
  (item not found).
- Only call `update_post_meta` when the item was actually found and removed,
  preventing the `sanitize_media_items` callback from running on an unmodified
  list.

**3. `list_media` — legacy ID backfill (`class-wpsg-rest.php`)**

After type normalization, iterate the items and assign a fresh UUID to any item
whose `id` field is missing or empty. Persist the backfilled list via
`update_post_meta` (and audit-log the count). Legacy campaigns are self-healing
on the first Media tab access.

**4. Frontend guard (`useUnifiedCampaignModal.ts`)**

- Reject delete attempts with a user-visible error if `mediaItem.id` is falsy
  (belt-and-suspenders; should not be reachable after the backend backfill).
- Use `encodeURIComponent(mediaItem.id)` when building the DELETE URL so any
  future ID format with reserved characters is safe.

### Acceptance criteria

- Clicking "delete" on one media item removes exactly that item; the remaining
  items are intact in both the UI and the database. ✅
- Clicking "delete" on a campaign that still has legacy items (no `id` field)
  shows a clear error instead of silently erasing the collection. ✅
- Opening the Media tab on a legacy campaign backfills UUIDs; a subsequent delete
  works correctly without reopening the modal. ✅
- PHPUnit and Vitest test suites pass with updated route patterns and new UUID /
  hyphenated IDs in the valid-ID test cases. ✅

### Validation

- PHP: `WPSG_REST_Routes_Test` — updated regex pattern and added UUIDs +
  hyphenated IDs (`item-1`, `valid-id-with-hyphens`,
  `550e8400-e29b-41d4-a716-446655440000`) to the valid-ID lists.
- Manual QA: open a campaign with 8 images, delete one → confirm 7 remain;
  confirm database `media_items` postmeta has 7 entries.
- Manual QA: open a legacy campaign (items without IDs) → confirm IDs are
  backfilled on load; then delete one → confirm it works.

---

## Files Affected

| File | Change |
|------|--------|
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Route regex, custom-ID validation regex, `delete_media` validation + guard, `list_media` ID backfill |
| `src/hooks/useUnifiedCampaignModal.ts` | `handleRemoveMedia` guard + `encodeURIComponent` |
| `wp-plugin/wp-super-gallery/tests/WPSG_REST_Routes_Test.php` | Updated regex patterns; added UUID and hyphenated IDs to valid test cases |

---

## Outcome

- One track shipped: P29-A (complete).
- Nothing deferred.
- Follow-on to consider: audit whether `rescan_all_media_types` and other
  functions that call `update_post_meta('media_items', ...)` are similarly
  exposed to the `sanitize_media_items` drop-on-no-id behaviour — those paths
  could wipe IDs if called on data that hasn't been backfilled yet.
