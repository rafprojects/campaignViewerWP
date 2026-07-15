# Phase 63 - Rate Limiting, Security Header & SSRF Hardening Completion

**Status:** Planned
**Created:** 2026-07-14
**Last updated:** 2026-07-14

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P63-A | Rate limiting silently no-ops without a persistent object cache | Planned | Small |
| P63-B | Consolidate the two rate-limiter implementations; fix client-IP handling | Planned | Small-Medium |
| P63-C | Security & asset-cache headers are dead code (hook-timing) | Planned | Small-Medium |
| P63-D | CSV formula-injection neutralization in audit-log export | Planned | Tiny |
| P63-E | Export-job read/download gate stamped to creator's tier | Planned | Small |
| P63-F | `is_private_ip()` reserved-range completeness | Planned | Tiny |
| P63-G | Bearer-auth branch hardening (defense-in-depth) | Planned | Tiny-Small |
| P63-H | Provider handlers use `wp_safe_remote_get` | Planned | Tiny |

---

## Rationale

The 2026-07-13 full PHP review ([PHP_REVIEW_FINDINGS.md](PHP_REVIEW_FINDINGS.md)) found that most of the plugin's advertised hardening — rate limiting, security headers, IP-based SSRF/reserved-range checks — is sound in *design* but silently inert or incomplete in *practice*. Every claim scheduled into this phase was independently re-verified against current source (not just trusted from the review doc) on 2026-07-14 before being written up here.

1. **What triggered it.** Two of the highest-impact items from the review (A-1, A-2) are both "the code is right, the wiring is wrong" bugs: a `function_exists()` check that's always true on any WP install, and hook registrations that fire after the hook they target has already run. Neither is caught by the existing test suite because tests call the functions directly rather than exercising a real request lifecycle.
2. **Why it belongs together.** Every track here lives in `WPSG_REST_Base`, the rate-limiter classes, or the oEmbed provider handlers — the same small cluster of security-critical files — and all are "restore/complete hardening that's already designed," not new security surface.
3. **Success.** Rate limiting actually throttles abusive traffic on a stock WP host (no Redis/Memcached required); security and cache headers are actually emitted on shortcode pages and REST responses; the SSRF/IP-trust helpers are complete and consistent.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Rate-limiter consolidation scope | P63-B consolidates client-IP resolution onto `WPSG_Rate_Limiter::get_client_ip()` and namespaces the two classes' `wpsg_rate_limit_window` filters distinctly. Full storage-backend unification (making `WPSG_Rate_Limiter` the single backend for both oEmbed and REST-base limiting) is left as a Follow-On Candidate — P63-A's fix (gate on `wp_using_ext_object_cache()`) is sufficient to restore correctness without that larger refactor. |
| B | Bearer-auth fix depth | **Resolved (user, 2026-07-14): Option 2 (tighten).** Only honor the `Bearer ` skip when `is_user_logged_in()` is true AND a filterable guard confirms an external token-auth integration actually validated the credential — default `false` preserves today's stricter (nonce-required) behavior for sites with no JWT integration wired up. See Track P63-G. |
| C | P63-C static-asset header fix | **Resolved (user, 2026-07-14): both.** Ship a checked-in `assets/.htaccess` (restores headers on Apache out of the box) AND document the nginx-equivalent snippet in packaging docs. See Track P63-C. |

## Execution Priority

