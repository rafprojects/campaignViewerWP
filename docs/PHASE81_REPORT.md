# Phase 81 - Consumer migration and Mantine removal

**Status:** Planned, no code yet
**Created:** 2026-09-10
**Last updated:** 2026-09-11 (P78-A measurements folded into B and D; Decision J gives B a batch zero)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P81-A | Style props and the size and variant scales: the mechanical bulk of the migration | Planned | Large |
| P81-B | Migrate the consumers, theming-critical surfaces first | Planned | Large |
| P81-C | Test, story and e2e harness migration | Planned | Medium |
| P81-D | Remove Mantine and delete the workarounds it required | Planned | Small-Medium |

---

## Rationale

1. **What this phase is.** The framework exists after Phase 80 and nothing uses it. This phase moves 142 files onto it, then deletes what it replaced. It is the largest phase by file count and the least interesting by design content, which is exactly why it is separated: mixing it into Phase 80 would have put "does this component work" and "did this screen change" in the same diff.

2. **Why the style props are their own track.** They are the single largest mechanical cost of leaving Mantine, and they are independent of which components exist.

   | Surface | Count |
   |---------|-------|
   | Mantine style props (`gap`, `c`, `fw`, `mb`, `py`) | 1,535 |
   | Literal `size`, `variant`, `radius`, `color` props | about 1,500 |
   | Files importing `@mantine/core` | 142 of 357 non-test |
   | Test files rendering through the Mantine provider wrapper | 117 |
   | Storybook stories with the Mantine decorator | 16 |
   | e2e specs using Mantine class selectors | 3 |

   This cost is identical under any replacement, including Mantine's own headless mode, which is why the evaluation treated headless Mantine as a fallback rather than a cheaper route.

3. **Why removal is a track and not a side effect.** `adapter.ts`, `chromeTheme.ts`, `chrome-portable.scss`, `AdminChromeProvider`, `adminChromeStyles()` and the `--mullion-builder-*` bridge are load-bearing until the last consumer moves. Deleting them is a deliberate step with its own verification, and several of the P77-A guards are written against a world where they exist and must be retargeted rather than deleted.

4. **The release gate.** The user decided on 2026-09-10 that release does not wait for full removal: it waits for the framework, the behavioural components and the theming-critical surfaces, with the long tail migrating behind the facade afterwards. P81-A, P81-B's first wave and P81-C are therefore pre-release; P81-B's tail and P81-D may land after. That is what the facade's ESLint boundary exists to make safe.

5. **Success.** `@mantine/*` appears in no `package.json`, or appears with a written reason and a shrinking allow-list. The theme adapter is gone. No screen changed except where the designer intended it to.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Does the release wait for full removal? | **No.** User decision, 2026-09-10: ship when the visible surfaces are migrated; the long tail follows behind the facade. Recorded because it is the decision that lets Phase 82 start before this phase ends. |
| B | Pixel parity or refresh? | **Refresh, with the designer.** User decision, 2026-09-10. `theme-qa` baselines are recaptured per surface as the refresh lands, so a moved pixel is evidence to review rather than an automatic failure. This is the one phase where the Phase 78 rule "a refactor moves zero pixels" does not apply, and saying so explicitly is what keeps that rule meaningful everywhere else. |
| C | Codemod or by hand? | **Codemod for the mechanical props, by hand for the rest.** `gap`, `align`, `justify`, `wrap`, `p` and the spacing props map directly and are worth automating across 1,535 occurrences. Colour and typography props (`c`, `fw`, `fz`) become `Text` variants or classes and need judgement. |
| D | What happens to the 3 e2e specs using Mantine class selectors? | **Retargeted to our own stable attributes**, not to the framework's internal class names. An e2e selector that depends on a library's generated class is the same fragility in a new costume. |
| E | Does `@mantine/hooks` go too? | **Yes, by default.** Seven hooks in 12 files, about 150 lines to own, and keeping one styling-free Mantine package for that is not worth the dependency. Reversible if the migration finds a hook that is harder than it looks. |

## Execution Priority

1. **P81-A** first. It is mechanical, it touches almost every file, and doing it before the component swap means each file is touched once for props and once for imports rather than churned twice in one diff.
2. **P81-B** next, theming-critical surfaces first: the Settings panel, the Layout Builder chrome and the admin panel, because those are where Phase 76's defects lived and where a regression is most likely.
3. **P81-C** alongside B, per batch. A migrated component with an unmigrated test harness is untested.
4. **P81-D** last, and only when the allow-list is empty or its residue is documented.

---

## Track P81-A - Style props and the size and variant scales

### Problem

1,535 Mantine style props and about 1,500 literal `size`, `variant`, `radius` and `color` props are spread across the component tree. The framework deliberately does not reproduce Mantine's full style-prop surface, so these cannot be carried over unchanged.

### Fix

A codemod for the direct mappings onto the framework's layout primitive props, which render as inline custom properties. Colour and typography props become `Text` variants or classes. The `size` and `variant` scales are the designer's to set, and the mapping from Mantine's scale to ours is written down once and applied uniformly rather than decided per file.

### Acceptance criteria

- No file outside `src/ui/` uses a Mantine style prop.
- The scale mapping is a document plus a codemod, not 3,000 individual judgements.
- Every batch passes the full suites, with `theme-qa` diffs reviewed rather than auto-accepted.

### Validation

- `npx vitest run`, `npx playwright test`, `theme-qa` with a reviewed diff per batch.
- The P77-C lesson applies: `theme-qa` tolerates a 0.1 pixel-diff ratio, so a batch must be reviewed with an explicit pixel diff rather than trusted to a green run.

