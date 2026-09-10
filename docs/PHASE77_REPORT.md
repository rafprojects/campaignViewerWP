# Phase 77 - Visual architecture spikes and hardening

**Status:** In progress
**Created:** 2026-08-28
**Last updated:** 2026-09-10 (P77-E and P77-H delivered; P77-A, P77-G, P77-D, P77-C and P77-F landed; P77-B decided, prototype behind a flag)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P77-A | Style-delivery seam — inventory every channel, name one canonical channel per job, enforce it with tests | **Done** (2026-09-09), see notes | Medium |
| P77-B | Mount strategy — decide whether portaled admin chrome moves inside the shadow root, and record the decision before release | **Decided** (2026-09-09): overlay root, prototype behind a flag, default unchanged until accepted; see Decision below and the notes | Medium |
| P77-C | Fix the `global.scss` rules that have never reached portaled admin chrome in shadow mode | **Done** (2026-09-09), see notes | Small |
| P77-D | Test-suite integrity — three e2e specs failing on a clean tree, plus the vacuous `theme-qa` persistence test; PHP suite failures folded in 2026-09-09 | **Done** (2026-09-09) | Small-Medium |
| P77-E | UI dependency evaluation — Mantine, an alternative, or in-house. Decision document only | **Done** (2026-09-10): [UI_DEPENDENCY_EVALUATION.md](UI_DEPENDENCY_EVALUATION.md); recommends an in-house layer on headless primitives behind the Phase 78 facade, primitive settled by a spike; see Decision below and the notes | Medium |
| P77-F | Two-tone ("halo") focus ring — neutral halo from the theme's grounds around the P76-I-2 ring, making focus visibility structural for themes no audit can see | **Done** (2026-09-09), see notes; designer review in situ still open | Small-Medium |
| P77-G | The plugin enqueues only the entry's own CSS; Mantine's base stylesheet and Dockview's reach the production document only when a dynamic chunk happens to preload them | **Done** (2026-09-09), verified on the redeployed dev site | Small |
| P77-H | In-house UI framework study: what a token-driven framework of our own on headless primitives would take, the Theme Manager merge, and the list of Mantine parts to address. Document only | **Done** (2026-09-10): [IN_HOUSE_UI_FRAMEWORK_STUDY.md](IN_HOUSE_UI_FRAMEWORK_STUDY.md); see the notes | Medium |

---

## Rationale

1. **What triggered it.** Phase 76 fixed five separate visual defects, and after the last one the user challenged whether the work was accumulating workarounds rather than addressing structure. The challenge was fair, and the pattern turned out to be nameable: **every one of those defects was the same failure — a style written through a channel that does not reach where the component actually renders.**

   | Defect | Channel used | Why it did not reach |
   |--------|--------------|----------------------|
   | P76-D/H — input borders collapsed in follow mode | Mantine scheme-keyed CSS | the keying attribute was absent on the portaled tree |
   | P76-I-1 — no focus indicator on inputs; 18 inert style blocks | Mantine `styles` | emits inline styles; pseudo-selectors are silently dropped |
   | P76-I-2 — focus ring stayed `primaryFill` | `global.scss` | shadow-root only; the Drawer portals to `document.body` |
   | pre-existing — select-option highlight, Tabs tab styling | `global.scss` | same |
   | pre-P76 — Dockview theming | 22 `--mullion-builder-*` inline properties | the workaround, paid earlier |

   There are roughly **seven** delivery channels with materially different reach, about **40 files** touch the plumbing, and nothing states which channel is correct or verifies the choice.

2. **Why it belongs together.** A and B are the two halves of one question — *what are the seams, and where is the boundary?* C is the concrete, user-visible instance of A, which makes it the cheapest possible proof that the contract in A is real rather than aspirational. D removes the noise that would otherwise hide regressions while A–C move styling around. E is the user's explicit question about Mantine, deliberately sequenced last because A and B change its inputs.

3. **Why now, ahead of release.** The user chose to settle this before shipping rather than on top of it. One track has a genuine deadline argument: **B's decision has post-release compatibility consequences.** If the plugin ships with shadow DOM and later moves to light DOM, CSS that site owners wrote — which currently does nothing — would suddenly start applying to plugin markup. That is a silent, site-by-site behaviour change, and it is much cheaper to decide now than to migrate later. The rest of the phase has no such deadline and is here by choice, not necessity.

4. **Success.** A developer adding a style to admin chrome has one documented answer for where it goes, and a test fails if they pick a channel that cannot reach the target. The shadow-DOM boundary is either removed or explicitly affirmed with its cost written down. The e2e suite is green on a clean checkout. The Mantine question has a written answer with the conditions that would change it.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Do the spikes gate the facade, or run in parallel with it? | **Gate it.** The facade (Phase 78) is a boundary, and a boundary drawn before knowing what it must abstract is a guess. B in particular could delete whole categories of workaround — if chrome renders inside the shadow root, `chrome-portable.scss`, `adminChromeStyles()` and the `--mullion-builder-*` bridge may all become unnecessary, which materially changes what the facade needs to wrap. Agreed explicitly with the user 2026-08-28. |
| B | Does the facade belong in this phase? | **No — it is Phase 78.** It was originally proposed as a track here, then moved out so the facade is one coherent phase rather than a skeleton in 77 and a migration in 78. |
| C | Is dropping shadow DOM a live option in B? | **No. Rejected, and recorded as rejected so it is not re-proposed.** See P77-B below — it trades away the only protection the plugin cannot obtain any other way. |
| D | Does E risk becoming a migration instead of an evaluation? | **Constrain it to a decision document.** E produces criteria, scores and a recommendation with exit conditions. It writes no component code. A half-migrated component layer is worse than either endpoint. |
| E | Should release-adjacent backlog items be pulled in to pad the phase? | **No.** The privacy items are Low impact (Sentry is off by default without a DSN; the Google Fonts data flow is documented in `PRIVACY.md` with opt-outs), CORS is explicitly meaningless for the shortcode deployment actually shipped, and the a11y gate's own entry says WCAG AA is a quality bar rather than a WP.org submission gate. Adding them would pad the phase without protecting the release. |
| F | Does the "roll our own" study belong inside E or in its own track? | **Its own track, P77-H** (2026-09-10). The user asked for a separate document and left the split to the author. E decides; H describes what the decided path takes and lists the Mantine parts to address. Keeping them apart lets H stand whether or not E's recommendation is followed. |
| G | Where does behaviour come from if we roll our own? | **Headless behaviour primitives** (user, 2026-09-10). Keyboard, focus and ARIA come from a primitive library; styling, theming and the component API are ours. Writing behaviours from scratch and vendoring behaviour code were both declined. |
| H | How much release delay may a migration cost? | **Correctness over timing** (user, 2026-09-10). No ceiling; the evaluation states the delay each option implies and weights migration cost at 1. |
| I | Which criteria weigh most? | **Theming fidelity and designer control over the visual language** (user, 2026-09-10), both at weight 3. Shadow-DOM friendliness and maintenance viability are gates, not scores. Maintainer capacity is undecided, so longevity sits at neutral weight. |
| J | What does "merge the Theme Manager with the theming implementation" absorb? | **All four** (user, 2026-09-10): the engine's model as the only theme model; registry, switching and persistence; runtime theme editing by users; per-instance scoping and lock/follow mode. Requirements of P77-H section 3. |
| K | Do the wp-admin Spaces and Assets pages fall under the same decision? | **Same framework everywhere** (user, 2026-09-10). `@wordpress/components` is scored only as a surface-specific option and rejected. |
| L | Does the Phase 78 facade land first regardless of E's outcome? | **Yes** (user, 2026-09-10). Every migration option is scored behind it. |
| M | Visual parity or refresh if we replace? | **A refresh with the designer is welcome** (user, 2026-09-10). No option is charged for failing to reproduce Mantine's look; the theme-qa baselines are recaptured per component as the refresh lands. |

## Execution Priority

1. **P77-D** first, and deliberately. Three specs fail on a clean checkout today; A–C all move styling around, and a suite with a known-red floor cannot tell you whether you broke something.
2. **P77-A** next — the inventory is the input to everything else, and its enforcement tests are what stop the pattern recurring.
3. **P77-C** immediately after A, as A's first real customer. If the contract cannot express this fix cleanly, the contract is wrong.
4. **P77-B** — larger validation surface, and its outcome may retire parts of A's channel list.
5. **P77-F** after C — the ring rule is one of the styles A/C move around, so land the halo
   through the canonical channel once it exists rather than adding another delivery-channel
   customer first and migrating it later.
