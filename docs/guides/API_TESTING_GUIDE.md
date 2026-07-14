# API Testing Guide — WP Super Gallery

Purpose: a compact reference QA testers can use to exercise every REST endpoint used by the admin SPA and public site.

Base URL: {site_base}/wp-json
Primary namespace: `wp-super-gallery/v1`

How to use
- Use the `Authorization: Bearer <token>` header for JWT-protected endpoints, or cookie auth + `X-WP-Nonce` for cookie-authenticated admin endpoints when applicable.
- Many admin routes require `manage_wpsg` capability (admin-only). Public routes show `Public` below.
- Default pagination: `page`, `per_page` (per_page max 50 on campaigns endpoints).

Grouping: endpoints are grouped to help QA navigate areas of functionality.

1) Campaigns
- GET /wp-json/wp-super-gallery/v1/campaigns
  - Auth: Public (rate-limited) — returns cacheable list.
  - Query params: `page`, `per_page`, `status`, `visibility`, `company`, `search`, `include_media` (true/false)
  - Successful: 200 with { items, page, perPage, total, totalPages }
  - QA checks: pagination, filters, include_media populates mediaByCampaign, ETag caching (If-None-Match -> 304).

- POST /wp-json/wp-super-gallery/v1/campaigns
  - Auth: Admin (`manage_wpsg` required)
  - Body (JSON): `title` (required), `description`, `company`, plus campaign meta fields (visibility, tags, publishAt, unpublishAt, galleryOverrides, layoutBinding etc.)
  - Successful: 201 with new campaign payload
  - QA checks: missing title -> 400; created campaign appears in GET list.

- GET /wp-json/wp-super-gallery/v1/campaigns/{id}
  - Auth: Public for published campaigns; restricted for non-public (permission callback checks ownership/capabilities)
  - Successful: 200 with campaign object; 403 when forbidden; 404 when not found.

- PUT /wp-json/wp-super-gallery/v1/campaigns/{id}
  - Auth: Admin
  - Body: any updatable fields (title, description, visibility, status, galleryOverrides, layoutBinding, company)
  - Successful: 200 with updated campaign

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/archive
  - Auth: Admin; 200 message on success; 404 if not found

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/restore
  - Auth: Admin; restore archived -> active

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/duplicate
  - Auth: Admin
  - Body: optional `name`, `copyMedia` (bool), `duplicateLayoutTemplate` (bool)
  - Successful: 201 with duplicated campaign

- POST /wp-json/wp-super-gallery/v1/campaigns/batch
  - Auth: Admin
  - Body: `{ action: 'archive'|'restore', ids: [id,...] }`
  - Successful: 200 { success: [], failed: [] }

- GET /wp-json/wp-super-gallery/v1/campaigns/{id}/export
  - Auth: Admin
  - Response: 200 attachment JSON payload + Content-Disposition header

- POST /wp-json/wp-super-gallery/v1/campaigns/import
  - Auth: Admin
  - Body: export JSON with `campaign` key, `version` == 1
  - Successful: 201 with created campaign (imports layout template and media references)

2) Media (campaign-scoped)
- GET /wp-json/wp-super-gallery/v1/campaigns/{id}/media
  - Auth: Public for published campaigns (rate-limited) or requires view permission for private
  - Response: { items: [...], meta: { typesUpdated, total } } — supports ETag header for caching

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/media
  - Auth: Admin
  - Body (JSON): `type` ('image'|'video'), `source` ('external'|'upload'), `caption`, `order`, `thumbnail`, optional `id` (custom media id)
    - If `source` === 'external': `url` required (oEmbed normalization performed)
    - If `source` === 'upload': `attachmentId` required (WP attachment id)
  - Successful: 201 media item object
  - QA: invalid type/source -> 400; missing attachmentId for upload -> 400

- PUT /wp-json/wp-super-gallery/v1/campaigns/{id}/media/{mediaId}
  - Auth: Admin
  - Body: fields to update (title, caption, thumbnail, order)

- DELETE /wp-json/wp-super-gallery/v1/campaigns/{id}/media/{mediaId}
  - Auth: Admin
  - Successful: 200 message or deleted payload

