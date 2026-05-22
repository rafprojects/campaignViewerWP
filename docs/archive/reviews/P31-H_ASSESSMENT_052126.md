# P31-H Assessment — Media Payload Foundations

**Author:** Continue Agent
**Date:** 2026-05-21
**Reference:** `docs/PHASE31_REPORT.md` Track P31-H

---

## Executive Summary

P31-H is a **pre-evaluation** track, not a delivery track. Its purpose is to define the canonical `MediaItem`/REST payload contract so that future Timeline and Filterable-gallery work has unambiguous prerequisites.

After auditing the full write/read path (`build_media_item_from_payload` → `enrich_media_with_dimensions` → `sort_media_items` → `list_media` REST → `fetchMediaItems` in `adminQuery.ts` → `MediaItem` TypeScript interface), **three concrete problems are confirmed**, and the pre-evaluation can produce actionable recommendations now.

### Severity Assessment: Medium (justified)

The problems are real but partially latent. The dead-code sort keys (`created_asc`, `size_asc`) are harmless today because no frontend consumer exercises them. The missing tag exposure is a blocker only for future filter work. But the contract drift is genuine and will cause real bugs when those features ship.

---

## Evidence

### Problem 1: `dateUploaded` — Declared but never populated

**Where referenced:**
- `class-wpsg-rest.php:2230-2236` — `sort_media_items()` uses `$a['dateUploaded']` for `created_asc` / `created_desc` sort

**Where it should be set:**
- `class-wpsg-rest.php:2294+` — `build_media_item_from_payload()` constructs the media item array but **never assigns** `dateUploaded`

**Impact:**
- Every media item has `dateUploaded === undefined`
- `strtotime('')` returns `false`, so the sort falls back to `intval($a['order'] ?? 0)`
- `created_asc` / `created_desc` are **functionally identical to `order_asc` / `order_desc`**

**Frontend:**
- The admin `CampaignFilters` in `adminQuery.ts:133` includes `sort?: 'created_asc' | 'created_desc' | ...` for the campaigns list endpoint (line 1176 in REST), NOT the media list endpoint. The media list endpoint at line 2197 defaults to `order_asc` and accepts any string, but no frontend media-list UI sends a sort parameter — `fetchMediaItems()` fetches without `sort` and sorts client-side by `order`.
- The `MediaItem` TypeScript interface does NOT declare `dateUploaded`, so frontend code has no type path to consume it.

### Problem 2: `filesize` — Declared but never populated

**Where referenced:**
- `class-wpsg-rest.php:2240-2243` — `sort_media_items()` uses `$a['filesize']` for `size_asc` / `size_desc`

**Where it should be set:**
- `build_media_item_from_payload()` **never assigns** `filesize`

**Impact:**
- Every media item has `filesize === undefined`, so `intval($a['filesize'] ?? 0)` is always `0`
- `size_asc` / `size_desc` are **complete no-ops** (all items compare as equal)

**Frontend:**
- `filesize` is not in the TypeScript `MediaItem` interface
- No frontend UI exposes size-based sorting for media items

### Problem 3: Media tags — Taxonomy exists but not exposed on media items

**Taxonomy:**
- `wpsg_media_tag` is registered in `class-wpsg-cpt.php:86` on the `attachment` CPT
- Full CRUD REST endpoints exist: `list_media_tags`, `create_media_tag`, `delete_media_tag` (lines 832-845, 5682-5943)
- `listMediaTags()` / `createMediaTag()` / `deleteMediaTag()` exist in `ApiClient` (lines 467-477)
- Admin can create, list, and delete tags

**Missing link:**
- `enrich_media_with_dimensions()` (line 3864) only adds `width`/`height` from attachment metadata
- **No code** queries `wp_get_object_terms( $attachment_id, 'wpsg_media_tag' )` and attaches tags to the media item
- The `MediaItem` TypeScript interface has no `tags` field
- `build_media_item_from_payload()` has no tag logic

**Impact:**
- Tags exist as an admin concept but are invisible to the gallery runtime
- Filterable-gallery follow-on work cannot proceed without this link
- A user can tag attachments in WP admin but those tags never appear in the REST response

### Summary table

| Field | In MediaItem TS type? | Written to media item in PHP? | Read by PHP sort? | Read by frontend? | Status |
|-------|----------------------|-------------------------------|-------------------|-------------------|--------|
| `dateUploaded` | No | No | Yes (created_*) | No | Dead code in PHP, missing contract |
| `filesize` | No | No | Yes (size_*) | No | Dead code in PHP, missing contract |
| `tags` (wpsg_media_tag) | No | No | No | No (tag CRUD only, not per-item) | Orphaned taxonomy, missing enrichment |

---

## Pre-Evaluation Findings

### Date Concepts (for future Timeline work)

