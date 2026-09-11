# Phase 79 - Framework core and theme manager

**Status:** Planned, no code yet
**Created:** 2026-09-10
**Last updated:** 2026-09-10

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P79-A | `MullionProvider`: scope, portal container, lock and follow mode, persistence, runtime theme registration | Planned | Medium-Large |
| P79-B | Style delivery and the token sheet: one registration list written into every tree the plugin owns | Planned | Medium |
| P79-C | Layout and typography primitives, and the single focus rule | Planned | Medium |
| P79-D | Theme manager merge: registry, catalogue, selector, scoping, lock and follow | Planned | Medium |

---

## Rationale

1. **What this phase builds.** `@mullion/ui`, up to but not including anything with interaction behaviour. The provider, the delivery mechanism, the tokens, the presentational primitives and the focus rule. It is the half of the framework that has no keyboard handling in it, which is why it can be built and proved before the primitive's components arrive in Phase 80.

2. **Why the provider is the centre.** Five separate pieces of today's code exist because Mantine's provider does not model what this plugin needs: `ThemeContext` (registry, persistence, scoping, variable injection), `OverlayRootSync` (mirroring variables into the overlay root), `AdminChromeProvider` (the nested lock-mode provider with its hidden sentinel element), `chromeTheme.ts` (`adminChromeStyles()`, the inline token bridge across the portal boundary), and the `--mullion-builder-*` block. Every one of them is a workaround for the same absence. One provider that owns scope, portal container and theme resolution replaces all five, which is what the user meant by merging the Theme Manager with the theming implementation.

3. **Why the theme manager merges here and not later.** It is provider state. Splitting it into a later phase would mean building the provider with a seam for something that is going to live inside it, which is the guess this project keeps deciding not to make.

4. **Why no components with behaviour yet.** The primitive is chosen in P78-B and its components arrive in Phase 80. Mixing them into this phase would make the provider's correctness contingent on the primitive's, and the provider is the thing everything else depends on. It is proved against presentational components and the existing Mantine tree, both of which already work.

5. **Success.** A component can read one token and be correct in the gallery tree, in the overlay root, in the wp-admin light-DOM apps, under a locked brand palette and under a followed gallery theme, without anything being carried inline. The five workarounds above are deleted or scheduled for deletion with a named replacement.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Does the provider replace `MantineProvider` or sit beside it? | **Beside it, for this phase.** Mantine's provider still runs, because the app is still full of Mantine components. `MullionProvider` owns the tokens and the portal container; Mantine's owns its own variables until Phase 81 removes it. Two providers briefly, one boundary. |
| B | Colour scheme as an attribute or a token? | **A token plus a `color-scheme` declaration on the scope.** Never an ancestor attribute selector. This is study principle 4 and it is what makes the P76-D/H class of defect impossible: a rule that keys on an ancestor fails the moment the element is portaled away from it. |
| C | How does CSS reach three different trees? | **One registration list, written per scope, preferring `adoptedStyleSheets`.** The P77-A contract's four mechanisms collapse to one because there is no third-party stylesheet to override and no "portable" sheet distinct from the rest. |
| D | Does `applyThemeEverywhere` stay a nested provider? | **No. It becomes a `mode` prop.** `AdminChromeProvider` exists because Mantine's scheme attribute and variable selector had to be re-declared for a subtree. A provider that takes `mode="lock"` needs no nesting trick and no hidden sentinel element, and it cannot drop focus by moving children between tree depths the way P76-F had to fix. |
| E | Runtime theme editing in this phase? | **The API, yes; the editor UI, no.** `defineTheme` with the audits running at save is provider surface and belongs here. A user-facing theme editor is a product feature and is not scheduled. |
| F | What happens to `adminChromeStyles()` and the builder bridge? | **Both retire when the overlay root carries the provider's own sheet.** That is this phase's P79-B, which is why P77-I flips the default first. Until then they stay load-bearing and are not touched. |

## Execution Priority

1. **P79-A** first. Everything else is a consumer of it.
2. **P79-B** next, because a token nobody can read is not a token. A and B together are the minimum that proves anything.
3. **P79-C** third. The primitives are simple, and the focus rule is the one visible thing this phase ships.
4. **P79-D** last, and only once A is stable. It moves live behaviour (persistence, scoping, switching) that the plugin depends on today, so it is the track most able to break a working feature.

---

## Track P79-A - `MullionProvider`

### Problem

Theme resolution, variable emission, colour scheme, portal container, lock and follow, persistence and per-instance scoping are spread across `ThemeContext`, `OverlayRootSync`, `AdminChromeProvider`, `chromeTheme.ts` and `main.tsx`. Each was added to work around something Mantine's provider does not model, and together they are why a token can reach one tree and not another.

### Fix

One provider, with the shape in the study's section 3.2: `theme`, `scope`, `mode`, `portal`, `persistence`, `instanceId`. It resolves the theme through the engine, emits the token sheet into its scope, sets `color-scheme`, provides the portal container to every overlay, and exposes the registry and switching API.

Nested providers merge scope, never theme objects. That removes the `deepMerge` class of trap entirely: there is no theme object being spread, so a DOM element cannot be turned into a plain object by a merge.

### Acceptance criteria

- One provider serves all four cases: gallery shadow mount, gallery light mount, overlay root, wp-admin light DOM.
- `mode="lock"` renders the brand palette and `mode="follow"` the gallery theme, with an identical element tree in both states, so flipping the mode cannot unmount a subtree or drop focus (the P76-F guarantee, kept by construction rather than by care).
- Per-instance scoping works on a multi-space page: two providers, two token sets, no bleed.
- `defineTheme` registers a runtime theme and refuses one that fails the contrast audits.
- No `[data-*-color-scheme]` ancestor selector exists anywhere in the framework, enforced by a static test.

