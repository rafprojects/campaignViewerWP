# Phase 71 - React Efficiency & i18n Consistency Sweep

**Status:** Planned
**Created:** 2026-07-14
**Last updated:** 2026-07-14

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P71-A | Reconnect triggers a double refetch of campaigns | Planned | Small |
| P71-B | `useUpdateSettings` sets fresh data then immediately invalidates it | Planned | Small |
| P71-C | Per-render `AssetsApi` construction in global-asset mutation hooks | Planned | Small |
| P71-D | Runtime SW cache is cache-first with no revalidation for same-origin static assets | Planned | Small-Medium |
| P71-E | User-facing strings in notification calls bypass i18n (regression vs. P60/61) | Planned | Medium |

---

## Rationale

The 2026-07-13 review ([REACT_REVIEW_FINDINGS.md](REACT_REVIEW_FINDINGS.md)) found four small, independent query/cache-layer inefficiencies with no functionality risk, plus one real regression: `eslint-plugin-i18next` only guards JSX text, so hardcoded English strings have crept back into notification/toast calls inside plain `.ts` hooks since the P60/61 i18n milestone marked the admin panel's i18n migration complete. All five items were independently re-verified against current source on 2026-07-14, with zero disputes (F-1's sweep was spot-checked across all 7 named files plus the App.tsx literals — every one confirmed).

1. **What triggered it.** F-1 is the highest-value item here: it's a correctness regression against a milestone the project already shipped and considered done, not a new gap — worth closing the lint hole so it can't silently regress a third time. The four efficiency items (E-2 through E-5) are all one-line-scoped fixes in the query/cache layer, cheap to batch alongside it.
2. **Why it belongs together.** None of these five items share code, but all are "no functionality risk, mechanical fix, do opportunistically" — the same shape as the PHP-side efficiency cluster (Phase 67), kept as one phase rather than five thin ones.
3. **Success.** Reconnect fires one refetch, not two; a settings save doesn't immediately refetch the data it just wrote; asset-mutation hooks don't construct a throwaway class instance every render; long-lived visitors see updated media after it's edited server-side; every user-facing notification string is translatable, and the lint suite catches the next one before it ships.

## Planning Refinement Pass (2026-07-22)

A validation pass re-checked every track's claims against current source before execution — this plan predates the P68/P69/P70 changes that landed 2026-07-21/22, and P68 in particular rewrote the `App.tsx` region P71-A cites. All five tracks' core claims still hold; the drift was confined to line numbers, and three either/or design choices the original prose left open were resolved with the maintainer.

**Line-number corrections** (logic unchanged in every case):

| Track | Original citation | Current location |
|-------|-------------------|------------------|
| P71-A | `App.tsx:285` (refetchOnReconnect), `:291` (manual effect) | `App.tsx:309`, `:315` — shifted ~24 lines by P68's `campaignsKey`/`fetchCampaigns` rewrite |
| P71-B | `settingsQuery.ts:76-79` | unchanged |
| P71-C | `adminQuery.ts:852,863,874` | `adminQuery.ts:848,859,870` — drifted ~4 lines |
| P71-D | `sw.js` default fetch branch | `sw.js:120-144`; SWR reference impl `handleMetaRequest` at `:185-225` |
| P71-E | `eslint.config.js:103`; App.tsx literals | `eslint.config.js:103` unchanged; App.tsx literals now at `:223,:382,:466` |

**Execution decisions taken with the maintainer:**

