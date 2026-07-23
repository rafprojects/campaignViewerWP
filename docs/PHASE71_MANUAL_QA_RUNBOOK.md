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
| P71-E | 60 hardcoded notification title/message strings (across 10 files) + 3 App.tsx literals routed through `i18n.t`; 69 new catalogue keys translated into all 5 reference locales; a new `wpsg/no-untranslated-notification` ESLint rule enforces it repo-wide. | **Yes** — those toasts now render translated on a non-English locale; a new hardcoded notification string now fails `npm run lint` |

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

### P71-E — Notification strings routed through i18n + a lint gate

**What & why.** `eslint-plugin-i18next` runs `jsx-text-only`, so it only guards literal JSX **text** — strings passed to `notifications.show()`/`showNotification()`/`notifications.update()` inside plain-object arguments (in `.ts`/`.tsx` hooks) escaped it entirely. Since the P60/61 i18n milestone shipped "fully localizable," 60 hardcoded English notification strings had crept back across 10 files, plus 3 non-notification literals in `App.tsx`. P71-E (a) routes every one through `i18n.t('key', 'English default')` (the `wpsgUpsell.tsx` precedent: `const t = i18n.t.bind(i18n)` for use outside JSX), (b) adds 69 new keys to `src/i18n-strings.en.json`, regenerates the PHP manifest, and translates all 69 into the 5 reference locales (de/es/fr/ru/zh), and (c) adds a **new local ESLint rule** `wpsg/no-untranslated-notification` (in `eslint-rules/`, wired into `eslint.config.js` over all `src/**`) that fails the build on a bare string/template literal in a notification `title`/`message` — closing the lint hole so this can't regress a third time.

**Unlike P71-A–D, this is a real content + tooling change, not a refactor** — so its verification borrows the [PHASE69_MANUAL_QA_RUNBOOK.md](PHASE69_MANUAL_QA_RUNBOOK.md) shape: a locale-switch manual check plus a deliberately-introduced-violation test for the new gate.

**Pre-fix behaviour.** On a non-English site, the 60 notification strings + 3 App.tsx literals rendered in **English** regardless of locale; a newly-added hardcoded notification string passed lint silently.

**Verification (primary — automated).**
```bash
npx vitest run src/test/noUntranslatedNotification.gate.test.ts   # the gate itself
npm run lint          # the gate is green repo-wide (0 violations after the sweep)
npm run i18n:check          # en source ↔ PHP manifest in sync
npm run i18n:check:locales  # all 5 reference locales fully translate every front-end string
npx tsc -b
npm test                    # affected hook/component tests still green (English defaults unchanged)
```
The **gate test** (`noUntranslatedNotification.gate.test.ts`) lints code strings through the *real* `eslint.config.js` via the ESLint Node API and asserts: a hardcoded `title` **and** `message` each flag (2); a bare `showNotification` message flags (1); a **`"Loading campaigns..."`-shaped (2+ trailing periods)** string flags (1) — the exact blind spot the old `i18next` rule had; a hardcoded branch inside a **conditional** title flags (1); and `t(...)`/`i18n.t(...)`-wrapped strings and non-`title`/`message` literals (`color`) flag **zero**. That is the "introduce a violation → caught; wrap in t() → passes" proof the acceptance criteria require, exercised against the wired rule (not the rule in isolation).

**Why it proves the fix.** `npm run lint` green proves all 60 sites are actually routed through `t()` (the rule would fail otherwise); `i18n:check:locales` green proves every new string is translated in all 5 locales (not English-only); the gate test proves the rule catches the next regression. Because each `t('key', 'English default')` keeps the **exact** original English as the default, the existing hook/component tests (which assert on the English toast text) pass **unmodified** — the observable English behaviour is unchanged, only localizability was added.

