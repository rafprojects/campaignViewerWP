# Phase 76 - Post-rebrand catalogs + Phase 75 colour-system follow-ons

**Status:** In progress — P76-A, P76-D, P76-E, P76-F, P76-G, P76-H landed
**Created:** 2026-08-25
**Last updated:** 2026-08-27 (P76-H complete — both toggle states now themed in both mount modes)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P76-A | Run a real `wp i18n make-pot` harvest, `msgmerge` into the 5 reference locales, compile `.mo` / `.l10n.php` | **Done** (2026-08-26) | Medium |
| P76-B | Translate every new or orphaned msgid across de_DE, es_ES, fr_FR, ru_RU, zh_CN so `npm run i18n:check:locales` is green again | **Done** (2026-08-28) — 15 strings, not the ~750 planned; see notes | Small |
| P76-C | Replace `Contributors: wpsupergallery` in `readme.txt` with a live Mullion WordPress.org account — required before the first WP.org upload | Planned — blocked on the.org account existing | Small (code) / human gate |
| P76-D | Verify P75-D's admin-chrome lock in a real browser (it never was), then close the CSS-variable / colour-scheme gap into portaled chrome | **Done** (2026-08-27) — remainder split into H and I | Medium |
| P76-E | Delete the dead legacy `--color-*` / `--radius-*` / `--shadow-*` token bridge (`src/styles/_tokens.scss`), including its three hardcoded ramp rungs | **Done** (2026-08-26) | Small |
| P76-F | Make the `applyThemeEverywhere` toggle instantaneous — always render `AdminChromeProvider`'s nested provider so flipping it stops remounting the Settings Panel | **Done** (2026-08-27) | Small |
| P76-G | Delete `scripts/validate-adapter-settings-parity.mjs` and its npm script — broken since a refactor, and superseded by a Vitest guard that says so in its own header | **Done** (2026-08-26) | Small |
| P76-H | Reach theme CSS variables into portaled admin chrome — P76-D fixed light-DOM mounts; shadow (the shipped default) still resolves nothing | **Done** (2026-08-27) — widened mid-track to cover both toggle states | Small-Medium |
| P76-I | The contrast audit measures tokens the product does not paint — the real focus ring is `primaryFill`, failing 3:1 on 11 of 23 themes, and inputs have no focus indicator at all | Planned — **premise corrected 2026-08-27**, see notes | Medium |

---

## Rationale

1. **What triggered it.** Phase 74's P74-C renamed the text domain and the `languages/` filenames, but deliberately did **not** run `wp i18n make-pot`. A real harvest would have pulled in ~150 strings added since the last regen (2026-07-23) and would have changed the translated-string count, which that track's own acceptance criteria forbade. The 2026-08-25 P74 PR Review confirmed the catalogs are now the largest remaining identity leak in shipped plugin files: msgid `WP Super Gallery`, `https://github.com/rafprojects/wp-super-gallery`, stale `#: class-wpsg-*.php` / `#: wp-super-gallery.php` comments, and orphaned translations for strings P74 already rewrote in PHP/JSON source (plugin name, privacy exporter labels, shortcode notice, import copy, settings page title, glow-color placeholder, etc.). The same review left `Contributors: wpsupergallery` as an intentional keep (WordPress.org account slug, not a product identifier). That handle still has to change before the first WP.org upload — Plugin Check / wp.org ingest reject contributor slugs that are not real.org users, and shipping Mullion under `wpsupergallery` is the last listing-identity mismatch.
2. **Why it belongs together, and why not Phase 74 or 75.** Mixing a harvest into the rebrand branch would have buried identifier work in a large i18n diff and broken the locale-coverage gate mid-rename. Phase 75 is Freemius + color-system work; this phase is listing/catalog identity (gettext catalogs + the.org `Contributors` field) with a human.org-account gate that Phase 74 correctly refused to fake.
3. **Success.** `languages/mullion-gallery.pot` describes the current PHP/JSON source (Mullion name, `mullion-gallery` GitHub URI, `class-mullion-*.php` / `mullion-gallery.php` `#:` comments, every string `make-pot` can see). All 5 reference locales compile, and `npm run i18n:check:locales` reports complete coverage — the same 100% bar P74-C preserved by *not* harvesting. `readme.txt` `Contributors:` is a live WordPress.org username that belongs to this product, not `wpsupergallery`.

Runtime English is already Mullion: gettext only matches identical msgids, so the stale `WP Super Gallery` entries are dead keys, not live UI. This phase retires those dead keys and fills the real ones.

