# Phase 78 - UI boundary, primitive bake-off, token model

**Status:** In progress
**Created:** 2026-08-28 (as "UI facade")
**Last updated:** 2026-09-11 (P78-A and P78-C landed; Decision J settles the shared-ui question)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P78-A | Establish `src/ui/` and the import boundary: re-export surface plus an ESLint rule forbidding new direct `@mantine/core` imports outside it | **Done** (2026-09-11), see notes | Medium |
| P78-B | Primitive bake-off: build the same five components on Ark UI and Base UI, measured against fixed tests, and pick one | Planned | Small-Medium |
| P78-C | Extend the theme engine with the component-token tier and the framework constants the framework will read | **Done** (2026-09-11), see notes | Medium |

---

## Rationale

1. **What this phase is now.** It was "UI facade" and it is now the decide-and-prepare phase for the in-house component framework. Phase 77 track E recommended building a component layer whose theme model, styling and API are ours and whose interaction behaviour is bought from a headless primitive library ([UI_DEPENDENCY_EVALUATION.md](UI_DEPENDENCY_EVALUATION.md)), and track H described what that framework takes ([IN_HOUSE_UI_FRAMEWORK_STUDY.md](IN_HOUSE_UI_FRAMEWORK_STUDY.md)). The user accepted both on 2026-09-10 and chose to do the work before release rather than after.

2. **Why these three tracks belong together.** They are the three things that must be true before a single framework component can be written, and none of them is the framework. A is the boundary that makes an incremental migration safe. B answers the one question the evaluation deliberately left open, because three candidates finished within three points of each other and the difference is not resolvable on paper. C puts the theme model in the engine, where the audits can see it, so the framework has something to read on its first day.

3. **Why the facade still comes first, and unchanged.** It was worth doing when the answer was "stay on Mantine" and it is worth more now. `@mantine/core` is imported directly in 142 non-test files. Without a boundary the migration is a 142-file diff that cannot be split; with one it is a series of small changes behind a stable import path, and the intermediate state where both implementations coexist is safe by construction. The user confirmed on 2026-09-10 that the facade lands first regardless of the outcome.

4. **Why the bake-off is a track and not a decision.** The evaluation scored Ark UI first, with Base UI and React Aria Components within three points. That gap is inside the judgement error of a 1-to-5 rubric, and the criteria that actually matter here are ones only a measurement can settle: does the primitive's overlay behave correctly inside our overlay root, does focus return reach a trigger inside the gallery shadow root, does the axe gate stay green, what does it cost in bytes. Picking on paper would be the same guess Phase 77 Key Decision A warned about.

