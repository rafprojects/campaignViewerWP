# Phase 2 Report (Auth + Permissions)

This report tracks Phase 2 work: authentication, permission enforcement, and frontend auth state.

---

## Scope

- Authenticate users for the SPA and WordPress embed.
- Fetch and apply permissions to campaign visibility.
- Wire WordPress JWT auth for REST endpoints.
- Document setup and operational requirements.

## Completed

### 1) Auth Abstraction

- Added `AuthProvider` interface and session/user types.
- Implemented WP JWT adapter.
- Added Auth context + hook for app‑wide auth state.

Files:

- [src/services/auth/AuthProvider.ts](src/services/auth/AuthProvider.ts)
- [src/services/auth/WpJwtProvider.ts](src/services/auth/WpJwtProvider.ts)
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- [src/hooks/useAuth.ts](src/hooks/useAuth.ts)

### 2) Frontend Auth State

- Added a basic login form when auth is configured.
- Added a sign-out control for swapping users during QA.
- Disabled mock permissions when provider is set.

Files:

- [src/components/Auth/LoginForm.tsx](src/components/Auth/LoginForm.tsx)
- [src/components/Auth/LoginForm.module.scss](src/components/Auth/LoginForm.module.scss)
- [src/App.tsx](src/App.tsx)
- [src/styles/global.scss](src/styles/global.scss)

### 3) Permissions Endpoint + Access Checks

- Added `/wp-json/wp-super-gallery/v1/permissions` to return campaign IDs.
- Enforced visibility/access checks in campaign and media endpoints.
- Applied `require_authenticated` on permissions endpoint.

Files:

- [wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php](wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php)

### 4) JWT Setup Documentation

- Documented JWT plugin setup, CORS, and Apache/.htaccess requirements.

Files:

- [docs/WP_JWT_SETUP.md](docs/WP_JWT_SETUP.md)

### 5) Live REST Data in UI

- Replaced mock campaigns with live REST data fetch.
- Added loading and error states for campaign retrieval.
- Normalized media data with fallbacks.

Files:

- [src/App.tsx](src/App.tsx)

### 6) Auth Lifecycle

- Added 401 handling to clear session and prompt re‑auth.
- Validate stored JWT on init via token/validate.
- Centralized unauthorized handling for API requests.
- Added JWT expiry detection (auto-logout and re-auth on expired token).
- Improved login error messaging with provider feedback.

Files:

- [src/App.tsx](src/App.tsx)
- [src/services/apiClient.ts](src/services/apiClient.ts)
- [src/services/auth/WpJwtProvider.ts](src/services/auth/WpJwtProvider.ts)
- [src/components/Auth/LoginForm.tsx](src/components/Auth/LoginForm.tsx)

### 7) UI Permission Gating

- Locked campaign viewer media behind access checks.
- Added optional hide mode for non‑permitted campaigns (default is lock).
- Added admin-only toggle for access mode.
- Persisted access mode choice in local storage.
- Added admin-only UI action affordances in the campaign viewer.
- Wired admin edit/archive/add-media actions to REST endpoints.
- Finalized hide/lock behaviors and empty states in the gallery.
- Added admin action feedback banners and capability gating in the UI.

Files:

- [src/components/Campaign/CampaignViewer.tsx](src/components/Campaign/CampaignViewer.tsx)
- [src/components/Campaign/CampaignViewer.module.scss](src/components/Campaign/CampaignViewer.module.scss)
- [src/App.tsx](src/App.tsx)
- [src/components/Gallery/CardGallery.tsx](src/components/Gallery/CardGallery.tsx)
- [src/components/Gallery/CardGallery.module.scss](src/components/Gallery/CardGallery.module.scss)
- [src/styles/global.scss](src/styles/global.scss)

### 8) Testing Plan + Automated Suites

- Added testing plan and manual QA procedures.
- Added unit testing scaffolding (Vitest + Testing Library).
- Added Playwright E2E coverage for auth, permissions, and admin actions.

Files:

- [docs/TESTING_PLAN.md](docs/TESTING_PLAN.md)
- [vite.config.ts](vite.config.ts)
- [src/test/setup.ts](src/test/setup.ts)
- [src/test/test-globals.d.ts](src/test/test-globals.d.ts)
- [src/components/Gallery/CardGallery.test.tsx](src/components/Gallery/CardGallery.test.tsx)
- [src/components/Campaign/CampaignViewer.test.tsx](src/components/Campaign/CampaignViewer.test.tsx)
- [playwright.config.ts](playwright.config.ts)
- [e2e/smoke.spec.ts](e2e/smoke.spec.ts)
- [e2e/auth-permissions.spec.ts](e2e/auth-permissions.spec.ts)
- [e2e/admin-actions.spec.ts](e2e/admin-actions.spec.ts)

### 9) WP Embed Config Injection

- Injected runtime auth + API base config into the WordPress shortcode output.

Files:

- [wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php](wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php)

---

## Status

Phase 2 is complete. Manual QA and E2E coverage for auth + permissions are validated.

Document updated: January 23, 2026.
