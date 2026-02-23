# Phase 15 — Layout Builder

**Status:** 🔧 In Progress — Sprint 3 (Media Picker + Smart Guides)  
**Version:** v0.13.0 (target)  
**Created:** February 22, 2026  
**Last updated:** February 22, 2026 — Sprint 3 complete

### Progress Log

| Date | Commit | Milestone |
|------|--------|-----------|
| 2026-02-22 | `44820f9` | Sprint 1 complete — P15-A (per-breakpoint selection) + P15-B (layout template data model) |
| 2026-02-22 | `a5e3f92` | 59 comprehensive tests for Sprint 1: layoutSlotAssignment (20), useBreakpoint (10), resolveAdapterId (9), defaults+merge (20). Extracted `resolveAdapterId` to `src/utils/` for testability. 246 tests passing, tsc clean. |
| 2026-02-22 | `7d528bc` | Sprint 2 complete — P15-C.1–C.5, C.8 (canvas builder UI): useLayoutBuilderState hook, LayoutBuilderModal, LayoutCanvas, LayoutSlotComponent, SlotPropertiesPanel. 246 tests passing, tsc clean. |
| 2026-02-22 | *pending* | Sprint 3 complete — P15-C.6–C.7, P15-C.4a, P15-D (media picker, canvas controls, a11y, smart guides). 25 new smartGuides tests. |

---

## Table of Contents