5. **Success.** A developer cannot import `@mantine/core` in new code. The primitive is chosen with measurements on the record, including the one that lost. The engine emits a token for every affordance the framework will style, and the contrast audits cover those tokens rather than Mantine's variable names.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Facade before or after the Phase 77 spikes? | **After.** Agreed with the user 2026-08-28: *"the spikes must be done first before we do anything, including the facade."* Satisfied; Phase 77 is complete apart from P77-I. |
| B | Before or after release? | **Before, and now so is the whole framework.** The user chose on 2026-09-10 to build the component layer ahead of release rather than ship on Mantine and migrate for v2. Recorded as a deliberate trade: it moves the release out by several phases in exchange for shipping on the final architecture. The author's written recommendation was the opposite, and the user's call is on the record as theirs. |
| C | Big-bang migration or incremental? | **Incremental, enforced at the boundary.** Unchanged. The ESLint rule is what makes the intermediate state safe. |
| D | Does the facade re-implement behaviour, or only re-export? | **Re-export only, in this phase.** Behaviour arrives in Phase 80, from the primitive. The facade never becomes the place where interaction code accumulates. |
| E | What did P77-E decide, and what does it change here? | **An in-house layer on headless primitives.** P78-A is unchanged. The former P78-B and P78-C (migrate Mantine consumers behind the facade) are superseded: migration now targets the new components and lives in Phase 81. |
| F | Does the facade wrap Mantine or the primitive during the migration? | **Both, one name at a time.** A name in `src/ui/` resolves to the Mantine re-export until its framework component exists, then to the framework component. That is the strangler pattern the boundary exists to enable, and it is why A can land before B is decided. |
| G | Who picks the primitive if the bake-off is close? | **The measurements decide, and a tie goes to coverage.** Ark UI has a direct counterpart for every behavioural component in use; Base UI lacks pagination, tags input and colour picker. If the fixed tests do not separate them, the coverage gap is the tiebreak, because each gap is a component we would write and own. |
| H | Does `src/ui/` own Mantine's theme plumbing as well as its components? | **No.** Eleven of the 75 `@mantine/core` symbols are theme plumbing: `MantineProvider`, `useMantineTheme`, `mergeThemeOverrides`, `mergeMantineTheme`, `DEFAULT_THEME`, `defaultCssVariablesResolver`, `convertCssVariables`, `colorsTuple`, `MantineThemeOverride`, `MantineColorShade` and `MantineTheme`. They are adapter concerns owned by `src/themes/` and `src/portalTarget.ts`, which Phase 81 deletes or rewrites. Routing them through the component surface would hand the framework an API it has no use for. They sit on the allow-list instead. Settled while building P78-A. |
| I | Does the boundary cover the test suite and `packages/shared-ui`? | **Both, with their files allow-listed.** Agreed with the user 2026-09-11. Exempting either by path would let its Mantine surface grow silently, and the allow-list would stop reflecting what is actually left. `packages/shared-ui` cannot import `@/ui` today (see the P78-A notes), so its six entries can only clear when Phase 81 restructures the package: that is a real dependency, and it is better visible on the list than hidden behind an exemption. |
| J | Does `packages/shared-ui` survive, and does the framework become a package? | **Neither. The package is dissolved and `@/ui` stays a lint-enforced app directory.** Decided with the user 2026-09-11, once P78-A found the package boundary blocking the migration. The evidence is one-sided: the app resolves `@mullion/shared-ui` to *source* in both `vite.config.ts` and `tsconfig.json`, no CI workflow builds or publishes any workspace package, `dist/` is gitignored, and four of its six components already keep their tests in `src/`. The boundary had no consumer and no build, and it cost an isolated `tsconfig.build.json` with a `paths` override, a `prepack` chain, and the blocker. Its six Mantine components move to `src/components/` beside those tests; `RootIdContext` and `CanvasTransformContext` move to `shared-utils`, which already declares React as a peer. `LoginForm`, `SpaceSwitcher` and the two `AuthBar` variants do **not** become `@/ui` components: they carry domain concepts, and a framework whose surface starts with them has no usable definition of "framework component". The Host Decoupling entry's own proposal is to make decoupling "a lint rule rather than a judgement call", which is exactly what P78-A built, so that guarantee survives the package's removal. Extracting `@mullion/ui` later out of a lint-enforced directory stays cheap if an external consumer ever appears. Execution is the first step of P81-B. |

## Execution Priority

1. **P78-A** first. Once new code cannot import Mantine directly the problem stops growing, and that is true whatever B decides.
2. **P78-B** next, and it is the gate for Phase 79. Nothing in the framework can be built against an unchosen primitive.
3. **P78-C** beside B. It touches the engine and not the app, so it does not compete for the same files, and Phase 79 needs it on day one.

---

## Track P78-A - Establish `src/ui/` and the import boundary

### Problem

`@mantine/core` is imported directly in 142 non-test source files of 357, across 73 distinct symbols. There is no seam at which the component library could be configured, wrapped, or replaced, so every change to how a component is themed is a change in 142 places.

### Fix

Create `src/ui/` exporting the components the app actually uses, initially as thin re-exports with our own prop surface where the Mantine prop is a poor fit. Add `no-restricted-imports` forbidding `@mantine/core`, `@mantine/hooks`, `@mantine/modals`, `@mantine/notifications` and `@mantine/form` outside `src/ui/`, with the existing files allow-listed so the rule constrains new code from day one without a big-bang migration.

The allow-list is data, not prose: a generated file with a test asserting it only shrinks, so re-adding an entry is an explicit act with a diff.

### Acceptance criteria

- `src/ui/` exists and exports the components in current use.
- A new direct `@mantine/core` import outside `src/ui/` fails lint, verified by adding one deliberately.
- The allow-list shrinks monotonically, enforced by a test.
- No rendered output changes. `theme-qa` shows zero baseline movement.

### Validation

- `npx vitest run`, `npx playwright test`, `npm run build`, `npm run lint`.
- `theme-qa` must show **zero** baseline changes. This track is a refactor; any pixel movement is a bug.

---

## Track P78-B - Primitive bake-off

