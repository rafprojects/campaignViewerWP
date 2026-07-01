# Phase 60 - Release / Store-Readiness (Freemius-targeted)

**Status:** In Progress
**Created:** 2026-06-26
**Last updated:** 2026-07-01

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P60-A | Version & metadata single-source-of-truth + `readme.txt` polish | ✅ Done (2026-07-01) | Small |
| P60-B | i18n completeness — generate `.pot`, confirm user-facing coverage, scope admin harvest | ✅ Done (2026-07-01) | Medium |
| P60-C | Plugin Check + escaping/sanitization compliance pass | Planned | Medium |
| P60-D | Accessibility hardening (extend the P54-C baseline to key admin flows) | Planned | Medium |
| P60-E | Store assets, privacy/GDPR statement, buyer-facing docs | Planned | Small-Medium |
| P60-F | Release packaging + final cross-version/browser QA | Planned | Small-Medium |
| P60-G | i18n runtime — front-end (i18next) locale delivery for the React app | ✅ Done (2026-07-01) | Medium-Large |

---

## Rationale

The product is feature-complete enough to sell; this phase closes the **release-readiness** gaps required to ship to a marketplace. The chosen distribution target is **Freemius premium** (see [MONETIZATION_OPTIONS.md](MONETIZATION_OPTIONS.md) §7), so this phase scopes to the "Premium / marketplace — Med-High delta" bar in §5 — not the heavier full-public WP.org bar.

1. **What triggered it.** Phase 54 set a target-independent must-fix floor and deferred the distribution-specific work to FUTURE_TASKS pending a path decision. The path is now chosen (Freemius premium), so the readiness items it gates are scheduled here. The monetization/licensing build itself lives in [PHASE61_REPORT.md](PHASE61_REPORT.md).
2. **Why it belongs together.** Every track is a precondition for a credible paid release — correct version metadata, translatable strings, escaping/Plugin-Check compliance, accessible admin flows, store collateral, and a validated package — and none adds product features.
3. **Success.** A reviewer (and a buyer) sees a plugin with consistent version metadata, a generated translation template, a clean Plugin Check / escaping pass, no new critical a11y violations in the main flows, complete store collateral and a privacy statement, and a release artifact that installs/activates/uninstalls cleanly across supported PHP versions.

> **Split from monetization.** This phase makes the plugin *shippable*; [PHASE61_REPORT.md](PHASE61_REPORT.md) makes it *sellable* (gating seams + Freemius SDK + pricing + buyer docs). Land P60 first.

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

## Track P60-E - Store assets, privacy/GDPR statement, buyer-facing docs

### Problem

There is no store collateral (banner/icon/screenshots), no privacy/GDPR statement, and no buyer-facing install/troubleshooting documentation — all expected for a marketplace listing and for international buyers.

### Fix

- Produce the marketplace assets (banner, icon, screenshots) and finalize the `readme.txt` marketing sections and changelog discipline.
- Write a privacy/GDPR statement covering data handling (note the existing Sentry PII-scrubbing and the localStorage inventory from Phase 54).
- Write buyer-facing install + troubleshooting docs (the support-process definition itself lives in [PHASE61_REPORT.md](PHASE61_REPORT.md)).

### Acceptance criteria

- Banner/icon/screenshots exist at the required dimensions; `readme.txt` sections are complete.
- A privacy/GDPR statement is published and accurate to the plugin's actual data handling.
- Install + troubleshooting docs exist and match the current UI.

### Validation

- Visual review of assets against marketplace spec; doc walkthrough against a fresh install.

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

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full admin-panel i18n + lint flip to `'error'` | WP.org public-listing gate, not required for the Freemius premium launch. Stays in [FUTURE_TASKS.md](FUTURE_TASKS.md). |
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
