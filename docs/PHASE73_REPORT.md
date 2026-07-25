# Phase 73 - eslint-plugin-react-hooks v7 Rule Spike + various fSure ixes

**Status:** In Progress (P73-A, P73-B, P73-C done; P73-D–F planned)
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
| P73-D | Fix the `react-hooks/static-components` findings (components defined inside a parent's render body) | Planned | Small-Medium |
| P73-E | Fix/triage the `react-hooks/refs` findings (ref `.current` read/written during render) | Planned | Medium |
| P73-F | Triage the `react-hooks/set-state-in-effect` findings (42 across 36 files) into real-bug vs. legitimate-external-sync buckets, then decide adoption severity | Planned | Medium |

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
4. P73-D — small-medium, concentrated in 3 files.
5. P73-E — medium, touches a common codebase idiom across 12 files; needs a design call before fixing.
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

## Track P73-F - Triage `react-hooks/set-state-in-effect` Findings

### Problem

42 findings across 36 files — the broadest and noisiest of the 5 firing rules. Inspection of one sample ([KeyboardHintOverlay.tsx](../packages/shared-ui/src/KeyboardHintOverlay.tsx)) found a legitimate "sync with external browser state on mount" pattern, not a bug — meaning this rule's findings are very likely a mix of real cascading-render bugs and defensible effect usage. Adopting at `error` without review would either block on false positives or train the team to reflexively suppress the rule.

### Fix

This track is triage, not blind fixing:

1. Review all 42 findings (36 files) and bucket each as: real bug (fix), legitimate external-sync pattern (suppress with a comment explaining why, or restructure to make the intent clearer), or unclear (flag for a second look).
2. Fix the "real bug" bucket.
3. Decide the rule's final severity based on the resulting suppression count — if most sites end up suppressed, `warn` (or a scoped `off` with per-file `error` re-enables) may fit this codebase better than a blanket `error`.

### Acceptance criteria

- All 42 findings triaged with a documented disposition.
- Real bugs fixed; legitimate patterns have a suppression comment explaining why (not just a bare `eslint-disable`).
- A final severity decision recorded here once triage completes.

### Validation

- `npm run lint`, `npm run test:silent`, `npm run build`.

## Follow-On Candidates

None beyond P73-C–F — those cover all 5 rules that produced findings in the P73-A spike, and the 9 zero-finding rules are folded into P73-C.

## Implementation Notes

- P73-A, P73-B, and P73-C are complete; see their own Implementation Notes / Findings Catalog subsections above.
- P73-D–F are scoped but not started.

## Outcome

_(Summarize once P73-C–F land, or once a decision is made not to pursue some of them.)_
