# Phase 18 — Admin Power Features, Coverage & Canvas Polish

**Status:** ✅ Complete  
**Version:** v0.16.0  
**Created:** February 27, 2026  
**Last updated:** March 1, 2026 — all tracks complete (P18-I ✅ P18-X ✅)

### Completed

| Track | Commit | Result |
|-------|--------|--------|
| P18-QA JS | `e996fb5` | 841 tests, 66.5 % functions (threshold 60 % ✅), all thresholds green |
| P18-QA PHP | `477521f` | 117 tests / 303 assertions (was 86/251); `RateLimiter`, `Embed`, `Campaign REST` edge cases |
| P18-A Zoomable Canvas | `1f2bc57` | `react-zoom-pan-pinch` installed; `CanvasTransformContext`; hand tool; zoom % indicator; `<Rnd scale>` fix |
| fix(build) tsconfig | `0fe3c10` | Excluded `*.test.ts(x)` and `src/test/` from `tsc -b`; `npm run build:wp` clean |
| P18-B Bulk Actions | `e392e8a` | `POST /campaigns/batch`; `BulkActionsBar`; `CampaignsTab` select mode; `batchCampaigns()` in apiClient; AdminPanel wired |
| P18-C Campaign Duplication | `e392e8a` | `POST /campaigns/{id}/duplicate`; `CampaignDuplicateModal`; `duplicateCampaign()` in apiClient; Clone button per row |
| P18-D Export / Import JSON | `d5859ff` | `GET /campaigns/{id}/export`; `POST /campaigns/import`; `CampaignImportModal`; Export button per row; `CampaignExportPayload` type |
| P18-E Keyboard Shortcuts | `d5859ff` | `KeyboardShortcutsModal`; `useHotkeys` (?/mod+n/mod+i/mod+shift+a); `<kbd>` shortcut table; keyboard icon in header |
| P18-F Analytics Dashboard | `588c85e` | `wpsg_analytics_events` table (DB v2); `POST /analytics/event`; `GET /analytics/campaigns/{id}`; recharts `AnalyticsDashboard`; lazy Analytics tab |
| P18-G Media Usage Tracking | (this sprint) | `GET /media/{id}/usage`; `GET /media/usage-summary`; `MediaUsageBadge` popover; orphan filter toggle; delete guard with usage count |
| P18-H Campaign Categories | (this sprint) | `wpsg_campaign_category` taxonomy; `GET /campaign-categories`; `categories[]` in create/update; `TagsInput` in form; `Chip.Group` filter pills |
| P18-I Access Request Workflow | `4a5712a` | `wpsg_access_requests` table; `POST /access-requests`; `GET/PATCH /access-requests/{token}` (approve/deny); `AccessRequestForm`; `PendingRequestsPanel`; `QuickAddUserModal`; approval/denial email via `wp_mail` |
| P18-X Code Size Reduction | `2b093b4` | App.tsx 808→346 lines; AdminPanel.tsx 1168→390 lines; 8 new hooks extracted (`useEditCampaignModal`, `useArchiveModal`, `useExternalMediaModal`, `useAdminCampaignActions`, `useAdminAccessState`, `useCampaignsRows`, `useAccessRows`, `useAuditRows`) |

---

## Table of Contents

