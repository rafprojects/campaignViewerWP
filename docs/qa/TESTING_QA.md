git pusnl# Testing + QA Guide (Unified)

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

## Phase 10 QA — Track B (Upload & DRY-up)

### Upload Validation (Edit Campaign Modal + Admin Media Tab)

- [ ] Select a disallowed file type (e.g., `.exe`, `.zip`, `.pdf`):
  - [ ] Error notification appears **immediately** — no upload attempt is made.
  - [ ] Message reads: "File type not allowed. Accepted: JPEG, PNG, GIF, WebP, MP4, WebM, OGG."
  - [ ] File selection is cleared (file input resets).
- [ ] Select a file larger than 50 MB:
  - [ ] Error notification appears **immediately** — no upload attempt is made.
  - [ ] Message reads: "File too large. Maximum size: 50 MB."
  - [ ] File selection is cleared.
- [ ] Select a valid image (e.g., `.jpg` < 50 MB):
  - [ ] Upload begins; progress bar is visible, striped, and animated.
  - [ ] On success, media appears in the campaign media list.
- [ ] Repeat the above in **both** the Edit Campaign modal (App.tsx flow) and the Admin Panel → Media tab upload.

### Upload Button UX (Admin Media Tab → Add Media modal)

- [ ] With no file selected, the Upload button is **disabled** and visually muted.
- [ ] With a file selected, the Upload button becomes **enabled** with a filled blue style and upload icon.
- [ ] After a failed upload, the file selection clears and the button returns to disabled.

### 401 Upload Regression (Edit Campaign Modal)

- [ ] Log in as admin, open a campaign, click "Edit Campaign".
- [ ] Upload a valid image from the edit modal.
  - [ ] Upload succeeds (no 401 error).
  - [ ] Uploaded media appears in the campaign.
  - [ ] Gallery card updates in real-time without page refresh.

### Error Message Readability

- [ ] Simulate a server error (e.g., stop WP server mid-upload):
  - [ ] Error notification displays a human-readable message, not a raw HTTP status code.
- [ ] On 401 (expired token): message should indicate authentication failure.

### Shared Utilities (Regression Check)

- [ ] Verify `getErrorMessage` renders proper error text in notifications across:
  - [ ] Campaign save, archive, restore
  - [ ] Media upload, add, delete
  - [ ] Access grant/deny/revoke
- [ ] Verify media sort order is preserved after page reload in both gallery viewer and admin media tab.

---

## Phase 10 QA — Track C (UX Improvements)

### C1: Button Loading States (Admin Panel → Campaigns tab)

- [ ] Click "Archive" on an active campaign:
  - [ ] Confirmation modal appears.
  - [ ] Confirm → the Archive button on that row shows a **spinner** until the operation completes.
  - [ ] On success: notification appears, campaign row updates to archived status.
  - [ ] On failure (e.g., disconnect server): error notification appears, spinner stops.
- [ ] Click "Restore" on an archived campaign:
  - [ ] Same loading behavior as above on the Restore button.

### C2: Empty State for Unauthenticated Gallery

- [ ] Log out (or open the gallery in an incognito window without a token).
- [ ] If no public campaigns exist:
  - [ ] Gallery shows "Sign in to view campaigns" instead of a generic empty message.
- [ ] If public campaigns exist:
  - [ ] They render normally.

### C3: Gallery Search

- [ ] With campaigns visible in the gallery:
  - [ ] A search input is visible in the header area.
  - [ ] Type a campaign title (partial match) → grid filters in real-time.
  - [ ] Type a tag name → matching campaigns appear.
  - [ ] Clear the search → all campaigns return.
  - [ ] Search + tab filter combine (e.g., search "summer" + tab "My Access" narrows to accessible campaigns with "summer" in the title/description/tags).
  - [ ] Empty search result shows "No campaigns match your search."

### C9: CampaignCard Semantic Button

- [ ] Tab through the gallery:
  - [ ] Campaign cards receive focus via native keyboard navigation.
  - [ ] Pressing Enter opens the campaign viewer.
- [ ] Using a screen reader:
  - [ ] Cards are announced as interactive buttons (not generic `div`s).
  - [ ] Locked cards are announced as disabled.

### C4: Gallery Pagination / Load More

- [ ] Navigate to the gallery with many campaigns (≥13):
  - [ ] Only the first 12 campaigns are rendered initially.
  - [ ] A "Load more (N remaining)" button appears below the grid.
  - [ ] Click "Load more" → next batch of 12 campaigns appends to the grid.
  - [ ] Button disappears when all campaigns are visible.
