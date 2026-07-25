# Phase 73 - eslint-plugin-react-hooks v7 Rule Spike + various fixes

**Status:** Planned
**Created:** 2026-07-25
**Last updated:** 2026-07-25

This phase carries **two unrelated track groups**, bundled opportunistically rather than split into single-track phases:

- **Lint rule-set spike (P73-A)** — investigate adopting the rest of `eslint-plugin-react-hooks` v7's `recommended` config.
- **Test-harness fix (P73-B)** — `useTheme()` logs a "called outside `<ThemeProvider>`" warning in most component tests because the shared test wrapper never mounts a real provider; fix and verify.

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P73-A | Spike — catalog what adopting `eslint-plugin-react-hooks` v7's full `recommended` config (the React Compiler rule suite) would require | Planned | Medium |
| P73-B | Wrap the shared test harness in `<ThemeProvider>` so `useTheme()` consumers render with real context instead of the outside-provider fallback | Planned | Small |

---

## Rationale

While resolving an `npm audit` finding (brace-expansion DoS, GHSA-mh99-v99m-4gvg) by bumping `eslint` `^9.17.0` → `^10.8.0`, `eslint-plugin-react-hooks` had to move `^5.1.0` → `^7.1.1` — it's the only major with an `eslint ^10` peer range. v7's `recommended` config bundles 12 new rules beyond the classic `rules-of-hooks` + `exhaustive-deps` (the React Compiler-derived suite: `static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library`, `immutability`, `globals`, `refs`, `set-state-in-effect`, `error-boundaries`, `purity`, `set-state-in-render`, `unsupported-syntax`, `config`, `gating`).

