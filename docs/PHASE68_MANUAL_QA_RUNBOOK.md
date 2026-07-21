# Phase 68 — Manual QA & Validation Runbook

**Companion to:** [PHASE68_REPORT.md](PHASE68_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand — exact preconditions, steps, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test. It follows the format of [PHASE67_MANUAL_QA_RUNBOOK.md](PHASE67_MANUAL_QA_RUNBOOK.md).

**Scope:** tracks P68-A … P68-E. Unlike Phase 67 (a PHP-only code-quality phase), Phase 68 is **mostly front-end correctness** — the public campaign-fetch-and-render path (`src/App.tsx`, `src/services/*`, `public/sw.js`) plus one cross-side PHP change (P68-B gates a nonce in `class-wpsg-embed.php`). Verification therefore leans on the browser (devtools Network/Application panels) and the vitest suite rather than WP-CLI/PHPUnit, with WP-CLI used only to seed fixtures (e.g. >10 campaigns) and to observe the PHP side of P68-B.

**Golden rule (unchanged from P63–P67):** a fix's test is only meaningful if you have also seen it **fail without the fix**, or you understand precisely why the pre-fix code was wrong. Each section states the pre-fix behavior so a green result actually proves something. The cleanest way to watch these fail is to check out the commit **before** the track and re-run the same steps:

```bash
git log --oneline | grep -iE 'p68|phase68'    # find the P68 commits
git checkout <commit-before-the-track>         # e.g. the phase-67-archive commit fabfeafd
# …run a step, observe the pre-fix behavior…
git checkout feature/phase68-react-hardening-1-of-4   # back to the fixes
```

> **Front-end pre-fix note.** Because the front end is a built bundle, watching a FE fix "fail" means rebuilding (`npm run build`) or running the dev server (`npm run dev`) on the pre-fix checkout, not just swapping PHP files on the running wp-env. The vitest regression tests are the faster oracle for the FE tracks; the browser steps are the end-to-end confirmation.

---

## 1. Environment & personas

| Requirement | Why |
|---|---|
| Local `wp-env` dev site (`npx wp-env start` from repo root) | Standard test host. Base URL `http://localhost:8888`. Needed to seed campaigns and to serve the built app for P68-A/B end-to-end. |
| Node 20 toolchain (`npm ci`) | Run `npm run test`, `npm run build`, `npm run dev`, `npx tsc -b`, `npx eslint .`. |
| Browser with devtools (Network + Application/Service-Workers panels) | The SW cache (P68-B) and header presence are only observable in-browser. |
| WP-CLI via `npx wp-env run cli wp …` | Seed >10 campaigns (P68-A), toggle login state, inspect the emitted page config (P68-B). |
| `curl` (`-s`/`-i`), `jq` | REST assertions on the campaigns endpoint's pagination metadata. |

```bash
export BASE=http://localhost:8888
export AUTH='-u sysadmin:APP_PASSWORD'     # an Application Password for a System Admin
```

**Personas / auth.** Same RBAC model as Phase 63–67 — see **§2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md)** for creating a System Admin and minting an Application Password. Phase 68 additionally needs a **plain logged-out visitor** (just an incognito window, no auth) for P68-B and P68-C.

---

## 2. Mental model — what actually changed

| Track | The change | Observable? |
|---|---|---|
| P68-A | Public `fetchCampaigns` pages through the whole listing (`per_page=50` + `totalPages` loop) via a shared `fetchAllPages` helper, instead of taking only the server's default first 10 | **Yes** — a gallery/space with >10 campaigns now renders all of them |
| P68-D | `campaignLoadProgress` is driven by the real page loop (page N of M) instead of a synchronous 0→N flash; the counter only shows when the listing spans >1 page | **Yes (subtle)** — loading copy reflects genuine progress; single-page loads just show the spinner |
| P68-B | PHP stops emitting `restNonce` to anonymous visitors; the SW's anonymous stale-while-revalidate path becomes reachable for real traffic | **Yes** — no `X-WP-Nonce` on logged-out GETs; `META_CACHE` populates |
| P68-C | `permissions` digest added to the campaigns query key + a focus/visibility refresh of permissions | **Yes** — a mid-session access grant shows up on tab refocus without a full reload |
| P68-E | `handleResponse` tolerates an empty/204 2xx body instead of throwing a JSON parse error | **Latent** — no current endpoint returns 204, so the correct observation is "nothing regressed" |

