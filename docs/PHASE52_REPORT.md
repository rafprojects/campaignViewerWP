# Phase 52 - Admin Platform Features & RBAC Enforcement Audit

**Status:** In Progress
**Created:** 2026-06-14
**Last updated:** 2026-06-15

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P52-A | RBAC audit & boundary enforcement — redesigned to a `manage_options` (System Admin) vs `manage_wpsg` (`wpsg_editor`, space-scoped) model via a centralized `WPSG_Permissions` map; staged A1–A6 (**A1–A5 done — all server-side enforcement complete; F1+F2 closed**; A6 frontend UX deferred → PHASE53) | ✅ Done | High |
| P52-B | Asset Management — global (non-campaign) asset add/delete in WP admin, mirrored into the app Admin Panel | ✅ Done | Medium-High |
| P52-C | Campaign tags/categories overhaul — show tags+categories in the listing, "Add Campaign" modal, multi-select tag/category entry with removable badges | ✅ Done | Medium |
| P52-D | Service Worker offline app-shell — versioned shell cache + deploy-time busting + offline fallback (promoted from FUTURE_TASKS) | ✅ Done | Medium |
| P52-E | vitest CRITICAL spec fix — `"vitest": "^2.1.8"` caps at 2.1.9 which is below the fix threshold (≥ 3.2.6); bump to `^4.0.0` matching the version already used in the lock file | ✅ Done | Low |
| P52-F | esbuild HIGH override — esbuild is capped at 0.25.x by vite's `^0.25.0` dep; needs an `overrides` entry to reach 0.28.1 (GHSA-gv7w-rqvm-qjhr); verify build/storybook still pass | ✅ Done | Low |
| P52-G | Lock file regeneration — current lock file is stale/inconsistent; after P52-E+F land, delete lock and run fresh `npm install` to pull dompurify@3.4.10, fast-uri@3.1.2, postcss@8.5.15, and close 8 remaining alerts | ✅ Done | Low |

---

## Rationale

Phase 52 collects the **larger, net-new features, security audit, and dependency CVE remediation** that were split out of the Phase 51 issue batch (Phase 51 kept the small, ship-now fixes — see PHASE51_REPORT.md, group P51-E…H). The feature tracks share a theme: they extend the admin/platform surface (asset management, campaign metadata UX) or harden it (RBAC enforcement). Three new tracks (P52-E, P52-F, P52-G) address 11 active Dependabot/npm audit advisories (HIGH and MODERATE) surfaced on the current branch.

Success: all Dependabot advisories are resolved or explicitly accepted with documented rationale; role boundaries are provably enforced server-side; admins can manage global assets from both the WP sidebar and the in-app Admin Panel using the same workflow; campaign tags/categories are first-class in listing and creation; and the gallery degrades gracefully offline.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Where Asset Management UI lives | Build the asset CRUD UI as a shared component and surface it in **both** the WP admin (new "SuperGallery" submenu) and the app Admin Panel. The Admin Panel host shape (new tab vs. Media-tab subtabs) is an open decision — see P52-B. |
| B | Update path for grant role edits | Reuse the existing `upsert_grant()` POST endpoints (no new PATCH route) — already decided for the P51-H quick win; P52-A's audit confirms these paths enforce the right caps. |
| C | SearchableEntityInput multi-select | Extend with removable badges OR add a thin `MultiEntityInput` wrapper over Mantine `Combobox`, to avoid breaking existing single-select callers. Decide in P52-C. |

## Execution Priority

1. **P52-E** — two-line `package.json` spec change (vitest + coverage-v8 to `^4.0.0`); fixes the only CRITICAL alert.
2. **P52-F** — add `"overrides": { "esbuild": ">=0.28.1" }` to `package.json`; fixes the only remaining HIGH alert.
3. **P52-G** — delete the stale lock file and run `npm install`; a single command closes 8 remaining alerts and produces a clean, consistent lock file. Manually dismiss alert #1.
4. **P52-A** — RBAC correctness/security audit; its findings may constrain how P52-B (asset endpoints) and any admin surface are gated.
5. **P52-B** — depends on the P51-G menu rename (the new "SuperGallery" parent menu) and on P52-A's permission conclusions.
6. **P52-C** — self-contained React/REST work; data + endpoints already exist.
7. **P52-D** — independent; can land any time after P50-F (shipped).

---

## Track P52-A - RBAC audit & boundary enforcement

### Problem

The app has three access tiers — **reader** (view-only of permitted spaces), **editor** (in-app Admin Panel for permitted spaces only, no WP Dashboard), and **admin** (WP Dashboard + all spaces). We need to audit that these boundaries are enforced *server-side everywhere it matters* — particularly that editors/readers cannot reach the WP Dashboard or spaces they were not granted. Builds on prior RBAC work (`docs/PHASE33_REPORT.md`, `tests/WPSG_P33C_Role_Enforcement_Test.php`).

Key surfaces to audit:
- **Capability/role definitions:** `wp-plugin/wp-super-gallery/wp-super-gallery.php` (~lines 80–116: `manage_wpsg` cap, `wpsg_admin` role); CPT caps in `includes/class-wpsg-cpt.php` (~lines 14–25, `CPT_CAPS`, `map_meta_cap`).
- **Dashboard gating:** admin menu pages guarded by `manage_wpsg` / `manage_options` (`class-wpsg-space-admin-renderer.php` ~line 34; `class-wpsg-settings-renderer.php` ~line 47).
- **REST enforcement:** `includes/rest/class-wpsg-rest-base.php` (`require_admin` ~line 224, `require_campaign_editor`, `require_campaign_owner`); per-space/per-campaign grant resolution from post meta `access_grants` + `wpsg_company` term meta (`class-wpsg-access-controller.php`).

### Audit findings (2026-06-15)

A full read of every capability gate confirmed the **existing** enforcement is largely correct: all mutating REST routes are gated (`require_admin` / `require_campaign_*` / `require_space_*`), public reads filter via `can_view_campaign` server-side, and delegated-space isolation is enforced for space-scoped callbacks. Two findings drove the redesign below:

- **F1 — Provability gap.** Editor/reader denial of wp-admin screens and `require_admin` endpoints is real but **untested**. `WPSG_P33C_Role_Enforcement_Test` only covers campaign-scoped owner endpoints.
- **F2 — Delegated-mode admin cross-space gap.** `require_admin` is bare `manage_wpsg` with no space scoping, so in a delegated deployment a space-scoped `wpsg_admin` can still act on other spaces via `POST /campaigns/batch` (incl. delete), `/campaigns/{id}/audit`, `/companies/{id}/access`, `/campaigns/{id}/export*`, `/campaigns/access-summary`, `/admin/audit-log`, `/media/library`. (`create_campaign` already has a `can_access_space` guard — the model is intended, just unevenly applied.)

