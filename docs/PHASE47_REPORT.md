# Phase 47 - Gallery Spaces (Multi-Instance Isolation)

**Status:** In Progress
**Created:** 2026-06-07
**Last updated:** 2026-06-07

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P47-A | Data foundation — `wp_wpsg_spaces` table, `space_id` columns, migration/backfill (ships dark) | **Done** | Large |
| P47-B | Resolution + enforcement core — space-aware permission choke points, dual isolation mode | **Done** | Large |
| P47-C | Space CRUD + access REST — `/spaces` endpoints, space grants, cache-key threading | Planned | Medium |
| P47-D | Settings inheritance — per-space overrides over global defaults | Planned | Medium |
| P47-E | Shortcode + bootstrap — `space` attribute, effective settings, per-instance config | Planned | Medium |
| P47-F | Admin UX — space switcher, "All spaces" mode, space-management modal | Planned | Large |
| P47-G | Migration hardening + libraries + uninstall | Planned | Medium |
| P47-H | Tests + docs | Planned | Medium |

---

## Rationale

1. The plugin currently behaves as **one global gallery per WordPress site**. The shortcode only filters the *public* display by `campaign`/`company`; the AdminPanel, custom tables, and settings are all site-wide. There is no grouping key above `campaign`, so a site cannot host multiple distinct galleries without their campaigns, media, metrics, logs, and access bleeding together.
2. The work belongs in one phase because true isolation requires a single scoping key (`space_id`) threaded coherently through the data model, every REST read/write, the permission layer, the shortcode, the settings resolution, and the admin UI. Splitting it across unrelated phases would leave the boundary leaky.
3. Success: an admin can create multiple **Gallery Spaces** on one site; each space's campaigns/media/metrics/logs/settings are isolated and server-enforced; shared site admins manage all spaces from one AdminPanel via a switcher; a space can optionally be flipped to **delegated** mode for true tenant delegation; and existing sites upgrade with zero data loss and zero shortcode changes.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Isolation unit | A new top-level **Gallery Space** container above campaigns. **Companies stay** as an optional sub-grouping *inside* a space. (User decision.) |
| B | Isolation strictness | **"Strict data, admins see all" by default**, plus a **per-space toggle** to `delegated` mode. Delegated = only explicit space grantees, with a `manage_options` super-admin escape hatch. Data isolation is server-enforced. (User decision.) |
| C | Settings & branding scope | **Per-space, inheriting global defaults** — override wins, unset falls back to `wpsg_settings`. (User decision.) |
| D | Admin UX | **One AdminPanel** with a space switcher + **"All spaces"** overview; all 8 tabs filter to the selected space. (User decision.) |
| E | Space storage | **Custom table `wp_wpsg_spaces`**, not a CPT — spaces are few, need fast joins against denormalized `space_id` columns, and carry a large JSON `settings_overrides` blob. The existing DB migration harness absorbs one more table cleanly. |
| F | Scoping mechanism | Campaign→space via post meta `_wpsg_space_id` (server-derived), **plus** a denormalized `space_id` column on each campaign-scoped custom table for query performance. Company→space via term meta `_wpsg_space_id`. |
| G | Enforcement location | At the **existing resolution choke points** (`get_effective_campaign_level`, `can_view_campaign`, `get_accessible_campaign_ids`), not per-controller — one insertion each makes all existing reads space-aware. |
| H | Backward compatibility | Seed a **Default Space**; backfill all existing data into it; resolve old `[super-gallery campaign=… company=…]` shortcodes to their resolved space (Default when unspecified). No markup or data changes required of existing sites. |
| I | Shared-vs-per-space libraries | Overlays, fonts, layout templates, and taxonomies stay **global/shared**; only **companies** become per-space. Heavy assets and design primitives are shared; organizational/ownership units are scoped. |

## Execution Priority

1. **P47-A** — Schema + migration. The irreversible/risky piece; ships behind the Default-Space no-op so everything that follows is additive.
2. **P47-B** — Enforcement core. Depends on A. Behavior unchanged with only the Default Space present, but isolation becomes airtight.
3. **P47-C** — Space CRUD + access REST. Depends on A, B. First point where multiple spaces become usable via the API.
4. **P47-D** — Settings inheritance. Depends on A, C.
5. **P47-E** — Shortcode + bootstrap. Depends on D (effective settings). Back-compat preserved throughout.
6. **P47-F** — Admin UX. Depends on C, D.
7. **P47-G** — Migration hardening + libraries + uninstall. Depends on A; can land alongside F.
8. **P47-H** — Tests + docs. Continuous; gates the phase.

---

