# Phase 10 — Codebase Refinement & UX Polish

**Status:** Complete  
**Version target:** v0.8.0  
**Created:** February 5, 2026
**Last updated:** February 16, 2026

---

## Overview

Phase 10 addresses technical debt, code redundancy, and UX gaps identified during a comprehensive codebase audit following Phase 9 (Theme System). The work is organized into four tracks: **Component Decomposition**, **Code DRY-up**, **UX Improvements**, and **Cleanup / Housekeeping**.

---

## Track A — Component Decomposition (High Priority)

**Status update:** Core decomposition tasks are complete. Remaining line-count targets are treated as stretch metrics and can be pursued in a follow-up refactor pass.

### Progress Snapshot (as of Feb 12, 2026)

- `App.tsx`: reduced from ~995 lines to ~706 lines with core modal/auth extractions complete.
- `AdminPanel.tsx`: reduced from ~1,458 lines to ~901 lines with tabs and modals extracted.
- `MediaTab.tsx`: reduced from ~900 lines to ~735 lines with modal decomposition complete.
- `useCarousel` shared hook implemented and adopted by both carousel components.
- `useLightbox` + shared `CarouselNavigation` implemented and adopted.

Large monolith files that hurt maintainability, testability, and code review velocity.

### A1. Split `App.tsx` (995 lines)

- [x] Extract **EditCampaignModal** (~200 lines of JSX + state for the inline campaign editor)
- [x] Extract **MediaLibraryPicker** (the "Pick from Library" section into a standalone reusable component)
- [x] Extract **AuthBar** (signed-in user info bar + admin toggle buttons) into `components/Auth/AuthBar.tsx`
- [x] Move the hardcoded `COMPANIES` record into `data/mockData.ts` (already duplicated there)
- [x] Remove the inline `fallbackSrc` SVG data URI → share a single constant from `utils/fallback.ts`
- [~] Goal: App.tsx ≤ 300 lines, thin orchestrator only (stretch metric; currently ~706 lines) — **Deferred to FUTURE_TASKS**

### A2. Split `AdminPanel.tsx` (1,458 lines / 40 `useState` calls)

- [x] Extract **CampaignsTab** — campaign CRUD table + modals
- [x] Extract **MediaTab** (already partially separate but orchestrated inline)
- [x] Extract **AccessTab** — access management + company view + user search
- [x] Extract **AuditTab** — audit log table
- [x] Extract **QuickAddUserModal** — user creation form + password reset link
- [x] Keep AdminPanel as a thin `Tabs` orchestrator routing to sub-components (substantially achieved through tab + modal extraction)
- [x] Adopt `useReducer` or a state machine for the 40 `useState` calls
- [~] Goal: AdminPanel.tsx ≤ 200 lines (stretch metric; currently ~901 lines) — **Deferred to FUTURE_TASKS**

### A3. Unify Carousel Components

- [x] Extract `useCarousel(length)` hook — shared `currentIndex`, `next()`, `prev()`, `setIndex()`
- [x] Extract `useLightbox()` hook — open/close state, keyboard Escape binding, scroll lock
- [x] Extract `<CarouselNavigation>` component — prev/next arrows, counter badge, thumbnail strip
- [x] Refactor `ImageCarousel.tsx` and `VideoCarousel.tsx` to consume shared hooks/components
- [x] Estimated ~70% JSX duplication eliminated

---

## Track B — Code DRY-up (Medium Priority)

**Status update:** All core DRY-up tasks complete. B3 (ConfirmModal) and B4 (CampaignSelector) are now done.

Repeated patterns that inflate the codebase and create divergence risk.

### B1. Extract `useXhrUpload` Hook

**Problem:** XHR upload-with-progress is implemented independently in **3 places** (App.tsx, MediaTab.tsx, and legacy api/media.ts). All three build FormData, wire `xhr.upload.onprogress`, set auth headers, and parse JSON.

- [x] Create `src/hooks/useXhrUpload.ts` — returns `{ upload, progress, isUploading, resetProgress }`
- [x] Wire into App.tsx and MediaTab.tsx
- [x] Remove legacy XHR code from `api/media.ts` (entire file is deprecated)
- [x] Add client-side file validation (type + size) before upload in both App.tsx and MediaTab.tsx
- [x] Add user-friendly error messages mapping HTTP status codes (401, 413, 415, 500)
- [x] Clear upload file state on validation failure or server error

