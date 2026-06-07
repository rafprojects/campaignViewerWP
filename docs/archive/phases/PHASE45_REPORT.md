# Phase 45 — Post-Audit Follow-Through: Tests, Auth UX & Library Extraction

**Status:** Complete (P45-A6 deferred — see `docs/FUTURE_TASKS.md` § "JWT In-Memory Token Auth")
**Created:** 2026-06-05
**Last updated:** 2026-06-06

### Tracks

| Track   | Description                                              | Status   | Effort |
|---------|----------------------------------------------------------|----------|--------|
| P45-A1  | Test coverage for `useXhrUpload`                         | Done     | M      |
| P45-A2  | Test coverage for `useExternalMediaModal`                | Done     | M      |
| P45-A3  | Test coverage for `useInContextSave`                     | Done     | S      |
| P45-A4  | `useInContextSave` failure UX — surface save errors      | Done     | S      |
| P45-A5  | Idle timeout countdown warning (`useIdleTimeout`)        | Done     | M      |
| P45-A6  | JWT in-memory + httpOnly cookie upgrade (P20-K)          | Deferred | L      |
| P45-A7  | Extract `LoginForm` + `AuthBar*` as library components   | Done     | M      |
| P45-A8  | Extract `sanitizeCss.ts` + `cssUnits.ts` to shared lib  | Done     | S      |
| P45-A9  | Split `MediaTab.tsx` into focused sub-components/hooks  | Done     | L      |
| P45-A10 | Bulk delete/archive/restore confirmation dialogs        | Done     | S      |
| P45-A11 | `MediaAddModal` drop zone drag-over visual feedback     | Done     | S      |
| P45-A12 | Full ARIA focus trap in `Lightbox`                      | Done     | M      |
| P45-A13 | Extract `Lightbox` as shared library component          | Done     | M      |
| P45-A14 | Split `LayoutBuilderModal.tsx` into focused hooks       | Done     | L      |
| P45-A15 | Split `LayoutSlotComponent.tsx` into sub-components     | Done     | M      |
| P45-A16 | `smartGuides.ts` per-slot memoization for drag perf     | Done     | M      |
| P45-A17 | Keyboard shortcut for adding a new canvas slot          | Done     | S      |
| P45-A18 | Split `GalleryConfigEditorModal.tsx` into sub-components | Done     | L      |

---

## Rationale

Phase 44 audited the full codebase and produced a prioritised list of issues too large to
fix inline. This phase acts on the highest-value items:

1. **Test coverage gaps** (P45-A1–A3) — three hooks carry meaningful business logic with
   zero test coverage; adding tests reduces regression risk on every future change.
2. **Silent failure UX** (P45-A4) — `useInContextSave` failure path is invisible to the
   user; fixing it makes data-loss events surfaced rather than silently swallowed.
3. **Auth UX hardening** (P45-A5) — abrupt idle-logout is a usability gap; countdown +
   "stay logged in" removes user surprise.
4. **JWT security upgrade** (P45-A6) — pre-existing P20-K deferred task; moving JWT tokens
   out of localStorage closes the XSS-to-token-theft vector.
5. **Library extraction** (P45-A7–A8) — highest-generalizability components and utilities
   identified in P44-A5 and P44-A8; extraction enables cross-project reuse.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Ordering of auth tracks | P45-A5 (idle warning) before P45-A6 (JWT upgrade) — A5 is standalone UX; A6 requires backend coordination |
| B | `useInContextSave` error UX (P45-A4) | Emit `onError` callback or show Mantine notification; exact mechanism TBD during implementation |

## Execution Priority

1. P45-A1/A2/A3 — test coverage first (no behaviour changes, pure risk reduction)
2. P45-A4 — small UX fix while the in-context save code is fresh from reading
3. P45-A5 — idle warning can ship independently
4. P45-A8 — small extraction, low risk
5. P45-A7 — component extraction, medium risk; defer until after A8
6. P45-A6 — largest, needs backend coordination; last

---

## Track P45-A1 — Tests: `useXhrUpload`

### Rationale

`new XMLHttpRequest()` required a global stub rather than a module mock because the hook
constructs it inline. Used `vi.stubGlobal('XMLHttpRequest', vi.fn(() => mockXhr))` with a
hand-rolled mock that captures upload/load/error listeners and exposes `_fireUploadProgress`,
`_fireLoad`, and `_fireError` helpers. The cumulative-size interpolation test (the highest-risk
path) confirms the two-file `[100, 200]` byte case yields `[100, 25]` at `loaded=150`.
Coverage exclusion was not needed — the file was never in the exclusion list.

11 tests added in `src/hooks/useXhrUpload.test.ts`.

### Problem

`useXhrUpload` manages complex XHR-based file uploads with:
- per-file and aggregate progress tracking
- batch progress interpolation from cumulative file sizes
- status-code → human-readable error mapping (401, 403, 413, 415, 500)
- abort-on-unmount via `useEffect` cleanup

None of this is tested. The per-file progress calculation (`cumulativeSizes` interpolation
in `uploadMany`) is the highest-risk path — a rounding error would silently show wrong
progress to users.

