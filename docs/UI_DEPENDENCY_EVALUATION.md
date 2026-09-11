# UI dependency evaluation: Mantine, an alternative, or in-house (P77-E)

**Status:** Decision document, delivered 2026-09-10. **Recommendation accepted by the user on
2026-09-10**, and scheduled as Phases 78 to 81; see section 9. No component code.
**Companion:** [IN_HOUSE_UI_FRAMEWORK_STUDY.md](IN_HOUSE_UI_FRAMEWORK_STUDY.md) (P77-H) describes what the
recommended path would take to build.
**Phase:** [PHASE77_REPORT.md](PHASE77_REPORT.md), track E.

## 1. Summary

Recommendation: **build an in-house component layer whose behaviour comes from a headless
primitive library and whose styling and theming are entirely ours, driven directly by the
theme engine's tokens.** Land the Phase 78 facade first, then migrate behind it. The primitive
library is not settled by this document: Ark UI scores first on our measured needs, with Base UI
and React Aria Components within three points, and the choice belongs to a bounded spike that
builds the same five components on the top two candidates against the shadow and overlay-root
boundary. If the spike fails on both, the fallback is Mantine in headless mode behind the same
facade, which keeps every behaviour we have today and still gives the styling layer to us.

The recommendation follows from the weights the user set on 2026-09-10 (theming fidelity and
designer control first, correctness over timing, a visual refresh welcome). Under equal weights
the same option still leads, by a smaller margin. Under a cost-first weighting (ship soon,
minimal change) staying on Mantine behind the facade wins narrowly. Section 8 shows all three so
the reader can see exactly what the answer depends on.

Two corrections to the premise the track started from stand. Mantine does expose the seams the
plugin needed (`Portal.target`, `getRootElement`, `cssVariablesSelector`, `HeadlessMantineProvider`),
and most of Phase 76's pain was the shadow-plus-portal boundary, which P77-B has now settled with
the overlay root. What remains against Mantine is structural rather than a bug list: its theme
model is a translation target, its stylesheet is a specificity opponent, its `styles` prop is
inline CSS in disguise, and its colour-scheme rules key on an ancestor attribute. Those are the
things the user's top two criteria measure, and they do not go away with more workarounds.

## 2. Method

Facts about this codebase were measured on the working tree at commit `c131b50d`
(2026-09-10). Facts about libraries were taken on 2026-09-10 from the npm registry, the GitHub
API, the libraries' own source files on GitHub, bundlephobia where it answered, and a local
esbuild measurement of a representative component set from each library (section 4.3). Web
search was unavailable during the session, so community sentiment was not surveyed; every
claim below has a primary source in section 12 or a measurement in this repository.

Scores are 1 to 5 per criterion against the anchors in section 5, weighted three ways in
section 8. The numbers are a way to make the judgement inspectable, not a substitute for it;
where a score is close, the text says why.

## 3. Decision inputs from the user (interview, 2026-09-10)

| Question | Answer | Effect on this document |
|----------|--------|-------------------------|
| Where does behaviour come from if we roll our own? | Ours on headless behaviour primitives | Options D1 to D6 are the "roll our own" family; "from scratch" (G) is scored for completeness only |
| Acceptable release delay for a migration | Correctness over timing | Migration cost carries weight 1; the document states the delay each option implies |
| Criteria that carry the most weight | Theming fidelity, designer control over the visual language | Both weighted 3; shadow-DOM friendliness and maintenance viability are gates rather than scores |
| Who maintains the code | Undecided or varies | Maintenance and longevity at neutral weight |
| What the "Theme Manager merge" absorbs | The engine's model is the only theme model; registry, switching and persistence; runtime theme editing by users; per-instance scoping and lock/follow mode | All four are requirements of the in-house study (P77-H) and count against options that cannot host them |
| wp-admin Spaces and Assets pages | Same framework everywhere | `@wordpress/components` is scored only as a surface-specific option and rejected |
| Does the Phase 78 facade land first regardless? | Yes | Every migration option is scored behind the facade; the facade's own cost is common to all and excluded from the comparison |
| Visual parity or refresh | A visual refresh with the designer is welcome | No option is charged for failing to reproduce Mantine's look |

## 4. Measured inputs

### 4.1 Coupling

| Measure | Value | Note |
|---------|-------|------|
| Non-test source files importing `@mantine/core` | 142 of 357 | 168 of 638 counting tests and stories. The Phase 77 plan's "153 of 434" counted differently; this count parses multi-line imports |
| Distinct symbols imported from `@mantine/core` | 73 | 62 components, the rest types and helpers (`mergeThemeOverrides`, `colorsTuple`, `DEFAULT_THEME`, `convertCssVariables`, `defaultCssVariablesResolver`) |
| Symbols imported on the visitor-facing path | 46 | `App`, auth bar, galleries, card viewer, campaign gallery, `shared-ui` |
| `@mantine/hooks` | 12 files, 7 hooks | `useDisclosure`, `useMediaQuery`, `useLocalStorage`, `getHotkeyHandler`, `useElementSize`, `useMergedRef`, `useDebouncedValue` |
| `@mantine/notifications` | 21 files | 48 `notifications.show` calls, plus `update`, `hide`, `clean` |
| `@mantine/modals` | 10 files | 8 `openConfirmModal`, 1 `open`, 2 `closeAll` |
| `@mantine/form` | 1 file | `LoginForm` in `shared-ui` |
| Mantine style props (`gap=`, `c=`, `fw=`, `mb=`, and so on) | 1,535 occurrences | `gap` 412, `c` 262, `fw` 154, `wrap` 108, `justify` 79 |
| `size=`, `variant=`, `radius=`, `color=` literals | about 1,500 | `size="xs"` 554, `size="sm"` 348, `variant="subtle"` 136, `variant="light"` 118 |
| `styles=` on components | 18 | all flat by the P77-A guard |
| Theme adapter (`src/themes/adapter.ts`) | 601 lines, 31 component override blocks | translates `ResolvedColors` into Mantine's model |
| Test files rendering through the Mantine provider wrapper | 117 | `src/test/test-utils.tsx` |
| Storybook stories with the Mantine decorator | 16 | |
| e2e specs using Mantine class selectors | 3 | `.mantine-Drawer-inner`, `.mantine-Drawer-close`, `.mantine-Modal-overlay` |
| `--mantine-*` variables referenced in our source | 58 files | `--mantine-color-default-border` 32, `--mantine-color-blue-5` 21, `--mantine-color-dimmed` 15 |

