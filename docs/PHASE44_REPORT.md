# Phase 44 — Codebase Audit: Code Quality, Security & UX Review

**Status:** In progress
**Created:** 2026-06-04
**Last updated:** 2026-06-05

### Tracks

| Track   | Area                        | Status      | Effort |
|---------|-----------------------------|-------------|--------|
| P44-A1  | Layout Builder              | Not started | L      |
| P44-A2  | Gallery Adapters            | Not started | L      |
| P44-A3  | Admin Panel + Media Tab     | Complete    | M      |
| P44-A4  | Settings System             | Not started | M      |
| P44-A5  | Auth + API Layer            | Complete    | M      |
| P44-A6  | Hooks + State               | Complete    | M      |
| P44-A7  | PHP Backend                 | Not started | L      |
| P44-A8  | Types + Utils               | Complete    | S      |

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

## Track P44-A8 Rationale

**Code quality:** No dead exports. The two `any`/`unknown` uses in `types/index.ts` are
intentional (adapter settings are open-ended by design). The `.catchall(z.unknown())` in
`settingsSchemas.ts` is similarly deliberate — added a comment explaining forward-compat
intent on both occurrences.

**Test coverage:** 9 utils lacked test files. Three were risk-bearing:
- `mergeSettingsWithDefaults.ts` — already covered by `defaultsAndMerge.test.ts`
  (filename mismatch caused false negative in scan).
- `galleryAnimations.ts` — DOM-manipulating transition utility; new tests added in
  `galleryAnimations.test.ts` covering all transition types, null-element handling,
  reflow-force verification, and direction variants.
- `loadGoogleFont.ts` — side-effecting font injector; new tests added in
  `loadGoogleFont.test.ts` covering inject, idempotency, error-event failure tracking,
  unknown fonts, spaces-in-family-name, and `loadGoogleFontsFromOverrides`.

**UX:** No direct UX surface. Zod error messages use Zod defaults — acceptable for
machine API; no user-visible validation strings reach the UI directly.

**Inline fixes:** Added `catchall` intent comments to `settingsSchemas.ts`;
created `galleryAnimations.test.ts` and `loadGoogleFont.test.ts`.

---

## Track P44-A5 Rationale

**JWT token storage:** Nonce path (default) stores tokens in memory only via WordPress
globals — secure. JWT opt-in path stores tokens in `localStorage` — known, intentionally
deferred as P20-K future work, documented in `FUTURE_TASKS.md`.

**Dead-code removal:** `expiryWarningThresholdMs` was defined in `GalleryBehaviorSettings`
with a default of 300,000 ms, a tooltip, and a UI NumberInput in
`AdvancedSettingsSection.tsx`, but no code anywhere read or acted on it. The tooltip
stated it would show a JWT token-expiry warning — a feature that was never implemented.
Removed from all four locations: interface, defaults object, tooltip map, and the
`AdvancedSettingsSection` control.

**Auth error handling:** 401 → "Session expired. Please sign in again." surfaced with
ARIA live region. 403 → automatic nonce refresh + retry, user-transparent. All error
messages are human-readable; no raw exception traces shown to users.

**Nonce heartbeat:** 20-minute interval, dual-layer refresh (proactive heartbeat +
reactive 403 retry in HttpTransportImpl). Silent failure is appropriate.

**Idle timeout UX:** `useIdleTimeout` fires logout with no advance warning or countdown.
The setting `sessionIdleTimeoutMinutes` is wired and functional — the gap is purely UX
(no "stay logged in" modal or countdown banner). Deferred to Phase 45.

**SSRF:** Correctly delegated to PHP backend. Frontend does not need client-side SSRF
validation — it trusts the backend proxy.

**Component library:** `LoginForm`, `AuthBar`, `AuthBarFloating`, `AuthBarMinimal` are
strong reuse candidates. `AuthBarFloatingMenuContent` is tightly coupled to
`CampaignContext` and would need decoupling first.

**Inline fixes:** Removed dead `expiryWarningThresholdMs` setting from all sites.

---

## Track P44-A6 Rationale

**Corrected scope:** The phase document stated "59 files, 0 tests currently" — this was
outdated. Actual count as audited: **38 hook files, 21 with test coverage, 17 untested.**

**Untested hooks risk triage:**

| Hook | Risk | Finding |
|------|------|---------|
| `useXhrUpload` | High | Complex XHR progress math, batch-upload per-file progress interpolation, abort-on-unmount. No test coverage. |
| `useExternalMediaModal` | High | File-type filtering, `https:`-only URL guard, oEmbed preview, batch-upload + batch-add flow, partial-failure state. No test coverage. |
| `useInContextSave` | Medium-High | Optimistic cache update → debounced server save → rollback path. Silent failure (console.error only). No test coverage. |
| `useCarousel` | Low-Medium | Index clamping, wrap-around modulo nav, length-change effect. Logic is correct; low surface area. |
| `useAuditRows` | Low | 12-LOC memoized sort + map. Trivial. |
| `useCampaignsRows` | Low-Medium | Renders ~7 action controls per row using mutations. The mutations carry inline `onError` callbacks — consistent. No issues. |
| `useTypographyStyle` | Low | Pure CSS derivation from settings. Clean `useMemo`. |
| `useScrollRestore` | Low | localStorage persist/restore with storageKeyRef pattern to avoid stale closure. Clean. |
| `useArchiveModal` | Low | Simple state gate + API call. **Inline fix applied**: general-error catch was using a hardcoded string instead of `getErrorMessage(err, ...)`, losing the server message. |

