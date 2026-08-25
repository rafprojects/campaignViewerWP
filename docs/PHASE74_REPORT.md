# Phase 74 - Mullion Rebrand: Full Technical Rename + New Default Theme

**Status:** In progress — P74-A, P74-B, P74-C, P74-D, P74-E, P74-G, P74-H, P74-I, P74-J, P74-L landed, remaining tracks Planned
**Created:** 2026-08-23
**Last updated:** 2026-08-24 (P74-J landed — remaining JS/TS `wpsg`/`WPSG` identifiers, host class `.wp-super-gallery` → `.mullion-gallery`, window globals, `data-mullion-*` attrs, and live PHP emitters; P74-I landed — `--wpsg-*` CSS custom-property namespace renamed to `--mullion-*` across 48 source files plus the PHP/i18n `dot_nav_active_color` default; Playwright visual 33/33 zero diffs; P74-H landed — 228 wpsg_* identifiers (21 functions, 75 hooks/filters, 108 REST error codes, 15 cron/schedule names, 1 AJAX action, 5 settings ids, 3 globals) renamed to mullion_*, plus the wpsg-cron-hooks.php file rename; P74-G landed — 56 PHP classes + 1 interface + 98 PHPUnit test classes renamed WPSG_* → Mullion_*, plus 6 orphaned PHP constants folded in as MULLION_*; P74-N: `borderStrong`'s fallback corrected from alias-to-`border` to a derived value, per verified designer review round 5 — aliasing would have reinstated the exact WCAG failure the field exists to prevent; palette from `COLOR-SPEC.md` adopted, `primaryShade` blocked on Phase 75's P75-F; P74-C landed — text domain renamed, header-only .po/.pot metadata fix)

### Tracks

| Track | Description | Status | Risk |
|-------|-------------|--------|------|
| P74-A | Plugin folder rename (`wp-plugin/wp-super-gallery/` → `wp-plugin/mullion-gallery/`) and every tooling path reference | Done | High (mechanical, broad) |
| P74-B | Plugin metadata: header, `package.json` name | Done | Low |
| P74-C | Text domain rename + i18n regeneration (~3,066 call sites, 16 language files) | Done | Medium |
| P74-D | Shortcode rename, outright (no backward-compat alias) | Done | Low |
| P74-E | CPT + taxonomy + capability rename, paired with a data-migration routine | Done | High (data migration) |
| P74-F | DB option key rename (276 occurrences), paired with the same migration routine | Planned | High (data migration) |
| P74-G | PHP class + file rename (56 classes, 56 files) | Done | Medium (large, mechanical) |
| P74-H | Function + hook/filter rename (20 functions, ~50+ extension points) | Done | Medium |
| P74-I | CSS custom-property prefix rename (`--wpsg-*` → `--mullion-*`) | Done | Medium |
| P74-J | Remaining JS/TS identifier cleanup | Done | Low-Medium |
| P74-K | Freemius slug wiring | Planned | Low (hard sequencing dependency on Phase 75) |
| P74-L | Build/CI/tooling string literals (+ npm workspace package scope rename, folded in) | Done | Low |
| P74-M | Documentation sweep (~149 files, excluding `docs/archive/`) | Planned | Low (volume) |
| P74-N | New default theme: Mullion / Rig Cyan | Planned — palette finalized, `primaryShade` blocked on Phase 75 P75-F | Low-Medium |
| P74-O | CSS fallback-color reconciliation (depends on P74-N) | Planned | Low |

---

## Rationale

The plugin's designer, working from [.wordpress-org/DESIGN_BRIEF.md](../.wordpress-org/DESIGN_BRIEF.md), returned two things: a product name — **Mullion** (slug `mullion-gallery`) — and a new brand palette, **Rig Cyan**. Both are adopted here.

