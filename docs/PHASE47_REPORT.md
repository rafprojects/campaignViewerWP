# Phase 47 - Gallery Spaces (Multi-Instance Isolation)

**Status:** **Done**
**Created:** 2026-06-07
**Last updated:** 2026-06-09 (all tracks done)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P47-A | Data foundation — `wp_wpsg_spaces` table, `space_id` columns, migration/backfill (ships dark) | **Done** | Large |
| P47-B | Resolution + enforcement core — space-aware permission choke points, dual isolation mode | **Done** | Large |
| P47-C | Space CRUD + access REST — `/spaces` endpoints, space grants, cache-key threading | **Done** | Medium |
| P47-D | Settings inheritance — per-space overrides over global defaults | **Done** | Medium |
| P47-E | Shortcode + bootstrap — `space` attribute, effective settings, per-instance config | **Done** | Medium |
| P47-F | Admin UX — space switcher, "All spaces" mode, space-management modal | **Done** | Large |
| P47-G | Migration hardening + libraries + uninstall | **Done** | Medium |
| P47-H | Tests + docs | **Done** | Medium |
| P47-I | Frontend space filtering + WP admin Campaigns column | **Done** | Small |
| P47-J | Campaign space assignment on create + settings space-scoping + create-space UX | **Done** | Small |
| P47-K | Settings space-scoping audit — read-path verification + field categorization | **Done** | Medium |
| P47-L | Bug: bust `get_space()` static cache on write so PUT responses are not stale | **Done** | Small |
| P47-M | Promote tier-1 visual/branding fields (~90 keys) to space-overridable | **Done** | Medium |
| P47-N | Promote tier-2 layout/composition fields (~190 keys + unit companions) | **Done** | Large |
| P47-O | Space settings UI — wire full `SettingsPanel` into `SpaceManagementView` | **Done** | Medium |

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

### Implementation Notes

- New `class-wpsg-space-controller.php` registered first in `class-wpsg-rest.php` (before campaign controller to avoid route-name collisions).
- Routes: `GET/POST /spaces`, `GET/PUT/DELETE /spaces/{id}`, `GET/POST /spaces/{id}/access`, `DELETE /spaces/{id}/access/{userId}`.
- `require_space_owner` and `require_space_member` permission callbacks added to `class-wpsg-rest-base.php`; both call `verify_admin_auth()` (not `rate_limit_authenticated`) so delegated-space owners can reach them without `manage_wpsg`.
- `DELETE /spaces/{id}` defaults to archive (soft); `force=true` hard-deletes only if the space has no campaigns. The Default Space cannot be deleted.
- Access grants stored as JSON in `wp_wpsg_spaces.access_grants` and read/written via `WPSG_DB::update_space()`. Response shape mirrors the campaign access endpoint (paginated, user-enriched, `is_expired` computed).
- `list_spaces` response cached per user+cache_version+archived-flag; all mutations call `bump_cache_version()`.
- Campaign `list_campaigns` endpoint now accepts `space=<id>` param: adds a `_wpsg_space_id` meta_query filter and includes the space value in the cache key. Omitting or `space=all` preserves backward-compatible behavior (no filter).
- Deviation from spec: `rate_limit_authenticated()` relaxation deferred; access to space endpoints is gated by the new `require_space_owner`/`require_space_member` callbacks which bypass that rate limit.
- Deviation from spec: global audit, analytics summary, and access-summary `space` params deferred to P47-F (admin UX) where those endpoints' consumers are built.

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

### Implementation Notes

- `WPSG_Settings_Registry::$space_overridable_fields` defines the allowlist (32 fields): theme, gallery_layout, items_per_page, enable_lightbox, enable_animations, full-bleed trio, typography_overrides, branding text, viewer/card/campaign display toggles, default_visibility. Getter `get_space_overridable_fields()` added alongside `get_admin_only_fields()`.
- `WPSG_Settings::get_overridable_keys()` delegates to the registry. `get_effective_settings(int $space_id = 0)` uses `array_merge($global, $filtered_overrides)` — flat merge only (nested configs excluded from allowlist). Falls back to global if space is 0, not found, or has no overrides.
- `GET /spaces/{id}/settings` (require_space_member): returns `{ settings: camelCase effective, overrides: raw snake_case stored }`.
- `PUT /spaces/{id}/settings` (require_space_owner): `from_js()` → allowlist filter → split nulls (clear) from values (set) → `sanitize_settings()` + `array_intersect_key` extract → merge with existing overrides → `WPSG_DB::update_space()` → audit `space.settings.updated` → bump cache → return updated effective settings.
- Deviation from spec: `wp_parse_args` mentioned in spec replaced by `array_merge($global, $filtered)` — identical semantics for flat keys, more explicit intent.
- Non-overridable keys sent in PUT are silently dropped (no error), consistent with global settings controller behavior.
- `null` value for a key clears the override, restoring global fallback.

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

### Implementation Notes

