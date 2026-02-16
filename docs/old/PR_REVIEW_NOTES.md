# PR Review Notes (Skipped / Deferred)

This document tracks PRs reviewed but **not** applied to this codebase yet. It captures the rationale and follow‑ups so we can revisit later.

---

## Skipped / Deferred

### PR #15 — Replace localStorage with in‑memory JWT token storage

- Link: [PR #15](https://github.com/rafprojects/campaignViewerWP/pull/15)
- Status: Deferred
- Summary:
  - Replaces persistent `localStorage` storage for JWT with in‑memory variables.
  - Updates tests and documentation to reflect non‑persistent tokens.
  - Adds security guidance around XSS and CSP in docs.
- Rationale for deferral:
  - Breaks refresh persistence (users must re‑authenticate on every reload), which complicates QA and manual testing.
  - Current app flow relies on persisted tokens for a smoother UX.
- Follow‑up options:
  - Consider a **configurable storage mode**, e.g. `window.__WPSG_TOKEN_STORAGE__ = "memory" | "local"`.
  - Default to `local` for UX, allow `memory` for hardened deployments.
  - Add a “security mode” section to docs explaining trade‑offs.
- Dependencies/impact:
  - `src/services/auth/WpJwtProvider.ts` (token/user/permissions storage)
  - `src/services/auth/WpJwtProvider.test.ts`
  - `src/App.test.tsx`
  - [docs/WP_JWT_SETUP.md](docs/WP_JWT_SETUP.md)

### PR #9 — Enforce visibility and access grants in GET /campaigns endpoint

- Link: [PR #9](https://github.com/rafprojects/campaignViewerWP/pull/9)
- Status: Skipped (already addressed)
- Summary:
  - Adds per‑campaign access filtering in `list_campaigns()`.
  - Updates pagination to reflect filtered results.
- Rationale for skipping:
  - Our `list_campaigns()` now filters at the database level for non‑admins using
    `post__in` from `get_accessible_campaign_ids()`, which already respects
    visibility and access grants.
  - Pagination metadata is now sourced from `WP_Query` totals.
- Addressed in this repo:
  - Database‑level filtering for non‑admins using `post__in` and accessible IDs.
  - Pagination metadata returned from `WP_Query` totals.
  - Implemented in [wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php](wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php) on 2026‑01‑23.
- Follow‑up options:
  - Consider using 404 for unauthorized access in `get_campaign()` / `list_media()`
    to reduce information leakage.

### PR #6 — Enforce access controls on REST API endpoints

- Link: [PR #6](https://github.com/rafprojects/campaignViewerWP/pull/6)
- Status: Skipped (already addressed)
- Summary:
  - Adds stricter permission callbacks and access helpers.
- Rationale for skipping:
  - Current handlers already enforce access via `can_view_campaign()` and admin
    checks; `list_campaigns()` is filtered by accessible IDs for non‑admins.
- Addressed in this repo:
  - Existing `can_view_campaign()` checks are enforced for campaign and media
    access, and list filtering is scoped to accessible IDs.
  - Implemented in [wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php](wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php) during Phase 2.
- Follow‑up options:
  - Evaluate swapping unauthorized responses to 404 for sensitive endpoints.

### PR #5 — Fix campaign enumeration vulnerability in list_campaigns

- Link: [PR #5](https://github.com/rafprojects/campaignViewerWP/pull/5)
- Status: Skipped (already addressed)
- Summary:
  - Prevents unauthenticated enumeration of private campaigns via `visibility`.
- Rationale for skipping:
  - Anonymous users are forced to `visibility=public` in `list_campaigns()`.
  - Authenticated non‑admins are constrained to `post__in` accessible IDs.
- Addressed in this repo:
  - Anonymous users are forced to `visibility=public` in `list_campaigns()`.
  - Authenticated non‑admins are constrained to `post__in` accessible IDs.
  - Implemented in [wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php](wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php) on 2026‑01‑23.
