# Phase 67 — Manual QA & Validation Runbook

**Companion to:** [PHASE67_REPORT.md](PHASE67_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand — exact preconditions, commands, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test. It follows the format of [PHASE66_MANUAL_QA_RUNBOOK.md](PHASE66_MANUAL_QA_RUNBOOK.md).

**Scope:** tracks P67-A … P67-J, plus **P67-R** (§4) — the four fixes from the post-landing PR review pass, which amend P67-F, P67-G, P67-H and P67-I. Phase 67 is a **code-quality** phase — refactors, duplicate-code extraction, query-count efficiency fixes, and dead-code removal. Unlike Phase 66 (100% behavior-visible lifecycle bookkeeping), **most of Phase 67 is deliberately invisible**: the correct manual-QA result for a refactor/deletion track is "nothing changed." Several sub-items therefore have **no** hand-QA script at all — for those this doc states the *rationale* (why an automated test or a repo-wide grep is the only meaningful check) in place of steps. The tracks that *do* have an observable effect (P67-F/G query counts, P67-H webhook latency, P67-I size sort) carry real before/after scripts.

**Golden rule (unchanged from P63–P66):** a fix's test is only meaningful if you have also seen it **fail without the fix**, or you understand precisely why the pre-fix code was wrong. Each section states the pre-fix behavior so a green result actually proves something. The cleanest way to watch these fail is to check out the commit **before** this phase and re-run the same steps:

```bash
git log --oneline | grep -iE 'p67|phase67'   # find the P67 commits
git checkout <commit-before-the-track>        # e.g. the P66 merge commit 9dd39ff7
# …run a step, observe the pre-fix behavior…
git checkout feature/phase67-php-hardening-5-of-5   # back to the fixes
```

**A note on the "no behavior change" tracks.** P67-A/B/C/D/E are refactors whose entire contract is *identical output for identical input*. Their real proof is the **existing** automated suite passing unmodified (it pins the exact outputs byte-for-byte). The manual scripts here are belt-and-braces spot checks on the highest-traffic surfaces, not the primary evidence. Where a track's only correct observation is "unchanged," the section says so explicitly so a reviewer doesn't mistake an unchanged result for an incomplete fix.

---

## 1. Environment & personas

| Requirement | Why |
|---|---|
| Local `wp-env` dev site (`npx wp-env start` from repo root) | Standard test host. Base URL `http://localhost:8888`. |
| `curl` (`-s`/`-i`), `jq` | REST + JSON assertions are scriptable and unambiguous. |
| WP-CLI via `npx wp-env run cli wp …` | For inspecting postmeta/options, running cron, and `SAVEQUERIES`-style query-count checks by hand. |
| System Admin auth for curl (Application Password) | Most endpoints under test are admin-gated. |

```bash
export BASE=http://localhost:8888
export AUTH='-u sysadmin:APP_PASSWORD'     # an Application Password for a System Admin
```

**Personas / auth.** Same RBAC model as Phase 63–66 — see **§2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md)** for creating a System Admin and minting an Application Password.

**Counting queries by hand (used by P67-F and P67-G).** The efficiency tracks are proven by a *drop in query count*, not by different output. The portable way to observe this on the dev site:

```bash
# Wrap any WPSG call in SAVEQUERIES and print how many DB queries it issued.
npx wp-env run cli wp eval '
  define("SAVEQUERIES", true);
  global $wpdb;
  $before = count($wpdb->queries);
  // …invoke the function under test here, e.g.:
  WPSG_REST_Base::get_accessible_campaign_ids( 1 );
  echo (count($wpdb->queries) - $before) . " queries\n";
'
```

The absolute number is host-dependent; what matters is **before-fix count minus after-fix count** with the *same fixture and same warm caches*. Each efficiency section states the shape of the expected drop (e.g. "~2N fewer, where N = campaigns on the page").

---

## 2. Mental model — what actually changed

| Track | The change | Observable? |
|---|---|---|
| P67-A | ~58 hand-written `sanitize_settings()` field blocks collapse into the registry-driven loop | No — identical sanitized output |
| P67-B | `list_campaigns()` query/cache-key assembly extracted into pure helpers | No — identical query args + cache keys |
| P67-C | Single/batch upload 409 shaping + font upload-error switch share one helper each | No — identical response shapes |
| P67-D | Three global-settings write paths call one shared helper | No — identical guard/merge/audit behavior (incl. a deliberately-preserved inconsistency, see §P67-D) |
| P67-E | Three meta-sync closures → one function; Rumble ID token shared; user-search columns confirmed aligned | No — identical behavior |
| P67-F | `wp_get_object_terms()` → `get_the_terms()` on 4 hot-path term lookups | **Yes** — fewer DB queries on cache-primed listings |
| P67-G | Full-scan loops prime meta/term caches before per-row `get_*_meta()` | **Yes** — fewer DB queries on the scanning endpoints |
| P67-H | First webhook delivery attempt moves to WP-Cron instead of blocking the request | **Yes** — admin save is fast even with dead endpoints |
| P67-I | Media-library "size" sort uses a real numeric `_wpsg_filesize` meta | **Yes** — size sort actually orders by size |
| P67-J | Dead permission primitives + vestigial code deleted; one latent `$user_id` bug fixed; a counter option de-autoloaded | Mostly no — deletions with zero live callers |
| P67-R | Review fixes: cache priming actually primes (F/G); unreadable files stamp `0` and the backfill is bounded + cron-resumed (I); a refused cron schedule delivers inline (H) | **Yes** for F/G (the priming was a no-op) and I; no for H's fallback unless cron refuses |

---

## 3. Track-by-track

---

### P67-J — Dead-code & latent-bug sweep

**What & why.** Four independent cleanups bundled into one pass:
- **G-1:** deleted the three deprecated permission primitives `require_campaign_editor()`, `require_campaign_owner()`, `require_space_owner()` from `WPSG_REST_Base` (zero callers since the P53-D role-based rewrite).
- **G-2:** deleted `enrich_media_with_dimensions()` (deprecated wrapper, zero callers), `WPSG_Layout_Templates::check_size_limit()` (private always-`true` no-op, zero callers), and `WPSG_Image_Optimizer::get_stats()` (only its own test called it); relabelled one mislabelled section marker and removed one stray marker + orphaned docblock in the media controller.
- **G-3:** fixed `get_effective_campaign_level()`'s admin short-circuit to resolve the capability against the **passed** `$user_id` (`user_can($user_id, 'manage_wpsg')`) instead of the current request user (`current_user_can('manage_wpsg')`).
- **E-5:** `wpsg_oembed_failure_count`'s two `update_option()` sites now pass `$autoload = false`.