---

## 3. Track-by-track

---

### P68-A — Public gallery listing pages through all campaigns (+ P68-D real progress)

**What & why.** `fetchCampaigns` ([src/App.tsx](../src/App.tsx)) requested `/campaigns?include_media=1` with no `per_page` and no page loop. The controller defaults `per_page` to 10 (max 50), so any space with **>10 campaigns silently showed exactly 10** — no error, no "load more" (`CardGalleryHostPagination` only slices the already-fetched client array; it never refetches). The fix pages through the whole listing with `per_page=50`, looping until the server's `totalPages` is exhausted (capped at `DEFAULT_MAX_PAGES = 20` ⇒ up to 1,000 campaigns/space), merging `items` and `mediaByCampaign` across pages. The loop is the shared `fetchAllPages` helper in [src/services/pagination.ts](../src/services/pagination.ts), now used by **both** `fetchCampaigns` and the admin selector's `fetchAllCampaignOptions` ([src/services/adminQuery.ts](../src/services/adminQuery.ts)) — one implementation, not two.

**P68-D folded in.** The same loop feeds `campaignLoadProgress` a real `{ completed: page, total: min(totalPages, maxPages) }` via `fetchAllPages`'s `onPage` callback, replacing the old synchronous `{0,N}`→`{N,N}` flash (the previous code set both values around a `.map()` with no `await`, so the counter could only ever render `0/N` for a frame or `N/N`). The loading copy now shows `(page X of Y)` **only when the listing spans more than one page** — single-page loads (the common case, ≤50 campaigns) just show the spinner + "Loading campaigns…".

**Pre-fix behavior.** A space with 15 campaigns rendered 10; the 11th–15th were unreachable in the public gallery. The loading alert's `(0/15 processed)` counter flashed for a single frame then jumped to `(15/15 processed)`.

**Primary proof — a >10-campaign space renders all of them.**

```bash
# Seed 15 public campaigns in one space (space id 1 assumed; adjust as needed).
for i in $(seq 1 15); do
  npx wp-env run cli wp post create --post_type=wpsg_campaign \
    --post_title="P68A Campaign $i" --post_status=publish --porcelain \
    --meta_input="$(printf '{"visibility":"public","_wpsg_space_id":1}')" >/dev/null
done

# Confirm the REST endpoint reports >1 page at the default per_page=10…
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/campaigns" | jq '{total, totalPages, returned: (.items|length)}'
# → total ≥ 15, totalPages ≥ 2, returned 10   (this is the server default the old FE stopped at)

# …and that per_page=50 returns them all in one page:
curl -s $AUTH "$BASE/wp-json/wp-super-gallery/v1/campaigns?per_page=50" | jq '{total, totalPages, returned: (.items|length)}'
# → total ≥ 15, totalPages 1, returned ≥ 15
```

Then load the **public gallery** in a browser (the shortcode page) and confirm **all 15** cards render, not 10. To force the multi-page path through the FE loop itself (rather than relying on a single 50-wide page), temporarily seed **>50** campaigns, or in devtools throttle to observe the `(page 1 of 2)` → `(page 2 of 2)` copy.

**Expected (pass).** Every seeded campaign appears in the public gallery. With >50 campaigns, the loading alert shows a genuine `(page X of Y)` progression. **Why it proves the fix:** on the pre-fix bundle the same seeded site renders exactly 10 cards and the counter never shows real page progress. **Pitfall — the two `per_page` observations above are on the *REST* endpoint, not the FE**; they establish that the server always returned `total`/`totalPages` (it did — the FE type just never declared them). The actual FE fix is proven by the browser rendering all cards, and by the regression test below.

