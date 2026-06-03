# Phase 39 — Enterprise Scale & Integration Tracks

**Status:** In Progress
**Created:** 2026-06-01
**Last updated:** 2026-06-03

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P39-CO1 | CORS origin allow-list and admin UI | Deferred — returned to FUTURE_TASKS | M |
| P39-AU1 | JWT in-memory token auth for standalone SPA | Deferred — returned to FUTURE_TASKS | L |
| P39-IN1 | Webhook support for campaign events | Complete | L |
| P39-CM1 | Campaign export full binary media export | Complete | M |
| P39-OC1 | Redis/Memcached object-cache guidance and health surface | Complete | M |
| P39-CL1 | Phase 39 backlog closure and FUTURE_TASKS cleanup | Complete | S |

> **Note:** Phase 39 is intentionally framed as a deployment, cross-origin,
> and interoperability phase rather than a broad backlog sweep.
>
> The first five tracks cover the substantive product, infrastructure, and
> integration work: CORS policy, standalone SPA auth, webhook automation,
> portable campaign export, and deployment-scale object-cache guidance.
>
> `P39-CL1` is intentionally last. It should not begin until the other Phase 39
> tracks are completed, explicitly narrowed, superseded, or closed, so
> `docs/FUTURE_TASKS.md` is cleaned up against actual outcomes rather than the
> original phase intent.

---

## Rationale

Phase 38 broadens the planning surface around Admin Media behavior, card
presentation, shortcut customization, and near-duplicate detection. The next
meaningful backlog cluster is different in character: it is not centered on one
admin surface, but on the conditions required for higher-scale, multi-instance,
cross-origin, and automation-heavy deployments.

The remaining active items in `docs/FUTURE_TASKS.md` already point in that
direction:

- CORS allow-listing is still settings-less and filter-driven.
- Standalone cross-origin auth still needs a secure JWT refresh model.
- Campaign export still only serializes media by URL reference.
- Automation users still lack first-party webhook delivery.
- High-traffic deployments still lack bounded object-cache guidance and cache
  visibility in the operational surface.

The codebase already contains strong anchors for this work:

- `wp-plugin/wp-super-gallery/wp-super-gallery.php` already owns the current
  CORS header path via `wpsg_add_cors_headers()` and
  `wpsg_cors_allowed_origins`.