6. **P77-E** last. Gated on A and B by construction.
7. **P77-G** slots in as soon as it is accepted: it is small, it is a production delivery bug rather than architecture, and A's contract already describes the mechanism it repairs.
8. **P77-H** beside E, written after E's scoring so it describes the path E recommends rather than a path in the abstract.

---

## Track P77-A - One canonical style-delivery seam

### Problem

Styles reach components through at least seven channels, each with different reach:

| Channel | Reaches |
|---------|---------|
| Mantine `styles` | the element, as **inline styles** — pseudo-selectors are dropped |
| Mantine `vars` | the element, as CSS custom properties — cascades into Mantine's own rules |
| Mantine `classNames` + SCSS | wherever the stylesheet reaches |
| `global.scss` | the shadow root under a shadow mount; the document under a light mount |
| `chrome-portable.scss` | both — added in P76-I-2 precisely because `global.scss` does not |
| `adminChromeStyles()` inline variable blocks | the portaled element, by construction |
| `ThemeContext` injected `cssVars` | the shadow root, or `document.head` in light mode |

Nothing documents which to use for a given job, and nothing verifies the choice. Each Phase 76 fix *added* a channel rather than reducing the count.

### Fix

1. **Inventory and classify** every channel by reach: shadow tree only, document only, both, per-element inline.
2. **Name one canonical channel per job** — state colour and pseudo-state, static layout, third-party-library variables, per-theme tokens — and mark the rest legacy, with a note on what each legacy channel is still load-bearing for.
3. **Enforce it.** Phase 76 produced two patterns that caught real regressions the source could not reveal, and both should be extended rather than reinvented:
   - a unit test walking all 23 themes that fails on any nested selector in a `styles` block (P76-I-1) — mutation-tested;
   - an e2e test that tabs the live panel and asserts the **painted** result (P76-I-2), which caught a Switch the selector list had missed.

   The new one this track owes: a test asserting that every selector intended for admin chrome is actually present in `document.styleSheets` with the Drawer open. That is the check that would have caught P77-C's defect years earlier.
4. **Collapse the count** where the contract makes a channel redundant.

### Acceptance criteria

- A written contract exists in `docs/` (or `CLAUDE.md`) naming the canonical channel per job, with reach stated for each.
- At least one test fails if a style is written to a channel that cannot reach admin chrome.
- The channel count is lower than seven, or each survivor has a stated reason it must exist.
- No new channel is introduced by this track.

### Validation

- `npx vitest run`, `npx playwright test theme-qa`, `npm run build`.
- The new delivery test must be **mutation-tested**: break the delivery deliberately and confirm it fails. A green test that cannot fail is the exact defect P76-I-1 found in the existing suite.

---

## Track P77-B - Mount strategy: decide the shadow-DOM boundary

### Problem

> **Read this first.** Shadow DOM is not incidental to this plugin — it is the mechanism that protects the gallery from the WordPress environment it is dropped into, and the decision below must not casually trade it away.

The app mounts into a shadow root by default (`main.tsx:30`). Mantine's `Portal` appends overlay targets to `document.body`, so Drawers, Modals, Menus and Popovers render **outside** that shadow root. Style isolation and overlay portaling are in direct tension, and **four of the five Phase 76 defects live on that seam.**

**What shadow DOM actually buys, precisely:**

- **It blocks host selectors from matching our elements.** A theme's `.entry-content img { width: 100% !important }`, or another plugin's admin CSS, cannot reach inside the shadow tree. **Nothing else in CSS does this.**
- **It does not block inherited properties.** `font-family`, `color`, `line-height`, `visibility` and custom properties still cascade in through the host element. The isolation is strong, not total.
- **`@layer` and `@scope` are not substitutes.** They govern *our* CSS's specificity and reach. They do nothing to stop the host page's rules from matching our elements.

**Both mount contexts are hostile.** The same `mullion-gallery-app` bundle is enqueued on the front end via shortcode (`class-mullion-embed.php`) **and inside wp-admin** via `add_submenu_page` (`class-mullion-space-admin-renderer.php`, `class-mullion-asset-admin-renderer.php`). On the front end the threat is the site's theme; in wp-admin it is other plugins' admin CSS, which is notoriously aggressive. There is no "safe" context to relax isolation in.

**This is not purely an internal decision.** If the plugin ships with shadow DOM and later moves to light DOM, CSS that site owners have written — which currently does nothing, because the shadow boundary blocks it — would suddenly begin applying to plugin markup. That is a silent, per-site behaviour change and it is the reason this track is in a pre-release phase at all.

### Fix

Evaluate, and prototype the leading option:

- **(a) Portal into the shadow root — the leading option.** `Portal` accepts a `target` (`Portal.mjs:17-19`), and because it resolves props through `useProps('Portal', …)`, `theme.components.Portal.defaultProps` can set that target **globally, in one place**. `MantineProvider` additionally accepts `getRootElement` and `cssVariablesSelector`. The boundary is therefore crossable by configuration — the project has been working around a wall the library already provides a door through. On success, `chrome-portable.scss`, `adminChromeStyles()` and the `--mullion-builder-*` inline bridge may all become deletable.

  **The cost is validation, not code.** The Drawer portals to `document.body` specifically to escape the host page's stacking context, so this changes z-index behaviour against wp-admin and against arbitrary customer plugins, plus focus trapping and click-outside detection. That failure mode surfaces in support tickets, not in CI.

- **(b) Split the mount** — shadow root for public gallery content, light DOM for admin chrome. **Weaker than it first appears:** the wp-admin finding above means admin chrome is not a controlled surface, and is arguably the more hostile of the two.

- **(c) Drop shadow DOM for scoped light DOM (`@layer` / `@scope`) — REJECTED.** Recorded here as rejected so it is not re-proposed as a modernisation. It is not a peer option: it trades away the single guarantee the plugin cannot obtain any other way — that host selectors cannot match plugin elements — in exchange for convenience. The portal problem it solves is solvable by (a) without giving up isolation.

- **(d) Status quo** — keep the boundary and keep paying the per-consumer tax, now that P77-A makes that tax explicit and testable. A legitimate outcome if (a)'s validation cost is judged too high before release.

### Acceptance criteria

- A written decision with its rationale, including what was rejected and why — **(c) explicitly among them**.
- If (a): a prototype behind a flag, with z-index, focus-trap and click-outside behaviour verified in a real wp-admin install against a realistic plugin set.
- If (d): the tax is documented and the P77-A contract covers it, so the next person does not rediscover it as a bug.
- The decision states its post-release compatibility implication for site-owner CSS in plain language.

### Validation

- `npx playwright test` in full, not only `theme-qa` — this touches overlay behaviour, which the visual snapshots do not cover.
- Manual wp-admin QA is **required** for (a) or (b) and cannot be substituted with CI. Use the `/php-testing` skill's wp-env setup, and exercise at least: Drawer over the admin menu, nested Modal from within the Drawer, Select dropdown inside the Drawer, Escape and click-outside dismissal.

### Decision (2026-09-09)

**Keep the shadow boundary around the gallery, and move portaled chrome into a second shadow root of ours, attached to a host appended to `document.body` (the "overlay root"). Prototype landed behind a flag; the shipped default stays `document` until the user accepts the flip.**

The plan's leading option (a), portaling into the gallery's own shadow root, was prototyped alongside and is **rejected on measurement**. Every mode was driven through the same script on the dev server, with and without a hostile host page: an element-selector stylesheet (`button { background: red !important }`), a sticky header at `z-index: 9999`, and a wrapper around the mount carrying `transform` and `overflow: hidden`, with the page scrolled 600px before the drawer opens. Any theme or page-builder motion effect produces that wrapper, because `transform` (like `filter`, `perspective`, `will-change` and `contain`) makes an element the containing block for every `position: fixed` descendant.

| Property, Settings drawer open | (d) `document`, shipped | (a) gallery shadow root | overlay root |
|--------------------------------|-------------------------|-------------------------|--------------|
| Drawer box inside the transformed wrapper | viewport, `0,0 1280x900` | `0,-500`: above the viewport, clipped, click-outside dead, Theme select unreachable | viewport, `0,0 1280x900` |
| Host `button` rule reaches the drawer's Cancel button | **yes** (red, 0 radius) | no | no |
| `--mullion-*` tokens on the drawer | unset | set | set |
| Mantine variables on the Admin panel's own dropdown | Mantine fallbacks (`#424242`) | theme | theme |
| Escape, click outside, nested editor, Select in drawer | work | work, except inside the wrapper | work |
| Layout Builder | styled | not measured | unstyled until the overlay sheet gained Dockview and `builder.css` (zero `.dv-` rules); styled after |
| Full Playwright suite in that mode | 40 passed | 39 passed | 39 passed |
| theme-qa visual snapshots | baseline | pass | pass |