The most-used components are presentational: `Text` (98 files), `Stack` (83), `Group` (76),
`Button` (58), `Box` (56), `ActionIcon` (42), `TextInput` (38), `Tooltip` (34), `Badge` (32).
The behaviourally hard ones are fewer: `Select` (26), `Modal` (25), `NumberInput` (19),
`Switch` (17), `Table` (15), `Accordion` (15), `SegmentedControl` (14), `Checkbox` (11),
`Menu` (11), `Slider` (11), `ScrollArea` (10), `Tabs` (6), `Popover` (5), `Combobox` (3),
`Pagination` (3), `TagsInput` (3), `Drawer` (2), `MultiSelect` (2), `ColorInput` (1),
`PasswordInput` (1).

### 4.2 What the codebase leans on beyond components

Measured in `node_modules/@mantine/core@9.3.1` (installed) and confirmed unchanged in the
9.6.1 sources on GitHub.

| Mantine mechanism | How we use it | Standing issue |
|-------------------|---------------|----------------|
| `MantineProvider` with `getRootElement`, `cssVariablesSelector`, `forceColorScheme`, `deduplicateInlineStyles` | Three providers: `ThemedApp` (`:host` or `:root`), the nested `AdminChromeProvider` (`.mullion-admin-chrome`), the wp-admin apps (bare) | Colour-scheme rules key on `[data-mantine-color-scheme]` on an ancestor; the attribute must be stamped on every tree the chrome renders in (P76-D/H). `getRootElement` defaults to `documentElement`, which stamps the host page |
| CSS variables emitter (`--mantine-*`) | Read in 58 files; the adapter maps our roles onto a 10-shade `primary` tuple plus `primaryShade` per scheme | A translation: `primaryStroke`, `focusHalo`, `surfaceRaised` have no Mantine slot and travel through `theme.other` or our own `--mullion-*` set |
| Styles API: `styles`, `classNames`, `vars` | 27 `styles`, 5 `vars`, 4 `classNames` blocks in the adapter; 18 `styles` props in components | `styles` emits inline style and drops pseudo-selectors (P76-I-1); `vars` is not forwarded from `Select` to its `Combobox` (P77-C); theme `vars` do override Mantine's own `varsResolver` |
| Global classes (`mantine-focus-auto`, `mantine-focus-always`) | Overridden in `chrome-portable.scss` with doubled classes | Mantine draws the ring from `--mantine-primary-color-filled` (the fill), which failed 3:1 on 13 of 23 themes (P76-I-2) |
| `Portal` | `defaultProps.target` set once in the top-level theme (P77-B) | A string target goes through `document.querySelector`, which cannot see into a shadow root; `deepMerge` spreads an element found on both sides of a theme merge into a plain object |
| `useFocusReturn` (inside Modal and Drawer) | Every overlay | Records `document.activeElement`, which is the shadow host when the trigger is inside the gallery, so focus returns to `body` (FUTURE_TASKS). Unchanged in 9.6.1, and it is inside the component, so it cannot be fixed from outside without wrapping. All three headless candidates resolve the active element through the shadow tree before storing it (section 7), so this defect does not survive the move |
| `FocusTrap`, `useClickOutside` | Every overlay | Both shadow-safe (`getRootNode().activeElement`, `composedPath()`) |
| Box style props and responsive props | 1,535 occurrences | Responsive props render a hoisted `<style>` in the root container (P77-A constraint) |
| z-index scale (app 100, modal 200, popover 300, overlay 400, max 9999) | Settings drawer at 450, nested editor 500 | No relationship to host page layers; `#wpadminbar` at 99999 covers the drawer header (FUTURE_TASKS) |
| `@mantine/notifications` store, `@mantine/modals` manager, `@mantine/form` | Imperative toasts and confirms; one form | All three are thin and replaceable; notifications carries its own stylesheet |

The count of things we maintain to make Mantine fit: `adapter.ts` (601 lines),
`chromeTheme.ts` (162), `chrome-portable.scss` (117), `shadowStyles.ts` (54),
`portalTarget.ts` and `OverlayRootSync.tsx` (P77-B), the P77-A delivery tests, the P76-I
flatness tests, and the `--mullion-builder-*` bridge for Dockview. Most of this exists because
of the boundary, and would exist in some form under any library. The part that is specific to
Mantine is the adapter and the override sheet: about 720 lines whose only job is to express our
theme in Mantine's terms and then undo Mantine's own rules where they disagree.

### 4.3 Bundle footprint

