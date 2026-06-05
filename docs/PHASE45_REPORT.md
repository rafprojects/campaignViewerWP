# Phase 45 — Post-Audit Follow-Through: Tests, Auth UX & Library Extraction

**Status:** Planned
**Created:** 2026-06-05
**Last updated:** 2026-06-05

### Tracks

| Track   | Description                                              | Status  | Effort |
|---------|----------------------------------------------------------|---------|--------|
| P45-A1  | Test coverage for `useXhrUpload`                         | Planned | M      |
| P45-A2  | Test coverage for `useExternalMediaModal`                | Planned | M      |
| P45-A3  | Test coverage for `useInContextSave`                     | Planned | S      |
| P45-A4  | `useInContextSave` failure UX — surface save errors      | Planned | S      |
| P45-A5  | Idle timeout countdown warning (`useIdleTimeout`)        | Planned | M      |
| P45-A6  | JWT in-memory + httpOnly cookie upgrade (P20-K)          | Planned | L      |
| P45-A7  | Extract `LoginForm` + `AuthBar*` as library components   | Planned | M      |
| P45-A8  | Extract `sanitizeCss.ts` + `cssUnits.ts` to shared lib  | Planned | S      |
| P45-A9  | Split `MediaTab.tsx` into focused sub-components/hooks  | Planned | L      |
| P45-A10 | Bulk delete/archive/restore confirmation dialogs        | Planned | S      |
| P45-A11 | `MediaAddModal` drop zone drag-over visual feedback     | Planned | S      |

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

Repurpose (or add) a `idleWarningThresholdMs` setting to make the threshold configurable.

### Acceptance criteria

- `onWarning` fires with the correct seconds-remaining when `warningThresholdMs` before timeout
- Clicking "Stay logged in" cancels the pending timeout and dismisses the warning
- No warning shown when `warningThresholdMs` is 0 or omitted
- Existing `useIdleTimeout.test.ts` continues to pass; new tests cover the warning path

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

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Storybook for Auth components | Requires full Storybook setup in the repo first |
| `useCarousel` tests | Logic is correct and low surface area; risk does not justify the effort before A1–A3 |
