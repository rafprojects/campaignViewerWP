# Testing + QA Guide (Unified)

This document consolidates the Testing Plan and Manual QA steps for WP Super Gallery. It includes automated test guidance and a release checklist for manual QA in WordPress, plus an updated REST API manual test suite.

---

## Goals

- Ensure correctness of UI logic, permissions, and auth flows.
- Provide repeatable automated coverage for regressions.
- Provide comprehensive manual QA steps for WordPress embeds, REST behavior, and admin workflows.

---

## Automated Testing

### Unit Testing (Target: 80%+ Average Coverage)

**Scope**
- Component rendering logic (gating, empty states, banners).
- Auth utilities and token handling (expiry/validation).
- API client behaviors (401 handling).

**Tooling**
- Vitest
- Testing Library (React + jest-dom)

**Commands**
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

### PHP Unit Tests (WordPress plugin)

These tests validate server-side behavior in the WordPress plugin (REST endpoints, helpers, caching). They use the WordPress PHPUnit harness and run inside a WP test environment.

- What they are:
  - Unit/integration tests for `wp-plugin/wp-super-gallery/includes/*` PHP classes and functions.
  - Validate REST responses, transient caching, and provider logic (oEmbed proxy, normalization).

- How to run:
  - Ensure you have the WordPress PHPUnit test environment set up (see WordPress testing docs).
  - From the plugin directory, run the WP test runner configured for your environment. Example (project-specific):

```bash
# from repo root
cd wp-plugin/wp-super-gallery
# run WP PHPUnit (environment dependent)
phpunit -c phpunit.xml.dist
```

Notes:
- These tests require a WordPress test fixture; they cannot be run with `npm run test` (frontend) and are executed separately in CI when PHP/WP tests are configured.
- We added `wp-plugin/wp-super-gallery/tests/test-proxy-oembed.php` to assert `proxy_oembed()` behaviors (missing URL returns 400; cached payloads returned).

**Targets**
- Project-level average coverage ≥ 80%.
- Focus on `src/components`, `src/services`, and `src/contexts`.

---

## Integration / E2E Testing

**Approach (recommended)**
- Playwright for browser automation.
- Two modes:
  1) **Mocked API mode** for reliable CI tests (mock `/wp-json/wp-super-gallery/v1/*`).
  2) **Live WP mode** for full end-to-end validation against a local WordPress instance.

**Tooling**
- `@playwright/test`

**Command**
- `npm run test:e2e`

**Recommended Coverage**
- Public campaign rendering (no auth).
- Hide vs lock behavior (access mode).
- Login flow (JWT) with `token/validate` and `permissions` endpoints.
- Admin-only actions (edit/archive/media add) gated and behavior on 403/401.
- External media embed rendering.

---

## Manual QA (Local WordPress)

This is the primary checklist for QA on a local WordPress install. Use it for every release.

### Setup (Start-to-finish)

1. Install dependencies.
   - `npm install`

2. Build the SPA and copy assets into the plugin bundle.
   - `npm run build:wp`
   - Copies `dist/` into `wp-plugin/wp-super-gallery/assets/`.

3. Sync the plugin into your local WordPress install.
   - Copy plugin folder into `wp-content/plugins/`.
   - Example (adjust path):
     - `cp -r wp-plugin/wp-super-gallery /path/to/wordpress/wp-content/plugins/wp-super-gallery`
   - Remove previous copy first to avoid stale assets:
     - `rm -rf /path/to/wordpress/wp-content/plugins/wp-super-gallery`

4. Activate the plugin in WordPress Admin.
   - **Plugins** → **WP Super Gallery** → **Activate**.

5. Ensure JWT auth is configured.
   - Follow [docs/WP_JWT_SETUP.md](docs/WP_JWT_SETUP.md) and confirm permalinks are **Post name**.

6. Create a test page and embed the widget.
   - Add the shortcode provided by the plugin and publish the page.

7. Open the page in a browser and proceed with the checklist below.

### Prerequisites

- Local WordPress install (LocalWP/Docker/MAMP).
- WP Super Gallery plugin installed and activated.
- JWT auth plugin installed and configured.
- Permalinks set to **Post name**.
- CORS and Apache/htaccess configured for JWT.

