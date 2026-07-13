# Phase 62 - Monetization & Licensing (Freemius)

**Status:** In Progress — premium-track engineering complete (P62-A/B/D/E, validated 2026-07-06); premium ship blocked on human M1–M4 (P62-C pricing + sandbox validation + doc placeholders). **Scope expanded 2026-07-10:** distribution moved from premium-only to **freemium** (free WordPress.org "lite" build + premium via Freemius), adding **P62-F–K** (WP.org enablement, buyer legal, go-live hardening). P62-F (split-mechanism spike) **complete 2026-07-10**; P62-G–K Planned.
**Created:** 2026-06-26
**Last updated:** 2026-07-10

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P62-A | Pro/free gating seams (new `WPSG_License` entitlement seam + 3 LayoutBuilder pro features) | Code complete (sandbox-pending) | Medium |
| P62-B | Freemius SDK integration (credential-ready bootstrap) | Code complete (sandbox-pending) | Medium |
| P62-C | Pricing & licensing model (tiers, renewals, trial) | Planned — human/dashboard (M1-M3) | Small-Medium |
| P62-D | Buyer-facing docs + support process | Docs authored (human M1–M4 placeholders) | Small-Medium |
| P62-E | i18n locale-coverage CI gate (PR-review hardening) | Complete | Small |
| P62-F | Spike: frontend free/premium split mechanism (compiled-bundle stripping) | Complete (spike, 2026-07-10) | Small |
| P62-G | WP.org "lite" build: free/paid code split (build-time `__WPSG_PREMIUM__` flag) | Core complete (2026-07-11); release wiring → P62-I | Large |
| P62-H | Full WCAG AA audit (WP.org public-listing quality bar) | Contrast done (2026-07-11); manual AT audit = human follow-on | Large |
| P62-I | WP.org submission + dual-channel release (Plugin Check, artwork, SVN) | Planned | Medium |
| P62-J | Buyer/user legal: EULA + privacy statement | Planned | Small-Medium |
| P62-K | Go-live hardening: SDK-derived upgrade URL + packaging | Done (2026-07-11) | Small |

> **Scope note (2026-07-06).** Two decisions taken during planning narrowed this phase from the original draft:
> 1. **Adapter-level gating is OUT of scope.** All 14 registered adapters stay free. P62-A gates only the 3 already-identified LayoutBuilder pro features (text layers, per-breakpoint responsive overrides, starter template library). Adapter gating is a Follow-On Candidate.
> 2. **The entitlement seam is a NEW `WPSG_License` class, not `WPSG_Permissions`.** See the corrected Key Decision C / new Decision E below.
>
> No Freemius account exists yet, so all code ships **credential-ready**: with no credentials it is a safe no-op defaulting to the free tier. Real activation/checkout/update testing is **blocked on M1-M3** (human account/dashboard setup) — see Execution Priority and the P62-B/C validation notes.

> **Scope note (2026-07-10) — freemium expansion.** The distribution model changed from **premium-only** to **freemium**: a free "lite" build on WordPress.org (top-of-funnel) alongside the premium build sold via Freemius. WordPress.org forbids locked/premium code in a hosted plugin, so the single-build **runtime gating** (P62-A) that suffices for the premium build is **not** sufficient for a `.org` free build — the Pro code must be *physically stripped*, and Freemius cannot strip inside the plugin's compiled React bundle. This adds tracks **P62-F–K** below (spike → code split → WCAG AA → WP.org submission → buyer legal → go-live hardening). As a result, the prior "WP.org lite tier" Follow-On Candidate and the deferred **Full WCAG AA** / **Store Listing Artwork** items ([FUTURE_TASKS.md](FUTURE_TASKS.md)) are **promoted into this phase**. The new tracks started **Planned**; **P62-F (the split-mechanism spike) has since completed** (see its track section). The premium tracks (A–E) do not depend on them and can ship first.

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
| F | Distribution model (**expanded 2026-07-10**) | **Freemium: free WordPress.org "lite" build + premium via Freemius** (was premium-only; MONETIZATION §7 stage 3 pulled forward). WP.org bars locked code, so the free build must be produced by **Freemius deployment stripping** (`__premium_only` markers) **plus a build-level free/premium split** for the compiled React bundle (Freemius cannot strip inside a bundled asset). See P62-F (spike) → P62-G (split). Premium (A–E) can still ship first, lite-follow — see the Recommendations in [guides/MARKETPLACE_READINESS.md](guides/MARKETPLACE_READINESS.md) §10. |