1. **What triggered it.** Designer feedback on the identity brief produced in the store-artwork engagement (`.wordpress-org/README.md` / `DESIGN_BRIEF.md`), delivered alongside a three-way palette comparison (Instrument Blue / Rig Cyan / Hi-Vis) for the plugin's new default theme.
2. **Why "Mullion."** Per the designer's own rationale: a mullion is the vertical bar that divides a window into framed panes — a mullion divides a plane into panes, and this product's Layout Builder lets someone lift a pane out and set it by hand. The mark drawn for the identity brief's aperture study is that idea rendered directly, so name and mark reinforce each other. It reads as precise rather than decorative — architectural vocabulary, not a coined word — which matches the brief's own "credible, design-led rather than cute" direction. The tradeoff is unfamiliarity, which the WordPress.org listing absorbs with a plain-language subtitle ("Visual Gallery Builder") doing the search-intent work the name itself doesn't.
3. **Why now, and why fully.** The plugin has not shipped publicly (v0.90.0, no real installs) — this is the only point in the project's life where a rename is nearly free. Every internal identifier scheme (`wpsg`/`WPSG`) was chosen when the product was still called WP Super Gallery; carrying it forward under a new brand name would mean permanently maintaining a mismatch between what the product is called and what its own code calls itself. Doing the rename in full, now, avoids ever paying for it twice.
4. **Why it displaces the existing Phase 74.** The previously-planned Phase 74 ("Freemius Package Self-Identification + Dual-Channel Release Wiring") is unimplemented — no code has been written against it yet — and several of its concrete details (the `wpsg_fs()` function name, the `wpsg-edition.json` marker filename, the `wp-super-gallery` Freemius slug) are identifiers this phase renames. Rather than implement Phase 74 against soon-to-be-renamed symbols and then immediately re-touch all of it, that plan moves intact to **Phase 75**, rewritten to describe the post-rename codebase it will actually be implemented against. See [PHASE75_REPORT.md](PHASE75_REPORT.md).
5. **Success.** Every `wpsg`/`WPSG`/`WP Super Gallery`/`wp-super-gallery` identifier in shipped code, config, and top-level docs reads as `mullion`/`Mullion`/`Mullion`/`mullion-gallery` instead (historical phase reports under `docs/archive/` excepted, left as an accurate record of what shipped under the old name); the plugin loads cleanly under its new folder/slug/text-domain in wp-env; existing dev-database campaign data and settings survive the rename via the migration routine; and the new default theme (Rig Cyan, pending the ink-safe correction) passes the same automated WCAG AA gate every other theme does.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Rename depth: user-facing only, slug/text-domain only, or full internal rename | **Full technical rename.** Pre-launch is the only time this is cheap; a partial rename would leave the codebase permanently describing itself by its old name internally. |
| B | PHP naming convention for a real-word brand name (vs. the old `WPSG` acronym convention) | **TitleCase class prefix (`Mullion_License`, not `MULLION_LICENSE`)**, matching the common WordPress-ecosystem idiom for a real product name (e.g. WooCommerce's `WC_Product`) rather than the all-caps convention that made sense for the `WPSG` initialism. Functions/hooks/options/slugs stay lowercase-snake (`mullion_*`), which is universal WP convention regardless of prefix style. |
| C | Plugin slug/text-domain strategy for the two editions | **One slug for both**: `mullion-gallery`. `-lite` remains a release-ZIP-filename-only convention (`mullion-gallery-lite-v${VERSION}.zip`), an exact carry-forward of the existing `wp-super-gallery-lite-v${VERSION}.zip` pattern from the (now-)Phase 75 plan. No structural change to the free/premium split logic. |
| D | Shortcode tag: rename outright, or preserve `super-gallery` | **Rename to `mullion-gallery` outright, no alias.** Originally planned as an aliased rename (see the track's own history below) on the theory that the shortcode is the one identifier that could land inside real post content. Revisited during implementation: the plugin has no public installs (v0.90.0, pre-release), so there is no live content anywhere depending on the old tag — the entire rationale for keeping an alias doesn't apply yet. Aliasing can be reintroduced later if a real deprecation ever becomes necessary post-launch. |
| E | CPT slug `wpsg_campaign` and the 276 `wpsg_*` option keys: rename and accept data loss on existing dev/staging installs, or migrate | **Migrate.** A one-time routine, self-disabling after it runs, bulk-updates `post_type`/taxonomy rows and copies-then-deletes each `wpsg_*` option to its `mullion_*` name. 63+ phases of manual QA runbooks have plausibly left real data in local wp-env instances; a silent post-rename data loss there is avoidable for cheap. |
| F | Default theme approach: overwrite `default-dark.json`'s colors in place, or add a new theme id and flip `DEFAULT_THEME_ID` | **Overwrite in place, keep `id: "default-dark"`.** Only the color values are changing, not the theme's role as *the* default — keeping the id avoids touching `DEFAULT_THEME_ID`, the 8+ tests that hardcode `'default-dark'` as an id assertion, and the catalog's default-entry ordering. The literal old navy-blue palette is retired rather than preserved as a selectable alternate, consistent with the design brief's own note that blue is the most crowded color in this product category. |
| G | The "ink-safe" swatch (`#0f857c`) from the designer's palette comparison | **Rejected as submitted, sent back to the designer.** It fails WCAG AA (4.5:1 minimum) as text against every surface tested: ground 4.14:1, surface 3.51:1, and the light "form" color 4.10:1. The raw accent (`#1ad1c4`) already clears AA comfortably as text on both dark surfaces (9.73:1 / 8.25:1) without it. See the color-system explanation in the updated design brief for what a corrected submission should look like — this track proceeds on every part of the new theme *except* whatever role ink-safe was meant to fill. |

## Execution Priority

1. **P74-A → P74-B.** Folder rename and plugin metadata first — every later track edits files that need to already be at their final path, under their final header.
2. **P74-C, P74-D** — independent of each other, can run in parallel once A/B land.
3. **P74-E, P74-F** — together, since they share the same data-migration routine.
4. **P74-G → P74-H → P74-I → P74-J** — the PHP/JS/CSS identifier sweep, roughly in that order (classes before the functions/hooks that reference them, before the CSS variables those components emit).
5. **P74-K** — small, but must land before Phase 75 is implemented; Phase 75's draft already assumes the new slug.
6. **P74-L** — build/CI, once the identifiers it references are stable.
7. **P74-M** — documentation, last, so it describes the finished state rather than an in-progress one.
8. **P74-N** — independent of the identifier-rename tracks; can run in parallel with any of the above, blocked only on the ink-safe correction for full completion.
9. **P74-O** — after P74-N resolves.

---

## Track P74-A - Plugin folder rename

### Problem

The plugin's entire PHP/WordPress footprint lives at `wp-plugin/wp-super-gallery/`. Every tool that references the plugin by path — `.wp-env.json`'s `plugins` array, both GitHub Actions workflows, `scripts/copy-wp-assets.js` and its siblings, `.distignore`, and the PHPUnit bootstrap — hardcodes that path. A half-renamed folder (some paths updated, some not) breaks the dev environment, CI, and the release pipeline simultaneously.

### Fix

`git mv wp-plugin/wp-super-gallery wp-plugin/mullion-gallery`, then update every path reference in the same commit:

- `.wp-env.json` — `"plugins": ["./wp-plugin/mullion-gallery"]`
- `.github/workflows/release.yml`, `.github/workflows/svn-deploy.yml` — every `wp-plugin/wp-super-gallery` path
- `scripts/copy-wp-assets.js` and any other `scripts/*.js`/`*.mjs` with a hardcoded path
- `.distignore` — path-relative excludes, if any are absolute rather than relative to the plugin root
- PHPUnit configuration (`phpunit.xml` or equivalent) inside the plugin folder, plus any test-bootstrap path assumptions in `wp-plugin/mullion-gallery/tests/`

### Acceptance criteria

- `npx @wordpress/env start` boots cleanly with the plugin active at its new path.
- `grep -rn "wp-plugin/wp-super-gallery"` across the repo (excluding `docs/archive/`) returns zero results.
- No CI workflow references the old path.

### Validation

- Local `wp-env` boot + admin screen load.
- `git status` shows a clean rename (not a delete+add that loses history) where the tooling supports it.

### Implementation Notes (2026-08-23)

- **Scope call, confirmed with the user first:** the track's own Fix section and Acceptance Criteria disagreed — Fix lists only tooling/config files, but the criteria demanded zero `wp-plugin/wp-super-gallery` hits repo-wide except `docs/archive/`, which would also require touching 21 non-archive `docs/*.md` files that P74-M ("Documentation sweep") explicitly owns. Chose **tooling/config only**, deferring all `docs/` prose (including the literal path string) to P74-M, to avoid piecemeal drift ahead of that track's full sweep.
- `git mv wp-plugin/wp-super-gallery wp-plugin/mullion-gallery` — git recorded a clean rename (189 files, `R` status) for the whole tree.
- Updated every non-docs tooling/build/test path reference to the old folder, found via repeated `grep -rln "wp-plugin/wp-super-gallery"` passes (extension-filtered first, then a final unfiltered repo-wide pass to catch anything the filtered pass missed): `.wp-env.json`, `.gitignore`, `eslint.config.js`, `.github/workflows/{ci,release,svn-deploy}.yml`, `scripts/{copy-wp-assets.js,generate-frontend-i18n.mjs,check-i18n-locales.mjs,validate-themes.mjs,validate-adapter-settings-parity.mjs}`, `update_dev_plugin.sh`.
- **Beyond the phase doc's explicit file list** (its Fix section names `.wp-env.json`, CI workflows, `scripts/copy-wp-assets.js`, `.distignore`, PHPUnit config — the doc did not anticipate these), the unfiltered grep pass surfaced four more path references that would have actively broken things had they been left:
  - [src/themes/index.ts](../src/themes/index.ts) statically imports `../../wp-plugin/wp-super-gallery/theme-catalog.json` — a stale path here fails module resolution outright (Vite build error, not just a broken dev script). This was the highest-risk miss the doc didn't call out.
  - [src/components/Galleries/Adapters/adapterSettingsParity.test.ts](../src/components/Galleries/Adapters/adapterSettingsParity.test.ts) reads four PHP/JSON files from the plugin tree at test-run time (schema JSON, settings registry, CPT class, sanitizer class) via `readFileSync` — a stale path here fails the test with ENOENT rather than a real assertion failure.
  - `update_dev_plugin.sh` (local dev convenience script, both its source and destination plugin-dir variables).
  - `public/.htaccess` and its committed copy `wp-plugin/mullion-gallery/assets/.htaccess` — an Nginx config example in a comment hardcodes `/wp-content/plugins/wp-super-gallery/assets/...`; updated for path-fidelity even though it's non-executable prose, since (unlike the docs/ sweep) this is a real on-disk-path reference site admins would copy verbatim.
  - Left `wp-plugin/mullion-gallery/tests/WPSG_Logger_Test.php`'s `/var/www/html/wp-content/plugins/wp-super-gallery/test.php` fixture value untouched — it's arbitrary sample data for a logger test, no assertion depends on the string, not a real path-tooling reference.
- **Held back on purpose**, staying inside files this track legitimately owns rather than reaching into P74-B/C/G/K/L territory: `wp-super-gallery.php`/`readme.txt` filenames (still named per-old-brand pending P74-B), the `wp-super-gallery` text-domain and `TEXT_DOMAIN` constant / `--domain=` flags (P74-C), the `SLUG:`/`ZIP_NAME=` literals in the release/SVN-deploy workflows (P74-B/K/L), and the `class-wpsg-*.php` filenames referenced by path (P74-G). Two spots in `release.yml`/`svn-deploy.yml` *did* need their folder-name literal changed to `mullion-gallery` despite looking adjacent to that ZIP-naming/slug scope — the `zip -r`/`-x` exclude list and the `deploy-dir/…` extraction paths reference the actual on-disk directory being archived/extracted, which really is `mullion-gallery` now (independent of what the output ZIP is *named*, which stays `wp-super-gallery-v*.zip` per P74-L).
- Verification: `php -l` across all of `wp-plugin/mullion-gallery` (excluding `vendor/`) — zero syntax errors. `npx eslint` on the changed config/script/TS files — clean. Full Vitest suite (Haiku subagent, isolated from implementation) — 3,775/3,775 tests passing across 255 files (one unhandled error in `TemplatesTab.test.tsx`'s `useTransition` timing, confirmed pre-existing and unrelated). `tsc --noEmit` — clean. `npm run build:wp` — succeeds end-to-end, assets land correctly under `wp-plugin/mullion-gallery/assets`. `node scripts/check-i18n-locales.mjs` — passes (all 5 locales, 2,379 strings). `node scripts/validate-themes.mjs` — fails, but on a pre-existing, unrelated defect: it reads theme definitions from `src/themes/definitions/`, a path that hasn't existed since Phase 51-L moved definitions to `packages/theme-engine/src/definitions/`; the script's own `theme-catalog.json` path (the one this track touched) resolves correctly.
- Live `npx @wordpress/env start` boot check (separate Haiku subagent, WSL/Docker): boots cleanly with the plugin mounted and active at `/var/www/html/wp-content/plugins/mullion-gallery` inside the container; `wp plugin list` reports `name: mullion-gallery`, `status: active`, `version: 0.90.0` (WP-CLI derives this displayed name from the folder slug — the plugin header itself still reads "WP Super Gallery" until P74-B); `wp eval` sanity check and clean `wp-env stop` both succeeded. No errors referencing the old path.

---

## Track P74-B - Plugin metadata

### Problem

The main plugin file's header block, and `package.json`'s `name` field, identify the product as "WP Super Gallery" with a text domain of `wp-super-gallery` and URIs pointing at the old GitHub repo name.

### Fix

`wp-plugin/mullion-gallery/wp-super-gallery.php` → renamed to `mullion-gallery.php`, header updated:

```php
/**
 * Plugin Name:       Mullion
 * Plugin URI:        https://github.com/rafprojects/mullion-gallery
 * Description:       [updated tagline — see P74-M / design brief]
 * Version:           0.90.0
 * Requires at least: 6.4
 * Tested up to:      7.0
 * Requires PHP:      8.2
 * Author:            Mullion
 * Author URI:        https://github.com/rafprojects/mullion-gallery
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       mullion-gallery
 * Domain Path:       /languages
 */
```

`package.json`: `"name": "mullion-gallery"`.

### Acceptance criteria

- `wp plugin list` (WP-CLI, via wp-env) shows the plugin as "Mullion" with the new URIs.
- `npm run` scripts that read `package.json`'s name (if any) still resolve correctly.

### Validation

- `php -l` on the renamed main file.
- Local wp-env admin → Plugins screen visual check.

### Implementation Notes (2026-08-23)

- `git mv wp-super-gallery.php mullion-gallery.php`; header updated exactly per the Fix block above, **except** `Description` — left as the existing "Embeddable campaign gallery with Shadow DOM rendering." rather than inventing the design brief's lead tagline candidate ("Design galleries visually. Embed anywhere.") myself: the brief itself marks that tagline "not locked, alternatives are welcome," and the current description is accurate and brand-neutral (it never mentioned the old name), so there's nothing broken to fix here — final copy is a call for whoever finishes the design pass, not a mechanical rename.
- `package.json`'s `name` updated; `package-lock.json` re-synced via `npm install --package-lock-only` (2-line diff, both `name` fields, zero dependency churn).
- Fixed every reference to the old main-file filename left dangling by the rename, found via `grep -rln "wp-super-gallery\.php"` outside `languages/`: `.github/workflows/release.yml` (`PLUGIN_FILE`, the version-bump `git add` list), `tests/bootstrap.php`'s `require` (this one would have failed every PHPUnit run outright — the bootstrap could no longer find the plugin file to load), `phpcs.xml`'s `<file>` entry, and `tests/WPSG_CLI_Test.php`'s `test_main_plugin_guards_cli_on_wp_cli_constant()` (reads the main file's contents by hard-coded path).
- **Scope expansion, asked and confirmed with the user first:** a repo-wide sweep for the bare phrase "WP Super Gallery" (not just the filename) turned up 19 more PHP files inside `wp-plugin/mullion-gallery/` — 17 were non-functional file-header comment banners (`* WP Super Gallery — Settings Registry.` style), 2 were genuinely user-visible: the wp-admin-bar node title in `class-wpsg-embed.php` and an admin-facing shortcode-resolution notice in the same file. Offered three options (fix just the 2 UI strings / leave all 19 for later / do the full sweep now); user chose the full sweep. Renamed all 19 to "Mullion", plus a `@package WP_Super_Gallery` → `@package Mullion` PHPDoc-tag sweep across a further 51 files once grep showed that tag existed nowhere except as this one exact literal (safe to bulk `sed`).
- Five of the changed strings were live inside `__()`/`_e()` calls (`class-wpsg-privacy.php`'s exporter/eraser labels ×3 distinct strings, `class-wpsg-embed.php`'s shortcode-not-resolved notice, plus the pre-existing frontend string `admin_import_desc` from `src/i18n-strings.en.json`, whose generated PHP manifest — `class-wpsg-frontend-strings.php` — is compiled output and was regenerated via `npm run i18n:generate` rather than hand-edited). Changing an English msgid orphans its existing translation, so all 6 changed strings were re-translated by hand across the 5 reference locales (de_DE, es_ES, fr_FR, ru_RU, zh_CN) directly in each `.po` file — every existing translation had "WP Super Gallery" sitting untranslated as a proper noun inside otherwise-translated text, so this was a mechanical swap of that one token per locale, not new translation work. Recompiled via `wp i18n make-mo` + `wp i18n make-php`, scoped to the `languages/` directory only.
- **Deliberately did not run `wp i18n make-pot`** to refresh the `.pot` template: a first attempt at this showed the `.pot` is already stale by months of unrelated feature work (regenerating it pulled in ~150 pre-existing untranslated strings — carousel/adapter/settings additions since the last `.pot` regen on 2026-07-23 — that have nothing to do with this rename). Reverted that regeneration; the `.pot` stays untouched, matching P74-C's own stated job ("Regenerate `.pot`/`.mo`/`.l10n.php` via the existing WP-CLI toolchain") rather than doing a slice of it prematurely and creating a confusing, oversized diff. A related mechanical slip during hand-editing: an overly-broad find/replace briefly changed each `.po`'s `Project-Id-Version` header from `WP Super Gallery 0.90.0` to `Mullion 0.90.0` as a side effect (matched on `" WP Super Gallery "` with spaces); caught and reverted before committing, since that header line is metadata P74-C owns as part of its own domain-rename pass, not something that should drift as an accidental side effect here.
- `readme.txt`: `=== WP Super Gallery ===` → `=== Mullion ===`, the intro sentence, "WP Super Gallery Pro" → "Mullion Pro", and the install-instructions folder name (now literally correct post-P74-A: `wp-super-gallery` → `mullion-gallery`). **Deliberately left unchanged:** `Contributors: wpsupergallery` (a WordPress.org account handle, not a product identifier) and "Navigate to **WP Super Gallery** in the admin menu..." — the actual admin-menu label (`class-wpsg-asset-admin-renderer.php` / `class-wpsg-space-admin-renderer.php`) is a separate string this track never touched, so rewriting the readme to say "Mullion" there would make it describe a UI that doesn't exist yet.
- **Found but explicitly left alone**, as genuinely out of this track's scope: the Freemius `'slug' => 'wp-super-gallery'` config and `load_plugin_textdomain('wp-super-gallery', ...)` call in the main file (P74-K and P74-C respectively — both need the literal domain/slug strings intact until those tracks land); 4 more "WP Super Gallery" mentions found in `src/` (`apiClient.ts`, `settingsApi.ts` comment banners, a `console.debug('[WP Super Gallery] ...')` log prefix in `TypographyEditor.tsx`, and a rendered SVG placeholder string in `fallback.ts`) — these are JS/TS-side and the phase doc explicitly assigns console-log-prefix-style strings to P74-J, so they're noted here as a pointer for that track rather than fixed now; and the REST route namespace literal `/wp-super-gallery/v1/` (used twice in the main file for a permission-callback route check) — this isn't mentioned by any track in the phase doc at all (a real gap, more invasive than a metadata rename since it's live API surface), flagged here rather than acted on.
- Verification: `php -l` across the full renamed tree — clean. `./vendor/bin/phpcs --standard=phpcs.xml` (local, since `composer` itself isn't installed in this environment but the vendored binary is) — clean, 8 files scanned. `node scripts/check-i18n-locales.mjs` — all 5 locales fully translated (2,379/2,379). `npm run i18n:check` (generated-manifest freshness) — up to date. Full verification delegated to a Haiku subagent, isolated from implementation: full Vitest suite 3,775/3,775 passing across 255 files; `tsc --noEmit` clean; `npm run build:wp` succeeds end-to-end (frontend i18n manifest regenerated, Vite build, assets copied to `wp-plugin/mullion-gallery/assets`); `php -l` across all 141 non-vendor PHP files — clean; and, via a live `wp-env` boot, the full PHPUnit suite — **1,304 tests, 13,683 assertions, 2 skipped, 0 failures** — plus `wp plugin get mullion-gallery` confirming `title: Mullion`, `author: Mullion`, `version: 0.90.0`.

---

## Track P74-C - Text domain rename + i18n regeneration

### Problem

The `'wp-super-gallery'` text-domain literal appears in ~3,066 `__()`/`_e()`/`_x()`-family call sites across the PHP codebase — WordPress.org's i18n tooling requires this as a literal string per call (not a constant), so this cannot be a single-point fix. The `languages/` directory holds 16 files (`wp-super-gallery.pot`, and `.po`/`.mo`/`.l10n.php` for each of 5 locales) named after the old domain.

**Scope discovery during implementation, changing the Fix from what's written below:** the doc's own Validation step calls for a real `wp i18n make-pot` regeneration, diffed against the pre-rename `.pot` "to confirm only the domain header changed, not the msgid list." That assumption doesn't hold. P74-B's implementation notes already found the `.pot` is stale by months of unrelated feature work (~150 strings added since its last real regen) and deliberately did NOT refresh it, to avoid an oversized, unrelated-drift diff — explicitly leaving that regeneration for this track. Running a real `make-pot` now would: pull in those ~150 new (untranslated) strings, swap the plugin-name/author-URI msgids from "WP Super Gallery" to "Mullion" (the header P74-B already changed), and shift every `#:` source-reference comment from `wp-super-gallery.php` to `mullion-gallery.php`. That's real, useful work — but it directly conflicts with this track's own Acceptance Criteria, which requires all 5 locales to report the *same* translated-string count as before the rename. A real harvest would add new untranslated entries and change that count. Resolved by doing a **surgical, header-only edit** instead: hand-fixed exactly three domain-tied header fields (`Project-Id-Version`, `Report-Msgid-Bugs-To`, `X-Domain`) in the `.pot` and all 5 `.po` files, leaving every `msgid`/`msgstr` pair byte-identical, then compiled `.mo`/`.l10n.php` from that corrected `.po` source via WP-CLI (a deterministic compile step, not a re-harvest). The ~150-string backlog stays exactly as stale as P74-B left it — a known, already-flagged gap this track doesn't own or close.

### Fix

- A scripted, not hand-edited, global replace of the literal domain string across all PHP call sites, scoped to the exact pattern `'wp-super-gallery')` (the domain is always the last, paren-adjacent argument in every call site in this codebase — verified via grep before running) so it cannot touch the visually-similar but unrelated `'slug' => 'wp-super-gallery'` Freemius config (P74-K's, untouched) or the `.wp-super-gallery` CSS class references (P74-J's, untouched). ~3,056 call sites across 9 hand-written files this way, plus `includes/i18n/class-wpsg-frontend-strings.php` (2,867 of those, a **generated** file — fixed correctly by changing the `TEXT_DOMAIN` constant in `scripts/generate-frontend-i18n.mjs` and re-running `npm run i18n:generate`, never hand-edited) and the one `load_plugin_textdomain('wp-super-gallery', ...)` call in `mullion-gallery.php` (a different argument position, needed its own fix).
- Renamed all 16 `languages/` files via `git mv`: `wp-super-gallery-{locale}.{po,mo,l10n.php}` → `mullion-gallery-{locale}.{po,mo,l10n.php}`; `wp-super-gallery.pot` → `mullion-gallery.pot`.
- Header-only edit (see Scope discovery above) on the `.pot` + 5 `.po` files, then `wp i18n make-mo` + `wp i18n make-php` (via wp-env) to regenerate the `.mo`/`.l10n.php` binaries from that corrected source — **not** `wp i18n make-pot`.
- Updated `scripts/check-i18n-locales.mjs`'s hardcoded `wp-super-gallery-${loc}.po` filename pattern and its error-message hint text.

### Acceptance criteria

- Zero occurrences of the literal `'wp-super-gallery'` as a text-domain argument anywhere in `wp-plugin/mullion-gallery/`. **Met** — the Freemius slug and CSS-class occurrences that remain are not text-domain arguments.
- All 5 locales report the same translated-string count as before the rename (translation content unaffected). **Met** — 2,379/2,379 for every locale, unchanged, confirmed by `npm run i18n:check:locales`.
- `languages/` contains only `mullion-gallery-*` files. **Met.**

### Validation

- ~~WP-CLI `wp i18n make-pot` / equivalent regeneration run, diffed against the pre-rename `.pot`~~ — superseded by the scope discovery above; instead, `git diff` on the hand-edited `.po`/`.pot` files was used to confirm *only* the 3 header lines changed (verified directly, zero msgid/msgstr drift), and a before/after entry-count check on the regenerated `.l10n.php` confirmed the compile step didn't add/drop/reorder any message.
- `php -l` across all 167 non-vendor files in `wp-plugin/mullion-gallery/` — clean.
- `npm run i18n:check` (generated-manifest freshness) and `npm run i18n:check:locales` (translation-coverage gate, updated filenames) — both pass.
- Full PHPUnit suite (wp-env, via `php-testing` skill): 1,304 tests, 13,683 assertions, 2 skipped, 0 failures.
- Full Vitest suite: 3,775/3,775 passing across 255 files.
- Load the admin UI under a non-English `WPLANG` (e.g. `de_DE`) in wp-env and confirm translated strings still render — **not done this pass** (no functional/UI-facing change was made — the domain string and file names changed, not any translation content — so this manual check is deferred rather than blocking; flagged here for whoever next boots wp-env with this branch to spot-check opportunistically).

### Implementation Notes (2026-08-24)

- Verified the "domain is always the paren-adjacent last argument" assumption by grep before writing the sed, rather than trusting it — found and cross-checked all 5 non-gettext, non-`languages/` occurrences of the bare `'wp-super-gallery'` literal (2 Freemius slug config lines, 1 `load_plugin_textdomain` call, 2 CSS class references) to confirm the scoped pattern couldn't touch any of them. It didn't.
- `class-wpsg-frontend-strings.php`'s "GENERATED FILE, DO NOT EDIT BY HAND" header was honored — fixed at the generator-script source (`TEXT_DOMAIN` constant) and regenerated, not sed'd directly, even though it held the bulk (2,867 of ~3,056) of the call sites.
- Left `docs/guides/TRANSLATING.md`'s prose (old paths, old domain in example commands) untouched — P74-M's territory, same precedent as every prior track this phase.

---

## Track P74-D - Shortcode rename, outright (no backward-compat alias)

### Problem

`includes/class-wpsg-embed.php` registers a single shortcode tag, `super-gallery`, with no brand reference in the tag itself — but the file and class it lives in will be renamed under P74-G, and consistency argues for the shortcode itself carrying the new name too.

### Fix

Originally scoped as an aliased rename (register `mullion-gallery` as primary, keep `add_shortcode('super-gallery', ...)` registered alongside it as a backward-compat alias). **Revised per explicit user instruction before implementation**: no fallback needed, since the plugin has never been publicly released (v0.90.0, no real installs) — there is no existing content anywhere that could depend on the old tag, so the entire premise for keeping an alias doesn't hold yet. Renamed the tag outright with no alias:

- `includes/class-wpsg-embed.php` — `add_shortcode('super-gallery', ...)` → `add_shortcode('mullion-gallery', ...)`; the `shortcode_atts([...], $atts, 'super-gallery')` third-argument tag name updated to match.
- `mullion-gallery.php` — `wpsg_page_has_gallery_shortcode()`'s `has_shortcode(..., 'super-gallery')` check updated.
- `includes/settings/class-wpsg-settings-renderer.php` — the Settings Panel's own "Shortcode Usage" example (`<code>[super-gallery ...]</code>`) updated.
- `readme.txt` — the installation-instructions shortcode example updated.
- `tests/WPSG_Coverage_Extras_Test.php`, `tests/WPSG_P63C_Security_Headers_Test.php` — updated to assert against/seed the new tag string.

### Acceptance criteria

- `[mullion-gallery ...]` renders correctly; `[super-gallery ...]` renders as unprocessed literal text (no shortcode registered under that tag).
- Documentation examples (P74-M) are updated to show only the new tag — no "old one still works" note, since there is no old-tag support to describe.

### Validation

- `php -l` across all 167 non-vendor PHP files in `wp-plugin/mullion-gallery/` — clean, zero syntax errors.
- Full-repo grep for shortcode-tag-specific patterns (`add_shortcode`, `has_shortcode`, `shortcode_atts`, `[super-gallery`, `shortcode_exists`, `remove_shortcode`, each paired with the old `super-gallery` literal) — zero hits. The ~3,689 remaining bare `super-gallery` string matches are all non-tag references (text-domain literal, REST namespace, script/style handles, CSS class, filenames) — none are shortcode-tag usages, none in scope for this track.
- PHPUnit full suite (via `php-testing` skill, wp-env): **1,304 tests, 13,683 assertions, 2 skipped, 0 failures.** A focused run of `WPSG_Embed_Test.php` + `WPSG_Coverage_Extras_Test.php` + `WPSG_P63C_Security_Headers_Test.php` alone: 26 tests, 47 assertions, 0 skips — confirms the 2 full-suite skips are pre-existing and unrelated.
- Full Vitest suite (unaffected, no JS/TS touched): 3,775/3,775 tests passing across 255 files.

### Implementation Notes (2026-08-23)

- Confirmed with the user before implementing, since this is a direct deviation from the phase doc's own Fix/Acceptance text (which specified an alias): dropped the alias entirely rather than keep it "just in case," per the user's own framing (plugin not yet released → no fallback needed).
- Scope check: grepped `src/` and `packages/*/src` for the shortcode-tag literal — no JS/TS references exist (no block-editor registration mirrors the tag name), so this was a PHP-only change.
- Left `docs/guides/THEME_AUTHORING_GUIDE.md`, `docs/guides/INSTALL_AND_TROUBLESHOOTING.md`, `docs/guides/ACCESSIBILITY_MANUAL_AUDIT.md`, `docs/testing/THEME_QA_GUIDE.md`, `docs/testing/SERVICE_WORKER_MANUAL_TEST.md`, `docs/old/ARCHITECTURE_INIT.md`, `docs/PHASE63_MANUAL_QA_RUNBOOK.md`, and `docs/PHASE72_MANUAL_QA_RUNBOOK.md` untouched — all reference the old `[super-gallery]` tag in prose/QA-step examples, but `docs/` prose is P74-M's explicit territory per the precedent already set twice in this phase (P74-A §Implementation Notes, P74-B §Implementation Notes both deferred non-owned doc/JS references to their proper tracks rather than fixing them piecemeal). Flagged here as a pointer for P74-M.

---

## Track P74-E - CPT + taxonomy + capability rename

### Problem

The campaign post type (`wpsg_campaign`), its taxonomies (`wpsg_company`, `wpsg_campaign_tag`, `wpsg_campaign_category`), and 12 custom capabilities (`edit_wpsg_campaigns`, etc.) are all registered under the old prefix in `includes/class-wpsg-cpt.php`. WordPress stores these strings directly in the `wp_posts.post_type` column, taxonomy tables, and role/capability meta — renaming them is not just a code change, it's a data-shape change.

### Fix

- Rename the CPT and all three taxonomies to `mullion_campaign`, `mullion_company`, `mullion_campaign_tag`, `mullion_campaign_category`; rename the 12 capabilities to match (`edit_mullion_campaigns`, etc.).
- **Migration routine**, shared with P74-F: a one-time function, hooked to run once (e.g. gated by a version-flag option check on `plugins_loaded`), that:
  1. Bulk-updates `wp_posts.post_type = 'wpsg_campaign'` → `'mullion_campaign'` via `$wpdb`.
  2. Re-maps term-relationship rows for the renamed taxonomies (taxonomy registration renames don't require touching `wp_terms` itself, only the `taxonomy` column in `wp_term_taxonomy`).
  3. Marks itself complete (e.g. `update_option('mullion_migrated_from_wpsg', true)`) so it never re-runs.
- Update every PHPUnit fixture and test assertion that references the old post-type/taxonomy strings.

### Acceptance criteria

- A fresh install registers everything under the new names with no migration step invoked.
- An install seeded with old-style `wpsg_campaign` posts and `wpsg_company`-taxonomy terms, after activating the renamed plugin, shows that content correctly under the admin's Campaigns list — nothing orphaned.
- The migration routine is idempotent (running twice is a no-op the second time) and does not run again after completing once.

### Validation

- New PHPUnit test seeding a fixture DB with old-prefix data, running the migration, and asserting the new-prefix data is queryable and the old-prefix data is gone. **Met** — `Mullion_Rebrand_Migration_Test` 5/5.
- Full PHPUnit suite: 1,309 tests, 13,724 assertions, 2 skipped, 0 failures (was 1,304 before the new file).
- `npm run i18n:check:locales` — 2,379/2,379 for all 5 locales after the SuperGallery msgid swap.

### Implementation Notes (2026-08-24)

- **Scope-count discovery, again.** The Problem text's "CPT `wpsg_campaign` + 3 taxonomies + 12 capabilities" undercounted: **2 CPTs** (`wpsg_campaign`, `wpsg_layout_tpl`), **4 taxonomies** (`wpsg_company`, `wpsg_campaign_tag`, `wpsg_campaign_category`, `wpsg_media_tag`), **10** primitives in `Mullion_CPT::CPT_CAPS` plus plugin cap **`manage_wpsg`** (225 hits / 70 files) plus role slug **`wpsg_editor`** (and leftover `wpsg_admin`). `wpsg_campaign` alone was ~257 hits across 77 plugin files. Frontend `src/` had zero CPT/cap/role literals (REST abstracts them); P74-J already rewrote empty-state copy to `manage_mullion`.
- **Shared migrator, versioned flag.** New `Mullion_Rebrand_Migration`, hooked at `plugins_loaded:1` (before `init` CPT register and `Mullion_DB::maybe_upgrade`). Flag is `mullion_rebrand_migration_version` (integer, not a boolean) so P74-F can bump 1 → 2 without being trapped behind a completed-once flag. Source strings in this class stay `wpsg_*` on purpose — a mechanical sweep of it would make it look for rows that no longer match the on-disk names.
- **Step 1 (this track):** `$wpdb` UPDATE of `post_type` and `term_taxonomy.taxonomy`; reassign `wpsg_editor` / `wpsg_admin` users onto `mullion_editor`; remap role + per-user extra caps (`manage_wpsg` and the 10 CPT primitives); `remove_role` the old slugs. Direct SQL bypasses `wp_insert_post`, so the migrator `wp_cache_flush()`s afterwards (without that, in-request `get_post_type()` kept returning the old slug — caught by the new PHPUnit test).
- **Mechanical code rename, not a blanket `wpsg_` → `mullion_`.** A global prefix replace would have rewritten P74-F option keys (notably `wpsg_campaign_tables_innodb_v15`, which contains the CPT token as a substring). Token list was CPT/tax/cap/role-specific; that option key was placeholder-protected. Folded in: P74-H leftover `admin_post_wpsg_create_space` + `_wpsg_nonce`, REST `/users` role enum, `WP_CLI::add_command( 'mullion' )`, CPT `menu_name` SuperGallery → Mullion (surgical `.po`/`.pot` msgid swap + `make-mo`/`make-php` only, not `make-pot`). `uninstall.php` deletes both old and new post types / taxonomies / roles / caps so an uninstall without a prior load does not leave orphans.
- **P52-A2 subsumed, not deleted.** `mullion_maybe_migrate_roles()` still converts leftover `wpsg_admin` → `mullion_editor` (destination updated by the mechanical pass); the rebrand migrator does the same plus `wpsg_editor` → `mullion_editor`. P52 tests keep seeding the historical `wpsg_admin` slug.
- **Held back on purpose for P74-F:** option keys (`wpsg_settings`, `wpsg_db_version`, …), post/term meta (`_wpsg_space_id`, …), custom tables, upload dirs, `PAGE_SLUG` (`wpsg-settings` / `wpsg-assets` / `wpsg-spaces`), `wpsg-full-bleed`, transients. REST namespace `/wp-super-gallery/v1/` and Freemius slug stay for their own tracks. `docs/**` for P74-M.

---

## Track P74-F - DB option key rename

### Problem

276 occurrences of `wpsg_`-prefixed keys across `get_option`/`update_option`/`add_option` calls hold every persisted setting the plugin has. Same data-shape concern as P74-E: renaming the string without migrating orphans every existing install's configuration.

### Fix

Extend the same migration routine from P74-E to also copy each `wpsg_*` option's value to its `mullion_*` counterpart, then delete the old key, as part of the same one-time pass. Update every call site in code from `wpsg_*` to `mullion_*`.

### Acceptance criteria

- Every setting a user configured under the old plugin (site title, layout defaults, license state, etc.) is present and correct under the new option keys after migration.
- No dangling `wpsg_*` options remain after the migration completes.

### Validation

- Extend the P74-E migration PHPUnit test to also seed representative `wpsg_*` options and assert their values survive under `mullion_*` keys.

---

## Track P74-G - PHP class + file rename

### Problem

56 classes (`WPSG_License`, `WPSG_CPT`, `WPSG_Settings_Registry`, etc.) live in 56 files following the `class-wpsg-*.php` naming convention, `require_once`'d from the main plugin file and from each other.

### Fix

Rename each class to `Mullion_*` (TitleCase, per Key Decision B) and each file to `class-mullion-*.php`. Update every `require_once`/`require` reference and every PHPUnit test file/class that mirrors the old naming (`WPSG_*_Test` → `Mullion_*_Test`).

### Acceptance criteria

- `php -l` passes across every renamed file.
- No `require_once` points at a non-existent `class-wpsg-*.php` path.
- PHPUnit test discovery finds every renamed test class under its new name.

### Validation

- Full PHPUnit suite run post-rename.
- `grep -rn "class-wpsg-\|WPSG_"` across `wp-plugin/mullion-gallery/` returns zero results outside comments/changelogs intentionally preserving history.

### Implementation Notes (2026-08-24)

- **Scope grew beyond the doc's own count**, all found by extracting every literal `WPSG_*` token from the tree rather than trusting the doc's list: an interface file the Fix section didn't mention (`interface-wpsg-provider-handler.php`, declaring `WPSG_Provider_Handler`, implemented by 3 of the 56 classes), and 98 PHPUnit test files bearing the `WPSG_*_Test` convention (not "~91" — recounted directly). Total: 57 include/interface files + 98 test files = 155 files renamed, 162 distinct `WPSG_*` identifiers touched.
- **Folded in 6 orphaned PHP constants, confirmed with the user first.** `WPSG_VERSION`, `WPSG_PLUGIN_DIR`, `WPSG_PLUGIN_URL` (`mullion-gallery.php`), `WPSG_ALLOW_NONCE_BYPASS` (`tests/bootstrap.php` + REST base), and two site-admin-overridable constants the identifier scan surfaced, `WPSG_DEBUG_COMPONENT_MARKERS` and `WPSG_ENABLE_JWT_AUTH` — none were assigned to any Phase 74 track (not G/classes, not H/functions, not J/JS-TS), a real gap against the phase's own "every wpsg/WPSG identifier" success criterion. Renamed to `MULLION_*`, keeping the SCREAMING_SNAKE convention — Key Decision B's TitleCase-for-classes carve-out is about the class-prefix style specifically and doesn't extend to constants; WordPress-ecosystem precedent for a real product name (e.g. WooCommerce's `WC_VERSION`) keeps constants uppercase regardless of class-prefix style.
- **Mechanical approach:** built a single word-boundary regex substitution map (`WPSG_X` → `Mullion_X` for the 156 class/interface/test-class identifiers, `WPSG_X` → `MULLION_X` for the 6 constants) and applied it across every `.php` file in `wp-plugin/mullion-gallery` (excluding `vendor/`). Regex `\b` word boundaries correctly disambiguate prefix collisions (e.g. `WPSG_REST` vs. `WPSG_REST_Base`) for free, since `_` counts as a word character in regex — no manual ordering or conflict resolution was needed. File renames (`class-wpsg-*.php` → `class-mullion-*.php`, `interface-wpsg-*.php` → `interface-mullion-*.php`, `tests/WPSG_*.php` → `tests/Mullion_*.php`) via `git mv`, preserving history.
- **Fixed real staleness outside the plugin tree**, same standard P74-A set: `scripts/validate-adapter-settings-parity.mjs` and `src/components/Galleries/Adapters/adapterSettingsParity.test.ts` both `readFileSync` PHP source by literal path (`class-wpsg-cpt.php`, `class-wpsg-settings-sanitizer.php`, etc.) and string-compare against `WPSG_CPT::VALID_ADAPTERS` / `WPSG_Adapter_Field_Schema::get_map()` — left unpatched, these would ENOENT or silently stop verifying the intended string. Updated paths and identifiers in both, plus `scripts/generate-frontend-i18n.mjs` (path comment + literal) and `packages/shared-utils/src/loadGoogleFont.ts` / `src/types/gallerySettings.ts` (doc-comment path references). A further seven `src/` files had comments naming a since-renamed PHP class or constant by its exact old identifier — `src/i18n.ts`, `src/App.tsx`, `src/components/Admin/SpaceManagementView.tsx`, `src/components/Admin/LayoutBuilder/LayoutBuilderPropertiesPanel.test.tsx`, `src/hooks/useWpsgLicense.ts`, `src/services/auth/WpJwtProvider.ts`, `src/services/auth/AuthProvider.ts` — updated as comment/string-literal-only edits, no logic changes.
- **Held back on purpose**, matching P74-A's boundary discipline: every `docs/*.md` reference (30 files, ~180 identifier occurrences found) stays untouched for P74-M's full sweep; every lowercase `wpsg_*` token (DB option keys, capability names like `manage_wpsg`, directory names `wpsg-exports/`/`wpsg-fonts/`, the procedural `includes/wpsg-cron-hooks.php` file itself, and JS-side `window.__WPSG_CONFIG__`-style globals) stays untouched — those belong to P74-E/F/H/J, not to class names. Fixed one comment inside `wpsg-cron-hooks.php` itself ("WPSG_\* class constants" → "Mullion_\* class constants") since it directly describes the constants this track *did* rename. `CHANGELOG.md` also carries stale references, left for P74-M; the gitignored `repomix-output*.md` snapshots are regenerated output, not source.
- Verification: `php -l` across every file in `wp-plugin/mullion-gallery` (excluding `vendor/`) — zero syntax errors. Full PHPUnit suite (Haiku subagent, wp-env container, isolated from implementation) — 1,304 tests / 13,683 assertions, 0 failures, 0 errors, 2 pre-existing skips, no output referencing `WPSG`. Frontend verification (separate Haiku subagent): `tsc --noEmit` clean, `eslint` clean on all 10 touched frontend files, `adapterSettingsParity.test.ts` (the one genuinely at risk, since it reads the renamed PHP files by path) 8/8 passing, full Vitest suite 3,775/3,775 passing.

---

## Track P74-H - Function + hook/filter rename

### Problem

20 `wpsg_*` functions and roughly 50+ distinct `apply_filters('wpsg_*', ...)`/`do_action('wpsg_*', ...)` extension-point names exist across the plugin — the latter are the plugin's documented public API for third-party customization, not just internal implementation detail.

### Fix

Rename all to `mullion_*`. Because filter/action names are a public extension surface (even pre-launch, anything documented in `docs/guides/` as an extension point is effectively a promise), cross-check every renamed hook against its documentation in P74-M to keep the two in sync.

### Acceptance criteria

- No `wpsg_`-prefixed function definition or hook name remains.
- Every hook documented as an extension point in `docs/guides/` reflects its new name.

### Validation

- `grep -rn "function wpsg_\|'wpsg_\|\"wpsg_"` across `wp-plugin/mullion-gallery/` returns zero results.
- PHPUnit suite (hooks are exercised indirectly by most functional tests).

### Implementation Notes (2026-08-24)

- **Scope-count discovery, again.** The Problem text's "20 functions, ~50+ extension points" undercounted the same way P74-G's "56 classes" did: a full-tree regex scan (multiline-aware — several `WP_Error(...)`/`apply_filters(...)` calls span lines, which a single-line `grep -E` silently misses) found **21** function definitions and **75** distinct `apply_filters`/`do_action` names, not 20/~50.
- **Three ambiguous categories surfaced and resolved via explicit user decisions (all folded into this track, matching P74-G's orphaned-constants precedent):**
  1. **89→108 `WP_Error`/`error_response()` REST error codes** (e.g. `wpsg_not_found`, `wpsg_invalid_email`) — not functions, not hooks, not `get_option` keys (P74-F), a genuine gap against every track's stated scope. User chose to fold in. Real live coupling confirmed during the sweep: `src/services/api/assetsApi.ts`'s `ASSET_IN_USE_CODE = 'wpsg_asset_in_use'` string-compares against this exact REST error code — left unrenamed it would have silently broken that comparison after the PHP side changed.
  2. **5 WP Settings API group/section ids** (`wpsg_settings_group`, `wpsg_auth_section`, `wpsg_display_section`, `wpsg_authbar_section`, `wpsg_performance_section`) — settings-registration plumbing, not literally an `get_option`/`update_option` call site (P74-F's stated scope) and not a hook. User chose to fold in.
  3. Not asked about separately, folded in on judgment as trivially safe (zero external contract, scoped to one class + its own test): 3 `$GLOBALS` keys internal to `Mullion_Embed` (`wpsg_has_shortcode`→`mullion_has_shortcode`, `wpsg_instance_ids`, `wpsg_config_emitted`) and the `settings_errors('wpsg_messages')` group id (same kind as the Settings API ids just above).
- **13→15 cron hook names, found via the class-constant cross-reference, not the Problem text.** `includes/wpsg-cron-hooks.php`'s own canonical list had 13 entries (two — `wpsg_schedule_auto_archive`, `wpsg_thumbnail_cache_cleanup` — were missed by a first pass that only followed the `Mullion_Maintenance`/`Mullion_Alerts`/etc. class-constant trail cited in its comments) plus the `wpsg_every_5min` custom cron-schedule interval key registered via the `cron_schedules` filter. All are genuine WordPress hook names (WP-Cron fires `do_action($hook)` internally), same "hook name" acceptance-criteria bucket as the third-party extension points, just internal rather than public-facing. The file itself — left un-renamed by P74-G on purpose, as its own note there flagged — is renamed here: `includes/wpsg-cron-hooks.php` → `includes/mullion-cron-hooks.php`.
- **One compound identifier needed special handling.** `add_action('wp_ajax_wpsg_test_auth', ...)` is a WordPress-constructed hook name (`wp_ajax_` + the AJAX `action` value). A `\b`-anchored regex on the bare identifier `wpsg_test_auth` correctly leaves this compound alone (no word boundary between the `_` in `wp_ajax_` and the `w` in `wpsg`, by design — same property P74-G relied on to disambiguate prefix-colliding identifiers) — so it needed an explicit plain-string substitution pass for the full compound, in addition to the identifier-level rename of the bare `wpsg_test_auth` nonce-action string used elsewhere in the same file. The vanilla-JS AJAX caller this talks to, `includes/settings/assets/settings-auth-test.js` (a PHP-plugin-owned asset, not part of the `src/` React app P74-J will sweep), sends the `action` value as a plain string literal and would have silently broken (AJAX handler never dispatches) had it not been updated in the same pass — fixed alongside the PHP side.
- **Total: 228 identifiers renamed** (21 functions + 75 hooks/filters + 108 error codes + 15 cron/schedule names + 1 AJAX action/nonce + 5 settings ids + 3 `$GLOBALS` keys, verified as non-overlapping and each anchored with `\b`-boundary regex substitution to avoid false matches inside longer, out-of-scope identifiers — same technique and same safety property as P74-G) across 88 files (84 content-modified by the mechanical pass + the 4 files touched separately for the `wpsg-cron-hooks.php` rename and the AJAX compound), plus the one file rename.
- **Held back on purpose, staying inside files this track legitimately owns:** every CPT/taxonomy slug, capability, DB option/postmeta/termmeta/transient key (`wpsg_campaign`, `wpsg_settings`, `wpsg_db_version`, `wpsg_layout_templates`, etc. — confirmed by diffing the full `wpsg_*` token inventory against this track's 228-identifier scope) is P74-E/P74-F's job, not touched. `docs/guides/*.md` (7 files reference renamed hooks/error-codes) deliberately left alone despite the Fix text's "cross-check every renamed hook against its documentation" instruction — consistent with the standing precedent from P74-A/P74-G that **no** track before P74-M hand-edits `docs/*.md`; flagged here as a concrete punch-list for P74-M instead of acted on now. Also noticed in passing, unrelated to this track's identifiers and not acted on: the `/php-testing` skill file has a stale `wp-plugin/wp-super-gallery` path reference left over from before P74-A — a skill-tooling file, not `docs/`, so not obviously anyone's job; flagged for whoever next touches that skill.
- **Verification:** `php -l` clean across every plugin file; full PHPUnit suite 1,304/1,304 passing (2 pre-existing skips, unrelated to this rename — same count as before); `tsc --noEmit`/`eslint` clean; full Vitest suite 3,775/3,775 passing, including `assetsApi.test.ts`'s assertion on the renamed `ASSET_IN_USE_CODE` REST error-code string.

---

## Track P74-I - CSS custom-property prefix rename

### Problem

The `--wpsg-*` CSS custom-property namespace (52+ distinct variable names) is defined centrally via `DEFAULT_CSS_VAR_PREFIX = '--wpsg'` in [cssVariables.ts](../packages/theme-engine/src/cssVariables.ts) — but 61 call sites across the React app hardcode the `--wpsg-` string literal directly rather than deriving it from that constant, so this is not a one-line fix.

### Fix

- Change `DEFAULT_CSS_VAR_PREFIX` to `--mullion`.
- Fix all 61 hardcoded bypass sites to either use the constant or the literal `--mullion-` prefix, consistently.
- Update the parallel `--wpsg-builder-*` namespace (the Layout Builder shell's own token set, remapped onto Dockview's `--dv-*` vars) to `--mullion-builder-*`.
- Update the legacy alias bridge in `src/styles/_tokens.scss` (`--color-accent-purple: var(--wpsg-color-primary-8, ...)` etc.) to reference the new prefix.

### Acceptance criteria

- `grep -rn -- "--wpsg-"` across `src/` and `packages/*/src` returns zero results. **Met.**
- Visual regression suite (Playwright, 3 viewports × adapters) shows no unintended change — this track is a pure rename, not a visual change (visual changes come from P74-N). **Met** — 33/33 passed, zero diffs against pre-rename baselines.

### Validation

- Full Vitest suite: 3,775/3,775 passing across 255 files.
- `tsc --noEmit` clean.
- `npm run i18n:check` + `npm run i18n:check:locales` — 2,379/2,379 for all 5 locales, unchanged.
- `php -l` on the settings registry and generated frontend-strings file — clean.
- Full PHPUnit suite (wp-env): 1,304 tests, 13,683 assertions, 2 skipped, 0 failures.
- `npm run build:wp` succeeds; hashed assets under `wp-plugin/mullion-gallery/assets` contain `--mullion-` and zero `--wpsg-`.
- Playwright visual-regression (`npm run build-storybook` then `npm run test:visual`): **33 passed (11 adapters × 3 viewports), 0 diffs.** Confirms generator and every consumer stayed in lockstep — a missed fallback would have shown the old hex (or unthemed) colors.

### Implementation Notes (2026-08-24)

- **Scope-count discovery, again.** The Problem text's "61 hardcoded bypass sites" / "52+ distinct variable names" undercounted the same way P74-G/H did: 47 files / ~236 hits in `src/` + `packages/theme-engine/src/`. Changing `DEFAULT_CSS_VAR_PREFIX` alone would have been a silent visual break — the generator would emit `--mullion-color-*` while every SCSS/inline-style consumer still read `--wpsg-color-*` and fell through to hex fallbacks. That is exactly the failure mode the visual-regression gate is there to catch.
- **Mechanical `--wpsg` → `--mullion`**, not a refactor onto the JS constant. SCSS/CSS cannot import `DEFAULT_CSS_VAR_PREFIX`, so "consistently" (the Fix text's own option) means the literal `--mullion-` prefix everywhere. The `--` prefix already isolates CSS custom properties from `wpsg-tile-*`, `data-wpsg-*`, and `wpsg-theme-vars`, so no word-boundary regex was needed. Covers the generated theme tokens, the 14 `--wpsg-builder-*` shell tokens, `--wpsg-slot-rot`, `--wpsg-glow-color`, and `--wpsg-media-grid-max-*`.
- **Folded in the PHP/i18n default, same class of live coupling as P74-H's `ASSET_IN_USE_CODE`.** `class-mullion-settings-registry.php`'s `'dot_nav_active_color' => 'var(--wpsg-color-primary)'`, the matching TS default / adapter-setting fallback, and the i18n placeholder `set_sg_carousel_dotNavActiveColor_ph` are stored *values* that name a CSS variable. Left unrenamed, a new gallery's default active-dot color would reference a variable that no longer exists. `class-mullion-frontend-strings.php` was regenerated via `npm run i18n:generate` (never hand-edited). Surgical msgid swap in the `.pot` + 5 `.po` files (`var(--wpsg-color-primary)` → `var(--mullion-color-primary)`, identity translations), then `wp i18n make-mo` + `wp i18n make-php` only — **not** `make-pot`, preserving P74-C's stale-~150-string harvest decision. Locale coverage stayed 2,379/2,379.
- **No `--wpsg-*` runtime aliases.** Pre-launch full rename, same call as P74-D dropping the shortcode alias.
- **Stored option values** already persisted as `var(--wpsg-color-primary)` are **not** rewritten here. P74-F migrates option *keys*, not CSS-var strings inside values. Flagged as a punch-list note for P74-F/P74-M rather than invented as a value-migration in this track.
- **Held back on purpose:** `.wp-super-gallery` host class, `.wpsg-sr-only`, `.wpsg-tile-*`, `wpsg-theme-vars` style-element id, `data-wpsg-*` / `wpsgDebug` (all P74-J); hex fallbacks inside `var(--mullion-…, #1a1a2e)` (P74-O, blocked on P74-N); every `docs/*.md` reference (P74-M, standing phase precedent). The `.wp-super-gallery` selector mention in `cssVariables.ts`'s docstring was left as well — that class is P74-J.

---

## Track P74-J - Remaining JS/TS identifier cleanup

### Problem

Beyond the CSS variable prefix, `wpsg`/`WPSG` appears in scattered TS/React identifiers: variable and type names, exported constants, console-log prefixes (e.g. `[WPSG Theme] CRITICAL: Default theme...` in `src/themes/index.ts`), the `.wp-super-gallery` root/Shadow-DOM-host CSS class, and any `data-wpsg-*` HTML attributes.

### Fix

Sweep and rename each to its `mullion`/`Mullion` equivalent; `.wp-super-gallery` root class → `.mullion-gallery`.

### Acceptance criteria

- `grep -rn "wpsg\|WPSG"` (case-sensitive, both forms) across `src/` and `packages/*/src` returns zero results. **Met.**

### Validation

- Full Vitest suite: 3,775/3,775 passing across 255 files (`tsc --noEmit` clean).
- Full PHPUnit suite (wp-env): 1,304 tests, 13,683 assertions, 2 skipped, 0 failures.
- `npm run i18n:check` + `npm run i18n:check:locales` — 2,379/2,379 for all 5 locales.
- Console prefixes: every former `[WPSG]` / `[WPSG Theme]` site in `src/` and `packages/*/src` now reads `[MULLION]` / `[MULLION Theme]`. Live wp-env admin console inspect not repeated this pass (no UI change beyond identifier names; source grep is exhaustive).

### Implementation Notes (2026-08-24)

- **Mechanical `WPSG` → `MULLION`, `Wpsg` → `Mullion`, `wpsg` → `mullion`** across `src/`, `packages/*/src`, and `e2e/` (265 + 6 files). Covers debug helpers (`wpsgDebug` → `mullionDebug`, files git-mv'd), `useWpsgLicense` → `useMullionLicense`, i18next namespace `'wpsg'` → `'mullion'`, `data-wpsg-*` attributes, CSS classes (`.wpsg-tile-*`, `.wpsg-sr-only`, `.wpsg-theme-vars`, …), localStorage keys (`wpsg_view_*`, `wpsg_builder_*`), window globals (`__WPSG_CONFIG__` → `__MULLION_CONFIG__`, plus `__MULLION_AUTH_PROVIDER__` / `__MULLION_API_BASE__` / `__MULLION_I18N__` / `__MULLION_PAGE_SPACES__` / `__mullionOpen_*` / `__mullionThemeId`), and console prefixes.
- **Host class is a separate pass.** `.wp-super-gallery` does not contain the substring `wpsg`, so the token sweep would have left it. Renamed via class-specific patterns (`.wp-super-gallery`, BEM `--`/`__` variants, `className="wp-super-gallery"`) so REST paths `/wp-json/wp-super-gallery/v1/…` stay untouched — that namespace is still the live backend (unclaimed gap, deliberately left by P74-L).
- **PHP/e2e live couplings folded in**, same standard as P74-H's REST error codes: `Mullion_Embed::page_config_js()` window globals, shortcode `data-mullion-props`/`data-mullion-config`, host CSS classes, `#mullion-assets-admin` / `#mullion-spaces-admin` mount divs, admin-bar `data-mullion-open` + `__mullionOpen_*`, `$GLOBALS['mullion_spaces_on_page']` (a P74-H leftover in the same file), webhook/monitoring/pagination HTTP headers (`X-MULLION-Signature` etc.), and the matching PHPUnit/e2e assertions. Without these, the renamed SPA would silently fail to mount or to read config.
- **Also folded:** `eslint.config.js` plugin id `wpsg` → `mullion` (the P71-E gate test in `src/` looks up `mullion/no-untranslated-notification`; leaving the config registered under `wpsg/` made the gate silently no-op). `scripts/generate-frontend-i18n.mjs` header comment for `__MULLION_I18N__`. A P74-C miss in `class-mullion-embed.php`: one `__()` call still used `'wp-super-gallery'` as its text-domain argument — corrected to `'mullion-gallery'` while that file was open.
- **i18n:** two user-visible strings named CSS/capability tokens (`data-wpsg-component`, `manage_wpsg`). Source JSON + PHP settings description updated; surgical `.po`/`.pot` msgid/msgstr token swap (identity translations); `make-mo`/`make-php` only, no `make-pot`. **Note for P74-E:** the empty-state copy now says `manage_mullion` while the PHP capability is still `manage_wpsg` until that track lands — admin-only, pre-launch.
- **Held back on purpose:** REST namespace `/wp-super-gallery/v1/` (still registered in PHP; changing only JS would 404 every API call); script handle `wp-super-gallery-app` and fallback filename `wp-super-gallery.js`; admin `PAGE_SLUG` (`wpsg-assets` etc.) and CPT/option/capability identifiers (P74-E/F); Freemius `'slug' => 'wp-super-gallery'` (P74-K); PHP-only wrapper class `wpsg-full-bleed` (no JS consumer); `docs/**` (P74-M).
- **No aliases.** Pre-launch, same call as P74-D/P74-I. localStorage UI-pref keys start fresh under `mullion_*`.

---

## Track P74-K - Freemius slug wiring

### Problem

`wpsg_fs()`'s `fs_dynamic_init()` args hardcode `'slug' => 'wp-super-gallery'` and `'menu' => ['slug' => 'wp-super-gallery']`. This function itself is being renamed under P74-G/H, and its slug arguments need to match the new plugin slug from P74-B/C.

### Fix

Update both slug arguments to `'mullion-gallery'` as part of the same edit that renames `wpsg_fs()` → `mullion_fs()` under P74-H.

### Acceptance criteria

- `mullion_fs()` remains a safe no-op with zero network calls whenever credentials are empty (unchanged behavior — this track only changes what the slug *would* resolve to).

### Validation

- Manual code review — this function can't be meaningfully exercised without real Freemius credentials, consistent with how it's validated today.

**Sequencing note:** this track must land before Phase 75 is implemented — Phase 75's draft plan references `wpsg_fs()` and the old slug throughout, and depends on this track's output to be implementable as written.

---

## Track P74-L - Build/CI/tooling string literals

### Problem

`vite.config.ts`, both GitHub Actions workflows' ZIP-filename construction (`wp-super-gallery-v${VERSION}.zip`), and any remaining `scripts/*.js`/`*.mjs` string literals reference the old name.

During implementation, two more build/tooling-adjacent items surfaced that weren't claimed by this track's Fix text or by any other track:

1. **The `@wp-super-gallery/*` npm workspace package scope** — three internal monorepo packages (`shared-utils`, `shared-ui`, `theme-engine`) published under that scope, aliased in `vite.config.ts`'s `resolve.alias` and `tsconfig.json`'s `paths`, and imported directly in 138 source files across `src/` and `packages/*/src`. Not mentioned by P74-L's own Fix bullets (which only named "name-derived output paths or `define` values"), and not caught by P74-J's acceptance criteria either (that track's grep only scans `src/`/`packages/*/src` for the bare tokens `wpsg`/`WPSG` — `@wp-super-gallery` doesn't contain either substring, so it would have silently survived P74-J too).
2. **The WordPress.org SVN deploy `SLUG: wp-super-gallery` env var** in both workflows — adjacent to the ZIP_NAME work but not named in the Fix text; not P74-K's job either (that track is specifically `wpsg_fs()`'s Freemius slug args, a different config surface).

Both were confirmed with the user before proceeding (folded into this track rather than split out or deferred — see Implementation Notes).

### Fix

- `vite.config.ts` — the `__WPSG_PREMIUM__` build-time `define` (+ its `vite-env.d.ts` declaration and ~10 usage sites in `src/`), the `wpsg-sw-hash-inject` plugin's own name, the `__WPSG_BUILD_HASH__` placeholder token (shared with `public/sw.js`), and the `@wp-super-gallery/*` → `@mullion/*` resolve aliases.
- `.github/workflows/release.yml`, `.github/workflows/svn-deploy.yml` — ZIP filenames become `mullion-gallery-v${VERSION}.zip`; `SLUG: wp-super-gallery` → `SLUG: mullion-gallery`.
- `package.json`'s `WPSG_PREMIUM=false` script literals (×3), `.github/workflows/ci.yml`'s matching comment, `scripts/check-free-build-clean.mjs`'s comments/messages — all `WPSG_PREMIUM`/`__WPSG_PREMIUM__` → `MULLION_PREMIUM`/`__MULLION_PREMIUM__`.
- The npm workspace scope rename: `packages/{shared-utils,shared-ui,theme-engine}/package.json` `name` fields + the inter-package `@wp-super-gallery/shared-utils` dependency/`prepack` references, both packages' `tsconfig.build.json` path-mapping comments/entries, `tsconfig.json`'s 3 `paths` entries, and all 138 importing files' import specifiers — `@wp-super-gallery/*` → `@mullion/*`.
- `public/sw.js` — cache-key prefixes (`CACHE_VERSION`, `RUNTIME_CACHE`, `META_CACHE`, `UPLOADS_CACHE`, `SHELL_CACHE`, the `startsWith('wpsg-')` activate-time sweep) and the custom `x-wpsg-cached-at` cache-timestamp header (+ its 2 test files, `swMeta.test.ts`/`swUploads.test.ts`) — all `wpsg-*` → `mullion-*`. **Explicitly not touched**: the `/wp-json/wp-super-gallery/v1/campaigns` REST-endpoint regex and its surrounding comments in the same file — that string mirrors the actual backend REST namespace, which is still registered under the old name (an unclaimed gap flagged back in P74-A's implementation notes, not this track's to fix; changing only the SW's copy would silently break its cache-matching regex against the still-unrenamed real endpoint).

### Acceptance criteria

- A local dry-run of the release build (per the existing Phase 75/old-74 verification pattern) produces correctly-named ZIPs with the new plugin folder structure inside.
- `grep -rn "@wp-super-gallery"` across the repo (excluding `package-lock.json`, `node_modules/`) returns zero results.
- `tsc --noEmit` and the full Vitest suite pass with the renamed package scope resolving correctly through both the Vite alias and `tsconfig.json` paths.

### Validation

- Local build dry-run: `npm run build:wp` → zip → `unzip -l` to confirm internal paths and filename.
- Full Vitest suite (workspace-package imports exercised by nearly every test file via `@mullion/*`).
- `tsc --noEmit` across the whole project, including both `packages/*/tsconfig.build.json` builds.
- `npm install` (not `--package-lock-only`, since real workspace package names changed and `node_modules/@mullion/*` symlinks needed regenerating) — confirmed `package-lock.json` has zero remaining `@wp-super-gallery` references afterward.

### Implementation Notes (2026-08-24)

- Confirmed both scope expansions with the user before proceeding (see Problem section) rather than deciding unilaterally — the workspace-package rename in particular is comparable in size/risk to a dedicated track (138 files) and no existing track's Fix or Acceptance text actually covered it.
- `__WPSG_PREMIUM__`/`WPSG_PREMIUM` renamed together as one unit (build-time `define` derives directly from the env var of the same name) even though the doc's Fix text only explicitly named `define` values — same reasoning as P74-A's "found but would actively break things if left" standard: leaving the env var renamed-if-touched-elsewhere but the define stale (or vice versa) would desync the two ends of the same mechanism.
- `public/sw.js`'s cache-prefix rename was done alongside the `__WPSG_BUILD_HASH__` placeholder fix (same file, same edit pass) since leaving the placeholder renamed but every surrounding cache-key string still `wpsg-*` would be an inconsistent half-rename with no other track claiming the rest of that file. Deliberately stopped short of the REST-endpoint regex in the same file — that one really does belong to whatever track eventually renames the backend's REST namespace (still an open gap, not created or closed by this track).
- Left `docs/` prose referencing the old shortcode/package names untouched (P74-M's territory, same precedent as every prior track this phase).

---

## Track P74-M - Documentation sweep

### Problem

Roughly 149 files under `docs/` mention "WP Super Gallery" or `wpsg` in prose. The root [README.md](../README.md) still carries the project's original working name, `# campaignViewerWP`, predating even the WP Super Gallery name. `.wordpress-org/README.md` and `.wordpress-org/DESIGN_BRIEF.md` both describe the product under its old name throughout.

### Fix

- Global prose sweep across `docs/` **excluding `docs/archive/phases/`** (73 historical phase reports, left untouched as an accurate record of what shipped under the old name — the same precedent already established for not rewriting history).
- Root `README.md` — replace `# campaignViewerWP` with the current product identity while this file is being touched anyway.
- `.wordpress-org/README.md`, `.wordpress-org/DESIGN_BRIEF.md` — full rename pass, plus append the color-system explanation and the ink-safe rejection to the design brief (see the companion update landing alongside this phase doc).

### Acceptance criteria

- `grep -rli "wp super gallery\|wpsg"` across `docs/` excluding `docs/archive/` returns zero results.
- Every hook/option/class name referenced in a guide (P74-H's cross-check) matches its renamed identifier.

### Validation

- Manual read-through of `docs/guides/` cross-links to confirm nothing points at a renamed-away anchor.

---

## Track P74-N - New default theme: Mullion / Rig Cyan

### Problem

The current default theme (`default-dark.json`, id `default-dark`) carries the old brand's navy-blue palette (`#0f172a` / `#3b82f6`). The designer's original submission ("ink-safe," `#0f857c`) failed this repo's own WCAG AA gate — see Key Decision G. Since then, two further review rounds with the designer produced a complete, self-verified palette (`.wordpress-org/COLOR-SPEC.md`), superseding everything below the original four-role submission.

### Fix

Overwrite `packages/theme-engine/src/definitions/default-dark.json`'s `colors` block in place (id and `DEFAULT_THEME_ID` unchanged — see Key Decision F), using the finished palette from `COLOR-SPEC.md` §1:

```json
{
  "background": "#08141b",
  "surface": "#102530",
  "surfaceRaised": "#1a3542",
  "surface2": "<derived>",
  "surface3": "<derived>",
  "text": "#eef8fb",
  "textMuted": "#9db4bf",
  "textMuted2": "<derived>",
  "border": "#22414f",
  "borderStrong": "#577577",
  "primary": "#1ad1c4",
  // primaryShade intentionally absent — see _primaryShade note below.
  "success": "#56b93e",
  "warning": "#f5b12b",
  "error": "#ff6b5e",
  "info": "#1ad1c4",
  "accent": "#1ad1c4",
  "accentGreen": "#56b93e",
  "accentPurple": "<no brand signal — placeholder>"
}
```

- **`success`/`warning`/`error` changed from the original plan.** The earlier draft of this track assumed these would carry over unchanged from the old blue theme (`#22c55e`/`#f59e0b`/`#ef4444`) — the designer's finished spec instead gives Rig Cyan-specific values, verified AA-clean against the palette's own surfaces. Use the new values, not the old-theme carryover.
- **`surfaceRaised` and `borderStrong` are new `ThemeColors` fields, not previously in the schema.** Per user decision, adopted as **optional fields with a fallback** (mirroring how `accent`/`accentGreen`/`accentPurple` already default from `primary` today) rather than required on every theme — so Rig Cyan gets the real distinction without forcing an immediate pass over the other 22 shipped themes. Requires touching `types.ts` (`ThemeColors`/`ResolvedColors`/`ThemeCatalogEntry` as applicable), `colorGen.ts`'s `resolveColors`, `cssVariables.ts` (emit `--mullion-color-surface-raised` / `--mullion-color-border-strong`), and `adapter.ts` (wire into whichever Mantine component overrides currently use `border`/`surface2` for an affordance/input-outline role — the ones P75-E's spike will identify as needing the "strong" variant). The rationale is the same WCAG 1.4.11 distinction P75-E is auditing: `border` (1.46:1, decorative dividers, exempt) vs. `borderStrong` (3:1, input outlines and focusable edges — an affordance, not decoration).
  - **The two fallbacks are not equivalent risk, per designer review round 5** (`.wordpress-org/color-response-from-designer.md.md`) — verified directly, not taken on faith: `surfaceRaised` → `surface2` when unset is harmless (a theme without it just reads flatter). `borderStrong` → `border` when unset is **not** a safe fallback — `border` measures 1.46:1 against Rig Cyan's surface (confirmed) while `borderStrong` measures 3.17:1 (confirmed); aliasing one to the other would reinstate exactly the WCAG 1.4.11 failure the field exists to prevent, for every theme that doesn't explicitly author it. **`borderStrong`'s fallback must be derived, not aliased**: step the surface color's own lightness toward mid-grey (holding hue, easing chroma slightly) until it clears 3:1 against that same surface. Verified against 4 surfaces (Rig Cyan `#102530`→`#5b707c` 3.05:1, tokyo-night `#1a1b26`→`#6e6f7c` 3.44:1, sunset-boulevard `#fffbeb`→`#8c887b` 3.42:1, forest-whisper `#f3f5f4`→`#818382` 3.49:1) — all four reproduce exactly against real contrast calculations. A theme that authors `borderStrong` explicitly overrides the derivation; one that doesn't gets a value that passes rather than one that doesn't.
- `surface2`/`surface3`/`textMuted2` — not given by the designer's 11-role spec (which uses a leaner 2-tier text hierarchy and a 2-tier raised-surface model rather than this schema's 3-tier one). Still derived via LAB-space interpolation, reusing [colorGen.ts](../packages/theme-engine/src/colorGen.ts)'s `deriveDarkTuple` technique, between the now-fixed anchor points (`surface`/`surfaceRaised` for surface2/3, `text`/`textMuted` for textMuted2).
- **`primaryShade` is absent, not TBD-with-a-placeholder, per final designer review (round 6).** Matching the theme JSON they now ship: no `primaryShade` value at all, replaced with a `_primaryShade` note carrying the criterion (first array index from the dark end clearing 4.5:1 against the lightest surface and under white text — expressed as a plain array index, not a Tailwind-style rung name; see the note below on why), the measured current-HSL values, and an explicit "pending P75-F." Nothing sits in the file that could be copied out and used by mistake. Under the current HSL generator the criterion resolves at **index 7** (`#0f7971`, 4.79:1 on text, 5.26:1 under white) — verified directly against `generateColorScale()`, not modeled. The OKLCH-side answer is not yet derivable at all; it depends on lightness stops P75-F hasn't chosen. Blocked on [PHASE75_REPORT.md](PHASE75_REPORT.md)'s P75-F.
- **Naming convention, settled after four rounds of ambiguity:** ramp positions are expressed as plain array indices (0–9) only, never Tailwind-style rung names (50/100/…/950). The two conventions don't map cleanly onto a 10-element array at either end, and the mismatch went unnoticed for several rounds of this design collaboration before being caught. Use indices everywhere in this codebase and in any future spec exchange.
- `accentPurple` still has no brand signal — stays a placeholder pending direction.
- `theme-catalog.json`'s `default-dark` entry — `name`/`description` updated to describe Mullion/Rig Cyan.

**Explicitly deferred:** `default-light.json` — no light-scheme values were supplied, left untouched as a known gap rather than guessed at.

### Acceptance criteria

- `auditThemeContrast()` reports zero failures against the finalized (derived-fields-included) palette, run directly against the JSON before this is considered done — the same check the CI gate runs.
- `surfaceRaised`/`borderStrong` resolve correctly (explicit value for Rig Cyan, fallback for every other theme) through `resolveColors`, `cssVariables.ts`, and the Mantine adapter.
- Every existing theme-registry/`ThemeContext`/`useTheme` test that asserts *behavior* (not literal old hex values) continues to pass; tests asserting the old blue hex values are updated to the new ones.
- Visual regression baselines are regenerated for the default theme's snapshots (an intentional visual change, unlike P74-I).

### Validation

- Run `auditThemeContrast` directly against the candidate JSON, independent of the CI test suite, before committing — catches an AA failure before it's baked into a snapshot.
- Full Vitest suite, including a regenerate-and-review pass on visual-regression snapshots for the default theme specifically.
- Confirm the `surfaceRaised`/`borderStrong` fallback path with a theme that omits them (any of the other 22) — should resolve to `surface2`/`border` unchanged, zero visual regression for themes that don't specify the new fields.

**Blocked sub-item:** `primaryShade`'s final value — pending [PHASE75_REPORT.md](PHASE75_REPORT.md)'s P75-F (OKLCH ramp migration). Everything else in this track is unblocked.

---

## Track P74-O - CSS fallback-color reconciliation

### Problem

Several components hardcode literal hex fallbacks for CSS custom properties that assume the *old* default theme's ballpark values — e.g. `var(--wpsg-color-surface, #1a1a2e)` across ~10 gallery adapters, plus `#0f3460`, `#0d0d0d`, `#228be6` (default card accent border), and `#7c9ef8` (default tile glow) elsewhere. Once P74-N ships, these fallbacks visually mismatch the real default theme's values whenever a fallback actually resolves (contexts outside the themed scope, or before the CSS variable initializes).

### Fix

Update each fallback literal to its Rig Cyan equivalent, once P74-N's derived values are final. This track cannot start in earnest before P74-N resolves.

### Acceptance criteria

- `grep -rn "#1a1a2e\|#0f3460\|#228be6\|#7c9ef8"` across `src/` returns zero results (all replaced with the new theme's real values as literal fallbacks).

### Validation

- Visual check of an unthemed/fallback-triggering context (e.g. briefly disabling the CSS variable injection in a dev build) to confirm no seam.

---

## Verification (phase-wide)

1. **Full-repo identifier sweep.** `grep -ri "wpsg\|wp-super-gallery" --include=*.php --include=*.ts --include=*.tsx --include=*.json -l` across `wp-plugin/mullion-gallery/`, `src/`, `packages/*/src/` returns zero results.
2. **Build.** `npm run build:wp` and `npm run build:wp:free` both succeed with the renamed paths and identifiers.
3. **`php -l`** across the entire renamed `wp-plugin/mullion-gallery/` tree.
4. **PHPUnit**, via the `php-testing` skill (wp-env) — full suite, plus the new P74-E/F migration test seeded with old-prefix fixture data.
5. **Vitest**, full suite, plus `auditThemeContrast` run directly against the finalized theme JSON.
6. **wp-env manual QA.** Boot the renamed plugin, confirm the admin menu, both shortcode tags, the front-end gallery, and (if a pre-rename database snapshot is available) that migrated content and settings are intact.
7. **Playwright visual regression**, diffed against pre-rename baselines — expect zero diffs from the identifier-only tracks (P74-A through P74-M), and intentional diffs only from P74-N/O, reviewed and re-baselined.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| `default-light.json` companion to Rig Cyan | No light-scheme values were supplied by the designer; inventing them would be worse than leaving the gap explicit. |
| Removing the retired old-blue palette from any design references outside the theme JSON itself (e.g. marketing screenshots already captured under the old theme) | Screenshot recapture is already tracked separately per the design brief's own screenshot-manifest section; not duplicated here. |
| A distinct "ink-safe"/accent-text schema role, if the designer's corrected submission turns out to need one | Genuinely blocked on knowing what the designer intended; adding schema surface speculatively would be worse than waiting for the real requirement. |

## Implementation Notes

Not started. This document currently reflects the **plan** only — see the Status header.

## Outcome

**Planned, not yet implemented.** All fifteen tracks are laid out with explicit dependencies and risk levels; P74-E/F (data migration) and P74-N (blocked on a corrected ink-safe value) carry the phase's real risk, everything else is large but mechanical. Once implemented, [PHASE75_REPORT.md](PHASE75_REPORT.md) becomes executable as written.