### Finalized model (decided 2026-06-15)

The boundary is anchored on **`manage_options` vs `manage_wpsg`**:

| Role | Caps | Meaning |
|------|------|---------|
| `administrator` | `manage_options` + `manage_wpsg` + CPT caps | **System Admin** — full WP + wp-admin gallery screens + system settings + all spaces |
| `wpsg_editor` *(renamed from `wpsg_admin`)* | `manage_wpsg` + `read` + `upload_files`; **no** CPT caps, **no** `manage_options` | **Space Editor** — in-app Admin Panel only (no wp-admin), scoped to accessible spaces, campaign/display settings only |
| subscriber + grants | — | viewer / editor / owner per campaign/company/space |

- The capability stays named `manage_wpsg` (renaming a stored cap is migration-heavy); only the **role slug** changes, with an upgrade migration that moves existing users and removes the old role.
- Stripping the CPT caps from `wpsg_editor` removes the wp-admin "Campaigns" menu. Verified safe: no REST permission callback checks the CPT caps — they all use `manage_wpsg`.
- **Authorization is centralized** into a new `WPSG_Permissions` **action→requirement map** (tier + scope + optional resource guard). Named tiers are presets over this map; the map *is* the audit matrix and every row is asserted by a test. A future granular custom-role builder composes over this foundation (deferred — see `docs/FUTURE_TASKS.md` › Access Control).

**Per-resource policy for global/shared resources** (here "editor" = `wpsg_editor` = `manage_wpsg`):

| Action | wpsg_editor | System Admin | Guard |
|--------|:----------:|:------------:|-------|
| categories / tags — create/edit/delete | ✅ | ✅ | global, no guard |
| layout templates / assets — create/edit | ✅ | ✅ | — |
| layout templates / assets — **delete** | ✅ | ✅ | **server-side in-use guard** + client confirm modal (modal is UX, not a security control) |
| fonts — upload/edit | ✅ | ✅ | — |
| fonts — **delete** | ❌ | ✅ | admin-only |

System/global REST (settings system keys, health, thumbnail-cache, webhooks, global audit-log, media library, binary import/export, user creation + role assignment) → `manage_options`. Per-campaign/company REST (batch ops, per-campaign audit/export, company access, analytics) → `manage_wpsg` **+ space access** derived from the target's space.

### Sub-track decomposition (staged, with checkpoints)

| Sub-track | Scope | Phase | Status |
|-----------|-------|-------|--------|
| **A1** | `WPSG_Permissions` centralized map wired to **current** gates + regression tests asserting the present matrix (provable baseline, no behavior change) | P52 | **Done 2026-06-15** |
| **A2** | Role rename `wpsg_admin`→`wpsg_editor` (slug only), strip CPT caps, upgrade migration, uninstall + `create_user` enum + `list_roles` + frontend role-string updates | P52 | **Done 2026-06-15** |
| **A3** | wp-admin re-gating: Spaces page + `admin_post_wpsg_create_space` → `manage_options`; CPT menu hidden for editor (from A2) | P52 | **Done 2026-06-15** |
| **A4** | Settings split: `$admin_only_fields` (system keys) require `manage_options` on write; display/campaign keys stay `manage_wpsg` | P52 | **Done 2026-06-15** |
| **A5a** | REST hardening — system/global endpoints → `manage_options` (new `require_system_admin`) | P52 | **Done 2026-06-15** |
| **A5b** | REST hardening — per-campaign/company endpoints → `manage_wpsg` + space access (closes F2) | P52 | **Done 2026-06-15** |
| **A5c** | Per-resource delete policy — layout-template/asset in-use guards; `fonts.delete` → `manage_options` | P52 | **Done 2026-06-15** |
| **A6** | Frontend UX: AdminPanel tier surfacing + template/asset delete confirm modals (any tier/permission-management control belongs in the WordPress "Super Gallery" admin sidebar, **not** the React app) | P53 | **Deferred → PHASE53** (decided 2026-06-15) |

### A1 — implementation notes (Done 2026-06-15)

**Built.** New `includes/class-wpsg-permissions.php` — `WPSG_Permissions` holds the authoritative `const MAP` of **119 actions → strategy** (the complete tier × surface matrix), plus `check($action, $request)` (fail-closed dispatcher), `gate($action)` (returns the permission-callback closure; `_doing_it_wrong` on an unknown action), and `strategy()`/`has()`/`actions()` accessors. Required in `includes/class-wpsg-rest.php` ahead of the controllers.

**Wired.** Every one of the 119 REST routes across the 10 controllers now uses `'permission_callback' => WPSG_Permissions::gate('<action>')`. Verified a strict 1:1 bijection — 119 registered routes ↔ 119 unique `gate()` action strings ↔ 119 MAP keys, with zero orphans on either side and zero duplicates. Each strategy value reproduces the *pre-refactor* gate verbatim (`require_admin`, `require_campaign_*`, `require_space_*`, `rate_limit_*`, `require_authenticated`, `__return_true`), so this is a pure indirection layer with **no behavior change**.

**Proven.** New `tests/WPSG_P52A_Permission_Matrix_Test.php` (10 tests, 980 assertions) asserts: (1) the frozen matrix, one assertion per row, against an independently hand-maintained copy (drift guard for A4/A5); (2) every strategy resolves to a callable `WPSG_REST_Base` primitive; (3) **completeness / no-bypass** — every registered `wp-super-gallery/v1` route's `permission_callback` is a `WPSG_Permissions` gate bound to a known action, and the set of wired actions equals the MAP keys exactly; (4) per-strategy allow/deny for `require_admin` (incl. the **F2 baseline**: a `manage_wpsg`-only editor *currently* passes system `require_admin` — the gap A4/A5 will close), `rate_limit_public`, `require_authenticated`, `__return_true`; (5) fail-closed on unknown action; (6) the `gate()` typo-guard. The `require_campaign_*`/`require_space_*` strategies remain cross-covered by `WPSG_P33C_Role_Enforcement_Test` and `WPSG_P47_Spaces_Isolation_Test`.

**No-behavior-change evidence.** Full PHPUnit suite green — **967 tests, 12003 assertions, 0 failures/0 errors** (2 pre-existing skips) — with P33C and P47 unmodified. Test-design note: an exact endpoint *count* assertion was dropped because WP's REST-server singleton accumulates duplicate endpoint registrations across the full suite (each `rest_api_init` re-appends); the action-set equality is the robust completeness proof and each accumulated duplicate is still validated as a gate.

