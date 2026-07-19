# Phase 66 — Manual QA & Validation Runbook

**Companion to:** [PHASE66_REPORT.md](PHASE66_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand — exact preconditions, commands, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test. It follows the format of [PHASE65_MANUAL_QA_RUNBOOK.md](PHASE65_MANUAL_QA_RUNBOOK.md).

**Scope:** tracks P66-A … P66-F. Phase 66 is entirely a **backend / lifecycle-bookkeeping** change — there is no new frontend surface. You verify it through the REST API, WP-CLI, WP-Cron, and direct DB/postmeta inspection. Do the shared setup once (§1), then run the tracks in any order **except** that P66-B builds on P66-A (archive something through any entry point first, then watch the purge clock key off it).

**Golden rule (unchanged from P63–P65):** a fix's test is only meaningful if you have also seen it **fail without the fix**, or you understand precisely why the pre-fix code was wrong. Each section states the pre-fix behavior so a green result actually proves something. The cleanest way to watch these fail is to check out the commit **before** this phase and re-run the same steps:

```bash
git log --oneline | grep -iE 'p66|phase66'   # find the P66 commits
git checkout <commit-before-P66-A>            # e.g. the P65 merge commit 50cae225
# …run a step, observe the broken behavior…
git checkout feature/phase66-php-hardening-4-of-5   # back to the fixes
```

**A note on migration-backed tracks (P66-B, P66-C).** Both ship a one-time, option-guarded backfill that runs inside `WPSG_DB::maybe_upgrade()` when the DB version bumps to `16`. On an already-upgraded dev site the guard option is set, so re-running the backfill by hand needs the guard cleared first (each section shows the exact `wp option delete` for its guard). This is the *only* safe way to re-observe a one-time migration.

---

## 1. Environment & personas

| Requirement | Why |
|---|---|
| Local `wp-env` dev site (`npx wp-env start` from repo root) | Standard test host. Base URL `http://localhost:8888`. |
| `curl` (`-s`/`-i`), `jq` | REST + JSON assertions are scriptable and unambiguous. |
| WP-CLI via `npx wp-env run cli wp …` | CLI is one of the archive/restore transports under test (P66-A), and the tool for inspecting postmeta and running cron/migrations by hand. |
| System Admin auth for curl (Application Password) | The archive/restore/analytics/duplicate endpoints are admin-gated. |

```bash
export BASE=http://localhost:8888
export AUTH='-u sysadmin:APP_PASSWORD'     # an Application Password for a System Admin
```

**Personas / auth.** Same RBAC model as Phase 63–65 — see **§2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md)** for creating a System Admin and minting an Application Password.

**Reusable helpers.**

```bash
# A campaign to work with:
CID=$(npx wp-env run cli wp post create --post_type=wpsg_campaign \
  --post_title='P66 Source' --post_status=publish --porcelain)
npx wp-env run cli wp post meta update $CID status active

# Inspect the lifecycle bookkeeping introduced by P66-A:
npx wp-env run cli wp post meta get $CID status
npx wp-env run cli wp post meta get $CID archived_at
npx wp-env run cli wp post meta get $CID restored_at
```

---

## 2. Mental model — what actually changed

Every track closes a gap between "data changed" and "the bookkeeping around that change is complete":

| Track | The gap | The fix |
|---|---|---|
| P66-A | `status` written at 7 sites, none recording *when* it changed | `WPSG_Campaign_Status::set()` writes status **and** `archived_at`/`restored_at` atomically; every site calls it |
| P66-B | Auto-purge keyed off the campaign's **creation** date | Keys off `archived_at` (from P66-A); an audit-log-derived backfill seeds it for old campaigns |
| P66-C | `space_id` never written on 3 scoped tables → space analytics always 0 | Writers stamp `space_id` at insert; a backfill corrects history |
| P66-D | Duplicate lost its space and its category/tag terms | Duplicator copies `_wpsg_space_id` + both taxonomies |
| P66-E | Templates surfaced as draft campaigns in listings | `list_campaigns` + the wp-admin list table exclude `_wpsg_is_template` |
| P66-F | Uninstall left options (incl. webhook secrets), tables, dirs, indexes, 6 cron hooks behind | Complete deletion + one shared cron-hook list |

