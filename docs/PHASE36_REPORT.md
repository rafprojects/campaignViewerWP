# Phase 36 — Listing-Adapter Carry-Forward & TBD

**Status:** Planned
**Created:** 2026-05-22
**Last updated:** 2026-05-22

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P36-X1 | Layout-builder for listings — deep-dive evaluation | Pre-evaluation | TBD |
| P36-X2 | Shape adapters for listings — UX/design evaluation | Pre-evaluation | TBD |
| P36-X3 | Admin Panel listing convergence — recommendation | Pre-evaluation | TBD |

> **Note:** Tracks P36-X1 through P36-X3 are carry-forwards from Phase 35.
> They are *evaluation* tracks, not implementation tracks — the output of each
> is a recommendation + effort estimate, not shipped code. Full implementation
> tracks (P36-A, P36-B, …) will be added when the next development focus is
> decided.

---

## Rationale

Phase 35 shipped the listing-adapter unification pipeline and proved the
host/adapter split works for four adapters (compact-grid, masonry, justified,
classic carousel). Three categories of adapter were intentionally deferred
because they require design research before code:

1. **Layout-builder (P36-X1)**: A layout-template's positioned slot holds
   media tiles. Having it hold a full campaign card (cover image, title,
   description, lock overlay, access badge, click→CampaignViewer) requires
   new composition design — not just plumbing.
2. **Shape adapters (P36-X2)**: Hexagonal/circular/diamond tiles work for
   square-ish media thumbnails. Campaign cards contain text, badges, and
   gradient overlays; whether they remain legible and accessible inside
   non-rectangular clips is an open UX question.
3. **Admin Panel convergence (P36-X3)**: The desktop admin campaign table is
   column-shaped and out of scope. The mobile admin list is closer to a card
   listing, but it is a different product surface with its own priorities.
   Should both eventually use the listing-adapter pipeline? A recommendation
   track is the right starting point.

---

## Track P36-X1 — Layout-Builder for Listings

### Problem

`layout-builder` is currently not tagged `'listing-compatible'` in the adapter
registry. A layout-template defines positioned zones on a grid; each zone renders
a `<GalleryMediaTile>`. For campaign listings, each zone would need to render
a full `<CampaignCard>` (or parts of it: thumbnail, title, description, badge,
lock indicator). The slot composition design is substantially different from
media-tile rendering.

### Goal

Evaluate and specify how a layout template's slot can host campaign-card
content. Produce:

1. A brief design doc (how slots map to card sections).
2. An effort estimate for implementation.
3. A go/no-go recommendation for Phase 37 implementation.

### Pre-conditions

Phase 35 listing-adapter pipeline is stable (✓ done). At least one real-world
usage of the listing adapter in production, giving feedback on whether the
layout-builder is worth the complexity.

### Acceptance criteria (for the evaluation track)

- Design doc created in `docs/` or as a comment in the phase report.
- Effort estimate provided.
- Recommendation captured in this report.

### Status: Pre-evaluation

---

## Track P36-X2 — Shape Adapters for Listings

### Problem

`hexagonal`, `circular`, and `diamond` adapters are not tagged
`'listing-compatible'`. They clip media tiles to non-rectangular shapes using
SVG masks / `clip-path`. Campaign cards have:
- Text content (title, description, company name).
- Gradient overlays (hover + lock).
- Badges (access, company logo).
- Click targets (entire card → CampaignViewer).

Whether these elements remain legible, accessible, and interactive inside a
hexagonal clip is an open question that warrants design prototyping before
engineering investment.

### Goal

Evaluate feasibility and desirability of shape adapters in listing mode.
Produce:

1. A brief UX assessment (legibility, accessibility, mobile usability).
2. A recommendation: implement with constraints, implement opt-in only, or
   formally reject for listings.
3. If recommended: an effort estimate and scope for Phase 37 implementation.

### Acceptance criteria (for the evaluation track)

- UX assessment captured in `docs/` or this report.
- Decision recorded: include / include-opt-in / reject.
- If include: implementation scope and estimate.

### Status: Pre-evaluation

---

## Track P36-X3 — Admin Panel Listing Convergence

### Problem

The desktop admin campaign table (`CampaignsTab.tsx`) is column-shaped
(sort, search, bulk-select) and intentionally excluded from Phase 35. The
mobile admin list (`CampaignsMobileList.tsx`) is closer to a card listing
but serves a different primary use-case (admin CRUD operations vs. public
discovery). The question for this track is whether either surface should
eventually join the listing-adapter pipeline.

### Goal

Produce a recommendation:

1. Should `CampaignsMobileList.tsx` be refactored to use the listing-adapter
   pipeline? If yes: estimate effort, identify required adapter changes.
2. Should the desktop admin gain a "View: Table | Cards" toggle that reuses
   the listing-adapter pipeline for the cards view? If yes: design the toggle,
   scope, estimate.
3. Confirm that shape/layout-builder adapters (P36-X1, P36-X2) don't need to
   be resolved first.

### Acceptance criteria (for the evaluation track)

- Recommendation captured in this report.
- If yes to either: scope + effort estimate.
- If no: rationale documented.

### Status: Pre-evaluation

---

## Implementation Notes

_Updated as tracks land._

---

## Outcome

_To be filled when Phase 36 is marked Complete._

---

## Related Planning

- Continues from: `docs/PHASE35_REPORT.md` (Campaign Listing Adapter
  Unification — Complete).
- Builds on: Phase 35 listing-adapter pipeline (`CardGallery.tsx` host,
  `CardGalleryHostPagination.tsx`, four listing-compatible adapters).
- Deferred items tracked here originated from P35-I carry-forward bookkeeping.