**Automated proof (faster oracle).**

```bash
npm run test -- src/services/pagination.test.ts src/App.test.tsx
```

- `pagination.test.ts` (new, 7 tests) pins the helper: single page when `totalPages` is 1/absent, walks every page in order, honors the `maxPages` cap, defaults the cap to `DEFAULT_MAX_PAGES`, and — the P68-D piece — reports genuine per-page `onPage` progress `[[1,3],[2,3],[3,3]]` (not a synthetic flash) and clamps the reported total to `maxPages`.
- `App.test.tsx` (new case *"pages through all campaigns when the listing spans multiple pages"*) mocks a 2-page listing (page 1 → "Campaign Page One", page 2 → "Campaign Page Two", both with `totalPages: 2`) and asserts **both** render and that exactly two list requests fire, with `page=1` then `page=2`. On the pre-fix code only "Campaign Page One" renders and only one request fires — the test fails, which is what makes it a real guard.

**Regression checks.** The existing admin campaign-selector coverage (`adminQuery.test.tsx`, `adminQuery.coverage.test.tsx`) passes unmodified after `fetchAllCampaignOptions` was refactored onto the shared helper — same IDs, same page walk, same cap (formerly the local `MAX_SELECTOR_PAGES = 20`, now `DEFAULT_MAX_PAGES = 20`). The existing App campaign-render tests pass because a `totalPages`-less mock response is treated as a single page (identical to old behavior). `npx tsc -b` and `npx eslint .` stay clean.

**Pitfalls.**
- **The admin campaigns *table* is untouched.** It already paged via `fetchAdminCampaigns` (`page`/`per_page` params) and its own pagination UI; P68-A only changes the *public* fetch and the *all-options selector* loop. Don't expect the admin table's page size to change.
- **`mediaByCampaign` merge across pages is collision-free** because campaign IDs are unique per page — if you ever see a campaign's media go missing on a multi-page load, that assumption (not the merge) is what to check.
- **The cap is real.** A space with >1,000 campaigns (20 pages × 50) will still truncate at the cap — this is the documented Follow-On Candidate (server-driven host pagination), not a P68-A regression.

---

### P68-B — Anonymous SW stale-while-revalidate becomes reachable (both-sides)

**What & why.** `public/sw.js` routes public metadata GETs into its stale-while-revalidate cache (`META_CACHE` + TTL stamping + FIFO eviction via `handleMetaRequest`) **only when** the request carries neither `X-WP-Nonce` nor `Authorization` (`isAuthenticated` gate, `sw.js:104-109`). But `class-wpsg-embed.php`'s `page_config_js()` emitted `restNonce => wp_create_nonce('wp_rest')` **unconditionally** — including for anonymous visitors — and `HttpTransportImpl.buildAuthHeaders()` attaches the nonce whenever `getNonce()` is truthy. So every request from the app carried `X-WP-Nonce`, `isAuthenticated` was always true, and the ~100-line anonymous SWR path never ran for real traffic. For a logged-out visitor that nonce authenticates user 0 — it provides nothing. **The fix:** PHP now omits `restNonce` from the page config for anonymous visitors (gate on `is_user_logged_in()`); the FE header drop then falls out naturally (`buildAuthHeaders` already guards `if (nonce)`), and `sw.js` needs no change — its gate simply starts being reached.

**Pre-fix behavior.** Every GET from the app — even a logged-out visitor's — carried `X-WP-Nonce`; `META_CACHE` never populated for anonymous traffic; the SWR code was dead-by-gating (the same failure shape as PHP A-1/A-2).

**Scope note — this is deliberately a PHP-only code change.** The FE required *no* edit: `buildAuthHeaders` already omits the header when `getNonce()` is falsy, and `WpNonceProvider.init()` already returns a `null` session (leaving `isAuthenticated` false) when there's no nonce — so for anonymous visitors it now short-circuits to the same result *and skips a pointless `/permissions` fetch*. The FE work here is a regression **test**, not a code change.

