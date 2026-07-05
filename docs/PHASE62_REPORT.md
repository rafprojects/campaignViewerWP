# Phase 62 - Monetization & Licensing (Freemius)

**Status:** Planned
**Created:** 2026-06-26
**Last updated:** 2026-06-26

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P62-A | Pro/free gating seams (adapter registry + `WPSG_Permissions` + LayoutBuilder pro features) | Planned | Medium |
| P62-B | Freemius SDK integration | Planned | Medium |
| P62-C | Pricing & licensing model (tiers, renewals, trial) | Planned | Small-Medium |
| P62-D | Buyer-facing docs + support process | Planned | Small-Medium |

---

## Rationale

With the product feature-complete and [PHASE60_REPORT.md](PHASE60_REPORT.md) making it *shippable*, this phase makes it *sellable*: it wires the pro/free gating, the licensing/update SDK, the pricing model, and the support process for the chosen target — **Freemius premium** (see [MONETIZATION_OPTIONS.md](MONETIZATION_OPTIONS.md) §3, §7).

1. **What triggered it.** MONETIZATION §7 recommends premium-via-Freemius as the first monetized release, because the SDK collapses license activation, authenticated auto-updates, checkout, and EU-VAT/sales-tax (merchant of record) into one drop-in — weeks of otherwise-bespoke, security-critical, availability-critical infrastructure (MONETIZATION §3, §4).
2. **Why it belongs together.** Gating, the SDK, pricing, and buyer support are one go-to-market unit; shipping any subset is not a sellable product. They build on two gating seams that already exist (the adapter registry and the `WPSG_Permissions` map), so this is additive, not a rewrite.
3. **Success.** A buyer can purchase a tiered annual license, activate it (with a trial path), receive authenticated auto-updates, and unlock pro features cleanly — while the free surface stays fully functional — with documented support and refund policies.

> **Depends on Phase 60.** Do not integrate the SDK or gate features until the store-readiness work (version metadata, compliance, packaging) has landed; gating on top of a non-shippable artifact is wasted effort.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Licensing/update provider | **Freemius** (MONETIZATION §3). Lowest LOE; merchant-of-record handles tax; first-class freemium gating that maps onto the existing seams. Revisit EDD/self-hosted only if fees/lock-in become material at scale. |
| B | Monetization model | **Annual subscription + tiered by site count** (single / 5-site / agency), with renewals and a trial (MONETIZATION §2). Best fit for a builder that needs ongoing WP-compat maintenance. |
| C | Gating seams | **Reuse the two existing cut-points** — the adapter registry (`adapterRegistry.ts`) and the `WPSG_Permissions` tier map — rather than introducing a new gating layer. |
| D | Pro feature set | **Gate advanced LayoutBuilder capabilities** (text layers from [PHASE59_REPORT.md](PHASE59_REPORT.md), per-breakpoint responsive from [PHASE58_REPORT.md](PHASE58_REPORT.md) P58-B, starter library) and advanced adapters; keep the core gallery + builder free and fully functional. |

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

- Add a `pro: true` flag to advanced adapter registrations and a license check at `resolveAdapter` in `src/components/Galleries/Adapters/adapterRegistry.ts` (registrations are already metadata-driven, so this is localized).
- Gate management/pro features through the `WPSG_Permissions` map (`includes/class-wpsg-permissions.php`).
- Designate the LayoutBuilder pro features (text layers, per-breakpoint responsive, starter library) and gate them at their entry points.

### Acceptance criteria

- Pro adapters/features are inaccessible without a valid license and degrade gracefully (clear upsell, no broken UI) when locked.
- The free surface remains fully functional with no license.
- Gating is expressed at the registry + permissions seams, not duplicated ad hoc.

### Validation

- `npm run test` + PHPUnit for the gated/ungated branches; manual QA toggling a simulated license state.

## Track P62-B - Freemius SDK integration

### Problem

A paid path needs license activation, authenticated auto-updates, and checkout/tax handling — none of which the plugin has today, and all of which are costly and risky to build in-house.

### Fix

- Initialize the Freemius SDK in `wp-super-gallery.php` and wrap the P62-A gates in the SDK's entitlement checks (`can_use_premium_code()` / `is_paying()`).
- Wire authenticated auto-updates through Freemius.
- Enable opt-in analytics with explicit user disclosure (MONETIZATION §6); no phoning-home without consent.

### Acceptance criteria

- License activation/deactivation works end-to-end; pro entitlements flip the P62-A gates.
- Authenticated auto-updates deliver through Freemius.
- Analytics are opt-in and disclosed; nothing transmits without consent.

### Validation

- Sandbox a Freemius test license: activate, verify pro unlock, simulate an update, deactivate and verify re-lock; confirm no network calls before opt-in.

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

- Write license activation + troubleshooting docs (extending the install docs from [PHASE60_REPORT.md](PHASE60_REPORT.md) P60-E).
- Define the support channel and an SLA, and publish a refund policy consistent with marketplace requirements.

### Acceptance criteria

- License activation/troubleshooting docs exist and match the real flow.
- A support channel + SLA and a refund policy are published.

### Validation

- Doc walkthrough against the sandbox activation flow; review the refund policy against Freemius/marketplace requirements.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Free WP.org "lite" tier (top-of-funnel) | MONETIZATION §7 stage 3; gated on the full public-readiness work (full admin i18n + WCAG AA) in [FUTURE_TASKS.md](FUTURE_TASKS.md). Revisit once the pro tier proves out. |
| EDD / self-hosted licensing | Only if Freemius per-transaction fees or lock-in become material at scale (MONETIZATION §3–4). |
| Affiliate program | Freemius supports it; defer until there is a renewal base worth amplifying. |

## Implementation Notes

- Record completed work at a high level as tracks land. Keep short and factual.

## Outcome

_To be completed once the phase ships._

- What shipped.
- What was deferred.
- What should happen next.
