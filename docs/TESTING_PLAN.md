# Testing Plan & Tracking

This document defines the testing strategy, implementation tracking, and manual QA procedures for WP Super Gallery. It is intended to be expanded as the test suite grows.

---

## Goals

- Ensure correctness of UI logic, permissions, and auth flows.
- Provide repeatable automated coverage for regressions.
- Provide comprehensive manual QA steps for WordPress embeds and REST behavior.

---

## Unit Testing (Target: 80%+ Average Coverage)

### Scope

- Component rendering logic (gating, empty states, banners).
- Auth utilities and token handling (expiry/validation).
- API client behaviors (401 handling).

### E2E Tooling

- Vitest
- Testing Library (React + jest-dom)

### Coverage Targets

- Project-level average coverage ≥ 80%.
- Focus on `src/components`, `src/services`, and `src/contexts`.

### E2E Commands

- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

### Tracking

- Add tests alongside component files where possible.
- For complex flows, create focused spec files in `src/components/**` or `src/services/**`.

---

## Integration / E2E Testing

### Approach (recommended)

- Playwright for browser automation.
- Two modes:
  1) **Mocked API mode** for reliable CI tests (mock `/wp-json/wp-super-gallery/v1/*`).
  2) **Live WP mode** for full end-to-end validation against a local WordPress instance.

### Tooling

- `@playwright/test`

### Commands

- `npm run test:e2e`

### Recommended E2E Coverage

- Public campaign rendering (no auth).
- Hide vs lock behavior (access mode).
- Login flow (JWT) with `token` and `permissions` endpoints.
- Admin-only actions (edit/archive/media add) gated and behavior on 403/401.
- External media embed rendering.

---

## Manual QA (Local WordPress)

This is the primary checklist for QA on a local WordPress install. It should be used for every release and can be expanded over time.

### Manual QA Setup (Start-to-finish)

1. Install dependencies.

   - `npm install`

1. Build the SPA and copy assets into the plugin bundle.

   - `npm run build:wp`
   - This runs `npm run build` and copies `dist/` into `wp-plugin/wp-super-gallery/assets/`.

1. Sync the plugin into your local WordPress install.

   - If you have a local WP install, copy the plugin folder into `wp-content/plugins/`.
   - Example (adjust the path to your WP install):
     - `cp -r wp-plugin/wp-super-gallery /path/to/wordpress/wp-content/plugins/wp-super-gallery`
   - If a previous copy exists, remove it first to avoid stale assets:
     - `rm -rf /path/to/wordpress/wp-content/plugins/wp-super-gallery`

1. Activate the plugin in WordPress Admin.

   - Go to **Plugins** → **WP Super Gallery** → **Activate**.

1. Ensure JWT auth is configured.

   - Follow [docs/WP_JWT_SETUP.md](docs/WP_JWT_SETUP.md) and confirm permalinks are **Post name**.

1. Create a test page and embed the widget.

   - Add the shortcode provided by the plugin and publish the page.

1. Open the page in a browser and proceed with the checklist below.

### Prerequisites

- WordPress installed locally (e.g., LocalWP, Docker, or MAMP).
- WP Super Gallery plugin installed and activated.
- JWT auth plugin installed and configured (see [docs/WP_JWT_SETUP.md](docs/WP_JWT_SETUP.md)).
- Permalinks set to **Post name**.
- CORS and Apache/htaccess configured for JWT.

### Data Setup

1. Create at least 3 campaigns:
   - 1 public campaign
   - 2 private campaigns
2. Assign campaigns to at least 2 companies (taxonomy: `wpsg_company`).
3. Add tags, cover images, and thumbnails for each campaign.
4. Add media items:
   - At least one external video (YouTube/Vimeo)
   - At least one external video (Rumble/BitChute/Odysee)
   - At least one uploaded image and video using the WP Media Library
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

### Media Validation

- [ ] External URLs normalize to embed URLs (YouTube/Vimeo/etc).
- [ ] Bad URLs are rejected with an error.
- [ ] Media order is respected.
- [ ] Missing thumbnails fall back to campaign thumbnail.

### Admin Actions (REST)

- [ ] Edit campaign title/description via UI:
  - [ ] Changes persist in WP and UI refreshes.
- [ ] Archive campaign:
  - [ ] Status is updated in WP.
  - [ ] Campaign disappears from public list if archived.
- [ ] Add external media:
  - [ ] New media appears in the campaign viewer.
- [ ] Verify 403 behavior:
  - [ ] Admin actions show an error when executed as viewer.

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

## REST API Manual Testing

Use these steps to verify each REST endpoint directly. Replace `$BASE_URL` with your WordPress site URL (e.g. `http://localhost:8888`) and `$TOKEN` with a valid JWT for an admin user.

### Path Variables & Query Parameters

This section documents all path variables and query parameters used by the REST API endpoints.

#### Campaigns (Parameters)

- `GET /campaigns`
  - Query params:
    - `status`: Optional campaign status filter (e.g. `active`, `archived`).
    - `visibility`: Optional visibility filter (`public` or `private`).
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
    - `mediaId`: Media identifier (string, typically WordPress attachment ID or external media ID).
- `DELETE /campaigns/{id}/media/{mediaId}`
  - Path vars:
    - `id`: Campaign ID (numeric).
    - `mediaId`: Media identifier (string, typically WordPress attachment ID or external media ID).

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

#### Auth + Permissions (Parameters)

- `POST /jwt-auth/v1/token/validate`
  - No path vars or query params (uses `Authorization: Bearer` header).
- `GET /permissions`
  - No path vars or query params (uses `Authorization: Bearer` header).

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

### Media

- List media (requires auth):
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media" -H "Authorization: Bearer $TOKEN"`
- Add media (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"type":"video","source":"external","url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","caption":"Main Video","order":1}'`
- Update media (admin required):
  - `curl -X PUT "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media/v1" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"caption":"Updated caption","order":2}'`
- Delete media (admin required):
  - `curl -X DELETE "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/media/v1" -H "Authorization: Bearer $TOKEN"`

### Access Grants

- List access grants (admin required):
  - `curl "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/access" -H "Authorization: Bearer $TOKEN"`
- Grant access (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/access" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"userId":42,"source":"campaign"}'`
- Revoke access (admin required):
  - `curl -X DELETE "$BASE_URL/wp-json/wp-super-gallery/v1/campaigns/123/access/42" -H "Authorization: Bearer $TOKEN"`

### Uploads

- Upload media (admin required):
  - `curl -X POST "$BASE_URL/wp-json/wp-super-gallery/v1/media/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@/path/to/file.jpg"`

---

## Tracking Status

- **Unit tests:** In progress (foundation added).
- **E2E tests:** In progress (Playwright scaffolding).
- **Manual QA:** Checklist drafted (expand as new features are added).

