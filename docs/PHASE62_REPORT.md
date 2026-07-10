# Phase 62 - Monetization & Licensing (Freemius)

**Status:** In Progress — engineering tracks complete (P62-A/B/D/E, validated 2026-07-06); phase ship blocked on human M1–M4 (P62-C pricing + sandbox validation + doc placeholders)
**Created:** 2026-06-26
**Last updated:** 2026-07-06

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P62-A | Pro/free gating seams (new `WPSG_License` entitlement seam + 3 LayoutBuilder pro features) | Code complete (sandbox-pending) | Medium |
| P62-B | Freemius SDK integration (credential-ready bootstrap) | Code complete (sandbox-pending) | Medium |
| P62-C | Pricing & licensing model (tiers, renewals, trial) | Planned — human/dashboard (M1-M3) | Small-Medium |
| P62-D | Buyer-facing docs + support process | Docs authored (human M1–M4 placeholders) | Small-Medium |
| P62-E | i18n locale-coverage CI gate (PR-review hardening) | Complete | Small |

> **Scope note (2026-07-06).** Two decisions taken during planning narrowed this phase from the original draft:
> 1. **Adapter-level gating is OUT of scope.** All 14 registered adapters stay free. P62-A gates only the 3 already-identified LayoutBuilder pro features (text layers, per-breakpoint responsive overrides, starter template library). Adapter gating is a Follow-On Candidate.
> 2. **The entitlement seam is a NEW `WPSG_License` class, not `WPSG_Permissions`.** See the corrected Key Decision C / new Decision E below.
>
> No Freemius account exists yet, so all code ships **credential-ready**: with no credentials it is a safe no-op defaulting to the free tier. Real activation/checkout/update testing is **blocked on M1-M3** (human account/dashboard setup) — see Execution Priority and the P62-B/C validation notes.

---

## Rationale

With the product feature-complete and [PHASE60_REPORT.md](archive/phases/PHASE60_REPORT.md) making it *shippable*, this phase makes it *sellable*: it wires the pro/free gating, the licensing/update SDK, the pricing model, and the support process for the chosen target — **Freemius premium** (see [MONETIZATION_OPTIONS.md](MONETIZATION_OPTIONS.md) §3, §7).

1. **What triggered it.** MONETIZATION §7 recommends premium-via-Freemius as the first monetized release, because the SDK collapses license activation, authenticated auto-updates, checkout, and EU-VAT/sales-tax (merchant of record) into one drop-in — weeks of otherwise-bespoke, security-critical, availability-critical infrastructure (MONETIZATION §3, §4).
2. **Why it belongs together.** Gating, the SDK, pricing, and buyer support are one go-to-market unit; shipping any subset is not a sellable product. They build on two gating seams that already exist (the adapter registry and the `WPSG_Permissions` map), so this is additive, not a rewrite.
3. **Success.** A buyer can purchase a tiered annual license, activate it (with a trial path), receive authenticated auto-updates, and unlock pro features cleanly — while the free surface stays fully functional — with documented support and refund policies.

> **Depends on Phase 60.** Do not integrate the SDK or gate features until the store-readiness work (version metadata, compliance, packaging) has landed; gating on top of a non-shippable artifact is wasted effort.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Licensing/update provider | **Freemius** (MONETIZATION §3). Lowest LOE; merchant-of-record handles tax; first-class freemium gating that maps onto the existing seams. Revisit EDD/self-hosted only if fees/lock-in become material at scale. |
| B | Monetization model | **Annual subscription + tiered by site count** (single / 5-site / agency), with renewals and a trial (MONETIZATION §2). Best fit for a builder that needs ongoing WP-compat maintenance. |
| C | ~~Gating seams~~ (**superseded by E**) | Original draft proposed reusing the adapter registry + `WPSG_Permissions` map. **Corrected:** adapter gating is out of scope (all adapters stay free), and `WPSG_Permissions` is a role/capability gate, not a license gate. See E. |
| D | Pro feature set | **Gate 3 LayoutBuilder capabilities only** this phase: text layers (from [PHASE59_REPORT.md](archive/phases/PHASE59_REPORT.md)), per-breakpoint responsive (from [PHASE58_REPORT.md](archive/phases/PHASE58_REPORT.md) P58-B), and the starter template library (P58-C). Advanced-adapter gating is deferred (Follow-On). Core gallery + builder stay free and fully functional. |
| E | Entitlement seam | **A new `WPSG_License` PHP class** is the single source of truth for license/entitlement state — deliberately orthogonal to `WPSG_Permissions`. `WPSG_Permissions` answers "who may call this REST route" (role → 403 on failure); `WPSG_License` answers "is this pro feature unlocked" (entitlement → silent payload degradation on failure). It wraps Freemius's `can_use_premium_code()` when the SDK is live and falls back to the `wpsg_license_is_pro` filter (default free) otherwise. |

