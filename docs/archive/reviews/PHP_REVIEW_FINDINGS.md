# PHP Code Review — Findings & Task Backlog

This document tracks the findings of a full review of the plugin's PHP surface (`wp-plugin/wp-super-gallery/` — bootstrap, `uninstall.php`, and all of `includes/`; ~23k lines excluding tests, vendor, and generated language files). Items follow the [FUTURE_TASKS.md](FUTURE_TASKS.md) conventions: each entry carries **Context**, **What to fix/implement**, **Files**, and an **Effort | Impact** estimate. Items promoted to active phase execution should move into phase reports and be checked off here.

**Review date:** 2026-07-13 (branch `feat/phase62-monetization-licensing`, v0.90.0)
**Method:** full manual read of every non-generated PHP source file, hook-timing and call-graph tracing, option/table/cron inventory cross-checked against `uninstall.php`, plus a clean run of the `WordPress.Security` PHPCS ruleset (`composer lint:php` → **0 findings**).

**Triage (2026-07-14):** every finding below was independently re-verified against current source (not just trusted from this doc) — all 39 confirmed accurate, zero disputes. All are now planned across five phase reports; see each phase's Rationale/Key Decisions for sequencing and any scope calls made during triage.

| Findings | Phase |
|---|---|
| A-1, A-2, B-2, B-3, B-4, B-5, B-6, B-7 | [PHASE63_REPORT.md](PHASE63_REPORT.md) — Rate Limiting, Security Header & SSRF Hardening Completion |
| A-7, A-8, A-13, A-14, B-1, C-2 | [PHASE64_REPORT.md](PHASE64_REPORT.md) — Access Request, Grants & Auth Correctness |
| C-1, A-4, A-5, A-12, E-4, G-4 | [PHASE65_REPORT.md](PHASE65_REPORT.md) — Campaign Import/Export Consolidation |
| A-3, A-6, A-10, A-11, C-3, F-1 | [PHASE66_REPORT.md](PHASE66_REPORT.md) — Campaign & Analytics Data Integrity, Lifecycle Bookkeeping |
| D-1, D-2, C-4, C-5, C-6, E-1, E-2, E-3, E-5, A-9, G-1, G-2, G-3 | [PHASE67_REPORT.md](PHASE67_REPORT.md) — PHP Code Quality: Refactor, Efficiency & Dead-Code Sweep |

---

## Overall Assessment

The PHP side is in **very good shape** — clearly the product of deliberate, phase-by-phase security work. Highlights worth calling out before the findings:

