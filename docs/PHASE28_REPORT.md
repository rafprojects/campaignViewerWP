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
| P28-F | Pagination on currently unbounded list endpoints | Low | Medium | Completed |
| P28-G | Audit log improvements (pagination, filters, global admin endpoint) | Low–Medium | Medium | Completed |
| P28-H | Analytics expansion (per-media tracking, cross-campaign dashboard, external hook) | Medium | Medium | Completed |
| P28-I | Magic-link access request approval | Low | Medium | Completed |
| P28-J | Access totals summary endpoint | Low | Low–Medium | Completed |
| P28-K | REST args hardening (`D-8` — typed args arrays on all routes) | Large | Medium | Completed |
| P28-L | Rate-limit status headers (`X-RateLimit-*` on all rate-limited endpoints) | Low | Medium | Completed |
| P28-M | Media sort controls on list endpoints | Low | Low–Medium | Completed |
| P28-N | Duplicate media detection on upload (pHash/MD5) | Medium | Low–Medium | Completed |
| P28-O | Campaign templates (preset library) | Medium | Low | Completed |
| P28-P | Settings ETag support + `PATCH` method on settings endpoint | Low | Low | Completed |
| P28-Q | Hierarchical campaign categories | Low | Low | Completed |
| P28-R | Campaign category TreeSelect UI (P28-Q frontend) | Low | Low |

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

- [x] Each affected endpoint respects `page` + `per_page`.
- [x] Response has `total`, `page`, `per_page`, `total_pages`.
- [x] All React Query hooks updated to read `.items`.
- [x] PHPUnit: page 1 vs page 2, over-bounds page returns empty items array.

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

- [x] `GET /campaigns/{id}/audit?from=2026-01-01&to=2026-03-31` returns filtered entries.
- [x] `GET /campaigns/{id}/audit?action=media.added` returns only media additions.
- [x] `GET /admin/audit-log` returns entries across all campaigns.
- [x] `GET /admin/audit-log` with `Accept: text/csv` returns valid CSV.
- [x] `wpsg_audit_log` table created by `WPSG_DB::maybe_upgrade()`.
- [x] Backfill from post meta runs on first query.
- [x] PHPUnit: pagination, date filter, action filter, CSV export header.

### Implementation notes

- **DB layer** (`class-wpsg-db.php`): `DB_VERSION` bumped to `8`. `maybe_create_audit_log_table()` called from `maybe_upgrade()`. `insert_audit_entry()`, `backfill_audit_entries()`, `list_audit_entries()` (supports `campaign_id`, `from`, `to`, `action`, `page`, `per_page`), and `format_audit_entry()` added.
- **REST layer** (`class-wpsg-rest.php`): `add_audit_entry()` writes to DB. `list_audit()` triggers backfill-on-first-query, then queries DB with filters. New `GET /admin/audit-log` route (admin-only) backed by `list_global_audit()`. CSV export via `rest_pre_serve_request` filter with `audit_csv_response()`.
- **Frontend**: `AuditEntry` type updated (adds `actorLogin`, `campaignId`). `AuditFilters` interface added. `useAuditEntries` / `useGlobalAuditEntries` hooks support filter params. `AuditTab` gets From/To/Action inputs and Export CSV button. New `GlobalAuditTab` component added. `AdminPanel` gains Global Audit tab.
- **PHPUnit** (`WPSG_P28G_Audit_Log_Test.php`): 8 tests covering table creation, backfill, date/action filters, pagination, cross-campaign view, campaign_id filter, CSV Content-Type.

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

### Change implemented

Added `args` arrays to 11 route registrations in `register_routes()`, covering
all high-security-impact mutation endpoints. WP's native `enum`, `type`, `format`,
`required`, `minimum`, and `sanitize_callback` keys are used throughout so that
validation fires before any handler is invoked.

