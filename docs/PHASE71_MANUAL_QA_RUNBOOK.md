# Phase 71 — Manual QA & Validation Runbook

**Companion to:** [PHASE71_REPORT.md](PHASE71_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand — exact preconditions, commands, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test. It follows the format of [PHASE70_MANUAL_QA_RUNBOOK.md](PHASE70_MANUAL_QA_RUNBOOK.md), with the more content-surfaced [PHASE69_MANUAL_QA_RUNBOOK.md](PHASE69_MANUAL_QA_RUNBOOK.md) pattern borrowed for P71-E (a real behaviour/content change, not a pure refactor).

**Scope:** tracks P71-A … P71-E. Phase 71 is a **React efficiency + i18n-consistency sweep**. Four of the five tracks (A–D) are small, no-user-visible-behaviour query/cache-layer fixes; **P71-E is different** — it translates user-facing strings and adds an enforced lint gate, so it has a genuinely different verification shape (locale switch + a deliberately-introduced-violation test). This doc is built **incrementally as each track lands** — a section is added when the corresponding fix is committed, not all at once up front.

**Golden rule (unchanged from P63–P70):** a fix's test is only meaningful if you have also seen it **fail without the fix**, *or* you understand precisely why the pre-fix and post-fix code are behaviourally equivalent. For the efficiency tracks here the operative check is usually the first clause: each new automated test was confirmed to go **red on the pre-fix source** and green on the fix (recorded per-track below), because "fewer refetches / one instance" is only provable by counting against the pre-fix baseline. The cleanest way to watch a track fail by hand is to diff against the pre-phase commit:

```bash
git log --oneline | grep -iE 'p71|phase71'      # find the P71 commits
git checkout <commit-before-the-track>           # e.g. the Phase 70 archive commit
# …run the step / suite, observe the pre-fix behaviour…
git checkout feature/phase71-react-hardening-4-of-4   # back to the fixes
```

---

## 1. Environment & personas

| Requirement | Why |
|---|---|
| The Vitest suite (`npm test`) and type-checker (`npx tsc -b`) | The **primary** proof for the efficiency tracks (A–D) — each ships a test that counts refetches/instances against the pre-fix baseline. |
| Local `wp-env` dev site (`npx @wordpress/env start` from repo root) | Only needed for the *optional* live checks (DevTools Network for A/D, a settings save for B, an admin asset upload for C). Base URL `http://localhost:8888`. See the `project_phptest_wpenv_env` note: WSL nvm Node 20; use `npx @wordpress/env`. |
| Browser DevTools (Network panel) | P71-A (campaigns refetch count on reconnect), P71-B (settings save → no redundant GET), P71-D (uploads-dir revalidation). |
| A **production** build served through the shortcode, or `npm run dev` | For the optional live checks. P71-D's SW behaviour is only meaningful against a real service-worker registration (prod build / served app), not jsdom. |

**Personas / auth.** Unchanged from prior phases. The only track touching a privileged surface is P71-C (global-asset mutation hooks, admin-only) and P71-B's settings save (admin). See §2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md) for creating a System Admin and a `wpsg_editor`.

---

## 2. Mental model — what actually changed

| Track | The change | Observable at runtime? |
|---|---|---|
| P71-A | Deleted the manual `isOnline && isReady` effect in `App.tsx` that called `refetch()`; the campaigns query now relies solely on its own `refetchOnReconnect: true`. | **Yes (by network count)** — a reconnect while the query is fresh no longer fires an extra `/campaigns` request; the offline banner (`!isOnline`) is unchanged |
| P71-B | Removed the `invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })` in `useUpdateSettings`'s `onSuccess`; the normalized response is still written to cache via `setSettingsQueryData`. | **Yes (by network count)** — saving settings no longer schedules a redundant refetch of the just-written data |
| P71-C | The three global-asset mutation hooks (`useUploadGlobalAsset`/`useUpdateGlobalAsset`/`useDeleteGlobalAsset`) now `useMemo(() => new AssetsApi(apiClient), [apiClient])` instead of constructing a new instance every render. | No — `AssetsApi` is stateless; identical calls, identical results. Consistency/footgun fix only |
| P71-D | Uploaded media (`/wp-content/uploads/`) moved from the cache-first-forever runtime branch into a dedicated stale-while-revalidate cache (`wpsg-uploads-swr-v1`): served from cache immediately, revalidated in the background once older than 1h. Fonts/other static assets keep cache-first. | **Yes (eventually)** — an image edited under the same URL is refreshed for returning visitors after the TTL, instead of never |
| P71-E | *(section added when the track lands)* | — |

---

## 3. Track-by-track

---

### P71-A — No duplicate campaigns refetch on reconnect

**What & why.** The campaigns query set `refetchOnReconnect: true` **and** a manual effect (`useEffect(() => { if (isOnline && isReady) void mutateCampaigns(); }, …)`) refetched whenever `useOnlineStatus`'s `isOnline` flipped true. Both are ultimately driven by the same native `window` `online` event, so a reconnect fired **two** refetches. The manual effect also duplicated the query's own `enabled: isReady` initial fetch on mount. P71-A deletes the manual effect and keeps only `refetchOnReconnect: true`. `isOnline` is still read for the offline banner (`{!isOnline && …}`), so the `useOnlineStatus` hook and its import stay.

**Pre-fix behaviour.** A reconnect (offline → online) fired two `/campaigns?include_media=1` requests: React Query's `refetchOnReconnect` **and** the manual effect's unconditional `refetch()`.

**This track's meaningful check is the failure-first count — it was confirmed red on the pre-fix source.**

**Verification (primary — automated).**
```bash
npx vitest run src/App.test.tsx -t "P71-A"
npx tsc -b
```
The new test (`does not refetch the fresh campaign list on reconnect …`) renders `<App>`, waits for the initial (single) campaign-list load, then dispatches a `window` `offline` then `online` event **in separate `act()` blocks** and asserts the campaign-list request count is **unchanged**. The two transitions must be committed separately or React batches `false→true` into "no change" and `useOnlineStatus` never re-fires (documented in the test).

**Why it proves the fix.** The key asymmetry the test exploits: `refetchOnReconnect: true` **respects `staleTime`** (it skips a still-fresh query), whereas the deleted manual effect's `refetch()` was an **unconditional** refetch. Because the query was just loaded (fresh, `staleTime: 5000`), post-fix the reconnect produces **zero** extra requests; pre-fix the manual effect forced one. Confirmed empirically: with the manual effect restored the test reports `expected 2 to be 1` (red); with the fix it is green.

**Optional live check.** On the dev site, open DevTools → Network, filter `campaigns`, load a gallery, then toggle the "Offline" throttle on and back off within a few seconds. Confirm **no** new `campaigns?include_media=1` request fires on reconnect (the list is still fresh). Wait past `staleTime` (5s) and reconnect again → exactly **one** request (React Query's own `refetchOnReconnect`), never two.

**Regression checks.** Existing `App.test.tsx` cases (render, error banner, offline banner, paging, 401) pass unmodified — the offline banner still keys off `isOnline`, which is untouched. New: the P71-A test above.

**Pitfall.** Don't "verify" this with a mount-count assertion (render → count list fetches == 1). On mount React Query **dedupes** the manual effect's `refetch()` with the still-in-flight initial fetch, so a mount-count test is green *both* pre- and post-fix — hollow. The reconnect-while-fresh count is the only version that actually distinguishes the two. (This was caught during implementation: the first draft of the test used the mount count and passed against the pre-fix source, so it was replaced.)

---

### P71-B — Settings save doesn't refetch its own just-written data

**What & why.** `useUpdateSettings`'s `onSuccess` wrote the normalized server response into the cache with `setSettingsQueryData`, then immediately called `invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })`. Because `SETTINGS_QUERY_KEY` is `['settings']` and the real per-space keys are `['settings', baseUrl, spaceId]`, that invalidation **prefix-matched the entry just written** (plus every other space's), scheduling a refetch of the data the server had just returned. P71-B drops the `invalidateQueries` call — the canonical response is already in cache, there is one call site (`SettingsPanel.tsx`), and no code path mounts settings queries for more than one space at a time, so no scoped sibling invalidation is needed.

**Pre-fix behaviour.** Save settings → `setQueryData` (correct) → `invalidateQueries(['settings'])` → the active settings observer refetches → a redundant `getSettings` request.

**This track's meaningful check is the failure-first count — confirmed red on the pre-fix source.**

**Verification (primary — automated).**
```bash
npx vitest run src/services/settingsQuery.test.ts -t "P71-B"
npx tsc -b
```
The new test mounts an **active** settings observer (`useGetSettings`) alongside `useUpdateSettings` (an invalidation only refetches queries that have active observers), waits for the initial fetch, then saves and asserts `getSettings` is **still called exactly once** and the cache holds the saved values.

**Why it proves the fix.** With the active observer present, the pre-fix `invalidateQueries` produces an observable second `getSettings` call; post-fix there is none. Confirmed empirically: with the `invalidateQueries` line restored the test reports `expected "vi.fn()" to be called 1 times, but got 2 times` (red); with the fix it is green. The cache-content assertion additionally proves the save result survives (a refetch would have clobbered it back to the mock's defaults).

**Optional live check.** On the dev site as an admin, open DevTools → Network, filter the settings endpoint, and save the Settings panel. Confirm the `POST`/update request fires but is **not** followed by a redundant `GET` of the same space's settings.

**Regression checks.** Existing `settingsQuery.test.ts` cases (normalize, fetch+cache, update-writes-cache, space scoping) pass unmodified. New: the P71-B test above.

**Pitfall.** The invalidation was genuinely redundant *only because* `setSettingsQueryData` writes the canonical normalized response first. Do not remove or reorder that `setSettingsQueryData` call thinking the two are interchangeable — dropping **both** would leave the cache stale after a save. The fix removes exactly one line (the invalidation), nothing else.

---

### P71-C — Memoized `AssetsApi` in global-asset mutation hooks

**What & why.** `useUploadGlobalAsset`, `useUpdateGlobalAsset`, and `useDeleteGlobalAsset` each did `const api = new AssetsApi(apiClient)` directly in the hook body — a fresh instance every render, with `mutationFn` closing over the latest one. Harmless today (the class is stateless), but a footgun if `AssetsApi` ever gains state, and inconsistent with how every other facade instance is created (once per `apiClient` identity). P71-C wraps all three in `useMemo(() => new AssetsApi(apiClient), [apiClient])`.

**Pre-fix behaviour.** Same network calls, same results — only the number of throwaway `AssetsApi` allocations differed.

**This is a no-behaviour-change consistency fix — the meaningful check is equivalence, and stating that is the honest verification, not a hollow click-through.** There is no user-visible or network-visible difference to exercise: a stateless class produces byte-identical calls whether constructed once or per render.

**Verification (the whole proof).**
```bash
npx vitest run src/components/Admin/GlobalAssetManager.test.tsx src/services/api/assetsApi.test.ts
npx tsc -b
```
The existing global-asset mutation coverage passes **unmodified** — that is the proof the extraction changed nothing observable. `tsc -b` confirms the `useMemo` dependency (`[apiClient]`) types correctly. No new test is warranted: a test asserting "the same object identity is reused across renders" would test React's `useMemo`, not our code, and adds no signal about a stateless facade.

**Why it proves the fix.** The hooks' entire contract is "call `AssetsApi.upload/update/delete` and invalidate the asset-library query on success." Unchanged tests demonstrate that contract is intact; the only thing that changed is *how often* a stateless instance is allocated, which has no observable consequence.

**Optional live check.** None warranted for the reason above. If desired for peace of mind: as a System Admin, upload / edit tags / delete a global asset in the Layout Builder asset library and confirm each still works and the library refreshes — identical to pre-fix.

**Regression checks.** Existing `GlobalAssetManager.test.tsx` / `assetsApi.test.ts` pass without edits. New: none (see above).

**Pitfall.** The dependency array must be `[apiClient]`, not `[]` — an empty array would capture the first `apiClient` and never rebuild the facade if `apiClient`'s identity changes (e.g. a base-URL/nonce swap), silently talking to the wrong client. `[apiClient]` matches how `apiClient` is threaded everywhere else.

---

### P71-D — Stale-while-revalidate for uploaded media

**What & why.** `public/sw.js`'s default fetch branch served every same-origin non-hashed GET (fonts, favicon, **and** `/wp-content/uploads/` images) cache-first *forever* — an entry only changed when `CACHE_VERSION` bumped. So a WP-media image edited or regenerated under the same URL (media editor, thumbnail-regeneration plugins) rendered stale indefinitely for any returning visitor with a warm cache. P71-D routes only `/wp-content/uploads/` requests (matched by `UPLOADS_PATH_RE`) into a dedicated SWR cache (`UPLOADS_CACHE = 'wpsg-uploads-swr-v1'`) via `handleUploadsRequest`, mirroring the metadata cache's `x-wpsg-cached-at`/`stampResponse` mechanism: cached asset served immediately, background revalidation fired only when the entry is older than `UPLOADS_TTL_MS` (1 hour). Fonts and other static assets stay on the unchanged cache-first branch. `UPLOADS_CACHE` was added to the `activate` keep-set so it isn't swept.

**Pre-fix behaviour.** An uploads image, once cached, was returned from `RUNTIME_CACHE` on every subsequent request with no revalidation — a server-side edit under the same URL was never picked up until a `CACHE_VERSION` bump.

**This track's meaningful check is the failure-first SWR-flow test; the pre-fix branch has no revalidation path at all, so its "second request still serves NEW" assertion cannot hold pre-fix.**

**Verification (primary — automated).**
```bash
npx vitest run src/test/swUploads.test.ts
npx tsc -b
```
Because `sw.js` is a standalone non-module file (not importable), the test **replicates** the constants + `handleUploadsRequest`/`isCacheableUpload`/`evictOldestUploadEntries` and exercises them against a mock Cache/fetch/event — the exact pattern `swMeta.test.ts` established. **Keep the two in sync** (the test header says so). The key case (`serves the stale asset immediately, then revalidates …`) seeds a stale (`> TTL`) `OLD` entry, asserts the first request returns `OLD` *and* starts one background fetch, settles `waitUntil`, then asserts a **second** request returns the revalidated `NEW` — the precise behaviour the pre-fix cache-first branch lacked. Companion cases pin: fresh entry → served without any fetch; cache miss → synchronous fetch + cache; non-200 → not cached; the `UPLOADS_PATH_RE` matcher (incl. subdirectory installs, and *non*-matches for fonts/themes/API); the `isCacheableUpload` guards (200-only, `no-store`, >5 MB, absent Content-Length ⇒ cacheable); FIFO eviction at `UPLOADS_MAX_ENTRIES`.

**Why it proves the fix.** The replicated handler is byte-faithful to `sw.js`, and the stale→revalidate→fresh sequence is exactly the property the acceptance criteria demand ("no longer served stale indefinitely"). The matcher tests prove fonts/static assets are **not** pulled into SWR (the "no regression in the common case" criterion).

**Live check (recommended — SWR is only real against an actual service worker).** On a **production** build served through the shortcode (jsdom can't register a SW):
1. Load a public gallery, let images cache. DevTools → Application → Cache Storage shows a `wpsg-uploads-swr-v1` cache populated with `/wp-content/uploads/...` entries, each carrying an `x-wpsg-cached-at` header.
2. Edit one of those images server-side under the **same URL** (WP media editor "Edit image" → overwrite, or a thumbnail-regeneration plugin).
3. Reload within the hour → the **old** image is still shown immediately (stale-while-revalidate serves cache first) — this is expected, not a bug.
4. Reload again after the entry has aged past the 1h TTL (or temporarily lower `UPLOADS_TTL_MS` to force it) → the request triggers a background revalidation; the **next** reload shows the updated image. Contrast with `main` pre-P71-D, where it never updates without a `CACHE_VERSION` bump.
5. Confirm a **font** or other `/wp-content/plugins/...` static asset is still served from the original `wpsg-runtime-*` cache (cache-first), not from `wpsg-uploads-swr-v1`.

**Regression checks.** `swMeta.test.ts` passes unmodified (the metadata SWR path is untouched). The navigation/shell and hashed-asset branches are unchanged. New: `src/test/swUploads.test.ts`.

**Pitfall.** The uploads branch must sit **after** the `/wp-json/` and `HASHED_ASSET_RE` bails and **before** the generic `RUNTIME_CACHE` block — an uploads URL must never fall through to cache-first. Also, `UPLOADS_CACHE` **must** be in the `activate` keep-set alongside `RUNTIME_CACHE`/`META_CACHE`/`SHELL_CACHE`; omit it and every activation wipes the uploads cache (correctness-safe but defeats the caching). The 1h `UPLOADS_TTL_MS` is a deliberate freshness-vs-bandwidth trade (images are heavy and change rarely; a 5-min TTL like the metadata cache would re-download a gallery's worth of unchanged images on every revisit) — tune it, but any finite value satisfies the "not indefinite" criterion.

---

## 4. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P71-A | New reconnect-count test green (confirmed red pre-fix); `tsc -b` clean | Existing `App.test.tsx` cases unchanged | ☑ (automated; live Network check optional, not run) |
| P71-B | New save-no-refetch test green (confirmed red pre-fix); `tsc -b` clean | Existing `settingsQuery.test.ts` cases unchanged | ☑ (automated; live Network check optional, not run) |
| P71-C | Existing global-asset mutation tests green **unmodified**; `tsc -b` clean | Same suite is the regression proof | ☑ (automated) |
| P71-D | New `swUploads.test.ts` green (SWR stale→revalidate→fresh flow + matcher/guards/eviction); `tsc -b` clean | `swMeta.test.ts` unchanged; fonts/static stay cache-first | ☑ (automated; prod-build SW live check optional, not run) |
| P71-E | *(added when the track lands)* | — | ☐ |

**Automated baseline (must be green alongside manual QA):** `npx tsc -b`, the front-end Vitest suite (`npm test`), and `npm run lint` on changed files. See PHASE71_REPORT.md → each track's section for per-track rationale.
