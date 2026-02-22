# Pre-Phase 14 Codebase Review

**Date:** February 22, 2026  
**Scope:** Full-stack audit of PHP plugin + React/TypeScript frontend  
**Baseline:** v0.11.0 (Phase 13 complete, 187 tests, tsc/build clean)

---

## Summary

| Severity | PHP | React/TS | Infra/Config | Total |
|----------|-----|----------|--------------|-------|
| **Critical** | 3 | 1 | 0 | **4** |
| **High** | 7 | 1 | 0 | **8** |
| **Medium** | 7 | 10 | 5 | **22** |
| **Low** | 6 | 9 | 4 | **19** |
| **Total** | 23 | 21 | 9 | **53** |

---

## A. CRITICAL — Fix Immediately

### A-1. Dead code inside access-control check (PHP)
**File:** `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` L573–578  
Dead code from `normalize_external_media()` (Odysee handler) is pasted inside the `can_view_campaign()` guard block. The `return` on L574 makes it unreachable, but the stray braces are fragile — any edit could break the auth check or cause a parse error.
```php
if (!self::can_view_campaign($post_id, $user_id)) {
    return new WP_REST_Response(['message' => 'Forbidden'], 403);
                    if (!preg_match('/^[a-zA-Z0-9_:-]+$/', $embed_slug)) {  // DEAD
                        return new WP_Error(…);                              // DEAD
                    }                                                        // DEAD
}
```
**Fix:** Delete lines 575–577.

### A-2. Undefined constant `WPSG_CPT::POST_TYPE` — PHP Fatal Error
**File:** `class-wpsg-rest.php` L1503  
`WPSG_CPT` does not define a `POST_TYPE` constant. Calling `rescan_all_media_types()` will trigger a fatal error.  
**Fix:** Add `const POST_TYPE = 'wpsg_campaign';` to `WPSG_CPT`, or replace with the string literal.

### A-3. SQL LIKE wildcard not escaped in cron handler
**File:** `wp-super-gallery.php` L118–122  
`_transient_wpsg_campaigns_%` uses `_` (single-char wildcard) without `$wpdb->esc_like()`. Can match unintended option rows.  
**Fix:** `$wpdb->esc_like('_transient_wpsg_campaigns_') . '%'`

### A-4. `campaignsRows` useMemo stale closure (React)
**File:** `src/components/Admin/AdminPanel.tsx` L528–573  
Dependencies are `[campaigns]` only, but the callback captures `handleEdit`, `restoringIds`, `archivingIds`, `setConfirmRestore`, `setConfirmArchive`. These are stale-captured: archive/restore loading states never visually update.  
**Fix:** Add all referenced identifiers to the dependency array, or extract a `<CampaignRow>` component.

---

## B. HIGH — Security & Correctness

### B-1. Internal URLs leaked in public oEmbed error response
**File:** `class-wpsg-rest.php` L1886–1893  
The `proxy_oembed` endpoint (public) returns an `attempts` array containing internal endpoint URLs on failure.  
**Fix:** Remove `attempts` from the response or gate behind `current_user_can('manage_options')`.

### B-2. No allowlist validation for `status` and `visibility` meta
**File:** `class-wpsg-rest.php` L3140–3145  
Values are sanitized but not validated against `['draft','active','archived']` / `['public','private']`. An admin could store arbitrary strings, potentially bypassing `can_view_campaign()`.  
**Fix:** `if (!in_array($status, ['draft','active','archived'], true)) { return error; }`

### B-3. `publishAt` / `unpublishAt` not validated as ISO 8601
**File:** `class-wpsg-rest.php` L3157–3175  
Invalid date strings (e.g., `"never"`) silently pass `sanitize_text_field()` and break cron comparisons.  
**Fix:** Validate with `strtotime()` or regex before storing.

### B-4. CORS headers sent to all origins
**File:** `wp-super-gallery.php` L135–136  
`Allow-Methods` and `Allow-Headers` are emitted unconditionally, even when `Allow-Origin` is denied.  
**Fix:** Move inside the origin allowlist check.

### B-5. Testing backdoor `simulateEmailFailure` in production
**File:** `class-wpsg-rest.php` L2002–2003  
Admin-only, but allows forcing the email-failure path which returns a password reset URL in JSON.  
**Fix:** Gate behind `defined('WP_DEBUG') && WP_DEBUG` or remove entirely.