### Validation

- Unit tests per responsibility, and a jsdom test asserting the lock and follow trees are structurally identical.
- An e2e test on a two-instance page asserting independent themes.
- Mutation: making the scheme a selector instead of a token must fail the static test.

---

## Track P79-B - Delivery and the token sheet

### Problem

CSS reaches an element through four mechanisms with different reach, and eleven authoring surfaces sit on top of them ([STYLING_GUIDE.md](guides/STYLING_GUIDE.md)). Every legacy surface in that table exists because a stylesheet lives in one tree and an element renders in another.

### Fix

One `uiStyles.ts` registration list concatenating the framework's component sheets and the gallery structural sheet. The provider writes it into every scope it owns, building the sheet once with `replaceSync` and adopting it where `adoptedStyleSheets` is available, falling back to a `<style>` element. The token sheet is emitted per scope and is small.

This is also the FUTURE_TASKS item "Share One Constructable Stylesheet Between the Gallery Root and the Overlay Root", which stops being a separate optimisation once delivery is written once.

**Backlog cleanup owned by this track.** When P79-B is closeable, delete that entry from [FUTURE_TASKS.md](FUTURE_TASKS.md) (Code Quality and Refactoring) and note the removal in the document's update log. It is deliberately left in place until then, because the entry describes a real gap for as long as the overlay root keeps its own `<style>` copy.

### Acceptance criteria

- Every framework stylesheet reaches the gallery tree, the overlay root and the document, proved in the browser rather than by reading imports.
- The P77-A guards carry over: every selector scoped, every sheet registered, no inline pseudo-state.
- Three new static tests from study principle 2: no colour literal in a component sheet, no `!important`, no ancestor scheme selector.
- One parsed sheet per page rather than one per mount, measured.
- The FUTURE_TASKS constructable-stylesheet entry is deleted in the same change that closes this track.

### Validation

- `e2e/style-delivery.spec.ts` extended to the new sheets, in both mount modes.
- Mutation: a colour literal added to a component sheet must fail the static test by file and line.

---

## Track P79-C - Layout primitives, typography and the focus rule

### Problem

Thirty of the 62 components in use are presentational: they have no keyboard behaviour, no ARIA state and nothing to buy from a primitive. They are also the most-used, with `Text` in 98 files, `Stack` in 83 and `Group` in 76. They can ship before the primitive is even installed.

The focus ring is here too, because it is one rule and it is the single most visible thing the framework owns.

### Fix

Build the presentational set listed in the study's section 4, reading tokens only. Layout primitives take a small prop set that renders as inline custom properties, so the value travels with the element into any tree; Mantine's full style-prop surface is deliberately not reproduced.

One focus rule on `[data-focus-visible]`: a 2px core in `--mullion-color-primary-stroke` inside a 6px halo in `--mullion-color-focus-halo`, both geometry values from the framework constants P78-C added.

### Acceptance criteria

- The presentational set renders correctly in all four scopes.
- The P77-F ring walk passes against framework components, all four combinations of mount and theme mode, asserting core colour, 2px width, the halo token present and the exact 6px halo.
- Every component sheet passes the three static tests from P79-B.
- Storybook covers the set, with the decorator on `MullionProvider` rather than Mantine's.
- The drawer header clears the WordPress admin bar via the host-safe layer token from P78-C, and the FUTURE_TASKS entry for it is deleted in the same change.

### Validation

- `npx vitest run`, the ring walk in `e2e/theme-qa.spec.ts`, and a visual pass at 2x on tight layouts, as P77-F did.

---

## Track P79-D - Theme manager merge

### Problem

The registry, the catalogue, switching, persistence, per-instance keys and lock and follow live in `src/themes/index.ts`, `src/contexts/ThemeContext.tsx`, `src/components/Admin/ThemeSelector.tsx`, `src/themes/chromeTheme.ts` and `AdminChromeProvider.tsx`. The user named merging these with the theming implementation as a requirement of the framework.

### Fix

Move them into the framework as provider surface, keeping the behaviour the plugin depends on exactly as it is: the four-step initial-theme priority (user choice, instance default, host-injected candidate, default), the admin persistence lock, the scoped storage key, and the catalogue grouping the WordPress settings field shares.

`ThemeSelector` becomes a framework component reading the registry, and stops importing the registry from app code.

### Acceptance criteria

- The initial-theme priority order is unchanged, covered by the existing tests moved with it.
- Persistence, the admin disable flag and the per-instance key behave identically, proved by the existing `ThemeContext` suite running against the new implementation.
- `getTheme` stays an O(1) map lookup; registry initialisation stays under 100ms for 23 themes.
- No app file imports a theme registry directly.

### Validation

- The existing theme suites, re-pointed and unchanged in their assertions wherever the behaviour is meant to be identical.
- `theme-qa` end to end: switch theme, reload, confirm persistence, in both mount modes.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Components with interaction behaviour | Phase 80. This phase deliberately ships nothing that handles a keypress. |
| Deleting `AdminChromeProvider`, `chromeTheme.ts`, `ThemeContext` | Phase 81. They keep serving Mantine components until those are gone. |
| A user-facing theme editor UI | Key Decision E. The API lands here; the product feature is unscheduled. |
| Host-safe layer wired from PHP so the admin bar stops covering the drawer | The token ships in P78-C and the framework reads it here. Wiring the PHP side is a small follow-on, and it closes a FUTURE_TASKS accessibility entry. |

## Implementation Notes

_None yet, phase is Planned._

## Outcome

_Pending._