| # | Decision | Resolution |
|---|----------|------------|
| P71-A | Which reconnect mechanism to keep | **Delete the manual `isOnline`-driven effect; keep only `refetchOnReconnect: true`.** Strictly better, not just "pick one": the query already has `enabled: isReady`, so React Query fires the initial fetch itself when `isReady` flips — the manual effect's mount fetch was *always* a pure duplicate. Deleting it fixes both the reconnect double-refetch and the extra mount fetch at once. |
| P71-B | Scope of the invalidation fix | **Drop the `invalidateQueries` call entirely.** `setSettingsQueryData` already writes the canonical response; only one `useUpdateSettings` call site exists (`SettingsPanel.tsx`) and no code path mounts settings queries for >1 space concurrently, so no sibling-invalidation fallback is needed. |
| P71-D | Breadth of the SWR treatment | **Scope SWR to `/wp-content/uploads/` paths only**, leaving fonts/favicon/other static assets on their current cache-first-forever behavior (matches the acceptance criteria's "no regression in the common case that motivated cache-first"). Reuse the `stampResponse`/`META_TTL_MS` pattern from `handleMetaRequest`, in a dedicated cache (e.g. `wpsg-uploads-swr-v1`) so eviction/versioning stays independent of `RUNTIME_CACHE`/`META_CACHE`. |

**P71-E lint-gate mechanism (worked out concretely — the original prose only gestured at "extend scope to `src/hooks/**`"):** the existing blanket rule (`eslint.config.js:87-103`) *already* covers `src/**/*.{ts,tsx}` at the file level — the only gap is `mode: 'jsx-text-only'`, which validates JSX text children exclusively. Reading the `eslint-plugin-i18next` v6 rule source directly, a precise low-noise gate is achievable with **no custom rule or grep script**: a *separate* flat-config block (flat config replaces same-rule settings per matching file rather than merging, so it must not fold into the `jsx-text-only` block) targeting the notification-call sites, configured `mode: 'all'` + `callees: { include: ['notifications\\.show', 'showNotification', 'notifications\\.update'] }` + `'object-properties': { include: ['title', 'message'] }`. That checks only `title`/`message` literals inside those specific calls; everything else stays exempt. The block's `files` glob must include `.tsx` (for `SettingsPanel.tsx`'s draft-restore toasts), not just `.ts`. **Caveat for the executing agent:** the existing rule already silently fails to flag `"Loading campaigns..."`-shaped strings (2+ trailing periods) as JSXText — root cause not fully traced. The new gate's acceptance test must therefore assert against a string reproducing *that specific shape*, not just a generic literal, before trusting the coverage claim.

## Execution Priority

No cross-track dependencies. Suggested order:

1. **P71-A, P71-B, P71-C** — the three smallest, most mechanical fixes (each a one-line-scoped change); batch together.
2. **P71-D** — independent; slightly more involved (adapting the existing SWR pattern to a new cache branch).
3. **P71-E** — do last: the largest track (multi-file sweep + a lint-rule change), benefits from the smaller wins clearing first.

---

## Track P71-A - Reconnect triggers a double refetch of campaigns

*Source: REACT_REVIEW_FINDINGS.md § E-2 — re-verified 2026-07-14, confirmed accurate: `refetchOnReconnect: true` and a manual `isOnline`-driven effect both listen to the same native browser `online` event, and the manual effect also fires once on initial mount as `isReady` flips true.*

### Problem

The campaigns query sets React Query's `refetchOnReconnect: true` (`src/App.tsx:285`) **and** a manual effect refetches when `useOnlineStatus`'s `isOnline` flips true (`src/App.tsx:291`) — both ultimately driven by the same native `window` `online` event, so two refetches fire per reconnect. The manual effect's dependency on `isReady` also means it fires once extra on initial mount.

### Fix

Drop the manual effect and rely on `refetchOnReconnect` (or vice-versa, if the custom `useOnlineStatus` signal is considered more trustworthy than React Query's built-in online-manager) — pick one mechanism.

### Acceptance criteria

- Exactly one refetch fires per genuine reconnect event.
- No extra refetch beyond the query's own initial fetch on mount.

### Validation

- Test: simulate an `online` event, assert `fetchCampaigns`/the query function is called exactly once.
- Manual: toggle network offline/online in devtools, confirm only one network request for campaigns fires on reconnect.

### Implementation (2026-07-22)

Deleted the manual `useEffect(() => { if (isOnline && isReady) void mutateCampaigns(); }, …)` in `src/App.tsx`; the campaigns query keeps only `refetchOnReconnect: true`. `isOnline`/`useOnlineStatus` are retained (still used by the offline banner). Added `src/App.test.tsx` → *"does not refetch the fresh campaign list on reconnect …"*: renders `<App>`, waits for the single initial load, dispatches `window` `offline` then `online` in **separate** `act()` blocks (batching collapses a same-tick false→true into no change), and asserts the campaign-list request count is unchanged. The test exploits that `refetchOnReconnect` respects `staleTime` (skips the fresh query) while the deleted manual `refetch()` was unconditional. **Confirmed red on the pre-fix source** (`expected 2 to be 1`) before landing — an earlier mount-count draft was discarded because React Query dedupes the mount-time refetch, making it hollow (passed pre-fix). See runbook §3 P71-A.

---

## Track P71-B - `useUpdateSettings` sets fresh data then immediately invalidates it

*Source: REACT_REVIEW_FINDINGS.md § E-3 — re-verified 2026-07-14, confirmed accurate: `invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })` prefix-matches and invalidates every space/baseUrl settings query, including the one just written.*

### Problem

`useUpdateSettings`'s `onSuccess` (`src/services/settingsQuery.ts:76-79`) writes the normalized server response into the cache, then immediately calls `invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })` — a prefix match that invalidates the entry just written (plus every other space's settings under that key), scheduling refetches of data the server just returned.

