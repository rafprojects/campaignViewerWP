# Phase 50 — PR Review: `feat/phase50-adapters-and-spaces`

**Reviewer:** Claude (Opus 4.8)
**Created:** 2026-06-13
**Branch:** `feat/phase50-adapters-and-spaces`
**Scope:** 16 commits, ~7.5k LOC across P50-A…K — cross-space campaign move, per-space asset library, Stacked/Deck + Isotope adapters, Service Worker metadata caching, shared-package extraction, Layout Builder menu bar + asset-layer parity, and the `overlay`→`asset` rename.

## Verification

| Check | Result |
|-------|--------|
| `tsc -b --noEmit` | ✅ clean |
| Frontend suite (`vitest run`) | ✅ 2309 passed / 167 files |
| PHP suite (PHPUnit, wp-env) | ✅ 951 passed, 2 skipped |
| `overlay`→`asset` rename | ✅ no dangling production references to `WPSG_Overlay_Library` / `overlay-library` / `get_overlays_table` |

**Overall:** Strong, well-tested work. Migrations are idempotent and guarded, the SVG sanitizer carries over intact, REST authorization on the new endpoints is sound, and the rename is clean. Findings below are mostly correctness/robustness edges — none block merge, but #1 and #2 warrant a decision before shipping.

---

## 🟠 Medium

### 1. Service Worker SWR also intercepts the **admin** campaign list — stale data after mutations

**File:** `public/sw.js` — contradicts Key Decision D (*"admin SPA routes and all mutation endpoints remain network-first"*).

`META_ENDPOINT_RE = /…\/campaigns(\/\d+\/media)?$/` is tested against `url.pathname`, which **excludes the query string**. The admin list fetches in `src/services/adminQuery.ts:280` and `:302` hit `/wp-json/wp-super-gallery/v1/campaigns?…&include_archived=true` — same pathname — so they now go through stale-while-revalidate too.

**Impact:** After an admin creates / archives / **moves** a campaign, React Query invalidates and refetches → the SW returns the *stale* cached list immediately and only revalidates in the background (no push to the page). The admin sees outdated data until a *subsequent* fetch. This includes the move feature shipped in this same branch — a moved campaign can still appear in its old space in the admin UI.

**Suggested fix:** Bypass the meta cache for authenticated requests, e.g. short-circuit `handleMetaRequest` when `request.headers.has('X-WP-Nonce')`, or otherwise gate the regex to the public read shape.

### 2. Cross-space move transaction relies on an **implicit InnoDB** engine

**File:** `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php` — `move_campaign_to_space()`.

None of the campaign-scoped tables specify `ENGINE=InnoDB` (no `CREATE TABLE` in the file sets an engine — all rely on the server default). The move's safety claim is "all five writes are atomic; on failure we ROLLBACK." On a MyISAM default, `START TRANSACTION`/`ROLLBACK` are silent no-ops, so a mid-move failure leaves a **partial move** — the exact isolation corruption the design says it prevents. The four custom tables + `$wpdb->postmeta` also form a mixed-engine transaction even when the custom tables are InnoDB.

Low probability on modern MySQL/MariaDB (InnoDB default), but the guarantee is currently unverified — the passing rollback test runs on InnoDB so it doesn't exercise the risky path.

**Suggested fix:** Force `ENGINE=InnoDB` on at least the four campaign-scoped tables, or document the assumption explicitly.

---

## 🟡 Low

### 3. `Service-Worker-Allowed: /` is documented but never actually sent

**Files:** `wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php` — `maybe_serve_service_worker()`; `src/main.tsx`.

The docblock and the `main.tsx` comment both claim the SW is served *"with Service-Worker-Allowed: /"*, but the handler only sets `Content-Type`, `Cache-Control`, and `X-Content-Type-Options`. It works today only because the script is served at the root path (`/sw.js`), so default scope is already `/`. Either add the header or correct both comments — as written it misleads maintainers and would break if anyone registers with an explicit broader scope.

### 4. SW eviction is FIFO, not LRU; budget doesn't match the spec

**File:** `public/sw.js` — `evictOldestMetaEntries`.

The comment claims an "LRU approximation," but `Cache.put` of an existing key doesn't reliably move it to the tail, so it's FIFO. Key Decision D also specifies *"5 MB per space, LRU eviction"*; the implementation is a 50-entry global cap. Functionally fine — align the doc/comment with reality (or implement true LRU if it matters).

### 5. `SHOW TABLES LIKE` doesn't escape the prefix wildcard

**File:** `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php` — `maybe_rename_overlays_to_assets_v14()`.

`"SHOW TABLES LIKE '{$old}'"` leaves the `_` in the WP prefix as a LIKE single-char wildcard. The `=== $old` equality guard makes false positives harmless (rename only proceeds on an exact match), so this is a correctness nit, not a vuln. Use `$wpdb->esc_like()` for precision.

### 6. shared-utils tests are stranded in the app tree

The sources moved to `packages/shared-utils/src/`, but their tests stayed at `src/lib/cssUnits.test.ts` (etc.), now importing from `@wp-super-gallery/shared-utils`. The package ships without co-located tests. Consider moving them into the package so it is self-contained.

### 7. `move_campaign` audit `from_space_id: 0` for pre-backfill campaigns

**File:** `wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php` — `move_campaign()`.

The handler reads the source from raw `get_post_meta` (→ 0 when absent), while `require_campaign_space_move` (in `class-wpsg-rest-base.php`) resolves the same case to the default space id. Cosmetic inconsistency in the audit record only.

---

## ⚪ Pre-existing (noticed in passing — not introduced by this branch)

### 8. Unconditional `console.log` of DOM info in production

**File:** `src/main.tsx:353-354` (blamed to Phase 10).

These log mount/element info **without** the `import.meta.env.DEV` guard that the neighboring logs use. Trivial to gate while in this file. Candidate for Phase 51 cleanup.

---

## ✅ Verified solid

- New REST authorization (`require_campaign_space_move`, `require_space_owner`/`require_space_member` on the library routes) correctly reuses P47-B level resolution; the `manage_options` bypass and delegated-target 403 fall out naturally.
- `effectiveLevel` added to `format_space` is **safe** — the spaces-list transient key includes `$user_id` (`class-wpsg-space-controller.php:172`), so no cross-user leak.
- SVG sanitizer (dependency pre-flight, double-pass CSS/URI scrub, `.htaccess` CSP) carried over fully intact in the renamed `WPSG_Asset_Library`.
- All schema migrations are column/table-existence guarded and idempotent.
- `GraphicLayerContent` routes all CSS through the existing sanitized helpers (`sanitizeClipPath`, `buildFilterCss`); inline-style values can't break out into new declarations.

---

## Recommendation

Address **#1** before shipping (it undermines the move feature this branch ships) and make a call on **#2**. The remaining items (#3–#8) are comfortable Phase 51 candidates.
