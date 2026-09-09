# Phase 80 - Go-live: business, legal, and store readiness

**Status:** Planned — no tracks landed yet, though several individual steps are already done via prior phases (see per-track notes)
**Created:** 2026-09-09
**Last updated:** 2026-09-09

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P80-A | Freemius account & product setup (M1–M3) | Planned — human/dashboard | Medium |
| P80-B | Credentials injection — real Freemius keys onto the store site | Planned — blocked on A | Small |
| P80-C | Buyer-facing text & legal — support/refund policy, placeholders, EULA | Planned — human/legal | Medium |
| P80-D | Store artwork — icon, banner, lockups, screenshots | In progress — assets in production with the designer; screenshots uncaptured | Medium |
| P80-E | Premium launch validation — flips P62-A/B to "shipped" | Planned — blocked on A, B | Medium |
| P80-F | Freemium ("lite") WP.org launch — account security, submission, review | In progress — account exists (P76-C); 2FA, SVN password, and submission remain | Small-Medium |
| P80-G | Quality bars — manual assistive-tech audit | Planned — recommended, not a hard gate | Small |

---

## Rationale

1. **What triggered it.** [`GO_LIVE_PUNCH_LIST.md`](guides/GO_LIVE_PUNCH_LIST.md) has existed since Phase 62 as a tight index of everything left to launch, and it does its job as a checklist. What it does not have is dated, tracked status the way a phase report does — so closing an item (like P76-C's account registration this week) updates the punch list's checkboxes but leaves no record of *when* or *why*, and there is no single place that says "here is what changed since last time anyone looked." Most of what remains is human/dashboard/legal work that never shows up in `git log`, which is exactly the kind of work that is easiest to lose track of.
2. **Why it belongs together as one phase.** Every item gates the same event — the first public release, premium and/or free — and several items reuse the same artifacts across sections (the Freemius account touches A, B, E and F; the WordPress.org account touches D and F). Collecting them under one phase, mirroring the punch list's own A–G sections one-to-one, means the two documents stay a single source of truth read two ways: the punch list for a fast glance, this report for dated status and the reasoning behind any decision.
3. **Success.** Every checklist item in `GO_LIVE_PUNCH_LIST.md` is a tracked track here with a current status. Flipping a punch-list checkbox and updating this report's track table happen together, not as two separately-remembered chores.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Ship premium first, free second, or together? | **Premium first, free can follow independently** — inherited from the punch list's own framing. Track F (free/lite) does not block A–E (premium), and vice versa; the two channels can complete in either order. |
| B | Does this phase block on, or get blocked by, Phase 77/78/79? | **No dependency either way.** 77 (visual architecture) and 78 (UI facade) are internal code-quality work with no bearing on anything in this punch list. 79 (release pipeline hygiene — the distribution exclude list, `actionlint`, the `mullion_fs()` caching fix) is polish to the same `release.yml` / `svn-deploy.yml` this phase eventually runs, so it is worth having landed first, but nothing here hard-blocks on it — the workflows work today without P79's fixes. |
| C | Screenshot capture: required 5 only, or expand for the future website? | **Capture both in one session** (P80-D) — the seeded wp-env instance is the actual cost, and a handful of extra shots is marginal once it exists. The expanded list stays deliberately unscoped until the website's own design work begins; see the [FUTURE_TASKS.md](FUTURE_TASKS.md) entry this decision produced. |
| D | Track lettering — new scheme, or mirror the punch list? | **Mirror `GO_LIVE_PUNCH_LIST.md`'s A–G exactly.** A reader already familiar with the punch list should not have to re-learn a mapping, and keeping the letters identical makes the two documents trivially cross-referenceable in both directions. |

## Execution Priority

1. **P80-D** can start immediately and already has — the designer is cutting final assets, unblocked by anything else in this phase. The screenshot half needs a seeded wp-env instance and can happen whenever that is convenient.
2. **P80-F's remaining account-security steps** (2FA, SVN password) can also happen immediately — the account exists, nothing else gates them. The actual submission step is independent of the premium chain (A/B/E) by Key Decision A.
3. **P80-A -> P80-B -> P80-E** is a real dependency chain for the premium channel: the Freemius account and product (A) must exist before real credentials can be injected (B), which must be in place before sandbox/live validation (E) means anything.
4. **P80-C** (legal) is independent of the above and can run in parallel, but should land before either channel actually goes public — a live listing without a finished EULA and refund policy is the wrong order.
5. **P80-G** last, or in parallel whenever convenient. Explicitly a quality bar, not a hard WP.org gate.

---

## Track P80-A - Freemius account & product setup

### Problem

No Freemius account exists yet. Nothing in the premium channel — pricing, checkout, license
enforcement — can go live without one, and `mullion_fs()`'s `fs_dynamic_init` call in
`mullion-gallery.php` currently carries placeholder values (see its own `NOTE (M2)` comment).

### Fix

Three dashboard steps, in order:

- **M1:** create the Freemius account, register "Mullion" as a plugin product, obtain the
  **Plugin ID + public key**. The secret key stays out of the repo entirely.
- **M2:** configure the product/bundle (premium build, menu placement), then reconcile
  `fs_dynamic_init` with Freemius's generated snippet. For a freemium product that means
  `has_premium_version`, a distinct `premium_slug`, `is_org_compliant`, and a non-empty
  `menu['first-path']`.
- **M3:** configure pricing — tiers (single / 5-site / agency), renewals, trial. Proposed
  defaults are in [MARKETPLACE_READINESS.md](guides/MARKETPLACE_READINESS.md) §6; validate
  against competitor pricing before locking.

### Acceptance criteria

- Plugin ID and public key obtained and stored outside the repo.
- `fs_dynamic_init`'s freemium-specific fields reconciled with what Freemius's dashboard
  generated.
- Pricing tiers locked and entered into the Freemius product configuration.

### Validation

- Dashboard-side confirmation only; nothing here is testable from this repo.

---

## Track P80-B - Credentials injection

### Problem

The real Freemius `id` / `public_key` / `is_premium` values need to reach the store site
without ever living in the repo, since the repo is public and the credentials are
account-specific.

### Fix

Add a site-specific `mullion_freemius_config` mu-plugin (outside the repo) carrying the real
values from P80-A.

### Acceptance criteria

- `Mullion_License::is_sdk_active()` returns **true** on the store site.
- The upgrade URL resolves correctly (SDK-derived since P62-K; no manual
  `mullion_license_upgrade_url` filter needed, though it still overrides if set).

### Validation

- Check directly on the live or staging store site after the mu-plugin is in place.

---

## Track P80-C - Buyer-facing text & legal

### Problem

Support channel, SLA, and refund policy are undecided. `[PLACEHOLDER]` strings remain in
`readme.txt`, `LICENSE_ACTIVATION.md`, and `EULA.md`. The EULA itself needs a filled-in
entity/jurisdiction and attorney review before it can be published to the Freemius listing.

### Fix

- Decide the support channel/email, SLA, and refund policy.
- Fill every `[PLACEHOLDER]`: `grep -rn "PLACEHOLDER" docs/ wp-plugin/ --include=*.md --include=*.txt`.
- Fill the EULA's entity/jurisdiction/dates, get attorney review, publish to the Freemius
  listing (Settings -> Legal -> EULA). Draft already exists at [EULA.md](EULA.md).
- Confirm [PRIVACY.md](PRIVACY.md) §8 (Freemius checkout + SDK opt-in) matches whatever
  the final Freemius configuration turns out to be.

### Acceptance criteria

- Zero `[PLACEHOLDER]` matches in shipped docs/txt files.
- EULA published and visible on the Freemius listing's Legal tab.
- `PRIVACY.md` §8 confirmed accurate against the live configuration.

### Validation

- The grep command above, run clean.
- Manual check that the Freemius listing shows the published EULA.

---

## Track P80-D - Store artwork

### Problem

`.wordpress-org/` does not exist yet. Banner, icon, and the five required screenshots are
all either uncommissioned or uncaptured — needed for both the WordPress.org and Freemius
listings.

**Already in motion, not starting from zero.** Per the
[Phase 76 close-out](archive/phases/PHASE76_REPORT.md), the identity is fully decided (name, palette, tagline, wordmark, icon motif — see
[`DESIGN_BRIEF.md`](design/DESIGN_BRIEF.md)) and the designer is cutting final assets: icon,
banners, lockups, favicon, and the "no image" placeholder. What remains here is the product
owner's side — the screenshots — plus dropping the designer's finals into place once they
arrive.

### Fix

- **Screenshots (product owner):** capture the 5 required shots per
  [`STORE_ASSETS.md`](design/STORE_ASSETS.md)'s manifest — order finalized in P76-K (Layout
  Builder canvas leading). Needs a seeded wp-env instance. Bundle in the same session, per
  Key Decision C above:
  - The 3 hover-glow verification screenshots the designer requested (see
    [FUTURE_TASKS.md](FUTURE_TASKS.md) → Design & Brand → "Hover-Glow Default Over Hostile
    Imagery").
  - A bounded extra set for the future Astragal/Mullion website (see FUTURE_TASKS.md →
    "Expand the Screenshot Capture Pass for the Astragal/Mullion Website"). Not required for
    this track's completion — capture opportunistically if the session is already running.
- **Designer finals:** once delivered, drop into `.wordpress-org/` (create the directory)
  with the exact filenames `STORE_ASSETS.md` specifies. Confirm the banner is legible at
  772×250 as well as 1544×500.

### Acceptance criteria

- `.wordpress-org/` exists and contains banner (both sizes), icon (128/256, optional SVG),
  and `screenshot-1.png` through `screenshot-5.png`.
- Screenshot captions in `readme.txt` match the captured content 1:1, in the P76-K order.
- Banner text stays clear of the extreme edges (avatar/badge overlap on the listing page)
  and reads at the smaller size.

### Validation

- Visual check against `STORE_ASSETS.md`'s capture guidance for each shot.
- Confirm file sizes are reasonable (compressed PNGs) before committing.

---

## Track P80-E - Premium launch validation

### Problem

`P62-A` / `P62-B` remain un-flipped to "shipped" pending manual and sandbox validation that
has not run yet. Automated gates are already green; what is missing is the human pass
through the actual purchase and licensing flows.

### Fix

- Confirm automated gates stay green: Vitest, PHPUnit license/gating suites,
  `i18n:check:locales`, the theme-contrast + component-axe a11y gates, `check:free-build`.
- Run the manual **Pro matrix** ([MARKETPLACE_READINESS.md](guides/MARKETPLACE_READINESS.md) §8b):
  the 3 gated features, server-side enforcement, and confirming existing Pro content still
  renders in the free build.
- Run **Freemius sandbox validation** (§8d): activate -> Pro unlocks -> simulated update ->
  deactivate -> re-lock -> opt-in dialog -> purchased/trial/expired states all reflected
  correctly.
- Run **live-marketplace validation** (§9): checkout with test cards, seat enforcement,
  trial/renewal, refund.
- Release via the **Release** workflow, with the version source of truth in sync and the ZIP
  containing production `vendor/`.

### Acceptance criteria

- All items above pass.
- `P62-A` and `P62-B` flip to shipped.

### Validation

- Automated: existing CI gates, already green.
- Manual: the Pro matrix, sandbox, and live-marketplace passes above — no substitute for
  actually running them.

---

## Track P80-F - Freemium ("lite") WP.org launch

### Problem

The free-build pipeline is done (P62-G stripping, P75-B dual-channel release), and the
WordPress.org account now exists (`astragal`, registered via **P76-C**, 2026-09-09). Three
account-security and submission steps remain before the plugin can actually be submitted,
plus the review-and-deploy cycle itself.

### Fix

- **Enable 2FA on the `astragal` account.** Mandatory since 2024-10-01 for any account with
  plugin commit access. Save the backup codes durably — losing both the method and the codes
  makes recovery very hard.
- **Generate the SVN password** (`profiles.wordpress.org/me/profile/edit/` -> Account &
  Security). A separate, randomly-generated credential, *not* the login password, because
  SVN auth cannot carry 2FA. This value goes into the `SVN_USERNAME` / `SVN_PASSWORD` GitHub
  secrets that `svn-deploy.yml` consumes.
- **Submit the plugin** at the developer portal, logged in as `astragal`. Plugin Check (PCP)
  must pass on the stripped free build; keep `Tested up to` current.
- **Correct the proposed slug to `mullion-gallery` during the one edit window before review
  opens.** The plugin header reads `Plugin Name: Mullion`, so WordPress.org will propose
  `mullion` — but `svn-deploy.yml`'s `SLUG:`, the text domain, every
  `languages/mullion-gallery-*` catalog, and the POT `X-Domain` are all hardcoded to
  `mullion-gallery`. **The slug cannot be changed after approval.**
- **On approval:** SVN-deploy; confirm Freemius serves the premium build via `is_premium`.

Full walkthrough for every step above in
[WORDPRESS_ORG_ACCOUNT_SETUP.md](guides/WORDPRESS_ORG_ACCOUNT_SETUP.md).

### Acceptance criteria

- 2FA active on the account with backup codes stored.
- SVN password generated and both GitHub secrets set.
- Slug is `mullion-gallery` post-approval, matching every hardcoded reference in the repo.
- Plugin Check green on the stripped free build.
- SVN repo live at `plugins.svn.wordpress.org/mullion-gallery/`.

### Validation

- `profiles.wordpress.org/astragal/` shows 2FA enabled (account-side check).
- Manual walkthrough of the submission flow, watching for the slug-edit window specifically.

---

## Track P80-G - Quality bars

### Problem

The structural a11y CI gate exists and is green, but the manual assistive-tech pass
(keyboard, screen-reader, Shadow-DOM, reflow) has not been run, and no decision is on record
for whether any finding from it would block launch or become a follow-on.

### Fix

Run the QA script in [ACCESSIBILITY_MANUAL_AUDIT.md](guides/ACCESSIBILITY_MANUAL_AUDIT.md).
Record the launch-blocking-vs-follow-on decision for whatever it finds, here or in
[ACCESSIBILITY.md](guides/ACCESSIBILITY.md).

### Acceptance criteria

- Audit run and findings recorded.
- Explicit blocking/non-blocking decision made for each finding, not left implicit.

### Validation

- The audit script itself; no separate automated check. Growing the *structural* a11y gate's
  coverage is tracked separately in [FUTURE_TASKS.md](FUTURE_TASKS.md) → Accessibility and is
  not part of this track.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Expanded screenshot capture for the Astragal/Mullion website | Deliberately unscoped until the website's own design work begins. Tracked in [FUTURE_TASKS.md](FUTURE_TASKS.md); the bounded version is folded into P80-D. |
| Growing the structural a11y gate's coverage beyond `LayoutTemplateList` | Existing `FUTURE_TASKS.md` entry (Accessibility). A quality bar, not a P80-G blocker. |
| Move the plugin header `Author:` / `Author URI:` to Astragal | Existing `FUTURE_TASKS.md` entry (Design & Brand), blocked on a live Astragal website existing to point `Author URI:` at. |

## Implementation Notes

_None yet — phase is Planned. Populate as tracks land, and update the corresponding
checkbox in [`GO_LIVE_PUNCH_LIST.md`](guides/GO_LIVE_PUNCH_LIST.md) in the same pass — the
two documents should never show different status for the same item._

## Outcome

_To be completed when the phase closes._