- `src/services/auth/WpJwtProvider.ts`, `src/services/auth/AuthProvider.ts`,
  and `src/services/http/HttpTransportImpl.ts` already define the client-side
  auth and bearer-token surfaces that a standalone SPA flow would extend.
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` and
  `wp-plugin/wp-super-gallery/includes/class-wpsg-cli.php` already ship the
  JSON export/import baseline that binary export should build on rather than
  replace.
- `wp-plugin/wp-super-gallery/includes/class-wpsg-monitoring.php` already
  exposes health data that can absorb a bounded cache-readiness view.
- `src/components/Admin/SettingsPanel.tsx` and the PHP settings registry and
  sanitizer surfaces already provide the core configuration path for CORS,
  webhook, and deployment-oriented controls.

Phase 39 therefore groups five substantive tracks plus one explicit closeout
track:

1. **CORS allow-list (`P39-CO1`)** — turn the current filter-only cross-origin
   path into a first-party settings-backed policy surface.
2. **Standalone SPA auth (`P39-AU1`)** — replace localStorage-oriented JWT
   assumptions with an in-memory access token plus httpOnly refresh flow.
3. **Webhook automation (`P39-IN1`)** — add signed, retry-aware outbound event
   delivery for campaign workflows.
4. **Binary export portability (`P39-CM1`)** — extend campaign export so media
   can travel with the manifest for multi-instance deployments.
5. **Object-cache readiness (`P39-OC1`)** — add bounded deployment guidance,
   cache-health visibility, and warm-cache support.
6. **Backlog closure (`P39-CL1`)** — remove, narrow, or reclassify the Phase 39
   backlog entries in `docs/FUTURE_TASKS.md` once the track outcomes are known.

---

## Track P39-CO1 — CORS Origin Allow-List and Admin UI

### Problem

Cross-origin REST access is currently controlled by a filter-oriented path in
`wp-plugin/wp-super-gallery/wp-super-gallery.php`. That is flexible for custom
code, but it is not yet a first-party product surface. Operators do not have a
settings-backed allow-list, invalid origins are not managed through the normal
settings sanitizer pipeline, and wildcard-with-credentials behavior should not
remain an implicit configuration trap.

This is now the smallest missing piece in the cross-origin story. It should be
resolved before the standalone JWT track expands the number of deployments that
depend on cross-origin credentials and predictable header behavior.

### Goal

Provide a first-party, settings-backed CORS allow-list with clear admin
controls, origin sanitization, and explicit rejection of unsafe wildcard plus
credentials combinations.

### Implementation outline

1. Audit the current `wpsg_add_cors_headers()` and
   `wpsg_cors_allowed_origins` path in the main plugin bootstrap.
2. Define the stored setting shape for allowed origins and how it interacts
   with the existing filter-based extension point.
3. Add an admin configuration surface for the allow-list using the existing
   settings pipeline.
4. Sanitize and normalize origin entries, reject malformed values, and block
   wildcard configurations when credentials are enabled.
5. Update header emission and preflight behavior so the effective policy is
   deterministic and testable.
6. Extend PHP and admin-surface coverage for allowed origins, rejected origins,
   and credentials handling.

### Key files

- `wp-plugin/wp-super-gallery/wp-super-gallery.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-renderer.php`
- `src/components/Admin/SettingsPanel.tsx`
- `src/components/Admin/SettingsPanel.test.tsx`

### Pre-conditions

- The existing filter-based CORS path remains the behavioral baseline until the
  settings-backed policy is accepted.
- This track should stay aligned with `P39-AU1` so the auth track does not
  assume a different cross-origin policy model.

### Open follow-ups

- **Credentials toggle scope** — decide whether credentials behavior remains a
  fixed policy or becomes an explicit admin-facing control.
- **Filter precedence** — decide whether custom filters can widen the settings
  allow-list or should only further constrain it.

### Acceptance criteria

- Admins can configure an allowed-origins list through a first-party settings
  surface.
- Invalid origins are rejected through the normal settings sanitizer path.
- Wildcard plus credentials combinations are explicitly blocked.
- The runtime CORS headers reflect the effective configured policy.
- Coverage exists for allowed, rejected, and malformed origin cases.

### Status: Deferred — returned to FUTURE_TASKS (see D-1)

### Deferral rationale

P39-CO1 was implemented in full (settings registry, sanitizer, admin UI, PHP tests, React tests) but rolled back after manual verification revealed that CORS restriction provides no value for the primary deployment model.

**Why it does not matter for standard deployments:** When the plugin is embedded via WordPress shortcode, the gallery and the REST API are on the same origin — CORS is not triggered at all. WP core's own `rest_send_cors_headers()` already reflects any `Origin` header back unconditionally (registered at priority 10 on `rest_pre_serve_request`). Our plugin's hook, also at priority 10, ran *before* WP's handler, making `header_remove()` a no-op. Correcting for that required changing the hook priority to 20, adding complexity to fight a behavior that was irrelevant for the primary use case.

**Why the standalone SPA case is not ready:** The track's real value is gating cross-origin credentials to a specific allow-list when the gallery is deployed as a standalone SPA on a different origin. That deployment model requires preparatory work (routing changes, build/bundle config, WPSG_ENABLE_JWT env-var gate, deployment documentation) that is not yet in scope. Implementing CORS restriction without that foundation would protect nothing and add surface area.

**No code shipped.** All implementation files were reverted to pre-session state via `git checkout`. Test files created during the session were deleted. No database schema changes, settings keys, or filter registrations were left in place.

---

## Track P39-AU1 — JWT In-Memory Token Auth for Standalone SPA

### Problem

The plugin defaults to nonce-oriented authentication for embedded and same-origin
usage, which is the right baseline for standard WordPress deployments. That does
not solve the standalone SPA case on a different origin, where WordPress nonces
are unavailable and the remaining JWT path must avoid turning localStorage into
the long-lived source of truth for access credentials.

The missing work is therefore not "enable JWT again" in the abstract. It is to
define a secure cross-origin flow built around short-lived in-memory access
tokens, httpOnly refresh cookies, and a transport/provider path that can refresh
silently without widening the browser-side credential surface.

### Goal

Implement a secure standalone SPA auth path that uses in-memory access tokens,
httpOnly refresh cookies, and bounded refresh behavior, all within the
cross-origin policy accepted by `P39-CO1`.

### Implementation outline

1. Record the accepted cross-origin CORS policy from `P39-CO1` so the auth
   track does not assume permissive defaults.
2. Add the refresh-token endpoint and cookie issuance/clear behavior on the
   WordPress side.
3. Replace persistent browser token storage assumptions in
   `WpJwtProvider.ts` with module-scoped or otherwise in-memory access-token
   handling.
4. Add silent refresh behavior on boot, focus, and impending expiry while
   keeping the access token out of `localStorage`.
5. Ensure the HTTP transport continues to inject bearer tokens through the
   existing auth-provider surface rather than introducing parallel logic.
6. Extend server-side and client-side tests for login, refresh, logout,
   expiration, and rejected cross-origin credential cases.

### Key files

- `src/services/auth/WpJwtProvider.ts`
- `src/services/auth/WpJwtProvider.test.ts`
- `src/services/auth/AuthProvider.ts`
- `src/services/http/HttpTransportImpl.ts`
- `src/services/http/HttpTransportImpl.test.ts`
- `src/services/apiClient.ts`
- `src/services/apiClient.test.ts`
- `src/App.tsx`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `wp-plugin/wp-super-gallery/wp-super-gallery.php`

### Pre-conditions

- `P39-CO1` has defined the accepted cross-origin policy model.
- The standalone JWT path remains explicitly opt-in and should not change the
  nonce-first default for standard same-origin deployments.

### Open follow-ups

- **Refresh-token rotation** — decide whether Phase 39 requires one-time-use
  rotation or accepts a simpler refresh cookie lifecycle.
- **Refresh-cookie TTL** — decide whether convenience and security defaults are
  fixed or admin-configurable.
- **Revoke-all scope** — decide whether "log out everywhere" belongs in this
  track or should be deferred.

### Acceptance criteria

- Standalone SPA deployments have a documented and implementable auth path that
  does not rely on persistent browser storage for access tokens.
- Refresh behavior is bounded around httpOnly cookies and short-lived access
  tokens.
- The existing auth-provider and transport abstraction remains the bearer-token
  injection path.
- Same-origin nonce-based deployments remain the default.
- Coverage exists for login, refresh, expiry, and logout behavior.

### Status: Deferred — returned to FUTURE_TASKS (see JWT In-Memory Token Auth entry)

### Deferral rationale

P39-AU1 was gated on P39-CO1. Both tracks are being deferred together. The core reason is that the standalone SPA deployment model — the only context where cross-origin JWT auth is required — is not ready. The app was built around WordPress embedding and would need routing, build, and deployment preparation work before it can optionally operate as a standalone SPA. Implementing the auth layer first, without that foundation, would be building on an undefined surface. Revisit when there is a concrete standalone SPA deployment requirement and the preparatory work is in scope.

---

## Track P39-IN1 — Webhook Support for Campaign Events

### Problem

Campaign state changes, media lifecycle events, access events, and analytics
milestones currently remain inside the product boundary. That limits
automation-heavy deployments that need to react to gallery activity in external
systems such as Slack, Zapier, CRMs, or internal orchestration tools.

The work is not just "send a POST request when something happens." A first-party
webhook surface needs an explicit event model, signing strategy, retry policy,
and enough operator visibility that failures can be understood without reading
raw server logs.

### Goal

Add a first-party webhook system for campaign-related events with bounded
configuration, signed payloads, retry-aware delivery, and basic operator-facing
delivery visibility.

### Implementation outline

1. Define the first-pass event catalog and payload contracts.
2. Decide whether configuration is per URL, per event type, or a bounded hybrid
   model for the initial release.
3. Add admin configuration for webhook endpoints and signing secrets through the
   existing settings surfaces.
4. Implement outbound delivery, failure capture, and retry handling using a
   bounded asynchronous path.
5. Surface enough delivery state for operators to debug failures without
   requiring direct database inspection.
6. Extend coverage for payload generation, signature headers, retry behavior,
   and disabled or failing endpoints.

### Key files

- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-renderer.php`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-monitoring.php`
- `src/components/Admin/SettingsPanel.tsx`
- `src/components/Admin/SettingsPanel.test.tsx`

### Pre-conditions

- The first-pass event catalog and delivery model are accepted before the track
  starts implementing storage and retry behavior.

### Open follow-ups

- **Configuration model** — choose per-URL, per-event, or a constrained mixed
  approach.
- **Retry guarantees** — decide max attempts, schedule, and terminal-failure
  handling.
- **Signing and rotation** — decide how HMAC secrets are generated, stored, and
  rotated.

### Acceptance criteria

- A first-pass event catalog is defined and implemented through a first-party
  configuration surface.
- Outbound payloads are signed and failures are not silent.
- Retry behavior is explicit rather than best-effort by convention.
- Operators can see enough delivery state to understand success and failure.
- Coverage exists for payload generation, signing, and retry behavior.

### Status: Complete

### Implementation notes

**Design decisions accepted before implementation:**
- **Configuration model**: Bounded hybrid — up to 5 endpoints each with URL, HMAC secret, optional per-event-type filter, and enabled toggle. Stored in `wpsg_webhook_endpoints` option (separate from the main settings option).
- **Retry guarantees**: 3 attempts via WP-Cron — immediate → +5 min → +30 min. Terminal failures logged in the delivery ring buffer. Retry hook clears on plugin deactivation.
- **Signing**: Auto-generated 64-char hex HMAC-SHA256 secret per endpoint (`random_bytes(32)`). Full secret exposed once on creation/rotation. Signature delivered as `X-WPSG-Signature: sha256=<hex>` per the GitHub convention.

**New files:**
- `wp-plugin/wp-super-gallery/includes/class-wpsg-webhooks.php` — engine: event hooks, dispatch, delivery, retry scheduling, delivery log, HMAC signing.
- `wp-plugin/wp-super-gallery/tests/WPSG_P39IN1_Webhook_Test.php` — PHP test coverage for endpoint storage, delivery, filtering, signing, and all REST routes.
- `src/services/api/webhooksApi.ts` — dedicated API domain module.
- `src/components/Settings/WebhookSettingsSection.tsx` — standalone React component with endpoint list, add form, enable toggle, event filter, rotate secret, one-time secret modal.

**Modified files:**
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` — added `do_action` hooks at all 9 campaign-mutation callsites (create, update, archive, restore, delete, batch archive/restore, media add, media remove, access grant, access revoke). Added REST routes at `/webhooks`, `/webhooks/{index}`, `/webhooks/{index}/rotate-secret`, `/webhooks/delivery-log` with `require_admin` permission.
- `wp-plugin/wp-super-gallery/wp-super-gallery.php` — `require_once` + `add_action('init', ['WPSG_Webhooks', 'register'])` + deactivation hook clears the retry cron hook.
- `wp-plugin/wp-super-gallery/includes/class-wpsg-monitoring.php` — `get_health_data()` includes a `webhooks` summary key with endpoint count, delivery totals, success/failure counts, and last 10 deliveries.
- `src/services/apiClient.ts` — imports `WebhooksApi`, adds `listWebhookEndpoints`, `createWebhookEndpoint`, `updateWebhookEndpoint`, `deleteWebhookEndpoint`, `rotateWebhookSecret`, `listWebhookDeliveries` methods.
- `src/components/Admin/SettingsPanel.tsx` — new permanent "Integrations" tab (no `advancedSettingsEnabled` gate) renders `WebhookSettingsSection`.
- `src/components/Admin/SettingsPanel.test.tsx` — added `listWebhookEndpoints` mock and two new tests for the Integrations tab.

