# Phase 78 - UI facade

**Status:** Planned — no code yet
**Created:** 2026-08-28
**Last updated:** 2026-09-10 (Key Decision E added after P77-E; no code yet)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P78-A | Establish `src/ui/` and the import boundary — re-export surface plus an ESLint rule forbidding new direct `@mantine/core` imports outside it | Planned — gated on Phase 77 | Medium |
| P78-B | Migrate the theming-critical components first — the ones the theme adapter actually fights with | Planned | Medium |
| P78-C | Migrate the remaining consumers, incrementally | Planned | Large |

---

## Rationale

1. **What triggered it.** The Phase 76 retrospective. The user's stated goal is not "remove Mantine" for its own sake — it is *"to allow for more ease to adjustments and expansions, and to minimize the chance of chaos if we need to make changes to a component of the app like we did with the color system."* A facade delivers exactly that, and it delivers it whether or not Mantine is ever replaced.

2. **Why it belongs together, and why after Phase 77.** Today **153 of 434** source files import `@mantine/core` directly across **44 distinct components** (~35% of the codebase). Any change to how a component is themed, styled or swapped has to be made in 153 places, which is precisely the chaos the user described. A facade converts that into one place.

   It runs after Phase 77 by explicit decision: P77-B may delete whole categories of workaround — if chrome renders inside the shadow root, `chrome-portable.scss`, `adminChromeStyles()` and the `--mullion-builder-*` bridge could all become unnecessary — and P77-E decides whether the facade is wrapping Mantine permanently or preparing to swap it. Drawing the boundary before those answers exist means guessing at what it must abstract.

3. **Why a facade rather than a replacement.** This is the middle path from P77-E, and it is expected to be the recommendation there. It buys the optionality without the rewrite: consumers stop depending on a third-party API, the theming contract from P77-A gets a natural home, and a future swap becomes a change behind a boundary instead of a 153-file migration. It is also **incremental by construction** — a strangler pattern needs no freeze and no big-bang diff.

4. **Success.** A developer changing how inputs are themed edits one file. `@mantine/core` appears only inside `src/ui/`. Nothing about the rendered product changes.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Facade before or after the Phase 77 spikes? | **After.** Agreed with the user 2026-08-28: *"the spikes must be done first before we do anything, including the facade."* |
| B | Before or after release? | **Before.** The user chose to settle the visual architecture ahead of shipping rather than build on top of it, and is explicitly not in a rush to release. Note this is a *preference*, not a technical necessity — the facade is purely internal, has no external contract, and would be no harder after release. Recorded so the trade is visible if priorities change. |
| C | Big-bang migration or incremental? | **Incremental, enforced at the boundary.** A-B-C below: create the layer, ban *new* direct imports with lint, migrate the theming-critical components, then let the long tail migrate. A half-migrated layer is only harmful if nothing prevents the two styles from mixing — the ESLint rule is what makes the intermediate state safe. |
| D | Does the facade re-implement behaviour, or only re-export? | **Re-export plus prop surface, no behaviour.** The moment the facade starts reimplementing focus management or overlay behaviour, it becomes the in-house library P77-E was supposed to decide on first. If P77-E recommends in-house, that is its own phase. |
| E | What did P77-E decide, and what does it change here? | **P77-E (2026-09-10) recommends an in-house component layer on headless primitives, migrated behind this facade**, with the primitive chosen by a spike and Mantine headless as the fallback ([UI_DEPENDENCY_EVALUATION.md](UI_DEPENDENCY_EVALUATION.md), [IN_HOUSE_UI_FRAMEWORK_STUDY.md](IN_HOUSE_UI_FRAMEWORK_STUDY.md)). P78-A is unchanged and lands first, as the user decided. P78-B and P78-C are to be re-planned as migrations onto the new components rather than re-exports of Mantine; until that re-plan they stand as written, and the "zero pixels move" rule applies to P78-A only. |

## Execution Priority

1. **P78-A** — the boundary is worth more than any migration. Once new code cannot import Mantine directly, the problem stops growing even if the tail takes months.
2. **P78-B** — the components the theme adapter fights with: the Input family, Checkbox, Switch, Table, Anchor, Drawer/Modal. These are where Phase 76's defects lived, so they benefit first and validate the design.
3. **P78-C** — the long tail, opportunistically, as files are touched for other reasons.

---

## Track P78-A - Establish `src/ui/` and the import boundary

### Problem

`@mantine/core` is imported directly in 153 files. There is no seam at which the component library could be configured, wrapped, or replaced.

### Fix

Create `src/ui/` exporting the components the app actually uses, initially as thin re-exports with our own prop surface where the Mantine prop is a poor fit. Add an ESLint rule (`no-restricted-imports`) forbidding `@mantine/core` outside `src/ui/`, with the existing 153 files allow-listed so the rule constrains *new* code from day one without requiring a big-bang migration.

Whatever the P77-A style contract concluded lives here — this is the natural home for "how a component gets themed".

### Acceptance criteria

- `src/ui/` exists and exports the components in current use.
- An ESLint rule fails on a new direct `@mantine/core` import outside `src/ui/`, verified by adding one deliberately.
- The allow-list shrinks monotonically — a test or lint config that makes re-adding an entry an explicit act.
- No rendered output changes. `theme-qa` baselines are untouched.

### Validation

- `npx vitest run`, `npx playwright test`, `npm run build`.
- `theme-qa` must show **zero** baseline changes. This track is a refactor; any pixel movement is a bug.

---

## Track P78-B - Migrate the theming-critical components

### Problem

The components the theme adapter manipulates are where every Phase 76 defect occurred: the Input family (`Input`, `TextInput`, `PasswordInput`, `Select`, `NumberInput`, `ColorInput`), `Checkbox`, `Switch`, `Table`, `Anchor`, and the overlay pair `Drawer` / `Modal`.

### Fix

Route these through `src/ui/` first, and move their adapter configuration behind the facade so the theming decisions and the components live together.

### Acceptance criteria

- No file outside `src/ui/` imports these components from `@mantine/core`.
- The P76-I guards still pass unchanged — the nested-selector check across 23 themes, and the painted-focus-ring e2e test.
- No rendered output changes.

### Validation

- The full unit and e2e suites, plus `theme-qa` with zero baseline changes.

---

## Track P78-C - Migrate the remaining consumers

### Problem

The long tail of the 153 files.

### Fix

Migrate opportunistically as files are touched for other reasons, shrinking the ESLint allow-list as it goes. This track has no deadline and should not block the phase from being considered successful.

### Acceptance criteria

- The allow-list is empty, or the residue is documented with a reason.

### Validation

- Full suites per batch; `theme-qa` zero baseline changes throughout.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Actually replacing Mantine | Only if P77-E recommends it. This phase deliberately makes that a later, cheaper decision rather than taking it now. |
| Re-implementing behaviour inside the facade | Explicitly out of scope — see Key Decision D. That is an in-house component library, which is a different phase and a different risk profile. |

## Implementation Notes

_None yet — phase is Planned._

## Outcome

_Pending._
