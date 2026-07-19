# Phase 67 - PHP Code Quality: Refactor, Efficiency & Dead-Code Sweep

**Status:** Complete — landed 2026-07-19 (all 10 tracks + the P67-R review-fix pass; full suite 1274 tests / 0 failures / lint clean)
**Created:** 2026-07-14
**Last updated:** 2026-07-19

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P67-A | Collapse ~58 redundant hand-written blocks in `sanitize_settings()` into the registry-driven loop | Done | Medium |
| P67-B | Extract query-builder and cache-key stages from `list_campaigns()` | Done | Small-Medium |
| P67-C | Dedup upload error/duplicate response shaping | Done | Small |
| P67-D | Unify the global-settings write path (3 copies → 1) | Done | Small |
| P67-E | Minor duplications bundle (meta-sync closures, Rumble regex, user-search alignment) | Done | Tiny |
| P67-F | Replace `wp_get_object_terms()` with `get_the_terms()` in hot paths | Done | Small |
| P67-G | Prime meta caches in full-scan loops | Done | Small |
| P67-H | Dispatch the first webhook delivery attempt asynchronously | Done | Small |
| P67-I | Media-library "size" sort orders by a serialized blob | Done | Small-Medium |
| P67-J | Dead-code & latent-bug sweep (deprecated permission primitives, vestigial code, `$user_id`/`current_user_can()` mismatch, oEmbed-failure-count autoload) | Done | Small |
| P67-R | PR review & fix pass over the landed phase (4 defects fixed, 6 areas cleared) — see [PR Review & Fix Pass](#pr-review--fix-pass--p67-r-2026-07-19) | Done | Small-Medium |

**Manual QA:** see the companion [PHASE67_MANUAL_QA_RUNBOOK.md](PHASE67_MANUAL_QA_RUNBOOK.md) for per-track hand-verification steps and the sign-off checklist.

---

## Rationale

The review ([PHP_REVIEW_FINDINGS.md](PHP_REVIEW_FINDINGS.md)) found a long tail of no-functionality-risk items — duplicate logic, oversized functions, N+1-query hot paths, and dead code — none individually urgent, all independently re-verified against current source on 2026-07-14. Kept as a single phase per direction: better one substantial cleanup phase than several thin ones.

1. **What triggered it.** These are the review's D/C/E/G sections — refactors, duplicate-code extractions, efficiency fixes, and dead-code removal — deliberately separated from the correctness/security phases (63–66) because none of them fix a bug a user could hit; they reduce future maintenance cost and, in the E-section items, real query counts on busy installs.
2. **Why it belongs together.** All are "no behavior change" or "behavior only gets faster/more correct in edge cases already covered by tests" — safe to batch and to interleave with the other phases as spare capacity allows, without the sequencing constraints that shape 63–66.
3. **Success.** The settings sanitizer's biggest function shrinks by roughly 60%; `list_campaigns()` becomes readable without behavior change; the campaign-list hot path drops ~2N queries per page on cache miss; per-post-loop functions stop issuing one meta query per row; webhook delivery no longer blocks the originating request; the media size-sort actually sorts; three files' worth of confirmed-dead code and one latent (non-live) permission-check bug are gone.

## Execution Priority

No cross-track dependencies exist in this phase — all ten tracks are independent and can proceed in any order or be interleaved with Phases 63–66 as capacity allows. Suggested grouping for review-batch efficiency (not a hard sequence):

1. **P67-J** — do first: it's the purest deletion (dead code, zero callers, confirmed by repo-wide grep) and gives the fastest, lowest-risk win.
2. **P67-F, P67-G, P67-H** — the three query/dispatch efficiency fixes; group together since they all touch the same class of "N+1 / synchronous-when-it-could-be-async" pattern.
3. **P67-C, P67-D, P67-E** — the three smaller duplicate-code extractions.
4. **P67-A, P67-B** — the two large-function reductions; do these last since they're the most careful, highest-line-count changes in the phase and benefit from the smaller tracks' momentum/context first.
5. **P67-I** — independent; fold in whenever convenient, since its "impact: low, admin-convenience sort" makes it the lowest priority in the phase.

---

## Track P67-A - Collapse redundant hand-written blocks in `sanitize_settings()`

*Source: PHP_REVIEW_FINDINGS.md § D-1 — re-verified 2026-07-14. Actual count is **58** explicit `isset($input['x']))` blocks, not the ~40 estimated in the review — same finding, bigger win than stated.*

### Problem

`sanitize_settings()` (`includes/settings/class-wpsg-settings-sanitizer.php:266-546`, 280 lines) contains 58 explicit `if (isset($input['x']))` field blocks that hand-re-implement exactly what the generic trailing registry-driven loop (lines 501-543) already does from `WPSG_Settings_Registry::$field_ranges` metadata: bool casts, `intval` + range clamps, enum allowlists, float clamps. Examples: `items_per_page` hand-clamps 1–100; `cache_ttl` hand-clamps 0–604800; roughly 17 blocks are pure `(bool)` casts. Only a handful of blocks do something the generic loop genuinely can't (`api_base` URL validation, `typography_overrides`, `viewer_bg_gradient`, `gallery_config`, `card_config`, `card_border_color` hex-with-fallback).

### Fix

Move the hand-written ranges into `WPSG_Settings_Registry::$field_ranges` (many already exist there — verify equivalence per field before deleting its hand-written block), delete the redundant blocks, and keep a short explicit list for the genuinely special fields. Mechanical, and the extensive `WPSG_Settings_Test`/`WPSG_Settings_Extended_Test` suites pin the behavior throughout.

### Acceptance criteria

- `sanitize_settings()` shrinks by roughly 60% (the function's own review-estimated reduction, likely more given the higher actual block count).
- Every field previously hand-clamped now sanitizes identically via the generic loop (byte-for-byte same output for the same input, across the full existing settings test matrix).
- Adding a new settings field with standard bool/int-range/enum/float-range semantics requires zero sanitizer code — registry metadata alone.

### Validation

- Full `WPSG_Settings_Test`/`WPSG_Settings_Extended_Test` suites pass unmodified (they pin exact sanitized output per field).
- Spot-check each of the ~6 genuinely special fields is still hand-handled correctly.

---

## Track P67-B - Extract query-builder and cache-key stages from `list_campaigns()`

*Source: PHP_REVIEW_FINDINGS.md § D-2 — re-verified 2026-07-14, confirmed accurate; function spans exactly lines 193-437 (245 lines) as described.*

### Problem

`list_campaigns()` (`class-wpsg-campaign-controller.php:193-437`) mixes cache-key assembly, sort mapping, meta/tax query construction, permission scoping, media enrichment, and caching in one 245-line function. It works and is tested; the cost is readability and a `$meta_query` reassignment dance — built (line 279), conditionally assigned (315), then further appended to and reassigned inside the non-admin branch (350-388) with a manual `relation` fixup — that has to be re-derived on every read.

### Fix

Extract `build_campaign_query_args($filters, $is_system_admin, $user_id)` and `build_campaign_cache_key($filters, ...)` as pure private helpers. No behavior change; unit-test the builders directly.

### Acceptance criteria

- `list_campaigns()` itself shrinks to orchestration (call builder → run query → enrich → cache); the query-construction logic lives in a directly-testable pure function.
- No behavior change: identical `WP_Query` args and identical cache keys for the same inputs, before and after.

### Validation

- Full existing `list_campaigns()` test coverage passes unmodified.
- New unit tests directly against `build_campaign_query_args()` covering admin vs. non-admin scoping and the meta-query relation fixup.

---

## Track P67-C - Dedup upload error/duplicate response shaping

*Source: PHP_REVIEW_FINDINGS.md § C-4 — re-verified 2026-07-14, both sub-claims confirmed accurate.*

### Problem

Two duplications around uploads: (1) `upload_media()`'s single-file (`class-wpsg-media-controller.php:1150-1214`) and batch (`:1216-1263`) paths each separately hand-build near-identical duplicate/near-duplicate 409 payloads (~80 lines of parallel field mapping); (2) the `$_FILES['error']` → message/status switch exists twice — `get_upload_error_data()` in the media controller (`:494-524`) and an inline copy inside `upload_font()` in `class-wpsg-content-controller.php:860-882`.

### Fix

A `format_upload_result(WP_Error|array $upload, string $filename): array` helper for the 409 shaping, used by both the single-file and batch paths. Move `get_upload_error_data()` to `WPSG_REST_Base` so `upload_font()` reuses it instead of its inline copy.

### Acceptance criteria

- Single-file and batch upload 409 responses are generated by one shared helper; identical shape for identical duplicate-detection results.
- `upload_font()`'s `$_FILES['error']` handling calls the shared `WPSG_REST_Base` helper; the inline copy is deleted.

### Validation

- Existing upload-duplicate and font-upload-error test coverage passes unmodified.

---

## Track P67-D - Unify the global-settings write path

*Source: PHP_REVIEW_FINDINGS.md § C-5 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`update_settings()` and `patch_settings()` (`class-wpsg-settings-controller.php:69-149`) are ~80% identical (from_js decode → admin-only guard → sanitize → merge → changed-keys audit), and `update_space_settings()` (`class-wpsg-space-controller.php:468-546`) independently re-implements the same "sanitize + intersect + changed-keys + `update_option` + audit" block for global settings keys routed through the space panel.

### Fix

One private `write_global_settings(array $snake_input, bool $patch_only, string $via)` used by all three call sites.

### Acceptance criteria

- All three settings-write endpoints call the shared helper; behavior (guard, sanitize, merge/patch semantics, audit-entry shape) is identical across all three.

### Validation

- Existing settings-controller and space-controller test suites pass unmodified.

---

## Track P67-E - Minor duplications bundle

*Source: PHP_REVIEW_FINDINGS.md § C-6 — re-verified 2026-07-14, sub-claims (a) and (b) confirmed accurate; (c) not independently re-checked (lower priority per the review itself).*

### Problem

Three small duplications, none urgent individually:
- (a) Three near-identical closures for `updated_post_meta`/`added_post_meta`/`deleted_post_meta` (`wp-super-gallery.php:291-306`), all gated on `$meta_key === 'media_items'`, calling `WPSG_DB::sync_media_refs`.
- (b) `normalize_external_media()`'s Rumble video-ID regex (`class-wpsg-media-controller.php:1439-1462`) duplicates logic already present in `WPSG_Provider_Rumble::fetch()` (`includes/providers/class-wpsg-provider-rumble.php:33`).
- (c) `resolve_user` (space controller) vs. `search_users` (auth controller) — two user-search shapes with `search_columns` lists that should stay aligned.

### Fix

- (a) One named function serving all three hooks.
- (b) Share the Rumble video-ID regex as a constant between the two call sites.
- (c) Check the two `search_columns` lists for drift; align if they've diverged.

### Acceptance criteria

- The three meta-sync hooks call one shared function.
- The Rumble regex exists in exactly one place.
- `resolve_user`/`search_users` column lists are confirmed aligned (or a note is left explaining an intentional difference).

### Validation

- Existing media-sync and Rumble-embed tests pass unmodified.

---

## Track P67-F - Replace `wp_get_object_terms()` with `get_the_terms()` in hot paths

*Source: PHP_REVIEW_FINDINGS.md § E-1 — re-verified 2026-07-14, confirmed accurate. Verification also found `list_companies()` primes the `wpsg_campaign` taxonomy cache but then queries `wpsg_company` — the primed cache doesn't even match the queried taxonomy, reinforcing that the function's own "O(1)" comment is wrong regardless of this fix.*

### Problem

`wp_get_object_terms()` always queries the DB; only `get_the_terms()` reads the object-term cache that `WP_Query`/`update_object_term_cache()` primes. `get_company_term()` and `get_campaign_category_ids()`/`_names()` (`class-wpsg-rest-base.php`) run per-item inside `format_campaign()` — roughly 2 queries × per_page on every uncached `campaigns.list` call. `list_companies()` (`class-wpsg-content-controller.php`) calls `wp_get_object_terms()` per campaign in its indexing loop immediately after a cache-priming call that primes the wrong taxonomy entirely.

### Fix

Swap all four call sites to `get_the_terms()` (handling its `false`/`WP_Error` return shape), keeping output identical. In `list_campaigns()`, posts come from `WP_Query` with default `update_post_term_cache`, so the cache is already primed and the swap is free query elimination. Fix `list_companies()`'s cache-priming call to target the taxonomy it actually queries (`wpsg_company`, not `wpsg_campaign`).

### Acceptance criteria

- `get_company_term()`, `get_campaign_category_ids()`, `get_campaign_category_names()`, and `list_companies()`'s per-campaign term lookup all use `get_the_terms()`.
- On a cache-primed `campaigns.list` call, the ~2N per-page DB queries from term lookups disappear (verifiable via a query-count assertion or `SAVEQUERIES` in a test).
- `list_companies()` primes the taxonomy it actually reads.

### Validation

- New or extended test asserting query count drops on a cache-primed `campaigns.list` call with N campaigns.
- Existing campaign-listing and company-listing test coverage passes unmodified (same term data returned, just fewer queries).

---

## Track P67-G - Prime meta caches in full-scan loops

*Source: PHP_REVIEW_FINDINGS.md § E-2 — re-verified 2026-07-14, confirmed accurate for the three functions checked; `get_campaigns_for_attachment_id()`'s existing `_doing_it_wrong()` warning re-confirmed as already documenting this exact issue (not a fresh finding).*

### Problem

`get_accessible_campaign_ids()` (`class-wpsg-rest-base.php`), `purge_expired_grants()` (`class-wpsg-maintenance.php`), and `count_expired_grants_pending_cleanup()` (`class-wpsg-monitoring.php`) all fetch post IDs via `WP_Query`/`get_posts` with `fields => 'ids'` (which skips meta-cache priming) and then loop `get_post_meta()` per post — one meta query each. `count_expired_grants_pending_cleanup()` runs on every `/admin/health` call; `get_accessible_campaign_ids()` runs per user on permission-cache miss.

### Fix

`update_meta_cache('post', $ids)` per batch before each loop (with `array_chunk` on the unbounded ones to keep memory flat). For `get_accessible_campaign_ids()`, additionally prime `update_object_term_cache()` since its `can_view_campaign()` → `get_company_term()` call needs terms too (pairs with P67-F).

### Acceptance criteria

- All three functions issue one batched meta-cache-priming call instead of N per-post meta queries.
- No behavior change — same campaign IDs/grant counts returned, just fewer queries.

### Validation

- Query-count assertion (or `SAVEQUERIES`) before/after for each of the three functions with a multi-campaign fixture.
- Existing test coverage for accessible-campaign resolution, grant purging, and health-check counts passes unmodified.

---

## Track P67-H - Dispatch the first webhook delivery attempt asynchronously

*Source: PHP_REVIEW_FINDINGS.md § E-3 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`WPSG_Webhooks::dispatch()` (`class-wpsg-webhooks.php:90-105`) performs delivery attempt #1 synchronously inline in the originating request — up to 5 endpoints × 10s timeout appended to every campaign create/update/media-add when an endpoint is slow or down (worst case ~50s added to the admin-facing request). Retries (attempts 2-3) already go through `wp_schedule_single_event`.

### Fix

Route attempt #1 through the same cron mechanism used for retries (the endpoint-UUID payload shape already exists), or make the first POST non-blocking (`'blocking' => false`) and treat it as fire-and-forget with attempt #2 as the first verified one. Preference: the cron route — keeps the delivery log accurate.

### Acceptance criteria

- Saving a campaign/media change with slow or unreachable webhook endpoints configured does not add meaningful latency to the originating admin request.
- Webhook delivery (including attempt #1) is still logged accurately.

### Validation

- Test: configure a webhook endpoint that hangs/times out; assert the originating request (e.g. campaign save) completes quickly regardless.
- Existing webhook delivery/retry test coverage passes unmodified.

---

## Track P67-I - Media-library "size" sort orders by a serialized blob

*Source: PHP_REVIEW_FINDINGS.md § A-9 — re-verified 2026-07-14, confirmed accurate: `size_asc`/`size_desc` map to `orderby => meta_value_num, meta_key => _wp_attachment_metadata`, a serialized PHP array whose numeric cast is 0 for every row.*

### Problem

`list_media_library()` (`class-wpsg-media-controller.php:1319-1320`) maps `size_asc`/`size_desc` to `orderby => meta_value_num` on `_wp_attachment_metadata` — a serialized array whose numeric cast is 0 for every row, so the sort is a no-op with arbitrary order.

### Fix

Persist a dedicated numeric meta (e.g. `_wpsg_filesize`), backfilled from existing attachment metadata via an option-guarded batch and written on every new upload, and sort on that instead. Alternative if the backfill cost isn't justified: remove the two size options from the enum until properly supported.

### Acceptance criteria

- Sorting the media library by size actually orders by file size, ascending or descending.
- Existing media (uploaded before this fix) sorts correctly after the one-time backfill runs.

### Validation

- Test: a fixture with attachments of known differing sizes sorts correctly both directions.
- Test the backfill migration populates `_wpsg_filesize` for pre-existing attachments.

---

## Track P67-J - Dead-code & latent-bug sweep

*Source: PHP_REVIEW_FINDINGS.md § G-1, G-2, G-3, E-5 — re-verified 2026-07-14, all confirmed accurate (G-1's "zero callers" and G-2's "no callers" claims confirmed via repo-wide grep).*

### Problem

Four small, independent items bundled for a single cleanup pass:
- **G-1:** `require_campaign_editor()`, `require_campaign_owner()`, `require_space_owner()` (`class-wpsg-rest-base.php`, ~90 lines) are marked DEPRECATED/unused in the `WPSG_Permissions` map legend and have zero callers anywhere outside their own definitions (confirmed via repo-wide grep).
- **G-2:** `enrich_media_with_dimensions()` (media controller, confirmed zero callers) and other vestigial code (`WPSG_Layout_Templates::check_size_limit()` documented always-true no-op; `WPSG_Image_Optimizer::get_stats()` only called from its own test; stray section-marker comments above empty/misplaced regions).
- **G-3:** `get_effective_campaign_level($user_id, $campaign_id)` (`class-wpsg-rest-base.php:359`) threads `$user_id` through its space-access gate correctly but its admin short-circuit uses `current_user_can('manage_wpsg')` instead of `user_can($user_id, 'manage_wpsg')` — confirmed latent (not live: both current callers pass `get_current_user_id()`), a trap for future reuse with a different user ID.
- **E-5 (autoload sub-item):** `wpsg_oembed_failure_count` is `update_option()`'d with no explicit `$autoload` argument (confirmed — defaults to autoloading) while being incremented per public-endpoint failure.

### Fix

- Delete `require_campaign_editor()`, `require_campaign_owner()`, `require_space_owner()`.
- Delete `enrich_media_with_dimensions()`; wire `WPSG_Image_Optimizer::get_stats()` into `/admin/health` or delete it (pick one); clean up the stray section-marker comments.
- Switch `get_effective_campaign_level()`'s admin short-circuit to `user_can($user_id, 'manage_wpsg')`.
- Set `wpsg_oembed_failure_count`'s `update_option()` (and its corresponding `add_option()`, if any) to `$autoload = false`.

### Acceptance criteria

- Zero references to the three deleted permission primitives anywhere in the codebase; PHPCS/lint stays clean.
- `enrich_media_with_dimensions()` is gone; a decision is made and implemented for `get_stats()` (wired in or removed).
- `get_effective_campaign_level()` behaves identically for current callers (both pass the current user) and correctly for a hypothetical future caller passing a different `$user_id`.
- `wpsg_oembed_failure_count` no longer autoloads.

### Validation

- Full PHP test suite passes unmodified (these are deletions/latent-only fixes with no live behavior change).
- `composer lint:php` (`WordPress.Security` ruleset) stays at 0 findings.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full pagination/streaming rework beyond what P65-C already covers, if the E-4 streaming change (Phase 65) surfaces further memory-pressure points | Out of this phase's scope — E-4 itself is scheduled in Phase 65 as part of the import/export consolidation, not here. |

## Implementation Notes

Landed 2026-07-19 in batches, each verified against the full wp-env PHPUnit suite before the next:
**J → (F, G, H) → (C, D, E) → (B, A) + I.** Final suite: **1267 tests, 13579 assertions, 0 failures, 2 pre-existing skips** (was 1255 at the P66 landing; +12 net = 8 new `WPSG_P67B_Query_Builder_Test` + 4 new `WPSG_P67I_Filesize_Sort_Test`, and −2 for the removed `WPSG_Image_Optimizer::get_stats()` tests). `composer lint:php` clean throughout.

Corrections and decisions surfaced during execution (the plan's line numbers were treated as advisory and re-derived against current source):

- **P67-A.** Actual block count was **58**; after analysis, **all** bool/int-range/float-range/enum blocks were removable — *including* the five "leave-unset-on-invalid" enum blocks (`card_border_mode`, `card_shadow_preset`, `card_thumbnail_fit`, `modal_transition`, `card_display_mode`), because the generic loop runs *after* the hand blocks and already normalized their invalid inputs to the default. Only the **6** genuinely special fields remain hand-written (`api_base`, `card_border_color`, `typography_overrides`, `viewer_bg_gradient`, `gallery_config`, `card_config`) — exactly the set the review named. `rate_limit_requests_per_minute => [0,6000]` was moved into `WPSG_Settings_Registry::$field_ranges` (the only removed int block whose range wasn't already there). `sanitize_settings()` shrank ~280 → ~108 lines (~61%). Every removed field's default type was verified against the registry before removal; the settings suites (which pin exact per-field output) confirm byte-for-byte equivalence.
- **P67-B.** `list_campaigns()` was **253 lines** (not the plan's 245 — P66-E's template-exclusion block shifted it). Extracted `build_campaign_cache_key()` + `build_campaign_query_args()` verbatim; added `WPSG_P67B_Query_Builder_Test` (8 tests) covering admin/anonymous/scoped branches, the meta-query `relation => AND` fixup, sort mapping, and cache-key stability/variation.
- **P67-C.** Extracted `format_duplicate_fields(WP_Error)` for the shared 409 shaping (a more precise target than the plan's `format_upload_result` — the real duplication was only the duplicate/near-duplicate field block; the audit calls still use `$data` directly). Moved `get_upload_error_data()` to `WPSG_REST_Base`; `upload_font()` now calls it.
- **P67-D.** Built `WPSG_REST_Base::write_global_settings($input, $mode, $bump_cache, $summary_prefix, $audit_extra)` with modes `replace`/`patch`/`changed`, preserving all three call sites byte-for-byte. The permission-guard difference (settings controller returns a 403; space panel **silently drops**) was **deliberately preserved**; unifying it is future-tasked in [FUTURE_TASKS.md](FUTURE_TASKS.md) › *Settings & Admin UI*.
- **P67-E.** (a) one named `wpsg_sync_media_refs_on_meta_change()` for all three meta hooks, with the delete-path `[]` quirk preserved via `current_action()`. (b) shared Rumble token hosted on the **always-loaded `WPSG_Provider_Registry`** (`RUMBLE_VIDEO_ID_TOKEN`), *not* the lazily-loaded `WPSG_Provider_Rumble`, so the media controller can reference it without a fatal (no autoloader exists for these classes). (c) `resolve_user`/`search_users` columns confirmed already aligned — **no code change**.
- **P67-F.** Swapped the 4 term lookups to `get_the_terms()` and fixed `list_companies()`'s wrong-taxonomy cache prime (`wpsg_campaign` → `wpsg_company`). Left the **batch** `enrich_media_with_metadata()` `wp_get_object_terms()` call untouched — `get_the_terms()` takes a single object id, so it is a documented **non-target**, not a miss.
- **P67-G.** Primed `update_meta_cache`/`update_object_term_cache`/`update_termmeta_cache` in the three scan loops, **plus** the second (company-term) loop inside `purge_expired_grants()` that wasn't in the original review scope (per planning Decision 4). Batch priming is memory-neutral because WordPress already lazy-loads each post's full meta on first access.
- **P67-H.** Attempt #1 now routes through the same `wpsg_webhook_retry` cron hook as retries 2–3 (delay 0), with a synchronous fallback for id-less legacy endpoints. Added `test_dispatch_defers_first_attempt_to_cron_for_endpoint_with_id` — the first automated coverage of the cron/retry path. Trade-off (documented): the first delivery-log entry now appears after the cron tick, not inline.
- **P67-I.** `_wpsg_filesize` numeric meta written at upload (`create_attachment_from_upload()` + a new `add_attachment` hook), backfilled by a **DB v17** one-time guarded migration; sort uses an `OR … NOT EXISTS` meta clause so un-stamped attachments sort as NULL instead of vanishing. Two bugs caught in the backfill during implementation: the paginated `NOT EXISTS` loop skipped rows (fixed to always fetch page 1) and could infinite-loop on missing-file attachments (fixed by stamping `0`). Added `WPSG_P67I_Filesize_Sort_Test` (4 tests). `wpsg_filesize_backfilled` added to `uninstall.php`.
- **P67-J.** Deleted the 3 dead permission primitives, `enrich_media_with_dimensions()`, `WPSG_Layout_Templates::check_size_limit()`, and `WPSG_Image_Optimizer::get_stats()` (chosen over wiring into `/admin/health`, since it is an unbounded full-library scan that would be a health-endpoint regression) + its 2 tests. Relabelled the mislabelled `P14-C` marker, removed the stray `P15-B` marker + orphaned docblock, cleaned the stale `WPSG_P52A_Permission_Matrix_Test` docblock and `WPSG_Permissions` legend entries. Fixed `get_effective_campaign_level()`'s admin short-circuit to `user_can($user_id, …)` and kept the function (Decision 2). Set `wpsg_oembed_failure_count`'s two `update_option()` sites to `$autoload = false`.

## PR Review & Fix Pass — P67-R (2026-07-19)

A full review pass over the landed Phase 67 commit (`10c9bf38`), covering correctness of every track rather than only the diff's stated intent. Four defects were found and fixed; six areas were challenged and cleared without changes. Two hypotheses were tested empirically against wp-env rather than reasoned about, because both hinged on WordPress core semantics that are easy to misread — one confirmed a real bug, the other exonerated the code.

Regression guards live in `WPSG_P67R_Review_Fixes_Test` (7 tests). Each fix below states what was wrong, why it mattered, and what pins it.

### Accepted — fixed

**R1. `update_object_term_cache()` was passed a taxonomy, not an object type.** Its second parameter is an *object type*, which it expands via `get_object_taxonomies()` into every taxonomy registered for that type. `get_object_taxonomies('wpsg_company')` returns `[]` — a taxonomy is not an object type — so both P67 calls primed nothing at all and returned early. Verified directly in wp-env: priming 3 campaigns via the taxonomy name warms 0/3 object-term caches; via the post type, 3/3.

- `class-wpsg-rest-base.php` — `get_accessible_campaign_ids()`. **Real impact.** The page is fetched with `fields => 'ids'`, so post objects, meta *and* terms all start cold; the no-op prime meant P67-G's stated win never materialised. Worse, P67-F's swap to `get_the_terms()` introduced a *new* N+1 on this path, because `get_the_terms()` calls `get_post()` first and nothing had primed the post cache. Replaced both hand-rolled priming calls with a single `_prime_post_caches($query->posts, true, true)`, which primes posts, meta and object terms together and derives the object-type argument from the posts themselves — so the same mistake cannot recur here.
- `class-wpsg-content-controller.php` — `list_companies()`. **No runtime impact**, but the change was wrong in the other direction: the pre-P67 `'wpsg_campaign'` argument was already correct, and P67-F "fixed" it to `'wpsg_company'` on a mistaken premise inherited from the review finding (§ E-1's "primes the wrong taxonomy" note). The observable effect is nil either way — `get_posts()` returns full `WP_Post` objects and WP_Query primes the object-term cache for its own results — so the explicit call is belt-and-braces regardless. Reverted to the post type and replaced the comment with the actual API contract.

**R2. `stamp_filesize_meta()` silently skipped unreadable files.** It returned without writing when the attachment's file was missing — offloaded/remote media, a broken path — while the backfill deliberately stamps `0` for exactly those rows. The divergence left such attachments permanently without `_wpsg_filesize`: invisible to any future query filtering on the key, and reliant forever on the `OR … NOT EXISTS` branch of the sort. Now always writes, `0` when unreadable, matching the backfill.

**R3. The `_wpsg_filesize` backfill was unbounded.** `maybe_backfill_filesize_meta()` looped over *every* image/video attachment in one pass — a `filesize()` stat plus a meta write each — from `maybe_upgrade()` on `init`. A media library is the largest table a gallery plugin touches; on a large install this can outlive `max_execution_time`, and because `wpsg_db_version` is only bumped after `maybe_upgrade()` returns, a timeout there re-enters the entire upgrade path on every subsequent request. (The sibling P66 backfills are bounded by what they scan — archived campaigns only — so they were not exposed to this.) Now bounded to `FILESIZE_BACKFILL_MAX_BATCHES × FILESIZE_BACKFILL_BATCH` = 1000 attachments per run, with the remainder handed to a new `wpsg_filesize_backfill` cron hook that resumes until the guard option is set. Both bounds are filterable (`wpsg_filesize_backfill_batch_size`, `wpsg_filesize_backfill_max_batches`), following the existing `wpsg_permissions_page_size` convention. The hook is registered in the plugin bootstrap and added to the canonical `wpsg_get_cron_hooks()` list, so deactivate/uninstall clear it — `WPSG_Cron_Hooks_Test` pins it against the class constant like every other hook.

**R4. `wp_schedule_single_event()`'s return value was ignored.** P67-H routed webhook delivery #1 through cron but never checked whether the event was actually queued. `wp_schedule_single_event()` returns false when a `pre_schedule_event`/`schedule_event` filter vetoes the event, or when an identical event is already queued inside its 10-minute duplicate window — and the attempt was then dropped with **no delivery-log entry at all**, which is strictly worse than the latency P67-H set out to avoid. `dispatch()` now falls back to inline `deliver()` when scheduling is refused; `schedule_retry()` returns `bool` to report it.

### Challenged — no change needed

- **P67-A range equivalence.** The highest-risk claim in the phase (58 hand-written blocks deleted in favour of registry metadata) was verified mechanically rather than by inspection: all 24 removed numeric clamps were extracted from the diff and cross-checked against `WPSG_Settings_Registry::$field_ranges`. Every one matches exactly. `thumbnail_scroll_speed`'s default is `1.0` — a genuine float — so the generic loop takes the float branch and its `0.25` lower bound survives, which an int default would have silently destroyed.
- **Media size-sort join fan-out.** The `relation => OR` + `EXISTS`/`NOT EXISTS` meta clause looked like it should duplicate un-stamped attachments: core joins the `EXISTS` clause on `post_id` alone with the key test in `WHERE`, and `WP_Query` — unlike `WP_User_Query` — never consults `has_or_relation()` to add `DISTINCT`. Tested with a deliberately un-stamped attachment carrying extra meta rows: **no duplication**, correct `total`. Left as-is. (`DISTINCT` would in fact have been the wrong fix — it errors under `ONLY_FULL_GROUP_BY` when `ORDER BY` references a non-selected column.)
- **P67-F output ordering.** `get_the_terms()` could plausibly return a different order than `wp_get_object_terms()` did, which would change category order in API responses. It does not: `update_object_term_cache()` primes with `orderby => 'name'` and `get_the_terms()`'s uncached path uses `wp_get_object_terms()`'s `orderby => name` default, so both the primed and unprimed paths match the old behaviour. The "byte-for-byte identical output" claim holds.
- **P67-B / P67-C / P67-D extractions.** Re-derived each against its pre-refactor source. `build_campaign_query_args()`/`build_campaign_cache_key()` are faithful; `format_duplicate_fields()` produces the same fields in both the single-file and batch paths; `write_global_settings()`'s three modes reproduce all three call sites including the space panel's skip-when-nothing-changed semantics and the deliberately-preserved silent drop.
- **P67-J deletions.** Repo-wide grep confirms zero remaining references to all six deleted symbols (the three permission primitives, `enrich_media_with_dimensions()`, `check_size_limit()`, `WPSG_Image_Optimizer::get_stats()`), including the TS/JS client.
- **`_wpsg_filesize` and uninstall.** Not added to `uninstall.php`'s cleanup — consistent, not an omission: the plugin deletes no post meta on uninstall (`_wpsg_space_id` and the rest are equally untouched). Only the `wpsg_filesize_backfilled` guard option is removed, which P67-I already did.

### Validation

Full wp-env PHPUnit suite green and `composer lint:php` clean after the fixes; see the *Outcome* section for the final counts. `WPSG_P67R_Review_Fixes_Test` fails against the pre-fix commit for R1, R2, R3 and R4 respectively, so each guard demonstrably pins its defect. Manual-QA steps for the fixes are folded into the per-track sections of [PHASE67_MANUAL_QA_RUNBOOK.md](PHASE67_MANUAL_QA_RUNBOOK.md) plus its new *§5 Review-fix verification* block.

## Outcome

Complete. All ten tracks landed with full automated coverage green and PHPCS clean; per-track manual-QA procedures are documented in [PHASE67_MANUAL_QA_RUNBOOK.md](PHASE67_MANUAL_QA_RUNBOOK.md). One follow-on (the settings-write guard unification deferred from P67-D) is recorded in FUTURE_TASKS.md.

A subsequent PR review pass (**P67-R**, above) found and fixed four defects in the landed work — two of them in the efficiency tracks' own cache priming, which was silently doing nothing — and cleared six further areas after challenge. Final suite: **1274 tests, 13609 assertions, 0 failures, 2 pre-existing skips** (1267 at the P67 landing, +7 from `WPSG_P67R_Review_Fixes_Test`). `composer lint:php` clean.
