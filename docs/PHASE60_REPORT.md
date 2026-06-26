# Phase 60 - Release / Store-Readiness (Freemius-targeted)

**Status:** Planned
**Created:** 2026-06-26
**Last updated:** 2026-06-26

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P60-A | Version & metadata single-source-of-truth + `readme.txt` polish | Planned | Small |
| P60-B | i18n completeness — generate `.pot`, confirm user-facing coverage, scope admin harvest | Planned | Medium |
| P60-C | Plugin Check + escaping/sanitization compliance pass | Planned | Medium |
| P60-D | Accessibility hardening (extend the P54-C baseline to key admin flows) | Planned | Medium |
| P60-E | Store assets, privacy/GDPR statement, buyer-facing docs | Planned | Small-Medium |
| P60-F | Release packaging + final cross-version/browser QA | Planned | Small-Medium |

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
5. **P60-F (packaging + final QA)** — last; validates everything above as a single installable artifact.

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
