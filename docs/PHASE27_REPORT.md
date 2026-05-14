# Phase 27 — API Contract Sweep & Improvement Analysis

**Status:** Planned
**Created:** 2026-05-14
**Last updated:** 2026-05-14 (added P27-C, P27-D, P27-E)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P27-A | API doc accuracy & completeness — fix every entry in `docs/api/` | Planned | Large |
| P27-B | API improvement analysis — surface additions and enhancements through the "what can be added" lens | Planned | Medium |
| P27-C | Admin SPA query cache & performance hardening — audit TanStack Query keys, staleTime, invalidation, and tab state preservation | Planned | Low–Medium |
| P27-D | TypeScript strictness improvements — enable `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` across the codebase | **Complete** | Medium |
| P27-E | React review debt batch — targeted fixes from the FUTURE_TASKS RD backlog (RD-3, RD-8, RD-10, RD-16, RD-18) | In Progress | Low–Medium |

---

## Rationale

Phase 26 closed the React 19 / Mantine 9 migration and surfaced two known gaps between the OpenAPI spec and the live code:

1. `GET /campaigns/{id}/audit` is registered in `class-wpsg-rest.php` (line 277) but does not exist anywhere in `docs/api/openapi.yaml`.
2. `PUT /campaigns/{id}/media/{mediaId}` and `DELETE /campaigns/{id}/media/{mediaId}` are registered (line 205) but the spec only documents the collection-level routes.

A full reconciliation revealed the spec is underspecified across the board: request body schemas are nearly empty, response shapes are undefined, query parameter options are incomplete, and many security annotations are either incorrect or inconsistent. The Postman collection contains only 4 items against a surface of 53 route registrations.

Phase 27 fixes all of this and goes one step further: it evaluates the full API through an improvement lens and decides the fate of the relevant FUTURE_TASKS entries (promote, defer, or prune).

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | OpenAPI version | Remain on 3.0.3 until YAML is fully accurate; upgrade to 3.1.0 can be a follow-on once validity is verified |
| B | Postman collection scope | Rebuild with full domain folder hierarchy; keep the cookie-login → nonce-capture flow from the existing v2.1.0 collection |
| C | Schema definitions vs inline | Expand `components/schemas` rather than using inline schemas; all reusable shapes must be a `$ref` |
| D | FUTURE_TASKS disposition | Each relevant FUTURE_TASKS entry is evaluated below in P27-B; accepted items move here, prune candidates are explicitly noted |

## Execution Priority

1. **P27-A** — fix documentation first so the spec is trustworthy before any new endpoints are added.
2. **P27-B** — improvement candidates are evaluated and prioritized so implementation can follow in a Phase 28 or dedicated sub-phase.
3. **P27-C** — query cache audit is independent of API work and can run in parallel with P27-A.
4. **P27-D** — TypeScript strictness is a global pass; run the error-count diagnostic first before committing scope.
5. **P27-E** — React debt items are individually small; can be interleaved with other tracks as capacity allows.

---

## Track P27-A — API Documentation Accuracy & Quality Review

### Problem

The two `docs/api/` artifacts — `openapi.yaml` and `wp-super-gallery.postman_collection.json` — do not accurately or completely reflect the live API at v0.24.0.

**Confirmed missing endpoints in `openapi.yaml`:**

| Missing path | HTTP method | Registered at |
|---|---|---|
| `/campaigns/{id}/audit` | GET | class-wpsg-rest.php line 277 |
| `/campaigns/{id}/media/{mediaId}` | PUT | class-wpsg-rest.php line 205 |
| `/campaigns/{id}/media/{mediaId}` | DELETE | class-wpsg-rest.php line 205 |

**Missing query parameters on documented endpoints:**

| Path | Missing params |
|---|---|
| `GET /campaigns` | `company` (string), `search` (string) |
| `GET /analytics/campaigns/{id}` | `granularity` (if supported) |

**Incomplete or incorrect security annotations:**

| Path | Spec says | Code says |
|---|---|---|
| `POST /campaigns/{id}/restore` | `bearerAuth` only | `require_admin` (accepts both bearer + nonce) |
| `POST /campaigns/{id}/archive` | `bearerAuth + cookieNonce` | `require_admin` (same — inconsistency between the two twin endpoints) |
| `GET /nonce` | `cookieNonce` only | `require_authenticated` (either cookie or bearer) |
| `POST /auth/logout` | `cookieNonce` only | `require_authenticated` (accepts either) |
| `POST /analytics/event` | No security shown (implicit public) | `rate_limit_public` — should be explicit |

**Schemas that need major expansion:**

Almost every schema in `components/schemas` is a stub. Specific gaps:

- `Campaign`: missing `slug`, `status`, `visibility`, `company_id`, `template_id`, `categories`, `tags`, `media_count`, `created_at`, `updated_at`, `settings_override`.
- `MediaItem`: missing `caption`, `order`, `thumbnail`, `attachment_id`, `created_at`.
- `PaginatedCampaigns`: schema present but item shape is only `$ref: Campaign` which itself is a stub.
- No schemas defined at all for: `AccessGrant`, `AccessRequest`, `AuditEntry`, `Company`, `User`, `Role`, `AnalyticsEvent`, `AnalyticsSummary`, `LayoutTemplate`, `OverlayItem`, `FontItem`, `Settings`, `HealthData`, `OembedResponse`, `ThumbnailCacheStats`.

**All HTTP error responses missing:**

Every operation is missing 401, 403, 404, 422, and 429 response codes. The `Error` schema exists in components but is not referenced.

**Postman collection coverage:**

The current collection has 4 items. The plugin exposes 53 route registrations (~70 method-path combinations). Existing items:

| Request | Coverage |
|---|---|
| Cookie Login | Partial (saves nonce only, no assertion on user object) |
| Get Settings (Authenticated) | Minimal (no assertions) |
| Get Campaigns (Authenticated) | Minimal (no assertions) |
| Get Campaigns (Public) | Minimal (no assertions) |

### Fix

#### Part 1 — OpenAPI YAML

**1. Add missing `components/schemas`**

Expand to include the following fully-typed schemas (all fields, required arrays, descriptions, and example values):

- `Campaign` — full shape including all meta fields
- `CampaignCreate` — subset of Campaign accepted by POST body
- `CampaignUpdate` — subset accepted by PUT body (all optional)
- `MediaItem` — id, url, type, source, caption, order, thumbnail, attachment_id
- `MediaItemUpdate` — fields accepted by PUT /campaigns/{id}/media/{mediaId}
- `MediaReorderItem` — { id: string, order: integer }
- `PaginatedCampaigns` — items: Campaign[], page, per_page, total, total_pages
- `AccessGrant` — campaign_id, user_id, user_login, user_email, granted_at
- `AccessRequest` — id, token, campaign_id, email, status (pending/approved/denied), created_at
- `AuditEntry` — id, action, user_id, user_login, data: object, created_at
- `Company` — id, name, slug
- `User` — id, login, email, display_name, roles
- `Role` — name, display_name, capabilities
- `AnalyticsEvent` — campaign_id, event_type, session_id, created_at
- `AnalyticsSummary` — campaign_id, period_start, period_end, total_views, unique_visitors, daily: []
- `LayoutTemplate` — id (uuid), name, slots: [], created_at, updated_at
- `OverlayItem` — id (uuid), url, name, mime_type, size
- `FontItem` — id (uuid), url, family, filename, size
- `Settings` — full flat key/value shape matching what GET /settings returns
- `HealthData` — version, wp_version, php_version, db_version, cache_driver, table_checks: []
- `OembedResponse` — url, html, width, height, provider_name, thumbnail_url
- `ThumbnailCacheStats` — count, total_size_bytes, oldest_entry, newest_entry
- `Error` — code, message, data (already exists; add description and example)
- `NoncePaginationMeta` — page, per_page, total, total_pages (shared across paginated responses)

**2. Fix and expand every path entry**

For each path below, the fix column describes the changes required. Entries are grouped by domain.

---

##### Domain: Campaigns (core CRUD)

**`GET /wp-json/wp-super-gallery/v1/campaigns`**
- Add missing query params: `company` (string, company slug/ID), `search` (string, full-text)
- Expand response `200` to reference `PaginatedCampaigns` schema with `$ref`
- Add responses: `429` (rate limited)
- Add operation `description` explaining visibility rules for authenticated vs. anonymous callers
- Add `operationId: listCampaigns`
- Add `tags: [Campaigns]`