### A2 — implementation notes (Done 2026-06-15)

**Role rename (slug only).** `wpsg_admin` → `wpsg_editor`; the *capability* stays `manage_wpsg` (renaming a stored cap is migration-heavy and unnecessary). The editor role now carries `read` + `upload_files` + `manage_wpsg` and **no custom CPT caps** (so it gets no wp-admin "Campaigns" menu) and **no `manage_options`**.

**Setup + migration** (`wp-super-gallery.php`). `wpsg_setup_roles_and_caps()` refactored: `administrator` keeps `manage_wpsg` + CPT caps (System Admin); a new idempotent `wpsg_ensure_editor_role()` creates/normalizes `wpsg_editor` (and strips any CPT caps left over from the legacy definition). A one-time `wpsg_maybe_migrate_roles()` (init priority 11, flag `wpsg_roles_migrated_editor`) ensures the editor role, reassigns every `wpsg_admin` user to `wpsg_editor` with `manage_wpsg` access intact, then removes the old role. It is flag-gated rather than tied to the setup gate, so it also fires on existing installs where the administrator already has `manage_wpsg` (setup gate closed).

**Touch points.** `class-wpsg-auth-controller.php` — `create_user` role enum + `$allowed_roles` + error text, and `list_roles` label ("Gallery Admin" → "Gallery Editor"). `uninstall.php` — removes `wpsg_editor` and the legacy `wpsg_admin` (if present) plus the new migration-flag option. `src/components/Admin/QuickAddUserModal.tsx` — role dropdown option. The localStorage keys `wpsg_admin_active_tab` / `wpsg_admin_shortcuts` are unrelated to the role and were intentionally **not** renamed.

**Proven.** New `tests/WPSG_P52A2_Role_Migration_Test.php` (8 tests): editor caps present, no `manage_options`/CPT caps, `ensure_editor_role` strips legacy CPT caps, the required **migration test** (pre-existing `wpsg_admin` user → `wpsg_editor`, access intact, legacy role removed, flag set), no-op when already migrated, and the `/users` contract (accepts `wpsg_editor`, rejects `wpsg_admin` with 400, `list_roles` exposes editor not legacy). Full PHPUnit suite green — **975 tests, 12043 assertions, 0 failures** — and `QuickAddUserModal.test.tsx` green (12/12).

### A3 — implementation notes (Done 2026-06-15)

**Re-gated wp-admin surfaces to `manage_options`.** The **Spaces** submenu page (`class-wpsg-space-admin-renderer.php`) moves from `manage_wpsg` to `manage_options` — managing spaces is a System Admin function. The `admin_post_wpsg_create_space` handler (`WPSG_CPT::handle_create_space()`) likewise now requires `manage_options`. **Settings** was already `manage_options` (kept; regression-tested).

**CPT menu provably hidden for editors.** The `wpsg_campaign` CPT is registered with `capability_type => ['wpsg_campaign','wpsg_campaigns']` + `map_meta_cap => true`, so its top-level "SuperGallery" menu (and the Spaces/Settings submenus nested under it) is gated by the CPT caps. A2 stripped those caps from `wpsg_editor`, so the entire menu is hidden for editors; A3's page-capability change additionally blocks direct-URL access. `render_create_space_ui()` only renders on the (CPT-cap-gated) campaign list screen, and the handler defends with `manage_options` regardless.

**Proven.** New `tests/WPSG_P52A3_Admin_Gating_Test.php` (5 tests): the Spaces page is registered with `manage_options`, Settings remains `manage_options` (regression), a `wpsg_editor` lacks `manage_options` and every CPT cap (menu hidden) while keeping `manage_wpsg`, an administrator has both, and the create-space handler `wp_die()`s for an editor. Full PHPUnit suite green — **980 tests, 12060 assertions, 0 failures**.

### A4 — implementation notes (Done 2026-06-15)

**Per-key split, not a flat flip.** `POST`/`PATCH /settings` is a *mixed-tier* endpoint — one request can carry both display/campaign keys and system keys — so the boundary is enforced **inside the handler**, not by swapping the route's strategy. The endpoints keep their `require_admin` (`manage_wpsg`) gate (you need `manage_wpsg` to write *any* setting); a new `WPSG_Settings_Controller::guard_admin_only_settings()` then returns **403 `wpsg_forbidden_settings`** if a caller lacking `manage_options` writes any key in the registry's `$admin_only_fields` (cache TTLs, upload limits, optimize/auth/retention, etc.).

**Keyed off caller intent.** The guard inspects `WPSG_Settings::from_js($body)` — the keys the caller actually sent — which is independent of `sanitize_settings()`'s "merge over current" behavior, so an editor's legitimate display-only write never trips it and unspecified system keys are never touched. The guard runs **before** any persistence, so a mixed payload is rejected atomically (no partial write).

**Map note.** `WPSG_Permissions::MAP` keeps `settings.update`/`settings.patch` ⇒ `require_admin` by design — a documented exception to A5's flat reclassification, since these endpoints are mixed-tier and enforce the system-key boundary per-key.

**Proven.** New `tests/WPSG_P52A4_Settings_Split_Test.php` (5 tests): editor writes a display setting (200), editor denied a system setting via POST and via PATCH (value unchanged), a mixed payload is rejected atomically (display key not applied), and a System Admin writes a system setting (200, persisted). Full PHPUnit suite green — **985 tests, 12072 assertions, 0 failures**.

### A5 — REST hardening (decisions 2026-06-15)

Four classification decisions were confirmed with the user (all as recommended): cross-space **global aggregates** (analytics summary, access-summary, media usage) → System Admin only; **company-level** endpoints (access list/grant/revoke, archive) → System Admin only (a company spans spaces); **import** endpoints → `manage_options` while `/media/upload` stays editor-tier; and **A5 delivered staged as A5a/A5b/A5c**. `users/search` is kept `manage_wpsg` (the access-grant UI needs it); the pre-existing gap that a subscriber-with-owner-grant can't reach it is noted for a future task, out of A5 scope.

#### A5a — system → `manage_options` (Done 2026-06-15)

Added `WPSG_REST_Base::require_system_admin()` (`manage_options` + auth-integrity). Flipped **30** MAP entries from `require_admin` to `require_system_admin` — roles.list; campaigns.access-summary; company access×3 + archive; media usage-summary/usage, rescan-all, library list, binary export/import; analytics summary; campaign import + import-binary; health; oembed-failures read/reset; thumbnail-cache read/clear/refresh; webhooks×6; global audit-log read + export; spaces.create — and retargeted `rate_limit_authenticated` (which exclusively guards `POST /users`) from `manage_wpsg` to `manage_options`. The frozen matrix in `WPSG_P52A_Permission_Matrix_Test` was updated in lockstep. `spaces.list` is deferred to A5b (handler-side space filtering); `fonts.delete` to A5c.