### Fix

Use `vi.fn()` to mock `XMLHttpRequest`; test `upload` and `uploadMany` with simulated
progress events, success/error responses, and the abort path.

### Acceptance criteria

- Progress events correctly update `progress` (single) and `batchProgress` (batch)
- Status 401/413/415 produce the expected human-readable error messages
- Server message in response body overrides the friendly fallback
- Abort clears state and does not throw
- Unmount aborts an in-flight XHR

---

## Track P45-A2 — Tests: `useExternalMediaModal`

### Rationale

Mocked `useXhrUpload` at the module level (`vi.mock('./useXhrUpload', ...)`) to decouple
the XHR layer and control `uploadMany` return values per-test. Mocked `useGetSettings` at
the module level so no `QueryClientProvider` wrapper was needed (the hook doesn't use
`useQuery` itself — only its internal `useXhrUpload` and `useGetSettings` calls need
mocking). Removed `'src/hooks/useExternalMediaModal.ts'` from the coverage exclusion array
in `vite.config.ts` since it now has coverage.

7 tests added in `src/hooks/useExternalMediaModal.test.ts`.

### Problem

`useExternalMediaModal` manages the full external-media entry flow:
- file-type filtering (image/video only) with per-file error notifications
- `https:`-only URL validation
- oEmbed preview fetch
- batch-upload → batch-add with partial-failure state

No test coverage. The partial-failure state (some files fail, modal stays open with failed
files shown) is the highest-risk path — a regression would silently succeed or silently
lose failed-file state.

### Fix

Wrap with `renderHook`, mock `apiClient` and `useXhrUpload`, drive the state machine
through the key flows.

### Acceptance criteria

- Non-image/non-video files are filtered out with a notification
- `http:` URLs are rejected; `https:` URLs accepted
- oEmbed success updates preview state
- Upload partial failure leaves failed files in state, shows error notification
- `closeExternalMediaModal` resets all state

---

## Track P45-A3 — Tests: `useInContextSave`

### Rationale

Used `vi.useFakeTimers()` + `vi.runAllTimersAsync()` for debounce control. Wrapped each
test in a `QueryClientProvider` with `createTestQueryClient()`. Discovered that with
`gcTime: 0` in the test client, `vi.runAllTimersAsync()` fires the React Query GC timer
(scheduled with `setTimeout(fn, 0)` on `setQueryData` when no observers exist), clearing
the cache before assertions. Fixed the "both fail → keep optimistic" test by using a custom
`QueryClient` with `gcTime: Infinity` for that case alone. All other tests are unaffected
since they check call counts (not cache data) after running timers.

6 tests added in `src/hooks/useInContextSave.test.ts` (3 more added under P45-A4).

### Problem

`useInContextSave` is the optimistic in-context save primitive used by live-preview
editors. It:
- optimistically updates the React Query cache
- debounces the actual server write
- rolls back to server state on failure

No test coverage. The rollback path is the highest-risk case: if the revert refetch also
fails, the hook is documented to "keep optimistic state" — this should be explicitly
verified.

### Fix

Use `renderHook` with a mock QueryClient; spy on `apiClient.updateSettings` and
`apiClient.getSettings`.

### Acceptance criteria

- Calling `save(key, value)` immediately updates query cache
- After debounce delay, `apiClient.updateSettings` is called with batched fields
- `apiClient.updateSettings` failure triggers `apiClient.getSettings` for rollback
- If both fail, the optimistic value is preserved
- Timer is cleared on unmount (no post-unmount state update)

---

## Track P45-A4 — `useInContextSave` Failure UX

### Rationale

Added optional `onError?: (err: unknown) => void` as the 4th parameter to `useInContextSave`.
Called `onError?.(err)` in the catch block after `console.error` and before the revert attempt.
Both call sites (`CardGallery.tsx:80` and `CampaignViewer.tsx:391`) were updated to wire
`onError` to `notifications.show({ color: 'red', message: getErrorMessage(err, ...) })`.
`CampaignViewer.tsx` already imported `getErrorMessage`; both files needed the
`notifications` import from `@mantine/notifications`. The returned `save` function signature
is unchanged so all downstream consumers (like `CampaignViewer.tsx` prop types) are
automatically correct. 3 additional tests cover the `onError` path.

### Problem

When `apiClient.updateSettings` throws, `useInContextSave` logs to `console.error` and
tries to revert silently. The user has no indication their change was not saved. If the
revert also fails, the UI shows a value the server never accepted.

### Fix

Accept an optional `onError?: (err: unknown) => void` callback parameter. Callers can
wire it to `notifications.show(...)` or a similar user-visible feedback mechanism.
Update call sites in live-preview editors.

### Acceptance criteria

- `onError` is called with the caught error when `updateSettings` throws
- No change in behaviour when `onError` is omitted (backwards-compatible)
- At least one call site shows a user-visible notification on failure

---

## Track P45-A5 — Idle Timeout Countdown Warning

### Problem