**Most of this track has no hand-QA — and that is correct.** Deleting a function with zero callers has no observable REST/UI surface; the meaningful check is that (a) the automated suite still passes and (b) a repo-wide grep confirms nothing referenced the deleted symbols. Below, each sub-item states its verification; only E-5 has a DB-observable effect worth a CLI check.

#### G-1 / G-2 — deletions (verification: grep + suite, no REST script)

**Pre-fix state.** The three permission primitives and the three vestigial functions existed but had **zero live callers** (confirmed by repo-wide grep during Phase 67 planning). There is no REST route, CLI command, or admin screen that invoked any of them, so there is nothing to click.

```bash
# Prove the deleted symbols are gone AND unreferenced (each must return NOTHING):
cd wp-plugin/wp-super-gallery
grep -rn "require_campaign_editor\|require_campaign_owner\|require_space_owner" --include="*.php" .
grep -rn "enrich_media_with_dimensions\|check_size_limit\|WPSG_Image_Optimizer::get_stats" --include="*.php" .
```

**Expected (pass).** Both greps return nothing. **Why it proves the fix:** any surviving reference would be a call to a now-undefined method — a fatal error waiting to happen. Empty output means the deletions were complete and safe. The `require_space_member` / `require_space_admin` callbacks and `WPSG_Thumbnail_Cache::get_stats()` (a *different*, live, same-named method) are untouched — confirm they still resolve:

```bash
grep -rn "require_space_member\|WPSG_Thumbnail_Cache::get_stats" --include="*.php" includes/ | head
```

**Regression checks.** Full PHP suite green — in particular `WPSG_P52A_Permission_Matrix_Test` (every route still resolves through the map), `WPSG_P33C_Role_Enforcement_Test`, `WPSG_P47_Spaces_Isolation_Test`, and `WPSG_Image_Optimizer_Test` (the two `get_stats` test methods were removed alongside the method). `composer lint:php` stays at 0 findings.

**Pitfall.** `get_effective_campaign_level()` was **intentionally kept** (see G-3) even though G-1 removed its only two callers — it is now reachable only via the reflection-based unit test. That is deliberate, not an oversight; do not "clean it up" as newly-dead code.

#### G-3 — `get_effective_campaign_level()` resolves caps against `$user_id`

**What & why.** The function receives a `$user_id` and gates space access with `can_access_space($space_id, $user_id)`, but its admin short-circuit previously asked `current_user_can('manage_wpsg')` — the *current request* user, not the passed one. All (former) callers passed the current user, so there was **no live bug**; the fix removes a latent trap for any future reuse with a different user id.

**Verification: reflection-based unit test, not a REST walkthrough — and here is why.** After G-1 there is **no live REST path** that reaches this private method, so there is no curl sequence that can exercise it. Its behavior is pinned by `WPSG_P64B_Revoke_Granularity_Test` (which reflects into `WPSG_Access_Controller::get_effective_campaign_level`). The meaningful check is that this test passes with the `user_can($user_id, …)` form. To *prove* the fix matters, a reviewer can add a throwaway assertion that passes a **non-current** user id who has `manage_wpsg` while the current user does not, and confirm the function returns `'owner'` for the passed user — pre-fix it keyed off the wrong user and returned based on the request user's caps.

**Expected (pass).** `WPSG_P64B_Revoke_Granularity_Test` green. **Why a hand test isn't provided:** there is genuinely no user-facing surface to drive; asserting otherwise would be theater.

#### E-5 — `wpsg_oembed_failure_count` no longer autoloads

**Pre-fix behavior.** Both `update_option('wpsg_oembed_failure_count', …)` calls omitted the third argument, so the option defaulted to **autoload = yes** — loaded into memory on every single request despite only ever being read inside the oEmbed failure path.

```bash
# Trigger an oEmbed failure so the option gets written (any un-fetchable URL works):
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/oembed?url=https://example.com/not-an-oembed" >/dev/null

# Inspect the autoload flag directly:
npx wp-env run cli wp db query \
  "SELECT option_name, autoload FROM wp_options WHERE option_name='wpsg_oembed_failure_count'"
# → autoload column reads 'no' (or 'off' on newer WP)
```

**Expected (pass).** `autoload = no`. **Why it proves the fix:** pre-fix the same query returns `autoload = yes`, meaning the counter rode along in `wp_load_alloptions()` on every request. **Pitfall:** on a dev site that recorded a failure *before* this fix, the row may already exist with `autoload = yes`; `update_option(..., false)` flips it on the **next** write, so trigger at least one failure *after* checking out the fix (or `wp option delete wpsg_oembed_failure_count` first, then trigger). This is the same self-healing-on-next-write pattern used elsewhere in the plugin.