Production build at `c131b50d`, gzipped. The visitor path loads `index`, `vendor-mantine-core`
and `vendor-mantine-helpers` statically, before any campaign renders.

| Chunk | Gzipped | Raw |
|-------|---------|-----|
| `vendor-mantine-core` (core, form, modals, notifications) | 157.2 kB | 626.4 kB |
| `vendor-mantine-helpers` (hooks) | 16.0 kB | 47.9 kB |
| `vendor-mantine-core` CSS | 32.2 kB | 216.0 kB |
| `index` (entry) | 214.2 kB | 703.3 kB |
| `vendor-dockview` | 63.3 kB | 340.1 kB |
| `vendor-charts` | 125.1 kB | 408.0 kB |

Representative component sets bundled with esbuild 0.25 (minified, ESM, React external), same
method for every library, so the numbers compare with each other but not with the Vite chunks
above. The set for each library was the closest match to our behavioural components: dialog,
drawer, popover, menu, select, combobox, tabs, slider, number field, switch, checkbox, tooltip,
scroll area, accordion, toggle or segmented group, tags, colour, pagination, toast where the
library has them.

| Library and version | Set | Minified | Gzipped |
|---------------------|-----|----------|---------|
| `@mantine/core` 9.3.1, the 60 symbols we import | styled | 364.0 kB | 114.1 kB |
| `@mantine/core` 9.3.1, everything | styled | 541.2 kB | 166.7 kB |
| `@mantine/core` 9.3.1, `HeadlessMantineProvider` plus the 27 behavioural components | headless | 321.9 kB | 100.6 kB |
| `@ark-ui/react` 5.39.1 | headless | 446.1 kB | 119.7 kB |
| `react-aria-components` 1.21.1 | headless | 481.1 kB | 139.3 kB |
| `@base-ui/react` 1.8.0 | headless | 417.6 kB | 140.6 kB |
| `@headlessui/react` 2.2.10 | headless, smaller set | 208.1 kB | 66.2 kB |
| `radix-ui` 1.6.7 | headless, no combobox or number field | 185.8 kB | 58.2 kB |
| `@ariakit/react` 0.4.39 | headless, no slider, number field, switch | 143.9 kB | 50.6 kB |
| `@floating-ui/react` 0.27.20 plus `react-remove-scroll` (from-scratch baseline) | positioning and scroll lock only | 69.0 kB | 25.2 kB |

Whole-package figures from bundlephobia for reference: `@mantine/core` 9.6.1 158.3 kB gz,
`@base-ui/react` 1.8.0 143.5 kB gz, `react-aria-components` 1.21.1 267.7 kB gz,
`@ark-ui/react` 5.39.1 283.0 kB gz, `@headlessui/react` 2.2.10 61.5 kB gz.

Two conclusions. First, a headless library of comparable coverage is not smaller than Mantine
for the same set; the saving from leaving Mantine is its 32 kB of CSS plus whatever our own
stylesheet costs less, and the modules our build retains but never renders. Second, the
visitor-facing cost is dominated by what loads statically, and that is a code-splitting
decision (admin chrome behind a lazy boundary) available under every option. Bundle size is
therefore a weak discriminator and is weighted 1.

### 4.4 History

| Event | Date |
|-------|------|
| Mantine adopted for the admin panel | 2026-01-23 |
| Mantine 7 to 8 migration | 2026-05-06 |
| Mantine 8 to 9 migration (with React 19) | 2026-05-14 |
| Mantine majors published | 7.0.0 2023-09-18, 8.0.0 2025-05-05, 9.0.0 2026-03-31 |
| Mantine releases in the last twelve months | 48 (9.3.1 installed; 9.6.1 current on 2026-09-09) |
| Phase 76: five visual defects, four of them boundary, one the `styles` trap | 2026-08 |
| P77-A contract, P77-C state rules, P77-B overlay root, P77-F halo ring | 2026-09-09 |

Mantine's majors arrive roughly yearly and each has carried breaking API changes (9.0 renamed
`Collapse.in`, dropped `color` on `Text` and `Anchor`, changed the default radius and medium
font weight, and requires React 19.2). The repository absorbed two majors in one week in May
2026. The 9.4 to 9.6 stream shipped a lightbox package, a schedule package, `ActionBar`,
`Cascader`, `Menubar`, tree components and a `keepMountedMode` on Modal and Drawer; nothing in
that stream touches the four structural issues above.

## 5. Criteria

### Gates (pass or fail; a fail removes the option)

| Gate | Test |
|------|------|
| G1 Shadow and portal control | Overlay content can be given a container we choose, including a node inside a shadow root or our overlay root; focus and dismissal logic resolves the active element through `getRootNode()` or a shadow-aware walk; no `document.querySelector` string on the critical path |
| G2 Maintenance viability | Actively released in the last six months, permissive licence, React 19 supported, an organisation or more than one maintainer behind it |
| G3 Whole-product coverage | Can serve the front end, the overlay root and the wp-admin light-DOM apps; not admin-only |

### Weighted criteria and anchors