---

## Track P81-B - Migrate the consumers

### Problem

142 non-test files import `@mantine/core` across 75 symbols. Counting the other four restricted packages and the test and mock files, the P78-A allow-list starts at 178 entries, 24 of which are test files and seven of those coupled only through a `vi.mock` call that no import scan sees. The facade means they can move in any order, and the order should be risk-first.

Six of those entries are in `packages/shared-ui`, and they are not an ordering problem. Its isolated `tsconfig.build.json` overrides `paths` to resolve only `@mullion/shared-utils`, so it cannot import `@/ui` at all: those six files cannot be migrated in place by any amount of work. **Phase 78 Decision J settled this on 2026-09-11: the package is dissolved rather than kept.** It resolves to source in `vite.config.ts` and `tsconfig.json`, no workflow ever builds or publishes it, and four of its six components already keep their tests in `src/`, so the boundary had no consumer and no build while costing the blocker.

### Fix

**Batch zero: dissolve `packages/shared-ui`.** Move `LoginForm`, `Lightbox`, `KeyboardHintOverlay`, `SpaceSwitcher`, `AuthBarFloating` and `AuthBarMinimal` into `src/components/` beside the tests that already live there (`Auth/`, `Galleries/Shared/`), move `RootIdContext` and `CanvasTransformContext` into `shared-utils`, and delete the package with its build config and `prepack` chain. This clears no allow-list entries by itself, since the six files still import Mantine at their new paths, but it is the prerequisite that makes them migratable at all. Per Decision J, `LoginForm`, `SpaceSwitcher` and the `AuthBar` variants land in `src/components/` and not in `@/ui`.

Then batch by surface, not by component. Settings panel, Layout Builder chrome, admin panel, then the gallery and viewer surfaces, then the wp-admin Spaces and Assets apps. Each batch shrinks the ESLint allow-list, which the P78-A test requires to be monotonic.

### Acceptance criteria

- The allow-list shrinks with every batch and never grows.
- `packages/shared-ui` is gone, its eight modules rehomed, and the allow-list paths updated to match before the first surface batch.
- Per batch: full suites green, axe gate green, and a keyboard pass on any surface whose interaction changed.
- The wp-admin apps work with WordPress styles present and without a global reset, which is the P77-E criterion C10.

### Validation

- Full suites per batch, plus the manual wp-admin pass from P77-B's validation for any batch touching admin surfaces.

---

## Track P81-C - Test, story and e2e harness migration

### Problem

117 test files render through a wrapper that mounts `MantineProvider` and `ModalsProvider`, 16 stories use the Mantine decorator, and 3 e2e specs select on Mantine class names. None of these is production code, and all of them block removal.

### Fix

Re-point `src/test/test-utils.tsx` at `MullionProvider`, keeping the global `CloseButton` accessible-name default the axe tests mirror. Re-point the Storybook decorator. Retarget the e2e selectors at our own stable attributes.

### Acceptance criteria

- No test utility, story or spec imports `@mantine/*`.
- The axe gate covers the same surfaces as before, at minimum.
- The structural a11y gate's existing coverage does not shrink.

### Validation

- `npx vitest run`, `npx playwright test`, `npm run build-storybook`.

---

## Track P81-D - Remove Mantine and delete the workarounds

### Problem

Six pieces of this codebase exist only to make Mantine fit: `adapter.ts` (601 lines, 31 override blocks), `chromeTheme.ts` (162 lines), `chrome-portable.scss` (117 lines), `AdminChromeProvider`, `adminChromeStyles()`, and the `--mullion-builder-*` inline bridge. Several P77 guards are written against their existence.

### Fix

Delete them, drop `@mantine/core`, `@mantine/hooks`, `@mantine/modals`, `@mantine/notifications` and `@mantine/form` from `package.json`, and remove Mantine's stylesheet imports from `main.tsx` and `shadowStyles.ts`.

`@mantine/dates` goes too, and it can go at any time: P78-A found it has zero importers anywhere in `src/`, `packages/`, `e2e/` or the stories, so it is a dependency the tree already does not use. It is excluded from the P78-A lint rule for the same reason, a rule with no subject being noise.

Retarget rather than delete the guards that still describe something true: the style-delivery tests, the P77-F ring walk and the 1.4.11 audit all continue to hold, against framework tokens instead of Mantine variables. Delete only the guards whose subject is gone, such as the `styles`-prop flatness tests, and say so in this document so their absence is not later read as a gap.

### Acceptance criteria

- No `@mantine/*` in `package.json` or in any import, or a written reason and a shrinking allow-list for any residue.
- The P77-A delivery guards, the P77-F ring walk and the 1.4.11 audit all still pass, retargeted.
- Every deleted guard is listed here with why its subject no longer exists.
- Bundle measured before and after, so the change is a number rather than an expectation.

### Validation

- Full suites twice, `npm run build`, `npm run size-check`, and a rebuilt plugin checked on the dev site.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Publishing `@mullion/ui` | A product decision, and it converts an internal API into a public commitment. Worth deciding after the framework has shipped in the product, not before. |
| Dropping `@mantine/dates` | Listed in Phase 80's follow-ons; confirm it is genuinely unused before removing. |
| Row-selection keyboard support in `Table` | A real a11y gap with its own FUTURE_TASKS entry. Fix it as a feature, not inside a migration batch. |

## Implementation Notes

_None yet, phase is Planned._

## Outcome

_Pending._