The one failure in each alternative mode is the P77-A contract test asserting the drawer renders under `document.body`, which is the fact these modes change; it is left as is until the default flips.

Against a real page (wordpress.lan, Twenty Twenty-Five, logged in), 5 of the 1422 host rules on the page already match elements inside the shipped drawer: heading weight, size, letter-spacing and line-height from the theme's global styles, `text-wrap` from the theme, and a border-style rule from the block library. That is a gentle theme. The chrome is the one surface of the plugin with no protection at all today, and the overlay root gives it the same protection the gallery has.

**Rejected, and why.** (a) fails inside any transformed ancestor, above. (b) split mount: the wp-admin pages are already separate light-DOM apps with their own provider, so the front-end shortcode is the only place the question exists, and there the chrome is the exposed piece. (c) dropping shadow DOM: rejected as planned, for the reason stated in the Problem. (d) status quo: the measured exposure plus the per-consumer tax P77-A documents, five defects deep in Phase 76.

**What the overlay root does not do.** The nested chrome provider (`AdminChromeProvider`) renders its scoped variable sheet in the gallery tree, so in lock mode the brand palette still reaches the drawer only through `adminChromeStyles()`. That bridge and the `--mullion-builder-*` block stay load-bearing after the flip; they carry a theming choice (chrome locked to the brand), not a boundary defect. What the overlay root removes is the whole "stylesheet in the wrong tree" class: `global.scss`, CSS modules and both variable sheets reach the chrome, and `chrome-portable.scss` stops being special under a shadow mount. Mirroring the nested sheet into the overlay root, which would retire `adminChromeStyles()`, is a follow-on.

**Post-release compatibility, in plain language.** Today a site owner's CSS reaches the Settings panel and Layout Builder because they render under `document.body`; it cannot reach the gallery. After the flip it reaches neither. Flipping before release changes nothing anyone relies on. Flipping after release would silently strip styles from any site that had targeted the chrome, so the default flip belongs in this phase, before Phase 79's release pipeline, on the user's call.

**Cost.** One more shadow root per mount, carrying its own copy of the shadow stylesheet plus Dockview and `builder.css` (about 315 KB of CSS text) and two small variable sheets kept in sync by `OverlayRootSync`. A shared constructable stylesheet (`adoptedStyleSheets`) would remove the duplication; filed as a follow-on.

**How to exercise it.** `?portal=overlay-root` on any page, `window.__MULLION_PORTAL_MODE__` for the plugin to set, or `VITE_MULLION_PORTAL_MODE` for a dev server running a whole suite in one mode. `?shadow=0` light mounts ignore the flag.

---

## Track P77-C - Fix the dead `global.scss` rules

### Problem

`main.tsx` loads `global.scss` into the document **only** when the app mounts without a shadow root:

```ts
if (!useShadowDom) { import('./styles/global.scss') }
```

Under the shipped shadow mount it goes into the shadow root instead, while portaled chrome renders in `document.body`. Measured directly during P76-I-2, with the Display Settings drawer open, checking which selectors are present in `document.styleSheets`:

| Rule | Reaches portaled chrome |
|------|-------------------------|
| `.mullion-mantine-select-option[data-selected]` | **No** |
| `.mullion-mantine-tabs-tab` | **No** |
| `.mantine-focus-auto…` (P76-I-2, `chrome-portable.scss`) | Yes |
| `.mullion-mantine-checkbox-input` (P76-I-2, `chrome-portable.scss`) | Yes |

The select-option rule is the sharpest case: its own comment states it exists *because* dropdowns portal. The ancestor problem was correctly identified; the delivery problem underneath it was not. The selected-option highlight in every themed dropdown has been falling back to Mantine's default.

**Scope corrected by P77-A's measurement (2026-09-09).** Three findings change the shape of this track:

1. **Dead is per surface, not per rule.** The Admin panel renders inline in the gallery tree (`App.tsx`), not in a portal, so `.mullion-mantine-tabs-tab[data-active]` is live for the Admin panel's tabs and dead only for the Settings drawer's. Moving the rule to `chrome-portable.scss` keeps the Admin panel unchanged and makes the drawer match it. The segmented-control rule is the third of the set; it matched only inside the gallery tree in the surfaces probed, so treat it the same way rather than assuming it is dead everywhere.
2. **Two CSS modules are dead in the shipped mount.** `MediaCard.module.scss` and `MediaTab.module.scss` are consumed by the Media tab inside the Admin panel (shadow tree) but are not registered in `shadowStyles.ts`, so Vite delivers them to the document only. Measured with the Media tab open: elements carry the classes, no sheet in the shadow root matches them. The hover lift, the focus ring and the grid max-width never apply. Register both in `shadowStyles.ts`; that is an appearance change and needs the same deliberate baseline review as the rules above.
3. **Both sets are encoded as allowlists** in `src/styles/__tests__/styleDelivery.test.ts` (`GLOBAL_SCSS_KNOWN_DEAD_UNTIL_P77C`, `MODULES_KNOWN_DEAD_UNTIL_P77C`). This track empties them; the test fails on a stale entry, so it cannot be forgotten.

### Fix

Move rules that target Mantine classes for admin chrome out of `global.scss` and into `chrome-portable.scss`. Keep genuinely gallery-scoped structural rules where they are — `chrome-portable.scss` leaks into the host WordPress page, so it must stay small and contain only Mantine class overrides, never element selectors or resets.

If P77-B lands option (a), revisit: the two files may collapse into one.

### Acceptance criteria

- Every `.mullion-mantine-*` rule intended for admin chrome is present in `document.styleSheets` with the Drawer open.
- `theme-qa`'s `theme selector dropdown` baselines are recaptured **deliberately** and the diff reviewed, not auto-accepted — these are dead styles becoming live, so the snapshots *should* change.
- `chrome-portable.scss` still contains no element selectors or resets.

### Validation

- The delivery test from P77-A, which this track is the first real customer of.
- `npx playwright test theme-qa` with the dropdown diffs inspected by eye before acceptance.

---

## Track P77-D - Test-suite integrity

### Problem

Two independent problems, both of which degrade the suite's value as a signal:

1. **Three specs fail on a clean checkout** (confirmed pre-existing during P76-I-1 by stashing all changes and re-running at `13598e13`):
   - `mantine8-runtime-qa.spec.ts:173` and `:230` wait on `[data-mullion-component=…][data-mullion-slot=overlay]` locators. Those attributes are **debug-gated** — `src/utils/mullionDebug.ts` only emits them when the debug-markers setting is on — so the specs cannot pass unless the fixture enables it.
   - `accessibility.spec.ts:65` (login modal) reports ~187 `color-contrast` violations, e.g. ratio **1.23** on `#10242f`. It is order-dependent: it fails when the spec runs alone and passed in one combined run, which suggests the modal is sampled before its theme resolves rather than genuinely shipping 187 violations. **Confirm which before treating it as a real contrast bug.**
   - Separately, `accessibility.spec.ts:258` (settings panel) is **flaky** — it failed in one combined run and passed in the next with identical code.

2. **A vacuous test.** `theme-qa`'s `changing theme … persists to localStorage` asserts `typeof saved === 'string' || saved === null` — a tautology over `localStorage.getItem`'s return type — and never actually changes a theme. Theme persistence is unguarded end-to-end while appearing covered.

### Fix

Enable the debug-marker flag in the e2e fixture or re-point those locators at stable roles; determine whether the login-modal violations are real or a timing artifact and fix or re-baseline accordingly; identify the cross-spec interference behind the flake (all four share one dev server via `reuseExistingServer`). Rewrite the vacuous test to select a *different* theme, wait for Save to enable, click it, and assert the stored id — dropping the conditional click, since a disabled Save after a theme change is exactly the failure the test should catch.

### Acceptance criteria

- `npx playwright test` is green on a clean checkout, twice in a row.
- The theme-persistence test fails if persistence is broken — verified by breaking it deliberately.

### Validation

- Run the full Playwright suite twice consecutively; a single green run does not clear a known flake.