## Track P47-A — Data Foundation (ships dark)

### Problem

There is no grouping key above `campaign`. The four campaign-scoped custom tables (`wpsg_analytics_events`, `wpsg_audit_log`, `wpsg_media_refs`, `wpsg_access_requests`) are keyed only by `campaign_id`, and campaigns have no space association.

### Fix

- Add `maybe_create_spaces_table()` creating `wp_wpsg_spaces`: `id`, `slug` (UNIQUE), `name`, `isolation_mode` (`open`|`delegated`, default `open`), `access_grants` (LONGTEXT JSON, same shape as campaign grants), `settings_overrides` (LONGTEXT JSON, sparse snake_case), `archived`, `created_at`, `updated_at`. Add DB helpers paralleling the access-request helpers (`get_space`, `get_space_by_slug`, `list_spaces`, `insert_space`, `update_space`, `archive_space`, `delete_space`).
- Denormalize `space_id BIGINT UNSIGNED NOT NULL DEFAULT 0` (+ `KEY space_id`, and composite `(space_id, occurred_at)` / `(space_id, created_at)` where time-queried) onto the four campaign-scoped tables. **Not** `wpsg_overlays` (stays global).
- Register post meta `_wpsg_space_id` (int, `show_in_rest=false`, sanitized to a positive int referencing an existing space) in `WPSG_CPT::register()`; register term meta `_wpsg_space_id` on `wpsg_company`.
- Migration follows the existing harness exactly: bump `DB_VERSION` `'10'` → `'11'`; in `maybe_upgrade()` call `maybe_create_spaces_table()` → `maybe_add_space_columns()` → `maybe_backfill_space_ids()`. `maybe_add_space_columns()` reuses the idempotent `INFORMATION_SCHEMA.COLUMNS` guard from `maybe_upgrade_audit_log_v9()`; `maybe_backfill_space_ids()` is offset-resumable and option-guarded like `backfill_media_refs()`.

**Files:** `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php`, `wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php`

### Acceptance criteria

- Fresh install and upgrade both converge on identical schema (each `maybe_create_*` CREATE TABLE string includes `space_id`).
- A Default Space row exists after upgrade; its id is stored in `wpsg_default_space_id`.
- After backfill, every campaign post and `wpsg_company` term has `_wpsg_space_id`, and no campaign-scoped table row retains `space_id = 0` (audit `campaign_id = 0` system rows excepted).
- Running the upgrade twice is a no-op (idempotent column-add guard).
- No behavior change visible to users — everything resolves to the Default Space.

### Validation

- PHP: schema + idempotency + resumable-backfill tests (interrupt mid-batch, re-run).
- Manual: upgrade a populated dev DB; confirm campaign/analytics/audit counts unchanged and all stamped to Default.

### Implementation Notes

- `DB_VERSION` bumped `'10'` → `'11'` in `class-wpsg-db.php`.
- `maybe_upgrade()` calls four new v11 methods before `update_option`: `maybe_create_spaces_table()`, `maybe_upgrade_v11_space_columns()`, `maybe_seed_default_space()`, `maybe_backfill_spaces()`.
- `wp_wpsg_spaces` table created via `dbDelta()`: id, slug (UNIQUE), name, isolation_mode (default `'open'`), access_grants LONGTEXT, settings_overrides LONGTEXT, archived, created_at, updated_at.
- `space_id` column added idempotently to all four campaign-scoped tables using the same `INFORMATION_SCHEMA.COLUMNS` guard as `maybe_upgrade_audit_log_v9()`.
- Default Space seeded once (guarded by `wpsg_default_space_id` option); id stored in that option.
- Campaign backfill is offset-resumable via `wpsg_spaces_backfill_offset`; company (term) backfill runs as a final step when the campaign batch completes; completion flagged in `wpsg_spaces_backfill_complete`.
- Public DB helpers added: `get_spaces_table()`, `get_space()` (with request-level static cache to avoid repeated queries in permission loops), `list_spaces()`, `insert_space()`, `update_space()`, `archive_space()`, `delete_space()`.
- `_wpsg_space_id` post meta registered on `wpsg_campaign`; `_wpsg_space_id` term meta registered on `wpsg_company` (both `show_in_rest=false`).

---

## Track P47-B — Resolution + Enforcement Core

### Problem

Permission resolution (`get_effective_campaign_level`, `can_view_campaign`, `get_accessible_campaign_ids`) and the capability checks (`require_admin`, `rate_limit_authenticated`) are entirely space-unaware; `manage_wpsg` admins see everything. There is no concept of space-level access or a delegated boundary.

### Fix