### Problem

The evaluation scored Ark UI 82, Base UI 79 and React Aria Components 79 of 95 under the user's weights. Three points is inside the noise of the rubric, and the decisive properties are behavioural: how each behaves inside the overlay root, across the shadow boundary, and under the accessibility gate. Those cannot be read off a repository.

### Fix

Build the same five components twice, once on Ark UI and once on Base UI, on two throwaway branches that are both discarded. React Aria Components is the third candidate and is built only if one of the first two fails outright.

The five, chosen because each exercises something the others do not: a **Drawer** in the overlay root (portal container, focus trap, scroll lock), a **Select** with a portaled listbox (the P77-C state-attribute problem, a nested portal inside a portal), a **Slider** (pointer and keyboard interaction, a thumb that must carry the ring), a **NumberInput** (spin buttons, formatting, locale), and **Tabs** (roving focus, the P77-C active-state colour).

Measure against tests that already exist and already caught real defects, not impressions:

| Measurement | Source |
|-------------|--------|
| The style-delivery guards still hold for the new components | `src/styles/__tests__/styleDelivery.test.ts`, `e2e/style-delivery.spec.ts` |
| The focus ring pair paints, core and halo, on every ring | the P77-F ring walk in `e2e/theme-qa.spec.ts` |
| Overlays survive a hostile host page | the P77-B probe: transformed ancestor, page scrolled 600px, sticky header at `z-index` 9999 |
| Focus returns to a trigger inside the gallery shadow root | new; this is the defect Mantine has today |
| Outside-click and Escape cross the boundary | the P77-B dismissal checks |
| The axe gate stays green | `src/test/axe.ts`, the existing structural gate |
| Bytes | esbuild, the same method as the evaluation's section 4.3 |

Record the losing branch's measurements in this document. A bake-off whose loser is undocumented cannot be re-run when the question comes back.

### Acceptance criteria

- Both branches build all five components and every measurement above is recorded for each.
- A written pick with the measurement that decided it, and the coverage tiebreak applied if the measurements do not separate them.
- Both branches deleted. No bake-off code is merged.
- If both candidates fail the boundary tests, the recorded outcome is the P77-E fallback (Mantine headless behind the same facade) and Phase 79 is re-planned against it.

### Validation

- The measurements are the validation. This track merges no production code.

---

## Track P78-C - Component tokens and framework constants in the engine

### Problem

The theme adapter currently holds 31 component override blocks that derive per-component colours from the resolved palette: the checkbox border from `borderStrong`, tab colours from `textMuted` and `text`, option checked colours from `primaryFill` and `primaryOnFill`, input focus from `primaryStroke`. Those derivations are real theme decisions living in a translation layer, which is why `uiContrastAudit` has to know which Mantine variable an affordance reads in order to audit it.

The framework will read tokens, not an adapter. The derivations have to move to where the audits can see them before there is anything to read.

### Fix

Add two tiers to `generateCssVariables` beside the existing role tokens, as described in the study's section 3.3:

- **Component tokens**, derived from role tokens by the engine: input border and focus border, control heights, tab colour and active colour, option checked background and foreground, menu hover, switch track, checkbox border, table hover. A theme JSON may override one explicitly, which is what `ThemeDefinition.components` becomes.
- **Framework constants**, fixed rather than per-theme: focus ring width and halo width, motion durations, the layer scale including a host-safe layer the embed can set from PHP so the WordPress admin bar stops covering the drawer header.

**Backlog cleanup owned by this track.** The host-safe layer token is the fix for the FUTURE_TASKS accessibility entry "WordPress Admin Bar Covers the Settings Drawer Header for Logged-In Users". The token lands here and the framework reads it in P79-C, so the entry is deleted once the drawer actually clears the bar, which is P79-C rather than this track. Leave it in place until then and note the removal in the update log when it goes.

Re-point `uiContrastAudit` at the component tokens it now has names for, keeping the P77-F pair guarantee and its zero exceptions.

### Acceptance criteria

- Every component token is emitted for all 23 bundled themes and covered by `cssVariables.test.ts`.
- The 1.4.11 audit reads component tokens where they exist, keeps the P77-F ring-pair checks, and still has zero exceptions across 23 themes.
- Nothing in the app reads the new tokens yet, and no rendered output changes. `theme-qa` shows zero baseline movement.
- The adapter is untouched in this track. It is deleted in Phase 81, not weakened here.