**Routes hardened:**
- `POST /campaigns` — `title` required, `visibility`/`status` enums
- `PUT /campaigns/{id}` — `visibility`/`status` enums, `title` sanitized
- `POST /campaigns/batch` — `action` required + enum, `ids` required integer array
- `POST /analytics/event` — `campaignId` required integer, `eventType` enum
- `POST /campaigns/{id}/media` — `type`/`source` required enums, `url`/`caption` sanitized
- `POST /campaigns/{id}/access` — `userId` required integer, `source` required enum, `action` enum
- `POST /campaigns/{id}/access-requests` — `email` required with `format: email`
- `POST /campaign-categories` — `name` required string
- `PUT /campaign-categories/{id}` — `name`/`slug` sanitized
- `POST /users` — `email` required + format, `displayName` required, `role` enum
- `POST /auth/login` — already had args (unchanged)

**Note on `POST /media/upload`:** File params arrive via `$_FILES`, not the
REST body; WP REST `args` does not apply to `get_file_params()`. MIME-type and
size validation already happen early in `upload_single_media_file()` (returns
415/413 before the attachment is created), so this endpoint is already hardened
at the handler layer.

### Acceptance criteria

- [x] `GET /wp-json/wp-super-gallery/v1` returns a schema document listing all routes with args.
- [x] `POST /campaigns` with missing `title` returns WP default `rest_missing_callback_param` error.
- [x] `POST /media/upload` with disallowed MIME type returns early 415 (handled in `upload_single_media_file`).
- [x] Existing PHPUnit tests remain green (args validation fires before handlers).
- [x] New PHPUnit tests in `WPSG_REST_Routes_Test` cover required-field and enum rejections for all priority routes.

---

## Track P28-L — Rate-Limit Status Headers

**Source:** P27-B API-17

### Problem

Rate-limited endpoints return `429` when the limit is exceeded, but clients
have no visibility into their remaining quota until they hit the wall.

### Change implemented

