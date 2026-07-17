# Phase 63 — Manual QA & Validation Runbook

**Companion to:** [PHASE63_REPORT.md](PHASE63_REPORT.md) → *Manual QA & Validation* (the one-line-per-track table). This document is the **detailed HOW**: exact preconditions, commands, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test.

**Scope:** tracks P63-A … P63-I. Each track section is self-contained. Do the shared setup once (§1–§3), then run the tracks in any order — except note the environment caveats called out per track (e.g. P63-A needs a *non*-persistent-object-cache host; P63-C needs a *built* plugin).

**Golden rule:** a hardening test is only valid if you have also seen it **fail without the fix**, or you understand precisely why the pre-fix code was wrong. Each section states the pre-fix behavior so a green result actually proves something. When in doubt, `git stash` the fix on a scratch branch and re-run to watch it fail.

---

## 1. Environment

| Requirement | Why |
|---|---|
| Local `wp-env` dev site (`npx wp-env start` from repo root) | Standard test host. Default wp-env has **no persistent object cache** — important for P63-A. |
| A **built** plugin (`npm run build:wp`) for P63-C only | The asset-cache `.htaccess` and hashed assets only exist under `assets/` after a build. The other tracks run against source. |
| `curl` (with `-i` to see headers/status) | All REST assertions below use curl so the result is unambiguous and scriptable. |
| A spreadsheet app (Excel / LibreOffice Calc / Google Sheets) for P63-D | CSV formula-injection only manifests when a spreadsheet *interprets* the cell. |
| Base URL | wp-env default is `http://localhost:8888`. Substitute `$BASE` below. |

```bash
export BASE=http://localhost:8888
```

**Web-server note (P63-C caching only):** wp-env serves via Apache, so the shipped `assets/.htaccess` applies. If you validate on nginx, apply the snippet documented at the top of `public/.htaccess` first — nginx ignores `.htaccess`.

---

## 2. Test personas & the RBAC model (read this before P63-E/-E-2/-I)

Getting the authorization model right is the difference between a test that proves something and one that passes for the wrong reason. The model enforced by the code (`WPSG_Permissions::actor_has_tier`, `WPSG_REST_Base::get_effective_space_level`) is:

| Persona | WP capability | Space access | Reaches export/admin endpoints? |
|---|---|---|---|
| **System Admin** | `manage_options` (+ `manage_wpsg`) | **Owner in every space, always** (escape hatch) | Yes — everything |
| **Editor (delegated)** | `manage_wpsg`, **not** `manage_options` | **Only spaces they hold an explicit grant to** | Yes, but space-scoped |
| **Reader / Viewer** | logged-in, no `manage_wpsg` | n/a | **No** — rejected at the `permission_callback` |

**Critical, and easy to get wrong:** per **P53-A**, a `manage_wpsg` editor has access to a space **only via an explicit grant — in *both* `open` and `delegated` isolation modes.** Open mode does **not** hand editors implicit access (that was removed in P53-A; the test `WPSG_P47_Spaces_Isolation_Test::test_open_space_denies_manage_wpsg_without_grant` pins it). `isolation_mode` now governs *asset/library visibility*, not this access gate. Only `manage_options` is owner-everywhere.

Consequence for P63-E/-E-2/-I testing: to make an editor *lack* access to a space, you simply **don't grant it** (or you **revoke** the grant) — the space's mode is irrelevant to the gate.

**"Reader" ≠ the space `viewer` grant-level.** "Reader/Viewer" above is a content consumer with no `manage_wpsg`. The per-space grant levels (`viewer` / `editor` / `owner`) are grants given to a `manage_wpsg` *editor* to scope them; a `viewer`-level grant still requires the user to hold `manage_wpsg` to reach export endpoints. Throughout this doc, "editor" means a `manage_wpsg` actor.

### 2.1 Authenticating REST requests

Two mechanisms; pick per test:

- **Application Password (recommended for curl).** WP authenticates HTTP Basic *before* the permission callback, and `verify_admin_auth()` returns `is_user_logged_in()` for Basic — **no nonce required**. Create one per persona:
  ```bash
  npx wp-env run cli wp user application-password create <user_login> qa --porcelain
  # → prints the password, e.g. abcd EFGH ijkl MNOP qrst UVWX  (spaces are fine)
  ```
  Then:
  ```bash
  curl -i -u '<user_login>:abcd EFGH ijkl MNOP qrst UVWX' "$BASE/wp-json/wp-super-gallery/v1/..."
  ```
