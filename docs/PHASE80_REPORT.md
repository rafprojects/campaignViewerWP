# Phase 80 - Behavioural components

**Status:** Planned, no code yet
**Created:** 2026-09-10
**Last updated:** 2026-09-11 (P78-B picked Base UI 1.8.0; Decision D's gap list is now concrete)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P80-A | Overlays and the input family: the components the theme adapter fights hardest | Planned | Large |
| P80-B | Selection, navigation and choice controls: the select family, tabs, accordion, checkbox, switch, chip, segmented control, slider | Planned | Large |
| P80-C | Imperative managers: notifications and confirmations | Planned | Small-Medium |

---

## Rationale

1. **What this phase builds.** Every `@mullion/ui` component that handles a keypress. The provider, tokens, delivery and presentational primitives exist from Phase 79; the primitive library was chosen in P78-B. This phase wraps that primitive, thinly, and styles it from tokens.

2. **Why overlays and inputs go first.** Every one of Phase 76's five visual defects lived in this set, and so did P77-C's three dead state rules. If the framework's design is wrong, these are the components that reveal it, and they reveal it while the phase is small enough to change direction. The alternative, starting with the easy components, would prove nothing and would leave the hard cases to a phase with no slack.

3. **Why the wrapping stays thin.** The study's principle 6 is a limit, not a preference. The moment a wrapper starts writing its own combobox semantics or focus trap, it inherits the class of correctness problem this codebase has already demonstrated it gets wrong: P76-I-1 shipped 18 dead style blocks and a WCAG 2.4.7 failure, and two tests were green while asserting a code path that never rendered. Each place where the framework does write real interaction code is named in the study's section 4 and is reviewed as behaviour, not as styling.

4. **Success.** A focused control paints the two-tone ring on every theme and in every scope. A drawer opens in the overlay root, traps focus, dismisses on Escape and outside click, and returns focus to the trigger inside the gallery shadow root, which is a defect the product has today. A select's checked option takes its colour from a token rather than an inline style.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Compound parts or flat props? | **Both.** Compound parts where the primitive has them, plus a flat convenience component for the common case, because 26 files use the flat Mantine `Select` form and rewriting them into parts is migration cost with no benefit. The flat form is a wrapper over the parts, never a fork of them. |
| B | Does this phase migrate any consumers? | **No.** Components are built and proved in Storybook and tests. Consumers move in Phase 81. Mixing the two would make every component's completion contingent on a file migration, and would put pixel movement and behaviour change in the same diff. |
| C | How is a component proved done? | **Four gates:** the axe structural gate, the P77-F ring walk, the P79-B static sheet tests, and a manual keyboard pass recorded in `ACCESSIBILITY_MANUAL_AUDIT.md`. A component with green unit tests and no keyboard pass is not done. |
| D | What about components the primitive lacks? | **Named, owned and reviewed as behaviour.** Resolved 2026-09-11 by P78-B's pick of Base UI 1.8.0, so the gap list is no longer conditional: **pagination** (10 files), **tags input** (5 files) and **colour picker** (20 files). Pagination is a button list with roving focus and is cheap. Tags input is Base UI's `Combobox` plus chips. The colour picker is a saturation and hue surface and is a component in its own right, so P80-B should budget for writing or vendoring it rather than wrapping it. Each gap carries the same four gates. |
| E | Do the notification and confirmation managers keep their call shape? | **Yes.** `notify.show()` and `confirm()` mirror the 48 and 11 existing call sites, so Phase 81's migration of those sites is mechanical rather than a rewrite. |

## Execution Priority

1. **P80-A**, and it is the phase's real risk. Land it before anything else so a design problem surfaces early.
2. **P80-B** second, in the order the adapter fights hardest: select family first (P77-C's `data-checked` and the unforwarded `vars` both lived there), then tabs and segmented control, then the simple choice controls.
3. **P80-C** last and independently. It is small, it has no styling subtleties, and it can slip without blocking anything.

---

## Track P80-A - Overlays and the input family

### Problem

`Modal`, `Drawer`, `Popover`, `Tooltip` and `Menu` are where the shadow-plus-portal boundary bites, and `Input`, `TextInput`, `Textarea`, `PasswordInput`, `NumberInput` and `ColorInput` are where P76-D/H collapsed the borders and P76-I-1 killed the focus indicator. The adapter's single `Input` entry reaches six components at once because Mantine renders them all through one component, and reproducing that coupling is not a goal.

### Fix

Wrap the primitive's dialog, popover, tooltip and menu, taking the portal container from the provider rather than each call site. Wrap its field and input primitives, with our own label, description and error composition. `Textarea` autosize is ours; it is named in the study's section 4 as behavioural code we write.

Every state that used to need an inline colour is a token read by a data-attribute selector, per study principle 2.

### Acceptance criteria

- Each overlay renders in the overlay root, traps focus, dismisses on Escape and outside click, and returns focus to the trigger when the trigger is inside the gallery shadow root.
- The P77-B hostile-host probe passes: transformed ancestor, page scrolled 600px, sticky header at `z-index` 9999.
- Input borders resolve from tokens in both colour schemes and both theme modes, which is the P76-D/H regression.
- A focused input shows the focus border, and a focused control shows the two-tone ring, on all 23 themes.
- The four gates in Key Decision C, for every component.

### Validation

- `npx vitest run`, `npx playwright test` twice, `theme-qa` ring walk, the axe gate, and the recorded keyboard pass.

---

## Track P80-B - Selection, navigation and choice controls

### Problem

This is where P77-C found three rules that had never painted: a Select option rule targeting an attribute Mantine does not set, and Tabs and SegmentedControl colours outranked by the adapter's own inline styles. The components are also the ones with the most intricate keyboard contracts in the product.

### Fix

Wrap the primitive's listbox, combobox, select, tabs, accordion, checkbox, switch, toggle group and slider. `Chip` is a styled checkbox. The segmented control's moving indicator is ours and is named as behavioural code. Pagination is ours if the chosen primitive lacks it.

### Acceptance criteria

- A checked select option takes its colour from a token, and the rule survives a mutation of the attribute name, which is the P77-C guard generalised.
- Tabs and segmented control resting and active colours come from tokens, with no inline colour on the part, enforced by the P79-B static test.
- Keyboard contracts verified per component against the ARIA Authoring Practices: typeahead, roving focus, Home and End, page keys on the slider.
- The four gates in Key Decision C, for every component.

### Validation

- As P80-A, plus a per-component keyboard pass recorded in the manual audit.

---

## Track P80-C - Notification and confirmation managers

### Problem

`@mantine/notifications` is called from 21 files with 48 `show` calls, and `@mantine/modals` from 10 files with 8 `openConfirmModal`. Both are imperative stores with their own stylesheets, and both are thin.

### Fix

A `notify` store over the primitive's toast, and a `confirm()` over the framework's own dialog, both keeping the existing call shape so Phase 81's migration is a find and replace rather than a rewrite. Notification visuals are framework components reading tokens.

### Acceptance criteria

- `notify.show`, `update`, `hide` and `clean` cover every existing call site's options.
- `confirm()` covers the eight `openConfirmModal` shapes in use.
- Toasts render in the overlay root and are announced to assistive technology.
- The existing untranslated-notification gate still passes.

### Validation

- `npx vitest run` including the notification gate, plus an axe pass on a rendered toast and confirm dialog.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Migrating consumers onto these components | Phase 81, by Key Decision B. |
| `Table` as a behavioural component | It is presentational in this product; row selection keyboard support is a separate FUTURE_TASKS entry and a real a11y gap, and it should be fixed as a feature rather than smuggled into a migration. |
| Date pickers | `@mantine/dates` is a dependency but no date component appears in the measured import inventory. Confirm before Phase 81 and drop the dependency if genuinely unused. |
| Dropping `@mantine/hooks` | Seven hooks, about 150 lines. Cheap, and it can wait for Phase 81's removal track. |

## Implementation Notes

_None yet, phase is Planned._

## Outcome

_Pending._
