# Phase 76 - Post-rebrand catalogs: i18n harvest + WordPress.org contributor

**Status:** Planned — no code yet
**Created:** 2026-08-25
**Last updated:** 2026-08-25 (P76-C: WordPress.org `Contributors` handle)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P76-A | Run a real `wp i18n make-pot` harvest, `msgmerge` into the 5 reference locales, compile `.mo` / `.l10n.php` | Planned | Medium |
| P76-B | Translate every new or orphaned msgid across de_DE, es_ES, fr_FR, ru_RU, zh_CN so `npm run i18n:check:locales` is green again | Planned | Medium |
| P76-C | Replace `Contributors: wpsupergallery` in `readme.txt` with a live Mullion WordPress.org account — required before the first WP.org upload | Planned — blocked on the.org account existing | Small (code) / human gate |

---

## Rationale

1. **What triggered it.** Phase 74's P74-C renamed the text domain and the `languages/` filenames, but deliberately did **not** run `wp i18n make-pot`. A real harvest would have pulled in ~150 strings added since the last regen (2026-07-23) and would have changed the translated-string count, which that track's own acceptance criteria forbade. The 2026-08-25 P74 PR Review confirmed the catalogs are now the largest remaining identity leak in shipped plugin files: msgid `WP Super Gallery`, `https://github.com/rafprojects/wp-super-gallery`, stale `#: class-wpsg-*.php` / `#: wp-super-gallery.php` comments, and orphaned translations for strings P74 already rewrote in PHP/JSON source (plugin name, privacy exporter labels, shortcode notice, import copy, settings page title, glow-color placeholder, etc.). The same review left `Contributors: wpsupergallery` as an intentional keep (WordPress.org account slug, not a product identifier). That handle still has to change before the first WP.org upload — Plugin Check / wp.org ingest reject contributor slugs that are not real.org users, and shipping Mullion under `wpsupergallery` is the last listing-identity mismatch.
2. **Why it belongs together, and why not Phase 74 or 75.** Mixing a harvest into the rebrand branch would have buried identifier work in a large i18n diff and broken the locale-coverage gate mid-rename. Phase 75 is Freemius + color-system work; this phase is listing/catalog identity (gettext catalogs + the.org `Contributors` field) with a human.org-account gate that Phase 74 correctly refused to fake.
3. **Success.** `languages/mullion-gallery.pot` describes the current PHP/JSON source (Mullion name, `mullion-gallery` GitHub URI, `class-mullion-*.php` / `mullion-gallery.php` `#:` comments, every string `make-pot` can see). All 5 reference locales compile, and `npm run i18n:check:locales` reports complete coverage — the same 100% bar P74-C preserved by *not* harvesting. `readme.txt` `Contributors:` is a live WordPress.org username that belongs to this product, not `wpsupergallery`.

Runtime English is already Mullion: gettext only matches identical msgids, so the stale `WP Super Gallery` entries are dead keys, not live UI. This phase retires those dead keys and fills the real ones.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Harvest in Phase 74 vs. a dedicated follow-on | **Follow-on (this phase).** Confirmed in the P74 PR Review interview: do not mix ~150 pre-rename untranslated strings plus msgid/URI/`#:` churn into the rebrand branch. |
| B | One mechanical harvest track vs. harvest + translation in the same commit | **Two tracks.** P76-A is deterministic toolchain (pot + merge + compile). P76-B is the human translation pass that restores the coverage gate. Splitting them keeps a green compile even if translation lags a commit. |
| C | What to do with fuzzy/`#| msgid` leftovers after msgmerge | **Resolve in P76-B, do not ship fuzzies.** `i18n:check:locales` already treats fuzzy as untranslated. Identity strings (product name, URIs, "Mullion — …" labels) are mechanical token swaps, same as P74-B's six-string hand pass. The ~150 never-harvested feature strings need real translations. |
| D | Write a guessed `Contributors` slug vs. wait for a real.org account | **Wait for the account, then write that exact username.** Plugin Check and wp.org SVN ingest validate contributor slugs against live WordPress.org users. Committing `mullion` (or any other invented slug) before the account exists fails the listing. P74-B/Q were right to leave `wpsupergallery` rather than invent; P76-C is when the account is created (or renamed/transferred) and the field is updated. |
| E | Contributor handle vs. plugin slug | **Not necessarily the same string.** Plugin slug is already `mullion-gallery` (Phase 74 Decision C). The.org *user* can be `mullion`, `mulliongallery`, the existing account renamed, or whatever username we actually register. Confirm the live username at implementation time; do not bake a guess into this plan. |

## Execution Priority

1. **P76-A** first — without a current `.pot`, P76-B is translating against a stale template.
2. **P76-B** immediately after — the coverage gate will fail between A and B; do not merge A alone to `main` if CI runs `i18n:check:locales` on every PR (it does, via the existing i18n job). Land A+B as one PR, or land B in the same branch before the PR is reviewable.
3. **P76-C** is independent of A/B (no i18n coupling) but is a **release gate**: it must land before the first WordPress.org upload (`svn-deploy.yml` / [GO_LIVE_PUNCH_LIST.md](guides/GO_LIVE_PUNCH_LIST.md)). The.org account can be created in parallel with A/B; the `readme.txt` edit waits on that account.

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

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Adding a sixth reference locale | Out of scope — this phase restores the five we already ship. |
| Switching the coverage gate from "100% of frontend JSON" to "100% of the whole POT" | The current gate (`check-i18n-locales.mjs`) only asserts frontend JSON values. PHP-only admin strings are not in that count. Expanding the gate is useful and separate. |

## Implementation Notes

Not started. This document is the plan produced from the Phase 74 PR Review leftover list.

## Outcome

**Planned.** Phase 74 can close without this; catalogs are stale, runtime English is not. P76-C is a WordPress.org-upload blocker, not a Phase 74 merge blocker.
