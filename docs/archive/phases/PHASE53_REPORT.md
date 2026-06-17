# Phase 53 - RBAC Model Alignment & Frontend Surfacing

**Status:** Done
**Created:** 2026-06-15
**Last updated:** 2026-06-16

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P53-A | Frontend RBAC tier surfacing — expose a System-Admin tier to the React app, gate AdminPanel system controls by tier, scope the editor's Admin Panel + campaign list to its spaces; layout-template delete-confirm modal handling the P52-A5c `409` → resend `force=true`. Makes the `wpsg_editor` role usable. **Deferred from P52-A6.** A1 (backend signal) + A2 (FE plumbing) + A3 (gate surfaces) + A4 (backend scoping) + A5 (delete-confirm) | ✅ **Done 2026-06-16** | High |
| P53-B | Public-campaign visibility fix — public campaigns viewable by everyone (logged-in users no longer see less than anonymous) | ✅ **Done 2026-06-15** | Low |
| P53-C | Portability — semantic capability-tier seam (`WPSG_Permissions::actor_has_tier`) isolating the WordPress-capability binding to one method | ✅ **Done 2026-06-15** | Low |
| P53-D | Access-grant model simplification (viewer-only; editing/managing comes from the `wpsg_editor` role). D1 (campaign+company) + D2 (space) + D3 (frontend AccessTab) | ✅ **Done 2026-06-15** | Medium |

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

## Track P53-A - Frontend RBAC tier surfacing / editor enablement (Done 2026-06-16, deferred from P52-A6)

### Problem

The boundary was enforced server-side but invisible to the frontend, and **all editing UI was gated on a single `manage_wpsg` → `role: 'admin'` flag**. A genuine `wpsg_editor` got the Admin Panel but **unscoped** — full of System-Admin-only controls the server now `403`s, plus a few queries (`access-summary`, `audit-log`, `analytics/summary`) that fired unconditionally and hard-`403`d. The React app had **no `manage_options` concept**, and P52-A5c's in-use delete guards returned `409` with no client affordance to force.

### Design

`isAdmin` is redefined to mean **editor-or-above** (true for `wpsg_editor` AND administrator) — every existing `isAdmin` consumer is an editing affordance the backend already grants editors, so they're unchanged and simply become true for editors. A new **`isSystemAdmin`** signal gates the system-admin-only surfaces. Tier semantics are exposed once from `AuthContext` (`isAdmin` / `isSystemAdmin`), not prop-drilled. The tier maps from two backend booleans: `isSystemAdmin ? 'admin' : isAdmin ? 'editor' : 'viewer'`.

Constraint (user direction, 2026-06-15): tier/permission-**management** UI stays in the WordPress "Super Gallery" sidebar; in-app work is limited to *reflecting* the tier + the delete-confirm flow.

### Staged delivery

**A-1 — Backend tier signal (commit `c328369d`).** `list_permissions` (`/permissions`) and the cookie-login payload now carry `isSystemAdmin` (= `actor_has_tier(TIER_SYSTEM_ADMIN)`) alongside `isAdmin` (manage_wpsg); login `user.role` resolves to admin/editor/viewer. New `WPSG_P53A_Tier_Signal_Test` (4) + editor/system-admin login cases in `WPSG_Cookie_Auth_Test`.

**A-2 — Frontend tier plumbing (commit `86cb337c`).** `AuthUser.role` widened to `viewer|editor|admin` with a `resolveRole(isAdmin, isSystemAdmin)` seam in `WpNonceProvider`/`WpJwtProvider`; `AuthContext` exposes `isAdmin` (editor-or-above) + `isSystemAdmin`; `App` derives `isAdmin` from context. So a `wpsg_editor` now correctly gets the editing UI. Auth-provider + context vitest updated (the old `isAdmin:true ⇒ 'admin'` cases now resolve to `'editor'`).

**A-3 — Gate system-admin surfaces (commit `8b9b41d1`).** Hidden from editors (mirroring `WPSG_Permissions::MAP`): campaign **Import**, media **Export/Import ZIP + Rescan All**, the **System Audit** tab, the Access **Company/All** views, the **all-campaign analytics** (totals + top-campaigns), the **create-space** form, the Settings **Integrations + System & Admin** tabs, and **font delete**. The `useAccessSummary` / `useGlobalAuditEntries` / `useAnalyticsSummary` queries gain an `enabled` arg so editors never fire a request that hard-`403`s. Vitest gating cases added across AdminPanel/AccessTab/Analytics/FontLibrary/SpaceManagement/SettingsPanel.

**A-4 — Backend scoping (commit `7ecee311`).** `list_campaigns` now gives only a System Admin (`manage_options`) the unscoped view; a `wpsg_editor` is scoped via `get_accessible_campaign_ids` (public campaigns everywhere per P53-B + everything in accessible spaces), closing the cross-space private-metadata leak (user-confirmed to fix here). The page-spaces list + admin-bar nodes are filtered through the new public `WPSG_REST_Base::current_actor_can_access_space()`. New `WPSG_P53A_Scoping_Test` (7); P47 isolation / public-visibility / draft suites unaffected.

**A-5 — Delete-confirm modal (commit `1a1cc72d`).** `ApiError` now carries the parsed response body, so the client reads the P52-A5c in-use count; `LayoutTemplateList` catches the `409`, shows a second confirm ("in use by N campaign(s) — delete anyway?"), and resends with `force=true` (`deleteLayoutTemplate` gains an optional `force` arg). Vitest covers the 409→force escalation.

### Proven

Full PHPUnit suite green — **1034 tests, 12964 assertions, 0 failures, 2 skipped**. Full frontend vitest green — **174 files, 2372 tests, 0 failures**. Manual QA pending on the deployed instance (log in as `wpsg_editor` vs administrator).

### Follow-up

Asset-library delete (the inline delete in `LayoutBuilderModal`) shares the same A5c 409 contract but was not wired to the force-confirm flow in A-5; the `ApiError.data` plumbing is in place for it. Minor — track as a future polish item if it surfaces.

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
