# Phase 74 - Mullion Rebrand: Full Technical Rename + New Default Theme

**Status:** In progress — P74-A landed, remaining tracks Planned
**Created:** 2026-08-23
**Last updated:** 2026-08-23

### Tracks

| Track | Description | Status | Risk |
|-------|-------------|--------|------|
| P74-A | Plugin folder rename (`wp-plugin/wp-super-gallery/` → `wp-plugin/mullion-gallery/`) and every tooling path reference | Done | High (mechanical, broad) |
| P74-B | Plugin metadata: header, `package.json` name | Planned | Low |
| P74-C | Text domain rename + i18n regeneration (~3,066 call sites, 16 language files) | Planned | Medium |
| P74-D | Shortcode rename with a `super-gallery` backward-compat alias | Planned | Low |
| P74-E | CPT + taxonomy + capability rename, paired with a data-migration routine | Planned | High (data migration) |
| P74-F | DB option key rename (276 occurrences), paired with the same migration routine | Planned | High (data migration) |
| P74-G | PHP class + file rename (56 classes, 56 files) | Planned | Medium (large, mechanical) |
| P74-H | Function + hook/filter rename (20 functions, ~50+ extension points) | Planned | Medium |
| P74-I | CSS custom-property prefix rename (`--wpsg-*` → `--mullion-*`) | Planned | Medium |
| P74-J | Remaining JS/TS identifier cleanup | Planned | Low-Medium |
| P74-K | Freemius slug wiring | Planned | Low (hard sequencing dependency on Phase 75) |
| P74-L | Build/CI/tooling string literals | Planned | Low |
| P74-M | Documentation sweep (~149 files, excluding `docs/archive/`) | Planned | Low (volume) |
| P74-N | New default theme: Mullion / Rig Cyan | Planned — partially blocked | Low-Medium |
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
| D | Shortcode tag: rename outright, or preserve `super-gallery` | **Rename to `mullion-gallery`, register `super-gallery` as a backward-compat alias** to the same handler. The shortcode is the one identifier that can land inside actual post content; aliasing it costs one line and removes any risk to already-written examples or docs. |
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

---

## Track P74-C - Text domain rename + i18n regeneration

### Problem

The `'wp-super-gallery'` text-domain literal appears in ~3,066 `__()`/`_e()`/`_x()`-family call sites across the PHP codebase — WordPress.org's i18n tooling requires this as a literal string per call (not a constant), so this cannot be a single-point fix. The `languages/` directory holds 16 files (`wp-super-gallery.pot`, and `.po`/`.mo`/`.l10n.php` for each of 5 locales) named after the old domain.

### Fix

- A scripted, not hand-edited, global replace of the literal domain string across all PHP call sites — a codemod or careful `sed`/`grep -l | xargs sed` pass scoped to gettext call signatures only (to avoid touching unrelated string literals that happen to contain `wp-super-gallery`, e.g. URLs, which should be reviewed separately as part of P74-M/P74-L).
- Rename all 16 `languages/` files: `wp-super-gallery-{locale}.{po,mo,l10n.php}` → `mullion-gallery-{locale}.{po,mo,l10n.php}`; `wp-super-gallery.pot` → `mullion-gallery.pot`.
- Regenerate `.pot`/`.mo`/`.l10n.php` via the existing WP-CLI toolchain (per `docs/guides/TRANSLATING.md`). The `msgid`/`msgstr` translation pairs themselves are untouched — only the domain metadata in each file's header and the filenames change — so none of the 5 locales' translated content needs re-translation.
- Update `scripts/check-i18n-locales.mjs` and any other script that pattern-matches the old filename convention.

### Acceptance criteria

- Zero occurrences of the literal `'wp-super-gallery'` as a text-domain argument anywhere in `wp-plugin/mullion-gallery/`.
- All 5 locales report the same translated-string count as before the rename (translation content unaffected).
- `languages/` contains only `mullion-gallery-*` files.

### Validation

- WP-CLI `wp i18n make-pot` / equivalent regeneration run, diffed against the pre-rename `.pot` to confirm only the domain header changed, not the msgid list.
- Load the admin UI under a non-English `WPLANG` (e.g. `de_DE`) in wp-env and confirm translated strings still render.

---

## Track P74-D - Shortcode rename with backward-compat alias

### Problem

`includes/class-wpsg-embed.php` registers a single shortcode tag, `super-gallery`, with no brand reference in the tag itself — but the file and class it lives in will be renamed under P74-G, and consistency argues for the shortcode itself carrying the new name too.

### Fix

Register `mullion-gallery` as the primary shortcode tag, and keep `add_shortcode('super-gallery', [self::class, 'render_shortcode'])` registered alongside it as a backward-compat alias to the same handler — one extra line, zero behavioral difference, and it removes any risk to already-written documentation or content using the old tag.

### Acceptance criteria

- Both `[mullion-gallery ...]` and `[super-gallery ...]` render identically.
- Documentation examples (P74-M) are updated to show the new tag as primary, with a note that the old one still works.

### Validation

- Front-end render test for both tags in wp-env.

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

- New PHPUnit test seeding a fixture DB with old-prefix data, running the migration, and asserting the new-prefix data is queryable and the old-prefix data is gone.
- Manual QA pass in wp-env: seed old-style data manually via `wp post create --post_type=wpsg_campaign`, activate the renamed plugin, confirm the migration recovers it.

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

