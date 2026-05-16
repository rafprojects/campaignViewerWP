# Phase 28 — API Capability Expansion & Backend Hardening

**Status:** Planned
**Created:** 2026-05-15
**Branch:** *(to be created from main once P27 merges)*
**Predecessor:** Phase 27 (P27-B promotion inventory)

---

## Overview

Phase 27 fixed every documentation gap in the OpenAPI spec (P27-A) and produced
a thorough improvement analysis (P27-B). Phase 28 implements the promoted items
from that analysis, plus a second wave of improvements uncovered by a deeper
codebase read: batch media upload, duplicate media detection, campaign delete
hard-path, REST args hardening, taxonomy CRUD, analytics expansion, and several
quality-of-life modifications to existing endpoints.

Tracks are grouped so that related PHP, spec, and React changes land together.

---

## Track Index

| Track | Description | Effort | Priority |
|-------|-------------|--------|----------|
| P28-A | Campaign hard-delete endpoint (`DELETE /campaigns/{id}`) | Low | High | Completed | 
| P28-B | Time-limited access grants (`expires_at` on grant endpoints) | Low–Medium | High | Completed |
| P28-C | Taxonomy CRUD — campaign categories + tags (create/update/delete) | Low | High | Completed |
| P28-D | Batch media upload (`POST /media/upload` multi-file + `POST /campaigns/{id}/media/batch`) | Medium | High | Completed |
| P28-E | Campaign filtering enhancements (category/tag/sort/include_archived/template_id) | Low | Medium | Completed |
| P28-F | Pagination on currently unbounded list endpoints | Low | Medium |
| P28-G | Audit log improvements (pagination, filters, global admin endpoint) | Low–Medium | Medium |
| P28-H | Analytics expansion (per-media tracking, cross-campaign dashboard, external hook) | Medium | Medium | Completed |
| P28-I | Magic-link access request approval | Low | Medium | Completed |
| P28-J | Access totals summary endpoint | Low | Low–Medium | Completed |
| P28-K | REST args hardening (`D-8` — typed args arrays on all routes) | Large | Medium |
| P28-L | Rate-limit status headers (`X-RateLimit-*` on all rate-limited endpoints) | Low | Medium |
| P28-M | Media sort controls on list endpoints | Low | Low–Medium |
| P28-N | Duplicate media detection on upload (pHash/MD5) | Medium | Low–Medium |
| P28-O | Campaign templates (preset library) | Medium | Low |
| P28-P | Settings ETag support + `PATCH` method on settings endpoint | Low | Low |
| P28-Q | Hierarchical campaign categories | Low | Low |

---

## Track P28-A — Campaign Hard-Delete

**Source:** P27-B API-7

### Problem

There is no REST endpoint to permanently delete a campaign. The only path is the
WP admin posts screen or WP-CLI. Admins cannot hard-delete from the SPA.

### Proposed change

**New endpoint:** `DELETE /wp-json/wp-super-gallery/v1/campaigns/{id}`

- Requires `require_admin` permission.
- Guard: `confirm=true` query parameter mandatory to prevent accidental deletes.
- Cascade: removes `media_items` post meta, `wpsg_media_refs` rows, access
  grants (post meta), analytics events (optional, controlled by
  `purge_analytics=true` query parameter, default `false`).
- Response `200`: `{ message: "Campaign deleted", id: integer }`
- Response `400`: if `confirm=true` is missing.
- Response `403/404`: standard.
- Audit entry: `campaign.deleted` logged before `wp_delete_post()`.

### Frontend change

- Add a "Delete Campaign" danger action in the campaign overflow menu (beside
  "Archive"). Show a confirmation modal with a text-entry guard (`type DELETE to
  confirm`) before sending the request. Distinct from Archive which uses a
  simple modal.

### OpenAPI / Postman

- Add `deleteCampaign` operation to `DELETE /campaigns/{id}` path (spec currently
  only has `GET`, `PUT` on that path).
- Add corresponding Postman request in `03. Campaigns` folder.

### Acceptance criteria