**Proven.** New `tests/WPSG_P52A5a_System_Admin_Gating_Test.php` (5 tests, 73 assertions): a `wpsg_editor` is denied **every** one of the 30 system actions, a System Admin is allowed every one, editor-tier global content actions (categories/tags/templates/assets/fonts create, media upload, companies list) are retained, `users.create` requires System Admin, and the `require_system_admin` primitive gates correctly. Full PHPUnit suite green — **990 tests, 12146 assertions, 0 failures**.

#### A5b — per-campaign space-scoping (Done 2026-06-15) — closes F2

Added two primitives sharing `user_can_access_campaign_space()` (mirrors the space gate in `get_effective_campaign_level`): `require_campaign_space_access` (manage_wpsg **and** access to the campaign in the `id` param) and `require_campaign_batch_space_access` (manage_wpsg **and** access to *every* campaign in the `ids` param — any inaccessible id denies the whole batch). Flipped **7** MAP entries off `require_admin`: analytics campaign read + media-read, campaign audit, campaign export + export-binary → `require_campaign_space_access`; campaigns batch + batch export-binary → `require_campaign_batch_space_access`. `GET /spaces` now filters to the caller's accessible spaces (System Admins see all). Subscribers (no manage_wpsg) stay denied — these remain admin-tier endpoints.

This is the direct F2 fix: a `manage_wpsg` editor can no longer touch analytics/audit/export of, or batch-act on, campaigns in delegated spaces they were not granted.

**Proven.** New `tests/WPSG_P52A5b_Campaign_Space_Scoping_Test.php` (9 tests): open-mode editor allowed; **delegated-space editor without grant denied (403 — the F2 regression guard)**; delegated editor with grant allowed; `manage_options` escape hatch; subscriber-with-grant still denied (admin-tier); batch denied when any id is cross-space; batch allowed when all accessible; `GET /spaces` filtered for an editor and unfiltered for a System Admin. Full PHPUnit suite green — **999 tests, 12165 assertions, 0 failures**.

#### A5c — per-resource delete policy (Done 2026-06-15)

- **`fonts.delete` → `require_system_admin`** (admin-only) — MAP + frozen matrix updated in lockstep.
- **Layout-template delete in-use guard.** `delete_layout_template` now resolves the template (404 if missing), counts campaigns bound to it via `_wpsg_layout_binding_template_id` (`count_campaigns_using_layout_template`), and returns **409 `wpsg_template_in_use`** when > 0 unless `force=true` is passed.
- **Asset delete in-use guard.** Added `WPSG_DB::count_asset_associations($asset_id, 'asset')` (reverse lookup on the `wpsg_space_library` table). `delete_asset` returns **409 `wpsg_asset_in_use`** while the asset is associated with any space unless `force=true`. The `force` flag is the modal-confirm override (the modal itself is UX, not the control).

**Proven.** New `tests/WPSG_P52A5c_Delete_Policy_Test.php` (8 tests): `fonts.delete` denies an editor (403) and a System Admin passes the gate (404 on a missing id); layout-template delete is blocked (409) while a campaign binds it, `force=true` overrides, and an unused template deletes; asset delete is blocked (409) while associated with a space, `force=true` overrides, and an unassociated asset deletes. Full PHPUnit suite green — **1007 tests, 12184 assertions, 0 failures**.

**P52-A server-side enforcement (A1–A5) is complete.** F1 (provability) and F2 (delegated cross-space) are both closed, asserted by the frozen matrix + completeness/no-bypass test + per-tier suites. All P52-A acceptance criteria are met (matrix encoded + asserted; F1+F2 closed; role-rename migration; per-resource delete policy), so **the track is marked Done**.

**A6 (frontend UX) is deferred to PHASE53 (decided 2026-06-15).** It is UX-only — the boundary is fully enforced server-side (editors receive 403 regardless of UI) — and a cohesive frontend effort: the React app has no `manage_options` concept yet (only `isAdmin` = `manage_wpsg`, used across ~32 files) and the AdminPanel is ~960 lines across a large component tree. Scope for P53: surface a System-Admin tier to the app + gate system controls in the AdminPanel; template/asset delete-confirm modals (catch the A5c `409` → resend `force=true`). Any tier/permission-management UI belongs in the WordPress "Super Gallery" admin sidebar, not the React app. Planned as [PHASE53_REPORT.md](PHASE53_REPORT.md) › Track P53-A.

### Acceptance criteria

- A documented matrix of tier × surface, encoded in `WPSG_Permissions` and asserted by tests.
- F1 + F2 closed: editors/readers provably cannot load any wp-admin screen or call any system-admin REST endpoint; `wpsg_editor` cannot act cross-space in delegated mode.
- Role rename migration preserves access for existing `wpsg_admin` users; old role removed.
- Per-resource delete policy enforced (font delete admin-only; template/asset delete guarded).

### Validation

- New/extended PHPUnit role-enforcement tests (alongside `WPSG_P33C_Role_Enforcement_Test.php`), one assertion per `WPSG_Permissions` row.
- Migration test: a pre-existing `wpsg_admin` user is converted to `wpsg_editor` on upgrade with access intact.
- Manual QA: log in as each tier; confirm `wpsg_editor` sees no wp-admin gallery screen and is confined to accessible spaces.

### Rationale log

- **2026-06-15 — Tier model.** User clarified `wpsg_admin` is conceptually the *editor* (space-scoped app admin, **no** WordPress access); only `administrator` touches WP itself. Editors get campaign/display settings, not system ones (e.g. cache). Anchoring on `manage_options` vs `manage_wpsg` (rather than minting many new caps) keeps the change provable and within WP's native capability system.
- **2026-06-15 — Architecture.** Chose a centralized `WPSG_Permissions` action→requirement map over (a) scattered per-endpoint fixes (not exhaustively provable) and (b) a full GitHub-style custom-role engine (premature; large management surface — future-tasked). The map captures the granularity the user wanted today (per-resource delete policy) while making a future engine additive.
- **2026-06-15 — Delivery.** Staged A1–A6 with checkpoints; A6 (frontend) is the candidate to defer to PHASE53 since server-side enforcement is the security-critical part.

## Track P52-B - Asset Management (global, non-campaign assets)

### Problem

