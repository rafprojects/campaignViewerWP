# Phase 53 - RBAC Model Alignment & Frontend Surfacing

**Status:** In Progress
**Created:** 2026-06-15
**Last updated:** 2026-06-15

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P53-A | Frontend RBAC tier surfacing — expose a System-Admin tier to the React app, gate AdminPanel system controls by tier, scope the editor's Admin Panel to its spaces; template/asset delete-confirm modals that handle the P52-A5c `409` → resend `force=true`. Makes the `wpsg_editor` role usable. **Deferred from P52-A6.** | To do | High |
| P53-B | Public-campaign visibility fix — public campaigns viewable by everyone (logged-in users no longer see less than anonymous) | **Done 2026-06-15** | Low |
| P53-C | Portability — semantic capability-tier seam (`WPSG_Permissions::actor_has_tier`) isolating the WordPress-capability binding to one method | **Done 2026-06-15** | Low |
| P53-D | Access-grant model simplification (viewer-only; editing/managing comes from the `wpsg_editor` role). D1 (campaign+company) + D2 (space) + D3 (frontend AccessTab) | **Done 2026-06-15** | Medium |

---

## Rationale

Phase 53 finishes the access-control story that P52-A started server-side. Live testing of the deployed P52-A build surfaced that the React app does not yet *reflect* the boundary, and that the model itself had a confusing overlap. This phase aligns the model end-to-end and makes the editor role usable, and designs ahead for an eventual non-WordPress backend.

### Confirmed access model (decided 2026-06-15)

Two axes were being conflated; the intended model is:

- **Viewer** = read-only. **Public campaigns are viewable by everyone** (anonymous or logged-in); private campaigns are visible only to a granted user (or an admin/editor of the space). No editing UI. (WP role: `subscriber`.)
- **Editor** = the **`wpsg_editor` role** (`manage_wpsg`): a space-scoped app admin who can edit campaigns + campaign/display settings in the spaces it has access to, but not system settings or WordPress itself. **Editing capability comes from the role, not from per-campaign access grants.** Provisioned by assigning the role + granting space access.
- **System Admin** = `administrator` (`manage_options`): full WordPress + all spaces + system settings + user management.

The per-campaign/space access *levels* (viewer/editor/owner) are a separate P33 grant mechanism. Because editing now comes from the role, the editor/owner grant levels are redundant — see P53-D.

## Track P53-B - Public-campaign visibility fix (Done 2026-06-15)

**Bug.** `can_view_campaign()` ran the P47 space-isolation gate *before* the `public` visibility check, so a logged-in user without access to a campaign's space was denied **even for public campaigns**. Anonymous visitors take a different path in `list_campaigns()` (a direct `visibility='public'` query with no space gate), so a logged-in user saw **less** public content than an anonymous one — the reported regression.

**Fix.** Reordered `can_view_campaign()` ([class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php)) so an **in-window, non-draft, `public`** campaign returns `true` *before* the space gate — public means public. Private / draft / out-of-window content keeps the original order (space gate → admin bypass → schedule/draft → grants), so P47 delegated isolation for **private** content and all draft/schedule/admin behavior are preserved. All three consumers (`get_accessible_campaign_ids`, single `GET /campaigns/{id}`, `GET /campaigns/{id}/media`) inherit the fix.

**Proven.** New `tests/WPSG_Public_Visibility_Test.php` (5 tests): a logged-in non-member CAN view a public campaign in a delegated space they can't access (matching anonymous) but still CANNOT view its private campaign; anonymous matches; an out-of-window public campaign is not universally visible (schedule preserved). Full PHPUnit suite green — **1013 tests, 12202 assertions, 0 failures**; P36-C draft, schedule-window, and P47 isolation suites unaffected.

## Track P53-C - Portability: capability-tier seam (Done 2026-06-15)

Toward an eventual non-WordPress backend, the WP-capability binding for authorization tiers is now isolated to **one method**. `WPSG_Permissions` defines semantic tiers (`TIER_SYSTEM_ADMIN` / `TIER_EDITOR` / `TIER_VIEWER`) and `actor_has_tier()` — the single seam mapping app tiers to WP caps (`manage_options` / `manage_wpsg` / `is_user_logged_in`). The permission primitives (`require_admin`, `require_system_admin`, `rate_limit_authenticated`, `require_campaign_editor`/`owner`, `require_campaign_space_access`/`batch`, `require_authenticated`) now ask for a **tier**, never a raw cap. A future backend reimplements only `actor_has_tier()`.

