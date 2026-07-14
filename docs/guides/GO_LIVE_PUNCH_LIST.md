# WP Super Gallery — Go-Live Punch List

**One place for everything left to launch.** The Phase 62 *engineering* is essentially complete
(F–K); what remains below is human/dashboard, legal, design, and validation work. Detail lives in
[MARKETPLACE_READINESS.md](MARKETPLACE_READINESS.md) (the full runbook) and
[../PHASE62_REPORT.md](../PHASE62_REPORT.md) (per-track); this is the tight index.

Two launch channels: **Premium** (paid, via Freemius) and the free **WP.org "lite"** build. You can
ship **premium first** and add the free tier later — §F doesn't block §A–E.

Legend: ⬜ to do · 🔒 blocked on a prior item · 💻 has code already done, listed for verification.

---

## A. Freemius account & product — M1–M3 (owner / dashboard)
- ⬜ **M1:** create a Freemius account; register "WP Super Gallery" as a plugin product → get the **Plugin ID + public key** (keep the secret key private, never in the repo).
- ⬜ **M2:** configure the product/bundle (premium build, menu placement); reconcile `wpsg_fs()`'s `fs_dynamic_init` with Freemius's generated snippet — for **freemium** that adds `has_premium_version`, a distinct `premium_slug`, `is_org_compliant`, and a non-empty `menu['first-path']` (see the `NOTE (M2)` in `wp-super-gallery.php`; P62-K).
- ⬜ **M3:** configure **pricing** — tiers (single / 5-site / agency), renewals, trial. Proposed defaults in [MARKETPLACE_READINESS.md](MARKETPLACE_READINESS.md) §6 — validate vs competitors before locking.

## B. Credentials injection — technical go-live
- ⬜ Add a site-specific **`wpsg_freemius_config` mu-plugin** (outside the repo) with the real `id` + `public_key` + `is_premium`; confirm `WPSG_License::is_sdk_active()` returns **true** on the store site. (The upgrade URL is now SDK-derived — P62-K — so no manual `wpsg_license_upgrade_url` filter is required; it still overrides if set.)

## C. Buyer-facing text & legal — M4 (P62-D / P62-J)
- ⬜ Decide the **support channel/email + SLA** and the **refund policy**.
- ⬜ Fill the `[PLACEHOLDER]`s: `readme.txt`, [LICENSE_ACTIVATION.md](LICENSE_ACTIVATION.md), [EULA.md](../EULA.md) (support email + refund text). Grep: `grep -rn "PLACEHOLDER" docs/ wp-plugin/ --include=*.md --include=*.txt`.
- ⬜ **EULA:** fill entity/jurisdiction/dates, get **attorney review**, publish to the Freemius listing (Settings → Legal → EULA). 💻 draft in [EULA.md](../EULA.md).
- 💻 Confirm [PRIVACY.md](../PRIVACY.md) §8 (Freemius checkout + SDK opt-in) matches the final config.

## D. Store artwork — design (P62-I)
- ⬜ Commission per the [`.wordpress-org/README.md`](../../.wordpress-org/README.md) spec: **banner** (772×250 + 1544×500), **icon** (128/256 + optional svg), **screenshots 1–5** (caption-synced with `readme.txt`). Needed for both the Freemius and WP.org listings.

## E. Premium launch validation — flips P62-A/B to "shipped"
- 💻 Automated gates green: Vitest, PHPUnit license/gating suites, `i18n:check:locales`, the theme-contrast + component-axe a11y gates, `check:free-build`.
- ⬜ Manual **Pro matrix** ([MARKETPLACE_READINESS.md](MARKETPLACE_READINESS.md) §8b): the 3 gated features + server enforcement + "existing Pro content still renders."
- ⬜ **Freemius sandbox validation** (§8d): activate → Pro unlocks → simulated update → deactivate → re-lock → opt-in dialog → purchased/trial/expired states reflected. **→ flip P62-A/B to shipped.**
- ⬜ **Live-marketplace validation** (§9): checkout with test cards, seat enforcement, trial/renewal, refund.
- ⬜ Release via the **Release** workflow; version SoT in sync; ZIP contains production `vendor/`.

## F. Freemium (free WP.org "lite") launch — P62-G done; P62-I remaining
- 💻 Build the free ZIP: `npm run build:wp:free` (strips all Pro code; the `check:free-build` CI gate asserts it).
- ⬜ **Plugin Check (PCP)** green on the *stripped* free build; keep `Tested up to` current.
- ⬜ Wire **dual-channel release**: `release.yml` also emits a free ZIP; point `svn-deploy.yml` at the free ZIP; **remove the P62-G guard** that currently blocks SVN deploy.
- 🔒 Submit the free build to the **WP.org review** (~1–10 days); on approval, SVN-deploy it; confirm Freemius serves the premium build via `is_premium`.

## G. Quality bars — recommended, decouplable (NOT hard WP.org gates)
- ⬜ **Manual assistive-tech audit** — run the QA script: [ACCESSIBILITY_MANUAL_AUDIT.md](ACCESSIBILITY_MANUAL_AUDIT.md) (keyboard / screen-reader / Shadow-DOM / reflow). Record the launch-blocking-vs-follow-on decision.
- 💻 **Structural a11y gate** in place ([ACCESSIBILITY.md](ACCESSIBILITY.md)); growing its coverage is a tracked future task ([FUTURE_TASKS.md](../FUTURE_TASKS.md) → Accessibility).

---

_Engineering status per track is in [../PHASE62_REPORT.md](../PHASE62_REPORT.md); the detailed how-to for
each item above is in [MARKETPLACE_READINESS.md](MARKETPLACE_READINESS.md)._
