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

## Tracking Status

- **Unit tests:** In progress (foundation added).
- **E2E tests:** In progress (Playwright scaffolding).
- **Manual QA:** Checklist drafted (expand as new features are added).