### Data Setup

1. Create at least 3 campaigns:
   - 1 public campaign
   - 2 private campaigns
2. Assign campaigns to at least 2 companies (`wpsg_company` taxonomy).
3. Add tags, cover images, and thumbnails.
4. Add media items:
   - At least one external video (YouTube/Vimeo)
   - At least one external video (Rumble/BitChute/Odysee if available)
   - At least one uploaded image and video using the upload flow
5. Configure access grants:
   - One user with access to only one private campaign
   - One user with access to both private campaigns
   - At least one deny override

### Auth & Permissions

- [ ] Login with a viewer user and confirm:
  - [ ] Public campaigns are visible.
  - [ ] Private campaigns are **locked** by default.
  - [ ] “My Access” filter shows only granted campaigns.
- [ ] Switch to **Hide** access mode (admin-only) and confirm:
  - [ ] Locked campaigns are hidden from “All”.
  - [ ] A banner indicates hidden campaigns.
- [ ] Login with an admin user and confirm:
  - [ ] Access mode toggle is visible.
  - [ ] Admin actions are enabled in the campaign viewer.

### Campaign Viewer

- [ ] Open a public campaign:
  - [ ] Title, description, tags, and stats render.
  - [ ] Videos and images render and carousel works.
- [ ] Open a private campaign **without access**:
  - [ ] Media is not rendered.
  - [ ] Access notice is visible.
- [ ] Open a private campaign **with access**:
  - [ ] Media renders correctly.

### Media Validation (Admin Panel)

- [ ] Upload image/video:
  - [ ] Progress updates and completed media appears.
  - [ ] Thumbnail defaults to uploaded asset.
- [ ] Add external media:
  - [ ] URL validation rejects non-https URLs.
  - [ ] Preview loads from server oEmbed proxy.
  - [ ] Item appears in campaign with caption + thumbnail.
- [ ] Edit media:
  - [ ] Caption updates persist.
  - [ ] Thumbnail URL updates persist.
- [ ] Reorder media:
  - [ ] Drag/reorder buttons update order on refresh.
- [ ] Delete media:
  - [ ] Confirmation prompt and removal persists.

### Access Manager (Admin Panel)

- [ ] Grant access:
  - [ ] Campaign access grant persists in Access list.
- [ ] Deny access:
  - [ ] Deny entry appears and overrides grants where applicable.
- [ ] Revoke access:
  - [ ] Entry removal persists and access is updated.

### Embed & Shadow DOM

- [ ] Embed via shortcode on a WP page:
  - [ ] Assets load from Vite manifest.
  - [ ] Widget renders within Shadow DOM.
- [ ] In non-shadow mode (toggle):
  - [ ] UI styles remain scoped and do not leak.

### Error Handling

- [ ] Expire JWT and refresh:
  - [ ] User is logged out and prompted to re-auth.
- [ ] CORS failures show a clear error banner.
- [ ] Unauthorized API calls trigger logout and banner.

---

## REST API Manual Testing (Updated)

Use these steps to verify each REST endpoint directly. Replace `$BASE_URL` with your WordPress site URL (e.g. `http://localhost:8888`) and `$TOKEN` with a valid JWT for an admin user.

### Path Variables & Query Parameters

#### Campaigns (Parameters)

- `GET /campaigns`
  - Query params:
    - `status`: Optional campaign status filter (`active`, `archived`).
    - `visibility`: Optional visibility filter (`public`, `private`).
    - `company`: Optional company slug for `wpsg_company` taxonomy.
    - `search`: Optional keyword search across title/description.
    - `page`: Optional 1-based page index (default `1`).
    - `per_page`: Optional page size (default `10`, max `50`).
- `GET /campaigns/{id}`
  - Path vars:
    - `id`: Campaign ID (numeric).
- `POST /campaigns`
  - No path vars or query params.
- `PUT /campaigns/{id}`
  - Path vars:
    - `id`: Campaign ID (numeric).
- `POST /campaigns/{id}/archive`
  - Path vars:
    - `id`: Campaign ID (numeric).

