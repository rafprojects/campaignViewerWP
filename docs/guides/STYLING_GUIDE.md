# Styling Guide

How CSS reaches a rendered element in this app, which channel to write a given
style through, and the tests that hold that choice in place. The first half is
the style-delivery contract from Phase 77 track A; the second half keeps the
older embedding guidance that still applies.

Every claim of reach below was measured in a browser on 2026-09-09, in both
mount modes and both `applyThemeEverywhere` states, with the Settings drawer
and the Admin panel open. The probe compared each stylesheet's selectors
against `document.styleSheets` and the shadow root's sheets. Do not update the
reach columns from reading source; re-measure.

## 1. The two trees

The app mounts in one of two ways, and the shipped default is the first:

| Mount | When | Where the app renders |
|-------|------|-----------------------|
| Shadow | default; every WordPress shortcode | a shadow root on the host element (`#mullion-default`, `#root` in dev) |
| Light | `?shadow=0` or `window.__USE_SHADOW_DOM__ = false`; the wp-admin Spaces and Asset pages | directly under the host element |

Mantine's `Portal` appends to `document.body`. Under a shadow mount, every
Drawer, Modal, Menu, Popover, Tooltip and Select dropdown that uses the portal
therefore renders in the **document**, outside the shadow root that holds the
gallery. A stylesheet lives in exactly one tree, and a rule in the wrong tree
does nothing, without any error. That single fact is behind five of the six
visual defects fixed in Phase 76, and it is the reason this contract exists.

Two surfaces are worth naming because they sit on opposite sides of the line:

- The **Settings drawer** (`SettingsPanel`) and the **Layout Builder**
  (`LayoutBuilderModal`) are portaled. They are in the document.
- The **Admin panel** (`AdminPanel`, including the Campaigns and Media tabs)
  renders inline in `App.tsx`. It is in the gallery tree, inside the shadow
  root under the shipped mount.

## 2. Delivery mechanisms

There are four ways CSS physically arrives at an element. Everything a
developer writes is one of these, and reach is a property of the mechanism.

| # | Mechanism | Shadow mount reaches | Light mount reaches |
|---|-----------|----------------------|---------------------|
| M1 | **Document stylesheet.** Any `import './x.css'` or CSS module in the bundle. Vite injects a `<style>` per file in dev; in production the plugin enqueues the built CSS from the Vite manifest (`class-mullion-embed.php`) and lazy chunks inject their own `<link>`. | document only: portaled chrome, never the gallery | everything |
| M2 | **Shadow-root style block.** `shadowStyles.ts` concatenates a fixed list of files with `?inline` and `main.tsx` writes them into `<style data-mullion>` in the shadow root. | gallery tree only, never portaled chrome | not used |
| M3 | **Runtime-injected variable sheets.** `ThemeContext` writes `#mullion-theme-vars` (the `--mullion-*` tokens) into the shadow root, or into `document.head` scoped by `[data-mullion-theme-scope]` for a light mount. Mantine writes its own `--mantine-*` sheet at `cssVariablesSelector` (`:host` or `:root`) and a `.mullion-admin-chrome` sheet for the nested chrome provider, both rendered where the React root lives. React 19 also hoists Mantine's responsive style-prop sheets (`__mdi__-*`) into the root container. | gallery tree; the `--mullion-*` tokens never reach portaled chrome in either mount | document, but `--mullion-*` is scoped to the host element and still misses portaled chrome |
| M4 | **Inline `style` on the element.** Mantine's `styles` prop, its `vars` prop (custom properties), `adminChromeStyles()` and the `--mullion-builder-*` block. Travels with the element wherever it is portaled. | the element | the element |

Mantine's own `styles.css` is imported both unconditionally in `main.tsx`
(M1) and in `shadowStyles.ts` (M2). That is why Mantine components look
right on both sides of the boundary while a rule of ours written to only one
of those files does not.

## 3. Authoring surfaces

