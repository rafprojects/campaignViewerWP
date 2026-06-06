# Phase 45 — Post-Audit Follow-Through: Tests, Auth UX & Library Extraction

**Status:** In Progress
**Created:** 2026-06-05
**Last updated:** 2026-06-05

### Tracks

| Track   | Description                                              | Status   | Effort |
|---------|----------------------------------------------------------|----------|--------|
| P45-A1  | Test coverage for `useXhrUpload`                         | Done     | M      |
| P45-A2  | Test coverage for `useExternalMediaModal`                | Done     | M      |
| P45-A3  | Test coverage for `useInContextSave`                     | Done     | S      |
| P45-A4  | `useInContextSave` failure UX — surface save errors      | Done     | S      |
| P45-A5  | Idle timeout countdown warning (`useIdleTimeout`)        | Done     | M      |
| P45-A6  | JWT in-memory + httpOnly cookie upgrade (P20-K)          | Planned | L      |
| P45-A7  | Extract `LoginForm` + `AuthBar*` as library components   | Planned | M      |
| P45-A8  | Extract `sanitizeCss.ts` + `cssUnits.ts` to shared lib  | Done     | S      |
| P45-A9  | Split `MediaTab.tsx` into focused sub-components/hooks  | Planned | L      |
| P45-A10 | Bulk delete/archive/restore confirmation dialogs        | Done     | S      |
| P45-A11 | `MediaAddModal` drop zone drag-over visual feedback     | Done     | S      |
| P45-A12 | Full ARIA focus trap in `Lightbox`                      | Planned | M      |
| P45-A13 | Extract `Lightbox` as shared library component          | Planned | M      |
| P45-A14 | Split `LayoutBuilderModal.tsx` into focused hooks       | Planned | L      |
| P45-A15 | Split `LayoutSlotComponent.tsx` into sub-components     | Planned | M      |
| P45-A16 | `smartGuides.ts` per-slot memoization for drag perf     | Planned | M      |
| P45-A17 | Keyboard shortcut for adding a new canvas slot          | Done     | S      |
| P45-A18 | Split `GalleryConfigEditorModal.tsx` into sub-components | Planned | L      |

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

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Storybook for Auth components | Requires full Storybook setup in the repo first |
| `useCarousel` tests | Logic is correct and low surface area; risk does not justify the effort before A1–A3 |
