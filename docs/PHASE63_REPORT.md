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
| B | Bearer-auth fix depth | Left open per user direction (2026-07-14) — implementer chooses between a documentation-only clarification (rely on `rest_cookie_check_errors()`) or the tighter `is_user_logged_in()`-gated check, at implementation time. |

## Execution Priority

1. **P63-A** — highest-impact single-line fix; do first and in isolation so its regression test is unambiguous.
2. **P63-B** — touches the same code path as P63-A; do immediately after so the two don't conflict mid-flight.
3. **P63-C** — independent of A/B; the three-part hook-timing fix (shortcode pages, REST responses, static assets) can proceed in parallel.
4. **P63-D, P63-F, P63-H** — small, independent, no dependencies; batch together.
5. **P63-E** — independent; touches the export-job/permissions files.
6. **P63-G** — last: lowest urgency (not practically exploitable today), and its scope depends on the Key Decision B default choice made at implementation time.

---

## Track P63-A - Rate limiting is a silent no-op without a persistent object cache

*Source: PHP_REVIEW_FINDINGS.md § A-1 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`WPSG_REST_Base::rate_limit_check()` (`includes/rest/class-wpsg-rest-base.php:132`) selects its counter backend with `if (function_exists('wp_cache_incr'))`. WordPress core defines `wp_cache_incr()` unconditionally — even for the default non-persistent, per-request array cache — so the transient-based fallback (lines 165-198) is unreachable on any host without a real persistent object-cache drop-in (Redis/Memcached). On the majority of WP hosts, every request gets a fresh in-memory cache, the counter is always 1, and `rate_limit_public()` / `rate_limit_authenticated()` / `rate_limit_magic_approve()` enforce nothing.

### Fix

- Gate the object-cache path on `wp_using_ext_object_cache()` instead of `function_exists('wp_cache_incr')`.
- No change needed to the transient fallback itself — it's already correct, just currently unreachable.

### Acceptance criteria

- On a host with no persistent object-cache drop-in, hitting a public rate-limited endpoint (e.g. `campaigns.list`) past its configured limit returns 429.
- On a host with `wp_using_ext_object_cache()` true, the object-cache path is used (no behavior regression for Redis/Memcached hosts).

### Validation

- New PHPUnit test asserting the transient path is taken when `wp_using_ext_object_cache()` returns false.
- Existing rate-limit test suite stays green.

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

- **Shortcode pages:** detect `has_shortcode(get_post()->post_content, 'super-gallery')` (or the block equivalent) on `template_redirect`/`wp` — both run before output — and send headers there instead of relying on the `the_content`-set global.
- **REST responses:** attach headers via `rest_pre_serve_request` (already used elsewhere in the plugin for CORS) or `rest_post_dispatch`.
- **Static assets:** drop the PHP-side header attempt (files under `/wp-content/plugins/...` are served by the web server without entering PHP) and instead document the required server config (Apache `.htaccess` snippet / nginx block), or write an `.htaccess` into `assets/` following the existing pattern used for the overlays/fonts upload dirs.

### Acceptance criteria

- A live GET of a page containing the gallery shortcode shows the security headers in the actual HTTP response (verified with `curl -I`, not a direct function call).
- A live REST response from any gallery route shows the same headers.
- Static asset requests either carry the cache headers (if a PHP-servable path exists) or the documented server-config snippet is present and referenced from the packaging docs.

### Validation

- New integration test that performs a real dispatch (WP test HTTP-request simulation, not a direct function call) and asserts on emitted headers — this is the test gap that let the bug ship in the first place.
- Manual: `curl -I` against a real shortcode page and a REST endpoint on the local dev site.

---

## Track P63-D - CSV formula-injection neutralization in audit-log export

*Source: PHP_REVIEW_FINDINGS.md § B-2 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`audit_csv_response()` (`includes/rest/class-wpsg-campaign-controller.php:937-967`) quotes cells and escapes embedded `"`, but does not neutralize cells whose first character is `=`, `+`, `-`, `@`, TAB, or CR — the standard CSV/Excel formula-injection vector. User- and attacker-influenced values (`actorLogin`, campaign titles/emails inside JSON-encoded `details`) reach these cells untouched.

### Fix

Add a small helper (used for every column) that prefixes a `'` to any cell whose first character is in the dangerous set.

### Acceptance criteria

- A crafted audit-log entry (e.g. an actor login or campaign title starting with `=cmd|'/c calc'!A1`) is exported with a leading `'` and does not execute as a formula when opened in Excel/LibreOffice/Google Sheets.
- Normal cell values are byte-for-byte unchanged.

### Validation

- Unit test asserting the escape helper neutralizes `=`, `+`, `-`, `@`, TAB, and CR-prefixed strings and leaves everything else untouched.
- Manual: open an exported CSV with a crafted entry in a spreadsheet app and confirm no formula execution.

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

---

## Track P63-G - Bearer-auth branch hardening (defense-in-depth)

*Source: PHP_REVIEW_FINDINGS.md § B-5 — re-verified 2026-07-14, confirmed accurate. Fix approach deliberately left open (user, 2026-07-14) — see Key Decision B.*

### Problem

`verify_admin_auth()` (`includes/rest/class-wpsg-rest-base.php:669-671`) returns true for any request carrying an `Authorization: Bearer <anything>` header, regardless of whether the token is validated — it checks header *presence*, not authenticity. Not practically exploitable today (WP core already zeroes out cookie-authenticated users lacking a valid nonce before permission callbacks run, and cross-origin custom headers require CORS preflight approval against an empty-by-default allowlist), but the layer's defense-in-depth value is weakened by trusting an unvalidated header.

### Fix

Implementer's choice at execution time, per Key Decision B:
- **Option 1 (minimal):** document the reliance on `rest_cookie_check_errors()` with a comment at the branch.
- **Option 2 (tightening):** only honor the Bearer skip when a token-auth integration actually authenticated the user (e.g. `is_user_logged_in() && !wp_validate_auth_cookie('', 'logged_in')`, or a filterable flag set by a JWT integration).

### Acceptance criteria

- Whichever option is chosen, the branch's behavior and reasoning are either clearly documented or demonstrably tightened — no silent trust-by-presence left unexplained.

### Validation

- If Option 2 is chosen: a test asserting a bare `Authorization: Bearer garbage` header with no authenticated user is rejected.
- If Option 1 is chosen: no test change needed; confirm the comment accurately describes the current protection.

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

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full storage-backend unification of the two rate limiters (single `WPSG_Rate_Limiter`-backed service for both oEmbed and REST-base limiting) | P63-B's narrower fix (shared IP resolution, distinct filters) restores correctness without the larger refactor; revisit if the two implementations keep drifting. |

## Implementation Notes

- Record completed work here as tracks land; nothing executed yet.

## Outcome

Not started.