- Add `get_effective_space_level($user_id, $space_id)` modeled on `get_effective_campaign_level()`: `manage_options` → `owner` (escape hatch); else space `access_grants` via the existing `validate_access_level()` + expiry check; else `''`.
- Add `can_access_space($space_id, $user_id)`: `archived` → `manage_options` only; `open` → `manage_wpsg` sees it; `delegated` → only `manage_options` OR an explicit space grantee (a `manage_wpsg`-only admin is denied).
- Insert the gate at the existing choke points: `get_effective_campaign_level()` returns `''` if `!can_access_space(space_of($campaign))`; `can_view_campaign()`'s `manage_wpsg || manage_options` early-return must first pass `can_access_space()`; `get_accessible_campaign_ids()` auto-filters via the guard (add `space` to its transient key).
- Relax `rate_limit_authenticated()` to `manage_wpsg OR space-grant` so delegated-space editors are not rate-limit-locked out.

**File:** `wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php`

### Acceptance criteria

- A request scoped to space A cannot read/return space B campaigns, media, analytics, audit, or access (403/empty).
- `open` mode: `manage_wpsg` sees all spaces (default "admins see all" preserved).
- `delegated` mode: `manage_wpsg`-only user denied; `manage_options` always admitted; explicit grantee gets exactly the granted level; grant expiry honored.
- With only the Default Space present, all existing permission behavior is unchanged.

### Validation

- PHP: extend the `WPSG_P33C` role-enforcement and `WPSG_P28B` access-expiry test patterns for spaces.
- Manual: create a second space, grant an editor, flip to delegated, confirm a different admin loses access while the site owner retains it.

### Implementation Notes

- `get_effective_space_level(int $user_id, int $space_id): string` added to `class-wpsg-rest-base.php`. `manage_options` → `'owner'` (super-admin escape hatch always); open-mode `manage_wpsg` → `'owner'`; else explicit space `access_grants` JSON entry (same `validate_access_level()` + expiry pattern as campaign grants); else `''`.
- `can_access_space(int $space_id, ?int $user_id): bool` added: archived space → `false`; else delegates to `get_effective_space_level()`.
- Space gate inserted at the top of `get_effective_campaign_level()` (before the `manage_wpsg` short-circuit) — delegated spaces can deny ungranted site admins.
- Space gate inserted at the top of `can_view_campaign()` (before the `manage_wpsg || manage_options` short-circuit) — same rationale.
- Deviations from spec: `get_accessible_campaign_ids()` cache-key scoping deferred to P47-C (safe while only one space exists); `rate_limit_authenticated()` relaxation deferred to P47-C (requires space-scoped endpoints to be safe to expose).

---

## Track P47-C — Space CRUD + Access REST

### Problem

There is no API to create, edit, archive, or grant access to spaces, and existing list endpoints cannot filter by space.

### Fix