**`POST /wp-json/wp-super-gallery/v1/campaigns`**
- Replace bare `requestBody` with `$ref: CampaignCreate`; mark `title` as required
- Expand response `201` to reference `Campaign` schema
- Add responses: `400`, `401`, `403`
- Security: add both `bearerAuth` and `cookieNonce` as alternatives (code uses `require_admin`)
- Add `operationId: createCampaign`
- Add `tags: [Campaigns]`

**`GET /wp-json/wp-super-gallery/v1/campaigns/{id}`**
- Add path param description: "Numeric campaign post ID"
- Expand response `200` to reference `Campaign` schema
- Document visibility logic in `description`: public campaigns are accessible without auth; private campaigns require `read_post` or `manage_options`
- Add responses: `401`, `403`
- Add `operationId: getCampaign`
- Add `tags: [Campaigns]`

**`PUT /wp-json/wp-super-gallery/v1/campaigns/{id}`**
- Replace bare `requestBody` with `$ref: CampaignUpdate`
- Expand response `200` to reference `Campaign` schema
- Add responses: `400`, `401`, `403`, `404`
- Security: add both `bearerAuth` and `cookieNonce`
- Add `operationId: updateCampaign`
- Add `tags: [Campaigns]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/archive`**
- Fix security: add `cookieNonce` alternative to match `require_admin`
- Add responses: `401`, `403`, `404`
- Add `operationId: archiveCampaign`
- Add `tags: [Campaigns]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/restore`**
- Fix security: add `cookieNonce` alternative (currently only `bearerAuth`)
- Add responses: `401`, `403`, `404`
- Add `operationId: restoreCampaign`
- Add `tags: [Campaigns]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/duplicate`**
- Expand `requestBody`: `name` (string, optional, new campaign title), `copyMedia` (boolean, default true), `copyTemplate` (boolean, default false — from P25 deep-clone feature)
- Response `201`: reference `Campaign` schema
- Security: add `cookieNonce` alternative
- Add `description` noting that `copyTemplate=true` creates an independent clone of the linked layout template
- Add responses: `401`, `403`, `404`
- Add `operationId: duplicateCampaign`
- Add `tags: [Campaigns]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/batch`**
- Expand `requestBody`: `action` (enum: `archive`, `restore`, `delete`), `ids` (array of integers, required)
- Expand response `200`: `{ processed: integer, failed: integer, errors: [{ id, message }] }`
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`
- Add `operationId: batchCampaigns`
- Add `tags: [Campaigns]`

**`GET /wp-json/wp-super-gallery/v1/campaigns/{id}/export`**
- Expand response `200`: JSON attachment; document that `Content-Disposition: attachment` header is set
- Response body shape: `{ version: string, campaign: Campaign, media: MediaItem[], settings_override: object }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: exportCampaign`
- Add `tags: [Campaigns]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/import`**
- Expand `requestBody`: JSON body matching export shape (`version`, `campaign`, `media`)
- Expand response `201`: reference `Campaign` schema with import metadata
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `422` (schema version mismatch)
- Add `operationId: importCampaign`
- Add `tags: [Campaigns]`

---

##### Domain: Campaign Media

**`GET /wp-json/wp-super-gallery/v1/campaigns/{id}/media`**
- Add path param `id` description
- Expand response `200`: `{ items: MediaItem[], total: integer }`
- Add responses: `403`, `404`, `429`
- Add `operationId: listCampaignMedia`
- Add `tags: [Media]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/media`**
- Expand `requestBody`: `type` (enum: `image`, `video`, `oembed`, `external`), `source`, `url`, `attachment_id` (integer), `caption` (string, optional), `order` (integer, optional)
- Expand response `201`: reference `MediaItem` schema
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `404`
- Add `operationId: createCampaignMedia`
- Add `tags: [Media]`

**`PUT /wp-json/wp-super-gallery/v1/campaigns/{id}/media/reorder`**
- Expand `requestBody`: `items` (array of `MediaReorderItem`), both `id` and `order` required
- Expand response `200`: `{ message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `404`
- Add `operationId: reorderCampaignMedia`
- Add `tags: [Media]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/media/rescan`**
- Add description: rescans all media items in the campaign and updates their `type` field based on URL/MIME analysis
- Expand response `200`: `{ updated: integer, message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: rescanCampaignMedia`
- Add `tags: [Media]`

**`PUT /wp-json/wp-super-gallery/v1/campaigns/{id}/media/{mediaId}`** ← **ADD — currently missing**
- Add path parameters: `id` (integer, campaign post ID), `mediaId` (string, media item identifier)
- `requestBody`: reference `MediaItemUpdate` — `caption` (string, optional), `order` (integer, optional), `thumbnail` (string URI, optional)
- Response `200`: `{ message: "Media updated" }`
- Responses: `400`, `401`, `403`, `404`
- Security: `bearerAuth` OR `cookieNonce`
- `operationId: updateCampaignMediaItem`
- `tags: [Media]`

**`DELETE /wp-json/wp-super-gallery/v1/campaigns/{id}/media/{mediaId}`** ← **ADD — currently missing**
- Add path parameters: `id` (integer), `mediaId` (string)
- Response `200`: `{ message: "Media deleted" }`
- Responses: `401`, `403`, `404`
- Security: `bearerAuth` OR `cookieNonce`
- `operationId: deleteCampaignMediaItem`
- `tags: [Media]`

**`POST /wp-json/wp-super-gallery/v1/media/rescan-all`**
- Add description: site-wide rescan; scans all media items across all campaigns
- Expand response `200`: `{ scanned: integer, updated: integer, message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: rescanAllMedia`
- Add `tags: [Media]`

**`GET /wp-json/wp-super-gallery/v1/media/library`**
- Add query params: `page` (integer), `per_page` (integer), `search` (string), `mime_type` (string)
- Expand response `200`: `{ items: MediaLibraryItem[], total: integer, page: integer, per_page: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listMediaLibrary`
- Add `tags: [Media]`

**`POST /wp-json/wp-super-gallery/v1/media/upload`**
- Expand `requestBody` (multipart/form-data): `file` (binary, required), `campaign_id` (integer, optional, attaches to campaign after upload)
- Expand response `201`: reference `MediaItem` schema plus `attachment_id`
- Document error responses per upload error codes: 400 (no file, partial), 413 (size exceeded), 500 (server error)
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `413`
- Add `operationId: uploadMedia`
- Add `tags: [Media]`

**`GET /wp-json/wp-super-gallery/v1/media/{mediaId}/usage`**
- Add path param description: "Media item string ID (not WP attachment ID)"
- Expand response `200`: `{ media_id: string, campaigns: [{ id: integer, title: string }], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: getMediaUsage`
- Add `tags: [Media]`

**`GET /wp-json/wp-super-gallery/v1/media/usage-summary`**
- Add query param: `ids[]` (array of strings, required) — comma-separated or repeated
- Expand response `200`: `{ [mediaId: string]: { campaign_count: integer, campaigns: integer[] } }`
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`
- Add `operationId: getMediaUsageSummary`
- Add `tags: [Media]`

---

##### Domain: Campaign Access Control

**`GET /wp-json/wp-super-gallery/v1/campaigns/{id}/access`**
- Expand response `200`: `{ items: AccessGrant[], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: listCampaignAccess`
- Add `tags: [Access]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/access`**
- Expand `requestBody`: `user_id` (integer) OR `email` (string) — at least one required; `note` (string, optional)
- Expand response `200`: reference `AccessGrant`
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `404`, `409` (grant already exists)
- Add `operationId: grantCampaignAccess`
- Add `tags: [Access]`

**`DELETE /wp-json/wp-super-gallery/v1/campaigns/{id}/access/{userId}`**
- Add path param description: "`userId` is the WordPress user ID"
- Expand response `200`: `{ message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: revokeCampaignAccess`
- Add `tags: [Access]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/access-requests`**
- Expand `requestBody`: `email` (string, required), `message` (string, optional), `name` (string, optional)
- Expand response `201`: `{ token: string, status: "pending", message: string }`
- Document rate limiting behaviour (uses `rate_limit_public`)
- Add responses: `400`, `422` (already granted/already requested), `429`
- Add `operationId: submitAccessRequest`
- Add `tags: [Access]`

**`GET /wp-json/wp-super-gallery/v1/campaigns/{id}/access-requests`**
- Expand response `200`: `{ items: AccessRequest[], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: listAccessRequests`
- Add `tags: [Access]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/access-requests/{token}/approve`**
- Add path param descriptions: `token` is a UUID v4 hex string
- Expand response `200`: `{ message: string, grant: AccessGrant }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404` (campaign or token not found), `409` (already decided)
- Add `operationId: approveAccessRequest`
- Add `tags: [Access]`

**`POST /wp-json/wp-super-gallery/v1/campaigns/{id}/access-requests/{token}/deny`**
- Same pattern as approve; expand correspondingly
- Response `200`: `{ message: string }`
- Add `operationId: denyAccessRequest`
- Add `tags: [Access]`

---

##### Domain: Campaign Audit Log

**`GET /wp-json/wp-super-gallery/v1/campaigns/{id}/audit`** ← **ADD — currently missing**
- Add full path entry under `/wp-json/wp-super-gallery/v1/campaigns/{id}/audit`
- Summary: "List campaign audit log entries"
- Description: "Returns the chronological audit log for a campaign. Each entry records a state-change event (media.added, media.updated, media.deleted, access.granted, access.revoked, campaign.archived, etc.) along with the acting user and any relevant data payload."
- Path param `id`: integer, required
- Response `200`: `{ items: AuditEntry[] }` — reference `AuditEntry` schema
- Security: `bearerAuth` OR `cookieNonce` (code uses `require_admin`)
- Responses: `401`, `403`, `404`
- `operationId: listCampaignAudit`
- `tags: [Campaigns]`

---

##### Domain: Analytics

**`POST /wp-json/wp-super-gallery/v1/analytics/event`**
- Expand `requestBody`: `campaign_id` (integer, required), `event_type` (string enum: `view`, `lightbox_open`, `video_play`), `session_id` (string, UUID), `media_id` (string, optional)
- Expand response `201`: `{ recorded: boolean }`
- Document that this endpoint is public/rate-limited via `rate_limit_public`
- Add `security: []` explicitly (unauthenticated/public)
- Add responses: `400`, `429`
- Add `operationId: recordAnalyticsEvent`
- Add `tags: [Analytics]`

**`GET /wp-json/wp-super-gallery/v1/analytics/campaigns/{id}`**
- Expand response `200`: reference `AnalyticsSummary` schema
- Clarify `from`/`to` param format: ISO 8601 date string (`YYYY-MM-DD`)
- Add `granularity` query param note (if the handler supports it; verify in code)
- Security: add `cookieNonce` alternative
- Add responses: `400` (invalid date format), `401`, `403`, `404`
- Add `operationId: getCampaignAnalytics`
- Add `tags: [Analytics]`

---

##### Domain: Tags & Categories

**`GET /wp-json/wp-super-gallery/v1/campaign-categories`**
- Expand response `200`: `{ items: [{ id: integer, name: string, slug: string, count: integer }] }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listCampaignCategories`
- Add `tags: [Taxonomy]`

**`GET /wp-json/wp-super-gallery/v1/tags/campaign`**
- Expand response `200`: `{ items: [{ id: integer, name: string, slug: string, count: integer }] }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listCampaignTags`
- Add `tags: [Taxonomy]`

**`GET /wp-json/wp-super-gallery/v1/tags/media`**
- Expand response `200`: `{ items: [{ id: integer, name: string, slug: string, count: integer }] }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listMediaTags`
- Add `tags: [Taxonomy]`

---

##### Domain: Companies

**`GET /wp-json/wp-super-gallery/v1/companies`**
- Expand response `200`: `{ items: Company[], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listCompanies`
- Add `tags: [Companies]`

**`GET /wp-json/wp-super-gallery/v1/companies/{id}/access`**
- Expand response `200`: `{ items: AccessGrant[], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: listCompanyAccess`
- Add `tags: [Companies]`

**`POST /wp-json/wp-super-gallery/v1/companies/{id}/access`**
- Expand `requestBody`: `user_id` (integer) OR `email` (string)
- Expand response `200`: reference `AccessGrant`
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `404`, `409`
- Add `operationId: grantCompanyAccess`
- Add `tags: [Companies]`

**`DELETE /wp-json/wp-super-gallery/v1/companies/{id}/access/{userId}`**
- Add path param descriptions
- Expand response `200`: `{ message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: revokeCompanyAccess`
- Add `tags: [Companies]`

**`POST /wp-json/wp-super-gallery/v1/companies/{id}/archive`**
- Expand response `200`: `{ message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: archiveCompany`
- Add `tags: [Companies]`

---

##### Domain: Users & Roles

**`GET /wp-json/wp-super-gallery/v1/users/search`**
- Add query param: `search` (string, required) — searches by login, email, display name
- Expand response `200`: `{ items: User[] }`
- Security: add `cookieNonce` alternative
- Add responses: `400` (missing search), `401`, `403`
- Add `operationId: searchUsers`
- Add `tags: [Users]`

**`POST /wp-json/wp-super-gallery/v1/users`**
- Expand `requestBody`: `username` (string, required), `email` (string, required), `password` (string, required), `role` (string, optional)
- Expand response `201`: reference `User` schema
- Add responses: `400`, `401`, `403`, `409` (username/email taken)
- Note: uses `rate_limit_authenticated` not `require_admin` — accessible to logged-in non-admin users
- Add `operationId: createUser`
- Add `tags: [Users]`

**`GET /wp-json/wp-super-gallery/v1/roles`**
- Expand response `200`: `{ items: Role[] }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listRoles`
- Add `tags: [Users]`

---

##### Domain: Settings

**`GET /wp-json/wp-super-gallery/v1/settings`**
- Mark as public (`security: []`) — uses `rate_limit_public`
- Expand response `200`: reference `Settings` schema
- Add responses: `429`
- Add description explaining the difference between public settings and admin settings
- Add `operationId: getPublicSettings`
- Add `tags: [Settings]`

**`POST /wp-json/wp-super-gallery/v1/settings`**
- Expand `requestBody`: partial `Settings` object — only the keys being updated need to be present
- Expand response `200`: full `Settings` object (post-update)
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `422` (validation error with per-field details)
- Add `operationId: updateSettings`
- Add `tags: [Settings]`

---

##### Domain: Auth

**`POST /wp-json/wp-super-gallery/v1/auth/login`**
- Expand `requestBody`: `username` (string, required), `password` (string, required), `remember` (boolean, default false)
- Expand response `200`: `{ user_id: integer, user_login: string, display_name: string, nonce: string, roles: string[] }` — document that the nonce in the body should be saved for `X-WP-Nonce`
- Add responses: `400` (missing params), `401` (invalid credentials), `429` (rate limited)
- Add note: sets `wordpress_logged_in_*` and `wp_sec_*` cookies (SameSite behaviour depends on WP configuration)
- Add `operationId: cookieLogin`
- Add `tags: [Auth]`

**`POST /wp-json/wp-super-gallery/v1/auth/logout`**
- Fix security: add `bearerAuth` alternative to match `require_authenticated`
- Expand response `200`: `{ message: "Logged out" }`
- Add responses: `401`
- Add note: clears the WordPress session cookie
- Add `operationId: cookieLogout`
- Add `tags: [Auth]`

**`GET /wp-json/wp-super-gallery/v1/nonce`**
- Fix security: add `bearerAuth` alternative to match `require_authenticated`
- Expand response `200`: `{ nonce: string }` — the fresh `wp_rest` nonce string
- Add description: "Use this to refresh a stale `X-WP-Nonce` header in long-running SPA sessions without a page reload. Nonces expire after 24 hours by default."
- Add responses: `401`
- Add `operationId: refreshNonce`
- Add `tags: [Auth]`

---

##### Domain: Permissions

**`GET /wp-json/wp-super-gallery/v1/permissions`**
- Expand response `200`: `{ can_manage_wpsg: boolean, can_upload_files: boolean, can_manage_options: boolean, user_id: integer, roles: string[] }`
- Security: both `cookieNonce` and `bearerAuth` (code uses `require_authenticated`)
- Add responses: `401`
- Add description: "Returns a flat capability map for the currently authenticated user. Used by the SPA to gate UI elements without repeated capability checks."
- Add `operationId: getPermissions`
- Add `tags: [Auth]`

---

##### Domain: oEmbed Proxy

**`GET /wp-json/wp-super-gallery/v1/oembed`**
- Expand `url` query param: required, must be a full HTTP(S) URL
- Expand response `200`: reference `OembedResponse` schema
- Add responses: `400` (missing/invalid URL), `422` (oEmbed provider returned no usable data), `429`
- Add security note: this endpoint is public with rate limiting; SSRF mitigations are in place server-side (HTTPS-only, RFC-1918 IP blocking, allowlist)
- Mark `security: []` explicitly
- Add `operationId: proxyOembed`
- Add `tags: [Media]`

---

##### Domain: Admin Tools — Health & Monitoring

**`GET /wp-json/wp-super-gallery/v1/admin/health`**
- Expand response `200`: reference `HealthData` schema
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: getHealthData`
- Add `tags: [Admin]`

**`GET /wp-json/wp-super-gallery/v1/admin/oembed-failures`**
- Expand response `200`: `{ items: [{ url: string, error: string, failed_at: string }], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listOembedFailures`
- Add `tags: [Admin]`

**`DELETE /wp-json/wp-super-gallery/v1/admin/oembed-failures`**
- Expand response `200`: `{ cleared: integer, message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: resetOembedFailures`
- Add `tags: [Admin]`

**`GET /wp-json/wp-super-gallery/v1/admin/thumbnail-cache`**
- Expand response `200`: reference `ThumbnailCacheStats` schema
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: getThumbnailCacheStats`
- Add `tags: [Admin]`

**`DELETE /wp-json/wp-super-gallery/v1/admin/thumbnail-cache`**
- Expand response `200`: `{ cleared: integer, message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: clearThumbnailCache`
- Add `tags: [Admin]`

**`POST /wp-json/wp-super-gallery/v1/admin/thumbnail-cache/refresh`**
- Expand response `200`: `{ refreshed: integer, message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: refreshThumbnailCache`
- Add `tags: [Admin]`

---

##### Domain: Layout Templates (Admin)

**`GET /wp-json/wp-super-gallery/v1/admin/layout-templates`**
- Expand response `200`: `{ items: LayoutTemplate[], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listLayoutTemplates`
- Add `tags: [LayoutTemplates]`

**`POST /wp-json/wp-super-gallery/v1/admin/layout-templates`**
- Expand `requestBody`: `name` (string, required), `slots` (array, optional), `preset` (string, optional preset key)
- Expand response `201`: reference `LayoutTemplate` schema
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`
- Add `operationId: createLayoutTemplate`
- Add `tags: [LayoutTemplates]`

**`GET /wp-json/wp-super-gallery/v1/admin/layout-templates/{templateId}`**
- Add path param description: "`templateId` is a UUID v4 string"
- Expand response `200`: reference `LayoutTemplate` schema (full slots array)
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: getLayoutTemplate`
- Add `tags: [LayoutTemplates]`

**`PUT /wp-json/wp-super-gallery/v1/admin/layout-templates/{templateId}`**
- Expand `requestBody`: `name` (string, optional), `slots` (array, optional) — partial update
- Expand response `200`: reference `LayoutTemplate` schema
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `404`
- Add `operationId: updateLayoutTemplate`
- Add `tags: [LayoutTemplates]`

**`DELETE /wp-json/wp-super-gallery/v1/admin/layout-templates/{templateId}`**
- Expand response `200`: `{ message: string }`
- Add description: note that deleting a template used by active campaigns will orphan those campaigns (no cascade)
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`, `409` (template in use — if enforced)
- Add `operationId: deleteLayoutTemplate`
- Add `tags: [LayoutTemplates]`

**`POST /wp-json/wp-super-gallery/v1/admin/layout-templates/{templateId}/duplicate`**
- Expand response `201`: reference `LayoutTemplate` schema (new copy with `"(Copy)"` name suffix)
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: duplicateLayoutTemplate`
- Add `tags: [LayoutTemplates]`

---

##### Domain: Layout Templates (Public)

**`GET /wp-json/wp-super-gallery/v1/layout-templates/{templateId}`**
- Mark `security: []` explicitly (uses `__return_true`)
- Expand response `200`: reference `LayoutTemplate` schema — note that only the fields needed for front-end rendering are returned (not admin metadata)
- Add responses: `404`
- Add description: "Read-only public endpoint used by the embedded gallery renderer to fetch layout template configuration. No authentication required."
- Add `operationId: getPublicLayoutTemplate`
- Add `tags: [LayoutTemplates]`

---

##### Domain: Overlay Library

**`GET /wp-json/wp-super-gallery/v1/admin/overlay-library`**
- Expand response `200`: `{ items: OverlayItem[], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listOverlayLibrary`
- Add `tags: [Admin]`

**`POST /wp-json/wp-super-gallery/v1/admin/overlay-library`**
- Expand `requestBody` (multipart/form-data): `file` (binary, required) — image file (PNG/SVG/WebP recommended for overlays)
- Expand response `201`: reference `OverlayItem` schema
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `413`
- Add `operationId: uploadOverlay`
- Add `tags: [Admin]`

**`DELETE /wp-json/wp-super-gallery/v1/admin/overlay-library/{id}`**
- Add path param description: "`id` is a UUID v4 string"
- Expand response `200`: `{ message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: deleteOverlay`
- Add `tags: [Admin]`

---

##### Domain: Font Library

**`GET /wp-json/wp-super-gallery/v1/admin/font-library`**
- Expand response `200`: `{ items: FontItem[], total: integer }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`
- Add `operationId: listFontLibrary`
- Add `tags: [Admin]`

**`POST /wp-json/wp-super-gallery/v1/admin/font-library`**
- Expand `requestBody` (multipart/form-data): `file` (binary, required) — font file (TTF/OTF/WOFF/WOFF2), `family` (string, optional custom family name)
- Expand response `201`: reference `FontItem` schema
- Security: add `cookieNonce` alternative
- Add responses: `400`, `401`, `403`, `413`, `422` (unsupported font format)
- Add `operationId: uploadFont`
- Add `tags: [Admin]`

**`DELETE /wp-json/wp-super-gallery/v1/admin/font-library/{id}`**
- Add path param description: "`id` is a UUID v4 string"
- Expand response `200`: `{ message: string }`
- Security: add `cookieNonce` alternative
- Add responses: `401`, `403`, `404`
- Add `operationId: deleteFont`
- Add `tags: [Admin]`

---

#### Part 2 — Postman Collection Rebuild

The collection must be rebuilt from scratch (preserving the existing file structure so Git history is clean). The rebuilt collection covers every significant method-path pair, organized into domain folders, with proper test scripts, environment variables, and a pre-request setup flow.

**Environment variables required (document in collection description):**

| Variable | Description | Example |
|---|---|---|
| `baseUrl` | Site root, no trailing slash | `https://example.com` |
| `username` | Admin username | `admin` |
| `password` | Admin password | `changeme` |
| `wpsg_nonce` | Captured from login; auto-populated | (auto-set) |
| `campaign_id` | Numeric ID of an existing campaign | `1` |
| `template_id` | UUID of an existing layout template | `abc123-...` |
| `media_id` | String ID of a media item | `abc123.jpg` |
| `user_id` | Numeric WP user ID | `2` |
| `access_token` | JWT token if using bearer auth | (optional) |

**Folder structure:**

```
WP Super Gallery — Full API Collection
├── 00. Auth
│   ├── Cookie Login (captures nonce) ← keep existing, add assertions
│   ├── Cookie Logout
│   └── Refresh Nonce
├── 01. Settings
│   ├── Get Public Settings
│   └── Update Settings (Admin)
├── 02. Permissions
│   └── Get Current User Permissions
├── 03. Campaigns
│   ├── List Campaigns (Public)
│   ├── List Campaigns (Authenticated + filters)
│   ├── Create Campaign
│   ├── Get Campaign
│   ├── Update Campaign
│   ├── Archive Campaign
│   ├── Restore Campaign
│   ├── Duplicate Campaign
│   ├── Batch Actions (archive)
│   ├── Export Campaign
│   └── Import Campaign
├── 04. Campaign Media
│   ├── List Campaign Media
│   ├── Add Media Item (URL/oEmbed)
│   ├── Upload Media (multipart)
│   ├── Update Media Item (caption)
│   ├── Delete Media Item
│   ├── Reorder Media
│   ├── Rescan Campaign Media Types
│   └── Rescan All Media Types (site-wide)
├── 05. Media Library
│   ├── List Media Library
│   ├── Get Media Usage (single)
│   └── Get Media Usage Summary (batch)
├── 06. Campaign Access
│   ├── List Access Grants
│   ├── Grant Access (by user ID)
│   ├── Grant Access (by email)
│   └── Revoke Access
├── 07. Access Requests
│   ├── Submit Access Request (public)
│   ├── List Access Requests (admin)
│   ├── Approve Access Request
│   └── Deny Access Request
├── 08. Campaign Audit Log
│   └── Get Campaign Audit Log
├── 09. Analytics
│   ├── Record Analytics Event (public)
│   └── Get Campaign Analytics
├── 10. Categories & Tags
│   ├── List Campaign Categories
│   ├── List Campaign Tags
│   └── List Media Tags
├── 11. Companies
│   ├── List Companies
│   ├── List Company Access
│   ├── Grant Company Access
│   ├── Revoke Company Access
│   └── Archive Company
├── 12. Users & Roles
│   ├── Search Users
│   ├── Create User
│   └── List Roles
├── 13. Layout Templates (Admin)
│   ├── List Layout Templates
│   ├── Create Layout Template
│   ├── Get Layout Template
│   ├── Update Layout Template
│   ├── Duplicate Layout Template
│   └── Delete Layout Template
├── 14. Layout Templates (Public)
│   └── Get Layout Template (public render)
├── 15. Overlay Library
│   ├── List Overlay Library
│   ├── Upload Overlay
│   └── Delete Overlay
├── 16. Font Library
│   ├── List Font Library
│   ├── Upload Font
│   └── Delete Font
├── 17. oEmbed
│   └── Proxy oEmbed (YouTube example)
└── 18. Admin Tools
    ├── Get Health Data
    ├── List oEmbed Failures
    ├── Reset oEmbed Failures
    ├── Get Thumbnail Cache Stats
    ├── Clear Thumbnail Cache
    └── Refresh Thumbnail Cache
```

**Test script requirements for every request:**

- Status code assertion matching the expected success code
- `Content-Type: application/json` assertion
- Response time < 2000ms assertion
- For POST/PUT: assert that the returned `id` or `message` field is present
- For paginated responses: assert `items` is an array, `total` is an integer
- For the login request: assert `nonce` is present and save to environment

**Collection-level pre-request script:**

Add a collection-level pre-request script that sets the `X-WP-Nonce` header from `{{wpsg_nonce}}` if set, so it does not need to be repeated per-request.

### Acceptance Criteria

- `openapi.yaml` passes `openapi-specification-validator` or equivalent (zero schema errors)
- All 53 route registrations in `class-wpsg-rest.php` are accounted for in the spec; no registered route is undocumented
- All 3 previously missing routes (`/audit`, `PUT /media/{mediaId}`, `DELETE /media/{mediaId}`) are present in the spec
- Every path has: `summary`, `description`, `operationId`, at least one `tag`
- Every response that is possible from the handler has its HTTP status documented (200/201/400/401/403/404/422/429 as applicable per endpoint)
- Every `requestBody` references a component schema or has fully typed inline properties; no bare `type: object`
- `components/schemas` contains all schemas listed above (21 new + expanded versions of 4 existing)
- Postman collection covers all 18 domains with at least one request per method-path combination
- Every Postman request has at minimum a status code test and a Content-Type test
- Login request saves `wpsg_nonce` to the environment so subsequent requests work without manual intervention

### Validation

- Run `npx @stoplight/spectral-cli lint docs/api/openapi.yaml --ruleset=@stoplight/spectral-owasp-rules` (or equivalent) — zero errors
- Import rebuilt Postman collection into Postman; run against `https://wordpress.lan` with wp-env running; all requests succeed (2xx or expected 4xx for intentional failure cases)
- Cross-check route list: `grep -c "register_rest_route" wp-plugin/.../class-wpsg-rest.php` must equal the number of unique path entries in the spec (allowing for multi-method registrations)
- PHPUnit suite must remain green after any incidental PHP changes (`wp-env run tests-cli vendor/bin/phpunit`)

---

## Track P27-B — API Improvement Analysis ("What Can Be Added")

### Problem

The current API serves the SPA's immediate needs but leaves several capability gaps that reduce the plugin's value for developers building on top of it, operators managing it at scale, and users who need features that the backend could already partially support. This track evaluates every improvement candidate from two angles: (1) does the API need a new or changed endpoint, and (2) does the frontend need a corresponding change.

FUTURE_TASKS.md is the primary input; items are evaluated below and either **Promoted** (added to Phase 27 scope), **Deferred** (kept in FUTURE_TASKS with updated notes), or **Pruned** (removed from FUTURE_TASKS as no longer relevant).

### Improvement Inventory

---

#### API-1: Time-Limited Access Grants

**Source:** FUTURE_TASKS.md — Access Control section
**Disposition:** **Promote to Phase 27**

**What changes on the API:**
- `POST /campaigns/{id}/access` requestBody: add optional `expires_at` (ISO 8601 datetime, nullable)
- `DELETE /campaigns/{id}/access-requests/{token}/approve` response: include `expires_at` in returned `AccessGrant`
- `GET /campaigns/{id}/access` response: `AccessGrant` schema gains `expires_at` (nullable datetime), `is_expired` (boolean computed field)
- New cleanup path: no new endpoint needed — handled by WP-Cron job — but `GET /admin/health` should surface expired-grant cleanup status

**Impact:** High for event/time-limited gallery use cases. The DB schema change (`expires_at` column) is small and backward-compatible.
**Effort:** Low–Medium (DB migration + REST schema update + admin UI date picker)
**Open questions resolved:**
- Expired grants should remain visible in the Access tab with an "Expired" badge (audit value) — they are not auto-deleted
- Grant holders do not receive an email warning (too complex for initial pass; can be added later)

---

#### API-2: Campaign Audit Log Improvements

**Source:** New — surfaced during P27-A reconciliation (the `/audit` endpoint existed but was undocumented)
**Disposition:** **Promote to Phase 27**

**What changes on the API:**
- `GET /campaigns/{id}/audit` already exists (now documented in P27-A). Additional improvements:
  - Add query params: `from` (ISO date), `to` (ISO date), `action` (string filter, e.g. `media.added`), `page` (integer), `per_page` (integer)
  - Expand response to include `total` and `page` fields for paginated access to large audit logs
  - Each `AuditEntry` should expose: `id`, `action`, `actor_id`, `actor_login`, `data`, `created_at`
- `GET /audit-log` (global) — **new endpoint** for a cross-campaign audit view (admin only): `GET /wp-json/wp-super-gallery/v1/admin/audit-log?campaign_id=&from=&to=&action=&page=&per_page=`
  - Returns same `AuditEntry` shape but not scoped to a single campaign
  - Supports CSV export via `Accept: text/csv` header (GDPR compliance / D-14 variant)

**Impact:** Medium — primarily relevant for audit/compliance and debugging
**Effort:** Low–Medium (pagination logic on existing in-memory array; global log requires a new query)

---

#### API-3: Access Audit Log Export (GDPR)

**Source:** FUTURE_TASKS.md — Access Audit Log Export
**Disposition:** **Promote to Phase 27 as part of API-2**

**Folded into API-2:** The global audit log endpoint with CSV export covers this requirement. The only GDPR-specific addition is documenting in the plugin's privacy policy declaration that `actor_id` and access event data constitute personal data records.

---

#### API-4: Access Totals Summary

**Source:** FUTURE_TASKS.md — Access Totals Summary UI
**Disposition:** **Promote to Phase 27**

**What changes on the API:**
- New endpoint: `GET /wp-json/wp-super-gallery/v1/campaigns/access-summary`
  - Returns: `{ items: [{ id: integer, title: string, grant_count: integer, request_count: integer, capacity: integer | null }] }`
  - Admin-only (`require_admin`)
  - Optional query params: `page`, `per_page` for large campaign lists
- Existing `GET /campaigns` could surface a `grant_count` field in each `Campaign` object as an alternative (less round-trips but changes the campaigns list response shape)

**Impact:** Low–Medium — saves navigating to each campaign individually
**Effort:** Low (single aggregate query)

---

#### API-5: JWT In-Memory Token Auth

**Source:** FUTURE_TASKS.md — JWT In-Memory Token Auth (Standalone SPA)
**Disposition:** **Defer — keep in FUTURE_TASKS**

**Rationale for deferral:** The standalone SPA use case is not yet confirmed to be a deployment target. The endpoint (`POST /wpsg/v1/token/refresh` with httpOnly cookie) is well-specified in FUTURE_TASKS and the design is sound. Deferring until there is a concrete deployment requirement prevents adding auth complexity prematurely.

**FUTURE_TASKS update:** No change needed; entry is already well-specified.

---

#### API-6: Magic-Link Approval for Access Requests

**Source:** FUTURE_TASKS.md — Analytics: Magic-Link Auto-Approval
**Disposition:** **Promote to Phase 27**

**What changes on the API:**
- The existing `POST /campaigns/{id}/access-requests/{token}/approve` endpoint can accept an optional `magic_key` query parameter
- `magic_key` is a time-limited HMAC token generated when the admin approval email is sent
- When `magic_key` is valid, the `permission_callback` allows the request even without an authenticated admin session (the key itself proves authorization)
- Security constraints:
  - HMAC-SHA256 keyed with `NONCE_KEY` + `token` + expiry timestamp (TTL: 48 hours)
  - Single-use: once used, a `_used` flag is set in the access request meta
  - The endpoint must still validate the campaign ID and token for IDOR protection

**New behaviour on `POST /access-requests/{token}/approve?magic_key=...`:**
- permission_callback: `__return_true` if magic_key is valid, else `require_admin`
- Response `200`: same as regular approve — `{ message, grant }`
- Response `403`: if magic_key is invalid or expired
- Response `409`: if request is already approved/denied

**Impact:** Medium — significantly reduces friction for high-volume access request workflows
**Effort:** Low (single endpoint modification + email template update)

---

#### API-7: Campaign Delete (Hard Delete)

**Source:** New — not in FUTURE_TASKS
**Disposition:** **Promote to Phase 27**

**Current state:** `POST /campaigns/{id}/archive` sets campaign status to archived. There is no way to permanently delete a campaign via the REST API. The only way is via WP admin posts screen or CLI.

**What changes on the API:**
- New endpoint: `DELETE /wp-json/wp-super-gallery/v1/campaigns/{id}`
  - Admin-only; requires explicit `confirm=true` query param as a double-check against accidental deletes
  - Cascades: deletes associated media items from post meta, removes access grants from DB table, removes analytics events (optional — configurable via `purge_analytics` param)
  - Response `200`: `{ message: "Campaign deleted", id: integer }`
  - Response `400`: if `confirm=true` is missing
  - Response `403/404`: standard

**Note:** This is distinct from archive. Archive is reversible; delete is permanent. The spec and UI must make this distinction clear.

**Impact:** Medium — admins currently must use WP admin to hard-delete
**Effort:** Low (new handler + cascade logic + confirmation gate)

---

#### API-8: D-8 — Add REST Schema/Args Definitions

**Source:** FUTURE_TASKS.md — PHP Deferred Review, D-8
**Disposition:** **Promote to Phase 27**

**What changes on the API:**
- Add typed `args` arrays with `type`, `required`, `sanitize_callback`, and `validate_callback` to all route registrations in `register_routes()`
- Benefits: WP REST API schema discovery (`/wp-json/wp-super-gallery/v1`), automatic sanitization, reduced per-handler boilerplate
- This is a backend-only change; no breaking changes to callers
- Best done route-by-route to avoid merge conflicts in the monolithic file

**Priority routes to tackle first (highest external risk):**
1. `POST /auth/login` — already has args defined (the only one)
2. `POST /campaigns` — missing `title` required validation
3. `POST /media/upload` — no file type or size validation at the args layer
4. `POST /campaigns/batch` — `action` should be an enum, `ids` should be integer array
5. All remaining routes

**Impact:** Medium (security hardening + DX for API explorers)
**Effort:** Large (mechanical but needs careful review per route)

---

#### API-9: Campaign Filtering Enhancements

**Source:** New — not in FUTURE_TASKS
**Disposition:** **Promote to Phase 27**

**Current state:** `GET /campaigns` supports `status`, `visibility`, `company`, `search`, `page`, `per_page`. Missing:

**What changes on the API:**
- Add `category` query param (taxonomy term slug — matches `campaign-categories`)
- Add `tag` query param (taxonomy term slug)
- Add `sort` query param: enum `created_desc` (default), `created_asc`, `title_asc`, `title_desc`
- Add `include_archived` boolean (default false; currently archived campaigns are excluded from list)
- Add `template_id` query param (filter campaigns using a specific layout template)

These all map to additional WP_Query args and do not change the response shape.

**Impact:** Medium — filtering is the primary navigation tool in the admin SPA's campaign list
**Effort:** Low (additional WP_Query args in `list_campaigns`)

---

#### API-10: Pagination on Under-Paginated Endpoints

**Source:** New — not in FUTURE_TASKS
**Disposition:** **Promote to Phase 27**

**Current state:** The following endpoints return unbounded lists (no `page`/`per_page` params):
- `GET /companies`
- `GET /campaign-categories`
- `GET /tags/campaign`
- `GET /tags/media`
- `GET /roles`
- `GET /campaigns/{id}/access` (grants list)
- `GET /companies/{id}/access`
- `GET /campaigns/{id}/audit`

For small deployments this is fine, but at scale these can return large payloads.

**What changes on the API:**
- Add `page` and `per_page` params to each of the above
- Add pagination metadata to each response: `{ items: [], total, page, per_page, total_pages }`

**Impact:** Low–Medium (defensive improvement; current users with small data sets are unaffected)
**Effort:** Low per endpoint

---

#### API-11: Bulk Media Operations

**Source:** New — not in FUTURE_TASKS
**Disposition:** **Defer**

**Proposed additions:**
- `DELETE /campaigns/{id}/media` with body `{ ids: string[] }` — bulk delete multiple media items
- `PUT /campaigns/{id}/media/bulk-caption` with `{ ids: string[], caption: string }` — set caption on multiple items

**Rationale for deferral:** The current media workflow in the SPA is per-item. Bulk media editing hasn't surfaced as a user need yet. Defer until there is evidence of demand.

**FUTURE_TASKS:** Add as a new entry under Campaign Features if a user or deployment surface requests it.

---

#### API-12: Media Sorting Controls on List Endpoint

**Source:** FUTURE_TASKS.md — Media Sorting Controls
**Disposition:** **Promote to Phase 27 (API-only portion)**

**What changes on the API:**
- `GET /campaigns/{id}/media` add `sort` param: enum `order_asc` (default), `order_desc`, `created_asc`, `created_desc`, `title_asc`, `title_desc`, `size_asc`, `size_desc`
- `GET /media/library` add `sort` param: same enum
- Server-side sort should apply to the SQL `ORDER BY` (not PHP-side sort) when querying from post meta arrays

**Note on client vs server sort:** For campaigns with <200 media items (vast majority), client-side sort is fine and avoids DB changes. The API param sets a preference; the server should honour it for large sets.

**Impact:** Medium — a visible UX improvement for large galleries
**Effort:** Low–Medium

---

#### API-13: Analytics Improvements

**Source:** FUTURE_TASKS.md — Campaign Analytics Extended Scope
**Disposition:** **Partially promote to Phase 27**

**What changes on the API:**
- `POST /analytics/event` requestBody: add `media_id` (string, optional) for per-media-item view tracking
- New endpoint: `GET /wp-json/wp-super-gallery/v1/analytics/campaigns/{id}/media` — per-media analytics for a campaign
  - Returns: `{ items: [{ media_id: string, views: integer, lightbox_opens: integer }] }`
  - Admin-only
- **Defer**: `GET /analytics/summary` (cross-campaign dashboard) — keep in FUTURE_TASKS; requires careful query design to avoid N+1 issues
- **Defer**: Real-time polling notes — documented as an API consideration but no endpoint changes needed (client-side concern)

---

#### API-14: Webhook Support

**Source:** FUTURE_TASKS.md — Webhook Support for Campaign Events
**Disposition:** **Defer — keep in FUTURE_TASKS**

**Rationale:** Webhook support requires a management UI (add/remove/test webhooks), a delivery queue (WP-Cron), a retry mechanism, and signed payloads. This is a significant sub-system. The API design questions in FUTURE_TASKS are not fully resolved (per-event vs. per-URL, retry schedule, signing key rotation). Defer until the product roadmap explicitly targets integrations.

---

#### API-15: Campaign Export — Streaming / Binary Media

**Source:** FUTURE_TASKS.md — Campaign Export Full Binary Media Export (P18-D Follow-Up), D-14
**Disposition:** **Defer — keep in FUTURE_TASKS**

**Rationale:** URL-reference-only export (current) covers the majority of deployments. Binary ZIP export requires `ext-zip`, a background job, and a progress endpoint. The open questions around size limits and async job architecture are unresolved. Defer until a multi-instance deployment case is confirmed.

---

#### API-16: Campaign Categories CRUD

**Source:** New — not in FUTURE_TASKS
**Disposition:** **Promote to Phase 27**

**Current state:** `GET /campaign-categories` is read-only. Creating, renaming, and deleting categories is only possible via WP admin Taxonomy screens.

**What changes on the API:**
- `POST /campaign-categories` — create a new category: `{ name: string, slug: string (optional) }`
- `PUT /campaign-categories/{id}` — rename / update a category
- `DELETE /campaign-categories/{id}` — delete (reassign or leave campaigns without category)

All three require `require_admin` permission. This mirrors how campaign tags could be managed; consider implementing for `/tags/campaign` and `/tags/media` in the same pass.

**Impact:** Medium — currently admins must leave the SPA to manage taxonomy
**Effort:** Low (WP taxonomy CRUD is straightforward; mainly REST glue)

---

#### API-17: Rate Limit Status Headers

**Source:** New — not in FUTURE_TASKS
**Disposition:** **Promote to Phase 27 (docs-only)**

**Current state:** Rate limiting is enforced by `WPSG_RateLimiter` but clients have no way to know their rate limit status without hitting a 429.

**What changes on the API:**
- Document (in spec) that rate-limited endpoints return the following headers on all responses:
  - `X-RateLimit-Limit: N` — maximum allowed per window
  - `X-RateLimit-Remaining: N` — remaining in current window
  - `X-RateLimit-Reset: Unix timestamp` — when the window resets
- Verify these headers are actually being set by `WPSG_RateLimiter`; if not, add them as part of this task

**Impact:** Medium — improves integration developer experience; allows clients to back-off gracefully
**Effort:** Low (header addition in rate limiter class) + docs update

---

#### API-18: Settings Versioning / ETag Support

**Source:** New — not in FUTURE_TASKS
**Disposition:** **Promote to Phase 27 (docs)**

**Current state:** `GET /campaigns` returns `304 Not Modified` (ETag). `GET /settings` does not.

**What changes on the API:**
- Add ETag support to `GET /settings`: compute hash of settings payload, send `ETag` header, honour `If-None-Match` for `304 Not Modified` responses
- Reduces unnecessary settings re-fetches on SPA reload

**Impact:** Low (small bandwidth saving)
**Effort:** Low

---

#### API-19: D-7 — Decompose REST Class

**Source:** FUTURE_TASKS.md — D-7
**Disposition:** **Defer — keep in FUTURE_TASKS**

**Rationale:** The `class-wpsg-rest.php` decomposition is a pure DX refactor with no API surface changes. It does not belong in a phase focused on API contract accuracy. Defer to a dedicated DX phase.

---

#### API-20: D-10 — get_accessible_campaign_ids() Optimization

**Source:** FUTURE_TASKS.md — D-10
**Disposition:** **Defer — keep in FUTURE_TASKS**

**Rationale:** Performance improvement at > 1000 campaigns. Not a current concern at typical deployment sizes. Defer.

---

#### API-21: D-12 — Rate Limiter Transient Documentation

**Source:** FUTURE_TASKS.md — D-12
**Disposition:** **Promote to Phase 27 (docs-only)**

**What changes:** Add a note to `GET /admin/health` response schema and to the API guide recommending persistent object cache (Redis/Memcached/APCu) for deployments under load. No code change.

---

#### API-22: OpenAPI / Swagger Doc Generation

**Source:** FUTURE_TASKS.md — Developer Experience — OpenAPI/Swagger documentation
**Disposition:** **Superseded by P27-A**

The manual spec update in P27-A is the complete resolution. Automatic generation from WP REST Controller schemas is a nice-to-have for future maintenance but is not needed once the spec is accurate. **Remove this sub-item from FUTURE_TASKS Developer Experience section** — it no longer needs to be tracked separately.

---

#### FUTURE_TASKS Items to Remove (No Longer Relevant)

| Item | Reason to remove |
|------|-----------------|
| "OpenAPI / Swagger documentation" sub-item in Developer Experience | Superseded by P27-A execution |
| "Settings Panel as a Non-Disruptive Modal (Completed)" section | Already marked Completed; explicitly flag for removal in FUTURE_TASKS cleanup pass |
| `RD-6` reference (removed from active review backlog) | Already removed in the file; cleanup note can be removed |

---

#### FUTURE_TASKS Items Confirmed as Still Valid (No Change Needed)

These items are correctly in scope for FUTURE_TASKS and are not API work; no disposition needed here:

- All Deferred Gallery Adapters (Mosaic, Coverflow, Spotlight, Stacked, Waterfall, Timeline, Isotope, Variable-Ratio, Vertical Scroll Snap)
- Builder Template Deep Clone — already completed per FUTURE_TASKS; verify note is accurate
- Role-Based Access Levels — high-effort; deferred correctly
- Storybook for component development
- TypeScript strictness improvements — **promoted to P27-D**
- Redis/Memcached Object Cache documentation
- WAF Rules documentation
- Structured Logging

### Promotion Summary

| API Item | Description | Phase 27 scope |
|---|---|---|
| API-1 | Time-limited access grants | Spec update + implementation |
| API-2 | Audit log pagination + global audit endpoint | Spec update + implementation |
| API-3 | Folded into API-2 | (see API-2) |
| API-4 | Access totals summary endpoint | New endpoint + spec |
| API-6 | Magic-link access request approval | Endpoint modification + spec |
| API-7 | Campaign hard-delete endpoint | New endpoint + spec |
| API-8 | REST schema/args definitions (D-8) | PHP implementation only |
| API-9 | Campaign filtering enhancements | Query param additions |
| API-10 | Pagination on under-paginated endpoints | Query param + response shape additions |
| API-12 | Media sort param on list endpoints | Query param addition |
| API-13 (partial) | Per-media analytics event + endpoint | requestBody + new endpoint |
| API-16 | Campaign categories CRUD | 3 new endpoints |
| API-17 | Rate limit status headers | PHP + spec |
| API-18 | Settings ETag support | PHP + spec |
| API-21 | Rate limiter transient docs (D-12) | Docs only |

| API Item | Description | Disposition |
|---|---|---|
| API-5 | JWT in-memory token auth | Defer |
| API-11 | Bulk media operations | Defer |
| API-14 | Webhook support | Defer |
| API-15 | Campaign export binary/streaming | Defer |
| API-19 | Decompose REST class (D-7) | Defer |
| API-20 | get_accessible_campaign_ids() opt (D-10) | Defer |
| API-22 | OpenAPI generation | Superseded by P27-A |

### Acceptance Criteria

- Every promoted API item (API-1 through API-21, promoted subset) is documented in the OpenAPI spec as part of P27-A
- FUTURE_TASKS.md is updated: completed items removed, deferred items retain their notes, newly promoted items are cross-referenced to Phase 27
- The `GET /campaigns/{id}/audit` endpoint (now documented) returns paginated results with query parameter support
- `DELETE /campaigns/{id}` exists in the spec and in `class-wpsg-rest.php`
- `GET /campaigns/access-summary` exists in the spec and in `class-wpsg-rest.php`
- Rate limit headers (`X-RateLimit-*`) are emitted by the rate limiter for all rate-limited endpoints
- Campaign categories CRUD (`POST`, `PUT`, `DELETE`) endpoints exist in spec and code
- `POST /analytics/event` requestBody schema includes optional `media_id`
- Time-limited access grant: `expires_at` accepted by `POST /campaigns/{id}/access` and returned by `GET /campaigns/{id}/access`

### Validation

- Vitest suite remains green after all PHP changes (`npm test`)
- PHPUnit suite remains green (`wp-env run tests-cli vendor/bin/phpunit`)
- Each new endpoint has at least one PHPUnit test covering: happy path (200/201), auth-missing (401/403), and not-found (404)
- Each new endpoint has a corresponding Postman request in the rebuilt collection
- FUTURE_TASKS.md diff: promoted items removed, superseded items removed, deferred items unchanged

---

## Follow-On Candidates

| Candidate | Why it is a follow-on |
|---|---|
| D-7: Decompose WPSG_REST into domain controllers | Pure DX refactor; worthwhile but orthogonal to API contract correctness |
| Webhook support (API-14) | Sub-system design not finalized; best done in a dedicated integration phase |
| Campaign export — binary ZIP (API-15) | Requires background job architecture; warrants its own phase |
| JWT in-memory auth (API-5) | Blocked on concrete standalone SPA deployment requirement |
| RBAC per-campaign access levels | High effort; requires data model change; best in a dedicated access-control phase |
| Storybook / component stories | DX only; no API impact; dedicated tooling phase |
| OpenAPI 3.1.0 upgrade | After 3.0.3 spec is fully accurate and passes linting |

---

## Track P27-C — Admin SPA Query Cache & Performance Hardening

**Source:** FUTURE_TASKS.md — "Reuse Loaded Admin Tab Data Across Tab Switches"
**Status:** Planned
**Effort:** Low–Medium | **Impact:** Medium

### Problem

The admin surface relies on TanStack Query for all data fetching, but the query configuration has grown incrementally and has not been audited as a whole. Symptoms include:

- Perceived reload cost when switching between heavy tabs or reopening campaign-specific panes
- Uncertainty about whether `staleTime` settings are appropriate for each query type
- Post-mutation state may be stale if invalidation paths are inconsistently wired
- MediaTab scroll position and active filter state are lost on tab switch (component unmount)

### Scope

1. **Query key & staleTime audit** — review all `useQuery`/`useInfiniteQuery` calls in:
   - `adminQuery` hooks (campaigns, companies, settings)
   - `AdminPanel` tab loaders (AccessTab, MediaTab, AnalyticsTab, AuditTab)
   - `LayoutTemplateList` and layout-builder data queries
   - Identify queries that should share a key (deduplication) vs. have intentionally separate keys
2. **Mutation invalidation audit** — for every `useMutation` that writes data, verify that `onSuccess` / `onSettled` correctly calls `queryClient.invalidateQueries` or `setQueryData` so the UI reflects the write without a manual refresh
3. **Reconnect / window-focus behavior** — confirm `refetchOnWindowFocus` and `refetchOnReconnect` are intentionally set (or intentionally left at default) per query; suppress aggressive refetch on focus for queries that are expensive and infrequently stale
4. **MediaTab tab-state preservation** — preserve scroll position and active filter state (search text, sort order, view mode) across tab switches. Decide: React state in a parent component (lost on full unmount) vs. URL search params (persistent on refresh). Implement whichever is chosen.

### Acceptance Criteria

- No `useQuery` call in the admin surface has an unintentional stale-on-switch regression after a write mutation
- MediaTab scroll position and filter state survive a tab switch to another tab and back
- Decision on Q2 (React state vs. URL params) is recorded as a comment or in a follow-up doc note
- Vitest suite remains green after any hook changes

### Validation

- Run full Vitest suite (`npm test`) after hook changes
- Manually switch between AdminPanel tabs while watching React Query DevTools cache hits — confirm no unnecessary full refetches

---

## Track P27-D — TypeScript Strictness Improvements

**Source:** FUTURE_TASKS.md — Developer Experience → TypeScript strictness improvements
**Status:** ✅ Complete — committed `feat/phase27-api-update-and-more` @ `8c7036e`
**Effort:** Medium | **Impact:** Medium

### Outcome

Both flags are now permanently enabled in `tsconfig.json`. All 1430 Vitest tests pass. The diagnostic run found 215 errors across 75+ files; all were resolved without `@ts-ignore` or `@ts-expect-error` suppressions.

**Fix patterns used:**
- `prop?: T` → `prop?: T | undefined` in ~60 of our own interfaces
- `arr[i]` → `arr[i]!` inside provably-bounds-checked loops; `.split(',')[0]!` pattern throughout
- Mantine component props receiving `T | undefined` → conditional spread `{...(val !== undefined ? { prop: val } : {})}`
- `forwardRef` components spreading `HTMLAttributes<HTMLButtonElement>` into Mantine `ActionIcon` → `{...(restProps as any)}`
- `Partial<Record<K,V>>` object construction → conditional key assignment (`if (val !== undefined) result.key = val`)
- `Array.reduce` initial value from array index → `arr[0] ?? defaultValue`
- ResizeObserver `entries[0]` → `entries[0]!` after length guard
- `parseGalleryConfigInput(input)` return cast: `as GalleryConfig | undefined`

### Problem

`tsconfig.json` has `"strict": true` but two additional strictness flags that are off by default are not enabled:

- `exactOptionalPropertyTypes` — prevents assigning `undefined` to optional properties that do not explicitly include `| undefined`
- `noUncheckedIndexedAccess` — adds `| undefined` to all indexed array/object access results, forcing explicit null-guards

These flags surface a class of latent type bugs (reading from possibly-undefined array indices without guards, writing `undefined` into optional props) that `strict: true` alone does not catch.

### Scope

1. **Diagnostic run** — run `tsc --noEmit` with both flags enabled in a temporary `tsconfig.check.json` (extends base tsconfig) to count and categorize errors before committing scope
2. **Fix all errors** — resolve every type error in-track; no `@ts-ignore` or `@ts-expect-error` suppressions are acceptable as a permanent fix
3. **Enable flags permanently** — add both flags to `tsconfig.json` once zero errors remain
4. **Update `tsconfig.json` audit** — verify no existing overrides/exclusions silently suppress errors that should surface under the new flags

### Acceptance Criteria

- `tsconfig.json` contains `"exactOptionalPropertyTypes": true` and `"noUncheckedIndexedAccess": true`
- `tsc --noEmit` exits with code 0
- Zero `@ts-ignore` or `@ts-expect-error` suppressions added as part of this track (existing pre-track suppressions may remain if they pre-date this work and have separate justifications)
- Vitest suite remains green

### Validation

- `tsc --noEmit` (no errors)
- `npm test` (no regressions)
- `npm run build` (production build succeeds)

---

## Track P27-E — React Review Debt Batch

**Source:** FUTURE_TASKS.md — Deferred Review Tasks (RD-3, RD-8, RD-10, RD-16, RD-18)
**Status:** Planned
**Effort:** Low–Medium | **Impact:** Low–Medium

### Problem

Five items from the React review backlog are individually small (1–6 hours each) but have been deferred across multiple phases. Batching them removes the carry-cost of tracking them individually and clears the RD backlog down to items that are either blocked or high-effort.

### Items

#### RD-3: Extract MediaTab Sortable Components

**File:** `src/components/Admin/MediaTab.tsx`

`SortableListRow` and `SortableGridItem` are defined inline inside the render body, which means they are recreated as new function references on every render. This forces React to unmount and remount the sortable items unnecessarily.

**Fix:** Move both components above the `MediaTab` component definition. Update any closure variable references to be explicit props.

**LOE:** Medium (4–6 hours) | **Impact:** Low–Medium — eliminates unnecessary remounts in the media sort flow; improves test isolation for sortable row/grid items

---

#### RD-8: CardGallery setTimeout → transitionend

**File:** `src/gallery-adapters/card/CardGallery.tsx`

A `setTimeout` is used to detect when a CSS transition completes before performing a follow-up action. This is fragile — it can fire too early (short CPU) or too late (delayed reflow).

**Fix:** Replace the `setTimeout` with a `transitionend` event listener on the relevant element. Add cleanup in the effect's teardown to remove the listener.

**LOE:** Low (1 hour) | **Impact:** Low — minor UX polish; eliminates a class of timing-sensitive flakiness

---

#### RD-10: AdminPanel AccessTab Prop Drilling

**Files:** `src/components/Admin/AdminPanel.tsx`, `src/components/Admin/AccessTab.tsx`

Individual props are drilled from `AdminPanel` down into `AccessTab`. The hook that generates them is already in scope; passing the hook's return object directly reduces the number of explicit prop declarations.

**Fix:** Pass the hook return object as a single prop to `AccessTab` rather than spreading individual values. Update `AccessTab` prop types accordingly.

**LOE:** Low (1–2 hours) | **Impact:** Low — code organization improvement; no user-visible change

---

#### RD-16: LoginForm Password Length from Settings

**File:** `src/components/Auth/LoginForm.tsx`

The minimum password length is hard-coded to `6` in `LoginForm`. The server-side validation uses the value from settings, so the client and server can silently disagree.

**Fix:** Read `loginMinPasswordLength` from the settings store/context and use it as the `minLength` validation rule in the form.

**LOE:** Low (1 hour) | **Impact:** Low — correctness improvement; server-side validation is the authoritative check, but aligning the client removes misleading UX

---

#### RD-18: useMediaDimensions ID-Based Caching

**File:** `src/hooks/useMediaDimensions.ts`

The hook recalculates dimensions on every render because the cache key is not stable. Using the media item's ID as the cache key ensures the expensive calculation runs once per item, not once per render.

**Fix:** Stabilize the cache key to use the media item's `id` field. Ensure the cache is cleared or bypassed when the item's source URL changes.

**LOE:** Low (1–2 hours) | **Impact:** Low — minor optimization; reduces redundant recalculations in large media grids

---

### Acceptance Criteria

- `SortableListRow` and `SortableGridItem` are defined at module scope in `MediaTab.tsx`, not inside the render body
- `CardGallery.tsx` has no `setTimeout` calls in transition-wait contexts; uses `transitionend` instead
- `AccessTab` receives a hook-object prop rather than individually drilled values
- `LoginForm` reads `loginMinPasswordLength` from settings; no hard-coded `6`
- `useMediaDimensions` caches by item ID; recalculates only when the source URL changes
- Vitest suite remains green after all five changes

### Validation

- `npm test` (no regressions)
- Manual spot-check: MediaTab drag-sort still works; CardGallery transitions still complete; LoginForm still validates correctly