## Execution Priority

1. **P62-A (gating seams)** — define what is pro and wire the cut-points first; the SDK enforces against these.
2. **P62-B (Freemius SDK)** — integrate activation/updates/analytics once the gates exist to wrap.
3. **P62-C (pricing model)** — configure tiers/renewals/trial in Freemius; depends on the gated feature set being settled.
4. **P62-D (docs + support)** — last; the ongoing-cost surface, written against the finished purchase/activation flow.

**Freemium expansion (P62-F–K, added 2026-07-10) — sequenced after / in parallel with the premium launch:**

5. **P62-F (split-mechanism spike)** — decide the compiled-bundle free/premium split approach; gates P62-G's estimate.
6. **P62-G (WP.org lite code split)** — implement the chosen split so Freemius can generate a compliant free build.
7. **P62-H (full WCAG AA)** — the public-listing quality bar (decouplable from launch — not a hard WP.org gate).
8. **P62-I (WP.org submission + dual-channel release)** — Plugin Check on the stripped build, listing artwork, `.org` review, SVN deploy of the free build; Freemius serves the premium build.
9. **P62-J (EULA + privacy)** — product EULA + extend `docs/PRIVACY.md`; independent of the code split.
10. **P62-K (go-live hardening)** — SDK-derived upgrade URL + `.distignore`; small, do any time before launch.

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

## Track P62-F - Spike: frontend free/premium split mechanism

> Added 2026-07-10 with the freemium expansion. **Complete (spike) — 2026-07-10.** Full decision + rationale in [guides/PRO_FEATURES.md](guides/PRO_FEATURES.md) §7.

### Problem

Freemius's deployment processor strips premium code at the **file/function level** (`__premium_only` filename suffixes, `is__premium_only()` blocks). But WP Super Gallery's front end ships as a **single compiled Vite/React bundle** (`assets/`, copied from the root `dist/`), and Freemius **cannot strip code inside a compiled asset**. So a WP.org-compliant free build (P62-G) needs a **build-level** free/premium split, and the mechanism choice drives P62-G's size and shape — it must be settled first.

### Fix

- Time-boxed spike evaluating three options:
  1. **Conditional Vite entries** — emit separate `free` / `premium` bundles; PHP enqueues one per `is_premium`.
  2. **Dynamic-imported Pro chunk** — lazy-load the Pro UI (`LayoutBuilderLayersPanel` text layers, `LayoutBuilderCanvasPanel` breakpoint-override editing, `LayoutTemplateList` starter gallery) from a chunk excluded from the free build.
  3. **Separate `*__premium_only` Pro JS asset(s)** — ship the Pro UI as distinct files Freemius strips, loaded only in the premium build.
- Build a minimal PoC of the chosen option; confirm the free bundle contains **no Pro functionality** and that a Freemius deployment produces a clean free build.

### Decision (outcome)

**Chosen mechanism: a build-time flag `__WPSG_PREMIUM__`** (Vite `define`), building two variants from the single entry; the free build (`WPSG_PREMIUM=false`) lets Rollup **dead-code-eliminate** the Pro authoring code (incl. its lazy `import()`s). This is the only option that also strips *inline* Pro code (text/breakpoint authoring lives inside `LayoutBuilder*Panel.tsx`, not a separate chunk); lazy-chunk gating alone can't, and multi-entry adds PHP/manifest churn without solving inline code. **Two-layer model:** `__WPSG_PREMIUM__` = code *presence* (build); `isPro` = *access* (runtime). Full rationale, gating pattern, authoring-vs-renderer boundary, and deployment consequence are in [guides/PRO_FEATURES.md](guides/PRO_FEATURES.md) §7.