---

## Track P77-E - UI dependency evaluation

### Problem

Raised directly by the user: *"we should look into getting away from the Mantine system and developing our own which is built from the ground up to support everything we actually need, rather than building infrastructure around Mantine because it doesn't fully support us."*

The frustration is legitimate and the pattern it points at is real. The evidence gathered so far, however, points mostly elsewhere, and this track should start from facts rather than from the frustration:

- **Coupling is deep.** 44 distinct Mantine components across **153 of 434** source files (~35%). Replacement is not a refactor; it is a second product built while the first keeps shipping.
- **Most of the pain was not Mantine's.** Four of five Phase 76 defects were the shadow/portal boundary — a tension no component library avoids, since portaling overlays to the body is what they all do and for good reason.
- **The premise needs one correction.** Mantine *does* expose the seams here: `Portal` accepts a `target`, `MantineProvider` accepts `getRootElement` and `cssVariablesSelector`. The infrastructure was built around a boundary the library already provides a way to cross.
- **One genuine footgun did cost real money.** The `styles` prop looks like CSS-in-JS but emits inline styles, silently dropping every `&:focus`, `&:checked` and `&::placeholder` — 18 dead blocks and a WCAG 2.4.7 failure. Now guarded by a mutation-tested check across all 23 themes, so the cost is capped, but it is a fair mark against the API design.
- **The counter-evidence belongs on the record.** In P76-I-1, Mantine's focus mechanism worked correctly and *the adapter broke it*. The custom layer also shipped two tests that were green while asserting a code path that never rendered. The components a rewrite would have to reproduce — combobox and listbox semantics, focus trapping, overlay management, date pickers — are precisely where correctness is hardest and where this codebase has demonstrated it gets things wrong.

### Fix

A decision document. No component code.

