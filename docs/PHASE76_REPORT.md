# Phase 76 - i18n catalog harvest after the Mullion rebrand

**Status:** Planned — no code yet
**Created:** 2026-08-25
**Last updated:** 2026-08-25

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P76-A | Run a real `wp i18n make-pot` harvest, `msgmerge` into the 5 reference locales, compile `.mo` / `.l10n.php` | Planned | Medium |
| P76-B | Translate every new or orphaned msgid across de_DE, es_ES, fr_FR, ru_RU, zh_CN so `npm run i18n:check:locales` is green again | Planned | Medium |

---

## Rationale

1. **What triggered it.** Phase 74's P74-C renamed the text domain and the `languages/` filenames, but deliberately did **not** run `wp i18n make-pot`. A real harvest would have pulled in ~150 strings added since the last regen (2026-07-23) and would have changed the translated-string count, which that track's own acceptance criteria forbade. The 2026-08-25 P74 PR Review confirmed the catalogs are now the largest remaining identity leak in shipped plugin files: msgid `WP Super Gallery`, `https://github.com/rafprojects/wp-super-gallery`, stale `#: class-wpsg-*.php` / `#: wp-super-gallery.php` comments, and orphaned translations for strings P74 already rewrote in PHP/JSON source (plugin name, privacy exporter labels, shortcode notice, import copy, settings page title, glow-color placeholder, etc.).
2. **Why it belongs together, and why not Phase 74 or 75.** Mixing a harvest into the rebrand branch would have buried identifier work in a large i18n diff and broken the locale-coverage gate mid-rename. Phase 75 is Freemius + color-system work; this is a catalog-maintenance phase with its own toolchain (`make-pot` / `msgmerge` / `make-mo` / `make-php`) and a different reviewer surface (translators, not Freemius/theme).
3. **Success.** `languages/mullion-gallery.pot` describes the current PHP/JSON source (Mullion name, `mullion-gallery` GitHub URI, `class-mullion-*.php` / `mullion-gallery.php` `#:` comments, every string `make-pot` can see). All 5 reference locales compile, and `npm run i18n:check:locales` reports complete coverage — the same 100% bar P74-C preserved by *not* harvesting.

Runtime English is already Mullion: gettext only matches identical msgids, so the stale `WP Super Gallery` entries are dead keys, not live UI. This phase retires those dead keys and fills the real ones.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Harvest in Phase 74 vs. a dedicated follow-on | **Follow-on (this phase).** Confirmed in the P74 PR Review interview: do not mix ~150 pre-rename untranslated strings plus msgid/URI/`#:` churn into the rebrand branch. |
| B | One mechanical harvest track vs. harvest + translation in the same commit | **Two tracks.** P76-A is deterministic toolchain (pot + merge + compile). P76-B is the human translation pass that restores the coverage gate. Splitting them keeps a green compile even if translation lags a commit. |
| C | What to do with fuzzy/`#| msgid` leftovers after msgmerge | **Resolve in P76-B, do not ship fuzzies.** `i18n:check:locales` already treats fuzzy as untranslated. Identity strings (product name, URIs, "Mullion — …" labels) are mechanical token swaps, same as P74-B's six-string hand pass. The ~150 never-harvested feature strings need real translations. |

## Execution Priority

1. **P76-A** first — without a current `.pot`, P76-B is translating against a stale template.
2. **P76-B** immediately after — the coverage gate will fail between A and B; do not merge A alone to `main` if CI runs `i18n:check:locales` on every PR (it does, via the existing i18n job). Land A+B as one PR, or land B in the same branch before the PR is reviewable.

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

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Adding a sixth reference locale | Out of scope — this phase restores the five we already ship. |
| Switching the coverage gate from "100% of frontend JSON" to "100% of the whole POT" | The current gate (`check-i18n-locales.mjs`) only asserts frontend JSON values. PHP-only admin strings are not in that count. Expanding the gate is useful and separate. |

## Implementation Notes

Not started. This document is the plan produced from the Phase 74 PR Review leftover list.

## Outcome

**Planned.** Phase 74 can close without this; catalogs are stale, runtime English is not.