## Execution Priority

1. **P62-A (gating seams)** — define what is pro and wire the cut-points first; the SDK enforces against these.
2. **P62-B (Freemius SDK)** — integrate activation/updates/analytics once the gates exist to wrap.
3. **P62-C (pricing model)** — configure tiers/renewals/trial in Freemius; depends on the gated feature set being settled.
4. **P62-D (docs + support)** — last; the ongoing-cost surface, written against the finished purchase/activation flow.

---

## Track P62-A - Pro/free gating seams

### Problem

The plugin has no notion of paid features. To monetize without a rewrite, the free/pro boundary must be expressed at clean, already-existing cut-points rather than scattered through the code.

### Fix

- Introduce a new `WPSG_License` class (`includes/class-wpsg-license.php`) as the single entitlement source of truth, with per-feature constants (`FEATURE_LAYOUT_TEXT_LAYERS`, `FEATURE_LAYOUT_BREAKPOINT_OVERRIDES`, `FEATURE_LAYOUT_STARTER_LIBRARY`) and a filter-backed stub (`wpsg_license_is_pro`, default free) for the pre-credentials state.
- **Server-side enforcement (defense-in-depth):** strip/freeze the gated persisted fields (`texts`, `breakpointOverrides`) in the layout-template write path (`includes/class-wpsg-layout-templates.php` — `create()`/`update()`/`sanitize_template_data()` via a shared `enforce_license_gates()` helper). An unlicensed save succeeds but degrades the pro payload; existing saved data is frozen, never destroyed. This closes the gap where a direct REST POST would bypass the client gate.
- **Client-side gating (UX):** expose license state via `WPSG_Embed::page_config_js()` → `window.__WPSG_CONFIG__.license` → `src/hooks/useWpsgLicense.ts`, and gate the 3 entry points (add-text button in `LayoutBuilderLayersPanel.tsx`, the breakpoint switcher in `LayoutBuilderCanvasPanel.tsx`, the "From Preset" button in `LayoutTemplateList.tsx`) with an upsell notification (`src/utils/wpsgUpsell.tsx`). The underlying data models/hooks are untouched.
- **Not touched:** the adapter registry / `AdapterRegistration` (adapter gating deferred), `WPSG_Permissions` (role gate stays orthogonal), and all rendering paths (`LayoutCanvas`, `LayoutBuilderGallery`, `resolveSlotForBreakpoint`) so already-saved pro content always renders.

### Acceptance criteria

- Pro features are inaccessible without a valid license and degrade gracefully (clear upsell, no broken UI) when locked. ✅
- The free surface remains fully functional with no license; already-saved pro content still renders. ✅
- Gating flows through the single `WPSG_License` seam (server enforcement + client UX), not duplicated ad hoc. ✅

### Validation

- ✅ `npm run test` (Vitest): `useWpsgLicense`, the 3 UI gates (Layers/Canvas/TemplateList) — gated + ungated branches.
- ✅ PHPUnit: `WPSG_License_Test`, plus strip/freeze cases added to `WPSG_Layout_Templates_Test` and `WPSG_Import_Sanitization_Test`.
- ✅ `npm run i18n:check`, `tsc -b`, ESLint, PHPCS security ruleset.
- ⏳ Manual QA toggling a simulated license via `add_filter('wpsg_license_is_pro', '__return_true')` in a local mu-plugin (recommended before release).

