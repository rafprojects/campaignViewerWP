# WP Super Gallery — Marketplace Readiness & Go-Live Runbook

**Audience:** the product owner / operator taking WP Super Gallery to market. This is the
step-by-step runbook for launching the **paid** plugin, plus how to test the Pro
functionality end-to-end.

- For the **buyer-facing** activation guide (what an end user does with a license key), see
  [LICENSE_ACTIVATION.md](LICENSE_ACTIVATION.md).
- For the **developer-facing** breakdown of what "Pro" is and how to add new Pro features,
  see [PRO_FEATURES.md](PRO_FEATURES.md).
- For build/packaging/versioning **mechanics**, see [PACKAGING_RELEASE.md](PACKAGING_RELEASE.md)
  and [VERSIONING.md](VERSIONING.md) — this guide references them rather than repeating them.

---

## 1. Where things stand

Two prior phases got us here:

- **Phase 60 made the plugin *shippable*** — version single-source-of-truth, Plugin Check /
  PHPCS compliance, accessibility hardening, `docs/PRIVACY.md`, packaging, and 5 shipped
  language packs.
- **Phase 62 made it *sellable*** — the `WPSG_License` entitlement seam, a credential-ready
  Freemius SDK bootstrap (`wpsg_fs()`), 3 gated LayoutBuilder Pro features, and buyer docs.

Distribution model is locked to **Freemius premium** (Freemius is the *merchant of record*, so
EU-VAT / US sales-tax is handled for you). See `docs/MONETIZATION_OPTIONS.md` for the full
decision and [PRO_FEATURES.md](PRO_FEATURES.md) for the gating architecture.

**Track status** (validated 2026-07-06, see [PHASE62_REPORT.md](../PHASE62_REPORT.md)):

