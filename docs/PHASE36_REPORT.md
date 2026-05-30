# Phase 36 — Reload-Safe State, Admin Convergence & Draft Permissions

**Status:** Planned
**Created:** 2026-05-22
**Last updated:** 2026-05-30

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P36-A | Location & state persistence on reload (phased) | Planned | L |
| P36-B | Admin CampaignsTab inline edits + X3 convergence note | Planned | M |
| P36-C | Draft permissions audit & fix | Planned | M |
| P36-X1 | Layout-builder for listings — evaluation only | Pre-evaluation | S |
| P36-X2 | Shape adapters for listings — evaluation only | Pre-evaluation | S |

> **Note:** P36-A / P36-B / P36-C are implementation tracks. P36-X1 and P36-X2
> are carry-forwards from Phase 35 kept as *evaluation* tracks only — the output
> of each is a recommendation + effort estimate that the user will feed into a
> multi-agent evaluation pass for conversion into Phase 37+ implementation
> tracks.
>
> P36-X3 (Admin Panel listing convergence) is folded into P36-B since both
> touch CampaignsTab; the X3 evaluation deliverable lives inside the P36-B
> section below.
>
> Out of P36 scope and deferred to P37+: hero/spotlight adapter sizing
> controls (HA1) and Layout Builder non-canvas theme propagation (LB1).

---

## Rationale

Phase 35 shipped the listing-adapter unification pipeline and proved the
host/adapter split works for four adapters (compact-grid, masonry, justified,
classic carousel). Phase 36 turns to three classes of follow-up:

1. **Reload-safety (P36-A)**. The app is mounted inside WordPress with no
   React Router. Reloading anywhere kicks the user back to the campaign
   listing. The layout builder already auto-saves drafts to localStorage every
   30 s but never restores them on mount. The settings panel has no draft
   store at all. This costs real work and is a top user-pain item.
2. **Admin productivity & draft-visibility correctness (P36-B, P36-C)**.
   Admins must currently open the full edit modal to change status,
   visibility, or company on a campaign. Separately, the public REST endpoint
   hides drafts from anonymous users (via `post_status = 'publish'`), but
   logged-in non-admin users who have been *granted access* can still see
   drafts because `get_accessible_campaign_ids()` does not filter by the
   custom `status` post-meta. P36-C closes that gap; P36-B improves admin
   productivity and folds the carry-forward X3 evaluation in.
3. **Deferred adapter evaluations (P36-X1, P36-X2)**. Layout-builder and
   shape adapters were held back from Phase 35 for design research before
   code. P36 keeps these as evaluation deliverables only.

---

## Track P36-A — Location & State Persistence on Reload

### Problem

The app is hosted inside `wp-admin` (and on the public frontend via
shortcodes). It has no React Router; the visible "view" is controlled by
modal-disclosure state in `App.tsx`. On reload, all of that resets:

- The user is dropped back on the campaign-listing view regardless of where
  they were (layout builder, settings panel, an admin tab, etc.).
- Layout-builder working state is auto-saved to localStorage as
  `wpsg_layout_draft_<id>` every 30 s — but `useLayoutBuilderState.ts` never
  reads it on mount, so reloads silently discard the draft.
- The settings panel uses a Zustand draft store with no persistence at all;
  unsaved settings vanish on reload.
- Scroll position and accordion/disclosure expansion state are not captured
  anywhere.

The existing `useBuilderDeepLink.ts` hook already encodes the active builder
template into `?builder=<id>` via `history.pushState()` and is the correct
template for the rest of the navigation surfaces — WordPress owns the
top-level URL, so all reload-recovery has to flow through query-params +
localStorage.

### Goal

Reloading the page lands the user back where they were and recovers
in-flight work, across every top-level surface.

### Phasing

The work is split into two passes inside P36 so the persistence primitives
can be validated before extending them to fine-grained UI state.

**A1 — position + drafts** (ship first)