- **Browser session + nonce.** Log in as the persona in a browser; in DevTools console read `wpApiSettings.nonce`; send `-H "X-WP-Nonce: <nonce>"` with the session cookies. Needed only for P63-G (the cookie-CSRF path).

### 2.2 Creating the personas

```bash
# System Admin (administrator already gets manage_wpsg at plugin setup)
npx wp-env run cli wp user create sysadmin sysadmin@ex.com --role=administrator --user_pass=pass

# Delegated editor: manage_wpsg WITHOUT manage_options
npx wp-env run cli wp user create editor_a editor_a@ex.com --role=subscriber --user_pass=pass
npx wp-env run cli wp user add-cap editor_a manage_wpsg
# (repeat for editor_b for the cross-space tests)
npx wp-env run cli wp user create editor_b editor_b@ex.com --role=subscriber --user_pass=pass
npx wp-env run cli wp user add-cap editor_b manage_wpsg

# Reader: logged-in, no manage_wpsg
npx wp-env run cli wp user create reader reader@ex.com --role=subscriber --user_pass=pass
```

Verify a persona lacks `manage_options` when it should:
```bash
npx wp-env run cli wp user list --field=user_login --capability=manage_options   # editor_a MUST NOT appear
```

---

## 3. Reusable setup recipes

**Spaces & grants** — do these through the **Spaces admin screen** (the realistic path a site admin uses) *or* REST. The admin screen: WP Admin → WP Super Gallery → Spaces → create Space A and Space B; open a space → Access → add/remove a user grant. Note each space's numeric ID (shown in the URL / list).

REST equivalents (act as System Admin):
```bash
# Create a space (POST /spaces).  isolation_mode: "open" | "delegated" — irrelevant to the access gate (see §2).
curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/spaces" \
  -H 'Content-Type: application/json' -d '{"name":"Space A","isolation_mode":"delegated"}'

# Grant a user access to a space (POST /spaces/{id}/access): {userId, access_level}
curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/spaces/<SPACE_ID>/access" \
  -H 'Content-Type: application/json' -d '{"userId":<EDITOR_ID>,"access_level":"editor"}'

# Revoke (DELETE /spaces/{id}/access/{userId})
curl -s -u 'sysadmin:APPPW' -X DELETE "$BASE/wp-json/wp-super-gallery/v1/spaces/<SPACE_ID>/access/<EDITOR_ID>"
```

**Put a campaign in a space:** create a campaign in the builder, then assign its space via the campaign's space selector (or set the `_wpsg_space_id` post-meta). Get a user's numeric ID with `npx wp-env run cli wp user get <login> --field=ID`.

**Generate an audit-log entry (for P63-D):** perform any audited action as a user whose login starts with a formula character (see P63-D for the crafted-username trick), e.g. edit/publish a campaign, or approve an access request.

---

## 4. Track-by-track

Each track: **What & why → Preconditions → Steps → Expected (pass) → Why it proves the fix → Regression checks → Pitfalls.**

---

### P63-A — Rate limiting actually throttles without a persistent object cache

**What & why.** Pre-fix, `rate_limit_check()` chose its counter backend with `function_exists('wp_cache_incr')`, which is **always true** (WP core defines it even for the default per-request array cache). On the majority of hosts (no Redis/Memcached) that counter resets every request, so the limit never tripped and the transient fallback was dead code. Fix gates on `wp_using_ext_object_cache()`.

**Preconditions.** A host with **no persistent object cache** — default wp-env qualifies. (If you added Redis, this test is meaningless; see Regression.) Rate-limited route: `GET /campaigns/{id}/media` (`rate_limit_public`, default **60 req / 60 s**). Use a real campaign ID.

**Steps.** Optionally lower the limit for speed via a scratch mu-plugin: `add_filter('wpsg_rate_limit_public', fn() => 5);`. Then hammer the route from one IP:
```bash
CID=<campaign_id>
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/media"
done | sort | uniq -c
```

**Expected (pass).** After the limit (default 60, or your filtered value) you see `429`s. `uniq -c` shows a mix of `200` then `429` — **not** all `200`.

**Why it proves the fix.** On this non-persistent-cache host, seeing *any* `429` means the transient backend is now reached and counts persist across requests. Pre-fix this exact run returned all `200`.

