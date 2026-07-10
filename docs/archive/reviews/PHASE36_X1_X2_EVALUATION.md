# Phase 36 Supplemental Evaluation - P36-X1 / P36-X2

**Date:** 2026-05-30
**Status:** Evaluated - Ready for review
**Related:** [PHASE36_REPORT.md](../phases/PHASE36_REPORT.md), [PHASE35_REPORT.md](../phases/PHASE35_REPORT.md), [PHASE36_FOLLOWUP_FINDINGS.md](./PHASE36_FOLLOWUP_FINDINGS.md)

---

## Executive Summary

This supplement closes the two Phase 36 evaluation-only tracks that were intentionally deferred from Phase 35's listing-adapter rollout.

- **P36-X1 (Layout-builder for listings): conditional go.** The only credible Phase 37 implementation path is a constrained **whole-card-per-slot** model. It fits the current listing adapter contract and preserves the Phase 35 host/adapter split. It should not begin as free-form slot-to-card-section composition.
- **P36-X1 slot-to-card-section composition: not implementation-ready.** The current slot model is media-oriented, not semantic-content-oriented. It requires new data modeling, builder UX, responsive rules, validation, and testing before it should enter implementation planning.
- **P36-X2 (shape adapters for listings): reject as first-class listing support.** Hexagonal and diamond are not viable for production campaign cards. Circular is only marginally less broken and still fails the full-card requirement once text, badges, lock states, and touch/focus behavior are included.
- **Experimental fallback:** if product leadership insists on a novelty prototype, keep it **thumbnail-only**, **opt-in**, and **explicitly non-recommended**. That path does not meet the current campaign-card bar and should not be treated as parity support.

---

## Scope and Evidence

This evaluation is based on the current implementation, not on hypothetical greenfield designs.

### Key files reviewed

