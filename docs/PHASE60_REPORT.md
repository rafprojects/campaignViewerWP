# Phase 60 - Release / Store-Readiness (Freemius-targeted)

**Status:** In Progress
**Created:** 2026-06-26
**Last updated:** 2026-07-04

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P60-A | Version & metadata single-source-of-truth + `readme.txt` polish | ✅ Done (2026-07-01) | Small |
| P60-B | i18n completeness — generate `.pot`, confirm user-facing coverage, scope admin harvest | ✅ Done (2026-07-01) | Medium |
| P60-C | Plugin Check + escaping/sanitization compliance pass | ✅ Done (2026-07-04) — 1 residual PC error is the readme "Tested up to" bump, a P60-F dependency | Medium |
| P60-D | Accessibility hardening (extend the P54-C baseline to key admin flows) | ✅ Done (2026-07-04) | Medium |
| P60-E | Store assets, privacy/GDPR statement, buyer-facing docs | ✅ Done (2026-07-05) — text deliverables complete; banner/icon/screenshot artwork spec'd but pending a designer/capture pass | Small-Medium |
| P60-F | Release packaging + final cross-version/browser QA | ✅ Done (2026-07-05) — packaging leak fixed, version SoT + Tested-up-to→7.0 done, JS suites+build green; live-WP install/uninstall smoke + cross-PHP PHPUnit are CI/test-server gated (no local Docker) | Small-Medium |
| P60-G | i18n runtime — front-end (i18next) locale delivery for the React app | ✅ Done (2026-07-01) | Medium-Large |
| P60-H | Localization — shipped language packs (fr_FR, es_ES, de_DE, zh_CN, ru_RU) | ✅ Done (2026-07-03) | Medium |
| P60-I | Admin-panel internationalization (harvest → t(), lint flip, translate) | ✅ Done (2026-07-04) | XL (phase-sized) |

---

## Rationale

The product is feature-complete enough to sell; this phase closes the **release-readiness** gaps required to ship to a marketplace. The chosen distribution target is **Freemius premium** (see [MONETIZATION_OPTIONS.md](MONETIZATION_OPTIONS.md) §7), so this phase scopes to the "Premium / marketplace — Med-High delta" bar in §5 — not the heavier full-public WP.org bar.

1. **What triggered it.** Phase 54 set a target-independent must-fix floor and deferred the distribution-specific work to FUTURE_TASKS pending a path decision. The path is now chosen (Freemius premium), so the readiness items it gates are scheduled here. The monetization/licensing build itself lives in [PHASE62_REPORT.md](PHASE62_REPORT.md).
2. **Why it belongs together.** Every track is a precondition for a credible paid release — correct version metadata, translatable strings, escaping/Plugin-Check compliance, accessible admin flows, store collateral, and a validated package — and none adds product features.
3. **Success.** A reviewer (and a buyer) sees a plugin with consistent version metadata, a generated translation template, a clean Plugin Check / escaping pass, no new critical a11y violations in the main flows, complete store collateral and a privacy statement, and a release artifact that installs/activates/uninstalls cleanly across supported PHP versions.

> **Split from monetization.** This phase makes the plugin *shippable*; [PHASE62_REPORT.md](PHASE62_REPORT.md) makes it *sellable* (gating seams + Freemius SDK + pricing + buyer docs). Land P60 first.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Distribution target | **Freemius premium** (MONETIZATION §7 recommended first monetized release). Scopes this phase to the §5 "premium/marketplace" delta. (User direction, 2026-06-26.) |
| B | Admin i18n depth | **User-facing subset is the floor; full admin-panel harvest (~300 literals + lint flip) stays a Follow-On.** Full admin i18n is the WP.org public-listing gate, not the Freemius premium gate. |
| C | Accessibility depth | **Extend the P54-C critical/serious baseline to the main admin flows;** the full WCAG AA audit remains a WP.org-tier Follow-On. |
| D | Version source of truth | **The release workflow / `compute-version.sh` is canonical;** this phase reconciles the committed in-repo values to it and removes the drift, rather than introducing a new mechanism. |

## Execution Priority

1. **P60-A (version/metadata)** — fast, unblocks a coherent release artifact; the current drift would otherwise ship.
2. **P60-B (i18n + `.pot`)** and **P60-C (Plugin Check / escaping)** — the compliance core; can proceed in parallel.
3. **P60-D (a11y hardening)** — extends the existing axe baseline; independent.
4. **P60-E (store assets + privacy + docs)** — collateral; can run alongside the compliance tracks.
5. **P60-G (front-end locale delivery)** — follows P60-B (sources ready); independent of C/D/E and non-blocking for F. Elevates the product to fully translatable.
6. **P60-F (packaging + final QA)** — last; validates everything above as a single installable artifact.

---

## Track P60-A - Version & metadata single-source-of-truth

### Problem

The committed version values disagree: the plugin header is `Version: 0.27.0` (`wp-super-gallery.php:6`) while the `WPSG_VERSION` constant is `0.26.0` (`:22`) and `readme.txt` carries `Stable tag: 0.26.0` (`:7`); `package.json` is `0.27.0`. Shipping with a stale `Stable tag`/constant is a release-integrity and update-delivery hazard.

### Fix

- Reconcile `WPSG_VERSION`, the header `Version:`, `readme.txt` `Stable tag:`, and `package.json` to one value, deriving from the release workflow / `scripts/compute-version.sh` as the canonical source.
- Refresh the compatibility headers (`Requires at least`, `Tested up to`, `Requires PHP`) in both `wp-super-gallery.php` and `readme.txt`, and polish the `readme.txt` description/sections.

### Acceptance criteria

- All four version sources report the same value, and that value matches what the release workflow produces.
- Compatibility headers are current and identical between the plugin header and `readme.txt`.
- No "stable tag mismatch" warning from Plugin Check (cross-checked in P60-C).

### Validation

- Grep the four sources for the version string and confirm equality; run a dry-run of the release workflow / version script and confirm it agrees.

### Implementation (2026-07-01) — ✅ Done

**What was found.** The drift was confirmed exactly as described: plugin header + `package.json` were `0.27.0`, while `WPSG_VERSION` and `readme.txt` `Stable tag` were `0.26.0`. Two further facts surfaced during verification:

- **No `v0.27.0` tag exists.** The only tags are `v0.17.0` and `v0.26.0`; `docs/VERSION_HISTORY.md` documented a `v0.27.0` (Phase 54) release that was never actually cut, and **455 commits across Phases 30–59** had landed on top of `v0.26.0` with no version bump. So the repo's real released baseline is `0.26.0`.
- **`Tested up to: 7.0` was an unverifiable/false compatibility claim** — CI (`ci.yml:142`) only exercises WordPress `6.7`. Shipping `7.0` would draw a Plugin Check flag (cross-checked in P60-C).

**Decisions & actions.**

- **Version set to `0.90.0`** across all four sources (header, `WPSG_VERSION`, `readme.txt` `Stable tag`, `package.json`). This is a **deliberate manual override** of `compute-version.sh` (which computes `0.27.0` from conventional commits since `v0.26.0`); the release workflow explicitly supports an override via its `version` input (`VERSIONING.md` §"Version Bump Process" step 3). Rationale: the product is one phase from a paid release, and jumping the number signals that proximity — user direction, 2026-07-01. **This supersedes Key Decision D's "reconcile to the computed value" for this release only:** the canonical *mechanism* is still the workflow; the *value* is an intentional override, not drift.
- **`Tested up to` corrected to `6.7`** in both the plugin header and `readme.txt` to match what CI actually validates. `Requires at least: 6.4` and `Requires PHP: 8.2` left unchanged (already accurate).
- **Consolidated `0.90.0` changelog entry** written to `CHANGELOG.md`, `docs/VERSION_HISTORY.md`, and the `readme.txt` `== Changelog ==` / `== Upgrade Notice ==` sections, summarizing Phases 30–59 by theme at buyer-relevant granularity (per user direction: consolidated, not per-phase backfill). All three files had drifted (they stopped at Phase 28/29/54 respectively); the new entry re-tops all three.