- [ ] Change tab filter or type into search:
  - [ ] Visible count resets — only the first 12 matches are shown.
  - [ ] "Load more" reappears if results exceed 12.

### C5: Touch/Swipe for Carousel

- [ ] On a touch device (or Chrome DevTools device emulation):
  - [ ] Image carousel (inline viewer): swipe left → next image; swipe right → previous image.
  - [ ] Image carousel (lightbox): swipe left/right navigates between images.
  - [ ] Video carousel: swipe left/right switches videos.
- [ ] Desktop mouse interaction is unaffected (no accidental swipe on click).

### C6: Keyboard Shortcut Hints

- [ ] Open the image lightbox for the first time in a fresh session:
  - [ ] A subtle overlay appears: "← → navigate · Esc close".
  - [ ] Overlay auto-dismisses after ~3.5 seconds.
  - [ ] Pressing any key or tapping dismisses the overlay immediately.
- [ ] Close and reopen the lightbox in the same session:
  - [ ] Overlay does NOT appear again (shown once per session).
- [ ] Open a new browser session (or clear sessionStorage):
  - [ ] Overlay appears again on first lightbox open.

### C7: Dirty Form Guard

- [ ] Admin Panel → Campaigns → Edit a campaign:
  - [ ] Modify the title and click ✕ or Cancel:
    - [ ] A "Discard changes?" confirmation appears.
    - [ ] Click "Discard" → modal closes, changes lost.
    - [ ] Click "Cancel" on the confirmation → returns to the form with edits intact.
  - [ ] Without making changes, click ✕ or Cancel:
    - [ ] Modal closes immediately (no confirmation).
- [ ] Admin Panel → Media → Edit Media:
  - [ ] Same dirty detection and guard behavior for title/caption/thumbnail fields.
- [ ] Gallery → Edit Campaign (viewer):
  - [ ] Same dirty detection for title/description fields.
- [ ] While a dirty form is open, navigate away from the browser tab:
  - [ ] Browser shows a "Leave site?" warning (beforeunload).

### C8: Sticky Auth Bar

- [ ] Sign in and scroll down in the gallery:
  - [ ] The auth bar (email + Admin Panel button + Sign out) remains sticky at the top.
  - [ ] It has a frosted-glass backdrop blur effect.
  - [ ] It does not overlap or conflict with the gallery header's sticky behavior.

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

## Phase 20 — Sprint 1 Manual QA (v0.18.0)

These manual tests validate the four ship-blocking tracks implemented in Phase 20 Sprint 1. Perform each section in a fresh WP test environment.

### P20-A · Rate Limiting Defaults

| # | Step | Expected |
|---|------|----------|
| 1 | Confirm the `wpsg_rate_limit_public` option is **not** set in `wp_options`. | Option absent (uses code default). |
| 2 | As a logged-out visitor, hit a public REST endpoint (e.g. `GET /wp-json/wp-super-gallery/v1/campaigns/{id}`) **61 times within 60 seconds** (use a loop: `for i in $(seq 1 61); do curl -s -o /dev/null -w "%{http_code}\n" "$URL"; done`). | Requests 1–60 return `200`. Request 61 returns `429 Too Many Requests`. |
| 3 | Override the public limit via filter: add `add_filter('wpsg_rate_limit_public', fn() => 10);` in a mu-plugin. Repeat step 2 with 11 requests. | Request 11 returns `429`. |
| 4 | As an **authenticated admin**, hit an admin endpoint (e.g. `GET /wp-json/wp-super-gallery/v1/campaigns`) **121 times within 60 seconds** using a valid nonce. | Requests 1–120 succeed. Request 121 returns `429`. |
| 5 | Override the authenticated limit: `add_filter('wpsg_rate_limit_authenticated', fn() => 20);`. Repeat step 4 with 21 requests. | Request 21 returns `429`. |

### P20-C · CSS Value Sanitization