**Event catalog (first-pass, 9 events):** `campaign.created`, `campaign.updated`, `campaign.archived`, `campaign.restored`, `campaign.deleted`, `media.added`, `media.removed`, `access.granted`, `access.revoked`.

**Delivery log:** Bounded ring buffer of last 50 entries in `wpsg_webhook_delivery_log` option. Each entry records `deliveryId`, `event`, `url`, `attempt`, `success`, `statusCode`, `timestamp`. Also surfaced in `GET /admin/health` under `webhooks.recentDeliveries`.

**PHP tests:** 36 test cases covering endpoint storage, secret generation, masking, signing, URL sanitization, event filtering, delivery (success, failure, disabled, event-filter, all-events), payload shape, HMAC signature header, WP action hook wiring, log capping, and all 6 REST routes (list, create, update, delete, rotate, delivery log) including admin-only enforcement.

**Manual testing:** End-to-end verified against a live wp-env environment with webhook.site as the receiver. Confirmed: REST route availability, endpoint CRUD, `campaign.created` delivery and HMAC signature, event filter (all-events endpoint receives `campaign.created`; filtered endpoint suppresses it and fires on `campaign.archived` via the dedicated `/campaigns/{id}/archive` route), and secret rotation (new secret verifies the delivered signature; old secret does not). See `docs/testing/WEBHOOK_MANUAL_TEST.md`.