`useIdleTimeout` fires logout with no advance warning. The user is silently logged out
mid-session with no opportunity to stay logged in. This is particularly bad for long-form
admin edits (settings, campaigns).

### Fix

Add an optional `onWarning?: (secondsRemaining: number) => void` callback parameter to
`useIdleTimeout`. Fire it `warningThresholdMs` (default: 120,000 ms = 2 min) before
the timeout fires. In `App.tsx`, wire it to show a dismissible Mantine notification with
a "Stay logged in" button that resets the idle timer.

### Rationale

Extended `UseIdleTimeoutOptions` with two optional fields: `warningThresholdMs` (default 120,000 ms) and `onWarning?: (secondsRemaining: number) => void`. Added a second internal timer (`warningTimerRef`) that fires `warningThresholdMs` before the main timeout; both timers are cleared and rescheduled together on any activity or programmatic reset. Changed the return type from `void` to `{ reset: () => void }`, exposing the internal `resetTimer` function — backward-safe since no consumer used the prior void return.

In `App.tsx`, used a `idleResetRef` (updated after the hook call) to break the circular dependency between the returned `reset` function and the `onWarning` callback that references it. The notification shows a "Stay signed in" button that calls `idleResetRef.current()` and `notifications.hide(id)`. `warningThresholdMs` is hardcoded at 120,000 ms (2 min) at the call site rather than adding a new settings field — the threshold is a UX constant, not a per-site configuration concern.

5 new tests added; all 13 tests in `useIdleTimeout.test.ts` pass.

### Acceptance criteria

- `onWarning` fires with the correct seconds-remaining when `warningThresholdMs` before timeout
- Clicking "Stay signed in" cancels the pending timeout and dismisses the warning
- No warning shown when `warningThresholdMs` is 0 or omitted
- Existing `useIdleTimeout.test.ts` continues to pass; new tests cover the warning path

---

## Track P45-A8 — `sanitizeCss.ts` + `cssUnits.ts` to `src/lib/`

### Rationale

Moved both files to `src/lib/` (new directory within `src/`, covered by the existing `@/` alias) as a step toward eventual npm package extraction. Full monorepo infrastructure (npm workspaces, separate `packages/`) would be L effort and was deferred — the descoped within-project move satisfies the acceptance criteria and signals "no app-specific deps" without the infrastructure lift. Updated 37 import sites: 35 `from '@/...'` imports plus 2 relative imports (`gridLayout.ts`, `loadCustomFonts.ts`) and 59 inline `import('@/utils/...')` type expressions in `types/index.ts` and `CampaignCard.tsx`. The full extraction path (including `LoginForm`, `AuthBar*`, `Lightbox`) is documented in `docs/FUTURE_TASKS.md` under "Reusable Component / Utility Library".

### Acceptance criteria

- All existing tests for both utilities pass from the new location (`src/lib/`)
- No WPSG-specific types or imports remain in the moved files (were already clean)
- All consuming files import from `@/lib/...`
- `docs/FUTURE_TASKS.md` has the new library-extraction task
- `npm run build:wp` TypeScript clean

---

## Track P45-A6 — JWT In-Memory + httpOnly Cookie Upgrade (P20-K)

### Problem

`WpJwtProvider.ts` stores access tokens in `localStorage` under keys `wpsg_access_token`,
`wpsg_user`, `wpsg_permissions`. An XSS vulnerability on any page in the same origin
gives an attacker full access to the token and its permissions.

The secure architecture (in-memory token + httpOnly refresh cookie) was deferred in
P20-K pending backend coordination.

### Fix

Backend: issue an httpOnly `wpsg_refresh` cookie on login; expose a
`/wp-json/wp-super-gallery/v1/token/refresh` endpoint that validates the cookie and issues
a short-lived access token.

Frontend: store access token in a module-scoped variable only; on startup, call refresh
endpoint to obtain the initial token; refresh proactively before expiry.

### Acceptance criteria

- Access token is never written to localStorage, sessionStorage, or cookies accessible to JS
- Logout clears the httpOnly cookie via an authenticated DELETE request
- Token refresh is transparent to callers; existing session-expiry UX still works
- `WpJwtProvider.test.ts` updated to reflect new storage model

---

## Track P45-A7 — Extract `LoginForm` + `AuthBar*` as Library Components

### Problem

`LoginForm`, `AuthBar`, `AuthBarFloating`, and `AuthBarMinimal` are generic enough for
cross-project reuse. The main coupling points are Mantine (already a peer dep in most
projects), WPSG CSS variables (`--wpsg-color-surface`, etc.), and
`AuthBarFloatingMenuContent`'s dependency on `CampaignContext`.

### Fix

1. Decouple `AuthBarFloatingMenuContent` from `CampaignContext` by accepting campaign
   actions as props.
2. Replace WPSG CSS variable references in Auth components with Mantine theme tokens or
   prop-passed overrides.
3. Move the Auth components to a separate package entry point suitable for extraction.

### Rationale

