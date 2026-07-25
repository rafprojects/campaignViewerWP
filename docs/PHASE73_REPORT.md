# Phase 73 - eslint-plugin-react-hooks v7 Rule Spike + various fSure ixes

**Status:** All 6 tracks complete (2026-07-25)
**Created:** 2026-07-25
**Last updated:** 2026-07-25

This phase carries **two unrelated origin threads**, bundled opportunistically rather than split into single-track phases:

- **Lint rule-set adoption (P73-A, done → P73-C–F, planned)** — P73-A spiked what adopting the rest of `eslint-plugin-react-hooks` v7's `recommended` config would take; it produced four concrete follow-on tracks (C–F) to actually adopt/fix the findings.
- **Test-harness fix (P73-B, done)** — `useTheme()` logged a "called outside `<ThemeProvider>`" warning in most component tests because the shared test wrapper never mounted a real provider; fixed and verified.

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P73-A | Spike — catalog what adopting `eslint-plugin-react-hooks` v7's full `recommended` config (the React Compiler rule suite) would require | ✅ Done | Medium |
| P73-B | Wrap the shared test harness in `<ThemeProvider>` so `useTheme()` consumers render with real context instead of the outside-provider fallback | ✅ Done | Small |
| P73-C | Turn on the 11 "adopt now" rules (9 zero-finding + 2 tiny-fix-then-flip) from the P73-A spike | ✅ Done | Small |
| P73-D | Fix the `react-hooks/static-components` findings (components defined inside a parent's render body) | ✅ Done | Small-Medium |
| P73-E | Fix/triage the `react-hooks/refs` findings (ref `.current` read/written during render) | ✅ Done | Medium |
| P73-F | Triage the `react-hooks/set-state-in-effect` findings (42 across 36 files) into real-bug vs. legitimate-external-sync buckets, then decide adoption severity | ✅ Done | Medium |

---

## Rationale

While resolving an `npm audit` finding (brace-expansion DoS, GHSA-mh99-v99m-4gvg) by bumping `eslint` `^9.17.0` → `^10.8.0`, `eslint-plugin-react-hooks` had to move `^5.1.0` → `^7.1.1` — it's the only major with an `eslint ^10` peer range. v7's `recommended` config bundles 14 new rules beyond the classic `rules-of-hooks` + `exhaustive-deps` (the React Compiler-derived suite: `static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library`, `immutability`, `globals`, `refs`, `set-state-in-effect`, `error-boundaries`, `purity`, `set-state-in-render`, `unsupported-syntax`, `config`, `gating` — corrected from an initial miscount of 12 during the same-day smoke test below).

A same-day smoke test (spreading the full `recommended` config into [eslint.config.js](../eslint.config.js) rather than the two explicit rules) surfaced roughly 120+ findings across the hooks layer from a handful of rule types, visible only in a truncated terminal tail before the run was reverted. That was real signal about the codebase's current hook hygiene, not noise, but a distinct body of work from a dependency bump and was deliberately kept out of scope in that session. The P73-A spike (see below) redid this properly with full JSON output and got exact, attributed numbers. `eslint.config.js` currently pins only `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` explicitly to preserve pre-bump lint behavior.

Separately (same day, different thread), running the test suite surfaced repeated `useTheme() called outside <ThemeProvider>. Using fallback defaults. This may indicate a portal rendering issue.` warnings ([src/hooks/useTheme.ts:44-51](../src/hooks/useTheme.ts#L44-L51)). Investigation found the warning is benign (dev-only `console.warn`, doesn't fail tests) but structurally miscalibrated: [src/test/test-utils.tsx](../src/test/test-utils.tsx)'s shared `Providers` wrapper never mounts `<ThemeProvider>`, so every test rendering one of the real consumers (`ThemeSelector`, `SettingsPanel`, `LayoutBuilderModal`, `useBuilderOverlayColors`, `useBuilderShellColors`, `main.tsx`) hits the fallback path unconditionally — not the rare "portal edge case" the warning's own comment describes. Because it fires by default in every test, the warning can't currently do its actual job of catching a genuine theme-context-loss regression in production.

1. **What triggered it.** P73-A: the eslint 9→10 bump forced the react-hooks plugin major bump as a side effect, exposing a large, previously-invisible backlog of React Compiler rule violations. P73-B: routine test-suite observation during that same session. P73-C–F: the concrete follow-on tracks the P73-A spike produced.
2. **Why it belongs together.** No shared code or dependency between the original two threads — bundled only because both surfaced in the same working session and P73-B was small enough not to warrant its own phase. P73-C–F are direct outputs of P73-A's investigation and naturally stay in this report.
3. **Success.** P73-A (done): a ranked, categorized findings catalog — see below — with a recommendation per rule, which produced P73-C–F. P73-B (done): the warning no longer fires from the shared test wrapper's own default shape, and it's verified capable of firing again if a real portal/context-loss regression is introduced. P73-C–F: tracked individually below; not yet started.

**Dependency bump context:** the eslint 9→10 bump itself (plus the `@eslint/js` bump and the `rules-of-hooks`/`exhaustive-deps`-only config) landed outside phase tracking as a standalone dependency/security fix, not part of this or any prior phase. The two dead-initializer fixes it required (`src/services/pagination.ts`, `scripts/set-wp-jwt-secret.js`) are already merged.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Adopt the full v7 `recommended` config immediately, or spike first? | Spike first — an unverified ~120+ findings estimate was too large a blast radius to fix blind, and some rules turned out to warrant per-file triage rather than a blanket adopt-and-fix. |
| B | Test all 14 rules one-at-a-time (as originally planned in P73-A's Validation section) or all at once with structured output? | All at once, with `--format json`: every ESLint finding already carries its own `ruleId`, so a single run gives exact per-rule attribution without 14 separate lint passes. The one-at-a-time plan was based on a wrong assumption (that only text tail output, not full JSON, was available) — caught during P73-A itself. |

## Execution Priority

No dependency between the original two tracks. P73-C–F (produced by P73-A) have no dependency on each other either — any order works; suggested order below groups by size.

1. ~~P73-B~~ — done.
2. ~~P73-A~~ — done; produced P73-C–F.
3. ~~P73-C~~ — done.
4. ~~P73-D~~ — done.
5. ~~P73-E~~ — done.
6. ~~P73-F~~ — done.
6. P73-F — medium, triage-first (broadest/noisiest rule); do last since it may inform E's approach.

## Track P73-A - Recommended Rule Set Spike

### Problem

`eslint-plugin-react-hooks@7.1.1` is now the pinned plugin version (required for the eslint 10 peer range), but [eslint.config.js](../eslint.config.js) only enables the two rules that existed pre-bump. The other 14 rules in the plugin's `recommended` config — largely the rule set React ships to catch React Compiler incompatibilities and hook-purity violations — are installed but silent. We don't know:

- How many real findings each of the 14 rules produces against the current codebase.
- Which findings are genuine bugs (e.g. `refs`/`set-state-in-effect` catching real stale-closure or cascading-render patterns) versus stylistic/false-positive noise for this codebase's patterns (e.g. the widely-used "ref mirrors latest prop" idiom, which `react-hooks/refs` flags directly during render).
- Whether adopting some rules is a precondition for eventually turning on the React Compiler itself (not currently in use here), which would raise the value of doing this now vs. later.

### Goal of the Spike

Run all 14 non-adopted rules against the full repo (not just `src/**`/`packages/shared-ui/src/**` — see the Implementation Notes below on why the scope widened) and produce a **ranked, per-rule findings catalog** capturing, for each rule:

- Finding count and file list.
- A sample of 3-5 representative findings with a quick read on whether they're a real bug, a stylistic false-positive for an established codebase idiom, or an intentional pattern that should be suppressed inline.
- Recommended disposition: **adopt now** (small/no fix backlog), **adopt as a dedicated fix track** (real bugs worth fixing, sized), **adopt at `warn`** (signal without blocking CI yet), or **defer/skip** (mostly noise for this codebase's patterns).
- Rough effort estimate if a fix track is warranted.

### Scope

- All 14 unadopted rules: `static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library`, `immutability`, `globals`, `refs`, `set-state-in-effect`, `error-boundaries`, `purity`, `set-state-in-render`, `unsupported-syntax`, `config`, `gating`.
- Repo-wide `**/*.{ts,tsx}`, not just `src/**`/`packages/shared-ui/src/**` as originally planned — [eslint.config.js](../eslint.config.js)'s hooks-plugin block already targets `files: ['**/*.{ts,tsx}']` (the whole repo, minus the standard `ignores`), so that's the real applicable scope and this spike used it as-is rather than artificially narrowing.
- Out of scope: actually fixing findings (that's the follow-on tracks this spike produced — P73-C–F), and evaluating the React Compiler itself.

### Acceptance criteria

- ✅ A findings catalog covering all 14 rules, each with a count, sample findings, and a disposition recommendation — see below.
- ✅ A concrete follow-on track proposal for every rule recommended "adopt now" or "adopt as a dedicated fix track": P73-C (adopt-now bucket), P73-D (`static-components`), P73-E (`refs`), P73-F (`set-state-in-effect` triage).
- ✅ `eslint.config.js` left unchanged — temporarily edited for the investigation run, reverted immediately after, confirmed via `git diff` showing no net change and a clean `npm run lint`.

### Validation

- Ran all 14 rules **simultaneously** with `npx eslint . --format json`, not one-at-a-time as originally planned — every ESLint finding already carries its own `ruleId`, so a single JSON run gives exact per-rule counts and file lists without 14 separate passes. (Corrected from the track's original Validation plan, which assumed text-tail output was the only option; it wasn't.)
- Cross-checked the JSON output for `fatal` messages and for any non-`react-hooks/*` `ruleId`s firing (would indicate config damage from the temporary edit) — none found; 654 files linted, 52 with any message.
- No code changes in this track — `eslint.config.js` reverted, `npm run lint` re-confirmed clean against the committed config.

### Findings Catalog (2026-07-25)

120 findings total, from 5 of the 14 rules. The other 9 fired **zero** findings against the current codebase.

| Rule | Count | Files | Disposition |
|---|---|---|---|
| `static-components` | 45 | 3 | **Adopt as dedicated fix track (P73-D)** — verified real bug, not noise. |
| `set-state-in-effect` | 42 | 36 | **Triage before adopting (P73-F)** — mixed real bugs and legitimate patterns; too broad to promote directly. |
| `refs` | 29 | 12 | **Adopt as dedicated fix track (P73-E)** — real concurrent-rendering concern, but touches a common codebase idiom; needs a design call. |
| `preserve-manual-memoization` | 3 | 2 | **Adopt now (P73-C)** — tiny, mechanical. |
| `purity` | 1 | 1 | **Adopt now (P73-C)** — single finding, already understood (see below). |
| `use-memo`, `incompatible-library`, `immutability`, `globals`, `error-boundaries`, `set-state-in-render`, `unsupported-syntax`, `config`, `gating` | 0 each | — | **Adopt now (P73-C)** — no findings, free to enable. |

**Per-rule detail (samples inspected, not just counts):**

- **`static-components` (45/3 files)** — Inspected [src/components/Settings/CampaignCardSettingsSection.tsx](../src/components/Settings/CampaignCardSettingsSection.tsx): a `ResetLink` component is declared with `function ResetLink(...)` *inside* the parent component's body (line 118), then used 8+ times in JSX below it. This is a genuine anti-pattern — a brand-new component type is created every render, forcing React to unmount/remount that subtree each time (lost DOM state, broken focus/transitions, wasted work). Real bug, not a style nit. The other two files ([CampaignGalleryAdapterRenderer.tsx](../src/components/CardViewer/CampaignGalleryAdapterRenderer.tsx), [TextLayerContent.tsx](../src/components/Galleries/Adapters/layout-builder/TextLayerContent.tsx)) weren't inspected line-by-line but the rule's mechanism is unambiguous — false positives on this specific rule are rare.
- **`refs` (29/12 files)** — Inspected [packages/shared-utils/src/useDirtyGuard.ts:55](../packages/shared-utils/src/useDirtyGuard.ts#L55): `snapshotRef.current` is *read* during render to compute `isDirty`. This is the "ref mirrors latest value, read during render" idiom flagged in the original investigation that led to this spike — common in this codebase, works today under React's current (non-concurrent-by-default) rendering, but is exactly what the rule exists to catch: ref reads during render aren't guaranteed consistent under React's concurrent features (`useTransition`, Suspense, etc.), which could cause visible tearing if/when those features are adopted here. Real, if currently low-probability, correctness concern — not pure noise, but also not an active bug today.
- **`set-state-in-effect` (42/36 files)** — Inspected [packages/shared-ui/src/KeyboardHintOverlay.tsx:38](../packages/shared-ui/src/KeyboardHintOverlay.tsx#L38): `setShow(true)` inside an effect that first checks `navigator.maxTouchPoints`/`sessionStorage` (external, non-deterministic-at-render browser state) — this is a legitimate, arguably necessary use of an effect (this exact state can't be read during render without an SSR/hydration mismatch), not a bug. Given the 36-file spread, the rule is very likely mixing genuine cascading-render bugs with this "sync with external browser state on mount" pattern throughout — the broadest and noisiest of the 5 firing rules, and the one most likely to produce false positives if adopted at `error` without per-finding review.
- **`preserve-manual-memoization` (3/2 files)** — Not deep-inspected; low count makes this cheap to review directly as part of P73-C rather than needing separate spike analysis.
- **`purity` (1/1 file)** — Already understood from the original same-day smoke test: [src/hooks/useCampaignsRows.tsx:64](../src/hooks/useCampaignsRows.tsx#L64) calls `Date.now()` directly during a row-derivation computation. Standard impure-during-render finding; trivial to fix (compute once via `useMemo`/effect or accept the minor imprecision is intentional and suppress with a comment either way).

## Track P73-B - `useTheme()` Test-Harness Fallback Warning

### Problem

Running the test suite prints `useTheme() called outside <ThemeProvider>. Using fallback defaults. This may indicate a portal rendering issue.` repeatedly ([src/hooks/useTheme.ts:44-51](../src/hooks/useTheme.ts#L44-L51)). It's harmless today — the warning is gated behind `import.meta.env.DEV` and only calls `console.warn`, and [src/test/setup.ts](../src/test/setup.ts) only escalates `console.error` to a failure, not `console.warn` — but the root cause is a gap, not a false alarm: [src/test/test-utils.tsx](../src/test/test-utils.tsx)'s shared `Providers` wrapper mounts `QueryClientProvider`, `MantineProvider`, and `ModalsProvider`, but never `<ThemeProvider>`. Every test that renders one of the real `useTheme()` consumers — `ThemeSelector`, `SettingsPanel`, `LayoutBuilderModal`, `useBuilderOverlayColors`, `useBuilderShellColors`, `main.tsx` — hits the missing-provider fallback path unconditionally, not because of the portal edge case the warning describes.

Net effect: the warning can't currently distinguish "expected test harness gap" from "a real component actually lost its theme context via a portal" — it fires identically either way, so it's not usable as a regression signal.

### Fix

Add `<ThemeProvider>` to the shared `Providers` wrapper in [src/test/test-utils.tsx](../src/test/test-utils.tsx), alongside the existing `QueryClientProvider`/`MantineProvider`/`ModalsProvider`. `ThemeProvider` works with no props (all `ThemeProviderProps` fields are optional — see [src/contexts/ThemeContext.tsx:112-169](../src/contexts/ThemeContext.tsx#L112-L169)): it falls back to `DEFAULT_THEME_ID`, skips all shadow-DOM/scoped-style effects when `shadowRoot`/`hostElement` aren't passed, and only touches `localStorage`, which [src/test/setup.ts:263](../src/test/setup.ts#L263) already clears in `afterEach` — so no new test-pollution risk.

This makes tests render through the real provider (closer to production shape) instead of the fallback, and frees the warning to mean something again.

### Acceptance criteria

- `src/test/test-utils.tsx`'s `Providers` wrapper renders children inside `<ThemeProvider>`.
- `npm run test:silent` (or a targeted run of the files touching `ThemeSelector`/`SettingsPanel`/`LayoutBuilderModal`/`useBuilderOverlayColors`/`useBuilderShellColors`) no longer logs the "called outside `<ThemeProvider>`" warning.
- A quick manual check (temporarily reintroducing a component that calls `useTheme()` outside any provider, e.g. by rendering it directly with `@testing-library/react`'s bare `render()` instead of the shared wrapper) still produces the warning — confirming the fix didn't silence the check entirely, just fixed the harness gap.
- No unrelated test snapshots/assertions change as a side effect of the real theme context now being present (e.g. any test asserting on `mantineTheme`/`colorScheme` values that differ between the fallback and a real default-theme provider).

### Validation

- `npm run test:silent` — full suite green, warning gone.
- `npm run lint` / `npm run build` — unaffected by this change but cheap to confirm.
- Spot-check a couple of the affected components' test output before/after to confirm no new failures from real theme values now flowing through (vs. the hand-rolled fallback object in `useTheme.ts`).

### Implementation Notes (2026-07-25)

- Added `import { ThemeProvider } from '@/contexts/ThemeContext';` to [src/test/test-utils.tsx](../src/test/test-utils.tsx) and nested it `QueryClientProvider > ThemeProvider > MantineProvider > ModalsProvider` — matching production's nesting order in [src/main.tsx](../src/main.tsx) (`ThemeProvider` wraps the Mantine layer there too), rather than an arbitrary order. `testTheme` (the static Mantine override object) was left untouched — this track only closes the missing-context gap, it does not wire `MantineProvider`'s theme to derive from `useTheme()`'s output, which would be a larger, separate change.
- Checked for conflicts first: `grep` found 3 test files that already `vi.mock()` `@/hooks/useTheme` directly (`SettingsPanel.test.tsx`, `ThemeSelector.test.tsx`, `useBuilderColors.test.ts`). Module-level mocks replace the hook regardless of what real context wraps it, so adding the real provider underneath doesn't conflict with them.
- Confirmed the negative case (the warning must still be reachable, not just silenced) is already covered by an existing dedicated test — [src/hooks/useTheme.test.ts](../src/hooks/useTheme.test.ts) calls `renderHook(() => useTheme())` directly via `@testing-library/react` (bypassing the shared `Providers` wrapper entirely) and spies on `console.warn`. No new test was needed.
- Verification (Haiku subagent, isolated from implementation per this session's usual split): `npm run test:silent` → 255 files / 3775 tests passed, zero occurrences of "called outside `<ThemeProvider>`" or "portal rendering issue" in output; `npm run build` → tsc + vite build both clean, no regressions from the new import. Ran `npm run lint` myself → clean.
- No snapshot or assertion changes were needed anywhere in the suite — the real default-theme context values didn't diverge from what components expected.

## Track P73-C - Adopt the "no fix backlog" Rules

### Problem

11 of the 14 non-adopted rules are free to turn on: 9 (`use-memo`, `incompatible-library`, `immutability`, `globals`, `error-boundaries`, `set-state-in-render`, `unsupported-syntax`, `config`, `gating`) produced zero findings against the current codebase in the P73-A spike, and 2 more (`preserve-manual-memoization`: 3 findings/2 files, `purity`: 1 finding/1 file) have a trivially small backlog.

### Fix

- Add all 11 rules to [eslint.config.js](../eslint.config.js)'s hooks-plugin `rules` block, each at its own `recommended` severity (`incompatible-library` and `unsupported-syntax` are `warn` upstream; the other 9 are `error`).
- Fix the 1 `purity` finding: [src/hooks/useCampaignsRows.tsx:64](../src/hooks/useCampaignsRows.tsx#L64) calls `Date.now()` during render/derivation — move it into a `useMemo`/effect-driven value, or otherwise make the computation not call an impure function inline.
- Fix the 3 `preserve-manual-memoization` findings (2 files: [MediaCarouselAdapter.tsx](../src/components/Galleries/Adapters/MediaCarouselAdapter.tsx), [ScrollSnapGallery.tsx](../src/components/Galleries/Adapters/scroll-snap/ScrollSnapGallery.tsx)) — inspect each "Compilation Skipped" message for the specific memoization pattern the rule can't verify and adjust it to a form the rule (and the eventual React Compiler, if ever adopted) can statically confirm is safe.

### Acceptance criteria

- All 11 rules present in `eslint.config.js` at their `recommended` severity.
- `npm run lint` passes clean with zero findings from any of the 14 non-adopted rules except the 3 (`static-components`, `refs`, `set-state-in-effect`) intentionally deferred to P73-D/E/F.

### Validation

- `npm run lint`, `npm run test:silent`, `npm run build` all green.

### Implementation Notes (2026-07-25)

- Added the 11 rules to [eslint.config.js](../eslint.config.js) with an updated block comment explaining the P73-D/E/F deferral. `npm run lint` immediately surfaced exactly the 4 findings the P73-A spike predicted (3 `preserve-manual-memoization`, 1 `purity`) — no surprises from the 9 "zero-finding" rules, confirming the spike's numbers held.
- **`purity` (`useCampaignsRows.tsx`):** did *not* restructure to an effect/interval as the track's Fix section originally suggested. The `Date.now()` call is inside a `useMemo` that derives table-row schedule badges ("Scheduled"/"Expiring"/"Expired"); it already re-runs whenever `campaigns` (or other deps) change, and the badges don't need to live-tick. Introducing an effect+interval purely to satisfy the linter would add real complexity (extra re-renders, cleanup) for a display-only value that doesn't need it — so this was suppressed with an inline rationale comment instead, matching the "document deliberate trade-offs" pattern already used elsewhere in this codebase (e.g. `useDirtyGuard.ts`'s existing `exhaustive-deps` suppression).
- **`preserve-manual-memoization` (3 findings, 2 files):** inspection changed the plan here too. All 3 are the compiler's static analysis flagging that it *can't prove* a manual `useMemo`/`useCallback`'s dependency is safe to auto-memoize (e.g. "this dependency may be mutated later", or — for the `handleKeyDown` finding — the compiler's own inferred dependency set, `[setPlayingSlides]`, disagreeing with the 5 manually-specified deps that the callback body actually reads). Since this codebase does **not** run React Compiler, these findings have zero runtime effect today, and — critically — adjusting the manual deps to chase the compiler's inference would risk introducing real stale-closure bugs (the compiler's inferred `[setPlayingSlides]` for `handleKeyDown` would drop `focusedIndex`/`media`/`openLightbox`/`scrollNext`/`scrollPrev`, all of which the callback body genuinely reads). All 3 suppressed with rationale comments rather than "fixed" — changing working dependency arrays to satisfy a hypothetical future compiler pass is the wrong trade here.
- Verified all 4 suppressions actually land on the ESLint-reported line: `eslint-disable-next-line` only silences a violation reported on the *exact* next line, and the first attempt on the `handleKeyDown` finding placed the comment one line too high (before `useCallback(` instead of before the arrow function itself), which `npm run lint` caught as both a missed violation and an "unused eslint-disable directive" warning — moved to the correct line and re-verified clean.
- Full verification (Haiku subagent): `npm run test:silent` → 255 files / 3775 tests passed; `npm run build` → tsc + vite build both clean. `npm run lint` confirmed clean by me directly before handing off.

## Track P73-D - Fix `react-hooks/static-components` Findings

### Problem

45 findings across 3 files where a component is defined inside another component's render body — confirmed via inspection (see P73-A's Findings Catalog) to be a real anti-pattern causing remount/state-loss on every parent render, not a false positive.

### Fix

For each of the 3 files, hoist the inline component definition (e.g. `ResetLink` in [CampaignCardSettingsSection.tsx](../src/components/Settings/CampaignCardSettingsSection.tsx)) to module scope, passing in whatever it currently closes over as explicit props. Likely 2-3 root-cause fixes total despite 45 line-level findings (one inline component reused many times = many findings, one fix).

### Acceptance criteria

- Zero `react-hooks/static-components` findings.
- No behavior change in the affected UI (component identity fix should be invisible to users — verify via existing component tests plus a manual check that inputs like `ResetLink` still work after the hoist).

### Validation

- `npm run lint`, `npm run test:silent`, `npm run build`.
- Manual smoke test of the 3 affected areas (Settings panel card section, CardViewer adapter renderer, Layout Builder text layer) since remount-on-render bugs can be subtle (e.g. lost focus/selection) and won't always show up in automated tests.

### Implementation Notes (2026-07-25)

- **`CampaignCardSettingsSection.tsx` (43/45 findings, the real bug):** confirmed `ResetLink` was defined inside the parent's render body, closing over `isDesktop`, `hasOverride`, `clearField`, `clearDimField`, `t`. Hoisted it to module scope as `ResetLink({ fieldKey, unitKey, hasOverride, onReset })`. Two things simplified the prop surface below the 4 originally-closed-over values:
  - `isDesktop` didn't need to be a separate prop — `hasOverride(key)` already returns `false` whenever `isDesktop` is true (checked its own definition), so `ResetLink`'s old `if (isDesktop || !hasOverride(fieldKey))` had a redundant first clause. Dropped it; behavior is identical.
  - `t()` didn't need to be threaded through — `ResetLink` calls its own `useTranslation('wpsg')` directly (same namespace, standard i18next usage), rather than receiving the parent's translation function as a prop.
  - `clearField`/`clearDimField` collapsed into one `onReset(fieldKey, unitKey)` prop, backed by a new `handleReset` function in the parent with the same `unitKey ? clearDimField(...) : clearField(...)` branching the old inline `onClick` had.
  - All 43 JSX call sites got `hasOverride={hasOverride} onReset={handleReset}` added via a scoped `sed` substitution (matched only `<ResetLink...` lines), then spot-checked and lint-verified rather than hand-edited 43 times.
- **`CampaignGalleryAdapterRenderer.tsx` (1 finding) and `TextLayerContent.tsx` (1 finding):** inspected both and found genuine false positives, not bugs — suppressed rather than restructured:
  - `resolveAdapter(adapterId)` returns a component reference from a `Map` populated once at module load ([adapterRegistry.ts](../src/components/Galleries/Adapters/adapterRegistry.ts)); same `adapterId` always yields the same reference, so there's no remount-on-render risk despite the rule's static analysis being unable to see that.
  - `textLayerElement(...)` returns a plain string type (`'h2' | 'h3' | 'p'`), not a component — DOM elements are reconciled by tag-name string, not object identity, so this pattern has no remount concern at all.
  - Both needed a paired `/* eslint-disable */` / `/* eslint-enable */` block rather than `eslint-disable-next-line`: the rule reports the violation at *two* locations (the variable declaration **and** the JSX usage line), and a single `-next-line` comment only silenced the first — caught via a follow-up `npm run lint` showing both a missed violation and an "unused eslint-disable directive" warning, same class of mistake as one made earlier in P73-C.
- Updated the block comment in [eslint.config.js](../eslint.config.js) to reflect `static-components` now being adopted (P73-C's comment was already stale for this).
- **Manual smoke test (2026-07-25, live browser click-through):** performed against the real local dev site (`https://wordpress.lan`, per `.claude/skills/see-wp`) after the user deployed the build via `update_dev_plugin.sh`. Drove headless Chromium (`@playwright/test`'s `chromium.launch`, no `chromium-cli` available in this environment) through the actual admin UI:
  - Logged in, navigated SuperGallery → Spaces → Default → Settings → "Configure display settings" → Campaign Cards tab.
  - Switched to the **Tablet** breakpoint, set an explicit **Border Radius** override (8 → 20) — confirmed the field label switched to "Override for tablet" and exactly one "↻ Reset to inherited" `ResetLink` appeared, with every other field correctly reading "Inherited from desktop".
  - Clicked the Reset link — confirmed the override cleared (value reverted to `8`, label back to "Inherited from desktop", link disappeared).
  - Cycled Mobile → Desktop → Tablet with no crash, no stale UI.
  - Zero `console.error` / uncaught page errors across the whole flow. No changes were saved (never clicked "Save Changes"), so the live dev site's actual settings are untouched.
  - Separately loaded two public gallery pages (`/` and `/meower/`, found via `wp post list`/`wp db query` rather than creating new content) to spot-check `TextLayerContent`: the Layout Builder hero text ("Tell your story" heading + paragraph) rendered live on `/meower/` — that's the exact `<Tag>` dynamic-tag-name component from this track's fix — with zero console errors.
  - `CampaignGalleryAdapterRenderer`'s suppression (the registry-lookup pattern) was not separately live-verified — reaching an authenticated campaign gallery view was more setup than the fix's risk warranted, given it's the same well-understood pattern already confirmed safe by code inspection (stable `Map` lookup) and covered by the passing automated suite.
  - Screenshots and driver scripts were scratch artifacts (temp `.tmp-explore*.mjs` at the repo root, deleted after use); nothing committed from this pass beyond the doc update.
- Verification (Haiku subagent): `npm run test:silent` → 255 files / 3775 tests passed; `npm run build` → tsc + vite build both clean. `npm run lint` confirmed clean repo-wide by me directly beforehand.

## Track P73-E - Fix/Triage `react-hooks/refs` Findings

### Problem

29 findings across 12 files where a ref's `.current` is read or written during render (not inside an effect/handler). Confirmed via inspection this is a real, if currently low-probability, concurrent-rendering correctness concern — and also a codebase-wide idiom ("ref mirrors latest prop/value, read during render"), not an isolated mistake.

### Fix

Needs a design decision before blind fixing, since a mechanical per-site fix risks 12 different ad-hoc patches for the same underlying idiom:

1. Review all 29 sites and confirm which are true "read during render" (the risky case) vs. "written during render to mirror a prop" (a different, more defensible pattern the rule also flags).
2. Decide on a standard replacement pattern for this codebase (e.g. deriving the value differently, moving the read into an event handler/effect, or introducing a shared `useLatestRef`-style helper if the "mirror a prop" case is common enough to warrant one).
3. Apply consistently across the 12 files rather than one-off fixes.

### Acceptance criteria

- Zero `react-hooks/refs` findings, or documented `eslint-disable` with rationale for any sites judged genuinely safe/unavoidable after review.
- No behavior change.

### Validation

- `npm run lint`, `npm run test:silent`, `npm run build`.

### Classification (2026-07-25)

All 29 findings fell into 4 categories, not the 2 originally anticipated:

| Category | Sites | Disposition |
|---|---|---|
| **A — mirror-latest-value write** (`ref.current = value` unconditionally, every render, so a stable callback/effect reads the freshest value without re-subscribing) | 9 files, 16 findings: `useScrollRestore.ts`, `FontLibraryManager.tsx`, `LayoutBuilderModal.tsx`, `LayoutCanvas.tsx` (×5), `UnifiedCampaignModal.tsx` (×2), `useBreakpoint.ts`, `useBuilderDraftRestore.tsx` (×2), `useInContextSave.ts` (×3) | **Fixed**: centralized into a new shared `useLatestRef` hook — see below. |
| **B — genuine DOM-read staleness bug** (reading a live layout property from a ref during render, with no mechanism to re-render on change) | `LayoutBuilderCanvasPanel.tsx` — `canvasAreaRef.current?.clientWidth` used to compute the device-preview-frame width | **Fixed for real**: swapped for Mantine's `useElementSize` (ResizeObserver-backed, reactive). |
| **C — React's documented "cache between renders" pattern** (conditional write, guarded so it only changes the *value*, never produces different output within the same render) | `CardGallery.tsx` — `if (selectedCampaign) lastCampaignRef.current = selectedCampaign` | **Suppressed** with rationale citing [React's own docs](https://react.dev/reference/react/useRef#caching-information-between-re-renders) for this exact pattern. |
| **D — false positive via an opaque third-party function** (the rule can't see that the function only registers a callback for later, doesn't invoke it during its own call) | `LayoutBuilderCanvasPanel.tsx` — `getHotkeyHandler` (`@mantine/hooks`) closures reading `transformRef.current`, only invoked on keydown | **Suppressed** with rationale. |
| **(one-off) low-risk read, deliberately not state** | `useDirtyGuard.ts` — `snapshotRef.current` read to compute `isDirty`; only ever written inside a committed effect | **Suppressed** with rationale — converting to state would cost an extra render on every modal open, which the ref was deliberately chosen to avoid. |
| **(one-off) circular-dependency-breaking ref** | `App.tsx` — `idleResetRef` must exist before `resetIdleTimer` (its own eventual value) because the `onWarning` callback passed *into* `useIdleTimeout` needs to reference it | **Suppressed** with rationale — doesn't fit the `useLatestRef` shape since the ref must be created before the value it will hold exists. |

Category A's volume (16 of 29 findings, 9 independent files, byte-for-byte the same 2-line shape every time, several with near-identical explanatory comments already written by prior phases) is what tipped the original "standard replacement pattern" decision toward a shared hook rather than 9 scattered suppressions:

- **New:** [`packages/shared-utils/src/useLatestRef.ts`](../packages/shared-utils/src/useLatestRef.ts) — `const ref = useRef(value); ref.current = value; return ref;`, with the one `react-hooks/refs` suppression living in this single documented place instead of 9+ call sites.
- All 9 sites converted from `const xRef = useRef(v); xRef.current = v;` to `const xRef = useLatestRef(v);`.
- This surfaced two incidental findings the mechanical pattern had been hiding:
  - **Dead code:** `LayoutCanvas.tsx`'s `templateSlotsRef` was never read anywhere (`.current` never accessed) — genuinely unused even before this track, just invisible to `no-unused-vars` because the old two-line form's assignment counted as a "use" of the identifier. Deleted.
  - **New (correct) `exhaustive-deps` warnings:** ESLint's stability-detection for `exhaustive-deps` is a hardcoded syntactic check for literal `useRef(...)` calls — a custom hook wrapping `useRef` doesn't get that recognition, so 8 `useCallback`/`useEffect`s that used to omit their ref from the deps array (correctly, since raw `useRef()` identity is stable) started warning once the refs came from `useLatestRef` instead. Fixed by adding each ref to its dependency array — always safe (the identity never changes) and was going to surface eventually the moment any of these refs got wrapped in any custom hook.

### Implementation Notes (2026-07-25)

- Read live code at every one of the 29 sites before deciding a disposition — did not trust the finding counts or the original track plan's 2-category assumption (which undercounted; see Classification above).
- `eslint.config.js`: `react-hooks/refs` now `error`, comment updated to reflect P73-C/D/E history and point at the remaining P73-F gap.
- Automated verification (Haiku subagent): `npm run test:silent` → 255 files / 3775 tests passed; `npm run build` → tsc + vite build both clean. `npm run lint` confirmed clean by me directly.
- Live browser click-through (`@playwright/test`'s `chromium.launch`, same approach as P73-D — user built + deployed via `update_dev_plugin.sh` each time) against `https://wordpress.lan`:
  - **Public gallery pages** (`/`, `/meower/`) load with zero console errors, both signed out and signed in — exercises `CardGallery.tsx`'s conditional-cache pattern (Category C) on every render.
  - **Admin Panel** (opened from the front-end gallery's admin menu → "Admin Panel") — campaigns table, Templates tab, Layouts tab all load and navigate with zero console errors — exercises `useInContextSave.ts` and more of `CardGallery.tsx`.
  - **Layout Builder canvas** (Admin Panel → Layouts → "Edit layout Magazine Spread") — the actual `LayoutBuilderCanvasPanel.tsx`/`LayoutCanvas.tsx` surface:
    - Pressed the canvas hotkeys (`=`, `-`, `0`, `f`) — exercises the `getHotkeyHandler` suppression (Category D). Zero errors.
    - Entered preview mode and selected the "Laptop" device preset (sets `activePresetWidth`), then resized the browser viewport from 1500px down to 700px and back — **visually confirmed the device-preview frame width shrank to match the narrower container**, proving the `useElementSize` fix (Category B) actually tracks resizes reactively now, not just "doesn't crash." Zero errors throughout.
  - Cleanup: a throwaway "P73-E manual QA (delete me)" Campaign Template created to navigate the admin UI was deleted via the UI's own delete action before finishing — no residue left on the dev site. No settings were saved from the Layout Builder session (closed without clicking Save).

## Track P73-F - Triage `react-hooks/set-state-in-effect` Findings

### Problem

42 findings across 36 files — the broadest and noisiest of the 5 firing rules. Inspection of one sample ([KeyboardHintOverlay.tsx](../packages/shared-ui/src/KeyboardHintOverlay.tsx)) found a legitimate "sync with external browser state on mount" pattern, not a bug — meaning this rule's findings are very likely a mix of real cascading-render bugs and defensible effect usage. Adopting at `error` without review would either block on false positives or train the team to reflexively suppress the rule.

### Fix

This track is triage, not blind fixing:

1. Review all 42 findings (36 files) and bucket each as: real bug (fix), legitimate external-sync pattern (suppress with a comment explaining why, or restructure to make the intent clearer), or unclear (flag for a second look).
2. Fix the "real bug" bucket.
3. Decide the rule's final severity based on the resulting suppression count — if most sites end up suppressed, `warn` (or a scoped `off` with per-file `error` re-enables) may fit this codebase better than a blanket `error`.

### Acceptance criteria

- ✅ All 42 findings triaged with a documented disposition — see Classification below.
- ✅ Real bugs fixed (none found); legitimate patterns documented (grouped, not individually suppressed — see rationale below).
- ✅ A final severity decision recorded: **not adopted**.

### Validation

- `npm run lint`, `npm run test:silent`, `npm run build`.

### Classification (2026-07-25)

Read the actual code at all 42 findings across all 36 files — not sampled, not estimated from filenames. Every single one fell into one of these established, legitimate React patterns; **zero were real bugs**:

| Pattern | Representative files | Count (approx.) |
|---|---|---|
| Reset local state when a modal opens/re-targets (`opened`/`source` toggles) | `AdminCampaignBulkDeleteModal`, `AdminCampaignDeleteModal`, `CampaignDuplicateModal`, `CampaignMoveSpaceModal`, `MediaUploadController`, `GalleryConfigEditorModal`, `TemplatePickerModal`, `SpaceManagementView`, `useExternalMediaModal` | ~10 |
| Default a selection to the first available item once data loads | `AccessPanel` (×2), `AuditPanel`, `MediaPanel`, `AdminPanel` (pagination reset/clamp, ×2) | ~6 |
| Sync local editable/display state from an external prop/context that can change from elsewhere | `TextPropertiesPanel` (×2), `LayerPanel`, `ThemeSelector`, `CompanyCombobox`, `ThemeContext`, `CampaignViewer`, `MediaTab` | ~9 |
| Derive from a browser API only available post-mount (SSR/hydration-unsafe during render) | `AuthBarFloating` | 1 |
| Animation/transition state machines (explicit rAF/timeout sequencing) | `Lightbox`, `SettingsPanel` (drawer open, has a detailed pre-existing comment on *why* a plain effect isn't enough) | 2 |
| Object URL lifecycle (create on change, revoke on cleanup — genuinely needs an effect) | `MediaAddModal`, `useExternalMediaModal` | 2 |
| Cancellation-guarded async fetch/probe with a stale-response guard | `useMediaDimensions`, `useFeatheredMask`, `useMediaUsageSummary`, `TemplatePickerModal`, `TemplatesTab`, `FontLibraryManager` | 6 |
| Clamp/derive interactive state when a dependency shrinks (pagination, carousel index) | `useCarousel`, `CardGalleryHostPagination` (×3), `AdminPanel` | ~5 |
| One-time deep-link / prefetch-once effects (guarded by a ref flag) | `LayoutTemplateList`, `AccessPanel`, `AuditPanel`, `MediaPanel`, `MediaTab` | ~5 |
| Prune derived state when an external observation changes (e.g. videos scrolled out of view) | `MediaCarouselAdapter` (×2), `OverlayArrows` | 3 |

(Categories overlap for a few multi-effect files, so counts don't sum exactly to 42 — every finding was individually read regardless.)

**Decision: do not adopt this rule.** Every one of the 42 sites is either already commented explaining the deliberate design (several predate this triage entirely) or is an unambiguous instance of a textbook effect use case (data fetching, DOM/browser API access, external subscriptions, imperative animation). Suppressing all 42 individually would mean 42 near-identical `eslint-disable` comments for patterns that are already correct — pure noise, not signal, and a real maintenance cost (every new component touching these same patterns would need yet another suppression). The rule's premise — flag `setState` calls inside effects because the React Compiler's stricter purity model can't verify they're safe — doesn't produce actionable findings in a codebase that doesn't run the Compiler and where this exact style is the established idiom throughout.

This is different from P73-D/E's false positives (a handful of specific, identifiable safe patterns worth naming and suppressing individually) — here the "false positive" rate is 100% across a large, structurally-repeated sample, which is a signal about the *rule's fit for this codebase* rather than about individual call sites. Recorded in [eslint.config.js](../eslint.config.js)'s block comment so this isn't re-litigated without cause; revisit if this codebase ever adopts the React Compiler for real, since only then would the rule's underlying concern (compiler-safety, not correctness) start to matter here.

### Implementation Notes (2026-07-25)

- Temporarily enabled `react-hooks/set-state-in-effect` at `error`, ran `npx eslint . --format json`, and read the code at all 42 reported locations across all 36 files (not a sample) before reverting the temporary enable.
- No source files changed — the only diff is the updated block comment in [eslint.config.js](../eslint.config.js) explaining the non-adoption decision and pointing back to this section.
- `npm run lint` confirmed clean (no net change) after reverting. `npm run test:silent` (255 files / 3775 tests) and `npm run build` both confirmed clean via a Haiku subagent sanity check — a config-comment-only change carries negligible risk, but the phase's established pattern is to verify every track regardless.

## Follow-On Candidates

None beyond P73-C–F — those cover all 5 rules that produced findings in the P73-A spike, and the 9 zero-finding rules are folded into P73-C.

## Implementation Notes

All six tracks (P73-A through P73-F) are complete; see their own Implementation Notes / Findings Catalog / Classification subsections above.

## Outcome

**Phase 73 shipped in full** (2026-07-25). Starting point: an eslint 9→10 major bump (a standalone dependency-security fix, tracked outside this phase) forced `eslint-plugin-react-hooks` to a major that bundles 14 new React Compiler rules. This phase resolved all 14 via a spike (P73-A) plus four scoped follow-on tracks:

- **11 rules adopted immediately** (P73-C) — 9 had zero findings, 2 had a handful fixed with a one-line suppression each (both judgment calls: don't restructure working code to satisfy a hypothetical future compiler pass).
- **`static-components` adopted** (P73-D) — found and fixed one real bug (a component defined inside its parent's render body, causing remount-on-every-render), suppressed two confirmed false positives (a registry-lookup pattern and a dynamic-tag-name pattern).
- **`refs` adopted** (P73-E) — classified 29 findings into 4 categories; centralized the codebase's dominant "ref mirrors latest value" idiom (16 findings, 9 files) into a new shared `useLatestRef` hook; fixed one real bug (a device-preview-frame width that never updated on window resize, now reactive via `useElementSize`); suppressed the rest with rationale (a React-documented cache pattern, a false positive through an opaque Mantine callback, and two deliberate low-risk exceptions).
- **`set-state-in-effect` NOT adopted** (P73-F) — full manual audit of all 42 findings across 36 files found zero real bugs; every site is a standard, often already-documented React pattern. Adopting would mean 42 near-identical suppressions for zero signal, so the rule stays off with the reasoning recorded for future reference.
- Unrelated to the rule work but landed alongside it: **P73-B**, a test-harness fix so `useTheme()` stops logging a spurious "outside `<ThemeProvider>`" warning in every component test.

Net result: 2 real bugs found and fixed, 1 dead ref deleted, 1 shared utility added, and a documented, defensible position on every one of the 14 new lint rules — 13 resolved one way or another, 1 deliberately declined. Every track that touched behavior was verified with the full automated suite (3775 tests) plus a live browser click-through against the local WP dev site. Nothing deferred; no further P73 work is planned.