### B2. Extract `getErrorMessage` Utility

**Problem:** The pattern `err instanceof Error ? err.message : 'Something went wrong'` appears **20+ times** across App.tsx, AdminPanel.tsx, and MediaTab.tsx.

- [x] Create `src/utils/getErrorMessage.ts`
- [x] Replace all 20+ occurrences (App.tsx, AdminPanel.tsx, SettingsPanel.tsx, MediaTab.tsx)

### B3. Extract `ConfirmModal` Component

**Problem:** AdminPanel has **4 separate confirmation modals** (archive campaign, restore campaign, archive company, delete media) with nearly identical structure.

- [x] Create `src/components/shared/ConfirmModal.tsx` — title, message, cancel + colored action button
- [x] Refactor all 4 confirmation dialogs to use it

### B4. Extract `CampaignSelector` Component

**Problem:** The `<Select>` with campaign-to-option-data mapping appears in **4 tabs** (media, access, audit, Quick Add User).

- [x] Create `src/components/shared/CampaignSelector.tsx`
- [x] DRY up all 4 usages

### B5. Consolidate Company Data

**Problem:** `COMPANIES` is defined in both `App.tsx` (inline record) and `data/mockData.ts` (array). Same 6 companies, same brand colors, same logos.

- [x] Single source of truth in `data/mockData.ts`
- [x] Export typed lookup helpers (`getCompanyById`, `getCompanyColor`)
- [x] Remove duplicate from App.tsx

### B6. Shared Fallback Image Constant

**Problem:** Inline SVG data URIs for fallback images appear in **4+ places** (App.tsx, CampaignCard.tsx, MediaTab.tsx, CampaignViewer.tsx).

- [x] Create `src/utils/fallback.ts` exporting a single `FALLBACK_IMAGE_SRC` constant
- [x] Replace all inline SVG data URIs

### B7. Consolidate Media Sorting

**Problem:** `items.sort((a, b) => a.sort_order - b.sort_order)` appears in **3+ places**.

- [x] Add `sortByOrder()` helper to `src/utils/sortByOrder.ts`
- [x] Replaced in App.tsx and MediaTab.tsx

---

## Track C — UX Improvements (Medium Priority)

**Status update:** All UX improvements (C1–C9) are complete.

### C1. Button Loading States for Admin Actions

**Problem:** Archive, restore, save, and grant-access operations show no inline loading indicator on the triggering button. Users only see feedback after success/failure notification.

- [x] Add `loading` prop to action buttons in AdminPanel
- [x] Track per-operation loading state

### C2. Empty State for Unauthenticated Gallery

**Problem:** When a user hasn't logged in and there are no public campaigns, the gallery shows an empty grid with no explanation.

- [x] Add a call-to-action empty state: "Sign in to view campaigns"

### C3. Gallery Search & Filtering

**Problem:** Users can only filter by company or access mode. No text search for campaign titles/descriptions.

- [x] Add a search input to CardGallery
- [x] Filter campaigns client-side by title match

### C4. Gallery Pagination / Virtual Scrolling

**Problem:** `CardGallery.tsx` renders all campaigns at once. For 50+ campaigns this causes slow initial paint.

- [x] Add pagination or "Load more" mechanism
- [x] Consider virtual scrolling for very large sets

### C5. Touch/Swipe for Carousel Lightbox

**Problem:** Image/Video carousel lightbox only supports keyboard and click navigation. No touch gestures on mobile.

- [x] Add swipe-left/right gesture support via pointer events (`useSwipe` hook)

### C6. Keyboard Shortcut Hints

**Problem:** Both carousels support arrow keys and Escape, but there's no visible hint.

- [x] Add a subtle "Use ← → to navigate, Esc to close" overlay on first lightbox open (`KeyboardHintOverlay`)

### C7. Dirty Form Guard

**Problem:** The Edit Campaign modal in App.tsx and AdminPanel can be closed with unsaved changes — no "Discard changes?" prompt.

- [x] Add `useDirtyGuard` hook + modal close guard for CampaignFormModal, MediaEditModal, EditCampaignModal

### C8. Sticky Auth Bar

**Problem:** The signed-in user bar with admin buttons scrolls out of view.

- [x] Make the auth bar sticky with backdrop blur and border

### C9. CampaignCard Semantic Button