**Deployment finding (revises P62-I):** Freemius cannot strip a compiled JS bundle, so the free `.org` build is **self-built** (`npm run build:wp:free`) and self-deployed via SVN; Freemius gets the premium build. Freemius JS auto-strip is not used (PHP may still use `__premium_only`).

### Acceptance criteria

- ✅ Recorded decision (mechanism + rationale) in [guides/PRO_FEATURES.md](guides/PRO_FEATURES.md) §7.
- ✅ PoC free bundle verified to exclude Pro code — kept first slice: the **starter library** gated behind `__WPSG_PREMIUM__` (`src/components/Admin/LayoutTemplateList.tsx`; flag infra in `vite.config.ts` + `src/vite-env.d.ts` + `package.json` `build:free`/`build:wp:free`).
- ✅ P62-G build-out estimate recorded (below).

### Validation

- ✅ **Two builds compared.** Free build (`WPSG_PREMIUM=false npm run build`): **no** `PresetGalleryModal-*.js` chunk (58 vs 59 chunks) and **no** preset data (`Magazine Spread` absent) — Pro functionality + data physically stripped. Premium build contains both; its main bundle is byte-size-identical to pre-change (208.8 kB gz), so the premium build is effectively unchanged.
- ✅ `tsc -b`, ESLint, and Vitest (239 files / 3,653 tests) all green.
- Note: the Pro *i18n strings* (`lb_preset_desc`, `upsell_starter_library`) remain in the shared string resource — text, not code; WP.org-compliant (PRO_FEATURES §7). The local `check-bundle-size.mjs` overages (`index` 208.8 kB, `LayoutBuilderModal` 50.1 kB) are **pre-existing on `main`** and not a CI gate — unrelated to this change.

### P62-G build-out estimate (~Medium-Large, ~5–7 dev-days)

(a) relocate the 2 pure renderers (`TextLayerContent`, `GraphicLayerContent`) out of `Admin/LayoutBuilder/` into a shared module (~0.5d); (b) flag-gate text-layer authoring — `LayoutBuilderLayersPanel` add-text UI + `TextPropertiesPanel` + `useLayoutBuilderText` (~1–1.5d); (c) flag-gate breakpoint-override authoring in `LayoutBuilderCanvasPanel` (~1–1.5d); (d) starter library — done in P62-F; (e) PHP `is__premium_only()` / `*__premium_only.php` for the server Pro-field path in `class-wpsg-layout-templates.php` (~0.5d); (f) readme `fs_premium_only` fences (trivial); (g) `build:wp:free` release wiring + a CI "free build excludes Pro chunks" assertion (~0.5–1d).

## Track P62-G - WP.org "lite" build: free/paid code split

> Added 2026-07-10 with the freemium expansion. **Core complete (2026-07-11): the free build strips all Pro code, is produced by `build:wp:free`, and is CI-gated on every PR. The remaining dual-channel release/SVN wiring was folded into P62-I. See Progress.**

### Progress (2026-07-11)

**Client-side split complete (a–d)** — the free build (`WPSG_PREMIUM=false`) now strips all three Pro features' authoring code, verified by chunk/string inspection; existing saved Pro content still renders (renderers kept):

- **(a)** Relocated the pure layer renderers (`TextLayerContent`, `GraphicLayerContent`) out of `Admin/LayoutBuilder/` into the public-renderer dir, and extracted `GOOGLE_FONT_NAMES` → `src/data/googleFontNames.ts`, so the renderer path no longer imports authoring code (commit `60baf938`).
- **(b)** Gated text-layer authoring: the "Add text" control is absent from the free build, and `TextPropertiesPanel` (+ its heavy `TypographyEditor`) is a flag-gated lazy import — no `TextPropertiesPanel-*.js` chunk in the free build (commit `0673fd3b`).
- **(c)** Gated the breakpoint edit-mode switcher — no `breakpoint-edit-selector`/`fit-to-viewport` in the free build; free users edit desktop only (commit `601594d3`).
- **(d)** Starter library — done in P62-F.
- Each slice verified: `tsc -b`, ESLint, all 3,653 Vitest tests green; premium retains all Pro chunks, free omits them.