### B-6. Unsanitized `$_SERVER['REQUEST_URI']`
**File:** `class-wpsg-embed.php` L51  
Not passed through `sanitize_text_field(wp_unslash(...))` like every other `$_SERVER` access.  
**Fix:** Add sanitization.

### B-7. Unprepared DDL in `ensure_index()`
**File:** `class-wpsg-db.php` L49  
`$index_name` and `$columns_sql` interpolated into raw SQL. Low risk (internal-only callers) but a latent injection vector.  
**Fix:** Validate identifiers with regex, add comment explaining why `prepare()` isn't used.

### B-8. Settings-to-defaults mapping triplicated (React DRY violation)
**File:** `src/App.tsx` (×2) + `src/components/Admin/SettingsPanel.tsx`  
The 80+ field `response.field ?? DEFAULT.field` mapping is copy-pasted 3 times. Any new setting must be added in all 3 places.  
**Fix:** Create `mergeSettingsWithDefaults(partial)` utility returning a full `GalleryBehaviorSettings`.

---

## C. MEDIUM — Efficiency, Code Quality & DRY

### C-1. N+1 query pattern in `list_companies()` (PHP)
**File:** `class-wpsg-rest.php` L939–981  
Each company iterates campaigns with individual `get_posts()` + `get_post_meta()`. 50 companies × 10 campaigns = ~550 queries.  
**Fix:** Single `WP_Query` with `tax_query`, group in PHP. Pre-warm term meta with `update_termmeta_cache()`.

### C-2. Unbounded `posts_per_page => -1` queries (PHP)
**Files:** `class-wpsg-rest.php` L947, L1027, L1213, L1528  
Four endpoints load ALL posts with no limit. Risk of memory exhaustion on large sites.  
**Fix:** Cap at 500, paginate, or use `'fields' => 'ids'` where only IDs are needed.

### C-3. `get_accessible_campaign_ids()` is O(N × M) (PHP)
**File:** `class-wpsg-rest.php` L2930–2960  
Iterates all published campaigns, calling `can_view_campaign()` per campaign (3+ queries each). Cached by transient, but cold-cache is expensive.  
**Fix:** Single meta_query for accessible campaigns instead of per-campaign loop.

### C-4. `format_campaign()` — 5+ DB calls per invocation (PHP)
**File:** `class-wpsg-rest.php` L3088–3108  
No batch pre-fetching of meta/terms. Multiplied in `list_campaigns()`.  
**Fix:** Call `update_postmeta_cache()` and batch-load terms before the `array_map`.

### C-5. Audit log race condition (PHP)
**File:** `class-wpsg-rest.php` L3249–3265  
Read-modify-write on serialized `audit_log` meta. Concurrent writes lose entries.  
**Fix:** Use individual `add_post_meta($id, 'audit_entry', $data, false)` rows, or move to a dedicated table.

### C-6. Settings response duplicated ~300 lines across 3 code paths (PHP)
**File:** `class-wpsg-rest.php` L2113–2385  
`get_public_settings()` has the full camelCase mapping repeated for admin response, public response, and update return.  
**Fix:** Extract `format_settings_response($settings, $is_admin)`.

### C-7. oEmbed failure counter race condition (PHP)
**File:** `class-wpsg-rest.php` L1873–1874  
Classic read-then-write on `wpsg_oembed_failure_count`. Concurrent requests lose increments.  
**Fix:** Atomic `UPDATE ... SET option_value = option_value + 1`.

### C-8. Upload validation duplicated (React)
**Files:** `src/App.tsx` L597–608, `src/components/Admin/MediaTab.tsx` L204–218  
Identical `ALLOWED_TYPES` array and `MAX_SIZE` constant.  
**Fix:** Extract to `utils/uploadValidation.ts`.

### C-9. Container layout derivation triplicated (React)
**Files:** `App.tsx`, `CardGallery.tsx`, `AuthBar.tsx`  
Same `containerSize / containerFluid / containerPaddingStyle` logic from `appMaxWidth`/`appPadding`.  
**Fix:** `useContainerLayout(settings)` hook.

### C-10. Inconsistent error handling — `(err as Error).message` vs `getErrorMessage()` (React)
**File:** `src/components/Admin/MediaTab.tsx` (7 occurrences)  
`getErrorMessage()` utility exists but isn't used consistently.  
**Fix:** Replace all raw casts with `getErrorMessage(err, 'Fallback')`.

