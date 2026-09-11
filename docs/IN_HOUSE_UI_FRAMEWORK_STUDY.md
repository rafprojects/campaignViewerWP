# In-house UI framework study (P77-H)

**Status:** Study, delivered 2026-09-10. No component code.
**Companion:** [UI_DEPENDENCY_EVALUATION.md](UI_DEPENDENCY_EVALUATION.md) (P77-E) scores the options and
recommends this path. This document describes what the path would take, whether or not it is
taken.
**Phase:** [PHASE77_REPORT.md](PHASE77_REPORT.md), track H.

## 1. What this document is for

The user asked two things beyond the evaluation: what it would take to roll our own styling
framework that replaces Mantine and addresses the shortcomings met so far, and a short list
of the parts of Mantine such a framework would need to address and should address. The
framework would also absorb the custom Theme Manager (registry, switching, persistence,
per-instance scoping, lock and follow mode, runtime editing), which Mantine does not model
and which is why the adapter and the nested chrome provider exist.

This is a design study, not a plan with dates. It records the principles the framework would
be built on, the shape of its architecture, the sourcing of every behaviour we use, the
Mantine inventory to cover, the shortcomings to design out, and the risks. A full dive into
Mantine's total surface belongs to the phase that builds it; the inventory here is the surface
this codebase actually touches, measured.

## 2. Principles

1. **The engine's model is the only theme model.** A component reads `--mullion-*` custom
   properties and nothing else. There is no second theme object, no shade tuple, no
   `primaryShade`, no per-component override map to translate into. What the engine cannot
   express, the engine is extended to express.
2. **State travels as attributes, colour travels as tokens, and nothing is inline.** Every
   part carries `data-part`; every state is a data attribute set by the behaviour layer
   (`data-state`, `data-checked`, `data-disabled`, `data-invalid`, `data-focus-visible`).
   A component stylesheet may not contain a literal colour; a static test enforces it. The
   P77-C lesson (inline colour outranks every state rule) becomes impossible by construction.
3. **One stylesheet, registered in every tree.** The P77-A contract collapses: component CSS is
   one concatenated sheet delivered to the document, the gallery shadow root and the overlay
   root through one registration list, and the token sheet is emitted per scope. There is no
   "portable" sheet distinct from the rest because there is no third-party CSS to override.
4. **No ancestor-attribute keying.** Colour scheme is a token (`--mullion-color-scheme`) and a
   `color-scheme` declaration on the scope, never a `[data-scheme]` ancestor selector. The
   P76-D/H class of defect (attribute absent on a portaled tree) cannot recur.
5. **Geometry is constant; colour resolves per theme.** Focus ring width and halo, control
   heights, radii per size, motion durations are framework constants expressed as tokens with
   one value, not per-theme choices. The designer's P77-F constraint generalised.
6. **Behaviour is bought, not written.** Keyboard, focus, ARIA and dismissal come from a
   headless primitive library chosen by the P77-E spike. The framework wraps; it does not
   reimplement. This is a deliberate limit: the moment the framework starts writing its own
   combobox semantics or focus trap, it inherits the class of correctness problem this
   codebase has already shown it gets wrong, and it stops being a styling framework.
7. **The theme manager is part of the framework.** Registry, switching, persistence, scoping,
   lock and follow, and runtime editing are provider concerns with a public API, not app code
   arranged around a provider.
8. **Audits are guards, not reports.** The contrast audits (1.4.3 text, 1.4.11 non-text, the
   P77-F ring pair) run at registration for bundled themes and at save for user-authored
   themes, and the editor refuses to save a failing theme rather than warning.

## 3. Architecture

### 3.1 Packages

| Package | Exists | Role |
|---------|--------|------|
| `@mullion/theme-engine` | yes | Types, validation, colour generation, audits, CSS variable emission. Gains the token tiers in 3.3 and a `defineTheme` API for runtime authoring |
| `@mullion/ui` | new | The component framework: provider, delivery, tokens sheet, layout and typography primitives, behavioural components wrapping the primitive library, the notify and confirm managers |
| `@mullion/theme-manager` | new, or a module of `@mullion/ui` | Registry, catalogue, switching, persistence, scoping, lock and follow, the editor model. Today spread over `src/themes/index.ts`, `src/contexts/ThemeContext.tsx`, `src/components/Admin/ThemeSelector.tsx`, `src/themes/chromeTheme.ts` and `AdminChromeProvider.tsx` |
| `@mullion/shared-ui` | yes | Consumers move onto `@mullion/ui`; the package stops depending on Mantine |

