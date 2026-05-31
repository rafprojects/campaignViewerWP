# Phase 36 — Reload-Safe State, Admin Convergence & Draft Permissions

**Status:** Planned
**Created:** 2026-05-22
**Last updated:** 2026-05-30

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P36-A | Location & state persistence on reload (phased) | ✅ Completed | L |
| P36-B | Admin CampaignsTab inline edits + X3 convergence note | Planned | M |
| P36-C | Draft permissions audit & fix | Planned | M |
| P36-X1 | Layout-builder for listings — evaluation only | ✅ Evaluated → GO (P37-LB) | S |
| P36-X2 | Shape adapters for listings — evaluation only | ✅ Evaluated → Rejected | S |

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

The app is mounted into WordPress through alternate bootstrap paths in
`src/main.tsx` (`#root` or one or more `.wp-super-gallery` hosts). It has no
React Router; the visible "view" is controlled by modal-disclosure state in
`App.tsx`, and the admin panel itself is an in-app surface rather than a
separate SPA. On reload, all of that resets:

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
  to a query-param + root-scoped localStorage pair on every transition;
  restore on mount. The key convention is locked as
  `wpsg_view_<rootId>_<feature>` with `rootId` created for every mount mode,
  not only the shared-root shortcode path.
2. Restore the existing layout-builder localStorage draft on mount in
   `useLayoutBuilderState.ts`, with a conflict-resolution prompt ("your
  local draft is from <relative time> — restore or discard?") when the
  server-fetched template differs. The persisted draft payload should carry
  enough metadata (at minimum saved-at time and version context) to make that
  prompt reliable.
3. Add settings-panel draft persistence to the Zustand store in
  `SettingsStore.ts` (persisted draft + metadata keyed per settings scope),
  and reconcile that persisted draft against fresh server settings on hydrate
  rather than trusting a stale persisted baseline.

**A2 — scroll + expanded sections** (second pass within P36)

4. Per-view scroll-position capture (debounced) keyed by root-scoped view
  identity.
5. Capture and restore expansion state on disclosure surfaces (Accordion
   `defaultValue` → controlled `value` persisted per-key).

### Key files

- `src/main.tsx` (mount topology; add a universal root-id helper and wrap every
  `renderApp()` path with a `RootIdContext` provider).
- `src/App.tsx` (modal/view disclosure hooks around lines 89–91; top-level view
  state remains the source of truth).
- `src/components/Admin/AdminPanel.tsx` (fold existing
  `wpsg_admin_active_tab` persistence into the new reload-safe/root-scoped
  mechanism instead of keeping a competing key).
- `src/hooks/useLayoutBuilderState.ts` (existing draft writer ~lines
  1130–1146; extend to structured draft metadata + restore-on-mount + conflict
  UX).
- `src/contexts/SettingsStore.ts` (Zustand draft store — add persistence keyed
  per settings scope and reconcile against fresh server settings).
- `src/hooks/useBuilderDeepLink.ts` (existing `?builder=<id>` query-param
  pattern; generalize into a new `src/hooks/useReloadSafeView.ts` helper that
  each surface can opt in to with one call).

### Pre-conditions

- Phase 35 listing-adapter pipeline is stable (✓ done).
- P36 follow-up decisions are now locked: reload-safe keys use
  `wpsg_view_<rootId>_<feature>` with root identity created for every mount
  mode; the broader legacy admin/media localStorage audit is deferred to P37.

### Acceptance criteria

- Reload from each top-level surface (campaign listing, layout builder,
  settings panel, each admin tab, sign-in) returns to that surface, not the
  campaign listing.
- Admin tab persistence is restored through the same reload-safe/root-scoped
  mechanism, not a competing standalone key.
- Layout-builder draft survives reload with the conflict-resolution prompt
  when it differs from the server-fetched template.
- Settings panel unsaved edits survive reload and reconcile against fresh
  server settings.
- A2: scroll position restored on the campaign listing and admin lists;
  admin accordion expansion preserved.
- No localStorage collisions between distinct shortcode roots on the same
  page.

### Status: A1 + A2 Complete · Layout-Builder draft restore requires replanning (see below)

### Implementation decisions (pre-code Q&A, 2026-05-30)

**LayoutBuilderModal surface (Q1).** The layout builder is not a separate
top-level modal in `App.tsx`. It lives inside `AdminPanel` and is opened via
`initialBuilderTemplateId` / the existing `?builder=<id>` deep-link in
`useBuilderDeepLink.ts`. Restoring `isAdminPanelOpen → true` (A1 item 1) plus
the existing deep-link is sufficient to return the user to the builder on
reload; no separate "LayoutBuilderModal" view-persistence entry is needed.
_Action: if restoring AdminPanel + `?builder=<id>` does NOT reliably reopen the
builder on reload (e.g. timing issues between auth, template fetch, and the
`initialBuilderTemplateId` flow), revisit and add an explicit builder-open
persistence path. Check `LayoutTemplateList.tsx` lines ~134-145 for the
deep-link handler._

**SignIn surface (Q2).** Excluded from view persistence. The sign-in modal is
transient; auto-reopening it on reload would be surprising and can't be
disambiguated from "deliberate reload to cancel login."

**Settings "scope" (Q3).** The settings scope = the Settings Panel being open
(A1 item 1) + the active tab (persisted to
`wpsg_view_<rootId>_settings_tab`) + the draft settings data (persisted to
`wpsg_settings_draft_<rootId>` with a `{ savedAt, settings }` wrapper). Accordion
expansion state inside the settings panel is A2 (stretch — see Q6 decision
below).

**Layout-builder draft metadata contract (Q4).** The autosave payload is
upgraded from raw `LayoutTemplate` JSON to a wrapper struct
`LayoutDraftPayload { savedAt: number; serverUpdatedAt: string; schemaVersion:
number; template: LayoutTemplate }`. `savedAt` is `Date.now()` at each
autosave tick. `serverUpdatedAt` captures `template.updatedAt` at save time,
enabling conflict detection (`draft.serverUpdatedAt !== currentTemplate.updatedAt`
→ server was updated in another session since this draft was written). The
existing `LayoutBuilderModal` draft-restore effect was comparing
`draft.updatedAt` (the server timestamp) against itself, so drafts were
always silently discarded — the `savedAt` field fixes this.
_Export `LayoutDraftPayload` from `useLayoutBuilderState.ts` for reuse._

**Settings draft restore UX (Q5).** Explicit restore/discard prompt (not
silent) for the same reason: silent restoration defeats using reload as an easy
"throw away uncommitted edits" escape hatch.

**A2 scope (Q6).** A2 shipped within P36 alongside A1.

**Layout-Builder draft restore — requires replanning.** The P36-A1
implementation introduced the `LayoutDraftPayload` wrapper and fixed the
broken `savedAt`-vs-server-`updatedAt` comparison. However, the draft restore
prompt is unreliable in practice (shows ~1/10 reloads) and does not carry
changes through when it does appear. A deeper fix is needed:

- The 30-second autosave interval means a fresh session may reload before
  any draft has been written.
- The draft should be written **immediately** on any builder mutation, not
  only on the 30 s tick.
- Exiting the builder (closing the modal) should **clear** the draft; only
  staying in the builder session should preserve it.
- The conflict-resolution prompt logic and `LayoutBuilderModal` effect
  timing also need review.

This is tracked for a focused replanning conversation before any further
builder draft work proceeds.

**Query-params vs localStorage (Q7).** localStorage is the primary mechanism
for all new view-persistence. The only query-param usage is the pre-existing
`?builder=<id>` pattern from `useBuilderDeepLink.ts`, which is left as-is.
No new query-params are introduced; multi-root pages rely entirely on the
`wpsg_view_<rootId>_<feature>` key convention.

### PR comment responses (2026-05-30)

Three post-implementation review comments on P36-A code. All accepted and
fixed in the same commit.

**[High] Cross-page key collision in `getRootId` — Accepted.**
The reviewer correctly identified that two unrelated WordPress pages each
rendering a single shortcode with no DOM id both produce `wpsg-0`, causing
`active_view`, `scroll`, `accordion`, and `settings-tab` state to bleed
between pages that share an origin. The `#root` path had the same flaw.

Fix: `getRootId` now includes `window.location.pathname` in the positional
fallback — `/my-gallery-page/` becomes `wpsg-my-gallery-page-0`. Id-bearing
hosts are unaffected (fast path: `if (host.id) return host.id`). This makes
positional keys page-stable without requiring any server-side token.

_Files: `src/main.tsx` (getRootId)._

**[Medium] Admin-tab migration value never persisted — Accepted.**
The reviewer traced a real one-session data loss: the migration effect at
`AdminPanel.tsx:81` removed the legacy `wpsg_admin_active_tab` key
immediately but never wrote the migrated value to the new
`wpsg_view_<rootId>_admin_tab` key. Since `useReloadSafeView` only persists
on setter calls, a user who never changed tabs in the first post-upgrade
session would find their tab preference reset to `campaigns` on the next
load.

Fix: the migration effect now calls `setActiveTab(legacyValue)` before
`localStorage.removeItem(...)`. The hook's `setValue` writes the value to
the new scoped key as a side-effect, completing the move atomically from the
user's perspective. The IIFE that reads `legacyTabDefault` for the initial
render default is preserved — it ensures no flash between the lazy
initializer and the effect.

_Files: `src/components/Admin/AdminPanel.tsx` (migration useEffect)._

**[Medium] `useScrollRestore` callback ref not memoized — Accepted.**
The reviewer flagged that `callbackRef` was a new function identity on every
render. The existing guard (`if (elementRef.current === el) return`) does
not protect against this: React calls the *old* ref function with `null`
first (which sets `elementRef.current = null`), then calls the *new* ref
function with the element — so by the time the guard runs, the element refs
have already diverged and the full attach path (scroll-restore + listener
add) executes again. On form-heavy surfaces like the settings panel this
causes visible scroll jumpiness on every keystroke.

Fix: `handleScroll` is now a stable `useCallback(fn, [])` (all its reads go
through refs, so zero deps is correct). `callbackRef` is wrapped in
`useCallback(fn, [handleScroll])`, making it stable across renders and
breaking the detach/reattach cycle. The cleanup effect's dependency on
`handleScroll` is now explicit and correct. The eslint-disable comment on
the cleanup effect is removed as it is no longer needed.

_Files: `src/hooks/useScrollRestore.ts`._

---

## Track P36-B — Admin CampaignsTab Inline Edits + X3 Convergence Note

### Problem

The admin desktop CampaignsTab currently requires opening the full
UnifiedCampaignModal for every edit, even for trivial changes to status,
visibility, or company. This is friction for any operator who needs to
re-bucket campaigns across a normal workday. Separately, Phase 35 deferred
P36-X3 ("Admin Panel listing convergence — recommendation") as a
recommendation track; since AD1's implementation touches the same table,
folding the X3 deliverable in here is the natural fit. The current modal
company field is also a freeform text input, so inline company editing should
not create a second, incompatible company-entry flow.

### Goal

1. Inline-edit status, visibility, and company directly in the admin
   CampaignsTab table without entering the per-campaign edit modal.
2. Reuse the same company-entry experience in both CampaignsTab and
  UnifiedCampaignModal so existing-company selection and new-company creation
  follow one contract.
3. Produce the X3 convergence recommendation (mobile list + desktop
   Table/Cards toggle) as a documented deliverable appended to this report.

### Implementation outline

1. **Status** and **Visibility** cells in `useCampaignsRows.tsx` become
   compact-variant Mantine `Select` controls (3-option and 2-option
   respectively). Values per `wpsg_campaign` post-meta: status =
   `draft | active | archived`; visibility = `public | private`.
2. **Company** editing is implemented through a shared company-entry control
  reused in both `useCampaignsRows.tsx` and `UnifiedCampaignModal.tsx`.
  The control should sit on top of a thin generic searchable/freeform
  combobox core under `src/components/Common/`, but P36-B only commits to
  this one concrete reuse.
3. **Companies source**: keep the existing
  `GET /wp-json/wp-super-gallery/v1/companies` endpoint as the canonical
  backend source. Frontend work should add a pagination-aware helper that can
  load the exhaustive company selector dataset; do not rely on the current
  first-page-only `useCompanies()` behavior for CampaignsTab inline editing.
4. **Company create/update contract**: extract or centralize the campaign
  save/update path currently centered in `useUnifiedCampaignModal.ts`, then
  extend the existing campaign create/update contract so company edits can
  submit either an existing company selection or explicit new-company
  `{ name, slug }` data. Campaign read responses should likewise expose
  stable company display data (`companyName` alongside `companyId`) so the UI
  does not depend on transient selector state after save/refetch.
5. **Optimistic updates**: write to the TanStack Query cache immediately,
  fire the shared mutation path, and revert + toast on failure.

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
- `src/hooks/useCampaignsRows.tsx` — row rendering / inline cell editors.
- `src/components/Campaign/UnifiedCampaignModal.tsx` — share the company-entry
  control with the inline editor; status/visibility controls remain canonical
  UI references.
- `src/hooks/useUnifiedCampaignModal.ts` — extract/share the campaign save
  contract for modal + inline edits.
- `src/services/adminQuery.ts` — exhaustive companies selector fetch/helper.
- `src/components/Common/` — new thin generic searchable/freeform combobox core
  plus the shared company-entry wrapper.
- `src/components/Admin/CampaignsMobileList.tsx` — referenced by the X3
  convergence evaluation only.
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` — existing
  companies-list endpoint plus the campaign save/read contract extension for
  explicit new-company name/slug data.

### Acceptance criteria

- Inline edits work for status, visibility, and company; updates persist
  server-side and survive reload.
- The company-entry control is shared between CampaignsTab inline editing and
  UnifiedCampaignModal.
- Existing-company selection and explicit new-company `{ name, slug }`
  creation both persist server-side and survive reload.
- The companies selector covers the full paginated company set, not only the
  first page.
- Post-save/refetch display remains stable without relying on transient
  selector state.
- Optimistic update + error-revert verified by manual test.
- X3 convergence note appended to the Implementation Notes section.
- Any new PHP code / contract extension is covered by focused PHPUnit tests.

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

### Status: Evaluated

**Outcome:** GO — whole-card-per-slot model promoted to Phase 37 as track P37-LB.
Slot-to-card-section composition evaluated and deferred as R&D-only (not scheduled).
Full evaluation in `docs/PHASE36_X1_X2_EVALUATION.md`. Implementation plan in
`docs/PHASE37_REPORT.md`.

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

### Status: Evaluated

**Outcome:** Rejected — hexagonal, diamond, and circular adapters are not viable
for production campaign listings. Thumbnail-only experimental fallback evaluated
and not recommended. Formally closed; not a Phase 37+ roadmap item unless product
leadership initiates a scoped prototype. Full evaluation in
`docs/PHASE36_X1_X2_EVALUATION.md`.

---

## Implementation Notes

_Updated as tracks land._

### Open follow-ups

Both pre-implementation follow-ups are resolved. Full findings in
`docs/PHASE36_FOLLOWUP_FINDINGS.md`.

- **Multi-root localStorage scoping (P36-A)** — ✓ Resolved. The current runtime
  collision surface is multi-shortcode pages, with all mounts sharing
  origin-localStorage. Key convention locked:
  `wpsg_view_<rootId>_<feature>`. Implementation requires a universal root-id
  helper in `src/main.tsx`, a `RootIdContext` wrapping every `renderApp()`
  path, and migration of `wpsg_admin_active_tab` into the same reload-safe
  mechanism. Broader legacy admin/media key scoping is deferred to P37.

- **Companies-list source (P36-B)** — ✓ Resolved. No new REST endpoint is
  needed: `GET /wp-json/wp-super-gallery/v1/companies` remains the canonical
  source. Frontend implementation still needs a pagination-aware exhaustive
  selector fetch, a shared company-entry control reused by CampaignsTab and
  UnifiedCampaignModal, and an extended campaign save/read contract that
  supports either existing company selection or explicit new-company
  `{ name, slug }` creation.

### P36-X3 — Admin Panel listing convergence (recommendation)

**Question 1: Should `CampaignsMobileList.tsx` switch to the listing-adapter pipeline?**

Recommendation: **No.** The listing-adapter pipeline (`CardGallery` + P35-A
`GalleryAdapter` contract) is a frontend display pipeline. It accepts `items`,
`renderItem`, and `listingMode`; the host owns card rendering and the adapter
owns layout. `CampaignsMobileList` is an admin CRUD surface: it renders action
buttons (edit, duplicate, export, archive, delete), inline grant-summary badges,
select-mode checkboxes, and schedule/expiry indicators. Threading those admin
concerns through `renderItem` would misuse the abstraction — the listing adapter
is designed for stateless card display, not for operator management workflows.

Keep `CampaignsMobileList.tsx` as a standalone admin component. It shares
rendering logic with `useCampaignsRows.tsx` (schedule badges, grant summary
badges) which could eventually be extracted into small shared utilities, but
that's a cosmetic refactor, not a pipeline migration.

**Estimated effort if this recommendation is ignored:** ~3–5 days to wire admin
action state through `renderItem`, handle pagination differences, and audit
accessibility/select-mode regressions. Net outcome would be a coupling increase
with no user-visible benefit.

**Question 2: Should the desktop CampaignsTab gain a Table / Cards view toggle?**

Recommendation: **Defer.** P36-B's inline status, visibility, and company edits
directly in the table rows address the primary friction (opening the full modal
for trivial changes). A Cards toggle would be cosmetic — it makes visual scanning
easier for campaigns with distinct cover images, but that's a low-urgency UX
polish item with no stated user request behind it.

If a Cards toggle is added later, the correct implementation is to reuse the
`CampaignsMobileList` rendering path (not the listing-adapter pipeline, for the
same reasons above), guarded behind a breakpoint-independent toggle button in the
CampaignsTab header. Effort estimate: ~1–2 days including tests and
localStorage persistence for the toggle state. Candidate for P38+ if user
feedback surfaces it.

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
  - **SE1** — Shared searchable entity input adoption. Promote P36-B's shared
    company-entry combobox into a broader reusable entity-input primitive,
    starting with `AccessTab` user search and future tag/category/company
    selectors.
  - **KS1** — Legacy storage-key scoping audit. Audit and migrate pre-existing
    admin/media localStorage keys that remain globally scoped after P36-A;
    auth/theme globals remain intentionally shared.
- Carry-forward bookkeeping: P36-X1 / P36-X2 originated from P35-I
  carry-forward; P36-X3 originated likewise and is folded into P36-B in
  this phase.