**Problem:** `CampaignCard.tsx` uses `<div role="button">` instead of a native `<button>` or Mantine `UnstyledButton`. While ARIA attributes are present, native semantics are stronger.

- [x] Switch to `<UnstyledButton>` from Mantine for better assistive technology support

---

## Track D — Cleanup & Housekeeping (High Priority, Low Effort)

### D1. Delete Deprecated `api/media.ts`

**Problem:** Every function is marked `@deprecated`. All call sites have migrated to `services/apiClient.ts`. The deprecation note says "Remove once all call-sites have been migrated" — they have been.

- [x] Delete `src/api/media.ts`
- [x] Delete `src/api/media.test.ts`
- [x] Remove any residual imports

### D2. Delete Dead `AdminPanel.module.scss` (444 lines)

**Problem:** `AdminPanel.tsx` does not import `AdminPanel.module.scss`. The file defines a parallel custom component system (`.panel`, `.tabs`, `.tableRow`, `.primaryButton`, etc.) that was superseded by Mantine components.

- [x] Delete `src/components/Admin/AdminPanel.module.scss`

### D3. Consolidate Icon Library

**Problem:** The codebase uses **both** `@tabler/icons-react` (AdminPanel, MediaTab, ErrorBoundary, App — 6 files) and `lucide-react` (CampaignViewer, ImageCarousel, VideoCarousel, CampaignCard — 4 files). Two icon libraries means unnecessary bundle weight.

- [x] Migrate `lucide-react` usages to `@tabler/icons-react` (Mantine ecosystem standard)
- [x] Remove `lucide-react` from `package.json`

### D4. Type the Window Globals

**Problem:** Scattered `as unknown as Record<string, unknown>` assertions for `__WPSG_CONFIG__`, `__WPSG_API_BASE__`, `__wpsgThemeId` etc. in ThemeContext.tsx, apiClient.ts, and App.tsx.

- [x] Create `src/types/global.d.ts` with proper `Window` interface augmentation
- [x] Remove all `as unknown as Record` casts

### D5. Remove Debug Statements

**Problem:** `apiClient.ts` has 4 `console.debug` statements that should be removed or gated behind `import.meta.env.DEV`.

- [x] Audit all `console.debug` / `console.log` across `src/`
- [x] Remove or gate behind dev-mode check

### D6. Sanitize oEmbed HTML

**Problem:** `MediaTab.tsx` renders oEmbed HTML via `dangerouslySetInnerHTML`. Even though the HTML comes from the WP proxy, this is an XSS vector if the oEmbed provider is compromised.

- [x] Add DOMPurify (or similar) to sanitize oEmbed HTML before rendering
- [x] Gate `dangerouslySetInnerHTML` behind sanitization

### D7. Fix Async/Await in AdminPanel Modals

**Problem:** Archive/restore confirm modal handlers call async API functions **without `await`**, so errors are swallowed silently and modals close regardless of outcome.

- [x] Add proper `await` + try/catch to archive/restore handlers
- [x] Show error notification on failure instead of silently closing

### D8. Remaining Hardcoded Colors in TSX

**Problem:** Several TSX files still have inline hardcoded colors that should use theme CSS variables:

| File | Examples |
|------|---------|
| `CampaignViewer.tsx` | `rgba(30, 41, 59, 1)`, `rgba(30, 41, 59, 0.6)` gradient overlay |
| `CampaignCard.tsx` | `rgba(15, 23, 42, 0.6)`, `rgba(30, 41, 59, 0.9)`, `#94a3b8` lock icon |
| `ImageCarousel.tsx` | `rgba(0, 0, 0, 0.95)` lightbox background |
| `AdminPanel.tsx` | `rgba(34, 139, 230, 0.05)` row highlight, `var(--mantine-color-dark-5)` borders |

- [x] Migrate all to `var(--wpsg-*)` or `color-mix()` expressions

---

## QA Fixes (Applied during Track B)

Bug fixes and improvements identified during QA testing of Track B changes.

### Backend Fixes

- [x] **Fix `register_meta` REST schema** — `media_items` and `tags` array meta fields now include proper `show_in_rest.schema.items` definitions, fixing WordPress "Doing it Wrong" Query Monitor warning.
- [x] **Upload endpoint returns thumbnail** — `upload_media` now generates and returns a `thumbnail` field using WP's `medium` image size.
- [x] **Fix video thumbnail in media library** — `list_media_library` was reading `_wp_attachment_image_alt` (alt text) instead of `_thumbnail_id` for video posters.

