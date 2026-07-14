# Monetization & Distribution Options

> **Created:** 2026-06-17
> **Purpose:** Decision-support for taking wp-super-gallery to production. Lays out every realistic distribution channel and monetization model, the licensing/update mechanics each requires, the fees involved, and the level of effort (LOE) on top of [PHASE54_REPORT.md](archive/phases/PHASE54_REPORT.md) anchored to this codebase.
> **Status:** Reference. *(Update 2026-07-06: the path is now **chosen** — **Freemius premium** is the decision of record; see PHASE60 / [PHASE62_REPORT.md](PHASE62_REPORT.md) Key Decision A, and the go-live runbook [guides/MARKETPLACE_READINESS.md](guides/MARKETPLACE_READINESS.md). This doc is retained for the option analysis behind that choice.)* PHASE54's must-fix bar was kept target-independent so the decision could be made later without invalidating that work.
> **Tone:** Honest engineering assessment, not marketing. Every LOE claim ties to a concrete file/seam in the repo.

---

## TL;DR

- **PHASE54 (security, i18n-user-facing, a11y baseline, builder robustness, release closeout) is the floor for *every* path.** Nothing below replaces it.
- The plugin was **not** built toward monetization, but nothing structurally blocks it. The two natural "pro/free gating seams" already exist: the **adapter registry** (`adapterRegistry.ts`) and the **`WPSG_Permissions` tier map** (`includes/class-wpsg-permissions.php`).
- **Lowest-risk monetization path:** private/client sales first (validate willingness to pay) → **premium via Freemius** (it collapses licensing + updates + taxes + analytics into one SDK) → optionally a free WP.org "lite" tier later for top-of-funnel.
- **Biggest extra cost to go *public* (WP.org or marketplace):** full admin-panel i18n + a WordPress Plugin Check / escaping-sanitization compliance pass + `readme.txt`/assets. These are deferred FUTURE_TASKS, not P54.

---

## 1. Distribution channels

| Channel | Reach | Review / quality gate | Revenue | Key constraints |
|---------|-------|-----------------------|---------|-----------------|
| **WordPress.org (free listing)** | Largest discovery surface in the WP ecosystem; built-in auto-update | Plugin Check + human review; strict GPL, escaping/sanitization, **no undisclosed remote calls**, no tracking without opt-in | None directly (freemium upsell only) | 100% GPL; can't gate features behind a paid license *in the .org-hosted code*; support forum expectations |
| **Own site (direct sale)** | You drive all traffic (SEO/content/ads) | None but your own QA | Full margin minus payment fees | You build/host licensing + update delivery + checkout + EU-VAT handling (or use a vendor that does) |
| **CodeCanyon / Envato** | Established buyer marketplace; discovery | Envato quality review (comparable rigor to .org) | Marketplace takes a large cut; **author share is roughly half** on non-exclusive, more if exclusive | Envato's own licensing model; limited control of pricing/renewals; brand lives on their platform |
| **Freemium (free .org core + paid pro/add-ons)** | Combines .org discovery with paid upsell — the dominant successful WP model | .org review for the free core; you control the pro plugin | Recurring via the pro plugin | Must cleanly split free vs pro code; the free core stays fully functional and GPL |

**Reading:** WP.org maximizes *reach* but not *revenue*; direct/premium maximizes *revenue* but you own the plumbing; freemium is the proven blend but is the most work (two codebases/seams to maintain). CodeCanyon is the fastest way to *a* paying audience but the worst economics and least control long-term.

---

## 2. Monetization models

| Model | How it works | Fit for this product | Notes |
|-------|--------------|----------------------|-------|
| **One-time license** | Pay once, use forever; updates maybe time-boxed | Simple; weak for a product with ongoing maintenance | Buyers love it, your recurring revenue is zero; common to pair with "1 year of updates/support" |
| **Annual subscription / renewal** | License renews yearly for continued updates + support | **Best fit** — a gallery/builder plugin needs ongoing WP-compat maintenance | Industry-standard for premium WP plugins; renewal rate is the core health metric |
| **Tiered by site count** | Single-site / 5-site / unlimited (agency) | Strong fit — agencies are a natural buyer for a builder | Maps cleanly to a license-activation seat count |
| **Freemium upsell** | Free core, paid pro features/add-ons | Strong fit — gate advanced adapters, LayoutBuilder pro features, export | Requires the gating seams in §5 |
| **SaaS / usage-based** | Hosted service, billed by usage | Poor fit *today* — the plugin is embedded same-origin in WP; only relevant if the deferred standalone-SPA path (see `FUTURE_TASKS.md` › JWT/CORS) is ever pursued | High infra + auth lift |