All 8 tracks were independently re-verified against current source on 2026-07-14 (see each track's Validation Notes) — the priority order below is unchanged by that verification, now formalized into batches for a separate executing agent/session. Batches 2-4 are mutually independent and may run in any relative order to Batch 1; Batch 1 and Batch 5 are fixed at the start and end respectively.

1. **Batch 1 (sequential, do first): P63-A → P63-B.** Same function cluster in `class-wpsg-rest-base.php` (`rate_limit_check()`); P63-A's regression test should land cleanly before P63-B changes the same code path. Do not interleave.
2. **Batch 2 (independent — may run before/after/parallel with Batch 1): P63-C.** Three-part hook-timing fix (shortcode pages, REST responses, static assets); separate file cluster (`wp-super-gallery.php`, `class-wpsg-embed.php`, new `assets/.htaccess`).
3. **Batch 3 (independent, small — batch together): P63-D, P63-F, P63-H.** No dependencies between them. Advisory: P63-F touches `class-wpsg-rest-base.php` (`is_private_ip()`, a different function than A/B's `rate_limit_check()`) — sequence after Batch 1 completes to avoid mid-flight edits to the same file.
4. **Batch 4 (independent): P63-E.** Touches the export-job/permissions files (`class-wpsg-export-engine.php`, `class-wpsg-export-controller.php`, `class-wpsg-permissions.php`).
5. **Batch 5 (last): P63-G.** Lowest urgency (not practically exploitable today per its Validation Notes); Key Decision B is now resolved (Option 2, tighten) so this is no longer scope-blocked — kept last purely for priority ordering.

---

## Track P63-A - Rate limiting is a silent no-op without a persistent object cache

*Source: PHP_REVIEW_FINDINGS.md § A-1 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`WPSG_REST_Base::rate_limit_check()` (`includes/rest/class-wpsg-rest-base.php:132`) selects its counter backend with `if (function_exists('wp_cache_incr'))`. WordPress core defines `wp_cache_incr()` unconditionally — even for the default non-persistent, per-request array cache — so the transient-based fallback (lines 165-198) is unreachable on any host without a real persistent object-cache drop-in (Redis/Memcached).

This is stronger than plain dead code: on the majority of WP hosts (no persistent object-cache drop-in), the `wp_cache_incr` branch runs on every request, but WordPress's default `WP_Object_Cache` is a per-request, in-memory array that does **not** persist across requests — so the counter resets to 1 on every single request. `rate_limit_public()` / `rate_limit_authenticated()` / `rate_limit_magic_approve()` therefore enforce nothing, not because the wrong branch runs, but because the branch that *does* run is silently non-functional across requests.

### Fix

- Gate the object-cache path on `wp_using_ext_object_cache()` instead of `function_exists('wp_cache_incr')`.
- No change needed to the transient fallback itself — it's already correct, just currently unreachable.

### Acceptance criteria

- On a host with no persistent object-cache drop-in, hitting a public rate-limited endpoint (e.g. `campaigns.list`) past its configured limit returns 429.
- On a host with `wp_using_ext_object_cache()` true, the object-cache path is used (no behavior regression for Redis/Memcached hosts).

### Validation

- New PHPUnit test asserting the transient path is taken when `wp_using_ext_object_cache()` returns false. Because the bug is a cross-request persistence failure, the test must simulate separate requests (e.g. reset any static/in-memory counter state between calls) rather than only asserting which branch is entered within a single process.
- Existing rate-limit test suite stays green.

### Validation Notes (2026-07-14)

Independently re-verified against current source (not just trusted from the review doc):
- Confirmed exact branch selector at `class-wpsg-rest-base.php:132`: `if (function_exists('wp_cache_incr'))`.
- Confirmed `wp_using_ext_object_cache()` is a real, always-available WP core function, and the plugin already uses it elsewhere (`includes/class-wpsg-monitoring.php:179`) — it is the correct replacement API.
- Confirmed the transient fallback (lines 165-198) is intact and logically correct (reads/resets/increments a `get_transient()` bucket, returns `WP_Error('wpsg_rate_limited', ..., ['status' => 429])` when exceeded).
- Confirmed against installed WP core (`wp-includes/cache.php`, `class-wp-object-cache.php`) that `wp_cache_incr()`/`WP_Object_Cache::incr()` are unconditionally defined and that the default object cache is non-persistent per-request array storage.

---

## Track P63-B - Consolidate the two rate-limiter implementations; fix client-IP handling

*Source: PHP_REVIEW_FINDINGS.md § B-3 — re-verified 2026-07-14, confirmed accurate. Verification note: Phase 48's P48-D added a `space_id` key segment to `rate_limit_authenticated()` specifically — that already-shipped fix is orthogonal to this track (it doesn't touch client-IP resolution) and does not reduce this track's scope.*

### Problem

`WPSG_Rate_Limiter` (oEmbed proxy, `includes/class-wpsg-rate-limiter.php`) resolves the client IP via `get_client_ip()`, which honors `X-Forwarded-For`/`X-Real-IP` only from trusted proxies. `WPSG_REST_Base::rate_limit_check()` (`includes/rest/class-wpsg-rest-base.php:125`) instead uses raw `$_SERVER['REMOTE_ADDR']` — behind any reverse proxy or CDN (common), every visitor's REMOTE_ADDR is the proxy's IP, so all public traffic collapses into one shared bucket per route (e.g. `campaigns.list` at 60/min *site-wide*, not per-visitor) once P63-A makes the limiter real. The two classes also each define a `wpsg_rate_limit_window` filter with different call signatures (`($default, $endpoint)` vs `($default)`), so tuning one silently doesn't tune the other.

### Fix

- `rate_limit_check()` uses `WPSG_Rate_Limiter::get_client_ip()` for its client-IP resolution instead of raw `REMOTE_ADDR`.
- Namespace or document the two `wpsg_rate_limit_window` filters distinctly (e.g. rename one, or add a doc comment on both pointing at each other) so operators don't tune the wrong knob.
- Full storage-backend unification is out of scope this phase (see Key Decision A) — this track only fixes IP resolution and filter clarity.

### Acceptance criteria

- Requests behind a simulated reverse proxy (`X-Forwarded-For` set, proxy IP in a trusted-proxy allowlist) are rate-limited per-visitor, not per-proxy.
- Tuning either `wpsg_rate_limit_window` filter has a clearly documented, distinct effect.

### Validation

- Extend the rate-limit test suite with a trusted-proxy `X-Forwarded-For` scenario.
- Manual: confirm `campaigns.list` isn't globally throttled when tested from multiple simulated client IPs behind one proxy IP.

### Validation Notes (2026-07-14)

Independently re-verified against current source:
- Confirmed `WPSG_Rate_Limiter::get_client_ip()` (`includes/class-wpsg-rate-limiter.php:72-105`): trust mechanism is a `wpsg_rate_limiter_trusted_proxies` filter (default `[]`), an exact-match `in_array($remote_addr, $trusted_proxies, true)` check, and only then does it consult `X-Forwarded-For`/`X-Real-IP` (first CSV entry, `filter_var(..., FILTER_VALIDATE_IP)`-validated).
- Confirmed `class-wpsg-rest-base.php:125` uses raw `$_SERVER['REMOTE_ADDR']` with no forwarded-header handling at all for the `public`/`authenticated`/`magic_approve` scopes.
- Confirmed the filter-signature divergence: `class-wpsg-rest-base.php` (lines 62, 97, 116) calls `apply_filters('wpsg_rate_limit_window', 60)` — one argument; `class-wpsg-rate-limiter.php:29` calls `apply_filters('wpsg_rate_limit_window', self::DEFAULT_WINDOW, $endpoint)` — two arguments. Same filter name, incompatible signatures, exactly as claimed.

---

## Track P63-C - Security & asset-cache headers are dead code (hook-timing)

*Source: PHP_REVIEW_FINDINGS.md § A-2 — re-verified 2026-07-14, all three sub-claims confirmed accurate.*

### Problem

Three independent hook-timing mistakes make the header subsystem inert:

1. `wpsg_add_security_headers()` runs on `send_headers`, gated by `$GLOBALS['wpsg_has_shortcode']` — but that global is only set inside `render_shortcode()` during the `the_content` filter, which fires well after `send_headers` in `WP::main()`.
2. The gate's REST-detection branch (`?rest_route=`, `/wp-json/` in the URI) is also unreachable: real REST requests are served and terminated by `rest_api_loaded()` during `parse_request`, before `send_headers` is ever reached.
3. `WPSG_Embed::register_assets()` attaches `add_asset_cache_headers` to the `send_headers` action from inside the `wp_enqueue_scripts` action — but `wp_enqueue_scripts` fires from `wp_head()`, after `send_headers` has already run; registering a callback on an already-fired hook is a no-op.

Net effect: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, the optional CSP, and the immutable-asset `Cache-Control` header are almost never emitted.

### Fix

- **Shortcode pages:** hook relocation to `template_redirect`/`wp` alone is **not sufficient** — `render_shortcode()` (which sets `$GLOBALS['wpsg_has_shortcode']`) still hasn't run at that point in the request lifecycle, since it fires later during `the_content`. The fix must pair the earlier hook with a static content pre-scan: `has_shortcode(get_post()->post_content, 'super-gallery')` (or the block equivalent) against the already-queried post at `template_redirect`/`wp` time — both hooks run before any output starts — and send headers there instead of relying on the runtime-set global.
- **REST responses:** attach headers via `rest_pre_serve_request` (already used elsewhere in the plugin for CORS — `wp-super-gallery.php:465` — and for the CSV export at `class-wpsg-campaign-controller.php:952`, which is direct proof headers can still be sent at that point) or `rest_post_dispatch`.
- **Static assets — resolved (user, 2026-07-14): both.** Ship a static, checked-in `assets/.htaccess` (committed to the plugin source, not runtime-generated via an `ensure_htaccess()`-style call — `assets/` ships with the plugin package and already exists at deploy time, unlike the overlays/fonts upload dirs which don't exist until first upload) carrying `mod_expires`/`mod_headers` rules for `Cache-Control: public, max-age=31536000, immutable` on the plugin's built asset files. Additionally document the nginx-equivalent snippet in packaging docs (implementer picks the exact doc location, e.g. a new "Server Requirements" note) for non-Apache hosts.

### Acceptance criteria

- A live GET of a page containing the gallery shortcode shows the security headers in the actual HTTP response (verified with `curl -I`, not a direct function call).
- A live REST response from any gallery route shows the same headers.
- Static asset requests under `assets/` carry the long-cache immutable `Cache-Control` header on an Apache host with `mod_headers`/`mod_expires` enabled (verified with `curl -I` against a real built asset file), and the nginx-equivalent snippet is documented and referenced from the packaging docs.

### Validation

- New integration test that performs a real dispatch (WP test HTTP-request simulation, not a direct function call) and asserts on emitted headers — this is the test gap that let the bug ship in the first place.
- Manual: `curl -I` against a real shortcode page, a REST endpoint, and a static asset URL under `assets/` on the local dev site (Apache).

### Validation Notes (2026-07-14)

Independently re-verified against current source and WP core hook order (not just trusted from the review doc) — all three sub-claims CONFIRMED:

1. **Shortcode gate:** confirmed `add_action('send_headers', 'wpsg_add_security_headers')` at `wp-super-gallery.php:466`; confirmed the gate at `wpsg_should_add_security_headers()` (`wp-super-gallery.php:516-519`) checks `$GLOBALS['wpsg_has_shortcode']`; confirmed that global is set in exactly one production location — inside `render_shortcode()` at `class-wpsg-embed.php:189` — which only runs when WP core's `do_shortcode()` fires on the `the_content` filter during the theme's post Loop, well after `send_headers` has already fired in `WP::main()`.
2. **REST-detection branch:** confirmed the `?rest_route=`/`/wp-json/` detection code at `wp-super-gallery.php:521-529`; confirmed WP core hooks `rest_api_loaded()` onto `parse_request`, which fires (and, for a real REST request, terminates the process via `die()`/`exit`) strictly before `send_headers` — so this branch can never observe a live REST request.
3. **Asset cache headers:** confirmed `add_action('wp_enqueue_scripts', ['WPSG_Embed', 'register_assets'])` at `wp-super-gallery.php:282`, and confirmed `register_assets()` itself calls `add_action('send_headers', [self::class, 'add_asset_cache_headers'])` at `class-wpsg-embed.php:14-20` — registering a callback on `send_headers` from inside `wp_enqueue_scripts`, which fires (via `wp_head()`) long after `send_headers` has already completed for the request. `add_action()` calls made after a hook has already fired are no-ops for that hook instance.

Verified WP core hook order for a normal front-end request (reasoned from `WP::main()`, `wp-blog-header.php`, `template-loader.php`, and core `default-filters.php`): `muplugins_loaded → plugins_loaded → setup_theme → after_setup_theme → init → wp_loaded → parse_request (rest_api_loaded) → send_headers → wp → template_redirect → get_header() → wp_head → wp_enqueue_scripts → Loop (the_content/do_shortcode) → wp_footer → shutdown`. This validates all three sub-claims and confirms `template_redirect`/`wp` fire after `send_headers` but before any output starts, so headers can still be sent there.

---

## Track P63-D - CSV formula-injection neutralization in audit-log export

*Source: PHP_REVIEW_FINDINGS.md § B-2 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`audit_csv_response()` (`includes/rest/class-wpsg-campaign-controller.php:937-967`) quotes cells and escapes embedded `"`, but does not neutralize cells whose first character is `=`, `+`, `-`, `@`, TAB, or CR — the standard CSV/Excel formula-injection vector. The concretely exploitable field is `actorLogin`: it's populated from `wp_get_current_user()->user_login`, sanitized only via `sanitize_text_field()`, and WordPress's default `sanitize_user()` allows usernames starting with `-` or `@` — so a maliciously-named account reaches the CSV cell untouched. (The `details` column and campaign titles are *not* a distinct injection path in practice — `sanitize_audit_details()` always forces `details` to an array, which `audit_csv_response()` then wraps via `wp_json_encode()`, so the cell's first character is always `{`/`[`, never an attacker-chosen leading character. The neutralization fix should still apply uniformly to every column for defense-in-depth, but `actorLogin` is the field that actually needs it today.)

### Fix

Add a small helper (used for every column) that prefixes a `'` to any cell whose first character is in the dangerous set.

### Acceptance criteria

- A crafted audit-log entry (e.g. an actor login or campaign title starting with `=cmd|'/c calc'!A1`) is exported with a leading `'` and does not execute as a formula when opened in Excel/LibreOffice/Google Sheets.
- Normal cell values are byte-for-byte unchanged.

### Validation

- Unit test asserting the escape helper neutralizes `=`, `+`, `-`, `@`, TAB, and CR-prefixed strings and leaves everything else untouched.
- Manual: open an exported CSV with a crafted entry in a spreadsheet app and confirm no formula execution.

### Validation Notes (2026-07-14)

Independently re-verified against current source — CONFIRMED, with one correction to the original claim's exploit path: confirmed `audit_csv_response()` is now at lines 937-967 (shifted from the review doc's original citation) and only does double-quote doubling, no leading-character neutralization. Traced attacker-influence through `add_audit_entry()` → `WPSG_DB::insert_audit_entry()`: `actorLogin` is the real, directly exploitable vector (WP allows `-`/`@`-prefixed usernames); the JSON-wrapped `details` field is not a distinct path since `wp_json_encode()` always produces a `{`/`[`-leading cell regardless of the underlying field values. No `email` field exists in the audit record at all. The fix (neutralize every column) is unaffected by this correction.

---

## Track P63-E - Export-job read/download gate stamped to creator's tier

*Source: PHP_REVIEW_FINDINGS.md § B-6 — re-verified 2026-07-14, confirmed accurate.*

### Problem

Export jobs are created under varying permission gates (e.g. audit-log export requires `manage_options` / `require_system_admin`), but `export_jobs.read`/`delete`/`download` all sit at the lower `require_admin` (`manage_wpsg`) tier in the permissions map, and `WPSG_Export_Engine::create_job()` stores no `created_by` or required-tier flag. Job IDs are 128-bit random (impractical to guess), but a leaked job ID would let any space editor download content (e.g. a full audit-log ZIP) they couldn't have created themselves.

### Fix

- Stamp `created_by` and a `required_tier` flag on the job record at `create_job()` time.
- Enforce the stamped tier in the three job endpoints (read/delete/download) instead of the uniform `require_admin` gate.

### Acceptance criteria

- A job created via the `manage_options`-gated audit-log export path is only downloadable by a `manage_options` user, even if a `manage_wpsg`-only user has (or guesses) the job ID.
- Jobs created via lower-tier paths (e.g. per-campaign media export) remain downloadable by the tier that could have created them.

### Validation

- New test matrix: create jobs at each tier, assert cross-tier read/download attempts are rejected.

### Validation Notes (2026-07-14)

Independently re-verified against current source — CONFIRMED. `create_job()` (`includes/class-wpsg-export-engine.php:43-67`) stores only `id/type/status/created_at/manifest/media_items/zip_path/size_limit/error` — no `created_by`/`owner`/`required_tier`. Permissions map (`includes/class-wpsg-permissions.php`) confirms the mismatch: `export_jobs.read/delete/download` sit uniformly at `require_admin` (lines 146-148, bare `manage_wpsg`, no space scoping), while job-creating actions range from `require_campaign_space_access` (lines 141, 144) up to `require_system_admin` (line 194, audit-log export). Confirmed the audit-log export job specifically (`export_audit_log_binary()`, `class-wpsg-campaign-controller.php:843-935`) can only be *created* by a System Admin but, absent this fix, could be read/downloaded by any `manage_wpsg` user who obtains the job ID.

---

## Track P63-F - `is_private_ip()` reserved-range completeness

*Source: PHP_REVIEW_FINDINGS.md § B-4 — re-verified 2026-07-14, confirmed accurate.*

### Problem

The IPv4 range list omits `224.0.0.0/4` (multicast), `240.0.0.0/4` (reserved, incl. `255.255.255.255`), and `198.18.0.0/15` (benchmarking). The IPv6 handling has no check for the NAT64 well-known prefix `64:ff9b::/96`, whose embedded IPv4 can map to RFC-1918 space on NAT64 networks. Practical exploitability is low, but the function aims to be exhaustive.

### Fix

- Add the three missing IPv4 ranges to the reserved/private list.
- For `64:ff9b::/96`, extract the trailing 32 bits and recurse through the existing `::ffff:`-mapped IPv4 handling.

### Acceptance criteria

- `is_private_ip()` returns true for a sample address in each of the four newly-covered ranges.
- No regression on any currently-covered range (existing SSRF test suite stays green).

### Validation

- Unit tests adding one assertion per new range.

### Validation Notes (2026-07-14)

Independently re-verified against current source — CONFIRMED, no corrections. `is_private_ip()` is now at `class-wpsg-rest-base.php:943-1046` (public wrapper `check_private_ip()` at 1055-1057). Confirmed the current IPv4 list (11 entries: RFC 1918 x3, loopback, link-local, "this" network, CGNAT, IETF protocol assignments, TEST-NET-1/2/3) genuinely omits `224.0.0.0/4`, `240.0.0.0/4`, and `198.18.0.0/15` — an attacker-supplied target like `240.0.0.1` or `255.255.255.255` currently passes as "not private." Confirmed the IPv6 checks (loopback, unspecified, `::ffff:`-mapped, unique-local, link-local, documentation, discard, multicast) have no `64:ff9b::/96` case — a NAT64-embedded `169.254.169.254` (a common cloud-metadata SSRF target) currently falls through to `false`.

---

## Track P63-G - Bearer-auth branch hardening (defense-in-depth)

*Source: PHP_REVIEW_FINDINGS.md § B-5 — re-verified 2026-07-14, confirmed accurate. Fix approach resolved (user, 2026-07-14) — Option 2 (tighten), see Key Decision B.*

### Problem

`verify_admin_auth()` (`includes/rest/class-wpsg-rest-base.php:669-671`) returns true for any request carrying an `Authorization: Bearer <anything>` header, regardless of whether the token is validated — it checks header *presence*, not authenticity.

Practical exploitability is bounded but not zero: WP core's `rest_cookie_check_errors()` already demotes a cookie-authenticated user lacking a valid nonce to user `0` before any plugin permission callback runs, which blocks the classic cross-site-CSRF-with-forged-header scenario regardless of this branch. The concrete residual risk is narrower — a misconfigured `auth_provider` setting (e.g. left at `'wp-jwt'` with no actual JWT integration wired up) or a stray/injected `Authorization: Bearer` header (e.g. from a misbehaving proxy or a stale client) reaching this branch and skipping nonce verification for a request that isn't actually token-authenticated. This is real defense-in-depth value being given up for no offsetting benefit, not a critical-severity gap.

### Fix

Only honor the `Bearer ` skip when there is actual evidence a token-auth integration authenticated the request — not just header presence:

```php
if (!empty($auth_header) && stripos($auth_header, 'Bearer ') === 0
    && is_user_logged_in()
    && apply_filters('wpsg_bearer_auth_verified', false, $auth_header)) {
    return true;
}
```

`is_user_logged_in()` confirms WordPress itself resolved a real current user (via cookie, Application Passwords, or an external auth integration hooked into `determine_current_user`); the `wpsg_bearer_auth_verified` filter (default `false`) lets a JWT/token-auth integration explicitly assert "yes, I validated this specific Bearer token" rather than the plugin inferring validation from presence alone. Sites with no token-auth integration wired up get the filter's default `false` — i.e. today's stricter nonce-required behavior, no regression.

### Acceptance criteria

- A bare `Authorization: Bearer garbage` header with no authenticated session and no `wpsg_bearer_auth_verified` filter attached is rejected (falls through to the normal nonce check).
- A site with a real JWT/token-auth integration that hooks `wpsg_bearer_auth_verified` and calls `is_user_logged_in()`-establishing code continues to work exactly as before (no regression for legitimate token-auth setups).

### Validation

- New test asserting a bare `Authorization: Bearer garbage` header with no authenticated user is rejected (currently would incorrectly pass).
- New test asserting the skip is honored when `is_user_logged_in()` is true and `wpsg_bearer_auth_verified` is filtered to `true`.
- Existing auth test suite stays green (default-`false` filter preserves current behavior for sites without token-auth integrations).

### Validation Notes (2026-07-14)

Independently re-verified against current source — CONFIRMED. Exact branch at `class-wpsg-rest-base.php:669-671`. Confirmed `verify_admin_auth()` is only ever reached in combination with `WPSG_Permissions::actor_has_tier()` (`class-wpsg-permissions.php:227-238`), which resolves to `current_user_can()`/`is_user_logged_in()` against WP's real current-user state — so the Bearer bypass alone cannot escalate an anonymous caller to admin; it only skips this file's own nonce check. Confirmed against installed WP core (`wp-includes/rest-api.php:1113`, `default-filters.php:341`) that `rest_cookie_check_errors()` is hooked at `rest_authentication_errors` priority 100 and demotes cookie-authenticated-but-nonce-missing requests to user `0` before any plugin route callback executes — this bounds the classic CSRF scenario as described above. Confirmed `auth_provider` (`'wp-jwt'`/`'none'`) is a real setting (`class-wpsg-settings-registry.php:26,645`; `class-wpsg-embed.php:59,72`) whose validation happens entirely outside this function today — the fix's filter gives that external layer an explicit, auditable signal to plug into instead of the plugin inferring validation from header presence.

---

## Track P63-H - Provider handlers use `wp_safe_remote_get`

*Source: PHP_REVIEW_FINDINGS.md § B-7 — re-verified 2026-07-14, confirmed accurate.*

### Problem

The oEmbed proxy's SSRF protection is applied out-of-band, via a temporary `pre_http_request` filter added/removed inside `proxy_oembed()` — but the four provider handler classes (Rumble, Direct, WPCore, OG_Fallback, `includes/providers/`) call plain `wp_remote_get()` directly. If any handler is ever invoked outside that one call path (they're publicly registerable via `wpsg_register_providers`), the SSRF safety net is gone.

### Fix

Switch all four handlers to `wp_safe_remote_get()` — behavior-identical for legitimate targets, and each handler becomes independently safe regardless of call path.

### Acceptance criteria

- All four provider files use `wp_safe_remote_get()`; zero remaining `wp_remote_get()` calls in `includes/providers/`.
- No behavior change for existing legitimate oEmbed fetches.

### Validation

- Existing oEmbed/provider test suite stays green.
- Manual: confirm a legitimate embed (e.g. a real Rumble URL) still resolves after the switch.

### Validation Notes (2026-07-14)

Independently re-verified against current source — CONFIRMED. All 4 `wp_remote_get()` call sites enumerated: `class-wpsg-provider-rumble.php:43`, `class-wpsg-provider-wpcore.php:35`, `class-wpsg-provider-direct.php:46`, `class-wpsg-provider-og-fallback.php:35` — none use `wp_safe_remote_get()`, while other parts of the plugin already do (`class-wpsg-export-engine.php:195`, `class-wpsg-thumbnail-cache.php:95`, `class-wpsg-settings-service.php:54`, `class-wpsg-webhooks.php:125`), confirming these four are the outliers. The `pre_http_request` SSRF filter actually lives in `includes/rest/class-wpsg-system-controller.php` inside `proxy_oembed()` (added/removed in a `try/finally` around `WPSG_OEmbed_Providers::fetch()`), which delegates to `WPSG_Provider_Registry::resolve()` — a fully `public static` API with no internal SSRF gating of its own. Confirmed the `wpsg_register_providers` hook (`class-wpsg-provider-registry.php:127`) is real and documented for third-party handler registration. Today `resolve()` has only one call site (`proxy_oembed()`), so the risk is currently latent rather than live, but the registry/handlers have zero built-in protection — any future internal caller (a new route, a CLI command, cron, or third-party code calling the registry directly) would bypass the SSRF safety net entirely, exactly as the finding describes.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full storage-backend unification of the two rate limiters (single `WPSG_Rate_Limiter`-backed service for both oEmbed and REST-base limiting) | P63-B's narrower fix (shared IP resolution, distinct filters) restores correctness without the larger refactor; revisit if the two implementations keep drifting. |

## Implementation Notes

All 8 tracks implemented 2026-07-14 (branch `feat/phase63-php-hardening-1-of-5`). Rationale/decisions recorded per track below; each is covered by a new or extended PHPUnit test (authored alongside the code).

- **P63-A** — `rate_limit_check()` (`class-wpsg-rest-base.php`) now gates the object-cache counter on `wp_using_ext_object_cache()` instead of `function_exists('wp_cache_incr')`. Transient fallback left unchanged (now reachable). Test: `WPSG_P63A_B_Rest_Rate_Limit_Test::test_transient_backend_throttles_without_persistent_cache` forces the no-persistent-cache profile via `wp_using_ext_object_cache(false)` and asserts a 429 after the limit plus the presence of the transient bucket.
- **P63-B** — `rate_limit_check()` now resolves the client IP via `WPSG_Rate_Limiter::get_client_ip()` (trusted-proxy-aware), guarded by `class_exists`. The three REST-base window filters were renamed `wpsg_rate_limit_window` → **`wpsg_rest_rate_limit_window`** (now carrying a `$scope` arg) to end the name collision with the oEmbed limiter's filter; a cross-referencing comment was added on both. **Decision:** renamed rather than merely documented — these filters are internal hardening knobs with no references outside the plugin's own code/tests, and the collision was a genuine footgun. Storage-backend unification remains a Follow-On Candidate (Key Decision A). Tests cover per-visitor bucketing behind a trusted proxy and the scoped filter.
- **P63-C** — security headers now emit from `template_redirect` (front-end pages whose queried post contains the `[super-gallery]` shortcode, detected via `has_shortcode()` on stored content — the runtime flag is set too late) and from `rest_pre_serve_request` (plugin REST namespace). The dead `send_headers` hook, `wpsg_add_security_headers()`, and `wpsg_should_add_security_headers()` were removed; header assembly is now the pure, testable `wpsg_security_headers_list()`. The dead PHP asset-cache path (`WPSG_Embed::add_asset_cache_headers()` + its `send_headers` registration from inside `wp_enqueue_scripts`) was removed. **Decision (build reality):** the static-asset `.htaccess` is committed at `public/.htaccess` (source of truth), not directly in the gitignored, build-wiped `assets/` dir — the Vite build copies `public/ → dist/ → assets/` (verified: Vite 6 `copyDir` and `scripts/copy-wp-assets.js` both copy dotfiles), exactly like the existing `public/sw.js`, so it ships in `assets/.htaccess` in the release ZIP. It sets `Cache-Control: public, max-age=31536000, immutable` on hashed assets and explicitly excludes `sw.js`; the nginx-equivalent is documented inline. No Gutenberg block exists (shortcode-only plugin), so no block-detection path was needed.
- **P63-D** — added `WPSG_Campaign_Controller::csv_cell()` applying formula-injection neutralization (leading `'` for cells starting `=`,`+`,`-`,`@`,TAB,CR) + RFC-4180 quote-doubling to **every** column of `audit_csv_response()`. The genuinely-reachable vector is `actor_login`; guard applied uniformly for defense-in-depth.
- **P63-E** — `WPSG_Export_Engine::create_job()` now stamps `created_by` + a validated `required_tier` (new 5th param, default `TIER_EDITOR`; escalated callers — audit + media-library export — pass `TIER_SYSTEM_ADMIN` via **named argument** so the existing positional `size_limit` call site in `WPSG_P39CM1_Export_Test` stays valid). The three job endpoints (`get`/`delete`/`download`) re-check the stamped tier via `authorize_job_access()` (403 on mismatch), placed before the status/not-ready checks. Pre-P63-E in-flight jobs (no `required_tier`) default to the old `TIER_EDITOR` floor.
- **P63-F** — `is_private_ip()` gained IPv4 `198.18.0.0/15`, `224.0.0.0/4`, `240.0.0.0/4` (incl. `255.255.255.255`) and the IPv6 NAT64 prefix `64:ff9b::/96` (extracts the embedded IPv4 and recurses, mirroring the `::ffff:` path; a NAT64-wrapped *public* IPv4 correctly stays allowed). Docblock updated.
- **P63-G** — extracted `WPSG_REST_Base::bearer_auth_is_verified()` (public, testable) and wired it into `verify_admin_auth()`. **Decision:** Key Decision B → Option 2 (tighten): the Bearer skip is honored only when `is_user_logged_in()` AND the new `wpsg_bearer_auth_verified` filter (default `false`) asserts a real token-auth integration validated the credential. Default behavior for sites without a JWT integration is now the stricter nonce-required path — no regression.
- **P63-H** — all four provider handlers (`includes/providers/`) switched from `wp_remote_get()` to `wp_safe_remote_get()`; zero plain `wp_remote_get()` calls remain in that directory (verified by grep). Behavior-identical for legitimate targets, so it rides the existing provider suite (no bespoke test).

## Manual QA & Validation

Automated coverage (the 6 new `WPSG_P63*` test files + the extended rate-limiter/coverage suites) is the primary gate. The steps below are the manual/end-to-end confirmations that automated tests can't fully capture, plus the rationale where manual QA is not applicable. All manual steps assume the local wp-env dev site (`npx @wordpress/env`), and for the header/asset checks a **built** plugin (`npm run build:wp`) so `assets/` (and `assets/.htaccess`) exist.

| Track | How to validate the change | How to confirm nothing broke |
|-------|----------------------------|------------------------------|
| **P63-A** | On a site with **no** persistent object cache (default wp-env), hammer a public rate-limited route past its limit — `for i in $(seq 1 70); do curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8888/wp-json/wp-super-gallery/v1/campaigns"; done` — and confirm `429`s begin appearing (before the fix: all `200`). | Existing rate-limit suite green; confirm a Redis/Memcached-backed site (if available) still limits via the object-cache path (no double-counting). |
| **P63-B** | With `add_filter('wpsg_rate_limiter_trusted_proxies', fn()=>['<proxy-ip>'])`, send requests through the proxy IP with differing `X-Forwarded-For` values and confirm each client IP gets its own bucket (one client's 429 doesn't block another). | Confirm `campaigns.list` is not throttled site-wide from a single proxy; verify tuning `wpsg_rest_rate_limit_window` affects REST limits and `wpsg_rate_limit_window` affects only the oEmbed proxy. |
| **P63-C** | `curl -I` a front-end **page containing `[super-gallery]`** → expect `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. `curl -I` any `/wp-json/wp-super-gallery/v1/...` route → same headers. On Apache with `mod_headers`, `curl -I` a built asset under `.../assets/assets/*.js` → `Cache-Control: ...immutable`; `.../assets/sw.js` → `no-store`. | `curl -I` a page **without** the shortcode → security headers absent (no over-broad emission). Confirm normal pages/admin unaffected; confirm the SPA still loads (assets 200). On nginx, apply the documented snippet and re-check. |
| **P63-D** | Create an account whose username starts with `=`/`@`/`-` (or a campaign whose title does), generate an audit entry, export the audit log as CSV (`Accept: text/csv`), open in Excel/LibreOffice/Sheets → the crafted cell shows literally (leading `'`), no formula executes. | Diff a CSV export of ordinary data before/after — cell *contents* unchanged (only quoting, which was already present). |
| **P63-E** | As a System Admin, start an audit-log binary export and note its job ID. As a `manage_wpsg`-only user, `GET`/`download` that job ID → `403`. As the System Admin → `200`/download works. | As a `manage_wpsg` user, create + read + download a *campaign* export job → still works (editor-tier jobs unaffected). |
| **P63-F** | N/A for live manual QA (pure IP-classification helper, no user-facing surface). Rationale: exercised exhaustively by `WPSG_P63F_Private_IP_Test` (each new range + NAT64 + adjacent-public regressions); a live oEmbed request to one of these ranges is impractical to arrange and adds nothing over the unit assertions. | Existing SSRF/oEmbed suite green (no regression on previously-blocked ranges). |
| **P63-G** | Send an admin REST request with `Authorization: Bearer garbage` and **no** valid nonce → rejected (before the fix: accepted). With a JWT integration hooking `wpsg_bearer_auth_verified` to true on a logged-in user → accepted. | Confirm normal cookie+nonce admin requests and Application-Password (Basic) auth still work unchanged. |
| **P63-H** | Resolve a legitimate embed (e.g. a real Rumble URL) through the oEmbed proxy → still resolves. Rationale: the change is behavior-identical to `wp_remote_get()` for public targets, so this is a smoke check rather than a new test. | Existing oEmbed/provider suite green; grep confirms zero `wp_remote_get(` remain under `includes/providers/`. |

## Outcome

All 8 tracks (P63-A…H) implemented on branch `feat/phase63-php-hardening-1-of-5`, 2026-07-14. Six new test files added (`WPSG_P63{A_B,C,D,E,F,G}_*`), two existing tests updated (`WPSG_Coverage_Extras_Test` for the removed asset-header method; `WPSG_P39CM1_Export_Test` unaffected by the named-arg `create_job` change). `php -l` clean on all changed files. Full wp-env PHPUnit run + commit pending.