### C-11. `SettingsResponse` ≈ `SettingsUpdateRequest` — near-identical 70-field types (React)
**File:** `src/services/apiClient.ts` L143–380  
**Fix:** `export type SettingsUpdateRequest = Partial<SettingsResponse>;`

### C-12. `SettingsResponse` uses `string` instead of union types (React)
**File:** `src/services/apiClient.ts` L232–260  
Fields like `cardBorderMode`, `modalTransition`, `cardDisplayMode` typed as `string` instead of their actual union types. Defeats compile-time checking.  
**Fix:** Import and use the proper union types from `types/index.ts`.

### C-13. Non-reactive `window.innerWidth` reads (React)
**Files:** `EditCampaignModal.tsx` L94, `SettingsPanel.tsx` L363  
Read once at mount, never update on resize/orientation change.  
**Fix:** Use Mantine's `useMediaQuery` hook.

### C-14. Console.log statements in production code (React)
**Files:** `main.tsx` L148, `MediaTab.tsx` (6 occurrences), `themes/index.ts` L194–201  
Not gated by `import.meta.env.DEV`.  
**Fix:** Gate behind DEV check or remove.

### C-15. `AppContent` component too large — 30+ useState (React)
**File:** `src/App.tsx`  
~1000 lines, ~30 state declarations, ~15 handlers.  
**Fix:** Extract `useEditCampaign()` and `useExternalMedia()` custom hooks.

### C-16. `deprecated` wp_count_terms parameter format (PHP)
**File:** `class-wpsg-rest.php` L987  
Uses old two-parameter form. WordPress 5.6+ expects array-only.  
**Fix:** `wp_count_terms(['taxonomy' => 'wpsg_company', 'hide_empty' => false])`

---

## D. LOW — Code Cleanup & Minor Issues

### D-1. Commented-out code in CampaignCard
**File:** `src/components/Gallery/CampaignCard.tsx` L161–166  
Old "counts layout" JSX in comments. Tracked in git; delete.

### D-2. Pointless variable `fallbackPermissions`
**File:** `src/App.tsx` L1048  
`const fallbackPermissions = hasProvider ? [] : [];` — both branches return `[]`.

### D-3. Duplicate "Header Visibility" divider label
**File:** `src/components/Admin/SettingsPanel.tsx` L413 + L437  
First one labels the wrong section (Layout & Dimensions).

### D-4. `ApiCampaignResponse` defined twice
**Files:** `App.tsx` L42–48, `useAdminSWR.ts` L56–58  
Different shapes. Consolidate in `types/index.ts`.

### D-5. Shadow preset mismatch
**File:** `src/components/Gallery/CampaignCard.tsx` L29–34  
Local `shadowMap` has key `'dramatic'` not in `ShadowPreset` type; missing `'strong'`/`'custom'`. A `resolveBoxShadow()` utility already exists.

### D-6. `theme.ts` is near-dead
**File:** `src/theme.ts`  
Only imported by `test-utils.tsx`. Could inline.

### D-7. `PR_COMMENTS.txt` at project root
Orphan file not referenced anywhere.

### D-8. `coverage/` checked into git
Build artifact. Run `git rm -r --cached coverage/`.

### D-9. `react-window` + `@types/react-window` unused
Zero imports in `src/`. Remove both from package.json.

### D-10. Dual sass compilers installed
Both `sass` and `sass-embedded`. Keep only `sass-embedded` (faster native binary).

### D-11. `mockData.ts` ships to production
**File:** `src/data/mockData.ts`  
Mock company data (Nike, Adidas, Apple) used as runtime fallback. Should source from API or remove.

### D-12. Security headers `X-Frame-Options: SAMEORIGIN` may conflict with embed use case
**File:** `wp-super-gallery.php` L147  
Documented filter exists but default may surprise users embedding on third-party sites.

---

## E. ADMIN UI — Settings Opportunities

### E-1. Gallery title & subtitle text hardcoded
**File:** `src/components/Gallery/CardGallery.tsx` L200–201  
"Campaign Gallery" and "Browse and access your campaign media" cannot be changed.  
**Proposal:** Add `galleryTitle` and `gallerySubtitle` string settings with TextInput controls.

### E-2. "Load More" batch size hardcoded to 12
**File:** `src/components/Gallery/CardGallery.tsx` L52  
`const LOAD_MORE_SIZE = 12;` — should be a configurable setting alongside `cardDisplayMode`.