- **Authorization architecture** — `WPSG_Permissions` is a single, auditable action→strategy map covering every REST route; it fails closed for unknown actions, and `actor_has_tier()` is the one WP-coupling seam. This is genuinely better than what most commercial plugins ship.
- **Input handling** — every REST input path traced lands in a sanitizer (`WPSG_Settings_Sanitizer`, `WPSG_Layout_Templates::build_template()`, `WPSG_CPT::sanitize_media_items()` as a registered meta sanitize callback, `sanitize_audit_details()` with depth caps). Enum allowlists and numeric range clamps are used consistently. `$wpdb` usage is uniformly `prepare()`d.
- **SSRF defenses** — the oEmbed proxy has pre-flight DNS validation (A + AAAA), IPv6-aware private-range blocking, an allowlist, HTTPS-only enforcement, **and** a `pre_http_request` re-validation filter that closes the DNS-rebinding TOCTOU gap. Exports use `wp_safe_remote_*`.
- **SVG pipeline** — `enshrined/svg-sanitize` plus a custom CSS pass, a custom URI-attribute pass, an `.htaccess` with CSP + PHP-execution-off in the upload dir, and pre-flight dependency checks. Multi-layered and correct.
- **Magic-link flow** — 256-bit key, only the SHA-256 hash stored, `hash_equals()` compare, TTL, and consume-before-process replay protection.
- **DB layer** — idempotent option-guarded migrations, InnoDB pinning so the transactional cross-space move is actually atomic, request-level space cache, batched backfills with resumable offsets.
- **Honest engineering** — concurrency/performance trade-offs are documented in docblocks (`WPSG_Logger`, `get_campaigns_for_attachment_id()`'s `_doing_it_wrong` performance cliff warning) rather than hidden.

The findings below are therefore mostly **correctness bugs in non-core paths, hook-timing mistakes, duplicated logic that has already started to drift, and lifecycle completeness** — not fundamental security defects. The two most impactful items are A-1 (rate limiting silently ineffective on default hosting) and A-2 (security headers never actually sent).

### Suggested fix order (highest value first)

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 1 | A-1 Rate limiting no-ops without a persistent object cache | Small | High |
| 2 | A-2 Security/cache headers are dead code (hook timing) | Small-Medium | Medium-High |
| 3 | A-3 Space-filtered analytics always empty (missing `space_id` stamping) | Small | Medium-High |
| 4 | C-1 Consolidate the 4 campaign import copies (fixes A-4 by construction) | Medium | High |
| 5 | A-14 Split revoke granularity: campaign-scoped vs company-wide (decided) | Small-Medium PHP + Small-Medium FE | Medium-High |
| 6 | B-1 Access-request email abuse vector | Small | Medium |
| 7 | A-6 Archive auto-purge keys off creation date, not archived date | Small-Medium | Medium |
| 8 | F-1 Uninstall completeness (options/tables/dirs/indexes) | Small-Medium | Medium |

---

## A. Correctness Bugs

### A-1: Public rate limiting is a silent no-op on hosts without a persistent object cache

**Context:** `WPSG_REST_Base::rate_limit_check()` chooses its backend with `if (function_exists('wp_cache_incr'))` ([class-wpsg-rest-base.php:132](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php#L132)). WordPress core **always** defines `wp_cache_incr()` — even for the default non-persistent, per-request array cache — so the transient fallback below it is unreachable dead code. On the majority of WP hosts (no Redis/Memcached drop-in), every request starts with a fresh in-memory cache: the counter is always 1, the limit is never exceeded, and `rate_limit_public` / `rate_limit_authenticated` / `rate_limit_magic_approve` enforce **nothing**. PHPUnit doesn't catch this because all test "requests" share one PHP process, so the array cache accumulates. (The oEmbed proxy is unaffected — `WPSG_Rate_Limiter` is transient-based.)

**What to fix:** Gate the object-cache path on `wp_using_ext_object_cache()` instead of `function_exists()`. The existing transient fallback then becomes live for default hosts exactly as designed. Add a regression test that asserts the transient path is taken when `wp_using_ext_object_cache()` is false.

**Files:** [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php) (`rate_limit_check`).

**Effort:** Small (1-line condition + test) | **Impact:** High — restores the advertised abuse protection (login endpoint, access-request endpoint, magic-approve, public listings) on standard hosting.

---

### A-2: Security headers and asset cache headers are dead code (hook-timing)

**Context:** Three related timing mistakes make the header subsystem inert:

1. `wpsg_add_security_headers()` runs on `send_headers`, but its gate `$GLOBALS['wpsg_has_shortcode']` is only set inside `render_shortcode()` during `the_content` — long **after** `send_headers` fired ([wp-super-gallery.php:516-532](../wp-plugin/wp-super-gallery/wp-super-gallery.php#L516-L532), [class-wpsg-embed.php:189](../wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php#L189)).
2. The REST conditions (`?rest_route=`, `/wp-json/...` in the URI) are also unreachable: REST requests are served and terminated by `rest_api_loaded()` during `parse_request`, **before** `WP::main()` reaches `send_headers`.
3. `WPSG_Embed::register_assets()` adds `add_asset_cache_headers` to `send_headers` from inside `wp_enqueue_scripts` — an action that fires after `send_headers` already ran; and static files under `/wp-content/plugins/...` are served by the web server without entering PHP at all.

Net effect: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, the optional CSP, and the immutable-asset `Cache-Control` header are (almost) never emitted. The P54-A tests pass because they call the functions directly, which can't detect hook-timing issues.

**What to fix:**
- Shortcode pages: detect `has_shortcode(get_post()->post_content, 'super-gallery')` (or the block equivalent) on `template_redirect`/`wp` — both run before output — and send headers there.
- REST responses: attach the headers via `rest_pre_serve_request` (the plugin already uses this hook for CORS) or `rest_post_dispatch`.
- Static assets: drop the PHP path and document the required server config (Apache `.htaccess` snippet / nginx block) for long-cache immutable headers, or write an `.htaccess` into `assets/` the way the overlays/fonts dirs already do.
- Add an integration test that performs a real dispatch and asserts on emitted headers.

**Files:** [wp-super-gallery.php](../wp-plugin/wp-super-gallery/wp-super-gallery.php) (`wpsg_add_security_headers`, `wpsg_should_add_security_headers`), [class-wpsg-embed.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php) (`register_assets`, `add_asset_cache_headers`).

**Effort:** Small-Medium (2-4 h incl. tests) | **Impact:** Medium-High — the hardening the plugin already claims to apply starts actually applying; asset caching improves front-end performance on Apache hosts.

---

### A-3: Space-filtered analytics are always empty — inserts never stamp `space_id`

**Context:** The v11 migration added a `space_id` column to all four campaign-scoped tables, and P50-A fixed **audit-log** inserts to stamp it ([class-wpsg-db.php:846-851](../wp-plugin/wp-super-gallery/includes/class-wpsg-db.php#L846-L851)). But `record_analytics_event()` still inserts without `space_id` ([class-wpsg-analytics-controller.php:93-104](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-analytics-controller.php#L93-L104)), while `get_analytics_summary()` filters `AND space_id = %d` — so a space-scoped analytics summary reports **zero** views/visitors for every event recorded since P47. `sync_media_refs()` and `insert_access_request()` have the same gap (latent — no current query filters those tables by `space_id`, but the columns sit permanently at 0). This was captured as knowledge-store error-pattern #27 during P50 and never completed.

**What to fix:** Resolve the campaign's space at insert time (same pattern as `insert_audit_entry`) in all three writers; optionally ship a one-time option-guarded backfill (`UPDATE t JOIN wp_postmeta pm ON pm.post_id = t.campaign_id AND pm.meta_key = '_wpsg_space_id' SET t.space_id = pm.meta_value WHERE t.space_id = 0`). Add a space-filtered summary assertion to the analytics tests.

**Files:** [class-wpsg-analytics-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-analytics-controller.php), [class-wpsg-db.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-db.php) (`sync_media_refs`, `insert_access_request`, new backfill).

**Effort:** Small (2-3 h) | **Impact:** Medium-High — a visible, currently-wrong number in the space analytics UI.

---

### A-4: JSON campaign export/import never carries the layout template (pre-CPT legacy code)

**Context:** The **binary** (ZIP) export/import correctly round-trips templates via `WPSG_Layout_Templates::get()/create()`. The **JSON** path predates the P20-I-1 CPT migration and is doubly broken:
- Export: `get_post(intval($template_id))` — template IDs are UUID strings, so `intval()` yields 0 and `layout_template` is always `null`; the meta keys it would read (`slots`/`background`/`graphic_layers`) don't exist on the CPT anyway ([class-wpsg-export-controller.php:91-104](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-export-controller.php#L91-L104)).
- Import: creates a post with post type `wpsg_layout_template` (the registered CPT is `wpsg_layout_tpl`), writes the wrong meta shape, and binds the campaign to the numeric post ID even though template lookup is by UUID `post_name` — an orphan post plus a dangling binding ([class-wpsg-export-controller.php:186-230](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-export-controller.php#L186-L230)).

Notably the **WP-CLI** JSON export/import already does this correctly (uses `WPSG_Layout_Templates::get`/`::create`) — evidence the REST path was simply missed during the CPT migration.

**What to fix:** Mirror the CLI/binary approach in the REST JSON path — ideally as part of C-1, which removes this code entirely. Add a JSON round-trip test that asserts the template survives.

**Files:** [class-wpsg-export-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-export-controller.php) (`export_campaign`, `import_campaign`).

**Effort:** Small standalone; free if C-1 lands | **Impact:** Medium — a documented export feature silently drops the layout half of a campaign.

---

### A-5: Campaign-filtered media-library export exports nothing (UUID through `intval()`)

**Context:** `export_media_library_binary()` restricts the export to a campaign by mapping `media_items[]['id']` through `intval()` ([class-wpsg-media-controller.php:1592-1604](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-media-controller.php#L1592-L1604)). Media-item `id`s are UUIDs (or custom strings) — `intval()` yields 0 for all of them, `$att_ids` collapses to `[0]`, and the "campaign exists but has no media" empty-export branch triggers even for media-rich campaigns. The WP attachment ID lives in `attachmentId`. The P48-F test doesn't exercise the filter with realistic UUID ids, which is why it passes.

**What to fix:** Map `intval($item['attachmentId'] ?? 0)` instead; extend the test with a UUID-id fixture.

**Files:** [class-wpsg-media-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-media-controller.php), [tests/WPSG_P48F_Media_Export_Test.php](../wp-plugin/wp-super-gallery/tests/WPSG_P48F_Media_Export_Test.php).

**Effort:** Tiny (<1 h) | **Impact:** Medium — the campaign filter of the media export feature is fully broken.

---

### A-6: Archive auto-purge keys off campaign *creation* date, not *archived* date

**Context:** `WPSG_Maintenance::trash_archived_campaigns()` selects `status=archived` campaigns whose **`post_date_gmt`** (creation date) is older than `archive_purge_days` ([class-wpsg-maintenance.php:73-92](../wp-plugin/wp-super-gallery/includes/class-wpsg-maintenance.php#L73-L92)). The intended semantics are "archived for N days" — as implemented, a two-year-old campaign archived *yesterday* is trashed on the next daily cron. Mitigations: the feature is off by default (`archive_purge_days = 0`) and phase 2 (trash purge) uses `post_modified_gmt`, which approximates trash time, so there's a grace window before permanent deletion. Still, the retention promise is wrong.

**What to fix:** Write an `archived_at` timestamp when a campaign is archived (best done inside the consolidated status writer from C-3) and query on that meta. Migrate existing archived campaigns by seeding `archived_at` from the audit log's `campaign.archived` entries (or, conservatively, from "now" so nothing is purged early).

**Files:** [class-wpsg-maintenance.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-maintenance.php), campaign status write sites (see C-3).

**Effort:** Small-Medium (3-4 h) | **Impact:** Medium — data-loss-adjacent semantics on an opt-in feature; fix before promoting the setting in docs.

---

### A-7: Approved access-request users are created with no way to log in

**Context:** `do_approve_request()` provisions missing users via `wp_create_user($username, wp_generate_password(), $email)` and emails "your access has been approved — visit the site" ([class-wpsg-access-controller.php:545-604](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php#L545-L604)) — but never sends credentials or a reset link. A brand-new visitor granted access via the (otherwise excellent) magic-link flow lands on a login form with a password nobody knows; they must discover "Lost your password?" on their own. The parallel `create_user` admin endpoint *does* send `wp_new_user_notification(..., 'user')`.

**What to fix:** Call `wp_new_user_notification($user_id, null, 'user')` after `wp_create_user()` in `do_approve_request()` (or include a reset link in the approval email). Test: assert the notification fires for the new-user path and not for the existing-user path.

**Files:** [class-wpsg-access-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php).

**Effort:** Tiny | **Impact:** Medium — the access-request happy path is broken for first-time visitors.

---

### A-8: Magic-link inline-HTML fallback is served through the JSON encoder

**Context:** When no landing page is configured, `magic_link_redirect()` returns a `WP_REST_Response` whose *data* is an HTML string ([class-wpsg-access-controller.php:669-705](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php#L669-L705)). `WP_REST_Server::serve_request()` JSON-encodes response data, so the browser receives a quote-wrapped, backslash-escaped blob under `Content-Type: text/html` — a visually broken page. The CSV export in the same codebase already solves this correctly with a one-shot `rest_pre_serve_request` filter ([class-wpsg-campaign-controller.php:952-961](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php#L952-L961)).

**What to fix:** Reuse the `rest_pre_serve_request` echo pattern for the HTML fallback (or always redirect — e.g. to `home_url()` with the `wpsg_result` query arg — and drop inline HTML entirely).

**Files:** [class-wpsg-access-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php).

**Effort:** Small | **Impact:** Low — cosmetic, only when `magic_link_landing_page_id` is unset (which is the default).

---

### A-9: Media-library "size" sort orders by a serialized blob

**Context:** `list_media_library()` maps `size_asc/size_desc` to `orderby => meta_value_num` on `_wp_attachment_metadata` ([class-wpsg-media-controller.php:1319-1320](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-media-controller.php#L1319-L1320)) — a serialized PHP array whose numeric cast is 0 for every row, so the sort is a no-op with arbitrary order.

**What to fix:** Either persist a dedicated numeric meta (e.g. `_wpsg_filesize`, backfilled from attachment metadata via an option-guarded batch, written on upload) and sort on that, or remove the two size options from the enum until supported.

**Files:** [class-wpsg-media-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-media-controller.php).

**Effort:** Small-Medium (backfill variant) | **Impact:** Low — admin convenience sort.

---

### A-10: Campaign templates appear in campaign listings (admin scope)

**Context:** User campaign templates are `wpsg_campaign` posts flagged with `_wpsg_is_template` ([class-wpsg-campaign-templates.php:99-113](../wp-plugin/wp-super-gallery/includes/class-wpsg-campaign-templates.php#L99-L113)), but `list_campaigns()` never excludes that flag — templates surface as draft campaigns in the admin `campaigns.list` API (anonymous/viewer listings are shielded by the draft/private gates). They also appear in the wp-admin Campaigns list table.

**What to fix:** Add a `['key' => '_wpsg_is_template', 'compare' => 'NOT EXISTS']` clause to `list_campaigns()` (and optionally `pre_get_posts` for the wp-admin list). Verify the frontend admin panel isn't already compensating client-side.

**Files:** [class-wpsg-campaign-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php) (`list_campaigns`).

**Effort:** Tiny | **Impact:** Low-Medium — admin-facing data hygiene; templates can be "archived"/edited as if they were campaigns.

---

### A-11: Duplicating a campaign drops its space and its category/tag terms

**Context:** `WPSG_Campaign_Duplicator::duplicate()` copies a fixed meta-key list plus the `wpsg_company` term — but not `_wpsg_space_id` (the copy falls back to the Default Space, silently escaping a delegated space) and not the `wpsg_campaign_category` / `wpsg_campaign_tag` taxonomies ([class-wpsg-campaign-duplicator.php:35-82](../wp-plugin/wp-super-gallery/includes/class-wpsg-campaign-duplicator.php#L35-L82)).

**What to fix:** Add `_wpsg_space_id` to the copied meta and copy the two taxonomies alongside `wpsg_company`. Consider whether the duplicate endpoint's permission gate should then also verify target-space access (it already requires access to the source campaign's space, and the copy stays in that space once fixed — so no new gate needed).

**Files:** [class-wpsg-campaign-duplicator.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-campaign-duplicator.php).

**Effort:** Tiny | **Impact:** Low-Medium — surprising space escape + lost categorization on a common operation.

---

### A-12: Silent truncation caps on binary exports

**Context:** `export_audit_log_binary()` fetches `per_page => 5000, page => 1` and `export_media_library_binary()` fetches `posts_per_page => 500, paged => 1` — both silently drop everything beyond the cap with no indication in the manifest or response.

**What to fix:** Either loop pages until exhausted (size limits in `WPSG_Export_Engine` already bound the ZIP), or include `truncated: true` + totals in the manifest/response so the operator knows.

**Files:** [class-wpsg-campaign-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php) (`export_audit_log_binary`), [class-wpsg-media-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-media-controller.php) (`export_media_library_binary`).

**Effort:** Small | **Impact:** Low-Medium — compliance exports (audit) especially should never silently truncate.

---

### A-13: `create_user`'s email-failure fallback can never trigger

**Context:** `wp_new_user_notification()` is wrapped in `try/catch (Exception)` ([class-wpsg-auth-controller.php:415-423](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-auth-controller.php#L415-L423)), but `wp_mail()` catches PHPMailer exceptions internally and returns `false` — nothing throws. `$email_sent` is therefore always `true` and the thoughtful reset-URL fallback below it is unreachable on real mail failure.

**What to fix:** Hook `wp_mail_failed` around the call (set a flag in a closure, remove after) or send the mail directly via `wp_mail()` and check its boolean.

**Files:** [class-wpsg-auth-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-auth-controller.php).

**Effort:** Small | **Impact:** Low — the fallback exists precisely for flaky-mail hosts and currently never fires.

---

### A-14: Campaign-scoped revoke silently removes company-wide grants — split revoke granularity — **DECIDED 2026-07-13**

**Decision (user, 2026-07-13):** revoke from the campaign by default; provide an explicit, separate mechanism for company-wide revoke. Both granularities must exist end-to-end. *(This entry deliberately includes the frontend scope — the fix is incoherent without it; PHP/FE mixing is accepted for this track.)*

**Context:** `DELETE /campaigns/{id}/access/{userId}` currently removes the user's grants from **three** stores at once: campaign postmeta, per-campaign overrides, **and company termmeta** ([class-wpsg-access-controller.php:326-363](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php#L326-L363)) — so revoking one campaign silently revokes every campaign of that company. Two aggravating facts:

- **The granularity already exists everywhere else.** Granting supports both scopes (`POST /campaigns/{id}/access` with `source: 'company'|'campaign'` writing to termmeta vs postmeta, plus dedicated `POST/DELETE /companies/{id}/access[/{userId}]` endpoints), per-campaign **deny overrides** exist (`action: 'deny'` → `access_overrides` postmeta, checked first in `get_effective_campaign_level()`), and the frontend access UI (`src/hooks/useAdminAccessState.ts`) already has the `accessSource` picker on grant and calls the company-scoped revoke from its company view. Only the campaign-scoped revoke handler is over-broad.
- **It is also a permission-tier inconsistency.** `company.access.revoke` is gated `require_system_admin` in the `WPSG_Permissions` map, but the campaign revoke (gated `require_campaign_space_access`, reachable by space editors) mutates those same company grants — a space editor can currently destroy System-Admin-tier company-wide grants through the side door.

**Semantics subtlety to implement correctly:** for a user whose access comes from a **company** grant, merely deleting their (non-existent) campaign grant would not remove access. "Revoke from this campaign" for a company-sourced user must therefore write a **deny override** (the mechanism exists and already wins over grants in precedence).

**What to implement:**

*PHP* ([class-wpsg-access-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php)):
- `revoke_access()`: remove **campaign-level** grants for the user; if (and only if) an active company grant also covers this user, add a per-campaign deny override instead of touching termmeta. Never modify company grants from this endpoint. Distinct audit actions (`access.revoked` vs `access.denied_via_revoke` or similar) so the log tells the two apart.
- Company-wide revoke stays exactly where it is (`DELETE /companies/{id}/access/{userId}`, `require_system_admin`) — no change needed; the tier inconsistency disappears once the campaign endpoint stops reaching into termmeta.
- Response should tell the client what happened (`{ removed: 'campaign_grant' | 'deny_override_added' }`) so the UI can phrase its confirmation.
- Tests: extend the P33-C matrix — campaign-sourced revoke removes only campaign grant; company-sourced revoke adds override and leaves company grant intact and other campaigns accessible-minus-this-one; space editor cannot affect company grants via any campaign endpoint.

*Frontend* (`src/hooks/useAdminAccessState.ts`, the Access tab components):
- The campaign-view revoke of an entry with `source: 'company'` should get confirm-dialog copy distinguishing the outcomes: "Block this user on this campaign only (their company-wide access is kept)" — plus a second, visually distinct action "Revoke company-wide…" that calls the existing company endpoint (shown only to System Admins, matching the gate).
- The "all" view (line ~162, per-entry campaign-scoped delete) inherits the same handling.
- The access list already renders `source` per entry, so no data-model change is expected — copy + action wiring only.

**Files:** [class-wpsg-access-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php), [tests/WPSG_P33C_Role_Enforcement_Test.php](../wp-plugin/wp-super-gallery/tests/WPSG_P33C_Role_Enforcement_Test.php), `src/hooks/useAdminAccessState.ts` + Access tab UI components.

**Effort:** Small-Medium (PHP: ~half day incl. tests) + Small-Medium (FE: confirm-dialog copy, company-revoke affordance, i18n for new strings) | **Impact:** Medium-High — correct blast radius on a destructive action, plus closes the space-editor→company-grant tier leak.

---

## B. Security Hardening

*(No exploitable defects found; these strengthen an already-strong posture.)*

### B-1: Public access-request endpoint is an email-abuse vector

**Context:** `POST /campaigns/{id}/access-requests` is public and sends **two** emails per request — an admin notification (to the fixed `admin_email`) **and a confirmation to the requester-supplied address, which the code never verifies the caller owns** ([class-wpsg-access-controller.php:398-486](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php#L398-L486)). That second email is the problem: an unauthenticated endpoint that emails an attacker-chosen recipient is a mail-amplification / email-bombing primitive. Rate limiting is the generic `rate_limit_public` (60/min/IP — and currently a no-op per A-1); the duplicate/cooldown check only applies per email+campaign, so distinct addresses sail through.

**Concrete attack walkthrough:**
1. Attacker (no account) runs a loop: for each address in a victim list, `POST /wp-json/wp-super-gallery/v1/campaigns/{any_public_campaign_id}/access-requests` with `{"email": "<victim>"}`.
2. Each request passes the public permission callback — no login, and per **A-1** the rate limit doesn't currently even fire.
3. The handler emails *"Your access request for [Campaign] has been received"* to `<victim>` — an address the **attacker** chose and the code never checked the caller controls.
4. Fallout: (a) every address on the list gets unsolicited mail bearing **your** site's name/domain — harassment for which your site looks like the sender; (b) the admin inbox takes one notification per request; (c) the bounce + "mark as spam" volume from unwilling recipients degrades your **sending domain's reputation**, which then degrades delivery of the site's *legitimate* mail (approval notices, WP password resets, receipts).
5. Rate limiting only throttles steps 1–3 — the "email any address I type" capability persists. Deferring the requester email to the approval step **removes** it: no requester-facing mail is sent until an admin approves, so no attacker can trigger mail to an address of their choosing.

**Decision (user, 2026-07-13):** do both halves — they close different holes:
- **Structural fix:** stop sending the requester confirmation on submit; send a requester-facing email only from the approve/deny handlers (an approval email already exists in `do_approve_request()`; a denial email already exists in `deny_access_request()` behind the `wpsg_send_denial_email` filter — so the "resolved" mails are covered). On submit, rely on the 201 response message the UI already shows; change its copy from "check your email for confirmation" to "you'll receive an email once your request is reviewed". The admin notification (fixed recipient) still fires immediately.
- **Rate/abuse fix:** give the endpoint its own tight limit (e.g. 5/min/IP + a daily per-IP cap on *distinct* emails) and a `wpsg_access_request_precheck` filter so operators can wire a CAPTCHA/honeypot — this handles admin-inbox flooding and general hammering that the deferral doesn't.

**Files:** [class-wpsg-access-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php) (`submit_access_request` — drop the requester `wp_mail`; confirm approve/deny mails cover the requester-facing cases), [class-wpsg-permissions.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-permissions.php) (new tighter strategy), [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php) (limiter + precheck filter), plus the submit-form success-copy string on the frontend (new i18n string).

**Effort:** Small (the deferral is a deletion + copy change; the rate limit depends on A-1 landing first to be meaningful) | **Impact:** Medium — closes a classic abuse pattern on a public endpoint that emails attacker-chosen addresses, and protects the site's own mail deliverability.

---

### B-2: CSV formula injection in the audit-log CSV export

**Context:** `audit_csv_response()` quotes and doubles quotes, but doesn't neutralize cells beginning with `=`, `+`, `-`, `@`, TAB, or CR — the classic CSV/Excel formula-injection vector (OWASP). User-influenced values reach cells: `actor_login`, and campaign titles/emails inside the JSON-encoded `details`.

**What to fix:** Prefix a `'` (or space) to any cell whose first character is in the dangerous set, in one small helper used for every column.

**Files:** [class-wpsg-campaign-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php) (`audit_csv_response`).

**Effort:** Tiny | **Impact:** Low-Medium — the export is admin-only, but the file is exactly the kind of thing that gets opened in Excel.

---

### B-3: Two rate-limiter implementations with divergent client-IP handling

**Context:** `WPSG_Rate_Limiter` (oEmbed proxy) has trusted-proxy `X-Forwarded-For` handling via `get_client_ip()`; `WPSG_REST_Base::rate_limit_check()` uses raw `REMOTE_ADDR`. Behind any reverse proxy/CDN (very common), all public traffic shares **one** bucket per route — once A-1 makes limiting real, legitimate visitors would trip 429s collectively (e.g. `campaigns.list` at 60/min *site-wide*). The two implementations also share the `wpsg_rate_limit_window` filter name with different signatures, so tuning one silently tunes the other.

**What to fix:** Consolidate on one service: `rate_limit_check()` should use `WPSG_Rate_Limiter::get_client_ip()`; longer-term, make `WPSG_Rate_Limiter` the single storage backend (object-cache when `wp_using_ext_object_cache()`, transients otherwise) and have the REST-base strategies delegate. Namespace the filters distinctly or document the shared knob.

**Files:** [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php), [class-wpsg-rate-limiter.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-rate-limiter.php).

**Effort:** Small-Medium | **Impact:** Medium — correctness of limits behind proxies; removes a duplicate implementation. Bundle with A-1.

---

### B-4: `is_private_ip()` reserved-range gaps

**Context:** The IPv4 list omits `224.0.0.0/4` (multicast), `240.0.0.0/4` (reserved) incl. `255.255.255.255`, and `198.18.0.0/15` (benchmarking); IPv6 misses the NAT64 well-known prefix `64:ff9b::/96`, whose embedded IPv4 can map to RFC-1918 space on NAT64 networks. Practical exploitability is very low (multicast/reserved are rarely useful SSRF targets; NAT64 is niche), but the function aims to be exhaustive and nearly is.

**What to fix:** Add the four ranges; for `64:ff9b::/96`, extract the trailing 32 bits and recurse like the existing `::ffff:` handling.

**Files:** [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php) (`is_private_ip`).

**Effort:** Tiny | **Impact:** Low — completeness hardening.

---

### B-5: `verify_admin_auth()` Bearer branch trusts header *presence*

**Context:** Any request carrying `Authorization: Bearer <anything>` skips the nonce check ([class-wpsg-rest-base.php:669-671](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php#L669-L671)). This is *not* practically exploitable today: WP core already zeroes out cookie-authenticated users lacking a valid nonce before permission callbacks run, and cross-origin custom headers require CORS preflight approval (the allowlist is empty by default). But the layer's value as defense-in-depth is weakened by trusting an unvalidated header, and the reasoning is subtle enough that it deserves either a comment or a tightening.

**What to fix:** Either document the reliance on `rest_cookie_check_errors()` in a comment at the branch, or only honor the Bearer skip when a token-auth plugin actually authenticated the user (e.g. `is_user_logged_in() && !wp_validate_auth_cookie('', 'logged_in')`, or a filterable flag set by the JWT integration).

**Files:** [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php).

**Effort:** Tiny-Small | **Impact:** Low — defense-in-depth clarity.

---

### B-6: Export-job read/download gate is broader than some job creators

**Context:** Export jobs are created under varying gates (per-campaign space access; audit-log export requires `manage_options`), but `export_jobs.read/delete/download` all sit at `require_admin` (`manage_wpsg`). Job IDs are 128-bit random, so guessing is impractical — but a leaked job ID would let any space editor download, say, a full audit-log ZIP they couldn't create.

**What to fix:** Stamp `created_by` + a required-tier flag on the job record at `create_job()` time and enforce it in the three job endpoints.

**Files:** [class-wpsg-export-engine.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-export-engine.php), [class-wpsg-export-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-export-controller.php).

**Effort:** Small | **Impact:** Low — requires a job-ID leak; tightens tier separation.

---

### B-7: Provider handlers use `wp_remote_get` instead of `wp_safe_remote_get`

**Context:** The oEmbed proxy's request-time SSRF filter protects non-allowlisted hosts, and allowlisted hosts are known-good — but the provider classes themselves (`Rumble`, `Direct`, `WPCore`, `OG_Fallback`) call plain `wp_remote_get`. If any handler is ever invoked outside `proxy_oembed()` (they're publicly registerable via `wpsg_register_providers`), the safety net is gone.

**What to fix:** Switch the four handlers to `wp_safe_remote_get` — behavior-identical for legitimate targets, and each handler becomes independently safe.

**Files:** [includes/providers/](../wp-plugin/wp-super-gallery/includes/providers/).

**Effort:** Tiny | **Impact:** Low — defense-in-depth.

---

## C. Duplicate-Code Abstractions

### C-1: Campaign import/export exists in four drifting copies — extract a `WPSG_Campaign_IO` service

**Context:** The campaign import pipeline (insert post → scalar meta map → gallery overrides → layout template → media refs/sideload → audit) is implemented **four times**: REST JSON (`import_campaign`), REST ZIP (`import_single_campaign_from_zip`), CLI JSON (`campaign_import`), CLI ZIP (`campaign_import_binary`) — plus three near-identical export/manifest builders (REST JSON, REST binary, CLI). The copies have already diverged in ways that are now bugs or inconsistencies:
- REST JSON import/export has the dead template path (**A-4**); CLI does it right.
- REST ZIP import dedupes media by MD5 (`find_attachment_by_md5`); CLI ZIP import does not — same archive, different outcomes.
- The scalar `$meta_map` blocks differ subtly (REST validates schedule datetimes via `strtotime` normalization; CLI writes them via `sanitize_text_field` only, relying on the meta sanitize callback).
- All import copies write media `source => 'url'`, which isn't in the registered allowlist and is coerced to `'wp'` by `sanitize_media_items()` — accidental behavior that should be explicit.

**What to implement:** One `WPSG_Campaign_IO` (or namespaced service) exposing `build_manifest($post_id)` and `import_entry(array $entry, ?ZipArchive $zip)`; REST controllers and CLI become thin transport wrappers (HTTP status shaping / `WP_CLI::error` respectively). A-4 disappears by construction, ZIP-vs-CLI dedupe unifies, and the JSON/ZIP schema versions live in one file.

**Files:** [class-wpsg-export-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-export-controller.php), [class-wpsg-cli.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-cli.php), new `includes/class-wpsg-campaign-io.php`.

**Effort:** Medium (1-2 days incl. keeping all existing tests green) | **Impact:** High — removes ~350 duplicated lines, fixes two real inconsistencies, and makes the next manifest-version bump a one-place change.

---

### C-2: Grants storage/logic is scattered — extract a grants helper

**Context:** Access-grant handling repeats across three storage locations (campaign postmeta, company termmeta, space-table JSON) with three identical `upsert_*` implementations (`upsert_grant`, `upsert_override`, `upsert_space_grant`), four copies of the expiry check (`!empty($e['expires_at']) && strtotime(...) < time()`), duplicated `expires_at` request validation (campaign + company + space grant endpoints), and duplicated page-slice user-enrichment blocks (`list_access`, `list_company_access`, space `list_access`). Any future change to grant shape (e.g. adding `granted_by` uniformly) currently touches ~10 sites.

**What to implement:** A small value-helper (e.g. `WPSG_Grants`): `upsert(array $grants, array $entry)`, `remove(array $grants, int $user_id)`, `is_expired(array $entry, ?int $now)`, `filter_active(array $grants)`, `parse_expiry_param($raw): string|null|WP_Error`, plus `enrich_users(array $entries)` for the response shaping. Storage stays where it is (postmeta/termmeta/space JSON) — this is pure logic extraction, no schema change, fully covered by the existing P28-B/P33/P47/P53 test matrix.

**Files:** [class-wpsg-access-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php), [class-wpsg-space-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-space-controller.php), [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php), [class-wpsg-maintenance.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-maintenance.php), new `includes/class-wpsg-grants.php`.

**Effort:** Medium (0.5-1 day) | **Impact:** Medium-High — consistency for the security-critical grant logic; one place to fix expiry-handling forever.

---

### C-3: Campaign status writes happen at five call sites — centralize (and enable A-6)

**Context:** `update_post_meta($id, 'status', ...)` for archive/restore is written independently in: `archive_campaign`, `restore_campaign`, `batch_campaigns`, `archive_company`, the auto-archive cron batch helper (`wpsg_archive_campaign_status_batch`), and the CLI archive/restore commands. Each site separately remembers (or forgets) the audit entry, the `do_action`, and cache invalidation — and none of them writes an `archived_at` timestamp, which is the root cause of A-6.

**What to implement:** A single `WPSG_Campaign_Status::set(int $id, string $status, array $ctx = [])` that validates the enum, writes the meta plus `archived_at`/`restored_at` bookkeeping, fires the matching hook + audit entry, and leaves batch-SQL optimization as an internal concern for the cron path.

**Files:** [class-wpsg-campaign-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php), [class-wpsg-access-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-access-controller.php) (`archive_company`), [wp-super-gallery.php](../wp-plugin/wp-super-gallery/wp-super-gallery.php) (cron batch), [class-wpsg-cli.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-cli.php).

**Effort:** Small-Medium | **Impact:** Medium — prerequisite for A-6; ends the copy-paste drift on a state transition with side effects.

---

### C-4: Upload error/duplicate response shaping duplicated

**Context:** Two duplications around uploads: (1) `upload_media()`'s single-file and batch paths each hand-build the same duplicate/near-duplicate 409 payloads (~80 lines of parallel field mapping); (2) the `$_FILES['error']` → message/status `switch` exists twice — `get_upload_error_data()` in the media controller and an inline copy in `upload_font()` in the content controller.

**What to implement:** A `format_upload_result(WP_Error|array $upload, string $filename): array` helper for the 409 shaping, and move `get_upload_error_data()` to `WPSG_REST_Base` so the font path reuses it.

**Files:** [class-wpsg-media-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-media-controller.php), [class-wpsg-content-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-content-controller.php), [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php).

**Effort:** Small | **Impact:** Low-Medium — keeps single/batch upload responses from drifting.

---

### C-5: Global-settings write path exists three times

**Context:** `update_settings()` and `patch_settings()` in the settings controller are ~80% identical (from_js → admin-only guard → sanitize → merge → changed-keys audit), and `update_space_settings()` (P57-A) re-implements the same "sanitize + intersect + changed-keys + `update_option` + audit" block for global keys routed through the space panel.

**What to implement:** One private `write_global_settings(array $snake_input, bool $patch_only, string $via)` used by all three.

**Files:** [class-wpsg-settings-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-settings-controller.php), [class-wpsg-space-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-space-controller.php).

**Effort:** Small | **Impact:** Low-Medium — audit-entry and guard behavior stays in lockstep.

---

### C-6: Minor duplications (bundle into any touch of the file)

- The three `media_items` meta-sync closures in the bootstrap (`updated_post_meta` / `added_post_meta` / `deleted_post_meta`) are near-identical — one named function can serve all three hooks ([wp-super-gallery.php:291-306](../wp-plugin/wp-super-gallery/wp-super-gallery.php#L291-L306)).
- `normalize_external_media()` in the media controller re-implements Rumble/Odysee/BitChute URL→ID parsing that partially overlaps the provider handlers; at minimum share the Rumble video-ID regex as a constant.
- `resolve_user` (space controller) vs `search_users` (auth controller) — two user-search shapes; fine, but keep the `search_columns` lists aligned.

**Effort:** Tiny each | **Impact:** Low.

---

## D. Large-Function Reduction (no functionality loss)

### D-1: `sanitize_settings()` — collapse ~40 hand-written field blocks into the registry-driven loop

**Context:** [class-wpsg-settings-sanitizer.php:266-546](../wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php#L266-L546) is ~280 lines, of which ~40 explicit `if (isset($input['x']))` blocks re-implement exactly what the generic trailing loop already does from registry metadata (bool cast, `intval` + range clamp, enum allowlist, float clamp). Examples: `items_per_page` hand-clamps 1–100; `cache_ttl` hand-clamps 0–604800; a dozen pure `(bool)` casts. Only a handful of blocks do anything the generic loop can't (`api_base` URL, `typography_overrides`, `viewer_bg_gradient`, `gallery_config`, `card_config`, `card_border_color` hex-with-fallback).

**What to implement:** Move the hand-written ranges into `WPSG_Settings_Registry::$field_ranges` (many already exist there — verify equivalence per field), delete the redundant blocks, and keep a short explicit list for the genuinely special fields. Mechanical, and the extensive `WPSG_Settings_Test`/`WPSG_Settings_Extended_Test` suites pin the behavior.

**Files:** [class-wpsg-settings-sanitizer.php](../wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php), [class-wpsg-settings-registry.php](../wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php).

**Effort:** Medium (mostly careful verification per field) | **Impact:** Medium — the single biggest function shrinks by ~60%, and new settings stop needing sanitizer edits at all.

---

### D-2: `list_campaigns()` — extract query-builder and cache-key stages

**Context:** ~245 lines mixing cache-key assembly, sort mapping, meta/tax query construction, permission scoping, media enrichment, and caching. It works and is tested; the cost is readability and the subtle `$meta_query` reassignment dance (built, assigned, extended, reassigned) that has to be re-derived on every read.

**What to implement:** Extract `build_campaign_query_args($filters, $is_system_admin, $user_id)` and `build_campaign_cache_key($filters, ...)` as pure private helpers. No behavior change; unit-test the builder directly.

**Files:** [class-wpsg-campaign-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php).

**Effort:** Small-Medium | **Impact:** Low-Medium — maintainability of the most-trafficked endpoint. (C-1 covers the other giant functions: `upload_media`, the import bodies.)

---

## E. Efficiency Improvements (no functionality risk)

### E-1: Replace `wp_get_object_terms()` with `get_the_terms()` in hot paths

**Context:** `wp_get_object_terms()` **always** queries the DB; only `get_the_terms()` reads the object-term cache that `WP_Query`/`update_object_term_cache()` primes. Affected: `get_company_term()` + `get_campaign_category_ids()` run per item in `format_campaign()` (≈2 queries × per_page on every uncached `campaigns.list`), and `list_companies()` calls `wp_get_object_terms()` per campaign in its indexing loop *immediately after* priming the cache — the comment claims O(1), but the priming is currently wasted.

**What to implement:** Swap to `get_the_terms()` (handles `false`/`WP_Error` returns), keep output identical. In `list_campaigns`, the posts come from `WP_Query` with default `update_post_term_cache`, so the cache is already primed and the swap is free query elimination.

**Files:** [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php) (`get_company_term`, `get_campaign_category_ids/_names`), [class-wpsg-content-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-content-controller.php) (`list_companies`).

**Effort:** Small | **Impact:** Medium — removes ~2N queries from the primary listing endpoint on cache miss.

---

### E-2: Prime meta caches in full-scan loops

**Context:** Several loops fetch post IDs with `fields => 'ids'` (which skips meta-cache priming) and then call `get_post_meta()` per post — one meta query each: `get_accessible_campaign_ids()` (runs per user on permission-cache miss; also triggers a `WPSG_DB::get_space()`-guarded space check per campaign), `purge_expired_grants()` (daily cron, all campaigns), `count_expired_grants_pending_cleanup()` (every `/admin/health` call), `get_campaigns_for_attachment_id()` (already tracked with a `_doing_it_wrong` cliff warning).

**What to implement:** `update_meta_cache('post', $ids)` per batch before the loops (and `array_chunk` the unbounded ones to keep memory flat). For `get_accessible_campaign_ids`, additionally prime `update_object_term_cache` since `can_view_campaign` → `get_company_term` needs terms (pairs with E-1).

**Files:** [class-wpsg-rest-base.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php), [class-wpsg-maintenance.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-maintenance.php), [class-wpsg-monitoring.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-monitoring.php).

**Effort:** Small | **Impact:** Medium on installs with hundreds of campaigns; zero behavior change.

---

### E-3: Dispatch the first webhook delivery asynchronously

**Context:** `WPSG_Webhooks::dispatch()` performs attempt #1 synchronously inside the originating request — up to 5 endpoints × 10 s timeout appended to every campaign create/update/media-add when an endpoint is slow or down. Retries already go through WP-Cron.

**What to implement:** Route attempt #1 through the same `wp_schedule_single_event(time(), RETRY_HOOK, ...)` mechanism used for retries (the endpoint-UUID payload shape already exists), or make the first POST non-blocking (`'blocking' => false`) and treat attempt #1 as fire-and-forget with attempt #2 as the first verified one. Preference: the cron route — keeps the delivery log accurate.

**Files:** [class-wpsg-webhooks.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-webhooks.php).

**Effort:** Small | **Impact:** Medium — admin-save latency stops depending on third-party endpoint health.

---

### E-4: Stream ZIP entries on media-library import

**Context:** `import_media_library_binary()` (and the campaign ZIP imports) read each archive entry fully into memory via `$zip->getFromName()` before writing to a temp file — a large video spikes PHP memory by its full size.

**What to implement:** Use `ZipArchive::getStream()` + `stream_copy_to_stream()` into the temp file handle.

**Files:** [class-wpsg-media-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-media-controller.php), [class-wpsg-export-controller.php](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-export-controller.php) (folds into C-1), [class-wpsg-cli.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-cli.php).

**Effort:** Small | **Impact:** Low-Medium — removes an OOM risk on video-heavy imports.

---

### E-5: Micro-items (informational; batch into adjacent work)

- `wpsg_oembed_failure_count` is created with autoload **on** (`update_option` default) and incremented per public-endpoint failure — set `autoload=false` and/or fold into the existing `wpsg_oembed_provider_failures` structure.
- `bump_cache_version()` invalidates *all* plugin caches (incl. per-user permission caches) on every media edit — acceptable simplicity today; revisit only if write-heavy installs report cache thrash.
- `list_media` performs writes on GET (type normalization + ID backfill). This is deliberate self-healing and the registered meta sanitizer keeps persisted data clean — keep, but document the intent inline so it isn't "fixed" later.
- `WPSG_Maintenance::register()` runs 4× `wp_next_scheduled` + up to 3× `wp_clear_scheduled_hook` on every request — cheap, but a `wpsg_needs_cron_sync` option flag (set on settings save) would make init work O(1).
- `media_items` REST meta schema (CPT registration) omits `width`/`height`/`filesize`/`dateUploaded`/`tags` that the REST layer emits — harmless, but aligning the schema helps API consumers.

---

## F. Uninstall & Lifecycle Completeness

### F-1: `uninstall.php` misses options, two tables, two upload directories, and core-table indexes

**Context:** `preserve_data_on_uninstall` defaults to **true**, so cleanup only runs when the operator explicitly opts out — but when they do, the promise is "remove all plugin data", and the current script leaves behind:

- **Options** (verified by inventory of every `*_option()` call + option-name constants): `wpsg_webhook_endpoints` (contains **webhook secrets** — arguably the most important one), `wpsg_webhook_delivery_log`, `wpsg_recent_logs`, `wpsg_rest_request_count`, `wpsg_rest_error_count`, `wpsg_oembed_failure_count`, `wpsg_alert_email_queue`, `wpsg_export_job_index`, `wpsg_font_library`, `wpsg_campaign_tables_innodb_v15`, `wpsg_space_library_assoc_backfilled`, and all per-hash `wpsg_thumb_%` rows (P49-F moved the thumbnail index to per-hash options; uninstall still deletes only the legacy `wpsg_thumbnail_cache_index`).
- **Tables:** `wpsg_assets` (uninstall drops the pre-P50-K name `wpsg_overlays` only) and `wpsg_space_library_assoc`.
- **Directories:** `wpsg-fonts/` and `wpsg-exports/` (only `wpsg-thumbnails/` and `wpsg-overlays/` are removed).
- **Indexes:** the custom `wpsg_postmeta_postid_key` / `wpsg_termmeta_termid_key` indexes added to **core** tables by `WPSG_DB::add_indexes()` are never dropped.
- **Cron:** the uninstall cron-clear list differs from `wpsg_deactivate()`'s (missing the maintenance hooks, webhook retry, export-engine hooks). Deactivation normally runs first so this is belt-and-braces, but the two lists should share one constant.

**What to fix:** Extend `uninstall.php` accordingly (options list, `LIKE 'wpsg\_thumb\_%'` delete, both tables, both dirs, `DROP INDEX` guarded by existence checks) and define the canonical cron-hook list in one place used by both deactivate and uninstall. Consider a smoke test that diffs the option inventory against the uninstall list so future options can't silently escape (the inventory grep in this review is a one-liner).

**Files:** [uninstall.php](../wp-plugin/wp-super-gallery/uninstall.php), [wp-super-gallery.php](../wp-plugin/wp-super-gallery/wp-super-gallery.php) (`wpsg_deactivate`).

**Effort:** Small-Medium | **Impact:** Medium — data-removal correctness is a marketplace-review credibility item, and orphaned webhook secrets are a mild security residue.

---

## G. Dead Code & Minor Cleanups

### G-1: Remove the deprecated permission primitives

`require_campaign_editor()`, `require_campaign_owner()`, and `require_space_owner()` (~90 lines in `WPSG_REST_Base`) are marked DEPRECATED/unused in the `WPSG_Permissions` MAP legend and have **zero** callers outside their definitions (verified by grep). Delete them (the map legend already documents the history).
**Effort:** Tiny | **Impact:** Low — shrinks the security-critical file.

### G-2: Assorted dead/vestigial code

- `enrich_media_with_dimensions()` deprecated wrapper (media controller) — no callers.
- `WPSG_Layout_Templates::check_size_limit()` — documented always-true no-op.
- `WPSG_Image_Optimizer::get_stats()` — only called from its own test; either wire it into `/admin/health` or drop it. Related: `generate_webp()` writes sibling `.webp` files that are never registered as attachments and never cleaned on attachment delete — hook `delete_attachment` or document.
- Stray section-marker comments in the media controller (a "P15-B Layout Template Handlers" header above an empty region at EOF; a "P14-C Thumbnail cache endpoints" header above the tag handlers), and the trailing "Public read-only endpoint" comment at the end of the access controller.
**Effort:** Tiny | **Impact:** Low.

### G-3: `get_effective_campaign_level()` mixes `$user_id` with `current_user_can()`

The function takes `$user_id` and uses `user_can($user_id, ...)` for the space gate, but the admin short-circuit uses `current_user_can('manage_wpsg')` ([class-wpsg-rest-base.php:359](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-rest-base.php#L359)). All current callers pass the current user, so no live bug — but it's a latent trap for reuse. Switch to `user_can($user_id, ...)`.
**Effort:** Tiny | **Impact:** Low (latent-bug removal).

### G-4: Media `source` value drift

Imports write `source => 'url'`, which the registered sanitizer coerces to `'wp'`; the REST `create_media` enum accepts `upload|external|library` while the meta sanitizer accepts `upload|library|wp|external|oembed`. Pick the canonical set once (likely the sanitizer's) and use it in both the route args and the import builders (folds into C-1).
**Effort:** Tiny | **Impact:** Low — prevents future "why is this source value different" archaeology.

---

## H. Open Questions (decisions needed before the corresponding fixes)

1. ~~**`revoke_access` company-grant side effect.**~~ **DECIDED 2026-07-13** — revoke from the campaign by default, with an explicit separate company-wide revoke. Granularity already exists on the grant side (`source: 'company'|'campaign'`) and on the company revoke endpoint; the fix is scoped (PHP + frontend) in **A-14** above.

2. ~~**Access-request emails (B-1): move the requester-confirmation to post-approval?**~~ **DECIDED 2026-07-13** — yes: defer the requester email to the approve/deny step and add the tight rate limit + CAPTCHA seam (both halves). Full mechanic, a concrete attack walkthrough, and the implementation split now live in **B-1** above. Rationale retained below for the record.
   - **The problem is *who chooses the recipient*.** The confirmation email goes to an attacker-supplied, unverified address from a public, unauthenticated endpoint — that makes the site a "send email to any address I type" primitive. Rate limits shrink the volume but never change that property; moving the requester email to post-approval changes it structurally: every outbound mail to a requester then follows a human (admin) decision.
   - **Concrete harms of the current shape:** (a) harassment/spam of arbitrary victims ("Your access request was received" mails they never sent — at the current nominal 60/min/IP that's ~86k/day per IP); (b) **mail-reputation damage** — bounces and spam-button reports from unwilling recipients count against the site's sending domain, degrading deliverability of *all* its legitimate mail (approval mails, WP password resets); (c) backscatter noise for the admin.
   - **What is lost by moving it:** only the instant "we received it" email. The requester already gets immediate on-page feedback (the 201 response message the UI displays); the message text would change from "check your email for confirmation" to "you'll receive an email when your request is reviewed". The admin notification (the operationally required mail carrying the magic-link) still sends immediately — it goes to the fixed `admin_email`, not an attacker-chosen address, so it is only a flooding concern, which the B-1 rate limit covers.
   - **Recommendation stands:** do both — B-1's tight rate limit + CAPTCHA seam now, and drop the pre-approval requester email (approval/denial mails already exist and are unchanged).

3. ~~**oEmbed proxy: keep public or require auth?**~~ **DECIDED 2026-07-13** — flip to `require_admin` + a `wpsg_oembed_proxy_public` filter escape hatch (one-line `WPSG_Permissions::MAP` change, keep the per-IP transient limiter for the filter-opened case). Verified safe: the proxy's only callers are the admin add-external-media previews; no public render path uses it. Pros/cons retained below for the record.
   - **Verified fact:** the proxy's only frontend callers are the two admin "add external media" preview hooks (`src/hooks/useMediaExternal.ts`, `src/hooks/useExternalMediaModal.ts` — Media tab / Add External Media modals). **No public gallery render path calls it** — published galleries use the stored `embedUrl` and the server-side thumbnail cache (which is populated at admin preview time via the `wpsg_oembed_success` hook). So requiring auth costs anonymous visitors nothing today.
   - **Pros of requiring `manage_wpsg`:** removes the public fetch-proxy surface entirely (no anonymous use of the server for metadata recon / IP laundering — the SSRF mitigations become a second layer instead of the only layer); stops anonymous cache-fill (every distinct URL creates a `wpsg_oembed_*` transient row for 5 min–6 h — at 30/min an attacker steadily bloats `wp_options`); matches the actual caller population (editors adding media); the admin panel already sends nonce-authenticated requests through `apiClient`, so no new plumbing.
   - **Cons:** any *future* feature wanting anonymous previews (e.g. visitor-side URL unfurling, or the deferred standalone-SPA/web-component deployment) would need the gate reopened — mitigated by keeping a `wpsg_oembed_proxy_public` filter escape hatch; third-party integrations that discovered the open endpoint would break (none are known or documented); marginally less graceful if an admin's nonce expires mid-session (the existing nonce-heartbeat handles this).
   - **Updated recommendation:** flip to `require_admin` with a documented filter escape hatch — a one-line `WPSG_Permissions::MAP` change (`'system.oembed_proxy' => 'require_admin'`) plus the filter, and delete/soften the long SECURITY NOTE comment. Keep the per-IP transient limiter for the filter-opened-public case.

4. ~~**Uninstall promise scope (F-1) — `wpsg-exports/` in preserve mode, and Freemius data.**~~ **DECIDED 2026-07-13** — delete `wpsg-exports/` in **both** preserve and full-cleanup modes (24 h TTL makes post-uninstall preservation backwards); add one doc sentence telling migrators to move ZIPs out of `uploads/wpsg-exports/` first. Freemius cleanup stays with the SDK; re-check at M2/M3. Rationale retained below.
   - **The one real counter-argument:** someone exports campaigns as a *migration backup* and then uninstalls, expecting the ZIP to survive. It's narrow, and it's undercut by the plugin's own behavior: export jobs have a **24 h TTL** — the cleanup cron would delete that ZIP within a day if the plugin stayed installed, and the authenticated download URL dies with the plugin anyway. Preserving the ZIPs post-uninstall would grant them *more* lifetime than normal operation does, which is backwards for a derived artifact. Anyone migrating should move the ZIP out of `uploads/wpsg-exports/` first — worth one sentence in [guides/PACKAGING_RELEASE.md](guides/PACKAGING_RELEASE.md) / install docs.
   - **Recommendation:** delete `wpsg-exports/` in **both** modes (preserve and full-cleanup), with the doc note. No other downside identified.
   - **Freemius:** when the SDK is connected it manages its own uninstall/account cleanup; nothing for `uninstall.php` to do now. Re-check once real credentials ship (M2/M3) that `fs_accounts` etc. are covered by the SDK's uninstall path in the freemium configuration.

---

## Explicitly Reviewed and Found Sound (no action)

For future reviewers — these were checked in depth and deliberately have **no** entry above: SQL injection surface (all dynamic SQL goes through `prepare()`; dynamic table names come from internal constants); the `WPSG_Permissions` map vs. controller registration (every route resolves through `gate()`); nonce/CSRF layering incl. the login CSRF origin check; privilege escalation on user creation (role allowlist); SVG upload pipeline; magic-link token handling; ZIP path traversal (`sanitize_file_name` on every archive read; `realpath` containment on deletes); the DNS-rebinding SSRF filter; XSS in admin renderers/settings fields (consistent `esc_*` usage — and the security-scoped PHPCS ruleset runs clean); webhook HMAC signing and secret masking; the transactional cross-space move; license gating (freeze-don't-destroy semantics in `enforce_license_gates()` are exactly right).

---

*Document created: 2026-07-13 — full PHP-side review (analysis only; no code changes). Entries should be checked off or moved into phase reports as they are executed.*

*Updated: 2026-07-13 — Q&A round with user. H-1 decided (campaign-default revoke + explicit company-wide mechanism) and promoted to **A-14** with full PHP + frontend scope, after verifying both grant granularities and the company revoke endpoint already exist (`useAdminAccessState.ts` already drives them); the fix also closes a space-editor→company-grant tier leak. H-2 enriched with the full rationale for post-approval confirmation emails (recipient-choice is the structural issue, not volume). H-3 recommendation **changed** to `require_admin` + filter escape hatch after verifying the proxy's only callers are admin add-external-media previews — no public render path uses it. H-4 answered: delete `wpsg-exports/` in both modes (24 h TTL makes preservation-past-uninstall backwards); Freemius cleanup deferred to the SDK once credentials ship.*

*Updated: 2026-07-13 (round 2) — user approved A-14 (H-1), H-3 (oEmbed → require_admin + filter), and H-4 (delete exports both modes); all three marked DECIDED. H-2 (access-request confirmation email) remains open pending a clearer explanation of the abuse mechanic — no change to its recommendation.*

*Updated: 2026-07-13 (round 3) — H-2 DECIDED: defer the requester confirmation email to the approve/deny step **and** add the tight rate limit + CAPTCHA seam. Rewrote **B-1** with the full mechanic, a numbered concrete-attack walkthrough, and the two-part implementation split (structural deferral + rate/abuse control), noting the approve/deny handlers already send the requester-facing "resolved" mails. All four H-section questions are now decided.*