| # | Step | Expected |
|---|------|----------|
| 1 | Create/edit a layout template via the admin panel. Set **Background Color** to `#ff6600`. Save and reload. | Color persists as `#ff6600`. |
| 2 | Set Background Color to `rgb(100, 200, 50)`. Save. | Value accepted and persisted. |
| 3 | Using direct REST (or browser dev-tools), attempt to save Background Color as `red; background-image: url(https://evil.com)`. | Value is **rejected** (empty string stored). Template renders with no background color. |
| 4 | Attempt to set **Clip Path** to `polygon(50% 0%, 100% 100%, 0% 100%)`. Save. | Valid clip-path persists and renders. |
| 5 | Attempt to set Clip Path to `url(#malicious)`. | Value rejected (empty string). |
| 6 | Attempt to set **Object Position** to `expression(alert(1))`. | Value rejected (empty string). |
| 7 | Attempt to set **Border Color** to `javascript:void(0)`. | Value rejected (empty string). |
| 8 | Inspect the rendered template HTML (Shadow DOM). Confirm no `expression(`, `url(`, `javascript:`, or `var(` appears in inline styles. | Clean inline styles only. |

### P20-D · Post Meta Sanitize Callbacks

All tests use the WP REST API directly (`wp-json/wp/v2/wpsg_campaign/{id}`).

| # | Step | Expected |
|---|------|----------|
| 1 | `PATCH` a campaign with `{"meta":{"visibility":"public"}}`. | Accepted; meta shows `public`. |
| 2 | `PATCH` with `{"meta":{"visibility":"<script>alert(1)</script>"}}`. | Rejected; value falls back to `public`. |
| 3 | `PATCH` with `{"meta":{"status":"archived"}}`. | Accepted; meta shows `archived`. |
| 4 | `PATCH` with `{"meta":{"status":"deleted"}}`. | Rejected; value falls back to `draft`. |
| 5 | `PATCH` with `media_items` containing a valid item `{"id":"m1","type":"image","source":"wp","url":"https://example.com/img.jpg","caption":"Test","order":1}`. | Accepted and persisted. |
| 6 | `PATCH` with `media_items` containing `{"type":"malware","source":"evil","url":"javascript:alert(1)"}` (missing `id`). | Entry dropped entirely (empty array stored). |
| 7 | `PATCH` with `{"meta":{"tags":["landscape","<img onerror=alert(1)>"]}}`. | Tags stored as `["landscape", ""]` (HTML stripped). |
| 8 | `PATCH` with `{"meta":{"publish_at":"2025-06-15T12:00:00Z"}}`. | Accepted as valid ISO 8601. |
| 9 | `PATCH` with `{"meta":{"publish_at":"not-a-date"}}`. | Rejected (empty string stored). |
| 10 | `PATCH` with `{"meta":{"cover_image":"javascript:alert(1)"}}`. | URL sanitised via `esc_url_raw`; stored as empty or stripped. |

### P20-K · Nonce-Only Auth (JWT Disabled by Default)