**Primary proof — no `X-WP-Nonce` on a logged-out visitor's requests, and the SW cache populates.**

1. Open the public gallery in an **incognito/logged-out** browser window. Open devtools → **Network**.
2. Filter to the `wp-super-gallery/v1/` XHRs. Inspect the request headers of a `campaigns`/metadata GET.

**Expected (pass).** **No `X-WP-Nonce` request header** on any of the logged-out app's GETs. **Why it proves the fix:** on the pre-fix build the same requests all carry `X-WP-Nonce` (the guest nonce). Then confirm the SWR cache is now reachable:

3. devtools → **Application** → **Cache Storage** → look for the `META_CACHE` entry (name defined in `sw.js`). After loading a metadata endpoint once, it should contain the cached response; reload and confirm a stale-while-revalidate hit (instant paint, background refresh).

**Expected (pass).** `META_CACHE` populates for the logged-out session; pre-fix it stays empty because every request looked authenticated. **Pitfall — service-worker caching:** the SW itself is served `no-cache` (see `maybe_serve_service_worker`), but an *already-registered* old SW can linger. In devtools → Application → Service Workers, tick **Update on reload** (or Unregister + hard-reload) before testing, or you may be exercising the pre-fix SW logic against the post-fix headers.

**Confirm the logged-in path is unaffected.**

4. Log in as a real user, reload the gallery, inspect the same GETs.

**Expected (pass).** Logged-in requests **still carry `X-WP-Nonce`**, and the SW treats them as authenticated (they bypass `META_CACHE`). **Why it matters:** the gate must only drop the nonce for genuinely anonymous sessions.

**Confirm login still works end-to-end (the one regression-risk edge).**

5. From a fully logged-out session (no nonce in the page config now), open the sign-in form and log in with valid credentials.

**Expected (pass).** Login succeeds. **Why it can't regress:** the login POST doesn't need a nonce — WP's `rest_cookie_check_errors` only enforces `X-WP-Nonce` once the request already carries a logged-in session cookie, which an anonymous login POST does not; and `WPSG_Auth_Controller::handle_cookie_login()` mints a **fresh** nonce server-side (`class-wpsg-auth-controller.php:261`) which `WpNonceProvider.login()` stores via `setWpNonce()`. So the guest nonce was never actually load-bearing for login. Confirm subsequent authenticated actions (e.g. opening the admin panel) work, proving the freshly-minted post-login nonce is in effect.

**PHP-side spot check (optional, scriptable).**

```bash
# Anonymous render omits restNonce; a logged-in render includes it.
npx wp-env run cli wp eval '
  wp_set_current_user(0);
  echo (strpos(WPSG_Embed::page_config_js(), "\"restNonce\"") === false ? "anon: omitted" : "anon: PRESENT") . "\n";
  $u = get_users(["role" => "administrator", "number" => 1]);
  wp_set_current_user($u[0]->ID);
  echo (strpos(WPSG_Embed::page_config_js(), "\"restNonce\"") !== false ? "logged-in: present" : "logged-in: MISSING") . "\n";
'
# → anon: omitted   /   logged-in: present
```

**Automated proof.**

```bash
npx vitest run src/services/http/HttpTransportImpl.test.ts     # FE: header omitted when getNonce()→undefined
# PHP (via the /php-testing skill, wp-env): WPSG_Embed_Test
#   test_render_shortcode_omits_rest_nonce_for_anonymous_visitor   (anonymous → no "restNonce")
#   test_render_shortcode_includes_rest_nonce_for_logged_in_user   (admin     → "restNonce" present)
```

- FE: `HttpTransportImpl.test.ts` gains *"omits X-WP-Nonce when the getNonce callback returns undefined (anonymous)"* — the exact runtime shape post-fix (the callback is wired but returns `undefined`). 22 tests green.
- PHP: `WPSG_Embed_Test` gains the two conditional-nonce tests above and relaxes `test_render_shortcode_includes_config_script` (which formerly asserted `restNonce` always present — now only asserts the config script emits, since the nonce is conditional). 18 tests / 30 assertions green.