**React Query patterns:** Mutations in this codebase use manual try/catch rather than
React Query `onError` option for most operations — consistent across all examined hooks.
The `usePatchCampaign` mutation in `useCampaignsRows` is the one place where `onError` is
used inline (via the per-call options), which is correct. No silent error swallowing found
in the top-risk hooks.

**Stale closures:** No problematic dep arrays found. `useScrollRestore`, `useInContextSave`,
and `useCarousel` all use refs correctly to avoid stale closure issues.

**Context over-subscription:** `SettingsStore` is Zustand-based (not React Context), so
subscriptions are already selector-based. `AuthContext` and `RootIdContext` are consumed
at the right level. No obvious over-subscription.

**UX:** `useInContextSave` failure path silently reverts with only a console.error. The
user has no indication that their in-context change was not persisted. Flagged as Phase 45.

**Inline fixes:** Added `getErrorMessage` import and usage to `useArchiveModal.ts`.

---

## Track P44-A3 Rationale

**Code quality:** `MediaTab.tsx` (1401 LOC) is a severe single-responsibility violation —
it owns upload handling, media ordering (dnd-kit), media metadata editing, bulk selection
and actions, search/filter, rescan, usage summary, and three separate inline modals. No
single extraction is safe to make inline (each concern is entangled with shared state);
split deferred to Phase 45.

**Error handling:** Seven `catch` blocks in `MediaTab.tsx` used `(err as Error).message`
directly — if the caught value is not an `Error` instance (e.g. a string, a rejected
promise with an object payload, or an `ApiError` subclass), this silently produces
`undefined` as the notification message. Fixed in place by replacing all seven occurrences
with `getErrorMessage(err, '<contextual fallback>')`. The utility (`src/utils/getErrorMessage.ts`)
was already imported in the file.

**Accessibility:** Two `Tabs.Panel` components in `AdminPanel.tsx` carried
`aria-labelledby="audit-heading"` and `aria-labelledby="global-audit-heading"` but no
corresponding `id` attributes exist on any element in the file — the ARIA references were
broken, pointing to nothing. Removed both broken attributes. The panels are visually
identified by their tab label; the correct fix (adding matching `id` elements inside each
panel's heading) is a larger UX change and is deferred. Also: `DragOverlay` image in
`MediaTab.tsx` had `alt=""`, which is appropriate for a drag ghost only if the image is
purely decorative. In this context it is a representation of the dragged item — changed
to `alt={activeMediaItem.caption || 'media item'}`.

**Drag-over visual feedback:** The `MediaAddModal` file drop zone (`<Paper ref={dropRef}>`)
has no visual feedback when files are dragged over it. The `dragover` event handler sets
`dropEffect = 'copy'` but does not signal any UI change. Adding visual feedback requires
lifting drag state to the parent and passing a prop to `MediaAddModal`. Deferred to
Phase 45 as a UX enhancement.

**Destructive action safety:** Single-item delete uses a confirmation modal with an
explicit "Delete" button — correct. Bulk-delete has no confirmation; items are permanently
removed immediately. Bulk archive and bulk restore also lack confirmation dialogs. The
inconsistency creates a usability hazard for users who mis-click. Deferred to Phase 45.

**Inline fixes:** Fixed 7 `(err as Error).message` usages → `getErrorMessage`; fixed 2
broken `aria-labelledby` references; fixed `alt=""` on DragOverlay image.

---

## Phase 45 Candidates

Issues and refactoring opportunities discovered during the audit that are too large to fix
inline. Appended here as each track completes.

| ID | Area | Issue / Opportunity | Effort estimate | Discovered in |
|----|------|---------------------|-----------------|---------------|
| P45-01 | Utils | Extract `sanitizeCss.ts` to shared library package | S | P44-A8 |
| P45-02 | Utils | Extract `cssUnits.ts` + `toCss*` helpers to shared library package | S | P44-A8 |
| P45-03 | Auth | Idle timeout countdown warning: enhance `useIdleTimeout` with `onWarning(secondsRemaining)` callback; show dismissible "stay logged in" banner | M | P44-A5 |
| P45-04 | Auth | JWT in-memory + httpOnly cookie upgrade (P20-K): replace `localStorage` token storage in `WpJwtProvider.ts` | L | P44-A5 |
| P45-05 | Auth | Extract `LoginForm` + `AuthBar*` as generic auth-UI library components (decouple `AuthBarFloatingMenuContent` from `CampaignContext` first) | M | P44-A5 |
| P45-06 | Hooks | Add test coverage for `useXhrUpload` (batch progress math, abort-on-unmount, status-code error mapping) | M | P44-A6 |
| P45-07 | Hooks | Add test coverage for `useExternalMediaModal` (file-type filter, URL validation, partial-failure state) | M | P44-A6 |
| P45-08 | Hooks | Add test coverage for `useInContextSave` (optimistic update, debounce, server rollback) | S | P44-A6 |
| P45-09 | Hooks | `useInContextSave` failure UX: surface a user-visible error notification when the debounced save fails (currently silent console.error + revert) | S | P44-A6 |
| P45-10 | Admin | Split `MediaTab.tsx` (1401 LOC, 10+ concerns) into focused sub-components/hooks: upload, ordering, metadata editing, bulk actions, filter/search | L | P44-A3 |
| P45-11 | Admin | Bulk delete/archive/restore confirmation dialogs in `MediaTab.tsx` — current bulk actions fire immediately with no scope confirmation | S | P44-A3 |
| P45-12 | Admin | `MediaAddModal` file drop zone: add drag-over visual feedback (border highlight / background shift) when files are being dragged over the drop area | S | P44-A3 |