---

## 3. Track-by-track

---

### P66-A — centralized status writes stamp `archived_at`/`restored_at`

**What & why.** Archiving or restoring a campaign now goes through one method, `WPSG_Campaign_Status::set($id, $status, $ctx)`, which writes the `status` meta **and** the matching timestamp in one place. `archived_at` is set when a campaign enters the archived state and cleared on restore (with `restored_at` written); a redundant re-archive does **not** reset `archived_at` (the purge clock must not restart). Audit/hook/cache side-effects are opt-in per caller, so external behavior (webhook volume, audit-log noise) is unchanged — the point of the track is only that the timestamp is now written *everywhere the status is*.

**Pre-fix behavior.** `update_post_meta($id, 'status', 'archived')` at each of 7 sites; **no** `archived_at` meta existed anywhere in the codebase.

#### Part 1 — single REST archive/restore

```bash
# Archive:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/archive" | jq .
npx wp-env run cli wp post meta get $CID status        # → archived
npx wp-env run cli wp post meta get $CID archived_at   # → a Y-m-d H:i:s UTC timestamp (was empty pre-fix)
npx wp-env run cli wp post meta get $CID restored_at   # → empty

# Restore:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/restore" | jq .
npx wp-env run cli wp post meta get $CID status        # → active
npx wp-env run cli wp post meta get $CID archived_at   # → EMPTY (cleared on restore)
npx wp-env run cli wp post meta get $CID restored_at   # → a timestamp
```

**Expected (pass).** `archived_at` is a real UTC timestamp after archive and **empty** after restore; `restored_at` is the mirror. **Why it proves the fix:** pre-fix, `wp post meta get $CID archived_at` prints nothing in *every* case — the meta never existed.

#### Part 2 — the clock does not reset on re-archive

```bash
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/archive" >/dev/null
FIRST=$(npx wp-env run cli wp post meta get $CID archived_at)
sleep 2
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/archive" >/dev/null
SECOND=$(npx wp-env run cli wp post meta get $CID archived_at)
[ "$FIRST" = "$SECOND" ] && echo "PASS: clock preserved" || echo "FAIL: clock reset"
```

**Expected (pass).** `FIRST == SECOND` — re-archiving an already-archived campaign leaves the original `archived_at` intact. This is what makes P66-B's purge window honest.

#### Part 3 — every entry point stamps it (parity)

Archive the campaign through each transport and confirm `archived_at` lands each time (restore between checks to reset). The four to spot-check:

```bash
# Batch REST:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/batch" \
  -H 'Content-Type: application/json' -d "{\"action\":\"archive\",\"ids\":[$CID]}" >/dev/null
npx wp-env run cli wp post meta get $CID archived_at    # → timestamp

# (restore, then) WP-CLI:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/restore" >/dev/null
npx wp-env run cli wp wpsg campaign archive $CID
npx wp-env run cli wp post meta get $CID archived_at    # → timestamp

# (restore, then) generic update endpoint with status=archived:
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/restore" >/dev/null
curl -s $AUTH -X PUT "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID" \
  -H 'Content-Type: application/json' -d '{"status":"archived"}' >/dev/null
npx wp-env run cli wp post meta get $CID archived_at    # → timestamp

# Auto-archive cron (set unpublish_at in the past, run the hourly job):
curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$CID/restore" >/dev/null
npx wp-env run cli wp post meta update $CID unpublish_at "$(date -u -d '-1 hour' '+%Y-%m-%d %H:%M:%S')"
npx wp-env run cli wp cron event run wpsg_schedule_auto_archive
npx wp-env run cli wp post meta get $CID status         # → archived
npx wp-env run cli wp post meta get $CID archived_at    # → timestamp (batched-SQL path stamps it too)
```

**Expected (pass).** All five entry points (single REST from Part 1, plus these four) leave an `archived_at`. **Why it proves the fix:** the batched-SQL cron path and the CLI path historically each wrote status their own way; a timestamp appearing uniformly is the observable signature of "one method backs them all."

