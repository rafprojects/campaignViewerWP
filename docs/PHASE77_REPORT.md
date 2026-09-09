# Phase 77 - Visual architecture spikes and hardening

**Status:** Planned — no code yet
**Created:** 2026-08-28
**Last updated:** 2026-09-01 (P77-F promoted from FUTURE_TASKS on the designer's sign-off)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P77-A | Style-delivery seam — inventory every channel, name one canonical channel per job, enforce it with tests | Planned | Medium |
| P77-B | Mount strategy — decide whether portaled admin chrome moves inside the shadow root, and record the decision before release | Planned | Medium |
| P77-C | Fix the `global.scss` rules that have never reached portaled admin chrome in shadow mode | Planned | Small |
| P77-D | Test-suite integrity — three e2e specs failing on a clean tree, plus the vacuous `theme-qa` persistence test | Planned | Small-Medium |
| P77-E | UI dependency evaluation — Mantine, an alternative, or in-house. Decision document only | Planned — gated on A and B | Medium |
| P77-F | Two-tone ("halo") focus ring — neutral halo from the theme's grounds around the P76-I-2 ring, making focus visibility structural for themes no audit can see | Planned — gated on A and C; promoted 2026-09-01 | Small-Medium |

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

## Execution Priority

1. **P77-D** first, and deliberately. Three specs fail on a clean checkout today; A–C all move styling around, and a suite with a known-red floor cannot tell you whether you broke something.
2. **P77-A** next — the inventory is the input to everything else, and its enforcement tests are what stop the pattern recurring.
3. **P77-C** immediately after A, as A's first real customer. If the contract cannot express this fix cleanly, the contract is wrong.
4. **P77-B** — larger validation surface, and its outcome may retire parts of A's channel list.
5. **P77-F** after C — the ring rule is one of the styles A/C move around, so land the halo
   through the canonical channel once it exists rather than adding another delivery-channel
   customer first and migrating it later.
6. **P77-E** last. Gated on A and B by construction.

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

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| The UI facade itself (`src/ui/`, ESLint boundary, migration) | **Phase 78.** Gated on A, B and E by explicit decision — a boundary drawn before knowing what it must abstract is a guess. |
| Portal Admin Chrome Into the Shadow Root (existing `FUTURE_TASKS` entry) | Absorbed into P77-B as option (a). The entry stays as the tactical write-up; the decision belongs to the track. |
| ~~Two-tone ("halo") focus ring~~ | **Promoted to P77-F on 2026-09-01.** The original deferral ("not urgent — Option A already clears 3:1") stands as far as it goes, but the designer's response to the v2 design docs endorsed building it and supplied the two constraints that were the open design questions. New information, not a reversal of the reasoning. |
| Privacy items (Sentry PHP scrubber, Google Fonts self-hosting, analytics salt rotation) | All Low / Low-Medium impact; Sentry is off without a DSN and the Google Fonts flow is documented with opt-outs. Would pad the phase without protecting the release. |
| CORS allow-list | Its own entry states it is meaningless for the shortcode deployment actually shipped. |
| Structural a11y gate growth | Its entry states WCAG AA is a quality bar, not a WP.org submission gate, and can grow post-launch. |

## Implementation Notes

_None yet — phase is Planned._

## Outcome

_Pending._