Deliberately **out of this seam** (documented as the separate storage/auth seam to port later): the per-grant resolution helpers `get_effective_campaign_level` / `get_effective_space_level` / `can_view_campaign` (which mix decision logic with `get_post_meta`/custom-table reads and a per-user `manage_wpsg` override), and `verify_admin_auth()`'s Basic-auth `is_user_logged_in()` integrity check.

**No behavior change** — `actor_has_tier(EDITOR) === current_user_can('manage_wpsg')`, etc.; the frozen `WPSG_Permissions` matrix (action→strategy) is unchanged. Proven by the full suite staying green plus a new `test_actor_has_tier_resolves_current_user` in `WPSG_P52A_Permission_Matrix_Test`.

## Track P53-A - Frontend RBAC tier surfacing / editor enablement (deferred from P52-A6)

### Problem

The boundary is enforced server-side but invisible to the frontend, and **all editing UI is gated on `manage_wpsg`** (the frontend turns it into `role: 'admin'`). Consequences confirmed in testing:

- A user granted "editor" via the Access tab (an access *grant*, not the role) is a `subscriber` without `manage_wpsg` → the AuthBar shows **only "Sign out"**: no Admin Panel, Settings, Space Switcher, or edit actions. They behave like a viewer-but-worse.
- A genuine `wpsg_editor` *does* get the Admin Panel today (it has `manage_wpsg`), but **unscoped** — it shows system controls that the server now `403`s and all spaces, because the tier was never surfaced.
- The React app has **no `manage_options` concept** — auth state exposes only `isAdmin` (= `manage_wpsg`), consumed across ~32 files.
- P52-A5c's in-use delete guards return `409` with no client affordance to confirm/`force`.

### Scope

1. **Surface the tier semantically.** Add a System-Admin signal to `list_permissions` (`/permissions`) + page-config JS, threaded **through the existing `AuthProvider` interface** (`src/services/auth/*`) as `isSystemAdmin`/`isEditor`/`isViewer` — components consume tier semantics, never `manage_wpsg`, keeping the auth providers the only WP-aware layer (ties into P53-C).
2. **Make the editor's Admin Panel scoped + usable.** Hide System-Admin-only surfaces (system settings keys, fonts delete, Spaces management, user creation, global audit log, webhooks, media library, binary import/export) from editors; scope the Space Switcher / campaign lists to the editor's accessible spaces; keep campaign + campaign/display settings.
3. **Delete-confirm modals.** Catch the `409`, show "in use by N — delete anyway?", resend with `force=true`.

### Constraint

Any tier/permission-**management** UI (role assignment, future custom-role config) belongs in the WordPress "Super Gallery" admin sidebar, **not** the React app (user direction, 2026-06-15). In-app work is limited to *reflecting* the tier + the delete-confirm flow.

### Acceptance criteria

- The app knows the caller's tier; no System-Admin-only control is rendered for a `wpsg_editor`; the editor's Admin Panel is scoped to its spaces and is genuinely usable for editing campaigns + campaign/display settings.
- Template/asset delete surfaces the in-use conflict and can force past it.
- No regression to the server boundary (P52-A suites stay green).

### Validation

- React/vitest tests for tier gating + the 409→force flow.
- Manual QA: log in as `wpsg_editor` vs administrator; confirm the editor gets a scoped, usable Admin Panel and the System Admin sees everything.

## Track P53-D - Access-grant model simplification (decided 2026-06-15: viewer-only)