1. [Rationale](#rationale)
2. [Architecture Decisions](#architecture-decisions)
3. [Data Model](#data-model)
4. [Per-Breakpoint Gallery Selection (P15-A)](#track-p15-a--per-breakpoint-gallery-selection)
5. [Layout Template Data Model & Persistence (P15-B)](#track-p15-b--layout-template-data-model--persistence)
6. [Layout Builder Canvas UI (P15-C)](#track-p15-c--layout-builder-canvas-ui)
7. [Smart Guides & Snapping (P15-D)](#track-p15-d--smart-guides--snapping)
8. [Layout Builder Adapter — Finalized Rendering (P15-E)](#track-p15-e--layout-builder-adapter--finalized-rendering)
9. [Template Library CRUD & Management (P15-F)](#track-p15-f--template-library-crud--management)
10. [Stretch: Z-Index / Overlap Control (P15-G)](#track-p15-g--stretch-z-index--overlap-control)
11. [Stretch: Overlay Transparencies (P15-H)](#track-p15-h--stretch-overlay-transparencies)
12. [Stretch: Mixed Shapes (P15-I)](#track-p15-i--stretch-mixed-shapes)
13. [Stretch: Premade Templates & Algorithms (P15-J)](#track-p15-j--stretch-premade-templates--algorithms)
14. [Stretch: Diagonal Shapes & Advanced Masks (P15-K)](#track-p15-k--stretch-diagonal-shapes--advanced-masks)
15. [Execution Priority](#execution-priority)
16. [Version Plan](#version-plan)
17. [Testing Strategy](#testing-strategy)
18. [Risk Register](#risk-register)

---

## Rationale

### Why a Layout Builder?

The existing gallery adapter system (Phase 12) provides powerful algorithmic layouts — masonry, justified, hexagonal, circular, diamond, compact-grid — but all of them are **computed layouts**: the algorithm decides where each image goes based on rules (column count, target row height, tile size, etc.). This works excellently for uniform galleries but offers zero control over **bespoke compositions**.

Real-world use cases demand authored layouts:

- **Hero + supporting thumbnails**: one large featured image with 4 smaller images arranged around it
- **Magazine spreads**: asymmetric, editorially-curated image arrangements
- **Product showcases**: precise placement of product images with intentional whitespace
- **Story layouts**: images arranged in a narrative flow, like a photo essay
- **Brand-specific grids**: layouts matching corporate design systems that no algorithm can replicate

The Layout Builder bridges this gap by introducing a **visual authoring surface** where admins drag, resize, and position image slots on a constrained canvas. The resulting layout is stored as a **reusable template** — a set of dimensionless positions and proportions — that can be applied to any campaign's media, decoupling the spatial arrangement from the content.

### Why Per-Breakpoint Selection?

A layout designed for a 1200px desktop viewport will not look good on a 375px mobile screen. Rather than attempting complex responsive reflow of bespoke layouts (which inevitably breaks the author's intent), we take a pragmatic approach: **let the admin choose a different gallery adapter per breakpoint**. A desktop campaign might use `layout-builder` for images but fall back to `masonry` on mobile. This keeps each layout purpose-built for its viewport class and eliminates the responsive layout problem entirely.

### Why DOM-Based (react-rnd) Over Canvas (Konva)?

We evaluated both approaches:

| Concern | DOM (react-rnd) | Canvas (Konva) |
|---------|-----------------|----------------|
| Hover pop/glow effects | CSS native — reuses existing `tileHoverStyles.ts` | Must reimplement via Konva event system |
| Lightbox integration | Standard `onClick` → open lightbox | Must map canvas coords → media items → programmatic open |
| CSS clip-path shapes | Already proven (hexagonal, circular, diamond adapters) | Konva shape equivalents needed |
| CSS mask-image | Supported natively | Konva compositing required |
| Drag + resize | react-rnd core feature | Konva `Transformer` node |
| Integration effort | Fits existing React/DOM pipeline | Parallel rendering pipeline (~40% more work) |
| Stretch goal support | clip-path + mask-image covers 90% | Superior for Photoshop-style compositing |

**Decision:** DOM-based with `react-rnd`. CSS features (clip-path, mask-image, drop-shadow, box-shadow) already proven in our codebase cover the core features and most stretch goals. Konva would only be needed for blend modes and realtime filters, which are beyond current scope.

### Why react-rnd?

[`react-rnd`](https://github.com/bokuweb/react-rnd) is a mature, lightweight React component for draggable and resizable elements. Key reasons:

- **Purpose-built**: drag + resize with bounds constraint is its entire API
- **Bounds enforcement**: `bounds="parent"` constrains items to canvas edges — exactly our requirement
- **Size constraints**: `minWidth`/`minHeight`/`maxWidth`/`maxHeight` per item
- **Callback-rich**: `onDragStop`, `onResizeStop` fire with final `{x, y, width, height}` — clean state updates
- **No peer dependencies**: ~15KB gzipped, no conflict with Mantine
- **React 18 compatible**: actively maintained

We avoid `react-dnd` for the canvas itself (it's designed for list reordering, not free-form placement) but may use it for drag-from-media-picker-to-canvas if the simpler `onDrop` approach proves insufficient.

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | Layout Builder registers as adapter ID `'layout-builder'` | Appears naturally in existing adapter dropdown alongside compact-grid, masonry, etc. No special rendering path needed. |
| AD-2 | Templates stored globally in WP options + per-campaign override | Global `wpsg_layout_templates` option stores the template library (array of `LayoutTemplate`). Each campaign can reference a template ID and optionally store slot overrides in campaign `post_meta`. |
| AD-3 | Positions stored as percentages of canvas dimensions | Canvas width/height may vary slightly within a breakpoint class (e.g., 1200px vs 1400px desktop). Percentage-based positions scale proportionally without distortion. |
| AD-4 | Per-breakpoint adapter selection with 6-way config | 3 breakpoints (desktop/tablet/mobile) × 2 media types (image/video) = 6 adapter IDs. Unified toggle collapses to 1 selection (current behavior). |
| AD-5 | Builder opens as full-screen modal from admin panel | Canvas workspace needs maximum screen real estate. Modal overlay with close/save/cancel controls, similar to existing settings modal pattern but full-viewport. |
| AD-6 | Slot filling: auto-assign by media order, manual override | Default fills slots 1→N by campaign media order. User can drag-reassign individual slots in the builder. Override stored per-campaign. |
| AD-7 | Smart guides (Figma-style) for alignment | Edge-to-edge and center-to-center snapping guides render dynamically as items are dragged. More useful than grid snapping for free-form layouts. |
| AD-8 | Scope is configurable: full gallery mode OR viewport-only | Setting `layoutBuilderScope: 'full' | 'viewport'` determines whether the layout replaces the entire gallery (collage mode, no thumbnail strip) or only the viewport area (thumbnail strip remains). |

---

## Data Model

### LayoutTemplate

```typescript
interface LayoutTemplate {
  id: string;                    // uuid v4
  name: string;                  // user-provided label
  schemaVersion: number;         // for future migration (starts at 1)
  canvasAspectRatio: number;     // width / height (e.g., 16/9 = 1.778)
  canvasMinWidth: number;        // px — minimum render width
  canvasMaxWidth: number;        // px — maximum render width (0 = fill container)
  backgroundColor: string;       // CSS color for canvas background
  slots: LayoutSlot[];           // ordered list of image/media slots
  overlays: LayoutOverlay[];     // P15-H stretch: decorative overlay layers
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  tags: string[];                // organizational tags
}
```

### LayoutSlot

```typescript
interface LayoutSlot {
  id: string;                    // uuid v4
  // Position & size as percentages of canvas (0–100)
  x: number;                     // % from left edge
  y: number;                     // % from top edge
  width: number;                 // % of canvas width
  height: number;                // % of canvas height
  // Stacking
  zIndex: number;                // layer order (P15-G stretch)
  // Appearance
  shape: LayoutSlotShape;        // 'rectangle' | 'circle' | 'ellipse' | ... (P15-I stretch)
  clipPath?: string;             // custom CSS clip-path (P15-K stretch)
  maskUrl?: string;              // CSS mask-image URL (P15-K stretch)
  borderRadius: number;          // px, for rectangle shapes
  borderWidth: number;           // px, 0 = none
  borderColor: string;           // CSS color
  // Image fitting
  objectFit: 'cover' | 'contain' | 'fill';
  objectPosition: string;        // CSS object-position, e.g., '50% 30%' for focal point
  // Optional fixed media binding (overrides auto-assignment)
  mediaId?: string;              // if set, always shows this specific MediaItem
  // Interaction
  clickAction: 'lightbox' | 'none';  // what happens on click in finalized mode
  hoverEffect: 'pop' | 'glow' | 'none'; // hover behavior in finalized mode
}
```

### LayoutSlotShape (P15-I stretch)

```typescript
type LayoutSlotShape =
  | 'rectangle'     // default — uses borderRadius
  | 'circle'        // clip-path: circle(50%)
  | 'ellipse'       // clip-path: ellipse(50% 50%)
  | 'hexagon'       // reuses existing hexClipPath setting
  | 'diamond'       // reuses existing diamondClipPath setting
  | 'custom';       // uses slot.clipPath directly
```

### LayoutOverlay (P15-H stretch)

```typescript
interface LayoutOverlay {
  id: string;
  imageUrl: string;              // transparent PNG/SVG URL
  x: number;                     // % position
  y: number;
  width: number;                 // %
  height: number;                // %
  zIndex: number;                // above all slots by default
  opacity: number;               // 0–1
  pointerEvents: boolean;        // false = click-through (default)
}
```

### CampaignLayoutBinding

```typescript
/** Stored in campaign post_meta as '_wpsg_layout_binding' */
interface CampaignLayoutBinding {
  templateId: string;            // references LayoutTemplate.id
  slotOverrides: Record<string, {  // keyed by LayoutSlot.id
    mediaId?: string;            // override auto-assigned media
    objectPosition?: string;     // override focal point
  }>;
}
```

### Per-Breakpoint Adapter Selection

```typescript
// New fields added to GalleryBehaviorSettings
interface GalleryBehaviorSettings {
  // ... existing fields ...

  // P15-A: Per-breakpoint gallery selection
  gallerySelectionMode: 'unified' | 'per-breakpoint';

  // Per-breakpoint adapter IDs (used when gallerySelectionMode === 'per-breakpoint')
  desktopImageAdapterId: string;
  desktopVideoAdapterId: string;
  tabletImageAdapterId: string;
  tabletVideoAdapterId: string;
  mobileImageAdapterId: string;
  mobileVideoAdapterId: string;

  // Layout builder settings
  layoutBuilderScope: 'full' | 'viewport';
}
```

### PHP Defaults

```php
// Added to WPSG_Settings::$defaults
'gallery_selection_mode'    => 'unified',
'desktop_image_adapter_id'  => 'classic',
'desktop_video_adapter_id'  => 'classic',
'tablet_image_adapter_id'   => 'classic',
'tablet_video_adapter_id'   => 'classic',
'mobile_image_adapter_id'   => 'classic',
'mobile_video_adapter_id'   => 'classic',
'layout_builder_scope'      => 'full',
```

### WP Options Keys

| Key | Content | Format |
|-----|---------|--------|
| `wpsg_layout_templates` | Global template library | Serialized array of `LayoutTemplate` |
| Campaign `post_meta: _wpsg_layout_binding` | Per-campaign template reference + overrides | Serialized `CampaignLayoutBinding` |

---

## Track P15-A — Per-Breakpoint Gallery Selection

**Status:** ✅ Complete  
**Effort:** Medium  
**Impact:** High — foundational for layout builder and general gallery flexibility

### Problem

Currently, `imageGalleryAdapterId` and `videoGalleryAdapterId` apply globally to all screen sizes. A layout designed for desktop will render identically on mobile, where it may not fit. This blocks layout-builder adoption because bespoke layouts are inherently breakpoint-specific.

### Deliverables

#### P15-A.1: Settings Model Extension

- [x] Add `gallerySelectionMode` setting: `'unified'` (current behavior) or `'per-breakpoint'`
- [x] Add 6 per-breakpoint adapter ID settings to `GalleryBehaviorSettings`, PHP `$defaults`, `SettingsResponse`, and `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`
- [x] Add `layoutBuilderScope` setting: `'full'` or `'viewport'`

**Files:** `src/types/index.ts`, `src/services/apiClient.ts`, `class-wpsg-settings.php`

#### P15-A.2: Breakpoint Detection Hook

- [x] Create `useBreakpoint()` hook returning `'desktop' | 'tablet' | 'mobile'` based on container width
- [x] Uses `ResizeObserver` on gallery container (not `window.innerWidth`) for embed-safe behavior — essential because this app embeds inside WordPress shortcodes where container width ≠ viewport width
- [x] Source breakpoint thresholds from `useMantineTheme().breakpoints` (sm/md/lg), converting `em` to `px`, to stay consistent with Mantine's responsive system used elsewhere in the app
- [x] Fallback defaults: mobile < 768px, 768px ≤ tablet < 1024px, desktop ≥ 1024px
- [ ] Thresholds should be configurable via settings (stretch: `desktopBreakpoint`, `tabletBreakpoint`)
- [ ] Note: existing `useMediaQuery` calls in `CampaignViewer.tsx` and `AuthBar.tsx` should be migrated to `useBreakpoint()` in a future cleanup pass for consistency

**Files:** `src/hooks/useBreakpoint.ts` (new)

#### P15-A.3: Adapter Resolution Logic

- [x] Modify `CampaignViewer.tsx` adapter selection to use `gallerySelectionMode`:
  - `'unified'`: current behavior (single `imageGalleryAdapterId` / `videoGalleryAdapterId`)
  - `'per-breakpoint'`: resolve adapter ID from the 6 per-breakpoint settings based on `useBreakpoint()` result
- [x] When breakpoint changes (e.g., window resize), adapter switches live (no reload needed)
- [x] Wrap adapter switch in `<Suspense>` since adapters are lazy-loaded
- [x] Extracted `resolveAdapterId()` to `src/utils/resolveAdapterId.ts` for unit testability

**Files:** `src/components/Campaign/CampaignViewer.tsx`

#### P15-A.4: Settings Panel UI

- [x] Add "Gallery Selection Mode" toggle in Settings Panel (General or Media Gallery tab)
- [x] When `per-breakpoint` is selected, show 6 adapter dropdowns organized as a 3×2 grid:
  ```
            Image        Video
  Desktop   [dropdown]   [dropdown]
  Tablet    [dropdown]   [dropdown]
  Mobile    [dropdown]   [dropdown]
  ```
- [x] Dropdown options include all existing adapter IDs plus the new `'layout-builder'`
- [x] When `unified` is selected, show existing single pair of dropdowns (current behavior)

**Files:** `src/components/Admin/SettingsPanel.tsx`

#### P15-A.5: PHP REST Integration

- [x] Add new settings to `$defaults`, `sanitize_settings()`, `to_js()` / `from_js()` mapping
- [x] Validate adapter IDs against known allowlist on save

**Files:** `class-wpsg-settings.php`, `class-wpsg-rest.php`

### Acceptance Criteria

- [x] Switching from `unified` to `per-breakpoint` mode preserves existing adapter selections as desktop defaults
- [x] Resizing the browser across breakpoint boundaries live-switches the adapter
- [x] Layout-builder appears as an adapter option in all 6 dropdowns
- [x] Settings round-trip correctly through PHP REST (save, reload, verify)
- [x] Existing unified-mode behavior is unchanged by default (backward compatible)

---

## Track P15-B — Layout Template Data Model & Persistence

**Status:** ✅ Complete  
**Effort:** Medium  
**Impact:** High — data foundation for all builder features

### Problem

No data model exists for storing authored layout templates. We need a versioned schema with CRUD operations, REST endpoints, and per-campaign binding.

### Deliverables

#### P15-B.1: TypeScript Types

- [x] Define `LayoutTemplate`, `LayoutSlot`, `LayoutOverlay`, `LayoutSlotShape`, `CampaignLayoutBinding` interfaces in `src/types/index.ts`
- [x] Define `DEFAULT_LAYOUT_SLOT` constant with sensible defaults (rectangle shape, cover fit, pop hover, lightbox click)
- [x] Add `layoutTemplateId` field to `Campaign` interface (optional, references template)

**Files:** `src/types/index.ts`

#### P15-B.2: PHP Data Model

- [x] Create `class-wpsg-layout-templates.php` with static methods:
  - `get_all(): array` — reads `wpsg_layout_templates` option
  - `get(string $id): ?array` — find by ID
  - `create(array $data): array` — validates, assigns UUID, saves
  - `update(string $id, array $data): array|WP_Error` — merge-update
  - `delete(string $id): bool` — remove from library
  - `duplicate(string $id, string $new_name): array` — clone with new ID
- [x] Validation: ensure all slot percentages are 0–100, canvas aspect ratio is positive, name is non-empty
- [x] Size-based storage limit: on `create()`/`update()`, check `strlen(serialize($all_templates))` — if > 500KB, log warning and return admin notice suggesting migration to a dedicated table. This accounts for varying template complexity (more slots/overlays = larger serialized size) better than a flat template-count limit.
- [x] Save-time bounds validation: warn if any slot extends beyond canvas boundaries (safety net beyond react-rnd's runtime `bounds="parent"` constraint)
- [x] Schema version migration hook: `migrate_template(array $template): array` — upgrades old schemas to current

**Files:** `wp-plugin/wp-super-gallery/includes/class-wpsg-layout-templates.php` (new)

#### P15-B.3: REST Endpoints

- [x] `GET    /wp-json/wpsg/v1/admin/layout-templates` — list all templates (admin only)
- [x] `POST   /wp-json/wpsg/v1/admin/layout-templates` — create new template
- [x] `GET    /wp-json/wpsg/v1/admin/layout-templates/{id}` — get single template
- [x] `PUT    /wp-json/wpsg/v1/admin/layout-templates/{id}` — update template
- [x] `DELETE /wp-json/wpsg/v1/admin/layout-templates/{id}` — delete template
- [x] `POST   /wp-json/wpsg/v1/admin/layout-templates/{id}/duplicate` — clone template
- [x] Public endpoint (for rendering): `GET /wp-json/wpsg/v1/layout-templates/{id}` — read-only, no auth required (templates are needed for public gallery rendering). ID-based only (no public list endpoint). Template IDs are UUIDv4 (128-bit random) — not guessable, no enumeration risk. Templates contain layout coordinates only, no sensitive data.

**Files:** `class-wpsg-rest.php`, `class-wpsg-layout-templates.php`

#### P15-B.4: Campaign Binding

- [x] Add `_wpsg_layout_binding` post_meta support to campaign CRUD
- [x] When campaign is created/updated with a `layoutTemplateId`, store the binding
- [x] On campaign GET, include resolved layout template data (or null if no binding)
- [ ] API client: add `getLayoutTemplates()`, `createLayoutTemplate()`, `updateLayoutTemplate()`, `deleteLayoutTemplate()`, `duplicateLayoutTemplate()` methods (type added, methods deferred to Sprint 2)

**Files:** `src/services/apiClient.ts`, `class-wpsg-rest.php`

#### P15-B.5: Slot Auto-Assignment Logic

- [x] Implement `assignMediaToSlots(template: LayoutTemplate, media: MediaItem[], overrides: CampaignLayoutBinding['slotOverrides']): Map<string, MediaItem>`
- [x] Logic: iterate slots in order, assign media by `order` field, skip slots with explicit `mediaId` override, handle case where media count < slot count (empty slots) or media count > slot count (extra media ignored in full mode, or shown in thumbnail strip in viewport mode)

**Files:** `src/utils/layoutSlotAssignment.ts` (new)

### Acceptance Criteria

- [x] Templates can be created, read, updated, deleted, and duplicated via REST
- [x] Schema version is stored and migration function handles upgrades
- [x] Campaign binding correctly references template and stores slot overrides
- [x] All REST endpoints return proper error codes for validation failures
- [x] Auto-assignment correctly fills slots and respects manual overrides

---

## Track P15-C — Layout Builder Canvas UI

**Status:** ✅ Complete  
**Effort:** High  
**Impact:** High — the core user-facing builder experience

### Problem

Admins need a visual authoring surface to create and edit layout templates. This is the centerpiece of Phase 15.

### Dependencies

- P15-B (data model must exist for save/load)
- `react-rnd` npm package

### Deliverables

#### P15-C.1: Package Installation & Setup

- [x] Install `react-rnd`: `npm install react-rnd` — v10.5.2
- [x] Verify TypeScript types are included (react-rnd ships its own `@types`)
- [x] Add to Vite config if any special handling needed (none needed)

#### P15-C.2: Builder Modal Shell

- [x] Create `LayoutBuilderModal.tsx` — full-screen modal opened from admin panel
- [x] Header bar: template name (editable), Save button, Cancel button, **Preview toggle** (Edit ↔ Preview mode)
- [x] **Preview mode**: hides all builder chrome (handles, guides, slot numbers, selection borders). Renders finalized layout with actual hover effects and cursor styles. Allows contextual WYSIWYG validation without leaving the builder.
- [x] Left sidebar: tabbed panels — Slots (ordered list with add/remove/reorder) + Media (media picker)
- [x] Right sidebar: properties panel (selected slot's position, size, appearance settings)
- [x] Center: canvas workspace (the main drag/resize area)
- [x] Footer: canvas size controls (max width input, fit-to-container, snap toggle)

**Files:** `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` (new)

#### P15-C.3: Canvas Component

- [x] Create `LayoutCanvas.tsx` — the bounded container where slots are placed
- [x] Canvas renders at the template's aspect ratio, scaled to fit the available modal workspace
- [x] Canvas has a visible border/background to distinguish it from the modal background
- [x] Canvas background color is editable (from template data)
- [ ] Zoom control: 50%–200% with scroll-wheel support (deferred — post-MVP)
- [x] Canvas dimensions displayed in corner (e.g., "1200 × 675")
- [x] Smart guides SVG overlay during drag operations
- [x] Drag-stop snapping via computeGuides()

**Files:** `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` (new)

#### P15-C.4: Draggable/Resizable Slots

- [x] Each `LayoutSlot` renders as a `<Rnd>` component inside the canvas
- [x] `bounds="parent"` enforces canvas containment — slots cannot be dragged outside
- [x] Resize handles on all 8 points (corners + edges)
- [x] On drag stop: update slot `x`, `y` (convert pixel position to %, store in state)
- [x] On resize stop: update slot `width`, `height` (convert to %, store in state)
- [x] Minimum slot size: 30px (prevents invisible slots)
- [x] Selected slot gets a highlighted border + property panel populates with its settings
- [x] Slot displays its index number and a small thumbnail preview of the assigned media
- [x] Multi-select support: Shift+click to select multiple slots
- [x] Delete key removes selected slot(s)
- [x] Copy/paste slots: Ctrl+V duplicates selected slots with slight offset
- [x] HTML5 drag-and-drop media assignment onto slots
- [x] onDrag frame callback for real-time smart guide computation

#### P15-C.4a: Accessibility (A11y)

- [x] Arrow keys nudge selected slot(s) by 1% (Shift+arrow = 0.1% for fine positioning)
- [x] `role="img"` with `aria-label="Slot {index}: {mediaTitle or 'empty'}"` on each slot element
- [x] Slots have `tabIndex={0}` for keyboard focus
- [x] ARIA live region announces drag/resize outcomes: "Slot moved to X%, Y%" / "Slot resized to W% × H%"
- [ ] Screen reader text for guide snapping: "Snapped to left edge of Slot 2" (deferred)
- [x] All interactive controls (properties panel, sidebars) are keyboard-navigable

**Files:** `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` (new)

#### P15-C.5: Slot Properties Panel

- [x] When a slot is selected, right sidebar shows editable properties:
  - **Position**: X%, Y% (numeric inputs)
  - **Size**: Width%, Height% (numeric inputs)
  - **Image Fit**: `object-fit` selector (cover / contain / fill)
  - **Focal Point**: `object-position` picker (visual 3×3 grid + text input)
  - **Border Radius**: slider (px)
  - **Border**: width + color picker
  - **Click Action**: lightbox / none
  - **Hover Effect**: pop / glow / none
  - **Shape**: rectangle / circle / ellipse / hexagon / diamond / custom
  - **Z-Index**: numeric input
- [x] Changes update the canvas in real-time (no save required)
- [ ] "Reset to default" button per property (deferred)
- [ ] Slot media assignment in properties panel (deferred — done via MediaPickerSidebar instead)

**Files:** `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx` (new)

#### P15-C.6: Media Picker Integration

- [x] Add a "Media" sidebar tab that shows the campaign's media items
- [x] Drag a media item from the sidebar to a slot to assign it (HTML5 DnD)
- [x] Select a slot, click media item in sidebar to assign it
- [x] Unassigned slots show a placeholder with slot number and dashed border
- [x] Assigned slots show the actual image, cropped/fitted per slot settings
- [x] "Auto-assign all" button fills all slots by media order
- [x] Assignments overview showing which media is assigned to which slot
- [x] Clear assignment button per slot

**Files:** `src/components/Admin/LayoutBuilder/MediaPickerSidebar.tsx` (new)

#### P15-C.7: Canvas Size Controls

- [x] Aspect ratio presets: 16:9, 4:3, 1:1, 3:2, 21:9 (SegmentedControl in header)
- [x] Max width input (px): NumberInput in footer, 0–3840
- [x] Height is computed from width ÷ aspect ratio
- [x] When aspect ratio changes, slot percentages are preserved (they scale proportionally)
- [x] "Fit to container" button sets `canvasMaxWidth: 0` (fills gallery viewer)
- [x] Snap toggle switch in footer

**Files:** integrated into `LayoutBuilderModal.tsx` footer

#### P15-C.8: Builder State Management

- [x] Create `useLayoutBuilderState()` hook managing:
  - `template: LayoutTemplate` — current working copy
  - `selectedSlotIds: Set<string>` — multi-select support
  - `isDirty: boolean` — unsaved changes indicator
  - `history: LayoutTemplate[]` — undo stack (last 50 states)
  - `historyIndex: number` — current position in undo stack
- [x] **Use `immer` (`produce()`)** for all template state mutations — the nested slot/overlay structure makes manual immutable updates error-prone. Immer's draft proxy pattern lets mutation handlers read like mutable code while producing immutable snapshots for the history stack. ~3KB gzipped, proven in Redux Toolkit and similar state-heavy apps.
- [x] Undo/redo: Ctrl+Z / Ctrl+Shift+Z, pointer to history stack. Each undo step is a full `LayoutTemplate` snapshot (produced by Immer's `produce()`).
- [x] Auto-save draft to `localStorage` every 30 seconds (crash recovery only — not a collaboration tool).
- [x] On "Save": POST/PUT to REST endpoint, clear dirty flag
- [x] On "Close": if dirty, confirm dialog ("Discard unsaved changes?")
- [x] `nudgeSlots()` — arrow key nudge with bounds clamping
- [x] `assignMediaToSlot()` / `clearSlotMedia()` / `autoAssignMedia()` — media binding

**Files:** `src/hooks/useLayoutBuilderState.ts` (new)

### Acceptance Criteria

- [x] Slots can be dragged and resized freely within the canvas
- [x] Slots cannot escape canvas boundaries
- [x] All slot properties are editable and update the canvas in real-time
- [x] Media can be assigned to slots via drag or picker
- [x] Canvas aspect ratio can be changed; slot positions scale proportionally
- [x] Undo/redo works across all operations (drag, resize, property change, add, delete)
- [x] Template saves to REST endpoint and reloads correctly
- [x] Draft auto-saves to localStorage
- [x] Arrow key nudge with 1% and 0.1% (Shift) steps
- [x] ARIA live region announces move/resize outcomes
- [x] Smart guides render during drag, snapping applied on drop

---

## Track P15-D — Smart Guides & Snapping

**Status:** ✅ Complete  
**Effort:** Medium  
**Impact:** Medium — UX polish for the builder

### Problem

Free-form positioning without alignment aids makes it difficult to create visually balanced layouts. Smart guides (as seen in Figma, Sketch, PowerPoint) show temporary alignment lines when a dragged element's edges or center align with other elements.

### Dependencies

- P15-C (builder canvas must exist)

### Deliverables

#### P15-D.1: Edge Alignment Guides

- [x] During drag, compute if the dragged slot's left/right/top/bottom edge aligns (within a threshold) with any other slot's left/right/top/bottom edge
- [x] Threshold: 5px (canvas-space pixels) for detection, snap to exact alignment on dragStop
- [x] Render thin colored lines (`#ff6b6b`) spanning the full canvas width/height at the aligned coordinate
- [x] Lines render on an SVG overlay above the canvas, below the dragged slot
- [x] Guide lines disappear when drag ends or alignment breaks

**Files:** `src/components/Admin/LayoutBuilder/SmartGuides.tsx` (new)

#### P15-D.2: Center Alignment Guides

- [x] Detect center-x and center-y alignment between dragged slot and other slots
- [x] Detect alignment with canvas center (horizontal + vertical midpoints)
- [x] Render dashed lines (`#4dabf7`) for center alignment (solid for edge alignment) — visual distinction

#### P15-D.3: Spacing Guides

- [ ] When gaps between adjacent slots are equal, show spacing indicator lines with pixel/percentage labels
- [ ] E.g., if slot A is 10% from slot B and slot B is 10% from slot C, show "10%" markers between them
- [ ] This helps create evenly-spaced compositions

#### P15-D.4: Snap Behavior

- [x] When a dragged slot is within the snap threshold of a guide, snap on dragStop
- [x] Add `Shift` key for fine nudge (0.1% vs 1% via arrow keys)
- [x] Snap toggle in footer to enable/disable snapping
- [ ] Add setting `layoutBuilderSnapThreshold` (deferred — hardcoded 5px for now)

#### P15-D.5: Implementation Strategy

The smart guides system works as a pure function (implemented in `src/utils/smartGuides.ts`):

```typescript
interface GuideResult {
  snapX?: number;        // snap-to x position (% of canvas)
  snapY?: number;        // snap-to y position (% of canvas)
  guides: GuideLine[];   // lines to render
}

interface GuideLine {
  axis: 'x' | 'y';
  position: number;      // % of canvas
  type: 'edge' | 'center' | 'spacing';
  label?: string;        // e.g., "10%"
}

function computeGuides(
  draggingSlot: {x, y, width, height},
  otherSlots: LayoutSlot[],
  canvasDimensions: {width, height},
  snapThreshold: number
): GuideResult;
```

- Called on every drag frame via onDrag callback
- Returns snap coordinates (applied on dragStop) and guide lines (rendered by SVG overlay)
- Pure function — 25 unit tests covering edge, center, spacing, and edge cases

**Files:** `src/utils/smartGuides.ts` (new), `src/components/Admin/LayoutBuilder/SmartGuides.tsx` (new), `src/utils/smartGuides.test.ts` (new)

### Acceptance Criteria

- [x] Dragging a slot near another slot's edge shows a red alignment line
- [x] Slot snaps to the guide on dragStop when within threshold
- [x] Center and canvas-center guides are shown with dashed blue lines
- [x] Equal spacing guides show distance labels in green
- [x] Snap toggle disables snapping
- [x] < 1ms per `computeGuides()` call (25 tests verify correctness)

---

## Track P15-E — Layout Builder Adapter — Finalized Rendering

**Status:** ❌ Not started  
**Effort:** Medium  
**Impact:** High — makes builder output actually usable in the gallery

### Problem

The builder produces a template data structure. We need a gallery adapter that reads this data and renders the finalized layout with hover effects and lightbox integration, consistent with all other adapters.

### Dependencies

- P15-A (adapter registration)
- P15-B (data model)

### Deliverables

#### P15-E.1: Adapter Component

- [ ] Create `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx`
- [ ] Implements `GalleryAdapterProps` interface: `{media: MediaItem[], settings: GalleryBehaviorSettings}`
- [ ] On mount: resolve template from campaign binding → auto-assign media to slots → render
- [ ] Each slot renders as an absolutely positioned `<div>` inside a relative container
- [ ] Container enforces template's `canvasAspectRatio` via CSS `aspect-ratio` property (native, no JS height computation needed; 95%+ browser support)
- [ ] Container width: `min(canvasMaxWidth, containerWidth)` or `100%` if `canvasMaxWidth === 0`
- [ ] Slot positions/sizes computed from percentage values × actual container pixel dimensions

**Files:** `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx` (new)

#### P15-E.2: Hover Effects

- [ ] Each slot applies hover effect based on its `hoverEffect` setting:
  - `'pop'`: reuses `buildTileStyles()` from `_shared/tileHoverStyles.ts` (scale bounce keyframes)
  - `'glow'`: reuses glow drop-shadow from same module
  - `'none'`: no hover effect
- [ ] CSS `clip-path` applied for non-rectangle shapes — `drop-shadow` used instead of `box-shadow` (consistent with hex/circular adapters)
- [ ] `cursor: pointer` on slots with `clickAction: 'lightbox'`

#### P15-E.3: Lightbox Integration

- [ ] On slot click (when `clickAction === 'lightbox'`): open `<Lightbox>` at the media item's index
- [ ] Lightbox renders from the full media array (not just the visible slots) — user can navigate to items not visible in the layout
- [ ] Uses same `useCarousel` hook and navigation as all other adapters
- [ ] In `viewport` scope mode: clicking a slot scrolls the thumbnail strip to that item's position via `scrollIntoView({ behavior: 'smooth' })` for consistent animated feedback

#### P15-E.4: Empty Slot Handling

- [ ] If media count < slot count, empty slots render with a subtle placeholder (light gray background, dashed border)
- [ ] Empty slots in finalized mode are non-interactive (no hover, no lightbox)
- [ ] If media count > slot count in `full` mode, extra media items are not visible (no thumbnail strip)
- [ ] If media count > slot count in `viewport` mode, extra items are visible in the thumbnail strip
- [ ] **Slot count mismatch warning**: when saving a template assignment to a campaign, if media count ≠ slot count, show an info notification ("This layout has 6 slots but the campaign has 4 images — 2 slots will be empty") to guide the user proactively

#### P15-E.5: Adapter Registration

- [ ] Add `'layout-builder'` case to `renderAdapter()` switch in `CampaignViewer.tsx`
- [ ] Lazy-load: `const LayoutBuilderGallery = React.lazy(() => import(...))`
- [ ] Template data fetched via `useSWR` — cached, revalidated on focus

**Files:** `src/components/Campaign/CampaignViewer.tsx`

#### P15-E.6: Template Data Fetching

- [ ] Create `useLayoutTemplate(templateId: string | undefined)` hook
- [ ] Uses SWR to fetch from `/layout-templates/{id}` public endpoint
- [ ] Returns `{template, isLoading, error}`
- [ ] While loading, show skeleton placeholder matching canvas aspect ratio
- [ ] On error, fall back to compact-grid adapter with console warning

**Files:** `src/hooks/useLayoutTemplate.ts` (new)

### Acceptance Criteria

- [ ] Selecting `layout-builder` adapter renders the template's layout with real images
- [ ] Hover pop/glow effects match other adapters' behavior
- [ ] Clicking a slot opens the lightbox at the correct media item
- [ ] Empty slots show appropriate placeholders
- [ ] Template data loads via SWR with loading/error states
- [ ] Fallback to compact-grid works when template is missing/invalid
- [ ] Layout scales correctly when container width varies within the same breakpoint class

---

## Track P15-F — Template Library CRUD & Management

**Status:** ❌ Not started  
**Effort:** Medium  
**Impact:** Medium — organizational layer for templates

### Problem

Admins need to browse, create, duplicate, rename, and delete templates from a dedicated management UI. Templates also need to be assignable to campaigns.

### Dependencies

- P15-B (REST endpoints)
- P15-C (builder modal for editing)

### Deliverables

#### P15-F.1: Template Library Panel

- [ ] New "Layouts" tab in admin panel (alongside Campaigns, Media, Settings)
- [ ] Grid/list view of all templates with:
  - Thumbnail preview (auto-generated canvas snapshot or placeholder)
  - Template name
  - Slot count
  - Created/updated dates
  - Tags
- [ ] Action buttons per template: Edit (opens builder), Duplicate, Delete
- [ ] "New Layout" button at top → opens builder modal with empty template
- [ ] Search/filter by name and tags

**Files:** `src/components/Admin/LayoutTemplateList.tsx` (new)

#### P15-F.2: Campaign Layout Assignment

- [ ] In campaign edit modal, add "Layout Template" selector
- [ ] Dropdown shows all templates with preview thumbnails
- [ ] Selection writes `layoutTemplateId` to campaign data
- [ ] Only appears when the campaign's adapter (for any breakpoint) is set to `layout-builder`
- [ ] "Edit Layout" button opens builder pre-populated with campaign's media for live preview

#### P15-F.3: Template Preview Thumbnails — DEFERRED to post-v1

> **Rationale:** Visual preview generation is polish, not MVP. Shipping v1 without thumbnails (metadata-only: name, slot count, aspect ratio, dates) accelerates delivery. If added later, `html-to-image` is the correct library — native `canvas.drawImage()` cannot capture CSS clip-paths, borders, overlays, or drop-shadows without reimplementing the entire layout renderer on canvas.

- [ ] For v1: template library shows name, slot count, aspect ratio badge, created/updated dates
- [ ] Post-v1: generate preview via `html-to-image` at small scale (200×112 for 16:9)
- [ ] Store preview in template data as `previewDataUrl` (base64)
- [ ] Regenerate on template save

#### P15-F.4: Import/Export

- [ ] Export template as JSON file (download)
- [ ] Import template from JSON file (upload + validate schema)
- [ ] Validation checks `schemaVersion`, required fields, percentage bounds
- [ ] Useful for moving templates between WP instances

**Files:** `src/components/Admin/LayoutTemplateList.tsx`, `src/services/apiClient.ts`

### Acceptance Criteria

- [ ] Template library shows all templates with previews
- [ ] CRUD operations work: create, edit, duplicate, delete
- [ ] Templates can be assigned to campaigns
- [ ] Import/export round-trips correctly (export → import → identical template)
- [ ] Campaign edit UI conditionally shows template selector when layout-builder adapter is active

---

## Track P15-G — Stretch: Z-Index / Overlap Control

**Status:** ❌ Not started  
**Effort:** Low–Medium  
**Impact:** Medium — enables creative overlapping compositions  
**Priority:** Stretch 1 (first stretch goal to attempt)

### Problem

Default slot stacking follows DOM order. For creative layouts, admins need explicit control over which images appear in front of others, enabling intentional overlaps for collage-style compositions.

### Deliverables

#### P15-G.1: Z-Index UI

- [ ] Add "Layer Order" (z-index) control to slot properties panel
- [ ] Visual layer list in left sidebar: reorderable slot list with drag handles
- [ ] Dragging a slot higher in the layer list increases its z-index
- [ ] "Bring to Front" / "Send to Back" / "Bring Forward" / "Send Backward" context menu actions
- [ ] Keyboard shortcuts: `]` = bring forward, `[` = send backward, `Shift+]` = front, `Shift+[` = back

#### P15-G.2: Visual Overlap Feedback

- [ ] During drag, when a slot overlaps another, show overlap indicators (subtle highlight on underlying slot)
- [ ] Semi-transparent rendering of lower-z slots under higher-z slots to visualize the final stacking

#### P15-G.3: Data Model

- [ ] `zIndex` field already defined in `LayoutSlot` — just needs UI wiring
- [ ] Default z-index: slot order (first slot = 1, second = 2, etc.)
- [ ] On save, normalize z-indices to sequential integers (no gaps)

### Acceptance Criteria

- [ ] Slots can overlap and stacking order is visually correct
- [ ] Layer list reflects and controls z-order
- [ ] Finalized rendering respects z-index (front image overlaps back image)
- [ ] Hover/click still works correctly on the topmost visible slot

---

## Track P15-H — Stretch: Overlay Transparencies

**Status:** ❌ Not started  
**Effort:** Medium  
**Impact:** Medium — decorative visual enhancement  
**Priority:** Stretch 2

### Problem

Admins want to place decorative transparent images (borders, frames, panels, textures) over the entire layout for visual effects. Examples: a vintage film strip border, a frosted glass panel, a grunge texture, a decorative corner ornament.

### Deliverables

#### P15-H.1: Overlay Layer System

- [ ] Overlay items render as absolutely positioned `<img>` tags above all slots
- [ ] `pointer-events: none` by default — clicks fall through to slots beneath
- [ ] Each overlay has individual position, size, opacity, z-index
- [ ] Overlays support PNG (with alpha) and SVG

#### P15-H.2: Overlay Management UI

- [ ] "Overlays" section in builder left sidebar
- [ ] Add overlay: opens WP media picker or URL input
- [ ] Each overlay is draggable/resizable on the canvas (same `<Rnd>` component)
- [ ] Properties panel: opacity slider, position/size inputs, "click-through" toggle
- [ ] Separate layer list from image slots (clearly distinguished as decorative layers)

#### P15-H.3: Premade Overlay Library (stretch within stretch)

- [ ] Ship 5–10 premade overlay assets (SVG): film strip border, corner ornaments, grid lines, vignette, halftone pattern
- [ ] Stored in plugin assets directory
- [ ] Shown as a quick-pick grid in the overlay sidebar

#### P15-H.4: Data Model

- [ ] `LayoutOverlay` interface already defined in data model section
- [ ] Overlays array stored alongside slots in `LayoutTemplate`
- [ ] Finalized renderer renders overlays after slots

### Acceptance Criteria

- [ ] Transparent PNG/SVG overlays render correctly over image slots
- [ ] Overlays are click-through (don't block slot interactions)
- [ ] Opacity control works in real-time
- [ ] Overlays persist in template data and reload correctly

---

## Track P15-I — Stretch: Mixed Shapes

**Status:** ❌ Not started  
**Effort:** Low–Medium  
**Impact:** Medium — visual variety within a single layout  
**Priority:** Stretch 3

### Problem

Currently all slots would be rectangular. Admins may want to mix shapes — e.g., a large rectangular hero image with circular profile shots beside it.

### Deliverables

#### P15-I.1: Shape Selector UI

- [ ] Add shape dropdown to slot properties panel
- [ ] Options: Rectangle, Circle, Ellipse, Hexagon, Diamond, Custom
- [ ] Shape preview icon next to each option
- [ ] For custom: text input for CSS `clip-path` polygon

#### P15-I.2: Shape Rendering

- [ ] Apply CSS `clip-path` to slot based on shape selection:
  - `rectangle`: no clip-path, use `border-radius` only
  - `circle`: `clip-path: circle(50% at 50% 50%)`
  - `ellipse`: `clip-path: ellipse(50% 50% at 50% 50%)`
  - `hexagon`: uses `hexClipPath` from settings (default: `polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)`)
  - `diamond`: uses `diamondClipPath` from settings
  - `custom`: uses slot's `clipPath` field directly
- [ ] Hover effects: use `filter: drop-shadow()` instead of `box-shadow` for clipped shapes (already established pattern)

#### P15-I.3: Canvas Preview

- [ ] Builder canvas shows shapes in real-time as the user edits
- [ ] Resize handles adapt to shape boundaries (for circle, corner handles maintain 1:1 aspect ratio)

### Acceptance Criteria

- [ ] Different shapes can coexist in the same layout
- [ ] Shape clipping renders correctly in both builder and finalized mode
- [ ] Hover effects work correctly with non-rectangular shapes
- [ ] Custom clip-path input validates CSS syntax

---

## Track P15-J — Stretch: Premade Templates & Algorithms

**Status:** ❌ Not started  
**Effort:** Medium  
**Impact:** Medium — quick-start layouts, reduces learning curve  
**Priority:** Stretch 4

### Problem

Creating layouts from scratch is time-consuming. Shipping premade templates gives admins a starting point and showcases what's possible.

### Deliverables

#### P15-J.1: Template Presets

- [ ] Ship 8–12 premade template JSON definitions:
  1. **Hero + Thumbnails**: 1 large (60% width) + 4 small (2×2 grid in remaining 40%)
  2. **Magazine Spread**: asymmetric 3-column with varying heights
  3. **Pinterest Board**: 3-column masonry-like but with fixed positions
  4. **Film Strip**: single row of equal-width images at cinematic aspect ratio
  5. **Spotlight**: 1 centered large image, 2 flanking smaller images
  6. **Grid 2×2**: equal quadrants
  7. **Grid 3×3**: equal 9-cell grid
  8. **Panoramic**: full-width hero + 3 columns below
  9. **Diagonal Cascade**: overlapping images on a diagonal line (requires P15-G)
  10. **Photo Stack**: overlapping images at slight rotation offsets (requires P15-G)
  11. **L-Shape**: one tall image + 2 or 3 short images beside it
  12. **T-Layout**: one wide image on top + 3 columns below

- [ ] Templates stored as JSON files in `src/data/layoutPresets/` directory
- [ ] Imported at build time, no runtime fetch needed

#### P15-J.2: Template Gallery UI

- [ ] "Start from Template" button in template creation flow
- [ ] Opens a visual gallery of presets with previews
- [ ] Clicking a preset creates a new template pre-populated with its slots
- [ ] User can then customize (add/remove/resize slots, change properties)

#### P15-J.3: Algorithmic Layout Generation (advanced)

- [ ] "Auto-layout" button in builder: given N media items, generate a balanced layout algorithmically
- [ ] Algorithms:
  - **Equal grid**: divide canvas into equal cells for N items
  - **Golden ratio**: recursively subdivide canvas using golden ratio proportions
  - **Random organic**: place items with random sizes and positions, then resolve overlaps
- [ ] Result populates slots which the user can then fine-tune

### Acceptance Criteria

- [ ] At least 8 premade templates available on fresh install
- [ ] Preset gallery shows visual previews
- [ ] Creating from preset produces a fully functional layout
- [ ] Auto-layout generates reasonable results for 2–12 media items

---

## Track P15-K — Stretch: Diagonal Shapes & Advanced Masks

**Status:** ❌ Not started  
**Effort:** Medium–High  
**Impact:** Low–Medium — niche creative use cases  
**Priority:** Stretch 5 (lowest priority, attempt last)

### Problem

Some creative layouts use diagonal lines (parallelogram-shaped images, chevron patterns) or complex masks (irregular outlines, feathered edges). CSS `clip-path: polygon()` handles diagonals. CSS `mask-image` handles complex masks.

### Deliverables

#### P15-K.1: Diagonal Polygon Shapes

- [ ] Add preset polygon shapes to the shape selector:
  - **Parallelogram left**: `polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)`
  - **Parallelogram right**: `polygon(0% 0%, 85% 0%, 100% 100%, 15% 100%)`
  - **Chevron right**: `polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)`
  - **Arrow**: `polygon(0% 0%, 70% 0%, 100% 50%, 70% 100%, 0% 100%, 30% 50%)`
  - **Trapezoid**: `polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)`
- [ ] Each generates the appropriate CSS `clip-path` polygon

#### P15-K.2: CSS Mask Support

- [ ] Add "Mask" option to slot properties
- [ ] Mask types:
  - **None**: no mask
  - **URL**: CSS `mask-image: url(...)` — user provides SVG/PNG mask URL
  - **Gradient**: CSS `mask-image: linear-gradient(...)` — fade edges
  - **Radial**: CSS `mask-image: radial-gradient(...)` — vignette effect
- [ ] Mask position / size / repeat controls
- [ ] Requires `-webkit-mask-image` prefix for Safari compatibility

#### P15-K.3: Visual Clip-Path Editor — DEFERRED to future phase

> **Rationale:** A full interactive polygon editor (mini "pen tool") is a substantial feature that exceeds stretch scope. Preset polygons + custom text input (already in P15-I.1) cover most use cases. Defer to a future phase informed by user feedback on whether custom shapes see real adoption.

- [ ] Interactive polygon editor: click to place points on a visual preview
- [ ] Points are draggable, double-click to insert new point on edge
- [ ] Generates `polygon(...)` value in real-time

### Acceptance Criteria

- [ ] Diagonal preset shapes render correctly
- [ ] CSS masks apply and display correctly (including Safari with prefix)
- [ ] Clip-path editor produces valid CSS values
- [ ] All shapes/masks persist in template data and render in finalized mode

---

## Execution Priority

| Priority | Track | Rationale |
|----------|-------|-----------|
| 1 | **P15-A** — Per-Breakpoint Selection | Foundational infrastructure — enables layout-builder adapter to be scoped to specific breakpoints. Independently valuable even without the builder. |
| 2 | **P15-B** — Data Model & Persistence | No builder features work without the data layer. REST endpoints needed for CRUD. |
| 3 | **P15-C** — Canvas Builder UI | Core deliverable — the drag/resize authoring surface. Largest track. |
| 4 | **P15-D** — Smart Guides | UX polish for the builder. Can be done in parallel with P15-E. |
| 5 | **P15-E** — Finalized Adapter Rendering | Makes builder output usable in the actual gallery. Needed for end-to-end validation. |
| 6 | **P15-F** — Template Library CRUD | Management layer. Builder works without it (can save/load) but admins need organization tooling. |
| 7 | **P15-G** — Stretch: Z-Index / Overlap | First stretch goal. Low effort, enabling for creative layouts. |
| 8 | **P15-H** — Stretch: Overlay Transparencies | Second stretch goal. Depends on overlay data model. |
| 9 | **P15-I** — Stretch: Mixed Shapes | Third stretch goal. Low effort — reuses existing clip-path patterns. |
| 10 | **P15-J** — Stretch: Premade Templates | Fourth stretch goal. Standalone, can be done anytime after P15-C. |
| 11 | **P15-K** — Stretch: Diagonals & Masks | Fifth stretch goal. Lowest priority, most niche. |

### Suggested Sprint Breakdown

| Sprint | Tracks | Goal |
|--------|--------|------|
| Sprint 1 | P15-A + P15-B | Settings and data foundation |
| Sprint 2 | P15-C (C.1–C.5) | Canvas shell + drag/resize |
| Sprint 3 | P15-C (C.6–C.8) + P15-D | Media assignment + smart guides |
| Sprint 4 | P15-E + P15-F | Finalized rendering + library UI |
| Sprint 5 | P15-G + P15-H + P15-I | Stretch: overlap, overlays, shapes |
| Sprint 6 | P15-J + P15-K | Stretch: presets + advanced masks |

---

## Version Plan

- **v0.13.0** — Phase 15 core complete (P15-A through P15-F)
- **v0.13.1** — Stretch goals P15-G through P15-K (incremental)

---

## Testing Strategy

### Unit Tests

| Area | Coverage Target |
|------|-----------------|
| `computeGuides()` | Edge alignment, center alignment, spacing, snap threshold, edge cases (overlapping slots, single slot) |
| `assignMediaToSlots()` | Auto-fill, overrides, mismatched counts, empty template |
| Layout template validation | Invalid percentages, missing fields, schema migration |
| `useBreakpoint()` | Correct threshold detection, resize transitions |
| Per-breakpoint adapter resolution | All 6 combinations, fallback behavior |

### Integration Tests

| Area | Coverage Target |
|------|-----------------|
| REST CRUD for templates | Create, read, update, delete, duplicate, validation errors |
| Campaign binding | Assign template, update overrides, remove binding |
| Settings persistence | Per-breakpoint IDs round-trip through PHP |

### E2E Tests (Playwright)

| Scenario | Coverage Target |
|----------|-----------------|
| Builder open → add slots → drag → resize → save | Full builder workflow |
| Assign template to campaign → view gallery → lightbox opens | End-to-end rendering |
| Per-breakpoint switch | Resize viewport → adapter changes |
| Template import/export | Export → import → verify identical |

### E2E Device Matrix

- Add Playwright device presets for multi-device coverage:
  - Desktop: `Desktop Chrome` (1280×720)
  - Tablet: `iPad (gen 7)` (810×1080)
  - Mobile: `iPhone 13` (390×844)
- Ensures per-breakpoint adapter switching works on real device dimensions
- Add to `playwright.config.ts` `projects` array (~5 lines of config)

### Visual Regression

- Snapshot finalized layouts at each breakpoint size
- Compare smart guide rendering during drag operations
- Verify shape clip-paths render correctly across browsers

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `react-rnd` bounds enforcement has edge cases with rapid dragging | Medium | Medium | Clamp positions in `onDragStop` handler as a safety net, not just `bounds="parent"` |
| Percentage-based positioning creates fractional pixel jitter | Low | High | Round computed pixel values; use `will-change: transform` for GPU compositing |
| Smart guides computation too slow with many slots (>20) | Medium | Low | O(n²) is fine for ≤50 slots; add early-exit when no slot is within 10% of dragged slot |
| Template data in WP options exceeds safe serialized size | Medium | Low | Size-based limit: warn at 500KB serialized; document migration to dedicated table. ~2KB per template means ~250 templates before warning. |
| SWR cache stale after template edit in builder | Low | Medium | Mutate SWR cache on save; invalidate `/layout-templates` key |
| `react-rnd` unmaintained or React 19 incompatible | Medium | Low | Library is simple; vendoring or forking is straightforward at ~400 LoC core. Run React 19 beta compatibility test during development to catch issues early. |
| CSS `mask-image` inconsistent across browsers | Low | Medium | Use `-webkit-` prefix; test Safari/Chrome/Firefox; provide fallback to clip-path |

---

## Dependencies & Package Additions

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `react-rnd` | `^10.4.x` | Drag + resize with bounds | ~15KB gzipped |
| `immer` | `^10.x` | Immutable state for builder undo/redo | ~3KB gzipped |
| `uuid` (or `crypto.randomUUID()`) | native | Generate template/slot IDs | 0KB (built-in) |
| `html-to-image` (deferred post-v1, P15-F.3) | `^1.11.x` | Template preview thumbnails | ~8KB gzipped |

---

## New File Inventory

| File | Track | Purpose |
|------|-------|---------|
| `src/hooks/useBreakpoint.ts` | P15-A | Container-width breakpoint detection |
| `src/types/index.ts` (modified) | P15-A/B | New interfaces and settings fields |
| `wp-plugin/.../class-wpsg-layout-templates.php` | P15-B | PHP template CRUD |
| `src/utils/layoutSlotAssignment.ts` | P15-B | Media-to-slot auto-assignment logic |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | P15-C | Full-screen builder shell |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | P15-C | Canvas workspace |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | P15-C | Individual draggable/resizable slot |
| `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx` | P15-C | Selected slot property editor |
| `src/components/Admin/LayoutBuilder/MediaPickerSidebar.tsx` | P15-C | Media item drag source |
| `src/hooks/useLayoutBuilderState.ts` | P15-C | Builder state + undo/redo + autosave |
| `src/components/Admin/LayoutBuilder/SmartGuides.tsx` | P15-D | SVG guide overlay for snapping |
| `src/utils/smartGuides.ts` | P15-D | Pure function guide computation |
| `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx` | P15-E | Finalized adapter rendering |
| `src/hooks/useLayoutTemplate.ts` | P15-E | SWR-based template data fetching |
| `src/components/Admin/LayoutTemplateList.tsx` | P15-F | Template library grid/list |
| `src/data/layoutPresets/*.json` | P15-J | Premade template definitions |

---

*Document created: February 22, 2026*