- `src/components/Galleries/Adapters/GalleryAdapter.ts`
- `src/components/Galleries/Adapters/adapterRegistry.ts`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/CampaignGallery/CampaignCard.tsx`
- `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`
- `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`
- `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx`
- `src/types/index.ts`
- `src/utils/layoutSlotAssignment.ts`
- `src/components/Galleries/Adapters/hexagonal/HexagonalGallery.tsx`
- `src/components/Galleries/Adapters/circular/CircularGallery.tsx`
- `src/components/Galleries/Adapters/diamond/DiamondGallery.tsx`
- `docs/testing/QA_PLAN_LAYOUT_BUILDER.md`

### Current listing adapter baseline

Phase 35 established the canonical listing contract:

1. `GalleryAdapterProps` now supports `items`, `renderItem`, and `listingMode`.
2. `CardGallery` resolves the active listing adapter, passes a slice of campaign items, and supplies `renderItem` that returns `<CampaignCard />`.
3. The adapter owns layout only; the host owns item rendering, filters, modal state, and most listing behavior.
4. Only `classic`, `compact-grid`, `justified`, and `masonry` are currently marked `listing-compatible`.

That split is the anchor for evaluating both deferred tracks. Any future listing adapter should preserve this contract unless there is a compelling architectural reason not to.

---

## P36-X1 - Layout-Builder for Listings

### Current state

The current layout-builder pipeline is media-specific.

- `LayoutBuilderGallery` accepts `media`, `templateId`, `slotOverrides`, and lightbox-related props. It does **not** currently accept `items` or `renderItem`.
- `assignMediaToSlots()` binds media to slots by media identity and fallback order. The utility assumes the rendered content is a media item, not an arbitrary listing item.
- `LayoutSlot` stores geometry and image/effect data such as `shape`, `objectFit`, `objectPosition`, `clickAction`, and `hoverEffect`.
- `SlotPropertiesPanel` exposes image-centric controls: fit, focal point, border, blend, overlay, tilt, and lightbox/no-click behavior.
- `GallerySlotView` renders positioned media, placeholders, and lightbox interactions. It is built around image/video rendering semantics, not content regions.

This means X1 is not blocked by missing layout power. It is blocked by the mismatch between a **semantic campaign card** and a **media slot abstraction**.

### Option A - Whole card per slot

**Assessment:** viable and recommended as the only Phase 37 implementation candidate.

This model keeps the Phase 35 contract intact:

1. `layout-builder` becomes `listing-compatible` in the registry.
2. `LayoutBuilderGallery` gains a listing-mode branch that accepts `items`, `renderItem`, and `listingMode`.
3. Each template slot becomes a positioned container for one whole campaign card.
4. The host continues to render `<CampaignCard />`; the adapter only places it.

#### Why this fits the current architecture

- It preserves the host/adapter split already proven by Phase 35.
- It avoids duplicating campaign-card logic inside the layout-builder adapter.
- It lets the listing surface reuse card permissions, lock state, badges, and viewer behavior without inventing a second card system.
- It gives the layout-builder a credible listing role without changing its core value proposition: authored spatial placement.

#### Required constraints

This path is viable only if it begins with explicit constraints.

**1. Rectangle-first slot policy**

The initial listing-compatible version should treat rectangular slots as the baseline. Existing shape and mask controls can remain available for media galleries, but they should not define the first listing implementation.

**2. Compact card baseline**

`CampaignCard` supports an optional info panel, badges, overlays, and lock/request-access affordances. A first implementation should use a compact or fixed-height card baseline so slot height remains predictable. Full free-form card height inside arbitrary slots should not be the first version.

**3. Slot count becomes a page-size contract**

Unlike masonry or grid layouts, a layout template has a fixed number of visible slots. Listing mode therefore needs a deliberate rule for page size. The cleanest version is: one page of listing items equals one template fill. If page size and slot count diverge, the adapter either hides items or renders empty slots. That behavior must be owned intentionally, not left accidental.

**4. Listing mode should ignore media-identity slot binding**

`assignMediaToSlots()` is designed for media identity, attachment matching, and per-campaign overrides. Campaign listings are not stable identity-bound layouts in the same way. For listing mode, slots should be treated as **ordered containers**, not fixed campaign bindings.

**5. Click behavior must stay card-owned**

Current slots only understand `lightbox` or `none`. In listing mode, the primary interaction should remain the card's existing CampaignViewer/open-card behavior. Slot-level interaction must either defer to the card or become listing-aware through an explicit new semantic. Reusing lightbox semantics here would be the wrong abstraction.

#### Effort estimate

| Scope | Effort | Notes |
|------|--------|-------|
| Render-only whole-card-per-slot branch with slot-count-aware pagination assumptions | **M** | Adapter branch, registry change, tests, basic listing QA |
| Same plus listing-specific editor guardrails, warnings, and template validation | **L** | Adds builder UI work and stronger template constraints |

#### Risks that remain even on the recommended path

- Template authors may create visually clever but operationally poor listing layouts if listing constraints are not surfaced in the builder.
- Existing slot properties such as mask, tilt, and clip-path remain easy to misuse against campaign cards.
- Pagination/page-size semantics become less generic than other listing adapters.
- Responsive behavior will need deliberate QA because authored slot geometry is less forgiving than flow-based layouts.

### Option B - Slot-to-card-section composition

**Assessment:** research-only; do not promote to Phase 37 implementation.

This model treats the layout template as a composition surface for card regions such as thumbnail, title, description, access badge, company badge, or lock state.

#### Why it does not fit the current codebase

The current layout-builder model has no concept of semantic content regions.

- `LayoutSlot` can describe geometry, shape, image fit, and effects, but not content role.
- `SlotPropertiesPanel` edits image-centric properties, not card sections.
- `LayoutBuilderGallery` renders one media payload per slot, not a card-section registry.
- `CampaignCard` is a composed, conditional component. It is not already broken into a reusable slot-schema that the layout builder can author.

#### What would be required before implementation

1. A new slot content model, for example `slotContentType = thumbnail | title | description | badge | company | lock | custom`.
2. A section registry that maps content roles to rendering logic.
3. Rules for required vs optional sections and how they behave when card settings hide certain sections.
4. Responsive composition rules for text truncation, overflow, badge placement, and focus order.
5. Builder UX for authoring, validating, and previewing section-based templates.
6. A new test matrix covering semantic rendering, accessibility, and template validity.

This is not a small extension of the current layout builder. It is a second authoring system.

#### Effort estimate

| Scope | Effort | Notes |
|------|--------|-------|
| Discovery, content-model design, and prototype work | **L** | Still pre-implementation work |
| Production-ready slot-to-section implementation | **XL** | New schema, new editor semantics, new QA burden |

### P36-X1 recommendation

**Recommendation:** carry only the whole-card-per-slot path into Phase 37 planning.

Conditions for that promotion:

1. Treat slots as ordered card containers, not fixed campaign bindings.
2. Start with rectangle-first templates and compact card behavior.
3. Define the slot-count/page-size rule up front.
4. Keep click/viewer ownership with the card rather than retrofitting lightbox semantics.
5. Leave slot-to-card-section composition as a separate R&D track rather than merging it into the first implementation.

**Go / No-go:**

- **Whole-card-per-slot:** **GO, with constraints**
- **Slot-to-card-section composition:** **NO-GO for Phase 37 implementation**

---

## P36-X2 - Shape Adapters for Listings

### Current state

The current shape adapters are deliberately media-tile adapters, not card adapters.

- `HexagonalGallery` renders fixed-size clipped buttons using a hexagonal `clip-path`, hidden overflow, and a centered overlay icon.
- `DiamondGallery` does the same with a diamond `clip-path` and interlocked row overlap.
- `CircularGallery` renders fixed-size circular tiles with hidden overflow and centered overlay treatment.
- All three assume a square tile, `object-fit: cover`, simple hover overlays, and lightbox-style click behavior.
- None are marked `listing-compatible` in the adapter registry.

By contrast, `CampaignCard` assumes:

- a full-card click target,
- corner-positioned badges,
- optional text and metadata sections,
- lock/request-access states,
- gradient and border treatments,
- configurable but still fundamentally rectangular card behavior.

### Core mismatch

The mismatch is not just technical. It is product-level.

Shape adapters are optimized for image browsing. Campaign listings are optimized for campaign recognition, status comprehension, and access decisions. Those are different jobs.

### UX and accessibility assessment

| Adapter | Visual fit | Card-semantic fit | Accessibility fit | Recommendation |
|--------|------------|-------------------|-------------------|----------------|
| **Hexagonal** | Poor | Poor | Poor | Reject |
| **Diamond** | Poor | Poor | Poor | Reject |
| **Circular** | Marginally better | Poor | Poor | Reject for production listings |

#### Hexagonal

- Corner badges are clipped or forced into awkward in-shape positions.
- Text panels do not fit the geometry without collapsing into a tiny readable area.
- Hidden overflow and clipped hit areas reduce focus clarity and touch confidence.
- The honeycomb layout is visually strong for media but weak for list scanning and campaign comparison.

#### Diamond

- The same badge and text issues exist, with even less stable rectangular reading area.
- The overlapped lattice makes list scanning worse once text or lock/access states matter.
- Focus outlines and touch targets become harder to reason about because the visible shape and the functional bounds diverge.

#### Circular

- Circular tiles are slightly more forgiving visually, but the underlying problem remains.
- If the info panel is preserved, the card escapes the circle and stops behaving like a circle.
- If the info panel is removed, the listing stops behaving like a campaign card and becomes a thumbnail picker.
- That may be visually interesting as a novelty mode, but it is not parity with the current listing contract.

### Why full-card support should be rejected

To make full campaign cards work inside the shape adapters, the implementation would need to give up most of what currently makes them shape adapters.

At that point the product pays the complexity cost of a special-case listing adapter without getting a strong functional payoff. The result is likely to be worse than the existing rectangular adapters on readability, accessibility, and mobile behavior.

### Experimental opt-in path

If a future phase insists on experimentation, the only defensible scope is a clearly limited novelty mode.

**Allowed experimental scope:**

1. Thumbnail-first rendering only.
2. No claim of full campaign-card parity.
3. Explicit experimental labeling in UI and docs.
4. Non-default selection; users must opt in deliberately.
5. Prefer testing circular first if any one adapter is chosen, because it is the least visually hostile of the three.

**What that experiment still does not solve:**

- full text legibility,
- badge parity,
- request-access UI parity,
- rectangular focus/touch predictability,
- consistent mobile scanability.

That is why the experiment should remain clearly separated from first-class listing support.

#### Effort estimate for the experimental path

| Scope | Effort | Notes |
|------|--------|-------|
| Thumbnail-only experimental shape-listing spike | **S-M** | Technically possible but product-weak |
| Full-card shape-listing parity | **Do not pursue** | Rejected on product and accessibility grounds |

### P36-X2 recommendation

**Recommendation:** do not promote X2 into a normal Phase 37 implementation track.

**Go / No-go:**

- **Hexagonal listings:** **REJECT**
- **Diamond listings:** **REJECT**
- **Circular listings:** **REJECT for production support**
- **Thumbnail-only experimental opt-in:** document-only fallback; not recommended roadmap work

---

## Decision Matrix

| Option | Technical fit | Product fit | Accessibility fit | Effort | Decision |
|--------|---------------|-------------|-------------------|--------|----------|
| X1 whole-card-per-slot | Good with constraints | Good if rectangle-first | Acceptable if card semantics stay intact | **M-L** | **Promote** |
| X1 slot-to-card-section composition | Weak today | Unproven | Unknown until redesigned | **L-XL** | **Do not promote** |
| X2 full-card shape adapters | Poor | Poor | Poor | N/A | **Reject** |
| X2 thumbnail-only experimental shapes | Technically possible | Weak | Weak | **S-M** | **Do not recommend** |

---

## Phase 37 Guidance

If Phase 37 needs one follow-on from this supplement, it should be a constrained X1 implementation track, not an X2 shape-listing effort.

### Recommended Phase 37 candidate

**Layout-builder listings via whole-card-per-slot**, with the following boundaries:

1. Rectangle-first slot guidance.
2. Compact/fixed-height listing-card baseline.
3. Explicit page-size vs slot-count rule.
4. Listing mode that treats slots as ordered containers.
5. Additional test coverage in `LayoutBuilderGallery.test.tsx` and manual QA additions to `QA_PLAN_LAYOUT_BUILDER.md`.

### Not recommended for Phase 37

1. Slot-to-card-section composition.
2. First-class listing support for hexagonal, circular, or diamond adapters.
3. Positioning X2 experiments as if they were equivalent to the current campaign-card listing experience.

---

## Final Determinations

### P36-X1

**Determination:** viable only as **whole-card-per-slot**. Recommend promotion to Phase 37 planning with explicit constraints.

### P36-X2

**Determination:** **reject** as first-class listing support. Keep only a narrow, clearly non-recommended thumbnail-only experiment on the table if future stakeholders insist on prototyping.

---

## Notes

- No implementation or registry changes were made as part of this evaluation.
- This supplement is intended to satisfy the evaluation deliverables requested by P36-X1 and P36-X2 in `PHASE36_REPORT.md`.
- `PHASE36_FOLLOWUP_FINDINGS.md` remains the source of truth for the separate P36-A / P36-B pre-implementation follow-up checks.