1. **Define criteria before looking at options:** accessibility guarantees, keyboard and focus management, theming model (does it expose a CSS variable for every affordance — Mantine's focus ring did not), shadow-DOM friendliness, portal control, bundle size, maintenance burden, and migration cost against the 153-file coupling.
2. **Score the real options:** stay as-is; stay behind a facade; migrate to unstyled primitives (Radix or Ark, which invert the trade — behaviour from the library, styling entirely ours); build in-house.
3. **State an exit condition.** If the answer is "stay", name the specific conditions that would change it — a second API-design footgun of the `styles` class, or a Mantine major version that breaks the theming model.

### Acceptance criteria

- A written recommendation with scored criteria, including the option that was not chosen and why.
- If "stay": exit conditions named explicitly.
- No `src/ui/` code is written in this track. That is Phase 78, and it proceeds on this track's outcome.

### Validation

- No automated validation. The deliverable is a document; review it with the user before Phase 78 begins.

### Decision (2026-09-10)

**Recommendation:** an in-house component layer whose behaviour comes from a headless primitive library and whose styling and theming are ours, driven directly by the engine's tokens, migrated behind the Phase 78 facade. The primitive is not settled here: Ark UI scores first on our measured needs, Base UI and React Aria Components sit within three points, and a bounded spike (the same five components on the top two, measured against the P77-A guards, the P77-F ring walk, the P77-B hostile-host probe, focus return through the shadow boundary and the axe gate) decides. Fallback if both fail: Mantine in headless mode behind the same facade. Full scoring, evidence and exit conditions in [UI_DEPENDENCY_EVALUATION.md](UI_DEPENDENCY_EVALUATION.md).

**Why not stay.** Mantine does expose the seams the plugin needed, and P77-B has settled the boundary that caused most of Phase 76. What remains is structural and is exactly what the user's two heaviest criteria measure: the theme model is a translation target (a 601-line adapter with 31 override blocks), the stylesheet is a specificity opponent (`chrome-portable.scss` doubles every class), `styles` is inline CSS in disguise, colour-scheme rules key on an ancestor attribute, and `useFocusReturn` still reads `document.activeElement` in 9.6.1. Under the user's weights the recommended option leads staying-behind-the-facade by seventeen points of ninety-five; under equal weights by four of fifty-five; under a ship-soon weighting staying wins narrowly, which is the honest statement of the trade.

**Consequence for Phase 78.** P78-A lands as planned and is the pivot. P78-B and P78-C become migrations onto the new components once the framework phase exists, rather than re-exports of Mantine; the phase doc carries a note to that effect and is re-planned by the user.

---

## Track P77-F - Two-tone ("halo") focus ring

Promoted from `FUTURE_TASKS` on 2026-09-01 after the designer's response to the v2 design
docs ([`docs/design/correspondences/designer-response-v2-notes.md`](design/correspondences/designer-response-v2-notes.md) §4)
endorsed building it and settled the two open design questions. The full tactical write-up
this track absorbs lived in the `FUTURE_TASKS` entry (now a pointer here).

### Problem

The P76-I-2 ring (`outline: 2px solid` in `primaryStroke`) is correct for the 23 bundled
themes **because they can be audited**. It cannot be correct for user-authored themes
(`registerCustomTheme`), because no build-time audit can see them — and a focus ring is the
one affordance where failure is not cosmetic: it is whether a keyboard user knows where they
are. A single-colour ring is only ever as visible as its contrast against whatever sits
behind it; any theme, or any surface it was not measured against, can put it back under the
3:1 floor. The two-tone technique Chrome, Firefox and GitHub ship — a brand-coloured core
plus a contrasting halo — sidesteps this structurally: at least one of the two tones
contrasts with any background.

### Fix

Add a halo (`box-shadow: 0 0 0 4px var(--ring-halo)` beneath the existing 2px
`primaryStroke` outline) to the focus-ring rule P76-I-2 introduced, delivered through
whatever channel P77-A names canonical (the rule currently lives in `global.scss` with its
colour variable carried into portaled chrome by `chromeVars()` — exactly the plumbing A and
C are straightening out). Two constraints from the designer's sign-off are requirements, not
suggestions:

1. **The halo is a neutral drawn from the theme's own grounds — never a second brand
   colour.** Resolved per colour-scheme: light halo on dark themes, dark on light. Two
   chromatic tones is what would actually look decorated.
2. **Ring geometry stays constant across themes.** Only the colours resolve per theme; a
   ring that changes thickness per theme is what would break the restrained look.

Then re-model `uiContrastAudit`'s ring checks: the guarantee changes from "the ring
contrasts with the surface" to "the ring pair contrasts with itself and with the surface",
so the `primaryStroke`-on-ground checks need re-derivation rather than deletion.

### Acceptance criteria

- Focused controls render core + halo on every bundled theme, in both mount modes and both
  `applyThemeEverywhere` states (the P76-D/H trap: measure the shipped default, not the
  fixture's).
- The audit asserts the re-modelled pair guarantee and stays a zero-exception gate.
- A hostile-theme spot check: a user-authored theme whose surface matches `primaryStroke`
  still shows a visible ring (the halo carries it).
- The visual pass covers tight layouts — toolbars, table cells, segmented controls — since
  the halo's footprint is wider, and `box-shadow` (unlike `outline`) can be clipped by an
  ancestor's `overflow: hidden`.

### Validation

- `npx playwright test theme-qa` — resting-state baselines must not move (the ring paints
  only on `:focus-visible`); focus-state assertions extend the P76-I-2 set.
- Designer review in situ, per their offer — after it is running, not gating the build.

---

## Track P77-G - Enqueue every stylesheet the entry needs

### Problem

`class-mullion-embed.php` registers and enqueues `$manifest['index.html']['css']` and nothing else. With `cssCodeSplit` and the vendor `manualChunks`, Vite attaches Mantine's base stylesheet (`vendor-mantine-core-*.css`, 221 KB, core plus notifications) and Dockview's to the vendor chunks they belong to. Vite's own `dist/index.html` links three stylesheets; the plugin links one.

Measured on the production site (2026-09-09, signed out, no campaigns): `document.styleSheets` held no sheet containing Mantine's `.mantine-focus-auto:focus-visible` at page load. The shadow root had its own copy from `shadowStyles.ts`, so the gallery looked right. The two vendor sheets appeared only when a dynamic chunk whose preload list includes them was fetched: every gallery adapter and every admin chunk lists `vendor-mantine-core-*.css` in `__vite__mapDeps`. Signed in with campaigns present the adapter chunk loads immediately and the gap closes within the first paint or two; the exposure is the window before that, and any page where no such chunk ever loads, on which portaled chrome rendered from the entry chunk (the auth bar's admin `Menu`) has no Mantine base rules at all.

This is a delivery bug in what the P77-A contract calls mechanism M1, not a new channel. It is the same shape as the P76 defects: a rule present in the source, absent from the tree that paints.

### Fix

Walk the manifest the way Vite's HTML generation does: for the entry, the CSS of every statically imported chunk (recursively, depth first, each chunk once) and then the entry's own CSS. Register a `mullion-gallery-app-style-N` handle per file in that order and enqueue the same list on render. Dynamic-only chunks stay with Vite's preload helper, which already handles them. The wp-admin renderers already enqueue every registered handle by index, so they need no change.

### Acceptance criteria

- `Mullion_Embed::get_entry_css_files()` returns, for the real manifest, exactly the stylesheets `dist/index.html` links, in the same order.
- PHPUnit covers the walk (order, deduplication, cycles, dynamic chunks excluded) and the registration and enqueue of every handle.
- On the production site, `document.styleSheets` contains Mantine's base sheet at page load, signed out, before any dynamic chunk is fetched.

### Validation

- `Mullion_Embed_Test.php` and the full PHPUnit suite through wp-env.
- A rebuilt and redeployed plugin checked in the browser as above.

---

## Track P77-H - In-house UI framework study

Added 2026-09-10 at the user's request alongside P77-E: consider what it would take to "roll our own" styling framework that completely replaces Mantine, addresses the shortcomings met so far, and merges the custom Theme Manager with the theming implementation; deliver a separate document with the thoughts and discoveries and a short list of the parts of Mantine to address.

### Problem

The evaluation answers whether to leave Mantine. It does not say what a replacement built for this plugin would look like, which of Mantine's roles it must take over, or which of Mantine's shortcomings it is the chance to design out. Without that, "in-house" is a word rather than a plan, and the Phase 78 facade would be drawn without knowing what it will eventually front.

### Fix

A design study, no code. Principles, architecture (packages, provider, three-tier token model, styling layer, delivery, component API), behaviour sourcing for every one of the 62 components in use against the three primitive candidates, the "need to address" and "should address" lists, effort classes per step driven by measured counts, and risks. The Theme Manager merge is specified as provider concerns (scope, portal, lock and follow, persistence, runtime `defineTheme` with audits at save).

### Acceptance criteria

- A document a reader can use to plan the framework phase without re-deriving the inventory.
- The Mantine inventory covers everything this codebase touches, measured, and nothing it does not.
- No `src/ui/` or framework code.

### Validation

- None automated. Reviewed with the user together with P77-E.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| The UI facade itself (`src/ui/`, ESLint boundary, migration) | **Phase 78.** Gated on A, B and E by explicit decision — a boundary drawn before knowing what it must abstract is a guess. |
| Portal Admin Chrome Into the Shadow Root (existing `FUTURE_TASKS` entry) | Absorbed into P77-B as option (a). The entry stays as the tactical write-up; the decision belongs to the track. |
| ~~Two-tone ("halo") focus ring~~ | **Promoted to P77-F on 2026-09-01.** The original deferral ("not urgent — Option A already clears 3:1") stands as far as it goes, but the designer's response to the v2 design docs endorsed building it and supplied the two constraints that were the open design questions. New information, not a reversal of the reasoning. |
| Privacy items (Sentry PHP scrubber, Google Fonts self-hosting, analytics salt rotation) | All Low / Low-Medium impact; Sentry is off without a DSN and the Google Fonts flow is documented with opt-outs. Would pad the phase without protecting the release. |
| CORS allow-list | Its own entry states it is meaningless for the shortcode deployment actually shipped. |
| Structural a11y gate growth | Its entry states WCAG AA is a quality bar, not a WP.org submission gate, and can grow post-launch. |
| Share one constructable stylesheet between the gallery root and the overlay root (`adoptedStyleSheets`) | The overlay root duplicates about 315 KB of CSS text per mount. Cheap to do once the overlay root is the default; pointless before. Recorded in FUTURE_TASKS under P77-B. |
| Mirror the nested chrome provider's variable sheet into the overlay root, then retire `adminChromeStyles()` | Only makes sense after the default flips; the inline bridge is correct until then. |
| Generalise `adminChromeStyles()` to carry the full `--mullion-*` token set | Would let chrome stylesheets and admin CSS modules read the same tokens the gallery root does, removing per-token special cases and `color-mix()` fallbacks. Deferred to P77-B by agreement on 2026-09-09: if the boundary goes, the mechanism goes with it. |
| Primitive spike (Ark UI against Base UI, React Aria Components third) | The first code of the framework phase, not of this one; P77-E section 9 fixes its protocol and measurements. |
| Re-plan Phase 78 B and C as migrations onto the new components | Depends on the user accepting the P77-E recommendation; P78-A is unchanged either way. |
| Lazy-load admin chrome so the visitor path stops shipping `vendor-mantine-core` statically | Available under every option; P77-E section 4.3 shows the visitor bundle is a code-splitting question more than a library question. Worth a FUTURE_TASKS entry when Phase 78 is re-planned. |

## Implementation Notes

### P77-A (2026-09-09)

**Status: landed.** Contract in [docs/guides/STYLING_GUIDE.md](guides/STYLING_GUIDE.md), three static guards in `src/styles/__tests__/styleDelivery.test.ts`, one browser guard in `e2e/style-delivery.spec.ts`. All five mutations fail as intended.

**Step 1: measure, do not read.** A throwaway Playwright probe (scratchpad, not committed) compiled `chrome-portable.scss` and `global.scss` with `sass`, parsed them with `new CSSStyleSheet().replaceSync()`, and compared each selector against `document.styleSheets` and the shadow root's sheets, with the Settings drawer open and with the Admin panel's Media tab open, in both mount modes and both `applyThemeEverywhere` states. The fixture trap from P76-I was avoided by setting the flag explicitly for every run. The production site was cross-checked through the browser (sheet sources and rule counts per tree on `wordpress.lan`) and matched the dev picture for every sheet that loads at page start.

**What the measurement changed about the plan.**

| Plan said | Measured |
|-----------|----------|
| Seven channels | Four mechanisms (document sheet, shadow `<style>`, runtime variable sheets, inline style) and eleven authoring surfaces. CSS modules split into registered and unregistered, and `builder.css` / `wpAdminFormReset.css` were missing from the list. Reach is a property of the mechanism, so the contract is written mechanism-first and the surface table derives from it. |
| Two dead `global.scss` rules | Three rules in the set, and dead only for portaled surfaces. The Admin panel is not portaled, so its tabs get the rule today. Recorded under P77-C. |
| Nothing about CSS modules | `MediaCard` and `MediaTab` modules are dead in the shipped mount. Recorded under P77-C. |
| Inline styles travel with the element | True for the `styles` and `vars` props and for the chrome variable blocks. Mantine's *responsive* style props are different: with `deduplicateInlineStyles` on they render a hoistable `<style>` that React places in the root container. Measured in the same tree as their elements on every surface probed; no portaled element used one. Recorded as a constraint, not a defect. |
| The plugin enqueues the built CSS | Only the entry's own CSS. Vite's `dist/index.html` links three stylesheets (`vendor-mantine-core`, `vendor-dockview`, `index`); the manifest hangs the first two off statically imported vendor chunks, and `class-mullion-embed.php` walks `$entry['css']` only. On the production home page the document had no Mantine base sheet at load; it arrives only when a dynamic chunk whose preload list includes it (every gallery adapter, the Admin panel) is fetched. The `AuthBar` admin menu portals to the document from the entry chunk, so on a page where no such chunk has loaded yet it renders without Mantine's base rules. Not fixed here: it is a loader bug, not a channel, and this track introduces no new channel by its own acceptance criteria. Proposed as **P77-G**; the fix is to enqueue the `css` of every chunk in the entry's `imports`, recursively, the way Vite's HTML does. Needs a signed-in check of the production drawer to size the visible impact, which the author could not do from the agent browser. |

**Canonical channels.** Named in the guide's section 4. The short form: state colour through `vars`; pseudo-state Mantine has no variable for through `classNames` plus `chrome-portable.scss`; gallery structure through `global.scss` under `.mullion-gallery` or a registered CSS module; tokens for chrome through `adminChromeStyles()` until P77-B. `styles` is constrained to flat keys, `adminChromeStyles()` and the `--mullion-builder-*` bridge are legacy and load-bearing, and both are consequences of the boundary P77-B decides.

**Channel count.** The acceptance criterion offered "lower than seven, or each survivor has a stated reason". The mechanism count is four. The surface count is eleven, higher than the plan's seven because the inventory was incomplete, and every survivor carries its reason in the guide's surface table. Nothing was deleted in this track: every collapse candidate depends on whether the shadow-plus-portal boundary survives P77-B, and deleting ahead of that decision would be the same guess the phase rationale warns against.

**Tests and mutations.**

| Guard | Mutation applied | Result |
|-------|------------------|--------|
| `global.scss` scope | appended `.mullion-mantine-menu-item[data-hovered] { color: red }` | fails naming the selector |
| module registry | created an unregistered `ProbeMutation.module.scss` | fails naming the file |
| component `styles={}` flatness | inserted `'&:hover'` into `AuthBar`'s `styles` | fails naming file and key |
| e2e, document side | commented out the `chrome-portable.scss` import in `main.tsx` | fails with "missing from the document (main.tsx import)" |
| e2e, shadow side | commented out `chromePortableStyles` in `shadowStyles.ts` | fails with "missing from the shadow root (shadowStyles.ts entry)" |

The e2e spec also pins `global.scss` to exactly one tree per mode, which is the reach claim the guide makes for it.

**Two environment notes for P77-D.** Port 5173 was serving an unrelated project, and `playwright.config.ts` has `reuseExistingServer: true`, so the suite would have driven the wrong app and reported a locator timeout rather than a clear error. Validation for this track ran against a gallery dev server on 5174 with `E2E_BASE_URL`. Separately, the project pins Playwright 1.61 (Chromium build 1228) while the user's general-purpose Playwright is 1.62 (build 1234); only the 262 MB headless shell for 1228 was kept.

### P77-G (2026-09-09)

**Status: done.** After the user rebuilt and redeployed, the production home page carried three server-rendered `<link>` elements with the WordPress handle ids `mullion-gallery-app-style-0-css` through `-2-css` (Mantine core, Dockview, entry) and `document.styleSheets` contained Mantine's base rules with `readyState` already `complete`, before any dynamic chunk had run. Runtime-injected links from Vite's preload helper carry no id, so the two delivery paths are distinguishable and the check does not depend on sign-in state.

`Mullion_Embed::get_entry_css_files()` walks the manifest from `index.html`: each statically imported chunk's CSS first, depth first, every chunk visited once (the walk tolerates cycles), then the entry's own CSS. Both `register_assets()` and the shortcode enqueue use it, so the `mullion-gallery-app-style-N` handles the wp-admin renderers already iterate now cover every sheet. Run against the real manifest the result is exactly the three files `dist/index.html` links, in the same order: `vendor-mantine-core`, `vendor-dockview`, `index`. Dynamic-only chunks are left to Vite's preload helper, which already injects their CSS.

Four PHPUnit tests cover the walk (order, deduplication, a deliberate cycle, a dynamic chunk excluded), the empty and bare-manifest cases, registration of one handle per file, and enqueueing on render. `Mullion_Embed_Test.php` passes 30 of 30. The full suite reported three failures, none in this area: the edition-marker test fails whenever a local build leaves `assets/mullion-edition.json` behind (its own message says so), and two `Mullion_REST_Extended_Test` analytics cases returned 403. Re-running that file against a tree with this change stashed produced an error in a third test on one run and a clean 63 of 63 on the next, so it is order-dependent and predates this track. Worth a line in P77-D's list even though that track is scoped to the e2e suite.

**Sizing, from the signed-in production check.** With campaigns present a gallery adapter chunk loads immediately and its preload list pulls both vendor sheets into the document within the first paints, so the drawer and modals were never visibly broken for a signed-in admin. The exposure was the window before that first dynamic chunk, and any page that never loads one: signed-out visitors on a page with no adapter, where the auth bar's admin `Menu` portals to a document with no Mantine base rules. Small, but the class of defect this phase exists to remove.

### P77-D (2026-09-09)

**Scope change.** The user folded the PHP suite in: after P77-G's full run showed three PHPUnit failures, fixing them became part of this track rather than a note in it.

**Baseline, measured before touching anything.** `npx playwright test` on a gallery dev server (port 5174; see the port note under P77-A) gave 36 failed, 36 passed. Thirty-three of the failures were the Storybook screenshot suite under `e2e/visual/`, which the default config swept in because `testDir` is `./e2e` and only `playwright.visual.config.ts` knows how to serve it. The three real failures were the two `mantine8-runtime-qa` specs and `media-flows`. The accessibility specs the plan listed as failing or flaky passed on that run and failed on the next, which is what a timing defect looks like. `theme-qa`'s persistence test passed, as a tautology does.

**What each failure actually was.** The plan's diagnoses were taken as hypotheses and two of them were wrong.

| Spec | Plan said | Measured | Fix |
|------|-----------|----------|-----|
| `e2e/visual/adapters.spec.ts` (33) | not listed | wrong config picks it up; no server, no baselines | `testIgnore: ['**/visual/**']` in `playwright.config.ts` |
| `mantine8-runtime-qa` drawer test | debug markers off | markers are on in dev. The dialog is named "Settings" since P75-E, not "Display Settings". Past that, the nested Responsive Gallery Config drawer rendered *inside* the Settings drawer's transformed, scrolling content with `withinPortal={false}`, so `position: fixed` resolved against that box and the editor's header scrolled 46px above the viewport; Playwright could not click Apply because nothing was there. A real bug a user hits by scrolling the Settings panel before opening the editor | dialog name regex; `GalleryConfigEditorModal` gains `withinPortal` and `drawerProps`, and the Settings panel portals it as a peer with the same `adminChrome*` props (contract: M4 carries the chrome tokens across the portal). The CampaignViewer keeps it inline inside the shadow tree. The overlay/close debug slots the spec addressed were never emitted by these two components; they are now, matching the other modals |
| `mantine8-runtime-qa` viewer test | debug markers off | same missing slots on `GalleryConfigEditorModal` | slots added; no other change needed |
| `media-flows` | not listed | strict-mode clash between "Upload" and "Remove upload.jpg"; then the upload mock still returned the pre-P28-D single-file shape, so `uploadMany` threw before any toast; then the expected toast text predates P28-D | `exact: true`; batch-shaped `media/upload` and `campaigns/101/media/batch` mocks; expect the batch summary toast |
| `accessibility` lightbox | login modal order-dependent | the lightbox's first-open keyboard hint (`packages/shared-ui/src/KeyboardHintOverlay.tsx`) styles itself with `--mantine-color-dimmed`, `dark-7`, `dark-4` and `radius-md`. The lightbox portals to `document.body`, where under a shadow mount none of those variables exist, so the hint painted as inherited dark text on a near-black overlay: axe measured 1.24:1. It shows once per session for 3.5s with a 300ms fade, so a scan that lands inside that window fails and one that lands outside passes | literal overlay-safe colours in the hint (the overlay behind it is always `rgba(0,0,0,0.93)`, so this is theme-independent by construction) and a plain styled `<kbd>` in place of Mantine's `Kbd`, which has the same dependency; the test now waits for the hint to be fully painted and scans it rather than racing it |
| `theme-qa` persistence | vacuous | vacuous | selects Tokyo Night, requires Save to enable, asserts the stored id. Mutation-tested: with `persistThemeId` short-circuited it fails with `Received: "default-dark"` |

The lightbox hint is the P77-A contract's mechanism M3 failing to reach a portal, the same class as every Phase 76 defect. It was fixed here rather than handed to P77-C because C is about `global.scss` rules and CSS modules, this is a component's inline styles, and the test could not be made deterministic without either fixing or hiding it.

**PHP suite.** Three failures in the full run, none of them in the code they appeared to implicate:

| Test | Cause | Fix |
|------|-------|-----|
| `Mullion_Package_Edition_Test::test_defaults_premium_without_marker_file` | asserted that the real build output `assets/mullion-edition.json` does not exist, which is false on any machine that has run `npm run build:wp` | the test filters the marker path to a temp file that cannot exist; the default-path assertion moved to its own test |
| `Mullion_REST_Extended_Test::test_get_campaign_analytics`, `::test_list_access` (403) | `Mullion_DB::$space_cache` is a static per-process memo of space rows. `WP_UnitTestCase` rolls the database back after each test but nothing rolls the static back, so a later test resolved the default space through a row the database no longer held. Passes in isolation every time; reproduced only in full-suite order | `Mullion_DB::flush_space_cache()` plus a PHPUnit `BeforeTestHook` extension (`tests/Mullion_Test_Isolation_Hook.php`, registered in `phpunit.xml.dist`) that calls it before every test. Production code path unchanged apart from the new method |

**Results.** `npx playwright test` twice in a row on a clean tree: 39 passed, 39 passed. PHPUnit through wp-env: 1328 tests, 13750 assertions, 2 skipped, no failures. `npx vitest run` on the touched components: green. The persistence test and the P77-A guards are the only e2e or unit tests in this track that were mutation-tested; the others are repairs of specs whose failure mode was observed directly.

### P77-C (2026-09-09)

**Measured first, in both mount modes and both `applyThemeEverywhere` states, with the Admin panel and the Settings drawer open.** The plan's diagnosis was "dead for portaled chrome because `global.scss` never reaches the document". That is true and was not the whole story. Each of the three rules was dead for a second reason that no delivery fix could touch:

| Rule | Plan said | Measured | Fix |
|------|-----------|----------|-----|
| `.mullion-mantine-select-option[data-selected]` | dead in portaled dropdowns | matched **nothing in any tree**: Mantine 9.3.1 marks the chosen option with `data-checked` (`data-combobox-selected` is the keyboard-active state). The theme dropdown had no selected-state highlight anywhere, which the P76 baselines show | rule targets `[data-checked]`; the two colours ride on the dropdown as inline custom properties because the dropdown portals on its own, so nothing on the Select root can inherit into it |
| `.mullion-mantine-tabs-tab[data-active]` | dead in the drawer, live in the Admin panel | the border half was live in the Admin panel (stroke `#008e85` measured against the drawer's Mantine default `#007870`). The colour half was dead everywhere: the adapter pins `color: textMuted` inline on every tab, and inline outranks any class rule | the active border is Mantine's own `--tabs-color`, set from the adapter; both text colours travel as `--mullion-tabs-tab-color` / `--mullion-tabs-tab-active-color` on the Tabs root and the inline colour is gone |
| `.mullion-mantine-segmented-control-label[data-active]` | assumed dead like the tabs rule | its only declaration was dead everywhere, same inline cause | Mantine reads `--sc-label-color` on the active label, so that variable carries the active colour; the resting colour is `--mullion-segmented-control-label-color`, read by a `:not([data-active])` rule so Mantine's own rule keeps the active state |

All three rules now live in `chrome-portable.scss` with the doubled first class, and `global.scss` has no selector outside `.mullion-gallery`. The pattern is the P76-I-2 checkbox one generalised: a themed colour a state rule must read travels as a custom property, never as an inline colour on the same part. Mantine merges theme-level `vars` after its own `varsResolver` (verified in `use-styles.mjs`), which is why `--tabs-color` can be set from the adapter at all. After the change every surface measured the intended colours: active tab text `#eef8fb` and border `#008e85` in the drawer and the Admin panel alike, checked option `#ffffff` on `#007870` in the drawer's dropdowns and in the Admin panel's sort dropdown, which sits in a document portal with no `--mantine-*` variables at all. Resting colours were re-measured unchanged.

**CSS modules.** `MediaCard.module.scss` and `MediaTab.module.scss` are registered in `shadowStyles.ts`; the probe that found them dead now reports element and rule in the same tree. `MediaTab.module.scss` also carried a `.mediaCard` block nothing consumed (the class of that name comes from `MediaCard.module.scss`); it is deleted. The comment in `MediaCard.module.scss` claiming the card renders inside the Layout Builder modal was wrong and is corrected.

**Baselines, recaptured deliberately.** All 21 theme-qa tests passed *before* recapture, because `maxDiffPixelRatio: 0.1` absorbs a dead rule going live. `--update-snapshots=all` rewrote 15 of 16 files. To separate this track's change from older drift, the baselines were captured once more from a stash of HEAD and pixel-diffed against the new set:

| Snapshot family | Pixels changed by P77-C | What they are |
|-----------------|-------------------------|---------------|
| `theme-selector-open-*` (2) | 2.2% | the checked theme option's primary fill and contrast text, plus the active tab |
| `display-settings-*` (7) | 0.02% to 0.07% | the "Appearance" tab's text and underline |
| `gallery-shell-*` (6) | 0 to 0.01% | the access-mode "Lock" segmented label brightening from textMuted to text |
| `themed-control-tight` | 0 | unchanged, as its zero-tolerance assertion requires |

Against the committed baselines the same files differ by 1.1% to 3.1%: header buttons, input borders and label weights that Phase 76 changed after the baselines were captured, all inside tolerance and never reviewed. They are now current. The dropdown diffs were inspected by eye: the "Mullion" and "Mullion Light" rows carry the fill, nothing else in the dropdown moved.

**Tests.** The unit guard's two allowlists are gone, and the test now fails on any unscoped `global.scss` selector or any unregistered module without justification. `adapter.test.ts` gains an assertion that Tabs, SegmentedControl and Select carry no inline colour on the tab, label or option and do carry the variables. `e2e/style-delivery.spec.ts` gains a paint check: with the drawer open, the active tab's computed colour and border equal the variables it carries, and the Theme select's checked option paints the checked pair. Mutations verified: renaming `data-checked` in the rule fails the paint check; restoring `color` in `Tabs.styles.tab` fails the adapter test.

**Flake fixed on the way.** In one of the two full Playwright runs the accessibility spec's login-modal and settings-panel scans failed on contrast values like `#20343e` for text whose inline colour is `#eef8fb`: axe scanning during Mantine's 200ms entrance fade, the same mechanism P77-D found on the lightbox hint. Reproduced at roughly one run in six on the login modal, with no tab, segmented control or select on that surface. Both scans now wait for the dialog to be fully painted (`awaitFullyPainted`), the P77-D lightbox approach made reusable.

**Data point for P77-B.** The Admin panel's own Select dropdown portals to `document.body` and, under the shipped mount, resolves no `--mantine-*` variable at all: its hover colour is Mantine's `--mantine-color-dark-4` fallback `#424242`, not the theme's. The checked state now paints correctly only because its colours travel inline. Anything in the gallery tree that portals is in the same position, and that is the boundary B is deciding on.

**Results.** Before the flake fix, `npx playwright test` (40 tests) gave 40 passed, then 38 passed with the two axe scans above. After it: 40 passed, 40 passed, and the two scans repeated six times each, 12 passed. `npx vitest run`: 259 files, 3922 tests, all passed (one `SettingsPanel.test.tsx` timeout under full-suite load did not reproduce in isolation, the same class as the P77-A `TemplatesTab` note).

### P77-B (2026-09-09)

**Prototype.** `src/portalTarget.ts` resolves a portal mode (`document`, `shadow`, `overlay-root`) and builds the target node; `withPortalTarget` sets `theme.components.Portal.defaultProps.target` once, in `ThemedApp`, and nested providers inherit it. It is set exactly once for a reason found while reading Mantine's merge: `deepMerge` spreads any object it finds on both sides, and an `HTMLElement` is an object, so a second declaration would turn the target into a plain object and every portal would throw. `AdminChromeProvider.test.tsx` now asserts the nested provider sees the same element. `OverlayRootSync` keeps the overlay root's theme-variable and Mantine-variable sheets current and stamps `data-mantine-color-scheme` on the host and the target, which Mantine's scheme-keyed rules need. The env fallback exists so a dev server can run the suite in one mode without touching the specs.

**Mantine's own hooks are already shadow-safe.** `useClickOutside` walks `composedPath()`, `scopeTab` reads `getRootNode().activeElement`, and Escape handling only reads an attribute off the retargeted event target. Nothing in the prototype patches Mantine.

**What the measurement changed.** Two things the plan assumed did not survive contact. First, (a) was "the leading option"; the containing-block failure is total inside a transformed wrapper and the fixture that shows it is four lines of CSS. Second, the plan's list of bridges that (a) would delete was too long: the nested chrome provider's sheet stays in the gallery tree in every mode, so `adminChromeStyles()` remains the way lock mode reaches the chrome. The prototype also found a gap that only shows on a surface no e2e spec opens: the Layout Builder's Dockview and builder rules are document stylesheets in `main.tsx` and reached an overlay root not at all until `overlayStyles` added them. `e2e/portal-mode.spec.ts` now opens the builder in overlay mode and asserts the rules are present and a tab is painted.

**Pre-existing findings on the way, filed in FUTURE_TASKS.** Focus after closing the Settings drawer lands on `body` in every mode, because `useFocusReturn` records `document.activeElement`, which is the shadow host rather than the trigger button. On the real site the WordPress admin bar (`z-index: 99999`) covers the drawer's header buttons for logged-in users in every mode; Mantine's drawer sits at 450. Both are independent of the boundary and neither is fixed here.

**Tests.** `src/__tests__/portalTarget.test.ts` (mode resolution; element identity through `mergeMantineTheme`), the nested-provider guard above, and `e2e/portal-mode.spec.ts` (drawer geometry inside the hostile wrapper, host-CSS isolation, Escape and click-outside, light mount ignores the flag, builder sheets). Mutation: pointing the geometry test at `?portal=shadow` fails it with `top` at -500. Full Playwright suite on the default server: see the results line below. Manual check on the redeployed dev site (2026-09-09, user): `https://wordpress.lan/?portal=overlay-root` exercised the drawer, nested editor, theme select and Layout Builder against the real theme; theming and CSS reported correct. The default flip remains the user's call.

**Results.** `npx playwright test` on the default dev server, twice in a row with the three new portal-mode tests included: 43 passed, 43 passed. In `shadow` and `overlay-root` mode servers: 39 passed of 40 each, the one failure being the P77-A document-placement assertion described in the Decision. `npx vitest run`: 260 files, 3926 tests, all passed.

### P77-F (2026-09-09)

**Token.** `deriveFocusHalo` in the theme engine derives `focusHalo` from the theme's own ground: the background's hue at near-zero chroma, stepped from lightness 96 toward white on dark schemes (12 toward black on light) until it clears 3:1 against the ring core, `primaryStroke`. If the scheme's pole cannot clear the core (a luminous accent such as `#ffd700` on a dark ground, where white reaches 1.4:1) the opposite pole is used; the core still carries the ring against the grounds, so the pair keeps its guarantee. Both designer constraints hold by construction: the halo is a neutral, never a second accent (measured chroma under 8 on every bundled theme), and the geometry is fixed in the stylesheet. Exposed as `--mullion-color-focus-halo`, in `theme.other.colors`, and carried inline into portaled chrome by `chromeVars()` next to the stroke token.

**Rule.** The P76-I-2 ring rule in `chrome-portable.scss` gains `box-shadow: 0 0 0 6px var(--mullion-color-focus-halo, transparent)`: 2px of halo inside the outline's offset, the 2px core, 2px of halo outside. The SegmentedControl label, which routes its core through Mantine's `--segmented-control-outline`, gets the same shadow. Delivered through the canonical channel from P77-A and P77-C, which is why this track was sequenced after them: nothing new was added to `global.scss` or to any inline style.

**Audit re-modelled, not replaced.** `intendedUiContrastChecks` gains three checks: halo against core, and for `surface` and `surfaceRaised` whichever of the two tones contrasts better against that ground, labelled with the tone that carries it. The six core-on-ground checks stay, because input focus borders, active tabs and builder outlines are core-only affordances. Zero exceptions on all 23 bundled themes.

**Hostile-theme spot check.** A `ThemeColors` block cannot author a surface equal to its own stroke: the engine always expands `primary` into a ramp and some rung clears any single ground. The case exists at the resolved level, so the primitive is tested with the core pinned to the surface; the halo clears 3:1 against that surface and against `surfaceRaised`, in both schemes.

**Measured.** default-dark: halo `#edf5fb`, core `#008e85`; halo against core 3.66:1, halo on surface 14.33:1, on surfaceRaised 12.50:1. default-light: halo `#101416`, core `#006e66`; halo against core 3.02:1, on surface 17.66:1, on surfaceRaised 18.52:1. The e2e ring walk (theme-qa) now runs four times, shadow and light mount times locked and following chrome, and on every painted ring asserts: core in `primaryStroke`, core width 2px, the halo token present on the element, and the painted box-shadow equal to that token at exactly 6px spread. All four pass. The full theme-qa suite passes with no resting baseline moving, as the acceptance criteria require.

**Tight layouts, by eye.** Focused controls were screenshotted at 2x: the access-mode segmented control, the "All" filter chip, the drawer's "Apply gallery theme" switch and an Edit button inside a table cell. The halo renders as a full ring on each, inside and outside the core, and none is clipped by an ancestor. The `overflow: hidden` risk the plan named did not materialise on any surface probed; it remains a thing to look for when a new container is introduced.

**Results.** `npx playwright test` twice in a row (46 tests, the ring walk now counting four): 46 passed, 46 passed. `npx vitest run`: 260 files, 3931 tests, all passed, the 1.4.11 gate included with its three new checks per theme.

**Not done here.** Designer review in situ, per their offer, after it is running. An authored `focusHalo` override in theme JSON was considered and not added: the designer's constraint is that the halo is derived from the grounds, and an override would reintroduce the failure mode the halo exists to close.

### P77-E (2026-09-10)

**Method.** The user was interviewed first (Key Decisions G to M) so the weights were theirs, not the author's. Codebase facts were measured on `c131b50d` with a multi-line-aware import parser (the plan's "153 of 434" became 142 non-test files of 357, 73 distinct symbols, 62 components; 1,535 style props; about 1,500 literal `size` and `variant` props; 117 provider-wrapped test files). Library facts came from the npm registry, the GitHub API and the libraries' own source files on 2026-09-10; web search was unavailable, so every claim carries a primary source. Representative component sets from each candidate were bundled with esbuild under one method so their sizes compare with each other.

**What the measurement changed about the plan's framing.** Bundle size is a weak discriminator: a headless library of comparable coverage costs the same as Mantine for our set (Ark 120 kB gz, React Aria Components 139, Base UI 141, Mantine's used set 114 plus 32 kB of CSS), and the visitor-facing cost is a code-splitting question. Shadow-DOM support divides the field sharply when read from source: Ark (`EnvironmentProvider`, root-node-aware DOM queries), Base UI (`container` accepting `ShadowRoot`, a shadow-walking active-element helper) and React Aria (behind a global `enableShadowDOM()` flag with `UNSAFE_PortalProvider`) pass; Radix's `FocusScope` reads `document.activeElement` in six places; Mantine's `useFocusReturn` still does in 9.6.1. Coverage divides it again: Ark has direct counterparts for every behavioural component we use, Base UI lacks pagination, tags input and colour picker, React Aria lacks pagination and scroll area; Ariakit and Headless UI lack sliders and number fields and are excluded. Mantine's own headless mode (`HeadlessMantineProvider`, present in 9.3.1) turned out to be a real option and is the fallback.