The app's `src/ui/` (Phase 78) is the import boundary and, during migration, the place where
a name resolves to either the Mantine re-export or the `@mullion/ui` component. When the
migration completes, `src/ui/` re-exports `@mullion/ui` and the lint rule bans direct imports
of both Mantine and the primitive library.

### 3.2 Provider

```
<MullionProvider
  theme={themeIdOrDefinition}
  scope={element | shadowRoot | 'document'}
  mode={'lock' | 'follow'}
  portal={overlayRoot}
  persistence={{ key, allowed }}
  instanceId={id}
/>
```

Responsibilities, each of which today lives in a different file or in Mantine:

- Resolve the theme (definition or registry id), run `resolveColors`, emit the token sheet into
  the scope with a scope selector (`:host`, `[data-mullion-scope="id"]`, or the overlay root),
  and update it in place on switch. This is `ThemeContext` plus `OverlayRootSync` plus
  Mantine's `MantineCssVariables`, unified.
- Set `color-scheme` on the scope element and expose it as a token. No attribute stamping.
- Provide the portal container to every overlay (the overlay root from P77-B, or the document
  body under a light mount, or a caller-supplied node). The same container carries the token
  sheet, so `adminChromeStyles()` and the `--mullion-builder-*` bridge retire.
- `mode="lock"` renders children under the brand theme regardless of the gallery theme;
  `mode="follow"` inherits. Nested providers merge scope, not theme objects, so the
  `deepMerge`-spreads-a-DOM-node trap has no surface. This replaces `AdminChromeProvider`.
- Persistence and per-instance keys as `ThemeContext` does today, with the same priority order
  (user choice, instance default, host-injected candidates, default).
- Register user-authored themes at runtime through `defineTheme`, running the audits and
  refusing failures.

### 3.3 Token model

Three tiers, all emitted by the engine, all as `--mullion-*` custom properties.

| Tier | Examples | Source |
|------|----------|--------|
| Role tokens (exist) | `color-background`, `color-surface`, `color-surface-raised`, `color-text`, `color-text-muted`, `color-border`, `color-border-strong`, `color-primary`, `color-primary-stroke`, `color-primary-on`, `color-focus-halo`, status colours, `spacing-*`, `radius-*`, `shadow-*`, `font-family`, `font-size-*` | `generateCssVariables` today |
| Component tokens (new) | `input-bd`, `input-bd-focus`, `input-bg`, `control-height-sm`, `tab-color`, `tab-color-active`, `option-checked-bg`, `option-checked-color`, `menu-hover-bg`, `switch-track`, `checkbox-bd`, `table-hover` | Derived from role tokens by the engine, replacing the adapter's 31 blocks. A theme JSON may override a component token explicitly, which is what `ThemeDefinition.components` becomes |
| Framework constants (new) | `focus-ring-width: 2px`, `focus-halo-width: 6px`, `motion-fast: 150ms`, `motion-base: 380ms`, `layer-app`, `layer-overlay`, `layer-toast`, `layer-host-safe` (below the WP admin bar) | Fixed by the framework; not per theme |

Per-theme derivations that currently live in the adapter (checkbox border from `borderStrong`,
tab colours from `textMuted` and `text`, option checked colours from `primaryFill` and
`primaryOnFill`, input focus from `primaryStroke`) move into the engine as named component
tokens, where the audits can see them. Today `uiContrastAudit` has to know which Mantine
variable an affordance reads; with component tokens the audit reads the same token the CSS
does.

### 3.4 Styling layer

- Plain CSS (or SCSS compiled to plain CSS), one file per component, all under a single
  cascade layer (`@layer mullion.components`) so any consumer-side override wins without
  specificity games. Selectors are `[data-part="option"][data-checked]` style, or a stable
  class per part; never element selectors, never resets outside the gallery scope.