1. Persist the active top-level view (which modal is open: AdminPanel,
   SettingsPanel, LayoutBuilderModal, SignIn; plus the active admin tab)
   to a query-param + localStorage pair on every transition; restore on
   mount.
2. Restore the existing layout-builder localStorage draft on mount in
   `useLayoutBuilderState.ts`, with a conflict-resolution prompt ("your
   local draft is from <relative time> — restore or discard?") when the
   server-fetched template differs.
3. Add settings-panel draft persistence to the Zustand store in
   `SettingsStore.ts` (persist middleware, keyed per settings scope).

**A2 — scroll + expanded sections** (second pass within P36)

4. Per-view scroll-position capture (debounced) keyed by view identity.
5. Capture and restore expansion state on disclosure surfaces (Accordion
   `defaultValue` → controlled `value` persisted per-key).

### Key files

- `src/App.tsx` (modal/view disclosure hooks around lines 89–91).
- `src/components/Admin/AdminPanel.tsx` (already persists active tab via
  `useLocalStorage('wpsg_admin_active_tab')` — reuse pattern).
- `src/hooks/useLayoutBuilderState.ts` (existing draft writer ~lines
  1130–1146; add restore-on-mount + conflict UX).
- `src/contexts/SettingsStore.ts` (Zustand draft store — add persist
  middleware).
- `src/hooks/useBuilderDeepLink.ts` (existing `?builder=<id>` query-param
  pattern; generalize into a new `src/hooks/useReloadSafeView.ts` helper that
  each surface can opt in to with one call).

### Pre-conditions

- Phase 35 listing-adapter pipeline is stable (✓ done).
- A short investigation of multi-root scoping (see Open Follow-Ups below)
  before final localStorage-key conventions are locked in.

### Acceptance criteria

- Reload from each top-level surface (campaign listing, layout builder,
  settings panel, each admin tab, sign-in) returns to that surface, not the
  campaign listing.
- Layout-builder draft survives reload with the conflict-resolution prompt
  when it differs from the server-fetched template.
- Settings panel unsaved edits survive reload.
- A2: scroll position restored on the campaign listing and admin lists;
  admin accordion expansion preserved.
- No localStorage collisions between distinct React roots on the same page.

### Status: Planned

---

## Track P36-B — Admin CampaignsTab Inline Edits + X3 Convergence Note

### Problem

The admin desktop CampaignsTab currently requires opening the full
UnifiedCampaignModal for every edit, even for trivial changes to status,
visibility, or company. This is friction for any operator who needs to
re-bucket campaigns across a normal workday. Separately, Phase 35 deferred
P36-X3 ("Admin Panel listing convergence — recommendation") as a
recommendation track; since AD1's implementation touches the same table,
folding the X3 deliverable in here is the natural fit.

### Goal

1. Inline-edit status, visibility, and company directly in the admin
   CampaignsTab table without entering the per-campaign edit modal.
2. Produce the X3 convergence recommendation (mobile list + desktop
   Table/Cards toggle) as a documented deliverable appended to this report.

### Implementation outline

1. **Status** and **Visibility** cells in `useCampaignsRows.tsx` become
   compact-variant Mantine `Select` controls (3-option and 2-option
   respectively). Values per `wpsg_campaign` post-meta: status =
   `draft | active | archived`; visibility = `public | private`.
2. **Company** cell becomes a Mantine `Autocomplete`. The source list is
   the existing companies set — if no fetch hook exists for that today, a
   small REST endpoint will be added under
   `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` to enumerate
   distinct company values (with the `php-testing` skill used for any new
   PHP test coverage). As a first-pass fallback the autocomplete may derive
   from currently loaded campaigns; the REST endpoint is the preferred end
   state.
3. **Optimistic updates**: write to the TanStack Query cache immediately,
   fire the mutation, revert + toast on failure. Reuse the same mutation
   hook the UnifiedCampaignModal already calls so all field-validation and
   server rules stay centralized.
4. **Permission gating**: each inline control is disabled when the current
   user can't edit that campaign — reuse the capability check that gates
   the existing Edit button.

### X3 convergence deliverable (folded in)

Appended to the Implementation Notes section of this report when P36-B
lands. Answers:

- Should `CampaignsMobileList.tsx` switch to the listing-adapter pipeline?
  Effort estimate.
- Should the desktop tab gain a Table/Cards view toggle that reuses the
  listing-adapter pipeline for the cards mode? Effort estimate.
- Recommended path forward (likely deferred to P37 but documented now).

### Key files

- `src/components/Admin/CampaignsTab.tsx` — desktop table.
- `src/hooks/useCampaignsRows.tsx` — row rendering / cell definitions.
- `src/components/Campaign/UnifiedCampaignModal.tsx` — current single source
  for these field controls; reuse its validation + mutation hook.
- `src/components/Admin/CampaignsMobileList.tsx` — referenced by the X3
  convergence evaluation only.
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` — companies-list
  endpoint, if the existing API doesn't already cover this.

### Acceptance criteria

- Inline edits work for status, visibility, and company; updates persist
  server-side and survive reload.
- Optimistic update + error-revert verified by manual test.
- Permission gating verified with a non-owner user.
- X3 convergence note appended to the Implementation Notes section.
- Any new PHP code is covered by tests authored via the `php-testing` skill.

### Status: Planned

---

## Track P36-C — Draft Permissions Audit & Fix

### Problem

Audit of `class-wpsg-rest.php` confirms a permission gap in the
granted-access path:

- `list_campaigns` hardcodes `'post_status' => 'publish'`. WordPress
  `post_status` is always `'publish'` for `wpsg_campaign`; the custom
  `status` value (`draft | active | archived`) lives in post-meta and is
  used only for surfacing in admin labelling and filters.
- Anonymous viewers: drafts are effectively hidden because the visibility
  check (`visibility == 'public'`) is enforced before any custom-status
  meta could leak draft items.
- Logged-in non-admin users with explicit grants: the request flows through
  `get_accessible_campaign_ids($user_id)` (~line 1509) with **no
  draft-status filter**. A user granted access to a draft campaign will see
  it. That contradicts the desired rule.

Desired rule (per user, this phase): drafts are visible only to the author,
to admins, and to granted-access users who are themselves admins.

### Goal

Enforce the desired draft-visibility rule across every endpoint that returns
campaigns, with regression coverage.

### Implementation outline

1. In `class-wpsg-rest.php`, add a `status != 'draft'` post-meta filter to
   the granted-access query path and any other public-facing or
   non-admin-scoped campaign queries. Admins bypass the filter. Authors
   bypass for their own campaigns (compare `post_author` to the current
   user).
2. **Audit**: enumerate every REST route that returns one or more
   campaigns (list, single fetch, search, related). Apply the rule
   uniformly so a single-fetch path can't be used to bypass it.
3. **Tests**: add PHPUnit coverage for the role × draft visibility matrix
   (admin / author-of / granted-access non-admin / granted-access admin /
   anonymous), authored via the `php-testing` skill.
4. Append the resulting permission matrix to the Implementation Notes
   section of this report as long-lived documentation.

### Key files

- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` — primary
  changes (filter additions, audit findings).
- New / extended PHPUnit cases under the existing PHP test directory —
  authored via the `php-testing` skill.

### Acceptance criteria

- Admin sees all drafts.
- Author sees their own drafts (only).
- Granted-access non-admin: drafts hidden, even when the grant exists.
- Granted-access admin: sees drafts.
- Anonymous: drafts hidden.
- PHPUnit role × draft matrix passes.
- Permission matrix documented in this report.

### Status: Planned

---

## Track P36-X1 — Layout-Builder for Listings (Evaluation Only)

### Problem

`layout-builder` is currently not tagged `'listing-compatible'` in the
adapter registry. A layout-template defines positioned zones on a grid;
each zone renders a `<GalleryMediaTile>`. For campaign listings, each zone
would need to render a full `<CampaignCard>` (or parts of it: thumbnail,
title, description, badge, lock indicator). The slot composition design is
substantially different from media-tile rendering.

### Goal

Evaluate and specify how a layout-template's slot can host campaign-card
content. Produce:

1. A brief design doc (how slots map to card sections).
2. An effort estimate for implementation.
3. A go/no-go recommendation for Phase 37 implementation.

### Pre-conditions

Phase 35 listing-adapter pipeline is stable (✓ done). At least one
real-world usage of the listing adapter in production, giving feedback on
whether the layout-builder is worth the complexity.

### Acceptance criteria (evaluation track)

- Design doc created in `docs/` or as an Implementation Notes entry in this
  report.
- Effort estimate provided.
- Recommendation captured in this report.

### Status: Pre-evaluation

---

## Track P36-X2 — Shape Adapters for Listings (Evaluation Only)

### Problem

`hexagonal`, `circular`, and `diamond` adapters are not tagged
`'listing-compatible'`. They clip media tiles to non-rectangular shapes
using SVG masks / `clip-path`. Campaign cards have:

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

### Acceptance criteria (evaluation track)

- UX assessment captured in `docs/` or this report.
- Decision recorded: include / include-opt-in / reject.
- If include: implementation scope and estimate.

### Status: Pre-evaluation

---

## Implementation Notes

_Updated as tracks land._

### Open follow-ups

- **Multi-root localStorage scoping (P36-A)** — confirm before locking key
  conventions. Specifically check: (1) `src/main.tsx` mounting logic to
  understand single-root vs multi-root invocation; (2) shortcode registration
  in the PHP plugin (`wp-plugin/wp-super-gallery/`) — can two
  `[wp-super-gallery]` shortcodes appear on the same post, and can a
  frontend shortcode appear on a page that also mounts the admin panel?;
  (3) whether shadow DOM is used per root (it is, per Phase 35
  exploration) — note that shadow DOM does *not* isolate localStorage
  (localStorage is per-origin), so per-root key prefixes are still required
  if multi-root co-mounting is possible; (4) any existing
  `STORAGE_KEY_PREFIX` constants or per-root scoping conventions in the
  codebase that should be reused rather than reinvented. The outcome of
  this check determines whether `useReloadSafeView` keys look like
  `wpsg_view_<rootId>` or just `wpsg_view`.

- **Companies-list source (P36-B)** — locate the existing fetch path for
  the set of distinct companies, if any. If none exists, P36-B includes a
  small REST endpoint under `class-wpsg-rest.php` (covered by tests via the
  `php-testing` skill) to enumerate distinct company values; an
  in-memory derivation from loaded campaigns is acceptable as a transient
  first pass but is not the end state.

---

## Outcome

_To be filled when Phase 36 is marked Complete._

---

## Related Planning

- Continues from: `docs/PHASE35_REPORT.md` (Campaign Listing Adapter
  Unification — Complete).
- Builds on: Phase 35 listing-adapter pipeline (`CardGallery.tsx` host,
  `CardGalleryHostPagination.tsx`, four listing-compatible adapters).
- Deferred to P37+:
  - **HA1** — Hero / Spotlight gallery sizing controls. Targeted: add a
    `spotlightHeroMaxWidth` dimension control, and a parallel
    `scrollSnapMaxWidth` for the Scroll Snap adapter, which has the same
    gap. Other adapters (compact-grid, masonry, justified, shape) already
    expose width / column / tile-size controls.
  - **LB1** — Layout Builder non-canvas theme propagation. Audit + remap
    the ~15–20 files that hardcode rgba/hex colors (canvas overlays: grid,
    rulers, smart guides, measurement labels; plus slot selection borders
    and a few panel backgrounds). Canvas content rendering is explicitly
    out of scope.
- Carry-forward bookkeeping: P36-X1 / P36-X2 originated from P35-I
  carry-forward; P36-X3 originated likewise and is folded into P36-B in
  this phase.