**Pricing reality (WP premium-plugin market, indicative, not a quote):** single-site annual licenses commonly sit in the low-to-mid tens of USD, agency/unlimited tiers in the low hundreds; lifetime deals priced at ~3–4× the annual. Renewal discounts (e.g. 20–30%) are common to protect renewal rate. Validate against direct competitors (Envira, FooGallery, Modula, NextGEN) before setting numbers.

---

## 3. Licensing + update delivery options

Any paid path needs three things the free WP.org channel gives you for free: **license activation/enforcement**, **authenticated auto-updates**, and **checkout + tax handling**. Options:

| Solution | What it gives | Setup LOE | Fees / share | Taxes / EU-VAT | Lock-in |
|----------|---------------|-----------|--------------|----------------|---------|
| **Freemius** | License activation, auto-updates, checkout, **EU-VAT/sales-tax as merchant of record**, analytics, freemium gating SDK, affiliates | **Lowest** — drop-in SDK | Per-transaction % + small fixed fee | **Handled for you** (merchant of record) | Highest — SDK embeds in the plugin |
| **Easy Digital Downloads + Software Licensing** | Self-hosted store + license API + update server (EDD add-on) | **High** — you run the WP store, configure the licensing add-on, wire the updater | EDD/add-on cost + your payment-gateway fees | **Your responsibility** (or an EDD tax add-on/gateway) | Low — you own it |
| **WooCommerce + a license/API-manager extension** | Store + licensing/updates via extension | **High** — similar to EDD | Woo + extension + gateway fees | Your responsibility | Low |
| **Roll-your-own update server** | Custom `pre_set_site_transient_update_plugins` + a license endpoint | **Highest** — you build + secure + maintain it | Only your infra | Your responsibility | None, but all maintenance is yours |

**Recommendation:** **Freemius** for the first monetized release. It removes the entire licensing/update/tax build (which is otherwise weeks of work and an ongoing security surface) and has first-class freemium gating that maps onto the seams in §5. Revisit EDD/self-hosted only if the per-transaction fee or lock-in becomes material at scale.

---

## 4. Cost / fee comparison