### Validation

- `npx vitest run` including the engine's own suites; `theme-qa` with zero baseline changes.
- Mutation check: removing a derivation from the engine must fail the audit, not merely change a value.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| The framework itself | Phase 79. It cannot start before B picks the primitive and C lands the tokens. |
| Migrating any consumer onto a framework component | Phase 81. Nothing exists to migrate onto yet. |
| Deleting `adapter.ts`, `chromeTheme.ts`, `chrome-portable.scss` | Phase 81, with the removal track. Each is load-bearing until its replacement ships. |
| Publishing `@mullion/theme-engine` as a standalone package | The engine is already framework-neutral with zero runtime peers, so this is cheap. It is a product decision rather than an engineering one, and belongs after the framework proves the token model. |

## Implementation Notes

### P78-A (2026-09-11)

**Status: landed.** Surface in [`src/ui/index.ts`](../src/ui/index.ts) with its contract in [`src/ui/README.md`](../src/ui/README.md), the rule in `eslint.config.js`, the allow-list generated by `scripts/mantine-boundary.mjs` into `eslint-rules/mantine-boundary-allowlist.json`, and the ratchet in `src/ui/__tests__/mantineBoundary.test.ts`. Nine mutations applied and caught, plus a negative control that stays clean. No component file was touched.

**What the measurement changed about the plan.**

| Plan said | Measured |
|-----------|----------|
| 142 non-test files import `@mantine/core` | Exactly 142, of 415 non-test `.ts`/`.tsx` files under `src/` and `packages/*/src/`. The plan's denominator of 357 counted `src/` only. |
| 73 distinct symbols | 75. Both numbers count `@mantine/core` alone. |
| The boundary restricts five packages | The same five, but the surface they describe is much larger than the core-only figure: **178 files**, 154 of them non-test, once `@mantine/hooks` (12), `@mantine/modals` (10), `@mantine/notifications` (22), `@mantine/form` (1) and the test and mock files are counted. That is where the allow-list starts. |
| Nothing about `@mantine/dates` | A declared dependency with zero importers anywhere, including e2e and stories. Left unrestricted on the user's call, because a rule with no subject is noise; filed instead against P81-D, which now names it in the list of packages to drop. |
| The facade re-exports "the components the app actually uses" | Eleven of the 75 symbols are not components at all but Mantine theme plumbing, and they are excluded. See Decision H. |
| Nothing about `packages/shared-ui` | It is a publishable package with `@mantine/core` and `@mantine/form` as declared `peerDependencies`, and its isolated `tsconfig.build.json` overrides `paths` to resolve only `@mullion/shared-utils`. It structurally cannot import `@/ui`, so its six files cannot be migrated by any amount of work in this phase. Covered by the rule and allow-listed anyway, per Decision I, and recorded against P81-B. |

**The surface.** `src/ui/index.ts` names 70 values and 7 types, grouped by role, every one a re-export. Three vendor-named types are renamed at the boundary, because nothing imports `@/ui` yet and establishing the framework's own names now is cheaper than doing it after 154 consumers have spelled Mantine's: `MantineSize` becomes `UiSize`, `MantineTransition` becomes `UiTransition`, `Primitive` becomes `UiPrimitiveValue`. Everything else keeps a name the framework would have chosen anyway. `tsc -b` resolves all 77, which is the check that the surface is real rather than a list of guesses.

**The ratchet.** The plan asked for "a generated file with a test asserting it only shrinks", and a list alone cannot assert that: a test with no memory of yesterday can only see today. The allow-list therefore carries a `maxFiles` number beside the file list. The generator lowers it to match reality and never raises it, so a new direct import fails the boundary test even after regenerating, until someone edits the number by hand. That is the "explicit act with a diff" the plan asked for, made mechanical.

Detection is deliberately a superset of what ESLint flags: any module specifier reaching a restricted package from an `import`, `export`, dynamic `import()` or `typeof import()` position, **plus module mocks**. An allow-list entry the rule would not have demanded is harmless; a missing one would be a hole. The generator and the test share one detector module so the two can never drift.

The mocks were the last thing found and they changed the number. Seven test files name a Mantine package only through `vi.mock('@mantine/notifications', ...)` and never import it, so neither ESLint nor a specifier scan sees them, and the first version of the list put them outside the boundary entirely. They are real coupling: a mock of a package that no longer exists throws at run time, so each one is work Phase 81 has to do. Counting them moved the list from 171 to 178 and makes "the allow-list reaches zero" mean what P81-D needs it to mean.