**Manual check (recommended — this track has real user-visible behaviour).** Switch the WP site to a non-English locale (e.g. `de_DE` via Settings → General → Site Language, with the compiled `.mo`/`.l10n.php` present) and trigger a handful of the affected toasts as an admin:
1. **External media** (add an invalid URL → "Invalid URL"/"Please enter a valid https URL."; add a valid one → "External media added.") — confirm German copy, not English.
2. **Media upload** (upload a batch, including a non-media file → the "Some files were skipped" + pluralized "N non-media files were ignored." toast) — confirm the `{{count}}` interpolation renders the number and the surrounding text is German.
3. **Layout Builder** (import a malformed layout JSON → "Invalid layout file"; import a valid one → the `"{{name}}" loaded successfully.` toast with the name interpolated).
4. **Session expired** (let the session lapse / force a 401) → the `App.tsx` "Session expired…" banner in German.
Then switch back to English and confirm the exact original wording is intact.

**Deliberate-violation manual check (the gate).** Add a line like `notifications.show({ message: 'temp hardcoded' });` to any `src/**` hook, run `npm run lint`, and confirm it fails with `wpsg/no-untranslated-notification`; remove it and confirm lint is green. (The automated gate test already encodes this, but it's a 20-second hands-on confirmation the CI gate is live.)

**Regression checks.** New: `src/test/noUntranslatedNotification.gate.test.ts`; `eslint-rules/no-untranslated-notification.js`. Unchanged: all existing hook/component tests pass without edits (155 across the swept files verified green); the `.po`/`.mo`/`.l10n.php` for the 5 locales gained the 69 entries; `.pot` regenerated (+69 msgids, none removed).

**Pitfall.** (1) The rule inspects only a notification `title`/`message` **direct value** (incl. conditional/logical branches), **not** strings nested inside a helper — e.g. `message: getErrorMessage(err, 'Failed…')`'s fallback is *not* flagged, so those fallbacks were translated by hand during the sweep; a future dev adding such a fallback won't be caught by the gate (documented in the rule header). (2) Non-notification user-facing strings (a11y `announce()`, `onNotify()` banners, the `validateImportPayload` error strings shown as `message: result.error`, and the draft-restore modal title/labels) are a **broader pre-existing i18n gap outside F-1's notification scope** and were intentionally left — don't assume the swept files are now 100% localized. (3) Translations for the 69 new strings are AI-generated (short UI phrases; terminology aligned to the existing catalogue — e.g. zh "campaign" → 活动); they warrant a native-speaker review pass but satisfy the coverage gate and are correct English-default fallbacks regardless.

---

## 4. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P71-A | New reconnect-count test green (confirmed red pre-fix); `tsc -b` clean | Existing `App.test.tsx` cases unchanged | ☑ (automated; live Network check optional, not run) |
| P71-B | New save-no-refetch test green (confirmed red pre-fix); `tsc -b` clean | Existing `settingsQuery.test.ts` cases unchanged | ☑ (automated; live Network check optional, not run) |
| P71-C | Existing global-asset mutation tests green **unmodified**; `tsc -b` clean | Same suite is the regression proof | ☑ (automated) |
| P71-D | New `swUploads.test.ts` green (SWR stale→revalidate→fresh flow + matcher/guards/eviction); `tsc -b` clean | `swMeta.test.ts` unchanged; fonts/static stay cache-first | ☑ (automated; prod-build SW live check optional, not run) |
| P71-E | Gate test green; `npm run lint` green (0 violations, all 60 sites routed through `t()`); `i18n:check` + `i18n:check:locales` green (69 keys × 5 locales); `tsc -b` + full suite green | Existing hook/component tests unchanged (155 verified); rule catches a deliberate violation | ☑ (automated; non-English locale-switch live check optional, not run) |

**Automated baseline (must be green alongside manual QA):** `npx tsc -b`, the front-end Vitest suite (`npm test`), and `npm run lint` on changed files. See PHASE71_REPORT.md → each track's section for per-track rationale.

---

## 5. PR review & fix pass (2026-07-23)

After the five tracks landed, the branch's three feature commits were put through a **reviewer pass** (a self-review standing in for external PR feedback — no reviewer comments existed to fetch): each implementation's correctness was re-validated against current source, then a `/code-review`-style adversarial sweep of the full diff. See PHASE71_REPORT.md → **PR Review & Fix Pass (2026-07-23)** for the finding-by-finding record. This runbook section is the **HOW to re-verify** that pass.

**Outcome in one line:** all five implementations confirmed correct; one cosmetic cleanup landed (`05b8e868` — hoisted a `[P71-E]` `const t` binding above the `import type` lines in `useBuilderDraftRestore.tsx` + `useLayoutBuilderAssets.ts`, which were interleaved between imports); no functional defect found; full suite re-run green.

**The two correctness claims worth re-checking by hand** (the review's non-obvious ones):

1. **P71-B is safe because `useUpdateSettings` only runs in the global branch.** Confirm the call graph yourself: `useUpdateSettings.mutateAsync` is called **only** at `SettingsPanel.tsx:537`, inside the `else` of `if (spaceId != null)` — i.e. `spaceId == null`. In that branch `setSettingsQueryData(queryClient, apiClient, data)` writes key `['settings', <baseUrl>, null]`, which is exactly what every global reader subscribes to (`useGetSettings(apiClient)` / `useGetSettings(apiClient, undefined)`). The **space** branch (`spaceId != null`, `:516-535`) never touches the mutation — it `PUT`s directly and calls `invalidateQueries` on both `getSettingsQueryKey(apiClient, spaceId)` and the `SETTINGS_QUERY_KEY` prefix itself. So the removed prefix-invalidation in `onSuccess` was pure redundancy for the only path that reaches it.
   ```bash
   grep -rn "updateSettingsMutation\|useUpdateSettings" src --include=*.tsx --include=*.ts | grep -v ".test."
   # Expect the only mutateAsync call site to be SettingsPanel.tsx's global (spaceId == null) branch.
   ```

2. **P71-E pluralization is convention-correct, not a regression.** The new `{{count}}` toasts replaced hand-rolled `file${n===1?'':'s'}` ternaries with i18next plural resolution. Confirm each pluralized message ships **both** forms:
   ```bash
   grep -nE "mediaup_skipped_msg|mediaup_complete_msg|mediaup_add_fail_clause" src/i18n-strings.en.json
   # Each must appear as a base key AND a <key>_other sibling.
   ```
   This repo's convention is **base key = the `_one`/singular form, `<key>_other` = plural** (i18next v26 resolves `<key>_one`, and when absent falls back to the base key); `grep -c '_other"' src/i18n-strings.en.json` shows the dozens of pre-existing pairs that prove the pattern works in this setup. A count-1 toast renders the base string, count-N renders `_other` — matching the old ternary output. `npm run i18n:check:locales` green additionally proves the `_other` forms are translated in all 5 locales.

**Re-verification commands (the whole pass — must all be green):**
```bash
npm run lint                 # incl. wpsg/no-untranslated-notification — 0 violations
npx tsc -b                   # or `npm run build` for tsc + vite build together
npm test                     # full Vitest suite — 3760 tests / 251 files, 0 failed
npm run i18n:check
npm run i18n:check:locales
```

**Re-confirm the cosmetic fix changed nothing:** `git show 05b8e868 --stat` should show only `useBuilderDraftRestore.tsx` (+1/-1) and `useLayoutBuilderAssets.ts` (+2/-2) — moved lines only, no logic. The husky pre-commit hook (`eslint --fix` + `tsc --noEmit`) ran clean on both files at commit time.

**Documented follow-ups the review deliberately left (do not treat the swept files as 100% localized):** the non-notification English strings — `setExternalError(…, 'Failed to load preview.')` in `useMediaExternal.ts`, the a11y `announce()` calls in `useLayoutBuilderAssets.ts`, `validateImportPayload` errors shown as `message: result.error`, and draft-restore modal chrome — are a **broader pre-existing i18n gap outside the notification `title`/`message` surface the gate guards**. They are unchanged by this phase and are the natural next i18n slice. See PHASE71_REPORT.md → PR Review & Fix Pass for the full list.