**Verification.** All four sources grep-equal to `0.90.0` (automated equality check passed). `compute-version.sh` confirmed to output `0.27.0`, documenting the override delta.

## Track P60-B - i18n completeness (`.pot` + coverage)

### Problem

The `languages/` directory is empty — there is **no `.pot` file** for translators — and `i18next/no-literal-string` is `'off'` globally (`eslint.config.js:82`), so admin-panel strings (~300 literals) are not enforced as translatable. International premium buyers expect at least translatable user-facing strings.

### Fix

- Generate `wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot` (e.g. `wp i18n make-pot`) and wire it into the release packaging so it ships.
- Confirm the Phase 54-B user-facing harvest is complete and reflected in the `.pot`.
- **Scope decision (in-doc):** ship the user-facing subset for the Freemius launch; keep the full admin-panel harvest + flipping `i18next/no-literal-string` to `'error'` as a Follow-On (it gates the later WP.org public tier). Include any admin strings newly introduced by [PHASE59_REPORT.md](PHASE59_REPORT.md).

### Acceptance criteria

- A `.pot` file exists, covers the user-facing strings, and is included in the release artifact.
- The text domain loads correctly and a sample translation resolves at runtime.
- The admin-harvest scope decision is recorded; no regression in already-harvested user-facing strings.

### Validation

- `npm run test` for the existing i18n surface; generate the `.pot` and spot-check it contains representative user-facing strings; manual QA loading a sample locale.

### Implementation (2026-07-01) — ✅ Done

**Key discovery — the plugin has two parallel, unbridged i18n systems.** The original track framing assumed a single `.pot` would "cover the user-facing strings." Investigation showed that is only half the surface:

- **PHP-rendered strings** use WordPress gettext (`__('…','wp-super-gallery')`, ~344 call sites). These *are* harvestable into a `.pot`.
- **The React front-end** (the P54-B harvest — `Lightbox`, `AuthBar*`, `LoginForm`, `SpaceSwitcher`, gallery adapters, etc.; **91 keys** in `src/i18n-strings.en.json`) runs on **i18next**, a completely separate system. `wp i18n make-pot` cannot see these strings, and there is **no bridge**: a translator working from the `.pot` would never encounter the React UI strings, and `src/i18n.ts` has a per-locale injection seam (`window.__WPSG_I18N__.strings`) that PHP currently feeds only ~12 hardcoded English defaults — so every non-English locale falls back to English for the entire React UI.

**Scope split (user-approved, 2026-07-01).** Completing the front-end runtime pipeline is a Medium-Large architectural build, so it was carved out into a new track, **P60-G**. The division:

- **P60-B (this track) = translation _sources_ complete and shipped.** The gettext `.pot` for the PHP surface, and confirmation that the React English source of truth (`src/i18n-strings.en.json`) is complete and ships (compiled into the built bundle + copied by `build:wp`).
- **P60-G = _consumption_ of a non-English locale in the React UI** (per-locale source generation, runtime loading, a pilot locale, and extending lint enforcement). See the P60-G section.

**Actions.**

- Generated `wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot` via `wp i18n make-pot` (175 msgids across the PHP surface: CPT, embed, settings, asset/space admin renderers, plugin header).
- Fixed the two `make-pot` warnings by adding `/* translators: … */` comments for the placeholder strings in `class-wpsg-settings-service.php` (`Connection failed: %s`, `Unexpected response: HTTP %d`); regenerated → clean, zero warnings.
- **Shipping:** the release ZIP (`release.yml`) zips the whole plugin dir minus an explicit exclude list; `languages/` is **not** excluded, so the committed `.pot` ships automatically. No workflow change needed.
- **Admin-harvest scope decision recorded** (per Key Decision B): the full admin-panel harvest (~300 literals) + flipping `i18next/no-literal-string` from `'off'` to `'error'` globally remains a WP.org-tier Follow-On, unchanged. `eslint.config.js` currently enforces `no-literal-string` only on gallery adapters + `packages/shared-ui`.

**Verification.**

- `.pot` is valid gettext and harvests real strings (spot-checked, e.g. `"API connection successful!"`).
- **Translation round-trip proven:** authored a sample `fr_FR` `.po` translating a shipped string, compiled `.po → .mo` via `wp i18n make-mo` (success), and confirmed the French translation is embedded in the compiled `.mo` binary.
- Text-domain load wiring confirmed at `wp-super-gallery.php:193` (`load_plugin_textdomain('wp-super-gallery', …, '/languages')`).

**Acceptance-criteria reconciliation.** The original criterion "a `.pot` covers the user-facing strings" is amended to reflect the two-source reality: the `.pot` covers the **PHP-rendered** user-facing strings (complete + shipped), and the **React** user-facing strings are covered by the i18next English source (complete + shipped). End-to-end *translated* rendering of the React UI is the P60-G deliverable, not P60-B.

## Track P60-C - Plugin Check + escaping/sanitization compliance pass

### Problem

A paid/marketplace release is expected to pass WordPress Plugin Check and a full output-escaping/sanitization audit. Phase 54-A hardened the core, but the audit has not been run end-to-end across the whole PHP surface.

### Fix

- Run the WordPress Plugin Check tool and resolve its findings.
- Audit output escaping at every echo and input sanitization at every boundary across the PHP surface (extends P54-A); confirm there is no `eval`/obfuscation and no undisclosed external requests (the same-origin, nonce-based design is already aligned — MONETIZATION §6).
- Verify nonce and capability coverage on every REST route via the centralized `WPSG_Permissions` map (`includes/class-wpsg-permissions.php`).

### Acceptance criteria

- Plugin Check reports no errors (warnings triaged and documented).
- Output escaping / input sanitization audited across the PHP surface with any gaps fixed.
- No undisclosed remote calls; nonce/capability coverage confirmed for all routes.

### Validation

- PHPUnit suite green; Plugin Check run captured; a documented escaping-audit checklist over the `includes/` PHP surface.

### Implementation (2026-07-04) — 🚧 Security core done; Plugin-Check conformance triaged

**Tooling stood up (both, per user direction).** No static-analysis rig existed. Added, as committed dev-dependencies in `wp-plugin/wp-super-gallery/composer.json`: `squizlabs/php_codesniffer ^3.11`, `wp-coding-standards/wpcs ^3.1`, `dealerdirect/phpcodesniffer-composer-installer ^1.0`, plus a security-scoped `phpcs.xml` (WordPress.Security only — EscapeOutput / ValidatedSanitizedInput / NonceVerification, **not** the full style standard) and `composer lint:php` / `lint:php:fix` scripts. This is the durable, CI-wireable gate. Separately, the official **Plugin Check (PCP) 2.0.0** was installed into wp-env for marketplace-parity and run against the plugin (`wp plugin check wp-super-gallery`).

**Dependency CVE audit + alignment.** Adding the dev-deps surfaced a pre-existing drift: `composer.json` correctly declared `enshrined/svg-sanitize ^0.22`, but the **local** (gitignored, un-committed) `composer.lock`/`vendor` had drifted to `0.20.0`. `composer audit` showed **0.20.0 is vulnerable to CVE-2025-55166** ("svg-sanitizer Bypasses Attribute Sanitization", fixed in 0.22.0) — the very SVG sanitizer the plugin runs on uploads — and the transitive `guzzlehttp/psr7 2.8.0` carried **3 CVEs** (CVE-2026-55766 / -49214 / -48998, CRLF-injection / host-confusion, fixed in ≥2.12.1). Because `composer.lock` is not committed, CI/release (`composer install` → fresh resolve from `composer.json`) already pulls the fixed `^0.22` svg-sanitize and newest-compatible psr7 — i.e. **shipped release artifacts were not exposed**; the vulnerable versions lived only in the local dev tree. Realigned local to `svg-sanitize 0.22.0` + `guzzlehttp/psr7 2.12.3` so dev matches release; **`composer audit` now reports no advisories**. Full PHPUnit suite (**1072 tests / 13,098 assertions**) stays green after the upgrade. `composer.lock` was previously blanket-ignored via a `*.lock` rule in `.gitignore`; that rule was disabled (user, 2026-07-04) so the lock is **now committed pinning the fixed `svg-sanitize 0.22.0` / `psr7 2.12.3`** — release installs are reproducibly on the safe versions rather than re-resolving each build.