### Fix

Invalidate only sibling keys (other spaces) if that's the actual intent, or skip invalidation entirely since the canonical response was just written into cache.

### Acceptance criteria

- Saving settings for one space doesn't trigger a redundant refetch of that same space's just-written data.
- If cross-space invalidation is genuinely needed (e.g. shared global keys), it's scoped precisely rather than via a blanket prefix match.

### Validation

- Test: save settings, assert no refetch fires for the just-written space's query key; assert sibling-space invalidation still happens if that's the chosen behavior.

### Implementation (2026-07-22)

Removed the single line `void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })` from `useUpdateSettings`'s `onSuccess` in `src/services/settingsQuery.ts`; `setSettingsQueryData(...)` still writes the canonical normalized response. Per the refinement-pass decision, no scoped sibling invalidation was added (single call site, no concurrent multi-space queries). Added `src/services/settingsQuery.test.ts` → *"does not refetch the just-written settings after a successful save"*: mounts an **active** `useGetSettings` observer beside `useUpdateSettings`, saves, and asserts `getSettings` is still called exactly once (plus a cache-content check). **Confirmed red on the pre-fix source** (`got 2 times`) before landing. See runbook §3 P71-B.

---

## Track P71-C - Per-render `AssetsApi` construction in global-asset mutation hooks

*Source: REACT_REVIEW_FINDINGS.md § E-4 — re-verified 2026-07-14, confirmed accurate: `useUploadGlobalAsset`/`useUpdateGlobalAsset`/`useDeleteGlobalAsset` each construct `new AssetsApi(apiClient)` directly in the hook body with no memoization — the only spot in the query layer doing so (contrast: the codebase's actual pattern instantiates facade classes once, e.g. inside `ApiClient`'s constructor).*

### Problem

`useUploadGlobalAsset`, `useUpdateGlobalAsset`, `useDeleteGlobalAsset` (`src/services/adminQuery.ts:852,863,874`) each do `new AssetsApi(apiClient)` in the hook body — a new instance every render, with `mutationFn` closing over the most recent one. Harmless today since the class is stateless, but it's a footgun if `AssetsApi` ever gains state, and it's inconsistent with how every other API-facade instance in the codebase is created.

### Fix

`useMemo(() => new AssetsApi(apiClient), [apiClient])` in all three hooks, matching how `apiClient` is treated everywhere else.

### Acceptance criteria

- All three hooks construct `AssetsApi` exactly once per `apiClient` identity, not per render.

### Validation

- Existing global-asset mutation test coverage passes unmodified (stateless class, so no behavior change expected — this is a consistency fix, not a bug fix).

### Implementation (2026-07-22)

Added `import { useMemo } from 'react'` to `src/services/adminQuery.ts` and wrapped each of the three hooks' facade construction in `useMemo(() => new AssetsApi(apiClient), [apiClient])`. No new test authored — a stateless facade produces byte-identical calls whether built once or per render, so the existing `GlobalAssetManager.test.tsx` / `assetsApi.test.ts` passing **unmodified** is the honest proof; a "same identity across renders" test would exercise React's `useMemo`, not our code. See runbook §3 P71-C.

---

## Track P71-D - Runtime SW cache is cache-first with no revalidation for same-origin static assets

*Source: REACT_REVIEW_FINDINGS.md § E-5 — re-verified 2026-07-14, confirmed accurate: the default fetch-handler branch has no TTL/staleness mechanism at all, in direct contrast to the metadata cache's genuine SWR implementation (`handleMetaRequest`) elsewhere in the same file.*

