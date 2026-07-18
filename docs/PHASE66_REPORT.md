# Phase 66 - Campaign & Analytics Data Integrity, Lifecycle Bookkeeping

**Status:** Complete (2026-07-18)
**Created:** 2026-07-14
**Last updated:** 2026-07-18 (all six tracks implemented + tested; Key Decision B resolved to the audit-log-derived backfill per user direction)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P66-A | Centralize campaign status writes (`WPSG_Campaign_Status::set()`) — enabling refactor for P66-B | ✅ Done | Small-Medium |
| P66-B | Archive auto-purge keys off creation date, not archived date | ✅ Done | Small-Medium |
| P66-C | Space-filtered analytics always empty — inserts never stamp `space_id` | ✅ Done | Small |
| P66-D | Duplicating a campaign drops its space and its category/tag terms | ✅ Done | Tiny |
| P66-E | Campaign templates appear in campaign listings (admin scope) | ✅ Done | Tiny |
| P66-F | Uninstall completeness (options/tables/dirs/indexes/cron) | ✅ Done | Small-Medium |

**Manual QA:** see the companion [PHASE66_MANUAL_QA_RUNBOOK.md](PHASE66_MANUAL_QA_RUNBOOK.md) for per-track by-hand validation.

---

## Rationale

The review ([PHP_REVIEW_FINDINGS.md](PHP_REVIEW_FINDINGS.md)) found a cluster of correctness gaps that all reduce to the same shape: a piece of campaign or plugin state is written in one place but never fully or correctly tracked through the rest of its lifecycle — `space_id` never stamped on three of four scoped tables, campaign status transitions written at 7+ independent call sites with no timestamp, a duplicate silently losing its space and taxonomy, template posts leaking into campaign listings, and — at the outermost lifecycle boundary — an uninstall that leaves real data (including webhook secrets) behind. All items were independently re-verified against current source on 2026-07-14, including a full line-by-line read of `uninstall.php`.