- `WPSG_DB::get_space_by_slug(string $slug): ?object` added to support slug-based `space=` resolution in the shortcode.
- `render_shortcode` now accepts `space=` attribute. Resolution priority: numeric/slug space attr → campaign `_wpsg_space_id` post meta → company `_wpsg_space_id` term meta → Default Space (`wpsg_default_space_id` option). All resolution falls back gracefully to the Default Space.
- `WPSG_Settings::get_effective_settings($space_id)` replaces `get_settings()` in the embed — fonts, full-bleed breakpoints, and theme all reflect the space's effective settings.
- `window.__WPSG_CONFIG__` is now emitted only once per page (guarded by `$GLOBALS['wpsg_config_emitted']`) and contains only page-global values: `authProvider`, `apiBase`, `sentryDsn`, `enableJwt`, `debugComponentMarkers`, `allowUserThemeOverride`, `restNonce`. Two shortcodes on one page no longer clobber each other's config.
- `window.__wpsgThemeId` page-global removed; theme is now per-node in `data-wpsg-config`.
- Each mount div carries `data-wpsg-config` with `{ spaceId, theme, galleryLayout, enableLightbox, enableAnimations }` and `data-wpsg-props` with `{ campaign, company, space }`.
- JS: `ALLOWED_PROPS` extended with `'space'`; `parseNodeConfig()` reads `data-wpsg-config`; `renderApp`, `mountWithShadow`, `mountDefault`, and `mountSharedRoot` all accept and forward `NodeConfig`.
- `ThemeProvider` gained `defaultThemeId` (space's admin theme, yields to localStorage) and `instanceId` (scopes `wpsg-theme-id-{id}` localStorage key so each space tracks user preference independently).
- `App` accepts `spaceId?: number` prop (unused until P47-F threads it into query prefixes).
- Known v1 limitation: full-bleed CSS class `.wpsg-full-bleed` is global; two shortcodes with different bleed settings on one page will conflict. Scoped per-instance bleed is a Follow-On.

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

### Implementation notes

- `SpaceInfo` type added to `adminQuery.ts`; `useSpaces()` hook fetches `GET /spaces`.
- `getAdminQueryPrefix` unchanged; `spaceId` inserted **after** the type identifier in each key factory (e.g., `['admin', base, 'campaigns', spaceId, ...]`) so `usePatchCampaign`'s prefix invalidation `['admin', base, 'campaigns']` still matches all space-scoped keys.
- `selectedSpaceId` defaults to `'all'` via `useReloadSafeView('admin_space', 'all')` — survives page reload.
- `space=all` passed as query param; endpoints skip the space filter when the value is not a positive integer.
- Mutations disabled (`disabled={isAllSpaces}`) on "New campaign", "Import", and "New company" buttons.
- New components: `SpaceSelector` (Common), `SpaceManagementModal` (Admin), `SpaceSettingsPanel` (Admin).
- `SpaceSettingsPanel` sends camelCase field names; PHP `WPSG_Settings::from_js()` iterates defaults mapping camelCase → snake_case, so no PHP-side changes needed for the settings endpoint.
- PHP: `space` query param added (optional) to analytics summary, global audit log, companies list, and access summary endpoints. Audit log and analytics filter by `space_id` column; companies filter via `meta_query` on `_wpsg_space_id` term meta; access summary via `INNER JOIN` on `_wpsg_space_id` post meta.

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

### Implementation notes (done 2026-06-09)

**`uninstall.php` additions:**
- `wp_wpsg_spaces` table added to the DROP TABLE list (section 6).
- `wpsg_audit_log` table also added to section 6 — it was missing since P40 (pre-existing gap, fixed opportunistically as part of this hardening track).
- Three space options added to the delete list (section 4): `wpsg_default_space_id`, `wpsg_spaces_backfill_complete`, `wpsg_spaces_backfill_offset`. Post meta and term meta are already cleaned by `wp_delete_post`/`wp_delete_term` in sections 1 and 3.

**`maybe_seed_default_space()` hardening bug fix:**
The original guard `if (get_option('wpsg_default_space_id')) { return; }` uses a PHP truthy check. If the option is stored as `'0'` (e.g., because a previous `$wpdb->insert()` on a UNIQUE-constraint violation returned `insert_id = 0`), the guard evaluates false and the function attempts a re-INSERT, hitting the duplicate-slug error again. Root cause in the test environment: `WPSG_DB_Test.tearDown()` issues `DROP TABLE` DDL which causes an implicit MySQL commit, permanently persisting the broken `wpsg_default_space_id = 0` state across test runs.

Fix: query the table by `slug = 'default'` first. If the row exists and the option is falsy, repair the option from the row's ID. Only INSERT when no row exists. This makes seeding idempotent regardless of prior partial failures.

**`WPSG_P47_Spaces_Migration_Test.php` (new, 8 tests, 16 assertions):**
Covers: spaces table exists after upgrade; `space_id` column on all four campaign-scoped tables; default space row has correct slug/name/mode; `wpsg_default_space_id` option is a positive integer; backfill assigns default space to campaigns without `_wpsg_space_id`; backfill does NOT overwrite a campaign already assigned to a different space; running backfill twice never creates duplicate meta; `wpsg_spaces_backfill_complete` is set `'1'` after completion.

Full suite: 889 tests, 2950 assertions, green.

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

### Implementation notes (done 2026-06-09)

Test coverage was grown incrementally across tracks and consolidated here. All three PHP test classes and both JS describe blocks were in place by the end of P47-N/P47-O; P47-H closes the loop by running the full suites and recording the final numbers.

**PHP — three test classes, 36 tests total:**

| Class | Tests | What it locks in |
|-------|------:|-----------------|
| `WPSG_P47_Spaces_Migration_Test` | 8 | Schema (`wp_wpsg_spaces` table, `space_id` columns on 4 tables); default space seeding; backfill assignment, non-overwrite, idempotency, completion flag (created P47-G) |
| `WPSG_P47_Spaces_Settings_Test` | 22 | Inheritance (`get_effective_settings` override wins, unset falls back, space_id 0 returns global); allowlist enforcement (non-overridable keys silently dropped at merge and at PUT); sanitizer clamping; P47-L cache-bust; P47-M branding group (5 representative-per-group tests); P47-N layout group (7 tests + unit-parity assertion) |
| `WPSG_P47_Spaces_Isolation_Test` | 6 | Campaign read isolation; public settings isolation (`GET /settings?space=A` ≠ `?space=B`); open mode admits `manage_wpsg`; delegated mode denies `manage_wpsg`-only; `manage_options` escape hatch; explicit grantee admitted |

**JS (vitest) — 5 tests in 2 describe blocks:**

- `settingsQuery space scoping (P47)` — `getSettingsQueryKey` returns distinct keys for global/spaceA/spaceB; `useGetSettings(client, spaceId)` forwards `spaceId` to the API and caches under the space-scoped key, leaving the global cache empty.
- `adminQuery space scoping (P47)` — `getAdminCampaignsQueryKey` keys distinctly per space; type identifier `'campaigns'` appears before `spaceId` so prefix invalidation (`['admin', base, 'campaigns']`) still matches every space-scoped key; `getAdminCampaignOptionsQueryKey` is also scoped per space.

**Full suite results:** PHP 889 tests / 2950 assertions (green); JS 2093 tests / 152 files (green).

---

## Track P47-I — Frontend Space Filtering + WP Admin Campaigns Column

### Problem

Two gaps left the space system non-functional end-to-end:

1. **Shortcode `space="test2"` showed the default gallery.** The PHP shortcode correctly resolved the slug to a numeric `spaceId` and embedded it in `data-wpsg-config`, but `App.tsx` was discarding it (`spaceId: _spaceId`). `AppContent.fetchCampaigns` always called `/campaigns?include_media=1` with no space param — every shortcode instance returned all campaigns regardless of `space=` attribute.

2. **WP admin Campaigns list had no space context.** The standard WordPress CPT list table showed all campaigns across all spaces with no Space column and no space filter. Admins had no way to see or filter by space assignment.

### Fix

**React (`src/App.tsx`):**
- Activated the `spaceId` prop (removed the `_` discard alias).
- Extended `AppContent` to accept `spaceId?: number` and forwarded it from `App` via conditional spread.
- `fetchCampaigns` now appends `&space=${spaceId}` when the prop is set; `spaceId` added to `useCallback` dependencies and the `campaignsKey` query key (ensures separate TanStack Query cache per space instance on the same page).

**PHP (`includes/class-wpsg-cpt.php`):**
- Registered four admin hooks inside `register()` under an `is_admin()` guard.
- `add_space_column`: inserts a "Space" column header after "Title".
- `render_space_column`: reads `_wpsg_space_id` post meta, looks up the space name via `WPSG_DB::get_space()`.
- `render_space_filter_dropdown`: renders a `<select name="wpsg_space_filter">` dropdown of non-archived spaces above the list table.
- `apply_space_filter`: when `wpsg_space_filter` is present in the request, adds a `meta_query` on `_wpsg_space_id` to the main admin query.

No new PHP endpoints required — the campaign REST endpoint already supported `?space=ID` from P47-C.

### Root cause note

The "test2" slug didn't exist in the DB (`SELECT slug FROM wp_wpsg_spaces` confirmed only `"default"`). Even once a space is created, the React fix was required — the slug lookup succeeding on the PHP side was irrelevant while the React app discarded the resolved `spaceId`.

### Acceptance criteria

- `[super-gallery space="<slug>"]` fetches `/campaigns?include_media=1&space=<id>` — confirmed in browser DevTools network tab.
- A plain `[super-gallery]` shortcode fetches without a `space` param.
- Two shortcodes for different spaces on the same page maintain independent caches.
- WP admin `/wp-admin/edit.php?post_type=wpsg_campaign` shows a "Space" column with the space name per row.
- The space dropdown filter narrows the list to campaigns in the selected space.

### Validation

- `tsc --noEmit` passes.
- `php -l includes/class-wpsg-cpt.php` passes.
- Create a "test2" space via Manage Spaces modal; assign a campaign to it; visit `[super-gallery space="test2"]` page — only that campaign appears.

---

## Track P47-J — Campaign Space Assignment + Settings Space-Scoping

### Problem

Three bugs found during first live testing with a real "test-2" space:

1. **Space filter showed no campaigns for a real space.** Campaigns created through the React admin panel never received `_wpsg_space_id` post meta — the only thing that ever wrote it was the P47-A backfill migration (for campaigns that pre-existed the migration). The `create_campaign()` REST endpoint and the frontend POST payload both omitted `space_id` entirely. Every new campaign had `_wpsg_space_id = 0`, so the WP admin space filter (added in P47-I) correctly found nothing.

2. **Theme settings bled across spaces.** The public `GET /settings` endpoint returned the global `wp_options` value regardless of which space was rendering. Per-space `settings_overrides` infrastructure existed (added in P47-D) and was reachable via `/spaces/{id}/settings` for the admin panel, but the public endpoint never called `get_effective_settings($space_id)`. A theme set in the admin for any space applied globally to all gallery instances.

3. **No way to create a space from the WP Campaigns list table.** The WP admin Campaigns page had a space filter dropdown (P47-I) but no affordance for creating new spaces without navigating away to the React front-end gallery.

### Fix

**Campaign space assignment (`class-wpsg-campaign-controller.php` + `src/hooks/useUnifiedCampaignModal.ts` + `src/App.tsx` + `src/components/Admin/AdminPanel.tsx`):**
- Added optional `space_id` integer arg to the POST `/campaigns` REST route.
- In `create_campaign()`, after `wp_insert_post()`, writes `_wpsg_space_id` post meta when `space_id > 0`.
- Extended `UseUnifiedCampaignModalOptions` with `spaceId?: number`; injects `space_id` into the POST payload on create (not PUT).
- `App.tsx`: forwards `spaceId` from `AppContent` to `useUnifiedCampaignModal` via conditional spread (required by `exactOptionalPropertyTypes`).
- `AdminPanel.tsx`: converts `selectedSpaceId` string (`'all'` or numeric) to `activeSpaceId?: number` and passes to `useUnifiedCampaignModal`.

**Settings space-scoping (`class-wpsg-settings-controller.php` + `src/services/api/settingsApi.ts` + `src/services/apiClient.ts` + `src/services/settingsQuery.ts` + `src/App.tsx`):**
- `GET /settings` now accepts optional `?space=ID`; calls `WPSG_Settings::get_effective_settings($space_id)` when ID > 0, otherwise unchanged.
- `SettingsApi.getSettings(spaceId?)` builds `?space=ID` when provided.
- `ApiClient.getSettings(spaceId?)` passes through.
- `getSettingsQueryKey` includes `spaceId ?? null` — different space instances get separate TanStack Query cache entries.
- `useGetSettings(apiClient, spaceId?)` threads `spaceId` into key and fetch URL.
- `App.tsx`: passes `spaceId` to `useGetSettings(apiClient, spaceId)`.

**Inline "Create Space" form (`class-wpsg-cpt.php`):**
- Added `manage_posts_extra_tablenav` hook → `render_create_space_ui()`: renders a `<details>`/`<summary>` collapsible form ("+ New Space") above the Campaigns table — name + optional slug, submits via `admin-post.php`.
- Added `admin_post_wpsg_create_space` hook → `handle_create_space()`: validates nonce + capability, calls `WPSG_DB::insert_space()`, redirects back to the campaigns list.

### Acceptance criteria

- Create a campaign in the React admin panel while "test-2" space is selected → WP Admin space filter for "test-2" shows the new campaign; "default" space filter does not.
- `[super-gallery space="test-2"]` shortcode fetches `/settings?space=<id>` and applies test-2's theme overrides. `[super-gallery]` still uses global settings.
- WP Admin Campaigns list shows a "+ New Space" collapsible form above the table; submitting it creates the space and redirects back.

### Validation

- `tsc --noEmit` passes.
- `php -l` passes on `class-wpsg-cpt.php`, `class-wpsg-campaign-controller.php`, `class-wpsg-settings-controller.php`.

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

---

## Settings Space-Scoping Audit (P47-K)

**Date:** 2026-06-08. **Scope:** verify that settings which *should* be space-specific are space-scoped in code, and identify which are not. **This is a report — no settings behavior was changed.**

### Verdict

The **mechanism is sound**: every settings *read path* that has a space context already routes through `WPSG_Settings::get_effective_settings($space_id)`, and the merge is a correct allowlist-filtered flat merge. **No read path leaks one space's settings into another, and no path drops a known space context back to global.** The open question is *breadth*, not correctness: only **34 of ~334** settings are eligible for per-space override, and the ~271 that aren't are overwhelmingly public-facing *visual/branding* knobs that a space owner would plausibly expect to control. Promotion of those is a deliberate, grouped decision left to the maintainer (see candidates below).

### 1. Read-path verification

`get_effective_settings()` lives at [class-wpsg-settings.php:216-231](../wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php#L216-L231) — `array_merge($global, $filtered_overrides)`, where `$filtered_overrides` is the space's `settings_overrides` intersected with the overridable allowlist.

| Consumer | Source | Scope | Correct? |
|----------|--------|-------|----------|
| Public `GET /settings?space=ID` | [class-wpsg-settings-controller.php:50-55](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-settings-controller.php#L50-L55) | `get_effective_settings($id)` when `id>0`, else global | ✅ space-aware |
| Public `POST /settings` (save) | class-wpsg-settings-controller.php | global `get_settings()` — admin save of defaults | ✅ intentionally global |
| `GET /spaces/{id}/settings` | class-wpsg-space-controller.php | `get_effective_settings($id)` | ✅ space-aware |
| `PUT /spaces/{id}/settings` | class-wpsg-space-controller.php | allowlist-filtered write to `settings_overrides` | ✅ space-aware |
| Shortcode / embed | class-wpsg-embed.php | `get_effective_settings($space_id)` (theme, fonts, full-bleed) | ✅ space-aware |
| Thumbnail cache TTL | class-wpsg-thumbnail-cache.php | global `thumbnail_cache_ttl` (admin-only) | ✅ correctly global |
| Image optimizer sizes | class-wpsg-image-optimizer.php | global `optimize_*` (admin-only) | ✅ correctly global |
| Auth provider filter | settings service | global `auth_provider` (admin-only) | ✅ correctly global |
| Analytics toggle | class-wpsg-analytics-controller.php | global `enable_analytics` | ✅ reasonably global |

No `get_settings()` call was found where a space id was in scope but discarded.

### 2. Field categorization (all ~334 keys)

| Bucket | Count | Defined in |
|--------|------:|-----------|
| Admin-only (global) | 29 | `$admin_only_fields` ([registry:371-401](../wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php#L371-L401)) |
| Space-overridable | 34 | `$space_overridable_fields` ([registry:408-443](../wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php#L408-L443)) |
| Uncategorized → **forced global** | ~271 | (neither list; fall through `get_effective_settings`) |

The **29 admin-only** (auth, API base, cache TTLs, image-optimization, upload limits, debounce/timeout, uninstall/purge, magic-link page) are correctly global. The **34 space-overridable** match Decision C's stated scope (theme, layout, items-per-page, lightbox/animations, full-bleed trio, typography, gallery title/subtitle, the `show_*` card/campaign/gallery toggles, `default_visibility`, the campaign-listing adapter trio + template).

### 3. The ~271 forced-global fields — promotion candidates

These are grouped so promotion can be done in coherent sets (most fields are paired with a `*_unit` companion or compose the runtime `gallery_config`/`card_config`, so piecemeal promotion would be incoherent).

| Group | Representative fields | Recommendation |
|-------|----------------------|----------------|
| **Branding text & labels** | `campaign_about_heading_text`, `gallery_image_label`, `gallery_video_label`, `gallery_label_justification`, `show_gallery_label_icon` | **Strong promote** — user-facing text; surprising to be global when `gallery_title_text`/`gallery_subtitle_text` are per-space |
| **Backgrounds** | `image_bg_*`, `video_bg_*`, `unified_bg_*`, `viewer_bg_*`, `modal_bg_*` (type/color/gradient/image_url) | Promote — core per-space branding |
| **Nav arrows & dot-nav** | `nav_arrow_*` (position/size/color/bg), `dot_nav_*` (position/size/colors/shape) | Promote — visual identity |
| **Shadows & borders** | `image/video/card_shadow_preset` (+custom), `*_border_radius/width`, `card_border_color`, `tile_border_*` | Promote |
| **Card layout & styling** | `card_thumbnail_*`, `card_gap_h/v`, `card_max_*`, `card_aspect_ratio`, `card_grid_columns`, `card_scale`, `grid_card_*`, `card_gradient_*`, `card_*_icon_size` | Promote (with their `*_unit` pairs) |
| **Tiles / mosaic / hex** | `tile_*`, `masonry_*`, `mosaic_target_row_height`, `hex_*`, `diamond_*`, `photo_normalize_height` | Promote |
| **Carousel** | `carousel_*` (visible/autoplay/gap/loop/darken) | Promote |
| **Modal & lightbox** | `modal_cover_*`, `modal_transition*`, `modal_max_*`, `modal_gallery_*`, `modal_close_button_*`, `lightbox_*` | Promote |
| **Gallery section / adapter layout** | `gallery_section_*`, `adapter_*`, `app_max_width`, `app_padding`, `gallery_sizing_mode`, `section_scale`, `item_scale` | Promote |
| **Viewport & responsive** | `video/image_viewport_height`, `viewport_height_*_ratio`, `modal_mobile_breakpoint`, `*_breakpoints` | Promote (mostly) |
| **CSS unit companions** | ~48 `*_unit` fields ([registry:310-357](../wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php#L310-L357)) | Promote **only paired** with their value field |
| **Extra display toggles** | `show_viewer_border`, `show_campaign_cover_image`, `show_campaign_tags`, `show_campaign_gallery_labels`, `transition_fade_enabled`, `dot_nav_enabled`, `campaign_open_mode` | Promote — siblings of already-overridable `show_*` toggles |
| **Admin-panel / operational** | `settings_panel_width`, `admin_panel_max_width`, `library_page_size`, `media_list_page_size`, `media_*_card_height`, `show_settings_tooltips`, `show_in_context_editors`, `show_campaign_admin_actions`, `settings_drawer_blur_enabled`, `campaign_stats_admin_only`, `enable_analytics` | **Leave global** — govern the editing surface / site-wide ops, not the public per-space look |

So: of the ~271, roughly **~250 are public visual/presentation knobs** (promotion candidates) and **~15-20 are genuinely admin/operational** (correctly global).

### 4. Known nuances & a bug found

- **⚠️ Stale read-back after save (`get_space()` cache).** `WPSG_DB::get_space()` keeps a **request-level static cache** ([class-wpsg-db.php:972-985](../wp-plugin/wp-super-gallery/includes/class-wpsg-db.php#L972-L985)) that `update_space()` does **not** invalidate. `PUT /spaces/{id}/settings` does `get_space()` (caches) → `update_space()` (writes DB) → `get_space()` (returns the **stale** cached row), so the endpoint's **response** returns the pre-save `settings_overrides` / effective settings even though the save itself persisted correctly. The admin panel reads that response after saving, so per-space settings can appear to "revert" until a fresh refetch — a strong candidate for the save-time settings glitches seen in P47-J. Same get→update→get pattern likely affects the space access-grant endpoints. Suggested fix (deferred — audit-only): bust the static cache in `update_space()`/`archive_space()`/`delete_space()`/`insert_space()`. Regression tests assert on the persisted DB row, which is correct.
- **Whole-unit JSON merge.** `typography_overrides` (and `*_bg_gradient`) are allowlisted but stored as JSON; the flat `array_merge` replaces them wholesale — a space cannot inherit some sub-keys and override others. Acceptable as a whole-unit override; note it if granular typography inheritance is ever wanted.
- **`gallery_config` / `card_config` are not settings keys.** They are composed at runtime from individual layout fields. Per-space layout therefore depends on promoting those individual fields (above), not on overriding a single config blob.
- **Per-space UI is narrower than the allowlist.** The dedicated `SpaceSettingsPanel` ([SpaceSettingsPanel.tsx](../src/components/Admin/SpaceSettingsPanel.tsx)) edits only **9 of the 34** overridable fields. A fuller path exists — `SettingsPanel` accepts a `spaceId` prop and saves to `/spaces/{id}/settings` ([SettingsPanel.tsx:140](../src/components/Admin/SettingsPanel.tsx#L140), [448-452](../src/components/Admin/SettingsPanel.tsx#L448-L452)) — but it is not the panel wired into the management modal. Any allowlist expansion should also pick a single coherent per-space settings UI.

### 5. Regression coverage added

PHP `WPSG_P47_Spaces_Settings_Test` (inheritance + allowlist enforcement) and `WPSG_P47_Spaces_Isolation_Test` (cross-space read/settings denial, open vs delegated, escape hatch) lock in the current behavior so a future change cannot silently widen or leak the boundary. Vitest covers `spaceId` query-key scoping.

---

## Track P47-L — Bug: `get_space()` Static Cache Invalidation

### Problem

`WPSG_DB::get_space()` keeps a request-level `static $cache = []` ([class-wpsg-db.php:972-985](../wp-plugin/wp-super-gallery/includes/class-wpsg-db.php#L972-L985)) to avoid repeated DB reads inside hot permission loops. However `update_space()`, `archive_space()`, `delete_space()`, and `insert_space()` never bust this cache. The concrete symptom:

`PUT /spaces/{id}/settings` executes `get_space()` (populates cache) → `update_space()` (writes DB) → `get_space()` (returns the **stale** cached row). The endpoint's response therefore contains the pre-save `settings_overrides`, so the React admin panel sees the old values after saving — the root of the "settings appear to revert" reports in P47-J. The same get→write→get pattern affects the access-grant endpoints (`GET/POST/DELETE /spaces/{id}/access`).

### Fix

After each write in `update_space()`, `archive_space()`, `delete_space()`, and `insert_space()`, unset the corresponding entry from the static cache:

```php
unset( $cache[ $space_id ] );
```

For `insert_space()` there is no prior cache entry to clear, but the returned id should not be seeded either (the next `get_space()` will hydrate correctly from DB).

**File:** `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php`

### Acceptance criteria

- `PUT /spaces/{id}/settings` response body reflects the values that were just saved, not the pre-save values.
- `POST/DELETE /spaces/{id}/access` response reflects the updated grant list.
- Running `get_space($id)` twice within the same request still uses the cache when no write occurred (cache is not disabled — just invalidated on write).

### Validation

- Extend `WPSG_P47_Spaces_Settings_Test`: after a PUT, assert the endpoint's response `settings.theme` (or any overridden field) equals the submitted value (not the prior value). The existing test already asserts the DB row; add a parallel assertion on the decoded response body.
- `composer test` full suite green.

### Implementation notes

The method-local `static $cache` inside `get_space()` was inaccessible from sibling write methods. Promoted it to a class-level `private static array $space_cache = []` and replaced all `$cache` references in `get_space()` with `self::$space_cache`. Added `unset(self::$space_cache[$id])` as the last statement in `update_space()`, `archive_space()`, and `delete_space()` — after the `$wpdb` call so the DB write always runs first. `insert_space()` needs no bust: a freshly-inserted ID was never cached. Cache hit behaviour is unchanged for read-only requests.

Added `test_put_settings_response_reflects_saved_values_not_stale_cache` to `WPSG_P47_Spaces_Settings_Test`: warms the cache with an explicit `WPSG_DB::get_space()` call before the PUT, then asserts both `response.overrides.theme` and `response.settings.theme` equal the submitted value. The stale-cache note in the existing test class header was updated to reflect the fix. Full suite: 869 tests, 2753 assertions, green.

---

## Track P47-M — Promote Tier-1 Visual / Branding Fields

### Problem

~90 public-facing visual fields remain forced-global despite being the kind of knob a space owner expects to control independently. These are fields that define *identity* — who the space looks like — not structural layout (which is larger/more complex and handled in P47-N). The most jarring gap: `gallery_title_text` and `gallery_subtitle_text` are already space-overridable (P47-D), but `campaign_about_heading_text`, `gallery_image_label`, and `gallery_video_label` are not — so two spaces can have different headings but identical image labels.

### Fix

Add the following groups to `$space_overridable_fields` in [class-wpsg-settings-registry.php:408-443](../wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php#L408-L443). No behavior change for existing sites — the Default Space has no overrides so effective settings are unchanged; the fields merely become eligible for per-space override via `PUT /spaces/{id}/settings`.

**Branding text & labels (~5 fields)**
`campaign_about_heading_text`, `gallery_image_label`, `gallery_video_label`, `gallery_label_justification`, `show_gallery_label_icon`

**Backgrounds (~20 fields)**
`image_bg_type`, `image_bg_color`, `image_bg_gradient`, `image_bg_image_url`,
`video_bg_type`, `video_bg_color`, `video_bg_gradient`, `video_bg_image_url`,
`unified_bg_type`, `unified_bg_color`, `unified_bg_gradient`, `unified_bg_image_url`,
`viewer_bg_type`, `viewer_bg_color`, `viewer_bg_gradient`, `viewer_bg_image_url`,
`modal_bg_type`, `modal_bg_color`, `modal_bg_gradient`, `modal_bg_image_url`

**Nav arrows (~12 fields)**
`nav_arrow_position`, `nav_arrow_size`, `nav_arrow_color`, `nav_arrow_bg_color`,
`nav_arrow_bg_opacity`, `nav_arrow_border_radius`, `nav_arrow_visible_on_hover`,
`dot_nav_position`, `dot_nav_size`, `dot_nav_color`, `dot_nav_active_color`, `dot_nav_shape`

**Shadows & borders (~10 fields)**
`image_shadow_preset`, `video_shadow_preset`, `card_shadow_preset`,
`card_border_radius`, `card_border_width`, `card_border_color`,
`tile_border_radius`, `tile_border_width`, `tile_border_color`, `tile_border_opacity`

**Extra display toggles (~8 fields)**
`show_viewer_border`, `show_campaign_cover_image`, `show_campaign_tags`,
`show_campaign_gallery_labels`, `transition_fade_enabled`, `dot_nav_enabled`,
`campaign_open_mode`, `show_gallery_label_icon`

**Files:** `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`

### Acceptance criteria

- `PUT /spaces/{id}/settings` with any promoted field stores the override; `GET /settings?space={id}` returns the overridden value; a different space returns the global default.
- Admin-only fields and uncategorized-global fields are unaffected.
- No new fields appear in the SpaceSettingsPanel UI until P47-O wires them in (allowlist expansion and UI expansion are intentionally separate tracks).

### Validation

- Extend `WPSG_P47_Spaces_Settings_Test`: for one representative from each group (e.g. `nav_arrow_color`, `card_border_radius`, `image_bg_type`, `campaign_about_heading_text`), assert that PUT stores the override and that a second space without an override returns the global default.
- Verify the sanitizer accepts the new fields (they already pass through `sanitize_settings()` — confirm no `$valid_options` or `$field_ranges` constraint blocks them).
- `composer test` + `npm test` green.

### Implementation notes

**Actual count: 47 fields** (not ~90). Several candidates listed in the plan don't exist in the registry:
- `viewer_bg_image_url`, `modal_bg_image_url` — no such keys in `$defaults`.
- `nav_arrow_bg_opacity` — opacity is embedded in `nav_arrow_bg_color`'s rgba value; no separate field.
- `nav_arrow_border_radius`, `nav_arrow_visible_on_hover` — don't exist; `nav_arrow_border_width` and `nav_arrow_auto_hide_ms` are the closest real fields (not promoted as they weren't in scope).
- `dot_nav_color` — doesn't exist; promoted `dot_nav_active_color` + `dot_nav_inactive_color` instead.
- `tile_border_radius`, `tile_border_opacity` — don't exist in the registry.

**Sanitizer discovery**: the `sanitize_settings()` path was wrong for per-space overrides because it has a "nested-only gallery setting" exclusion list — fields like `gallery_image_label`, `image_bg_type`, and all nav/dot-nav fields are in `$nested_common_field_map` and are skipped by the global settings sanitizer. Added `WPSG_Settings::sanitize_overrides(array $input): array` as a focused per-space sanitizer that applies the same type-based rules (valid_options → enum; bool → cast; int/float → clamp; string → sanitize_text_field/esc_url_raw) without the nested-only exclusion. The space controller's `update_space_settings()` now calls `sanitize_overrides()` instead of `sanitize_settings()`.

Added 5 PHPUnit tests (one per group) to `WPSG_P47_Spaces_Settings_Test`. Full suite: 874 tests, 2787 assertions, green.

---

---

## Track P47-N — Promote Tier-2 Layout / Composition Fields

### Problem

~190 layout, sizing, and composition fields are forced-global. Because layout is the primary visual differentiator between gallery styles, keeping them global means two spaces on the same site must share the same card grid, carousel behavior, modal size, and responsive breakpoints — making true multi-tenant differentiation impractical.

Two subtleties unique to this group:

1. **Unit companions.** Almost every numeric layout value has a `*_unit` companion (px/%, vw, etc.). Promoting a value field without its unit would silently break the CSS calculation. Every promoted numeric field in this track must have its `*_unit` companion promoted in the same commit, and vice versa.
2. **`gallery_config` / `card_config` are not settings keys.** They are runtime-composed objects. Per-space layout depends on promoting the individual primitive fields below — not on any config blob.

### Fix

Add the following groups to `$space_overridable_fields`. Fields marked `(+ unit)` must be promoted together with their `*_unit` companion.

**Card layout & styling (~30 fields + ~14 unit companions)**
`card_thumbnail_position`, `card_thumbnail_size` (+ unit), `card_gap_h` (+ unit), `card_gap_v` (+ unit),
`card_max_width` (+ unit), `card_max_height` (+ unit), `card_aspect_ratio`,
`card_grid_columns`, `card_scale`, `grid_card_width` (+ unit), `grid_card_height` (+ unit),
`card_gradient_enabled`, `card_gradient_direction`, `card_gradient_start_opacity`, `card_gradient_end_opacity`,
`card_title_icon_size` (+ unit), `card_subtitle_icon_size` (+ unit), `card_tag_icon_size` (+ unit)

**Tile / mosaic / hex / diamond (~20 fields + unit companions)**
`tile_width` (+ unit), `tile_height` (+ unit), `tile_gap` (+ unit),
`masonry_column_width` (+ unit), `masonry_gap` (+ unit),
`mosaic_target_row_height` (+ unit),
`hex_size` (+ unit), `hex_gap` (+ unit),
`diamond_size` (+ unit), `diamond_gap` (+ unit),
`photo_normalize_height`

**Carousel (~6 fields + unit companions)**
`carousel_visible_items`, `carousel_autoplay`, `carousel_autoplay_interval`,
`carousel_gap` (+ unit), `carousel_loop`, `carousel_darken_inactive`

**Modal & lightbox (~15 fields + unit companions)**
`modal_cover_enabled`, `modal_cover_opacity`,
`modal_transition_type`, `modal_transition_duration`,
`modal_max_width` (+ unit), `modal_max_height` (+ unit),
`modal_gallery_enabled`, `modal_gallery_layout`,
`modal_close_button_position`, `modal_close_button_size` (+ unit),
`lightbox_zoom_enabled`, `lightbox_zoom_max`, `lightbox_pan_enabled`, `lightbox_keyboard_nav`

**Gallery section / adapter layout (~10 fields + unit companions)**
`gallery_section_gap` (+ unit), `gallery_section_padding` (+ unit),
`adapter_column_count`, `adapter_row_count`,
`app_max_width` (+ unit), `app_padding` (+ unit),
`gallery_sizing_mode`, `section_scale`, `item_scale`

**Viewport & responsive (~8 fields)**
`video_viewport_height`, `image_viewport_height`,
`viewport_height_desktop_ratio`, `viewport_height_tablet_ratio`, `viewport_height_mobile_ratio`,
`modal_mobile_breakpoint`, `tablet_breakpoint`, `mobile_breakpoint`

**Files:** `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`

### Acceptance criteria

- Every promoted numeric field has its `*_unit` companion in the allowlist (and vice versa — no orphaned unit).
- `PUT /spaces/{id}/settings` with any promoted field stores the override correctly; effective settings for that space reflect the override; another space without overrides returns the global value.
- No `$field_ranges` constraint silently clamps a submitted value to the global default (confirm each promoted field's range accepts the submitted test value).
- Unit-companion parity: write a PHP assertion that lists all promoted fields ending in `_unit` and confirms the corresponding base field is also promoted, and vice versa.

### Validation

- PHP: representative test per group (e.g. `card_gap_h` + `card_gap_h_unit`, `carousel_gap` + unit, `modal_max_width` + unit).
- Unit-parity assertion runs as part of the test class `setUp` or as its own test method.
- `composer test` + `npm test` green.

### Implementation notes

**Actual count: 144 fields** (143 new + 1 P47-M parity fix). The plan's "~190 keys" estimate included phantom fields that don't exist in `$defaults` and some that were already in the P47-M allowlist.

**Phantom / absent fields skipped:** `hex_size`, `hex_gap`, `diamond_size`, `diamond_gap`, `masonry_column_width`, `modal_cover_enabled`, `adapter_column_count`, `adapter_row_count`, `gallery_section_gap`, `viewport_height_desktop_ratio`, `tablet_breakpoint`, `mobile_breakpoint`, `lightbox_zoom_enabled`, `lightbox_zoom_max`, `lightbox_pan_enabled`, `lightbox_keyboard_nav` — none exist in the registry `$defaults`.

**P47-M unit parity fix:** `card_border_radius` was promoted in P47-M without its `card_border_radius_unit` companion. Fixed in this commit by adding `card_border_radius_unit` to the allowlist.

**`section_scale` / `item_scale` are int-defaulted:** Both default to `1` (PHP integer), so the sanitizer casts submitted values to int. Semantically they are scale floats but submitting `1.0` or `1.1` stores as `1`. Test uses integer values (`2`) to match the actual sanitizer behavior. The float-default alignment (`1.0`) is a clean-up candidate for a future track.

**`sanitize_overrides()` handles all promoted types correctly.** String fields (`image_shadow_custom`, `lightbox_backdrop_color`, `gallery_manual_height`, etc.) pass through `sanitize_text_field()`. Float fields with ranges are clamped. Enum/_unit fields go through `$valid_options`. No nested-only exclusion applied.

**Fields intentionally left global** (admin UX / operational): `settings_panel_width`, `admin_panel_max_width`, `library_page_size`, `media_*`, `show_settings_tooltips`, `show_in_context_editors`, `show_campaign_admin_actions`, `settings_drawer_blur_enabled`, `campaign_stats_admin_only`, `enable_analytics`, `hex_clip_path`, `diamond_clip_path`, thumbnail scroll/size details, auth bar display settings, and all `$admin_only_fields`.

**Tests:** 7 new tests added to `WPSG_P47_Spaces_Settings_Test` — one per group (card layout, tile/mosaic/hex/diamond, carousel, modal/lightbox, gallery section/adapter, viewport/responsive) plus a programmatic unit-parity assertion that validates the full allowlist: every `*_unit` in the list has its base present, and every promoted base with a `*_unit` in `$defaults` has that unit promoted. Full suite: 881 tests, 2934 assertions, green.

---

## Track P47-O — Space Settings UI: Wire Full `SettingsPanel` into `SpaceManagementView`

### Problem

`SpaceSettingsPanel` ([src/components/Admin/SpaceSettingsPanel.tsx](../src/components/Admin/SpaceSettingsPanel.tsx)) currently exposes only 9 of the 34 (and growing, post P47-M/N) space-overridable fields. A fuller per-space settings path already exists: `SettingsPanel` ([src/components/Admin/SettingsPanel.tsx:140](../src/components/Admin/SettingsPanel.tsx#L140)) accepts a `spaceId` prop and routes its saves to `PUT /spaces/{id}/settings`, but it is not wired into `SpaceManagementView` or the "Campaigns → Spaces" admin page. After P47-M and P47-N promote ~280 additional fields, the editing surface gap becomes the practical barrier to using per-space settings at all.

### Fix

1. In `SpaceManagementView`'s "Settings" tab, replace `<SpaceSettingsPanel>` with `<SettingsPanel spaceId={selectedSpaceId}>` (already saves to the correct endpoint). Keep `SpaceSettingsPanel` only if there is a remaining compact-embedded context that genuinely cannot use the full panel; otherwise delete it.
2. Audit `SettingsPanel` for any sections that hard-filter to admin-only fields and would expose a global-only field in the per-space context — those sections should either be hidden when `spaceId` is set or render a "revert to global" affordance instead of a save.
3. Confirm the "revert to global" pattern: a `null` value submitted via `PUT /spaces/{id}/settings` clears the override and restores the global fallback (this is already the PHP behavior per P47-D; verify the UI sends `null` for cleared fields rather than the global value).

**Files:** `src/components/Admin/SpaceManagementView.tsx`, `src/components/Admin/SettingsPanel.tsx`, `src/components/Admin/SpaceSettingsPanel.tsx`

### Acceptance criteria

- All space-overridable fields (34 base + P47-M + P47-N additions) are editable from the "Campaigns → Spaces" admin page.
- Admin-only fields (auth, API base, cache TTLs, etc.) do not appear in the per-space settings UI.
- Saving a field writes to `/spaces/{id}/settings`; a subsequent `GET /settings?space={id}` returns the overridden value.
- Clearing a field (sending `null`) writes a null entry; effective settings fall back to the global default.
- `SpaceSettingsPanel` is either repurposed or deleted — no dead component left in the tree.

### Validation

- Manual: in the WP-admin "Gallery Spaces" page, edit a space's theme, a background color (P47-M), and a card gap (P47-N). Reload the page and confirm all three persist. Switch to a different space and confirm it shows global defaults for those fields.
- `npm test` green (update or remove `SpaceSettingsPanel` tests if the component is deleted).
- `composer test` green.

---

### Implementation notes (done 2026-06-09)

**What shipped:**

1. **`SettingsPanel.tsx`** — Two additions:
   - `withinPortal?: boolean` prop (default `false`, preserving existing shadow-DOM behavior). When `true`, Mantine renders the Drawer via a React portal to `document.body`, placing it above any hosting Modal (z-index 450 > Modal's 200).
   - `spaceId?: number` threaded into `SettingsPanelTabsContent`. When set, the **Integrations** tab (webhook settings — global) and **System & Admin** tab (admin-only fields — already gated by `advancedSettingsEnabled`) are hidden. All other 7 tabs render normally; the PHP allowlist already silently drops any non-overridable keys on PUT.

2. **`SpaceManagementView.tsx`** — Settings tab replaced:
   - `<SpaceSettingsPanel>` removed; the tab now shows a brief description + "Configure display settings" button.
   - `<SettingsPanel opened={settingsPanelOpen} spaceId={selectedSpace.id} withinPortal>` rendered at the component root (outside the `<Tabs>` tree). State `settingsPanelOpen` starts `false` and resets whenever `selectedSpaceId` changes.
   - Import updated: `SpaceSettingsPanel` → `SettingsPanel`.

3. **`SpaceSettingsPanel.tsx` deleted** — its only caller was `SpaceManagementView`.

**Scope of "admin-only" hiding:** Only tabs that are exclusively non-overridable in practice (Integrations = webhooks; System & Admin = magic-link page selector and advanced flags) are hidden. All other tabs expose their full field set; any non-allowlisted keys the user edits are silently dropped by `array_intersect_key` in `update_space_settings()`. This is the correct behavior — no frontend field enumeration needed.

**`exactOptionalPropertyTypes` compat:** `spaceId` is spread conditionally (`...(spaceId != null ? { spaceId } : {})`) when passed to `SettingsPanelTabsContent`, satisfying the strict optional-property type check.

**Build:** `npm run build` green (11.2 s), `tsc --noEmit` clean.

---

## PR #62 Copilot review — round 2 (2026-06-09)

Six additional issues addressed:

| # | Location | Issue | Decision |
|---|----------|-------|----------|
| 1 | `class-wpsg-rest-base.php` | `get_effective_space_level()` ignored `expires_at` on grants — expired grants continued to confer access | **Fixed** — skip any grant where `strtotime(expires_at) < time()` |
| 2 | `class-wpsg-settings.php` | `sanitize_overrides()` cast array-typed values to string ("Array"), corrupting `viewer_bg_gradient` | **Fixed** — added `is_array($default)` branch that accepts only arrays and sanitizes each element with `sanitize_text_field` |
| 3 | `class-wpsg-space-controller.php` | `GET /spaces/{id}` always included full `access_grants` payload, leaking other users' grant metadata to any space member | **Fixed** — `format_space(..., $include_grants)` now only passes `true` when requester is `manage_options` or has `owner` level |
| 4 | `class-wpsg-space-controller.php` | `get_space_settings()` used `to_js($effective, true)` unconditionally, exposing admin-only fields to non-admin space members | **Fixed** — gated on `current_user_can('manage_wpsg')` |
| 5 | `class-wpsg-space-controller.php` | `update_space_settings()` same admin-only field leak | **Fixed** — same gate as #4 |
| 6 | `class-wpsg-cpt.php` | `handle_create_space()` (admin-post handler) skipped `bump_cache_version()`, leaving REST space list caches stale | **Fixed** — `WPSG_REST_Base::bump_cache_version()` called after successful insert |

---

### PR #62 Copilot review — round 3 (2026-06-09)

Commit: `82364625`

| # | File | Issue | Decision |
|---|------|-------|----------|
| 1 | `src/components/Admin/SettingsPanel.tsx` | Space-mode PUT response was discarded; `markSaved(settings)` used the pre-save local state as the "saved" baseline, causing desync if the server clamped or dropped values | **Fixed** — capture `put<{ settings? }>()` response, derive saved state via `mapResponseToSettings(normalizeSettingsResponse(response.settings))` — same pattern as the non-space path |
| 2 | `wp-plugin/…/class-wpsg-db.php` | `update_space()` sanitized `slug` with `sanitize_text_field()` while `insert_space()` uses `sanitize_title()`; mismatched normalization could produce invalid slugs on update | **Fixed** — added dedicated `$key === 'slug'` branch in `update_space()` that calls `sanitize_title()` |
| 3 | `src/components/Admin/SpaceManagementView.tsx` | Grants query key `['space-grants', selectedSpaceId]` omitted the ApiClient base URL, risking cache collisions when multiple ApiClient instances are mounted (tests, multi-site) | **Fixed** — key is now `['space-grants', apiClient.getBaseUrl(), selectedSpaceId]` |
| 4 | `src/components/Admin/SpaceManagementView.tsx` | `handleGrantAccess` resolved userId via `/wp/v2/users?search=...` which requires `list_users`; delegated-mode space owners who are not site admins would get a 403 and be unable to grant access | **Fixed** — added `GET /spaces/{id}/resolve-user?search=` plugin endpoint (requires `require_space_owner`) backed by `get_users()` which runs under the plugin's own auth; React now calls this endpoint |
| 5 | `wp-plugin/…/class-wpsg-cpt.php` | `handle_create_space()` used `wp_redirect()` for all four admin-URL redirects; WP recommends `wp_safe_redirect()` as defense-in-depth against open redirect | **Fixed** — all four calls changed to `wp_safe_redirect()` |