**Company-level bulk archive.** The 6th/7th sites (`archive_company` in the access controller) are covered by the same method; if you exercise the company-archive endpoint, spot-check that each affected campaign gets `archived_at` and that exactly **one** cache-version bump happens for the whole batch (not one per campaign).

**Regression checks.** `WPSG_P66A_Campaign_Status_Test` (14 tests) + the extended `WPSG_Auto_Archive_Cron_Test`. Existing archive/restore coverage (`WPSG_Campaign_Rest_Test`, `WPSG_CLI_Test`) stays green — audit/hook/cache behavior is deliberately unchanged.

**Pitfalls.**
- `archived_at`/`restored_at` are stored as **UTC** `Y-m-d H:i:s` (via `gmdate`), matching every other WPSG datetime. Don't compare against local-time strings.
- The generic **update** endpoint (`PUT /campaigns/{id}`) stamps `archived_at` when `status` flips to archived but deliberately fires no `wpsg_campaign_archived` hook — it emits `campaign.updated`, exactly as before. That's intended, not a miss.

---

### P66-B — auto-purge keys off `archived_at`, not creation date

**What & why.** `WPSG_Maintenance::trash_archived_campaigns()` now selects archived campaigns whose **`archived_at`** is older than `archive_purge_days`, instead of `post_date_gmt`. A campaign created two years ago but archived yesterday is no longer trashed on the next cron run.

**Pre-fix behavior.** The `date_query` used `'column' => 'post_date_gmt'`, so purge eligibility followed the campaign's *creation* date.

```bash
# Enable the feature (off by default) and craft the decisive pair:
npx wp-env run cli wp eval '$s = get_option("wpsg_settings", []); $s["archive_purge_days"] = 30; update_option("wpsg_settings", $s);'

# A) created long ago, archived yesterday → must SURVIVE:
OLD=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='Old, just archived' \
  --post_date='2023-01-01 00:00:00' --post_status=publish --porcelain)
npx wp-env run cli wp post meta update $OLD status archived
npx wp-env run cli wp post meta update $OLD archived_at "$(date -u -d '-1 day' '+%Y-%m-%d %H:%M:%S')"

# B) created yesterday, archived 60 days ago → must be TRASHED:
NEW=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='New, long archived' \
  --post_status=publish --porcelain)
npx wp-env run cli wp post meta update $NEW status archived
npx wp-env run cli wp post meta update $NEW archived_at "$(date -u -d '-60 days' '+%Y-%m-%d %H:%M:%S')"

# Run the purge (phase 1 = trash):
npx wp-env run cli wp cron event run wpsg_archive_cleanup
npx wp-env run cli wp post get $OLD --field=post_status   # → publish  (survives)
npx wp-env run cli wp post get $NEW --field=post_status   # → trash    (eligible)
```

**Expected (pass).** `OLD` stays `publish`; `NEW` goes to `trash`. **Why it proves the fix:** pre-fix, eligibility followed `post_date` — `OLD` (created 2023) would be trashed and `NEW` (created yesterday) would survive, i.e. exactly inverted.

**Backfill (audit-log-derived).** Existing archived campaigns get `archived_at` seeded from their most recent `campaign.archived` audit entry (DB audit table first, then legacy `audit_log` post meta), falling back to "now" only when no archival record exists. To re-observe on a dev site:

```bash
# Pick a campaign already archived before P66, strip its archived_at, clear the guard, re-run the migration:
npx wp-env run cli wp post meta delete $SOME_OLD_ARCHIVED archived_at
npx wp-env run cli wp option delete wpsg_archived_at_backfilled
npx wp-env run cli wp eval 'delete_option("wpsg_db_version"); WPSG_DB::maybe_upgrade();'
npx wp-env run cli wp post meta get $SOME_OLD_ARCHIVED archived_at   # → the timestamp of its last campaign.archived audit entry
```

**Expected (pass).** `archived_at` matches the campaign's most recent `campaign.archived` audit timestamp (verify against `GET /campaigns/{id}/audit`). A campaign that has *no* archival record gets ≈ now (conservative — it waits the full window from migration).

