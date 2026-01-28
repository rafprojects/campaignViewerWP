# WP Super Gallery - Implementation Plan

This plan builds on the original architecture reference in [docs/ARCHITECTURE_INIT.md](docs/ARCHITECTURE_INIT.md). It defines the decisions, TODOs, and the concrete work needed to ship a production-ready SPA and WordPress‑embedded widget.

---

## Goals

- Deliver a React SPA that can run standalone or inside WordPress as an embedded widget.
- Use Shadow DOM only for style isolation.
- Provide admin tooling to create campaigns/cards, upload or link media, and manage user access.
- Avoid services with direct payment requirements.

---

## Decisions (current)

- **Embedding strategy:** Shadow DOM only (no iframe).
- **Admin scope:** Full campaign CRUD + media management + user permissions.
- **Styling:** SCSS Modules, scoped tokens, scoped resets.
- **System of record (Phase 1):** WordPress CPT + REST API. External DB remains an optional future migration.
- **Media sources:** Uploads via WP Media Library + external links (YouTube, Vimeo, Rumble, BitChute, Odysee).
- **Permissions:** Company-level grants with campaign-level override deny.
- **Auth provider:** TBD (see detailed comparison below).

---

## Auth Options (no direct payment)

The options below align with “no direct payment” requirements. Security notes are for the default, recommended deployment patterns.

### 1) WordPress Built‑in Auth + REST API + Application Passwords

#### WordPress App Passwords pros

- Uses existing WordPress user system and roles.
- No additional auth service or infrastructure.
- Straightforward integration if data is stored in WP.

#### WordPress App Passwords cons

- Application Passwords are basic and not ideal for end‑user UX.
- Limited token lifecycle controls; must handle revocation carefully.
- Less flexible for non‑WP deployments.

#### WordPress App Passwords security assessment

- **Good** for admin‑initiated integrations.
- Requires HTTPS and careful storage of app passwords.
- Not ideal for high‑scale public sign‑in experiences.

### 2) WordPress REST API + JWT Authentication plugin

#### WP JWT pros

- Familiar JWT‑based flow with bearer tokens.
- Works well for SPA and non‑WP contexts.
- Easier to integrate fine‑grained permission checks.

#### WP JWT cons

- Requires custom plugin or third‑party JWT plugin.
- Token revocation and refresh are on you to implement securely.

#### WP JWT security assessment

- **Good** when implemented with short‑lived access tokens and refresh strategy.
- Must protect against token leakage (XSS, storage policy).

### 3) SuperTokens (self‑hosted)

#### SuperTokens pros

- Production‑grade auth with refresh/session management.
- Great developer experience and prebuilt flows.
- Works well for SPAs.

#### SuperTokens cons

- Requires hosting and maintenance of auth service.
- Adds complexity to deployment pipeline.

#### SuperTokens security assessment

- **Strong** when deployed with HTTPS + proper domain separation.
- Mature session handling and refresh patterns.

### 4) Auth.js (self‑hosted)

#### Auth.js pros

- Flexible and open‑source; integrates with many providers.
- No direct service costs if self‑hosted.

#### Auth.js cons

- Better suited to server‑rendered Next.js workflows.
- SPA‑only setup may require custom handling for tokens/session.

#### Auth.js security assessment

- **Good** when deployed with a secure backend and session storage.
- Requires careful configuration of cookies, CSRF, and refresh.

### 5) Keycloak (self‑hosted)

#### Keycloak pros

- Enterprise‑grade IAM, robust RBAC, SSO, and federation.
- Strong admin tooling and security controls.

#### Keycloak cons

- Heavy operational footprint for small projects.
- More complex to configure and maintain.

#### Keycloak security assessment

- **Very strong** when properly configured.
- May be overkill if you only need simple access control.

### 6) Supabase (managed or self‑hosted)

#### Supabase pros

- Battle‑tested auth + Postgres with Row Level Security.
- Excellent fit for permission‑based campaign access.
- Option to self‑host to avoid direct payments.

#### Supabase cons

- Managed tier may incur costs; self‑host adds infra work.
- Requires DB design and migration discipline.

#### Supabase security assessment

- **Strong** with RLS and strict policies.
- Clear auditability and access control at the data layer.

---

## Recommendation (choose one)

