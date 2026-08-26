# Phase 76 - Post-rebrand catalogs + Phase 75 colour-system follow-ons

**Status:** Planned — no code yet
**Created:** 2026-08-25
**Last updated:** 2026-08-25 (P76-D / P76-E added from the Phase 75 branch review)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P76-A | Run a real `wp i18n make-pot` harvest, `msgmerge` into the 5 reference locales, compile `.mo` / `.l10n.php` | Planned | Medium |
| P76-B | Translate every new or orphaned msgid across de_DE, es_ES, fr_FR, ru_RU, zh_CN so `npm run i18n:check:locales` is green again | Planned | Medium |
| P76-C | Replace `Contributors: wpsupergallery` in `readme.txt` with a live Mullion WordPress.org account — required before the first WP.org upload | Planned — blocked on the.org account existing | Small (code) / human gate |
| P76-D | Verify P75-D's admin-chrome lock in a real browser (it never was), then close the CSS-variable / colour-scheme gap into portaled chrome | Planned | Medium |
| P76-E | Delete the dead legacy `--color-*` / `--radius-*` / `--shadow-*` token bridge (`src/styles/_tokens.scss`), including its three hardcoded ramp rungs | Planned | Small |

---

## Rationale

1. **What triggered it.** Phase 74's P74-C renamed the text domain and the `languages/` filenames, but deliberately did **not** run `wp i18n make-pot`. A real harvest would have pulled in ~150 strings added since the last regen (2026-07-23) and would have changed the translated-string count, which that track's own acceptance criteria forbade. The 2026-08-25 P74 PR Review confirmed the catalogs are now the largest remaining identity leak in shipped plugin files: msgid `WP Super Gallery`, `https://github.com/rafprojects/wp-super-gallery`, stale `#: class-wpsg-*.php` / `#: wp-super-gallery.php` comments, and orphaned translations for strings P74 already rewrote in PHP/JSON source (plugin name, privacy exporter labels, shortcode notice, import copy, settings page title, glow-color placeholder, etc.). The same review left `Contributors: wpsupergallery` as an intentional keep (WordPress.org account slug, not a product identifier). That handle still has to change before the first WP.org upload — Plugin Check / wp.org ingest reject contributor slugs that are not real.org users, and shipping Mullion under `wpsupergallery` is the last listing-identity mismatch.
2. **Why it belongs together, and why not Phase 74 or 75.** Mixing a harvest into the rebrand branch would have buried identifier work in a large i18n diff and broken the locale-coverage gate mid-rename. Phase 75 is Freemius + color-system work; this phase is listing/catalog identity (gettext catalogs + the.org `Contributors` field) with a human.org-account gate that Phase 74 correctly refused to fake.
3. **Success.** `languages/mullion-gallery.pot` describes the current PHP/JSON source (Mullion name, `mullion-gallery` GitHub URI, `class-mullion-*.php` / `mullion-gallery.php` `#:` comments, every string `make-pot` can see). All 5 reference locales compile, and `npm run i18n:check:locales` reports complete coverage — the same 100% bar P74-C preserved by *not* harvesting. `readme.txt` `Contributors:` is a live WordPress.org username that belongs to this product, not `wpsupergallery`.

Runtime English is already Mullion: gettext only matches identical msgids, so the stale `WP Super Gallery` entries are dead keys, not live UI. This phase retires those dead keys and fills the real ones.