#### Media (Parameters)

- `GET /campaigns/{id}/media`
  - Path vars:
    - `id`: Campaign ID (numeric).
- `POST /campaigns/{id}/media`
  - Path vars:
    - `id`: Campaign ID (numeric).
- `PUT /campaigns/{id}/media/{mediaId}`
  - Path vars:
    - `id`: Campaign ID (numeric).
    - `mediaId`: Media identifier (string).
- `DELETE /campaigns/{id}/media/{mediaId}`
  - Path vars:
    - `id`: Campaign ID (numeric).
    - `mediaId`: Media identifier (string).
- `PUT /campaigns/{id}/media/reorder`
  - Path vars:
    - `id`: Campaign ID (numeric).

#### Access Grants (Parameters)

- `GET /campaigns/{id}/access`
  - Path vars:
    - `id`: Campaign ID (numeric).
- `POST /campaigns/{id}/access`
  - Path vars:
    - `id`: Campaign ID (numeric).
- `DELETE /campaigns/{id}/access/{userId}`
  - Path vars:
    - `id`: Campaign ID (numeric).
    - `userId`: WordPress user ID (numeric).

#### Uploads (Parameters)

- `POST /media/upload`
  - No path vars or query params.

#### oEmbed Proxy (Parameters)

- `GET /oembed`
  - Query params:
    - `url`: External URL to preview (https only).

#### Auth + Permissions (Parameters)

- `POST /jwt-auth/v1/token/validate`
  - Uses `Authorization: Bearer` header.
- `GET /permissions`
  - Uses `Authorization: Bearer` header.

### Auth + Permissions

- Validate token:
  - `curl -X POST "$BASE_URL/wp-json/jwt-auth/v1/token/validate" -H "Authorization: Bearer $TOKEN"`
- Permissions (requires auth):
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/permissions" -H "Authorization: Bearer $TOKEN"`

### Campaigns (query + add)

- Query campaigns (public):
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns"`
- Query campaigns with filters:
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns?status=active&visibility=public&company=acme&search=summer&page=1&per_page=10"`
- Add campaign (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Winter Drop","description":"Seasonal campaign","company":"acme","status":"active","visibility":"private"}'`

### Campaign Details + Admin Actions

- Get campaign by id:
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123"`
- Update campaign (admin required):
  - `curl -X PUT "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Updated Title","description":"Updated description"}'`
- Archive campaign (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/archive" -H "Authorization: Bearer $TOKEN"`

- List campaign audit (admin required):
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/audit" -H "Authorization: Bearer $TOKEN"`

### Media

- List media (requires auth):
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media" -H "Authorization: Bearer $TOKEN"`
- Add media (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"type":"video","source":"external","url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","caption":"Main Video","order":1}'`
- Update media (admin required):
  - `curl -X PUT "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media/{mediaId}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"caption":"Updated caption","order":2}'`
- Delete media (admin required):
  - `curl -X DELETE "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media/{mediaId}" -H "Authorization: Bearer $TOKEN"`
- Reorder media (admin required):
  - `curl -X PUT "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media/reorder" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"items":[{"id":"m1","order":1},{"id":"m2","order":2}]}'`

### Access Grants

- List access grants (admin required):
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/access" -H "Authorization: Bearer $TOKEN"`
- Grant access (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/access" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"userId":42,"source":"campaign","action":"grant"}'`
- Deny access (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/access" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"userId":42,"source":"campaign","action":"deny"}'`
- Revoke access (admin required):
  - `curl -X DELETE "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/access/42" -H "Authorization: Bearer $TOKEN"`

### Uploads

- Upload media (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/media/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@/path/to/file.jpg"`

### oEmbed Proxy

- oEmbed preview (public endpoint — no Authorization required):
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ"`
  
  - Caching behavior:
    - Successful oEmbed responses are cached for 6 hours.
    - Error/failure responses are cached for 5 minutes to avoid repeated immediate retries against external providers.

---

## Tracking Status

- **Unit tests:** Complete (coverage ≥ 80%).
- **E2E tests:** Complete for core media flows.
- **Manual QA:** Required for each release (checklist above).