**Testing findings:**
- Admin routes require Application Password auth. No `X-WP-Nonce` is needed — `verify_admin_auth()` accepts HTTP Basic (Application Password) requests without a nonce. Nonces are only required for cookie-based browser sessions.
- The `manage_wpsg` capability is granted by the plugin activation hook. Re-run deactivate/activate after a fresh wp-env start.
- Archiving a campaign fires `campaign.archived` only via the dedicated `POST /campaigns/{id}/archive` route. A `PUT /campaigns/{id}` with `status: archived` fires `campaign.updated` instead.
- Deleting multiple endpoints in sequence must proceed from highest index to lowest. Each deletion calls `array_values()` internally, which re-indexes the stored array. Deleting index 0 first causes remaining endpoints to shift down, making subsequent index-based deletes target the wrong slot.

---

## Track P39-CM1 — Campaign Export Full Binary Media Export

### Problem

Campaign export currently serializes media by URL reference. That is sufficient
for deployments where the target environment can still reach the original asset
host, but it breaks down for multi-instance moves where the target WordPress
site cannot dereference the source CDN or media origin.

The missing work is therefore a portability layer on top of the existing JSON
manifest, not a replacement for the current export/import model. The export path
needs a binary packaging strategy, explicit limits, and a generation mode that
matches expected archive size and server capabilities.

### Goal

Extend campaign export with a binary media package and manifest flow so a
campaign can be moved between environments without assuming the source media
URLs remain reachable.

### Implementation outline

1. Audit the current JSON export/import baseline in the REST and CLI surfaces.
2. Decide whether binary packaging requires `ext-zip` and whether generation is
   synchronous, backgrounded, or conditionally split by size.
3. Package the JSON manifest plus trusted media binaries into an archive format
   that can be imported without widening the SSRF surface.
4. Add bounded size limits, dependency checks, and failure messaging so export
   behavior is operationally predictable.
5. Extend the import path to understand the packaged archive and attach media
   in the target environment.
6. Add REST, CLI, and manual QA coverage for generation, limits, dependency
   failures, and round-trip behavior.

### Key files

- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-cli.php`
- `wp-plugin/wp-super-gallery/tests/WPSG_REST_Extended_Test.php`
- `wp-plugin/wp-super-gallery/tests/WPSG_CLI_Test.php`
- `src/hooks/useAdminCampaignActions.ts`

### Pre-conditions

- The export packaging policy is accepted before implementation begins.
- The track must preserve the current JSON export/import baseline rather than
  silently replacing it.

### Open follow-ups

- **Archive dependency** — decide whether `ext-zip` is required or whether a
  fallback path exists.
- **Size limits** — decide the default and maximum package size policy.
- **Generation mode** — decide synchronous versus background generation and the
  operator-facing progress story.

### Acceptance criteria

- The existing JSON export/import path remains intact.
- Binary export packages a manifest plus media payloads in a bounded format.
- Size limits and dependency failures are surfaced clearly.
- Import behavior for packaged exports is defined and testable.
- Coverage exists for generation, failure, and round-trip cases.

### Status: Complete

### Implementation notes

**Design decisions:**
- **Archive dependency**: `ext-zip` (`ZipArchive`) required. Engine checks availability at export request time and returns a clear 500 if missing.
- **Size limit**: 100 MB total. HEAD check used to reject early; per-file and cumulative checks during download.
- **Generation mode**: Background via WP-Cron (REST path) + synchronous for CLI.
- **Modular engine**: `WPSG_Export_Engine` owns all job plumbing and ZIP packaging. Future export types (audit, media library) hand the engine a manifest + media list; the engine handles the rest.

**New files:**
- `wp-plugin/wp-super-gallery/includes/class-wpsg-export-engine.php` — reusable background export job manager: `create_job()`, `get_job()`, `delete_job()`, `process_job()` (WP-Cron callback), `cleanup_expired_jobs()`, `get_media_filename()` (deterministic naming shared by manifest builder and ZIP builder), `check_zip_available()`. Job state stored in transients; job IDs tracked in `wpsg_export_job_index` option.
- `wp-plugin/wp-super-gallery/tests/WPSG_P39CM1_Export_Test.php` — 24 PHP tests covering engine CRUD, ZIP building, size-limit enforcement, cleanup, all 5 REST routes, manifest structure, filename consistency between manifest and ZIP.
- `src/services/api/exportApi.ts` — `ExportApi` domain module: `startCampaignBinaryExport()`, `getExportJob()`, `deleteExportJob()`, `downloadExportJob()` (fetch with auth headers → blob download).
- `wp-plugin/wp-super-gallery/tests/stubs/1x1.jpg` — minimal JPEG stub for HTTP-intercepted media fetch tests.

**Modified files:**
- `wp-plugin/wp-super-gallery/wp-super-gallery.php` — `require_once` + `add_action('init', ['WPSG_Export_Engine', 'register'])` + deactivation cleanup for both `JOB_PROCESS_HOOK` and `JOB_CLEANUP_HOOK`.
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` — 5 new REST routes (`POST /campaigns/{id}/export/binary`, `GET /export-jobs/{id}`, `DELETE /export-jobs/{id}`, `GET /export-jobs/{id}/download`, `POST /campaigns/import/binary`) with corresponding callbacks. Binary import is SSRF-safe: reads media from the ZIP archive, never follows URLs from the manifest.
- `wp-plugin/wp-super-gallery/includes/class-wpsg-cli.php` — extended `campaign_export` with `--format=binary [--output=path]` (synchronous: creates job then processes immediately, no WP-Cron needed in CLI context); extended `campaign_import` to auto-detect `.zip` extension and call `campaign_import_binary()`.
- `src/services/apiClient.ts` — imports `ExportApi`, exposes `startCampaignBinaryExport`, `getExportJob`, `deleteExportJob`, `downloadExportJob`.
- `src/hooks/useAdminCampaignActions.ts` — `handleBinaryExportCampaign`: starts job, polls every 3s up to 5 min, then calls `downloadExportJob()` and cleans up the server-side job. `binaryExportingIds` set tracks in-flight exports per campaign.

