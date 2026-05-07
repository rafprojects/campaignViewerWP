# ASAP Tasks

Tasks with meaningful user or system impact that should be addressed in the near term.
Sourced from archived [PHP_IMPLEMENTATION_REVIEW.txt](archive/reviews/PHP_IMPLEMENTATION_REVIEW.txt) and [REACT_IMPLEMENTATION_REVIEW.txt](archive/reviews/REACT_IMPLEMENTATION_REVIEW.txt) deferred task lists.

---

## ~~D-4: Maintenance Purge — Add Trash Phase and Pre-Deletion Safeguards~~ ✅
**Completed:** commit 21da22f  
Two-phase cleanup (archive→trash→delete with grace period). New settings: `archive_purge_days`, `archive_purge_grace_days`, `analytics_retention_days`.

---

## ~~D-6: Audit and Fix Cache Invalidation Gaps~~ ✅
**Completed:** commit 21da22f  
Added `bump_cache_version()`/`clear_accessible_campaigns_cache()` to 10 mutation endpoints.

---

## ~~D-15: Standardize REST Error Responses~~ ✅
**Completed:** commit 279427e  
Converted 90 `WP_REST_Response` error returns to `WP_Error` with `wpsg_*` codes. 3 intentional exceptions kept (proxy_oembed 429+502s).

---

## ~~D-20: Analytics Data Retention / Purge Cron~~ ✅
**Completed:** commit 21da22f  
Batch analytics purge cron (wpsg_analytics_purge) deletes rows older than `analytics_retention_days` in batches of 1000.

---

## ~~RD-14: safeLocalStorage Utility~~ ✅
**Completed:** commit 5769e69  
Created `src/utils/safeLocalStorage.ts`. Migrated 14 unprotected call sites in WpJwtProvider and LayoutBuilderModal.

---

## ~~RD-19: Scope Admin Hotkeys to Container~~ ✅
**Completed:** commit 5769e69  
Replaced global `useHotkeys` with `getHotkeyHandler` on container elements. Admin shortcuts scoped to Card, canvas shortcuts scoped to canvas Box.

---

## ~~D-9: Migrate Access Requests from wp_options to Custom Table~~ ✅
**Completed:** commit 5423466  
DB_VERSION bumped to 4. Created `wpsg_access_requests` table with indexed lookups. Migrated from O(N) wp_options scans to indexed SQL queries. 7 DB helpers, rewritten REST handlers, uninstall cleanup, 25 PHPUnit tests.

---

## ~~RD-12: Campaign Pagination for Large Lists~~ ✅
**Completed:** commit 1cc73c9  
PHP endpoint already supported pagination. Updated `useAdminCampaigns` to pass page/perPage params and return pagination metadata. Added Mantine `<Pagination>` to CampaignsTab. Separate `useAllCampaignOptions` hook for selector dropdowns.
