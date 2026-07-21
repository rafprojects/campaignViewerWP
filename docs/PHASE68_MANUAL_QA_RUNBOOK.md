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