Admins need an intuitive place to add/delete the plugin's **global asset images** (the overlay/graphic-layer library, and optionally fonts) — both in the WP sidebar and in the app's Admin Panel. Today there is no dedicated management surface; assets are created incidentally via uploaders.

Existing infrastructure to reuse (no new storage):
- `includes/class-wpsg-asset-library.php` — `get_all()`, `add()`, `set_universal()`, `set_tags()`, `remove()`, `handle_upload()`; custom table `{prefix}wpsg_assets`.
- `includes/class-wpsg-font-library.php` — parallel pattern for fonts (optional second tab).
- Admin permission gate `require_admin()` (`manage_wpsg`).

### Fix

Build asset CRUD once and surface it in two hosts, the **same way** in both:

1. **WP admin** — a new submenu under the renamed "SuperGallery" menu (P51-G), rendering the asset manager.
2. **App Admin Panel** — mirror the *exact same* management UX so assets can be managed in either place identically.

**Open decision — Admin Panel host shape (call out and resolve when scoping this track):** the user wants non-campaign asset management to mirror cleanly into the Admin Panel. Two candidate shapes:
- **(i) A new dedicated Admin Panel tab** for non-campaign / global assets, sitting beside the existing tabs.
- **(ii) Subtabs inside the existing Media tab** — split it into "Campaign" (existing media management) and "Non-campaign / Global" (the new asset management).

Choose the option that makes the WP-admin and Admin-Panel experiences easiest to keep identical. Prefer extracting the asset-manager UI into a shared component consumed by both hosts (and by whichever Admin Panel shape wins) so the two surfaces cannot drift. Reference the existing Media tab (`src/components/Admin/MediaTab.tsx`, lazy-loaded in `AdminPanel.tsx`) for the campaign-media pattern to mirror. Add a REST controller extending `WPSG_REST_Base` only if endpoints beyond the existing library routes are needed.

### Acceptance criteria

- Admins can add and delete global assets from the WP sidebar **and** the app Admin Panel, with the same controls and behavior in both.
- The asset-management UI is a single shared component (no duplicated implementation between hosts).
- The Admin Panel host shape (new tab vs. Media subtabs) is decided and documented in this track before implementation.
- Non-admins cannot reach the asset-management surface or its endpoints.

### Validation

- Component/integration tests for the shared asset manager.
- Manual QA: add/delete an asset in WP admin, confirm it appears/disappears in the Admin Panel view and vice versa.

### Implementation notes (Done 2026-06-17)

**Host shape decision.** New dedicated **"Assets" tab** in the Admin Panel (Option i), not subtabs inside Media. Global assets are orthogonal to campaign-scoped media — a dedicated tab maps 1:1 to the WP admin sidebar page and keeps the surfaces easy to reason about.

**Shared component — no duplication.** `GlobalAssetManager` (`src/components/Admin/GlobalAssetManager.tsx`) is the single implementation used by both surfaces. It uses the existing `useAssetLibrary` query hook (from `layoutTemplateQuery.ts`) for reading, `AssetUploader` for the upload UI, and `DesignAssetsGrid` for the asset grid. Both consumers (`GlobalAssetTab` for the Admin Panel, `GlobalAssetAdminApp` for WP admin) are thin wrappers over this one component.

**No new PHP infrastructure needed.** All four REST routes (`GET/POST /admin/asset-library`, `POST/DELETE /admin/asset-library/{id}`) and the `WPSG_Asset_Library` PHP class already existed. The `WPSG_Permissions` MAP entries (`assets.list/upload/update/delete` → `require_admin`) were already correct from P52-A.

**New files:**
- `src/services/api/assetsApi.ts` — `AssetsApi` class wrapping the four REST endpoints (list, upload via `postForm`, update via `post`, delete with optional `?force=true`)
- `src/services/adminQuery.ts` — added `useUploadGlobalAsset`, `useUpdateGlobalAsset`, `useDeleteGlobalAsset` mutation hooks; re-exports `ASSET_IN_USE_CODE`
- `src/components/Admin/GlobalAssetManager.tsx` — shared CRUD UI; handles the P52-A5c in-use 409 guard with a two-step confirm flow (first confirm → if 409, `forceDelete` state → `ConfirmModal` with force=true)
- `src/components/Admin/GlobalAssetTab.tsx` — lazy-loaded Admin Panel tab wrapper
- `src/components/Admin/GlobalAssetAdminApp.tsx` — WP admin mount (mirrors `SpacesAdminApp.tsx`)
- `includes/class-wpsg-asset-admin-renderer.php` — WP admin submenu renderer (`manage_options` cap, `#wpsg-assets-admin` div)
- `tests/WPSG_P52B_Asset_Admin_Renderer_Test.php` — 3 assertions: submenu requires `manage_options`, `render_page()` outputs the mount div, editor lacks the capability
- `src/components/Admin/GlobalAssetManager.test.tsx` — 5 tests: empty state, grid renders, delete+confirm, 409 escalation to force-confirm, upload

**Modified files:**
- `src/main.tsx` — added `#wpsg-assets-admin` detection branch (after `#wpsg-spaces-admin`, before `#root`)
- `src/components/Admin/AdminPanel.tsx` — added `GlobalAssetTab` lazy import, "Assets" tab in desktop Tabs.List and mobile Select, `Tabs.Panel value="assets"` with Suspense
- `wp-plugin/wp-super-gallery/wp-super-gallery.php` — `require_once` the new renderer; `WPSG_Asset_Admin_Renderer::init()` in the `is_admin()` block

**Permissions summary:**
| Surface | Gate |
|---------|------|
| WP admin "Asset Library" submenu | `manage_options` (System Admin only) |
| Admin Panel "Assets" tab | no extra gate — REST gates apply automatically |
| All `/admin/asset-library` REST routes | `require_admin` (`manage_wpsg`) — editor + admin |

**Validation.** 2377 vitest tests pass (5 new for GlobalAssetManager). 1037 PHPUnit tests pass, 2 pre-existing skips (3 new for renderer).

## Track P52-C - Campaign tags/categories overhaul

### Problem

Tags and categories are not first-class in the campaign listing or creation flow. The listing table (`src/components/Admin/CampaignsTab.tsx`, cols ~lines 88–93: Title/Status/Visibility/Company/Grants/Actions) shows neither. In the create/edit modal (`src/components/Campaign/UnifiedCampaignModal.tsx`), tags are a comma-separated text input (~lines 288–294) and categories a `MultiSelect` (~lines 295–304) — inconsistent and clumsy for many values. The user also wants the "Add Campaign" action surfaced as a clear button opening the modal.