**Regression checks.** The rewritten `WPSG_Maintenance_Test` (creation-date-independent purge, plus the "no `archived_at` ⇒ skip" conservative case) and `WPSG_P66B_Archived_At_Backfill_Test` (DB-entry, most-recent-wins, legacy-meta, now-fallback, already-set-skip, non-archived-ignored).

**Pitfalls.**
- `archive_purge_days` is **0 by default** (feature off). If the cron does nothing, confirm you actually set it.
- The purge is two-phase: `wpsg_archive_cleanup` *trashes*, then `wpsg_trash_purge` permanently deletes after `archive_purge_grace_days`. This track only changed **phase 1**; phase 2 still keys off `post_modified_gmt` (trash time), which is correct.
- An archived campaign with **no** `archived_at` is deliberately **never** purged by the new query — that's the conservative shield for any row the backfill missed, not a bug.

---

### P66-C — space-filtered analytics report real numbers

**What & why.** `record_analytics_event()`, `WPSG_DB::sync_media_refs()`, and `WPSG_DB::insert_access_request()` now stamp the campaign's `space_id` at insert (same resolution as `insert_audit_entry`). A one-time backfill corrects historical rows. The user-visible payoff: a space-scoped analytics summary counts events instead of reporting zero.

**Pre-fix behavior.** All three writers omitted `space_id`, so the column sat at `0`; `get_analytics_summary()` filters `AND space_id = %d`, so a space-scoped summary was always **0 views / 0 visitors**.

```bash
# A delegated space + a campaign in it:
SID=$(npx wp-env run cli wp eval 'echo WPSG_DB::insert_space(["slug"=>"qa-space","name"=>"QA","isolation_mode"=>"delegated"]);')
SCID=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='In QA Space' --post_status=publish --porcelain)
npx wp-env run cli wp post meta update $SCID status active
npx wp-env run cli wp post meta update $SCID _wpsg_space_id $SID

# Record three views:
for i in 1 2 3; do
  curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/analytics/event" \
    -H 'Content-Type: application/json' -d "{\"campaign_id\":$SCID,\"event_type\":\"view\"}" >/dev/null
done

# Space-scoped summary must be non-zero:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/analytics/summary?space=$SID" | jq '{totalViews, uniqueVisitors}'
# → totalViews 3 (was 0 pre-fix)

# Confirm the raw row carries the space:
npx wp-env run cli wp db query "SELECT space_id FROM $(npx wp-env run cli wp eval 'echo WPSG_DB::get_analytics_table();') WHERE campaign_id=$SCID LIMIT 1"
```

**Expected (pass).** `totalViews == 3` for the space filter, and the stored `space_id` equals `$SID`. **Why it proves the fix:** pre-fix, the same summary returns `totalViews: 0` because every event's `space_id` was `0` while the query filtered on the real space id.

**Backfill.** Historical `space_id = 0` rows are corrected by joining the campaign's `_wpsg_space_id` postmeta. To re-observe:

```bash
npx wp-env run cli wp option delete wpsg_scoped_space_id_backfilled
npx wp-env run cli wp eval 'delete_option("wpsg_db_version"); WPSG_DB::maybe_upgrade();'
# → analytics/media_refs/access_requests rows for space-assigned campaigns now carry the right space_id.
```

**Frontend spot-check (per PHASE66_REPORT §P66-C).** The SPA already passes `spaceId` to `getAnalyticsSummary` and gates the space filter correctly — no FE change was needed. After this lands, open the analytics dashboard, filter to a delegated space with real traffic, and confirm non-zero numbers against real data. There is no FE-side all-zeros workaround to remove (there never was one).

**Regression checks.** `WPSG_P66C_Scoped_Space_Id_Test` (three writers stamp; space-filtered summary counts; backfill corrects history). `WPSG_P28H_Analytics_Test` and `WPSG_DB_Test` stay green (default space_id `0` is unchanged for campaigns with no space).