| Track | State |
|---|---|
| P62-A gating seams | ✅ code complete & verified |
| P62-B Freemius SDK | ✅ code complete & verified (safe no-op until credentials) |
| P62-D buyer docs | 🟡 authored — placeholders pending (this runbook's M4) |
| P62-E i18n locale gate | ✅ complete |
| P62-C pricing model | ⏳ human-only — configured in the Freemius dashboard (M3) |

Everything remaining to launch is **human / Freemius-dashboard work** (M1–M4 below) plus the
real-Freemius **sandbox validation** that flips A/B from "code complete" to "shipped."

---

## 2. The M1–M4 go-live milestones

> **These milestones are defined here for the first time.** Across the phase docs "M1–M4"
> were referenced but never enumerated; this section is the canonical definition. The mapping
> was inferred from the "Next" line of [PHASE62_REPORT.md](../PHASE62_REPORT.md) and is made
> authoritative here.

| # | Milestone | What you do | Unblocks |
|---|---|---|---|
| **M1** | Freemius **account + product registration** | Create a Freemius account, register "WP Super Gallery" as a plugin product, and obtain the **Plugin ID** + **public key** (keep the secret key private, never in the repo). | Credentials for §3 |
| **M2** | **Product / bundle configuration** | In the Freemius dashboard configure the product: the premium bundle build, menu placement, and the `is_premium` path. Then **reconcile the `NOTE (M2)`** hardcoded defaults in `wpsg_fs()` (`wp-super-gallery/wp-super-gallery.php`) with the exact `fs_dynamic_init(...)` snippet Freemius generates (menu slug, icon, `is_premium` bundle path). | Correct SDK init |
| **M3** | **Pricing / licensing config** (track P62-C) | Configure tiers (single / 5-site / agency), renewals, and the trial in the Freemius dashboard. See §6 for proposed defaults. | Checkout + seats |
| **M4** | **Buyer-facing text** | Decide and write: support channel/email + SLA, and the refund policy; set the real pricing/upgrade URL. Then fill the placeholders in §5. | Public listing |

**Sandbox validation** (see §8d) spans M1–M3: you need the account, product, and pricing live
in a Freemius *sandbox* to run the activation/checkout/update tests against.

---

## 3. Injecting real Freemius credentials (technical go-live)

The plugin ships **credential-ready**: `wpsg_fs()` (in `wp-super-gallery/wp-super-gallery.php`)
reads the `wpsg_freemius_config` filter and, while the Plugin ID / public key are empty,
returns `null` and makes **zero** network calls (a safe free-tier no-op). Supplying real
credentials flips it live — and `WPSG_License::is_sdk_active()` starts returning `true`.

**Credentials live OUTSIDE this repo — never commit them.** Inject them from a site-specific
must-use plugin (or wp-config constants read into the filter):

```php
<?php
/**
 * wp-content/mu-plugins/wpsg-freemius-credentials.php
 * Site-specific. NEVER commit this to the plugin repo.
 */
add_filter('wpsg_freemius_config', function () {
    return [
        'id'         => '1234',                   // Freemius Plugin ID (from M1)
        'public_key' => 'pk_xxxxxxxxxxxxxxxxxxxx', // Freemius public key (from M1)
        'is_premium' => true,                      // true for the premium build
    ];
});

// Recommended: set the real pricing/upgrade URL here (see §5) so you don't edit committed source.
add_filter('wpsg_license_upgrade_url', fn () => 'https://yourstore.example/pricing');
```

Once this is in place: `wpsg_fs()` loads the vendored Freemius SDK, calls `fs_dynamic_init()`
(your `$config` is merged last, so real values always win), fires `do_action('wpsg_fs_loaded')`,
and every `WPSG_License` check delegates to Freemius instead of the free-tier stub.

See [PRO_FEATURES.md](PRO_FEATURES.md) §"The 5 filters" for the full filter list
(`wpsg_freemius_config`, `wpsg_license_upgrade_url`, `wpsg_license_tier`, …).

---

## 4. Reconcile the SDK init defaults (M2)

`wpsg_fs()` contains an explicit `NOTE (M2)` marking hardcoded `fs_dynamic_init` defaults
(`slug`, `menu.slug`, `menu.first-path`, `has_paid_plans`, `is_premium`) that must be
reconciled with the exact snippet the Freemius dashboard generates for your product once it
exists. Because `$config` (from your filter) is merged **last**, the `id`/`public_key`/
`is_premium` you inject already override the placeholders — but the menu/bundle details should
be brought in line with Freemius's generated snippet during M2.

---

## 5. Placeholder-fill checklist

Every marketplace-readiness placeholder still in the tree. Grep to re-verify:
`grep -rn "PLACEHOLDER\|your-site.tld/pricing" wp-plugin/ src/ docs/ --include=*.php --include=*.txt --include=*.ts --include=*.md` (ignore `vendor/`).

| Location | Placeholder | How to fill |
|---|---|---|
| `wp-plugin/wp-super-gallery/readme.txt` | support email + refund policy (2 `[PLACEHOLDER]`) | Edit to final support email + refund text (M4). |
| `docs/guides/LICENSE_ACTIVATION.md` | support email + refund policy (2 `[PLACEHOLDER]`) | Same values as readme (M4). |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-license.php` | `get_upgrade_url()` → `https://your-site.tld/pricing` | **Prefer** the `wpsg_license_upgrade_url` filter (§3) — then this hardcoded default is never used. Optionally update the default too. |
| `src/hooks/useWpsgLicense.ts` | `DEFAULT_UPGRADE_URL` fallback | Same — the client reads the URL from `get_upgrade_url()` via page config, so the filter covers it; this fallback only shows if config omits a URL. |
| `.wordpress-org/README.md` | banner / icon / screenshot artwork spec | Commission the store artwork (designer pass, from P60-E). |

> **Tip:** setting `wpsg_license_upgrade_url` in your mu-plugin (§3) fixes the upgrade URL for
> both PHP and the React client at once, with no source edits — the two hardcoded
> `your-site.tld/pricing` defaults become dead fallbacks.

---

## 6. Pricing model — proposed defaults (confirm before committing)

Derived from `docs/MONETIZATION_OPTIONS.md` §2 ("single low-to-mid tens; agency low hundreds;
lifetime ~3–4× annual; renewal discounts 20–30%"). **These are a proposed starting point —
validate against direct competitors (Envira, FooGallery, Modula, NextGEN) before locking them
into the Freemius dashboard at M3.**

| Tier | Sites | Annual | Lifetime (~3.5×, optional) |
|---|---|---|---|
| Single | 1 | **$39/yr** | ~$129 |
| Team | 5 | **$79/yr** | ~$279 |
| Agency | Unlimited | **$149/yr** | ~$499 |

- **Renewal discount:** 25% (protects renewal rate — the core health metric).
- **Trial:** 14-day, **no card required** (lowers friction; the Freemius opt-in dialog still applies).
- **Model:** annual subscription, tiered by site count (maps 1:1 to Freemius seat counts).

The pro feature set is currently **all-or-nothing** (any active license unlocks all 3 Pro
features). If you later want to split features across tiers, that's a code-free change via the
`wpsg_license_feature_enabled` filter — see [PRO_FEATURES.md](PRO_FEATURES.md).

---

## 7. Building & releasing the paid package

Use the existing pipeline — see [PACKAGING_RELEASE.md](PACKAGING_RELEASE.md) for the full
mechanics. The **Freemius/pro-specific** points:

- **The Freemius SDK ships inside the ZIP.** `vendor/` (including `freemius/wordpress-sdk`) is
  gitignored, but the `Release` workflow runs `composer install --no-dev --optimize-autoloader`
  before zipping, and the zip step does **not** exclude `vendor/` — so the production SDK is in
  the distributed ZIP.
- **Premium vs free build** is distinguished by `is_premium` (your injected config / the
  Freemius bundle). Freemius serves the correct build per license.
- **Release path:** `Actions → Release → Run workflow` (manual `workflow_dispatch`) → version
  bump across the 4 SoT files → Vitest + PHPUnit gates → `npm run build:wp` → ZIP → GitHub
  Release with the ZIP attached → optional WP.org SVN deploy. A tagged release can also be
  pushed to WP.org later via the `SVN Deploy` workflow (`.github/workflows/svn-deploy.yml`).

---

## 8. Testing the Pro functionality (to complete the tracks)

### (a) Simulate a Pro license locally — no Freemius needed

The entire entitlement layer is filter-based and defaults to free, so you can drive the
licensed UI/behaviour with a dev-only mu-plugin:

```php
<?php
/** wp-content/mu-plugins/wpsg-fake-pro.php — DEV/QA ONLY. */
add_filter('wpsg_license_is_pro', '__return_true');
```

To simulate a **single** feature being unlocked (per-tier testing):

```php
add_filter('wpsg_license_feature_enabled', function ($enabled, $feature) {
    return $feature === 'layout_text_layers' ? true : $enabled; // e.g. only text layers
}, 10, 2);
```

Remove the mu-plugin to return to the free tier.

### (b) Manual test matrix — the 3 Pro gates + server enforcement

With the free tier (no filter) vs Pro (filter on):

| Feature | Where | Free tier | Pro |
|---|---|---|---|
| **Text layers** | LayoutBuilder → Layers panel → "Add text" | Shows "Pro feature" upsell toast; no text layer added | Adds a text layer |
| **Per-breakpoint responsive** | LayoutBuilder → Canvas → breakpoint edit switcher | Tablet/Mobile show upsell; **Desktop stays free**; edit mode does not switch | Switches into tablet/mobile edit mode |
| **Starter template library** | Templates list → "From Preset" | Shows upsell; gallery does not open | Opens the preset gallery |

**Server-side enforcement (must also verify — the client gate alone is bypassable):**

- With the free tier, `POST` a layout template (via the REST API or the builder) containing
  `texts` and `breakpointOverrides`:
  - **Create / import** → those fields come back **stripped to `[]`**.
  - **Update** of an existing template → those fields are **frozen to the last-saved value**
    (an unlicensed edit is discarded, never destroys saved Pro data).
- **Existing Pro content still renders** when unlicensed — open a public gallery whose layout
  already has text layers / breakpoint overrides and confirm they display unchanged.

### (c) Automated coverage that already exists

- **PHPUnit** (via wp-env — see [../testing/TESTING_QUICKSTART.md](../testing/TESTING_QUICKSTART.md)
  and the `php-testing` skill):
  ```bash
  npx wp-env start
  npx wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && php ./vendor/bin/phpunit -c phpunit.xml.dist tests/WPSG_License_Test.php tests/WPSG_Layout_Templates_Test.php tests/WPSG_Import_Sanitization_Test.php"
  ```
  Covers the stub/filter paths, strip-on-create/import, and freeze-on-update.
- **Vitest** — `npm test` (the `useWpsgLicense` hook + the 3 gate component suites).
- **i18n locale coverage** — `npm run i18n:check:locales` (fails if any upsell string is not
  translated in all 5 reference locales).

### (d) Real Freemius sandbox validation (the M1–M3 gate that ships A/B)

Once M1–M3 are done, run this against the Freemius **sandbox** before flipping P62-A/B to
"shipped":

1. Activate a sandbox license → confirm Pro features unlock (no reload needed beyond re-opening
   an open LayoutBuilder tab).
2. Simulate an update → confirm authenticated delivery via **Plugins → Updates**.
3. Deactivate the license → confirm Pro re-locks and **existing saved content still renders**.
4. Confirm the Freemius **opt-in / skip dialog** appears on first activation.
5. Confirm `WPSG_License::can_use_premium_code()` reflects a **purchased / trial / expired**
   license correctly.

### (e) Follow-on: e2e Pro coverage

Pro-gating is **not** currently exercised in the Playwright e2e suite. It could be added by
dropping a `wpsg_license_is_pro` mu-plugin into the wp-env instance the `e2e.yml` workflow
starts, then asserting the licensed UI. Tracked as a nice-to-have, not built.

---

## 9. Validating on the live marketplace

Before (and just after) going live, exercise the real purchase flow in Freemius **test / sandbox
mode**:

- Run a checkout with **Freemius test cards** (no real charge) → verify the license-delivery
  email arrives.
- Activate the delivered key on a **clean** WordPress site → Pro unlocks.
- **Seat enforcement:** activate on one more site than the tier allows → confirm the extra
  activation is refused ("No available activations").
- **Trial + renewal:** start the trial → confirm Pro for the trial window; simulate renewal /
  expiry → confirm the transition.
- **Refund:** issue a refund from the Freemius dashboard → confirm the license
  deactivates and the site returns to free (saved content intact).
- **Post-launch:** monitor the first 24–48h of real activations and support inbox; watch the
  Freemius dashboard for failed activations / refunds.

---

## 10. WP.org "lite" tier (deferred — forward-looking)

`MONETIZATION_OPTIONS.md` §7 stage 3: a free "lite" tier on the WordPress.org directory as
top-of-funnel for the paid plugin. **Deferred until the pro tier proves the product** — not
built. When you take it on, it additionally requires:

- **WP.org guideline compliance** and a clean **Plugin Check** run (Phase 60 left exactly one
  honest `outdated_tested_upto_header`; keep `Tested up to` current).
- **Full WCAG AA** (Phase 60 shipped admin-flow a11y hardening; full AA is a documented
  follow-on).
- **A free/paid code split.** Paid code cannot live in the WordPress.org repo — you ship a
  *lite* build to .org (via the `SVN Deploy` workflow) and the *premium* build via Freemius.
  The gating seams already support this: the lite build simply never receives real
  `wpsg_freemius_config` credentials, so it stays free-tier.

---

## 11. Pre-launch checklist

- [ ] **M1** — Freemius account created; plugin product registered; Plugin ID + public key obtained.
- [ ] **M2** — Product/bundle configured; `wpsg_fs()` `NOTE (M2)` defaults reconciled with Freemius's snippet.
- [ ] **M3** — Tiers / renewals / trial configured in Freemius (pricing confirmed vs competitors — §6).
- [ ] **M4** — Support email + SLA and refund policy decided.
- [ ] Placeholders filled (§5): `readme.txt`, `LICENSE_ACTIVATION.md`, upgrade URL (filter or source), `.wordpress-org` artwork.
- [ ] Credentials injected via `wpsg_freemius_config` mu-plugin (outside the repo); `is_sdk_active()` returns true on the store site.
- [ ] Automated gates green (§8c): Vitest, PHPUnit license/gating suites, `i18n:check:locales`.
- [ ] Manual Pro matrix passed (§8b), including server-enforcement + "existing content renders."
- [ ] Freemius **sandbox** validation passed (§8d) → P62-A/B flipped to shipped.
- [ ] Live-marketplace validation passed (§9): checkout, seat enforcement, trial/renewal, refund.
- [ ] Released via the `Release` workflow; version SoT in sync; ZIP contains production `vendor/`.

---

_See also: [PRO_FEATURES.md](PRO_FEATURES.md) (what Pro is + how to build new Pro features),
[LICENSE_ACTIVATION.md](LICENSE_ACTIVATION.md) (buyer activation), and
[../PHASE62_REPORT.md](../PHASE62_REPORT.md) (track detail)._