- No colour literals, no `!important`, no ancestor scheme selectors; three static tests.
- Sizes (`xs` to `xl`) and variants (`filled`, `subtle`, `outline`, `light`) are data
  attributes read by CSS, mapped to tokens. The about 1,500 literal `size` and `variant` props
  in the codebase migrate mechanically; the scales themselves are the designer's to set.
- Layout primitives (`Stack`, `Group`, `Center`, `Grid`, `Container`) accept a small prop set
  (`gap`, `align`, `justify`, `wrap`, `padding`) that renders as inline custom properties
  (`--mullion-gap`) on the element, which travel with it into any tree. Mantine's full style-prop
  surface (`m`, `p`, `c`, `fw`, `fz`, `w`, `h`, `pos`, responsive objects) is deliberately not
  reproduced; the 1,535 occurrences migrate to the primitive props, to `className`, or to
  `Text` variants. This is the largest mechanical cost of the migration and it is the same
  under Mantine headless.
- Focus is a single rule on `[data-focus-visible]` (or `:focus-visible` where the primitive
  does not set the attribute): 2px core in `--mullion-color-primary-stroke`, 6px halo in
  `--mullion-color-focus-halo`, geometry constants from the framework tier.
- Motion honours `prefers-reduced-motion` through one token switch, not per component.
- Browser features that remove code from the framework, with support on 2026-09-10: the
  Popover API and `<dialog>` (universal), `inert` (universal), CSS anchor positioning
  (Chrome 125, Safari 26, Firefox 147; 84% global). Anchor positioning would let tooltips and
  small popovers skip Floating UI, but the primitive library brings Floating UI anyway, so
  this is an optimisation to revisit, not a design input.

### 3.5 Delivery

One registration list (`uiStyles.ts`) concatenates the component sheets and the gallery
structural sheet. The provider writes the concatenation into every scope it owns (document
head once, each gallery shadow root, the overlay root), preferring `adoptedStyleSheets` with a
single constructable sheet where supported and falling back to `<style>`. The token sheet is
per scope and small. The P77-A tests carry over almost unchanged: every selector scoped, every
module registered, no inline pseudo-state, plus the three new static tests from 3.4.

### 3.6 Component API shape

- Compound parts where the primitive has them (`Select.Root`, `Select.Trigger`,
  `Select.Content`, `Select.Option`), with a flat convenience component (`Select` with `data`)
  for the common case, because 26 files use the flat Mantine form.
- Polymorphism through a `render` or `asChild` prop, whichever the primitive uses; the 23
  `component=` usages migrate.
- Every overlay accepts `container` and defaults to the provider's portal; `withinPortal`
  becomes `portal={false}`.
- Imperative managers: `notify.show()`, `confirm()`, mirroring the 48 and 11 call sites, backed by
  the primitive's toast and dialog.
- Hooks: `useDisclosure`, `useMediaQuery`, `useLocalStorage`, `useDebouncedValue`,
  `useElementSize`, `useMergedRef` and `getHotkeyHandler` owned in about 150 lines, or
  `@mantine/hooks` kept as a styling-free dependency.

## 4. Behaviour sourcing, component by component

The 62 Mantine components in use, grouped by what supplies the behaviour. "Primitive" means
the library chosen by the P77-E spike; the column shows which candidate has a direct
counterpart (Ark UI, Base UI, React Aria Components) so the spike's coverage question is
concrete.

**What "ours" means here.** Styling, tokens and the component API are ours in every row
without exception; that is the whole point of the framework and is never what the word is
marking. Where the tables say "ours" they mean one of three narrower things, and the
distinction matters because only the second carries correctness risk:

| Sense | Meaning | Examples |
|-------|---------|----------|
| Ours, presentational | No behaviour to buy. A styled element reading tokens, with no keyboard, focus or ARIA state machine | `Text`, `Stack`, `Badge`, `Card`, `Table`, `Button`, the first table below |
| Ours, behavioural | The primitive supplies nothing for this and we write real interaction code. Each instance is named in the tables and each is a risk to review | `Textarea` autosize, the `SegmentedControl` indicator animation, the notification store, `Pagination` where the primitive lacks it |
| Ours, composed | The primitive has the parts but not the assembled component; we compose its parts and own the assembly, not the semantics | tags input on Base UI and React Aria, password input on Base UI |