Given the requirement to avoid direct payment, the best two paths are:

1. **WP + JWT** if you want WordPress to be the system of record.
2. **Supabase self‑hosted** if you want a modern API + strict permission enforcement.

We will finalize once you choose a system of record (WordPress vs external DB).

---

## Implementation Phases (TODO plan)

### Phase 1: Core Data + API Contract

**Status:** Complete.

- Locked WP CPT + REST as system of record (external DB migration remains optional).
- Defined schema for `Company`, `Campaign`, `MediaItem`, and access grants.
- Media supports `upload | external` sources (YouTube, Vimeo, Rumble, BitChute, Odysee).
- Implemented permission inheritance rules (company grants with campaign-level overrides).
- Finalized REST endpoints and response shapes for campaigns, media, and access.

---

## API Contract (Phase 1)

All endpoints are served from the WordPress REST namespace:

`/wp-json/wp-super-gallery/v1`

### Campaigns

- `GET /campaigns`
- Query: `status`, `visibility`, `company`, `search`, `page`, `per_page`
- `GET /campaigns/{id}`
- `POST /campaigns`
- `PUT /campaigns/{id}`
- `POST /campaigns/{id}/archive`

#### Campaign response (example)

```json
{
  "id": "123",
  "companyId": "nike",
  "title": "Summer Rush 2026",
  "description": "...",
  "thumbnail": "https://...",
  "coverImage": "https://...",
  "status": "active",
  "visibility": "private",
  "tags": ["summer", "sports"],
  "createdAt": "2026-01-10T00:00:00.000Z",
  "updatedAt": "2026-01-12T00:00:00.000Z"
}
```

### Media

- `GET /campaigns/{id}/media`
- `POST /campaigns/{id}/media`
- `PUT /campaigns/{id}/media/{mediaId}`
- `DELETE /campaigns/{id}/media/{mediaId}`

#### Media response (example)

```json
{
  "id": "v1",
  "type": "video",
  "source": "external",
  "provider": "youtube",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "thumbnail": "https://...",
  "caption": "Main Campaign Video",
  "order": 1
}
```

### Access Grants

- `GET /campaigns/{id}/access`
- `POST /campaigns/{id}/access`
- `DELETE /campaigns/{id}/access/{userId}`

#### Access response (example)

```json
{
  "userId": "42",
  "campaignId": "123",
  "source": "company",
  "grantedAt": "2026-01-10T00:00:00.000Z"
}
```

### Uploads

- `POST /media/upload`
- Uses WP Media Library uploads for image/video assets.
- Returns attachment ID and URL.

---

### Phase 2: Auth + Permissions

**Status:** Mostly complete.

**Completed in Phase 2 so far:**

- Auth abstraction with pluggable provider and app‑wide auth state.
- WP JWT provider with token storage, login, and permissions fetch.
- Login UI when a provider is configured.
- Permissions endpoint in WP REST and access checks on campaign/media routes.
- JWT setup documentation, including Apache/htaccess requirements.
- Replaced mock campaigns with live REST data in the UI.
- Gated campaign viewer media behind access checks (partial UI enforcement).
- Added configurable access mode (default lock, optional hide).
- Added admin-only toggle for access mode (via permissions).
- Persisted access mode selection in local storage.
- Added admin-only action affordances in the campaign viewer.
- Wired admin edit/archive/add-media actions to REST endpoints.
- Finalized gallery hide/lock behavior and empty states.
- Added admin action feedback banners and capability gating in the UI.
- Added JWT validation on app init (token/validate).
- Added centralized unauthorized handling for API requests.
- Added JWT expiry detection and auto-logout on expired tokens.
- Improved login error messaging with provider feedback.
- Added testing plan and initial unit/E2E test scaffolding.

**Remaining in Phase 2:**

- Expand E2E coverage for auth + permissions, including private campaign visibility.

### Phase 3: Admin Panel (full CRUD)

**Status:** ✅ **COMPLETE** (January 28, 2026)

**Completed in Phase 3:**

- Campaign CRUD implemented in Admin Panel.
- Media, access, and audit endpoints wired in the WP plugin.
- Mantine-based Admin Panel UI with tabs, tables, forms, and archive modal.
- Full media management workflows (add/edit/delete, upload/external).
- Access management workflows (grant/deny/revoke).
- Manual QA testing passed.
- Version bump to 0.2.0.