Three distinct date concepts exist or could exist:

| Concept | Source | Current state |
|---------|--------|---------------|
| **Attachment upload date** | WP `post_date` on the attachment | Available via `get_post($attachment_id)->post_date`, not currently surfaced |
| **Campaign-media relationship date** | When media was added to the campaign | Not tracked anywhere — no `created_at` on the campaign-media relationship |
| **Manual order** | `$item['order']` | The only reliable chronology signal currently |

**Recommendation:** For a Timeline adapter, the attachment upload date (`post_date`) is the most meaningful default. It is available with one `get_post()` call per attachment item and maps to user intuition ("when I took/uploaded this photo"). Campaign-relationship date could be added later as a separate sort option.

### Tag Exposure Shape

If we decide to surface `wpsg_media_tag` on `MediaItem`, the shape options are:

| Shape | Example | Pros | Cons |
|-------|---------|------|------|
| **IDs only** | `[42, 43]` | Minimal payload | No meaning without a separate tag lookup |
| **Names only** | `["Portrait", "Outdoor"]` | Human-readable | Breaks if tag renamed |
| **Slug only** | `["portrait", "outdoor"]` | Stable-ish | Still not unique across taxonomies |
| **Compact objects** | `[{id:42, name:"Portrait", slug:"portrait"}]` | Self-contained, stable | Larger payload |

**Recommendation:** Compact objects. The tag array per media item is small in practice (1-5 tags), and self-contained objects eliminate a second API round-trip for gallery rendering. The frontend can then filter client-side without needing a tag lookup service.

---

## Proposals

### Proposal A: Fix `dateUploaded` and `filesize` (Immediate, Low Risk)

**What:** Populate `dateUploaded` and `filesize` in the media item during `list_media` read, so the sort keys actually work.

**Implementation:**

In `enrich_media_with_dimensions()` (or a new `enrich_media_with_metadata()` that supersedes it):

```php
private static function enrich_media_with_metadata(array $items): array {
    foreach ($items as &$item) {
        $attachment_id = intval($item['attachmentId'] ?? 0);
        if ($attachment_id > 0) {
            $post = get_post($attachment_id);
            if ($post) {
                $item['dateUploaded'] = $post->post_date;
            }
            $meta = wp_get_attachment_metadata($attachment_id);
            if (!empty($item['width']) || !empty($item['height'])) {
                // existing dimension logic...
            }
            // filesize: file_exists + filesize() on the attachment path
            $file = get_attached_file($attachment_id);
            if ($file && file_exists($file)) {
                $item['filesize'] = (int) filesize($file);
            }
        }
    }
    unset($item);
    return $items;
}
```

**Caveats:**
- `filesize()` requires the file to exist on disk. For external media (`source: 'external'`), filesize will not be available — which is semantically correct.
- Adding `get_post()` per media item in `list_media` adds N queries. With `post__in` batching or `update_post_meta_cache()`, this is manageable. Consider object caching.
- `dateUploaded` should be ISO 8601 format (`$post->post_date`) for consistency with the REST API conventions already used for `createdAt`/`updatedAt` on campaigns.

**TypeScript:** Add optional fields to `MediaItem`:
```ts
dateUploaded?: string | undefined;  // ISO 8601 from WP post_date
filesize?: number | undefined;      // bytes, null for external media
```

**Effort:** ~2 hours.

### Proposal B: Expose media tags on MediaItem (Medium, Required for Filterable Gallery)

**What:** Query `wpsg_media_tag` terms for each media item's attachment and include them in the REST response.

**Implementation:**

In `enrich_media_with_metadata()` (same function as Proposal A):

```php
if ($attachment_id > 0) {
    $terms = wp_get_object_terms($attachment_id, 'wpsg_media_tag', ['fields' => 'all']);
    if (!empty($terms) && !is_wp_error($terms)) {
        $item['tags'] = array_map(static function ($t) {
            return ['id' => (int) $t->term_id, 'name' => $t->name, 'slug' => $t->slug];
        }, $terms);
    }
}
```

**TypeScript:**
```ts
export interface MediaTag {
  id: number;
  name: string;
  slug: string;
}
// in MediaItem:
tags?: MediaTag[] | undefined;
```

**Performance:** `wp_get_object_terms()` in a loop is N+1. Mitigation:
- Batch: collect all `attachment_id`s, use `wp_get_object_terms()` once with an array
- Or use `WP_Term_Query` with `object_ids` parameter
- Or add to the object cache with a short TTL

**Effort:** ~2-3 hours.

### Proposal C: TypeScript contract hardening (Low, Foundational)

**What:** Update `MediaItem` in `src/types/index.ts` to include the new optional fields, and verify that no downstream code breaks (all usage should be safe since the fields are optional).