Focus return across the shadow boundary was listed here as a fourth case in the first draft of
this document and is not one. Measured in the libraries' sources on 2026-09-10, all three
candidates already resolve the focused element through the shadow tree before storing it, so
the P76-era bug does not survive the move: Base UI's `activeElement(doc)` walks
`shadowRoot.activeElement` and `FloatingFocusManager` stores its result; Zag's focus trap
stores `getActiveElement(this.doc)` from `@zag-js/dom-query`, which walks nested roots;
React Aria's `useRestoreFocus` stores `getActiveElement()` from its shadow DOM helpers, gated
behind the global `enableShadowDOM()` flag. Mantine's `useFocusReturn` stores
`document.activeElement` unguarded, which is why focus returns to `body` today.

| Ours (presentational, no primitive needed) |
|---|
| `Text`, `Title`, `Anchor`, `Kbd`, `Badge`, `Alert`, `Loader`, `Skeleton`, `Divider`, `Image`, `Paper`, `Card`, `Center`, `Container`, `Stack`, `Group`, `Grid`, `SimpleGrid`, `Box`, `UnstyledButton`, `Button`, `ActionIcon`, `CloseButton`, `ColorSwatch`, `VisuallyHidden`, `Table`, `Chip` (a styled checkbox or toggle), `CopyButton`, `FileButton`, `Collapse` |

| Behavioural | Ark UI | Base UI | React Aria Components | Note |
|-------------|--------|---------|------------------------|------|
| `Modal`, `Drawer`, `ModalsProvider` | Dialog, Drawer | Dialog, Drawer, AlertDialog | Dialog, Modal | All three restore focus through a shadow boundary; Mantine does not (section 5.2 item 8) |
| `Popover`, `Tooltip` | Popover, Tooltip | Popover, Tooltip, PreviewCard | Popover, Tooltip | Anchor positioning later |
| `Menu` | Menu | Menu, Menubar, ContextMenu | Menu | |
| `Select`, `MultiSelect`, `Combobox`, `useCombobox`, `TagsInput` | Select, Combobox, Listbox, TagsInput | Select, Combobox, Autocomplete (tags by composition) | Select, ComboBox, ListBox, TagGroup (tags by composition) | Coverage discriminator |
| `TextInput`, `Textarea`, `PasswordInput` | Field, PasswordInput | Field, Input | TextField | Textarea autosize is ours |
| `NumberInput` | NumberInput | NumberField | NumberField | Replaces `react-number-format` |
| `ColorInput` | ColorPicker | none | ColorPicker, ColorField | Base UI gap |
| `Checkbox`, `Switch` | Checkbox, Switch | Checkbox, Switch | Checkbox, Switch | |
| `SegmentedControl` | SegmentGroup | ToggleGroup | ToggleButtonGroup | Indicator animation is ours |
| `Slider` | Slider | Slider | Slider | |
| `Tabs` | Tabs | Tabs | Tabs | |
| `Accordion` | Accordion | Accordion, Collapsible | Disclosure, DisclosureGroup | |
| `ScrollArea` | ScrollArea | ScrollArea | none (native overflow) | |
| `Pagination` | Pagination | none | none | Base UI and RAC gap; small to own |
| `Notifications` | Toast | Toast | Toast | Store is ours |
| `Transition`, `Collapse` (animated) | Presence | (CSS transitions, `keepMounted`) | (CSS) | `@starting-style` where available |
| `Portal`, `FocusTrap` | Portal, FocusTrap | Portal (via each component) | (via each component) | |
| `Progress` | Progress | Progress, Meter | ProgressBar, Meter | |
| `useForm` (1 file) | none needed | Form, Field | Form | Plain state suffices |

Beyond Mantine, the framework keeps: Dockview (themed through `--dv-*` from our tokens, inside
the overlay root, so the inline bridge is no longer needed), dnd-kit, react-photo-album,
react-zoom-pan-pinch, embla, recharts, Tabler icons.

## 5. Parts of Mantine to address

The short list the user asked for. "Need" is what this codebase uses and must have a home;
"should" is the shortcoming a replacement is the chance to design out.

### 5.1 Need to address (in use today)

1. Provider: theme resolution, CSS variable emission at a selector, colour scheme, root
   element, three nesting patterns (gallery, locked chrome, wp-admin).
