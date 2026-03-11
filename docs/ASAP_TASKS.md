# ASAP Tasks

Tasks with meaningful user or system impact that should be addressed in the near term.
Sourced from PHP_IMPLEMENTATION_REVIEW.txt and REACT_IMPLEMENTATION_REVIEW.txt deferred task lists.

---

## D-4: Maintenance Purge — Add Trash Phase and Pre-Deletion Safeguards
**Source:** PHP_IMPLEMENTATION_REVIEW.txt (D-4)  
**Files:** `class-wpsg-maintenance.php` (`purge_archived_campaigns`)  
**LOE:** Medium (4-6 hours)  
**Why ASAP:** Archived campaigns are permanently deleted with no confirmation, notification, or recovery path. Accidental short retention = irreversible data loss.

**Solution:**
1. Phase 1 — `wp_trash_post` instead of `wp_delete_post`
2. Phase 2 — Weekly cron for trash items older than grace period, email notification with export link
3. Phase 3 — Permanent delete 24h after notification
4. Add `purge_grace_period_days` setting (default 30, min 7)

---

## D-6: Audit and Fix Cache Invalidation Gaps
**Source:** PHP_IMPLEMENTATION_REVIEW.txt (D-6)  
**Files:** `class-wpsg-rest.php` (all mutation endpoints)  
**LOE:** Small-Medium (3-4 hours)  
**Why ASAP:** Gaps in cache invalidation for less-frequent operations (access grants, settings updates, taxonomy edits). Stale lists persist for up to 15 min.

**Solution:**
1. Create unified `invalidate_all_caches()` method
2. Grep for all mutation calls, add invalidation to access grant/override endpoints, settings update, category assignment
3. Add integration tests

---

## D-15: Standardize REST Error Responses
**Source:** PHP_IMPLEMENTATION_REVIEW.txt (D-15)  
**Files:** `class-wpsg-rest.php` (all endpoints returning errors)  
**LOE:** Medium (4-6 hours)  
**Why ASAP:** Mixed error patterns (WP_Error, WP_REST_Response with error status, raw arrays). Affects third-party integrations and automated tools.

**Solution:**
1. Grep for mixed patterns (WP_REST_Response with 4xx/5xx, raw arrays with error keys)
2. Replace with `new WP_Error()` usage
3. Update PHPUnit assertions

---

## D-20: Analytics Data Retention / Purge Cron
**Source:** PHP_IMPLEMENTATION_REVIEW.txt (D-20)  
**Files:** `class-wpsg-db.php`, `class-wpsg-maintenance.php`, `class-wpsg-settings.php`  
**LOE:** Small-Medium (3-4 hours)  
**Why ASAP:** Analytics data accumulates indefinitely. Millions of rows will eventually slow aggregate queries.

**Solution:**
1. Add `analytics_retention_days` setting (default 90, min 30, max 730)
2. Weekly cron deleting in batches of 1000
3. Manual "Purge Analytics" button in Settings

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

---

## RD-14: safeLocalStorage Utility
**Source:** REACT_IMPLEMENTATION_REVIEW.txt (RD-14)  
**Files:** Multiple (~10+ production files using `localStorage`)  
**LOE:** Low-Medium (2-3 hours)  
**Why ASAP:** Bare `localStorage` calls scattered across codebase. Some browsers block localStorage entirely (private browsing, enterprise policies). A centralized wrapper prevents silent failures.

**Solution:**
1. Create `src/utils/safeLocalStorage.ts` with try/catch for quota/blocking
2. Find-and-replace bare `localStorage` calls in production files
3. Keep test files using raw `localStorage` (fine in test env)

---

## RD-19: Scope Admin Hotkeys to Container
**Source:** REACT_IMPLEMENTATION_REVIEW.txt (RD-19)  
**Files:** `src/hooks/useAdminCampaignActions.ts`  
**LOE:** Low-Medium (1-2 hours)  
**Why ASAP:** `useHotkeys` binds to `document`, which can conflict with WordPress admin keyboard shortcuts. Requires wrapping with `getHotkeyHandler` or a container-scoped approach.

**Solution:**
1. Replace `useHotkeys` with Mantine's `getHotkeyHandler` attached to the admin container ref
2. Or use a custom wrapper that listens on the container element