**Regression checks.** No dedicated test (option-autoload flags aren't unit-pinned); covered by the full suite staying green and the CLI check above. `uninstall.php` already deletes this option (added in P66-F), so uninstall completeness is unaffected.

---

### P67-F — `get_the_terms()` on hot-path term lookups

**What & why.** Four per-item term lookups switched from `wp_get_object_terms()` (always a DB query) to `get_the_terms()` (reads the object-term cache that `WP_Query` / `update_object_term_cache()` primes): `get_company_term()`, `get_campaign_category_names()`, `get_campaign_category_ids()` in `WPSG_REST_Base`, and `list_companies()`'s per-campaign company lookup in the content controller.

**Pre-fix behavior.** Each `format_campaign()` issued ~2 term queries per campaign (company + category) straight to the DB even on a `campaigns.list` call whose posts came from `WP_Query` (which had already primed the object-term cache).

> **Correction (P67-R).** P67-F originally also "fixed" `list_companies()`'s priming call from `wpsg_campaign` to `wpsg_company`, on the review's premise that it primed the wrong taxonomy. That premise was wrong, and the change was reverted. `update_object_term_cache($ids, $type)`'s second parameter is an **object type** (a post type), which it expands through `get_object_taxonomies()` into *every* taxonomy registered for that type — `wpsg_company` included. Passing a taxonomy name makes the whole call a silent no-op, because `get_object_taxonomies('wpsg_company') === []`. The original `wpsg_campaign` argument was correct all along. See §4.

**Observable effect: query count, not output.** Output is byte-for-byte identical (same terms, same order — `get_the_terms()` and the priming both use the default `orderby => name`). The win is fewer DB queries on cache-primed paths.

```bash
# Seed: a handful of campaigns with a company + category each, then measure the
# query count of a cache-primed campaigns.list. The key is that WP_Query primes
# the object-term cache, so the term lookups should add ZERO extra queries.
npx wp-env run cli wp eval '
  define("SAVEQUERIES", true);
  global $wpdb;
  // Warm: run once so transients/caches settle, then reset the counter.
  $req = new WP_REST_Request("GET", "/wp-super-gallery/v1/campaigns");
  $req->set_param("per_page", 20);
  WPSG_Campaign_Controller::list_campaigns($req);   // populates transient
  delete_transient_like("wpsg_campaigns_");         // force a fresh, uncached build
  $before = count($wpdb->queries);
  WPSG_Campaign_Controller::list_campaigns($req);
  echo "queries for a fresh campaigns.list: " . (count($wpdb->queries) - $before) . "\n";
'
```

**Expected (pass).** The fresh (transient-miss) `campaigns.list` issues meaningfully **fewer** queries than pre-fix — roughly `2 × N` fewer, where N = campaigns returned (one company + one category lookup per campaign eliminated). **Why it proves the fix:** check out the pre-fix commit and run the same block; the delta is the ~2N term queries `wp_get_object_terms()` used to force. **Pitfall:** you must compare a **transient-miss** build both times (the response is cached in a transient for `cache_ttl`); if the transient is warm, `list_campaigns` returns early and issues almost no queries in *both* versions, hiding the difference. The helper above deletes the transient before the measured call. (`delete_transient_like` is shorthand — on the dev site use `wp transient delete --all` between runs.)

**`list_companies()` — spot-check output unchanged:**

```bash
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/companies" | jq '[.[] | {name, campaignCount: (.campaigns | length)}]'
# → same company→campaign groupings as before the fix (correctness preserved; only the query count drops)
```

Note that this endpoint's explicit prime is belt-and-braces either way: `get_posts()` returns full `WP_Post` objects, and WP_Query already primes the object-term cache for its own results. The observable query count therefore does *not* move with the P67-R correction — the fix is to the call's correctness, not its effect here. The place where priming genuinely matters is `get_accessible_campaign_ids()` (P67-G below), which pages with `fields => 'ids'` and so starts entirely cold.

**Explicit non-target.** `enrich_media_with_metadata()` also calls `wp_get_object_terms()`, but as a **batch** lookup across many attachment IDs (`'fields' => 'all_with_object_id'`). `get_the_terms()` only accepts a single object ID, so it is **deliberately left as-is** — not a missed swap. Do not "fix" it to `get_the_terms()` in a loop; that would reintroduce the N+1 this phase removes.

**Regression checks.** Existing campaign-listing and company-listing suites pass unmodified (same term data). The query-count improvement is the manual assertion above; no automated query-count test is added for F on its own — it is exercised jointly with G below.

---

### P67-G — Prime meta/term caches in full-scan loops

**What & why.** Three (four, counting a second loop) full-scan loops fetched IDs with `fields => 'ids'` (which skips meta-cache priming) and then read `get_post_meta()` / `get_term_meta()` per row. Each now primes the relevant cache in bounded batches first:
- `get_accessible_campaign_ids()` — primes the whole page with one `_prime_post_caches($query->posts, true, true)` (post objects + meta + object terms). Pairs with P67-F: `can_view_campaign()` reads several meta keys, calls `get_post()` on the draft branch, and for private campaigns resolves the company term. **Amended by P67-R** — this originally primed meta by hand plus `update_object_term_cache(…, 'wpsg_company')`, which primed nothing (see §4 R1), *and* missed the post-object cache that `get_the_terms()` needs, so P67-F's swap had added a fresh N+1 here. `_prime_post_caches()` covers all three caches and derives the object-type argument itself.
- `purge_expired_grants()` — primes post-meta for the campaign-grant loop **and** `update_termmeta_cache()` for the company-grant loop (the second loop was not in the original review scope; folded in here per Phase 67 planning Decision 4).
- `count_expired_grants_pending_cleanup()` — primes post-meta (runs on every `/admin/health` call).

**Pre-fix behavior.** WordPress lazily primes a post's *entire* meta on the first `get_post_meta()` for that post — but as **N separate single-post queries**, one per row in the loop. Same total data loaded; N× the round-trips.

**Why batch priming is memory-neutral (important — this is why it's safe).** Because the lazy path already loads each post's full meta on first access, priming the whole page up front loads the *same* data into the object cache, just in one query instead of N. Peak memory is unchanged; only the query count drops. The `array_chunk(…, 200)` on the unbounded loops keeps each priming query's `IN (…)` list bounded.

```bash
# Query-count drop for the health-check counter (easiest to observe — it runs live):
npx wp-env run cli wp eval '
  define("SAVEQUERIES", true);
  global $wpdb;
  $rm = new ReflectionMethod("WPSG_Monitoring", "count_expired_grants_pending_cleanup");
  $rm->setAccessible(true);
  $before = count($wpdb->queries);
  $rm->invoke(null);
  echo "queries: " . (count($wpdb->queries) - $before) . "\n";
'
# Seed several campaigns with access_grants meta first so N is non-trivial.
```

**Expected (pass).** With N campaigns carrying grants, the post-fix count is roughly `N-1` fewer than pre-fix (N single-post meta queries collapse into ~1 batched prime). Same returned count of expired grants. **Why it proves the fix:** the pre-fix commit issues one `get_post_meta` query per campaign; the batched prime replaces them with a single `SELECT … WHERE post_id IN (…)`.

**Combined F+G proof on the permission path:**

```bash
npx wp-env run cli wp eval '
  define("SAVEQUERIES", true);
  global $wpdb;
  $before = count($wpdb->queries);
  WPSG_REST_Base::get_accessible_campaign_ids( 1 );   // user 1
  echo "queries: " . (count($wpdb->queries) - $before) . "\n";
'
# Clear the permission transient between pre/post runs: wp transient delete --all
```

**Expected (pass).** Fewer queries than pre-fix by roughly the per-campaign meta + company-term lookups that F and G together eliminate. **Pitfall:** `get_accessible_campaign_ids()` caches its result in a transient for 15 min — delete transients between the pre-fix and post-fix measurement or you will measure a cache hit (near-zero queries) both times.

**Regression checks.** Existing accessible-campaign, grant-purge, and health-count suites pass unmodified (identical IDs / grant counts). Query-count assertions are the manual proof above.

**Pitfall.** `purge_expired_grants()`'s second (company-term) loop uses `update_termmeta_cache()`, not `update_meta_cache()` — priming *term* meta, not post meta. Confirm both loops' outputs (which grants get purged) are unchanged; only the query count moves.

---

### P67-H — First webhook delivery attempt dispatched via WP-Cron

**What & why.** `WPSG_Webhooks::dispatch()` previously performed delivery attempt #1 **synchronously, inline** in the originating request — up to `MAX_ENDPOINTS (5) × 10s` appended to every campaign/media save when an endpoint is slow or down. Attempt #1 now schedules on the same WP-Cron hook the retries (2–3) already use, so the admin request returns immediately and the POST happens on the cron tick. Endpoints without a stable UUID `id` (legacy hand-edited config) fall back to the old synchronous path — they can't be retried by UUID anyway.

**Pre-fix behavior.** `dispatch()` called `deliver(…, 1)` inline per endpoint; a hanging endpoint blocked the save for up to its 10s timeout.

**Primary proof — the save is fast even with a dead endpoint (stopwatch):**

```bash
# Configure an endpoint that black-holes the connection (a non-routable IP that
# will hang until timeout). Create it through the REST API so it gets a UUID id.
EP=$(curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/webhooks" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://10.255.255.1/hook","events":[]}' | jq -r '.id // .endpoint.id')

# Time a campaign save that fires a webhook event. It must return in well under
# the 10s-per-endpoint timeout budget.
CID=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='H timing' --post_status=publish --porcelain)
time curl -s $AUTH -X PUT "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID" \
  -H 'Content-Type: application/json' -d '{"description":"trigger webhook"}' >/dev/null
```

**Expected (pass).** The `time` real duration is a fraction of a second — **not** ~10s+. **Why it proves the fix:** pre-fix, the same save blocks on `wp_safe_remote_post()` until the 10s timeout (×N endpoints) because attempt #1 ran inline; now `dispatch()` only calls `wp_schedule_single_event()` and returns.

**Delivery still happens and is logged accurately (via cron):**

```bash
# Run WP-Cron to fire the scheduled attempt #1, then inspect the delivery log.
npx wp-env run cli wp cron event run wpsg_webhook_retry
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/webhooks/deliveries" | jq '.[0] | {event, attempt, success, statusCode}'
# → an entry with attempt 1 (delivery is logged from the cron run, not the save)
```

**Expected (pass).** After the cron run, the delivery log has an `attempt: 1` entry for the event. **Why it proves the fix keeps the log accurate:** the cron route (vs. a fire-and-forget non-blocking POST) still records the real status of attempt #1. **Gotcha (documented, not a bug):** the first log entry now appears only **after** the cron tick, not the instant the save returns. Immediately after saving, `deliveries` is empty for that event — that is the expected deferral, not a lost delivery.

**Regression checks.** `WPSG_P39IN1_Webhook_Test` passes unmodified — its fixtures save endpoints **without** an `id`, so they exercise the synchronous fallback (`deliver()` is identical in both paths). One **new** test, `test_dispatch_defers_first_attempt_to_cron_for_endpoint_with_id`, covers the fix directly: it asserts the log is empty right after `dispatch()` (no inline delivery), that a `wpsg_webhook_retry` event with `attempt = 1` is scheduled, and that running it logs the delivery. This is the first automated coverage of the cron/retry path, which previously had none.

**Pitfall.** Only endpoints created through the REST API (`POST /webhooks`) get a UUID `id` and therefore the cron path; an endpoint written directly into the `wpsg_webhook_endpoints` option without an `id` will deliver synchronously. Use the REST endpoint (as above) to exercise the async path.

**Amended by P67-R — a refused schedule falls back to inline delivery.** `dispatch()` originally ignored `wp_schedule_single_event()`'s return value. That call returns `false` when a `pre_schedule_event`/`schedule_event` filter vetoes the event, or when an identical event is already queued inside its 10-minute duplicate window — and the delivery was then dropped **with no log entry at all**. `dispatch()` now delivers inline when scheduling is refused, so an attempt is never silently lost:

```bash
# Veto scheduling, dispatch, and confirm the delivery still happened + was logged.
npx wp-env run cli wp eval '
  add_filter("pre_schedule_event", fn() => false, 10, 3);
  update_option(WPSG_Webhooks::LOG_OPTION, []);
  WPSG_Webhooks::dispatch("campaign.created", ["id" => 1, "title" => "veto"]);
  $log = WPSG_Webhooks::get_delivery_log();
  echo "log entries: " . count($log) . " attempt: " . ($log[0]["attempt"] ?? "-") . "\n";
'
# → log entries: 1  attempt: 1   (pre-fix: 0 entries — the delivery vanished)
```

Pinned by `WPSG_P67R_Review_Fixes_Test::test_dispatch_delivers_inline_when_cron_refuses_the_schedule`.

---

### P67-C — Shared upload error / duplicate response shaping

**What & why.** Two duplications removed: (1) the single-file and batch upload paths each hand-built the same 409 duplicate / near-duplicate field set — now both call one `format_duplicate_fields(WP_Error)` helper; (2) `upload_font()` carried an inline copy of the `$_FILES['error']` → message/status switch that already lived in `get_upload_error_data()` — that helper moved up to `WPSG_REST_Base` and `upload_font()` now calls it.

**Pre-fix behavior.** Identical field mappings appeared in `upload_media()`'s single-file branch, its batch branch, and (for the error switch) in both the media controller and the content controller. No behavior change here — purely a dedup; the responses are byte-for-byte the same.

**This is a no-behavior-change refactor — the correct observation is "identical output."** The automated `WPSG_P28N_Duplicate_Detection_Test` pins the single-file and batch 409 field names and is the primary proof. The manual checks below matter most for the **batch near-duplicate** fields, which that test does not pin.

**Duplicate 409 shape — single vs. batch parity:**

```bash
# Upload a file once (force so it lands), then upload the SAME file again without
# force to trigger the exact-duplicate 409. Do it single-file and in a batch.
CID=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='C dup' --post_status=publish --porcelain)

# Prime: force-upload an image.
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/media/upload" \
  -F "file=@/path/to/image.jpg" -F "campaign_id=$CID" -F "force=1" >/dev/null

# Single-file duplicate → 409 body:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/media/upload" \
  -F "file=@/path/to/image.jpg" -F "campaign_id=$CID" \
  | jq '{duplicate, existing_id, existing_url, existing_name, existing_campaigns}'

# Batch duplicate → the matching result entry:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/media/upload" \
  -F "files[]=@/path/to/image.jpg" -F "campaign_id=$CID" \
  | jq '.results[0] | {duplicate, existing_id, existing_url, existing_name, existing_campaigns}'
```

**Expected (pass).** The single-file 409 body and the batch `results[0]` entry carry the **same** `existing_*` field set for the same duplicate (batch additionally wraps `filename`/`success`). **Why it proves the fix:** both now come from `format_duplicate_fields()`; a drift between them is exactly what the shared helper prevents. Repeat with a *visually similar* (not identical) image to exercise the `near_duplicate` / `similar_*` branch — the batch near-dup fields are the ones without automated coverage, so eyeball them here.

**Font upload-error parity:**

```bash
# A zero-byte or oversized "font" triggers the $_FILES['error'] path. The simplest
# deterministic check is the empty-file (UPLOAD_ERR_NO_FILE) case:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/fonts/upload" \
  -F "file=@/dev/null;filename=" | jq '{code, message}'
# → wpsg_font_upload_failed with the same message text get_upload_error_data() produces
```

**Expected (pass).** `upload_font()` returns `wpsg_font_upload_failed` with the message/status the shared `get_upload_error_data()` maps — identical to pre-fix, because the inline switch it replaced was a verbatim copy. **Why it proves the fix:** the error code stays `wpsg_font_upload_failed` (the wrapper is caller-specific) while the message/status now come from the single shared source.

**Regression checks.** `WPSG_P28N_Duplicate_Detection_Test` (single + batch 409 field names) passes unmodified; font-upload coverage passes unmodified. **Pitfall:** the batch near-duplicate (`similar_*`) fields are **not** test-pinned — a regression there would pass CI, so the manual near-duplicate check above is the real guard.

---

### P67-D — Unified global-settings write path

**What & why.** `update_settings()`, `patch_settings()`, and the space panel's global-key routing in `update_space_settings()` now all call one `WPSG_REST_Base::write_global_settings($input, $mode, $bump_cache, $summary_prefix, $audit_extra)`. Each keeps its own permission guard and passes a mode (`replace` / `patch` / `changed`) that reproduces its original merge semantics exactly.

**Pre-fix behavior.** Three near-identical sanitize→merge→changed-keys→`update_option`→audit blocks, one per call site, drifting independently.

**This is a no-behavior-change refactor. One result here is deliberately "still broken" — read carefully.** The point of the manual QA is to confirm each of the three endpoints behaves *exactly* as before, **including** the space panel's pre-existing silent-drop quirk (which P67-D intentionally preserved — see [FUTURE_TASKS.md](FUTURE_TASKS.md) › *Unify settings-write authorization behavior*).

**Parity across the three endpoints:**

```bash
# 1) Full update (replace): write a display key + read it back.
curl -s $AUTH -X PUT "$BASE/wp-json/wp-super-gallery/v1/settings" \
  -H 'Content-Type: application/json' -d '{"itemsPerPage":24}' | jq '.itemsPerPage'   # → 24

# 2) Patch: change one key, confirm OTHER keys are untouched (patch merges only sent keys).
curl -s $AUTH -X PATCH "$BASE/wp-json/wp-super-gallery/v1/settings" \
  -H 'Content-Type: application/json' -d '{"itemsPerPage":18}' | jq '.itemsPerPage'   # → 18

# 3) Space panel routing a global key: sysadmin write lands in the global option.
SID=$(npx wp-env run cli wp eval 'echo WPSG_DB::insert_space(["slug"=>"d-space","name"=>"D","isolation_mode"=>"delegated"]);')
curl -s $AUTH -X PUT "$BASE/wp-json/wp-super-gallery/v1/spaces/$SID/settings" \
  -H 'Content-Type: application/json' -d '{"itemsPerPage":30}' >/dev/null
npx wp-env run cli wp eval '$s=get_option("wpsg_settings",[]); echo $s["items_per_page"] ?? "unset";'   # → 30
```

**Expected (pass).** Each endpoint updates the global option with its own merge semantics, and each emits a `settings.updated` audit entry (the space-panel one additionally carries `via: space-panel`). Confirm via `GET /audit` or the recent-logs option. **Why it proves the fix:** the audit `changedKeys` + summary prefix ("App settings updated:" / "App settings patched:" / "Global settings updated via space panel:") are produced by the shared helper from the same inputs as before.

**The deliberately-preserved quirk (silent drop) — confirm it did NOT change:**

```bash
# As a NON-manage_options user (a wpsg_editor), write a system-level (admin-only)
# global key through BOTH paths and compare the outcomes:
export EDITOR_AUTH='-u editor:APP_PASSWORD'   # a manage_wpsg (not manage_options) user

# /settings → explicit 403 naming the blocked field:
curl -s -o /dev/null -w '%{http_code}\n' $EDITOR_AUTH -X PATCH "$BASE/wp-json/wp-super-gallery/v1/settings" \
  -H 'Content-Type: application/json' -d '{"cacheTtl":120}'      # → 403

# /spaces/{id}/settings → 200, but the global key is SILENTLY DROPPED (no error, not written):
curl -s -o /dev/null -w '%{http_code}\n' $EDITOR_AUTH -X PUT "$BASE/wp-json/wp-super-gallery/v1/spaces/$SID/settings" \
  -H 'Content-Type: application/json' -d '{"cacheTtl":120}'      # → 200
npx wp-env run cli wp eval '$s=get_option("wpsg_settings",[]); echo $s["cache_ttl"] ?? "unset";'   # → unchanged (NOT 120)
```

**Expected (pass).** `/settings` returns **403**; `/spaces/{id}/settings` returns **200** but leaves `cache_ttl` unchanged — i.e. the inconsistency is intact. **Why this is the pass condition, not a failure:** P67-D is a pure refactor; "fixing" the silent drop here would be an out-of-scope behavior change. This unchanged-behavior result is the whole point — the future-task entry tracks the eventual deliberate fix. Do not report the silent drop as a P67-D regression.

**Regression checks.** Settings-controller and space-controller suites pass unmodified.

---

### P67-E — Minor duplications bundle

**What & why.** Three small dedups: **(a)** the three `updated`/`added`/`deleted`_post_meta closures that synced `media_items` refs are now one named handler, `wpsg_sync_media_refs_on_meta_change()`; **(b)** the Rumble video-ID token is a single constant `WPSG_Provider_Registry::RUMBLE_VIDEO_ID_TOKEN` used by both the provider and the media controller; **(c)** `resolve_user()` vs `search_users()` — **no code change**: their `search_columns` were confirmed already aligned during planning.

**Pre-fix behavior.** (a) three near-identical closures; (b) the `v[0-9a-zA-Z]+` token literal appeared in two files; (c) already consistent.

**(a) Meta-sync handler — all three hooks still fire, delete still clears:**

```bash
CID=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='E sync' --post_status=publish --porcelain)

# ADD media_items → refs table gains rows:
npx wp-env run cli wp post meta update $CID media_items '[{"id":"m1","type":"image","url":"http://x/1.jpg"}]' --format=json
npx wp-env run cli wp db query "SELECT COUNT(*) FROM $(npx wp-env run cli wp eval 'echo WPSG_DB::get_media_refs_table();') WHERE campaign_id=$CID"   # → 1

# UPDATE media_items → refs resync:
npx wp-env run cli wp post meta update $CID media_items '[{"id":"m1","type":"image","url":"http://x/1.jpg"},{"id":"m2","type":"image","url":"http://x/2.jpg"}]' --format=json
npx wp-env run cli wp db query "SELECT COUNT(*) FROM $(npx wp-env run cli wp eval 'echo WPSG_DB::get_media_refs_table();') WHERE campaign_id=$CID"   # → 2

# DELETE media_items meta → all refs cleared (the preserved [] quirk):
npx wp-env run cli wp post meta delete $CID media_items
npx wp-env run cli wp db query "SELECT COUNT(*) FROM $(npx wp-env run cli wp eval 'echo WPSG_DB::get_media_refs_table();') WHERE campaign_id=$CID"   # → 0
```

**Expected (pass).** Add → 1 ref, update → 2 refs, delete → 0 refs. **Why it proves the fix:** the single handler must behave identically for all three hooks, and the delete path must still clear *all* refs (pass `[]`, not the deleted value) — that quirk is detected via `current_action()` now instead of a separate closure.

**(b) Rumble token — external add still validates the ID identically:**

```bash
# Add a Rumble URL as external media; the extracted embed id must be unchanged.
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/media/external" \
  -H 'Content-Type: application/json' -d '{"url":"https://rumble.com/v72ksce-some-title.html"}' \
  | jq '{provider, embedUrl}'
# → provider "rumble", embedUrl ".../embed/v72ksce/"  (same as pre-fix)
```

**Expected (pass).** Provider `rumble`, embed URL built from `v72ksce` — identical to pre-fix. **Why it proves the fix:** both the provider's path-extraction regex and the media controller's validation regex now interpolate the same `RUMBLE_VIDEO_ID_TOKEN`; the extracted/validated id must not change. **Load-order note:** the constant lives on the always-loaded `WPSG_Provider_Registry` (not the lazily-loaded `WPSG_Provider_Rumble`) specifically so the media controller can reference it without a fatal — if you see a "class not found" here, that assumption has been broken.

**(c) resolve_user / search_users — rationale only, no QA.** No code changed; the two `search_columns` lists were confirmed identical (`user_login`, `user_email`, `display_name`) during Phase 67 planning. Nothing to test — this sub-item is a documented confirmation, not a change.

**Regression checks.** Media-sync and Rumble-embed coverage passes unmodified.

---

### P67-B — `list_campaigns()` query/cache-key builders extracted

**What & why.** `list_campaigns()`'s cache-key assembly and its 150-line WP_Query-args construction (the `$meta_query` reassignment dance across the admin / anonymous / scoped branches) were extracted into two pure private helpers, `build_campaign_cache_key()` and `build_campaign_query_args()`. `list_campaigns()` is now orchestration: build filters → cache-key → transient check → build args → run query → enrich → cache.

**Pre-fix behavior.** All of that logic lived inline in one ~245-line function.

**No-behavior-change refactor — identical query args and cache keys for identical inputs.** The primary proof is the **new unit tests** (`WPSG_P67B_Query_Builder_Test`, 9 tests) that assert the builders directly: admin (unscoped, no `post__in`, no schedule-window clauses), anonymous (public + draft-exclusion + schedule-window, `relation => AND` fixup), authenticated non-admin (`post__in` scoping), explicit-status override, space/taxonomy filters, sort mapping, and cache-key stability/variation. The manual pass below is a belt-and-braces spot check on the live endpoint.

```bash
# Same filters must return the same items before and after. Exercise several
# combinations and diff the response JSON against a pre-fix capture.
for q in \
  "" \
  "?status=active" \
  "?include_archived=true&sort=title_asc" \
  "?category=news&tag=featured" \
  "?space=1&per_page=5" ; do
  echo "== /campaigns$q =="
  curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/campaigns$q" | jq '{total, ids: [.items[].id], page, perPage}'
done
```

**Expected (pass).** Identical `total` + ordered `ids` for every filter combination, before and after the extraction. Repeat as an anonymous user (drop `$AUTH`) and as a non-admin editor to exercise the scoped branches. **Why it proves the fix:** the extracted builders must reproduce the exact same `WP_Query` args (and therefore results) and the exact same transient cache key — a mismatch would change the item set or silently split/merge cache entries.

**Pitfall.** The response is transient-cached per `cache_ttl`; if you compare pre/post on the same site, clear transients (`wp transient delete --all`) between the two checkouts, or you may compare a stale cached payload built by the other version.

**Regression checks.** `WPSG_P67B_Query_Builder_Test` (new) plus all existing campaign-listing coverage (`WPSG_Campaign_Rest_Test`, `WPSG_P28E_Campaign_Filters_Test`, `WPSG_P52A5b_Campaign_Space_Scoping_Test`, …) pass unmodified.

---

### P67-A — `sanitize_settings()` collapsed into the registry-driven loop

**What & why.** ~52 of the 58 hand-written `if (isset($input['x']))` field blocks were deleted; the generic trailing loop already sanitizes them from `WPSG_Settings_Registry::$valid_options` (enums) and `::$field_ranges` (int/float clamps) plus the default's type (bool casts). Only six genuinely special fields remain hand-written: `api_base` (URL), `card_border_color` (hex with a brand fallback), `typography_overrides`, `viewer_bg_gradient`, `gallery_config`, `card_config` (structured/nested payloads). One range (`rate_limit_requests_per_minute => [0,6000]`) moved into `$field_ranges`. `sanitize_settings()` shrank from ~280 to ~108 lines (~61%).

**Pre-fix behavior.** Every field had its own explicit block re-implementing exactly what the generic loop already does.

**Key equivalence insight (why removing the enums is safe).** The generic loop runs *after* the hand blocks and processes any `$input` key not already in `$sanitized`. So even the enum blocks that "left the value unset on invalid input" were already being normalized to the default by the generic loop on the next pass — meaning the hand block and the generic loop produced the *same* output. That is why all enum/bool/range blocks are removable and only the six bespoke fields stay.

**This is a byte-for-byte no-behavior-change refactor. The automated suite is the real proof.** `WPSG_Settings_Test`, `WPSG_Settings_Extended_Test`, and `WPSG_Settings_Rest_Test` pin the exact sanitized output per field across the full matrix — they are the equivalence oracle and must pass unmodified. A manual end-to-end pass catches anything field-level tests wouldn't:

```bash
# Round-trip a representative spread of field types and confirm the stored,
# sanitized values are what you'd expect (unchanged from pre-fix):
curl -s $AUTH -X PUT "$BASE/wp-json/wp-super-gallery/v1/settings" \
  -H 'Content-Type: application/json' -d '{
    "itemsPerPage": 250,           "cacheTtl": 999999999,
    "theme": "not-a-real-theme",   "enableLightbox": "yes",
    "cardBorderColor": "notacolor","thumbnailScrollSpeed": 99
  }' | jq '{itemsPerPage, cacheTtl, theme, enableLightbox, cardBorderColor, thumbnailScrollSpeed}'
# → itemsPerPage clamped to 100; cacheTtl clamped to 604800; theme reset to its
#   default (invalid enum); enableLightbox coerced to a bool; cardBorderColor
#   falls back to #228be6 (invalid hex); thumbnailScrollSpeed clamped to 3.
```

**Expected (pass).** Out-of-range ints clamp to their registry range, invalid enums fall back to the default, invalid booleans coerce, and the special `card_border_color` still applies its `#228be6` fallback. **Why it proves the fix:** the clamps/enums are now enforced entirely by the generic loop + registry metadata; identical outputs prove the extraction preserved behavior. Also open **wp-admin → SuperGallery → Settings**, save the page, and confirm nothing visibly changed (catches a field silently dropping out of both the hand list and the registry).

**Pitfall.** If a *new* settings field is added later with standard bool/int-range/enum/float-range semantics, it now needs **zero** sanitizer code — just registry metadata (`$defaults` type, and `$valid_options` or `$field_ranges`). A field added to `$defaults` but forgotten in `$valid_options`/`$field_ranges` will be accepted but unclamped/unvalidated; that is a registry omission, not a sanitizer bug.

---

### P67-I — Media-library "size" sort orders by a real numeric meta

**What & why.** The media-library `size_asc`/`size_desc` sort mapped to `orderby => meta_value_num` on `_wp_attachment_metadata` — a serialized PHP array whose numeric cast is `0` for every row, so the sort was a no-op with arbitrary order. It now sorts on a dedicated numeric `_wpsg_filesize` meta, written at upload time (the plugin's own `create_attachment_from_upload()` **and** a new `add_attachment` hook for native/other-plugin uploads) and backfilled for existing attachments by a one-time DB-v17 migration.

**Pre-fix behavior.** `size_asc`/`size_desc` returned attachments in an effectively arbitrary order (every row's sort key was 0).

**Observable effect: the sort actually works.** This track has a real, user-visible result.

```bash
# Upload three files of clearly different sizes through the plugin's own path:
for sz in 1k 500k 5M; do
  head -c $sz /dev/urandom > /tmp/wpsg-$sz.jpg   # (use real images if the pipeline validates)
  curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/media/upload" -F "file=@/tmp/wpsg-$sz.jpg" >/dev/null
done

# Ascending by size → smallest first; descending → largest first:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/media-library?sort=size_asc&per_page=100"  | jq '[.items[].filename]'
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/media-library?sort=size_desc&per_page=100" | jq '[.items[].filename]'

# Confirm the numeric meta exists on a fresh upload:
LAST=$(npx wp-env run cli wp post list --post_type=attachment --posts_per_page=1 --field=ID)
npx wp-env run cli wp post meta get $LAST _wpsg_filesize   # → the byte size (was absent pre-fix)
```

**Expected (pass).** `size_asc` lists the 1k file before the 500k before the 5M; `size_desc` reverses it. **Why it proves the fix:** pre-fix the same two calls return the *same arbitrary order* (both sort keys are 0), so ascending and descending are indistinguishable. **Also test the two other write paths:**

```bash
# (a) Native WP uploader / wp media import → the add_attachment hook stamps it:
NID=$(npx wp-env run cli wp media import /tmp/wpsg-500k.jpg --porcelain)
npx wp-env run cli wp post meta get $NID _wpsg_filesize   # → byte size (hook path)

# (b) Backfill for pre-existing attachments — strip the meta, clear the guard, re-run:
npx wp-env run cli wp post meta delete $NID _wpsg_filesize
npx wp-env run cli wp option delete wpsg_filesize_backfilled
npx wp-env run cli wp eval 'delete_option("wpsg_db_version"); WPSG_DB::maybe_upgrade();'
npx wp-env run cli wp post meta get $NID _wpsg_filesize   # → byte size restored (backfill path)
```

**Expected (pass).** All three write paths (plugin upload, `add_attachment` hook, one-time backfill) leave a correct `_wpsg_filesize`. Each is exercised independently because none subsumes the others.

**Pitfalls.**
- Attachments that *don't* yet carry `_wpsg_filesize` are **not** dropped from the size-sorted list — the query uses an `OR … NOT EXISTS` meta clause so they sort as NULL (first on ASC / last on DESC) rather than vanishing. Do not "simplify" it to a bare `meta_key`, which would silently exclude them. (P67-R specifically tested whether that `OR` clause fans the join out and duplicates un-stamped rows — it does not; leave the clause alone. `DISTINCT` is *not* the fix if you ever think it is: it errors under `ONLY_FULL_GROUP_BY` because `ORDER BY` references a non-selected column.)
- **Both** write paths stamp `0` for an attachment whose file is missing or unreadable, rather than skipping it. For the backfill this makes the migration terminate instead of re-scanning unstampable rows forever; for `stamp_filesize_meta()` it keeps offloaded/remote media from ending up permanently without the key. **Amended by P67-R** — the hook path originally skipped the write, diverging from the backfill.
- Re-observing the backfill needs **both** the guard option cleared (`wpsg_filesize_backfilled`) and the DB version reset, exactly like the P66 migration re-runs.

**The backfill is bounded per run and resumes on cron (P67-R).** It originally looped over the entire attachment library in one pass, from `maybe_upgrade()` on `init` — a `filesize()` stat plus a meta write per row. On a large library that can outlive `max_execution_time`, and since `wpsg_db_version` is only bumped after `maybe_upgrade()` returns, a timeout there re-enters the whole upgrade path on every subsequent request. It now stamps at most `FILESIZE_BACKFILL_MAX_BATCHES × FILESIZE_BACKFILL_BATCH` (5 × 200 = 1000) attachments per run and schedules `wpsg_filesize_backfill` to continue.

```bash
# Force the multi-run path with tiny bounds, then watch it resume.
npx wp-env run cli wp eval '
  add_filter("wpsg_filesize_backfill_batch_size", fn() => 1);
  add_filter("wpsg_filesize_backfill_max_batches", fn() => 1);
  delete_option("wpsg_filesize_backfilled");
  WPSG_DB::run_filesize_backfill_batch();
  echo "complete flag: " . var_export(get_option("wpsg_filesize_backfilled"), true) . "\n";
  echo "continuation queued: " . var_export((bool) wp_next_scheduled(WPSG_DB::FILESIZE_BACKFILL_HOOK), true) . "\n";
'
# → complete flag: false   continuation queued: true   (with >1 unstamped attachment)

# Drain it the way cron would, until the guard flips:
npx wp-env run cli wp cron event run wpsg_filesize_backfill
npx wp-env run cli wp option get wpsg_filesize_backfilled   # → 1 once every row is stamped
```

**Expected (pass).** With more unstamped attachments than one run's budget, the guard option stays unset and a `wpsg_filesize_backfill` event is queued; running it repeatedly finishes the library and sets the guard, after which the hook is not rescheduled. On a small library the whole thing still completes inside `maybe_upgrade()` with no cron event queued at all.

**Regression checks.** `WPSG_P67I_Filesize_Sort_Test` (hook stamp, idempotency, backfill, and the size sort both directions) and `WPSG_P67R_Review_Fixes_Test` (zero-stamp on unreadable files, bounded run + cron resume, hook registration). `WPSG_Cron_Hooks_Test` pins `wpsg_filesize_backfill` in the canonical hook list so deactivate/uninstall clear it. Existing media-library listing coverage passes unmodified.

---

## 4. Review-fix verification — P67-R

The PR review pass over the landed phase found four defects. Each is folded into its own track section above; this block is the consolidated check, and the one place to start if you are re-verifying the phase after the fixes rather than working through it track by track. Full rationale: [PHASE67_REPORT.md → PR Review & Fix Pass](PHASE67_REPORT.md#pr-review--fix-pass--p67-r-2026-07-19).

**R1 — cache priming targeted a taxonomy instead of an object type.** The single highest-value check in this block, because the two efficiency tracks' priming was doing *nothing*. The distinction is easy to re-break, so verify the core contract first and the plugin behaviour second:

```bash
npx wp-env run cli wp eval '
  var_dump(get_object_taxonomies("wpsg_company"));   // → array(0) {}  — a taxonomy is NOT an object type
  var_dump(get_object_taxonomies("wpsg_campaign"));  // → includes "wpsg_company"
'
```

```bash
# The path where it actually mattered: fields => "ids" leaves posts, meta AND terms cold.
# Public campaigns return from can_view_campaign() before touching terms, so a warm
# cache afterwards can only come from the batch prime.
npx wp-env run cli wp eval '
  WPSG_REST_Base::clear_accessible_campaigns_cache();
  wp_cache_flush();
  $m = new ReflectionMethod("WPSG_REST_Base", "get_accessible_campaign_ids");
  $m->setAccessible(true);
  $m->invoke(null, 0);
  $id = (int) get_posts(["post_type" => "wpsg_campaign", "posts_per_page" => 1, "fields" => "ids"])[0];
  echo "post cache primed: " . var_export(false !== wp_cache_get($id, "posts"), true) . "\n";
  echo "term cache primed: " . var_export(false !== get_object_term_cache($id, "wpsg_company"), true) . "\n";
'
# → both true. Pre-fix: both false (the prime returned early on an empty taxonomy list,
#   and nothing primed the post objects that get_the_terms() needs).
```

**R2 — unreadable files are stamped `0`, not skipped.** See the P67-I *Pitfalls*; check with an attachment whose `_wp_attached_file` points nowhere:

```bash
npx wp-env run cli wp eval '
  $id = wp_insert_post(["post_type" => "attachment", "post_status" => "inherit", "post_title" => "ghost"]);
  update_post_meta($id, "_wp_attached_file", "does/not/exist.jpg");
  WPSG_Media_Controller::stamp_filesize_meta($id);
  var_dump(get_post_meta($id, "_wpsg_filesize", true));   // → string(1) "0"  (pre-fix: "" — never written)
'
```

**R3 — the backfill is bounded and resumes on cron.** Procedure in the P67-I section above (tiny-bounds filter → continuation queued → drain via `wp cron event run`).

**R4 — a refused cron schedule still delivers.** Procedure in the P67-H section above (`pre_schedule_event` veto → delivery logged inline).

**Regression checks for the whole block.** `WPSG_P67R_Review_Fixes_Test` (7 tests) pins all four, plus the core taxonomy-vs-object-type contract that R1 rested on. It fails against the pre-fix commit for each defect, so it is a real guard rather than a description of current behaviour.

---

## 5. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P67-J | Deleted symbols unreferenced (grep clean); `wpsg_oembed_failure_count` autoload=no; `get_effective_campaign_level` uses `user_can($user_id,…)` | Full suite + PHPCS green; `WPSG_P52A_Permission_Matrix_Test`, `WPSG_Image_Optimizer_Test` green | ☐ |
| P67-F | ~2N fewer term queries on a cache-primed `campaigns.list`; `list_companies` primes the taxonomy it reads | Campaign/company listing coverage green (same terms) | ☐ |
| P67-G | Batched meta/term-cache priming ⇒ fewer queries in the three (four) scan loops | Accessible-campaign / grant-purge / health-count coverage green | ☐ |
| P67-H | Save with a dead webhook endpoint returns fast; delivery logged via cron with attempt 1 | `WPSG_P39IN1_Webhook_Test` + new cron-path test green | ☐ |
| P67-C | Single & batch 409 duplicate shape identical; `upload_font` uses the shared error map | `WPSG_P28N_Duplicate_Detection_Test` green | ☐ |
| P67-D | Three settings-write paths share one helper; space-panel silent-drop **deliberately preserved** | Settings + space controller suites green | ☐ |
| P67-E | One meta-sync handler (delete still clears all refs); shared Rumble token; user-search columns confirmed aligned | Media-sync + Rumble-embed coverage green | ☐ |
| P67-B | Identical query args + cache keys for identical inputs | `WPSG_P67B_Query_Builder_Test` + campaign-listing suites green | ☐ |
| P67-A | Out-of-range/invalid inputs clamp/fall-back identically; `sanitize_settings` ~61% smaller | `WPSG_Settings_Test` / `_Extended_Test` / `_Rest_Test` green (byte-for-byte) | ☐ |
| P67-I | Size sort orders by real file size both directions; all three write paths stamp `_wpsg_filesize` | `WPSG_P67I_Filesize_Sort_Test` green | ☐ |
| P67-R | §4 R1–R4: priming warms post+term caches on the `fields => 'ids'` path; unreadable files stamp `0`; backfill bounded + resumes on cron; refused schedule delivers inline | `WPSG_P67R_Review_Fixes_Test` + `WPSG_Cron_Hooks_Test` green | ☐ |

**Automated baseline (must be green alongside manual QA):** full wp-env PHPUnit suite — **1274 tests, 13609 assertions, 0 failures, 2 pre-existing skips**, `composer lint:php` clean. Phase 67 adds 20 tests (9 for P67-B + 4 for P67-I + 7 for P67-R) and removes 2 (the dropped `WPSG_Image_Optimizer::get_stats()` tests) from the P66 landing baseline of 1255. See PHASE67_REPORT.md → each track's *Implementation* block for the exact per-track rationale and any line-number/scope corrections surfaced during execution, and its *PR Review & Fix Pass* section for the four post-landing fixes and the six areas that were challenged and cleared.