## Track P62-B - Freemius SDK integration

### Problem

A paid path needs license activation, authenticated auto-updates, and checkout/tax handling — none of which the plugin has today, and all of which are costly and risky to build in-house.

### Fix

- Add a **credential-ready** Freemius bootstrap block in `wp-super-gallery.php` (defines `wpsg_fs()`): reads the `wpsg_freemius_config` filter, and when the Plugin ID / public key are empty or the vendored SDK is absent, returns `null` — a safe no-op making **zero** network calls (mirrors the `wpsg_sentry_dsn` pattern). `WPSG_License` (P62-A) already delegates to `wpsg_fs()->can_use_premium_code()` when the SDK is live. The composer dependency `freemius/wordpress-sdk` (pinned `^2.13`, resolved 2.13.3) is added to `composer.json`/`composer.lock`.
- **Auto-updates:** handled automatically by the SDK once `is_premium` + real credentials are configured (reads the existing `WPSG_VERSION` SoT). No separate code path.
- **Analytics/consent (MONETIZATION §6):** rely on Freemius's built-in opt-in/skip dialog, which fires on first activation *after* real credentials exist. No custom consent UI, and nothing transmits pre-credentials because `wpsg_fs()` is a no-op. Nothing to implement.

### Acceptance criteria

- ✅ (code) SDK bootstrap is credential-ready and a safe no-op without credentials; `WPSG_License` flips the P62-A gates when the SDK reports premium.
- ⏳ (sandbox, M1-M3) License activation/deactivation end-to-end; authenticated auto-update delivery; opt-in dialog appearing on activation.

### Validation

- ✅ Verifiable now with the stub: PHPUnit/Vitest green with `wpsg_fs()` returning `null`; no network calls before opt-in (there is no SDK call path until credentials exist).
- ⏳ **Blocked on M1-M3 (real Freemius sandbox account):** activate → verify pro unlock → simulate an update → deactivate → verify re-lock; confirm the opt-in dialog and that `can_use_premium_code()` reflects a real purchased/trial/expired license. Do not mark this track "shipped" until this passes — current state is **code complete, sandbox-pending**.

## Track P62-C - Pricing & licensing model

### Problem

There is no pricing or licensing structure defined. Without tiers, renewals, and a trial, there is nothing to sell or to enforce seat counts against.

### Fix

- Define annual-subscription pricing tiered by site count (single / 5-site / agency) with renewal handling and a trial, configured in Freemius (MONETIZATION §2).
- Validate the numbers against direct competitors (Envira, FooGallery, Modula, NextGEN) before committing.

### Acceptance criteria

- Tiers, renewal terms, and the trial are configured and enforce the correct seat counts.
- Pricing is sanity-checked against competitor benchmarks and recorded in the doc.

### Validation

- Walk a test purchase through each tier in the Freemius sandbox; confirm seat enforcement and renewal/trial behavior.

## Track P62-D - Buyer-facing docs + support process

### Problem

Support is the dominant *ongoing* cost of any paid path (MONETIZATION §6), and buyers need clear license-activation, troubleshooting, refund, and support-channel information. None of this exists yet.

### Fix

- ✅ New `docs/guides/LICENSE_ACTIVATION.md` (activation / deactivation / troubleshooting), cross-linked from the P60-E install guide.
- ✅ Two FAQ entries in `wp-plugin/wp-super-gallery/readme.txt` (license activation, refund policy) with clearly-marked `[PLACEHOLDER]` values.
- ✅ Troubleshooting-matrix row in `docs/guides/INSTALL_AND_TROUBLESHOOTING.md` pointing at the activation guide.
- ⏳ Final support-channel/SLA and refund-policy text (M4) and exact Freemius-screen captures (M1-M3) filled in by the account owner before publishing.

### Acceptance criteria