2. Styles API: `classNames`, `styles`, `vars` on 62 components; 18 component-level `styles`
   props; the adapter's 31 override blocks.
3. Box style props (1,535 uses) and responsive props; `size`, `variant`, `radius`, `color`
   literals (about 1,500).
4. Polymorphic `component=` (23 uses) and `renderRoot`.
5. `Portal` with a shared target node; `Transition` and `Collapse`; `FocusTrap`.
6. Overlays: `Modal`, `Drawer`, `Popover`, `Tooltip`, `Menu`; stacking via the z-index scale;
   `closeOnClickOutside`, `closeOnEscape`, `keepMounted`, `transitionProps`.
7. Combobox family: `Select`, `MultiSelect`, `Combobox` with `useCombobox`, `TagsInput`;
   grouped data; `withinPortal`.
8. Input family: `TextInput`, `Textarea`, `PasswordInput`, `NumberInput`, `ColorInput`;
   `Input.Wrapper` labels, descriptions, errors, sections.
9. Choice controls: `Checkbox`, `Switch`, `Chip`, `SegmentedControl`, `Slider`.
10. Navigation and structure: `Tabs`, `Accordion`, `ScrollArea`, `Pagination`, `Table`.
11. Feedback: `Alert`, `Badge`, `Loader`, `Skeleton`, `Progress`, `Notification`.
12. Layout and typography: `Stack`, `Group`, `Center`, `Container`, `Grid`, `SimpleGrid`,
    `Paper`, `Card`, `Divider`, `Text`, `Title`, `Anchor`, `Kbd`, `Image`, `VisuallyHidden`.
13. Utilities: `FileButton`, `CopyButton`, `ColorSwatch`, `CloseButton` (with its global
    `aria-label` default).
14. Packages: `@mantine/notifications` (48 calls), `@mantine/modals` (11), `@mantine/form` (1),
    `@mantine/hooks` (7 hooks).
15. Tooling: the test provider wrapper (117 files), the Storybook decorator (16 stories),
    three e2e selectors, `src/theme.ts`.

### 5.2 Should address (shortcomings met, with the P77 evidence)

1. `styles` emits inline style and silently drops pseudo-selectors (P76-I-1). Design out: no
   inline colour anywhere; state by attribute; a static test.
2. Colour-scheme rules key on an ancestor attribute (P76-D/H). Design out: scheme as a token
   and a `color-scheme` declaration on the scope.
3. The theme model is a translation target: 10-rung tuples, `primaryShade`, no slot for
   `primaryStroke`, `focusHalo`, `surfaceRaised` (adapter, 601 lines). Design out: the engine is
   the model; component tokens replace the override blocks.
4. Library CSS at specificity (0,2,0) to (0,3,0) that ours must double classes to beat
   (`chrome-portable.scss`). Design out: no third-party CSS; a cascade layer.
5. Not every state has a variable (`Tabs` tab colour, `SegmentedControl` label colour,
   `Select` option checked colour; P77-C). Design out: every state is an attribute and every
   colour is a token, so there is nothing to expose.
6. `vars` not forwarded from `Select` to `Combobox` (P77-C). Design out: tokens inherit
   through the scope; nothing is forwarded.
7. `Portal` string targets go through `document.querySelector` and cannot see a shadow root;
   `deepMerge` spreads a DOM node into a plain object (P77-B). Design out: the provider owns
   the container; providers merge scope, not objects.
8. `useFocusReturn` records `document.activeElement` and returns focus to `body` (FUTURE_TASKS).
   Design out: record `getRootNode().activeElement` on the trigger's root, walking nested
   roots.
9. The global focus ring is drawn from the fill colour (P76-I-2) and its geometry is not a
   token. Design out: the P77-F pair as framework constants and tokens.
10. A z-index scale with no relation to host layers (`#wpadminbar` at 99999 covers the drawer
    header). Design out: a `layer-host-safe` token the embed can set from PHP.
11. Headless mode is global per provider and style props die with it. Design out: there is no
    styled mode to switch off.
12. Attribute naming that must be checked per component (`data-checked` versus
    `data-selected`). Design out: one documented attribute vocabulary across parts.
13. Yearly majors with breaking API changes absorbed twice in one week. Design out: the
    facade plus a primitive with a stable major; the framework's own API is versioned by us.