### Problem

`public/sw.js`'s default fetch-handler branch serves same-origin non-hashed GETs (fonts, upload-dir images) cache-first indefinitely — an entry is only replaced when `CACHE_VERSION` bumps. WP media edited or regenerated under the same URL (image editor, thumbnail-regeneration plugins) renders stale indefinitely for returning visitors.

### Fix

Give the runtime cache the same SWR treatment as the metadata cache (serve cached, revalidate in background), or scope cache-first strictly to font/static paths and let `/wp-content/uploads/` revalidate. Reuse the existing `stampResponse`/TTL mechanism from the metadata path rather than building a new one.

### Acceptance criteria

- WP media edited under an existing URL is no longer served stale indefinitely to a returning visitor with a warm cache.
- Fonts/immutable static assets keep their current cache-first behavior if that's the chosen scoping (no regression in the common case that motivated cache-first in the first place).

### Validation

- Test: simulate a cached upload-dir asset going stale (content changes server-side under the same URL), assert the SW eventually serves the updated version.
- Manual: edit an image via the WP media editor (same URL, new content), confirm a returning visitor with a warm cache eventually sees the update.

---

## Track P71-E - User-facing strings in notification calls bypass i18n

*Source: REACT_REVIEW_FINDINGS.md § F-1 — re-verified 2026-07-14, confirmed accurate across all 7 named hook files (spot-checked) plus the three App.tsx literals; the `wpsgUpsell.tsx` precedent pattern (`i18n.t` bound outside JSX) confirmed to exist and work.*

### Problem

`eslint-plugin-i18next` is configured `jsx-text-only` (`eslint.config.js:103`), so it only guards JSX text — strings passed to `notifications.show()`/`showNotification()` inside plain `.ts` hooks escape the rule entirely. Hardcoded English strings exist in at least `useMediaExternal.ts` (5 toasts), `useLayoutBuilderAssets.ts` (4), `useLayoutBuilderFileIO.ts` (3-4), `useBroadcastStaleness.ts` (1), `useGalleryAdapterSettingsIO.ts` (5), `useMediaUpload.ts` (8+, more than the review's original count of 2), and draft-restore toasts in `SettingsPanel.tsx` — plus non-toast literals in `App.tsx` (`'Session expired. Please sign in again.'`, `title="Sign in"`, `'Loading campaigns...'`). This directly regresses the "fully localizable" property the P60/61 i18n milestone shipped and marked complete in `FUTURE_TASKS.md`.

### Fix

- Sweep all `notifications.show`/`showNotification` call sites in the named hooks (and any others a fresh grep turns up — `useMediaUpload.ts` alone had more instances than originally catalogued) plus the `App.tsx` literals into `i18n.t(key, fallback)`, adding keys to `i18n-strings.en.json` (the generator script keeps PHP in sync).
- Follow the already-working `wpsgUpsell.tsx` pattern: `import i18n from '@/i18n'; const t = i18n.t.bind(i18n);` for use outside JSX render.
- Close the lint gap: extend the i18next lint rule's scope to `src/hooks/**` (beyond `jsx-text-only`), or add a lightweight custom rule/grep-based CI check for string literals inside notification-call arguments, so this can't silently regress a third time.

### Acceptance criteria

- Every notification/toast string in the named files (and any others the fresh sweep finds) is routed through `i18n.t`.
- The three `App.tsx` literals are translated.
- A new lint rule or CI check fails on a hardcoded string literal passed as a notification title/message, or as an `App.tsx`-style user-facing literal, in non-JSX code — verified by adding one deliberately in a test branch and confirming it's caught.

### Validation

- `i18next` completeness check (or equivalent existing tooling) passes with the new keys added.
- New lint-rule/CI-check test: introduce a hardcoded notification string, confirm the new gate catches it; remove it, confirm the gate passes.
- Manual: switch the site to a non-English locale, trigger a handful of the affected toasts (external media add failure, layout builder asset upload, session-expired), confirm they render translated.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| None — all five items are fully scoped within this phase. | — |

## Implementation Notes

- Record completed work here as tracks land; nothing executed yet.

## Outcome

Not started.
