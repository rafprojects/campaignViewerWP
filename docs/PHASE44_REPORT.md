# Phase 44 — Codebase Audit: Code Quality, Security & UX Review

**Status:** Not started
**Created:** 2026-06-04
**Last updated:** 2026-06-04

### Tracks

| Track   | Area                        | Status      | Effort |
|---------|-----------------------------|-------------|--------|
| P44-A1  | Layout Builder              | Not started | L      |
| P44-A2  | Gallery Adapters            | Not started | L      |
| P44-A3  | Admin Panel + Media Tab     | Not started | M      |
| P44-A4  | Settings System             | Not started | M      |
| P44-A5  | Auth + API Layer            | Not started | M      |
| P44-A6  | Hooks + State               | Not started | M      |
| P44-A7  | PHP Backend                 | Not started | L      |
| P44-A8  | Types + Utils               | Not started | S      |

---

## Rationale

The codebase has grown across 40+ phases without a cross-cutting audit. This phase applies
structured review to every major area: code quality, security vulnerabilities, and — as the
primary lens — UX against widely regarded standards. Small fixes are made inline within each
track's PR. Major issues and significant refactoring opportunities are captured as Phase 45
candidate tracks rather than acted on immediately.

A secondary goal is to flag any components that could be extracted into a reusable library
primitive (for future cross-project use). These are noted, not implemented.

### Recommended execution order

`A8 → A5 → A6 → A3 → A2 → A1 → A4 (after Phase 43) → A7 (after Phase 42)`

A8 and A5 are the smallest, safest starting points. A1 (Layout Builder) and A7 (PHP Backend)
are the heaviest and benefit from familiarity gained across earlier tracks. A4 should run
after Phase 43 completes (SettingsPanel split); A7 should run after Phase 42 completes
(REST decomposition — reviewing per-controller files is easier than the 7800-line monolith).

---

## Audit Methodology

Each track is a focused PR review of one codebase area. Within a track:

1. **Code quality** — complexity, naming, dead code, pattern inconsistency, test gaps
2. **Security** — XSS, SQL injection, SSRF, auth bypass, input validation, file-type checks
3. **UX audit** — see criteria table below; this is the primary lens
4. **Component library flags** — note (don't implement) any component that could become
   a reusable library primitive with minimal changes
5. **Inline fixes** — small issues (wrong error message, missing ARIA label, off-by-one,
   unused import) get fixed within the track's PR
6. **Phase 45 candidates** — major issues or valuable refactors are appended to the
   "Phase 45 Candidates" section at the bottom of this document

### UX Evaluation Criteria

Applied uniformly to every track. For each criterion, note: ✅ good, ⚠️ improvable, ❌ missing.

| Criterion | What to check |
|-----------|---------------|
| **Feedback & status** | Loading spinners, skeleton screens, success toasts — present and accurate? |
| **Error UX** | Errors surfaced with human-readable messages; user can recover without a reload |
| **Accessibility** | Keyboard nav, focus order, ARIA roles/labels, color contrast (WCAG 2.1 AA target) |
| **Empty states** | Zero-data views give the user a clear, actionable next step |
| **Destructive action safety** | Confirmation dialogs; undo affordances where practical |
| **Progressive disclosure** | Advanced/rare options don't clutter primary flows |
| **Responsive behavior** | Key flows usable at tablet widths (≥768px) |
| **Consistency** | Same interaction pattern for similar operations throughout the app |
| **Micro-interactions** | Transitions/animations reinforce spatial model; nothing jarring or missing |
| **Innovation opportunities** | Places where UX could be genuinely improved beyond convention |

---

## Track P44-A8 — Types + Utils

### Scope

`src/types/index.ts` (59K), `src/types/settingsSchemas.ts` (12K), `src/utils/` (62 files),
`src/data/`

### Focus areas

- **Type correctness**: wide `any` / `unknown` uses that mask real types; loose union members
  that allow invalid states to be representable
- **Dead exports**: types and util functions defined but never imported; identify with
  `ts-prune` or grep
- **Zod schema coverage**: does `settingsSchemas.ts` cover all settings paths used at runtime,
  or are there unchecked code paths that accept raw API shapes?
- **Utility test gaps**: 77% coverage is good, but identify the untested 23% and determine
  whether the gap is risk-bearing
- **UX**: no direct UX surface, but schema validation errors surfaced by Zod feed user-visible
  messages — audit that error message strings are human-readable

---

## Track P44-A5 — Auth + API Layer

### Scope

`src/components/Auth/` (4 files), `src/services/` (9 files), `src/hooks/useAuth*`,
`src/hooks/useNonce*`, `src/hooks/useIdleTimeout.ts`, `src/contexts/AuthContext.tsx`

### Focus areas

- **JWT token handling**: are tokens stored only in memory (not localStorage)? Confirm
  P20-K nonce-default is intact; JWT path is env-gated
- **Token refresh / expiry UX**: when a session expires, does the user get a clear message
  and a path back to logged-in state, or does the app silently break?
- **401 / 403 handling**: API errors from auth failures — are they caught and surfaced, or
  do they fall through as generic errors?
- **Idle timeout UX**: does `useIdleTimeout` give the user a warning before logging them out?
  Is the countdown visible?
- **Nonce heartbeat**: `useNonceHeartbeat` — is the refresh interval appropriate, does failure
  degrade gracefully?
- **SSRF in oEmbed proxy**: the oEmbed proxy routes — verify SSRF guard is present (PHP side;
  cross-reference with A7)
- **Component library flag**: `Auth/` components (login form, session expiry modal) are
  candidates for a generic auth-UI primitive

---

## Track P44-A6 — Hooks + State

### Scope

`src/hooks/` (59 files, **0 tests currently**), `src/contexts/` (10 files),
React Query usage across components

### Focus areas

- **Correctness without tests**: 59 hooks with zero test coverage is the single largest risk
  surface. For each hook, determine: is it trivial (safe to skip), or does it carry business
  logic that warrants at least a smoke test? Flag the top 5–10 highest-risk hooks as Phase 45
  test-addition candidates
- **Stale closure / dependency array bugs**: `useCallback`/`useMemo` with missing or incorrect
  deps; effects that close over stale values
- **Infinite re-render risks**: hooks that call `setState` unconditionally in render; ref
  callbacks that call `setState`
- **React Query patterns**: are `onError` callbacks used consistently, or do some mutations
  swallow errors silently? Is cache invalidation targeted (specific query keys) or
  over-broad (`invalidateQueries()` without keys)?
- **Context over-subscription**: are components subscribed to full contexts when they only
  need one field? Flag candidates for context splitting or selector patterns
- **UX**: hooks that own user-visible state (loading, error) — verify they expose the
  right shape for UI components to render meaningful feedback

---

## Track P44-A3 — Admin Panel + Media Tab

### Scope

`src/components/Admin/AdminPanel.tsx` (703 LOC), `src/components/Admin/MediaTab.tsx` (1401 LOC),
`src/components/Campaign/` (4 files), `src/components/CampaignGallery/` (5 files)

### Focus areas

- **MediaTab complexity**: at 1401 LOC, this is likely a single-responsibility violation.
  Map the distinct concerns (upload, ordering, media metadata editing, bulk actions, search/filter)
  and evaluate whether any should be extracted
- **Upload UX**: drag-and-drop feedback; progress indicators for large files; error states
  when a file is rejected (wrong type, too large) — are errors human-readable?
- **Bulk action safety**: bulk delete / bulk archive — are confirmation dialogs present?
  Is the scope of impact (N items will be deleted) clear before the user confirms?
- **Campaign lifecycle UX**: create, archive, restore, delete flows — are transitions smooth
  and status communicated? Empty states for a new install with no campaigns?
- **Accessibility**: media grid — are images accessible (alt text, keyboard navigation to
  select items)? Are action menus keyboard-reachable?
- **Component library flag**: upload drop zone, progress bar, media grid item — candidates
  for extraction

---

## Track P44-A2 — Gallery Adapters

### Scope

`src/components/Galleries/Adapters/` (all 11 adapters), `src/components/Galleries/Shared/`
(Lightbox, ImageCarousel, OverlayArrows)

### Focus areas

- **Cross-adapter UX consistency**: do all adapters handle the same edge cases (single-item
  gallery, very long/portrait images, mixed landscape+portrait) in a visually consistent way?
- **Lightbox UX**: keyboard navigation (arrow keys, Escape to close, Tab to cycle through
  controls); focus trap inside the lightbox; swipe gesture on mobile; caption/metadata display
  when available
- **Lightbox state correctness**: does the lightbox correctly track which media item is shown
  when items are dynamically filtered or reordered?
- **Loading behavior**: skeleton / placeholder shown while images load? Are broken image states
  handled gracefully?
- **Responsive behavior**: each adapter at tablet and mobile widths — layout collapse, touch
  targets ≥44px
- **Animation / micro-interaction consistency**: do enter/exit animations feel cohesive, or
  do adapters diverge noticeably?
- **Security**: any adapter that constructs URLs from media metadata — verify no XSS surface
- **Component library flag**: Lightbox is the strongest standalone library candidate;
  ImageCarousel and OverlayArrows are secondary candidates

---

## Track P44-A1 — Layout Builder

### Scope

`src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` (1152 LOC),
`src/components/Admin/LayoutBuilder/LayoutCanvas.tsx`,
`src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` (945 LOC),
`src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx` (871 LOC),
`src/utils/smartGuides.ts`, `src/utils/groupGeometry.ts`, `src/utils/layerList.ts`

### Focus areas

- **Canvas interaction UX**: snap guide accuracy and visibility; alignment handles (do they
  appear at the right moment and disappear cleanly?); undo/redo availability and scope
- **Drag-and-drop feedback**: cursor changes, ghost elements, drop target highlighting —
  are these consistent and responsive?
- **Slot property panel UX**: is it clear which slot is selected? Do property changes have
  immediate visual feedback? Are advanced options progressively disclosed?
- **Error states**: what happens when a layout has zero slots? When a media item referenced
  by a slot is deleted from the library?
- **Performance**: `groupGeometry.ts` and `smartGuides.ts` run on every drag event — any
  expensive computations that could be memoized or debounced?
- **Accessibility**: canvas is inherently pointer-heavy; is there any keyboard path for
  users who cannot use a mouse/touchpad?
- **Code quality**: LayoutBuilderModal and LayoutSlotComponent at 1152/945 LOC are refactor
  candidates; map responsibilities and flag Phase 45 split if warranted
- **Component library flag**: LayoutCanvas's coordinate/transform model could generalize to
  any drag-and-drop canvas primitive

---

## Track P44-A4 — Settings System

### Scope

`src/components/Admin/SettingsPanel.tsx` (post-Phase 43 tab split),
`src/components/Settings/` (12 files, section components),
`src/components/Common/GalleryConfigEditorModal.tsx` (1386 LOC),
`src/data/settingTooltips.ts`

> **Soft dependency:** Run after Phase 43 completes (P43-SP1/SP2 tab split). Reviewing the
> tab-component architecture is easier after the refactor.

### Focus areas

- **GalleryConfigEditorModal complexity**: at 1386 LOC, likely doing too much. Map its
  responsibilities; flag Phase 45 split if warranted
- **Settings UX**: are settings organized logically? Do users know which settings affect
  what? Are tooltips (`settingTooltips.ts`) present for non-obvious settings?
- **Validation feedback**: when a setting value is invalid, is the error shown inline next
  to the field, or only on save? Does the form prevent invalid submission?
- **Unsaved-changes UX**: is there a clear indicator when there are unsaved changes? Is the
  user warned before navigating away?
- **Responsive config editor**: the responsive breakpoint configuration flow — is it
  discoverable? Is the breakpoint concept explained for non-developer users?
- **Progressive disclosure**: are rarely-used or advanced settings hidden behind accordions
  or secondary screens, or do they crowd the primary settings view?
- **Accessibility**: form labels, error associations (`aria-describedby`), keyboard nav
  through tab sections

---

## Track P44-A7 — PHP Backend

### Scope

`wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` (or post-Phase 42 per-controller
files), `class-wpsg-settings-sanitizer.php` (1377 LOC), `class-wpsg-db.php` (855 LOC),
`includes/providers/` (6 files), `class-wpsg-monitoring.php`

> **Soft dependency:** Run after Phase 42 completes (P42-DC0 through P42-DC9). Per-controller
> files are far easier to audit individually than the 7800-line monolith.

### Focus areas

- **Input sanitization**: every REST endpoint — verify `sanitize_*` is called on all
  user-supplied data; check for missing capability checks (any endpoint callable by
  unauthenticated or low-privilege users?)
- **SQL injection**: `class-wpsg-db.php` — all dynamic queries use `$wpdb->prepare()`?
  Any raw query construction with user input?
- **SSRF**: oEmbed proxy routes — confirm URL allow-list or blocklist is present and
  covers private IP ranges (127.x, 10.x, 192.168.x, 169.254.x, ::1)
- **File upload security**: media upload endpoints — MIME-type validation (not just
  extension), file size ceiling, path traversal prevention
- **Rate limiting**: is rate limiting applied to all mutation endpoints, or only some?
- **Settings sanitizer coverage**: `class-wpsg-settings-sanitizer.php` — does it cover
  all settings fields? Are CSS values sanitized to prevent stored XSS via custom CSS fields?
- **Monitoring / error logging**: `class-wpsg-monitoring.php` — are errors logged at
  appropriate severity? Any PII (IP addresses, user emails) logged without scrubbing?
- **Error response UX**: WP REST errors returned to the frontend — are `message` strings
  human-readable and actionable, or raw PHP exception strings?

---

## Phase 45 Candidates

Issues and refactoring opportunities discovered during the audit that are too large to fix
inline. Appended here as each track completes.

| ID | Area | Issue / Opportunity | Effort estimate | Discovered in |
|----|------|---------------------|-----------------|---------------|
| — | — | *(populated during audit execution)* | — | — |