**Regression checks.** On a Redis/Memcached-backed host (if available), the same run must also throttle (object-cache path), with no double-counting. Automated: the full rate-limit suite stays green.

**Pitfalls.**
- Any intermediate cache/CDN that coalesces or serves the route without hitting PHP will hide throttling — hit the origin directly.
- Different client IPs get different buckets (that's P63-B). Keep the source IP constant.
- If you filtered the limit down, remember the **window** is still 60 s — wait it out or use a fresh route between runs.

---

### P63-B — Per-client-IP bucketing behind a trusted proxy + distinct window filter

**What & why.** The REST limiter now resolves the client IP through `WPSG_Rate_Limiter::get_client_ip()` (trusted-proxy-aware) instead of raw `REMOTE_ADDR`. Behind a reverse proxy every visitor shares the proxy's `REMOTE_ADDR`, which pre-fix collapsed all traffic into one site-wide bucket. Also, the REST window filter was renamed `wpsg_rate_limit_window` → **`wpsg_rest_rate_limit_window`** to end a name collision with the oEmbed proxy limiter.

**Preconditions.** Forwarded headers are only honored when `REMOTE_ADDR` is in the trusted-proxy allowlist — otherwise they're ignored (that's the anti-spoofing design). Simulate a proxy by trusting your own origin IP via a scratch mu-plugin:
```php
add_filter('wpsg_rate_limiter_trusted_proxies', fn() => ['127.0.0.1']); // the REMOTE_ADDR wp-env sees
add_filter('wpsg_rate_limit_public', fn() => 2);                        // tiny limit to make it quick
```

**Steps.** Two "clients" behind the same proxy, distinguished by `X-Forwarded-For`:
```bash
CID=<campaign_id>; URL="$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/media"
# Client A — exhaust its 2 allowed
curl -s -o /dev/null -w "A %{http_code}\n" -H 'X-Forwarded-For: 203.0.113.11' "$URL"
curl -s -o /dev/null -w "A %{http_code}\n" -H 'X-Forwarded-For: 203.0.113.11' "$URL"
curl -s -o /dev/null -w "A %{http_code}\n" -H 'X-Forwarded-For: 203.0.113.11' "$URL"   # 3rd → 429
# Client B — SAME proxy, different XFF — must be independent
curl -s -o /dev/null -w "B %{http_code}\n" -H 'X-Forwarded-For: 203.0.113.22' "$URL"   # → 200
```

**Expected (pass).** `A 200`, `A 200`, `A 429`, then `B 200`. Client B is **not** throttled by client A's activity.

**Why it proves the fix.** Independent buckets prove keying is by real client IP, not the shared proxy IP. Pre-fix, B's first request would already be `429` (same bucket as A).

**Filter distinctness sub-test.**
```php
add_filter('wpsg_rest_rate_limit_window', fn($w,$scope) => 1, 10, 2); // REST window → 1s (scope arg present)
add_filter('wpsg_rate_limit_window',      fn($w,$ep)    => 999, 10, 2); // oEmbed window — must NOT affect REST
```
Confirm REST buckets now expire after ~1 s (a blocked client is allowed again ~1 s later), while the oEmbed proxy limiter is unaffected. Tuning one subsystem must not move the other.

**Regression checks.** With **no** trusted-proxy filter set, an `X-Forwarded-For` header must be **ignored** (spoofing prevented) — a single real client can't dodge the limit by rotating XFF. Verify `campaigns/{id}/media` isn't throttled site-wide from a single proxy in normal operation.

**Pitfalls.** The trusted-proxy list must contain the IP wp-env actually sees in `REMOTE_ADDR` (often `127.0.0.1` or a Docker gateway) — if it's wrong, XFF is ignored and both clients share one bucket, masking the fix. Confirm the observed `REMOTE_ADDR` first.

---

### P63-C — Security & asset-cache headers fire at the right time

**What & why.** Pre-fix the headers were wired to `send_headers`, which fires *before* the shortcode flag is set and *after* REST requests were already served — so nothing was emitted. Fix: front-end pages containing `[super-gallery]` emit on `template_redirect`; the plugin's REST namespace emits on `rest_pre_serve_request`. Static-asset long-cache headers ship via `assets/.htaccess` (Apache), which needs a **built** plugin.

**Preconditions.** `npm run build:wp` (so `assets/` and `assets/.htaccess` exist). A published page whose content contains `[super-gallery ...]`, and a page without it.