A same-day smoke test (spreading the full `recommended` config into [eslint.config.js](../eslint.config.js) rather than the two explicit rules) surfaced **122 findings** across the hooks layer, from at least three rule types (`set-state-in-effect`, `refs`, `purity` — the run was reverted before a full catalog of all 14 rules' output was captured). That's real signal about the codebase's current hook hygiene, not noise, but it's a distinct body of work from a dependency bump and was deliberately kept out of scope in that session — see the "Dependency bump" note below. `eslint.config.js` currently pins only `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` explicitly to preserve pre-bump lint behavior.

Separately (same day, different thread), running the test suite surfaced repeated `useTheme() called outside <ThemeProvider>. Using fallback defaults. This may indicate a portal rendering issue.` warnings ([src/hooks/useTheme.ts:44-51](../src/hooks/useTheme.ts#L44-L51)). Investigation found the warning is benign (dev-only `console.warn`, doesn't fail tests) but structurally miscalibrated: [src/test/test-utils.tsx](../src/test/test-utils.tsx)'s shared `Providers` wrapper never mounts `<ThemeProvider>`, so every test rendering one of the real consumers (`ThemeSelector`, `SettingsPanel`, `LayoutBuilderModal`, `useBuilderOverlayColors`, `useBuilderShellColors`, `main.tsx`) hits the fallback path unconditionally — not the rare "portal edge case" the warning's own comment describes. Because it fires by default in every test, the warning can't currently do its actual job of catching a genuine theme-context-loss regression in production.

1. **What triggered it.** P73-A: the eslint 9→10 bump forced the react-hooks plugin major bump as a side effect, exposing a large, previously-invisible backlog of React Compiler rule violations. P73-B: routine test-suite observation during that same session.
2. **Why it belongs together.** No shared code or dependency — bundled only because both surfaced in the same working session and P73-B is small enough not to warrant its own phase. Same "batch opportunistic, independently-shippable work" shape as prior phases.
3. **Success.** P73-A: a ranked, categorized findings list (by rule, file, and estimated fix complexity) plus a recommendation per rule (adopt now / adopt with fixes as its own track / defer / suppress-and-revisit), landing as one or more follow-on tracks (P73-C, P73-D, …) added to this same report once the spike concludes. P73-B: the warning no longer fires from the shared test wrapper's own default shape, and it's verified capable of firing again if a real portal/context-loss regression is introduced.

**Dependency bump context:** the eslint 9→10 bump itself (plus the `@eslint/js` bump and the `rules-of-hooks`/`exhaustive-deps`-only config) landed outside phase tracking as a standalone dependency/security fix, not part of this or any prior phase. The two dead-initializer fixes it required (`src/services/pagination.ts`, `scripts/set-wp-jwt-secret.js`) are already merged.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Adopt the full v7 `recommended` config immediately, or spike first? | Spike first — 122 findings is too large a blast radius to fix blind, and some rules may warrant `warn` or per-file suppression rather than blanket `error`. |

## Execution Priority

No dependency between tracks — either order works.

1. P73-B — small, self-contained, quick to verify.
2. P73-A — the spike; produces follow-on tracks once done.

## Track P73-A - Recommended Rule Set Spike

### Problem

`eslint-plugin-react-hooks@7.1.1` is now the pinned plugin version (required for the eslint 10 peer range), but [eslint.config.js](../eslint.config.js) only enables the two rules that existed pre-bump. The other 12 rules in the plugin's `recommended` config — largely the rule set React ships to catch React Compiler incompatibilities and hook-purity violations — are installed but silent. We don't know:

- How many real findings each of the 12 rules produces against the current codebase.
- Which findings are genuine bugs (e.g. `refs`/`set-state-in-effect` catching real stale-closure or cascading-render patterns) versus stylistic/false-positive noise for this codebase's patterns (e.g. the widely-used "ref mirrors latest prop" idiom, which `react-hooks/refs` flags directly during render).
- Whether adopting some rules is a precondition for eventually turning on the React Compiler itself (not currently in use here), which would raise the value of doing this now vs. later.

### Goal of the Spike

Run each of the 12 non-adopted rules individually (not just the blanket `recommended` config) against the full `src/**` and `packages/shared-ui/src/**` trees, and produce a **ranked, per-rule findings catalog** capturing, for each rule:

- Finding count and file list.
- A sample of 3-5 representative findings with a quick read on whether they're a real bug, a stylistic false-positive for an established codebase idiom, or an intentional pattern that should be suppressed inline.
- Recommended disposition: **adopt now** (small/no fix backlog), **adopt as a dedicated fix track** (real bugs worth fixing, sized), **adopt at `warn`** (signal without blocking CI yet), or **defer/skip** (mostly noise for this codebase's patterns).
- Rough effort estimate if a fix track is warranted.

### Scope

- All 12 unadopted rules: `static-components`, `use-memo`, `preserve-manual-memoization`, `incompatible-library`, `immutability`, `globals`, `refs`, `set-state-in-effect`, `error-boundaries`, `purity`, `set-state-in-render`, `unsupported-syntax`, `config`, `gating`.
- `src/**/*.{ts,tsx}` and `packages/shared-ui/src/**/*.{ts,tsx}` (matches the existing `eslint.config.js` hooks-plugin file scope).
- Out of scope: actually fixing findings (that's the follow-on tracks this spike produces), and evaluating the React Compiler itself.

### Acceptance criteria

- A findings catalog (table or doc section) covering all 12 rules, each with a count, sample findings, and a disposition recommendation.
- At least one concrete follow-on track proposal per rule recommended for "adopt now" or "adopt as a dedicated fix track", added to this report as P73-C, P73-D, etc.
- `eslint.config.js` unchanged by this track — the spike is read-only investigation; any rule adoption happens in the follow-on tracks it produces.

### Validation

- Re-run `npm run lint` with each candidate rule temporarily enabled (one at a time, not the whole `recommended` block) to get isolated, attributable counts — the earlier smoke test enabled all 14 at once and couldn't cleanly attribute findings past the first three rule types.
- No code changes in this track, so no test/build validation needed beyond confirming the temporary lint runs don't get committed.

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

## Follow-On Candidates

To be populated from the spike's findings catalog (P73-C, P73-D, …). Do not promote a rule to a follow-on track without a concrete finding count and sample from the spike — the 122-finding smoke test number is a ceiling estimate, not a scoped task.

## Implementation Notes

_(Record spike progress and findings here as P73-A proceeds. P73-B is small enough to land and check off directly.)_

## Outcome

_(Summarize once the spike concludes and follow-on tracks are scoped.)_