**Mutations.**

| Guard | Mutation applied | Result |
|-------|------------------|--------|
| the rule | new file importing `Button` from `@mantine/core` | error naming `@mantine/core`, pointing at `src/ui/README.md` |
| the rule, subpaths | `@mantine/core/styles.css?inline` and `@mantine/notifications` in a new file | both flagged; the CSS side-effect import in `shadowStyles.ts` is a real boundary crossing and the `<pkg>/*` pattern catches it |
| the rule, types | `import type { SelectProps }` and `export type { NumberInputProps } from '@mantine/core'` | both flagged, which matters because the type surface is the easiest leak to miss |
| the rule, negative | the same file importing `Button` from `@/ui` | clean |
| allow-list completeness | deleted `src/App.tsx` from the list | test fails naming it; `eslint src/App.tsx` reports 3 errors |
| stale entries | added `src/nope.tsx` to the list | test fails naming it |
| the ratchet | added a genuinely new importer, then regenerated | list grows to 179, ratchet holds at 178, test fails |
| the ratchet, mocks | added a file whose only Mantine reference is `vi.mock`, then regenerated | same: 179 against a ratchet of 178, test fails |
| barrel confinement | a second Mantine-importing file inside `src/ui/` | test fails naming it |
| `--check` | the same new importer, list not regenerated | exits 1 with the regenerate instruction |

**A stated limitation.** The allow-list is file-level, not import-level, so a file already on it can add a *new* Mantine import freely. ESLint also cannot see a mock, so a brand-new mock-only test file passes lint and is caught by the ratchet rather than at the point of writing. Import-level granularity would mean recording every specifier per file and regenerating on every edit, for a guard against a case that a reviewer sees anyway: the file is already known to be unmigrated. The ratchet makes the population monotonic, which is the property the phase actually needs.

**Rendered output.** Zero, by construction rather than by measurement: the diff adds `src/ui/`, a script, a generated JSON file, two npm scripts and an ESLint block, and modifies no file that produces markup, styles or theme values. Nothing imports `@/ui` yet. `theme-qa`'s baselines cannot move because there is no code path to move them, and the run confirms it.

**Validation.** Run at CI parity on the final tree: `npm run lint` clean, `npx tsc --noEmit` clean, `npm run ui:allowlist:check` green at 178 files, `npm run test:coverage` 3,940 of 3,940 across 261 files with every threshold met (statements 86.1, branches 74.91, functions 82.12, lines 88.15), `npx playwright test` 46 of 46 with no snapshot differences, and `npm run build` clean (`tsc -b` and Vite, with only the pre-existing chunk-size warnings).

`theme-qa` is 24 of those 46 and reported no baseline movement, which is the criterion this track was actually measured against.

**One defect found and fixed during the track.** The boundary test first listed `src/ui/` with `fs.globSync`, which arrived in Node 22, while all five CI workflows pin Node 20. It passed locally on Node 24 and would have thrown on the first push. Replaced with a walker exported from the detector module, and the mutation re-run confirms the rewritten guard still bites. The guard now also asserts that the walk found `src/ui/index.ts`, so an empty listing cannot pass the check vacuously.

**CI.** `npm run ui:allowlist:check` joins the fast-fail lint job beside `i18n:check`, on the same reasoning: `npm run lint` enforces the boundary and the vitest ratchet keeps the list shrinking, but neither notices a list that is merely stale.

### P78-C (2026-09-11)

**Status: landed.** The tier is in [`packages/theme-engine/src/componentTokens.ts`](../packages/theme-engine/src/componentTokens.ts), emitted by `generateCssVariables`, covered by `componentTokens.test.ts` across all 23 bundled themes, and read by `uiContrastAudit`. 38 new custom properties: 17 derived component tokens, 5 control heights, 16 framework constants. Four mutations applied and caught. **`src/themes/adapter.ts` is untouched**, as the track requires.

**What the measurement changed about the plan.**