Editing/managing comes from the `wpsg_editor` role, so the per-campaign/space **editor/owner grant levels are redundant**. Access grants are reduced to **viewer-only**: the Access tab shares read access to a *private* campaign/space with a specific reader; editing/managing requires the `wpsg_editor` role + space access. This **supersedes the proposed P52-A7 "admins-only granting"** (without editor/owner grants, non-admins can't grant by construction) and **resolves the `users/search` gap** (only `manage_wpsg` users grant, and they have search).

Staged delivery:

### D1 — Campaign + company grant model (Done 2026-06-15)

- **Collapsed** the 17 per-campaign edit/manage endpoints (update, duplicate, media×6, delete, archive, restore, access list/grant/revoke, access-request list/approve/deny) from `require_campaign_editor`/`require_campaign_owner` to **`require_campaign_space_access`** (manage_wpsg + the campaign's space access). This also **closes a residual F2 gap**: bare `manage_wpsg` no longer bypasses space scope on the edit endpoints, so a delegated-space editor without access is denied. (`require_campaign_editor`/`owner` are now unused/deprecated; `company.access.*` were already `require_system_admin` from A5a.)
- **Reduced** the campaign / company / approve grant `access_level` enums to `['viewer']` (`class-wpsg-access-controller.php`). Legacy editor/owner grants in stored data degrade gracefully to "view-only" (gating ignores the level; viewing still honors the grant) — no data migration.
- **Tests:** overhauled `WPSG_P33C_Role_Enforcement_Test` (a non-admin editor/owner grant now → 403 on every mutation) and `WPSG_P33B_Access_Level_Test` (viewer-only storage); new `WPSG_P53D_Grant_Model_Test` (a `wpsg_editor` edits in accessible spaces, is denied in a delegated space without access, allowed with a space grant; a legacy grant can view but not edit; the grant endpoint rejects non-viewer levels). Full PHPUnit suite green — **1018 tests, 12209 assertions, 0 failures**.

### D2 — Space grant model (Done 2026-06-15)

- Added `WPSG_REST_Base::require_space_admin()` (manage_wpsg + space access) and flipped the **9** space management/access-management endpoints (update, delete, access list/grant/revoke, resolve-user, settings.update, library associate/dissociate) from `require_space_owner` to it. Space reads (`space.read` / `settings.read` / `library.read`) stay `require_space_member`, so a viewer-grantee can still read a space but not manage it. `require_space_owner` is now unused (deprecated in the legend).
- Reduced the space grant `access_level` enum to `['viewer']`.
- Relaxed `require_campaign_space_move` from owner-level on both spaces to **manage_wpsg + access to both** source and target. Uses the archived-agnostic level check (not `can_access_space`) so the handler still returns 404 for an archived target and a campaign can be moved *out* of an archived source.
- **Tests:** extended `WPSG_P53D_Grant_Model_Test` (editor manages an accessible space; denied in a delegated space without access; a viewer-grantee can read but not manage; the space grant endpoint rejects non-viewer levels). The one affected P50-A move case (archived target) keeps its 404 via the archived-agnostic check. Full PHPUnit suite green — **1022 tests, 12215 assertions, 0 failures**.

### D3 — Frontend grant UI (Done 2026-06-15)

`src/components/Admin/AccessTab.tsx` role dropdown reduced to **viewer-only** (removed the ✏️ Editor / 👑 Owner options) so the grant UI matches the server. `AccessTab.test.tsx` green (15/15). (The role state/prop type is left as the viewer/editor/owner union for now; a fuller redesign of the grant UI belongs to P53-A.)

---

## WordPress coupling seams (for the future non-WP port)

Map of what binds to WordPress, to make the eventual decoupling additive:

| Seam | Where | Status |
|------|-------|--------|
| **Authorization tiers** | `WPSG_Permissions::actor_has_tier()` (caps→tiers) | ✅ isolated to one method (P53-C) |
| **Authorization policy** | `WPSG_Permissions::MAP` (action→requirement) | ✅ already declarative/portable (P52-A) |
| **Per-grant resolution** | `get_effective_campaign_level` / `get_effective_space_level` / `can_view_campaign` (logic + `get_post_meta`/tables) | ⚠️ decision logic + storage mixed; port later |
| **Auth integrity** | `verify_admin_auth()` (nonce / Bearer / Basic) | ⚠️ WP-specific; frontend already abstracts via `AuthProvider` |
| **Storage** | CPT `wpsg_campaign`, post/term meta, custom tables, `wp_options`, `WP_Query` | ⚠️ largest lift; future-task |
| **API framework** | WP REST (`register_rest_route`, permission callbacks) | ⚠️ future-task |

The full non-WP **storage + auth + REST** port is a large, separate effort — but additive given these seams. To be recorded in `docs/FUTURE_TASKS.md` when scoped.

---

## Notes

- The granular custom-role builder remains separately future-tasked (`docs/FUTURE_TASKS.md` › Access Control) and is **not** part of P53.