**Regression checks.** No `sw.js` change (verify none crept in — its gate was already correct). No `HttpTransportImpl.ts`/`WpNonceProvider.ts` code change — only a test was added. The wp-admin Spaces/Assets renderers (`class-wpsg-asset-admin-renderer.php`, `class-wpsg-space-admin-renderer.php`) also call `page_config_js()`, but those pages are always logged-in, so the gate is a no-op there (nonce still emitted) — confirm the admin apps on those screens still authenticate.

**Pitfalls.**
- **Don't test P68-B with a warm pre-fix service worker** (see the Update-on-reload note above) — the single most common false result.
- **`useNonceHeartbeat`** (`src/hooks/useNonceHeartbeat.ts`) already no-ops when no nonce is present, so it simply stops running for anonymous visitors — confirm no console errors, but there's nothing to change there.

---

### P68-C — Mid-session permission changes refresh the campaigns view (scope expanded)

**What & why.** The campaigns query key (`src/App.tsx`) included `user?.id`, `isAuthenticated`, and the admin flag, but **not** `permissions` — while `fetchCampaigns` uses `permissions` to decide which campaigns' media to expose per item. If a viewer's grants changed mid-session (an access request approved elsewhere), the cached query kept the old access mapping until a full reload. **Scope expansion (Key Decision C):** verification found `AuthContext` had *no mid-session permissions-refresh path at all* — `permissions` was set only once at mount and once at login (no polling/focus/websocket). So the digest-in-query-key fix alone was necessary but not sufficient to make the acceptance criterion ("approving access mid-session updates the view without reload") literally true — nothing would ever change `permissions` for it to react to. The fix therefore has **two** parts: (1) a stable `permissionsDigest(permissions)` in the campaigns query key, and (2) a window-focus/`visibilitychange` listener in `AuthContext` (gated on an authenticated `user`) that re-hydrates permissions from the provider when the tab regains focus — the natural "user came back after approving access elsewhere" signal.

**Pre-fix behavior.** A viewer whose access was granted in another tab/session saw no change in their gallery — the same campaigns' media stayed hidden — until they hard-reloaded the page.

**Important mechanism note.** `provider.getPermissions()` returns a *cached* value (both providers), so the refresh re-runs `provider.init()` (which re-hits `/permissions` for the default `WpNonceProvider`) and then reads `getPermissions()`/`getUser()`. The JWT provider caches permissions in localStorage without expiry (the known, deferred B-4 finding) — so on the opt-in JWT path this focus refresh is a no-op until that separate rework lands. The default cookie+nonce deployment refreshes correctly.

**Primary proof — a grant approved elsewhere appears on tab refocus, no reload.**

1. Log in as a **viewer** with access to campaign A but not campaign B. Load the public gallery; confirm B's media is hidden/locked.
2. In a **separate** admin session (another browser/profile), approve the viewer's access request for campaign B (Admin → Pending Requests).
3. Return to the viewer's tab — click into it / alt-tab back so it regains focus.

**Expected (pass).** Campaign B's media becomes visible in the viewer's gallery **without a manual reload**, within one refetch of regaining focus. **Why it proves the fix:** pre-fix, the viewer's `permissions` never updated mid-session and the campaigns query key never changed, so the view stayed stale until reload. **Pitfall — staleTime:** the campaigns query has a 5s `staleTime`; the refetch fires when the digest in the key changes (a genuinely new grant), which bypasses staleTime because it's a *new* key, not a refetch of the same one. If B still looks locked, confirm the grant actually landed server-side (`GET /permissions` for that viewer should now include B's id).

**Confirm no wasteful churn for the unchanged case.**

4. With no grant change, click away from the viewer's tab and back several times.

**Expected (pass).** No campaigns refetch fires on a plain refocus when permissions are unchanged. **Why:** the digest is order-independent and the `AuthContext` refresh bails out (returns the previous state reference) when the re-hydrated permissions/user are content-identical, so the query key is byte-stable and React Query doesn't refetch. **Pitfall:** open the Network panel and watch for `/permissions` + `/campaigns` calls — a `/permissions` probe on refocus is expected (that's how we detect a change) but a `/campaigns` refetch should **not** follow unless the grant set actually changed.