| # | Criterion | Weight | 5 | 3 | 1 |
|---|-----------|--------|---|---|---|
| C1 | Theming fidelity | 3 | The engine's tokens are the only theme model; every state of every part is addressable from our CSS | Tokens are translated into a library model that exposes most states as variables or attributes | The library owns the model and the translation loses roles |
| C2 | Designer control over the visual language | 3 | No library CSS; geometry, motion and visuals are entirely ours | Overridable, with specificity work and some fixed geometry | Fixed look; overrides fight inline styles |
| C3 | Accessibility guarantees | 2 | Maintained by an accessibility team against the ARIA Authoring Practices, with automated a11y tests upstream | Good in practice, community-tested, some patterns diverge | Ours to prove |
| C4 | Portal and boundary control (beyond the gate) | 2 | Container per overlay accepting `ShadowRoot`; focus return and outside-click shadow-aware; layering exposed | Container control with one known gap | Document-only assumptions |
| C5 | Coverage of the 62 components we use | 2 | Every behavioural component has a counterpart | A few need composing or a second dependency | Major gaps (combobox, number field, slider) |
| C6 | API footgun risk | 2 | Few, documented, none silent | Some, documented | Several silent traps met in production use |
| C7 | Migration cost behind the facade | 1 | None | Styling rewrite only | Styling, behaviour API and writing behaviours |
| C8 | Bundle footprint for our set | 1 | 60 kB gz or less | 100 to 140 kB gz | Over 180 kB gz |
| C9 | Longevity | 1 | Backed by an organisation, steady cadence, stable majors | One organisation or maintainer, active | Slowing or single-person |
| C10 | wp-admin fit | 1 | Works in the light-DOM admin apps with WP styles present, without a global reset | Works with care | Conflicts |
| C11 | Test and tooling impact | 1 | jsdom, axe, Storybook and Playwright work as today | Some friction | jsdom cannot exercise it |

Migration cost is weighted 1 because the user chose correctness over timing. It would be 3
under a ship-soon weighting, and section 8 shows that case.

## 6. Options

Every migration option assumes the Phase 78 facade (`src/ui/` plus the import-boundary lint
rule) lands first, so the facade's own cost is not counted against any of them.

| Id | Option | What it is |
|----|--------|------------|
| A | Stay as-is | Styled Mantine, the P77-A contract, the P77-B overlay root, no facade |
| B | Stay behind the facade | Styled Mantine behind `src/ui/`; the facade narrows the API (no `styles`, `vars` only) and is the home of per-component theming |
| C | Mantine headless behind the facade | `HeadlessMantineProvider` (or `unstyled` per root): Mantine's behaviour and DOM, none of its CSS, variables or style props; all styling ours |
| D | In-house layer on headless primitives, behind the facade | Our component API, our styling and theming, behaviour from: D1 Ark UI, D2 Base UI, D3 React Aria Components, D4 Radix Primitives, D5 Ariakit, D6 Headless UI |
| E | Another styled library | Chakra UI v3 scored as the representative (Ark inside, token and recipe model); MUI, Ant Design, HeroUI, Park UI, Reshaped in section 11 |
| F | Web Components library | Web Awesome 3 (the successor of Shoelace, which is archived); native shadow DOM per component, React 19 custom elements |
| G | In-house from scratch | Behaviours written by us, no UI dependency beyond positioning and scroll lock |
| H | `@wordpress/components` for wp-admin | Gutenberg's library on the two admin pages only |

## 7. Evidence per option

### A and B. Stay on Mantine (styled)

Theming fidelity is the weak point and it is structural. The adapter maps our roles onto a
10-rung `primary` tuple and a `primaryShade` per scheme, then writes 31 component blocks to
re-express surfaces, borders and text in Mantine's variables and inline styles. Roles Mantine
has no slot for (`primaryStroke`, `focusHalo`, `surfaceRaised`, `textMuted2`) travel through
`theme.other` and our own `--mullion-*` sheet. Where Mantine exposes a variable the P77-A
`vars` channel works well; where it does not, we add a class and a rule in
`chrome-portable.scss` with a doubled selector. Colour-scheme rules key on
`[data-mantine-color-scheme]`, which is why the nested chrome provider stamps a hidden sentinel
element and why the overlay root has to mirror the attribute onto its host and target.

Designer control: the designer's brief already describes the product's signature in terms
outside Mantine (gradient shells, frosted header, translucent chips, the halo ring), and each
of those was delivered by overriding or bypassing Mantine rather than through it. Mantine's
`size` and `variant` scales are its own; a new visual language means either re-mapping every
one of about 1,500 literal `size`/`variant` props or accepting Mantine's scale.

Accessibility: good in practice and the P76-I-1 record is fair to it, the mechanism worked and
the adapter broke it. Mantine is a solo-maintained project without a published accessibility
audit; its focus ring is drawn from the fill colour, which failed 3:1 on 13 of 23 themes until
P76-I-2 re-pointed it.

Portal and boundary: the seams exist (`Portal.target` element, `getRootElement`,
`cssVariablesSelector`) and P77-B uses them. The remaining gap is `useFocusReturn`, which
records `document.activeElement` and so returns focus to `body` for any trigger inside the
gallery; unchanged in 9.6.1. That gap is inside Modal and Drawer and cannot be fixed from
outside without wrapping them.

Footguns met in production: `styles` as inline style (18 dead blocks and a WCAG 2.4.7 failure,
now guarded), `data-selected` versus `data-checked`, `vars` not forwarded from `Select` to
`Combobox`, `deepMerge` spreading a DOM node, the string portal target. B removes the first by
policy at the facade; the others remain.

Longevity: 31,700 stars, 48 releases in twelve months, yearly majors with breaking changes,
one primary maintainer. Coverage: complete for us, including packages we do not use. Tooling:
the test wrapper, Storybook decorator and e2e selectors all exist today.

Migration: A is zero. B is the facade's mechanical re-pointing of 142 files, which the user
has already decided to do.