### Frontend Fixes

- [x] **Fix 401 upload regression** — Edit campaign upload was using `authProvider.getAccessToken()` directly, missing the WP nonce. Switched to `apiClient.getAuthHeaders()` (includes both nonce and Bearer token), matching MediaTab's working approach.
- [x] **Upload now links to campaign** — `handleUploadMediaInEdit` was only uploading to WP media library without linking to the campaign via `POST /campaigns/{id}/media`. Now does proper 2-step upload.
- [x] **Real-time gallery updates** — Added `mutateCampaigns()` calls after all media mutations (upload, add from library, add external, delete, reorder) in both App.tsx and MediaTab. Gallery updates immediately without page reload.
- [x] **Client-side upload validation** — File type and size checked before upload attempt. Accepted types: JPEG, PNG, GIF, WebP, MP4, WebM, OGG. Max 50 MB. Clear file state on validation failure.
- [x] **User-friendly upload error messages** — XHR hook now maps HTTP status codes (401, 413, 415, 500) to readable messages instead of raw codes.
- [x] **Clear file on upload failure** — Upload state (file selection, progress) resets after errors instead of leaving stale state.
- [x] **Progress bar improvements** — Striped + animated progress bars (`size="md"`) in both edit modal and admin upload.
- [x] **Upload button UX** — Admin MediaAddModal: `variant="filled"` with blue color and upload icon; right-aligned; disabled when no file selected. Image preview only for image files (no blank area for videos). "Or add external URL" → "Add External URL".
- [x] **Fix pre-existing App.test.tsx failure** — Edit campaign test used `getByRole` (sync) for lazy-loaded CampaignViewer button; fixed to `findByRole` (async).

---

## Track E — Architecture Improvements (Low Priority)

### E1. SWR for AdminPanel Data Fetching

**Problem:** AdminPanel manually manages `data`, `loading`, `error` state for fetching campaigns, media, users, and audit entries. This is ~30 lines of boilerplate per resource. SWR is already a project dependency used in App.tsx.

- [~] Adopt SWR for AdminPanel data fetching — **Deferred to FUTURE_TASKS (E1)**
- [~] Gain automatic revalidation, caching, and error retry — **Deferred to FUTURE_TASKS (E1)**

### E2. Fix N+1 Media Fetch in CardGallery

**Problem:** `CardGallery` fetches all campaigns, then triggers per-campaign media fetches via `useSWR` inside each `CampaignCard`. For 20 campaigns = 21 HTTP requests on initial load.

- [~] Add a bulk media endpoint (`GET /campaigns/media?ids=1,2,3`) — **Deferred to FUTURE_TASKS (E2)**
- [~] Or include media summary in the campaigns list response — **Deferred to FUTURE_TASKS (E2)**

### E3. Remove `any` Types in MediaTab ✅

**Problem:** `MediaTab.tsx` uses `any` for oEmbed response types, media state arrays, and several callback parameters.

- [x] Add proper TypeScript interfaces for oEmbed responses — created shared `OEmbedResponse` in `src/types/index.ts`
- [x] Type all `any` occurrences — replaced 3 `any` types in MediaTab.tsx + unified `MediaAddModal.tsx` with shared type
- [x] Zero `any` remaining in production source code

---

## Track F — Feature Ideas (Future / Not Committed)

| Feature | Effort | Impact | Notes |
|---------|--------|--------|-------|
| Drag-and-drop media reordering (`@dnd-kit`) | Medium | High | Replace ↑/↓ buttons; natural UX |
| Bulk media operations (multi-select delete/move) | Medium | High | Common admin workflow |
| Campaign duplication ("Clone Campaign") | Low | Medium | Copy campaign + media metadata |
| Campaign text search in gallery | Low | Medium | Client-side title/description filter |
| Keyboard shortcuts for admin (`Ctrl+N`, `Ctrl+S`) | Low | Medium | `useHotkeys` from Mantine |
| Export/import campaigns as JSON | Medium | Medium | Migration between WP instances |
| Campaign analytics dashboard (view counts) | High | Medium | Requires event tracking backend |

---

## Items Migrated from FUTURE_TASKS.md