**Steps.**
```bash
# 1. Front-end page WITH the shortcode
curl -sI "$BASE/<page-with-shortcode>/" | grep -iE 'x-content-type-options|x-frame-options|referrer-policy|permissions-policy'
# 2. A plugin REST route
curl -sI "$BASE/wp-json/wp-super-gallery/v1/campaigns" | grep -iE 'x-content-type-options|x-frame-options|referrer-policy|permissions-policy'
# 3. A hashed asset (Apache + mod_headers), built plugin
curl -sI "$BASE/wp-content/plugins/wp-super-gallery/assets/assets/index-<hash>.js" | grep -i cache-control   # → max-age=31536000, immutable
# 4. The service worker must NOT be long-cached
curl -sI "$BASE/wp-content/plugins/wp-super-gallery/assets/sw.js" | grep -i cache-control                   # → no-cache/no-store
```

**Expected (pass).** Steps 1 & 2 return all four security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`). Step 3 → `immutable` long cache. Step 4 → no-store.

**Why it proves the fix.** Pre-fix, steps 1 and 2 returned **none** of these headers (dead hook). The distinct front-end and REST paths each need their own check because they use different hooks.

**Regression checks.**
- A page **without** the shortcode must **not** carry the security headers (step 1 on the plain page → absent). This proves emission is scoped, not global.
- The SPA still loads (assets return `200`).
- CSP is **opt-in**: absent unless `add_filter('wpsg_csp_header', fn() => "default-src 'self'")` is set — then step 1/2 also show `Content-Security-Policy`.

**Pitfalls.**
- Running against **source** (not a build) means no `assets/.htaccess` and no hashed files → steps 3–4 are meaningless. Build first.
- Some hosts/proxies strip or add these headers; check at the origin.
- `X-Frame-Options` is filterable (`wpsg_x_frame_options`); default is `SAMEORIGIN`.

---

### P63-D — CSV formula-injection neutralization in audit-log export

**What & why.** A CSV cell beginning `=`, `+`, `-`, `@`, TAB, or CR is executed as a formula by spreadsheet apps (OWASP CSV injection). The reachable vector is `actor_login` (WP usernames may start with `-`/`@`). Fix: `csv_cell()` prefixes such cells with a single quote and applies RFC-4180 quoting to **every** column.

**Preconditions.** System Admin persona (the global audit-log export is `require_system_admin`). An audit entry whose `actor_login` starts with a formula char:
```bash
npx wp-env run cli wp user create '=cmd' evil@ex.com --role=subscriber --user_pass=pass
npx wp-env run cli wp user add-cap '=cmd' manage_wpsg
# Perform an audited action AS that user so it appears as actor_login, e.g. publish/edit a campaign.
```
(If a `=`-leading login is rejected by your WP config, use `@sum` or a campaign **title** starting with `=` for a title-bearing audit field.)

**Steps.**
```bash
curl -s -u 'sysadmin:APPPW' -H 'Accept: text/csv' \
  "$BASE/wp-json/wp-super-gallery/v1/admin/audit-log" -o audit.csv
```
Open `audit.csv` **in a spreadsheet app** (double-click / import), not just a text editor.

**Expected (pass).** The crafted cell displays **literally** — e.g. `'=cmd` shows as text `=cmd`, no formula evaluates, no `#NAME?`/calc result, no external-content prompt. In the raw file the cell is `"'=cmd"` (leading `'` inside the quotes).

**Why it proves the fix.** The spreadsheet is the actual threat surface — only it interprets formulas. Pre-fix the cell was `"=cmd"` and Excel/Sheets would evaluate it on open.