- [ ] `DELETE /campaigns/{id}?confirm=true` returns 200 and removes the post.
- [ ] Missing `confirm` returns 400.
- [ ] `purge_analytics=true` also removes rows from `wpsg_analytics_events`.
- [ ] `wpsg_media_refs` rows are cleaned up.
- [ ] Audit entry `campaign.deleted` exists before post deletion.
- [ ] PHPUnit: happy path, missing confirm, 404, purge_analytics flag.
- [ ] React confirmation modal requires typing "DELETE".

---

## Track P28-B — Time-Limited Access Grants

**Source:** P27-B API-1 · FUTURE_TASKS Access Control

### Problem

Access grants are permanent. There is no way to issue a time-limited grant (e.g.
"access expires after the event date") without manually revoking later.

### Proposed changes

**`POST /campaigns/{id}/access` requestBody:** add optional `expires_at`
(ISO 8601 datetime string, nullable; null = permanent).

**`GET /campaigns/{id}/access` response:** `AccessGrant` schema gains:
- `expires_at: string | null` — stored expiry timestamp
- `is_expired: boolean` — computed: `expires_at` is in the past

**`GET /campaigns/{id}/access` filter:** add `?include_expired=true` query
param (default false; expired grants are hidden from the main list but accessible
for audit purposes).

**DB change:** The grants are stored in post meta as a JSON array — add
`expires_at` key to each grant entry. Backward-compatible (existing grants get
`expires_at: null`).

**WP-Cron cleanup job:** A daily cron removes grants where `expires_at < now`
from the post meta array. Expired grants are preserved in the audit log.

**`GET /admin/health` response:** surface `expired_grants_pending_cleanup: int`
to show the WP-Cron job backlog.

### Frontend change

- AccessTab grant form: add an optional "Access expires" date-time picker.
- Expired grants shown with a muted "Expired" badge; not in the primary grants
  list by default (toggle to show).
- AccessTab grant item: show expiry date when set.

### Acceptance criteria

- [ ] `POST access` with `expires_at` stores value in post meta grant entry.
- [ ] `GET access` returns `is_expired: true` for grants past their expiry.
- [ ] `GET access` hides expired grants by default; `include_expired=true` shows them.
- [ ] WP-Cron job fires daily and removes expired grants.
- [ ] `GET /admin/health` surfaces `expired_grants_pending_cleanup` count.
- [ ] PHPUnit: grant with future expiry (valid), grant with past expiry (expired), no expiry (permanent).

---

## Track P28-C — Taxonomy CRUD (Campaign Categories + Tags)

**Source:** P27-B API-16

### Problem

Campaign categories and campaign/media tags can only be created, renamed, or
deleted via WP admin taxonomy screens — the SPA has no management surface for them.

### Proposed new endpoints

**Campaign categories:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/campaign-categories` | Create a category |
| `PUT` | `/campaign-categories/{id}` | Rename / update |
| `DELETE` | `/campaign-categories/{id}` | Delete (uncategories affected campaigns) |

**Campaign tags:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tags/campaign` | Create a campaign tag |
| `DELETE` | `/tags/campaign/{id}` | Delete a campaign tag |