| Surface | Mechanism | Reach under the shipped mount | Status |
|---------|-----------|-------------------------------|--------|
| `src/styles/chrome-portable.scss` | M1 and M2 (imported in both `main.tsx` and `shadowStyles.ts`) | both trees; also leaks into the host page | **canonical** for Mantine class overrides that admin chrome must see |
| `src/styles/global.scss` | M2 under shadow; M1 (dynamic import) under light | gallery tree only | **canonical** for structural rules under `.mullion-gallery`; every selector must carry that ancestor (tested) |
| CSS module registered in `shadowStyles.ts` (`CampaignCard`, `CardGallery`, `CampaignViewer`) | M1 and M2 | both trees | **canonical** for component-local structure in the gallery tree |
| CSS module not registered (`MediaCard`, `MediaTab`, `TemplatePickerModal`) | M1 only | document only | **constrained**: allowed only when every consumer is portaled; the registry test requires a stated justification. `MediaCard` and `MediaTab` are consumed inside the Admin panel and are therefore dead in the shipped mount; P77-C registers them |
| `src/styles/builder.css`, `src/styles/wpAdminFormReset.css` | M1 only | document only | **constrained** by design: Dockview lives in the portaled Layout Builder; the wp-admin reset targets light-DOM admin pages and is intentionally absent from the shadow tree |
| Mantine `vars` (theme adapter or component prop) | M4 as custom properties | the element and Mantine's own rules that read the variable, including pseudo-state rules | **canonical** for colour and state on a Mantine part whenever Mantine exposes a variable for it (`--input-bd`, `--table-hover-color`, `--checkbox-color`, and so on) |
| Mantine `classNames` plus a stylesheet | whichever stylesheet | see the stylesheet | **canonical** for state and pseudo-state Mantine does not expose a variable for; the stylesheet must be `chrome-portable.scss` if the part can render in chrome |
| Mantine `styles` (theme adapter or component prop) | M4 as inline style | the element; pseudo-class and attribute keys are silently dropped (P76-I-1) | **constrained**: flat declarations only, and only when no `vars` route exists. Two tests enforce flatness, one for the adapter and one for the 14 component call sites |
| `adminChromeStyles()` (`chromeTheme.ts`) | M4 | Drawer and Modal `inner` and `content` | **legacy, load-bearing**: the only way theme tokens reach portaled chrome across the boundary (P76-H). Carries the full `--mantine-*` set and one `--mullion-*` token. Retired or generalised by P77-B |
| `--mullion-builder-*` inline block (`LayoutBuilderModal`) | M4 | the builder shell | **legacy, load-bearing**: Dockview is themed through `--dv-*` variables that must resolve inside a portal. Same fate as the row above |
| `ThemeContext` `cssVars` | M3 | gallery tree | **canonical** for per-theme tokens in the gallery tree |

Counting authoring surfaces gives eleven, more than the seven the Phase 77
plan listed, because CSS modules split by registration and the two plain
`.css` files were missing from the list. Counting mechanisms gives four. The
phase's "lower than seven" target is met at the mechanism level and is not
met at the surface level, and the table says why each survivor exists. Every
legacy surface is a consequence of the shadow-plus-portal boundary, which is
P77-B's decision, not this document's.

## 4. Which channel for which job

| Job | Write it as | Not as |
|-----|-------------|--------|
| Colour or state on a Mantine part that has a variable (`--input-bd`, `--input-bd-focus`, `--table-hover-color`) | `vars` in `adapter.ts` | `styles`, which pins the colour inline and outranks Mantine's own focus and checked rules |
| Pseudo-state or attribute state on a Mantine part with no variable (`:focus-visible` rings, `[data-active]`, `[data-selected]`) | a stable class through `classNames` plus a rule in `chrome-portable.scss` | a rule in `global.scss`, which never reaches portaled chrome |
| Overriding a Mantine class on anything that can render in chrome | `chrome-portable.scss`, class selectors only, doubled first class to clear Mantine's specificity | `global.scss`; element selectors or resets in `chrome-portable.scss`, which leaks into the host page |
| Structural layout in the gallery tree | `global.scss` under `.mullion-gallery`, or a CSS module registered in `shadowStyles.ts` | a CSS module you forgot to register; the registry test will tell you |
| Structural layout for a portaled surface only | a CSS module listed in the test's `DOCUMENT_ONLY_MODULES` with the consumer that justifies it | registration in `shadowStyles.ts` is harmless but pointless |
| Static, state-free declarations on a Mantine part | `styles` with flat keys is acceptable | nested keys; both flatness tests fail on them |
| Per-theme tokens for gallery components | `--mullion-*` from `ThemeContext` | hardcoded hex; see the theme authoring guide |
| Per-theme tokens for portaled chrome | `adminChromeStyles()` on the Drawer or Modal, until P77-B | reading `--mullion-*` from a chrome stylesheet without a fallback; the token is not there |
| A third-party library themed by CSS variables inside a portal | the inline variable bridge, as Dockview does | expecting M2 or M3 to reach it |

