# Phase 39 — Enterprise Scale & Integration Tracks

**Status:** Planned
**Created:** 2026-06-01
**Last updated:** 2026-06-01

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P39-CO1 | CORS origin allow-list and admin UI | Planned · align with P39-AU1 | M |
| P39-AU1 | JWT in-memory token auth for standalone SPA | Planned · gated on accepted cross-origin policy decisions | L |
| P39-IN1 | Webhook support for campaign events | Planned · requires delivery/signing decisions | L |
| P39-CM1 | Campaign export full binary media export | Planned · requires export-mode and packaging decisions | M |
| P39-OC1 | Redis/Memcached object-cache guidance and health surface | Planned | M |
| P39-CL1 | Phase 39 backlog closure and FUTURE_TASKS cleanup | Planned · do after other P39 tracks | S |

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

### Status: Planned · align with P39-AU1

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

### Status: Planned · gated on accepted cross-origin policy decisions

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

### Status: Planned · requires delivery/signing decisions

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

### Status: Planned · requires export-mode and packaging decisions

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

- Operators have first-party guidance for Redis/Memcached and an APCu fallback.
- The health surface exposes bounded cache-readiness information.
- A warm-cache utility exists for identified high-read settings paths.
- Cache guidance for access-sensitive data is explicit.
- Coverage exists for health-data output and non-persistent-cache fallback.

### Status: Planned

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

### Status: Planned · do after other P39 tracks

---

## Implementation Notes

_Updated as tracks land._

### Open follow-ups

Track-level follow-ups remain in the sections above until the cross-origin,
export, automation, and cache-readiness decisions are resolved and the cleanup
track can close the loop in `docs/FUTURE_TASKS.md`.

---

## Outcome

_To be filled when Phase 39 is marked Complete._

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