**Implementation:**
- Add `dateUploaded`, `filesize`, `tags` to `MediaItem` interface
- Add `MediaTag` interface
- Verify `CampaignMediaBatchRequestItem` — these fields should NOT be in the request shape (they are server-derived)
- Verify Zod schema (`settingsSchemas.ts`) — no changes needed (this is not a settings field)
- Verify `build_media_item_from_payload` tests — existing tests should continue passing

**Effort:** ~1 hour.

### Proposal D: Decide on `dateUploaded` format (Design decision)

**Question:** Should `dateUploaded` be the WP `post_date` (upload time) or `post_date_gmt`?

**Recommendation:** `post_date` (local time) is consistent with how WordPress displays dates in admin and is more intuitive for end users. If future Timeline work needs timezone-aware sorting, we can surface `dateUploadedGmt` as a separate field.

### Proposal E: Document the boundary with Phase 34

Phase 34's admin media-sort UI (referenced in the Phase 31 report rationale) is the consumer that will benefit from these fields. The boundary is:

- **P31-H / this phase:** Populate the fields on the server, expose them in the REST response, type them in TypeScript
- **Phase 34:** Add UI controls that consume the sort parameters and the tag filter surface

This keeps P31-H as a pre-evaluation with a small concrete delivery (Proposals A+B+C), and leaves the UI work for Phase 34.

---

## Go/No-Go Recommendation

| Criterion | Status |
|-----------|--------|
| Canonical payload proposal exists | **Yes** (this document) |
| Proposal states which date concept Timeline should rely on | **Yes** (attachment `post_date`) |
| Proposal states whether filterable-gallery should use `wpsg_media_tag` exposure | **Yes** (compact objects on `MediaItem`) |
| Clear go/no-go prerequisite list for follow-on work | **Yes** (see below) |

### Go: Implement Proposals A, B, C in Phase 31

**Total estimated effort: 5-6 hours** (within the P31-H estimate of 4-6 hours)

**Deliverables:**
1. PHP: `enrich_media_with_metadata()` replaces/augments `enrich_media_with_dimensions()`
2. PHP: `dateUploaded` and `filesize` populated for `source: 'upload'` items
3. PHP: `tags` populated from `wpsg_media_tag` taxonomy
4. TypeScript: `MediaItem` interface extended with `dateUploaded`, `filesize`, `tags`, `MediaTag`
5. Tests: Extend `enrich_media` coverage, PHP REST media list tests

### Prerequisites for Timeline adapter (Phase N follow-on):
- [x] `dateUploaded` in REST payload and typed in TypeScript
- [ ] Timeline-specific chronology semantics decision (if attachment date is insufficient)
- [ ] Timeline adapter delivery (out of scope for Phase 31)

### Prerequisites for Filterable gallery wrapper (Phase N follow-on):
- [x] `tags` in REST payload and typed in TypeScript
- [ ] Client-side filter orchestration layer
- [ ] Filter UI controls
- [ ] Wrapper/orchestration boundary definition

---

## Risks and Open Questions

1. **Performance on large campaigns:** Enriching N media items with `get_post()`, `filesize()`, and `wp_get_object_terms()` adds database I/O. For campaigns with 100+ media items, this could be noticeable. Mitigation: WordPress object cache + batching.

2. **Backfill:** Existing media items in `post_meta` will NOT have `dateUploaded`/`filesize`/`tags` stored — these fields are computed at read time, not stored. This is intentional and correct: the data is always fresh from the attachment metadata. No migration is needed.

3. **External media:** `filesize` and `dateUploaded` are not meaningful for `source: 'external'` items. They should be omitted (not set to 0 or null) to avoid misleading consumers.

4. **`sort` parameter on media list endpoint:** The `list_media` endpoint accepts a `sort` parameter but no frontend consumer sends it. The sort keys `created_asc/desc` and `size_asc/desc` are dead code today. After Proposal A, they become functional, but the frontend sort UI (Phase 34) is still needed to expose them to users.

5. **Should `enrich_media_with_dimensions` be renamed?** The function name is inaccurate if it starts doing more than dimensions. Renaming to `enrich_media_with_metadata` is a simple refactor with one call site change.

---

## Files Affected

| File | Change |
|------|--------|
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Rename/augment `enrich_media_with_dimensions` to populate `dateUploaded`, `filesize`, `tags` |
| `src/types/index.ts` | Add `dateUploaded`, `filesize`, `tags?: MediaTag[]` to `MediaItem`; add `MediaTag` interface |
| `wp-plugin/wp-super-gallery/tests/WPSG_REST_Extended_Test.php` | Test that `dateUploaded`, `filesize`, `tags` appear in media list response |
| `src/services/adminQuery.ts` | No changes needed (fields are optional and already sorted by `order` client-side) |
| `src/hooks/useUnifiedCampaignModal.ts` | No changes needed (fields are optional) |