Removed the `useCampaignContext` import from `AuthBarFloating.tsx` entirely. The five campaign-related fields (`activeCampaign`, `onEditCampaign`, `onEditGalleryConfig`, `onArchiveCampaign`, `onAddExternalMedia`) are now accepted as optional props on `AuthBarFloatingProps`. The internal `AuthBarFloatingMenuContentProps` interface now uses explicit types (`Campaign | null`, `((campaign: Campaign) => void) | undefined`) instead of `ReturnType<typeof useCampaignContext>[...]`.

The `useCampaignContext()` call was moved to `AuthBar.tsx` — the orchestrator component which was already WPSG-coupled via `GalleryBehaviorSettings`. `AuthBar.tsx` reads the campaign context once and forwards the values to whichever `AuthBarFloating` render branch is active (floating or draggable; minimal and full-bar modes don't show campaign actions). The hook is called unconditionally before the `if`-chain of early returns, satisfying React's rules-of-hooks.

CSS vars replaced: `--wpsg-color-surface` → `--mantine-color-body`, `--wpsg-color-border` → `--mantine-color-default-border` in both `AuthBarFull` and `AuthBarMinimal`. These are standard Mantine v7 CSS variables that resolve in any `MantineProvider` tree.

Both `AuthBarFloating.test.tsx` and `AuthBarFloating.portal.test.tsx` were updated: the `CampaignContextProvider` wrapper and `ActivateCampaign` helper component were removed; campaign props are now passed directly to `AuthBarFloating`. All 10 Auth component tests pass; full suite 2088/2088 pass; build clean.

### Acceptance criteria

- Auth components render correctly with a plain Mantine theme (no WPSG CSS vars)
- `AuthBarFloatingMenuContent` no longer imports from any WPSG-specific context
- Existing Auth component tests continue to pass

---

## Track P45-A8 — Extract `sanitizeCss.ts` + `cssUnits.ts` to Shared Library

### Problem

`src/utils/sanitizeCss.ts` (CSS injection prevention) and `src/utils/cssUnits.ts`
(multi-unit dimension helpers) have no WPSG-specific dependencies and are universally
useful across React/WordPress projects.

### Fix

Move both files to a `packages/shared-utils/` package entry point. Update all intra-repo
imports via path alias or package reference. Confirm no circular dependencies.

### Acceptance criteria

- All existing tests for `sanitizeCss` and `cssUnits` continue to pass from the new location
- No WPSG-specific types or imports remain in the extracted files
- Import paths in consuming files updated

---

## Track P45-A11 — `MediaAddModal` Drop Zone Drag-Over Visual Feedback

### Problem

The `MediaAddModal` drop zone showed no visual response when files were dragged over it. The existing `dragover`/`drop` `useEffect` in `MediaTab.tsx` ran once at component mount with `dropRef.current = null` (modal closed at that point), returning early without registering any listeners. Drag-drop had never worked in production: files dropped on the zone opened in a new browser tab (no `preventDefault()` on `dragover`).

### Fix

Moved all drag handling into `MediaAddModal` itself using React JSX event props (`onDragEnter`, `onDragLeave`, `onDragOver`, `onDrop`) directly on the `Paper` drop zone. This eliminates the `useEffect` timing dependency entirely — the handlers are live as soon as the Paper renders. Removed the now-dead `useEffect` from `MediaTab.tsx`.

Visual feedback: blue border + light blue background tint on the `Paper`; hint text changes from "or drag & drop files here" to "Drop files here" during drag-over.

### Rationale

Using React JSX event props rather than `addEventListener` in a `useEffect` avoids the modal-open/closed lifecycle timing issue entirely. The `enterCountRef` counter handles `dragenter`/`dragleave` pairs from child elements without false positives. A future task was added to `docs/FUTURE_TASKS.md` for accumulative multi-file selection with per-file preview and remove buttons.

7 tests added in `MediaAddModal.test.tsx` covering: default hint text, drag-over hint on `dragenter`, restoration on `dragleave` and `drop`, `onSelectFiles` called with dropped files, no listeners when closed.

### Acceptance criteria

- Blue border + background highlight on drag-over
- "Drop files here" hint text replaces the default during drag-over
- Dropping files calls `onSelectFiles` with the dropped `File[]`
- `dragover` calls `e.preventDefault()` so the browser doesn't open the file in a new tab

---

## Track P45-A10 — Bulk Delete/Archive/Restore Confirmation Dialogs

### Problem

`BulkActionsBar`'s Archive and Restore buttons fired `handleBulkArchive` and `handleBulkRestore` immediately — no confirmation gate. Bulk Delete already had `AdminCampaignBulkDeleteModal` and `confirmBulkDelete` state. Archive and restore had no equivalent.

### Fix

Added `confirmBulkArchive` and `confirmBulkRestore` boolean state fields to `useAdminCampaignActions`. Changed `BulkActionsBar`'s `onArchive` and `onRestore` props in `AdminPanel.tsx` from direct action handlers to setters. Added two lazy `AdminCampaignBulkConfirmModal` instances for archive and restore.

### Rationale

Rather than creating two near-identical `AdminCampaignBulkArchiveModal` and `AdminCampaignBulkRestoreModal` files, a single `AdminCampaignBulkConfirmModal` component accepts `action: 'archive' | 'restore'` and derives all text and color from an internal `ACTION_CONFIG` map. `AdminCampaignBulkDeleteModal` stays separate since it has custom UI (the `purgeAnalytics` checkbox). 10 tests added in `AdminCampaignBulkConfirmModal.test.tsx` covering both actions, singular/plural labels, confirm/cancel callbacks.

### Acceptance criteria

- Clicking Archive in `BulkActionsBar` opens a confirmation modal before any server call
- Clicking Restore in `BulkActionsBar` opens a confirmation modal before any server call
- Cancelling either confirmation makes no server call
- `AdminCampaignBulkConfirmModal` test coverage for both actions

---

## Track P45-A16 — smartGuides Per-Slot Memoization

### Problem

`handleDragFrame` in `LayoutCanvas.tsx` rebuilt the `others: SlotRect[]` array from scratch on every drag event (~60 fps). For `n` slots, this created `n - 1` new object literals plus one array allocation per frame. During a sustained drag with 15 slots: ~14 objects × 60 fps = ~840 allocations/second with no benefit, since the other slots' positions are stable throughout the drag (committed only on drag stop).

### Fix

Pre-computed a `Map<string, SlotRect[]>` (per-slot "others" map) using `useMemo` keyed on `template.slots`. The map rebuilds only when the slot collection changes (add/remove/move commit) — not during drag frames. A stable `slotOthersMapRef` (the `ref.current = value` pattern already established in the file) gives the drag handler read access without listing the map as a `useCallback` dependency.

In `handleDragFrame`, the three-line `filter`+`map` was replaced with a single `slotOthersMapRef.current.get(slotId) ?? []` lookup.

### Rationale

The `useMemo` pre-computation is O(n²) in slot count (n arrays of n−1 elements), but it runs only on committed slot changes — rare, deliberate user actions. During drag, the lookup is O(1). For a typical layout of 10–20 slots, the total pre-computed allocation is 90–380 `SlotRect` objects done once, versus 9–19 allocations per frame at 60 fps (540–1140/sec) with the old code. GC pressure on the drag-move hot path is eliminated.

No changes to `smartGuides.ts` or the `computeGuides` API — the optimization is entirely at the call site in `LayoutCanvas.tsx`.

### Acceptance criteria

- Smart guides continue to snap correctly during slot drag
- No new allocations per drag frame in the guides path (the `others` array is pre-computed)
- All existing `LayoutCanvas` and `smartGuides` tests pass without modification

---

## Track P45-A12 — Full ARIA Focus Trap in Lightbox

### Problem

The Lightbox moved focus to the close button on open and restored it on close, but had no focus trap. Pressing Tab while the lightbox was open would cycle through elements on the page behind the overlay, violating ARIA modal dialog semantics (a modal must confine Tab within itself).

### Fix

Wrapped the `Box` backdrop/dialog element in Mantine's `FocusTrap` component (`@mantine/core`). `FocusTrap` uses its child's `ref` (via `cloneElement`) to attach a `document` keydown listener that intercepts Tab and Shift+Tab events and cycles focus only among tabbable descendants (close button, prev/next arrows, video controls if present). No extra DOM wrapper is introduced — Mantine's `FocusTrap` merges the ref directly onto the `Box` element.

The existing focus management `useEffect` (save previous focus on entering, restore on closed) is unchanged — `FocusTrap` handles Tab cycling but not open/close focus handoff.

### Rationale

Mantine's `FocusTrap` was the natural fit: it's the same component used by Mantine's own `Modal`, `Popover`, and `Drawer`. The implementation is a single wrapper and an import change. No custom `useEffect` or `querySelectorAll` logic needed.

2 new tests added to `Lightbox.test.tsx`:
- "moves focus to the close button when opened" — verifies `document.activeElement` is the close button after open
- "Shift+Tab from close button wraps focus within dialog" — verifies `event.defaultPrevented` when Shift+Tab from the first tabbable element (the boundary case where FocusTrap's `scopeTab` calls `preventDefault()`)

Full Tab-cycling behavior requires a real browser and is covered by e2e testing.

### Acceptance criteria

- Tab and Shift+Tab cycle only among focusable elements within the Lightbox dialog
- Close button receives focus when the lightbox opens
- Focus restores to the previously focused element when the lightbox closes
- All existing Lightbox tests continue to pass; 2 new focus-management tests added

---

## Track P45-A17 — Keyboard Shortcut for Adding a New Canvas Slot

### Problem

The Layout Builder had no keyboard shortcut for adding a new slot. Users had to reach for the "Add Slot" button in the canvas panel toolbar every time they wanted a new slot, which interrupted the keyboard-driven workflow.

### Fix

Added `N` as the keyboard shortcut for adding a new slot. The handler:
- Calls `builder.addSlot()` to create the slot and obtain its ID
- Calls `builder.selectSlot(id)` to immediately select it
- Clears overlay and background selection (`setSelectedOverlayId(null)`, `setIsBackgroundSelected(false)`)
- Announces "New slot added" for screen readers
- Is a no-op when the builder is in preview mode (`builder.isPreview`)

Added the entry to the Canvas section of `BuilderKeyboardShortcutsModal.tsx` so it appears in the `?` reference sheet.

### Rationale

`N` follows the same bare-key pattern as `H` (hand tool), `V` (select tool), `F` (fit canvas), and `?` (help). It is not taken by any existing shortcut. Modifier-free keeps it fast and mirrors the "create new thing" convention common in design tools. The `isPreview` guard prevents accidental slot creation when reviewing the layout.

2 new tests added to `BuilderKeyboardShortcuts.test.tsx`: one verifies `addSlot`/`selectSlot` are called with the returned ID; one verifies the "Add new slot" entry appears in the shortcuts reference modal. All 29 tests pass.

### Acceptance criteria

- Pressing `N` in the Layout Builder adds a new slot and selects it immediately
- `N` is a no-op when the builder is in preview mode
- "Add new slot" appears in the `?` keyboard shortcuts reference under Canvas
- Existing keyboard shortcut tests continue to pass

---

## Track P45-A15 — Split `LayoutSlotComponent.tsx` into Sub-Components

### Problem

`LayoutSlotComponent.tsx` was 945 lines with significant JSX duplication across its three render paths (preview clip-path, edit clip-path, edit rectangle). Four patterns appeared 2–4 times each with no meaningful variation: the index number badge, the lock icon badge, the overlay effect layer, and the drag/resize dimensions tooltip.

### Fix

Extracted four private sub-components immediately after the existing `MaskDragOverlay` definition:

- **`SlotIndexBadge({ index, isSelected, badgeBg })`** — the top-left numbered badge, called in both edit mode branches (clip-path and rectangle)
- **`SlotLockBadge({ lockBg })`** — the top-right lock icon badge, called in both edit mode branches
- **`SlotOverlayLayer({ overlayBg, clipPath?, maskCssProps?, borderRadius? })`** — the colored overlay effect div; accepts optional clip-path/mask props for shaped slots and optional `borderRadius` for rectangle slots; called in all 4 overlay-bearing render paths (preview + edit × clip-path + rectangle)
- **`SlotLiveInfoOverlay({ liveInfo, bg })`** — the drag/resize dimensions tooltip (bottom-center); extracted `SlotLiveInfo` interface for the `liveInfo` state type

Also typed the `liveInfo` state as `SlotLiveInfo | null` instead of the inline anonymous object union.

### Rationale

All 4 extracted components are purely presentational (no state, no hooks). They accept only the data they render. The inline style props are passed as-is, so behavior is unchanged. `SlotOverlayLayer` unifies 4 near-identical divs by accepting optional `clipPath`/`maskCssProps`/`borderRadius` — when undefined, these are spread/assigned as `undefined` in the style object, which the browser ignores.

The file reduced from 945 to 909 lines despite adding ~90 lines of new component definitions — the eliminated duplication was ~126 lines.

No test changes were needed. All 32 existing `LayoutSlotComponent` tests pass, covering both preview and edit modes.

### Acceptance criteria

- Duplicated badge, overlay, and live-info JSX consolidated into named sub-components
- No behavior change — all existing tests pass without modification
- TypeScript build clean

---

## Track P45-A13 — Extract `Lightbox` as Shared Library Component

### Problem

`Lightbox.tsx` and its sibling `KeyboardHintOverlay.tsx` have generic functionality with no WPSG business logic, but were coupled to WPSG-specific types and CSS variables:
- `LightboxProps.media: MediaItem[]` imported `MediaItem` from `@/types`, pulling in a type with many WPSG-specific fields
- `KeyboardHintOverlay.tsx` used `--wpsg-color-background` and `--wpsg-color-border` CSS variables

### Fix

Defined a minimal `LightboxMediaItem` interface directly in `Lightbox.tsx` containing only the fields the component reads (`id`, `url`, `type: string`, `caption?: string | undefined`, `embedUrl?: string | undefined`). Removed the `MediaItem` import from `@/types`. `LightboxMediaItem` is exported so consumers can use it for type-annotating their media data.

Replaced the two WPSG CSS variables in `KeyboardHintOverlay.tsx` with Mantine v7 palette tokens: `--mantine-color-dark-7` (background, always near-black regardless of color scheme) and `--mantine-color-dark-4` (border). These are appropriate since the Lightbox always renders on a near-black backdrop.

Updated `docs/FUTURE_TASKS.md` to reflect that both Auth components (P45-A7) and Lightbox/KeyboardHintOverlay (P45-A13) are now decoupled and ready for extraction once monorepo infrastructure is established.

### Rationale

`type: string` (rather than `'image' | 'video'`) was chosen for `LightboxMediaItem.type` because `MediaItem.type` is `"video" | "image" | "other"` — a wider union that would not satisfy the narrower type with `exactOptionalPropertyTypes: true`. Using `string` keeps the interface a structural subtype of `MediaItem` (so existing `MediaItem[]` values pass without casting) and is correct since the component only branches on `=== 'video'` at runtime.

`?: string | undefined` (explicit union) was used for optional fields because `exactOptionalPropertyTypes: true` is enabled in the project's TypeScript config, which distinguishes between `?: string` (absent | string) and `?: string | undefined` (absent | string | undefined). `MediaItem` uses the explicit union form, so the local interface must match to be structurally compatible.

No test changes were required: `Lightbox.test.tsx` fixtures are typed as `MediaItem` which remains a structural superset of `LightboxMediaItem`. 2088/2088 tests pass; build clean.

### Acceptance criteria

- `Lightbox.tsx` no longer imports from `@/types`
- `LightboxMediaItem` is exported for consumer use
- `KeyboardHintOverlay.tsx` uses no `--wpsg-*` CSS variables
- All existing Lightbox tests continue to pass
- `docs/FUTURE_TASKS.md` reflects completed decoupling work

---

## Track P45-A18 — Split `GalleryConfigEditorModal.tsx` into Sub-Components

`GalleryConfigEditorModal.tsx` was 1386 lines. The top ~480 lines were pure TypeScript utility functions with no React dependencies — config mutation helpers, representative-value getters, scope/adapter utilities. These were entirely separable from the React layer.

### What changed

- **New file**: `src/components/Common/galleryConfigUtils.ts` (480 lines) — all 24 pure utility functions, 3 type aliases, 1 constant, and 2 private helpers (`getApplicableScopes`, `hasVisibleAdapterSettingField`, `CONDITIONAL_ADAPTER_FIELD_CONTROLLERS`) extracted here and exported
- **`GalleryConfigEditorModal.tsx`**: reduced from 1386 → 937 lines; imports replaced with a single block from `./galleryConfigUtils`; three existing internal React sub-components (`GalleryConfigEditorIntro`, `GalleryConfigBreakpointAdaptersSection`, `GalleryConfigEditorFooterActions`) were already present and remain in the main file
- Removed `adapterUsesSettingGroup`, `AdapterSettingGroupDefinition`, `AdapterSettingGroupScopeMode`, `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`, `GalleryCommonSettings`, `GalleryConfigMode`, `GalleryConfigScope`, `getLegacyViewportBackgroundFieldMap` from the modal's imports (all moved to utils)

### Rationale

The pure-function block in the modal file was the natural extraction boundary — no React imports, no hooks, no JSX. Extracting to `galleryConfigUtils.ts` makes these functions independently testable and importable by any future breakpoint/adapter editor without dragging in the full Drawer/Accordion tree. `getApplicableScopes`, `hasVisibleAdapterSettingField`, and `CONDITIONAL_ADAPTER_FIELD_CONTROLLERS` were left unexported since they are internal coordination helpers not needed by consumers.

The three existing sub-components (`GalleryConfigEditorIntro`, `GalleryConfigBreakpointAdaptersSection`, `GalleryConfigEditorFooterActions`) remain in the modal file — they share the `GalleryConfigDraftUpdater` type and are tightly coupled to the modal's draft state flow; extracting them to separate files would add import complexity without meaningfully reducing coupling.

### Acceptance criteria

- `GalleryConfigEditorModal.tsx` contains no utility function definitions
- All 24 utility functions are exported from `galleryConfigUtils.ts`
- `npm run build:wp` TypeScript clean
- 2088/2088 tests pass

---

## Track P45-A14 — Split `LayoutBuilderModal.tsx` into Focused Hooks

`LayoutBuilderModal.tsx` was 1161 lines. The bulk of the non-JSX body broke into four clear logical units with well-defined inputs/outputs — each suitable for a standalone hook.

### What changed

Four new hooks extracted to `src/hooks/`:

| Hook | Lines | Responsibility |
|------|-------|----------------|
| `useBuilderWorkspacePrefs` | 87 | P30-B snap/grid/ruler prefs, localStorage persistence, P37-KS1 migration |
| `useBuilderCampaignMedia` | 66 | Campaign list fetch, media fetch, selection persistence per-template |
| `useBroadcastStaleness` | 54 | P30-D cross-tab stale detection + `postSaved()` for the save handler |
| `useBuilderDraftRestore` | 119 | P36-A draft restore/discard modal prompt |

`LayoutBuilderModal.tsx` reduced from 1161 → 966 lines. Module-level `BUILDER_BC_CHANNEL` constant and `BuilderBroadcastMessage` type moved into `useBroadcastStaleness`. Removed `safeLocalStorage`, `useAllCampaignOptions`, `useMediaItems`, and `LayoutDraftPayload` imports from the modal.

### Rationale

Each extracted hook is independently testable and addresses a distinct concern:
- `useBuilderWorkspacePrefs` — pure preference state; no coupling to builder domain logic
- `useBuilderCampaignMedia` — data-fetching layer; decoupled from the builder state machine
- `useBroadcastStaleness` — encapsulates the BroadcastChannel lifecycle; exposes only `postSaved` to the caller, hiding all channel management
- `useBuilderDraftRestore` — side-effect-only hook using the ref-callback pattern (`onRestoreDraftRef`, `onDiscardDraftRef`) so the effect never re-runs due to prop identity changes

`useBuilderDraftRestore` is `.tsx` because it renders a Mantine `<Text>` node for the confirm modal body. The remaining action handlers (handleSave, handleClose, group handlers, keyboard handler) were NOT extracted — they have 10+ interdependencies and share `announce`, `builder`, and the UI state setters. Extracting them would move complexity without reducing coupling.

### Acceptance criteria

- `LayoutBuilderModal.tsx` contains no workspace preference state, no campaign/media fetch logic, no BroadcastChannel wiring, and no draft restore logic
- `npm run build:wp` TypeScript clean
- 2088/2088 tests pass

---

---

## Track P45-A9 — Split `MediaTab.tsx` into Focused Sub-Components / Hooks

`MediaTab.tsx` was 1382 lines. Five extraction boundaries were identified with minimal coupling.

### What changed

| Unit | Lines | Responsibility |
|------|-------|----------------|
| `MediaTabSortableItems.tsx` | 185 | `SortableListRow`, `SortableGridItem`, and `SharedSortableProps` type |
| `useMediaViewPrefs` | 63 | Per-campaign view/sort preferences (viewMode, cardSize, sortMode, orphanFilter, listPage) + P37-KS1 migration |
| `useMediaLightbox` | 52 | Lightbox open/index state, `openLightbox`, `navigateLightbox`, keyboard navigation |
| `useMediaUsageSummary` | 49 | P18-G usage-count fetch; cancellable effect keyed on sorted media IDs |
| `useMediaDnd` | 106 | dnd-kit sensors, drag state, insertion-indicator styles, `handleDndEnd`, `moveByKeyboard` |

`MediaTab.tsx` reduced from 1382 → 998 lines. The mutation-heavy handlers (upload, near-duplicate resolution, external media, edit, delete, oEmbed enrichment) were deliberately left in the main component — they share 10+ interdependencies (`setMedia`, `queryClient`, `campaignId`, `apiClient`, `onCampaignsUpdated`) and extracting them would create a large "mutations bag" without meaningfully reducing coupling.

### Rationale

**`MediaTabSortableItems.tsx`**: Both `SortableListRow` and `SortableGridItem` call `useSortable` and compose Mantine table/grid primitives — they have zero coupling to MediaTab state and are the clearest extraction target.

**`useMediaViewPrefs`**: All five preferences are `useLocalStorage` calls keyed to `campaignId` or `rootId`, plus a one-time P37-KS1 migration effect. The hook exports `ViewMode`, `CardSize`, and `MediaSortMode` so MediaTab can type-cast onChange callbacks cleanly.

**`useMediaLightbox`**: Pure lightbox concern — index state, `openLightbox` finder, `navigateLightbox` wrap-around, keyboard effect. Accepts `imageItems: MediaItem[]`; `imageItems` stays as a `useMemo` in MediaTab because it's derived from `media`, which is the optimistic mutation state.

**`useMediaUsageSummary`**: The stable-ID-key pattern (`sorted ids → string → split`) and the cancellable fetch effect are entirely self-contained. Accepts `media: MediaItem[]`; the mediaIdKey derivation moved inside the hook.

**`useMediaDnd`**: Accepts `media: MediaItem[]` and `onReorder: (nextMedia: MediaItem[]) => Promise<void>`. The `onReorder` callback (`reorderMediaItems`) stays in MediaTab because it mutates `setMedia`, `queryClient`, and calls `onCampaignsUpdated`. This clean interface keeps DnD machinery (sensors, drag state, `arrayMove`, insertion styles) fully encapsulated while the commit operation remains in the mutation layer.

### PR review fixes (Copilot)

- **`usageSummary[item.id] ?? 1` → `?? 0`** in both `SortableListRow` and `SortableGridItem`: the `?? 1` fallback was pre-existing code moved during extraction. It incorrectly labels items absent from the summary as "1 campaign", hiding the "Unused" (count = 0) red badge. `?? 0` is the correct fallback — items not returned by the summary API are unknown, but defaulting to "no known associations" is safer than falsely claiming 1, and the API is expected to explicitly return 0 for genuinely unused items.
- **`enterCountRef.current--` → `Math.max(0, enterCountRef.current - 1)`** in `MediaAddModal.tsx`: clamping to 0 prevents the counter going negative if `dragleave` fires more times than `dragenter` (common with nested elements), which would leave `isDragOver` stuck true on a subsequent drag.

### Acceptance criteria

- `MediaTab.tsx` no longer contains SortableListRow/SortableGridItem, lightbox state, usage-summary fetch, view/sort preference localStorage, or dnd-kit sensor/state setup
- `npm run build:wp` TypeScript clean
- 2088/2088 tests pass

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Storybook for Auth components | Requires full Storybook setup in the repo first |
| `useCarousel` tests | Logic is correct and low surface area; risk does not justify the effort before A1–A3 |