Data + endpoints already exist (`src/services/api/campaignsApi.ts`): tags `GET/POST/DELETE /v1/tags/campaign` (`TagEntry`), categories `GET/POST/PUT/DELETE /v1/campaign-categories` (`CampaignCategoryEntry`, hierarchical); hooks `useCampaignTags` / `useCampaignCategories` (`src/services/adminQuery.ts`).

### Fix

- **Listing:** add Tags and Categories columns to `CampaignsTab.tsx` / `useCampaignsRows.tsx`, rendered as wrapping badge lists that handle many values gracefully.
- **Add Campaign:** surface a clear "Add Campaign" button that opens the existing `UnifiedCampaignModal` (`useUnifiedCampaignModal`).
- **Creation entry:** replace the comma-separated tag input with a multi-select searchable entry that shows selected items as removable badges (name + ×); align the categories control to the same removable-badge display.
- **`SearchableEntityInput` multi-select:** `src/components/Common/SearchableEntityInput.tsx` is single-select today (`onOptionSubmit(value)`, single clear). Extend it to support multiple selections as removable Mantine `Pill`/`Badge` chips, **or** add a thin `MultiEntityInput` wrapper over Mantine `Combobox` to avoid breaking existing single-select callers (`AccessTab.tsx`, `CompanyCombobox.tsx`).

### Acceptance criteria

- Campaign listing shows tags and categories per row, wrapping cleanly for many values.
- "Add Campaign" is a visible button that opens the campaign modal.
- During creation/edit, tags and categories are each added via search, displayed as badges with an obvious × to remove, and persisted via the existing endpoints.
- Existing single-select `SearchableEntityInput` callers are unaffected.

### Validation

- Component tests for the multi-select input (add/remove badges) and the listing columns.
- Manual QA: create a campaign with several tags and categories; confirm they persist and render in the listing.

### Implementation notes (Done 2026-06-17)

**Tags type change.** `UnifiedCampaignFormState.tags` changed from `string` (comma-separated) to `string[]`, consistent with `categories: string[]`. Four touch points in `src/hooks/useUnifiedCampaignModal.ts`: type declaration, `emptyForm` initializer, `openForEdit` load path (`.join(', ')` removed), and the save path (`.split(',').map(trim).filter(Boolean)` simplified to direct pass-through).

**TagsInput.** `TextInput` for tags in `UnifiedCampaignSettingsPanel` (`src/components/Campaign/UnifiedCampaignModal.tsx`) replaced with Mantine `TagsInput`. Existing tags from `useCampaignTags` (already called in `AdminPanel`) are passed as the `data` autocomplete list via a new `tagItems: TagEntry[]` prop threaded from `UnifiedCampaignModal` → `UnifiedCampaignSettingsPanel`. `TagsInput` shows selected tags as removable pill chips, supports freeform creation (type + Enter or comma), and is visually consistent with the `MultiSelect` already used for categories. No new wrapper component was needed (`SearchableEntityInput` single-select callers untouched).

**Listing columns.** `src/hooks/useCampaignsRows.tsx` adds a `categoryItems?: CampaignCategoryEntry[]` option, builds a `Map<id, name>` lookup inside `useMemo`, and inserts two new `<Table.Td>` cells per row — Tags (light variant badges, tag names from `AdminCampaign.tags`) and Categories (outline variant badges, ID→name resolved via the map, falling back to the raw ID). Empty arrays render `—`. `src/components/Admin/CampaignsTab.tsx` adds the matching `Tags` and `Categories` `<Table.Th>` headers and two placeholder skeleton cells in `CampaignSkeletonRows`.

**Add Campaign toolbar.** `CampaignsTab` gains a `onAddCampaign?: () => void` prop. When provided, a `Button` ("Add Campaign", `IconPlus`) renders above the scroll container. `AdminPanel` passes `isAllSpaces ? undefined : campaignActions.handleCreate` — the button is absent in the "all spaces" aggregated view, matching the existing header button's `disabled={isAllSpaces}` behavior.

**AdminPanel wiring.** Three additions: `categoryItems={campaignCategories}` to `useCampaignsRows`, `tagItems={campaignTags}` to `<UnifiedCampaignModal>`, and `onAddCampaign={...}` to `<CampaignsTab>`. Both `campaignCategories` and `campaignTags` were already fetched at lines 174–175.

**Tests.** New `src/components/Admin/CampaignsTab.test.tsx` (6 tests): Tags/Categories column headers, all expected headers, Add Campaign button present/absent, click fires callback, campaign rows render. `UnifiedCampaignModal.test.tsx` gains 3 P52-C tests: pills render for initial tags, TagsInput onChange fires updateForm, empty-state placeholder. Existing tests updated: `tags: 'tag1, tag2'` → `tags: ['tag1', 'tag2']` in `makeMockModal` (8 occurrences); `defaultFormState.tags: ''` → `tags: [] as string[]` in `LayoutBuilderGallery.test.tsx`; removed stale `fireEvent.change(getByPlaceholderText('tag1, tag2, tag3'))` in `AdminPanel.test.tsx`. Full suite green — **2386 tests, 0 failures**.

## Track P52-D - Service Worker offline app-shell

### Problem

Promoted from `docs/FUTURE_TASKS.md` (Build & Bundle; P50-F follow-on). Going offline and reloading produces `ERR_INTERNET_DISCONNECTED` because the SW intentionally skips navigation/HTML caching (`request.mode === 'navigate'` bail in `public/sw.js`) to avoid stale-chunk failures after deploys. The metadata SWR cache (`wpsg-meta-v1`) survives offline but has no page to serve into.

### Fix

- A **versioned app-shell cache** for the gallery entry-point HTML, tied to the deployed bundle (version hash injected at build time, or `workbox-window` + `injectManifest`).
- **Deploy-time cache busting** so the shell is invalidated on every deploy and imports the correct Vite chunk URLs.
- An **offline fallback** — a minimal branded page when the shell is absent/too stale, instead of the browser error screen.

Open questions (carried from FUTURE_TASKS): (Q1) how the deploy version reaches the SW — build-time hash injection vs. a `/__wpsg_version` PHP endpoint vs. `workbox-window` + `injectManifest`; (Q2) whether the SW must handle multiple WP page URLs embedding the shortcode or only the site root; (Q3) static offline HTML string in the SW vs. a separately cached `offline.html`.

### Acceptance criteria

- Reloading offline serves a working app shell (or a branded offline fallback), not the browser error page.
- A new deploy invalidates the stale shell without manual site-data clearing.

### Validation

- Manual QA in DevTools offline mode: reload and confirm the shell/fallback renders; deploy a new bundle and confirm the shell updates.

