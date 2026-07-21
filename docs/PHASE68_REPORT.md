# Phase 68 - React Correctness: Listing, Freshness & SW Cache Fixes

**Status:** In progress — Batch 1 (P68-A + P68-D) and Batch 2 (P68-B) done; P68-C, P68-E pending
**Created:** 2026-07-14
**Last updated:** 2026-07-21

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P68-A | Public gallery listing is silently capped at 10 campaigns | ✅ Done | Small-Medium |
| P68-B | Anonymous SW stale-while-revalidate is unreachable (nonce sent unconditionally) — both-sides | ✅ Done | Small-Medium FE + Small PHP |
| P68-C | Permission changes mid-session don't refresh the public campaigns query (scope expanded — see Key Decision C) | Planned | Small-Medium |
| P68-D | Campaign load progress indicator never shows intermediate progress | ✅ Done (folded into P68-A — see Key Decision D) | Small |
| P68-E | `handleResponse` assumes every 2xx body is JSON | Planned | Small |

---

## Rationale

The 2026-07-13 full React review ([REACT_REVIEW_FINDINGS.md](REACT_REVIEW_FINDINGS.md)) found the front end in excellent shape overall (`tsc`/`eslint` clean, one intentional `dangerouslySetInnerHTML` behind DOMPurify, server remains authoritative for every client-side gate) — but flagged one real data-loss-shaped bug and a cluster of query/cache-freshness gaps, all independently re-verified against current source on 2026-07-14 with zero disputes.