**Reframing of (e)/(f) under the self-built free-build model (P62-F finding):** the free `.org` build is produced by `build:wp:free` (self-built), **not** Freemius auto-strip — so the original `__premium_only` / `fs_premium_only` plan does not apply:

- **(e) PHP — no `__premium_only` stripping needed or appropriate.** The server code is *license-enforcement* (`WPSG_License` + `enforce_license_gates()`), not premium *feature* code — it must **stay** in the free build (it strips Pro fields for unlicensed sites, keeping the free tier free). There is no premium-only server feature code to remove; WP.org permits license-check + Freemius-SDK code in a freemium plugin.
- **(f) readme — done** (`fs_premium_only` fences do not apply under the self-built model). The single `readme.txt` now presents the 3 Pro features as a **"WP Super Gallery Pro (optional upgrade)"** section — not as included free features — and drops "text" from the free layer list (commit `79d454b6`).

**(g) — done (lean scope, chosen 2026-07-11).** Added `scripts/check-free-build-clean.mjs` + `npm run check:free-build` (builds with `WPSG_PREMIUM=false`, fails on any Pro chunk/marker), wired as a **blocking gate on every PR** in `ci.yml`, plus a **hard guard** on `svn-deploy.yml` so the premium ZIP can't reach `.org` (commit `aee0517d`). Verified: the gate fails on a premium build (lists all 5 Pro markers) and passes on a free build (58 clean assets). **Deferred to P62-I:** the full dual-channel release wiring — `release.yml` emitting a separate free ZIP (via `build:wp:free`) and `svn-deploy.yml` switched to that free ZIP (removing the guard) — since the actual `.org` launch is gated on the Freemius account (M1), WCAG (P62-H), and artwork anyway.

### Problem

WordPress.org requires **all hosted code to be free and fully functional** — a plugin "may not contain functionality that is restricted or locked, only to be made available by payment." The current design ships all 3 Pro features in one build, gated at runtime: correct for the Freemius premium build, but non-compliant for a free `.org` listing, where the Pro code must be **absent**, not merely gated.

### Fix

- **PHP:** move/guard Pro-only server logic with `is__premium_only()` blocks and/or `*__premium_only.php` files — the Pro-field acceptance around `enforce_license_gates()` in `includes/class-wpsg-layout-templates.php`. (Server enforcement already *strips* Pro fields for graceful degradation; this ensures the free build carries no Pro code path at all.)
- **Frontend:** implement the free/premium split chosen in **P62-F** so the free bundle excludes the Pro UI. Upsell prompts may remain in the free build (upselling is permitted); only the Pro *functionality* must be gone.
- **readme.txt:** wrap Pro-only marketing copy in `[//]: # fs_premium_only_begin` / `fs_premium_only_end` (and `fs_free_only`) fences so the free readme doesn't advertise locked features as free.

### Acceptance criteria

- ⏳ Freemius deployment generates a free build with **zero** Pro code (PHP + JS); the premium build is unchanged.
- ⏳ The free build is functionally complete for all non-Pro features; Pro content authored on a licensed site still renders where applicable.

### Validation

- ⏳ Deploy via a Freemius sandbox; inspect the generated free ZIP for Pro-code absence; run the existing PHPUnit/Vitest suites against the split build; manual smoke of the free build.

## Track P62-H - Full WCAG AA audit

> Added 2026-07-10; carried over from the FUTURE_TASKS backlog (origin P54-C → P60-D baselines). **In progress (2026-07-11): the contrast increment is complete (deterministic AA gate + 18-theme fixes + e2e contrast re-enabled); the manual assistive-tech audit is a documented human follow-on.**

### Problem