### C. Mantine headless

`HeadlessMantineProvider` (present in 9.3.1) sets `headless: true`, `withStaticClasses: false`,
emits no CSS variables and no global classes, and `useStyles` skips the `varsResolver` and the
`m_*` classes. Components keep their DOM, data attributes and behaviour; every visual becomes
ours through `classNames` and our stylesheets. This addresses the top two criteria almost as
well as D: no Mantine CSS to fight, no Mantine variables, no scheme attribute. It keeps all 62
components and the modals and notifications managers (which would need our styles).

Costs and limits. Style props (`gap`, `c`, `p`, `size`, `radius`, `variant`) have no effect in
headless mode, so the 1,535 style props and about 1,500 literal size and variant props must be
rewritten exactly as they would be under D. Headless is a per-provider switch, not per
component, so the migration cannot be incremental within one provider tree except through the
`unstyled` prop on root components (not on parts such as `Tabs.Tab`). The structural traps that
are not styling remain: the string portal target, `deepMerge`, `useFocusReturn`, Mantine's z-index
scale, attribute naming, the yearly majors. And the component API stays Mantine's, so the
facade can narrow it but not redesign it around our theme manager.

C is the fallback if D's spike fails, and it is a poor stepping stone toward D: the stylesheet
written against Mantine's DOM and attributes would be rewritten again against a primitive
library's parts.

### D1. Ark UI 5.39.1 (Zag.js state machines; Chakra organisation)

Coverage against our list is the best of the headless candidates: dialog, drawer, popover,
menu, select, combobox, listbox, tabs, slider, number input, switch, checkbox, tooltip, scroll
area, accordion, toggle group, segment group (our `SegmentedControl`), tags input, colour
picker, pagination, password input, file upload, toast, progress, presence, portal, focus trap,
field. Presentational pieces (`Text`, `Stack`, `Badge`, `Table`) are ours in any case.

Shadow DOM is explicit: `EnvironmentProvider` takes a root node (or a function returning one)
and Zag's DOM queries resolve `getRootNode()`, `getActiveElement` walking nested shadow roots,
and `contains` through composed trees (`@zag-js/dom-query`). `Portal` takes a `container`. Its
focus trap stores `getActiveElement(this.doc)` before activating and restores it on
deactivate, so the focus-return defect we have under Mantine does not reproduce.
Styling is data attributes only: `data-scope`, `data-part`, `data-state`, plus a
`--layer-index` variable for stacked overlays; no CSS ships. That is exactly the styling model
the P77-A contract converged on (state as attributes, colour as tokens, one stylesheet
registered in every tree).

Longevity: 5,400 stars, 9 open issues, released 2026-08-28, 30 releases in twelve months, MIT.
The risk is history: five majors between November 2023 and March 2025, then eighteen months on
v5. Zag is framework-agnostic, so the behaviour is not tied to React's release cycle. Bundle for
our set 119.7 kB gz. Testing: Zag machines run in jsdom.

Footguns known from its design: compound parts must be assembled correctly (an `asChild`
pattern); the `--layer-index` model is a convention rather than a guarantee; large dependency
fan-out (69 `@zag-js/*` packages) that tree-shakes per component.

### D2. Base UI 1.8.0 (MUI)

Renamed from `@base-ui-components/react` (deprecated) to `@base-ui/react`; 1.0.0 on
2025-12-11, 1.8.0 on 2026-09-04, twelve releases in twelve months. Shadow-aware by
construction and without a flag: `activeElement(doc)` walks `shadowRoot.activeElement`
(`packages/utils/src/shadowDom.ts`) and its forked `FloatingFocusManager` stores that value as
the element to restore, so focus return across the boundary works; `Dialog.Portal.container`
accepts `HTMLElement | ShadowRoot | RefObject`. Styling is `className` and `style` as functions of state, data attributes
(`data-checked` and the like) and layout variables (`--anchor-width`,
`--available-height`); no CSS ships. shadcn/ui made Base UI its default primitive in July 2026,
which is a strong ecosystem signal.

Coverage gaps for us: no pagination, no tags input, no colour picker, no segmented control (a
toggle group serves), password input by composition (`Field` plus `Input`), table native. Each
gap is small on its own; together they are the difference between D1 and D2 on C5. Bundle
140.6 kB gz for our set. 10,900 stars, 424 open issues, MIT.

### D3. React Aria Components 1.21.1 (Adobe)

The strongest accessibility pedigree: Adobe's accessibility team, ARIA Authoring Practices
patterns, internationalised number and date handling, weekly releases (255 in twelve months),
Apache-2.0. Coverage is broad (dialog, popover, menu, select, combobox, listbox, tabs, slider,
number field, switch, checkbox, tooltip, disclosure, toggle button group, tag group, colour
picker and field, table, toast, toolbar, tree, virtualizer). Gaps for us: pagination, scroll area
(native overflow instead), tags input by composition.

Shadow DOM is supported behind a global opt-in flag, `enableShadowDOM()` from the flags module,
which gates `nodeContains`, `getActiveElement`, `getEventTarget` and the focus walker;
`FocusScope`'s `useRestoreFocus` stores the shadow-resolved active element, so focus return
works once the flag is set. Portal containers come from `UNSAFE_PortalProvider({ getContainer })`. Both work, and both names say
the maintainers consider the surface provisional. Styling is render props (`className` and
`style` as functions of state) with data attributes (`data-focus-visible`, `data-selected`,
`data-pressed`). Bundle 139.3 kB gz for our set, the largest of the three because of the
collections and i18n layers. Tooling: jsdom works but pointer and virtualizer behaviour needs
care in tests, a known friction.