**Deploy packaging moved to Phase 7** (additional development phases still pending).

### Phase 4: Main UI Mantine Migration

- Assess feasibility and scope for migrating the main UI to Mantine.
- Implement the main UI migration once scope is confirmed.
- Track component-by-component steps in [docs/MANTINE_MAIN_UI_ASSESSMENT.md](docs/MANTINE_MAIN_UI_ASSESSMENT.md).

### Phase 5: WordPress Integration

**Status:** In progress (core embedding and config injection complete).

**Completed in Phase 5 so far:**

- Plugin embedding and asset pipeline working in WP.
- Shortcode output + config injection for SPA.
- Shadow DOM initialization and style isolation in WP context.

**Remaining in Phase 5:**

- Verify WP settings UI for auth/theme selection (as needed for production).
- End-to-end QA in WordPress (auth flows, admin panel, embed behavior).
- Packaging/release checklist for production deployment.

### Phase 6: Functionality Polish

Track functional UX improvements that are not pure styling.

- **Embed providers:** modularize provider handlers, and revisit Rumble/other non-oEmbed providers for robust previews and fallback thumbnails.
- **Access UI:** add a searchable user picker (dropdown/search) while keeping manual user ID entry available.
- **Access visibility:** show current effective user grants (not just entries created from the admin panel).
- **Upload metadata edit:** allow editing upload metadata (e.g., caption) within the upload dialog before saving.
- **Thumbnail reflow:** reflow uploaded image thumbnails inside media cards for consistent cropping and layout.
- **Image optimizer:** provide a manual/on-demand image optimizer workflow (details TBD).
- **App/media performance:** optimize initial app load and media loading (preload/lazy-load strategies).
- **External thumbnail cache:** cache external media thumbnails (server-side fetch + storage) to improve reliability and performance.

- **oEmbed failure monitoring:** track repeated oEmbed failures, expose `wpsg_oembed_failure_count` as a WP option, and provide a lightweight admin dashboard widget to surface recent failure trends (Phase 6).
- **WP-CLI:** add a `wpsg` WP-CLI command to view/reset `wpsg_oembed_failure_count` and inspect cached oEmbed keys (Phase 6).
- **Plugin PHP tests:** add and maintain PHPUnit tests for `includes/` logic (proxy_oembed, normalizers, cache behavior) and run these in CI (Phase 6).
- **Admin metric & alerting:** provide a simple admin metric panel and `do_action('wpsg_oembed_failure', $url, $attempts)` integration hook for external monitoring systems (Phase 6).
- **Logging / metrics:** ensure oEmbed failures log via `error_log()` and provide an opt-in integration point for external metrics (e.g., StatsD/Prometheus) (Phase 6).

- **Admin Panel → Media tab:**
  - Add create/edit/delete media associations per campaign.
  - Provide upload flow for new media assets.
  - Allow linking external media and assigning to campaigns.
  - QoL: thumbnail fetching for upload + external links.
  - QoL: title metadata fetching for linked videos (where supported).

- **Consolidate media API usage:** replace ad-hoc `src/api/media.ts` helper usage with `ApiClient` (or pass `authHeaders`) and remove unused legacy helpers (Phase 6).
- **Deprecate/remove standalone media helpers:** review exported helpers in `src/api/media.ts` and either remove or mark deprecated if all call-sites now use `ApiClient` (Phase 6).

### Phase 7: Polish + Production Readiness

- Error handling, analytics, performance, accessibility.
- Logging and audit trails for admin actions.

### Phase 8: Theme System

- Implement a global theme system for main UI + admin panel.
- Reference feasibility and configuration plan in [docs/THEME_SYSTEM_ASSESSMENT.md](docs/THEME_SYSTEM_ASSESSMENT.md).

---

## Admin Panel Sub‑Plan

A separate doc captures the admin panel flow and complexity: [docs/ADMIN_PANEL_PLAN.md](docs/ADMIN_PANEL_PLAN.md)

---

## Next Decision Needed

1. Choose auth provider from the shortlist above.
2. Decide if/when to plan external DB migration (post-Phase 1).

Document created: January 17, 2026.