14. No first-class multi-instance scoping, lock and follow mode, or runtime theme editing.
    Design out: provider concerns in 3.2.
15. `sideEffects: ["*.css"]` and a single stylesheet for the whole library. Design out:
    per-component sheets in one registration list, tree-shaken with the components.

## 6. What it would take

Effort classes follow the phase docs (Small, Medium, Large) and are driven by the measured
counts, not estimated in days.

| Step | Scope | Effort | Depends on |
|------|-------|--------|------------|
| 0 Facade | `src/ui/`, lint boundary, re-exports (Phase 78 A) | Medium | none |
| 1 Primitive spike | Five components on two candidates against the fixed tests in the evaluation's section 9 | Small-Medium | 0 |
| 2 Engine extension | Component token tier, framework constants, `defineTheme` with audits at save | Medium | none |
| 3 Framework core | `MullionProvider` (scope, portal, mode, persistence), delivery, token sheet, layout and typography primitives, focus rule | Medium-Large | 1, 2 |
| 4 Behavioural components, wave one | Input family, `Modal`, `Drawer`, `Popover`, `Tooltip`, `Menu` (the adapter's hardest cases) | Large | 3 |
| 5 Behavioural components, wave two | `Select` family, `Tabs`, `SegmentedControl`, `Checkbox`, `Switch`, `Chip`, `Slider`, `NumberInput`, `ColorInput`, `Accordion`, `ScrollArea`, `Pagination`, toast and confirm managers | Large | 4 |
| 6 Theme manager merge | Registry, catalogue, `ThemeSelector`, persistence, scoping, lock and follow, the editor | Medium | 3 |
| 7 Consumer migration | 142 files; 1,535 style props; about 1,500 size and variant literals; 117 test files onto the new wrapper; 16 stories; 3 e2e selectors; `--mantine-*` references in 58 files | Large, incremental behind the facade | 4, 5, 6 |
| 8 Removal | Drop `@mantine/*`, the adapter, `chromeTheme.ts`, `chrome-portable.scss`, `AdminChromeProvider`, `adminChromeStyles()`, the builder bridge; retarget the P77-A tests | Small | 7 |

The critical path is 0, 1, 3, 4, 5, 7. Steps 2 and 6 run beside it. Wave one lands the
components where Phase 76's defects lived, so the framework is validated against the hardest
cases before the long tail. Every wave lands with the theme-qa harness, the axe gate, the
delivery guards and the ring walk green; new baselines are captured per component as the
designer's refresh arrives, and the P78 rule that a refactor moves zero pixels applies only to
step 0.

## 7. Risks

| Risk | Mitigation |
|------|------------|
| The primitive's shadow handling has a gap the spike did not exercise | The spike runs the P77-B hostile-host probe and the ring walk, both of which found real defects before; keep the probe as an e2e spec |
| Accessibility regressions in wrappers (wrong ARIA on a composed part) | Wrap thin; keep the primitive's parts; the axe gate per component plus manual keyboard passes per wave, recorded in `ACCESSIBILITY_MANUAL_AUDIT.md` |
| The mixed state during migration looks inconsistent | The facade makes it safe; the designer decides whether a release may ship mixed; if not, the release waits for wave two, which the user has accepted |
| The style-prop rewrite is larger than counted | The count is mechanical (1,535); a codemod handles `gap`, `align`, `justify`, `wrap`, `p`; the remainder is `Text` variants and `className` |
| A primitive major during the migration | The facade limits the change to `@mullion/ui`; pin the major; Ark v5 has been stable eighteen months, Base UI is on 1.x |
| The framework grows its own opinions and becomes a Mantine | Principle 2 and its tests; component tokens live in the engine, not the framework; the designer owns the scales |
| Designer capacity | Wave one can ship on the current visuals expressed in our tokens; the refresh is not a gate for the framework, only for baselines |

## 8. What is not in scope

- No decision on numbering the phases that would build this; that is the user's call after
  Phase 78 is re-planned.
- No prototype. The P77-E spike is the first code, and it belongs to the phase that builds the
  framework.
- No review of Mantine's total surface. The inventory in section 5 is what this codebase
  touches; a full comparison is only worth doing if the path is taken.