**Pitfalls.**
- A campaign with no `_wpsg_space_id` meta resolves to `space_id = 0` — that's correct (it's in the Default Space, whose scoped queries don't filter). Use a campaign explicitly assigned to a delegated space to see a non-zero stamp.
- The audit-log table is intentionally **not** in the backfill — `insert_audit_entry` already stamped it in P50-A.

---

### P66-D — duplicating a campaign preserves its space and taxonomies

**What & why.** `WPSG_Campaign_Duplicator::duplicate()` now copies `_wpsg_space_id` and the `wpsg_campaign_category` / `wpsg_campaign_tag` taxonomies, alongside the `wpsg_company` term it already copied.

**Pre-fix behavior.** Neither `_wpsg_space_id` nor the category/tag terms were copied — the duplicate silently fell back to the Default Space and lost its categorization.

```bash
# Source in a delegated space, with a category and a tag:
SID=$(npx wp-env run cli wp eval 'echo WPSG_DB::insert_space(["slug"=>"dup-space","name"=>"Dup","isolation_mode"=>"delegated"]);')
SRC=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='Dup Source' --post_status=publish --porcelain)
npx wp-env run cli wp post meta update $SRC _wpsg_space_id $SID
CAT=$(npx wp-env run cli wp term create wpsg_campaign_category 'QA Cat' --porcelain)
TAG=$(npx wp-env run cli wp term create wpsg_campaign_tag 'QA Tag' --porcelain)
npx wp-env run cli wp post term add $SRC wpsg_campaign_category $CAT
npx wp-env run cli wp post term add $SRC wpsg_campaign_tag $TAG

# Duplicate via REST:
DUP=$(curl -s $AUTH -X POST "$BASE/wp-json/wp-super-gallery/v1/campaigns/$SRC/duplicate" \
  -H 'Content-Type: application/json' -d '{"name":"Dup Copy"}' | jq -r '.id')

npx wp-env run cli wp post meta get $DUP _wpsg_space_id                         # → $SID (not the default space)
npx wp-env run cli wp post term list $DUP wpsg_campaign_category --field=name   # → QA Cat
npx wp-env run cli wp post term list $DUP wpsg_campaign_tag --field=name        # → QA Tag
```

**Expected (pass).** The duplicate's `_wpsg_space_id` equals `$SID`, and it carries both terms. **Why it proves the fix:** pre-fix, `_wpsg_space_id` on the duplicate is the Default Space id (or empty) and the category/tag term lists are empty.

**Regression checks.** `WPSG_P66D_Duplicate_Space_Taxonomy_Test`.

**Pitfall.** The permission gate for `POST /campaigns/{id}/duplicate` already requires access to the source campaign's space, and the copy now stays in that space, so no new gate is needed — but this means a duplicate you make of a space you can't access still can't be made (unchanged).

---

### P66-E — templates no longer appear as campaigns

**What & why.** `list_campaigns()` and the wp-admin Campaigns list table now exclude `wpsg_campaign` posts carrying `_wpsg_is_template`. Templates stay reachable through the dedicated templates endpoint.

**Pre-fix behavior.** `list_campaigns()` had no template-exclusion clause, so a saved template surfaced as a draft campaign in `campaigns.list` and in the wp-admin list table.

```bash
# A normal campaign and a template-flagged one:
NORM=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='Real Campaign' --post_status=publish --porcelain)
npx wp-env run cli wp post meta update $NORM status active
TPL=$(npx wp-env run cli wp post create --post_type=wpsg_campaign --post_title='Saved Template' --post_status=publish --porcelain)
npx wp-env run cli wp post meta update $TPL _wpsg_is_template 1

# REST listing must include NORM, exclude TPL:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/campaigns?include_archived=true&per_page=50" \
  | jq --arg n "$NORM" --arg t "$TPL" '[.items[].id] | {hasNormal: (index($n) != null), hasTemplate: (index($t) != null)}'
# → { "hasNormal": true, "hasTemplate": false }

# Template still reachable through its own API:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/campaign-templates" | jq '.[].id'   # → includes $TPL
```

**Expected (pass).** `hasNormal: true, hasTemplate: false`, and the template still appears in the templates listing. **Why it proves the fix:** pre-fix, `hasTemplate` is `true` — the template leaks into the campaign list.