**Automated proof.**

```bash
npx vitest run src/contexts/AuthContext.test.tsx src/services/auth/AuthProvider.test.ts
```

- `AuthContext.test.tsx` gains: *"re-hydrates permissions when the tab becomes visible again"* (fires `visibilitychange`, asserts `init()` runs a second time and the grant set grows `['1'] → ['1','2']` in the UI without a reload) and *"does not refresh on visibility change for an unauthenticated visitor"* (guest never subscribes the listener; `init` stays at one call).
- `AuthProvider.test.ts` (new) pins `permissionsDigest`: order-independence, distinctness, empty-list stability, and the separator guard (so `['1','2'] ≠ ['12']`).

**Regression checks.** Full FE suite green (the campaigns query-key shape changed — every `<App>`-rendering test still passes because the added digest is `''` for their empty-permissions fixtures). `tsc`/`eslint` clean.

**Pitfalls.**
- **Don't gate the refresh on anything but `user`.** Gating on `isAuthenticated` (derived from `user`) is equivalent; the point is it must not run for anonymous visitors (they'd have no session to re-detect and would just burn a request).
- **Overlapping events.** `focus` and `visibilitychange` can both fire on a single tab-return; the handler has an in-flight guard so they coalesce into one refresh — if you ever see a double `/permissions` probe per refocus, that guard has been broken.

---

### P68-E — `handleResponse` tolerates an empty/204 success body

**What & why.** `HttpTransportImpl.handleResponse` ended with an unconditional `return response.json()`. An endpoint typed `Promise<void>` (e.g. `deleteCampaignTemplate`) or any future 204/empty-body 2xx would reject with a JSON parse error **despite the request succeeding**. The fix returns `undefined` when the response is a 204 or carries `Content-Length: 0`, and otherwise still parses JSON — so a genuinely malformed body from a data-returning endpoint is still surfaced as an error rather than silently swallowed.

**Pre-fix behavior.** Latent — current WP controllers always return a JSON body, so nothing triggers it today. It's contract fragility, not a live bug; the correct manual observation is "nothing regressed."

**This is a latent-hardening fix — the automated test is the real proof.** There is no current endpoint that returns 204, so there is no hand-QA script that exercises it without fabricating a response. Rationale in place of steps: the meaningful check is the unit test below plus confirming existing JSON-returning endpoints are unaffected (which the full suite pins).

```bash
npx vitest run src/services/http/HttpTransportImpl.test.ts
```

- New tests: *"resolves with undefined for a 204 response without calling json()"*, *"resolves with undefined for a 200 with Content-Length: 0"*, and *"still parses JSON for a normal 2xx body (no regression)"*. The first two also assert `json()` is **not** called (so no parse attempt on an absent body); the third guards against over-broad short-circuiting.

**Regression checks.** Whole transport suite green (22 → 25 tests); every domain module that goes through `handleResponse` is unaffected because the guard only triggers on an explicit 204 / `Content-Length: 0`. **Pitfall:** a chunked 2xx response with no `Content-Length` header and a real body still parses normally — the guard deliberately does **not** treat a missing length header as empty, so streaming/large responses aren't mis-handled.

---