**Media tags:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tags/media` | Create a media tag |
| `DELETE` | `/tags/media/{id}` | Delete a media tag |

All mutating endpoints require `require_admin`. Creation body: `{ name, slug? }`.
Update body: `{ name?, slug? }`. Delete: uncategories/untags associated items.

### Frontend change

- Add inline "Add category", "Rename", "Delete" controls to the
  CampaignCategoryFilter panel (or a dedicated taxonomy manager modal).
- Inline editable tag chips in the campaign/media edit forms.

### Acceptance criteria

- [ ] `POST /campaign-categories` creates term; returns `{ id, name, slug }`.
- [ ] `PUT /campaign-categories/{id}` renames; returns updated term.
- [ ] `DELETE /campaign-categories/{id}` removes; campaigns lose the category.
- [ ] Equivalent tests for campaign and media tags.
- [ ] PHPUnit: happy path, duplicate-name conflict (400), not found (404).

---

## Track P28-D — Batch Media Upload

**Source:** New — not in FUTURE_TASKS; user request implicit from UX review

### Problem

`POST /media/upload` accepts a single file per request. Uploading 50 images
requires 50 sequential requests. There is no batch upload surface in the PHP API
or the React UI.

### Proposed changes

**Modification to `POST /media/upload`:**
Accept multiple files via a `files[]` multipart field (in addition to the
existing single `file` field for backward compatibility).
- Process each file independently; return an array of results:
  `{ results: [ { filename, success, attachmentId, url, thumbnail, mimeType } | { filename, success: false, error: "..." } ], total, succeeded, failed }`
- Enforce per-request file count limit (`max_batch_upload_size` setting,
  default 20).
- Report per-file failures without discarding successful uploads.

**New endpoint:** `POST /campaigns/{id}/media/batch`
- Accepts `{ items: [ { type, source, url } | { type, source, attachmentId } ] }`.
- Returns `{ added: [...], failed: [{ index, error }], total }`.
- Existing `POST /campaigns/{id}/media` (single-item) is unchanged.

**Setting:** `max_batch_upload_size` (integer, default 20, admin-only) added to
settings registry.

### Frontend change

- MediaAddModal: supports multi-file selection and shows per-file progress and
  per-file errors.
- MediaTab and UnifiedCampaignModal upload with the batch API path and reuse the
  batch-create endpoint for successful attachments.
- Shared external media modal now supports the same multi-file upload flow.

### Acceptance criteria

- [x] `POST /media/upload` with `files[]` containing 3 files returns 3 result entries.
- [x] Exceeding `max_batch_upload_size` returns 400.
- [x] Each uploaded file is added to WP media library.
- [x] `POST /campaigns/{id}/media/batch` adds multiple media items and reports per-item failures.
- [x] PHPUnit: mixed success/failure batch, count limit enforcement.
- [x] React: `<input multiple>` triggers batch upload flow; progress shown per file.

---

## Track P28-E — Campaign Filtering Enhancements

**Source:** P27-B API-9

### Problem

`GET /campaigns` supports `status`, `visibility`, `company`, `search`,
`page`, `per_page`. Missing: category, tag, sort order, include_archived flag,
template_id filter.

### Proposed additions to `GET /campaigns`

| Param | Type | Description |
|-------|------|-------------|
| `category` | string (slug) | Filter by `wpsg_campaign_category` term slug |
| `tag` | string (slug) | Filter by `wpsg_campaign_tag` term slug |
| `sort` | enum | `created_desc` (default), `created_asc`, `title_asc`, `title_desc`, `updated_desc` |
| `include_archived` | boolean | Default false — include archived campaigns in results |
| `template_id` | string (UUID) | Filter campaigns using a specific layout template |

All map to additional `WP_Query` args / `tax_query` entries; response shape unchanged.

### Frontend change

- CampaignsTab filter bar: add Category dropdown (existing), Tag dropdown, Sort
  dropdown.
- "Include archived" toggle (currently a separate status filter — unify UX).

### Acceptance criteria

- [x] `?category=weddings` returns only campaigns in that category.
- [x] `?tag=2026` returns only campaigns with that tag.
- [x] `?sort=title_asc` returns campaigns in alphabetical order.
- [x] `?include_archived=true` includes archived campaigns in the list.
- [x] `?template_id=<uuid>` returns campaigns bound to that layout template.
- [x] PHPUnit: each param independently, combined params.

---

## Track P28-F — Pagination on Unbounded List Endpoints

**Source:** P27-B API-10

### Problem

The following endpoints return unbounded lists with no pagination support. At
scale (hundreds of companies, thousands of access grants) this creates large
payloads and slow queries.

**Affected endpoints:**
- `GET /companies`
- `GET /campaign-categories`
- `GET /tags/campaign`
- `GET /tags/media`
- `GET /roles`
- `GET /campaigns/{id}/access`
- `GET /companies/{id}/access`
- `GET /campaigns/{id}/audit`

### Proposed change

Add `page` (integer, default 1) and `per_page` (integer, default 50, max 200)
query parameters to each. Response shape changes to:

```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "per_page": 50,
  "total_pages": 3
}
```

Backward compatibility: if neither param is supplied, default behaviour continues
(returns up to `per_page` default, i.e. first page). Clients that currently
expect a flat array will need to read `.items` — this is a breaking change for
the SPA hooks that consume these endpoints.

### Frontend change

Per endpoint, update the React Query hook to read `.items` and surface pagination
controls where appropriate (companies list, access grants list, audit log).

### Acceptance criteria

- [ ] Each affected endpoint respects `page` + `per_page`.
- [ ] Response has `total`, `page`, `per_page`, `total_pages`.
- [ ] All React Query hooks updated to read `.items`.
- [ ] PHPUnit: page 1 vs page 2, over-bounds page returns empty items array.

---

## Track P28-G — Audit Log Improvements

**Source:** P27-B API-2 + API-3

### Problem

`GET /campaigns/{id}/audit` returns an unbounded in-memory array with no
filtering or pagination. There is no global audit log view across all campaigns.

### Proposed changes

**`GET /campaigns/{id}/audit` enhancements:**
- Add `page`, `per_page` query params (pagination; same shape as P28-F).
- Add `from` (ISO date), `to` (ISO date) date range filters.
- Add `action` filter (string, e.g. `media.added`).
- Move audit storage from post meta to a dedicated `wpsg_audit_log` table
  (critical for large histories; post meta is not designed for growing lists).
  - `id`, `campaign_id`, `action`, `actor_id`, `actor_login`, `details` (JSON),
    `created_at` columns.
  - Migration: on first request, backfill from post meta if table is empty.

**New endpoint:** `GET /wp-json/wp-super-gallery/v1/admin/audit-log`
- Cross-campaign audit view (admin only).
- Params: `campaign_id`, `from`, `to`, `action`, `page`, `per_page`.
- Optional `Accept: text/csv` header for CSV export (GDPR compliance).

### Frontend change

- AuditTab: add date-range picker + action-type filter dropdown.
- Add "Export CSV" button that calls the endpoint with `Accept: text/csv`.
- Admin panel: add a global "Audit Log" tab that calls the new cross-campaign
  endpoint.

### Acceptance criteria

- [ ] `GET /campaigns/{id}/audit?from=2026-01-01&to=2026-03-31` returns filtered entries.
- [ ] `GET /campaigns/{id}/audit?action=media.added` returns only media additions.
- [ ] `GET /admin/audit-log` returns entries across all campaigns.
- [ ] `GET /admin/audit-log` with `Accept: text/csv` returns valid CSV.
- [ ] `wpsg_audit_log` table created by `WPSG_DB::maybe_upgrade()`.
- [ ] Backfill from post meta runs on first query.
- [ ] PHPUnit: pagination, date filter, action filter, CSV export header.

---

## Track P28-H — Analytics Expansion

**Source:** P27-B API-13 · FUTURE_TASKS Campaign Analytics Extended Scope

### Problem

Analytics currently track only campaign-level view events. No per-media tracking,
no cross-campaign dashboard, no external integration hook.

### Proposed changes

**`POST /analytics/event` requestBody:** add optional `media_id` (string, the
media item's ID within the campaign). No change to required fields.

**DB change:** `wpsg_analytics_events` gains a `media_id` column (VARCHAR 191,
nullable, indexed).

**New endpoint:** `GET /analytics/campaigns/{id}/media`
- Admin-only.
- Returns per-media breakdown: `{ items: [{ media_id, views, lightbox_opens }] }`
- Date range params: `from`, `to`.

**New endpoint:** `GET /analytics/summary`
- Admin-only.
- Returns: `{ total_views, unique_visitors, top_campaigns: [{ id, title, views }] }`
- Date range params: `from`, `to`.
- Adds a "top campaigns" aggregate query (no N+1: single GROUP BY query).

**Action hook:** fire `do_action('wpsg_analytics_event', $campaign_id, $media_id,
$event_type, $visitor_hash)` after every recorded event. Allows GA/Matomo
integrations without modifying plugin code.

### Frontend change

- AnalyticsDashboard: add a "Media Performance" table below the campaign chart
  (calls `/analytics/campaigns/{id}/media`).
- Admin panel: add a top-level "Analytics" tab showing the summary dashboard
  (calls `/analytics/summary`).
- `useRecordAnalyticsEvent` hook: pass `mediaId` when opening a lightbox item.

### Acceptance criteria

- [ ] `POST /analytics/event` with `media_id` stores it in the DB column.
- [ ] `GET /analytics/campaigns/{id}/media` returns per-media view counts.
- [ ] `GET /analytics/summary` returns cross-campaign totals and top-10.
- [ ] `wpsg_analytics_event` action fires for every recorded event.
- [ ] PHPUnit: event with/without media_id, media analytics query, summary query.

---

## Track P28-I — Magic-Link Access Request Approval

**Source:** P27-B API-6 · FUTURE_TASKS Magic-Link Auto-Approval

### Problem

Admins must open the admin panel to approve access requests. Emailed approval
notifications have no one-click action.

### Proposed change

`POST /campaigns/{id}/access-requests/{token}/approve` gains an optional
`magic_key` query parameter.

**Magic key generation:** When the admin notification email is sent (in
`approve_access_request` or a new dedicated action), generate a HMAC-SHA256
token:
```
magic_key = HMAC-SHA256(NONCE_KEY + token + expiry_timestamp)
```
TTL: 48 hours. Store `{ magic_key_hash, expires_at }` in the access request row.

**Permission callback change:** If `magic_key` is present and valid, grant
access without requiring an authenticated admin session. Validate:
1. Campaign ID matches the request token.
2. `magic_key` matches the stored hash.
3. Not expired.
4. Not already used (`used_at IS NULL`).

On use: set `used_at = NOW()`.

**Security notes:**
- IDOR protection: token is UUID v4, and the campaign ID must match the token's
  stored `campaign_id`.
- Rate limit: magic-link approve endpoint is rate-limited at 10 requests/minute.
- The hash is stored, not the raw magic key.

### Frontend change

None required — the magic link points to the REST endpoint directly from email.
Admin UI shows a "magic link sent" notice on the notification email template.

### Acceptance criteria

- [ ] Valid `magic_key` approves request without admin session.
- [ ] Expired `magic_key` returns 403.
- [ ] Already-used `magic_key` returns 409.
- [ ] Mismatched campaign ID returns 403.
- [ ] PHPUnit: valid key, expired key, used key, wrong campaign.

---

## Track P28-J — Access Totals Summary Endpoint

**Source:** P27-B API-4 · FUTURE_TASKS Access Totals Summary UI

### Problem

To see grant counts across all campaigns, an admin must navigate to each campaign
individually. There is no aggregate summary view.

### Proposed new endpoint

`GET /campaigns/access-summary`

- Admin-only.
- Returns: `{ items: [{ id, title, grant_count, pending_request_count, capacity }] }`
- `capacity`: null (unlimited) or integer (future use).
- Optional `page` + `per_page` for large installations.

Implementation: single `get_posts` query + `get_post_meta` batch (`update_meta_cache`),
then count grants per campaign from the post meta array. For the access request
count, query `wpsg_access_requests` table with status=pending, GROUP BY campaign_id.

### Frontend change

- CampaignsTab: add a "Grant count" column to the campaign table (badge).
- Or a dedicated "Access Overview" sub-tab summarising all campaigns.

### Acceptance criteria

- [x] `GET /campaigns/access-summary` returns all campaigns with grant counts.
- [x] PHPUnit: campaign with grants, campaign with no grants, pending request count.

---

## Track P28-K — REST Args Hardening (D-8)

**Source:** P27-B API-8 · FUTURE_TASKS D-8

### Problem

Only `POST /auth/login` has typed `args` in its `register_rest_route()` call.
All other routes accept any input and rely on per-handler sanitization. This
means: no schema discovery at `/wp-json/wp-super-gallery/v1`, no automatic
sanitization, and no early validation errors.

### Proposed change

Add `args` arrays to every route registration in `register_routes()`:
- `type`, `required`, `sanitize_callback`, `validate_callback` per field.
- Enum validation via `validate_callback` for fields with fixed value sets.
- Remove duplicate validation logic from handlers where it duplicates what `args`
  now covers.

**Priority order (highest security impact first):**
1. `POST /campaigns` — validate `title` required, `visibility` enum
2. `POST /media/upload` — validate file type, file size at args layer
3. `POST /campaigns/batch` — validate `action` as enum, `ids` as integer array
4. `POST /analytics/event` — validate `campaign_id` integer, `event_type` enum
5. `POST /auth/login` — already has args; review and expand
6. All remaining routes in creation order

### Acceptance criteria

- [ ] `GET /wp-json/wp-super-gallery/v1` returns a schema document listing all routes with args.
- [ ] `POST /campaigns` with missing `title` returns WP default `rest_missing_callback_param` error.
- [ ] `POST /media/upload` with disallowed MIME type returns early 400.
- [ ] Existing PHPUnit tests remain green (args validation fires before handlers).

---

## Track P28-L — Rate-Limit Status Headers

**Source:** P27-B API-17

### Problem

Rate-limited endpoints return `429` when the limit is exceeded, but clients
have no visibility into their remaining quota until they hit the wall.

### Proposed change

In `rate_limit_check()`, append headers to the current response:
- `X-RateLimit-Limit: {limit}` — window maximum
- `X-RateLimit-Remaining: {remaining}` — requests left in current window
- `X-RateLimit-Reset: {unix_timestamp}` — when the window resets

Since `rate_limit_check()` is a `permission_callback` (called before the handler),
headers must be added via `add_filter('rest_post_dispatch', ...)` using a closure
that captures the computed values — or return the values to the caller and let
each handler add them.

Alternative approach: attach a `rest_post_dispatch` filter in `register_routes()`
that reads rate limit data from a class-level static array set during the
permission callback.

### Acceptance criteria

- [ ] `GET /campaigns` response includes `X-RateLimit-Limit` header.
- [ ] `X-RateLimit-Remaining` decrements on subsequent requests.
- [ ] `X-RateLimit-Reset` is a valid Unix timestamp.
- [ ] 429 responses still include all three headers.

---

## Track P28-M — Media Sort Controls

**Source:** P27-B API-12 · FUTURE_TASKS Media Sorting Controls

### Problem

`GET /campaigns/{id}/media` and `GET /media/library` return items in insertion
order with no sort control.

### Proposed change

**`GET /campaigns/{id}/media`:** add `sort` query param:
- `order_asc` (default — existing insertion order)
- `order_desc`
- `created_asc` / `created_desc` (by `created_at` timestamp if present)
- `title_asc` / `title_desc` (by `title` field)
- `size_asc` / `size_desc` (by `filesize` if present)

For media arrays stored in post meta (in-memory), sort in PHP after loading.
For `GET /media/library` (WP attachments), pass `orderby` / `order` to `WP_Query`.

**`GET /media/library`:** add `sort` with the same enum.

### Frontend change

- MediaTab toolbar: add a Sort dropdown.
- Persist sort preference per campaign in `localStorage`.

### Acceptance criteria

- [ ] `?sort=title_asc` returns media sorted alphabetically.
- [ ] `?sort=order_desc` reverses insertion order.
- [ ] `GET /media/library?sort=created_desc` returns WP attachments in creation order.
- [ ] PHPUnit: each sort value, unknown sort value falls back to default.

---

## Track P28-N — Duplicate Media Detection on Upload

**Source:** FUTURE_TASKS Duplicate Media Detection

### Problem

The same image can be uploaded multiple times, wasting storage and confusing
the media grid. There is no deduplication check on upload.

### Proposed change

**On `POST /media/upload`:**
1. Compute MD5 of the uploaded file before writing to disk.
2. Query `wp_postmeta` for any existing attachment with `_wpsg_file_md5 = {hash}`.
3. If an exact duplicate exists: return `409 Conflict` with:
   `{ duplicate: true, existing_id: int, existing_url: string }`.
4. Store `_wpsg_file_md5` on each newly uploaded attachment.

**Near-duplicate detection (optional / phase 2):**
- If `jensseger/imagehash` is installed, compute pHash and store as
  `_wpsg_phash`. Compare against existing pHashes; if Hamming distance ≤ 10,
  return `200` with `{ near_duplicate: true, similar: [{ id, url, distance }] }`.
- If not installed, skip near-duplicate check silently.

**Client behaviour:**
- `409 Conflict`: SPA shows "This file is already uploaded" modal with a
  preview of the existing item. Options: "Use existing" (add existing media_id to
  campaign) or "Upload anyway" (re-send with `force=true` query param).
- Near-duplicate warning: non-blocking toast; user can dismiss and continue.

### Acceptance criteria

- [ ] Uploading the same file twice returns `409` on the second attempt.
- [ ] `_wpsg_file_md5` is stored on each uploaded attachment.
- [ ] `?force=true` bypasses MD5 check and uploads anyway.
- [ ] PHPUnit: exact duplicate (409), forced re-upload (201), unique file (201).

---

## Track P28-O — Campaign Templates (Preset Library)

**Source:** FUTURE_TASKS Campaign Templates

### Problem

There is no concept of a "campaign template" — a blank prototype with
pre-configured metadata, display settings, and layout that users can instantiate
as a starting point. P18-C duplication only copies real campaigns with real data.

### Proposed approach

Store campaign templates as `wpsg_campaign` posts with `is_template: true` in
post meta. This reuses existing CPT infrastructure.

**New endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/campaign-templates` | List available templates (first-party + user-created) |
| `POST` | `/campaign-templates` | Create a template from scratch or from an existing campaign |
| `POST` | `/campaign-templates/{id}/instantiate` | Create a new campaign from a template |
| `DELETE` | `/campaign-templates/{id}` | Delete a user-created template |