| Path | Marketplace/processor cut | Recurring infra cost | Maintenance surface added |
|------|---------------------------|----------------------|---------------------------|
| WP.org free | None | None | Support forum; .org guideline compliance over time |
| Direct + **Freemius** | Per-transaction % + small fixed fee | Effectively none (Freemius hosts) | SDK upgrades; that's it |
| Direct + **EDD/Woo self-hosted** | Payment-gateway % only | WP store hosting + uptime (your update server must stay up or customers can't update) | Store, licensing add-on, update endpoint, backups, security |
| **CodeCanyon** | Large marketplace cut (author keeps ~half on non-exclusive) | None | Envato support expectations; platform dependency |
| Roll-your-own | Gateway % only | Your servers | Everything — highest ongoing burden |

**Hidden cost to weigh:** a self-hosted update server is **availability-critical** — if it's down, every customer's plugin update silently fails. Freemius/Envato absorb that operational risk.

---

## 5. LOE anchored to THIS codebase

What each path needs **on top of** PHASE54, with the concrete artifacts involved:

**Common to all paid paths**
- **Pro/free gating seam.** Two clean cut-points already exist: gate advanced adapters at the **adapter registry** (`src/components/Galleries/Adapters/adapterRegistry.ts` — registrations are already metadata-driven, so a `pro: true` flag + a license check at `resolveAdapter` is a small, localized change) and gate management features at the **`WPSG_Permissions` tier map** (`includes/class-wpsg-permissions.php` — already a declarative action→requirement map, P52-A). LayoutBuilder "pro" features (e.g. text layers, responsive editing from `FUTURE_TASKS`) gate naturally at their entry points.
- **License/update SDK integration** — Freemius SDK init in `wp-super-gallery.php`; ~days, not weeks.

**Public WP.org (free or freemium free-core)** — **High delta**
- **Full admin-panel i18n** — flip `i18next/no-literal-string` from `'off'` to `'error'` globally (`eslint.config.js:82`) and harvest the remaining ~300 literals (P54-B only does the user-facing subset). Add a proper WP text domain + generated `.pot`.
- **Plugin Check + escaping/sanitization compliance pass** — extends P54-A across the whole PHP surface (output escaping at every echo, nonce/capability checks audited, no `eval`/remote-code, no undisclosed external requests). The codebase is already strong here (centralized sanitizer, `WPSG_Permissions`), so this is a focused audit, not a rewrite.
- **`readme.txt`, banner/icon assets, screenshots, stable-tag discipline.**
- **Full WCAG AA** beyond P54-C's critical/serious baseline.

**Premium / marketplace** — **Med-High delta**
- All of the "common to all paid paths" items.
- i18n still expected by international buyers (can be the user-facing subset initially).
- Buyer-facing **docs + support process** (the real ongoing cost).
- CodeCanyon adds an Envato review pass comparable to .org.

**Private / client / agency** — **Low delta**
- PHASE54 is roughly sufficient. i18n/a11y handled pragmatically per client. No licensing infra if you deploy it yourself.

**Internal / single-site** — **Lowest delta**
- Ship after PHASE54.

---

## 6. Legal / compliance notes

- **GPL.** WordPress plugins are derivative of GPL WordPress; the PHP is effectively GPL. You **can** sell GPL software and **can** restrict who downloads it and gate updates/support behind a license — what you can't do is stop a buyer from redistributing what they received. This is the normal, accepted premium-WP model; Freemius/EDD/Woo are all built around it.
- **WP.org specifics.** No "phoning home" / tracking without explicit opt-in; no obfuscated code; no calling external services for core functionality without disclosure. The current plugin's same-origin, nonce-based design is already aligned (see `FUTURE_TASKS.md` notes where remote/URL features were deliberately removed).
- **Refunds & support.** Marketplaces mandate refund windows; direct sales need a stated policy. Support is the dominant *ongoing* cost of any paid path — budget for it explicitly.
- **Taxes.** Selling globally triggers EU-VAT and US sales-tax obligations. A merchant-of-record (Freemius, or Envato for CodeCanyon) handles this; self-hosted EDD/Woo makes it your responsibility.

---

## 7. Recommended sequencing

1. **Validate (now → post-PHASE54): private / client sales.** Lowest bar, fastest cash, real signal on willingness to pay. Requires nothing beyond PHASE54.
2. **Monetize: premium via Freemius.** Once there's demand, add the gating flag at the adapter registry + `WPSG_Permissions` seams and the Freemius SDK. Subscription + tiered-by-site-count pricing. Avoids building/hosting licensing + update + tax infrastructure. *(Superseded by Phase 62: gating went through a new `WPSG_License` entitlement seam — deliberately orthogonal to `WPSG_Permissions` — and all 14 adapters stayed free; the 3 gated features are LayoutBuilder capabilities. See [guides/PRO_FEATURES.md](guides/PRO_FEATURES.md).)*
3. **Scale reach: free WP.org "lite" tier.** A freemium free-core on .org becomes the top-of-funnel for the Freemius-licensed pro plugin. This is the step that requires the free/paid code split + Plugin Check + WCAG AA work. *(Updated 2026-07-10: this is **no longer "defer until the pro tier proves out"** — the owner has chosen freemium, so the WP.org "lite" tier is **in scope** and tracked in [PHASE62_REPORT.md](PHASE62_REPORT.md) as **P62-F–I**. Sequencing recommendation stands: ship premium first, add the free WP.org tier afterwards, so the Large code-split/WCAG work and the ~1–10 day WP.org review stay off the paid-launch critical path — see [guides/MARKETPLACE_READINESS.md](guides/MARKETPLACE_READINESS.md) §10.)*

**Decision triggers to move between stages:** repeated inbound "can I buy this?" → stage 2; pro renewals healthy and support load manageable → stage 3 (**now planned regardless**, per the 2026-07-10 freemium decision). If demand never materializes, stopping at stage 1 (or internal/single-site) is a perfectly valid end state.

---

## Cross-references

- [PHASE54_REPORT.md](archive/phases/PHASE54_REPORT.md) — the must-fix floor for every path here.
- [FUTURE_TASKS.md](FUTURE_TASKS.md) — full admin i18n, full WCAG AA, standalone-SPA/JWT (the SaaS prerequisite), and the gating-candidate enhancements.
- [guides/MARKETPLACE_READINESS.md](guides/MARKETPLACE_READINESS.md) — the owner go-live runbook (M1–M4, pricing, pro-testing) for the chosen Freemius-premium path.
- [guides/PRO_FEATURES.md](guides/PRO_FEATURES.md) — the free/pro boundary decisions and how to add new pro features.