4. **Why two colour-system tracks joined a catalogs phase.** P76-D and P76-E come from the [Phase 75 branch review](PHASE75_REPORT.md#branch-review-2026-08-25)'s "reviewed and deliberately not changed" list — the two items that need a browser (D) or a decision about a shipped public-ish surface (E), and so could not be settled inside a review pass. Neither shares a dependency with A/B/C; the phase is a container, not a theme. This repo has run mixed-domain phases before (Phase 72 landed seven unrelated tracks). Both are strictly smaller than A/B, and E in particular is a five-minute deletion that has been carrying a "TODO: Phase 9 follow-up" comment since Phase 9.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Harvest in Phase 74 vs. a dedicated follow-on | **Follow-on (this phase).** Confirmed in the P74 PR Review interview: do not mix ~150 pre-rename untranslated strings plus msgid/URI/`#:` churn into the rebrand branch. |
| B | One mechanical harvest track vs. harvest + translation in the same commit | **Two tracks.** P76-A is deterministic toolchain (pot + merge + compile). P76-B is the human translation pass that restores the coverage gate. Splitting them keeps a green compile even if translation lags a commit. |
| C | What to do with fuzzy/`#| msgid` leftovers after msgmerge | **Resolve in P76-B, do not ship fuzzies.** `i18n:check:locales` already treats fuzzy as untranslated. Identity strings (product name, URIs, "Mullion — …" labels) are mechanical token swaps, same as P74-B's six-string hand pass. The ~150 never-harvested feature strings need real translations. |
| D | Write a guessed `Contributors` slug vs. wait for a real.org account | **Wait for the account, then write that exact username.** Plugin Check and wp.org SVN ingest validate contributor slugs against live WordPress.org users. Committing `mullion` (or any other invented slug) before the account exists fails the listing. P74-B/Q were right to leave `wpsupergallery` rather than invent; P76-C is when the account is created (or renamed/transferred) and the field is updated. |
| E | Contributor handle vs. plugin slug | **Not necessarily the same string.** Plugin slug is already `mullion-gallery` (Phase 74 Decision C). The.org *user* can be `mullion`, `mulliongallery`, the existing account renamed, or whatever username we actually register. Confirm the live username at implementation time; do not bake a guess into this plan. |
| F | P76-D: fix the CSS-var reach blind, or verify first? | **Verify first, as the track's own step 1.** P75-D's Implementation Notes state plainly that no visual check of either toggle state was run. Its acceptance criteria ("chrome always renders in the Mullion brand palette", "pixel-identical with the toggle on") are therefore unconfirmed, and the portal gap below is a *predicted* symptom derived from reading Mantine's source, not an observed one. Writing a fix before looking is how P75-E's spike found the designer's 8-theme list was measured against the wrong code. |
| G | P76-E: delete the token bridge, or migrate the hardcoded rungs to `primaryFill` / `primaryStroke`? | **Delete.** The migration question is moot — a full grep of `src/` and `packages/` finds **zero** consumers of any `--color-*`, `--radius-*`, or `--shadow-*` alias, so the three hardcoded rungs are not painting anything. Rewriting dead declarations to use the correct token would be busywork that keeps a file whose own header has said "migrate, then delete this file" since Phase 9. Only `--z-header` has live consumers and only that survives. |

## Execution Priority

1. **P76-A** first — without a current `.pot`, P76-B is translating against a stale template.
2. **P76-B** immediately after — the coverage gate will fail between A and B; do not merge A alone to `main` if CI runs `i18n:check:locales` on every PR (it does, via the existing i18n job). Land A+B as one PR, or land B in the same branch before the PR is reviewable.
3. **P76-C** is independent of A/B (no i18n coupling) but is a **release gate**: it must land before the first WordPress.org upload (`svn-deploy.yml` / [GO_LIVE_PUNCH_LIST.md](guides/GO_LIVE_PUNCH_LIST.md)). The.org account can be created in parallel with A/B; the `readme.txt` edit waits on that account.
4. **P76-E** is independent of everything and landable first if convenient — it is a deletion with no consumers, and it does not touch the theme engine, so it cannot collide with D.
5. **P76-D** last of the code tracks, because its step 1 is a browser QA pass whose findings define the rest of the track. It should also absorb any theme-QA snapshot recapture the whole phase needs, rather than each track recapturing separately.

---

## Track P76-A - Harvest and merge

### Problem

`wp-plugin/mullion-gallery/languages/mullion-gallery.pot` last had a real harvest on 2026-07-23. Since then:

- The plugin header, privacy exporter/eraser labels, embed shortcode notice, settings page title, and several frontend strings changed from "WP Super Gallery" to "Mullion" in *source*, so those `.po` entries are orphaned.
- Plugin URI / Author URI in the header is `https://github.com/rafprojects/mullion-gallery`; the POT still has `https://github.com/rafprojects/wp-super-gallery`.
- Every `#:` source-reference comment still names `wp-super-gallery.php` / `class-wpsg-*.php`.
- ~150 strings added after 2026-07-23 (carousel/adapter/settings work, later phases) were never harvested. English ships; the five locales fall through to English for those keys.
- P74-O changed the glow-color placeholder `#7c9ef8` → `#1ad1c4` in source JSON/PHP; the POT still has msgid `#7c9ef8`.

P74-C's header-only edit (`Project-Id-Version`, `Report-Msgid-Bugs-To`, `X-Domain`) is still correct and should survive the harvest.

### Fix

Follow [TRANSLATING.md](guides/TRANSLATING.md) "Regenerate the template", via wp-env so WP-CLI is the same binary CI/docs assume:

1. `npm run i18n:generate` (no-op if the manifest is already current; required so `make-pot` sees frontend strings).
2. `wp i18n make-pot wp-plugin/mullion-gallery wp-plugin/mullion-gallery/languages/mullion-gallery.pot --domain=mullion-gallery --exclude=node_modules,vendor,tests,build` (from inside wp-env, plugin path as mounted).
3. `msgmerge --update --backup=off` each of the 5 `.po` files against the new `.pot` (or `wp i18n update-po`).
4. `wp i18n make-mo` + `wp i18n make-php` scoped to `languages/`.
5. Diff the `.pot` header: keep `X-Domain: mullion-gallery`. Confirm Plugin Name / URI msgids now match `mullion-gallery.php`. Confirm `#:` comments name `mullion-gallery.php` / `class-mullion-*.php`.

Do **not** hand-edit `class-mullion-frontend-strings.php`. Do **not** translate in this track.

### Acceptance criteria

- `.pot` Plugin Name msgid is `Mullion`; Plugin URI msgid is `https://github.com/rafprojects/mullion-gallery`.
- Zero `#: class-wpsg-` / `#: wp-super-gallery.php` comments in `.pot`.
- `npm run i18n:check` still passes (manifest freshness, independent of locales).
- All 5 `.po` files merge without conflict markers. Fuzzies are acceptable at the end of A; they are P76-B's input.
- Compiled `.mo` / `.l10n.php` exist for every locale and load as `mullion-gallery`.

### Validation

- `git diff --stat` on `languages/` reviewed: header + msgid list + `#:` comments, no accidental binary-only change.
- `npm run i18n:check:locales` is **expected to fail** after A until B lands — that failure list *is* P76-B's punch-list. Capture it in this report under P76-A Implementation Notes.

---

## Track P76-B - Restore locale coverage

### Problem

After P76-A, `npm run i18n:check:locales` will report every new or changed English msgid as missing/untranslated/fuzzy in de_DE, es_ES, fr_FR, ru_RU, and zh_CN. Two populations:

1. **Identity / rebrand strings** — product name, GitHub URI, "Mullion — Access Requests" / "Mullion — Audit Log", shortcode-not-resolved notice, import-from-Mullion copy, settings page title, hex placeholders. Same class of work as P74-B's six-string hand pass: the existing translation is the old English proper noun sitting inside otherwise-translated text, or an identity translation of a URI/hex.
2. **The ~150-string harvest backlog** — feature copy that has never been in the catalogs. These need real translations, not token swaps.

Until this track lands, non-English sites keep falling through to English for (2), and (1) stays as dead POT keys plus English fallback for the new msgids.

### Fix

- For population 1: mechanical token swap / identity translation, locale by locale, matching P74-B's method (edit `.po` source, never the generated `.l10n.php`).
- For population 2: translate each new msgid in all 5 locales. Empty or fuzzy msgstr is not acceptable.
- Recompile with `wp i18n make-mo` + `wp i18n make-php`.
- Do not regenerate the `.pot` again unless A has to be re-run because source changed underfoot.

### Acceptance criteria

- `npm run i18n:check:locales` — 5/5 locales complete (every `src/i18n-strings.en.json` value has a non-empty, non-fuzzy msgstr). The absolute count will be higher than P74-C's 2,379; that is expected.
- Zero `WP Super Gallery` / `wp-super-gallery` (as this product) in `.po` msgstr values. The third-party name "WP Super Cache" does not appear in these catalogs.
- `npm run i18n:check` still passes.

### Validation

- `npm run i18n:check` + `npm run i18n:check:locales`.
- Spot-check one non-English locale in wp-env (`WPLANG=de_DE`): Plugins screen shows Mullion, not the old name; a previously-backlogged settings string renders translated rather than English.

---

## Track P76-C - WordPress.org `Contributors` handle

### Problem

`wp-plugin/mullion-gallery/readme.txt` line 2 is still `Contributors: wpsupergallery`. P74-B, P74-Q, and P74-M all left it on purpose: that field is a WordPress.org *account slug*, not the product name. Rewriting it to a username that does not exist fails Plugin Check and wp.org ingest. The 2026-08-25 PR Review recorded it as an intentional keep.

It still has to change before release. The listing would otherwise credit `wpsupergallery` for a product named Mullion, and the first SVN deploy / WP.org submission is the moment the field becomes load-bearing. This is the last listing-identity leftover from the rebrand that is not i18n catalogs and is not historical changelog.

The handle appears only in `readme.txt` today (plus this phase's FROM-map in PHASE74). Changelog history lines (`wp wpsg`, `@wpsg`) stay historical — they are not this track.

### Fix

1. **Human gate, first.** Create or rename the WordPress.org account that will own the listing (or transfer the existing `wpsupergallery` profile). Confirm the live username at [wordpress.org/plugins](https://wordpress.org/plugins/) profile URL. Do not pick a slug in this plan — see Key Decision E.
2. **Code.** `Contributors: <that-username>` in `wp-plugin/mullion-gallery/readme.txt`. If the listing will have more than one contributor, list them comma-separated per the [readme standard](https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/).
3. **Do not** rewrite `readme.txt` changelog history, the P74-K license-test negative assertion, or archive docs.

Blocked on step 1. The file edit is a one-liner once the account exists.

### Acceptance criteria

- `Contributors:` in `readme.txt` is a username that loads as a real WordPress.org profile (HTTP 200 on `https://profiles.wordpress.org/<username>/`).
- Zero `wpsupergallery` in `readme.txt` outside changelog history lines.
- Plugin Check / the WP.org header validator accept the field (same check [TESTING_QA.md](testing/TESTING_QA.md) already names for headers).

### Validation

- Open the profiles.wordpress.org URL for the new slug before committing.
- `grep -n wpsupergallery wp-plugin/mullion-gallery/readme.txt` — only historical changelog, if it appears there at all (today it does not; only line 2).
- This is a release blocker for `svn-deploy.yml` / the Go-Live punch list, not for Phase 74 merge.

---

## Track P76-D - Verify the admin-chrome lock, then close the portal gap

### Problem

Two things, in this order.

**1. P75-D was never visually verified.** Its Implementation Notes say so outright: *"No browser MCP in this session; Settings Panel / Builder visual check of both toggle states against a non-default gallery theme was not run here."* Its four acceptance criteria — brand palette with the toggle off, pixel-identical to pre-P75-D with it on, public gallery unaffected, standalone admin pages unaffected — are backed by unit tests over `useMantineTheme()` and `useBuilderShellColors()`, not by looking at the product. The e2e `theme-qa` suite explicitly opts *out* of the new default (`BASE_SETTINGS.applyThemeEverywhere = true`) to keep its existing baselines valid, so the shipped default state has no visual coverage at all.

**2. A predicted gap the unit tests cannot see.** `AdminChromeProvider` scopes its nested Mantine CSS variables with `cssVariablesSelector=".mullion-admin-chrome"`, and `adminChromeClassNames()` puts that class on the Drawer/Modal `inner` and `content` parts. But Mantine renders that variable block as a `<style>` element **inline in the provider's own React tree**, while `Drawer`/`Modal` default to `withinPortal: true` — and Mantine 9's `Portal` (`reuseTargetNode: true`) appends its target node to `document.body`:

```js
if (reuseTargetNode) {
  const existingNode = document.querySelector("[data-mantine-shared-portal-node]");
  if (existingNode) return existingNode;
  const node = createPortalNode(others);
  node.setAttribute("data-mantine-shared-portal-node", "true");
  document.body.appendChild(node);
  return node;
}
```

In a shadow-DOM mount the `<style>` is inside the shadow root and the chrome it should style is in the light DOM under `<body>`. The same split hits the gallery's own tokens: `ThemeContext` injects `--mullion-color-*` at `:host` in the shadow root, or into `document.head` scoped to `[data-mullion-theme-scope]` in a non-shadow mount — neither is an ancestor of a node parented directly to `<body>`. Nor does any ancestor of that node carry `data-mantine-color-scheme`, which is what Mantine's compiled `light-dark()` rules select on.

What still works, and is why this is a gap rather than a broken feature: `adaptTheme`'s per-component `styles` / `defaultProps` travel through React context, which crosses portals, so the brand palette *is* applied to Mantine components. The Layout Builder shell is also fine by construction — it writes `--mullion-builder-*` as **inline styles** on a div inside the Modal (`LayoutBuilderModal.tsx:512`), which no portal can break. The exposure is narrower than "the chrome is unthemed": it is whatever inside portaled chrome reads a CSS variable or depends on `light-dark()`.

Related and worth checking in the same pass: `packages/shared-ui/src/Lightbox.tsx`'s header comment claims *"The Portal inherits `getRootElement()` from the nearest MantineProvider"* — Mantine 9's `Portal` does not read `getRootElement` at all. Either the comment is stale or the Lightbox relies on behaviour it does not have.

### Fix

**Step 1 — look at it.** wp-env + Playwright (or a manual pass), on a non-default gallery theme (`tokyo-night` is the established fixture), capturing all four states: Settings Panel and Layout Builder × toggle off and on, in both a shadow mount and `?shadow=0`. Record what actually differs from the acceptance criteria. This step's output is the real scope of steps 2–3; it may find nothing, in which case the track closes by adding the missing default-state coverage and correcting P75-D's notes.

**Step 2 — pick a mechanism for whatever step 1 confirms.** Four candidates, roughly by increasing blast radius:

- **(a) `attributes` prop.** Mantine 9 supports `attributes={{ inner: {...}, content: {...} }}` on styles-API components. Put `data-mantine-color-scheme` on the same parts that already get `ADMIN_CHROME_CLASS`, so `light-dark()` resolves. Smallest change; does not help CSS variables.
- **(b) Inline the chrome variables** on the Drawer/Modal `content` style, the way the Builder already does with `--mullion-builder-*`. Self-contained and portal-proof, but Mantine generates the `--mantine-*` set internally, so this means either reproducing that or limiting it to the `--mullion-color-*` block.
- **(c) Move the provider inside the portal** — wrap the Drawer's *children* rather than the Drawer itself, so the generated `<style>` lands in the portal (a `<style>` in the light DOM applies document-wide, so `.mullion-admin-chrome` would then match). Costs the Drawer's own header/title/close button, which would fall outside the provider.
- **(d) Portal into the shadow root** via `portalProps={{ target }}` — `SettingsPanel` already resolves the shadow root for its badge sentinel, so the target is in hand. Cleanest conceptually, largest blast radius: z-index stacking against wp-admin, focus trapping, and click-outside all change.

Prefer (a), plus (b) or (c) only if step 1 shows a variable-driven difference. Do not adopt (d) without a specific finding that requires it.

**Step 3 — close the coverage hole.** Add at least one `theme-qa` state captured with `applyThemeEverywhere` **false** (the shipped default), so the brand lock has a baseline. Today every settings-dialog snapshot is a toggle-on capture.

### Acceptance criteria

- Each of P75-D's four acceptance criteria is confirmed against a rendered browser, not a unit test, and the result is recorded in this document — including "confirmed, no change needed" if that is the answer.
- Portaled Settings Panel chrome resolves the brand palette in the locked state with no dependence on which mount mode (shadow / light DOM) the app is in.
- At least one `theme-qa` baseline exercises `applyThemeEverywhere: false`.
- The `Lightbox.tsx` `getRootElement` comment is either corrected or the behaviour it describes is restored.
- With the toggle on, the panel remains visually identical to the pre-P75-D capture — the existing toggle-on baselines must not need recapture for an unrelated reason.

### Validation

- `npx playwright test theme-qa` (existing suite) plus the new default-state case.
- `npx playwright test --config=playwright.visual.config.ts` (Storybook, 0.1% tolerance).
- Focused Vitest on `AdminChromeProvider`, `chromeTheme`, `useBuilderShellColors` — unchanged expectations unless the mechanism changes the component tree.
- Manual: open the Settings Panel over a `tokyo-night` gallery, toggle the switch both ways, confirm the chrome swaps and the gallery behind it does not.

---

## Track P76-E - Delete the dead legacy token bridge

### Problem

`src/styles/_tokens.scss` maps 24 pre-theme-engine CSS custom properties (`--color-*`, `--radius-*`, `--shadow-*`, `--z-*`) onto the `--mullion-*` variables, scoped to `.mullion-gallery`. Its own header has said so since Phase 9:

> `TODO: Phase 9 follow-up — migrate all SCSS modules to use --mullion-* directly, then delete this file.`

The migration finished at some point and the deletion never happened. A grep across `src/` and `packages/` for consumers of any alias in that file returns **one** live token:

| Group | Aliases defined | Live consumers |
|-------|-----------------|----------------|
| `--color-*` | 14 | **0** |
| `--radius-*` | 4 | **0** |
| `--shadow-*` | 2 | **0** |
| `--z-*` | 4 | **1** (`--z-header`) |

`--z-header` is read by `CardGallery.module.scss` (no fallback), `src/components/Auth/AuthBar.tsx`, and `packages/shared-ui/src/AuthBarMinimal.tsx` (both with a `100` fallback). The only other mentions of the file anywhere are two comments describing it, in `global.scss` and `shadowStyles.ts`.

The Phase 75 branch review reached this file from the other direction: three of the dead aliases hardcode ramp rungs (`--mullion-color-primary-6` ×1, `--mullion-color-primary-8` ×2), which P75-E's "no hardcoded ramp index" sweep did not cover. They are the wrong tokens under the fill/stroke split — but they are also unread, so correcting them would be decoration on a corpse.

There is no user-facing risk. The aliases are *definitions*, never *reads*, so a site owner overriding one already has no effect; and the plugin exposes no custom-CSS setting through which anyone could be reading them (confirmed — no `customCss` / `custom_css` field exists).

### Fix

- Move `--z-header: 40` (and, if a named scale is still wanted, the other three z-index values) into `src/styles/global.scss`'s existing `.mullion-gallery` rule, where the rest of the gallery's own base styling lives.
- Give `CardGallery.module.scss`'s `z-index: var(--z-header)` a literal fallback (`var(--z-header, 40)`), matching the two AuthBar call sites, so the value is not silently `auto` if the definition ever moves again.
- Delete `src/styles/_tokens.scss` and the `@use './tokens';` line at the top of `global.scss`.
- Update the two comments that describe the bridge (`global.scss` line ~10, `shadowStyles.ts` line ~9).

### Acceptance criteria

- `src/styles/_tokens.scss` no longer exists and nothing imports it.
- `grep -rn -- "var(--color-\|var(--radius-\|var(--shadow-" src/ packages/` returns nothing outside `node_modules` and build output.
- `--z-header` still resolves for all three consumers; the sticky gallery header keeps its stacking order.
- Zero `--mullion-color-primary-<n>` index references remain in production SCSS, closing the gap P75-E left.

### Validation

- `npx vitest run` and `npx tsc -b` (the file is SCSS, so the real gate is the build: `npm run build` must not warn on a missing `@use`).
- `npx playwright test theme-qa` — gallery-shell snapshots must be **byte-identical**. Any diff means something was reading a bridged token after all, and the grep missed it.
- Visual: sticky gallery header still overlaps content on scroll.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Adding a sixth reference locale | Out of scope — this phase restores the five we already ship. |
| Switching the coverage gate from "100% of frontend JSON" to "100% of the whole POT" | The current gate (`check-i18n-locales.mjs`) only asserts frontend JSON values. PHP-only admin strings are not in that count. Expanding the gate is useful and separate. |

## Implementation Notes

Not started. P76-A/B/C came from the Phase 74 PR Review leftover list; P76-D/E were added from the [Phase 75 branch review](PHASE75_REPORT.md#branch-review-2026-08-25) on 2026-08-25.

## Outcome

**Planned.** Phase 74 can close without this; catalogs are stale, runtime English is not. P76-C is a WordPress.org-upload blocker, not a Phase 74 merge blocker. P76-D/E are Phase 75 follow-ons and block nothing — D is unverified-acceptance-criteria cleanup, E is a deletion.