**First-party templates:** Embedded as JSON in the plugin (versioned array in
`class-wpsg-campaign-templates.php`). Not stored as posts — merged into the
`GET` list at runtime. Marked `{ source: "builtin", editable: false }`.

### Frontend change

- "New Campaign" action: show a template picker modal before the create form.
- Templates panel: manage user-created templates.

### Acceptance criteria

- [ ] `GET /campaign-templates` returns built-in + user templates.
- [ ] `POST /campaign-templates/{id}/instantiate` creates a new campaign pre-populated with template settings.
- [ ] Built-in templates cannot be deleted.
- [ ] PHPUnit: list, instantiate, delete user template, attempt delete builtin (403).

---

## Track P28-P — Settings ETag + PATCH Method

**Source:** P27-B API-18

### Problem

`GET /settings` does not support `ETag` / `If-None-Match` caching, so every SPA
reload re-fetches the full settings payload. `POST /settings` replaces the
entire settings object; partial updates overwrite sibling keys if omitted.

### Proposed changes

**`GET /settings`:** compute `md5(json_encode($settings))`, send `ETag` header.
Honour `If-None-Match` — return `304 Not Modified` when matching.

**`PATCH /settings`:** new method alongside existing `POST`. Merges the provided
keys into current settings rather than replacing the entire object. Prevents race
conditions when two admin tabs save different settings keys concurrently.