## 4. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P68-A | A space with >10 campaigns renders all of them (public gallery) | `pagination.test.ts` + `App.test.tsx` multi-page case green; admin selector suites unmodified | ☐ |
| P68-D | Loading copy shows genuine `(page X of Y)` on multi-page loads; spinner-only on single-page | `pagination.test.ts` `onPage` progress asserts | ☐ |
| P68-B | Logged-out GETs carry no `X-WP-Nonce`; `META_CACHE` populates; login still works | `WPSG_Embed_Test` (anon omits / logged-in includes) + `HttpTransportImpl.test.ts` green; no `sw.js`/transport code change | ☐ |
| P68-C | A grant approved elsewhere appears on tab refocus, no reload; no refetch when unchanged | `AuthContext.test.tsx` focus-refresh + `AuthProvider.test.ts` digest green; full FE suite green | ☐ |
| P68-E | Simulated 204/empty 2xx resolves `undefined` without a parse error | `HttpTransportImpl.test.ts` 204 cases green; existing JSON endpoints unaffected | ☐ |

**Automated baseline (must be green alongside manual QA):** full FE vitest suite (**243 files / 3707 tests** at Batch 3), `npx tsc -b` clean, `npx eslint .` clean; PHP `WPSG_Embed_Test` (18 tests / 30 assertions) green via the `/php-testing` wp-env path. See [PHASE68_REPORT.md](PHASE68_REPORT.md) → each track's *Implementation* block for the per-track rationale and the line-citation corrections surfaced during execution.

---

## 5. Review-pass sign-off (PR #82, 2026-07-21)

A post-implementation PR review over the branch commits (P68-A/D `84a7e036`, P68-B `8c4ca9c1`, P68-C/E `25246535`) found **no open review threads** and required **no code changes** — every track was verified correct against source. The full rationale is in [PHASE68_REPORT.md](PHASE68_REPORT.md) → *PR Review & Validation Pass*. This section records what the reviewer re-ran so the result is reproducible.

**Automated re-validation (all green, no source changed):**

```bash
npx tsc -b                                                    # → exit 0
npx eslint src/services/pagination.ts src/App.tsx \
  src/services/adminQuery.ts src/contexts/AuthContext.tsx \
  src/services/auth/AuthProvider.ts \
  src/services/http/HttpTransportImpl.ts                      # → exit 0
npx vitest run src/services/pagination.test.ts src/App.test.tsx \
  src/contexts/AuthContext.test.tsx \
  src/services/auth/AuthProvider.test.ts \
  src/services/http/HttpTransportImpl.test.ts                 # → 55/55 green

# PHP (wp-env /php-testing path):
npx @wordpress/env run tests-cli \
  --env-cwd=wp-content/plugins/wp-super-gallery \
  php vendor/bin/phpunit --filter WPSG_Embed_Test             # → OK (18 tests, 30 assertions)
```

> **wp-env gotcha (surfaced this pass):** invoking `vendor/bin/phpunit` directly on the `tests-cli` container fails with `exec: "vendor/bin/phpunit": permission denied` (exit 126). Prefix it with `php` (`php vendor/bin/phpunit …`) — the wrapper script's exec bit isn't honored through `wp-env run`.

**Key source assumption confirmed during review** (worth re-checking if P68-A ever appears to under-fetch): the public `include_media` listing really does return `totalPages`, at [class-wpsg-campaign-controller.php:471](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php#L471) (`'totalPages' => (int) $query->max_num_pages`). If that field is ever dropped from the response, `fetchAllPages` silently collapses to a single page and the A-1 truncation returns — this is the single load-bearing server contract behind the fix.

**Accepted observations (logged, deliberately not "fixed"):**

| # | Observation | Why it's acceptable |
|---|-------------|---------------------|
| 1 | `fetchAllPages` truncates at `DEFAULT_MAX_PAGES × 50 = 1,000` campaigns/space with no user-facing signal | Documented Follow-On (server-driven host pagination); 100× the original 10-cap, out of scope for this phase |
| 2 | The P68-C focus refresh fires a `/permissions` round-trip on every tab refocus for logged-in users | Intended detection signal; the digest bail-out guarantees it never triggers a `/campaigns` refetch unless grants actually changed |

**Sign-off:** ☐ Review-pass automated re-validation green (tsc / eslint / affected vitest / `WPSG_Embed_Test`) · ☐ No source diff introduced by the review · ☐ Observations 1–2 acknowledged