### D4. Radix Primitives 1.6.7 (WorkOS)

`Portal.container` exists and outside-event handling attaches to `ownerDocument`, but
`FocusScope` reads `document.activeElement` in six places, so focus trapping and return break
across a shadow boundary. That is a conditional pass on G1 at best (our own focus scope would be
required). No combobox, number field, tags input, pagination or colour picker; `Select` only.
Smallest footprint of the full-featured set (58.2 kB gz) and 19,300 stars, but 347 open issues,
last publish 2026-07-31, repository last pushed 2026-08-08. The unified `radix-ui` package
(February 2026) and shadcn's move to Base UI (July 2026) both suggest the momentum has moved.

### D5. Ariakit 0.4.39

Accessibility-first and small (50.6 kB gz for what it has), `portalElement` per portal, but no
slider, number field, switch, scroll area, tags input, colour picker or pagination; still on
0.4.x after four years; one primary maintainer. Fails C5 badly enough that it cannot be the
primary primitive. Worth noting as the behaviour layer inside `@wordpress/components`.

### D6. Headless UI 2.2.10 (Tailwind Labs)

Root-node-aware active element, but the portal appends to `ownerDocument.body` with a group
target rather than an arbitrary container; the component set is the smallest (no slider,
number field, tooltip, tags, colour, pagination, scroll area); last release 2026-04-13, five
months before this evaluation. Fails C5 and is marginal on G2.

### E. Chakra UI v3 (representative styled alternative)

Ark inside, so behaviour and shadow handling match D1, plus Emotion at runtime (a
`CacheProvider` container is needed per shadow root) and a token, semantic-token and recipe
system. The theme model is closer to ours than Mantine's (semantic tokens map onto roles), but it
is still a translation into someone else's system and recipes carry Chakra's defaults. Bundle
would exceed 180 kB gz for our set once Emotion and the recipe runtime are included. It buys
Ark's behaviour with a second opinionated layer on top, which is the shape the user is leaving.

### F. Web Awesome 3.12 (Lit web components)

Native shadow DOM per component, React 19 without wrappers, theming through its own design
tokens, palettes and `::part` selectors. Two problems for us. Component internals are closed to
our stylesheet except through parts and `--wa-*` tokens, which is a translation layer again and
weaker control than data attributes on light DOM. And jsdom does not exercise custom elements
with shadow roots well enough for our 117 provider-wrapped test files or the axe gate. Shoelace
(its predecessor) is archived; Web Awesome has 1,300 stars and is backed by the Font Awesome
company. Overlays inside a component's own shadow root also meet the containing-block problem
P77-B measured.

### G. In-house from scratch

The scale, measured on Mantine's own sources for the components we use: 14,688 lines of
component JavaScript plus 3,515 lines of provider, Box and Styles API infrastructure plus 5,497
lines of hooks, and 130 kB of raw CSS for the used components. Positioning and scroll lock
would still come from Floating UI and `react-remove-scroll` (25 kB gz together). The
accessibility risk is the decisive mark: combobox and listbox semantics, focus trapping across
shadow roots, roving tab index, slider and spin-button keyboard maps, and live regions are where
this codebase has already shipped tests that passed while asserting an unrendered path. The
user's own answer (behaviour from primitives) rules this out; it is scored so the reasoning is
on record.

### H. `@wordpress/components` 40.1.0 for wp-admin

Ariakit and Emotion inside, 20 MB unpacked, styled for the block editor and not themeable to
our engine. The two admin pages are the only place it fits, and the user chose one framework
everywhere. Rejected on G3.

## 8. Scores

Scores follow the anchors in section 5. Gates: D4 conditional on G1, D5 and D6 fail C5 badly
enough to be excluded from the recommendation, F fails C11 in practice, H fails G3.

| Option | C1 fidelity | C2 designer | C3 a11y | C4 portal | C5 coverage | C6 footgun | C7 migration | C8 bundle | C9 longevity | C10 wp-admin | C11 tooling |
|--------|---|---|---|---|---|---|---|---|---|---|---|
| A Stay as-is | 2 | 2 | 4 | 3 | 5 | 2 | 5 | 3 | 4 | 4 | 5 |
| B Stay behind facade | 3 | 2 | 4 | 3 | 5 | 3 | 4 | 3 | 4 | 4 | 5 |
| C Mantine headless | 4 | 4 | 4 | 3 | 5 | 3 | 2 | 4 | 4 | 4 | 4 |
| D1 Ark UI | 5 | 5 | 4 | 5 | 5 | 4 | 2 | 3 | 3 | 4 | 4 |
| D2 Base UI | 5 | 5 | 4 | 5 | 3 | 4 | 2 | 3 | 4 | 4 | 4 |
| D3 React Aria Components | 5 | 5 | 5 | 4 | 4 | 3 | 2 | 3 | 5 | 4 | 3 |
| D4 Radix | 5 | 5 | 4 | 2 | 3 | 3 | 2 | 4 | 3 | 4 | 4 |
| D5 Ariakit | 5 | 5 | 5 | 3 | 2 | 3 | 2 | 5 | 3 | 4 | 4 |
| D6 Headless UI | 5 | 5 | 4 | 3 | 2 | 3 | 2 | 4 | 2 | 4 | 4 |
| E Chakra v3 | 3 | 4 | 4 | 4 | 5 | 3 | 2 | 2 | 4 | 3 | 4 |
| F Web Awesome | 3 | 3 | 3 | 4 | 4 | 3 | 1 | 2 | 3 | 4 | 1 |
| G From scratch | 5 | 5 | 1 | 5 | 5 | 3 | 1 | 4 | 2 | 4 | 4 |

