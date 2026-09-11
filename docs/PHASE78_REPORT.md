# Phase 78 - UI boundary, primitive bake-off, token model

**Status:** Planned, no code yet
**Created:** 2026-08-28 (as "UI facade")
**Last updated:** 2026-09-10 (re-planned after the user accepted the P77-E recommendation)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P78-A | Establish `src/ui/` and the import boundary: re-export surface plus an ESLint rule forbidding new direct `@mantine/core` imports outside it | Planned | Medium |
| P78-B | Primitive bake-off: build the same five components on Ark UI and Base UI, measured against fixed tests, and pick one | Planned | Small-Medium |
| P78-C | Extend the theme engine with the component-token tier and the framework constants the framework will read | Planned | Medium |

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

_None yet, phase is Planned._

## Outcome

_Pending._