**ZIP archive format (manifest version 2):**
```
campaign-{id}.zip
├── manifest.json   (version: 2; media_references include "filename" field)
└── media/
    ├── media-{id1}.jpg
    └── media-{id2}.png
```

**Import flow:** ZIP upload → extract `manifest.json` → validate version 2 → create campaign post → sideload each `media/{filename}` via `media_handle_sideload()` (WP attachment creation) → store attachment IDs + URLs in `media_items` meta.

**PHP test count:** 27 tests in `WPSG_P39CM1_Export_Test.php` (3 added post-implementation). Full suite: 807 tests — clean.

**Future extensions** (planned via FUTURE_TASKS): audit log binary export, media library binary export. Both would reuse `WPSG_Export_Engine` with a different manifest builder.

**Post-implementation fixes (found during manual testing):**

- **`verify_admin_auth()` rejected Application Passwords** — The auth gate checked for Bearer tokens or nonces only. WordPress Application Password auth uses HTTP Basic; WP authenticates it before the permission callback runs, so no CSRF nonce is needed. Added an explicit Basic branch: `if Authorization starts with 'Basic' → return is_user_logged_in()`. (`class-wpsg-rest.php`)
- **`process_job()` catch too narrow** — `catch (RuntimeException $e)` did not catch PHP `Error` or other `Throwable` subclasses. A crash inside `build_zip()` left jobs permanently stuck in `processing` status. Broadened to `catch (\Throwable $e)` so all failures land in `failed` with an error message. (`class-wpsg-export-engine.php`)
- **`reset_job()` added** — Public static method to restore a stuck job to `pending` so it can be retried without creating a new export. Used for manual recovery and tested in `WPSG_P39CM1_Export_Test.php`. (`class-wpsg-export-engine.php`)
- **Manual test guide auth/cron fixes** — `$AUTH` bash string variable (broken expansion) replaced with `AUTH=(-u "admin:$APP_PASS")` array. Nonce requirement removed throughout (Application Passwords authenticate at HTTP level). WP-Cron trigger (`wp cron event run`) replaced with `wp eval WPSG_Export_Engine::process_job(...)` — idempotent and works whether or not the cron event was already consumed by `spawn_cron()`. (`docs/testing/BINARY_EXPORT_MANUAL_TEST.md`)

---

## Track P39-OC1 — Redis/Memcached Object-Cache Guidance and Health Surface

### Problem

Most deployments can rely on WordPress' default database-backed object cache,
but higher-traffic embeds and automation-heavy environments need clearer
guidance on when that becomes a bottleneck and what the recommended object-cache
deployment shape should be.

The codebase already exposes health data and monitoring surfaces, but it does
not yet present a bounded object-cache readiness view or formalize the expected
cache policy for settings, access checks, and operational diagnostics.

### Goal

Provide a bounded deployment-readiness track for object-cache usage, including
configuration guidance, a warm-cache utility for frequently read settings, and a
cache-oriented health surface that helps operators understand their setup.

### Implementation outline

1. Audit the current monitoring and health-data surfaces to identify where cache
   readiness can be surfaced without redesigning the whole operational panel.
2. Document recommended Redis or Memcached setup, plus APCu guidance for
   single-server deployments.
3. Add a bounded cache-health section that reports what can be known safely in
   environments with and without a persistent object cache.
4. Add a warm-cache utility for high-read settings and other bounded hot paths.
5. Record cache TTL and bypass guidance for access-sensitive checks so
   revocation behavior remains coherent.
6. Extend tests and manual QA for cache-health output and warm-cache behavior.

### Key files