Weighted totals under three weightings. User weights are the ones set in the interview
(C1 3, C2 3, C3 to C6 2, the rest 1; maximum 95). Equal weights give every criterion 1
(maximum 55). Ship-soon weights give migration 3, tooling 2, everything else 1 (maximum 70).

| Option | User weights | Equal weights | Ship-soon weights |
|--------|--------------|---------------|-------------------|
| A Stay as-is | 61 | 39 | 54 |
| B Stay behind facade | 65 | 40 | 53 |
| C Mantine headless | 72 | 41 | 49 |
| **D1 Ark UI** | **82** | **44** | 52 |
| D2 Base UI | 79 | 43 | 51 |
| D3 React Aria Components | 79 | 43 | 50 |
| D4 Radix (conditional gate) | 71 | 39 | 47 |
| D5 Ariakit (coverage fail) | 74 | 41 | 49 |
| D6 Headless UI (coverage fail) | 70 | 38 | 46 |
| E Chakra v3 | 68 | 38 | 46 |
| F Web Awesome | 57 | 31 | 34 |
| G From scratch | 73 | 39 | 45 |

Reading the table. Under the user's weights the in-house layer on primitives leads by ten
points over Mantine headless and seventeen over the facade alone, and the three viable
primitives sit within three points of each other, which is inside the judgement error of a
1-to-5 rubric. Under equal weights D1 still leads, by three. Under a ship-soon weighting A and B
win narrowly, which is the honest statement of what the user is trading: the recommendation
costs a long migration and buys the two things they weighted highest.

## 9. Recommendation

1. **Land the facade** (`src/ui/`, the lint boundary, re-exports with a narrowed prop
   surface). It is the pivot for every option and the user has decided it lands first.
2. **Run a bounded primitive bake-off before any framework code.** Build the same five
   components on Ark UI and Base UI (React Aria Components as the third if either fails): a
   Drawer in the overlay root, a Select with a portaled listbox, a Slider, a NumberInput, and
   Tabs. Measure against fixed tests, not impressions: the P77-A delivery guards, the P77-F
   ring walk, the P77-B hostile-host probe (transformed ancestor, 600 px scroll, sticky 9999
   header), focus return to a trigger inside the gallery shadow root, outside-click through the
   boundary, the axe gate, and the esbuild footprint of the five. One branch each, both
   discarded, the loser's measurements recorded.
3. **Adopt the winner as the behaviour layer of an in-house component framework** whose
   styling and theming are ours and whose theme model is the engine's, as designed in
   [IN_HOUSE_UI_FRAMEWORK_STUDY.md](IN_HOUSE_UI_FRAMEWORK_STUDY.md). Migrate behind the facade in
   the order the adapter fights hardest: the Input family and overlays first, then combobox,
   tabs and segmented control, then the long tail. The theme-qa harness is the regression net,
   with new baselines captured per component as the designer's refresh lands.
4. **Fallback:** if neither primitive passes the bake-off's boundary tests, use option C
   (Mantine headless) behind the same facade. It gives the styling layer to us at once and
   keeps the behaviours we have; the structural traps that remain are documented in section 4.2
   and are wrappable at the facade.
5. **Keep** `@mantine/hooks` only if the bake-off finds it convenient; the seven hooks we use
   are about 150 lines to own. Replace `@mantine/notifications`, `@mantine/modals` and
   `@mantine/form` with facade-level `notify()`, `confirm()` and plain form state; the call
   sites are 48, 11 and 1.

### As scheduled (user decision, 2026-09-10)

The user accepted this recommendation and chose to build the framework **before release**
rather than ship on Mantine and migrate for v2. The author's written advice in an earlier
draft of this section was the opposite, and the trade is recorded in
[PHASE78_REPORT.md](PHASE78_REPORT.md) Key Decision B so it stays visible: the release moves
out by several phases in exchange for shipping on the final architecture.

| Phase | Content | Steps from the study's section 6 |
|-------|---------|-----------------------------------|
| [78](PHASE78_REPORT.md) | UI boundary, primitive bake-off, token model | 0, 1, 2 |
| [79](PHASE79_REPORT.md) | Framework core and theme manager | 3, 6 |
| [80](PHASE80_REPORT.md) | Behavioural components | 4, 5 |
| [81](PHASE81_REPORT.md) | Consumer migration and Mantine removal | 7, 8 |
| [82](PHASE82_REPORT.md) | Release pipeline hygiene (was Phase 79) | none |
| [83](PHASE83_REPORT.md) | Go-live (was Phase 80) | none |

Release does not wait for full removal. It waits for the framework, the behavioural components
and the theming-critical surfaces; the long tail of presentational components migrates behind
the facade afterwards, which is what the facade's lint boundary exists to make safe
([PHASE81_REPORT.md](PHASE81_REPORT.md) Key Decision A).

## 10. Exit conditions

Conditions that would change this recommendation back to staying on Mantine:

- The spike fails on both primitives against the boundary tests, and option C is judged too
  costly for what it returns.
- The designer's visual refresh does not happen. Without it, reproducing Mantine's look in our
  own CSS is the largest single cost of D and C and buys nothing visible.