The following items from `docs/FUTURE_TASKS.md` remain relevant and are captured here or in Track F:

| FUTURE_TASKS Item | Status |
|---|---|
| Modularize Embed Provider Handlers | Still relevant — deferred |
| External Thumbnail Cache | Still relevant — deferred |
| Redis/Memcached Object Cache | Still relevant — not needed yet |
| oEmbed Failure Monitoring | Still relevant — low priority |
| Admin Health Dashboard | Still relevant — deferred |
| Usage Analytics | Still relevant — deferred (Track F) |
| WAF Rules | Still relevant — deferred |
| Contributor Tooling (Storybook, Husky, ADRs) | Still relevant — good Phase 11 candidate |
| WP-CLI Commands | Still relevant — deferred |
| Drag-and-drop media reordering | **Promoted** to Track F |
| Media library search/filtering | **Promoted** to Track C3 |
| Campaign cloning | **Promoted** to Track F |
| Campaign scheduling | Still relevant — deferred |
| Role-based access levels | Still relevant — deferred |
| Time-limited access grants | Still relevant — deferred |
| Access totals summary UI | Still relevant — deferred |
| Image optimization on upload | Still relevant — deferred |
| PWA support | Still relevant — deferred |
| Third-party OAuth | Still relevant — deferred |
| Webhook support | Still relevant — deferred |
| REST API docs (OpenAPI) | Still relevant — good Phase 11 candidate |

---

## Suggested Implementation Order

### Current Focus (updated)
1. Complete remaining Track A items (App fallback/data consolidation, carousel/lightbox unification)
2. Reduce orchestration complexity in `AdminPanel.tsx` and `MediaTab.tsx`
3. Proceed to Track D quick wins (`api/media.ts` removal, stylesheet cleanup, global typing)

### Sprint 1 — Quick Wins (D-track cleanup)
1. D1: Delete deprecated `api/media.ts`
2. D2: Delete dead `AdminPanel.module.scss`
3. D5: Remove debug statements
4. D4: Type the Window globals
5. B2: Extract `getErrorMessage` utility
6. B5: Consolidate company data
7. B6: Shared fallback image constant

### Sprint 2 — Component Decomposition
1. A2: Split AdminPanel.tsx (highest impact)
2. A1: Split App.tsx
3. A3: Unify carousel components
4. B1: Extract `useXhrUpload` hook

### Sprint 3 — UX & Polish
1. D8: Remaining hardcoded colors in TSX
2. D3: Consolidate icon library
3. D7: Fix async/await in modals
4. D6: Sanitize oEmbed HTML
5. C1: Button loading states
6. C2: Empty state for unauthenticated gallery
7. C9: CampaignCard semantic button

### Sprint 4 — Architecture & Features
1. E1: SWR for AdminPanel
2. E2: Fix N+1 media fetch
3. C3: Gallery search
4. C5: Touch/swipe carousel
5. B3/B4: ConfirmModal + CampaignSelector components

---

## Phase 10 Wrap-Up Summary

### Final Statistics
- **Tests:** 167 passing (23 test files), 1 skipped
- **Coverage:** 80.74% statements/lines (threshold: 80%), 72.55% branches (threshold: 72%), 62.54% functions (threshold: 60%)
- **TypeScript:** Zero `any` in production source code, clean `tsc --noEmit`
- **Build:** Green (Vite production build)

### Completed Tracks
| Track | Items | Status |
|-------|-------|--------|
| A — Component Decomposition | A1 core ✅, A2 core ✅, A3 ✅ | Complete (stretch metrics deferred) |
| B — Code DRY-up | B1–B7 all ✅ | Complete |
| C — UX Improvements | C1–C9 all ✅ | Complete |
| D — Cleanup / Housekeeping | D1–D8 all ✅ | Complete |
| E — Architecture Improvements | E3 ✅ | Partial (E1/E2 deferred to FUTURE_TASKS) |
| F — Feature Ideas | — | Deferred to FUTURE_TASKS |

### Deferred Items → FUTURE_TASKS.md
- A1/A2 stretch metrics (reduce App.tsx to ≤300, AdminPanel.tsx to ≤200)
- E1 (SWR for AdminPanel), E2 (N+1 media fix)
- All Track F feature ideas (drag-drop, bulk ops, clone, search, shortcuts, export/import, analytics)

---

*Document created: February 5, 2026*