- New controller `includes/rest/class-wpsg-space-controller.php` (registered in `class-wpsg-rest.php`): `GET/POST /spaces`; `GET/PUT/DELETE /spaces/{id}` (DELETE refuses while the space has campaigns unless `force`); `GET/PUT/DELETE /spaces/{id}/access` (clone the company-access handlers, swapping term meta for the row's `access_grants` JSON; new audit actions `space.access.granted`/`revoked`).
- Add `require_space_member()` / `require_space_owner()` permission callbacks reading the `space` param.
- Existing list endpoints (`list_campaigns`, `list_companies`, audit lists, analytics summary, access-summary) accept a `space` query param (numeric id or `all`); omitted → Default Space; `all` → union of `get_user_space_ids()`.
- Cache keys: add `space` to `wpsg_campaigns_<md5>`, `wpsg_companies_*`, and the accessible-ids key; reuse `bump_cache_version()` on any space mutation.

**Files:** `wp-plugin/wp-super-gallery/includes/rest/class-wpsg-space-controller.php` (new), `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`, `wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php`, `wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php`

### Acceptance criteria

- Full CRUD on spaces with capability-gated create (`manage_wpsg`) and owner-gated edit/delete.
- Space grants list/add/revoke work and emit audit entries.
- Existing list endpoints return only the requested space's data; `space=all` returns the accessible union.
- Switching space yields distinct cached payloads; mutations invalidate via the version counter.

### Validation

- PHP: CRUD + grant + cache-key tests; cross-space write rejection (cannot create a campaign in a space you lack owner/editor on).
- Manual: exercise endpoints via the REST client / browser network panel.

---

## Track P47-D — Settings Inheritance

### Problem

Settings are a single global option; a space cannot have its own theme/branding/layout.

### Fix

- Add `WPSG_Settings::get_effective_settings($space_id = 0)` = `wp_parse_args(json_decode(space.settings_overrides), get_settings())`.
- Define an **overridable allowlist** (theme, gallery_layout, items_per_page, lightbox/animations, full-bleed trio, typography/branding/card-display toggles). The registry's `$admin_only_fields` (auth_provider, cache_ttl, upload limits, …) remain **global-only**.
- `PUT /spaces/{id}/settings` mirrors the settings controller (camel→snake via `from_js`, sanitize through `WPSG_Settings_Sanitizer::sanitize_settings()` against `$valid_options`/`$field_ranges`, merge, audit `space.settings.updated`, bump cache). "All spaces" mode edits global defaults only.

**Files:** `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php`, `wp-plugin/wp-super-gallery/includes/settings/`, `wp-plugin/wp-super-gallery/includes/rest/class-wpsg-space-controller.php`

### Acceptance criteria

- Effective settings = space override ⊕ global defaults; unset keys fall back.
- Non-overridable (admin-only) keys cannot be space-overridden; out-of-range overrides are clamped/rejected by the sanitizer.
- A space with a distinct theme override renders with that theme.

### Validation

- PHP: inheritance, allowlist enforcement, sanitizer-range tests.
- Manual: set a per-space theme; confirm it applies only to that space.

---

## Track P47-E — Shortcode + Bootstrap

### Problem

The shortcode has no `space` attribute, builds config from global settings only, and emits a single `window.__WPSG_CONFIG__` — so multiple shortcodes targeting different spaces on one page would clobber each other's config.

### Fix

- Add a `space` attribute to `render_shortcode`. Resolve effective space: explicit `space=` (slug or id) → else campaign's `_wpsg_space_id` → else company's `_wpsg_space_id` → else Default Space (back-compat).
- Build config from `get_effective_settings($space_id)` (theme/fonts/full-bleed/lightbox reflect the space).
- Add `space` to `data-wpsg-props` and to `ALLOWED_PROPS` in `main.tsx`.
- Keep the page-global `__WPSG_CONFIG__` once (nonce/apiBase/sentry), but move **space-specific** config (spaceId, theme, branding, isolationMode) into per-node `data-wpsg-props`/`data-wpsg-config`; each mount derives its theme from its own node. Scope theme-persistence localStorage by `spaceId` (dovetails with the existing `RootIdContext` + portal multi-mount).

**Files:** `wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php`, `src/main.tsx`

### Acceptance criteria

- Existing `[super-gallery campaign=… company=…]` shortcodes work unchanged (resolve to their space / Default).
- `[super-gallery space="…"]` renders that space's campaigns with its effective theme/branding.
- Two shortcodes targeting two spaces on one page each render with their own theme.

### Validation

- PHP: `space=` resolution; legacy attribute fallthrough; effective-theme-in-config test.
- JS: `parseProps` accepts `space` + per-instance config, rejects unknown keys.
- Manual: two-shortcode page renders distinct themes.

---

## Track P47-F — Admin UX (switcher + "All spaces")

### Problem

The AdminPanel manages all campaigns/media/metrics/logs globally with no notion of space, and there is no UI to create or manage spaces.

### Fix

- `AdminPanel.tsx`: add `selectedSpaceId` via the existing `useReloadSafeView('admin_space', '<default>')` hook; add a header space `<Select>` (+ "All spaces") fed by a new `useSpaces()` hook.
- Thread `selectedSpaceId` through `getAdminQueryPrefix()` → `['admin', baseUrl, spaceId]`; because every key factory spreads this prefix, all admin caches scope per space and refetch on switch. Add `space` to the corresponding `fetch*` params.
- "All spaces" mode: lists use `space=all`; mutating actions are disabled / prompt "pick a space first". Reset per-tab campaign/company selections on space change.
- New header-level "Manage spaces" modal (keep the 8-tab contract): create/edit (name, slug, **isolation toggle** with a clear warning), per-space settings (reuse Settings panel components against `/spaces/{id}/settings`), and space access grants (reuse `AccessTab` grant table + `QuickAddUserModal`). Add a thin `SpaceSelector` mirroring `CampaignSelector`.

**Files:** `src/components/Admin/AdminPanel.tsx`, `src/services/adminQuery.ts`, `src/components/Common/` (new `SpaceSelector`), new space-management components under `src/components/Admin/`

### Acceptance criteria

- Space switcher visible in the header; all 8 tabs filter to the selected space.
- "All spaces" shows the cross-space union; mutations are gated to a single space.
- Spaces can be created/edited, isolation toggled, per-space settings edited, and grants managed from the modal.
- Switching space resets dependent per-tab selections.

### Validation

- JS: `adminQuery` keys include spaceId (distinct per space); switcher resets dependent selections.
- e2e: create space → switch → tabs filter; All-spaces union; toggle delegated → non-owner admin loses access, owner retains.

---

## Track P47-G — Migration Hardening + Libraries + Uninstall

### Problem

The migration must be airtight on real data, the shared-vs-per-space library policy needs to be finalized in code, and uninstall must clean up the new table/options.

### Fix

- Finalize Decision I: companies gain per-space association (term meta); overlays, fonts, layout templates, and taxonomies stay global/shared (filter pickers client-side by the space's used terms where helpful).
- Stress-test the resumable backfill on a large populated DB; confirm restart-safety and no `space_id = 0` leakage.
- Extend `uninstall.php` to drop `wp_wpsg_spaces` and the `wpsg_default_space_id` / `wpsg_space_ids_backfilled` (and backfill-offset) options when data preservation is off.

**Files:** `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php`, `wp-plugin/wp-super-gallery/uninstall.php`, controllers touching companies/taxonomies

### Acceptance criteria

- Companies are space-scoped; shared libraries remain accessible across spaces.
- Backfill is provably idempotent and resumable on a large dataset.
- Uninstall removes all space artifacts when preservation is disabled.

### Validation

- PHP: uninstall cleanup test; large-dataset backfill test.
- Manual: full uninstall on a dev site; confirm no orphan table/options.

---

## Track P47-H — Tests + Docs

### Problem

Isolation is a security-shaped boundary; it needs dedicated coverage, and the phase needs an executive record.

### Fix

- PHP (`wp-plugin/wp-super-gallery/tests/`): new `WPSG_P47_Spaces_*` files covering schema/migration, **isolation enforcement** (cross-space read denial, open vs delegated, escape hatch, grant expiry, cross-space write rejection), settings inheritance, cache keying, and embed resolution.
- JS (vitest): `adminQuery` key scoping, switcher resets, `parseProps`, "inherits global" indicator.
- e2e (playwright, `e2e/spaces.spec.ts`): space lifecycle, delegated denial, two-space single-page theming; extend `auth-permissions.spec.ts`.
- Keep this report current as tracks land; record outcomes in the Implementation Notes / Outcome sections.

**Files:** `wp-plugin/wp-super-gallery/tests/`, `src/**/__tests__/`, `e2e/`

### Acceptance criteria

- Isolation, migration, settings, and embed paths are covered; the isolation suite fails if any read path leaks cross-space data.
- Full suite green: `composer test`, `npm test`, `npm run test:e2e`.

### Validation

- Run the full PHP/JS/e2e suites; manual end-to-end per the Testing Strategy below.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Cross-space **move** of an existing campaign | Requires atomically re-stamping `space_id` across all custom tables; high corruption risk. v1 creates campaigns directly in the target space. |
| Per-instance **full-bleed CSS** scoping | Server-rendered `.wpsg-full-bleed` is global; two spaces with different full-bleed on one page is a known v1 limitation (scope later via `[data-space]`). |
| Per-space **library isolation** (overlays/fonts) | Default is shared. If delegated tenants must not see each other's assets, add `wpsg_space_library_assoc` join tables (preserving the shared store) rather than columns. |
| Space-scoped **rate-limit buckets** | v1 reuses the global rate limiter with a relaxed capability check; per-space quotas can come later. |

## Risks

1. **Enforcement gaps** — any read path bypassing the three choke points leaks cross-space data. Audit `class-wpsg-export-controller.php` and `WPSG_Campaign_Duplicator` for direct `wpdb`/`WP_Query` against campaign-scoped tables.
2. **`space_id = 0` overloading** (unassigned vs audit system-scope) — backfill must guarantee no campaign-scoped row keeps `0`.
3. **Per-page single `__WPSG_CONFIG__`** — space-specific config must be per-instance or multi-space pages render the wrong theme/branding.
4. **Delegated-mode rate-limit lockout** — `rate_limit_authenticated()` gates on `manage_wpsg`; must relax for space editors.
5. **Schema/migration irreversibility** — A and B ship behind the Default-Space no-op so the rest is additive and safely revertible at the feature level.

## Testing Strategy

- Build and sync: `npm run build` → `./update_dev_plugin.sh`.
- On a dev WP site: create two spaces, place two shortcodes on one page referencing different spaces, confirm public + admin isolation and per-space theming; flip one space to delegated and verify delegation behavior with a second admin account.
- Automated: `composer test` (PHP), `npm test` (vitest), `npm run test:e2e` (playwright) — the isolation suite is the gate.