When in doubt, the question to ask is "which tree is the element in when it
paints?", and the answer decides the mechanism. The surface follows.

## 5. Tests that hold the contract

| Test | Guards | Mutation that fails it |
|------|--------|------------------------|
| `src/styles/__tests__/styleDelivery.test.ts`: global.scss scope | every `global.scss` selector carries `.mullion-gallery`, except an explicit known-dead list that P77-C empties | append an unscoped rule |
| same file: module registry | every `*.module.scss` is registered in `shadowStyles.ts`, document-only with a justification, or on the known-dead list | add a module without registering it |
| same file: component `styles={}` flatness | no nested key in any component-level `styles` prop | add `'&:hover'` to any `styles={{}}` |
| `src/themes/__tests__/adapter.test.ts`: adapter flatness (P76-I-1) | the same rule for the theme adapter across all 23 themes | add a nested key to any component block |
| `e2e/style-delivery.spec.ts` | with the Settings drawer open, every selector compiled from `chrome-portable.scss` is present in the document's sheets and in the shadow root's; `global.scss` is present in exactly the tree its mechanism implies | remove either `chrome-portable.scss` import |
| `e2e/theme-qa.spec.ts`: focus ring colour (P76-I-2) | the painted ring on every tabbable control in the drawer is `primaryStroke` | drop a selector from the ring rule |

The e2e spec needs the gallery dev server on the configured port. Note that
`playwright.config.ts` reuses any server already listening there, whatever it
is serving, so a stray dev server from another project produces a confusing
timeout rather than a clear error.

## 6. Embedding guidance that still applies

**Scope everything under `.mullion-gallery`.** WordPress themes apply global
CSS freely. Under a light mount our rules and theirs share one document, so a
bare `button` or `img` rule in `global.scss` would restyle the host page. The
scope test above enforces this; `chrome-portable.scss` is the one deliberate
exception, which is why it may contain Mantine class selectors only.

**No resets outside the root.** `* { box-sizing }` and base typography live
under `.mullion-gallery`, never at `:root` or `body`.

**Theme through CSS variables.** Colours, radii, shadows and typography are
`--mullion-*` custom properties generated per theme by the theme engine.
Components read the variable, never a hex. Where the variable cannot reach
(portaled chrome), the variable is carried inline by `adminChromeStyles()`;
the fix is never to hardcode the value.

**Keep CSS modules for component structure**, and register them in
`shadowStyles.ts` when the component renders in the gallery tree.

**One z-index token.** `--z-header: 40` is set on `.mullion-gallery` in
`global.scss` and read by the sticky gallery header and both auth-bar
variants. Portaled chrome takes Mantine's own `--mantine-z-index-*` scale.

**Narrow embeds.** `.mullion-gallery--compact` on the root reduces the
container max-width and horizontal padding.

**Shadow DOM versus iframe.** Shadow DOM gives strong CSS isolation in the
same JS context at the cost of the boundary this document is about. An iframe
gives total isolation and needs cross-window messaging for everything else;
it is not implemented and not planned. Dropping shadow DOM was considered and
rejected in Phase 77 (Key Decision C): it is the only protection against host
CSS the plugin cannot obtain any other way.

Document rewritten 2026-09-09 for Phase 77 track A. The previous version
(January 2026) predates the shadow-plus-portal findings of Phases 75 and 76
and described CSS variables as scoped to `.mullion-gallery`, which has not
been true since the shadow mount became the default.