- PUT /wp-json/wp-super-gallery/v1/campaigns/{id}/media/reorder
  - Auth: Admin
  - Body: `{ items: [ {id, order}, ... ] }` or similar (client uses `{items: [{id, order}]}`)

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/media/rescan
  - Auth: Admin — triggers type rescan for campaign media

- POST /wp-json/wp-super-gallery/v1/media/rescan-all
  - Auth: Admin — triggers global rescan; returns counts

- POST /wp-json/wp-super-gallery/v1/media/upload
  - Auth: Admin
  - Used by upload helper; expects attachment/upload workflow (server-side handles attachments)

3) Media usage & library
- GET /wp-json/wp-super-gallery/v1/media/{mediaId}/usage
  - Auth: Admin
  - Returns campaigns that reference `mediaId` { count, campaigns }

- GET /wp-json/wp-super-gallery/v1/media/usage-summary?ids[]=id1&ids[]=id2...
  - Auth: Admin
  - Returns object map { mediaId: count }

- GET /wp-json/wp-super-gallery/v1/media/library
  - Auth: Admin — returns global media library search/list

4) Access / Access Requests
- GET /wp-json/wp-super-gallery/v1/campaigns/{id}/access
  - Auth: Admin — lists explicit access grants and overrides

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/access
  - Auth: Admin
  - Body: { userId, source, action } (client uses specific shape)

- DELETE /wp-json/wp-super-gallery/v1/campaigns/{id}/access/{userId}
  - Auth: Admin

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/access-requests
  - Auth: Public (rate-limited)
  - Body: { email, name, message? } — submits an access request

- GET /wp-json/wp-super-gallery/v1/campaigns/{id}/access-requests
  - Auth: Admin — list pending requests

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/access-requests/{token}/approve
  - Auth: Admin

- POST /wp-json/wp-super-gallery/v1/campaigns/{id}/access-requests/{token}/deny
  - Auth: Admin

5) Companies
- GET /wp-json/wp-super-gallery/v1/companies
  - Auth: Admin

- GET /wp-json/wp-super-gallery/v1/companies/{id}/access
  - Auth: Admin

- POST /wp-json/wp-super-gallery/v1/companies/{id}/access
  - Auth: Admin

- DELETE /wp-json/wp-super-gallery/v1/companies/{id}/access/{userId}
  - Auth: Admin

- POST /wp-json/wp-super-gallery/v1/companies/{id}/archive
  - Auth: Admin

6) Users & Roles
- GET /wp-json/wp-super-gallery/v1/users/search?search=term
  - Auth: Admin

- POST /wp-json/wp-super-gallery/v1/users
  - Auth: Authenticated (rate-limited) — creates a user and optionally grants access
  - Body example: `{ email, displayName, role, campaignId, simulateEmailFailure }`

- GET /wp-json/wp-super-gallery/v1/roles
  - Auth: Admin — lists roles usable by UI

7) Settings, Permissions, Nonce, Auth
- GET /wp-json/wp-super-gallery/v1/settings
  - Auth: Public (rate-limited) — returns public display settings

- POST /wp-json/wp-super-gallery/v1/settings
  - Auth: Admin — updates settings

- GET /wp-json/wp-super-gallery/v1/permissions
  - Auth: Authenticated (must be logged in) — returns permissioned campaignIds and isAdmin flag

- GET /wp-json/wp-super-gallery/v1/nonce
  - Auth: Authenticated with cookie — returns fresh REST nonce for long-running tabs

- POST /wp-json/wp-super-gallery/v1/auth/login
  - Auth: Public — cookie-based login helper
  - Body: `{ username, password, remember }` — returns 200 on success (sets cookie)

- POST /wp-json/wp-super-gallery/v1/auth/logout
  - Auth: Authenticated (cookie) — logs out session

Also used by client (external plugin):
- POST /wp-json/jwt-auth/v1/token
  - Auth: Public — obtains JWT token (username/password)

- POST /wp-json/jwt-auth/v1/token/validate
  - Auth: Bearer token — validates token