**Update OpenAPI spec** to document both methods and ETag headers.

### Acceptance criteria

- [ ] `GET /settings` response includes `ETag` header.
- [ ] `GET /settings` with matching `If-None-Match` returns `304`.
- [ ] `PATCH /settings` with `{ "default_visibility": "private" }` updates only that key.
- [ ] `POST /settings` still works (full replace for backward compat).
- [ ] PHPUnit: ETag roundtrip, PATCH partial merge, POST full replace.

---

## Track P28-Q — Hierarchical Campaign Categories

**Source:** FUTURE_TASKS Hierarchical Campaign Categories

### Problem

Campaign categories are flat. Many gallery managers organise work in trees
(e.g. `Events > Weddings > 2026`).

### Proposed change

- Change `wpsg_campaign_category` taxonomy registration to `'hierarchical' => true`.
  WP handles parent–child relationships natively.
- `GET /campaign-categories` response: add `parent_id` (integer, 0 = top-level)
  to each term.
- `POST /campaign-categories` body: add optional `parent_id`.
- UI: TreeSelect component in the campaign category picker (max 3 nesting levels
  enforced in the UI).

### Acceptance criteria

- [ ] `GET /campaign-categories` returns `parent_id` on each term.
- [ ] `POST /campaign-categories` with `parent_id` creates a child term.
- [ ] Taxonomy re-registration does not affect existing flat terms (parent_id = 0).
- [ ] TreeSelect renders up to 3 levels.