A public WordPress.org listing raises the accessibility bar. [PHASE60_REPORT.md](archive/phases/PHASE60_REPORT.md) P60-D landed the **critical/serious** axe baseline on the main admin flows only; contrast (1.4.3) was **disabled** in the axe suite, and a full WCAG **AA** pass (contrast, focus management, ARIA landmarks, Shadow-DOM screen-reader exposure) across all flows remained open.

### Progress (2026-07-11) — contrast increment

- **Deterministic contrast gate (blocking, fast CI).** New `packages/theme-engine/src/contrastAudit.ts` + `contrastAudit.test.ts` assert every bundled theme's intended text/background pairs meet WCAG AA (4.5:1), reusing a new exported `contrastRatio` in `validation.ts`. 23 per-theme tests run in the existing Vitest CI job (no browser).
- **Fixed 18 of 23 themes.** The audit found muted text below AA on secondary surfaces across 18 themes (systematic pattern). All fixed with minimal, hue-preserving bumps to **foreground** text tokens only (`textMuted`/`textMuted2`, and `text` in darcula/tokyo-night/forest-whisper) — surfaces/backgrounds untouched, so elevation/palette identity are preserved.
- **Re-enabled `color-contrast`** in the manual e2e axe suite (`e2e/accessibility.spec.ts`) for runtime coverage on top of the token gate.
- **Static focus/ARIA review + human AT checklist** documented in [guides/ACCESSIBILITY.md](guides/ACCESSIBILITY.md) (findings: no plugin-owned landmarks [WP-admin-context nuance], `outline:none` to verify, LayoutBuilder Escape disabled; + a keyboard/SR/Shadow-DOM checklist).
- Verified: `tsc`, ESLint, full Vitest (240 files / 3,676 tests) green.

### Remaining (human follow-on — not automatable)

- ⏳ Manual assistive-tech audit — follow the step-by-step QA script in [guides/ACCESSIBILITY_MANUAL_AUDIT.md](guides/ACCESSIBILITY_MANUAL_AUDIT.md) (living doc: setup, per-surface test scripts, issue log, coverage tracker): keyboard walkthrough, real screen-reader (NVDA/VoiceOver) pass, focus order/traps, **Shadow-DOM SR exposure**, reduced-motion, 200% reflow. Requires a human with an AT stack.

### Acceptance criteria

- ✅ Contrast (1.4.3): every theme AA, gated deterministically in blocking CI; e2e color-contrast re-enabled.
- ⏳ Focus / keyboard / landmark / SR (2.1.x, 2.4.x, 1.3.1, 4.1.2): reviewed at code level + documented; real-AT verification is the human follow-on.

### Validation

- ✅ `contrastAudit.test.ts` green across 23 themes; full suite green; theme diffs are value-only (hue preserved).
- ⏳ Manual AT walkthrough (ACCESSIBILITY.md §3).

> **Not a hard WP.org gate.** WCAG AA is the project's *quality bar* for a public listing, not a WordPress.org submission requirement. The lite tier can launch before full AA lands if desired (see Recommendations in the readiness runbook).

## Track P62-I - WP.org submission + dual-channel release

> Added 2026-07-10 with the freemium expansion. **Planned — no code yet; depends on P62-G.**

### Problem

The freemium model ships two artifacts from one codebase: the **free "lite"** build on WordPress.org and the **premium** build via Freemius. That requires `.org` review + SVN publication for the free build and confirmation that Freemius serves the premium build — none of which is wired end-to-end yet.

### Fix