**Regression checks.** Diff a CSV of ordinary data before/after the fix — the *content* of normal cells is unchanged (only quoting, which was already present). Numeric/date columns (`id`, `createdAt`) are untouched (their first char isn't a formula char).

**Pitfalls.**
- Viewing in a plain text editor proves nothing — you must open in a spreadsheet.
- Google Sheets sometimes needs "File → Import" (not paste) to reproduce interpretation.
- Only a **leading** formula char triggers it; `a=b` is safe and stays unquoted-for-formula (still RFC-4180 quoted).

---

### P63-E — Export-job read/download gated to the creator's tier

**What & why.** Export jobs are created under varying gates (audit / media-library export require System Admin) but the `export-jobs/*` endpoints sit at the coarse `require_admin` (`manage_wpsg`) floor. Pre-fix, a `manage_wpsg`-only editor who obtained a job ID could download System-Admin-only content. Fix stamps `required_tier` on the job and re-checks it.

**Preconditions.** System Admin + a delegated editor. Job type that stamps System-Admin tier: the audit-log binary export.

**Steps.**
```bash
# As System Admin: enqueue an audit-log binary export, capture the job ID
JOB=$(curl -s -u 'sysadmin:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/admin/audit-log/export/binary" | tr ',' '\n' | grep -o '[a-f0-9]\{32\}' | head -1)
echo "job=$JOB"
# As a manage_wpsg-only editor: try to read and download it
curl -s -o /dev/null -w "read  %{http_code}\n"     -u 'editor_a:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB"
curl -s -o /dev/null -w "dl    %{http_code}\n"     -u 'editor_a:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB/download"
# As the System Admin: same calls
curl -s -o /dev/null -w "admin %{http_code}\n"     -u 'sysadmin:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB"
```

**Expected (pass).** Editor `read`/`dl` → **403**; System Admin → **200** (and download works once the job completes).

**Why it proves the fix.** The editor passes the coarse `require_admin` permission callback yet is still denied by the stamped-tier re-check. Pre-fix both returned `200`.

**Regression checks.** A **campaign** export job (editor-tier, `POST /campaigns/{id}/export/binary` created by an editor with space access) remains readable/downloadable by that editor — editor-tier jobs are unaffected.

**Pitfalls.** Job IDs are 32-hex and expire (1 h TTL) — don't reuse a stale ID. The download returns `409` until the job status is `complete`; the tier check fires **before** that, so a 403 is correct even on an incomplete job.

---

### P63-E-2 — Creator-ownership on export jobs (same-tier peer)

**What & why.** `require_admin` is global (not space-scoped), so even at the same tier a peer editor holding a job ID could read another editor's job. Fix stamps `created_by` and restricts access to the creator; System Admins retain global access; unknown creator (`created_by = 0`, legacy/CLI) falls back to tier-only.

**Preconditions.** Two delegated editors, **both** granted the same space S (so both *can* create in S), and a campaign in S.

**Steps.**
```bash
# Editor A creates a campaign (editor-tier) export in space S
JOB=$(curl -s -u 'editor_a:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/<CID_in_S>/export/binary" | grep -o '[a-f0-9]\{32\}' | head -1)
# Editor B (same tier, same space) tries to read it
curl -s -o /dev/null -w "peerB %{http_code}\n"  -u 'editor_b:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB"
# Editor A (the creator) reads it
curl -s -o /dev/null -w "ownerA %{http_code}\n" -u 'editor_a:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB"
# System Admin reads it
curl -s -o /dev/null -w "admin %{http_code}\n"  -u 'sysadmin:APPPW'  "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB"
```

**Expected (pass).** `peerB` → **403**; `ownerA` → **200**; `admin` → **200**.

**Why it proves the fix.** Both editors share tier *and* space, so only ownership can distinguish them. Pre-fix `peerB` was `200`. (Because ownership stops a peer here, this scenario is *not* the one that demonstrates P63-I — for that you need the owner to lose space access; see P63-I.)

**Regression checks.** Owner A's own read/download keeps working through job completion. A job with no `created_by` (e.g. WP-CLI `wp ... export`, run as no user) falls back to tier-only — confirm an editor can still read a CLI-created editor-tier job.

**Pitfalls.** Don't conflate this with P63-I. Here A and B both have space S; the denial is by identity. If B were denied by *space*, you couldn't tell the two gates apart — keep B in the same space.

---

### P63-F — `is_private_ip()` reserved-range completeness

**What & why.** Adds IPv4 benchmarking `198.18.0.0/15`, multicast `224.0.0.0/4`, reserved `240.0.0.0/4` (incl. `255.255.255.255`) and the IPv6 NAT64 well-known prefix `64:ff9b::/96` (extracts the embedded IPv4 and recurses), closing SSRF gaps in the oEmbed proxy's private-IP filter.

**Manual QA: N/A (rationale).** This is a pure IP-classification helper with no user-facing surface. It is exhaustively covered by `WPSG_P63F_Private_IP_Test` (each new range, NAT64 mapping to metadata/RFC-1918, and adjacent-public regressions asserting no false positives). Arranging a live oEmbed request whose host resolves into one of these ranges is impractical and adds nothing over the unit assertions.

**If you want a smoke check anyway:** confirm the automated `WPSG_P63F_Private_IP_Test` passes, and that the existing SSRF/oEmbed suite shows no regression on previously-blocked ranges (RFC-1918, loopback, link-local, IPv6 ULA). See P63-H for a live public-target sanity check that exercises the same proxy path.

---

### P63-G — Bearer-auth branch hardening (defense-in-depth)

**What & why.** Pre-fix, the mere *presence* of an `Authorization: Bearer …` header made `verify_admin_auth()` skip the nonce check, regardless of whether any token was validated. Fix: the skip is honored only when `is_user_logged_in()` **and** the `wpsg_bearer_auth_verified` filter (default `false`) asserts a real integration validated *this* credential. Not directly exploitable pre-fix (WP core demotes a nonce-less cookie session to user 0), but trusting an unvalidated header is needless.

**Preconditions.** An admin REST route, e.g. `GET /spaces` (`require_admin`). No JWT/token integration installed (default).

**Steps.**
```bash
# 1. Bare Bearer, nothing else — the pre-fix bug case
curl -s -o /dev/null -w "%{http_code}\n" -H 'Authorization: Bearer garbage' \
  "$BASE/wp-json/wp-super-gallery/v1/spaces"                                   # → 401/403
# 2. A real integration confirms the credential (simulate via mu-plugin):
#      add_filter('wpsg_bearer_auth_verified', '__return_true');
#    AND a logged-in user context — then the skip is honored.
```

**Expected (pass).** Step 1 → rejected (`401`/`403`). With the filter set to true on a genuinely logged-in request → honored.

**Why it proves the fix.** Pre-fix, step 1's header presence alone caused `verify_admin_auth()` to return `true`. Now an unvalidated Bearer header confers nothing.

**Regression checks.** Normal auth is unaffected: cookie+`X-WP-Nonce` admin requests still work; Application Password (HTTP Basic) requests still work (that path returns `is_user_logged_in()`, no nonce). Confirm both against `GET /spaces`.

**Pitfalls.** Don't mix a valid Application Password with the Bearer header when testing step 1 — that would authenticate via Basic and mask the point. Step 1 must carry *only* the Bearer header.

---

### P63-H — Provider handlers use `wp_safe_remote_get()`

**What & why.** All four oEmbed provider handlers switched `wp_remote_get()` → `wp_safe_remote_get()`, so each is SSRF-safe on any call path (not only through the proxy's out-of-band filter). Behavior-identical for legitimate public targets.

**Preconditions.** The oEmbed proxy route `GET /wp-json/wp-super-gallery/v1/oembed?url=…` and a real, public embeddable URL.

**Steps.**
```bash
curl -s "$BASE/wp-json/wp-super-gallery/v1/oembed?url=https://rumble.com/<a-real-video>" | head -c 300; echo
```

**Expected (pass).** A normal oEmbed payload resolves (title/thumbnail/html), i.e. no behavior change for public targets.

**Why it proves the fix.** `wp_safe_remote_get()` blocks private/reserved targets at the HTTP layer but is transparent for public ones — so a working public resolve confirms no regression while the SSRF protection is now unconditional.

**Regression checks.** The existing oEmbed/provider suite stays green. `grep -rn 'wp_remote_get(' includes/providers/` returns **zero** hits (all migrated).

**Pitfalls.** A private/loopback `url=` is *supposed* to fail now — don't read that as a regression. Use a genuinely public URL for the positive check.

---

### P63-I — Per-space authorization scoping of export jobs

**What & why.** Export jobs stamp the campaign space(s) their content came from; read/delete/download re-check that the requesting editor **currently** has access to **every** contributing space (Key Decision D: *all* contributing spaces, symmetric with the `require_campaign_batch_space_access` create gate). System Admins bypass; jobs with no stamped space skip the gate.

**Why the setup must revoke a grant.** Ownership (P63-E-2) already blocks a *peer* editor. To isolate the **space** gate you need a case where **ownership passes but space fails** — i.e. the *creator* who has since lost access to a contributing space. So: create as an editor who holds the space, then revoke it.

**Preconditions.** Delegated editor `editor_a`; spaces A and B; campaigns in A and in B.

**Steps — single space.**
```bash
# Grant editor_a space A; create a campaign export in A (editor is the creator)
#   (grant via admin UI or the §3 REST recipe)
JOB=$(curl -s -u 'editor_a:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/<CID_in_A>/export/binary" | grep -o '[a-f0-9]\{32\}' | head -1)
curl -s -o /dev/null -w "before-revoke %{http_code}\n" -u 'editor_a:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB"   # → 200 (owner + has A)
# Revoke editor_a's grant to space A, then re-check
#   DELETE /spaces/<A_ID>/access/<editor_a_ID>   (as sysadmin)
curl -s -o /dev/null -w "after-revoke  %{http_code}\n" -u 'editor_a:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB"   # → 403
curl -s -o /dev/null -w "download      %{http_code}\n" -u 'editor_a:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB/download" # → 403 (before the not-ready check)
```

**Steps — batch "all contributing spaces".**
```bash
# Grant editor_a BOTH A and B; create a batch export spanning a campaign in A and one in B
JOB=$(curl -s -u 'editor_a:APPPW' -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/batch/export/binary" \
  -H 'Content-Type: application/json' -d '{"ids":[<CID_in_A>,<CID_in_B>]}' | grep -o '[a-f0-9]\{32\}' | head -1)
curl -s -o /dev/null -w "both %{http_code}\n" -u 'editor_a:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB"   # → 200
# Revoke ONLY space B, re-check — one missing contributing space denies the whole aggregate
#   DELETE /spaces/<B_ID>/access/<editor_a_ID>
curl -s -o /dev/null -w "minusB %{http_code}\n" -u 'editor_a:APPPW' "$BASE/wp-json/wp-super-gallery/v1/export-jobs/$JOB" # → 403
```

**Expected (pass).** Single: `before-revoke 200`, `after-revoke 403`, `download 403`. Batch: `both 200`, `minusB 403`.

**Why it proves the fix.** The actor is unchanged (still the owner, still `manage_wpsg`), so neither tier nor ownership explains the flip to 403 — only the re-checked **space** gate does. The batch case proves the **all-spaces** semantics: losing access to *one* contributing space denies the aggregate.

**Regression checks.**
- **System Admin** reads/downloads the same job regardless of grants → `200` (owner everywhere).
- An editor who **retains** all contributing-space grants keeps full access.
- **Spaceless / non-space jobs** are unaffected: an `audit` or `media-library` job has no stamped space and relies on tier + ownership only (already covered by P63-E/-E-2).

**Pitfalls.**
- If you test the denial with a *peer* editor instead of revoking the owner's grant, you're re-testing **ownership** (P63-E-2), not space scoping — the 403 would come from the wrong gate.
- `isolation_mode` is irrelevant here (see §2) — don't switch modes expecting the gate to change; change **grants**.
- To *create* the batch in the first place, the editor needs access to **all** included spaces (the create gate) — that's why you grant A+B first, then revoke.

---

## 5. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P63-A | `429`s appear past the limit on a non-persistent-cache host | Redis host still throttles; suite green | ☐ |
| P63-B | Two clients behind one trusted proxy get independent buckets | XFF ignored without trusted-proxy; oEmbed window filter independent | ☐ |
| P63-C | Security headers on shortcode page + REST; assets `immutable`, `sw.js` no-store | No headers on non-shortcode page; SPA loads | ☐ |
| P63-D | Crafted `actor_login` cell inert in a spreadsheet | Ordinary CSV content unchanged | ☐ |
| P63-E | Editor `403` on a System-Admin-tier job; admin `200` | Editor-tier campaign job still works for editor | ☐ |
| P63-E-2 | Peer editor `403` on another editor's job; owner/admin `200` | Owner keeps access; CLI/legacy tier-only fallback works | ☐ |
| P63-F | Automated `WPSG_P63F_Private_IP_Test` green (manual N/A) | SSRF suite: no regression on old ranges | ☐ |
| P63-G | Bare `Bearer` header rejected on admin route | Cookie+nonce and App-Password auth still work | ☐ |
| P63-H | Public oEmbed target still resolves via the proxy | Zero `wp_remote_get(` in `includes/providers/`; suite green | ☐ |
| P63-I | Owner flips to `403` after their contributing-space grant is revoked; batch denied when one space missing | Admin bypass; retained-grant editor OK; spaceless jobs unaffected | ☐ |

**Automated baseline (must be green alongside manual QA):** full wp-env PHPUnit suite — `OK — 1166 tests, 13258 assertions, 0 failures` (see PHASE63_REPORT.md → Outcome). Manual QA covers the request-lifecycle behaviors that unit tests calling functions directly cannot.