---

## Cross-Cutting Concerns

### OpenAPI spec updates

Every track that adds or modifies an endpoint must update
`docs/api/openapi.yaml` **in the same commit**. Verify with:

```bash
npx @redocly/cli lint docs/api/openapi.yaml
```

### Postman collection updates

Add Postman requests for every new endpoint in the matching folder in
`docs/api/wp-super-gallery.postman_collection.json`.

### PHPUnit coverage

Each new endpoint needs at minimum three test cases:
1. Happy path (200/201/204)
2. Missing/invalid auth (401/403)
3. Not found or invalid input (400/404)

### DB migrations

Any new table (P28-G `wpsg_audit_log`) must be created in `WPSG_DB::maybe_upgrade()`
following the existing pattern. Backfill migrations must be idempotent.

### Cache invalidation

New write endpoints must call `self::bump_cache_version()` or the relevant
targeted invalidation where campaign list or settings caches may be stale.

---

## Deferred / Carry-Forward from P27-B

| Item | Reason deferred further |
|------|------------------------|
| API-5: JWT in-memory token auth | No confirmed standalone SPA deployment |
| API-11: Bulk media operations (DELETE/caption) | Demand not yet confirmed |
| API-14: Webhook support | Sub-system design not finalized |
| API-15: Campaign export binary ZIP | Requires background job architecture |
| API-19: Decompose REST class (D-7) | Pure DX refactor; orthogonal to capability |
| API-20: get_accessible_campaign_ids() opt | Only relevant at >1000 campaigns |
| GraphQL API (FUTURE_TASKS) | Long-horizon; REST coverage is sufficient |
| Third-party OAuth (FUTURE_TASKS) | No confirmed deployment requirement |