### Implementation notes (Done 2026-06-17)

**Open question resolutions:**
- **Q1 — version signal:** Vite `closeBundle` plugin (`wpsg-sw-hash-inject` in `vite.config.ts`, `enforce: 'post'`) reads `.vite/manifest.json` after the bundle is fully written, computes an 8-char SHA-256 hash of its contents, and replaces the `__WPSG_BUILD_HASH__` placeholder in `dist/sw.js`. Every deploy produces a changed SW file; the browser detects the new SW, installs/activates it, and the existing `activate` cleanup sweeps the old `wpsg-shell-*` cache automatically.
- **Q2 — which URLs to cache:** All successful same-origin navigation responses (`mode === 'navigate'`), keyed by exact URL. This handles multiple WP pages with the shortcode without enumerating them in advance. On a miss, the branded offline fallback is served.
- **Q3 — offline HTML:** Inline `OFFLINE_HTML` constant at the top of `sw.js`. No extra file, no cache entry.

**`public/sw.js` changes:**
- Added `BUILD_HASH`, `SHELL_CACHE`, and `OFFLINE_HTML` constants.
- The `fetch` handler is restructured: `url`, origin, `wp-login`, and `wp-admin` checks are now computed *before* the navigate branch (they previously lived after the early-return that we removed). `wp-admin` navigations still pass through to the network unmodified.
- New `handleNavigationRequest(request)` function: tries the network first; on `response.ok`, fire-and-forgets a `SHELL_CACHE.put`; on network failure, tries the exact-URL cache hit, then falls back to `OFFLINE_HTML`.
- `activate` handler updated to also preserve `SHELL_CACHE` (the old `filter` only preserved `RUNTIME_CACHE` and `META_CACHE`).

**`vite.config.ts` changes:**
- Added `node:fs`, `node:path`, `node:crypto` imports.
- Added `wpsg-sw-hash-inject` plugin (`apply: 'build'`, `enforce: 'post'`) — pure post-build step, never runs in dev or vitest.

**No PHP changes.** `maybe_serve_service_worker()` already serves `assets/sw.js` with `no-cache` headers; `copy-wp-assets.js` copies the already-injected `dist/sw.js` to `assets/sw.js` as part of `build:wp`.

**Validation.** Build confirmed: `dist/sw.js` contains `BUILD_HASH = '3e613417'` (placeholder fully replaced, zero occurrences of `__WPSG_BUILD_HASH__`). Full vitest suite green — **2386 tests, 0 failures**.

### Rationale log

- **2026-06-17 — Version signal.** Build-time hash injection via a Vite `closeBundle` plugin chosen over (a) a `/__wpsg_version` PHP endpoint (requires network to detect deploy — defeats offline purpose) and (b) Workbox `injectManifest` (adds a large dependency and changes the SW architecture). Hashing the full manifest content is deterministic and changes on every deploy.
- **2026-06-17 — Network-first strategy.** Shell caching uses network-first (not cache-first) so the user always gets the freshest WP page when online. Only network failure falls through to the cache. This avoids serving a cached shell that references old chunk URLs that may no longer exist after a deploy.
- **2026-06-17 — wp-admin pass-through.** wp-admin navigations are excluded from the shell cache and offline fallback — admins seeing a browser error while offline is correct behavior; serving a gallery offline page on wp-admin would be confusing.

## Track P52-E - vitest CRITICAL spec fix

### Problem

`package.json` has `"vitest": "^2.1.8"` (and `"@vitest/coverage-v8": "^2.1.8"`). The `^2.1.8` range resolves to **vitest 2.1.9** on a fresh install — no 2.x release fixes GHSA-5xrq-8626-4rwp; the fix required a new major line at **3.2.6**. This leaves the CRITICAL alert open regardless of the lock file state.

| Alert | Advisory | Impact | Fix |
|-------|----------|--------|-----|
| #42 CRITICAL | GHSA-5xrq-8626-4rwp — arbitrary file read/execute when Vitest UI server is listening | Dev environment; exploitable on Windows or when `--api.host` is set | vitest ≥ 3.2.6 |

Note: the lock file currently has vitest **4.1.9** (from a previous spec of `>=3.2.6` that was reverted). The spec should match the lock file, not the other way around.

### Fix

Two line changes in `package.json`:
```json
"vitest": "^4.0.0",
"@vitest/coverage-v8": "^4.0.0"
```
`coverage-v8` must match the vitest major; mismatched majors cause runtime errors.

After the spec change, run `npm install` (lock file already has 4.1.9 so this is a no-op for vitest itself — npm will confirm compatibility and leave the version as-is).

Verify tests still pass: `npm test`. The project was previously running at 4.1.9, so no test regressions are expected.

### Acceptance criteria

- `package.json` shows `"vitest": "^4.0.0"` and `"@vitest/coverage-v8": "^4.0.0"`.
- Dependabot alert #42 resolves (auto-dismissed after lock file reflects ≥ 3.2.6).
- `npm test` green.

### Validation

- `npm ls vitest` shows ≥ 3.2.6.
- CI passes.

---

## Track P52-F - esbuild HIGH override

### Problem

esbuild is pulled in transitively by vite (`"esbuild": "^0.25.0"`) and storybook (`"esbuild": "^0.18.0 || … || ^0.27.0"`). npm resolves to **esbuild 0.25.x** (satisfies both constraints simultaneously), but the fix for GHSA-gv7w-rqvm-qjhr requires **≥ 0.28.1**. Neither vite 6.x nor storybook 10.x currently requires a version that high, so this cannot resolve without an override.

| Alert | Advisory | Impact | Fix |
|-------|----------|--------|-----|
| #43 HIGH | GHSA-gv7w-rqvm-qjhr — missing binary integrity check; RCE if `NPM_CONFIG_REGISTRY` is redirected during install | Build-time / CI; not a runtime risk | esbuild ≥ 0.28.1 |

Note: alert #1 (MEDIUM, GHSA-67mh-4wv8-2f99, affected ≤ 0.24.2) is already resolved by 0.25.x — it will auto-dismiss once Dependabot re-evaluates after the lock file is regenerated in P52-G.

### Fix

Add an `overrides` block to `package.json`:
```json
"overrides": {
  "esbuild": ">=0.28.1"
}
```

Then run `npm install` and smoke-test both `npm run build` and `npm run storybook`. The current latest esbuild is **0.28.1** (exactly the fix version). Remove the override once vite and/or storybook upstream their esbuild requirements past 0.28.1.

### Acceptance criteria

- Dependabot alert #43 resolves.
- `npm run build`, `npm test`, and `npm run storybook` remain green.