| Plan said | Measured |
|-----------|----------|
| The adapter holds 31 component override blocks in 601 lines | Both exact. |
| "A theme JSON may override one explicitly, which is what `ThemeDefinition.components` becomes" | **Not that field.** `adapter.ts:568` reads `def.components` as *Mantine* overrides and is load-bearing until Phase 81, so repurposing it would break the adapter while it is still the thing that paints. A separate `componentTokens` field was added instead; the two coexist and P81 deletes `components` with the adapter. No bundled theme uses either field today, so nothing had to migrate. |
| Component tokens include "menu hover" | **No derivation exists to lift.** The adapter has no menu hover rule; Mantine's default supplies it. The surface ladder cannot express one either, because a menu dropdown already sits at `surfaceRaised`, the top rung, so there is nothing above it to step to. Emitted as an alpha overlay of the text colour, which matches how `Table.tr` already uses `withAlpha`. This is the one token in the tier that is a new decision rather than a lift, and no designer has seen it. |
| Component tokens include "control heights" | **Also not a derivation**: no role token describes a height. Measured Mantine's `--input-height-*` and `--button-height-*` from the installed stylesheet rather than recalled, found they agree exactly on all five rungs, and carried that scale as an overridable default with the `var(--mantine-scale)` multiplier dropped. |
| Nothing about dropdown grounds | `menu-bg` and `menu-bd` had to be added. Three of the nine existing audit checks measure an affordance against `surfaceRaised`, and without a token for that ground the audit could only name half of each pair. Both are straight lifts from the adapter's `Menu` and `Select` dropdown blocks. |

**Why the audit stayed at zero exceptions.** Re-pointing it was a rename, not a re-measurement: every component token resolves to the same colour the role-token form was already checking, so the six value pairs are preserved exactly.

| Was | Is now | Same pair? |
|-----|--------|-----------|
| `primaryStroke` on `surface` | `tab-indicator-color` on `surface` | yes |
| `primaryStroke` on `surface2` | `input-bd-focus` on `input-bg` | yes |
| `primaryStroke` on `surfaceRaised` | `primaryStroke` on `menu-bg` | yes |
| `borderStrong` on `surface` | `checkbox-bd` on `surface` | yes |
| `borderStrong` on `surface2` | `input-bd` on `input-bg`, and `switch-track-bd` on `switch-track-bg` | yes, both |
| `borderStrong` on `surfaceRaised` | `input-bd` on `menu-bg` | yes |

The three P77-F ring-pair checks are unchanged and stay on role tokens, because the ring is framework geometry rather than a component's own affordance.

**Mutations.**

| Guard | Mutation applied | Result |
|-------|------------------|--------|
| the audit reads the tier | `checkbox-bd` derivation weakened from `borderStrong` to `border` | 20 failures across the bundled themes, which is the track's "must fail the audit, not merely change a value" |
| token completeness | deleted the `table-hover-bg` derivation | emission test fails, and `tsc` fails too because the audit's key type no longer admits it |
| constants are fixed | `focus-halo-width` set to `0px` | the P77-F geometry test fails |
| namespace parametrization | hardcoded `--mullion` in the layer `calc()` | the custom-prefix test fails |

**Two defects I introduced and caught.** The layer scale first wrote `calc(var(--mullion-layer-host-offset, 0) + N)` with the prefix hardcoded, which would have left every external consumer of this package unable to escape its host chrome, since P51-L parametrized the namespace precisely so they can pick their own. Fixing it by importing `DEFAULT_CSS_VAR_PREFIX` then created a runtime import cycle between `componentTokens` and `cssVariables`; `tsc` was happy with it because the other direction is type-only. The prefix is a required argument now, which removes both.

**One stale pointer fixed.** `uiContrastAudit`'s docstring sent readers to `src/styles/global.scss` for the focus-ring block. P77-A moved it to `chrome-portable.scss`, and the comment had not followed.

**Rendered output.** The emitted variable block grows by 38 declarations per theme and nothing reads any of them: no component, stylesheet or adapter references a new name. Unused custom properties do not paint, and `theme-qa` confirms it: 24 of 24 with no snapshot differences.

**Validation.** Run at CI parity: `npm run lint` clean, `npx tsc --noEmit` clean, `npm run ui:allowlist:check` green at 178 files, `npm run test:coverage` 4,019 of 4,019 across 262 files with every threshold met (statements 86.15, branches 74.95, functions 82.21, lines 88.19), `npx playwright test` 46 of 46. The suite grew by 79 tests in one file, which is the 76 new token tests plus the three the audit gained.

## Outcome

_Pending._