- ✅ License activation/troubleshooting docs exist (written against the SDK's standard flow; exact screens pending M1-M3).
- ⏳ Real support channel + SLA and refund policy published (placeholders shipped; human fills M4).

### Validation

- ✅ Docs build/link-check; placeholders clearly marked.
- ⏳ Walkthrough against the real sandbox activation flow once M1-M3 land; review refund policy against Freemius/marketplace requirements.

## Track P62-E - i18n locale-coverage CI gate (PR-review hardening)

> Added out-of-band during the P62-A/B PR review (2026-07-06); not part of the original phase plan. See the **PR Review & Fix Pass** section for how the underlying defect surfaced.

### Problem

The i18n pipeline (see [TRANSLATING.md](guides/TRANSLATING.md)) has a single English source of truth — `src/i18n-strings.en.json` — that is (a) generated into a PHP `__()` manifest, then (b) harvested by `wp i18n make-pot` into `languages/wp-super-gallery.pot`, translated per locale in `wp-super-gallery-<locale>.po`, and compiled to `.mo`/`.l10n.php`. The existing guard, `npm run i18n:check`, asserts only step (a): that the en source and the generated PHP manifest agree. **Nothing asserts step (b)** — that the reference locales actually translate those strings.

The failure mode is silent and easy to hit: add a user-facing string to the en source, run `npm run i18n:generate` (so `i18n:check` stays green), ship it — and it renders **English-only** on every non-English site, regressing the Phase 61 5-locale-completeness guarantee. This is exactly what the P62-A `upsell_*` strings did (see PR Review & Fix Pass); `i18n:check` was green throughout.

### Fix

- **New `scripts/check-i18n-locales.mjs`.** For every unique front-end source string (a value in `src/i18n-strings.en.json`), assert each reference locale's committed `.po` contains that `msgid` with a **non-empty, non-fuzzy** `msgstr`. It reads the `.po` directly (the `.mo`/`.l10n.php` are compiled from it), so it fails *before* the binaries are built, and on failure prints the exact missing strings per locale plus the remediation commands. Reference locales: `de_DE`, `es_ES`, `fr_FR`, `ru_RU`, `zh_CN`.
- **Exposed as `npm run i18n:check:locales`.**
- **CI-enforced.** Wired into `.github/workflows/ci.yml` (`lint-typecheck` job) as a dedicated **i18n locale coverage** step immediately after the existing **i18n manifest freshness** step, so the two guards read as a pair: manifest sync (step a) + locale coverage (step b).

### Acceptance criteria

- ✅ Passes on the current tree — all 2,267 unique front-end strings translated across all 5 reference locales.
- ✅ Fails (exit 1) with an actionable per-locale report when a front-end string is added without a translation in every reference locale (verified by a negative test: injecting a throwaway key failed all 5 locales, then reverted).
- ✅ No false positives — fuzzy entries (excluded from the compiled `.mo`) and empty `msgstr` both count as untranslated; shared/duplicate English strings collapse to a single `msgid`; the header entry is skipped.

### Validation

- ✅ `npm run i18n:check:locales` green on the committed tree; injected-string negative test fails as designed.
- **Scope note.** The gate covers the **front-end** manifest strings — the class that regressed. The broader PHP-only admin/server gettext strings (which carry plural/context nuances) are not gated here; extending coverage to the full `.pot` is a Follow-On Candidate.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| **Adapter-level pro gating** (`pro` flag on `AdapterRegistration`, license check in `resolveAdapter`) | Explicitly out of scope this phase — all 14 adapters stay free. Revisit only once a specific adapter is deliberately productized as pro, ideally informed by Freemius usage analytics once live. |
| Free WP.org "lite" tier (top-of-funnel) | MONETIZATION §7 stage 3; gated on the full public-readiness work (WCAG AA still open in [FUTURE_TASKS.md](FUTURE_TASKS.md); admin i18n now resolved via P60-I/P61). Revisit once the pro tier proves out. |
| EDD / self-hosted licensing | Only if Freemius per-transaction fees or lock-in become material at scale (MONETIZATION §3–4). |
| Affiliate program | Freemius supports it; defer until there is a renewal base worth amplifying. |
| Per-feature Freemius plan mapping | `WPSG_License::can_use_feature()` already accepts a feature key; today all 3 constants collapse to one boolean. Split only if pricing later differentiates the features into separate plans. |
| Save-response "license notice" | When `update()`'s freeze silently drops a pro-field edit, the REST response could carry a flag so the client shows a targeted "your edit wasn't saved — upgrade to keep it" banner instead of a generic upsell. Nice-to-have. |
| Extend the locale-coverage gate to the full PHP surface | Track P62-E gates the front-end manifest strings (the class that regressed). Extending `check-i18n-locales.mjs` to assert every `.pot` msgid — including PHP-only admin/server strings — is more complete but must handle gettext plural/context nuances that the front-end source does not have. Defer until a PHP-surface string actually ships untranslated. |

## Implementation Notes

- **P62-A / P62-B code (2026-07-06).** New `includes/class-wpsg-license.php` (entitlement seam). Credential-ready Freemius bootstrap (`wpsg_fs()`) + `freemius/wordpress-sdk ^2.13` in `composer.json`/`composer.lock`. Server-side strip/freeze of `texts`/`breakpointOverrides` in `class-wpsg-layout-templates.php`. License state exposed via `class-wpsg-embed.php::page_config_js()`. JS: `src/hooks/useWpsgLicense.ts`, `src/utils/wpsgUpsell.tsx`, and 3 UI gates (`LayoutBuilderLayersPanel`, `LayoutBuilderCanvasPanel`, `LayoutTemplateList`). 5 new i18n keys (`upsell_*`) + regenerated PHP manifest.
- **Design call — graceful degradation:** existing saved pro data always renders; only *new/edited* pro content is gated once a license check is live (`update()` freezes to the stored value, `create()`/import strip to empty). No live migration (pre-launch).
- **Credential injection:** real Plugin ID / public key are supplied via the `wpsg_freemius_config` filter from **outside** this repo (mu-plugin or wp-config constant) — never committed.

## PR Review & Fix Pass (2026-07-06)

A pre-merge self-review of the P62-A/P62-B branch (`feat/phase62-monetization-licensing`, commits `6567590c` + `de0269b5`) combining a manual PR review with an inline `/code-review` pass (line-by-line, removed-behaviour, cross-file caller tracing, reuse/simplification/efficiency, altitude, and CLAUDE.md-conventions angles). No open GitHub PR existed, so the GitHub-comment steps of the review workflow were skipped; commits/pushes were kept for the fix.

### Verdict

The branch held up well. The license/permission split is correctly orthogonal, the shared `enforce_license_gates()` helper sits at the right altitude (server enforcement is not duplicated per call-site), the create-strip / update-freeze semantics never destroy already-saved pro data, and the Freemius bootstrap is a genuine no-op without credentials. Two candidate defects were investigated and **refuted**:

- **Fatal-error risk from the un-guarded `WPSG_License::can_use_feature()` call in `enforce_license_gates()`** — refuted: `includes/class-wpsg-license.php` is required (`wp-super-gallery.php:100`) before `includes/class-wpsg-layout-templates.php` (`:124`), and the latter has no lazy-load path, so the class is always loaded when the helper runs.
- **Pro data stripped from *exports*** — refuted: the only non-test caller of `sanitize_template_data()` (`includes/rest/class-wpsg-export-controller.php:191`) is an *import* routine (it builds posts from an incoming payload), so strip-to-empty there is the intended create-path behaviour, and it is covered by `WPSG_Import_Sanitization_Test`.

### Finding — i18n locale-coverage gap (fixed)

**Severity:** Medium. The 5 new user-facing `upsell_*` strings (`upsell_pro_title`, `upsell_cta`, `upsell_text_layers`, `upsell_breakpoints`, `upsell_starter_library`) were added to `src/i18n-strings.en.json` and the generated PHP manifest, but were never harvested into `languages/wp-super-gallery.pot` or translated in any of the 5 reference locales (de_DE, es_ES, fr_FR, ru_RU, zh_CN). A German/Spanish/French/Russian/Chinese site would therefore render the upsell toasts in English, regressing the Phase 61 5-locale-completeness standard. `npm run i18n:check` only validates the en-JSON ↔ PHP-manifest sync, so it did not catch the missing `.po`/`.mo` coverage.

**Fix** (per [TRANSLATING.md](guides/TRANSLATING.md), which authorises AI-authored reference translations pending native-speaker review):

- Regenerated `languages/wp-super-gallery.pot` via `wp i18n make-pot` (adds the 5 msgids).
- Appended AI-authored translations for all 5 strings to each of the 5 locale `.po` files (surgical `+21` lines/file). `wp i18n update-po` was **rejected** because it reflows the entire file into a ~2,900-line diff; gettext is order-independent, so a targeted append is equivalent and reviewable.
- Recompiled the runtime binaries with `wp i18n make-mo` and `wp i18n make-php`; verified each locale's `.l10n.php` now carries the translation.

### QA — no regressions

- ✅ **Vitest:** 3,653 tests across 239 files green (incl. `useWpsgLicense` + the 3 gating suites).
- ✅ **ESLint / `tsc -b` / `npm run i18n:check`:** clean.
- ✅ **PHPUnit** (wp-env, via the `php-testing` skill): 1,095 tests / 13,141 assertions, 0 failures (2 pre-existing skips). `WPSG_License_Test` (13), `WPSG_Layout_Templates_Test` (60), and `WPSG_Import_Sanitization_Test` (12) all green.

The root cause was a **process gap**, not a one-off: nothing caught a front-end string that lacks a `msgstr` in a reference locale, because `npm run i18n:check` only validates the en-JSON ↔ PHP-manifest sync. That gate is now implemented and CI-enforced — see **Track P62-E** below.

## Outcome

**Engineering-complete; phase ship blocked on human M1–M4 (Freemius account/dashboard).** Track statuses validated against the codebase on 2026-07-06:

- ✅ **P62-A (gating seams) — code complete & verified.** `WPSG_License` seam, server-side `enforce_license_gates()`, the 3 LayoutBuilder client gates, and license state in `WPSG_Embed::page_config_js()` all present. PHPUnit green (`WPSG_License_Test` +13, plus the strip/freeze cases in `WPSG_Layout_Templates_Test`/`WPSG_Import_Sanitization_Test`); Vitest gating suites green.
- ✅ **P62-B (Freemius SDK) — code complete & verified.** `wpsg_fs()` credential-ready bootstrap present; `freemius/wordpress-sdk ^2.13` (resolved 2.13.3) in `composer.json`/`composer.lock`; a safe no-op without credentials.
- ✅ **P62-E (i18n locale-coverage gate) — complete.** `scripts/check-i18n-locales.mjs` + `npm run i18n:check:locales` + CI step; green across 2,267 front-end strings × 5 locales.
- 🟡 **P62-D (buyer docs) — authored, human fill pending.** `docs/guides/LICENSE_ACTIVATION.md`, the two `readme.txt` FAQ entries, and the troubleshooting row all present; remaining `[PLACEHOLDER]` markers (support email, refund policy) are filled by the account owner at M4.
- ⏳ **P62-C (pricing model) — not started (human-only).** Tiers / renewals / trial are configured in the Freemius dashboard; no code deliverable, blocked pre-account.
- ⏳ **Sandbox validation (P62-A/B)** — activation → pro-unlock → update → deactivate → re-lock, plus the opt-in dialog; blocked on the real Freemius sandbox (M1–M3). Do not flip A/B to "shipped" until this passes.
- **Deferred (Follow-On):** adapter-level gating; WP.org lite tier (WCAG AA); affiliate program; per-feature plan mapping; full-PHP-surface locale gate.
- **Next:** human completes M1–M4 (Freemius account, product, pricing/trial config, support/refund text), injects real credentials via the `wpsg_freemius_config` filter, then runs the P62-B/C sandbox checklist before flipping the phase to shipped. The full go-live runbook — with **M1–M4 defined** — is [guides/MARKETPLACE_READINESS.md](guides/MARKETPLACE_READINESS.md); the pro decisions + dev guide are in [guides/PRO_FEATURES.md](guides/PRO_FEATURES.md).
