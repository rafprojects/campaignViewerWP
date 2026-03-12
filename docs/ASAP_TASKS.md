# ASAP Tasks

Tasks with meaningful user or system impact that should be addressed in the near term.
Sourced from PHP_IMPLEMENTATION_REVIEW.txt and REACT_IMPLEMENTATION_REVIEW.txt deferred task lists.

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

## D-9: Migrate Access Requests from wp_options to Custom Table
**Source:** PHP_IMPLEMENTATION_REVIEW.txt (D-9)  
**Files:** `class-wpsg-rest.php` (submit/approve/deny_access_request), `class-wpsg-db.php`, `uninstall.php`  
**LOE:** Medium (6-8 hours)  
**Why ASAP:** Table schema already exists (`wpsg_access_requests`) but REST code still uses individual options + serialized index. Slow at hundreds of access requests.

**Solution:**
1. Replace `get_option` calls with `$wpdb` queries against custom table
2. Remove serialized index option
3. Add migration routine
4. Update `uninstall.php`
5. Add PHPUnit tests

---

## RD-12: Campaign Pagination for Large Lists
**Source:** REACT_IMPLEMENTATION_REVIEW.txt (RD-12)  
**Files:** `src/components/Admin/AdminPanel.tsx`, `src/hooks/useAdminSWR.ts`  
**LOE:** High (6-8 hours, requires PHP + React changes)  
**Why ASAP:** Admin panel silently degrades with >50 campaigns. No pagination — all campaigns loaded at once.

**Solution:**
1. Add PHP offset/limit params to campaign list endpoint
2. Add React pagination controls (or virtual scrolling)
3. Update SWR cache keys to include page param