4. **Why four Phase 75 follow-on tracks joined a catalogs phase.** P76-D, P76-E, and P76-F are the whole of the [Phase 75 branch review](PHASE75_REPORT.md#branch-review-2026-08-25)'s "reviewed and deliberately not changed" list that is code rather than test debt — the items needing a browser (D), a decision about a shipped surface (E), or a change to a stated behavioural guarantee (F), none of which a review pass should settle unilaterally. None shares a dependency with A/B/C; the phase is a container, not a theme. This repo has run mixed-domain phases before (Phase 72 landed seven unrelated tracks). All four are strictly smaller than A/B, and E in particular is a five-minute deletion that has been carrying a "TODO: Phase 9 follow-up" comment since Phase 9. The list's fourth item, a vacuous `theme-qa` test, went to [FUTURE_TASKS.md](FUTURE_TASKS.md#vacuous-e2e-test--theme-qa-changing-theme--persists-to-localstorage) instead — it needs an executable Playwright run rather than a scheduled slot. **P76-G** came from the same review by a different route: P75-G's validation table recorded `npm run validate:adapter-settings` as failing pre-existing, which correctly scoped it out of the colour work and left it with no owner.

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
| H | P76-F: stabilise the element tree, or read the *saved* `applyThemeEverywhere` instead of the live draft? | **Stabilise the tree.** Reading the saved value would also stop the remount — the panel reads the live draft today, which is exactly why the switch applies instantly — but it buys that by making the toggle *not* instantaneous, which is the behaviour worth keeping. Always rendering the nested provider keeps both properties. |
| I | P76-F: what preserves P75-D's "pixel-identical with the toggle on" guarantee once a provider is always mounted? | **The theme override, plus the existing baselines as proof.** Follow mode feeds the nested provider the parent's own `MantineThemeOverride` from `useTheme()`, run through the same `CloseButton` merge `ThemedApp` applies — same input, same output. It is checkable rather than assertable: all six `display-settings-*` theme-QA baselines were captured with `applyThemeEverywhere: true`, so if they stay byte-identical, follow mode is unchanged. Treat a recapture requirement as a failure of this track, not a baseline refresh. |
| J | P76-G: repair the parity script or delete it? | **Delete.** The surviving Vitest guard's own header says `replaces P31-D regex parity test` — the script *is* P31-D, superseded by P55-C and never removed. Repairing it would resurrect a weaker, unrun duplicate: one-way key-existence scraping versus eight checks against the `adapter-fields.json` single source of truth. Nothing calls the script, so deleting it cannot regress a gate. |

## Execution Priority

1. **P76-A** first — without a current `.pot`, P76-B is translating against a stale template.
2. **P76-B** immediately after — the coverage gate will fail between A and B; do not merge A alone to `main` if CI runs `i18n:check:locales` on every PR (it does, via the existing i18n job). Land A+B as one PR, or land B in the same branch before the PR is reviewable.
   > **Superseded by what P76-A actually found (2026-08-26).** The gate stays **green** after A — all three remaining gaps are PHP-only strings, which `check-i18n-locales.mjs` does not cover. A is safe to merge alone. See [P76-A Implementation Notes](#implementation-notes-2026-08-26).
3. **P76-C** is independent of A/B (no i18n coupling) but is a **release gate**: it must land before the first WordPress.org upload (`svn-deploy.yml` / [GO_LIVE_PUNCH_LIST.md](guides/GO_LIVE_PUNCH_LIST.md)). The.org account can be created in parallel with A/B; the `readme.txt` edit waits on that account.
4. **P76-E** is independent of everything and landable first if convenient — it is a deletion with no consumers, and it does not touch the theme engine, so it cannot collide with D.
5. **P76-F** before **P76-D**. Both touch `AdminChromeProvider`, and F changes the component tree that D's browser pass is supposed to be observing — running D first means QA-ing a structure F is about to replace. F is also the smaller, fully-specified one.
6. **P76-G** is independent of everything, like E — a deletion with no callers.
7. **P76-D** last of the code tracks, because its step 1 is a browser QA pass whose findings define the rest of the track. It should also absorb every theme-QA snapshot change the phase needs — F's byte-identical check, D's own new default-state baseline, and the `borderStrong` coverage gap below — rather than each track recapturing separately.

---

## Track P76-A - Harvest and merge

### Problem

`wp-plugin/mullion-gallery/languages/mullion-gallery.pot` last had a real harvest on 2026-07-23. Since then:

- The plugin header, privacy exporter/eraser labels, embed shortcode notice, settings page title, and several frontend strings changed from "WP Super Gallery" to "Mullion" in *source*, so those `.po` entries are orphaned.
- Plugin URI / Author URI in the header is `https://github.com/rafprojects/mullion-gallery`; the POT still has `https://github.com/rafprojects/wp-super-gallery`.
- Every `#:` source-reference comment still names `wp-super-gallery.php` / `class-wpsg-*.php`.
- ~150 strings added after 2026-07-23 (carousel/adapter/settings work, later phases) were never harvested. English ships; the five locales fall through to English for those keys.
- P74-O changed the glow-color placeholder `#7c9ef8` → `#1ad1c4` in source JSON/PHP; the POT still has msgid `#7c9ef8`.
- P75-G renamed the `default-light` theme to **Mullion Light** in `theme-catalog.json` and the PHP picker; the catalogs still carry the orphaned `Default Light` msgid, alongside `Default Dark` from the P74-N rename. Handed to this track by that phase; `npm run i18n:check:locales` stays green because it only covers front-end strings.

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

### Implementation Notes (2026-08-26)

Ran the real toolchain end to end through wp-env (WP-CLI 2.12.0, WordPress 7.0), then verified the result against the tree rather than against this plan's predictions. **Three of the plan's premises turned out to be stale — they are corrected below and they shrink P76-B substantially.**

**What was run**

1. `npm run i18n:generate` — no-op, the manifest was already current (`i18n:check` green before the harvest).
2. `wp i18n make-pot . languages/mullion-gallery.pot --domain=mullion-gallery --exclude=node_modules,vendor,tests,build --skip-js`
3. `wp i18n update-po mullion-gallery.pot .` (all 5 locales in one pass)
4. `wp i18n make-mo languages languages` + `wp i18n make-php languages languages`

**Deviations from the plan's command list, and why**

- **`--skip-js` was required, not optional.** The plan's exact command dies: `PHP Fatal error: Allowed memory size of 134217728 bytes exhausted in .../Peast/Syntax/CommentsRegistry.php`. `make-pot` parses JS by default and the plugin ships 5.1 MB of minified Vite bundles (`admin/build/assets/`, `assets/assets/`), which the Peast parser cannot hold. `--skip-js` is also *correct* independent of the OOM: a grep of `package.json`, `src/`, and `packages/` finds **zero** `@wordpress/i18n` usage — the React side goes through the P60-G manifest bridge, not `wp.i18n` — and the pre-existing POT likewise carried no JS source references. Bumping the PHP memory limit instead would have made the POT depend on build state, which is worse. **This flag belongs in [TRANSLATING.md](guides/TRANSLATING.md); filed as a doc follow-up below.**
- **`wp i18n update-po`, not GNU `msgmerge`.** `msgmerge` is not installed on the WSL host and the WP-CLI container is Alpine without `gettext`. The plan explicitly allowed either. Behavioural difference worth recording: WP-CLI's `update-po` **drops** obsolete entries outright rather than preserving them as `#~` comments, and does **no** fuzzy similarity matching. Net effect here is benign — Key Decision C says not to ship fuzzies anyway, and the dropped entries are all confirmed rebrand orphans (list below) whose translations remain recoverable from git history.
- **`POT-Creation-Date` in the five `.po` headers was synced by hand** to the new template's `2026-08-27T02:59:44+00:00`. GNU `msgmerge` does this; WP-CLI's `update-po` leaves the stale value (they still read `2026-07-18`). `PO-Revision-Date` was deliberately left alone — that is the translator timestamp and belongs to P76-B. The `.mo` / `.l10n.php` were recompiled after the edit so the binaries carry the corrected header.

**Corrections to this track's Problem statement**

- **"~150 strings added after 2026-07-23 were never harvested" is wrong.** The true delta is **+7 / −13 msgids** in the POT. The catalogs were never actually 5 weeks stale: later phases hand-maintained the `.po` files ahead of the POT (most recently `ba72659f`, the P75-I harvest). Four of the seven "new" POT msgids were *already translated in all five locales* before this track ran.
- **"The POT still has msgid `#7c9ef8`" is wrong.** The pre-harvest POT already carried `#1ad1c4`; that P74-O follow-on had been closed earlier.
- **Four of the thirteen dropped msgids are not rebrand orphans.** `Role updated`, `Failed to update role`, `Can edit metadata and media; cannot manage access or builder`, and `Full campaign control including access management and builder` no longer exist anywhere in source — stale POT entries from a removed feature, correctly dropped. The other nine are the expected rebrand/theme-rename orphans: `WP Super Gallery`, `https://github.com/rafprojects/wp-super-gallery`, `Super Gallery Settings`, `WP Super Gallery — Access Requests`, `WP Super Gallery — Audit Log`, the two long WP-Super-Gallery-branded strings, `Default Dark`, `Default Light`.

**Regression check on the merge (the part worth proving)**

The `.po` diffs are whole-file rewrites (~6,100 lines each, entry order changed), so a diff read proves nothing. Parsed both revisions into `(msgctxt, msgid, msgid_plural) → msgstr[]` maps instead and compared:

| Locale | Common entries | `msgstr` changed | Dropped | Added |
|--------|---------------:|-----------------:|--------:|------:|
| de_DE / es_ES / fr_FR / ru_RU / zh_CN | 2 522 | **0** | 9 | 3 |

Zero translations mutated. Arithmetic reconciles exactly: 2 531 − 9 + 3 = 2 525 entries per locale, matching the new POT. Plural-Forms headers (including ru_RU's 3-form rule) and all non-ASCII payloads survived intact. Zero fuzzies, zero `#~` obsoletes, zero conflict markers.

**P76-B's punch list — 15 strings, not ~750**

Every locale is missing exactly the same three msgids, and `npm run i18n:check:locales` **stays green** (contradicting this track's Validation note, which expected it to fail):

| msgid | Source | Note |
|-------|--------|------|
| `Mullion Settings` | `class-mullion-settings-*` | rebrand of `Super Gallery Settings` |
| `Mullion Light` | `theme-catalog.json` via the PHP theme picker | P75-G rename of `Default Light` |
| `https://github.com/rafprojects/mullion-gallery` | Plugin URI / Author URI | identity translation, as the old URI had |

The gate stays green because all three are **PHP-only** strings and `check-i18n-locales.mjs` only asserts coverage of `src/i18n-strings.en.json` — the blind spot this phase's own Follow-On Candidates table already names. So the "do not merge A alone" warning in Execution Priority does not apply: CI is green on A by itself. `P75-G`'s `Default Dark` → the plugin-name msgid `Mullion` needed no new entry, since `theme-catalog.json` names the default dark theme just `Mullion`.

**Validation**

- `npm run i18n:check` — green (manifest unchanged by this track).
- `npm run i18n:check:locales` — **green**, 2 380/2 380 in all five locales, unchanged from the pre-harvest baseline.
- POT acceptance: Plugin Name msgid is `Mullion`; Plugin URI msgid is `https://github.com/rafprojects/mullion-gallery`; **zero** `wpsg` / `wp-super-gallery` occurrences anywhere in the file (was 3 041 + 4); `X-Domain: mullion-gallery` and `Report-Msgid-Bugs-To` preserved; `Copyright (C) 2026 WP Super Gallery` → `Copyright (C) 2026 Mullion`. Source-reference dirs are exactly `mullion-gallery.php`, `includes/`, `includes/i18n/`, `includes/settings/` — no `admin/` or `assets/` leakage from the JS skip.
- Zero `WP Super Gallery` / `wp-super-gallery` / `Super Gallery` in any `.po` **msgstr** — P76-B's second acceptance criterion is already met.
- Runtime load, all five locales, both compiled formats (`wp eval-file` in the cli container): `load_textdomain()` (which prefers the `.l10n.php` fast format) and a direct `MO::import_from_file()` each return the same translation for a probe string — e.g. `Asset Library` → `Asset-Bibliothek` / `Biblioteca de recursos` / `Bibliothèque de ressources` / `Библиотека ресурсов` / `素材库`. Each `.mo` carries 2 522 entries (2 525 minus the three untranslated, which `make-mo` omits) and the correct `Language:` header. `Mullion Settings` correctly falls through to English — the expected end-of-A state.
- `php -l` clean on all five `.l10n.php`.
- PHPUnit (via a Haiku runner on the `/php-testing` skill): **1 323 tests, 13 737 assertions, 1 failure, 2 skipped.** The single failure is `Mullion_Package_Edition_Test::test_defaults_premium_without_marker_file`, which asserts the gitignored build marker `assets/mullion-edition.json` is absent. That file was written by a local build at `02:16` today, before this track's first command at `02:59`, and this track touched only `languages/` — **pre-existing local-environment state, unrelated.** Delete the marker to re-green it locally; CI never sees it.

**Docs touched by this track**

- **[TRANSLATING.md](guides/TRANSLATING.md) "Regenerate the template" — fixed in this track.** The documented `make-pot` command omitted `--skip-js` and therefore OOMs on any built checkout. Added the flag plus a callout explaining why skipping JS loses nothing. This is in scope because this track's Fix section is "follow TRANSLATING.md", and the instruction it points at did not work.
- **[PHASE72_MANUAL_QA_RUNBOOK.md](PHASE72_MANUAL_QA_RUNBOOK.md) line ~328 is now obsolete** — its "Pitfall" tells the reader *not* to run a bare `wp i18n make-pot` because it "will drop the hand-maintained `class-mullion-frontend-strings.php` reference block style". The canonical regen has now been run and the structural comparison above shows **zero** translations lost. Left as-is (historical QA runbook, not a live guide), but flagged here so nobody re-derives that advice.


---

## Track P76-B - Restore locale coverage

> **Scope correction after P76-A ran (2026-08-26).** The two populations below did not materialise. The real punch list is **3 msgids × 5 locales = 15 strings** — `Mullion Settings`, `Mullion Light`, and the Plugin/Author URI — all identity or near-identity swaps, all PHP-only. `npm run i18n:check:locales` is already green and stays green; population 2 (the "~150-string harvest backlog") does not exist, because later phases hand-maintained the `.po` files ahead of the POT. Zero old-brand strings remain in any `msgstr`, so this track's second acceptance criterion is already met. Read the [P76-A Implementation Notes](#implementation-notes-2026-08-26) before starting. The remainder of this section is the original plan, kept for provenance.

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

### Implementation Notes (2026-08-28)

**Punch list re-derived independently, not taken from P76-A.** Parsed all five `.po` files into `(msgid, msgid_plural) -> msgstr[]` maps rather than trusting the scope-correction note above: exactly **3 msgids x 5 locales = 15 empty msgstr**, zero fuzzy, zero `#~` obsoletes, 2 525 entries per locale. A's numbers hold. Also confirmed first-hand that none of the three appears in `src/i18n-strings.en.json` -- that is *why* `i18n:check:locales` stayed green through A, and it means **this track's own headline gate cannot prove it landed.** The structural parse and the runtime probe below are the real checks.

**The 15 strings, and where each translation came from**

| msgid | de_DE | es_ES | fr_FR | ru_RU | zh_CN |
|-------|-------|-------|-------|-------|-------|
| `Mullion Settings` | Mullion-Einstellungen | Ajustes de Mullion | Paramètres de Mullion | Настройки Mullion | Mullion 设置 |
| `Mullion Light` | Mullion Hell | Mullion claro | Mullion clair | Mullion светлая | Mullion 浅色 |
| `https://github.com/rafprojects/mullion-gallery` | *identity* | *identity* | *identity* | *identity* | *identity* |

House style was read off sibling entries already in the catalogs, not invented:

- **`Mullion Light` follows the theme-name pattern, not the dropped `Default Light` one.** The catalogs already translate `Material Light` -> `Material Hell` / `Material claro` / `Material clair` / `Material светлая` / `Material 浅色`, and `Solarized Light` identically: **brand token verbatim, descriptor translated, descriptor case per locale** (German capitalises, the Romance locales do not). The dropped `Default Light` translations (`Standard Hell`, `Claro predeterminado`, `Clair par défaut`, `По умолчанию светлая`, `默认浅色`) are *not* the precedent -- "Default" was an adjective, "Mullion" is a proper noun, so reusing that shape produces word-order nonsense. Worth noting the catalogs deliberately leave upstream-named themes (`Gruvbox Dark`, `Tokyo Night`, `Catppuccin Latte`) untranslated in all five locales; `Mullion Light` is our own name plus our own descriptor, so it is translated like `Material Light`.
- **The standalone `Light` msgid is a trap.** It resolves to `Leicht` / `Ligera` / `Léger` / `细` -- font *weight*, not luminance. Reusing it would have shipped "Mullion Thin" in Chinese.
- **`Mullion Settings` is a token swap of the dropped `Super Gallery Settings`, with one deliberate French departure.** de/es/ru/zh keep the old structure exactly (`Super Gallery-Einstellungen` -> `Mullion-Einstellungen`, `Ajustes de Super Gallery` -> `Ajustes de Mullion`, and so on). French does not: the old entry was `Réglages de Super Gallery`, but A dropped it, and in the *surviving* catalog "Paramètres" outnumbers "Réglages" 12 : 1 -- including the translation of the adjacent submenu label `Settings`, which `add_submenu_page()` renders directly beside this page title. `Réglages de Mullion` would have put two different French words for "Settings" side by side in one menu. Chose `Paramètres de Mullion`.
- **The URI is an identity translation**, matching what the dropped `.../wp-super-gallery` entry did in all five locales. It must be a real entry rather than left empty, or `make-mo` omits it and the Plugins-screen URI falls through to the untranslated header.

`PO-Revision-Date` bumped to `2026-08-28` in all five headers -- P76-A deliberately left that field alone as the translator timestamp belonging to this track.

**Validation**

- **Structural parse, all five catalogs: `total=2525 empty=0 fuzzy=0 oldbrand_in_msgstr=0`.** The last column greps every `msgstr` for `WP Super Gallery` / `wp-super-gallery` / `Super Gallery` / `wpsg` -- this track's second acceptance criterion, now proven rather than inherited from A's assertion.
- **The `.po` diff is exactly 20 lines: 15 `msgstr` + 5 `PO-Revision-Date`.** Nothing else in ~1.9 MB of catalog text moved.
- **Runtime probe, 5 locales x both compiled formats.** `load_textdomain()` (which prefers the `.l10n.php` fast format) and a direct `MO::import_from_file()` return the **same** string for each of the three msgids in every locale -- no format skew. `.mo` entry count went **2 522 -> 2 525** exactly as predicted, since `make-mo` omits untranslated entries and there are none left. Control probe `Asset Library` still resolves to its pre-existing translation everywhere.
- **The track's browser spot-check, settled at the data layer instead.** `get_plugin_data($file, false, true)` under a forced `de_DE` / `fr_FR` / `zh_CN` locale returns Name `Mullion`, both URIs `https://github.com/rafprojects/mullion-gallery`, and a translated Description (`Einbettbare Kampagnengalerie mit Shadow-DOM-Rendering.` / `Galerie de campagnes intégrable avec rendu Shadow DOM.` / `可嵌入的活动图库，采用 Shadow DOM 渲染。`). That is precisely what the Plugins screen renders.
- `php -l` clean on all five regenerated `.l10n.php`.
- `npm run i18n:check` green; `npm run i18n:check:locales` green (2 380/2 380 in all five).
- **No test regression surface, checked rather than assumed.** A grep of `wp-plugin/mullion-gallery/tests/` finds **zero** PHP tests referencing `languages/`, `.po`, `l10n`, `textdomain` or `gettext`; the only JS consumers of the catalogs are `src/i18n.ts` and the two `scripts/*i18n*.mjs`. A full PHPUnit run would only re-confirm P76-A's pre-existing `Mullion_Package_Edition_Test` failure -- the gitignored `assets/mullion-edition.json` build marker, still present locally from 2026-08-26 -- and would say nothing about this track, so it was not re-run.

**Two more copies of the broken `make-pot` command, fixed here**

P76-A found that the documented `make-pot` invocation OOMs on any built checkout without `--skip-js`, and fixed [TRANSLATING.md](guides/TRANSLATING.md). It missed two other live copies of the same command. Both are this track's natural property, and both are two-line fixes:

- **`scripts/check-i18n-locales.mjs`** printed the flagless command as its *failure* remediation -- read by exactly the person about to run it, at the moment they need it to work. Added `--skip-js` and a one-line reason.
- **[PRO_FEATURES.md](guides/PRO_FEATURES.md)** "Mandatory i18n locale step" carried the same command with the same omission. Added the flag.

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

**Step 3 — close the coverage holes.** Two, both in the same suite and the same recapture:

- Add at least one `theme-qa` state captured with `applyThemeEverywhere` **false** (the shipped default), so the brand lock has a baseline. Today every settings-dialog snapshot is a toggle-on capture.
- Extend the snapshot matrix to exercise a **`borderStrong` outline**. P75-G proved by controlled experiment that reverting the dark `borderStrong` to the defective `#577577` produced *byte-identical* `display-settings-default-dark` and `theme-selector-open-default-dark` captures: the token is painted on Input / Select / Checkbox / Switch outlines (`adapter.ts` ×9) but no snapshot state renders one. `uiContrastAudit` is currently the only gate covering that token. A dialog state with a focused text input and an unchecked checkbox visible would close it.

### Acceptance criteria

- Each of P75-D's four acceptance criteria is confirmed against a rendered browser, not a unit test, and the result is recorded in this document — including "confirmed, no change needed" if that is the answer.
- Portaled Settings Panel chrome resolves the brand palette in the locked state with no dependence on which mount mode (shadow / light DOM) the app is in.
- At least one `theme-qa` baseline exercises `applyThemeEverywhere: false`.
- Reverting `default-dark`'s `borderStrong` to `#577577` makes at least one `theme-qa` snapshot fail — the controlled test P75-G ran and that nothing currently catches.
- The `Lightbox.tsx` `getRootElement` comment is either corrected or the behaviour it describes is restored.
- With the toggle on, the panel remains visually identical to the pre-P75-D capture — the existing toggle-on baselines must not need recapture for an unrelated reason.

### Validation

- `npx playwright test theme-qa` (existing suite) plus the new default-state case.
- `npx playwright test --config=playwright.visual.config.ts` (Storybook, 0.1% tolerance).
- Focused Vitest on `AdminChromeProvider`, `chromeTheme`, `useBuilderShellColors` — unchanged expectations unless the mechanism changes the component tree.
- Manual: open the Settings Panel over a `tokyo-night` gallery, toggle the switch both ways, confirm the chrome swaps and the gallery behind it does not.

### Implementation Notes (2026-08-27)

Step 1 was run as a real browser pass (Playwright against the dev server, `tokyo-night` gallery, all four combinations of `applyThemeEverywhere` × shadow / `?shadow=0`), probing the rendered DOM rather than eyeballing screenshots. It **changed the track**: two of P75-D's criteria are confirmed, the predicted gap is real but its *root cause is not portals*, and the plan's own preferred mechanism was dismissed for the wrong reason.

**A false start worth recording.** The first probe reported identical colours in all four states, which read as "the brand lock does nothing". It was the probe that was wrong: `theme-qa`'s fixture seeds `localStorage['mullion-theme-id']` as well as the settings payload, and without that the gallery never left the default theme — so "gallery" and "brand" were the same palette and nothing could discriminate. Fixed the fixture, re-ran, and the real picture appeared. Anything measuring a lock-vs-follow difference must put the gallery on a *non-default* theme first.

**P75-D criteria 1 and 2: CONFIRMED, no change needed.** With the gallery on `tokyo-night` (`background #1a1b26`, `surface #24283b`, `text #d4dbf8`) and the brand on `default-dark` (`surface #102530`, `text #eef8fb`), the Drawer content paints:

| State | Drawer `background-color` | Drawer `color` | Verdict |
|-------|---------------------------|----------------|---------|
| toggle **off** (shipped default) | `rgb(16,37,48)` = `#102530` | `rgb(238,248,251)` = `#eef8fb` | **brand** ✓ |
| toggle **on** | `rgb(36,40,59)` = `#24283b` | `rgb(212,219,248)` = `#d4dbf8` | **gallery** ✓ |

Identical in shadow and light-DOM mounts. The gallery shell behind stayed `#1a1b26` in every state, so criterion 3 (public gallery unaffected) holds too. This also re-confirms P76-F did not disturb follow mode.

**Root cause of the variable gap — not what the plan predicted.** Mantine does not emit its colour variables under the bare `cssVariablesSelector`. It emits three rules:

```
.mullion-admin-chrome                                     /* static: z-index, scale, cursor  */
.mullion-admin-chrome[data-mantine-color-scheme="dark"]   /* every colour variable           */
.mullion-admin-chrome[data-mantine-color-scheme="light"]  /* every colour variable           */
```

`adminChromeClassNames()` put the **class** on `inner`/`content`; nothing ever put the **attribute** there. So those parts matched only the static rule, and every colour variable fell through to the gallery root by inheritance — chrome labelled brand-scoped while resolving gallery values. Measured on the locked light-DOM panel: `--mantine-color-body` was `#1e212f` and `--mantine-primary-color-filled` `#2f509e` (both Tokyo Night) on the Drawer content, while the provider's own sentinel — which *does* carry the attribute — correctly read `#0d1c24` / `#007870` (brand).

**This means the gap was never shadow-specific.** The plan derived it from Mantine's `Portal` source and scoped it to shadow mounts. It bites light-DOM mounts too, where no portal or shadow boundary is involved at all — the attribute is simply missing.

**The plan dismissed the right fix for the wrong reason.** Key Decision option (a) is listed as *"Smallest change; does not help CSS variables."* It is precisely what makes the CSS variables resolve, because Mantine gates them on that attribute. Verified by simulating (a) in-page before writing any code — setting `data-mantine-color-scheme` on `inner`/`content` flipped the locked light-DOM panel from `#1e212f`/`#2f509e` to `#0d1c24`/`#007870`.

**Implemented (a).** New `adminChromeAttributes()` in `chromeTheme.ts`, mirroring `adminChromeClassNames()` part-for-part (a unit test asserts the two return the same keys, so they cannot drift), wired into the `Drawer` in `SettingsPanel` and the `Modal` in `LayoutBuilderModal` via Mantine 9.3.1's `attributes` styles-API prop. Follow mode returns `{}` for the same reason `adminChromeClassNames()` does — there the chrome is *meant* to inherit the gallery root, and does.

**What (a) does not fix, and why it is a separate decision.** In a shadow mount the variables stay `(unset)` even with the attribute, because the rule block is rendered inside the shadow root while the Drawer is portaled to `document.body`. Confirmed in the browser both by simulation and after the real fix. Mantine's `getTargetNode` (`@mantine/core/esm/components/Portal/Portal.mjs:17-32`) honours only an explicit `target`; otherwise `reuseTargetNode` (default `true`) appends a shared node to `document.body`.

**The shadow-mode remainder is measurable, not theoretical.** Fingerprinting every painted colour on the first 400 elements inside the Drawer: the light-DOM panel renders **58** distinct `background/color/border/outline/fill` combinations, the shadow panel **55**. The three missing ones are the variable-driven surfaces — `#0d1c24` (`--mantine-color-body`) and `#0e1f29` among them. Small, but real.

Choosing between the plan's remaining options (b) inline the variables, (c) move the provider inside the portal, (d) portal into the shadow root is a change to a shipped surface with genuine trade-offs — (d) alone moves z-index stacking against wp-admin, focus trapping, and click-outside. **Left for an explicit decision rather than settled here**; see Outstanding below.

**Lightbox comment corrected** (acceptance criterion). `packages/shared-ui/src/Lightbox.tsx` claimed *"The Portal inherits `getRootElement()` from the nearest MantineProvider, so it correctly targets the shadow DOM mount point in WP plugin mode."* A grep of `Portal.mjs` finds **zero** references to `getRootElement`; the claim was never true. Replaced with what the component actually does, why it is acceptable (colours arrive via per-component styles through React context, which cross portals), and a warning not to retarget it at the shadow root without re-checking the z-index stacking the Portal exists to escape. Corrected rather than "restored" — the behaviour described never existed, and changing where the lightbox portals is a behavioural change nobody asked for.

**Step 3 — coverage holes, and a finding that invalidates one of this track's own acceptance criteria.**

Added the missing default-state baseline: `display settings dialog, chrome locked — tokyo-night gallery` (`applyThemeEverywhere: false`). Every prior settings-dialog snapshot was a toggle-**on** capture, so the shipped default had no visual coverage at all; a regression leaking the gallery palette into locked chrome now shows up as a whole-dialog diff. `installThemeSession` gained an `applyThemeEverywhere` option to make that expressible.

The `borderStrong` criterion could not be met, and the reason is a product finding, not a testing one. This track assumed P75-G's byte-identical result meant "no snapshot state renders an outline". The first hypothesis on re-examination was tolerance — a handful of 1px borders is ~0.3 % of a 1280×900 page against `maxDiffPixelRatio: 0.1`. So a control-scoped, **zero-tolerance** snapshot was added, and the P75-G experiment re-run against it: revert `default-dark`'s `borderStrong` to the defective `#577577`, expect a failure. **Result: 20/20 still passed.**

Measuring the controls directly explains why:

| Element | computed `border-color` | computed `border-width` |
|---------|------------------------|-------------------------|
| `mantine-Select-input` | `rgb(87,117,119)` = the reverted `#577577` | **`0px`** |
| `mantine-Switch-track` | `rgb(87,117,119)` | **`0px`** |
| `mantine-NumberInput-input` | `rgb(87,117,119)` | **`0px`** |

The token *is* flowing — the reverted value reached the DOM — onto elements with **zero border width**. `adapter.ts` sets `borderColor: rc.borderStrong` on Input / Select / TextInput / NumberInput / Checkbox / Switch (×9) but never a width, and Mantine's own Input styles compute to `border-width: 0` here. Contrast the same file's eight `border: \`1px solid ${rc.border}\`` declarations, which do paint.

**So `borderStrong` never reaches a pixel, and no snapshot can cover it.** `uiContrastAudit` is auditing a token that is not rendered. That makes this track's criterion *"Reverting `default-dark`'s `borderStrong` to `#577577` makes at least one `theme-qa` snapshot fail"* unachievable as written — it needs a product decision first (give those controls a `borderWidth`, or retire the token), which is why it is not silently papered over with a passing test. Recorded as Outstanding.

The zero-tolerance snapshot was kept but **renamed** to `themed control — tight tolerance`, with a comment stating plainly that it does not cover `borderStrong` and why. It still earns its place: it is the only tight-tolerance visual coverage of a themed control, and it catches fill/text/geometry changes that 115 k pixels of whole-page slack would swallow. Stable across four consecutive runs.

**Validation**

- Browser probe, four states, before and after the fix — the table and variable readings above.
- `npx vitest run chromeTheme AdminChromeProvider SettingsPanel` — 79 passed / 4 files, including two new `adminChromeAttributes` cases.
- `npx vitest run` — 3 885 passed / 258 files. `npx tsc -b` exit 0.
- `npx playwright test theme-qa` — **20/20**, including the two new cases, with the 18 pre-existing baselines byte-identical and untouched (`git status` shows no modification under `-snapshots`, only the two new files). Confirms option (a) did not disturb follow mode, as expected: `adminChromeAttributes()` returns `{}` there.
- Both new baselines re-run clean on repeat invocations before being committed; the zero-tolerance one across four runs.
- All three throwaway probe specs were deleted after recording these findings; they are not permanent tests. `packages/theme-engine/src/definitions/default-dark.json` was restored after the controlled revert (verified by an empty `git diff --stat`).

**Outstanding — both now have homes (2026-08-27)**

Neither was settled unilaterally, both were taken to a decision, and both are now tracks in this phase rather than loose ends: **[P76-H](#track-p76-h---reach-theme-css-variables-into-portaled-admin-chrome)** (option (b) chosen; (c) ruled out, (d) deferred with reasons) and **[P76-I](#track-p76-i---borderstrong-is-audited-but-never-painted)** (split into an audit-correctness half and a design half, since the borderless look is deliberate). The original statements:

1. **Shadow-mode CSS variables** — needs a decision between (b), (c), and (d). Impact is bounded and known: 3 of 58 painted colour combinations, no effect on the primary palette, which travels through React context.
2. **`borderStrong` is not painted.** Decide whether the affected controls should carry a `borderWidth` (making the token real, and `uiContrastAudit`'s coverage of it meaningful) or whether `borderStrong` should be retired from `adapter.ts` and the audit. Until then this track's `#577577` criterion cannot be satisfied by any test. This is the same class of finding as P75-G's — a token measured against code that does not render it.


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

### Implementation Notes (2026-08-26)

Deleted `src/styles/_tokens.scss`. Re-derived the consumer census independently rather than trusting the plan's table — it was correct, and the deletion is provably inert.

**Consumer census, re-run against the live tree**

| Group | Aliases defined | `var()` reads in `src/` + `packages/` |
|-------|----------------:|--------------------------------------:|
| `--color-*` | 14 | **0** |
| `--radius-*` | 4 | **0** |
| `--shadow-*` | 2 | **0** |
| `--z-base` / `--z-overlay` / `--z-modal` | 3 | **0** |
| `--z-header` | 1 | **3** |

The only non-`var()` mentions of the dead groups anywhere were three comments — `global.scss:10`, `shadowStyles.ts:9`, and **`src/styles/README.md:5`, which this plan did not list**. All three updated; the README needed a rewrite rather than a line edit, since its whole premise was "this folder contains design tokens", which stopped being true when the theme engine took over.

**What survived, and why it is a no-op**

`--z-header: 40` moved into `global.scss`'s existing `.mullion-gallery` rule — the *same selector* the bridge used, in the *same compiled stylesheet* (`global.scss?inline` is what `shadowStyles.ts` injects into the shadow root, and `_tokens.scss` only ever reached the shadow root by being `@use`d from it). Same selector + same value = identical computed value for all three consumers. Verified by compiling `global.scss` standalone: output is one `.mullion-gallery` block carrying `--z-header: 40` and zero legacy aliases.

`CardGallery.module.scss` got the literal fallback `var(--z-header, 40)`. **Note a discrepancy in the plan here:** it says to make this "match the two AuthBar call sites", but those use `var(--z-header, 100)` while the definition is `40`. Copying `100` would have changed the out-of-scope rendering of a rule that resolves to `40` today. Used `40` — the value it actually computes to — and left the AuthBar fallbacks alone, since changing them would alter `AuthBarMinimal`'s standalone (non-`.mullion-gallery`) behaviour, which is outside this track. **The `40`/`100` fallback inconsistency is real but pre-existing and harmless while the definition is present; not fixed here.**

**Closes P75-E's hardcoded-ramp gap outright.** All three `--mullion-color-primary-<n>` index references in production SCSS (`primary-6` ×1, `primary-8` ×2, at `_tokens.scss:27,30,32`) lived in this file and only this file. A post-deletion grep of `src/` and `packages/` for `--mullion-color-<name>-<digit>` returns nothing.

**Validation**

- **`npx playwright test theme-qa` — 18/18 passed, exit 0, zero snapshot updates.** This is the criterion that mattered: the plan flagged any diff here as proof the grep had missed a live consumer. There is none.
- Full `npx vitest run` — 3 879 passed / 258 files, exit 0. `npx tsc -b` exit 0.
- `npm run build` exit 0 with **no missing-`@use` warning** — the specific failure mode of removing the import.
- **End-to-end proof in the shipped bundle:** a grep of the entire freshly built `dist/` — CSS *and* JS — for `--color-*`, `--radius-*`, `--shadow-*`, `--z-base`, `--z-overlay`, `--z-modal` returns **zero files**. This is stronger than the source grep: it would catch a variable name composed at build time that a source grep could miss. `--z-header` is present in the fresh `global-*.css`, `index-*.css`, and `index-*.js`, and the emitted `global` stylesheet shrank 4 825 → 3 825 bytes — the bridge, and nothing else.
- Stale copies of the pre-deletion CSS still sitting in `wp-plugin/mullion-gallery/assets/` are from a local build at 22:16 today, before this work; that path is gitignored (`.gitignore:37`) and regenerated by `scripts/copy-wp-assets.js` at packaging time, so nothing stale ships. Confirmed zero tracked changes under it.
- Confirmed no `customCss` / `custom_css` setting exists anywhere in `src/`, `packages/`, or `includes/`, so no site owner could have been reading a bridged alias through custom CSS.
- **Not run:** a manual scroll of the sticky gallery header. The computed `--z-header` is unchanged by construction (same selector, same value, same rule), and the gallery-shell snapshots are byte-identical, so there is no mechanism by which stacking order could have moved.


---

## Track P76-F - Make the `applyThemeEverywhere` toggle instantaneous

### Problem

`AdminChromeProvider` returns two structurally different trees:

```tsx
if (applyThemeEverywhere) {
  return children;                       // passthrough
}
return (
  <>
    <div className={ADMIN_CHROME_CLASS} … />
    <MantineProvider …>{children}</MantineProvider>
  </>
);
```

`SettingsPanel` reads the flag off the **live draft** (`settings.applyThemeEverywhere`), so flipping the Switch changes that tree mid-session. `children` moves from directly under the component to two levels down, React sees different element types at each position, and it unmounts and remounts the entire Drawer subtree.

The draft settings and the active tab live *above* the provider in `SettingsPanel`, so they survive. Everything below it does not: accordion sections collapse, scroll position resets, and — the reason this is worth a track rather than a note — **keyboard focus is dropped from the Switch the user just operated**. Toggling a setting should not eject a keyboard user from the control they are using.

This falls directly out of P75-D's own decision that the toggle-on path be "a passthrough (no extra MantineProvider) so chrome is pixel-identical to today". The guarantee is worth keeping; implementing it as *structural absence* is what costs the remount.

### Fix

Always render the nested provider, and change what it is fed rather than whether it exists:

```tsx
const { mantineTheme, colorScheme } = useTheme();
const source = applyThemeEverywhere
  ? { theme: mantineTheme,   scheme: colorScheme }
  : { theme: brand.mantine,  scheme: brand.meta.colorScheme };
```

then run `source.theme` through the same `mergeThemeOverrides(…, { CloseButton: { defaultProps: { 'aria-label': … } } })` the component already applies — which is also what `ThemedApp` applies — so follow mode receives byte-for-byte the theme override its parent would have used. The element tree is now identical in both states, so React preserves the subtree and the switch is instant.

Three things that could have made this costly were checked and do not apply:

- **`forceColorScheme` is free.** A grep of `src/` and `packages/*/src` finds **zero** callers of `useMantineColorScheme` or `setColorScheme`, so forcing the scheme in follow mode disables nothing.
- **The nested CSS-variable block is inert in follow mode.** `adminChromeClassNames(true)` already returns `{}`, so `.mullion-admin-chrome` is applied to no Drawer/Modal part and the extra variable block matches nothing. (It is a few hundred bytes of unmatched CSS; if that is judged wasteful, `withCssVariables={!applyThemeEverywhere}` removes it.)
- **The scope sentinel is harmless in both states.** It is `hidden` + `aria-hidden` and carries only the colour-scheme attribute that the P75 branch review's R1 fix already points `getRootElement` at.

Apply the same change at both call sites — `SettingsPanel` and `LayoutBuilderModal` pass through the same provider.

### Acceptance criteria

- Flipping `applyThemeEverywhere` in an open Settings Panel does **not** remount the Drawer: a child mounted before the flip is the same instance after it.
- Focus stays on the Switch across the toggle, in both directions.
- The chrome palette still changes on the flip — the point of the toggle is not lost to the stabilised tree.
- With the toggle on, the panel is unchanged from today (see Key Decision I).
- `LayoutBuilderModal` behaves the same way; its Dockview `colorScheme` still follows the chrome theme.

### Validation

- **New Vitest**: render `AdminChromeProvider` with a child that increments a counter in a mount effect; rerender with the flag flipped; assert the counter is still 1. That test fails against the current implementation, which is what makes it a regression test rather than a description of the new code.
- Existing focused Vitest: `AdminChromeProvider` (including the R1 shadow-root case), `chromeTheme`, `useBuilderShellColors`, `SettingsPanel`.
- **`npx playwright test theme-qa` — the six `display-settings-*` baselines must be byte-identical**, since all of them were captured with `applyThemeEverywhere: true`. A recapture requirement means follow mode changed and the track has not met Key Decision I.
- Manual: open the panel over a `tokyo-night` gallery, tab to the Switch, toggle both ways with the keyboard, confirm focus never leaves it and an expanded accordion section stays expanded.

### Implementation Notes (2026-08-27)

Implemented exactly as planned — always render the nested provider, change only its inputs — after reproducing the remount first. All three of the plan's "checked and do not apply" claims were independently re-verified and hold.

**Reproduced before fixing.** Wrote the regression tests against the *unchanged* implementation and confirmed they fail: `expected 2 to be 1` on the mount counter, in **both** directions (on→off and off→on). The plan only predicted the flip in one direction; it costs a remount either way, because the passthrough and wrapped trees differ structurally regardless of which one you start from.

**What changed.** `AdminChromeProvider` no longer early-returns `children`. Both states render the same element tree; only `theme` and `forceColorScheme` differ:

- Lock mode: `brand.mantine` / `brand.meta.colorScheme` — unchanged from P75-D.
- Follow mode: `mantineTheme` / `colorScheme` straight off `useTheme()`, i.e. the parent's own values, run through the identical `mergeThemeOverrides(…, { CloseButton: { defaultProps: { 'aria-label': … } } })` that `ThemedApp` applies at `main.tsx:97`. Same input, same transform, same output.

`getTheme` reads a module-level `Map`, so both branches hand `useMemo` a stable object identity and the memo does not thrash.

**Re-verified the plan's three risk dismissals**

- **`forceColorScheme` is free** — a grep of `src/` and `packages/` for `useMantineColorScheme`, `useComputedColorScheme`, and `setColorScheme` returns **zero** hits. Forcing the scheme in follow mode disables nothing, because nothing reads it.
- **The nested CSS-variable block is inert in follow mode** — `adminChromeClassNames(true)` returns `{}`, so no Drawer/Modal part carries `ADMIN_CHROME_CLASS`. The only node that does is the provider's own hidden sentinel, which is `hidden` + `aria-hidden`. Left `withCssVariables` at its default rather than taking the plan's optional `withCssVariables={!applyThemeEverywhere}`: in follow mode the block now carries the *gallery* values, so painting the sentinel with them is correct rather than merely harmless, and not toggling a prop keeps the tree that much more stable.
- **`LayoutBuilderModal` needs no edit.** The plan says to "apply the same change at both call sites", but the change is entirely inside the shared provider, so both call sites inherit it. Its Dockview `colorScheme` and `useBuilderShellColors` read `useTheme()` directly and emit **inline** `--mullion-builder-*` styles — no dependency on this provider at all, in either state.

**One existing test had to change, deliberately.** `is a passthrough when applyThemeEverywhere is true` asserted `document.querySelector('.mullion-admin-chrome')` was `null` — a *structural* assertion that this track intentionally invalidates. Replaced with `follows the gallery theme when applyThemeEverywhere is true`, which asserts the property that actually matters and that the old test never checked: in follow mode the chrome resolves to the gallery palette, not the brand palette. It uses `github-light` against the dark brand theme so `colorScheme` discriminates between "followed the gallery" and "silently fell back to brand" — the old test would have passed either way.

**Validation**

- **New regression tests, proven to discriminate.** Restored the pre-P76-F provider from `HEAD` and re-ran: **5 of the 7 tests fail** (both mount-counter cases, both focus cases, and the rewritten follow-mode case), then pass again on the fix. A test that passes against the old code would not have been a regression test.
- **Focus is asserted directly, not by proxy.** Beyond the mount counter, two `it.each` cases focus a control inside the provider, flip the flag, and assert both that `screen.getByTestId(…)` returns the *same DOM node* and that `document.activeElement` is still it. That is the acceptance criterion ("focus stays on the Switch across the toggle, in both directions") rather than a mechanism that implies it.
- **`npx playwright test theme-qa` — 18/18 passed, zero snapshot mismatches, and `git status` shows no modified file under any `-snapshots` path.** This is Key Decision I discharged: all six `display-settings-*` baselines were captured with `applyThemeEverywhere: true`, so byte-identical output is positive evidence that follow mode is unchanged. No recapture was needed, which the plan defines as the pass condition.
- Focused Vitest — `AdminChromeProvider`, `chromeTheme`, `useBuilderShellColors`, `SettingsPanel`: 75 passed / 4 files.
- Full `npx vitest run` — **3 883 passed / 258 files** (3 879 before this track: +4 new cases, 1 rewritten in place). `npx tsc -b` exit 0. `eslint --max-warnings 0` clean on both changed files.
- **Not run:** a manual keyboard pass in a real browser. The remount was the sole mechanism by which focus could be lost, it is now asserted absent in jsdom in both directions, and the byte-identical snapshots show the rendered result did not move. P76-D's browser pass covers this surface next and can confirm it live.


---

## Track P76-G - Delete the superseded adapter-settings parity script

### Problem

`npm run validate:adapter-settings` fails, today, on a clean checkout:

```
✗ Could not locate SETTING_GROUP_DEFINITIONS block in adapterRegistry.ts
```

`scripts/validate-adapter-settings-parity.mjs` text-scrapes `const SETTING_GROUP_DEFINITIONS` out of `src/components/Galleries/Adapters/adapterRegistry.ts`. That constant was extracted to `src/data/adapterSettingGroups.ts` — the registry now only imports it — so the script's `indexOf()` returns `-1` and it exits 1 before checking anything.

It has been silently broken since that extraction, because **nothing runs it**: a grep of `.github/`, `.husky/`, and `.lintstagedrc.cjs` finds no caller, only the `package.json` entry. So no build ever went red, and the script has sat in the script list looking like a working gate.

The parity coverage it appears to provide is not lost — it moved. `src/components/Galleries/Adapters/adapterSettingsParity.test.ts` imports the constant properly, runs in the blocking Vitest suite, and opens with:

> `P55-C: Adapter fields schema contract guard (replaces P31-D regex parity test).`

That script *is* P31-D. It was explicitly superseded by P55-C and never deleted. The Vitest guard is also strictly stronger: eight checks against the `adapter-fields.json` single source of truth, versus the script's one-way "registry keys exist in the PHP map" scrape.

Surfaced by the [Phase 75 branch review](PHASE75_REPORT.md#branch-review-2026-08-25) — P75-G's validation table recorded `validate:adapter-settings` as *"fails — pre-existing, reproduces on a clean `git stash` of this branch; unrelated to colour work"*, correctly scoping it out of the colour work but leaving it unowned.

### Fix

- Delete `scripts/validate-adapter-settings-parity.mjs`.
- Delete the `validate:adapter-settings` entry from `package.json`.
- Grep the docs for references and repoint them at `npx vitest run adapterSettingsParity` (the command the surviving guard's own header documents).

Do **not** repair the script by retargeting it at `src/data/adapterSettingGroups.ts`. That would restore a weaker, unrun duplicate of a check that already passes in CI — Key Decision J.

### Acceptance criteria

- `scripts/validate-adapter-settings-parity.mjs` no longer exists and `npm run` no longer lists `validate:adapter-settings`.
- `npx vitest run adapterSettingsParity` passes and is still reached by the default `npx vitest run`.
- No doc or workflow references the removed script.

### Validation

- `npx vitest run adapterSettingsParity` before and after — unchanged pass.
- `npm run` lists no broken script; `grep -rn "validate:adapter-settings" .` returns nothing outside phase history.

### Implementation Notes (2026-08-26)

Deleted `scripts/validate-adapter-settings-parity.mjs` and its `validate:adapter-settings` entry from `package.json`. Re-verified every claim in this track's Problem section before deleting — all held, and one is **stronger than stated**.

- **The break reproduces exactly as described.** `npm run validate:adapter-settings` on the pre-change tree exits 1 with `✗ Could not locate SETTING_GROUP_DEFINITIONS block in adapterRegistry.ts`, before performing a single check.
- **Nothing ran it.** Grepped `.github/`, `.husky/`, `.lintstagedrc.cjs`, `scripts/`, and every root config: the only references anywhere were `package.json`, the script's own usage docstring, and prose in `docs/`. No gate could regress.
- **It was broken in *two* places, not one — and this is what settles Key Decision J.** Its second stage scrapes `$nested_adapter_field_map` out of `class-mullion-settings-sanitizer.php`. That static array is also gone: the sanitizer now exposes `get_nested_adapter_field_map()` sourcing from `Mullion_Adapter_Field_Schema::get_map()`. And the surviving Vitest guard's check 7 — *"PHP sanitizer sources adapter map from Mullion_Adapter_Field_Schema, not a hand-maintained array"* — **asserts that array must not come back** (`expect(sanitizerSource).not.toContain("private static $nested_adapter_field_map = [")`). So "repair the script" was never really on the table: restoring its PHP scrape target would fail the test that replaced it. The plan reached the right answer via the weaker argument (duplicate coverage); the real one is that the two are mutually exclusive.
- **Coverage genuinely moved, it was not lost.** `adapterSettingsParity.test.ts` imports `SETTING_GROUP_DEFINITIONS` properly from `src/data/adapterSettingGroups.ts` — the module the script's regex could no longer find — and runs 8 checks against `adapter-fields.json` as the single source of truth, versus the script's one-way key-existence scrape.

**Doc reference updated:** [FUTURE_TASKS.md](FUTURE_TASKS.md) cited this script as its cautionary precedent in the future tense ("is being deleted in … P76-G"); moved to past tense. Its point — cross-artifact parity checks rot unless wired into CI — is unaffected and worth keeping.

**Validation**

- `npx vitest run adapterSettingsParity` — **8/8 passed**, unchanged before and after.
- Full `npx vitest run` — **3 879 passed / 258 files**, exit 0.
- `npx tsc -b` exit 0; `npm run build` exit 0 (only the pre-existing chunk-size advisory).
- `package.json` still parses; `npm run` no longer lists `validate:adapter-settings`.
- `grep -rn "validate-adapter-settings-parity\|validate:adapter-settings"` across the repo returns hits only in `docs/PHASE76_REPORT.md`, `docs/FUTURE_TASKS.md`, and `docs/archive/` — phase history, as the acceptance criterion allows.


---

## Track P76-H - Reach theme CSS variables into portaled admin chrome

### Problem

P76-D fixed half of this. Mantine emits the chrome's colour variables as `.mullion-admin-chrome[data-mantine-color-scheme="…"]`, and P76-D's `adminChromeAttributes()` put that attribute on the parts that already carried the class — which makes the variables resolve **in a light-DOM mount**. In a **shadow mount they still do not**, and shadow is the shipped path (`main.tsx:30`: `useShadowDom = windowFlag ?? query.get('shadow') !== '0'`, i.e. default on).

The reason is structural, and P76-D confirmed it in a browser rather than deriving it: the `<style>` carrying those rules renders inside the React tree, which lives in the shadow root, while Mantine's `Portal` (`Portal.mjs:17-32`, `reuseTargetNode` default `true`) appends its target to `document.body`. A `<style>` inside a shadow root only styles that shadow tree. Rules and elements end up in different trees. The same split hits `ThemeContext`'s `--mullion-color-*`, which are injected at `:host`.

Measured exposure, from P76-D's paint fingerprint of the first 400 elements inside the Drawer: the light-DOM panel renders **58** distinct `background/color/border/outline/fill` combinations, the shadow panel **55**. The primary palette is unaffected in both, because `adaptTheme`'s per-component `styles` travel through React context and cross portals. What is missing is the variable-driven surfaces, `--mantine-color-body` (`#0d1c24`) among them.

**This is not hypothetical debt — the codebase has already paid for it once.** `src/styles/builder.css` themes Dockview through **22** `--mullion-builder-*` custom properties. Those cannot reach it across the portal, so `LayoutBuilderModal` computes them via `useBuilderShellColors` (a hook deriving 14 colours) and writes them as **inline styles** on a div inside the Modal. That entire apparatus — hook, derived palette, inline style object, and a CSS file of `--dv-*` mappings — exists solely to smuggle theme values across this boundary. The next third-party component themed by CSS variables (an editor, a chart library, a date picker) needs its own copy unless this is solved generically.

### Fix

Take the plan-of-record's **option (b)** — inline the chrome's CSS variables onto the Drawer/Modal parts via the styles API. Inline styles travel with the element wherever it is portaled, so one mechanism covers both mount modes.

P76-D's framing of this option said it means "either reproducing [Mantine's variable generation] or limiting it to the `--mullion-color-*` block". **That is not the case** — Mantine exports the machinery publicly:

```ts
import { defaultCssVariablesResolver, mergeMantineTheme, DEFAULT_THEME } from '@mantine/core';
// defaultCssVariablesResolver(theme) → { variables, dark, light }, each Record<string,string>
```

so the block is `styles={{ content: { ...variables, ...dark } }}` with no reproduction. Add a `adminChromeStyles()` companion to `chromeTheme.ts` alongside `adminChromeClassNames()` / `adminChromeAttributes()`, returning `{}` in follow mode exactly as the other two do.

The one real implementation cost: `defaultCssVariablesResolver` wants a fully resolved `MantineTheme`, not the `MantineThemeOverride` we pass around, so it needs `mergeMantineTheme(DEFAULT_THEME, override)` (or a `useMantineTheme()` read from inside the nested provider). Memoize on the override identity — `getTheme` returns from a module-level `Map`, so that is stable.

Once this lands, consider whether `useBuilderShellColors` + the `--mullion-builder-*` inline bridge can be folded into the same mechanism. **Do not do that in this track** — it is a second, larger change and the Builder works today.

### Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | (b) inline the variables, (c) move the provider inside the portal, (d) portal into the shadow root, or (e) hoist the block to `document.head`? | **(b).** (c) is out: wrapping the Drawer's *children* leaves its header, title, close button, and overlay outside the provider, so locked chrome would render brand in the body and gallery in the header — a visible split worse than the bug. (e) is equivalent to (b) in cost but mutates `document.head` from a component, so it buys nothing and adds lifecycle and de-duplication concerns. (d) is deferred, see B. |
| B | Why not (d), which removes the boundary rather than working around it? | **Deferred, not rejected — filed as [FUTURE_TASKS.md](FUTURE_TASKS.md) "Portal Admin Chrome Into the Shadow Root" (2026-08-27).** Risk lands in someone else's environment. The Drawer portals to `document.body` specifically to escape the host page's stacking context; moving it inside the shadow root changes z-index behaviour against wp-admin and whatever plugins a customer has installed, plus focus trapping and click-outside. That is a support-ticket regression, not a CI one. (b) is also the pattern this codebase already uses successfully (the Builder bridge). Crucially (b) does not foreclose (d) — it makes it *easier*, by turning "get theme values onto portaled chrome" from one ad-hoc solution into one central one. Revisit (d) as its own project if the variable-consuming surface grows. |

### Acceptance criteria

- On the locked Settings Panel in a **shadow** mount, `getComputedStyle(drawerContent).getPropertyValue('--mantine-color-body')` resolves to the brand value (`#0d1c24` for `default-dark`), not `(unset)`.
- The paint fingerprint of the shadow panel matches the light-DOM panel — **58** distinct colour combinations in both, closing P76-D's measured 55-vs-58 gap.
- ~~Follow mode is untouched: `adminChromeStyles(true)` returns `{}`, and the chrome keeps inheriting the gallery root.~~ **Wrong — corrected 2026-08-27.** Inheriting the gallery root works in a light-DOM mount and yields nothing in a shadow one. Replaced by: follow mode inlines the *gallery* palette, and `adminChromeClassNames()` / `adminChromeAttributes()` keep returning `{}` there. See Implementation Notes.
- `LayoutBuilderModal` gets the same treatment and its Dockview shell is unchanged.

### Validation

- Re-run P76-D's probe methodology (four states: Settings Panel × toggle × shadow/`?shadow=0`), comparing variable resolution and the paint fingerprint before and after.
- ~~`npx playwright test theme-qa` — all baselines **byte-identical**.~~ **Superseded by the widened scope.** One baseline (`themed control — tight tolerance`) moved and was replaced deliberately, with the old and new inspected first; the other 19 are byte-identical. The six `display-settings-*` captures did *not* move, which is itself a finding — see Implementation Notes.
- Focused Vitest on `chromeTheme` — extend the existing "attributes and classNames cover exactly the same parts" guard to the third function so all three cannot drift.

### Implementation Notes (2026-08-27)

Landed option (b) as planned, then **widened the track mid-implementation** after verification found the plan's own scope was wrong. Both changes are below; the second was taken to the user rather than decided here, because it touched a snapshot baseline.

**The fix.** New `adminChromeStyles(applyThemeEverywhere, galleryThemeId)` in `chromeTheme.ts`, joining `adminChromeClassNames()` and `adminChromeAttributes()` and taking the same `(flag, galleryThemeId)` shape `resolveChromeThemeId()` already uses. It returns Mantine's resolved variable block — 371 properties — as an inline style for the Drawer/Modal `inner` and `content` parts. Inline styles travel with the element wherever it is portaled, so one mechanism covers both mount modes. Memoized in a module-level `Map` keyed by resolved theme id, so the 371-property object is built once per theme rather than per render.

**The plan's claim that this needs Mantine's generator reproduced was wrong**, as suspected at planning time and now confirmed: `defaultCssVariablesResolver(theme)` returns `{ variables, dark, light }` and is public API. The only real cost is that it wants a resolved `MantineTheme` rather than the override we pass around, hence `mergeMantineTheme(DEFAULT_THEME, entry.mantine)`. Only one of the `dark` / `light` blocks is merged — the nested provider runs `forceColorScheme`, so exactly one can ever apply, and emitting both would leave the winner to key order.

Both call sites already had a `styles` prop (`SettingsPanel` sets `body` plus the space-accent rail on `content`; `LayoutBuilderModal` sets `body` and `content`), so the chrome block is **merged into** those rather than replacing them.

#### The track's own acceptance criteria were wrong, and verification caught it

This track was written to fix **lock mode only**, on the reasoning that follow mode should inherit the gallery root — with an explicit criterion that "follow mode is untouched: `adminChromeStyles(true)` returns `{}`". That reasoning holds in a light-DOM mount and **fails in a shadow mount**, which is the shipped path, for precisely the reason lock mode failed: the gallery's own variables are injected at `:host` inside the shadow root, and the portaled chrome is outside it. Inheriting from a root you cannot see yields nothing.

Measured in a browser (Tokyo Night gallery, toggle **on**, shadow mount): `--mantine-color-body` and `--mantine-primary-color-filled` both `(unset)`, and the paint fingerprint at **51** distinct colour combinations against light-DOM's 58. Visually, `Cancel` and `Save Changes` rendered as bare text with no button surface at all, the number stepper lost its border and divider, and the switch knob and select chevrons were off-tone. Pre-existing, and shipped.

Taken to the user rather than decided here, because the fix implied replacing snapshot baselines and P76-F had just established byte-identical baselines as a pass condition. **Approved 2026-08-27: fix both modes as part of H.**

So `adminChromeStyles` now returns a value in both modes — the brand palette when locked, the gallery palette when following — while `adminChromeClassNames()` and `adminChromeAttributes()` still return `{}` in follow mode. That asymmetry is deliberate and a unit test asserts it, so nobody "fixes" the inconsistency later.

#### A prediction that was wrong, and what it means

I told the user this would recapture **six** `display-settings-*` baselines. **One** moved.

The six did not move because they run at `maxDiffPixelRatio: 0.1` — roughly 115 000 pixels of slack on a 1280×900 page. Restoring two button surfaces, a stepper border, and a divider does not come close. The only case that caught it was `themed control — tight tolerance`, the control-scoped zero-tolerance snapshot P76-D added, and the diff is exactly one thing: the select chevron moving from a Mantine fallback to the theme's own tone — matching what the unsealed mount already rendered. Baseline replaced deliberately; old and new inspected side by side first.

**This is the same tolerance blind spot P76-I documents, now demonstrated on a second, unrelated defect.** A real visual regression in the shipped configuration passed six whole-page snapshots untouched. That is worth more than the fix itself: it means the `display-settings-*` captures cannot be relied on to catch anything smaller than a palette swap, and the tight-tolerance pattern deserves extending rather than staying a single case. Recorded as a follow-on below rather than expanded here.

**Validation**

- Browser probe, all four states (Settings Panel × toggle × shadow / `?shadow=0`), before and after:

| State | `--mantine-color-body` before | after | distinct colours before → after |
|-------|------------------------------|-------|--------------------------------|
| shadow / locked | `(unset)` | **`#0d1c24`** (brand) | 55 → **59** |
| shadow / follow | `(unset)` | **`#1e212f`** (gallery) | 51 → **57** |
| light-DOM / locked | `#0d1c24` | `#0d1c24` | 58 → 58 |
| light-DOM / follow | `#1e212f` | `#1e212f` | 58 → 58 |

  Both shadow states now resolve the right palette; light-DOM is unchanged, as it should be — P76-D had already fixed it.
- Visual confirmation that the fixed shadow/follow panel matches the light-DOM rendering: buttons, stepper, and switch knob all restored.
- `npx playwright test theme-qa` — 20/20, one baseline deliberately replaced (above), the other 19 byte-identical.
- Focused Vitest on `chromeTheme` — 9 passed, including three new `adminChromeStyles` cases. Note the trap they had to avoid: `--mantine-color-body` is `var(--mantine-color-dark-7)` in *every* theme, so asserting on it proves nothing. The tests compare the resolved ramp literals instead. A first draft asserted on the indirection, passed vacuously in one direction and failed confusingly in the other.

**Follow-on this track surfaced**

- The `display-settings-*` snapshots are too loose to catch anything below a palette-level change — demonstrated twice now (P75-G/P76-I's `borderStrong`, and this track's button surfaces). Worth either tightening them or extending the control-scoped zero-tolerance pattern to more of the panel. Not done here: it is a test-strategy change, not part of this fix.


---

## Track P76-I - `borderStrong` is audited but never painted

### Problem

The theme engine does real work to guarantee WCAG 1.4.11 (non-text contrast, 3:1) on form controls, and none of it reaches a pixel.

- `colorGen.ts:383` derives `borderStrong` for the 22 of 24 themes that do not author one, with a comment stating the derivation must satisfy the audit.
- `uiContrastAudit.ts` runs **three** `borderStrong` checks — on `surface`, `surface2`, and `surfaceRaised` — labelled "input outline, checkbox, switch".
- `cssVariables.ts:62` emits `--mullion-color-border-strong`.
- `adapter.ts` sets `borderColor: rc.borderStrong` on Input / Select / TextInput / NumberInput / Checkbox / Switch — **nine sites**.

Measured in a browser during P76-D, on the `default-dark` Settings Panel: those elements compute `border-style: none` and `border-width: 0px`, with `border-color` correctly carrying the token. `outline-style` is `none` too. The colour is declared and never drawn. Contrast the same file's eight `border: 1px solid ${rc.border}` declarations on containers, which do paint.

The consequence is that the control's only visual boundary is its fill, and that boundary is nowhere near 3:1. Across all 23 registered themes:

| Boundary | Range |
|----------|-------|
| control fill (`surface2`) vs panel (`surface`) — **what is painted** | **1.02 – 1.63 : 1** |
| `borderStrong` vs `surface` — **what is audited** | **3.18 – 4.92 : 1** |

So `uiContrastAudit` is green on every theme while the rendered boundary fails 1.4.11 on every theme. This is the same class of finding as P75-G's: a token measured against code that does not render it. P75-G's controlled revert of the dark `borderStrong` to the defective `#577577` produced byte-identical baselines, and re-running that experiment in P76-D against a **zero-tolerance** control-scoped snapshot still produced 20/20 passes — because no snapshot can catch a colour that never reaches a pixel.

**The borderless look is deliberate** — a minimalist design choice, confirmed 2026-08-27 — so this is not simply a bug to fix. What is not defensible is the current state, where a passing audit reports compliance the product does not have.

### Fix

Two separable pieces. **Do the first regardless; the second is a design decision.**

**I-1 — make the audit measure the rendered boundary.** No visual change, no design decision.

- Remove the nine inert `borderColor: rc.borderStrong` declarations from `adapter.ts`, or give them a width — whichever I-2 decides. Until then they are dead declarations that make the code read as though a border exists.
- Re-point `uiContrastAudit`'s three `borderStrong` checks at whatever actually delineates the control. Today that is `surface2` on `surface` / `surfaceRaised`.
- Expect the audit to **go red on all 23 themes** at 1.02–1.63:1. That is the point: the gate should reflect reality. Land it with whatever I-2 chooses, or land it with a documented, explicitly-approved threshold exception so the number is visible rather than hidden.
- Keep `deriveBorderStrong` and the `--mullion-color-border-strong` variable if I-2 keeps the token; delete them if it does not.

**I-2 — decide the boundary.** Options, in order of how much they preserve the current look:

- **(a) Accept and document.** Keep borderless, record the 1.4.11 position explicitly, and stop asserting compliance. Cheapest; leaves the gap.
- **(b) `prefers-contrast: more` opt-in.** Default stays minimal; users who ask their OS for more contrast get the compliant border. Not strict conformance — WCAG is assessed on the default presentation — but a real improvement for the people affected.
- **(c) Scope the border to admin chrome.** Settings Panel and Layout Builder are dense operator tools where boundaries earn their keep; the public gallery stays borderless as the brand surface. Caveat: the login and auth-bar forms live in the gallery and would stay non-compliant.
- **(d) Paint it everywhere.** Add `borderWidth: 1, borderStyle: 'solid'` at the nine sites. Reaches 3.18–4.92:1 on every theme with the colours the engine already derives. Rendered comparison captured 2026-08-27 (`default-dark` Settings Panel, before/after) shows a thin definition line rather than a boxy form — subtler than the description suggests, but a real change to every control in 24 themes.

**Ruled out: raising `surface2` contrast to 3:1.** Going from ~1.1:1 to 3:1 on the control fill turns the fields into obvious blocks — a far larger visual change than a hairline, and the *least* minimal option available. It is the intuitive answer and it is the wrong one.

### Correction to this track's premise (2026-08-27)

**`borderStrong` is painted. This track's central claim was wrong, and so was the P75-G reading it inherited.** The error is worth recording in full, because the same trap is still sitting in the test fixture.

**What was actually wrong.** Every measurement behind "the token never reaches a pixel" — P76-D's browser probes, the 23-theme contrast sweep's interpretation, the before/after border screenshots — was taken with `applyThemeEverywhere: **true**`. That is what `theme-qa`'s `BASE_SETTINGS` defaults to, and the probes were built by copying that fixture. Nobody ever measured the shipped default.

Measured properly, on the same `default-dark` Settings Panel:

| Mode | `--input-bd` | Rendered border |
|------|--------------|-----------------|
| `applyThemeEverywhere: false` — **the shipped default** | `#263944` | **`1px solid #648284`** — borderStrong, painted |
| `applyThemeEverywhere: true` | `(unset)` | `0px none` — nothing |

**The mechanism.** Mantine keys its per-variant input rules on an ancestor attribute:

```css
[data-mantine-color-scheme='dark'] .…[data-variant='default'] { --input-bd: …; }
```

P76-D added `data-mantine-color-scheme` to the Drawer parts **in lock mode only**, on the same "follow mode inherits the gallery root" reasoning that P76-H later had to retract for the inline variables. With no ancestor carrying the attribute, `--input-bd` is never defined, Mantine's own `border: 1px solid var(--input-bd)` collapses to nothing, and the border disappears — taking `adapter.ts`'s `borderColor: rc.borderStrong` with it, since a colour with no width paints nothing. The adapter was never missing a width. Mantine supplies width and style; the adapter supplies the colour. That contract worked, and follow mode silently broke it.

**This also fully explains P75-G's puzzle**, which needed no tolerance theory at all. Reverting `default-dark`'s `borderStrong` to `#577577` left every baseline byte-identical because **every `theme-qa` snapshot is a follow-mode capture** — there was no border in any of them to change colour. The same is true of P76-D's re-run of that experiment against a zero-tolerance snapshot: that case also inherits `BASE_SETTINGS`, so it too was photographing a borderless control.

**Fixed as part of P76-H** (the same defect, the same cause): `adminChromeAttributes()` now applies in both modes, carrying whichever scheme the chrome resolves to. Both modes now render `1px solid #648284`. The `themed control — tight tolerance` baseline was replaced again to record the restored border — and once again the six `display-settings-*` captures did not move, which remains a real finding about their tolerance even though it is no longer the explanation for `borderStrong`.

### What survives the correction

Two of the three findings stand, and one is worse than first written:

1. **`borderStrong` on Switch is still unpainted.** `--input-bd` is `(unset)` on `.mantine-Switch-track` in both modes — the Switch does not use Mantine's input-variant block — so `borderColor: rc.borderStrong` there paints nothing. Narrower than "nine sites", still real.
2. **The audit measures the wrong token for focus, and the painted one fails.** `uiContrastAudit`'s three `primaryStroke` checks pass on all 23 themes. But the focus ring Mantine actually draws is `.mantine-focus-auto:focus-visible { outline: 2px solid var(--mantine-primary-color-filled) }` — **`primaryFill`, not `primaryStroke`**. The adapter's `&:focus { borderColor: stroke }` was the intended mechanism and it is overridden by that outline. Measured by tabbing through the panel: every button ring renders `2px solid #007870`, which is `primaryFill`.

   | | under 3:1 |
   |---|---|
   | `primaryFill` on `surface` — **what is painted** | **11 of 23 themes** |
   | `primaryStroke` on `surface` — what is audited | 0 of 23 |

   Worst case `darcula` at **1.08:1**; also failing: `default-dark` (2.95), `material-dark`, `nord`, `solarized-dark`, `catppuccin-mocha`, `tokyo-night`, `gruvbox-dark`, `cyberpunk`, `synthwave`, `halloween`. All dark themes. P75-E's entire point was that UI affordances use the contrast-selected `primaryStroke` rung; the focus ring never got wired to it.

3. **Text inputs and selects have no focus indicator at all — WCAG 2.4.7, and the most serious thing in this track.** Measured on the *same element*, resting versus focused (`document.activeElement` confirmed), in the shipped default mode:

   | | border | outline |
   |---|---|---|
   | resting | `1px rgb(100,130,132)` | `none` |
   | **focused** | `1px rgb(100,130,132)` | `none` |

   Byte-identical. A keyboard user tabbing into a text field gets no visual feedback whatsoever. The Switch fares little better — only the browser default `1px auto rgb(16,16,16)`, near-invisible on a dark panel. Buttons are fine (`2px solid`, the `mantine-focus-auto` ring).

   **Suspected mechanism, not yet confirmed:** `adapter.ts` expresses focus as `styles: () => ({ input: { '&:focus': { borderColor: stroke } } })`. Mantine's `styles` prop emits **inline styles**, and an inline style cannot carry a pseudo-class. If that is right, every `&:focus`, `&:checked`, and `&::placeholder` in `adapter.ts` is being silently dropped — which would make this a much wider defect than the focus ring alone. Confirming that, and auditing every pseudo-selector in the adapter, is the first thing I-1 should do.

### Revised scope

**I-1** is no longer "re-point the `borderStrong` checks". It is: make `uiContrastAudit` measure the tokens the product actually paints — `primaryFill` for the focus ring, and `borderStrong` only where a width exists. **Expect it to go red on 11 of 23 themes.** That is the finding, not a regression.

**I-2** is no longer "should form controls have borders at all". They do, in the shipped default; the borderless appearance was the follow-mode bug, now fixed. The real question is narrower and more concrete:

- Point the focus ring at `primaryStroke` (restoring P75-E's intent), or raise `primaryFill`'s contrast, or accept 11 themes below 3:1?
- Give text inputs and selects a visible focus indicator — required regardless of the above, since they currently have none. If the pseudo-selector suspicion holds, the fix is structural (move those rules to `classNames` + CSS) rather than a token change, and it lands the `&:checked` / `&::placeholder` rules with it.
- Decide whether the Switch track should carry a real border.


### Interaction with the gallery's own border settings (checked 2026-08-27)

Raised during scoping: the public gallery already exposes border controls — does I conflict with them?

**No direct conflict — the surfaces are disjoint.** The settings registry carries `card_border_width` / `card_border_mode` / `card_border_color` / `show_card_border`, `tile_border_width` / `tile_border_color`, `image_border_radius`, `video_border_radius`, `nav_arrow_border_width`, and `show_viewer_border`. Every one targets gallery **content** — campaign cards, tiles, media, nav arrows, the viewer. P76-I's nine sites are Mantine **form controls** (Input / Select / TextInput / NumberInput / Checkbox / Switch). Nothing overlaps.

Confirmed `borderStrong` specifically is not reachable from any of them: a grep of `src/` and `packages/` finds it in `adapter.ts` only — the nine control sites plus `theme.other.colors.borderStrong` at line 540, which has **zero consumers**. Cards resolve their border from `cardBorderColor` / `campaign.borderColor`, never from the theme's border tokens. So the "never reaches a pixel" finding holds without qualification.

Three things the question did surface, all of which belong in this track:

**1. The design-language argument cuts the other way.** The gallery ships `show_card_border: true` with `card_border_width: 4` by default. The product is therefore *not* uniformly borderless — it is borderless for form controls and deliberately, prominently bordered for cards. That materially weakens "a 1px hairline on form controls breaks the minimalist language": the language already uses borders where they carry meaning, at four times the width under discussion. Input for **I-2**, not a decision.

**2. I-1's guarantee has a hard ceiling, and the track must say so.** `uiContrastAudit` operates on **theme tokens**. `card_border_color` is an arbitrary user hex (`sanitize_hex_color`, default `#1ad1c4`) and `card_border_width` is user-set. A site owner can configure a card border at any contrast against any surface and no theme-level audit can see it. So I-1 can honestly claim contrast for *theme-derived* chrome only. Do not let the corrected audit imply more than that.

**3. That ceiling is itself a candidate for follow-on work.** Guaranteeing contrast on user-chosen colours means a runtime check where the colour is chosen — a contrast warning beside the colour picker in the settings UI, in the same spirit as the existing `uiContrastAudit` but at configure time rather than build time. Deliberately **out of scope here**: it is a settings-UX feature, not a theme-engine correction, and it should not gate I-1's much simpler fix. Worth a FUTURE_TASKS entry if I-2 lands on any option that treats 3:1 as a real product commitment.


### Acceptance criteria

- `uiContrastAudit` measures a boundary the product actually renders. No check references a colour with no painted surface.
- The audit's scope is stated where a reader will see it: it covers theme-derived chrome, **not** user-configured gallery borders (`card_border_color` is a free hex), so it must not read as a blanket 3:1 guarantee.
- `adapter.ts` contains no declaration that sets a border colour without a border.
- Whatever I-2 chooses is recorded here with its rationale, including if the answer is "accept the gap".
- If I-2 picks (c) or (d): the `theme-qa` baselines are recaptured **deliberately**, noted as intentional in this document. This is the one place in Phase 76 where a baseline recapture is not a failure signal — contrast P76-F's Key Decision I, where it was.
- A regression test that would fail if the boundary silently loses contrast again — which, unlike P75-G's and P76-D's attempts, requires the boundary to be painted first.

### Validation

- Re-run the contrast sweep across all 23 themes and record the after values, as the table above records the before.
- `npx vitest run uiContrastAudit` — the audit's own suite, against the corrected checks.
- If a border is painted: `npx playwright test theme-qa`, with the diff reviewed rather than auto-accepted, plus the `themed control — tight tolerance` case P76-D added, which is scoped and zero-tolerance and will catch it.
- Re-run P75-G's controlled experiment as the real regression proof: revert `default-dark`'s `borderStrong` to `#577577` and confirm something now **fails**. That has been the intended check since P75-G and has never once been satisfiable.


### Implementation Notes — I-1 (2026-08-27)

**Status: I-1 landed. I-2 still open, and its shape changed again — see "What I-2 now decides" below.**

#### The suspicion was correct, and it was the root cause

I-1's first instruction was to confirm or refute the pseudo-selector suspicion before anything else. **Confirmed, at three levels.**

*Source.* `@mantine/core/esm/core/styles-api/use-styles/use-styles.mjs` resolves the `styles` prop through `getStyle()`, which spreads the result into React's `style` prop. Nested keys are only handled when a `stylesTransform` is registered — the `@mantine/emotion` escape hatch. A grep of `src/`, `packages/`, and `package.json` finds no `stylesTransform` and no `@mantine/emotion`. So nested keys are handed to the DOM as CSS property names and dropped.

*Rendered DOM.* Rendering real components through `getMantineTheme('default-dark')`:

```
INPUT    style attr => "background-color: rgb(19,42,54); border-color: rgb(100,130,132); color: rgb(238,248,251);"
CHECKBOX style attr => "border-color: rgb(100,130,132);"
SWITCH   track      => "border-color: rgb(100,130,132); background-color: rgb(19,42,54);"
```

Every flat property survives. `&::placeholder`, `&:focus`, `&:checked` are absent — not overridden, never emitted.

*Blast radius.* **18 nested blocks across 15 components**, every one inside `styles`, none anywhere else in the codebase:

| Selector | Count | Components |
|---|---|---|
| `&:focus` | 6 | Input, TextInput, PasswordInput, Select, NumberInput, ColorInput |
| `&:hover` | 6 | Tabs, Table, Menu, Select option, Anchor, Accordion |
| `&::placeholder` | 3 | Input, TextInput, PasswordInput |
| `&::before` | 1 | Notification |
| `&:checked` | 1 | Checkbox |
| `&[data-checked]` | 1 | Chip |

#### Why this destroyed the focus indicator rather than merely failing to add one

This is the part the plan did not anticipate, and it inverts the finding. Mantine ships a **working** focus indicator for inputs:

```css
.m_8fb7ebe7        { border: 1px solid var(--input-bd); }
.m_8fb7ebe7:focus  { outline: none; --input-bd: var(--input-bd-focus); }
```

Focus swaps a variable; the border follows. The adapter wrote `borderColor: rc.borderStrong` as a **flat** property, which became an inline style — and an inline style outranks that stylesheet rule. Measured in a real browser, pre-fix:

| | rendered `border-color` | `--input-bd` |
|---|---|---|
| resting | `rgb(100,130,132)` | `#263944` |
| focused | `rgb(100,130,132)` | **`#007870`** |

**The variable flipped correctly and the paint never moved.** So the adapter both suppressed Mantine's working indicator *and* its own replacement was silently dropped. Two failures, same line of code. WCAG 2.4.7 was failing because of an inline style, not a missing rule.

#### A measurement trap I walked into, and the correction

My first before/after comparison read computed style immediately after `.focus()` — and `.m_8fb7ebe7` carries `transition: border-color 100ms`. `getComputedStyle` returned the *start* of the transition, so the border appeared unchanged even after the fix worked. Every focus measurement in this track was re-taken with `transition: none !important` injected. Finding B survives the corrected method — pre-fix border is byte-identical resting vs focused with transitions off — but it very nearly became a second false premise on top of P76-D's. **Any state-change measurement in this codebase must disable transitions first.**

#### The fix

Move the input family from `styles` to `vars`. Mantine calls `useStyles({ name: ['Input', __staticSelector] })` for every input-family control, so a **single** `Input.vars` entry reaches Input / TextInput / PasswordInput / Select / NumberInput / ColorInput:

```ts
Input: {
  vars: () => ({
    wrapper: {
      '--input-bd': rc.borderStrong,
      '--input-bd-focus': stroke,
      '--input-bg': rc.surface2,
      '--input-color': rc.text,
      '--input-placeholder-color': rc.textMuted2,
    },
  }),
},
```

Placement is load-bearing: these go on the **wrapper**. Mantine's `:focus` rule redefines `--input-bd` on the input element itself, so an inline custom property on the input would outrank it and re-break focus in a way that looks correct in source.

Verified in a browser, transitions disabled — resting unchanged, focus now moves:

| | resting | focused |
|---|---|---|
| before | `1px solid rgb(100,130,132)` | `1px solid rgb(100,130,132)` |
| after | `1px solid rgb(100,130,132)` | **`1px solid rgb(0,142,133)`** |

`rgb(0,142,133)` is `#008e85` — `primaryStroke`, which is what `adapter.ts` always intended (`'&:focus': { borderColor: stroke }`). This restores the existing intent rather than choosing a new one, so it is not a decision taken on I-2's behalf.

The other **nine** dead blocks were deleted rather than repaired. Deletion is provably zero-visual-change — they never emitted anything — whereas *restoring* their intent would change appearance and is properly I-2's call. `fillHover` went with them: it existed only to serve the dead Anchor hover — and it turns out that was the right call for a second reason, since one-rung-lighter lowers contrast on every light theme.

**Intent lost to those deletions, for I-2 to decide on:**

| Component | Lost intent | What happens now |
|---|---|---|
| Anchor | `&:hover { color: fillHover }` | ~~No hover feedback on links.~~ **RETRACTED — see the I-2 notes.** Mantine's `Anchor` defaults to `underline="hover"`, so hover feedback works. Only the colour shift was lost, and restoring it would *reduce* contrast on 9 of 23 themes. |
| Table `tr` | `&:hover` row highlight | Mantine only highlights with `highlightOnHover`; likely no row hover at all. |
| Tabs, Menu, Accordion, Select option | themed hover backgrounds | Mantine's own defaults apply, reading adapter variables. Cosmetic drift only. |
| Checkbox | `&:checked` fill + border | Mantine's `--checkbox-color` still fills the box; the flat `borderColor` pins the border, so checked state is visible but the border does not follow. |
| Chip | `&[data-checked]` | Mantine's `--chip-bg` default applies; state still visible. |
| Notification | `&::before` accent bar | Mantine's `--notification-color` default applies. |

#### The tests were guarding the bug

Two existing assertions in `adapter.test.ts` had to be rewritten, and they explain how this survived a review:

```ts
expect(input?.styles?.().input?.['&:focus']?.borderColor).toBe(colors['primaryStroke']);   // GREEN
expect(checkbox?.styles?.().input?.['&:checked']?.backgroundColor).toBe(colors['primaryFill']); // GREEN
```

Both passed while the product had no focus indicator at all. They inspected the **config object**, never the mechanism that paints — so they could not have failed for the reason they claimed to test. This is the same failure mode as P75-G's byte-identical baselines and P76-D's `border-width: 0`: a green signal derived from something that never reached a pixel. Both now assert `vars` (the painted path) or a flat, painted consumer.

New guard: `adapter styles contain no nested selectors` walks every component of all 23 themes and fails on any nested key. Mutation-tested — injecting `'&:hover'` into `Checkbox.label` fails with `[ 'Checkbox.label → &:hover' ]`.

#### The audit correction

With the fix in place, `primaryStroke` and `borderStrong` **are** now painted, so the six original checks became legitimate rather than needing to be re-pointed. The real gap was the other focus ring, which was never audited at all:

```css
.mantine-focus-auto:focus-visible {
  outline: 2px solid var(--mantine-primary-color-filled);   /* primaryFill */
  outline-offset: 2px;
}
```

That governs Button, ActionIcon, Checkbox, Switch, Chip, and SegmentedControl. Because of the 2px offset the ring sits on the **container** surface, so it is checked against `surface` and `surfaceRaised` — not `surface2`, which is an input's own fill and where no outline ring is ever drawn (`outline: none` on focused inputs).

Sweep across all 23 themes with the corrected checks:

| Check | Themes under 3:1 |
|---|---|
| `primaryFill` on `surface` | **11** |
| `primaryFill` on `surfaceRaised` | **13** |
| `primaryStroke` on all three grounds | 0 |
| `borderStrong` on all three grounds | 0 |

**13 of 23 themes have at least one failure; every one is a dark theme.** Worst is `darcula` at **1.08:1** on both grounds. All 10 light themes pass comfortably (lowest 3.82). The 11-theme figure independently reproduces the number recorded before I-1, which is a useful cross-check given this track's history.

Rather than leave the gate red or silently relax it, every gap is itemised in `KNOWN_FOCUS_RING_GAPS` with its exact measured ratio. The gate still fails on a **new** failing theme/ground, and on an **existing** one getting worse. A companion suite fails if a listed entry stops failing, so the table cannot rot into documentation of a problem that was already fixed. The six input-border checks keep zero exceptions. Both behaviours mutation-tested.

This needs your explicit sign-off: the acceptance criteria allow "a documented, explicitly-approved threshold exception so the number is visible rather than hidden", and I have done the documenting but cannot approve it.

#### Scope ceiling, stated in the code

The audit header now says outright that it covers **theme-derived chrome only**. `card_border_color` is an arbitrary user hex and `card_border_width` is user-set, so no theme-level check can see them. The corrected audit must not read as a blanket 3:1 guarantee for a rendered page.

#### What I-2 now decides

1. **The focus ring token.** Inputs now use `primaryStroke` (clears 3:1 on all 23). Everything else uses Mantine's `primaryFill` ring (fails on 13). Options: re-point the global ring at `primaryStroke` for consistency and instant compliance; lift `primaryFill` on the 13 dark themes; or accept the gap on record. **Note this is no longer "which token is correct" — the product now uses two different tokens for the same affordance, which is its own inconsistency.**
2. **The Switch track.** Still `border-width: 0`, so its `borderStrong` declaration remains inert. Pinned by a deliberately-named test so either resolution is a conscious edit.
3. **The nine deleted intents**, above — two are real (Checkbox checked border, Table row hover); Anchor turned out not to be. See the I-2 notes.

#### Verification

- `npx vitest run` — **3925 passed** (was 3888; +37 from the new guards).
- `npx tsc --noEmit`, `npx eslint src packages e2e`, `npm run build` — all clean.
- `npx playwright test theme-qa` — **20/20, zero baseline changes.** This is the load-bearing result for the deletions: nine blocks removed and the resting appearance is pixel-identical, which is what "they never painted" predicts.
- Browser probes for every focus claim, transitions disabled, before and after.
- Mutation tests on both new guards and on both branches of the gate's exception logic.
- **Not verified:** the deleted hover intents were not measured individually in a browser — the theme-qa result covers resting appearance, and hover/checked states have no snapshot coverage. The table above is reasoned from Mantine's stylesheet, not measured. Flagged rather than asserted.

Three e2e specs fail on a clean tree (`mantine8-runtime-qa` ×2, `accessibility` login modal). Confirmed pre-existing by stashing all I-1 changes and re-running at `13598e13` — identical failures. Filed in [FUTURE_TASKS.md](FUTURE_TASKS.md) rather than left as a note here, since a permanently-red e2e floor trains everyone to ignore failures.


### Implementation Notes — I-2 decision (2026-08-28)

**Decision: Option A — re-point Mantine's global focus ring at `primaryStroke`.** Options B (lift `primaryFill` on 13 dark themes) and C (accept the gap) are **dropped outright** and should not resurface. Option D (two-tone halo ring) is deferred to [FUTURE_TASKS.md](FUTURE_TASKS.md) § Accessibility as a *complementary layer on top of A*, not a competing choice.

Why A: `primaryStroke` already clears 3:1 on all 23 bundled themes (minimum **3.64** on `surface`, **3.01** on `surfaceRaised`); on **10 of 23 themes it is the same hex as `primaryFill`**, so those change not at all; it restores P75-E's stated intent; and it collapses the two-token split I-1 introduced, where inputs ring in `primaryStroke` and everything else in `primaryFill`. Once A lands, `KNOWN_FOCUS_RING_GAPS` should empty out and the gate return to zero exceptions — which removes the sign-off question I-1 raised rather than answering it.

#### A correction to I-1's findings, found by photographing them

The user asked for rendered examples of the three remaining gaps rather than reasoning from code. Doing that immediately falsified one of them.

**Anchor hover was never broken.** Mantine's `Anchor` ships `defaultProps = { underline: 'hover' }`, implemented as:

```css
.m_849cf0da:where([data-underline='hover']):hover { text-decoration: underline; }
```

Screenshots of the real component confirm it: no underline at rest, underline on hover. I-1 reported "no hover feedback on links" because a stylesheet grep for `anchor` never matched a rule keyed on `[data-underline]`. What the dead adapter rule actually cost was a *colour* shift layered on the underline — and restoring that naively would be harmful, because it used `primary[fillIndex - 1]` (one rung lighter), which **lowers** contrast on all 9 light themes (`default-light` 5.85 → 4.20). Recommendation: leave Anchor alone.

**Two gaps survive, both confirmed visually:**

| Gap | Confirmed behaviour | Fix |
|---|---|---|
| Checkbox checked border | Mantine's checked rule sets background *and* border from `--checkbox-color`; the adapter's inline style pins only the border, leaving a grey ring around the filled box. | Move the resting border to `classNames` + a CSS rule — the pattern already used for Tabs / Select option / SegmentedControl. Deleting the declaration outright is **not** an option: Mantine's base is `border: 1px solid transparent`, so unchecked boxes would lose their border entirely. |
| Table row hover | No hover at all — `highlightOnHover` is never set. | `Table.defaultProps = { highlightOnHover: true }` plus `vars: { '--table-hover-color': rc.surfaceRaised }`. Fully Mantine-native, no override. |

**A second thing photography caught:** restoring the Table rule's original intent would have looked like a no-op. It used `surface2` at 30% alpha, and on `default-dark` `surface` is `#102530` against `surface2` `#132a36` — three points apart, imperceptible even at full opacity. "Put the rule back" was the wrong instinct; the hover colour has to be chosen, and `surfaceRaised` is the legible token that already exists on every theme.

**Method note.** These renders were captured by temporarily adding real `Anchor` / `Checkbox` / `Table` components to the Display Settings drawer, screenshotting at 3× with transitions disabled, then reverting — the admin surfaces render no `Anchor` at all. The specimens were removed and the working tree verified clean. Twice now in this track, reading Mantine's CSS produced a confident wrong conclusion that a single screenshot overturned; **render it before reporting it.**


### Implementation Notes — I-2 implementation (2026-08-28)

**All three landed: Option A, the Checkbox checked border, and Table row hover.** Every claim below was measured in a browser, not read off a stylesheet.

#### Option A — and the delivery problem that nearly sank it

The token change itself is one declaration: override `outline-color` on Mantine's focus-ring selectors with `--mullion-color-primary-stroke`, leaving Mantine to own the ring's width, style and offset so a future geometry change still lands.

Two things had to be solved first, and a permanent test found both.

**1. Specificity.** Mantine's focus rules are not uniform. `.mantine-focus-auto:focus-visible` is (0,2,0), but the sibling-drawn rings — `.m_926b4011:focus-visible + .m_9307d992` for the Switch track — are (0,3,0). A like-for-like selector only *ties* those and loses on source order. The first run of the new test failed with exactly one entry, `sibling:mantine-Switch-track`, still painting `primaryFill`. Every selector now doubles its first class to sit one step clear of Mantine's.

**2. The rules never reached the chrome at all.** `main.tsx` loads `global.scss` into the document **only when `!useShadowDom`**; under the shipped shadow mount it goes into the shadow root via `shadowStyles.ts`. Mantine's `Portal` appends to `document.body`, so the Drawer renders outside that shadow root and none of our CSS applied to it. This is the same portal-escape class of defect as P76-H, in a different delivery channel.

Fixed by adding **`src/styles/chrome-portable.scss`** — imported unconditionally in `main.tsx` (so it is in the document, like Mantine's own stylesheet) *and* concatenated into `shadowStyles.ts` (so shadow content gets it too). Its header states the constraint: it leaks into the host WordPress page, so it must stay small and hold only Mantine class overrides — never element selectors or resets.

Verified by tabbing 45 stops through the real panel: **every painted ring is now `rgb(0, 142, 133)` (`primaryStroke`), none is `primaryFill`.**

The audit follows: the two `primaryFill` focus checks I-1 added are removed (they no longer describe anything painted), and **`KNOWN_FOCUS_RING_GAPS` is deleted entirely**. The gate is strict again with zero exceptions across all 23 themes — which retires I-1's request for a documented threshold exception rather than answering it.

#### The regression test is the real deliverable

`e2e/theme-qa.spec.ts` → `focus ring colour › no painted focus ring uses primaryFill` tabs the live panel and asserts on the **painted** result, not the stylesheet. That distinction is load-bearing: the override is a *list of selectors*, and a list can be incomplete. Several components (Switch, Checkbox, Chip, SegmentedControl) draw their ring on a sibling, so a component missing from the list keeps the old colour silently. The test caught the Switch immediately. It also asserts it found more than five rings, so it cannot pass by walking a panel with nothing focusable in it.

#### Checkbox and Table

| | Before | After |
|---|---|---|
| Checkbox unchecked | border `rgb(100,130,132)`, inline style | border `rgb(100,130,132)`, **no inline style** |
| Checkbox checked | border `rgb(100,130,132)` — grey ring | border + fill `rgb(0,120,112)` = `--checkbox-color` |
| Table row | rest and hover both transparent | rest transparent → hover `rgb(26,53,66)` = `surfaceRaised` |

The Checkbox colour moved to a `vars` entry (`--mullion-checkbox-bd`) consumed by a class rule, because deleting the declaration was not an option: Mantine's base is `border: 1px solid transparent`, so unchecked boxes would have lost their border entirely. The Table needed `defaultProps: { highlightOnHover: true }` plus `--table-hover-color`; `surfaceRaised` rather than the deleted rule's `surface2`, which sits three points from `surface` and is imperceptible.

**A measurement note.** The first checked-state reading came back as `rgba(0,120,112,0.576)` with border `rgb(42,124,120)` — values that sit exactly on the interpolation line from `borderStrong` to `--checkbox-color` at 57.6%. It was a transition captured mid-flight: `page.addStyleTag` injects into `document.head`, which the shadow root does not inherit, so the transition-disabling never applied to that element. Worth remembering — the same trap that corrupted I-1's first before/after read, in a new disguise.

#### A pre-existing defect this surfaced

Measuring which selectors reach `document.styleSheets` showed two `global.scss` rules have been dead for portaled chrome all along: `.mullion-mantine-select-option[data-selected]` and `.mullion-mantine-tabs-tab`. The select-option rule is the pointed one — its own comment says it exists *because* dropdowns portal, so the ancestor problem was spotted while the delivery problem beneath it was not, and the selected-option highlight has been falling back to Mantine's default. `theme-qa` has dropdown captures that pass; they baked the unstyled appearance in as correct. Filed in [FUTURE_TASKS.md](FUTURE_TASKS.md) rather than fixed here, because making dead styles live changes appearance and needs a deliberate baseline review.

#### Verification

- `npx vitest run` — **3913 passed** (3925 − 13 exception-table staleness tests + 1 new Table test).
- `npx tsc --noEmit`, `npx eslint src packages e2e`, `npm run build` — clean.
- `npx playwright test theme-qa` — **21/21, zero baseline changes.** Expected: snapshots capture resting state, and nothing about the resting appearance moved. Focus, hover and checked states are covered by the new assertions instead.
- Checkbox, table-row and focus-ring behaviour each measured in the running app against the real admin surfaces.


---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Adding a sixth reference locale | Out of scope — this phase restores the five we already ship. |
| Switching the coverage gate from "100% of frontend JSON" to "100% of the whole POT" | The current gate (`check-i18n-locales.mjs`) only asserts frontend JSON values. PHP-only admin strings are not in that count. Expanding the gate is useful and separate. |

## Implementation Notes

**P76-A, P76-E, P76-F, and P76-G landed; P76-D mostly done** — see their per-track notes above. P76-B and P76-C not started. P76-A/B/C came from the Phase 74 PR Review leftover list; P76-D–G were added from the [Phase 75 branch review](PHASE75_REPORT.md#branch-review-2026-08-25) on 2026-08-25.

Two durable lessons so far:

- **From A: this plan's estimate of catalog staleness was off by two orders of magnitude** (+7/−13 msgids, not ~150), because the `.po` files had been hand-maintained ahead of the `.pot` for weeks. Size an i18n harvest by diffing msgid sets, not by counting phases since the last regen.
- **From D: verify the fixture before believing the measurement.** The first browser probe "showed" the brand lock doing nothing — because the fixture had left the gallery on the default theme, so lock and follow were the same palette. The same fixture then produced a *second*, worse error: D concluded `borderStrong` was painted onto elements with `border-width: 0`, and P76-H had to retract that — every probe had inherited `BASE_SETTINGS`'s `applyThemeEverywhere: true`, the opposite of the shipped default, and follow mode was itself the bug. Re-deriving a wrong result from the same fixture is not confirmation. Vary the fixture, not just the probe.
- **From E and G: for a deletion, the decisive check is the *built artifact*, not the source grep.** E's proof that nothing read the bridge is that the freshly built `dist/` contains zero occurrences of any deleted alias in CSS *or* JS — which a source grep for `var(--…)` could not have established for a runtime-composed name. Both tracks also turned up one live reference the plan had not listed (E: `src/styles/README.md`; G: the tense of the `FUTURE_TASKS.md` precedent note), so re-run the reference sweep yourself before deleting.

## Outcome

**In progress.** P76-A, P76-E, P76-F, P76-G done. P76-D delivered its browser pass, the attribute fix, the missing default-state baseline, and the Lightbox correction; its two open decisions were taken on 2026-08-27 and became **P76-H** and **P76-I**. Remaining: B (15 strings), C (blocked on the WordPress.org account), H, I.

P76-I is the one to read first if picking this phase back up cold. It is not a styling nit: the contrast sweep says every one of the 23 themes renders its form controls with a **1.02–1.63:1** boundary while a green audit reports **3.18–4.92:1**, and the gap has now survived three separate attempts to catch it with a test (P75-G's revert, P76-D's zero-tolerance snapshot, P76-D's re-run of the revert). No test can catch it, because the audited colour is never drawn.

**Originally:** Planned. Phase 74 can close without this; catalogs are stale, runtime English is not. P76-C is a WordPress.org-upload blocker, not a Phase 74 merge blocker. P76-D–G are Phase 75 follow-ons and block nothing — D is unverified-acceptance-criteria cleanup, E and G are deletions, F is an a11y/UX fix to a toggle that already works.