| # | Step | Expected |
|---|------|----------|
| 1 | Ensure `WPSG_ENABLE_JWT_AUTH` is **not** defined in `wp-config.php`. Load a page with the `[wp_super_gallery]` shortcode while logged in as admin. | Gallery renders. Browser console: no JWT token requests, no `localStorage.getItem('wpsg_jwt_*')` calls. |
| 2 | Open browser DevTools → Application → Local Storage. Search for `wpsg_jwt`. | No JWT keys present. |
| 3 | In the rendered gallery embed, inspect the `__WPSG_CONFIG__` object (run `JSON.stringify(window.__WPSG_CONFIG__)` in the shadow root's context or from the parent page). | `enableJwt` is `false` (or absent). `restNonce` is a valid nonce string. |
| 4 | Verify admin UI controls are visible (edit, delete, settings). | Admin detected via nonce-authenticated `/permissions` endpoint. |
| 5 | Open the page as a **logged-out visitor** (incognito). | Gallery renders in guest/public mode. No admin controls visible. A blue "Sign in" banner is shown. Console: no auth errors. |
| 6 | Click the **"Sign in"** button in the banner. | An in-app modal opens with email + password fields. No redirect to `wp-login.php`. The URL bar does not change. |
| 7 | Enter valid WordPress credentials and submit. | Modal closes. AuthBar appears showing "Signed in as …". Admin controls appear (if user is admin). Network tab shows `POST /wp-json/wp-super-gallery/v1/auth/login` returning 200 with `user`, `permissions`, `nonce`. |
| 8 | Enter **invalid** credentials and submit. | Modal stays open. An error message "Invalid username or password." is displayed. Network tab shows 401 response. |
| 9 | While signed in, click **"Sign out"** in the AuthBar. | User returns to guest mode. The sign-in banner reappears. Network tab shows `POST /wp-json/wp-super-gallery/v1/auth/logout` returning 200. No redirect to a WordPress page. |
| 10 | View page source or inspect Network tab. Verify no reference to `wp-login.php` or `wp-logout` URLs. | WordPress identity is not exposed to the end user. |
| 11 | Leave a tab open for **25+ minutes** (or temporarily change the heartbeat interval to 10 s for testing). Check the Network tab for periodic `GET /wp-json/wp-super-gallery/v1/nonce` calls. | Nonce refresh requests appear every ~20 min (or 10 s if overridden). Each returns `{ "nonce": "..." }`. |
| 12 | After a nonce refresh, perform an admin action (e.g. reorder media). | Action succeeds with the refreshed nonce (no 403). |
| 13 | **Opt-in JWT test:** Add `define('WPSG_ENABLE_JWT_AUTH', true);` to `wp-config.php`. Reload the gallery page. | `enableJwt` is `true` in config. JWT login flow activates. `localStorage` shows `wpsg_jwt_*` keys. |
| 14 | Remove the `WPSG_ENABLE_JWT_AUTH` constant. Reload. | Reverts to nonce-only mode (step 1 behavior). |
| 15 | In the admin **Settings** panel → General tab, set **"Session Idle Timeout"** to **2 minutes**. Save. | Setting persists. |
| 16 | Sign in and wait **2+ minutes** without any mouse/keyboard/touch activity. | User is auto-logged out. Sign-in banner reappears. Admin panel closes if it was open. |
| 17 | Sign in again. Move the mouse or press a key periodically (stay active). | Timer resets on each interaction — no auto-logout while active. |
| 18 | Set **"Session Idle Timeout"** back to **0**. Save. Sign in and wait several minutes idle. | No auto-logout occurs (feature disabled). |

---

## Phase 20 — QA Round 5 Manual Tests

The following manual tests cover changes landed in QA Round 5: glow hover fix, per-slot glow color, PHP filter sanitization, layout height flexibility (vh mode), mobile breakpoint handling for Layout Builder, and URL-input removal.

### R5-A · Glow Hover Effect (Clip-Path Shapes)

| # | Step | Expected |
|---|------|----------|
| 1 | Open the Layout Builder. Add a slot, set its **Shape** to "Circle" and **Hover** to "Glow". Save the template. | Template saves without error. |
| 2 | View the campaign on the front-end. Hover over the circular slot. | A coloured glow (drop-shadow) appears around the circular clip-path on hover. The glow follows the clip shape, not a rectangular bounding box. |
| 3 | Repeat step 2 with shapes: Hexagon, Diamond, Ellipse, Parallelogram. | Glow renders correctly around each non-rectangular clip-path. |
| 4 | Set a slot to **Rectangle** shape with Hover = Glow. View front-end and hover. | Glow appears via the CSS class path (`wpsg-tile-lb-rect-glow`), using `box-shadow`. |
| 5 | Set a slot's Hover to "Pop". View front-end and hover. | Scale-up bounce effect; no glow visible. |
| 6 | Set a slot's Hover to "None". View front-end and hover. | No visual change on hover. |

### R5-B · Per-Slot Glow Color & Spread

| # | Step | Expected |
|---|------|----------|
| 1 | In the Layout Builder, set a slot's **Hover** to "Glow". | A **Glow** colour picker and **Spread** slider appear below the Hover selector. Default colour is `#7c9ef8`, default spread is 12 px. |
| 2 | Change the glow colour to `#ff0000` (red). Save. View front-end and hover. | Glow renders in red. |
| 3 | Adjust the spread slider to 30 px. Save. View front-end and hover. | Glow is noticeably wider/softer than the default. |
| 4 | Add a second slot, set Hover = Glow with a green colour (`#00ff00`). View front-end. | Slot 1 has red glow, Slot 2 has green glow — each independent. |
| 5 | Switch Slot 1's Hover back to "Pop". | The Glow and Spread controls disappear from the properties panel. |
| 6 | Switch it back to "Glow". | Controls reappear, retaining the previously-set red colour and 30 px spread. |
| 7 | Leave a slot's glowColor unset (or clear it). View front-end with Hover = Glow. | Falls back to the campaign-level `tileGlowColor` from Settings → Tile Appearance. |

### R5-C · PHP Filter Sanitization (Round-Trip)

| # | Step | Expected |
|---|------|----------|
| 1 | Open the Layout Builder. Select a slot and adjust **Brightness** to 150%, **Contrast** to 120%, **Saturate** to 180%. Save. | Template saves. |
| 2 | Reload the builder or re-open the template. | Brightness = 150, Contrast = 120, Saturate = 180 — values survive the round-trip without clamping. |
| 3 | Set **Grayscale** to 80%, **Sepia** to 50%, **Invert** to 100%. Save and reload. | Values persist exactly. Grayscale and Sepia are capped at 100 (not 300). Invert is capped at 100. |
| 4 | Set Brightness to 300 (the max). Save and reload. | Value persists as 300. |
| 5 | Using the REST API or direct DB edit, attempt to set Brightness to 500. | Server clamps to 300 on save. |
| 6 | View the campaign front-end with the filter values from step 1. | Image renders correctly with the applied brightness/contrast/saturation — no grey wash-out, no solid grey rectangle. |
| 7 | Set all filter sliders back to their defaults (100/100/100/0/0/0/0). Save. | Image renders normally with no visible filter effect. |

### R5-D · Layout Canvas Height Mode (vh)

| # | Step | Expected |
|---|------|----------|
| 1 | Open the Layout Builder. In the footer bar, locate the **Height** section with a "Ratio / vh" toggle. | Toggle is present between the "Fit" button and the Snap controls. Default mode is "Ratio". |
| 2 | Switch to "vh" mode. | A number input appears showing **50** (the default viewport-height percentage). |
| 3 | Set the value to 80. The builder canvas height should update. | Canvas height becomes approximately 80% of the browser viewport height. |
| 4 | Save the template. View the campaign on the front-end. | The gallery canvas height fills ~80% of the viewport, regardless of container width. |
| 5 | Resize the browser window vertically. | Gallery height adjusts in real-time to stay at ~80 vh. |
| 6 | Set the vh value to 1 (the minimum). Save and view. | Very short canvas (~1% of viewport). |
| 7 | Set the vh value to 100 (the maximum). Save and view. | Canvas fills the full viewport height. |
| 8 | Switch back to "Ratio" mode. Save and view. | Canvas height reverts to width ÷ aspect-ratio behavior. No vh sizing. |
| 9 | Via REST API, attempt to save `canvasHeightVh` as 200. | Server clamps to 100 on save. |

### R5-E · Mobile Breakpoint — Layout Builder Guard

| # | Step | Expected |
|---|------|----------|
| 1 | Open Settings → Media Gallery tab. Set gallery selection to **Unified** mode. Select **Layout Builder** as the image adapter. | Mode auto-switches to **Per Breakpoint**. Desktop and Tablet rows show "Layout Builder". Mobile row shows a different adapter (the previous unified adapter or "Classic"). |
| 2 | Inspect the Mobile row's Image and Video dropdowns. | "Layout Builder" appears in the dropdown list but is **greyed out / disabled** with the label "Layout Builder (desktop/tablet only)". |
| 3 | Attempt to select Layout Builder on the Mobile row. | Selection is blocked (disabled item). |
| 4 | Save settings. View the campaign in a desktop-width browser. | Layout Builder renders. |
| 5 | Resize the browser below 768 px (or use DevTools responsive mode). | Gallery switches from Layout Builder to the mobile adapter (e.g. Classic, Compact Grid). No blank/broken state. |
| 6 | Resize back above 768 px. | Gallery switches back to Layout Builder. |
| 7 | Set all three breakpoints (desktop/tablet/mobile) to non-layout-builder adapters. Switch back to Unified mode. | Unified mode works normally with the selected adapter. |

### R5-F · URL Image Input Removal

| # | Step | Expected |
|---|------|----------|
| 1 | Open the Layout Builder → Media picker sidebar. | Only the "Upload" button and WP media library picker are available. There is **no** URL text input or "Add from URL" option. |
| 2 | Open Slot Properties → Mask section (if a mask exists). | Only "Replace" (file upload) and "Remove" buttons. No URL input for mask images. |
| 3 | Inspect the network requests when adding media. | No requests to external URLs for fetching image metadata. All images come from local upload or WP media library. |

---

## Phase 20 — P20-B · Import Payload Sanitization

These tests validate that the layout-template import path deep-sanitizes every slot, overlay, and background field. Automated PHPUnit coverage exists in `WPSG_Import_Sanitization_Test.php` (10 tests). The manual steps below verify end-to-end behaviour through the admin UI.

| # | Step | Expected |
|---|------|----------|
| 1 | Open Admin Panel → Layout Builder. Create a simple template with 2 slots, an overlay, and a background color. **Export** the template as JSON (or copy the raw JSON from browser DevTools → Network tab on save). | Valid JSON file in hand. |
| 2 | Edit the JSON: change a slot's `name` to `<script>alert(1)</script>Slot`. Re-import via Settings → Import. | Import succeeds. Slot name stored as `alertSlot` (tags stripped). |
| 3 | Edit the JSON: set a slot's `mediaUrl` to `javascript:alert(1)`. Import. | `mediaUrl` stored as empty string (scheme rejected by `esc_url_raw`). |
| 4 | Edit the JSON: set a slot's `borderColor` to `red; background-image: url(https://evil.com)`. Import. | `borderColor` stored as empty string (CSS injection blocked by `wpsg_sanitize_css_value`). |
| 5 | Edit the JSON: set a slot's `clipPath` to `expression(document.cookie)`. Import. | `clipPath` stored as empty string. |
| 6 | Edit the JSON: set an overlay's `imageUrl` to `javascript:void(0)`. Import. | `imageUrl` stored as empty string. |
| 7 | Edit the JSON: set an overlay's `imageUrl` to `blob:https://example.com/abc`. Import. | `imageUrl` stored as empty string (`blob:` scheme rejected). |
| 8 | Edit the JSON: set `backgroundColor` to `red; position: fixed; top:0; left:0; z-index:99999`. Import. | `backgroundColor` stored as empty string (injection blocked). |
| 9 | Edit the JSON: set `backgroundImageUrl` to `javascript:alert(1)`. Import. | `backgroundImageUrl` stored as empty string. |
| 10 | Import the **original unmodified** JSON from step 1. | All values round-trip cleanly — slot names, positions, sizes, overlay images, background color all match the original template. |
| 11 | Run PHPUnit: `vendor/bin/phpunit tests/WPSG_Import_Sanitization_Test.php`. | All 10 tests pass. |

---

## Phase 20 — P20-E · Uninstall Cleanup

These tests verify that deactivation + deletion properly cleans up (or preserves) all plugin data.

**Prerequisites:** Fresh WordPress install with WP Super Gallery activated. Create test data: 2+ campaigns with media, 1+ layout template, 1+ overlay upload, adjust at least one setting.

| # | Step | Expected |
|---|------|----------|
| 1 | Open Admin Panel → Settings → General tab. Locate the **"Preserve data on uninstall"** switch. | Switch is visible, defaults to OFF. |
| 2 | Leave the switch OFF. Deactivate the plugin via Plugins → Installed Plugins → Deactivate. | Plugin deactivated. All data still present (deactivation does not delete). |
| 3 | Click **Delete** on the deactivated plugin. Confirm deletion. | Plugin files removed. |
| 4 | Check the database: `SELECT * FROM wp_posts WHERE post_type IN ('wpsg_campaign', 'wpsg_layout_template');` | No rows returned — campaigns and templates deleted. |
| 5 | Check: `SELECT * FROM wp_terms t JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id WHERE tt.taxonomy = 'wpsg_company';` | No rows — taxonomy terms deleted. |
| 6 | Check: `SELECT * FROM wp_options WHERE option_name LIKE 'wpsg_%';` | No matching rows — all plugin options removed. |
| 7 | Check: `SELECT * FROM wp_options WHERE option_name LIKE '_transient%wpsg%';` | No matching rows — transients cleaned. |
| 8 | Check: `SHOW TABLES LIKE '%wpsg%';` | No custom tables remain. |
| 9 | Check: `SELECT * FROM wp_usermeta WHERE meta_key LIKE 'wpsg_%';` | No rows — roles/caps removed. Verify `wpsg_admin` role no longer exists: `wp role list` or `SELECT * FROM wp_options WHERE option_name = 'wp_user_roles'` and search for `wpsg`. |
| 10 | Check `wp-content/uploads/wpsg-overlays/` directory. | Directory deleted (or empty). |
| 11 | **Reinstall** the plugin. Create new test data (campaign, template, overlay, setting). Set **"Preserve data on uninstall"** to **ON**. Save. | Setting saved. |
| 12 | Deactivate and Delete the plugin again. | Plugin files removed. |
| 13 | Repeat checks from steps 4–10. | All data **preserved** — campaigns, templates, terms, options, transients, tables, overlay files all still present. |
| 14 | Reinstall the plugin. Verify the preserved data loads correctly in the admin panel. | Campaigns, templates, overlays, and settings all intact and functional. |

---

## Phase 20 — P20-F · License Verification

| # | Step | Expected |
|---|------|----------|
| 1 | Open `LICENSE.md` at the repository root. | File exists and contains the full GPLv2 text ("GNU GENERAL PUBLIC LICENSE, Version 2, June 1991"). |
| 2 | Open `wp-plugin/wp-super-gallery/LICENSE`. | File exists and matches the repo-root LICENSE.md content. |
| 3 | Open `wp-plugin/wp-super-gallery/wp-super-gallery.php`. Inspect the plugin file header comment. | Header includes: `License: GPLv2 or later`, `License URI: https://www.gnu.org/licenses/gpl-2.0.html`, `Requires at least: 6.0`, `Tested up to: 6.7`, `Requires PHP: 8.0`, `Text Domain: wp-super-gallery`. |
| 4 | Run the WordPress.org plugin header validator (or manually compare against [the required headers list](https://developer.wordpress.org/plugins/plugin-basics/header-requirements/)). | All required fields present and correctly formatted. |

---

## Phase 20 — QA Round 6 Manual Tests

The following manual tests cover changes from QA Round 6: mask sublayer workflow (A1–A5), background panel (B6–B7), and Design Assets drag-and-drop (C8–C11).

### R6-A · Mask Sublayer Workflow

| # | Step | Expected |
|---|------|----------|
| 1 | Open the Layout Builder. Add a slot. In the **Layers** panel, click the **mask icon** (🎭) button. | A "Mask" sublayer appears nested under the slot in the Layers panel. The sublayer is auto-selected. The MaskPropertiesPanel opens in the right sidebar showing an empty preview area with "No mask image" placeholder. |
| 2 | In the MaskPropertiesPanel, locate the **Design Assets** grid. Click a PNG/SVG asset. | The asset is applied as the mask image. Preview thumbnail updates. The canvas shows the mask effect on the slot. |
| 3 | Drag a different Design Asset **onto the mask preview area** in the MaskPropertiesPanel. | The dragged asset replaces the current mask image. Preview and canvas update. |
| 4 | Click the **slot's base layer** (not the mask sublayer) in the Layers panel. | Properties panel switches from "MASK PROPERTIES" to "SLOT PROPERTIES". The base image is now draggable on canvas — no pointer interception from the mask overlay. |
| 5 | Click the **mask sublayer** in the Layers panel. Drag the mask around on the canvas. | Mask repositions independently of the base image. Position values (X, Y) update in MaskPropertiesPanel. |
| 6 | With the mask sublayer selected, grab a **corner resize handle** (violet circle) on the canvas. | Mask resizes. Width/Height values update in MaskPropertiesPanel. |
| 7 | Toggle **Mode** between Luminance and Alpha in MaskPropertiesPanel. | Canvas updates: Luminance mode uses white=visible/black=hidden; Alpha mode uses opacity for masking. |
| 8 | Adjust the **Feather** slider to 20px. | Mask edges soften with the applied blur/feather effect on canvas. |
| 9 | Click **Auto Fit** in MaskPropertiesPanel. | Mask scales and positions to cover the entire slot. |
| 10 | Click **Remove** in MaskPropertiesPanel. | Mask sublayer disappears from Layers panel. Slot renders without any mask. Properties panel reverts to "SLOT PROPERTIES". |

### R6-B · Background Panel

| # | Step | Expected |
|---|------|----------|
| 1 | In the Layers panel, click the **Background** row. | The properties panel switches to **BackgroundPropertiesPanel** (not the Media panel). Header shows "BACKGROUND". |
| 2 | In the background panel, switch between **None**, **Color**, **Gradient**, and **Image** modes. | Canvas updates in real-time for each mode. None = transparent. Color = solid fill. Gradient = linear/radial gradient. Image = background image. |
| 3 | In **Color** mode, change the colour. | Canvas background updates immediately. |
| 4 | In **Gradient** mode, adjust direction (5 presets) and colour stops. | Gradient preview swatch and canvas update. |
| 5 | In **Image** mode, locate the Design Assets grid. Click an asset. | Asset applied as background image. Canvas shows the image background. |
| 6 | Click somewhere on the canvas (not on a slot). Then click a slot. Then click Background again. | Background panel reopens correctly each time — it does not get "stuck" or redirect to Media panel. |

### R6-C · Design Assets Drag-and-Drop

| # | Step | Expected |
|---|------|----------|
| 1 | In the Media panel, locate the Design Assets grid. Confirm each asset is an image thumbnail **without** a "+" button overlay. | Assets show as thumbnails with a small "✕" circle at the top-right corner (for deletion). No "+" button. |
| 2 | Drag an asset thumbnail from the Design Assets grid and drop it onto an **empty area** of the canvas. | A new **graphic (overlay) layer** is created at the drop position. It appears in the Layers panel. |
| 3 | Drag a **campaign media item** (from the media list) onto the canvas. | A new **slot** is created at the drop position, pre-assigned with that media item. It appears in the Layers panel. |
| 4 | Click the "✕" circle on a Design Asset thumbnail. | Asset is deleted from the overlay library. Confirmation prompt appears first. |
| 5 | Add a mask to a slot (via the Layers panel mask button). Then drag a Design Asset **onto the slot** on the canvas. | The asset is applied as the slot's mask image (replacing any existing mask image). |
| 6 | Drag multiple assets to the canvas in succession. | Each creates a separate graphic layer at its respective drop position. Layers panel shows all of them. |
| 7 | Undo (Ctrl+Z / ⌘Z) after a drag-to-canvas drop. | The created layer/slot is removed. |
| 8 | Save the template after drag-created layers exist. Reload. | All drag-created layers persist with correct positions and images. |

---

## Phase 20 — H-Track Security Verification

These tests verify the security hardening items from the H-track sprint.

### H-2 · DNS Rebinding SSRF Protection

| # | Step | Expected |
|---|------|----------|
| 1 | Call the oEmbed proxy with an **allowlisted** provider URL: `GET /wp-json/wp-super-gallery/v1/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`. | Returns 200 with oEmbed data (allowlisted providers bypass DNS check). |
| 2 | Call the oEmbed proxy with a **non-allowlisted** public HTTPS URL (e.g. `https://example.com/page`). | Returns either oEmbed data (if the host resolves to a public IP) or an appropriate error. No request is made to a private IP. |
| 3 | *(Requires `/etc/hosts` manipulation or DNS rebinding test tool)* Configure a hostname that resolves to `127.0.0.1`. Call the oEmbed proxy with `https://that-hostname/path`. | Returns 400 with "oEmbed host resolves to a private or disallowed IP" **or** "DNS rebinding detected" — the request is never completed. |
| 4 | Call the oEmbed proxy with a non-HTTPS URL: `GET /wp-json/wp-super-gallery/v1/oembed?url=http://example.com`. | Returns 400: "Only HTTPS oEmbed URLs are allowed". |

### H-3 · Nonce Bypass Hardening

| # | Step | Expected |
|---|------|----------|
| 1 | In a test environment **without** `WPSG_ALLOW_NONCE_BYPASS` defined, make a REST API call with an invalid/missing nonce. | Returns 403 — nonce is enforced. |
| 2 | Define `WP_DEBUG = true` but **not** `WPSG_ALLOW_NONCE_BYPASS`. Make a REST call with invalid nonce. | Still returns 403 — `WP_DEBUG` alone is insufficient. |
| 3 | Define both `WP_DEBUG = true` and `WPSG_ALLOW_NONCE_BYPASS = true`. Make a REST call with invalid nonce. | Request proceeds (bypass active). |

### H-5 · Overlay File Deletion

| # | Step | Expected |
|---|------|----------|
| 1 | Upload a Design Asset (overlay) via the Layout Builder. Note the file path in `wp-content/uploads/wpsg-overlays/`. | File exists on disk. |
| 2 | Delete the overlay (click the ✕ on the asset thumbnail, confirm). | API returns success. |
| 3 | Check `wp-content/uploads/wpsg-overlays/` for the file. | File is **gone** — physically deleted from disk. |

### H-6 · Sentry PII Scrubbing

| # | Step | Expected |
|---|------|----------|
| 1 | Enable Sentry DSN in the plugin settings. Open browser DevTools → Network tab. Trigger an action that generates Sentry breadcrumbs (e.g. navigating, making API calls). | Sentry events appear in Network tab (or Sentry dashboard). |
| 2 | Inspect the Sentry event payload. Search for `Authorization` in breadcrumb data. | No `Authorization` header values present — scrubbed by `beforeSend`. |
| 3 | Inspect the Sentry event payload for `user.ip_address`. | Field is absent or null — PII scrubbed. |

### H-8 · ErrorBoundary → Sentry

| # | Step | Expected |
|---|------|----------|
| 1 | Temporarily introduce a runtime error in a React component (e.g. access a property on `undefined`). | ErrorBoundary catches the crash and shows the fallback UI. |
| 2 | Check the Sentry dashboard (or mock Sentry capture). | An exception event is captured with `componentStack` context. |
| 3 | Remove the intentional error. | App resumes normal operation. |

---

## Tracking Status

- **Unit tests:** Complete (coverage ≥ 80%).
- **E2E tests:** Complete for core media flows.
- **Manual QA:** Required for each release (checklist above).

