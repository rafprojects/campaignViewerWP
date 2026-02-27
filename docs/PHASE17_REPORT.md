# Phase 17 — Builder UX: Design Assets Consolidation & Dockable Panels

**Status:** ✅ Complete  
**Version:** v0.15.0  
**Created:** February 26, 2026  
**Last updated:** February 26, 2026 — All tracks complete; coverage assessment addendum added

---

## Table of Contents

- [Phase 17 — Builder UX: Design Assets Consolidation \& Dockable Panels](#phase-17--builder-ux-design-assets-consolidation--dockable-panels)
  - [Table of Contents](#table-of-contents)
  - [Rationale](#rationale)
  - [Key Decisions (Resolved)](#key-decisions-resolved)
  - [Architecture Decisions](#architecture-decisions)
  - [Current State Audit](#current-state-audit)
    - [Left panel tabs (HEAD `ac06b9b`)](#left-panel-tabs-head-ac06b9b)
    - [Right panel (as of HEAD)](#right-panel-as-of-head)
    - [`LayoutSlotComponent` drop handler](#layoutslotcomponent-drop-handler)
  - [Track P17-F — Type Rename (Pre-Work)](#track-p17-f--type-rename-pre-work)
    - [Scope](#scope)
    - [Why `template.overlays` stays](#why-templateoverlays-stays)
    - [Files touched (~15)](#files-touched-15)
  - [Track P17-B — AssetUploader Sub-Component](#track-p17-b--assetuploader-sub-component)
  - [Track P17-C — Media Slot Drop Guard](#track-p17-c--media-slot-drop-guard)
  - [Track P17-D — Graphic Layer Properties Panel](#track-p17-d--graphic-layer-properties-panel)
    - [Props](#props)
    - [Properties surfaced](#properties-surfaced)
    - [Right panel hot-swap (after P17-D)](#right-panel-hot-swap-after-p17-d)
  - [Track P17-A — Design Assets Consolidation](#track-p17-a--design-assets-consolidation)
    - [Target left panel structure (after P17-A)](#target-left-panel-structure-after-p17-a)
    - [Routing `setLeftTab('bg')` → `setDesignAssetsOpen(true)` + scroll](#routing-setlefttabbg--setdesignassetsopentrue--scroll)
    - [State changes](#state-changes)
    - [Graphic Layers library — no on-canvas cards](#graphic-layers-library--no-on-canvas-cards)
    - [Removed: `overlaysVisible` global toggle](#removed-overlaysvisible-global-toggle)
  - [Track P17-E — True Dockable Panels (dockview)](#track-p17-e--true-dockable-panels-dockview)
    - [Builder shell change](#builder-shell-change)
    - [dockview integration sketch](#dockview-integration-sketch)
    - [Panel configuration](#panel-configuration)
    - [Layout reset](#layout-reset)
    - [Styling dockview to match Mantine theme](#styling-dockview-to-match-mantine-theme)
  - [Deferred to P18 — Zoomable Canvas \& Hand Tool](#deferred-to-p18--zoomable-canvas--hand-tool)
  - [Execution Priority](#execution-priority)
  - [Testing Strategy](#testing-strategy)
  - [Risk Register](#risk-register)
  - [Modified File Inventory (projected)](#modified-file-inventory-projected)
    - [New files](#new-files)
    - [Modified files](#modified-files)

---

## Rationale

Phase 16 delivered a unified layer panel that surfaces all elements in a single scrollable list. Three friction points remain:

**1 — Four tabs, two serving the same conceptual purpose.** `Overlays` and `BG` are both template-level design asset tools. Forcing users to know the distinction in order to find the right tab adds unnecessary cognitive load. `Media` (campaign photos/videos) belongs in its own section but does not need a full peer tab alongside design tools.

**2 — Graphic layer properties not reachable from the layer panel.** Selecting a graphic layer row currently shows nothing in the right panel. To edit opacity or click-through, users must switch to the Overlays tab — breaking the "layer panel is the single interaction surface" principle from P16.

**3 — Rigid panel layout.** The modal locks `[Layers+Media] | [Canvas] | [Properties]` regardless of workflow. Designers frequently want canvas-dominant views, or want properties and media on the same side. A true Photoshop-style drag-to-dock system covers the range of realistic workflows.

---

## Key Decisions (Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | Ordering within Design Assets section | Graphic Layers first → Background (matches Layer Panel top-to-bottom visual order) |
| B | Design Assets accordion default state | Persisted to `localStorage` |
| C | Graphic layer properties implementation | New `GraphicLayerPropertiesPanel.tsx` component (clean separation, will grow) |
| D | Dockable panels scope | Included in P17-E; true drag-to-dock via `dockview` |
| E | On-canvas overlay cards in Design Assets | **Removed entirely.** Right panel is the single edit surface. |
| — | Dock library | `dockview` (~38KB gzip, TypeScript-first, purpose-built for panel docking) |
| — | Which panels dock | All three: Layers, Media, Properties. All can go left, right, or float. |
| — | Floating panels | Supported (detached over canvas, dismiss on click-outside) |
| — | Builder shell | Mantine `<Modal fullScreen>` + stripped chrome. dockview fills the overlay. No router changes. |
| — | Type rename | `LayoutOverlay` → `LayoutGraphicLayer`, `kind: 'overlay'` → `kind: 'graphic'` in P17 (~15-file diff) |
| — | Zoom/pan canvas | **Deferred to P18.** All 6 desired UX interactions documented below. |

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | `LayoutOverlay` → `LayoutGraphicLayer` throughout | Naming convention finalized in P16 QA. Compiled-only change — `kind` is computed at runtime, not stored in DB. |
| AD-2 | Design Assets section inside Media tab, not its own tab | Avoids fourth-tab proliferation. Campaign media and design assets share the same authoring workflow. |
| AD-3 | Graphic Layers listed above Background in Design Assets | Matches the layer panel's spatial order: top-most element at top; background is always lowest, listed last. |
| AD-4 | On-canvas overlay cards removed entirely | With the right panel surfacing all properties on selection (P17-D), on-canvas cards are fully redundant. Single edit surface reduces "which one do I use?" friction. |
| AD-5 | `dockview` for true drag-to-dock | Purpose-built library, TypeScript-first, actively maintained, ~38KB gzip. Provides drop-zone highlighting, floating panels, resizable splitters, and layout serialization for localStorage persistence. |
| AD-6 | Builder stays as full-screen modal overlay (Option 2) | Mantine `<Modal fullScreen>` strips chrome and gives dockview a full-viewport surface. No router changes, no callsite changes, existing `opened`/`onClose`/`onSaved` API preserved. **Future note:** A full-page route (`/builder/:templateId`) is the cleaner long-term architecture — bookmarkable URLs, fully owned viewport, simpler z-index context. Document as P18+ consideration. |
| AD-7 | All three panels (Layers, Media, Properties) are dockable | Left, right, or floating. The layer panel's top-to-bottom order is the same on either side — no spatial anchoring argument. |
| AD-8 | dockview layout state persisted to `localStorage` | `dockview` has a `toJSON()` / `fromJSON()` API. Key: `'wpsg_builder_layout'`. A `LAYOUT_VERSION` constant guards against stale serialized layouts after code changes. |
| AD-9 | Zoom/pan deferred to P18 with `react-zoom-pan-pinch` | Known incompatibility: react-rnd calculates positions in parent-container coordinates; CSS scale transforms (used by all zoom libraries) break slot drag/resize math unless each `onDragStop`/`onResizeStop` callback divides by the current scale. Fix is known (~10 lines per callback) but adds risk if combined with the already-complex P17 docking restructure. |

---

## Current State Audit

### Left panel tabs (HEAD `ac06b9b`)

| Tab value | Content | Lines in modal |
|-----------|---------|---------------|
| `layers` | `<LayerPanel>` — unified layer list, DnD reorder, keyboard nav | ~60 JSX lines |
| `media` | Campaign selector + `<MediaPickerSidebar>` | ~25 JSX lines |
| `overlays` | Overlay library thumbnails + upload/URL + on-canvas overlay cards (opacity, click-through, fill-canvas, delete) | ~130 JSX lines |
| `bg` | Color picker + background image upload/URL/fit/opacity + remove button | ~110 JSX lines |

`setLeftTab('bg')` is called from two places:
1. Background layer row click in `<LayerPanel>`
2. Background layer keyboard selection

Both will need to be updated to point at the new Design Assets section location.

### Right panel (as of HEAD)

The right panel hot-swaps between:
- **Slot selected** → `<SlotPropertiesPanel>` (position/size/shape/border/objectFit/clickAction/hoverEffect)
- **Background selected** → inline BG controls (color + image, currently also in `bg` tab)
- **Overlay selected** → *nothing* — gap introduced in P16, still open

### `LayoutSlotComponent` drop handler

Currently accepts any `draggedMediaId` from `dataTransfer.getData('media-id')` without checking whether the drop target is a slot (not a graphic layer / background). Graphic layers and the background are not `LayoutSlot` targets, so this only matters if the canvas drop logic is accidentally invoked on them — but the guard makes the intent explicit and future-safe.

---

## Track P17-F — Type Rename (Pre-Work)

**Do this first** — all other tracks consume the renamed types.

### Scope

| Old | New | Notes |
|-----|-----|-------|
| `LayoutOverlay` (interface in `types/index.ts`) | `LayoutGraphicLayer` | Consistent with `LayoutSlot`, `LayoutTemplate` naming |
| `kind: 'overlay'` (in `LayerItem` union, `layerList.ts`) | `kind: 'graphic'` | Computed at runtime — never stored in DB |
| `OverlayLayerItem` (in `layerList.ts`) | `GraphicLayerItem` | Runtime type only |
| `template.overlays` array key | **Stays as `overlays`** | Stored in DB — renaming requires a migration. Type and storage key are intentionally decoupled. |
| `builder.addOverlay()` / `removeOverlay()` etc. | **Stays as-is** | Action names are internal — decouple gradually in P18 |

### Why `template.overlays` stays

The `overlays` key is stored in `wpsg_layout_templates` WP option. Renaming the stored key to `graphicLayers` would require a PHP migration across all existing templates. The TypeScript interface (`LayoutGraphicLayer`) describes *what* the object is; the stored key (`overlays`) describes *where* it lives in the serialized structure. They can differ.

```typescript
// After rename:
export interface LayoutGraphicLayer {
  id: string;
  imageUrl: string;
  // ... (all fields unchanged)
}

export interface LayoutTemplate {
  // ...
  overlays: LayoutGraphicLayer[];  // ← key stays, type renamed
}
```

### Files touched (~15)

`types/index.ts`, `layerList.ts`, `layerList.test.ts`, `useLayoutBuilderState.ts`, `LayoutBuilderModal.tsx`, `LayoutCanvas.tsx`, `LayerRow.tsx`, `LayerPanel.tsx`, `LayerPanel.test.tsx`, `GraphicLayerPropertiesPanel.tsx` (new in P17-D), `LayoutBuilderGallery.tsx`, `class-wpsg-layout-templates.php` (PHP doc comment only — data key unchanged).

---

## Track P17-B — AssetUploader Sub-Component

**New file:** `src/components/Admin/LayoutBuilder/AssetUploader.tsx`  
**Scope:** module-private (exported from the file but not added to `index.ts` unless reuse is needed)

The `FileButton + Loader + Button + TextInput` pattern appears verbatim for both the background image and each graphic layer entry in the library. Extract to a focused component:

```typescript
interface AssetUploaderProps {
  label?: string;
  acceptTypes?: string;        // default: 'image/png,image/svg+xml,image/webp,image/gif'
  isUploading: boolean;
  onFileSelect: (file: File) => void | Promise<void>;
  onUrlSubmit: (url: string) => void | Promise<void>;
  urlPlaceholder?: string;
}
```

Usage in Background section:
```tsx
<AssetUploader
  label="Background image"
  isUploading={isUploadingBg}
  onFileSelect={handleUploadBgImage}
  onUrlSubmit={(url) => builder.setBackgroundImage(url)}
  urlPlaceholder="Paste background image URL…"
/>
```

Usage in Graphic Layers library section:
```tsx
<AssetUploader
  label="Add to library"
  isUploading={isUploadingOverlay}
  onFileSelect={handleUploadOverlay}
  onUrlSubmit={handleAddUrlToLibrary}
  urlPlaceholder="Or paste image URL into library…"
/>
```

This removes ~60 lines of duplication and makes both upload flows consistent (same loading state UX, same keyboard behaviour on the URL input).

---

## Track P17-C — Media Slot Drop Guard

**File:** `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx`

The current `onDrop` handler in `LayoutSlotComponent` reads `draggedMediaId` from `dataTransfer.getData('media-id')` and calls `onAssignMedia`. The `dataTransfer.setData('media-id', ...)` is set in `MediaPickerSidebar`. 

No existing code sets `media-id` on graphic layer or background drags — so there is currently no bug. However, the guard is good defensive practice: make the intent explicit so a future drag refactor cannot accidentally fire media assignment on a non-slot element.

```typescript
// In LayoutSlotComponent onDrop:
const draggedMediaId = e.dataTransfer.getData('media-id');
if (!draggedMediaId) return;   // ← guard: only media drags accepted
onAssignMedia?.(slot.id, draggedMediaId, ...);
```

This is a 1-line addition — minimal risk.

---

## Track P17-D — Graphic Layer Properties Panel

**New file:** `src/components/Admin/LayoutBuilder/GraphicLayerPropertiesPanel.tsx`

When a graphic layer row is selected in the Layer Panel, the right panel (currently blank) renders this component via the existing hot-swap logic in `LayoutBuilderModal`.

### Props

```typescript
interface GraphicLayerPropertiesPanelProps {
  overlay: LayoutGraphicLayer;  // renamed type from P17-F
  overlayIndex: number;         // for display: "Graphic Layer 2"
  onUpdate: (id: string, patch: Partial<LayoutGraphicLayer>) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
}
```

### Properties surfaced

| Property | Control | Notes |
|----------|---------|-------|
| Name | `TextInput` inline | Calls `onRename`; same inline-edit pattern as `SlotPropertiesPanel` header |
| Preview | Small `<img>` thumbnail | 64px height, `object-fit: contain`, dark background |
| Position (x, y) | Two `NumberInput` (%) | Bounds 0–100 |
| Size (width, height) | Two `NumberInput` (%) | Min 1 |
| Opacity | `Slider` 0–1 | Label: `${Math.round(v * 100)}%` |
| Click-through | `Switch` | `!overlay.pointerEvents` |
| Fill canvas | `Button` | Sets x/y/w/h to 0/0/100/100 |
| Z-order | 4-button row (↑↑ ↑ ↓ ↓↓) | Same as `SlotPropertiesPanel` — calls bring/send callbacks |
| Remove | `Button` (red + trash icon) | `onRemove(overlay.id)` with Mantine `useDisclosure`-gated confirm dialog |

### Right panel hot-swap (after P17-D)

| Selection | Right panel |
|-----------|-------------|
| Slot | `<SlotPropertiesPanel>` (unchanged) |
| Graphic layer | `<GraphicLayerPropertiesPanel>` ← new |
| Background | Inline BG controls (unchanged) |
| Nothing | "Select a layer to edit its properties" hint text |

---

## Track P17-A — Design Assets Consolidation

**File:** `LayoutBuilderModal.tsx`

Remove the `overlays` and `bg` tabs from the `<Tabs.List>`. Collapse their content into a new `<Accordion>` section at the bottom of the `media` tab panel, titled **"Design Assets"**.

### Target left panel structure (after P17-A)

```
┌──────────────────────────────┐
│  Tabs: [Layers]  [Media]     │  ← only 2 tabs
├──────────────────────────────┤
│  Tab: Layers                 │
│    <LayerPanel> (unchanged)  │
├──────────────────────────────┤
│  Tab: Media                  │
│                              │
│  ┌── Campaign Media ───────┐ │
│  │  [Select campaign ▼]   │ │
│  │  <MediaPickerSidebar>  │ │
│  └────────────────────────┘ │
│                              │
│  ┌── Design Assets ── [^] ─┐ │  ← Mantine Accordion, state persisted
│  │                          │ │
│  │  Graphic Layers          │ │  ← first (matches layer panel top-to-bottom)
│  │  ─────────────────────  │ │
│  │  Library: [thumb][thumb] │ │
│  │  <AssetUploader>         │ │  ← upload + URL, no on-canvas cards
│  │                          │ │
│  │  Background              │ │  ← scroll target for bg row click
│  │  ─────────────────────  │ │
│  │  [ColorInput]            │ │
│  │  <AssetUploader>         │ │
│  │  [Fit: cover/contain/fill│ │
│  │  [Opacity slider]        │ │
│  └──────────────────────────┘ │
└──────────────────────────────┘
```

### Routing `setLeftTab('bg')` → `setDesignAssetsOpen(true)` + scroll

The two places that currently call `setLeftTab('bg')` will be replaced by:
1. `setLeftTab('media')` — switch to the Media tab
2. `setDesignAssetsOpen(true)` — expand the Design Assets accordion
3. `bgSectionRef.current?.scrollIntoView({ behavior: 'smooth' })` — scroll to the BG sub-section

A `useRef` on the background sub-section heading handles the scroll target.

### State changes

```typescript
// Remove:
const [leftTab, setLeftTab] = useState<string | null>('layers');
// → leftTab values 'bg' and 'overlays' no longer needed

// Keep, narrow type:
const [leftTab, setLeftTab] = useState<'layers' | 'media'>('layers');

// Add — persisted:
const [designAssetsOpen, setDesignAssetsOpen] = useState<boolean>(() => {
  try {
    const stored = localStorage.getItem('wpsg_builder_design_assets_open');
    return stored === null ? true : stored === 'true';  // default open
  } catch { return true; }
});
// On toggle: localStorage.setItem('wpsg_builder_design_assets_open', String(next));
```

### Graphic Layers library — no on-canvas cards

The library grid (thumbnail + add-to-canvas button) remains. Per Decision E, the "On canvas" cards section (individual overlay controls) is removed entirely. Graphic layers on the canvas are managed via the Layer Panel and have their properties editable in the right panel (P17-D).

### Removed: `overlaysVisible` global toggle

`overlaysVisible` was a workaround for the lack of per-layer visibility. With P16 per-element `visible` fields and the Layer Panel eye icon, it is redundant. **Grep all files for `overlaysVisible` before removing** — confirmed callsites: `LayoutBuilderModal.tsx` (state + prop) and `LayoutCanvas.tsx` (prop + usage).

---

## Track P17-E — True Dockable Panels (dockview)

**New dependency:** `dockview` (~38KB gzip, TypeScript-first)  
**Peer requirement:** React >= 16.8 (uses hooks internally). Project is React 18.3.1 — satisfied.

### Builder shell change

Replace the current `<Modal>` chrome with a full-screen overlay using Mantine's `fullScreen` prop and stripped internal styling:

```tsx
<Modal
  fullScreen
  withCloseButton={false}
  styles={{
    body: { padding: 0, height: '100dvh' },
    content: { borderRadius: 0, boxShadow: 'none' },
  }}
>
  {/* dockview fills this — close/save controls live inside as a dockview panel or toolbar overlay */}
</Modal>
```

This preserves the existing `opened` / `onClose` / `onSaved` prop API, WP admin z-index context, Mantine's keyboard focus trap, and ESC-to-close — while giving dockview a true full-viewport surface.

> **Future consideration (P18+):** A full-page route (`/builder/:templateId`) is the cleaner long-term architecture: fully owned viewport, bookmarkable/shareable builder URLs, removes modal z-index management entirely. Worth revisiting once the admin SPA router is more established.

### dockview integration sketch

```tsx
import { DockviewReact, type DockviewReadyEvent } from 'dockview';

// Panels registered by component ID:
// 'layers'     → LayerPanelWrapper
// 'media'      → MediaPanelWrapper (campaign selector + MediaPickerSidebar + Design Assets)
// 'canvas'     → CanvasPanelWrapper (toolbar + LayoutCanvas — center group, not moveable)
// 'properties' → PropertiesPanelWrapper (hot-swaps slot / graphic / bg panels)

function onReady(e: DockviewReadyEvent) {
  const stored = localStorage.getItem('wpsg_builder_layout');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Guard against stale layouts from old code versions:
      if (parsed.version === LAYOUT_VERSION) { e.api.fromJSON(parsed); return; }
    } catch { /* fall through to default */ }
  }

  // Default layout:
  const canvasGroup = e.api.addGroup();
  e.api.addPanel({ id: 'canvas', component: 'canvas',
    position: { referenceGroup: canvasGroup } });

  const leftGroup = e.api.addGroup({
    position: { direction: 'left', referenceGroup: canvasGroup, size: 240 } });
  e.api.addPanel({ id: 'layers', component: 'layers',
    position: { referenceGroup: leftGroup } });

  const rightGroup = e.api.addGroup({
    position: { direction: 'right', referenceGroup: canvasGroup, size: 280 } });
  e.api.addPanel({ id: 'media', component: 'media',
    position: { referenceGroup: rightGroup } });
  e.api.addPanel({ id: 'properties', component: 'properties',
    position: { referenceGroup: rightGroup } });
}

// Persist on change:
// dockviewApi.onDidLayoutChange(() => {
//   localStorage.setItem('wpsg_builder_layout',
//     JSON.stringify({ version: LAYOUT_VERSION, ...dockviewApi.toJSON() }));
// });
```

### Panel configuration

| Panel | Default side | Can float | Min width |
|-------|-------------|-----------|----------|
| Layers | Left | Yes | 200px |
| Media (+ Design Assets) | Right (initial) | Yes | 220px |
| Properties | Right | Yes | 240px |
| Canvas | Center (fixed, non-moveable) | No | 300px |

All three non-canvas panels can be dragged to either side or floated as detached overlays.

### Layout reset

A `"Reset layout"` button in the toolbar (next to save/undo) calls:
```typescript
dockviewApi.fromJSON(DEFAULT_LAYOUT);
localStorage.removeItem('wpsg_builder_layout');
```

### Styling dockview to match Mantine theme

dockview exposes CSS custom properties (e.g. `--dv-activegroup-hiddenpanel-tab-background-color`). Override them in a scoped CSS block targeting `.dockview-react` to match Mantine's color tokens. No CSS modules needed — a single `<style>` injected into the modal body.

---

## Deferred to P18 — Zoomable Canvas & Hand Tool

All UX decisions captured for the P18 plan. All 6 desired interactions confirmed:

| Interaction | Notes |
|-------------|-------|
| Space + drag | Temporary hand/pan mode while key is held. Standard across all design tools. |
| Dedicated hand tool button | Permanent toggle in canvas toolbar. |
| Mouse wheel = zoom | No modifier key required. |
| Pinch-to-zoom | Trackpad / touch support. |
| Double-click canvas bg | Reset zoom to 100% + re-center. |
| Zoom % indicator | Displayed in toolbar; click to reset to 100%. |

**Implementation plan for P18:**
- Library: `react-zoom-pan-pinch` v3.x (~14KB gzip, TypeScript-first)
- **react-rnd coordinate fix (known):** `onDragStop` and `onResizeStop` divide raw position values by `transformState.scale` — approximately 10 lines per callback, patched in `LayoutSlotComponent.tsx` and the overlay `Rnd` wrapper in `LayoutCanvas.tsx`
- Zoom range: 25%–400%
- Pure design-time transform — zero impact on gallery rendering or stored slot positions

---

## Execution Priority

| Sprint | Track | Prerequisite | Risk |
|--------|-------|-------------|------|
| 1 | **P17-F** — Type rename | None | Low (compile-time only) |
| 2 | **P17-B** — AssetUploader + **P17-C** — Drop guard | P17-F | Low |
| 3 | **P17-D** — GraphicLayerPropertiesPanel | P17-F, P17-B | Low–Medium |
| 4 | **P17-A** — Design Assets consolidation | P17-B, P17-D | Medium |
| 5 | **P17-E** — dockview true dock | P17-A complete (modal layout stable) | Medium–High |

Sprints in the same row can be parallelised. Run `npm run build:wp` and `npx vitest run` after every sprint.

---

## Testing Strategy

| File | Tests | Coverage |
|------|-------|----------|
| `layerList.test.ts` (update) | ±0 new, ~4 updated | `kind: 'graphic'` assertion updates after P17-F |
| `LayerPanel.test.tsx` (update) | ±0 new, ~3 updated | `kind` rename in test fixtures |
| `AssetUploader.test.tsx` | ~8 | Renders upload button + URL input; `onFileSelect` on file pick; `onUrlSubmit` on Enter; loader when `isUploading`; disabled state |
| `GraphicLayerPropertiesPanel.test.tsx` | ~12 | Renders name, position, opacity; slider calls `onUpdate`; fill-canvas button; remove triggers confirm dialog; z-order buttons |
| `LayoutBuilderModal.test.tsx` (new/extend) | ~8 | Design Assets in Media tab; BG controls present; graphic layer library button; no on-canvas cards; background row click expands Design Assets + scrolls |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| P17-F type rename missed in a callsite → TS error | Low | Low | `tsc --noEmit` after P17-F sprint; CI blocks on type errors |
| Removing `overlaysVisible` prop breaks `LayoutCanvas` | Medium | Low | Per-element `overlay.visible` already drives opacity in `LayoutCanvas`; grep all usages before removal |
| `setLeftTab('bg')` callsites missed → background row click does nothing | Medium | Low | Grep for `'bg'` string in modal before removing; add regression test |
| dockview CSS conflicts with Mantine | Medium | Medium | Override dockview CSS custom properties in a scoped block targeting `.dockview-react`; namespace cleanly |
| dockview floating panels lose Mantine Modal focus trap | Medium | Low | Mantine's focus trap is document-wide; dockview floating panels use `ReactDOM.createPortal` — verify Mantine honors portaled elements in focus trap chain before shipping P17-E |
| dockview stale layout JSON after a panel rename | Low | Medium | `LAYOUT_VERSION` constant guards serialized layout; mismatched version falls through to default and clears storage |
| `bgSectionRef.scrollIntoView` no-ops in jsdom tests | Low | High | `scrollIntoView` is already mocked in `setup.ts`; assert `setDesignAssetsOpen(true)` was called instead |

---

## Modified File Inventory (projected)

### New files

| File | Track |
|------|-------|
| `src/components/Admin/LayoutBuilder/AssetUploader.tsx` | P17-B |
| `src/components/Admin/LayoutBuilder/GraphicLayerPropertiesPanel.tsx` | P17-D |

### Modified files

| File | Tracks | Change summary |
|------|--------|---------------|
| `src/types/index.ts` | P17-F | `LayoutOverlay` → `LayoutGraphicLayer` |
| `src/utils/layerList.ts` | P17-F | `kind: 'overlay'` → `kind: 'graphic'`, `OverlayLayerItem` → `GraphicLayerItem` |
| `src/utils/layerList.test.ts` | P17-F | Update `kind` assertions |
| `src/hooks/useLayoutBuilderState.ts` | P17-F | All `LayoutOverlay` references |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | P17-F, P17-A, P17-D, P17-E | Type rename; remove overlays+bg tabs; Design Assets accordion; `GraphicLayerPropertiesPanel` wiring; dockview shell |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | P17-F, P17-A | Type rename; remove `overlaysVisible` prop |
| `src/components/Admin/LayoutBuilder/LayerRow.tsx` | P17-F | `kind: 'overlay'` → `kind: 'graphic'` |
| `src/components/Admin/LayoutBuilder/LayerPanel.tsx` | P17-F | `kind: 'overlay'` → `kind: 'graphic'` |
| `src/components/Admin/LayoutBuilder/LayerPanel.test.tsx` | P17-F | Update `kind` in fixtures |
| `src/components/Admin/LayoutBuilder/LayoutBuilderGallery.tsx` | P17-F | `LayoutOverlay` → `LayoutGraphicLayer` |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | P17-C | 1-line drop guard |
| `src/components/Admin/LayoutBuilder/index.ts` | P17-B, P17-D | New component exports |
| `wp-plugin/.../class-wpsg-layout-templates.php` | P17-F | Doc comment only (data key `overlays` unchanged) |

---

*Plan finalized: February 26, 2026. All tracks delivered — see Addendum below.*

---

## Addendum — Delivery Summary & Coverage Assessment (February 26, 2026)

### Track Status at Merge

| Track | Commit | Status |
|-------|--------|--------|
| P17-F — Type rename (`LayoutOverlay` → `LayoutGraphicLayer`) | `9bf0488` | ✅ |
| P17-B — `AssetUploader` sub-component | `d12b4e3` | ✅ |
| P17-C — Media slot drop guard | `d12b4e3` | ✅ |
| P17-D — `GraphicLayerPropertiesPanel` + right-panel wiring | `e0721a8` | ✅ |
| P17-A — Design Assets consolidation (overlay+bg tabs → accordion) | `bfc0ef0` | ✅ |
| P17-E — dockview true dock (DockviewReact replaces 3-column flex) | `d6570e2` | ✅ |

### Build & Bundle (post P17-E)

`dockview` was split into its own vendor chunk in `vite.config.ts` after P17-E raised the admin chunk above 600 kB raw:

| Chunk | Raw | Gzip |
|-------|-----|------|
| `vendor-dockview` | ~100–150 kB | ~38 kB |
| `admin` | ~560 kB (est. after split) | ~149 kB (est.) |

The real-world download cost is the gzip number. See `FUTURE_TASKS.md § Async Chunk Candidates` for the next step: loading `LayoutBuilderModal` itself via `React.lazy()`.

---

### JavaScript / TypeScript Coverage Assessment

**Baseline at P17-E merge (vitest v8 coverage):**

| Metric | Actual | Target | Gap |
|--------|--------|--------|-----|
| Statements | 69.27 % | 75 % | −5.73 pp |
| Branches | 73.63 % | 75 % | −1.37 pp |
| Functions | 41.48 % | 75 % | −33.52 pp |
| Lines | 69.27 % | 75 % | −5.73 pp |

**Root cause of low function coverage:** Six gallery adapter components (`circular`, `compact-grid`, `diamond`, `hexagonal`, `justified`, `masonry`) have **0 % coverage** across all metrics. Together they represent the majority of the function gap. These are pure rendering components that need render-smoke tests.

**Files needing the most attention (ranked by impact × effort):**

| File | Stmts % | Funcs % | Priority |
|------|---------|---------|----------|
| Gallery adapters (6 files, ~1 000 lines) | 0 % | 0 % | 🔴 High — smoke tests would move the needle significantly |
| `MediaTab.tsx` | 65.6 % | 47.5 % | 🟠 Medium — large admin component, many untested handlers |
| `AdminPanel.tsx` | 74.9 % | 45.2 % | 🟠 Medium |
| `App.tsx` | 64.4 % | 55.6 % | 🟠 Medium — orchestration, some flows not tested |
| `useMediaDimensions.ts` | 0 % | 0 % | 🟡 Low-medium — measured hook, needs ResizeObserver mock |
| `ErrorBoundary.tsx` | 18.2 % | 0 % | 🟡 Low — small component, easy to test |
| `DotNavigator.tsx` | 58.4 % | 50 % | 🟡 Low |

**What already passes:** `src/utils`, `src/themes`, `src/hooks` (minus `useMediaDimensions`), `src/services/auth`, `src/contexts` — all at 80 %+ and above target.

**Path to 75 % overall:**  
1. Add render-smoke tests for all six gallery adapters (~18–24 tests) — estimated +8 pp functions, +3 pp statements.  
2. Add coverage for untested `MediaTab` / `AdminPanel` handlers — estimated +2 pp statements.  
3. Add `ErrorBoundary` and `DotNavigator` tests — trivial, +1 pp.  
4. Add `useMediaDimensions` tests with `ResizeObserver` mock — +0.5 pp.

Suggested phase: **P18-QA sprint** before the P18 zoom/pan canvas work.

---

### PHP Coverage Assessment

**Baseline at P17-E merge (PHPUnit 9.6, 86 tests, 249 assertions, 0 failures):**

PHP coverage tooling (Xdebug/pcov) is not installed in the wp-env container, so line-level metrics are unavailable. Test-case coverage is assessed by class.

| Class | Test file | Covered scenarios |
|-------|-----------|-------------------|
| `WPSG_Settings` | `WPSG_Settings_Test` (20 tests) | Defaults, get_setting, sanitize (auth, theme, layout, booleans, cache_ttl, api_base, clamp, filter) |
| `WPSG_Settings` REST | `WPSG_Settings_Rest_Test` (3 tests) | Public GET, admin POST, subscriber blocked |
| `WPSG_REST` campaigns | `WPSG_Campaign_Rest_Test` (1 test) | Full create-update-archive-restore flow |
| `WPSG_REST` capability | `WPSG_Capability_Test` (3 tests) | Subscriber blocked, `manage_wpsg` allows create, settings update blocked |
| `WPSG_REST` routes | `WPSG_REST_Routes_Test` (5 tests) | Route registration, valid/invalid mediaId patterns, direct handler call |
| `WPSG_Layout_Templates` | `WPSG_Layout_Templates_Test` (20+ tests) | Create/read/update/delete/duplicate, slot/overlay CRUD, validation, migration, size-limit |
| `WPSG_Overlay_Library` | `WPSG_Overlay_Library_Test` (13 tests) ← **new in P17** | get_all (empty, corrupt, order), add (structure, UUID, sanitize name/URL, persist, multi), remove (success, missing, targeted, unset option) |
| `WPSG_REST` oEmbed proxy | `ProxyOEmbedTest` (5 tests) | Missing URL, no host, cached payload, allowed provider, SSRF block |
| `WPSG_REST` oEmbed SSRF | `ProxyOEmbedSSRFTest` (10+ tests) | Private IP ranges, localhost, blocked schemes |

**Untested classes (known gaps):**

| Class | Reason | Priority |
|-------|---------|----------|
| `WPSG_CPT` (custom post type registration) | WordPress hooks — hard to assert in unit tests | Low |
| `WPSG_DB` (database migrations/schema) | Needs DB setup; covered implicitly by REST tests | Low–medium |
| `WPSG_Embed` (shortcode rendering) | PHP output; needs HTML assertion tests | Medium |
| `WPSG_ThumbnailCache` | External HTTP; needs mock transport | Low |
| `WPSG_RateLimiter` | Transient-based; testable with WP transients | Medium |
| `WPSG_Maintenance` | Admin-only hooks | Low |
| `WPSG_ImageOptimizer` | File I/O; needs fixture images | Low |
| oEmbed providers (`providers/`) | Already covered by proxy + SSRF tests indirectly | Low |

**Immediate gaps worth closing:**

1. **`WPSG_RateLimiter`** — Core security feature; `check()` / `increment()` / `reset()` are independently testable using WP transients. ~8-10 tests.  
2. **`WPSG_Embed` shortcode** — `render_shortcode()` could be tested with `do_shortcode('[wpsg_gallery id="..."]')` assertions. ~6 tests.  
3. **WPSG campaign REST — edge cases** — 404 on unknown ID, archived campaign restore idempotency, duplicate title handling. ~4-6 tests.

**Suggested phase:** Include PHP coverage gap-fill in the same **P18-QA sprint** as the JS adapter tests.

---

*Addendum written: February 26, 2026.*