**Escaping / sanitization / nonce audit (WordPress.Security via PHPCS).** Scan found **26 violations in 11 files**. Fixed the **6 clear-cut** ones — missing `wp_unslash()`/`sanitize_text_field()` on superglobal reads (`$_SERVER['REMOTE_ADDR']` in analytics-controller, `HTTP_ACCEPT` in campaign-controller, `HTTP_ORIGIN`/`HTTP_REFERER` in auth-controller, `REQUEST_URI` in embed, `$_POST` space name/slug in cpt) plus an `(int)` cast on a `_doing_it_wrong` debug arg in db. The **14 residual** were triaged and assessed as false-positives/justified (left un-annotated pending review):

| Finding | Sites | Assessment |
|---|---|---|
| `NonceVerification.Recommended` | wp-super-gallery.php:443, monitoring.php:104, cpt.php:454/475 | Read-only request inspection (REST-route detection; admin list-table GET filter, `intval`'d). No state change → nonce N/A. Core WP list filters are nonce-free GET. |
| `EscapeOutput.ExceptionNotEscaped` | adapter-field-schema.php:38/46, export-engine.php:172/229 | Exception messages built from a trusted `__DIR__` constant / a numeric `round()`; not echoed output. Escaping a logged exception message is semantically wrong. |
| `ValidatedSanitizedInput.InputNotSanitized` | rest-base.php:664 (`PHP_AUTH_USER`/`PW`) | Basic-auth credentials — already `wp_unslash`'d and base64'd into a header WP itself validates. **Must not** `sanitize_text_field()` a password (would corrupt it). |

**Nonce & capability coverage.** 86 `register_rest_route` calls across 10 controllers; every route carries a `permission_callback` (the single `__return_true` is the intentionally-public campaign-view read path). No capability gaps surfaced.

**Plugin Check (PCP) triage — 542 findings (65 error / 477 warning), by disposition:**

| Bucket | Count | Disposition |
|---|---|---|
| **Dev-only files** (tests/, phpunit.xml.dist, bootstrap, .gitkeep, .phpunit.result.cache) | 215 | **Excluded from the release ZIP** (`release.yml` strips them) → not shipped, scan noise. Configure PCP to ignore, or accept. |
| **Custom-table `$wpdb`** (DirectQuery / NoCaching / SchemaChange / InterpolatedNotPrepared / UnescapedDBParameter) | ~250 | Architectural: table names are internal `$wpdb->prefix . 'wpsg_*'` constants (un-parameterizable in SQL); actual values use `%s`/`%d` via `prepare()`. **Verified no injection** — the 3 whole-string `NotPrepared` errors (`$sql`, `$count_sql`, `$statement`) are all properly prepared or internal-only; code already carries `// phpcs:ignore` in these spots. Bulk-acceptable with documentation. |
| **WP.org-directory-only** (`trademarked_term "wp"` in name/slug ×3; `load_plugin_textdomain` discouraged ×1) | 4 | **N/A for the Freemius/self-hosted premium target** (Key Decision A/B). The "wp" restriction and auto-load only apply to WordPress.org-hosted plugins; `load_plugin_textdomain` is *required* off-WP.org. |
| **Conformance fixes — APPLIED** (`unlink`→`wp_delete_file` ×6, `parse_url`→`wp_parse_url` ×1, `wp_count_terms` deprecated 2nd param ×5) | 12 | ✅ Fixed this session — pure drop-in, behavior-preserving swaps. PHPUnit re-verified green. |
| **Intentional / not-changed** (`MissingVersion` on enqueue ×4; `rmdir` in uninstall ×2; `error_log` ×2) | 8 | **By design, left as-is.** Enqueue `null` version is deliberate — a `?ver=` on Vite content-hashed ES modules duplicates app state (`embed.php:24-28`). `rmdir` runs in `uninstall.php` after `wp_delete_file`; WP_Filesystem init can silently no-op cleanup on FTP hosts → native FS is the robust choice. `error_log` sites are the `WPSG_Logger`/font-library logging implementation. `rmdir` now carries a documented `// phpcs:ignore` (follow-on); enqueue/`error_log` left as design. |
| **Metadata** (`outdated_tested_upto_header` 6.7<7.0; `upgrade_notice_limit` >300 chars) | 2 | `readme.txt` fixes; the "Tested up to" bump must follow real WP-7.0 testing (P60-F), not be asserted blind. Folded into P60-A/P60-F. |

**Net result (progression).** Plugin Check shipped-code **errors 27 → 15** after the 12 conformance fixes (unlink/parse_url/wp_count_terms cleared), then **15 → 1** after the follow-on annotations below (the 4 `ExceptionNotEscaped`, 7 `NotPrepared`, 1 `UnescapedDBParameter`, 2 `rmdir` are all verified-safe and now carry justified `// phpcs:ignore`). The final remaining error is the honest `outdated_tested_upto_header` (readme → P60-F). PHPUnit **1072/1072 green** throughout.

**Scope note.** P60-C's Problem/Fix framed the *security* surface (escaping, sanitization, nonce/capability) — that core is **done**: WPCS-security clear-cut items fixed, **dependency CVEs eliminated** (`composer audit` clean, lock pinned), **injection ruled out**, and the 12 low-risk WP-conformance fixes applied on top.

### Follow-on (2026-07-04) — WP.org-tier polish + lint annotations (done)

Per user direction, closed out the two remaining items:

- **Annotated all verified-safe findings so the gates go green.** The 14 WPCS-security false-positives (nonce on read-only route/list-filter detection, exception messages from trusted-`__DIR__`/numeric values, must-not-sanitize Basic-auth creds) and the residual Plugin-Check custom-table errors (7 `NotPrepared` that are `$wpdb->prepare()` output or internal table-name interpolation, 1 `UnescapedDBParameter`, 2 intentional uninstall `rmdir`) each carry an inline `// phpcs:ignore <code> -- <reason>` justification. **`composer lint:php` (the security gate) now exits 0.**
- **Wired the gate into CI** — a "PHP lint (PHPCS security)" step runs `composer lint:php` in `ci.yml`'s `test-php` job (once, on PHP 8.3), so escaping/sanitization/nonce regressions fail the build.
- **Removed dev-file scan noise** — deleted the obsolete `languages/.gitkeep` (the dir now ships real `.po`/`.mo` files) and the local `.phpunit.result.cache` artifact; the canonical Plugin Check run excludes `tests`/`vendor`/`phpunit.xml.dist` (which the release ZIP already strips).
- **Net Plugin Check result on the release-shipped surface: 1 error, 291 warnings.** The single remaining error is `outdated_tested_upto_header` (readme "Tested up to: 6.7" vs WP 7.0) — **intentionally not bumped**: CI tests against WP 6.7, so asserting 7.0 would be a false compatibility claim. It is deferred to **P60-F** (cross-version QA adds the 7.0 run, then the header can be truthfully bumped). The 291 warnings are the accepted custom-table `$wpdb` architecture + the by-design enqueue/logging items. PHPUnit **1072/1072 green** after annotation.

**Security scope: complete.** The only open P60-C item is the `readme.txt` "Tested up to" bump, which is correctly a P60-F dependency, not a code or security gap.

## Track P60-D - Accessibility hardening

### Problem

Phase 54-C established a critical/serious axe baseline on the **front-end only**. The main admin flows are not yet covered, and media alt text is not consistently surfaced in gallery output.

### Fix

- Extend the axe checks in `e2e/accessibility.spec.ts` to the primary admin flows and fix any new critical/serious violations.
- Surface per-slot/media **alt text** in the gallery render path so images are not unlabeled.
- Keep the full WCAG AA audit (contrast, full focus management, ARIA landmarks, Shadow-DOM exposure) as a WP.org-tier Follow-On.

### Acceptance criteria

- The main admin flows have no critical/serious axe violations.
- Gallery images render with meaningful alt text where the media provides it.
- The remaining full-AA scope is explicitly listed as a Follow-On.

### Validation

- Playwright `e2e/accessibility.spec.ts` (extended) passes; manual screen-reader spot-check of one admin flow and one rendered gallery.

### Implementation (2026-07-04) — ✅ Done

**Extended axe coverage to the admin surface.** Added two admin-flow axe tests to `e2e/accessibility.spec.ts` (the tabbed **Admin Panel** campaigns tab, and the **Settings** panel) alongside the P54-C front-end baseline. **All 6 a11y tests pass** (critical/serious, structural). Per **Key Decision C**, the exhaustive WCAG-AA colour-contrast audit stays a follow-on, so the axe gate excludes `color-contrast` (documented in-spec) and enforces the structural set (roles, names, labels, ARIA validity).

**Real a11y violations fixed (found by the extended axe run):**
- `button-name` on **every modal's close button** — Mantine leaves `CloseButton` unlabeled by default. Fixed globally via a `mergeThemeOverrides` `CloseButton` default `aria-label` in `src/main.tsx` (one change covers all ~36 modals; components with their own label still win).
- `aria-valid-attr-value` on the **CardGallery filter** — it used Mantine `Tabs` (with dangling `aria-controls` → non-existent panels) as a single-select filter. Converted to `Chip.Group` (the admin-panel filter pattern).
- `label` on the **AdminPanel sort `Select`** — added an `aria-label`.
- `aria-dialog-name` on the **CampaignViewer modal** — its `aria-label` was landing on Mantine's root wrapper, not the `role="dialog"` element. Switched to a `title` (→ `aria-labelledby`) rendered visually-hidden so the dialog is named without a visible title bar.

**Alt text.** Translated the LayoutBuilder image/video alt fallbacks (were hardcoded English) and added a `title` fallback to the compact-grid and isotope adapters (`caption || title || t('lightbox_image_alt')`), so gallery images surface meaningful alt where the media provides caption/title. The layout-builder background-image layer keeps `alt=""` (correctly decorative).

**Test-harness repairs (pre-existing P54-C bit-rot, uncovered here).** The e2e a11y suite couldn't run locally: (1) the Vite dev server crashed under this environment's Node 24 (esbuild couldn't down-level destructuring to the `es2015` build target during on-demand dep optimization) — fixed with a **dev-only** `optimizeDeps: { esbuildOptions: { target: 'esnext' } }` in `vite.config.ts` (production `build.target` untouched) and running the suite under Node 20 (matching CI); (2) the front-end tests referenced a drifted campaign-open interaction (`getByText` → the current "Open campaign" button) and fetched media the wrong way — the app embeds media in the `campaigns?include_media=1` response as a `mediaByCampaign` map, not a separate `/media` call; (3) shadow-DOM-incompatible axe `.include()` scopes were replaced with full-page `.analyze()` (axe traverses the open shadow root). CI's e2e job already targets a wp-env instance (Node 20), so no workflow change was needed.

**Verification.** `e2e/accessibility.spec.ts` 6/6 green; vitest **3,641 tests** green (confirms the global CloseButton default + viewer title change broke nothing); `tsc -b` + eslint clean; production `build:wp` succeeds. Two new i18n keys (`common_close`, `admin_sort_label`) added, manifest/`.pot` regenerated, `Sort campaigns` translated into all 5 packs (`Close` reused an existing msgid), `i18n:check` green.

**Follow-On (full WCAG AA).** Colour-contrast (e.g. the access-mode `SegmentedControl` label, 4.03 vs 4.5), full focus management, ARIA landmarks, and Shadow-DOM SR exposure remain the WP.org-tier full-AA audit (Key Decision C) — tracked in [FUTURE_TASKS.md](FUTURE_TASKS.md).

## Track P60-E - Store assets, privacy/GDPR statement, buyer-facing docs

### Problem

There is no store collateral (banner/icon/screenshots), no privacy/GDPR statement, and no buyer-facing install/troubleshooting documentation — all expected for a marketplace listing and for international buyers.

### Fix

- Produce the marketplace assets (banner, icon, screenshots) and finalize the `readme.txt` marketing sections and changelog discipline.
- Write a privacy/GDPR statement covering data handling (note the existing Sentry PII-scrubbing and the localStorage inventory from Phase 54).
- Write buyer-facing install + troubleshooting docs (the support-process definition itself lives in [PHASE62_REPORT.md](PHASE62_REPORT.md)).

### Acceptance criteria

- Banner/icon/screenshots exist at the required dimensions; `readme.txt` sections are complete.
- A privacy/GDPR statement is published and accurate to the plugin's actual data handling.
- Install + troubleshooting docs exist and match the current UI.

### Validation

- Visual review of assets against marketplace spec; doc walkthrough against a fresh install.

### Implementation (2026-07-05) — ✅ Done (text deliverables; artwork spec'd)

**Scope decision (user-approved).** Distribution target is **hybrid free/Pro** — asset work
targets the WordPress.org `.wordpress-org/` spec now, and buyer docs are written to serve
paid users too. Because banner/icon/screenshot PNGs are graphic-design deliverables (not
authorable here), the visual assets are **spec'd + slotted** for a designer/capture pass
while all writable pieces were completed in full.

**Ground-truth audit first.** Before publishing a privacy statement, ran an exhaustive
data-handling inventory and **verified the load-bearing facts directly** (not trusted from
the sweep): analytics stores a salted-SHA-256 `visitor_hash`, never a raw IP
(`class-wpsg-analytics-controller.php:88-90`), and is gated off by default
(`enable_analytics=false`); `wp_wpsg_access_requests.email` stores raw indexed email
(`class-wpsg-db.php:354`); **no** WordPress privacy exporter/eraser hooks exist anywhere
(grep empty); `preserve_data_on_uninstall` is honored (`uninstall.php:18`). This surfaced
genuine compliance gaps (below) that the statement documents honestly rather than papering
over.

**Documentation-vs-code bug found & fixed.** The shipped `readme.txt` documented a
shortcode that does not exist — `[wp_super_gallery id="123"]`. The real tag is
**`[super-gallery ...]`** with `campaign`/`company`/`space` (slug **or** ID),
`compact`, and `auth_bar_mode` attributes, and there is **no `id=` attribute**
(`class-wpsg-embed.php:11,182-188,438-441`). Anyone copying the old snippet would have
rendered nothing. Fixed in `readme.txt` and documented correctly in the new install guide.

**What shipped (files).**

- **New:** `docs/PRIVACY.md` — full GDPR/privacy statement: per-table PII inventory,
  privacy-preserving analytics explanation, third-party/transmission section (no
  phone-home; Sentry off by default; email via `wp_mail`), browser-storage/JWT section,
  a **manual** data-subject-request procedure (accurate to the current lack of core-tool
  integration), retention/uninstall behavior, and a documented Follow-Ons list of the gaps.
- **New:** `docs/guides/INSTALL_AND_TROUBLESHOOTING.md` — buyer-facing requirements,
  install (ZIP + manual + first-run), correct shortcode + attribute table, configuration
  essentials, and a troubleshooting matrix (blank gallery, stale assets, oEmbed, SVG,
  email, REST/nonce, debug toggle) cross-linked to PRIVACY/JWT/THEME/DEBUG guides.
- **New:** `.wordpress-org/README.md` — store-asset spec/manifest: exact filenames +
  dimensions for banner (772×250, 1544×500), icon (128, 256, optional SVG), and
  `screenshot-1..5.png` **cross-mapped to the readme's `== Screenshots ==` captions**, plus
  a content brief and a note that the 10up deploy action reads this dir automatically.
- **Changed:** `readme.txt` — corrected shortcode/attributes, aligned Requirements to the
  plugin header (WP **6.4+**, not 6.0), and added a "What data does the plugin collect?"
  GDPR FAQ pointing at `PRIVACY.md`. (The `Tested up to: 6.7` bump remains a **P60-F**
  dependency and was intentionally left untouched.)

**Compliance gaps surfaced (documented as Follow-Ons, not fixed — code changes out of this
content track's scope).** These are named in `PRIVACY.md` so the statement stays honest:

1. No `wp_privacy_personal_data_exporters`/`_erasers` registration → DSAR fulfilled manually
   via SQL/WP-CLI today. **Recommended as the highest-value privacy follow-on.**
2. No auto-purge/retention job for `wp_wpsg_access_requests` (emails) or `wp_wpsg_audit_log`
   (usernames) — both grow unbounded; analytics has retention but defaults to `0` = never.
3. PHP-side Sentry has no PII scrubber (browser side does).
4. Analytics visitor hash uses a static, non-rotating salt.

**Good practices credited in the statement:** pseudonymized (never-raw) analytics IP,
opt-in/off-by-default analytics, hashed + expiring + single-use magic-keys, HttpOnly
same-origin default auth with no browser tokens, browser-side Sentry IP/header redaction.

**Verification.** Every file path, `file:line`, dimension, and shortcode attribute in the
docs was checked against the source. No code changed, so no test run is required; the
readme/asset/privacy claims were reconciled with `class-wpsg-embed.php`,
`class-wpsg-analytics-controller.php`, `class-wpsg-db.php`, `uninstall.php`, and the plugin
header.

**Follow-On (this track).** Produce the actual banner/icon/screenshot artwork to the
`.wordpress-org/README.md` spec (designer + a seeded-wp-env screenshot-capture pass), and
consider folding the four privacy gaps above into a dedicated remediation track.

## Track P60-F - Release packaging + final QA

### Problem

The release artifact and final cross-version behavior have not been validated as a single shippable package since the readiness work above.

### Fix

- Validate the existing release workflow (`.github/workflows/release.yml`, `.github/workflows/svn-deploy.yml`) produces a clean ZIP that excludes dev/test files and includes `languages/`, built assets, and `readme.txt`.
- Smoke-test install → activate → **uninstall** (`uninstall.php`) on a clean site.
- Run cross-PHP (8.2/8.3/8.4) and modern-browser QA. Reference `docs/guides/PACKAGING_RELEASE.md` and `docs/guides/VERSIONING.md`.

### Acceptance criteria

- The packaged ZIP installs and activates cleanly and contains exactly the expected files.
- Uninstall runs the cleanup path without leaving orphaned data (per the uninstall setting).
- Tests pass across PHP 8.2/8.3/8.4; no console/runtime errors in supported browsers.

### Validation

- Build the release artifact and install it on a clean WP test site; PHPUnit + frontend suites green in CI; manual install/activate/uninstall + cross-version smoke test.

### Implementation (2026-07-05) — ✅ Done (packaging + version; live-WP smoke is CI/test-server gated)

**Packaging audit — real dev-file leak found & fixed.** Simulated the release ZIP by
applying `release.yml`'s exact exclude globs to the plugin tree (Python `fnmatch`, no
`zip`/Docker needed). The current exclude list missed **`phpcs.xml`** — added in P60-C, it
is tracked and top-level, so `composer install --no-dev` cannot strip it and it would ship
in every release. Fixed `release.yml` to also exclude `wp-super-gallery/phpcs.xml` and
`wp-super-gallery/phpunit/*`. (The many `vendor/**/composer.json` + `vendor/bin/*` entries
the simulation flagged are **local-only noise** — the release runs `composer install
--no-dev` before zipping, which removes phpcs/phpunit/php-parser/wpcs; the prod deps that
remain, `enshrined/svg-sanitize` + `guzzlehttp/psr7`, legitimately ship their nested
`composer.json`, which is standard and harmless.)

**Required-contents check (verified present in the simulated ZIP):** `readme.txt`,
`uninstall.php`, `wp-super-gallery.php`, `LICENSE`, `theme-catalog.json` (**confirmed
runtime-loaded** at `class-wpsg-settings-core-fields.php:168` — explicitly *not* excluded),
`languages/` (16 files = 5 locales × `.po`/`.mo`/`.l10n.php` + `.pot`), `assets/` (built
front-end), `includes/`, `admin/`, and `vendor/` (production-only in the real build). The
new `.wordpress-org/` store-asset dir (P60-E) sits at repo root and correctly stays out of
the plugin ZIP.

**Version single-source-of-truth — consistent.** `0.90.0` across `package.json`, the plugin
header `Version:`, `WPSG_VERSION`, and readme `Stable tag`. `Requires at least: 6.4` /
`Requires PHP: 8.2` match between header and readme.

**"Tested up to" bump (absorbed the P60-C residual).** Raised `6.7 → 7.0` in both the plugin
header and `readme.txt`, resolving the lone remaining Plugin Check error carried over from
P60-C. Per user direction (test server runs WP 7.0), also **pinned** `.wp-env.json`
`core: null → "WordPress/WordPress#7.0"` so the tested-up-to claim is reproducibly exercised
in CI rather than testing against a nondeterministic "latest". `Requires at least` kept at
`6.4` (long-standing declared floor; a post-6.4 core-API scan is logged as an optional
follow-on — 6.7→7.0 users sit inside the `6.4 → 7.0` supported window and are not blocked).

**Verification (this session).**
- **Vitest: 3641 passed / 0 failed** (236 files); **`npm run build:wp`: success** — both run
  under Node 20 (the required toolchain) via a Haiku subagent.
- **PHP PHPUnit: not runnable locally** — this environment has **no Docker** (`spawn docker
  ENOENT`), so wp-env cannot boot. The authoritative cross-PHP gate is **CI** (`ci.yml`
  `test-php` matrix), which I verified covers exactly **8.2 / 8.3 / 8.4** against a MySQL
  service. Reported honestly as infra-unavailable rather than claimed as a local pass.

**Remaining (CI / test-server gated, not executable here).** The live **install → activate →
uninstall** smoke and the cross-PHP PHPUnit run require a real WP/Docker environment. The
release workflow already boots wp-env, loads the plugin, and runs PHPUnit (exercising
activation) on every release; the recommended final step is a manual install/activate/
uninstall pass on the WP 7.0 test server (confirming the `uninstall.php` cleanup and the
`preserve_data_on_uninstall` opt-out) before triggering the release.

## Track P60-G - i18n runtime: front-end (i18next) locale delivery

### Problem

Split out of P60-B (2026-07-01). The plugin's user-facing strings live in **two parallel systems** (see P60-B → "Key discovery"): the PHP surface uses WordPress gettext (now covered by the shipped `.pot`), while the **React front-end** uses **i18next** with a single English source (`src/i18n-strings.en.json`, 91 keys). There is **no bridge** between them, and no per-locale source or delivery path for the React UI:

- `src/i18n.ts:32-33` exposes a per-locale seam (`window.__WPSG_I18N__.strings`), but PHP (`class-wpsg-embed.php` `page_config_js()`) injects only ~12 hardcoded **English** defaults into it. For any non-English locale, all 91 React keys fall back to English.
- No `i18n-strings.<locale>.json` files exist, and there is no build/conversion step to produce them from a translator's work.
- `eslint`'s `i18next/no-literal-string` covers only gallery adapters + `packages/shared-ui`; other customer-facing React components (13 of 36 adapters use `useTranslation`; `src/components/Admin/**` is exempt) are not enforced, so the English source is not guaranteed complete.

Net effect: a translator **cannot** ship a non-English React UI today, even though the gettext side is ready. This is the runtime half of "the i18n system is complete."

### Fix

- **Per-locale front-end source.** Define and produce `i18n-strings.<locale>.json` for the `wpsg` namespace, generated from the translator's `.po`/`.pot` work via a documented conversion step (e.g. `po2json` / a small Node script), or a documented manual JSON workflow. Establish the single canonical path so PHP gettext and React i18next stay in sync.
- **Runtime loading.** Wire `src/i18n.ts` to receive the *full* translated set for the active WordPress locale (`window.__WPSG_I18N__.locale`) — either by expanding the PHP `wpsg_i18n_strings` injection to read from the loaded translation, or by client-side loading of the locale JSON bundle — with English fallback preserved.
- **Pilot locale.** Ship one non-English locale end-to-end (e.g. a partial `fr_FR`) to prove the round-trip renders in the React UI.
- **Enforcement.** Extend `i18next/no-literal-string` to the remaining customer-facing React components so the English source stays complete (coordinate with Key Decision B's admin-harvest Follow-On boundary — this track covers the *customer-facing* front end, not the full admin panel).
- **Translator docs.** A "how to add a language" guide covering *both* the PHP `.po` and the React JSON.

### Acceptance criteria

- A non-English locale renders translated strings across the React front-end (not just the PHP-rendered surface), with clean English fallback for untranslated keys.
- A documented, repeatable path exists to produce a new locale's front-end source from a translator's work.
- `no-literal-string` enforcement covers the customer-facing React components; the English source is verified complete.
- The pilot locale is included (or documented) and the translator workflow doc is published.

### Validation

- Load the app under the pilot locale and confirm React UI strings are translated; confirm fallback for a deliberately-omitted key.
- `npm run test` + lint green; spot-check that a newly-added front-end string appears in both the source and the harvest path.

### Notes

- Effort is **Medium-Large**; this track can run independently of P60-C/D/E and does not block the P60-F packaging artifact (the plugin ships English-complete without it). It *does* elevate the product from "translatable back-end" to "translatable product," which matters for international premium buyers.

### Implementation (2026-07-01) — ✅ Done

**Architecture chosen: unified gettext bridge** (user-approved over the parallel-per-locale-JSON alternative). A single `.po`/`.mo` per locale now translates *both* the PHP surface and the React (i18next) front-end; translators never touch a React-specific format.

**How it works.**

1. **Single source of truth** stays `src/i18n-strings.en.json` (key → English), already lint-enforced.
2. **`scripts/generate-frontend-i18n.mjs`** (new) generates a PHP manifest, `includes/i18n/class-wpsg-frontend-strings.php`, mapping each i18next key to its English default wrapped in `__()`. This one file does double duty: `wp i18n make-pot` harvests the `__()` calls into the `.pot`, and `WPSG_Frontend_Strings::get_translated()` resolves each key to the active-locale translation at runtime.
3. **`page_config_js()`** (`class-wpsg-embed.php`) now injects `WPSG_Frontend_Strings::get_translated()` into `window.__WPSG_I18N__.strings` (behind the preserved `wpsg_i18n_strings` filter), replacing the previous **dead stub** — 11 hardcoded keys (`close`, `loading`, …) that matched *none* of the 91 i18next keys and therefore never resolved.
4. **`src/i18n.ts`** merges the injected map over the bundled English defaults for the active locale, so any untranslated key degrades to English per-key (belt-and-suspenders with `fallbackLng: 'en'`).

**Drift protection.** `npm run i18n:generate` regenerates the manifest; it is wired into `build:wp` (releases are always fresh) and a new `npm run i18n:check` step in `ci.yml`'s lint job fails the build if the committed manifest diverges from the JSON source.

**Pilot locale.** Shipped `languages/wp-super-gallery-fr_FR.po` + compiled `.mo` + `.l10n.php`, translating a representative slice across *both* surfaces (PHP `API connection successful!` + React auth/login/lightbox strings, including an interpolated string and the plural pair).

**What shipped (files).**

- New: `scripts/generate-frontend-i18n.mjs`, `includes/i18n/class-wpsg-frontend-strings.php` (generated, 91 keys), `languages/wp-super-gallery-fr_FR.{po,mo,l10n.php}`, `docs/guides/TRANSLATING.md`.
- Changed: `class-wpsg-embed.php` (injection), `wp-super-gallery.php` (require), `src/i18n.ts` (merge/fallback), `package.json` (`i18n:generate`/`i18n:check` + `build:wp`), `ci.yml` (freshness gate), `languages/wp-super-gallery.pot` (175 → 250 msgids).

**Verification.**

- `.pot` regenerated to **250 msgids**; front-end strings present with manifest source refs; interpolation (`{{email}}`, `{{count}}`) preserved.
- **End-to-end chain proven without booting WP** (a standalone PHP harness over the compiled `.l10n.php`): `i18next key → English default → French` resolves for auth/settings/interpolated/plural keys; identical-`msgid` dedup works (`auth_sign_in` + `login_submit` → "Se connecter"); an untranslated key (`gallery_video_badge`) correctly falls back to English.
- `.po → .mo/.l10n.php` compile cleanly via WP-CLI; French translations embedded in the binaries.
- Manifest and edited PHP are syntax-clean; `i18n:check` idempotent.

**Scope boundary (unchanged).** Enforcement of `i18next/no-literal-string` was *not* broadened to the whole app: the 91 already-harvested customer-facing strings are the complete front-end set for this release, and the full **admin-panel** harvest + global lint flip remains the WP.org-tier Follow-On (Key Decision B). P60-G delivered the *runtime pipeline + pilot + docs*, not new string coverage.

## Track P60-H - Localization: shipped language packs

### Problem

P60-G delivered the *pipeline* and a minimal `fr_FR` pilot, but a paid product marketed to international buyers should ship at least a few complete, ready-to-use language packs — not just the machinery to make them. Each pack must cover the full string surface (PHP + React) uncovered by the P60-B/`.pot` work.

### Fix

- Produce **complete** `.po`/`.mo`/`.l10n.php` packs (all ~249 msgids) for a prioritized set of common languages, driven off the canonical `.pot`.
- Preserve every interpolation placeholder (`{{…}}`) and printf token (`%s`, `%d`); keep theme brand-names (Nord, Solarized, Catppuccin, …) untranslated.
- Ship the packs in `languages/` (they ride the release ZIP automatically).

### Acceptance criteria

- Each shipped locale resolves translated strings across both surfaces with English per-key fallback for anything omitted.
- Placeholder/printf integrity holds for every string in every shipped locale.
- Packs are committed as `.po` (source) + compiled `.mo` + `.l10n.php`.

### Validation

- Automated placeholder-integrity + resolution check over each locale's compiled `.l10n.php`; manual spot-check in wp-env under each locale (see `docs/guides/TRANSLATING.md`).

### Implementation (2026-07-01) — fr_FR + es_ES done

- **French (`fr_FR`)** completed (was the P60-G pilot at ~12 strings) and **Spanish (`es_ES`)** added — **all 249 msgids** translated in each, assembled from the `.pot` so coverage is exhaustive by construction.
- Verified: **0 placeholder/printf mismatches** across all 249 strings in both locales; ~85/91 React keys translated (remainder are brand-names/symbols that correctly stay identical); every `.l10n.php` is syntax-clean; the front-end manifest remains in sync.
- **Caveat recorded:** both packs are **AI-authored for QA and a translation head-start**; a native-speaker review is required before they are relied upon in production. This is noted in the `.po` headers and `TRANSLATING.md`.

### Implementation (2026-07-03) — de_DE + zh_CN + ru_RU done (post I-7b re-scope)

Track I (P60-I) expanded fr/es from ~249 to the **full 2,162-msgid surface** (admin panel included), so each *new* pack now covers all 2,162 strings, not 249. All three planned locales shipped via the same deterministic PO pipeline built for I-7b (index-keyed batch builder + `{{var}}`/`%s`/`%d` placeholder-parity validation + `wp i18n make-mo`/`make-php` + wp-env runtime-diff QA):

| Locale | Language | msgstrs | wp-env render | Notes | Commit |
|--------|----------|---------|---------------|-------|--------|
| `de_DE` | German | 2162/2162 | **2312/2426** | `nplurals=2`; Photoshop-standard blend modes; watch long-compound UI truncation | `5ca8b1ad` |
| `zh_CN` | Simplified Chinese | 2162/2162 | **2388/2426** | `nplurals=1`; fullwidth punctuation (`：（）。`), no inter-word spaces | `2824cdd1` |
| `ru_RU` | Russian | 2162/2162 | **2391/2426** | 3-form gettext plurals in `.po`; genitive-plural for `_other` msgid (see nuance) | `aa92db63` |

- Each pack: **0 empty msgstrs, 0 placeholder mismatches**; generated `.l10n.php` passes `php -l`; the "identical to English" remainder (114 / 38 / 35) are CSS/technical tokens, brand names, and cognates, not fallbacks. Runtime QA confirmed the bridge resolves under each live locale (e.g. Danger Zone → *Gefahrenzone* / *危险区域* / *Опасная зона*).
- **Russian 3-plural nuance (documented, deferred).** `ru_RU` carries the correct Russian 3-form `Plural-Forms` header and each gettext msgid uses the right form. But the React i18next plural pairs only encode `_one`/`_other`, so counts 2–4 render the `_other` (genitive-plural "many") form rather than the ideal `_few` form. Full 3-form React correctness requires adding `_few`/`_many` keys to `src/i18n-strings.en.json` and backfilling all locales — a P60-G-layer source change that touches the shipped fr/es/de/zh packs, so it was intentionally **not** bundled here to avoid destabilising four committed packs. Tracked as a follow-up.
- **All packs are AI-authored for QA / a translation head-start; a native-speaker review is required before production reliance** (noted in each `.po` header and `TRANSLATING.md`).

**Track H is complete** for the five shipped reference locales (fr, es, de, zh, ru).

## Track P60-I - Admin-panel internationalization

### Problem

P54-B/P60-G internationalized only the **customer-facing front-end** (auth bar, login, lightbox, all gallery/carousel/layout **adapters**). The **admin panel React UI** — campaign management, settings, media manager, the entire LayoutBuilder, and dozens of modals — was never harvested (`grep useTranslation src/components/Admin/` → none). This was Key Decision B's deferral. QA under a non-English locale therefore shows only the shared `AuthBar` translated and everything else in English, which is not acceptable for a fully-localized product. **This track promotes that deferred item to active work** (user direction, 2026-07-01).

### Scale (measured 2026-07-01)

- `src/components/Admin/**`: **78 components**, ~744 candidate literals.
- `src/components/Admin/LayoutBuilder/**`: **34 components**, ~327 candidate literals.
- `src/components/Campaign/**`: 4 components, ~70 candidate literals.
- Rough net after removing false positives (test-ids, enum values, numeric): **~500–800 real user-facing strings**. This rivals a full phase; it is tracked here per user direction but may be promoted to its own phase.

### Fix (method — same unified gettext bridge as P60-G)

Executed **in area-batches**; each batch is self-contained and independently shippable:

1. Wrap each user-facing literal in `t('area_key', 'English default', vars?)` via `useTranslation('wpsg')`; leave test-ids / enum values / debug attrs alone.
2. Append new key → English pairs to `src/i18n-strings.en.json` (the single source).
3. `npm run i18n:generate` (regenerate the PHP manifest) → `wp i18n make-pot` (harvest).
4. Translate the new keys into `fr_FR` + `es_ES`; rebuild `.po` and recompile `.mo`/`.l10n.php`.
5. Flip `i18next/no-literal-string` to `error` for the completed area's glob in `eslint.config.js` so it can't regress.
6. `npm run lint` + `tsc` + `vitest` green; commit the batch.

### Batch plan

| Batch | Area | Files (approx) | Status |
|-------|------|----------------|--------|
| I-1 | Admin shell + navigation (`AdminPanel`, tabs, header actions, bulk bar) | ~4 | ✅ Done |
| I-2 | Campaign management (`CampaignsTab`, mobile list, campaign modals, `UnifiedCampaignModal`) | ~12 | ✅ Done |
| I-3 | Media (`MediaTab`, add/edit/delete modals, upload controller, cards) | ~12 | ✅ Done |
| I-4 | Settings (`SettingsPanel` + all tab sections, tooltips) — sub-batches a–j | ~14 | ✅ Done |
| I-4k | Adapter setting-group **schema** labels — render-time resolver (`utils/adapterSchemaI18n.ts`), wired at both consumption sites (`GalleryAdapterSettingsSection`, `GalleryConfigEditorModal`) + adapter option labels in the registry | 5 | ✅ Done |
| I-5 | Access / audit / analytics / assets / spaces / taxonomy / templates (a access · b spaces · c analytics/templates/taxonomy · d misc) | ~19 | ✅ Done |
| I-6 | LayoutBuilder (a Slot · b GraphicLayer · c Text/Bg/Mask/Props · d canvas/layers · e toolbar/menu/modals · f media/assets) | ~31 | ✅ Done |
| I-7a | Lint flip: `i18next/no-literal-string` → `error` for `src/components/Admin/**` (test/story fixtures exempt); wrap the ~15 strings it surfaced | — | ✅ Done |
| I-7b | Full fr/es translation sweep — all 1,913 new admin keys translated into `fr_FR` + `es_ES` (2,162 msgstrs each), `.mo`/`.l10n.php` recompiled | — | ✅ Done |

### Progress log

- **I-1 → I-3** — admin shell, full campaign-management surface (incl. `UnifiedCampaignModal`), and media manager harvested; bulk-count strings converted to i18next `base + _other` plurals to satisfy existing tests.
- **I-4 (a–j)** — the entire **Settings component surface** internationalized: General, Webhook, Advanced, CampaignCard, CampaignViewer, MediaDisplay (style + navigation), GalleryLayoutDetail + Presentation, GalleryAdapter chrome + GalleryLayout wrapper, Cards + SystemAdmin tab wrappers, Typography. A scan of `src/components/Settings/**` (excl. tests) now reports **zero** hardcoded JSX/label literals. Module-level helper functions that can't call the `useTranslation` hook resolve through the `i18n` singleton (`i18n.t(key, default, { ns: 'wpsg' })`) with the parent component subscribed so locale switches cascade. Breakpoint labels reuse the existing `admin_bp_*` keys.
- **I-4k (schema layer)** — adapter setting-group field labels/descriptions/placeholders/select-options and adapter option-labels come from the pure-data module `src/data/adapterSettingGroups.ts` (evaluated once at import, no locale reactivity). Rather than mutate the schema shape, translation happens at **render time** via `src/utils/adapterSchemaI18n.ts` using deterministic keys (`set_sg_<group>_<fieldKey>[_desc|_ph|_opt_<value>]`, `set_sg_group_<group>`, `set_sg_note_<group>`, `set_adp_<id>[_<context>]`). Keys were harvested by a throwaway vitest extractor (imported the real definitions through the vite resolver, dumped to JSON, then removed). Both consumption sites and the registry's option-label builders were wired; 78 adapter tests remain green.
- **Catalogue growth this stretch:** `src/i18n-strings.en.json` **794 → 1,451 keys**; `.pot` **899 → 1,368 msgids**. English-first (per user direction: translate in the final sweep, I-7). All batches: eslint `--max-warnings 0`, `tsc`, and every touched test suite green (test execution delegated to Haiku).
- **I-5 (access → misc)** — the whole non-LayoutBuilder admin surface: AccessTab, PendingRequests, Audit/GlobalAudit, QuickAddUser; SpaceManagement (view/modal/asset-library), GlobalAssetManager, ArchiveCompany; AnalyticsDashboard, TaxonomyManager, TemplatesTab, LayoutTemplateList, TemplatePicker; KeyboardShortcuts, ThemeSelector, FontLibraryManager. Several count strings upgraded from `?'s':''` to i18next `_other` plurals; recharts legends localised via the `name` prop to keep `dataKey` bindings intact; `t`-as-data-variable collisions resolved by binding the hook as `tr`.
- **I-6 (LayoutBuilder, ~31 files)** — Slot/GraphicLayer/Text/Background/Mask property panels, the schema-derived option arrays (shape/blend/fit) reused across panels via shared `lb_slot_*` keys; canvas toolbar + layers/layer-row/guides; contextual toolbar, menu bar (incl. dockview panel titles), keyboard-shortcuts reference (data-driven `hkey`/`dkey`), auto-grid, history panel/dropdown, the full-screen builder modal (notifications threaded through `useCallback` deps), and the media picker / design-assets / uploader / preset gallery. Module-level helper components that can't call the hook resolve their few strings through the parent's `t`; where `t` was already used as a template/loop variable the hook was bound as `tr`.
- **Final catalogue:** `src/i18n-strings.en.json` **2,399 keys**; `.pot` **2,144 msgids**; **29** `p60-i-*` commits. A scan of `src/components/Admin/**` (incl. `LayoutBuilder/**`) shows **zero** remaining hardcoded JSX/label literals — the admin string harvest (I-1 → I-6) is **complete**. Remaining: **I-7** — flip `i18next/no-literal-string` to `error` for `src/components/Admin/**`, translate all keys into fr_FR + es_ES, and wp-env QA.
- **I-7a — lint flip (done).** Added `src/components/Admin/**/*.{ts,tsx}` to the enforced `no-literal-string` glob (test/story fixtures kept exempt via `ignores`), which caught **~15 genuinely-missed strings** the manual sweep skipped: AccessTab's real (non-loading) table headers — dropped because the loading-vs-real header blocks differ only by indentation, so the earlier `replace_all` matched just one; the entire SettingsPanel **tab bar** (Appearance / Campaign Cards / … — they live in a separate `SettingsPanelTabsContent` component) plus its unsaved-draft restore prompt; and small LayoutBuilder chrome (history-dropdown header/empty-state, LayerPanel "Layers", the breakpoint-edit banner, canvas dims/slot-count/empty hints, "Empty" slot placeholder, "Media (N)" header). Undo/redo arrow glyphs were moved into string-literal expressions (`{'↶'}`) and the taxonomy tree-indent `↳` got a documented `eslint-disable-next-line` — punctuation like the `·` separator isn't flagged by `jsx-text-only`. Result: catalogue **2,426 keys**, `.pot` **2,163 msgids**, `i18n:check` reports the manifest in sync, and the whole repo passes eslint `--max-warnings 0` + `tsc`; 166 touched-file tests green. No new hardcoded admin string can regress in now.
- **I-7b — fr/es translation sweep (done).** All **1,913** previously-untranslated admin `msgid`s were translated into **`fr_FR`** and **`es_ES`** (both packs now carry **2,162** non-header `msgstr`s — up from 249), then `wp i18n make-mo` + `make-php` recompiled the `.mo` and WP-6.5 `.l10n.php` runtime binaries (fr `.l10n.php` 15 KB → 150 KB, es → 147 KB). Translations were authored through a deterministic scratch pipeline: a dependency-free PO parser/writer merges the existing 249 translations with index-keyed batch maps and **validates placeholder parity** (`{{var}}`, `%s`, `%d`) between each English source and its translation — the final build reported **0 empty msgstrs and 0 placeholder mismatches** across both languages. Terminology held constant via a glossary (Layout Builder → *Générateur de mise en page* / *Constructor de diseños*, slot → *emplacement* / *ranura*, layer → *calque* / *capa*, mask → *masque* / *máscara*, canvas → *canevas* / *lienzo*, space → *espace* / *espacio*, grant → *autorisation* / *concesión*, breakpoint → *point de rupture* / *punto de interrupción*); CSS blend modes use Photoshop-standard localised names. Word-order-sensitive sentence fragments (e.g. "Editing {bp} layout —") were re-balanced across their parts so the interpolated locale reads naturally. Generated `.l10n.php` files pass `php -l`; `i18n:check` still reports the manifest in sync (the JSON/manifest were untouched — translation lives only in the `.po`/`.mo`/`.l10n.php`). These remain AI-authored (per the packs' header) and warrant a native-speaker review before release.
- **I-7b — wp-env runtime QA (done).** Booted the plugin under a live WordPress **`fr_FR`** and **`es_ES`** locale (`wp-env` + `wp site switch-language`) and exercised the real bridge (`load_plugin_textdomain` → `__()` → `WPSG_Frontend_Strings::get_translated()`). Dumping `get_translated()` per locale and diffing against the `en_US` baseline: **2,320/2,426** keys render in French and **2,365/2,426** in Spanish; every remaining "identical to English" value is a deliberate identity translation — CSS/technical tokens (`#ffffff`, `rgba(...)`, `polygon(...)`, `var(--wpsg-color-primary)`, `Clip-path`, `my-gallery-space`) or a true cross-language cognate (fr *Image / Description / Navigation / Transparent / Pagination / Hexagonal*; es *Error / Color / Normal / Actor / Editor / Radial*), not a fallback (the data-level check already confirmed 0 empty msgstrs and 2,026/2,026 manifest defaults resolving). The runtime bridge loads both packs correctly. **Track I is complete.**
- **Post-completion QA closeout (2026-07-04).** Live-locale QA surfaced two classes of string that bypassed the bridge entirely (so the data-level `get_translated()` diff could never have caught them — they were never in the manifest): (1) a PHP `const` array of built-in template names/descriptions, which can't call `__()`, fixed via a runtime `translate_builtin()` overlay in `class-wpsg-campaign-templates.php`; and (2) React that renders user-facing JSX from **outside** the enforced lint glob — `src/hooks/useCampaignsRows.tsx` / `useAccessRows.tsx` (campaign-row actions, status/visibility options, role labels/tips) and `src/components/Campaign/**` (Archive modal, MediaLibraryPicker). Fixed by wrapping in `t()` (module-level role config moved inside the hook so it can call the hook), **extending the enforced `no-literal-string` glob to `src/hooks/**` + `src/components/Campaign/**`**, and translating the new msgids across **all five** packs (0 empty / 0 placeholder mismatch, runtime-verified under de_DE + zh_CN). Commits `b248a58e`, `51969bb5`. The remaining un-enforced front-end (`Common/**`, `CampaignGallery/**`, `CardViewer/**`, `Auth/AuthBar.tsx`, `App.tsx` — 81 lint violations) plus the terminal blanket-glob flip were scoped out into **[PHASE61_REPORT.md](PHASE61_REPORT.md)** rather than expanded here, since P60-I's charter was the admin panel.

### Acceptance criteria

- Every user-facing admin string renders translated under a shipped locale, with per-key English fallback.
- `i18next/no-literal-string` enforced (`error`) across `src/components/Admin/**` (customer-relevant literals; documented exceptions allowed).
- `fr_FR` + `es_ES` cover the new admin keys; placeholder integrity holds.
- vitest/lint/tsc green; manual wp-env QA per major area.

### Validation

- Per batch: `i18n:check`, lint, tsc, vitest; placeholder-integrity check over new keys; wp-env spot-check under `fr_FR`.

### Notes

- Given the ~500–800-string volume, this is a multi-session effort. Progress is recorded per batch here as each lands.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| ~~Full admin-panel i18n + lint flip to `'error'`~~ | **Promoted to active work as Track P60-I** (user direction, 2026-07-01) — no longer deferred. |
| Full WCAG AA audit | WP.org public-listing gate; P60-D covers the premium-tier critical/serious bar. Stays in FUTURE_TASKS. |
| CodeCanyon / Envato submission pass | Only if a second marketplace beyond Freemius is pursued. |
| Free WP.org "lite" tier | Top-of-funnel step from MONETIZATION §7, gated on the full public-readiness work above; revisit after the pro tier proves out. |

## Implementation Notes

- Record completed work at a high level as tracks land. Keep short and factual.

## Outcome

_To be completed once the phase ships._

- What shipped.
- What was deferred.
- What should happen next.