### Validation

- `npm ls esbuild` shows ≥ 0.28.1.
- CI green.

---

## Track P52-G - Lock file regeneration + stale alert closure

### Problem

The `package-lock.json` is in an inconsistent state (vitest 4.1.9 in the lock vs `^2.1.8` in the package.json spec, along with stale versions of several other packages). After P52-E and P52-F land, a fresh lock file regeneration is needed to pull all package versions to their correct fresh-install resolutions and allow Dependabot to auto-dismiss the remaining open alerts.

**Packages that resolve correctly under the current specs (no package.json change needed):**

| Package | Lock file (stale) | Fresh install → | Advisory fix | Alerts closed |
|---------|-------------------|----------------|-------------|---------------|
| dompurify | 3.3.3 | **3.4.10** | > 3.3.3 | #29, #31, #32, #33 |
| fast-uri | 3.1.0 | **3.1.2** (via `ajv@8.18.0 → "fast-uri": "^3.0.1"`) | ≥ 3.1.2 | #35, #36 |
| postcss | 8.5.9 | **8.5.15** (via `vite → "postcss": "^8.5.3"`) | ≥ 8.5.10 | #34 |
| vite | 6.4.2 | **6.4.3** | ≥ 6.4.2 | #28 |

**Stale alert to manually dismiss (already fixed, no further action needed):**

| Alert | Why it is already fixed |
|-------|------------------------|
| #1 esbuild MEDIUM (GHSA-67mh-4wv8-2f99) | Affected ≤ 0.24.2; fresh install gives 0.25.x or 0.28.1+ after P52-F override |

Note: `brace-expansion` (#37) and `ws` (#38) are already **auto-dismissed** by Dependabot.

### Fix

1. After P52-E and P52-F changes to `package.json` are confirmed, delete `package-lock.json` and run:
   ```bash
   npm install
   ```
   This produces a clean lock file with all packages at their correct latest-within-spec versions.
2. Run `npm test` and `npm run build` to confirm nothing regressed.
3. Commit both `package.json` (with vitest spec + esbuild override) and the regenerated `package-lock.json`.
4. Manually dismiss alert #1 via the GitHub Security tab (comment: "esbuild MEDIUM GHSA-67mh-4wv8-2f99 affected ≤ 0.24.2; we ship 0.25.x/0.28.1+ which exceeds the fix threshold").

### Acceptance criteria

- `package-lock.json` reflects: dompurify ≥ 3.4.0, fast-uri ≥ 3.1.2, postcss ≥ 8.5.10, vite ≥ 6.4.2, vitest ≥ 3.2.6, esbuild ≥ 0.28.1.
- All 11 originally open Dependabot alerts are in `fixed` or `dismissed` state.
- `npm test` and `npm run build` green.

### Validation

```bash
gh api repos/rafprojects/campaignViewerWP/dependabot/alerts --paginate \
  | python3 -c "import json,sys; open_=[a for a in json.load(sys.stdin) if a['state']=='open']; print('open:', len(open_), [a['number'] for a in open_])"
```
Should print `open: 0 []`.

---

## Follow-On Candidates

`docs/FUTURE_TASKS.md` items evaluated and intentionally left deferred:

| Candidate | Why it is deferred |
|-----------|--------------------|
| JWT in-memory token auth + frontend silent refresh | Blocked on the standalone-SPA scenario and the CORS allow-list; no value for the primary same-origin shortcode deployment. |
| CORS origin allow-list & admin UI | Same — meaningful only for standalone cross-origin SPA deployments. |
| Third-party OAuth providers | High effort, unresolved design questions (popup vs. redirect when embedded), priority unclear. |
| GraphQL API alternative | High effort, ROI unproven without a concrete external-integrator use case. |
| Settings panel animation variants | Low-impact polish; fold in opportunistically. |
| SettingsPanel space-badge dark-mode parity | Cosmetic; badge is already nearly correct. |
| Timeline / variable-aspect-ratio grid adapters | Net-new adapters, no current demand; revisit after P51-E stabilizes the adapter geometry helper. |
| Campaign binary export streaming (>100 MB) | Low impact; current 100 MB ceiling covers most campaigns. |

## Implementation Notes

### P52-E — vitest CRITICAL spec fix (Done 2026-06-15)

Bumped `"vitest"` and `"@vitest/coverage-v8"` in `package.json` from `"^2.1.8"` to `"^4.0.0"`, resolving GHSA-5xrq-8626-4rwp (CRITICAL). The lock file already had vitest 4.1.9; the spec change aligns it.

**Vitest 4 migration side-effect:** upgrading from the stale `^2.1.8` spec caused test failures because Vitest 4 enforces that mock implementations used as constructors must be regular functions (not arrow functions). Fixed 6 test files:
- `packages/shared-utils/src/useXhrUpload.test.ts` — `XMLHttpRequest` constructor mock
- `packages/shared-utils/src/maskFeather.test.ts` — `Image` constructor mock
- `src/components/Galleries/Adapters/__tests__/adapters.test.tsx` — `ResizeObserver` constructor mock
- `src/components/Galleries/Adapters/isotope/IsotopeAdapter.test.tsx` — same
- `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.test.tsx` — same (3 instances)
- `src/components/Admin/CampaignImportModal.test.tsx` — `FileReader` constructor mock

Also migrated `vite.config.ts` test config: `poolOptions.forks.{minForks,maxForks}` → top-level `minForks`/`maxForks` per Vitest 4 pool rework.

All 2361 tests pass after the fixes.

### P52-F — esbuild HIGH override (Done 2026-06-15)

Added `"overrides": { "esbuild": ">=0.28.1" }` to `package.json`, resolving GHSA-gv7w-rqvm-qjhr (HIGH). Fresh install resolves esbuild to 0.28.1. Build and tests confirmed green.

### P52-G — Lock file regeneration (Done 2026-06-15)

Deleted stale `package-lock.json` and ran `npm install`. Fresh lock file resolves:
- dompurify → 3.4.10 (was 3.3.3) — closes #29, #31, #32, #33
- fast-uri → 3.1.2 (was 3.1.0) — closes #35, #36
- postcss → 8.5.15 (was 8.5.9) — closes #34
- vite → 6.4.3 (was 6.4.2) — closes #28
- vitest/esbuild as above

`npm install` reported `found 0 vulnerabilities`. Alert #1 (esbuild MEDIUM, GHSA-67mh-4wv8-2f99, affected ≤ 0.24.2) should be manually dismissed via GitHub Security tab as we now ship 0.28.1+.

## Outcome

_Pending — phase in planning._