- Ark UI or Base UI loses its maintainer organisation, or ships a major that breaks the
  shadow and portal contract, before the migration is half done. The facade limits the blast
  radius but not to zero.

Conditions that would have moved a "stay" answer to "leave", recorded because the plan asked
for them and because they remain true:

- A second API-design trap of the `styles` class: a channel that looks like CSS and is not.
- A Mantine major that changes the theming model or the CSS variable contract again.
- A shadow-boundary defect inside a component (the `useFocusReturn` case) that the maintainers
  decline to fix and that cannot be wrapped from outside.

## 11. Options rejected without full scoring

| Library | Why not |
|---------|---------|
| MUI Material, Ant Design, HeroUI, Fluent UI, Primer React | Styled systems with their own design language and theme model; each is a stronger version of the objection to Mantine, and all are heavier |
| Park UI | Ark plus Panda CSS; a styled preset over the same primitive D1 uses. Worth reading for its recipes, not adopting |
| Reshaped, Tamagui | Opinionated styling runtimes; the second targets React Native first |
| Pigment CSS, Panda CSS, vanilla-extract | Styling toolchains, not component libraries; the in-house study picks plain CSS with custom properties and does not need a compiler |
| `@wordpress/components` | Admin-only, Emotion and Ariakit inside, not themeable to the engine; fails the one-framework-everywhere decision |
| shadcn/ui as a whole | A copy-in distribution of Base UI or Radix with Tailwind styling. The vendoring model was declined in the interview; the primitive it now defaults to (Base UI) is scored as D2 |
| Downshift, cmdk, Vaul, focus-trap-react | Single-purpose behaviour packages; candidates for filling a gap in the chosen primitive, not for the layer itself |

## 12. Sources

Registry and repository facts, all read 2026-09-10:

- npm registry documents for `@mantine/core`, `@mantine/hooks`, `react-aria-components`,
  `react-aria`, `@base-ui/react`, `@base-ui-components/react` (deprecated, "renamed to
  @base-ui/react"), `@ark-ui/react`, `@zag-js/core`, `radix-ui`, `@ariakit/react`,
  `@headlessui/react`, `@wordpress/components`, `@awesome.me/webawesome`,
  `@shoelace-style/shoelace`, `@floating-ui/react`, `react-remove-scroll`, `@chakra-ui/react`.
- GitHub API repository records for `mantinedev/mantine`, `adobe/react-spectrum`,
  `mui/base-ui`, `chakra-ui/ark`, `chakra-ui/zag`, `radix-ui/primitives`, `ariakit/ariakit`,
  `tailwindlabs/headlessui`, `shoelace-style/webawesome`, `shoelace-style/shoelace` (archived),
  `WordPress/gutenberg`, `floating-ui/floating-ui`, `shadcn-ui/ui`.
- GitHub releases for `mantinedev/mantine` 9.2.2 through 9.6.1; https://mantine.dev/changelog/9-0-0/;
  https://mantine.dev/styles/unstyled/.
- Source files inspected: `mantine/9.6.1` `packages/@mantine/hooks/src/use-focus-return/use-focus-return.ts`,
  `packages/@mantine/core/src/components/Portal/Portal.tsx`,
  `packages/@mantine/core/src/core/styles-api/use-styles/get-style/resolve-vars/resolve-vars.ts`;
  `chakra-ui/zag` `packages/utilities/dom-query/src/node.ts`; `chakra-ui/ark`
  `packages/react/src/providers/environment/environment-provider.tsx`; `mui/base-ui`
  `packages/utils/src/shadowDom.ts`, `packages/react/src/dialog/portal/DialogPortal.tsx`;
  `adobe/react-spectrum` `packages/@react-stately/flags/src/index.ts`,
  `packages/react-aria/src/utils/shadowdom/DOMFunctions.ts`,
  `packages/react-aria/src/overlays/PortalProvider.tsx`; `radix-ui/primitives`
  `packages/react/focus-scope/src/focus-scope.tsx`, `packages/react/portal/src/portal.tsx`,
  `packages/react/dismissable-layer/src/dismissable-layer.tsx`; `tailwindlabs/headlessui`
  `packages/@headlessui-react/src/utils/owner.ts`, `.../components/portal/portal.tsx`;
  `ariakit/ariakit` `packages/ariakit-react-components/src/portal/portal.tsx`,
  `packages/ariakit-utils/src/dom.ts`; `floating-ui/floating-ui` `packages/react/src/utils/element.ts`.
- Documentation pages: https://base-ui.com/react/overview/releases,
  https://base-ui.com/react/handbook/styling, https://ark-ui.com/docs/guides/styling,
  https://ui.shadcn.com/docs/changelog, https://webawesome.com/docs/frameworks/react/,
  https://webawesome.com/docs/themes/.
- bundlephobia API for the whole-package sizes in section 4.3; esbuild 0.25 for the
  representative-set sizes (entries kept in the session scratchpad, not committed).
- caniuse data for CSS anchor positioning (Chrome 125, Safari 26, Firefox 147; 84% global
  support on 2026-09-10), used by the in-house study.
- This repository: `src/themes/adapter.ts`, `src/themes/chromeTheme.ts`,
  `src/styles/chrome-portable.scss`, `src/portalTarget.ts`, `src/test/test-utils.tsx`,
  `vite.config.ts`, `dist/` at `c131b50d`, `docs/guides/STYLING_GUIDE.md`,
  `docs/PHASE77_REPORT.md`, `docs/PHASE78_REPORT.md`, `docs/FUTURE_TASKS.md`.