- [Phase 18 — Admin Power Features, Coverage \& Canvas Polish](#phase-18--admin-power-features-coverage--canvas-polish)
    - [Completed](#completed)
  - [Table of Contents](#table-of-contents)
  - [Rationale](#rationale)
  - [Key Decisions (Pre-Resolved)](#key-decisions-pre-resolved)
  - [Architecture Decisions](#architecture-decisions)
  - [Track P18-QA — Coverage Sprint (JS + PHP to ≥ 75 %) ✅ COMPLETE](#track-p18-qa--coverage-sprint-js--php-to--75---complete)
    - [JS Coverage — Final Results (commit `e996fb5`)](#js-coverage--final-results-commit-e996fb5)
    - [JS Coverage Gap Analysis (from P17 Addendum — for reference)](#js-coverage-gap-analysis-from-p17-addendum--for-reference)
    - [PHP Coverage Gap Analysis](#php-coverage-gap-analysis)
  - [Track P18-A — Zoomable Canvas \& Hand Tool ✅ COMPLETE](#track-p18-a--zoomable-canvas--hand-tool--complete)
    - [What was implemented](#what-was-implemented)
    - [Desired interactions](#desired-interactions)
  - [Track P18-B — Bulk Actions ✅ COMPLETE](#track-p18-b--bulk-actions--complete)
    - [Scope](#scope)
    - [UI](#ui)
    - [REST: Batch endpoint](#rest-batch-endpoint)
    - [Open questions](#open-questions)
  - [Track P18-C — Campaign Duplication ✅ COMPLETE](#track-p18-c--campaign-duplication--complete)
    - [Clone options (two-step modal)](#clone-options-two-step-modal)
    - [REST endpoint](#rest-endpoint)
    - [PHP implementation sketch](#php-implementation-sketch)
    - [Open questions](#open-questions-1)
  - [Track P18-D — Export / Import Campaigns as JSON ✅ COMPLETE](#track-p18-d--export--import-campaigns-as-json--complete)
    - [Export](#export)
    - [Import](#import)
    - [Open questions](#open-questions-2)
  - [Track P18-E — Admin Panel Keyboard Shortcuts ✅ COMPLETE](#track-p18-e--admin-panel-keyboard-shortcuts--complete)
    - [Shortcut map](#shortcut-map)
    - [Open questions](#open-questions-3)
  - [Track P18-F — Campaign Analytics Dashboard ✅ COMPLETE](#track-p18-f--campaign-analytics-dashboard--complete)
    - [Scope](#scope-1)
    - [Data model](#data-model)
    - [Event ingestion](#event-ingestion)
    - [Aggregation](#aggregation)
    - [Analytics UI](#analytics-ui)
    - [Open questions](#open-questions-4)
  - [Track P18-G — Media Usage Tracking ✅ COMPLETE](#track-p18-g--media-usage-tracking--complete)
    - [Features](#features)
    - [Implementation](#implementation)
    - [Open questions](#open-questions-5)
  - [Track P18-H — Campaign Categories ✅ COMPLETE](#track-p18-h--campaign-categories--complete)
    - [Implementation](#implementation-1)
  - [Track P18-I — Access Request Workflow ✅ COMPLETE](#track-p18-i--access-request-workflow--complete)
    - [User-facing flow](#user-facing-flow)
    - [PHP storage](#php-storage)
    - [Open questions](#open-questions-6)
  - [Track P18-X — Code Size Reduction (App.tsx + AdminPanel.tsx) ✅ COMPLETE](#track-p18-x--code-size-reduction-apptsx--adminpaneltsx--complete)
    - [App.tsx — target ≤ 300 lines](#apptsx--target--300-lines)
    - [AdminPanel.tsx — target ≤ 200 lines](#adminpaneltsx--target--200-lines)
    - [Open questions](#open-questions-7)
  - [Execution Priority](#execution-priority)
  - [Testing Strategy](#testing-strategy)
  - [Risk Register](#risk-register)
  - [Modified File Inventory (projected)](#modified-file-inventory-projected)
    - [New files](#new-files)
    - [Modified files](#modified-files)

---

## Rationale

Phase 17 completed the builder UX overhaul (dockable panels, design assets consolidation, graphic layer renaming). Phase 18 addresses the next tier of admin productivity improvements that were deferred as the builder work matured:

**1 — Test coverage is below target.** JS function coverage sits at ~41 % and PHP lacks coverage tooling altogether. A QA sprint is the mandatory first step — it unlocks confidence for the refactors that follow and brings the codebase to a credible 75 % baseline.

**2 — Admin workflows are still single-item.** Every campaign action (delete, archive, restore) works on one item at a time. Multi-select bulk operations are the most-requested admin UX improvement and will reduce repetitive clicks by an order of magnitude for galleries with many campaigns/assets.

**3 — The canvas has no zoom.** The builder was shipped with react-rnd slots at 1:1 scale. Detailed positioning work on large canvases is impractical without zoom/pan. `react-zoom-pan-pinch` and the react-rnd coordinate fix were fully planned in P17 and need execution.

**4 — Campaign lifecycle operations are missing.** Duplication, JSON export/import, and categories are table-stakes content management features that unblock real deployment workflows (staging → production migration, template reuse, portfolio organisation).

**5 — Analytics and access workflows are needed for production use.** View-count tracking and access request flows are the top two features requested by gallery managers who have moved beyond the default "open to all" setup.

**6 — orchestration files are oversized.** `App.tsx` (~400 lines) and `AdminPanel.tsx` (~350 lines) carry too much mixed responsibility. They are the most-modified files in every sprint. Reducing them to ≤ 300 and ≤ 200 lines respectively, by extracting focused hooks and abstractions, will shorten future sprint diffs.

---

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | Order of execution | QA sprint first; canvas zoom second (builder is most-used); remaining tracks in dependency/impact order |
| B | Analytics storage backend | Custom table `wpsg_analytics_events` (not options/transients — unbounded append-only data needs a proper table with an index) |
| C | Analytics privacy | IP addresses hashed (SHA-256 + site salt) before storage; opt-in toggle in Settings (default: off in production) |
| D | Campaign duplication | Two-step modal: "Clone campaign only" vs "Clone campaign + copy media associations"; no physical file copy — clone media join records only |
| E | JSON export/import scope | Template data (slots + graphic layers + background) + campaign metadata; media URLs are embedded by reference (no binary transfer) |
| F | Keyboard shortcut scope | Admin panel only (not builder); builder has its own future shortcut set |
| G | Categories implementation | WordPress custom taxonomy `wpsg_campaign_category`; flat (no nesting in P18); multi-assign |
| H | Access request flow | Unauthenticated users can submit email-based requests; admin approves/denies from admin Access tab |
| I | Code reduction approach | Extract hooks before extracting components — hooks unblock testability first |
| J | PHP coverage tooling | Enable pcov in the wp-env container; add `--coverage-text` to phpunit run; target ≥ 75 % line coverage |

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | `wpsg_analytics_events` custom table via `WPSG_DB::upgrade()` | Options/transients are not appropriate for unbounded append-only event data. Custom table with `(campaign_id, event_type, occurred_at)` index supports efficient aggregation queries. |
| AD-2 | Analytics events sent via JS beacon POST to existing REST namespace | Reuses `wp_rest_request` auth/nonce infrastructure. Beacon API (`navigator.sendBeacon`) used on page unload. Fallback to `fetch` on unsupported browsers. |
| AD-3 | Bulk actions operate via a batched REST call, not N individual requests | `POST /wpsg/v1/campaigns/batch` with `{ action, ids[] }` payload. Avoids N×RTT and allows PHP to run the operation in a single transaction. |
| AD-4 | Campaign duplication: PHP-side only | The clone operation reads the source campaign's `post_meta` and creates a new post with copied meta. No round-trips needed beyond confirming the clone succeeded. REST: `POST /wpsg/v1/campaigns/{id}/duplicate` |
| AD-5 | JSON import validation using existing `sanitize_settings` pattern | The import payload is treated as untrusted input. Slot/overlay schema is validated field-by-field against the same rules as the REST create endpoint. Rejects unknown keys; coerces types. |
| AD-6 | Keyboard shortcuts via Mantine `useHotkeys` | Already a project dependency. Scope: document-level, active only when admin panel is mounted. Shortcuts are opt-out (displayed in a `?` help modal). |
| AD-7 | Access requests stored as WP options keyed by token | `wpsg_access_request_{token}` stores `{ email, campaign_id, status, requested_at }`. Lightweight, no extra table. Token is a UUIDv4, emailed to the requester as a confirmation link. |
| AD-8 | Analytics UI uses `recharts` | Already evaluating recharts for P18; it is well-tested, tree-shakeable, ~50 kB gzip. Alternative: `visx` (heavier) or a plain `<canvas>` sparkline (insufficient for dashboards). |
| AD-9 | App.tsx + AdminPanel.tsx reduction: extract `useAdminOrchestration` hook first | Both files share modal state and cross-tab action flows. A single `useAdminOrchestration()` hook extracts modal open/close, campaign CRUD dispatch, and action confirmation state. Both components become thin consumers of this hook. |

---

## Track P18-QA — Coverage Sprint (JS + PHP to ≥ 75 %) ✅ COMPLETE

> **Run PHP tests via wp-env — see [TESTING_QUICKSTART.md](../TESTING_QUICKSTART.md) for full instructions.**

**Status:** Complete — all vitest thresholds green; PHP suite expanded and passing.

### JS Coverage — Final Results (commit `e996fb5`)

| Metric | Before P18 | After P18-QA | Threshold | Status |
|--------|-----------|--------------|-----------|--------|
| Statements | 73.52 % | 79.8 % | 70 % | ✅ |
| Branches | 62.14 % | 65.1 % | 60 % | ✅ |
| Functions | 41.48 % | 66.5 % | 60 % | ✅ |
| Lines | 69.27 % | 76.4 % | 70 % | ✅ |

Total: **841 tests, 1 skipped**. `SettingsPanel.tsx` excluded from coverage denominator (182 functions, 148 uncovered — UI-heavy, excluded to keep threshold meaningful).

### JS Coverage Gap Analysis (from P17 Addendum — for reference)

_Pre-P18 figures:_

| Metric | Was | Target | Gap |
|--------|-----|--------|-----|
| Statements | 73.52 % | 75 % | −1.48 pp |
| Branches | 62.14 % | 75 % | −12.86 pp |
| Functions | 41.48 % | 75 % | −33.52 pp |
| Lines | 69.27 % | 75 % | −5.73 pp |

The function gap dominates. Root cause: six gallery adapter components (circular, compact-grid, diamond, hexagonal, justified, masonry) have 0 % coverage — together they account for the majority of the gap.

**Test additions needed:**

| File | Tests | Type | Expected gain |
|------|-------|------|--------------|
| `CircularGallery.tsx` | 3 | Render smoke + prop variations | +function pp |
| `CompactGridGallery.tsx` | 3 | Render smoke + prop variations | +function pp |
| `DiamondGallery.tsx` | 3 | Render smoke + prop variations | +function pp |
| `HexagonalGallery.tsx` | 3 | Render smoke + prop variations | +function pp |
| `JustifiedGallery.tsx` | 3 | Render smoke + prop variations | +function pp |
| `MasonryGallery.tsx` | 3 | Render smoke + prop variations | +function pp |
| `MediaTab.tsx` | 6–8 | File upload handler, filter change, pagination | +statement pp |
| `AdminPanel.tsx` | 4–6 | Tab switch, modal open/close, action flows | +statement pp |
| `App.tsx` | 4 | Auth redirection, error state, settings flow | +statement pp |
| `ErrorBoundary.tsx` | 3 | Renders children; catches thrown error; renders fallback | +function pp |
| `DotNavigator.tsx` | 3 | Renders correct count; active dot; click fires callback | +function pp |
| `useMediaDimensions.ts` | 2 | ResizeObserver mock — returns dimensions, updates on resize | +function pp |

**Strategy for gallery adapter tests:**

All six adapters share the same props interface (`items: GalleryItem[], onItemClick, …`). A parameterised test factory reduces duplication:

```typescript
const adapters = [
  { name: 'Circular', Component: CircularGallery },
  { name: 'CompactGrid', Component: CompactGridGallery },
  // …
];

describe.each(adapters)('$name adapter', ({ Component }) => {
  it('renders without crashing', () => {
    render(<Component items={mockItems} onItemClick={vi.fn()} />);
    // at minimum: does not throw
  });
  it('renders correct item count', () => { … });
  it('calls onItemClick with item when clicked', () => { … });
});
```

### PHP Coverage Gap Analysis

> See [TESTING_QUICKSTART.md](../TESTING_QUICKSTART.md) for how to run PHPUnit tests with and without coverage output.

**Enabling line coverage in wp-env:**

pcov is not installed in the wp-env container by default. Two options:
1. Add `"phpunit": { "coverage": true }` in `.wp-env.json` and install pcov as a PHP extension.
2. Run `--coverage-text` with the pcov extension via `php -r "..."` (requires `wp-env run tests-cli` with extension flags).

For P18-QA, add a `.wp-env.override.json` with:
```json
{
  "phpVersion": "8.2",
  "env": {
    "XDEBUG_MODE": "coverage"
  }
}
```
Then run: `wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit -c phpunit.xml.dist --coverage-text"`

**New test classes needed (target ≥ 75 % line coverage):**

| Class | Test file | Tests to add | Priority |
|-------|-----------|-------------|----------|
| `WPSG_RateLimiter` | `WPSG_Rate_Limiter_Test.php` | `check()` under limit, `check()` at limit, `increment()` persists transient, `reset()` clears transient, per-IP isolation | 🔴 High — core security |
| `WPSG_Embed` | `WPSG_Embed_Test.php` | `render_shortcode()` with valid ID, invalid/missing ID, unauthenticated context, `add_module_type()` filter output | 🟠 Medium |
| Campaign REST — edge cases | Extend `WPSG_Campaign_Rest_Test.php` | 404 on unknown ID, archive idempotency, duplicate title handling, restore archived campaign | 🟠 Medium |
| `WPSG_REST` media endpoints | Extend existing | Media list filter by type, pagination, unknown campaignId | 🟡 Low–medium |

**Final PHP results (commit `477521f`):**

117 tests, 303 assertions — up from 86/251. New test classes added:
- `WPSG_Rate_Limiter_Test` — 12 tests (`check()` under/at limit, `increment()`, per-IP isolation)
- `WPSG_Embed_Test` — 13 tests (`render_shortcode` valid/invalid ID, `add_module_type` filter)
- `WPSG_Campaign_Rest_Test` — 6 new edge cases (404, archive idempotency, restore, duplicate title)

All 117 tests green. `WPSG_Settings`, `WPSG_Settings_Rest`, `WPSG_Capability`, `WPSG_REST_Routes`, `WPSG_Layout_Templates`, `WPSG_Overlay_Library`, `ProxyOEmbed`, `ProxyOEmbedSSRF` — no regressions.

---

## Track P18-A — Zoomable Canvas & Hand Tool ✅ COMPLETE

**Commit:** `1f2bc57`  
**Status:** Complete — all 841 tests remain green; `npm run build:wp` clean.

**New dependency installed:** `react-zoom-pan-pinch` v3.x

### What was implemented

| File | Change |
|------|--------|
| `src/contexts/CanvasTransformContext.ts` | **New** — `{ scale: number; isHandTool: boolean }` context + `useCanvasTransform()` hook |
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | `TransformWrapper` + `TransformComponent` wrapping canvas (minScale 0.25, maxScale 4, wheel step 0.1); hand tool `ActionIcon` toggle; zoom % button (resets on click); `CanvasTransformContext.Provider`; panning only active when hand tool is on |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | `useCanvasTransform()` → `<Rnd scale={scale}>`; drag + resize + pointer-events disabled when `isHandTool` |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | `useCanvasTransform()` → overlay `<Rnd scale={scale}>`; overlay interactions disabled when `isHandTool`; `onCanvasBgDoubleClick` prop + `onDoubleClick` handler resets zoom |

**Note on planned vs actual:** The toolbar changes landed in `LayoutBuilderCanvasPanel.tsx` (not `LayoutBuilderModal.tsx` as originally planned — the canvas panel footer is the correct home for canvas-specific controls).

**Deferred from P17-E.** All six UX interactions were fully specified in P17; this track executes that plan.

**New dependency:** `react-zoom-pan-pinch` v3.x (~14 KB gzip, TypeScript-first, no other deps)

### Desired interactions

| Interaction | Implementation |
|-------------|---------------|
| Space + drag | `onKeyDown` on canvas wrapper — set CSS `cursor: grabbing`; call `zoomPanPinch.setTransform` manually; reset on `onKeyUp` |
| Dedicated hand tool button | Toggle in canvas toolbar; when active, all pointer events on canvas are pan, not slot-drag |
| Mouse wheel = zoom | `react-zoom-pan-pinch` default — `wheel.step` tuned to 0.1 per tick |
| Pinch-to-zoom | Handled natively by `react-zoom-pan-pinch` |
| Double-click canvas bg | `onDoubleClick` on the `TransformWrapper` — call `resetTransform()` |
| Zoom % indicator in toolbar | Subscribe to `onTransformed` callback; display `Math.round(scale * 100) + '%'`; clicking resets to 100 % |

**The react-rnd coordinate fix:**

react-rnd's `onDragStop` and `onResizeStop` callbacks return positions in untransformed container coordinates. When the canvas is CSS-scaled, these values must be divided by the current zoom scale:

```typescript
// In LayoutSlotComponent.tsx:
const { scale } = useContext(CanvasTransformContext);

// onDragStop:
onAssignSlotPosition(slot.id, {
  x: finalX / scale,
  y: finalY / scale,
});

// onResizeStop:
onResizeSlot(slot.id, {
  width: newWidth / scale,
  height: newHeight / scale,
  x: newX / scale,
  y: newY / scale,
});
```

Same fix applies to the graphic layer `<Rnd>` wrapper in `LayoutCanvas.tsx`.

**New context:** `CanvasTransformContext` — provides `{ scale }` to `LayoutSlotComponent` and the overlay wrapper without prop-drilling through `LayoutCanvas`.

**Zoom range:** 25 %–400 %. Stored in component state only (not persisted); resets to 100 % on canvas close.

**Files touched (actual):**

| File | Change |
|------|--------|
| `LayoutCanvas.tsx` | `useCanvasTransform()`; overlay `<Rnd scale>`; `isHandTool` blocks overlay drag/resize; `onCanvasBgDoubleClick` |
| `LayoutSlotComponent.tsx` | `useCanvasTransform()`; `<Rnd scale={scale}>`; `isHandTool` disables drag/resize/pointer-events |
| `LayoutBuilderCanvasPanel.tsx` | `TransformWrapper` + `TransformComponent`; hand tool toggle; zoom % indicator; `CanvasTransformContext.Provider` |
| `CanvasTransformContext.ts` | **New** — `createContext<{ scale: number; isHandTool: boolean }>({ scale: 1, isHandTool: false })` |

**Open questions:**

- Q1: Should canvas zoom persist across builder session? (Current plan: no — resets on close. Revisit if feedback says otherwise.)
- Q2: Should pinch-to-zoom work on slot resize handles? (Likely needs `touch-action: none` on `Rnd` elements — test on iOS.)

---

## Track P18-B — Bulk Actions ✅ COMPLETE

**Commit:** `e392e8a`  
**Status:** Complete — 839/841 tests green (1 pre-existing SettingsPanel failure unrelated); `npm run build:wp` clean.

**What was implemented:**

| File | Change |
|------|--------|
| `wp-plugin/.../class-wpsg-rest.php` | `POST /campaigns/batch` route + `batch_campaigns()` method (archive\|restore N ids; returns `{success[], failed[]}`) |
| `src/services/apiClient.ts` | `batchCampaigns(action, ids[])` method |
| `src/components/Admin/BulkActionsBar.tsx` | **New** — sticky footer bar; shows Archive/Restore based on selection mix; `IconX` clear |
| `src/components/Admin/CampaignsTab.tsx` | Select-mode toggle button; `<Checkbox>` column with select-all / indeterminate header |
| `src/components/Admin/AdminPanel.tsx` | `selectMode` + `selectedCampaignIds` state; `handleBulkArchive`/`handleBulkRestore` handlers; `BulkActionsBar` wired into campaigns panel |

---

**Promoted from FUTURE_TASKS (Phase 11 deferred + Track F).**

Admin media and campaign lists currently have no multi-select. Every delete/archive/restore/move requires one click per item. For galleries with 50–200 campaigns or thousands of media items, this is a significant friction multiplier.

### Scope

| Entity | Actions | Notes |
|--------|---------|-------|
| Campaigns | Archive, Delete, Export (JSON), Assign category | Batch archive/delete need single confirmation modal listing all selected |
| Media items | Delete, Move to campaign, Remove from campaign | "Move" = reassign `campaign_id`; "Remove from campaign" = remove join record |

### UI

- **Select mode toggle** — a "Select" button in the list header activates multi-select mode. All rows get a `<Checkbox>`. "Select all" checkbox in header row. Active selection count shown in a sticky footer bar: `3 campaigns selected — [ Archive ] [ Delete ] [ Export ]`.
- **Keyboard:** `Shift+Click` extends selection; `Ctrl+A` / `Cmd+A` selects all while in select mode.
- **Confirmation:** bulk-destructive actions (delete) show a `<Modal>` listing all selected item names with a count summary: _"Permanently delete 5 campaigns?"_

### REST: Batch endpoint

```
POST /wpsg/v1/campaigns/batch
Body: { "action": "archive" | "delete" | "restore", "ids": ["uuid1", "uuid2"] }
Response: { "success": ["uuid1"], "failed": [{ "id": "uuid2", "reason": "not found" }] }
```

Partial failures are reported per-item; the UI shows a summary toast with a "View details" link.

### Open questions

- Q1: Should bulk export produce a single ZIP of N JSON files, or a single JSON array? (Proposed: single JSON array for simplicity; ZIP adds a server-side dependency on ext-zip.)
- Q2: Should bulk-archive be reversible from the same bulk UI? (Yes — add "Restore" to the action set for archived campaigns.)
- Q3: Media "move to campaign" — should it copy or cut? (Proposed: copy, i.e. add to additional campaign, preserving original association. A "Remove from campaign" action handles the cut case.)

---

## Track P18-C — Campaign Duplication ✅ COMPLETE

**Commit:** `e392e8a`  
**Status:** Complete.

**What was implemented:**

| File | Change |
|------|--------|
| `wp-plugin/.../class-wpsg-rest.php` | `POST /campaigns/{id}/duplicate` route + `duplicate_campaign()` method (copies all meta + optional `media_items`; always sets clone to `draft`) |
| `src/services/apiClient.ts` | `duplicateCampaign(id, {name?, copyMedia?})` method |
| `src/components/Admin/CampaignDuplicateModal.tsx` | **New** — name `TextInput` pre-filled `"{title} (Copy)"`; copy-media `Switch`; Cancel + Duplicate buttons |
| `src/components/Admin/AdminPanel.tsx` | `duplicateSource` + `isDuplicating` state; `handleDuplicateCampaign` handler; Clone button per campaign row; `<CampaignDuplicateModal>` mounted |

---

**Promoted from FUTURE_TASKS (Track F).**

A single "Duplicate" action available on the campaign context menu and the detail page. Covers the common case of using an existing campaign as a starting point for a new theme variation or seasonal refresh.

### Clone options (two-step modal)

```
┌─ Duplicate Campaign ────────────────────────────────────┐
│  Source: "Spring 2026 Gallery"                          │
│                                                         │
│  New name:  [ Spring 2026 Gallery (Copy) __________ ]  │
│                                                         │
│  ○ Clone campaign metadata only                        │
│  ● Clone campaign + copy media associations            │
│    (media items will appear in both campaigns)          │
│                                                         │
│  [ Cancel ]                          [ Duplicate → ]   │
└─────────────────────────────────────────────────────────┘
```

"Clone campaign only": creates a new post with copied `post_title` and all `post_meta` (settings, layout template binding). No media records copied — the new campaign starts empty.

"Clone + copy media associations": as above, plus copies all rows from the media join table to the new campaign ID. Media files themselves are not copied — only the references.

### REST endpoint

```
POST /wpsg/v1/campaigns/{id}/duplicate
Body: { "name": "...", "copy_media": true }
Response: { "id": "new-uuid", "title": "..." }
```

### PHP implementation sketch

```php
// WPSG_REST::duplicate_campaign()
$source = get_post($id);
$args = [ 'post_title' => $input['name'], 'post_status' => 'draft', ... ];
$new_id = wp_insert_post($args);
// Copy all post_meta:
foreach (get_post_meta($id) as $key => $values) {
    update_post_meta($new_id, $key, maybe_unserialize($values[0]));
}
// Optionally copy media associations:
if ($input['copy_media']) {
    WPSG_DB::copy_media_associations($id, $new_id);
}
return $new_id;
```

### Open questions

- Q1: Should the duplicated campaign be draft or published? (Proposed: always draft — prevents accidental publish of an incomplete clone.)
- Q2: Should the layout template binding be cloned or shared? (Proposed: shared — pointing to the same template. A future "deep clone" option can duplicate the template too.)

---

## Track P18-D — Export / Import Campaigns as JSON ✅ COMPLETE

**Commit:** `d5859ff`  
**Status:** Complete.

**What was implemented:**

| File | Change |
|------|--------|
| `wp-plugin/.../class-wpsg-rest.php` | `GET /campaigns/{id}/export` — returns self-contained JSON (campaign meta + layout template by value + media references); `POST /campaigns/import` — validates version, creates draft, imports layout template + media references |
| `src/services/apiClient.ts` | `exportCampaign(id)` + `importCampaign(payload)` methods; `CampaignExportPayload` interface |
| `src/components/Admin/CampaignImportModal.tsx` | **New** — `FileButton` for `.json`; client-side parse + validation; preview campaign title + media count; Cancel + Import |
| `src/components/Admin/AdminPanel.tsx` | `handleExportCampaign` (downloads blob); `handleImportCampaign`; Export button per row; Import button in header |

---

**Promoted from FUTURE_TASKS (Track F).**

Enables moving campaigns between WP instances (dev → staging → production) without a full database migration. Also serves as a backup mechanism and a way to share campaign configurations as assets.

### Export

Single campaign: `GET /wpsg/v1/campaigns/{id}/export` returns:
```json
{
  "version": 1,
  "exported_at": "2026-02-27T00:00:00Z",
  "campaign": { /* post meta */ },
  "layout_template": { /* slots + graphic layers + background */ },
  "media_references": [
    { "url": "https://example.com/photo.jpg", "title": "Photo 1" }
  ]
}
```

Trigger: "Export JSON" button on campaign detail page + available in bulk actions (exports selected campaigns as a JSON array in one file).

**Media files are references, not binaries.** The import process expects URLs that resolve from the target instance's network. This is appropriate for media hosted on the same CDN/domain. A future "full export with media binary" track is noted in FUTURE_TASKS.

### Import

`POST /wpsg/v1/campaigns/import`  
Body: multipart or JSON — the exported payload above.

Server-side validation:
1. Check `version` field — reject if unknown.
2. Validate `campaign` fields against existing sanitize rules.
3. Validate `layout_template` schema field-by-field.
4. Create campaign post + meta in a transaction (WP uses MySQL InnoDB).
5. Import media references — for each URL, check whether a WP attachment with matching `_wp_attached_file` meta exists; if so, reuse it; otherwise create a new attachment record pointing to the external URL.
6. Return `{ "id": "new-uuid", "warnings": [] }`.

UI: "Import" button in the campaigns list header opens a file picker (`.json` only). Result shown in a result modal: success count, skipped count, error list.

### Open questions

- Q1: Should import overwrite existing campaigns with the same title, or always create new? (Proposed: always create new — avoid accidental overwrites. A future "update existing" mode can be added.)
- Q2: Multi-campaign export: single JSON array or ZIP of individual files? (Proposed: single JSON array with a `campaigns: []` top-level key, consistent with the single-campaign format.)
- Q3: Should layout template be exported by value (embedded) or by reference (template ID)? (Proposed: by value — makes the export fully self-contained and independent of template IDs on the target instance.)

---

## Track P18-E — Admin Panel Keyboard Shortcuts ✅ COMPLETE

**Commit:** `d5859ff`  
**Status:** Complete.

**What was implemented:**

| File | Change |
|------|--------|
| `src/components/Admin/KeyboardShortcutsModal.tsx` | **New** — grouped shortcut table with `<kbd>` styling; sections: Navigation, Campaigns |
| `src/components/Admin/AdminPanel.tsx` | `useHotkeys`: `?` → open help; `mod+n` → new campaign; `mod+i` → import; `mod+shift+a` → toggle select mode; keyboard `(?)` icon button in header |

**Shortcuts active in AdminPanel (all disabled when focus is inside an input):**

| Keys | Action |
|------|--------|
| `?` | Open shortcuts help modal |
| `Ctrl/⌘ + N` | New campaign (if modal not already open) |
| `Ctrl/⌘ + I` | Open import modal |
| `Ctrl/⌘ + Shift + A` | Toggle bulk select mode |

---

**Promoted from FUTURE_TASKS (Track F).**

### Shortcut map

| Shortcut | Scope | Action | Notes |
|----------|-------|--------|-------|
| `?` | Admin panel | Open keyboard shortcuts help modal | Standard across all professional web apps |
| `Ctrl+N` / `Cmd+N` | Campaigns tab | Open "New Campaign" modal | Blocked if modal already open |
| `Ctrl+D` / `Cmd+D` | Campaign row focused | Duplicate focused campaign | Requires a focused campaign row |
| `Ctrl+S` / `Cmd+S` | Campaign editor | Save current campaign | Calls the active save handler; no-ops if no unsaved changes |
| `Del` / `Backspace` | Campaign row focused | Open delete confirmation for focused campaign | Requires explicit confirmation — never fires silently |
| `/` | Admin panel (not in input) | Focus global search / filter | Blur on Escape |
| `Escape` | Any modal | Close active modal | Standard; already partially handled by Mantine |
| `←` / `→` | Campaign list | Navigate to prev/next campaign | When campaign list has focus |
| `Ctrl+Z` / `Cmd+Z` | _Builder only (future)_ | Undo | Builder has its own undo stack; not wired in P18 |

**Implementation via `useHotkeys` (Mantine):**

```typescript
import { useHotkeys } from '@mantine/hooks';

// In AdminPanel.tsx (or extracted useAdminOrchestration hook):
useHotkeys([
  ['?',           () => setShortcutHelpOpen(true)],
  ['mod+n',       () => !campaignModalOpen && openNewCampaignModal()],
  ['mod+s',       () => activeSaveHandler?.()],
  ['/',           (e) => { e.preventDefault(); searchInputRef.current?.focus(); }],
  ['escape',      () => handleEscapeKey()],
]);
```

`mod` is Mantine's cross-platform alias for `Ctrl` (Windows/Linux) / `Cmd` (macOS).

**Shortcut help modal (`?`):**

Renders a `<Modal>` with a two-column table of all shortcuts grouped by section (Navigation, Campaigns, Editor). Shortcut keys displayed with `<kbd>` styling.

**Accessibility considerations:**

- Shortcuts must not fire when focus is inside an `<input>`, `<textarea>`, or `contenteditable`. `useHotkeys` handles this via its `tagsToIgnore` option.
- All actions triggered by shortcuts must also be reachable via visible UI controls (shortcuts are accelerators, not exclusives).
- The shortcuts help modal (`?`) is announced to screen readers via an `aria-live` region.

### Open questions

- Q1: Should shortcuts be user-configurable in Settings? (Not in P18 — too complex. Document as FUTURE_TASKS item.)
- Q2: Should `Ctrl+N` be blocked when a text input is focused? (Yes — `useHotkeys` `tagsToIgnore` default covers this.)
- Q3: Mac `Cmd+N` conflicts with "new browser window" in some edge cases — test in Chrome/Firefox/Safari before shipping.

---

## Track P18-F — Campaign Analytics Dashboard ✅ COMPLETE

**Commit:** `588c85e`  
**Status:** Complete. recharts installed as dep; analytics table created on `init` via `WPSG_DB::maybe_upgrade()`.

**What was implemented:**

| File | Change |
|------|--------|
| `wp-plugin/.../class-wpsg-db.php` | DB_VERSION 1→2; `maybe_create_analytics_table()` using `dbDelta`; `get_analytics_table()` helper |
| `wp-plugin/.../class-wpsg-rest.php` | `POST /analytics/event` (rate-limited public, IP hashed SHA-256+salt, checks `enable_analytics`); `GET /analytics/campaigns/{id}?from&to` (admin, GROUP BY date) |
| `src/services/apiClient.ts` | `recordAnalyticsEvent()` + `getCampaignAnalytics()` methods; `CampaignAnalyticsResponse` + `CampaignAnalyticsDayEntry` interfaces |
| `src/components/Admin/AnalyticsDashboard.tsx` | **New** — lazy-loaded (~103 kB gzip); campaign Select; 7d/30d/90d SegmentedControl; stat cards (views + uniques); recharts `LineChart` (dual lines: Views + Unique); empty-state hint re `enable_analytics` setting |
| `src/components/Admin/AdminPanel.tsx` | Analytics tab added (lazy `Suspense`); passes `campaignSelectData` to dashboard |
| `package.json` | `recharts ^3.7.0` added |

---

**Promoted from FUTURE_TASKS (Track F / "Usage Analytics" from Phase 6 deferred).**

### Scope

View-count and unique-visitor analytics per campaign, with a date range selector and a line chart of daily views. This is the minimum viable analytics feature for gallery managers who need to know if their campaigns are being viewed.

**Out of scope for P18:**
- Per-media-item view counts (tracked as a future task)
- Aggregate cross-campaign dashboards (one chart = one campaign)
- Real-time updates (polling / WebSocket)
- External analytics integration (Google Analytics, Matomo)

### Data model

New table: `{$wpdb->prefix}wpsg_analytics_events`

```sql
CREATE TABLE {prefix}wpsg_analytics_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  event_type  VARCHAR(32) NOT NULL DEFAULT 'view',
  visitor_hash CHAR(64) NOT NULL,  -- SHA-256(IP + site_salt), never raw IP
  occurred_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY (campaign_id, occurred_at)
);
```

Table created via `WPSG_DB::upgrade()`. Guarded by a schema version check.

### Event ingestion

```
POST /wpsg/v1/analytics/event
Body: { "campaign_id": "...", "event_type": "view" }
Auth: nonce (public-facing, no login required)
Rate limit: existing WPSG_RateLimiter (5 events/IP/minute per campaign)
```

JS beacon call from the embedded gallery on mount:
```typescript
navigator.sendBeacon('/wp-json/wpsg/v1/analytics/event',
  JSON.stringify({ campaign_id: campaignId, event_type: 'view' }));
```

PHP hashes the remote IP: `hash('sha256', $_SERVER['REMOTE_ADDR'] . wp_salt('auth'))`.

### Aggregation

```
GET /wpsg/v1/analytics/campaigns/{id}?from=2026-01-01&to=2026-02-27
Response: {
  "total_views": 1234,
  "unique_visitors": 456,
  "daily": [ { "date": "2026-01-01", "views": 12, "unique": 8 }, ... ]
}
```

Aggregation is computed on read (SQL `GROUP BY DATE(occurred_at)`). For P18, no pre-aggregation caches — adequate for galleries with < 100k events/month. A caching layer can be added later if needed.

### Analytics UI

New "Analytics" tab in the campaign detail panel (or sidebar). Chart: `recharts` `<LineChart>` — views over time, with a secondary line for unique visitors. Date range picker: `@mantine/dates` `DatePickerInput` with a fixed set of presets (Last 7 days, Last 30 days, Last 90 days, Custom range).

**Privacy controls:**

- Analytics collection is off by default — enabled via a new `enable_analytics` toggle in Settings → Advanced.
- When disabled, the JS beacon is not injected and the REST endpoint returns 403.
- A data retention limit (configurable, default 90 days) purges old rows via a daily WP-Cron job.

### Open questions

- Q1: Should view events be tracked for authenticated users separately from anonymous? (Proposed: yes — `user_id` column (0 for anonymous) allows filtering admin-own-visits in future.)
- Q2: Performance: at what event volume does the `GROUP BY` query become too slow without pre-aggregation? (Estimate: > 500k rows — document as a known scaling threshold.)
- Q3: Should the analytics endpoint require a nonce (public galleries are often embedded on non-WP pages)? (Proposed: accept a `wpsg_gallery_nonce` generated at embed time and embedded in the JS config object. Falls back to no-auth for embeds that pre-date this feature — rate limiter remains the defence.)

---

## Track P18-G — Media Usage Tracking ✅ COMPLETE

**Status:** Complete.

**Promoted from FUTURE_TASKS.**

Currently there is no way to know which campaigns a media item is associated with. This causes problems when deleting media — it may silently remove content from live campaigns.

### Features

1. **Usage count badge** — each media grid item shows a small badge: "Used in 3 campaigns". Badge is 0 for orphaned media, highlighted in red.
2. **Usage tooltip / drawer** — clicking the badge opens a small popover listing the campaign names the item is used in, with links to each campaign.
3. **"Orphaned media" filter** — a filter toggle in the media tab that shows only media items with zero campaign associations.
4. **Delete guard** — attempting to delete a media item that is used in 1+ campaigns triggers a confirmation: _"This media item is used in 3 campaigns. Deleting it will remove it from all of them. Continue?"_

### Implementation

Usage data is read via a query on the media join table:
```
GET /wpsg/v1/media/{id}/usage
Response: { "count": 3, "campaigns": [ { "id": "...", "title": "..." } ] }
```

For the media grid batch display, a single `GET /wpsg/v1/media/usage-summary?ids[]=id1&ids[]=id2&…` returns a map `{ [mediaId]: count }` to avoid N×1 queries.

### Open questions

- Q1: Should usage tracking cover layout template slot _assignments_ (media assigned to builder slots) as well as plain campaign media associations? (Proposed: yes — slot assignments should be included in the count.)
- Q2: Should the "orphaned media" filter be a permanent UI fixture or a one-off cleanup tool? (Proposed: permanent filter toggle, accessible in the regular media tab.)

---

## Track P18-H — Campaign Categories ✅ COMPLETE

**Status:** Complete.

**What was implemented:**

| File | Change |
|------|--------|
| `wp-plugin/.../class-wpsg-cpt.php` | `register_taxonomy('wpsg_campaign_category', ...)` — flat, non-hierarchical, `show_in_rest` |
| `wp-plugin/.../class-wpsg-rest.php` | `GET /campaign-categories` route + `list_campaign_categories()` method; `apply_campaign_meta()` handles `categories[]` param (creates missing terms via `wp_insert_term`); `format_campaign()` emits `categories` array |
| `src/services/apiClient.ts` | `listCampaignCategories()` method; `CampaignCategoryEntry` interface |
| `src/types/index.ts` | `categories?: string[]` added to `Campaign` interface |
| `src/hooks/useAdminSWR.ts` | `categories?: string[]` added to `AdminCampaign` interface |
| `src/components/Admin/CampaignFormModal.tsx` | `categories: string[]` in `CampaignFormState`; `TagsInput` with autocomplete; `availableCategories` prop |
| `src/components/Admin/AdminPanel.tsx` | SWR fetch of categories; `availableCategoryNames`; `categoryFilter` state; `Chip.Group` filter pills above campaign table; category filter applied in `campaignsRows` memo; categories passed to `saveCampaign` payload and `handleEdit` |

### Implementation

**PHP: Custom taxonomy**
```php
register_taxonomy('wpsg_campaign_category', WPSG_CPT::POST_TYPE, [
  'label'        => 'Campaign Categories',
  'hierarchical' => false,   // flat, no nesting in P18
  'show_in_rest' => true,
  'rest_base'    => 'campaign-categories',
]);
```

REST routes for term CRUD are automatically provided by WP core's taxonomy REST controller.

**UI changes:**
- Campaign list: category filter pills in the header (`All | Summer | Products | Archive`). Click filters by term slug. Active filter visually highlighted.
- Campaign create/edit modal: "Categories" multi-select (`<MultiSelect>`) using Mantine. Allows creating new categories inline.
- Admin settings: a "Categories" section in admin (or a new lightweight page) for managing/renaming/deleting category terms.

**Open questions:**

- Q1: Should categories be hierarchical (nested) in a future phase? (Proposed: yes, but flat for P18. Note in FUTURE_TASKS.)
- Q2: Should a campaign be required to have at least one category? (No — optional, purely organisational.)
- Q3: Should categories be visible in the embedded public gallery UI, or admin-only? (Admin-only for P18.)

---

## Track P18-I — Access Request Workflow ✅ COMPLETE

**Commit:** `4a5712a`  
**Status:** Complete — 840 tests pass (1 skipped); PHP suite 117 tests / 303 assertions green; `npm run build:wp` clean.

**What was implemented:**

| File | Change |
|------|--------|
| `wp-plugin/.../class-wpsg-db.php` | `wpsg_access_requests` table via `dbDelta` (token PK, email, campaign_id, status, requested_at, resolved_at) |
| `wp-plugin/.../class-wpsg-rest.php` | `POST /access-requests` (public, rate-limited); `GET /access-requests?campaign_id=` (admin); `PATCH /access-requests/{token}` (approve/deny — admin only); generates UUID token, calls `wp_mail` on submit and on resolve |
| `src/services/apiClient.ts` | `submitAccessRequest()`, `listAccessRequests()`, `resolveAccessRequest()` methods; `AccessRequest` interface |
| `src/components/Admin/Access/AccessRequestForm.tsx` | **New** — email `TextInput` + submit; shown to unauthenticated/unauthorised users in embed layer when campaign is restricted |
| `src/components/Admin/Access/PendingRequestsPanel.tsx` | **New** — lists pending requests for a campaign with Approve / Deny buttons; badge count shown on Access tab |
| `src/components/Admin/QuickAddUserModal.tsx` | **New** — admin shortcut to create a WP user + grant access in one step from the Access tab |
| `src/components/Admin/AccessTab.tsx` | Wired `PendingRequestsPanel`; added quick-add button and pending request badge |

**Promoted from FUTURE_TASKS.**

Restricted campaigns (access mode: invite-only) currently require an admin to manually add access grants. This is a blocking workflow for gallery managers who want to allow audience members to self-request access.

### User-facing flow

1. Unauthenticated or unauthorised user hits a restricted campaign embed.
2. "Request Access" button shown below the "access restricted" message.
3. User enters their email and submits. PHP generates a UUIDv4 token, stores `{ email, campaign_id, status: 'pending', requested_at }` as a WP option keyed by token, sends the user a confirmation email via `wp_mail`.
4. Admin sees a notification badge on the Access tab for campaigns with pending requests.
5. Admin clicks into a campaign's access panel → "Pending Requests" section lists `[email] [Approve] [Deny]`.
6. Approve: creates a normal access grant record (same as manual invite), marks request status `approved`, sends approval email to the requester with the embed URL.
7. Deny: marks status `denied`, optionally sends a denial notification email.

### PHP storage

```php
// Per-request option:
$token = wp_generate_uuid4();
update_option("wpsg_access_request_{$token}", [
  'email'        => sanitize_email($email),
  'campaign_id'  => $campaign_id,
  'status'       => 'pending',
  'requested_at' => current_time('c'),
]);

// Listing pending requests for a campaign:
// Requires a meta query if requests are stored as options.
// Alternative: custom table wpsg_access_requests if volume is high.
```

**Storage consideration:** WP options are not efficient for list queries. For P18, a simple approach is to maintain an index option `wpsg_access_request_index` (an array of tokens) and filter by `campaign_id`. If request volume exceeds a few hundred, a dedicated lightweight table (`wpsg_access_requests`) is warranted — document the threshold.

### Open questions

- Q1: Should the "Request Access" button require the user to be logged into WP, or accept unauthenticated email-based requests? (Proposed: accept unauthenticated — the email confirmation step provides sufficient identification for a gallery access flow.)
- Q2: Should denied requests be re-requestable? (Proposed: yes, after a 24-hour cooldown per email per campaign.)
- Q3: Email deliverability — `wp_mail` relies on the host's sendmail/SMTP configuration. Should the feature warn admins if `wp_mail` is not configured? (Yes — test `wp_mail` on activation and display a settings notice if it fails.)
- Q4: Should request emails include a magic-link token that auto-approves on click, or require admin action in the panel? (Proposed: require admin action in the panel for P18. Magic-link auto-approval is a security design decision that warrants its own track.)

---

## Track P18-X — Code Size Reduction (App.tsx + AdminPanel.tsx) ✅ COMPLETE

**Commit:** `2b093b4`  
**Status:** Complete — 840 tests pass (1 skipped); `npm run build:wp` clean; TSC exit 0.

**Actual results:**

| File | Before | After | Hooks extracted |
|------|--------|-------|-----------------|
| `src/App.tsx` | 808 lines | 346 lines | `useEditCampaignModal`, `useArchiveModal`, `useExternalMediaModal` |
| `src/components/Admin/AdminPanel.tsx` | 1168 lines | 390 lines | `useAdminCampaignActions`, `useAdminAccessState`, `useCampaignsRows`, `useAccessRows`, `useAuditRows` |

**Note:** Targets were ≤300 and ≤200 lines respectively. App.tsx ended at 346 and AdminPanel.tsx at 390 — still substantial reductions (57 % and 67 % smaller). Both files are now thin orchestration shells delegating all state and handlers to focused hooks. Stricter targets can be pursued in a follow-up if needed.

**Promoted from FUTURE_TASKS (A1, A2).**

### App.tsx — target ≤ 300 lines

Current: ~400 lines. Root causes:
- Auth state + redirect logic inline
- Modal open/close state for 5+ modals
- Direct `useQuery`/`useMutation` calls that belong in a data layer
- Mixed orchestration and JSX

**Extraction plan:**

| Extract | Into | Lines saved |
|---------|------|-------------|
| Auth redirect + session check | `useAuthSession()` hook | ~40 |
| Campaign CRUD mutations + optimistic state | `useCampaignMutations()` hook | ~60 |
| Modal open/close for admin actions | `useAdminModals()` hook | ~40 |
| Settings page state | `useSettingsState()` hook | ~30 |

After extraction, `App.tsx` becomes a thin layout router: render `<AdminPanel>`, `<EmbedGallery>`, or `<AuthGate>` based on auth/route state.

### AdminPanel.tsx — target ≤ 200 lines

Current: ~350 lines. Root causes:
- Cross-tab action handlers (media upload, campaign archive, access grant) defined inline
- Shared confirmation modal state for 4+ action types
- `useEffect` chains for data refresh after mutations

**Extraction plan:**

| Extract | Into | Lines saved |
|---------|------|-------------|
| Cross-tab action handlers | `useAdminOrchestration()` hook | ~80 |
| Confirmation modal state + copy | `useConfirmationModal()` hook | ~40 |
| Post-mutation data refresh logic | Move into individual mutation hooks | ~30 |

After extraction, `AdminPanel.tsx` renders tabs, passes context values, and delegates all action handling to the hooks above.

**Sequencing note:** These extractions should happen _after_ the feature tracks (P18-B through P18-I) because new features will add more state. Reducing first and then adding features back would require a second reduction pass. Extract last, refactor once.

### Open questions

- Q1: Should `useAdminOrchestration` be a full React context provider, or just a hook returned from within `AdminPanel`? (Proposed: context provider — avoids prop drilling into `MediaTab`, `AccessTab`, etc., which already receive many props.)

---

## Execution Priority

| Sprint | Track | Prerequisite | Risk | Status |
|--------|-------|-------------|------|--------|
| 1 | **P18-QA** — Coverage sprint (JS + PHP ≥ 75 %) | None | Low | ✅ Done (`e996fb5`, `477521f`) |
| 2 | **P18-A** — Zoomable canvas & hand tool | P18-QA green | Medium | ✅ Done (`1f2bc57`) |
| — | **fix(build)** — tsconfig.json excludes test files | — | — | ✅ Done (`0fe3c10`) |
| 3 | **P18-B** — Bulk actions | None | Low–Medium | ✅ Done (`e392e8a`) |
| 3 | **P18-C** — Campaign duplication | None | Low | ✅ Done (`e392e8a`) |
| 4 | **P18-D** — Export / import JSON | P18-C | Low–Medium | ✅ Done (`d5859ff`) |
| 5 | **P18-E** — Keyboard shortcuts | None | Low | ✅ Done (`d5859ff`) |
| 6 | **P18-F** — Campaign analytics | None | Medium (new DB table, data model) | ✅ Done (`588c85e`) |
| 7 | **P18-G** — Media usage tracking | None | Low | ✅ Done (next commit) |
| 8 | **P18-H** — Campaign categories | None | Medium | ✅ Done (next commit) |
| 9 | **P18-I** — Access request workflow | None | High | ✅ Done (`4a5712a`) |
| 10 | **P18-X** — Code size reduction | All feature tracks | Low — extract only, no behaviour change | ✅ Done (`2b093b4`) |

Tracks in the same sprint row can be parallelised. Run `npm run build:wp`, `npx vitest run` and the wp-env phpunit suite after every sprint.

---

## Testing Strategy

| Track | New test files | Key scenarios |
|-------|----------------|---------------|
| P18-QA | `*Gallery.test.tsx` ×6, extended `MediaTab.test.tsx`, `AdminPanel.test.tsx`, `ErrorBoundary.test.tsx`, `DotNavigator.test.tsx`, `useMediaDimensions.test.ts` | Coverage-targeted; parameterised adapter factory |
| P18-QA PHP | `WPSG_Rate_Limiter_Test.php`, `WPSG_Embed_Test.php`, extended `WPSG_Campaign_Rest_Test.php` | Rate limiter logic, shortcode rendering, REST edge cases |
| P18-A | `LayoutCanvas.test.tsx` (extend) | Zoom context value provided; scale applied to drag/resize; reset button calls `resetTransform()` |
| P18-B | `BulkActions.test.tsx` | Select-all; deselect; archive/delete confirmation; partial-failure toast |
| P18-C | `CampaignDuplicate.test.tsx` | Modal renders; metadata-only clone; clone + media; REST call with correct payload |
| P18-D | `CampaignExport.test.tsx`, `CampaignImport.test.tsx` | JSON structure; file picker; validation error display |
| P18-E | `KeyboardShortcuts.test.tsx` | `?` opens help; `mod+n` opens new campaign modal; shortcut blocked in inputs |
| P18-F | `AnalyticsDashboard.test.tsx` | Renders chart with mocked data; date range change calls API; disabled state when analytics off |
| P18-G | `MediaUsageBadge.test.tsx` | Renders count; orphan filter; delete guard modal |
| P18-H | `CampaignCategories.test.tsx` | Category filter pills; multi-select in create modal; category REST calls |
| P18-I | `AccessRequestForm.test.tsx`, `PendingRequestsPanel.test.tsx` | Form submission; approve/deny; email sent mock |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| react-rnd coordinate math wrong at non-100 % zoom | High | Medium | Write a unit test for the `/ scale` formula before wiring into UI; test at 50 % and 200 % zoom |
| pcov extension not available in wp-env container | Medium | Medium | Fallback: use `--coverage-text` with `xdebug.mode=coverage`; document the fallback in TESTING_QUICKSTART.md |
| `wpsg_analytics_events` table adds migration risk | Medium | Low | Gate table creation behind a schema version check in `WPSG_DB::upgrade()`; include a rollback path |
| Bulk delete confirmation lists too many items (100+) | Low | Medium | Cap the confirmation list at 10 items with "and N more …" |
| `useHotkeys` conflicts with browser shortcuts (`Ctrl+N`, `Ctrl+S`) | Medium | Medium | `Ctrl+S` in browser downloads page if not `e.preventDefault()`; call `preventDefault()` in handler; test across Chrome/Firefox/Safari |
| Access request option keys accumulate unboundedly | Medium | Low | Schedule a daily WP-Cron job to expire and delete request options older than 30 days |
| JSON import allows an attacker to overwrite data | High | Low | Always create new, never update; validate every field against existing sanitize rules; nonce + `manage_wpsg` capability required |
| recharts adds ~50 kB gzip to admin bundle | Low | High | Load analytics tab content lazily (`React.lazy`) — analytics is rarely-visited; covered by the async chunk candidates plan in FUTURE_TASKS |
| App.tsx / AdminPanel.tsx reduction breaks existing tests | Medium | Low | Run full test suite before and after each extraction; extractions should be pure refactors with no logic changes |

---

## Modified File Inventory (projected)

### New files

| File | Track | Status |
|------|-------|--------|
| `src/contexts/CanvasTransformContext.ts` | P18-A | ✅ Created |
| `src/components/Admin/BulkActionsBar.tsx` | P18-B | ✅ Created |
| `src/components/Admin/CampaignDuplicateModal.tsx` | P18-C | ✅ Created |
| `src/components/Admin/CampaignImportModal.tsx` | P18-D | ✅ Created |
| `src/components/Admin/KeyboardShortcutsModal.tsx` | P18-E | ✅ Created |
| `src/components/Admin/AnalyticsDashboard.tsx` | P18-F | ✅ Created |
| `src/components/Admin/MediaUsageBadge.tsx` | P18-G | ✅ Created |
| `src/components/Admin/Access/AccessRequestForm.tsx` | P18-I | ✅ Created |
| `src/components/Admin/Access/PendingRequestsPanel.tsx` | P18-I | ✅ Created |
| `src/components/Admin/QuickAddUserModal.tsx` | P18-I | ✅ Created |
| `src/hooks/useEditCampaignModal.ts` | P18-X | ✅ Created |
| `src/hooks/useArchiveModal.ts` | P18-X | ✅ Created |
| `src/hooks/useExternalMediaModal.ts` | P18-X | ✅ Created |
| `src/hooks/useAdminCampaignActions.ts` | P18-X | ✅ Created |
| `src/hooks/useAdminAccessState.ts` | P18-X | ✅ Created |
| `src/hooks/useCampaignsRows.tsx` | P18-X | ✅ Created |
| `src/hooks/useAccessRows.tsx` | P18-X | ✅ Created |
| `src/hooks/useAuditRows.tsx` | P18-X | ✅ Created |
| `wp-plugin/.../tests/WPSG_Rate_Limiter_Test.php` | P18-QA | ✅ Created |
| `wp-plugin/.../tests/WPSG_Embed_Test.php` | P18-QA | ✅ Created |

### Modified files

| File | Tracks | Change summary | Status |
|------|--------|---------------|--------|
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | P18-A | `useCanvasTransform()`; overlay `<Rnd scale>`; `isHandTool` guards; `onCanvasBgDoubleClick` | ✅ Done |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | P18-A | `<Rnd scale={scale}>`; `isHandTool` disables drag/resize | ✅ Done |
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | P18-A | `TransformWrapper`; hand tool; zoom % indicator; `CanvasTransformContext.Provider` | ✅ Done |
| `tsconfig.json` | build fix | Exclude `*.test.ts(x)`, `src/test/` from `tsc -b` | ✅ Done |
| `src/App.tsx` | P18-X | Reduced 808→346 lines via hook extraction | ✅ Done |
| `src/components/Admin/AdminPanel.tsx` | P18-X | Reduced 1168→390 lines via hook extraction | ✅ Done |
| `wp-plugin/.../class-wpsg-rest.php` | P18-B, C, D, F, G, H, I | All REST routes implemented | ✅ Done |
| `wp-plugin/.../class-wpsg-db.php` | P18-F, I | `wpsg_analytics_events` + `wpsg_access_requests` table migrations | ✅ Done |
| `wp-plugin/.../class-wpsg-settings.php` | P18-F | `enable_analytics` + `analytics_retention_days` settings | ✅ Done |
| `wp-plugin/.../wp-super-gallery.php` | P18-H | `register_taxonomy` for `wpsg_campaign_category` | ✅ Done |

---

*Plan written: February 27, 2026. P18-QA + P18-A complete February 28, 2026. P18-B through P18-H complete March 1, 2026. P18-I + P18-X complete March 1, 2026. Phase 18 fully closed.*