8) OEmbed proxy
- GET /wp-json/wp-super-gallery/v1/oembed?url={encoded-url}
  - Auth: Public (rate-limited)
  - Purpose: fetches oEmbed metadata proxied via server (SSRF mitigations present)
  - QA: test with valid https URL; test blocked hosts/invalid URL handling

9) Analytics
- POST /wp-json/wp-super-gallery/v1/analytics/event
  - Auth: Public (rate-limited) but requires `enable_analytics` setting enabled
  - Body: `{ campaignId or campaign_id, eventType }` — allowed eventType: `view`
  - Response: 201 { recorded: true }

- GET /wp-json/wp-super-gallery/v1/analytics/campaigns/{id}?from=YYYY-MM-DD&to=YYYY-MM-DD
  - Auth: Admin — returns totals and daily breakdown

10) Tags and Categories
- GET /wp-json/wp-super-gallery/v1/campaign-categories
  - Auth: Admin — returns id, name, slug, count

- GET /wp-json/wp-super-gallery/v1/tags/campaign
  - Auth: Admin

- GET /wp-json/wp-super-gallery/v1/tags/media
  - Auth: Admin

11) Admin / Monitoring / Cache
- GET /wp-json/wp-super-gallery/v1/admin/health
  - Auth: Admin — returns health diagnostics

- GET /wp-json/wp-super-gallery/v1/admin/oembed-failures
  - Auth: Admin
- DELETE /wp-json/wp-super-gallery/v1/admin/oembed-failures
  - Auth: Admin

- GET /wp-json/wp-super-gallery/v1/admin/thumbnail-cache
  - Auth: Admin
- DELETE /wp-json/wp-super-gallery/v1/admin/thumbnail-cache
  - Auth: Admin
- POST /wp-json/wp-super-gallery/v1/admin/thumbnail-cache/refresh
  - Auth: Admin

12) Layout templates, overlays, fonts (admin)
- GET/POST /wp-json/wp-super-gallery/v1/admin/layout-templates
- GET/PUT/DELETE /wp-json/wp-super-gallery/v1/admin/layout-templates/{templateId}
- POST /wp-json/wp-super-gallery/v1/admin/layout-templates/{templateId}/duplicate

- GET/POST /wp-json/wp-super-gallery/v1/admin/overlay-library
- DELETE /wp-json/wp-super-gallery/v1/admin/overlay-library/{id}

- GET/POST /wp-json/wp-super-gallery/v1/admin/font-library
- DELETE /wp-json/wp-super-gallery/v1/admin/font-library/{id}

13) Public layout template read
- GET /wp-json/wp-super-gallery/v1/layout-templates/{templateId}
  - Auth: Public — returns template by ID (used for front-end rendering)

QA Checklist / Test cases (high level)
- Authorization: verify admin-only endpoints return 401/403 for unauthenticated or insufficient roles.
- Validation: send bad/missing params to endpoints and confirm 400 errors with meaningful messages.
- Concurrency / rate-limits: hit public endpoints repeatedly to confirm rate-limiting behavior (429) for public scope.
- ETag & caching: test `GET /campaigns` and `GET /campaigns/{id}/media` with If-None-Match header -> 304 when unchanged.
- File uploads / media: test `media/upload` + subsequent `POST /campaigns/{id}/media` with `attachmentId`.
- OEmbed SSRF: attempt edge cases (non-https, private IPs) — server has SSRF mitigations; expect 400/403 for blocked hosts.
- Analytics flow: enable analytics in settings, send `analytics/event`, then fetch `analytics/campaigns/{id}` to confirm counts.

Where to look in the repo
- Route registrations & server behavior: [wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php](../../wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php)
- Client usage/examples: `src/services/apiClient.ts`, `src/services/adminQuery.ts`, `src/contexts/AuthContext.tsx` and admin SPA builds under `wp-plugin/wp-super-gallery/admin/build/assets`.

If you want, I can:
- Generate an OpenAPI / Postman collection from the PHP route registrations in `class-wpsg-rest.php`.
- Add example cURL commands and sample JSON bodies for each endpoint.