1. **What triggered it.** A-6 (archive-purge date bug) cannot be fixed correctly without first fixing C-3 (no single place writes campaign status, so no single place can write an `archived_at` timestamp either) — these two were always going to ship together.
2. **Why it belongs together.** Every track here is about a gap between "data changed" and "the bookkeeping around that change is complete" — space scoping, status timestamps, duplication completeness, listing hygiene, and uninstall completeness are all instances of the same category of bug, and several touch the same files (`class-wpsg-campaign-controller.php`, `class-wpsg-db.php`).
3. **Success.** A space-scoped analytics summary reports real numbers; archiving a campaign starts its purge clock from when it was archived, not when it was created; duplicating a campaign preserves its space and categorization; campaign templates don't masquerade as draft campaigns; uninstalling with data-removal enabled actually removes all plugin data, including secrets.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Centralize-before-fix ordering | P66-A (centralize status writes) is sequenced before P66-B (archive-purge date fix), since P66-B's `archived_at` timestamp needs exactly one write site to be reliable. Engineering-sequencing call, not a product decision. |
| B | `archived_at` backfill for already-archived campaigns | **RESOLVED 2026-07-18 (user chose the audit-log-derived backfill):** seed `archived_at` from each currently-archived campaign's most recent `campaign.archived` audit entry — the DB audit-log table first, then the legacy `audit_log` post meta — falling back to `now()` only when no archival record exists at all. More historically accurate than "seed from now"; the follow-on candidate below is therefore delivered, not deferred. |
| C | Uninstall scope for `wpsg-exports/` | **Already decided by user, 2026-07-13** (PHP_REVIEW_FINDINGS.md § H-4): delete `wpsg-exports/` in **both** preserve-data and full-cleanup uninstall modes — the 24-hour export-job TTL makes preserving ZIPs past uninstall backwards (they'd outlive normal operation). One doc sentence should tell migrators to move ZIPs out of `uploads/wpsg-exports/` before uninstalling. Carried forward verbatim into P66-F. |

## Execution Priority

1. **P66-A** — do first; P66-B depends on it directly.
2. **P66-B** — immediately after, using the new `archived_at` bookkeeping from P66-A.
3. **P66-C, P66-D, P66-E** — independent of A/B and of each other; batch together.
4. **P66-F** — do last; broadest blast radius (touches `uninstall.php` end-to-end) and benefits from the canonical cron-hook-list groundwork being stable first if that list is shared with P66-A's centralization.

---

## Track P66-A - Centralize campaign status writes

*Source: PHP_REVIEW_FINDINGS.md § C-3 — re-verified 2026-07-14, confirmed accurate. Verification found 7 distinct call sites (more than the review's original count), plus a generic status setter reinforcing the same pattern, and confirmed zero existing `archived_at`/`restored_at` writes anywhere in the codebase.*

### Problem

`update_post_meta($id, 'status', ...)` for archive/restore is written independently at 7+ sites: `archive_campaign`, `restore_campaign`, `batch_campaigns` (`class-wpsg-campaign-controller.php`), `archive_company` (`class-wpsg-access-controller.php`), the auto-archive cron batch helper (`wpsg_archive_campaign_status_batch`, `wp-super-gallery.php`), and CLI `campaign_archive`/`campaign_restore` (`class-wpsg-cli.php`) — plus a generic `apply_campaign_meta` status setter. Each site separately remembers (or forgets) the audit entry, the `do_action`, and cache invalidation — and **none** of them writes an `archived_at`/`restored_at` timestamp, which is the direct root cause of P66-B.

### Fix

A single `WPSG_Campaign_Status::set(int $id, string $status, array $ctx = [])` that validates the enum, writes the meta plus `archived_at`/`restored_at` bookkeeping, fires the matching hook + audit entry, and leaves batch-SQL optimization as an internal concern for the cron path. Replace all 7+ call sites with calls into it.

### Acceptance criteria

- Archiving or restoring a campaign through any entry point (REST, batch REST, cron, CLI, company-level archive) writes an `archived_at`/`restored_at` timestamp alongside the status.
- Audit entries and cache invalidation happen identically regardless of which entry point triggered the transition (no more per-site drift).

### Validation

- Existing archive/restore test coverage across all entry points stays green.
- New test asserting `archived_at` is set on archive and cleared (or left, per chosen semantics) on restore, from every entry point.

---

## Track P66-B - Archive auto-purge keys off creation date, not archived date

*Source: PHP_REVIEW_FINDINGS.md § A-6 — re-verified 2026-07-14, confirmed accurate. Depends on P66-A.*

### Problem

`WPSG_Maintenance::trash_archived_campaigns()` (`includes/class-wpsg-maintenance.php:67-98`) selects `status=archived` campaigns whose **`post_date_gmt`** (creation date) is older than `archive_purge_days` — confirmed via the `date_query` build using `'column' => 'post_date_gmt'`. The intended semantics are "archived for N days"; as implemented, a two-year-old campaign archived yesterday is trashed on the next daily cron. Mitigations, both confirmed: the feature is off by default (`archive_purge_days = 0`, confirmed in `class-wpsg-settings-registry.php:239`), and the second phase (trash purge) uses `post_modified_gmt` as an approximation of trash time, giving a grace window before permanent deletion.

### Fix

Query on the `archived_at` timestamp written by P66-A instead of `post_date_gmt`. Migrate existing archived campaigns per Key Decision B (seed `archived_at = now()`, conservative default — flag if the audit-log-derived alternative is preferred instead).

### Acceptance criteria

- A campaign archived N+1 days ago (per its `archived_at`, regardless of original creation date) is eligible for auto-purge; one archived yesterday is not, no matter how old the campaign is.
- Existing archived campaigns (pre-migration) are not purged earlier than they would have been under the old logic (satisfied by the conservative "seed from now" backfill).

### Validation

- Test: a campaign created long ago, archived yesterday, with `archive_purge_days` set low, is **not** selected for purge.
- Test: a campaign archived N+1 days ago **is** selected, regardless of creation date.
- Manual: enable `archive_purge_days` on a dev site, verify the cron selection matches expectations for both old and new campaigns.

---

## Track P66-C - Space-filtered analytics always empty

*Source: PHP_REVIEW_FINDINGS.md § A-3 — re-verified 2026-07-14, confirmed accurate, including that `insert_audit_entry` already stamps `space_id` correctly (prior P50-A fix) while the other three writers don't.*

### Problem

The v11 migration added a `space_id` column to four campaign-scoped tables, and `insert_audit_entry()` (`class-wpsg-db.php`) already stamps it correctly (P50-A). But `record_analytics_event()` (`class-wpsg-analytics-controller.php:93-104`) still inserts without `space_id`, while `get_analytics_summary()` filters `AND space_id = %d` — so a space-scoped analytics summary reports **zero** views/visitors for every event recorded since the space feature shipped. `sync_media_refs()` and `insert_access_request()` (`class-wpsg-db.php`) have the same gap — latent today (no current query filters those two tables by `space_id`), but the column sits permanently at 0.

### Fix

Resolve the campaign's space at insert time (same pattern as `insert_audit_entry`) in all three writers. Ship a one-time, option-guarded backfill: `UPDATE t JOIN wp_postmeta pm ON pm.post_id = t.campaign_id AND pm.meta_key = '_wpsg_space_id' SET t.space_id = pm.meta_value WHERE t.space_id = 0`, applied to all three tables.

### Acceptance criteria

- New analytics events, media-ref syncs, and access requests are stamped with the correct `space_id` at insert time.
- A one-time backfill corrects `space_id` on historical rows for all three tables.
- A space-scoped analytics summary reports real, non-zero numbers for a space with real activity.

### Validation

- New test: insert an analytics event scoped to a non-default space, assert `get_analytics_summary()` for that space reflects it.
- Test the backfill migration against a fixture with pre-existing `space_id = 0` rows and populated `_wpsg_space_id` postmeta.
- Manual: view analytics for a delegated space with real traffic, confirm non-zero numbers.
- **Cross-referenced 2026-07-14 against REACT_REVIEW_FINDINGS.md § G:** the frontend already passes `spaceId` to `getAnalyticsSummary` and gates the space-filter UI correctly — no FE code change is expected here. Once this track lands, do a frontend spot-check of the space-filtered analytics dashboard against real data (rather than a synthetic fixture) and remove any FE-side workaround if one was ever added for the all-zeros symptom.

---

## Track P66-D - Duplicating a campaign drops its space and its category/tag terms

*Source: PHP_REVIEW_FINDINGS.md § A-11 — re-verified 2026-07-14, confirmed accurate. `WPSG_Campaign_Duplicator::duplicate()` copies `visibility`, `tags`, `cover_image`, `_wpsg_gallery_overrides`, `_wpsg_layout_binding`, and the `wpsg_company` term, but neither `_wpsg_space_id` nor the `wpsg_campaign_category`/`wpsg_campaign_tag` taxonomies.*

### Problem

`WPSG_Campaign_Duplicator::duplicate()` (`class-wpsg-campaign-duplicator.php`) doesn't copy `_wpsg_space_id` — the duplicate silently falls back to the Default Space, escaping a delegated space — and doesn't copy the `wpsg_campaign_category`/`wpsg_campaign_tag` taxonomies, even though it does copy the `wpsg_company` term.

### Fix

Add `_wpsg_space_id` to the copied meta keys and copy the two taxonomies alongside `wpsg_company`. The duplicate endpoint's permission gate already requires access to the source campaign's space, and the copy stays in that space once fixed, so no new gate is needed.

### Acceptance criteria

- Duplicating a campaign in a delegated space produces a duplicate in the **same** space, not the Default Space.
- Duplicating a campaign with categories/tags produces a duplicate with the same categories/tags.

### Validation

- Test: duplicate a campaign assigned to a non-default space with categories and tags set; assert the duplicate has the same `_wpsg_space_id` and the same taxonomy terms.

---

## Track P66-E - Campaign templates appear in campaign listings

*Source: PHP_REVIEW_FINDINGS.md § A-10 — re-verified 2026-07-14, confirmed accurate. Confirmed `list_campaigns()` has no `_wpsg_is_template` exclusion clause anywhere in its meta-query construction.*

### Problem

User campaign templates are `wpsg_campaign` posts flagged with `_wpsg_is_template` (`class-wpsg-campaign-templates.php`), but `list_campaigns()` (`class-wpsg-campaign-controller.php`) never excludes that flag — templates surface as draft campaigns in the admin `campaigns.list` API and in the wp-admin Campaigns list table (anonymous/viewer listings are shielded separately by the draft/private gates).

### Fix

Add a `['key' => '_wpsg_is_template', 'compare' => 'NOT EXISTS']` clause to `list_campaigns()`'s meta query, and optionally a matching `pre_get_posts` filter for the wp-admin list table. Verify the frontend admin panel isn't already compensating for this client-side (if it is, that workaround can be removed once the backend excludes templates).

### Acceptance criteria

- Campaign templates no longer appear in `campaigns.list` API responses or the wp-admin Campaigns list table.
- Templates remain fully manageable through whatever dedicated template UI/endpoint already exists.

### Validation

- Test: create a template-flagged campaign post, assert it's absent from `list_campaigns()` output.
- Manual: confirm the wp-admin Campaigns list table no longer shows template posts.

---

## Track P66-F - Uninstall completeness (options, tables, directories, indexes, cron)

*Source: PHP_REVIEW_FINDINGS.md § F-1 — re-verified 2026-07-14 via a full line-by-line read of `uninstall.php` (174 lines) cross-referenced against every option/table/directory/cron-hook definition site in the plugin. All sub-claims confirmed exactly as described.*

### Problem

`preserve_data_on_uninstall` defaults to **true**, so cleanup only runs when the operator explicitly opts out — but when they do, the promise is "remove all plugin data," and the current script leaves behind, confirmed real and actively used:

- **Options:** `wpsg_webhook_endpoints` (contains **webhook secrets**), `wpsg_webhook_delivery_log`, `wpsg_recent_logs`, `wpsg_rest_request_count`, `wpsg_rest_error_count`, `wpsg_oembed_failure_count` (distinct from the already-deleted `wpsg_oembed_provider_failures`), `wpsg_alert_email_queue`, `wpsg_export_job_index`, `wpsg_font_library`, `wpsg_campaign_tables_innodb_v15`, `wpsg_space_library_assoc_backfilled`, and all per-hash `wpsg_thumb_%` options (uninstall only deletes the legacy singular `wpsg_thumbnail_cache_index`).
- **Tables:** `wpsg_assets` (uninstall drops only the old pre-rename name `wpsg_overlays`) and `wpsg_space_library_assoc`.
- **Directories:** `wpsg-fonts/` and `wpsg-exports/` (only `wpsg-thumbnails/` and `wpsg-overlays/` are removed).
- **Indexes:** the custom `wpsg_postmeta_postid_key` / `wpsg_termmeta_termid_key` indexes added to **core** WP tables (`wp_postmeta`, `wp_termmeta`) by `WPSG_DB::add_indexes()` are never dropped.
- **Cron:** `wpsg_deactivate()` clears 10 hooks; `uninstall.php` clears only 4 — missing `wpsg_trash_purge`, `wpsg_analytics_purge`, `wpsg_expired_grants_cleanup`, `wpsg_webhook_retry`, `wpsg_export_process_job`, `wpsg_export_cleanup`.

### Fix

- Extend `uninstall.php`'s option-deletion list with all confirmed-missing options above, plus a `LIKE 'wpsg\_thumb\_%'` delete query.
- Drop `wpsg_assets` and `wpsg_space_library_assoc`.
- Remove `wpsg-fonts/` and `wpsg-exports/`; per the already-decided Key Decision C, `wpsg-exports/` is removed in **both** preserve-data and full-cleanup modes, with one doc sentence in the packaging/install docs telling migrators to move ZIPs out of `uploads/wpsg-exports/` before uninstalling.
- Add guarded `DROP INDEX` statements for both custom core-table indexes.
- Define the canonical cron-hook list once (shared constant/method), used by both `wpsg_deactivate()` and `uninstall.php`, so the two lists can't drift again.

### Acceptance criteria

- Uninstalling with data-removal enabled leaves zero `wpsg_*` options, tables, directories, or custom indexes behind (verifiable by a full-site option/table/index diff before and after).
- `wpsg-exports/` is removed regardless of the `preserve_data_on_uninstall` setting.
- The cron-hook clear list is identical between `wpsg_deactivate()` and `uninstall.php` by construction (single source of truth), not by manual sync.

### Validation

- New test: run the uninstall routine against a fixture site with every listed option/table/dir/index present, assert all are gone afterward.
- Consider a standing smoke test that diffs the actual option-name inventory (a one-line grep, as done for this review) against the uninstall deletion list, so future new options can't silently escape cleanup again.
- Manual: full uninstall on a dev site with data-removal enabled; confirm via direct DB/filesystem inspection that nothing plugin-related remains.

## Follow-On Candidates

| Candidate | Status |
|-----------|--------|
| Audit-log-derived `archived_at` backfill (more accurate than "seed from now") | **Delivered this phase** (Key Decision B resolved to this option). No longer a follow-on. |
| Direct PHPUnit coverage that boots `uninstall.php` end-to-end | Deferred. `uninstall.php` runs in an isolated process (`WP_UNINSTALL_PLUGIN`), which the PHPUnit harness does not model. P66-F is covered by `WPSG_Cron_Hooks_Test` (single-source-of-truth + deactivation clear) plus the before/after DB/filesystem diff in the manual QA runbook. |

## Implementation Notes

### P66-A — `WPSG_Campaign_Status` (new class)
- New `includes/class-wpsg-campaign-status.php`. `set($id, $status, $ctx)` validates the enum, writes `status`, and — via `stamp_transition()` — writes `archived_at` on entering the archived state / `restored_at` (clearing `archived_at`) on leaving it. A redundant re-archive does **not** reset `archived_at` (the purge clock must not restart).
- **Design call (my judgment):** audit / hook / cache side-effects are **opt-in via `$ctx`**, passed per call site to reproduce each site's *existing* behavior, so no outward-facing change (webhook volume, audit-log noise) results. The core bug — a timestamp written atomically wherever status is — is fixed uniformly; the review's "fires the matching hook + audit entry" is honored where callers already did so.
- Wired all 7 sites: `archive_campaign`, `restore_campaign`, `batch_campaigns`, `apply_campaign_meta` (generic create/update, events suppressed since the caller emits `campaign.created`/`campaign.updated`), `archive_company` (access controller, one cache bump after the loop, no per-campaign hook — unchanged), CLI `campaign_archive`/`campaign_restore` (audit+cache, no hook — unchanged).
- The auto-archive **cron** batch (`wpsg_archive_campaign_status_batch`) keeps its optimized batched-SQL status write and additionally calls `WPSG_Campaign_Status::stamp_archived_batch()` (2 queries: clear stale archived_at/restored_at, then one bulk INSERT) — O(1) queries per batch. The metadata-API fallback routes each campaign through `set()`. Fixed a latent gap: the partial-failure branch now stamps the already-UPDATEd ids before falling back.

### P66-B — auto-purge keyed off `archived_at`
- `WPSG_Maintenance::trash_archived_campaigns()` swapped its `date_query` on `post_date_gmt` for a `meta_query` on `archived_at` (`<=` cutoff, DATETIME). Archived campaigns with no `archived_at` are excluded (conservative shield).
- Backfill `WPSG_DB::maybe_backfill_archived_at()` (audit-log-derived, per Key Decision B) + helper `derive_archived_at_from_legacy_meta()`. Runs once via the `DB_VERSION` bump to `16`, guarded by `wpsg_archived_at_backfilled`.

### P66-C — `space_id` stamped on the three scoped writers
- `record_analytics_event()`, `WPSG_DB::sync_media_refs()`, `WPSG_DB::insert_access_request()` now resolve the campaign's `_wpsg_space_id` and stamp it at insert (same pattern as `insert_audit_entry`).
- Backfill `WPSG_DB::maybe_backfill_scoped_space_ids()` (one `UPDATE … JOIN wp_postmeta` per table, `WHERE space_id = 0`), guarded by `wpsg_scoped_space_id_backfilled`. audit_log excluded (already stamped in P50-A).

### P66-D — duplication completeness
- `WPSG_Campaign_Duplicator::duplicate()` adds `_wpsg_space_id` to the copied meta keys and copies the `wpsg_campaign_category` / `wpsg_campaign_tag` taxonomies alongside `wpsg_company`.

### P66-E — templates excluded from listings
- `list_campaigns()` gains a `_wpsg_is_template NOT EXISTS` meta clause (placed first, so it applies to admin, anonymous, and space-scoped paths).
- New `WPSG_CPT::exclude_templates_from_admin_list()` `pre_get_posts` filter for the wp-admin Campaigns list table (mirrors the existing `apply_space_filter`).

### P66-F — uninstall completeness + shared cron list
- New dependency-free `includes/wpsg-cron-hooks.php` → `wpsg_get_cron_hooks()`, the single source of truth consumed by both `wpsg_deactivate()` and `uninstall.php` (10 hooks; was 10 vs 4).
- `uninstall.php`: added all confirmed-missing options + a `LIKE 'wpsg\_thumb\_%'` delete; drops `wpsg_assets` + `wpsg_space_library_assoc`; removes `wpsg-fonts/` and (per Key Decision C, **before** the preserve-data early return) `wpsg-exports/`; guarded `DROP INDEX` for the two custom core-table indexes; added the two new P66 backfill-guard options to the deletion list.
- Packaging note added to [INSTALL_AND_TROUBLESHOOTING.md](guides/INSTALL_AND_TROUBLESHOOTING.md#uninstalling): move ZIPs out of `uploads/wpsg-exports/` before uninstalling.

### Tests
- New: `WPSG_P66A_Campaign_Status_Test`, `WPSG_P66B_Archived_At_Backfill_Test`, `WPSG_P66C_Scoped_Space_Id_Test`, `WPSG_P66D_Duplicate_Space_Taxonomy_Test`, `WPSG_P66E_Template_Listing_Test`, `WPSG_Cron_Hooks_Test`.
- Extended: `WPSG_Maintenance_Test` (creation-date-independent purge + no-`archived_at` skip), `WPSG_Auto_Archive_Cron_Test` (batched path stamps `archived_at`).
- Full wp-env PHPUnit suite: **1255 tests, 13535 assertions, 0 failures, 2 pre-existing skips** (was 1219/13437 at the P65 landing; +36 tests).

## Outcome

All six tracks landed and tested. Campaign lifecycle bookkeeping is now complete: status transitions stamp `archived_at`/`restored_at` from every entry point; the auto-purge keys off the real archival date (with an audit-log-derived backfill for history); the three scoped tables stamp `space_id` so space analytics report real numbers; duplicates keep their space and categorization; templates no longer masquerade as campaigns; and uninstall removes all plugin data — options (incl. webhook secrets), tables, directories, custom core-table indexes, and all cron hooks — with `wpsg-exports/` always removed and the cron-hook list a single source of truth.