- `grep -rn -- "--wpsg-"` across `src/` and `packages/*/src` returns zero results.
- Visual regression suite (Playwright, 3 viewports × adapters) shows no unintended change — this track is a pure rename, not a visual change (visual changes come from P74-N).

### Validation

- Full Vitest suite.
- Playwright visual-regression run, diffed against pre-rename baselines — any diff here indicates a fallback value was missed, not just a renamed variable.

---

## Track P74-J - Remaining JS/TS identifier cleanup

### Problem

Beyond the CSS variable prefix, `wpsg`/`WPSG` appears in scattered TS/React identifiers: variable and type names, exported constants, console-log prefixes (e.g. `[WPSG Theme] CRITICAL: Default theme...` in `src/themes/index.ts`), the `.wp-super-gallery` root/Shadow-DOM-host CSS class, and any `data-wpsg-*` HTML attributes.

### Fix

Sweep and rename each to its `mullion`/`Mullion` equivalent; `.wp-super-gallery` root class → `.mullion-gallery`.

### Acceptance criteria

- `grep -rn "wpsg\|WPSG"` (case-sensitive, both forms) across `src/` and `packages/*/src` returns zero results.

### Validation

- Full Vitest suite.
- Browser console check in wp-env admin — no `[WPSG ...]`-prefixed log lines.

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

`vite.config.ts`, both GitHub Actions workflows' ZIP-filename construction (`wp-super-gallery-v${VERSION}.zip`, `wp-super-gallery-lite-v${VERSION}.zip`), and any remaining `scripts/*.js`/`*.mjs` string literals reference the old name.

### Fix

- `vite.config.ts` — any name-derived output paths or `define` values.
- `.github/workflows/release.yml`, `.github/workflows/svn-deploy.yml` — ZIP filenames become `mullion-gallery-v${VERSION}.zip` / `mullion-gallery-lite-v${VERSION}.zip`.
- Remaining `scripts/*` literals.

### Acceptance criteria

- A local dry-run of the release build (per the existing Phase 75/old-74 verification pattern) produces correctly-named ZIPs with the new plugin folder structure inside.

### Validation

- Local build dry-run: `npm run build:wp` → zip → `unzip -l` to confirm internal paths and filename.

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

The current default theme (`default-dark.json`, id `default-dark`) carries the old brand's navy-blue palette (`#0f172a` / `#3b82f6`). The designer's replacement, "Rig Cyan," supplies four of the roles the theme schema requires (`background`, `surface`, `text`, `primary`) plus a fifth ("ink-safe") that — per Key Decision G — fails this repo's own WCAG AA gate as submitted and has been sent back.

### Fix

Overwrite `packages/theme-engine/src/definitions/default-dark.json`'s `colors` block in place (id and `DEFAULT_THEME_ID` unchanged — see Key Decision F):

```json
{
  "background": "#08141b",
  "surface": "#102530",
  "surface2": "<derived>",
  "surface3": "<derived>",
  "text": "#e8f7fc",
  "textMuted": "<derived>",
  "textMuted2": "<derived>",
  "border": "<derived>",
  "primary": "#1ad1c4",
  "primaryShade": { "light": "<TBD>", "dark": "<TBD>" },
  "success": "#22c55e",
  "warning": "#f59e0b",
  "error": "#ef4444",
  "info": "#1ad1c4",
  "accent": "#1ad1c4",
  "accentGreen": "#22c55e",
  "accentPurple": "#a855f7"
}
```

- `surface2`/`surface3`/`textMuted`/`textMuted2`/`border` — derived via LAB-space interpolation between `surface` (`#102530`) and `text` (`#e8f7fc`), reusing the technique [colorGen.ts](../packages/theme-engine/src/colorGen.ts)'s `deriveDarkTuple` already applies to Mantine's `dark[]` tuple, rather than hand-picked.
- `primaryShade` — set once a corrected ink-safe (or equivalent) value establishes which rung of the auto-generated 10-step accent ramp should back filled buttons; until then, defaults to the same index `default-dark.json` currently uses.
- `success`/`warning`/`error` carried over unchanged — not part of the designer's three-way comparison, so presumed stable.
- `accentPurple` kept as a neutral placeholder (`#a855f7`) pending any brand-specific signal.
- `theme-catalog.json`'s `default-dark` entry — `name` and `description` updated to describe Mullion/Rig Cyan rather than "Clean dark baseline."

**Explicitly deferred:** `default-light.json` — no light-scheme values were supplied, left untouched as a known gap rather than guessed at.

### Acceptance criteria

- `auditThemeContrast()` reports zero failures against the finalized (derived-fields-included) palette, run directly against the JSON before this is considered done — the same check the CI gate runs.
- Every existing theme-registry/`ThemeContext`/`useTheme` test that asserts *behavior* (not literal old hex values) continues to pass; tests asserting the old blue hex values are updated to the new ones.
- Visual regression baselines are regenerated for the default theme's snapshots (an intentional visual change, unlike P74-I).

### Validation

- Run `auditThemeContrast` directly against the candidate JSON, independent of the CI test suite, before committing — catches an AA failure before it's baked into a snapshot.
- Full Vitest suite, including a regenerate-and-review pass on visual-regression snapshots for the default theme specifically.

**Blocked sub-item:** finalizing `primaryShade` and confirming whether a distinct "ink-safe"-equivalent role is needed at all — pending the designer's corrected submission, per Key Decision G and the color-system explanation appended to the design brief.

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