### E-3. Card locked opacity hardcoded to 0.75
**File:** `src/components/Gallery/CampaignCard.tsx` L48  
`opacity: hasAccess ? 1 : 0.75` — could be `cardLockedOpacity` setting.

### E-4. Upload max file size hardcoded to 50 MB
**Files:** `App.tsx`, `MediaTab.tsx`  
Could be a server-reported or admin-configured setting. Would align with WordPress `upload_max_filesize`.

### E-5. Modal "About this Campaign" heading hardcoded
**File:** `src/components/Campaign/CampaignViewer.tsx` L183  
Important for white-label deployments. Could be a setting.

---

## F. INFRASTRUCTURE & CONFIG

### F-1. Build target too conservative
**File:** `vite.config.ts` L25  
`target: 'es2015'` while tsconfig targets `ES2020`. Using `es2020` reduces output size (no unnecessary polyfills for `??`, `?.`, etc.).

### F-2. Function test coverage threshold low
**File:** `vite.config.ts` L55  
`functions: 60` — well below the 80% line/statement thresholds. Raise to 70+.

### F-3. ESLint missing strict rules
**File:** `eslint.config.js`  
No `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-explicit-any`, `eslint-plugin-jsx-a11y`, or import ordering.

### F-4. Inline `<script>` in embed lacks CSP nonce
**File:** `class-wpsg-embed.php` L134  
Sites using `Content-Security-Policy` with `script-src 'nonce-...'` will block the config injection. Use `wp_add_inline_script()`.

### F-5. Service worker cache grows unbounded
**File:** `public/sw.js`  
No total cache eviction strategy. Add LRU or max entry count.

---

## G. TEST COVERAGE GAPS

### Critical untested areas:

| Component/Hook | Usage | Risk |
|---|---|---|
| `useCarousel` | 8 consumers | **High** — core carousel logic |
| `useAdminSWR` | All admin tabs | **High** — data fetching layer |
| `ErrorBoundary` | App wrapper | **High** — error recovery |
| `useXhrUpload` | Media upload | **Medium** — file upload flow |
| `useOnlineStatus` | Reconnect UX | **Medium** — offline resilience |
| All 6 gallery adapters | Gallery rendering | **Medium** — visual output |
| `CampaignFormModal` | Admin CRUD | **Medium** — form validation |
| `CampaignCard` | Gallery display | **Medium** — card rendering |
| `LazyImage` | All tile adapters | **Medium** — progressive load |
| `AccessTab`, `AuditTab`, `CampaignsTab` | Admin panel | **Medium** — tab rendering |

---

## H. DOCUMENTATION STALENESS

| Doc | Issue |
|---|---|
| `TESTING_QA.md` L1 | Git merge artifact: `git pusnl#` |
| `FUTURE_TASKS.md` | "E1. SWR for AdminPanel" listed as future — completed in P13-C |
| `PHASE1_REPORT.md`, `PHASE3_REPORT.md`, `PHASE4_REPORT.md` | Broken links to `ARCHITECTURE.md` (moved to `docs/old/`) |
| `PHASE7_REPORT.md` | References `framer-motion` (removed from project) |
| `STYLING_GUIDE.md` | Describes Shadow DOM as "optional" — now default |
| `_tokens.scss` | TODO comment: "Phase 9 follow-up — migrate and delete" — Phase 9 done |

---

## Recommended Phase 14 Track Groupings

Based on the findings above, here are natural groupings for Phase 14:

| Track | Focus | Items | Effort |
|---|---|---|---|
| **14-A: Security Hardening** | A-1, A-2, A-3, B-1 through B-7 | 10 | Medium |
| **14-B: PHP Efficiency** | C-1, C-2, C-3, C-4, C-5, C-6, C-7, C-16 | 8 | Medium–High |
| **14-C: React DRY & Performance** | A-4, B-8, C-8 through C-15 | 10 | Medium |
| **14-D: Code Cleanup** | D-1 through D-12 | 12 | Low |
| **14-E: Admin UI Settings** | E-1 through E-5 | 5 | Low–Medium |
| **14-F: Test Coverage** | G (all untested items) | 10+ | Medium–High |
| **14-G: Config & Infra** | F-1 through F-5 | 5 | Low |
| **14-H: Doc Cleanup** | H (all stale docs) | 6 | Low |

---

*Generated from automated analysis — all findings verified against source code.*