---

## Suggested Implementation Order

For a single developer doing the tracks sequentially, the recommended order
balances quick wins with foundational work:

1. **P28-A** (campaign delete) — small, isolated, high value, good warm-up.
2. **P28-L** (rate-limit headers) — one PHP change, zero DB changes.
3. **P28-E** (campaign filtering) — additive query params, no schema changes.
4. **P28-F** (pagination) — mechanical but affects React hooks; do before the
   hooks need to handle more data.
5. **P28-C** (taxonomy CRUD) — builds on P28-F taxonomy endpoints.
6. **P28-B** (time-limited grants) — low effort, high operator value.
7. **P28-I** (magic-link) — email integration, good standalone slice.
8. **P28-D** (batch upload) — medium effort; plan the DB / media library impact first.
9. **P28-G** (audit log + table) — DB migration warrants its own PR.
10. **P28-H** (analytics) — DB migration + cross-campaign queries; tackle after G settles.
11. **P28-J** (access summary) — aggregate query, no DB change.
12. **P28-M** (media sort) — additive, low risk.
13. **P28-N** (duplicate detection) — optional pHash phase; MD5 phase is a standalone PR.
14. **P28-K** (REST args hardening) — large and mechanical; can be parallelised or done route-by-route across sprints.
15. **P28-P** (settings ETag + PATCH) — low risk, do near the end.
16. **P28-O** (campaign templates) — most design work; last.
17. **P28-Q** (hierarchical categories) — depends on P28-C; do last in the category track.