- `wp-plugin/wp-super-gallery/includes/class-wpsg-monitoring.php`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php`
- `src/components/Admin/SettingsPanel.tsx`
- `src/components/Settings/AdvancedSettingsSection.tsx`
- `src/components/Admin/SettingsPanel.test.tsx`

### Pre-conditions

- This track should remain a bounded readiness and observability effort, not a
  broad rewrite of the plugin's caching architecture.

### Open follow-ups

- **Access-check freshness** — decide when access-control reads should bypass
  cache or use short TTLs to keep revocations timely.
- **Stats availability** — decide what to surface when the underlying cache
  implementation does not expose useful stats.

### Acceptance criteria

- [x] Operators have first-party guidance for Redis/Memcached and an APCu fallback.
- [x] The health surface exposes bounded cache-readiness information.
- [x] A warm-cache utility exists for identified high-read settings paths.
- [x] Cache guidance for access-sensitive data is explicit.
- [x] Coverage exists for health-data output and non-persistent-cache fallback.

### Implementation notes

**PHP backend (`class-wpsg-monitoring.php`):**
- Added `get_object_cache_health()` — detects `wp_using_ext_object_cache()` (cast to
  `bool`), identifies backend from `get_class($GLOBALS['wp_object_cache'])` (normalized to
  `redis | memcached | apcu | unknown`), and safely probes `stats()` / `get_stats()`
  guarded by `method_exists()` and `\Throwable` catch. Returns a four-key array:
  `persistent`, `backend`, `stats_available`, `stats`.
- Extended `get_health_data()` to include `objectCache` key via
  `get_object_cache_health()`.
- Added `warm_settings()` — on miss in the `wpsg_settings` cache group, calls
  `get_option('wpsg_settings')` and stores the result with `wp_cache_set` at a 1-hour
  TTL. Hooked to `init` at priority 20 from `register()`.

**PHP constants (`class-wpsg-rest.php`):**
- Added `CACHE_TTL_SETTINGS = 3600` and `CACHE_TTL_ACCESS = 60` class constants with
  PHPDoc documenting the access-check bypass rule (≤60 s TTL or bypass for any
  grant/role check so revocations propagate quickly).

**Documentation (`docs/object-cache-setup.md`):**
- New file covering Redis (drop-in + wp-config constants), Memcached (Memcached Redux),
  APCu/ZapCu (single-server only), traffic thresholds, plugin cache groups
  (`wpsg_settings`, `wpsg_rate_limit`), and the access-control cache policy.
- Verified against live installs: Redis via redis-cache plugin, APCu via ZapCu, Memcached
  via Memcached Redux. Key findings from real-world testing:
  - ZapCu auto-installs the drop-in on activation; no manual file copy needed.
  - Drop-in plugins (Memcached Redux) must NOT be activated as normal WP plugins —
    copy the drop-in file directly to `wp-content/` instead.
  - `$memcached_servers` format for Memcached Redux must use `'host:port'` strings
    (`['127.0.0.1:11211']`), not the old array-of-arrays format (`[['127.0.0.1', 11211]]`)
    used by the deprecated `memcache` (no `d`) plugin — the old format throws a
    `TypeError` on PHP 8 in Memcached Redux's `WP_Object_Cache::__construct()`.

**React (`AdvancedSettingsSection.tsx`, `SettingsPanel.tsx`):**
- Added "Object Cache" accordion section (value `adv-cache`) to `AdvancedSettingsSection`.
  Uses `useQuery` (`enabled: mounted.has('adv-cache')`) against the existing
  `/admin/health` endpoint, lazy-loaded on accordion open.
- Displays: persistent badge (Active / Not detected), backend label badge (Redis /
  Memcached / APCu / Unknown), guidance alert for non-persistent deployments, and per-key
  stats rows when `stats_available` is true.
- `AdvancedSettingsSection` now receives `apiClient: ApiClient` prop; call site in
  `SettingsPanel.tsx` updated accordingly.
- `AdminApi` extended with `getHealthData()` and `ObjectCacheHealth` /
  `HealthDataResponse` types; both re-exported from `apiClient.ts`.

**Tests:**
- `WPSG_P39OC1_CacheHealth_Test.php` — 6 assertions covering non-persistent shape,
  key ordering, inclusion in `get_health_data()`, REST endpoint shape, `warm_settings()`
  primes cache, and idempotency.
- `SettingsPanel.test.tsx` — 2 new tests: "Not detected" badge on non-persistent mock,
  "Active" + "Redis" badge on persistent mock. `getHealthData` added to base mock client.

**Full suite results:** 813/813 PHP tests ✓, 58/58 React tests ✓.

**Rationale on `wp_using_ext_object_cache()` cast:** The function returns the global
`$wp_using_ext_object_cache` which is `null` when unset (not `false`). Casting to `bool`
normalises this to `false` in non-persistent environments and keeps the API shape
strictly typed.

### Status: Complete

---

## Track P39-CL1 — Phase 39 Backlog Closure and FUTURE_TASKS Cleanup

### Problem

Phase-owned items can linger in `docs/FUTURE_TASKS.md` after they are promoted,
partially shipped, rejected, or narrowed. That creates planning drift and makes
the backlog look larger and less reliable than it really is.

Phase 39 already bundles several items from `docs/FUTURE_TASKS.md`. If those
tracks land, narrow, or close without a dedicated cleanup pass, the document
will immediately start drifting again. The backlog cleanup therefore needs to be
an explicit track, not an assumed afterthought.

### Goal

Audit the outcome of each substantive Phase 39 track and then remove, narrow,
or reclassify the corresponding `docs/FUTURE_TASKS.md` entries so the backlog
reflects the actual disposition of the work.

### Implementation outline

1. Review the recorded outcome of `P39-CO1`, `P39-AU1`, `P39-IN1`, `P39-CM1`,
   and `P39-OC1`.
2. For each track, decide whether the originating backlog item should be
   removed, narrowed to residual work, moved into the ownership snapshot, or
   retained as a long-tail reference.
3. Update `docs/FUTURE_TASKS.md` to remove duplicate detailed sections or revise
   them to reflect only the remaining unresolved scope.
4. Refresh the ownership snapshot and document metadata so the backlog stays
   internally consistent.
5. Verify that no Phase 39-owned items remain duplicated as active backlog
   entries unless residual scope explicitly remains.

### Key files

- `docs/FUTURE_TASKS.md`
- `docs/PHASE39_REPORT.md`

### Pre-conditions

- `P39-CO1`, `P39-AU1`, `P39-IN1`, `P39-CM1`, and `P39-OC1` all have recorded
  outcomes: shipped, narrowed, superseded, or closed.

### Open follow-ups

- **Residual scope policy** — decide how small follow-on work is represented if
  a Phase 39 track ships most but not all of the original backlog item.
- **Ownership snapshot wording** — decide whether partially shipped tracks move
  to the ownership snapshot or remain only as narrowed backlog references.

### Acceptance criteria

- Each substantive Phase 39 track has a recorded backlog disposition.
- `docs/FUTURE_TASKS.md` no longer duplicates Phase 39-owned work as active
  backlog unless explicit residual scope remains.
- The ownership snapshot and document metadata reflect the completed cleanup.
- The backlog is narrower and more accurate after the phase than before it.

### Implementation notes

**Dispositions applied to `docs/FUTURE_TASKS.md`:**

| Track | Originating backlog entry | Disposition |
|-------|--------------------------|-------------|
| P39-CO1 | D-1: CORS Origin Allow-List & Admin UI | Retained — deferral note added June 1; entry narrowed to standalone SPA context only |
| P39-AU1 | JWT In-Memory Token Auth (Standalone SPA) | Retained — deferral note added June 1; gated on P39-CO1 and standalone SPA deployment model |
| P39-IN1 | Webhook Support for Campaign Events | **Removed** — fully shipped |
| P39-CM1 | (No stale entry to remove; follow-on items Audit Log Binary Export and Media Library Binary Export added as new backlog entries) | No action needed |
| P39-OC1 | Redis/Memcached Object Cache | **Removed** — fully shipped; D-12 (rate-limiter object-cache docs) also retired |

**Residual scope policy adopted:** Follow-on items identified during a track's implementation (e.g. audit-log binary export, media library export) are added as new backlog entries and do not block the originating track from being removed. The originating entry is removed once the core scope ships.

**Ownership snapshot updated:** P39-IN1 and P39-OC1 added to the "Recently promoted and now phase-owned" table.

### Status: Complete

---

## PR #54 Review — Copilot Comments

Five Copilot threads addressed:

| Thread | File | Decision | Rationale |
|--------|------|----------|-----------|
| `sslverify => false` on HEAD (size check) | `class-wpsg-export-engine.php:156` | **Accept — removed** | Disabling cert validation exposes the content-length value to MITM tampering; WP default (`true`) is correct. |
| `sslverify => false` on GET (media download) | `class-wpsg-export-engine.php:169` | **Accept — removed** | Same security concern: MITM could substitute media content in the ZIP. Removed; WP default applies. |
| `warm_settings()` false-positive cache miss | `class-wpsg-monitoring.php:282` | **Accept — fixed** | `!== false` cannot distinguish a stored `false` from a miss. Switched to `$found` out-parameter from `wp_cache_get()`. While `wpsg_settings` is unlikely to be `false`, the API contract should be correct. |
| `create_webhook_endpoint()` `enabled` coercion | `class-wpsg-rest.php:7206` | **Accept — fixed** | `!== false` treats `0`/`'0'` as enabled. Aligned with update endpoint: `null` → default `true`, otherwise `(bool)` cast. |
| WEBHOOK_MANUAL_TEST.md nonce prerequisite | `docs/testing/WEBHOOK_MANUAL_TEST.md:41` | **Accept — fixed** | Guide incorrectly stated nonce is required alongside Application Password. `verify_admin_auth()` explicitly skips the nonce for HTTP Basic requests. Removed nonce from section 4 and all curl commands; matches binary export guide wording. |

**Post-review CI fix — PHP 8.2 stat cache (`class-wpsg-export-engine.php`):**

The streaming-download refactor (round 4) introduced a fallback path for HTTP transports that intercept `pre_http_request` and return an in-memory response without writing to the stream file. That path called `file_put_contents($tmp, $body)` and then immediately re-read `filesize($tmp)`. On PHP 8.2, PHP's stat cache retains the `0` it recorded when `wp_tempnam()` created the empty file; the subsequent `filesize()` hits the cache and returns `0`, causing every media file to be silently skipped (jobs ended `'complete'` with an empty ZIP instead of `'failed'`). PHP 8.3 and 8.4 evict that cache entry fast enough that the tests passed. Fixed by adding `clearstatcache(true, $tmp)` between the write and the size read.

**Round 9 — 3 threads (invalid events silent broadening, blob URL revocation):**

| Thread | File | Decision | Rationale |
|--------|------|----------|-----------|
| Invalid events → empty array → "all events" on create | `class-wpsg-rest.php:7196` | **Accept** | If the client sends a non-empty events list but none are recognised, `sanitize_events()` silently returns `[]`, which the dispatcher treats as "deliver all events". Added a 400 guard: reject when raw events are non-empty but sanitized result is empty. |
| Same issue on update | `class-wpsg-rest.php:7240` | **Accept** | Identical guard added to `update_webhook_endpoint`. Extracted to a local variable `$sanitized_events` to avoid double-call. |
| Blob URL revocation 100ms too short | `exportApi.ts:58` | **Accept** | 100ms can race the browser's async download read for large ZIPs, especially in Safari. Increased to 30 s — well within any reasonable download-initiation window. The blob is in-memory so holding the reference longer has no meaningful cost. |

**Round 8 — 3 threads (update endpoint bool coercion, doc wording x2):**

| Thread | File | Decision | Rationale |
|--------|------|----------|-----------|
| `update_webhook_endpoint` `(bool)` cast for `enabled` | `class-wpsg-rest.php:7244` | **Accept** | Same issue fixed in `create_webhook_endpoint` last round — `(bool) "false"` is `true`. Applied `is_truthy_param()` for consistent behaviour across both endpoints. |
| "database-backed cache" in doc intro | `docs/object-cache-setup.md:3` | **Accept** | WP default object cache is non-persistent in-memory, not database-backed. Changed to "default non-persistent object cache". |
| "database-backed cache" repeated in when-to-add section | `docs/object-cache-setup.md:25` | **Accept** | Same wording issue. Reworded to clarify the persistence property: values cached only for the lifetime of the current request, so every subsequent request is a cold DB read. |

**Round 7 — 5 threads (deactivation hook, SSRF on GET, ZIP leak, boolean coercion, UI copy):**

| Thread | File | Decision | Rationale |
|--------|------|----------|-----------|
| `wp_unschedule_hook()` claimed non-existent | `wp-super-gallery.php:74` | **Partial accept** | Copilot's factual claim is wrong — `wp_unschedule_hook()` has been in WP core since 4.9.0. However, for codebase consistency (all other deactivation hooks use `wp_clear_scheduled_hook()`) and since WP 6.4+ minimum means both are equivalent, switched to `wp_clear_scheduled_hook()`. |
| `wp_remote_get()` → `wp_safe_remote_get()` | `class-wpsg-export-engine.php:183` | **Accept** | The media-download step uses `wp_remote_get()` against URLs from the manifest; same SSRF surface as the HEAD request fixed in round 6. Changed to `wp_safe_remote_get()`. |
| Orphaned ZIP files when transient expires | `class-wpsg-export-engine.php:240` | **Accept** | When a transient expires naturally its `zip_path` is lost, so `cleanup_expired_jobs()` and `delete_job()` can't delete the file. Added `expected_zip_path($id)` private helper (path is deterministic from job ID) and used it as a fallback in both methods. |
| `(bool)` cast for `enabled` → `is_truthy_param()` | `class-wpsg-rest.php:7198` | **Accept** | `(bool) "false"` yields `true`; the existing `is_truthy_param()` helper handles string `"false"/"0"/"no"/"off"` correctly. Applied it; kept `null → true` default unchanged. |
| "database-backed cache" wording | `AdvancedSettingsSection.tsx:393` | **Accept** | WordPress default object cache is non-persistent in-memory (not database-backed). Reworded to "default in-memory cache, which is discarded on every request". |

**Round 6 — 7 threads (SSRF, silent skip, layout template UUID):**

| Thread | File | Decision | Rationale |
|--------|------|----------|-----------|
| `wp_remote_post()` → `wp_safe_remote_post()` | `class-wpsg-webhooks.php:125` | **Accept** | Webhook URLs are user-configured and triggered server-side; the `wp_remote_post()` variant will call private/loopback IPs. `wp_safe_remote_post()` blocks those by default and allows operators to relax via filter. |
| Silent skip on failed media fetch | `class-wpsg-export-engine.php:183` | **Accept — partial** | Copilot suggested a hard failure; instead tracked skipped items and appended `skipped_media.json` to the ZIP. Hard failure would block export entirely if any one asset is temporarily unavailable. Recording skipped items is transparent without being brittle, and callers can inspect the file. |
| `wp_remote_head()` → `wp_safe_remote_head()` | `class-wpsg-export-engine.php:156` | **Accept** | Same SSRF surface as the POST fix; the size-preflight HEAD request against a user-provided media URL also needs to reject private/loopback targets. |
| Export: `get_post(intval($template_id))` | `class-wpsg-rest.php:2136` | **Accept** | `_wpsg_layout_binding_template_id` stores a UUID, so `intval()` produces `0` and `get_post(0)` returns `null`. Replaced with `WPSG_Layout_Templates::get($template_id)` which looks up by UUID slug and returns the full template array (including `slots`, `overlays`, all background fields). |
| Import: wrong CPT + post ID stored as UUID | `class-wpsg-rest.php:2341` | **Accept** | Import used `wp_insert_post(['post_type' => 'wpsg_layout_template'])` (wrong CPT, no meta registration) and stored the numeric post ID in `_wpsg_layout_binding_template_id`. Replaced with `WPSG_Layout_Templates::create()` which uses the correct CPT (`wpsg_layout_tpl`), stores data in `_wpsg_template_data`, and returns the UUID. Also rewrites `layoutBinding.templateId` to the new UUID. Legacy manifest support added (`title` → `name` fallback). |
| CLI export: same `intval()` UUID bug | `class-wpsg-cli.php:266` | **Accept** | Identical fix: `WPSG_Layout_Templates::get($template_id)`. |
| CLI import: same wrong CPT + post ID | `class-wpsg-cli.php:433 & 550` | **Accept** | Both JSON and binary CLI import paths fixed identically to the REST import path using `WPSG_Layout_Templates::create()`. |

---

## Outcome

Phase 39 delivered four of five substantive tracks. P39-CO1 and P39-AU1 were
rolled back together after implementation revealed the primary deployment model
(embedded WP shortcode) is same-origin and gains nothing from explicit CORS
restriction; both are retained in the backlog with deferral notes gating them
on a concrete standalone SPA deployment requirement.

P39-IN1 shipped webhook automation with HMAC-signed delivery, a retry queue,
and WP-CLI management commands. P39-CM1 shipped `WPSG_Export_Engine` for
background ZIP generation and unlocked two new follow-on export types. P39-OC1
shipped Redis/APCu/Memcached deployment docs, a health surface in the admin
panel, warm-cache and TTL-policy primitives, and a PHPUnit + React test suite.
P39-CL1 closed the backlog loop.

---

## Related Planning

- Follows: `docs/PHASE38_REPORT.md` as the next planning pass after the Admin
  Media expansion tracks.
- Promoted from: `docs/FUTURE_TASKS.md` (CORS origin allow-list, standalone
  SPA JWT auth, webhook support, full binary export, and object-cache
  guidance).
- Source anchors: `wp-plugin/wp-super-gallery/wp-super-gallery.php` for CORS;
  `src/services/auth/WpJwtProvider.ts` and
  `src/services/http/HttpTransportImpl.ts` for auth;
  `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` and
  `wp-plugin/wp-super-gallery/includes/class-wpsg-cli.php` for export;
  `wp-plugin/wp-super-gallery/includes/class-wpsg-monitoring.php` for cache
  health; `src/components/Admin/SettingsPanel.tsx` plus the PHP settings
  registry and sanitizer surfaces for admin configuration.
- Gating rules:
  - **P39-AU1** should align with the accepted cross-origin policy from
    **P39-CO1**.
  - **P39-CL1** should not begin until the other Phase 39 tracks have recorded
    outcomes one way or the other.