**wp-admin list table.** Log into wp-admin → **SuperGallery → Campaigns**. The template post must **not** appear in the table. (Pre-fix it did, as a Draft.)

**Regression checks.** `WPSG_P66E_Template_Listing_Test` (REST exclusion + templates-API still returns it). `WPSG_P28O_Campaign_Templates_Test` stays green. The wp-admin `pre_get_posts` filter is verified manually (above) — it is a thin mirror of the existing `apply_space_filter`, so its unit-level risk is low; the REST path (the higher-traffic, higher-risk surface) carries the automated coverage.

**Pitfall.** The exclusion is a `_wpsg_is_template NOT EXISTS` meta clause. If a template post is *missing* the flag (hand-created), it will still list — that's correct; it isn't actually a template.

---

### P66-F — uninstall removes everything (options, tables, dirs, indexes, cron)

**What & why.** Uninstalling with data-removal enabled now removes every `wpsg_*` option (including `wpsg_webhook_endpoints`, which holds **webhook secrets**), both renamed tables (`wpsg_assets`, `wpsg_space_library_assoc`), the `wpsg-fonts/` and `wpsg-exports/` upload dirs, the two custom indexes added to core WP tables, and all **10** cron hooks. `wpsg-exports/` is removed **regardless** of the preserve-data setting. The cron-hook list is a single source of truth (`includes/wpsg-cron-hooks.php`) shared by `wpsg_deactivate()` and `uninstall.php`, so the two can't drift.

**Pre-fix behavior.** Uninstall left ~12 options (incl. secrets), 2 tables, 2 dirs, 2 core-table indexes, and 6 of 10 cron hooks behind.

**⚠️ Uninstall is destructive and one-shot.** Do this on a throwaway dev site (or a DB snapshot you can restore). The most reliable check is a **before/after diff**.

```bash
# BEFORE — capture the plugin's footprint:
npx wp-env run cli wp db query "SELECT option_name FROM wp_options WHERE option_name LIKE 'wpsg\_%' ORDER BY option_name" > /tmp/opts_before.txt
npx wp-env run cli wp db query "SHOW TABLES LIKE 'wp_wpsg\_%'" > /tmp/tables_before.txt
npx wp-env run cli wp db query "SHOW INDEX FROM wp_postmeta WHERE Key_name='wpsg_postmeta_postid_key'"
npx wp-env run cli wp db query "SHOW INDEX FROM wp_termmeta WHERE Key_name='wpsg_termmeta_termid_key'"
npx wp-env run cli wp cron event list --fields=hook | grep wpsg

# Make sure data removal is ON (preserve flag OFF):
npx wp-env run cli wp eval '$s=get_option("wpsg_settings",[]); $s["preserve_data_on_uninstall"]=false; update_option("wpsg_settings",$s);'

# Trigger the real uninstall routine:
npx wp-env run cli wp plugin uninstall wp-super-gallery --deactivate

# AFTER — nothing wpsg-* should remain:
npx wp-env run cli wp db query "SELECT option_name FROM wp_options WHERE option_name LIKE 'wpsg\_%'"   # → empty
npx wp-env run cli wp db query "SELECT option_name FROM wp_options WHERE option_name LIKE 'wpsg\_thumb\_%'"  # → empty
npx wp-env run cli wp db query "SHOW TABLES LIKE 'wp_wpsg\_%'"                                          # → empty
npx wp-env run cli wp db query "SHOW INDEX FROM wp_postmeta WHERE Key_name='wpsg_postmeta_postid_key'"  # → empty
npx wp-env run cli wp db query "SHOW INDEX FROM wp_termmeta WHERE Key_name='wpsg_termmeta_termid_key'"  # → empty
ls "$(npx wp-env run cli wp eval 'echo wp_upload_dir()["basedir"];')" | grep wpsg   # → no wpsg-fonts / wpsg-exports / wpsg-thumbnails / wpsg-overlays
```