**Scores.** Twelve options against eleven criteria and three gates, weighted three ways (section 8 of the document). The recommended option leads under the user's weights and under equal weights; staying wins narrowly under a ship-soon weighting. The three viable primitives finish within three points, which is why the choice is delegated to a spike with fixed measurements rather than decided on paper.

**Exit conditions** are recorded in both directions: what would turn this back into "stay" (the spike fails twice; the designer's refresh does not happen; the primitive loses its organisation), and what would have turned a "stay" into "leave" (a second `styles`-class trap; a major that changes the theming contract; an unfixable in-component boundary defect).

### P77-H (2026-09-10)

**Delivered** as [IN_HOUSE_UI_FRAMEWORK_STUDY.md](IN_HOUSE_UI_FRAMEWORK_STUDY.md): eight principles, the architecture (three packages, a `MullionProvider` that absorbs `ThemeContext`, `OverlayRootSync`, `AdminChromeProvider` and Mantine's variable emitter; a three-tier token model in which the adapter's 31 override blocks become engine-derived component tokens; a styling layer with no colour literals and no ancestor scheme selectors; one delivery list for every tree), a behaviour-sourcing table for all 62 components against Ark, Base UI and React Aria Components, the "need to address" list (fifteen groups, measured) and the "should address" list (fifteen shortcomings, each with its P76 or P77 evidence and the design that removes it), effort classes per step, and risks.

**Two findings worth stating outside the document.** The largest mechanical cost of leaving Mantine is not the behavioural components but the style props and literal scales (about 3,000 occurrences), and that cost is identical under Mantine's own headless mode, so headless Mantine is a fallback rather than a cheaper stepping stone. And the Theme Manager merge is mostly a consolidation of code that already exists in five files; what is new is the runtime editor with audits at save and the lock/follow mode as a provider prop rather than a nested-provider trick.

## Outcome

_Pending: P77-B default flip and the designer's in-situ review of the halo ring are the open items; every track's document work is complete._