`rate_limit_check()` now populates `WPSG_REST::$rate_limit_headers` (a private
static array) with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset` on every call — including calls that result in a 429.

A `rest_post_dispatch` filter registered in `register_routes()` reads this
property after the response is built and injects the three headers. This keeps
the permission callback return type unchanged (WP_Error or true).

Both storage backends are covered:
- **Object cache (`wp_cache_incr`) path** — a paired `_reset` cache entry
  records the window's expiry timestamp; added on window creation with the same
  TTL as the count key.
- **Transient path** — reset is computed from `start + window` stored in the
  transient data array.

### Acceptance criteria

- [x] `GET /campaigns` response includes `X-RateLimit-Limit` header.
- [x] `X-RateLimit-Remaining` decrements on subsequent requests.
- [x] `X-RateLimit-Reset` is a valid Unix timestamp.
- [x] 429 responses still include all three headers.
- [x] PHPUnit tests cover header presence, decrement, and 429 case.

---

## Track P28-M — Media Sort Controls

**Source:** P27-B API-12 · FUTURE_TASKS Media Sorting Controls

### Problem

`GET /campaigns/{id}/media` and `GET /media/library` return items in insertion
order with no sort control.

### Change implemented

`sort` query param added (registered in `args` with an enum so unknown values
return 400 before reaching the handler):

**`GET /campaigns/{id}/media`** (default `order_asc`) — sorted in PHP via
`sort_media_items()` after loading from post meta:

| `sort` value | Sort key |
|---|---|
| `order_asc` (default) | `order` asc |
| `order_desc` | `order` desc |
| `title_asc` / `title_desc` | `caption` (falls back to `title`) via `strnatcasecmp` |
| `created_asc` / `created_desc` | `dateUploaded` timestamp; falls back to `order` if absent |
| `size_asc` / `size_desc` | `filesize`; falls back to 0 if absent |

The `sort` value is echoed in the response `meta.sort` field. The ETag salt
now includes the sort param so different sort orders don't serve stale caches.

**`GET /media/library`** (default `created_desc`) — sort mapped to WP_Query
`orderby`/`order` args:

| `sort` value | `orderby` | `order` |
|---|---|---|
| `order_asc` / `order_desc` | `menu_order` | ASC/DESC |
| `title_asc` / `title_desc` | `title` | ASC/DESC |
| `created_asc` / `created_desc` | `date` | ASC/DESC |
| `size_asc` / `size_desc` | `meta_value_num` (`_wp_attachment_metadata`) | ASC/DESC |

### Frontend change

Not in scope for backend-only track — MediaTab sort dropdown deferred.

### Acceptance criteria

- [x] `?sort=title_asc` returns media sorted alphabetically.
- [x] `?sort=order_desc` reverses insertion order.
- [x] `GET /media/library?sort=created_desc` returns WP attachments in creation order (default).
- [x] Unknown sort value rejected with 400 by args enum validation before handler runs.
- [x] PHPUnit covers `order_asc`, `order_desc`, `title_asc`, `title_desc`, unknown-sort, and `meta.sort` in response.

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

### Change implemented

MD5-based exact-duplicate detection added to `POST /media/upload`.

**Flow:**
1. After file type/size validation, `md5_file($tmp_name)` is called while the
   temp file is still readable (before `wp_handle_sideload` moves it).
2. `find_attachment_by_md5()` queries `wp_postmeta` for `_wpsg_file_md5 = {hash}`.
3. If a match exists and `force` is false: a `wpsg_duplicate_file` WP_Error is
   returned (with `existing_id` and `existing_url` in error data).
4. `upload_media` converts this to a `409` response with
   `{ duplicate: true, existing_id, existing_url }` for single uploads.
5. For batch uploads the per-file result gets `{ success: false, duplicate: true,
   existing_id, existing_url }` — the batch itself still returns 201 (partial success).
6. On successful upload, `update_post_meta($id, '_wpsg_file_md5', $md5)` stores
   the hash for future comparisons.
7. `?force=true` (registered as a boolean arg) skips step 2–3 entirely.

**pHash (near-duplicate):** deferred to a future phase; the `jensseger/imagehash`
dependency is not bundled. The MD5 check covers exact duplicates.

### Acceptance criteria

- [x] Uploading the same file twice returns `409` on the second attempt.
- [x] `_wpsg_file_md5` is stored on each uploaded attachment.
- [x] `?force=true` bypasses MD5 check and uploads anyway.
- [x] Duplicate in batch: per-file result has `duplicate: true`; batch returns 201.
- [x] PHPUnit: unique file (201 + MD5 stored), exact duplicate (409), forced re-upload (201), batch duplicate.

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

- [x] `GET /campaign-templates` returns built-in + user templates.
- [x] `POST /campaign-templates/{id}/instantiate` creates a new campaign pre-populated with template settings.
- [x] Built-in templates cannot be deleted.
- [x] PHPUnit: list, instantiate, delete user template, attempt delete builtin (403).

### Implementation notes

- New `class-wpsg-campaign-templates.php`: holds `BUILTIN` constant array (2 first-party
  templates: `builtin_blank`, `builtin_public_showcase`), plus helpers `get_builtins()`,
  `is_builtin()`, `get_builtin()`, `post_to_template()`, `get_user_templates()`.
- User templates stored as `wpsg_campaign` posts with `_wpsg_is_template = 1` post meta.
  No media items — templates are blank prototypes.
- `POST /campaign-templates` accepts optional `from_campaign_id` to seed visibility and
  gallery overrides from an existing campaign; falls back to safe defaults.
- `POST /campaign-templates/{id}/instantiate` works for both builtin IDs
  (`builtin_*` strings) and numeric user template IDs; returns a full campaign object
  via `format_campaign()`. Instantiated campaigns do NOT carry `_wpsg_is_template`.
- `DELETE /campaign-templates/{id}` returns 403 for any builtin ID.
- Route ID pattern: `[a-zA-Z0-9_]+` covers both `builtin_blank` and numeric post IDs.
- Frontend picker (template modal before "New Campaign") deferred to a future track.
- 11 PHPUnit tests across list, create (scratch + from campaign), delete, and instantiate paths.

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

- [x] `GET /settings` response includes `ETag` header.
- [x] `GET /settings` with matching `If-None-Match` returns `304`.
- [x] `PATCH /settings` with `{ "default_visibility": "private" }` updates only that key.
- [x] `POST /settings` still works (full replace for backward compat).
- [x] PHPUnit: ETag roundtrip, PATCH partial merge, POST full replace.

### Implementation notes

- `get_public_settings()` now accepts `$request` and delegates to the existing
  `respond_with_etag()` helper (same md5-of-payload approach used by other endpoints).
- `patch_settings()` converts camelCase body via `WPSG_Settings::from_js()`, sanitizes,
  then intersects with the sent keys before merging — so unsent sibling keys are never
  overwritten. `POST` is unchanged for backward compat.
- Route registration adds a third `PATCH` entry alongside GET/POST.

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

- [x] `GET /campaign-categories` returns `parent_id` on each term.
- [x] `POST /campaign-categories` with `parent_id` creates a child term.
- [x] Taxonomy re-registration does not affect existing flat terms (parent_id = 0).
- [ ] TreeSelect renders up to 3 levels. *(deferred — frontend only; backend complete)*

### Implementation notes

- `class-wpsg-cpt.php`: `wpsg_campaign_category` registration changed to
  `'hierarchical' => true`. Existing flat terms are unaffected (WP stores `parent = 0`).
- `format_term()`: adds `'parent_id' => (int) $term->parent` — used by all category
  responses (list, create, update).
- `handle_term_insert()`: accepts optional `$parent_id`; passes `'parent'` to
  `wp_insert_term()` when non-zero.
- `create_campaign_category()` / `update_campaign_category()`: both forward `parent_id`
  from the request; route args updated with `type: integer, minimum: 0`.
- PHPUnit: 3 tests covering `parent_id` in list, child creation, and PUT update.

---

## Track P28-R — Campaign Category TreeSelect UI

**Source:** P28-Q deferred frontend

### Problem

The campaign category picker in `UnifiedCampaignModal` is a flat `TagsInput`
that stores category **names** as `string[]`. Now that the backend (P28-Q)
supports parent–child relationships, the UI needs to show the hierarchy and
allow users to pick from it.

### Current state

- `UnifiedCampaignModal` props: `availableCategories?: string[]` (flat names)
- `formState.categories: string[]` (names)
- Rendered as Mantine `<TagsInput>` with free-text entry and autocomplete

### Proposed change

- Fetch the full category objects from `GET /campaign-categories` (which now
  returns `{ id, name, slug, parent_id }`) in `AdminPanel` / the modal's data
  source.
- Build a `CategoryTreeSelect` component backed by Mantine `<MultiSelect>` with
  indented group labels for parent terms, or a custom tree-aware combobox.
- Enforce a maximum of **3 nesting levels** in the UI — deeper terms are shown
  but selecting a 4th-level term is blocked with a tooltip.
- Change `formState.categories` from `string[]` (names) to `string[]` (term IDs
  as strings) to unambiguously identify terms. Update all consumers.
- `availableCategories` prop replaced by `availableCategoryTerms: CategoryTerm[]`
  where `CategoryTerm = { id: string; name: string; parent_id: number }`.

### Acceptance criteria

- [ ] Category picker in `UnifiedCampaignModal` shows parent → child indentation.
- [ ] Selecting a child term does not require selecting the parent first.
- [ ] Attempting to assign a 4th-level term shows a disabled state with a tooltip.
- [ ] `formState.categories` stores term IDs (not names); existing save/load logic updated.
- [ ] `TaxonomyManagerModal` shows parent name in the category list for child terms.
- [ ] Vitest: tree-building helper unit tests; modal integration snapshot or interaction test.

### Notes

- The `TagsInput` → `MultiSelect` change requires updating the save path: the
  campaign create/edit handlers currently send `categories` as names and the PHP
  side does `wp_insert_term` on unknown names. After this change they should send
  IDs and the PHP side should call `wp_set_object_terms` with integers directly.
- This is a **data-model change** for `formState.categories`; grep for all usages
  before starting.

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