- **Plugin Check (PCP):** re-run against the **stripped free build** (P60 achieved compliance on the single build; keep `Tested up to` current — WP 7.0.x as of 2026-07).
- **Listing assets:** finalize `readme.txt` + commission **Store Listing Artwork** (banner / icon / screenshots — spec/manifest in [`.wordpress-org/README.md`](../.wordpress-org/README.md), origin P60-E; carried over from the FUTURE_TASKS backlog and removed from that queue).
- **Submission + deploy:** submit the lite build to the WP.org plugin review (manual, ~1–10 days); on approval, deploy the exact stripped free bytes via the existing `.github/workflows/svn-deploy.yml`; confirm Freemius serves the premium build via `is_premium`.
- **Dual-channel release wiring (absorbed from P62-G(g), 2026-07-11):** update `release.yml` to also emit a **free ZIP** (`npm run build:wp:free`, a separate output so it doesn't clobber the premium `assets/`), point `svn-deploy.yml` at that free ZIP, and **remove the P62-G guard** that currently blocks SVN deploy. (P62-G already shipped the free build + a blocking CI Pro-code gate.)
- **Decision (updated by the P62-F spike, 2026-07-10):** for the **front end**, Freemius auto-strip is **not viable** — it cannot strip a compiled JS bundle — so the free build is **self-built** (`npm run build:wp:free`) and self-deployed via SVN; Freemius serves the premium build. PHP server code may still use Freemius `__premium_only`. (Supersedes the earlier lean toward Freemius auto-strip for the front end.)
- **Optional CI enhancement:** adopt the official **"Deploy on Freemius" GitHub Action** to auto-upload premium builds on release.

### Acceptance criteria

- ⏳ Plugin Check green on the stripped free build; readme + artwork complete.
- ⏳ Free build approved on WP.org and published via SVN; premium build served by Freemius.

### Validation

- ⏳ Run Plugin Check locally on the free ZIP; complete a real WP.org review cycle; install the published free build on a clean site and the premium build via a Freemius sandbox license.

## Track P62-J - Buyer/user legal: EULA + privacy

> Added 2026-07-10 with the freemium expansion. **Planned — no code yet.**

### Problem

A professional paid listing needs a product **EULA** and a clear **privacy/data-collection statement**. P62-D covers support email + refund policy, but there is no EULA, and the existing `docs/PRIVACY.md` predates the Freemius checkout + SDK opt-in analytics.

### Fix

- Add a product **EULA**, wired into the Freemius listing and referenced from [guides/LICENSE_ACTIVATION.md](guides/LICENSE_ACTIVATION.md).
- **Extend** `docs/PRIVACY.md` (do not duplicate) to cover Freemius-checkout data handling and the SDK opt-in analytics, satisfying GDPR/CCPA disclosure for the paid path.

### Acceptance criteria

- ⏳ EULA published on the listing and linked from buyer docs.
- ⏳ `docs/PRIVACY.md` covers the Freemius checkout + opt-in analytics data flows.

### Validation

- ⏳ Legal-text review; link-check the EULA references; confirm the privacy statement matches what Freemius/the SDK actually collect.

## Track P62-K - Go-live hardening: SDK-derived upgrade URL + packaging

> Added 2026-07-10 with the freemium expansion. **Done (2026-07-11): SDK-derived upgrade URL + `.distignore` shipped; M2 freemium flags documented in `wpsg_fs()`.**

### Problem

Two small go-live footguns: (1) `WPSG_License::get_upgrade_url()` (`includes/class-wpsg-license.php:107-109`) reads only the `wpsg_license_upgrade_url` filter and defaults to the placeholder `https://your-site.tld/pricing` — unlike its sibling `get_tier()`, it never delegates to the live SDK, so a forgotten filter sends buyers to a dead URL instead of Freemius checkout. (2) The release ZIP excludes are duplicated inline in `release.yml`, and the `phpunit/*` glob wouldn't catch a stray top-level `phpunit` file.

### Fix

- Make `get_upgrade_url()` prefer `wpsg_fs()->get_upgrade_url()` when `is_sdk_active()` (mirror `get_tier()` at `class-wpsg-license.php:91-101`), falling back to the filter/placeholder otherwise.
- Add a `.distignore` to centralize packaging excludes (low urgency — clean CI releases are unaffected — but removes drift risk).
- Reconcile the **M2** `fs_dynamic_init` note with the **freemium** flags the Freemius-generated snippet sets and the current init (`wp-super-gallery.php:78-90`) omits: `has_premium_version => true`, a distinct `premium_slug`, `is_org_compliant => true`, and a non-empty `menu['first-path']`.

### Acceptance criteria

- ✅ `get_upgrade_url()` prefers `wpsg_fs()->get_upgrade_url()` when `is_sdk_active()` (mirrors `get_tier()`), filter-overridable, placeholder fallback otherwise (`includes/class-wpsg-license.php`).
- ✅ `.distignore` added (`wp-plugin/wp-super-gallery/.distignore`) as the canonical exclude list mirroring `release.yml`.
- ✅ M2 `fs_dynamic_init` freemium flags (`has_premium_version`, `premium_slug`, `is_org_compliant`, `menu['first-path']`) documented in the `wpsg_fs()` NOTE(M2) comment; applied at go-live with real credentials.

### Validation

- ✅ `php -l` clean; `WPSG_License_Test::test_get_upgrade_url_default_and_filter` tightened to assert the stub-path default (runs in the PHP CI matrix). The SDK-active path is validated against a Freemius sandbox. ⏳ ZIP file-list inspection + init-args diff happen at go-live (M2).

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| **Adapter-level pro gating** (`pro` flag on `AdapterRegistration`, license check in `resolveAdapter`) | Explicitly out of scope this phase — all 14 adapters stay free. Revisit only once a specific adapter is deliberately productized as pro, ideally informed by Freemius usage analytics once live. |
| ~~Free WP.org "lite" tier (top-of-funnel)~~ **→ promoted to P62-F–I (2026-07-10)** | Was MONETIZATION §7 stage 3, deferred; **now in scope** as the freemium expansion (spike → code split → WCAG AA → WP.org submission). No longer a follow-on. |
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
- ✅ **P62-F (split-mechanism spike) — complete (2026-07-10).** Decision: build-time `__WPSG_PREMIUM__` flag (Vite `define`) → two build variants; PoC verified (free build strips the starter-library chunk + preset data), premium build unchanged. See [guides/PRO_FEATURES.md](guides/PRO_FEATURES.md) §7; the P62-G estimate is in the P62-F track section.
- ✅ **P62-G (WP.org "lite" code split) — core complete (2026-07-11).** The free build (`build:wp:free`) strips all 3 Pro features' authoring code (starter library, text editor, breakpoint switcher); a blocking CI gate + an SVN guard prevent Pro-code leaks to `.org`. Full dual-channel release/SVN wiring folded into P62-I. See the P62-G track section.
- 🟡 **P62-H (WCAG AA) — contrast increment complete (2026-07-11); manual AT audit is a human follow-on.** Deterministic per-theme contrast gate (blocking CI) + 18 themes fixed to AA + e2e contrast re-enabled + [guides/ACCESSIBILITY.md](guides/ACCESSIBILITY.md) (static review + human AT checklist). See the P62-H track.
- ⏳ **P62-I/J/K (freemium enablement) — Planned.** WP.org submission + dual-channel release (P62-I, incl. the deferred P62-G release wiring), EULA + privacy (P62-J), go-live hardening (P62-K). The premium tracks (A–E) do not depend on these and can ship first.
- **Deferred (Follow-On):** adapter-level gating; affiliate program; per-feature plan mapping; full-PHP-surface locale gate. *(The WP.org "lite" tier and full WCAG AA are no longer deferred — promoted to P62-F–I / P62-H.)*
- **Next (premium launch):** human completes M1–M4 (Freemius account, product, pricing/trial config, support/refund text), injects real credentials via the `wpsg_freemius_config` filter, then runs the P62-B/C sandbox checklist before flipping the premium tracks to shipped.
- **Next (freemium launch):** P62-F (split-mechanism spike) is **done**; next execute P62-G (code split) → P62-I (WP.org submission), with P62-H/J/K in parallel; this can follow the premium launch. The full go-live runbook — with **M1–M4 defined** — is [guides/MARKETPLACE_READINESS.md](guides/MARKETPLACE_READINESS.md); the pro decisions + dev guide are in [guides/PRO_FEATURES.md](guides/PRO_FEATURES.md).