1. **What triggered it.** A-1 (10-campaign cap) is the single highest-impact finding across both the PHP and React reviews combined — any gallery site with more than 10 campaigns per space silently shows an incomplete listing with no error and no "load more." A-2 repeats the exact PHP A-1/A-2 failure shape (a well-built subsystem made inert by its own gate) on the front end: a carefully constructed service-worker SWR cache that never executes because the app always sends an auth-looking header.
2. **Why it belongs together.** All five items live in the same two files (`App.tsx`'s `fetchCampaigns`/query-key logic, `HttpTransportImpl.ts`) or their direct dependency (`sw.js`) — the public campaign-fetch-and-render path, end to end.
3. **Success.** A gallery with any number of campaigns renders all of them; anonymous visitors actually get the offline/latency benefit the service worker was built for; the campaigns query reflects permission changes without a hard reload; the loading UI doesn't lie about progress; the transport layer doesn't crash on a legitimate empty-body success response.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | A-1 fix shape | Follow the review's preferred direction: pass `per_page=50` and loop `totalPages`, mirroring the existing `fetchAllCampaignOptions` pattern in `src/services/adminQuery.ts` (already verified to loop pages correctly up to `MAX_SELECTOR_PAGES`) — extract that loop as a shared helper rather than duplicating it a third time. Full server-side `CardGallery` host-pagination wiring is a larger change and is not required to fix the data-loss bug; treat as a Follow-On Candidate if product wants true infinite/paged public browsing later. **As implemented (2026-07-21):** helper extracted to `src/services/pagination.ts` as `fetchAllPages(fetchPage, { maxPages, onPage })` returning the raw per-page responses so each caller merges its own shape; the former `MAX_SELECTOR_PAGES = 20` is now `DEFAULT_MAX_PAGES = 20` in that module. Also widened `App.tsx`'s local `ApiCampaignResponse` to declare `total`/`totalPages`, which the server (`class-wpsg-campaign-controller.php:466-472`) already returns — it was simply undeclared, which is why the caller never paged. |
| B | A-2's PHP-side change | This finding is cross-side (front-end SW + `class-wpsg-embed.php`) and originated in this review rather than the PHP one, so it has no existing home in Phases 63–67 — it's scoped entirely within P68-B below rather than requiring a PHP-phase edit. Chosen direction: gate `restNonce` injection in `page_config_js()` (the `restNonce` assignment is at `class-wpsg-embed.php:74`) on `is_user_logged_in()` rather than adding a new "was a session actually detected" signal on the FE `WpNonceProvider` — smaller surface, and the login-form flow already re-derives its own nonce independently (verified 2026-07-21: `handle_cookie_login` mints a fresh nonce server-side at `class-wpsg-auth-controller.php:261`; and WP's `rest_cookie_check_errors` only enforces `X-WP-Nonce` once the request already carries a session cookie, so an anonymous login POST isn't blocked by having no nonce to send). |
| C | P68-C scope (new, 2026-07-21) | **Expand scope.** Verified `AuthContext.tsx`'s `permissions` state has *no* mid-session refresh path today (set once on mount + once on `login()` only). The review's original digest-in-query-key fix is necessary but not sufficient to make its own acceptance criteria true. Add a window-focus/`visibilitychange` listener (gated on `isAuthenticated`) that re-calls `provider.getPermissions()` on tab refocus, **on top of** the query-key digest. |
| D | P68-D scope & sequencing (new, 2026-07-21) | **Make it real, fold into P68-A.** Since P68-A already builds a genuine page-by-page loop, feed `campaignLoadProgress` real `{ completed: page, total: min(totalPages, maxPages) }` from `fetchAllPages`'s `onPage` callback instead of the synchronous 0→N flash. Delivered as part of P68-A's commit; the loading counter now shows only when the listing spans >1 page. |

## Execution Priority

Formalized into batches for the executing agent (D folded into A, so four units not five):

1. **Batch 1 (do first, isolated): P68-A** (includes P68-D's real-progress wiring). ✅ Done 2026-07-21. Highest impact; touches `App.tsx`'s `fetchCampaigns`/`campaignsKey` region and adds `src/services/pagination.ts`, consumed by both `App.tsx` and `adminQuery.ts`. Landed and verified before anything else touches this region.
2. **Batch 2 (independent, both-sides — land PHP + FE together): P68-B.** `class-wpsg-embed.php` + `HttpTransportImpl.ts` + `WpNonceProvider.ts`; `sw.js` needs no edit (its gate reacts naturally once the header stops being sent). Do not split PHP/FE across commits.
3. **Batch 3 (independent, small — after Batch 1): P68-C + P68-E.** P68-C touches `App.tsx`'s `campaignsKey` (the region Batch 1 restructured) + `AuthContext.tsx`; P68-E touches only `HttpTransportImpl.ts`'s `handleResponse` (independent of P68-B's `buildAuthHeaders` in the same file). Sequenced after Batch 1 to avoid overlapping `App.tsx` query-key edits.

Batches 2 and 3 may run in either relative order; Batch 1 is fixed first.

---

## Track P68-A - Public gallery listing is silently capped at 10 campaigns

*Source: REACT_REVIEW_FINDINGS.md § A-1 — re-verified 2026-07-14, confirmed accurate, including that `ApiCampaignResponse`'s type doesn't even declare `total`/`totalPages` fields (so the caller can't easily notice it's being handed a partial result), and that `fetchAllCampaignOptions` (`src/services/adminQuery.ts`) already implements the correct all-pages loop pattern.*

### Problem

The public campaign fetch in `fetchCampaigns` (`src/App.tsx`) requested `/campaigns?include_media=1` with no `per_page` and no page loop. The PHP controller defaults `per_page` to 10 (max 50) — `class-wpsg-campaign-controller.php:400` (moved from ~202 by the P67 `build_campaign_cache_key`/`build_campaign_query_args` extraction, commit `10c9bf38`) — and the response's `total`/`totalPages` fields (returned at `class-wpsg-campaign-controller.php:466-472`) were ignored by the caller, whose local `ApiCampaignResponse` type didn't even declare them. `CardGalleryHostPagination.tsx` only slices the already-fetched, client-side array for its pagination modes (paginated/load-more/show-all) — it never triggers a server refetch (verified: no `ApiClient`/`fetch`/`useQuery` import in the file). Any site or space with more than 10 campaigns silently showed exactly 10, with no error and no "load more" affordance. The admin panel is unaffected — its query layer already passes `page`/`per_page` and has a working capped all-pages loop in `fetchAllCampaignOptions`.

### Fix

Per Key Decision A: pass `per_page=50` and loop `totalPages` in `fetchCampaigns`, following the same pattern as `fetchAllCampaignOptions`. Extract that loop as a shared helper (`fetchAllPages(fetchPage, { maxPages, onPage })`) used by both call sites instead of a third copy.

### Implementation (landed 2026-07-21)

- **New `src/services/pagination.ts`** — `fetchAllPages<TResponse extends PagedResponse>(fetchPage, { maxPages?, onPage? })` walks pages 1..N until `totalPages` is exhausted or `maxPages` (default `DEFAULT_MAX_PAGES = 20`) is hit, returning the raw per-page responses so each caller merges its own fields. `onPage(completed, total)` reports genuine progress with `total` clamped to `min(totalPages, maxPages)`.
- **`src/App.tsx`** — `fetchCampaigns` now calls `fetchAllPages` with `include_media=1&per_page=50&page=N`, flat-maps `items`, merges `mediaByCampaign` across pages (collision-free — unique campaign IDs per page), and drives `campaignLoadProgress` from `onPage` (P68-D). Local `ApiCampaignResponse` widened with optional `total`/`totalPages`. The synchronous end-of-map progress set was removed.
- **`src/services/adminQuery.ts`** — `fetchAllCampaignOptions` refactored onto `fetchAllPages`; the local `MAX_SELECTOR_PAGES` constant removed (folded into the helper default). `fetchAdminCampaigns` (the admin table's single-page fetch) untouched.
- **Tests** — new `src/services/pagination.test.ts` (7 tests) pins the helper incl. the P68-D progress signal; new `App.test.tsx` case pins the >1-page render + two-request page walk. `npx tsc -b`, `npx eslint`, and the affected vitest files (41 tests) all green.

### Acceptance criteria

- A public gallery (or space) with more than 10 campaigns renders all of them, not just the first 10.
- No behavior change for sites with 10 or fewer campaigns.
- The extracted pagination-loop helper is used by both `fetchCampaigns` and `fetchAllCampaignOptions`.

### Validation

- New regression test with a >10-campaign fixture asserting all campaigns are returned/rendered.
- Existing admin-panel campaign-selector tests (which already exercise `fetchAllCampaignOptions`) stay green after the extraction.
- Manual: seed a dev site with 15+ campaigns in one space, load the public gallery, confirm all render.

---

## Track P68-B - Anonymous SW stale-while-revalidate is unreachable (both-sides)

*Source: REACT_REVIEW_FINDINGS.md § A-2 — re-verified 2026-07-14, confirmed accurate. Cross-side finding — see Key Decision B for why the PHP-side piece is scoped here rather than in Phases 63–67.*

### Problem

`public/sw.js` routes public metadata GETs to a carefully built SWR cache (`META_CACHE`, TTL stamping, FIFO eviction via `handleMetaRequest`/`stampResponse`/`evictOldestMetaEntries`) only when the request has no `X-WP-Nonce`/`Authorization` header (`isAuthenticated` check, `sw.js:104-106`). But `class-wpsg-embed.php:71` sets `restNonce => wp_create_nonce('wp_rest')` unconditionally in `page_config_js()` — for anonymous visitors too — and `HttpTransportImpl.buildAuthHeaders()` attaches the nonce whenever `getNonce()` returns truthy, with no auth-state check. Result: every request from the app carries `X-WP-Nonce`, `isAuthenticated` in the SW is always true, and the anonymous SWR path (~100 lines of already-working code) never executes for real app traffic. For a logged-out visitor, the nonce authenticates user 0 — it provides nothing, so sending it isn't even functionally necessary.

### Fix

*PHP* (`class-wpsg-embed.php`): only inject `restNonce` into the page config when `is_user_logged_in()` is true.
*Frontend* (`HttpTransportImpl.ts`, `WpNonceProvider.ts`): skip attaching the `X-WP-Nonce` header when no nonce is present (this falls out naturally once PHP stops sending one for anonymous sessions — no header to attach).

### Implementation (landed 2026-07-21)

- **`class-wpsg-embed.php`** — `restNonce` removed from the unconditional `$config` literal and re-added only inside `if ( is_user_logged_in() )`. Anonymous visitors' page config now has no `restNonce` key (the FE type already declares it optional, `vite-env.d.ts:34`).
- **Front-end: no code change needed.** `buildAuthHeaders` already guards `if (nonce)`, and `WpNonceProvider.init()` already returns a `null` session when `getWpNonce()` is falsy — so anonymous visitors short-circuit to the same `isAuthenticated=false` result *and skip a now-pointless `/permissions` fetch*. Verified the login flow is self-healing (`WPSG_Auth_Controller::handle_cookie_login()` mints a fresh nonce at `class-wpsg-auth-controller.php:261`; WP's `rest_cookie_check_errors` doesn't enforce a nonce on a cookieless anonymous POST). No `sw.js` change — its `isAuthenticated` gate (`sw.js:104-109`) simply starts being reached.
- **Tests** — PHP `WPSG_Embed_Test` gains `test_render_shortcode_omits_rest_nonce_for_anonymous_visitor` + `test_render_shortcode_includes_rest_nonce_for_logged_in_user`; `test_render_shortcode_includes_config_script` relaxed (no longer asserts `restNonce` unconditionally). FE `HttpTransportImpl.test.ts` gains the anonymous `getNonce()→undefined` header-omission case. PHP suite 18/30 green; FE transport suite 22 green.

### Acceptance criteria

- A logged-out visitor's requests carry no `X-WP-Nonce` header; the SW's anonymous SWR path is actually exercised for their traffic. ✅
- A logged-in visitor's requests are unaffected — nonce still sent, SW correctly treats them as authenticated. ✅ (gate is `is_user_logged_in()`; wp-admin renderers unaffected)
- The login form flow (which the review doc flags as currently relying on the guest nonce) continues to work — verify explicitly, since this is the one place a "no nonce for anonymous" change could regress something. ✅ (self-healing via fresh server-minted nonce; see runbook § P68-B step 5 for the manual end-to-end check)

### Validation

- New integration test asserting the SWR path is exercised for a simulated logged-out fetch (no nonce header present).
- Manual: log out, load a public gallery, inspect network requests to confirm no `X-WP-Nonce` header on GETs; confirm the SW cache actually populates (check `META_CACHE` in devtools Application panel); then test login still works end-to-end.

---

## Track P68-C - Permission changes mid-session don't refresh the public campaigns query

*Source: REACT_REVIEW_FINDINGS.md § A-4 — re-verified 2026-07-14, confirmed accurate.*

### Problem

The campaigns query key (`src/App.tsx:265-272`) includes `user?.id`, `isAuthenticated`, and an admin flag, but not `permissions` — while `fetchCampaigns` uses `permissions` (present in its own `useCallback` deps) to decide which campaigns' media to expose per item. If a viewer's grants change mid-session (e.g. an access request is approved elsewhere), the cached query data keeps the old access mapping until some unrelated key change or a full reload forces a refetch. The server response is itself permission-scoped, so this is a staleness bug, not a data leak.

### Fix

Include a stable digest of `permissions` (e.g. a sorted-join string) in the campaigns query key, or invalidate the campaigns query wherever `permissions` state is refreshed (likely `AuthContext.tsx`).

### Acceptance criteria

- Approving/changing a viewer's access mid-session updates their campaigns view without a full page reload.
- No unnecessary extra refetches for users whose permissions haven't changed (the digest/invalidation approach shouldn't cause query-key churn on every render).

### Validation

- Test: change a user's `permissions` array, assert the campaigns query key changes (or an invalidation fires) and refetches.
- Manual: approve an access request for a logged-in viewer in another tab/session, confirm their gallery view picks up the new access without reload.

---

## Track P68-D - Campaign load progress indicator never shows intermediate progress

*Source: REACT_REVIEW_FINDINGS.md § A-3 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`fetchCampaigns` (`src/App.tsx:237-263`) sets `{ total: N, completed: 0 }` and then immediately `{ total: N, completed: N }` after a fully synchronous `items.map(...)` (no `await` inside) — the `(completed/total processed)` copy in the loading alert (~line 439) can only ever render `0/N` for a single frame or `N/N`. It's a progress bar over a synchronous loop.

### Fix

Per Key Decision D — **resolved: make it real, folded into P68-A.** `campaignLoadProgress` is now fed by `fetchAllPages`'s `onPage` callback (`{ completed: page, total: min(totalPages, maxPages) }`), and the loading copy renders `(page X of Y)` only when `total > 1`; single-page loads show just the spinner + label.

### Implementation (landed 2026-07-21, as part of P68-A)

- Removed the synchronous `{total: N, completed: 0}` → `{total: N, completed: N}` writes around the `.map()`.
- Progress is driven per-page from the real loop; the loading alert at `src/App.tsx` gained the `campaignLoadProgress.total > 1` guard so the counter never appears for single-page loads.
- Pinned by `src/services/pagination.test.ts` (`onPage` reports `[[1,3],[2,3],[3,3]]` for a 3-page fetch; total clamped to `maxPages`). The exact DOM copy is intentionally not snapshot-tested — the meaningful assertion is that the progress signal reflects genuine async work, which lives in the helper test.

### Acceptance criteria

- The loading UI no longer displays a progress counter that can't reflect real progress; when the listing spans multiple pages it shows genuine page-N-of-M progress. ✅

### Validation

- Manual: seed >50 campaigns in one space (to force >1 FE page), load the public gallery, confirm the loading copy shows `(page 1 of 2)` → `(page 2 of 2)`; with ≤50 campaigns confirm only the spinner shows. See [PHASE68_MANUAL_QA_RUNBOOK.md](PHASE68_MANUAL_QA_RUNBOOK.md) § P68-A.

---

## Track P68-E - `handleResponse` assumes every 2xx body is JSON

*Source: REACT_REVIEW_FINDINGS.md § A-5 — re-verified 2026-07-14, confirmed accurate; the success branch has no try/catch at all (contrast with the error branch, which does).*

### Problem

`HttpTransportImpl.ts`'s `handleResponse` (~lines 126-147) ends with an unconditional `return response.json()`. Endpoints typed `Promise<void>` (e.g. `deleteCampaignTemplate`) or any future 204/empty-body response would reject with a JSON parse error despite the request succeeding. Latent today since current WP controllers always return JSON bodies.

### Fix

Guard on `response.status === 204` / empty `content-length` and return `undefined as T` in that case, or wrap the success-path `.json()` call in the same try/catch pattern already used on the error branch.

### Acceptance criteria

- A simulated 204/empty-body 2xx response resolves successfully with `undefined` rather than throwing a JSON parse error.
- No behavior change for existing JSON-returning endpoints.

### Validation

- Unit test: mock a 204 response, assert `handleResponse` resolves without throwing.
- Existing transport test suite stays green.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full server-driven `CardGallery` host pagination (true infinite/paged public browsing, not just "fetch everything up front") | P68-A's all-pages-loop fix resolves the data-loss bug without this larger UX change; revisit if a site's campaign count grows large enough that fetching all pages up front becomes its own performance concern. |

## Implementation Notes

- Record completed work here as tracks land; nothing executed yet.

## Outcome

Not started.