**Expected (pass).** Every AFTER query is empty. **Why it proves the fix:** pre-fix, the options query still lists `wpsg_webhook_endpoints`, `wpsg_font_library`, `wpsg_recent_logs`, the `wpsg_thumb_%` rows, etc.; `SHOW TABLES` still lists `wp_wpsg_assets` and `wp_wpsg_space_library_assoc`; the two indexes remain; and `wpsg-fonts/` / `wpsg-exports/` still exist.

**`wpsg-exports/` removed even when preserving data:**

```bash
# Fresh install, create an export dir, turn preserve-data ON, uninstall:
npx wp-env run cli wp eval 'wp_mkdir_p(wp_upload_dir()["basedir"]."/wpsg-exports"); file_put_contents(wp_upload_dir()["basedir"]."/wpsg-exports/x.zip","x");'
npx wp-env run cli wp eval '$s=get_option("wpsg_settings",[]); $s["preserve_data_on_uninstall"]=true; update_option("wpsg_settings",$s);'
npx wp-env run cli wp plugin uninstall wp-super-gallery --deactivate
ls "$(npx wp-env run cli wp eval 'echo wp_upload_dir()["basedir"];')/wpsg-exports" 2>&1   # → No such file or directory
# …but campaigns/options survive (preserve honored) — spot-check a wpsg_campaign post still exists.
```

**Expected (pass).** `wpsg-exports/` is gone even though preserve-data kept everything else. **Why it proves the fix:** Key Decision C — the 24h export-job TTL makes preserving ZIPs past uninstall backwards; the removal runs *before* the preserve-data early return.

**Cron-hook single-source-of-truth.** Verified automatically by `WPSG_Cron_Hooks_Test`: the canonical list matches every originating class constant (drift guard) and `wpsg_deactivate()` clears the whole set. Manually: `wp cron event list | grep wpsg` returns nothing after deactivation.

**Regression checks.** `WPSG_Cron_Hooks_Test`. Uninstall itself runs in an isolated process, so it is validated by the before/after diff above plus the cron-list unit test rather than a PHPUnit case that boots the uninstall file.

**Pitfalls.**
- `wp plugin uninstall` only runs `uninstall.php` if the plugin is **not** active — the `--deactivate` flag handles that.
- The `LIKE 'wpsg\_%'` escaping matters: an unescaped `_` is a single-char wildcard. The AFTER queries above escape it, matching the deletion queries.
- Migrators must move real ZIPs out of `uploads/wpsg-exports/` **before** uninstalling — this is now documented in [INSTALL_AND_TROUBLESHOOTING.md](guides/INSTALL_AND_TROUBLESHOOTING.md#uninstalling).

---

## 4. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P66-A | `archived_at`/`restored_at` stamped through every archive/restore entry point; clock not reset on re-archive | Audit/hook/cache behavior unchanged; `WPSG_P66A_Campaign_Status_Test` (14) + auto-archive cron green | ☐ |
| P66-B | Old-but-recently-archived campaign survives purge; new-but-long-archived is trashed | `WPSG_Maintenance_Test` + `WPSG_P66B_Archived_At_Backfill_Test` green | ☐ |
| P66-C | Space-filtered analytics summary is non-zero; 3 writers stamp `space_id`; backfill corrects history | `WPSG_P66C_Scoped_Space_Id_Test`; P28H/DB tests green | ☐ |
| P66-D | Duplicate keeps its space + category/tag terms | `WPSG_P66D_Duplicate_Space_Taxonomy_Test` green | ☐ |
| P66-E | Templates absent from `campaigns.list` + wp-admin table; still in templates API | `WPSG_P66E_Template_Listing_Test`; P28O green | ☐ |
| P66-F | Before/after diff: zero `wpsg_*` options/tables/dirs/indexes; all 10 cron hooks cleared; `wpsg-exports/` gone even when preserving | `WPSG_Cron_Hooks_Test` green | ☐ |

**Automated baseline (must be green alongside manual QA):** full wp-env PHPUnit suite — **1255 tests, 13535 assertions, 0 failures, 2 pre-existing skips** as of this phase (was 1219/13437 at the P65 landing; +36 tests for Phase 66). See PHASE66_REPORT.md → each track's *Implementation* block.
