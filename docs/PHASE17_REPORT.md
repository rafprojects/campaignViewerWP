# Phase 17 — Builder UX: Design Assets Consolidation & Dockable Panels

**Status:** 📋 Planning  
**Version:** v0.15.0 (target)  
**Created:** February 26, 2026  

---

## Table of Contents

1. [Rationale](#rationale)
2. [Architecture Decisions](#architecture-decisions)
3. [Current State Audit](#current-state-audit)
4. [Track P17-A — Design Assets Consolidation](#track-p17-a--design-assets-consolidation)
5. [Track P17-B — AssetUploader Sub-Component](#track-p17-b--assetuploader-sub-component)
6. [Track P17-C — Media Slot Drop Guard](#track-p17-c--media-slot-drop-guard)
7. [Track P17-D — Overlay Properties in Right Panel](#track-p17-d--overlay-properties-in-right-panel)
8. [Track P17-E — Dockable Panels](#track-p17-e--dockable-panels)
9. [Open Questions / Choices](#open-questions--choices)
10. [Execution Priority](#execution-priority)
11. [Testing Strategy](#testing-strategy)
12. [Risk Register](#risk-register)

---

## Rationale

Phase 16 delivered a unified layer panel that surfaces all elements (slots, graphic layers, background) in a single scrollable list. Two friction points remain:

### Friction 1 — Four tabs, two of which serve the same conceptual purpose

The current left panel has four tabs: **Layers | Media | Overlays | BG**.

`Overlays` and `BG` are both template-level design asset tools — the admin picks or uploads a graphic to decorate the canvas. They differ only in their layer position (overlays occupy a zIndex slot; background is beneath everything). Forcing the user to know this distinction in order to find the right tab is unnecessary cognitive load.

`Media` is fundamentally different in nature: it manages campaign-specific photos and videos that fill the assignable slots. It belongs in its own section, but does not need a full peer tab alongside design asset tools.

### Friction 2 — Rigid panel layout wastes screen space on wide monitors

The modal currently locks `[Layers+Media] | [Canvas] | [Properties]` regardless of screen width or workflow preference. Designers often want the canvas central and as wide as possible, pushing both asset panels to one side. Others want properties on the left when editing text-heavy overlays. A lightweight toggle-based dock covers the realistic configuration space with ~200 lines and zero new dependencies. 

### Friction 3 — Overlay properties not surfaced via layer panel

Clicking a graphic layer row in the layer panel selects it visually but the right panel shows nothing (it only responds to slot selections). To edit opacity or click-through on a graphic layer, the user must switch to the Overlays tab. This breaks the "layer panel is the single interaction surface" principle introduced in P16.

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | Naming: "Graphic Layer" / "Design Assets" (not "Overlay") | Follows naming convention finalized in P16 QA. "Overlay" implies covering something; graphic layers can sit at any z-position. Consistent with `getLayerName()` output already shipping. |
| AD-2 | Design Assets section lives **inside** the Media tab | The Media tab already exists and is the natural home for left-panel content when layers are hidden. Adding a collapsible `Design Assets` accordion section avoids a third-or-fourth tab proliferation. |
| AD-3 | Background controls merge into Design Assets section | Background image and graphic layers share upload/URL flow. Zero data-model impact — both write to existing `LayoutTemplate` fields. |
| AD-4 | Background tab (`value="bg"`) **removed** from tab bar | Clicking the Background layer row in Layer Panel already switches to the BG properties via `setLeftTab('bg')`. With P17, it will instead expand the Design Assets section and scroll to the BG sub-section. |
| AD-5 | `AssetUploader` extracted as a reusable sub-component | Both Background image and each Graphic Layer share the same `FileButton + TextInput URL` pattern. Extracting avoids ~60 lines of duplication. Scoped to this file initially — no public export needed. |
| AD-6 | Drop guard: `MediaItem` drag must resolve to a slot | Currently nothing prevents a user from accidentally triggering a media-assign on a graphic layer or the background. An explicit type-check in `LayoutSlotComponent`'s drop handler closes this gap cleanly. |
| AD-7 | Overlay properties render in right `SlotPropertiesPanel` (or parallel `GraphicLayerPropertiesPanel`) | The right panel already hot-swaps between slot properties and background properties based on selection. Adding a graphic layer branch is a natural extension. The only question is whether to extend the existing `SlotPropertiesPanel` component or create a focused `GraphicLayerPropertiesPanel`. See [Choice C](#choice-c--graphic-layer-properties-implementation). |
| AD-8 | Dockable panels: toggle-based, `localStorage` persisted | Full drag-to-dock is ~600 lines with hit testing. A simple ←/→ toggle achieves 95% of the value with ~200 lines and zero new dependencies. |
| AD-9 | Layers panel is **left-anchored** — not dockable | The layer panel has spatial coupling with the canvas (layer row hovers, drag-to-reorder hit areas). Moving it to the right would require inverting all spatial intuition. Media and Properties panels are not spatially coupled and can toggle freely. |

---

## Current State Audit

### Left panel tabs (as of HEAD `ac06b9b`)

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

## Track P17-A — Design Assets Consolidation

**Files affected:** `LayoutBuilderModal.tsx`

Remove the `overlays` and `bg` tabs from the `<Tabs.List>`. Collapse their content into a new `<Accordion>` (or Mantine `<Collapse>`) section at the bottom of the `media` tab panel, titled **"Design Assets"**.

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
│  └─────────────────────────┘ │
│                              │
│  ┌── Design Assets ── [^] ─┐ │  ← Mantine Accordion, open by default
│  │                          │ │
│  │  Background              │ │
│  │  ─────────────────────  │ │
│  │  [ColorInput]            │ │
│  │  [Image: upload | URL]   │ │
│  │  [Fit: cover/contain/fill│ │
│  │  [Opacity slider]        │ │
│  │                          │ │
│  │  Graphic Layers          │ │
│  │  ─────────────────────  │ │
│  │  Library: [thumb][thumb] │ │
│  │  [Upload] [URL input]    │ │
│  │  On canvas: [card][card] │ │
│  └─────────────────────────┘ │
└──────────────────────────────┘
```

### Routing `setLeftTab('bg')` → `setDesignAssetsOpen(true)` + scroll

The two places that currently call `setLeftTab('bg')` will be replaced by:
1. `setLeftTab('media')` — switch to the Media tab
2. `setDesignAssetsOpen(true)` — expand the Design Assets accordion
3. `designAssetsRef.current?.scrollIntoView({ behavior: 'smooth' })` — scroll to the BG sub-section

A `useRef` on the background sub-section heading handles the scroll target.

### State changes

```typescript
// Remove:
const [leftTab, setLeftTab] = useState<string | null>('layers');
// → leftTab values 'bg' and 'overlays' no longer needed

// Keep, rename intent:
const [leftTab, setLeftTab] = useState<'layers' | 'media'>('layers');

// Add:
const [designAssetsOpen, setDesignAssetsOpen] = useState(true);
```

### Impact on `LayerPanel`

The `onSelectBackground` prop currently does `setLeftTab('bg')`. After P17-A it will do:
```typescript
onSelectBackground={() => {
  setLeftTab('media');
  setDesignAssetsOpen(true);
  // scroll on next tick
  requestAnimationFrame(() =>
    bgSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  );
}}
```

### Removed: `overlaysVisible` global toggle

The `overlaysVisible` toggle in the old Overlays tab header was a workaround for the lack of per-layer visibility. With P16 per-layer `visible` field and the Layer Panel eye icon, the global toggle is redundant. It will be removed in P17-A.

> **Note:** `overlaysVisible` is currently passed to `<LayoutCanvas>`. Removing it requires checking `LayoutCanvas` and `LayoutOverlayComponent` — the per-element `visible` prop already drives opacity there, so the prop removal should be clean.

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

## Track P17-D — Overlay Properties in Right Panel

**File:** `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx`  
**New file (Option A):** `src/components/Admin/LayoutBuilder/GraphicLayerPropertiesPanel.tsx`

When a graphic layer row is selected in the Layer Panel, the right panel currently renders nothing. P17-D adds a graphic layer properties panel that surfaces the same controls currently buried in the Overlays tab's "On canvas" cards.

### Properties to expose

| Property | Control | Notes |
|----------|---------|-------|
| Name | `TextInput` (inline rename) | Syncs with layer row rename — calls `builder.renameOverlay()` |
| Position (x, y) | `NumberInput` pair | % values, same pattern as `SlotPropertiesPanel` |
| Size (width, height) | `NumberInput` pair | % values |
| Opacity | `Slider` 0–1 | `Math.round(v * 100)%` label |
| Click-through | `Switch` | `!overlay.pointerEvents` |
| Fill canvas | `Button` | Sets x/y/w/h to 0/0/100/100 |
| z-index reorder | `bringToFront / sendToBack / bringForward / sendBackward` | Same 4-button row as slot properties |
| Remove from canvas | `Button` (red, danger) | Calls `builder.removeOverlay(id)` |

### Implementation choice

See [Choice C](#choice-c--graphic-layer-properties-implementation) below.

### Right panel hot-swap logic (after P17-D)

```typescript
// Currently:
// slot selected → <SlotPropertiesPanel>
// background selected → inline BG controls
// overlay selected → nothing

// After P17-D:
// slot selected    → <SlotPropertiesPanel>
// overlay selected → <GraphicLayerPropertiesPanel> (or extended SlotPropertiesPanel)
// background selected → inline BG controls (unchanged; now also in Design Assets section)
// nothing selected → "Select a layer to edit its properties" hint
```

---

## Track P17-E — Dockable Panels

**Files affected:** `LayoutBuilderModal.tsx` (layout logic), possibly a new `useDockState.ts` hook

### Scope

Two panels are dockable: **Media** and **Properties**. The **Layers** panel stays left-anchored (spatial coupling with canvas).

```typescript
type DockSide = 'left' | 'right';

interface DockState {
  media: DockSide;       // default: 'left'
  properties: DockSide;  // default: 'right'
}
```

Persisted to `localStorage` under key `'wpsg_builder_dock'`. Loaded once on modal open; written on every toggle.

### The 4 configurations

| Config | media | properties | Use case |
|--------|-------|------------|----------|
| A (default) | left | right | Standard — Layers+Media left, Properties right |
| B | left | left | Both panels left; canvas full right |
| C | right | right | Both panels right; canvas full left |
| D | right | left | Swapped — Properties left, Media right |

Config B and C produce a single column on one side with the canvas filling the other side entirely. Config D is the "power user" layout for editing slot properties while browsing media.

### Modal layout structure

The modal currently uses a manual `<Group>` with three fixed children. After P17-E it becomes driven by the dock state:

```tsx
function buildColumns(dock: DockState, panels: Record<string, ReactNode>) {
  const left: ReactNode[] = [panels.layers];
  const right: ReactNode[] = [];

  if (dock.media === 'left')       left.push(panels.media);
  else                             right.push(panels.media);

  if (dock.properties === 'left')  left.push(panels.properties);
  else                             right.push(panels.properties);

  return { left, right };
}
```

Each side renders as a `<Stack>` with `gap={0}`. The canvas sits between them and fills remaining width via `flex: 1`.

### Dock toggle button

Small `←` / `→` `<ActionIcon>` in the header of each dockable panel. Only visible on panel hover (CSS `opacity: 0` → `1` on `:hover`) to avoid persistent visual noise.

```
Media panel header:
  [Media]                        [→]   ← dock-to-right button (hover-only)
```

Tooltip: `"Move to right side"` / `"Move to left side"`.

### `useDockState` hook

```typescript
// src/hooks/useDockState.ts
export function useDockState() {
  const [dock, setDock] = useState<DockState>(() => {
    try {
      const stored = localStorage.getItem('wpsg_builder_dock');
      return stored ? JSON.parse(stored) : DEFAULT_DOCK;
    } catch {
      return DEFAULT_DOCK;
    }
  });

  const toggleDock = useCallback((panel: keyof DockState) => {
    setDock((prev) => {
      const next = { ...prev, [panel]: prev[panel] === 'left' ? 'right' : 'left' };
      localStorage.setItem('wpsg_builder_dock', JSON.stringify(next));
      return next;
    });
  }, []);

  return { dock, toggleDock };
}
```

### Constraint: both panels on the same side

When both `media` and `properties` are docked to the same side, they stack vertically within a single side column. The canvas still fills the remaining width. No special handling needed — the column simply grows taller.

---

## Open Questions / Choices

The following decisions need sign-off before implementation begins.

---

### Choice A — Graphic Layers section ordering within Design Assets

**Context:** The Design Assets accordion has two sub-sections: Background and Graphic Layers. Which comes first?

| Option | Order | Rationale |
|--------|-------|-----------|
| **A1 (recommended)** | Background → Graphic Layers | Background is the lowest layer conceptually and the most commonly configured. Graphic Layers are added iteratively. |
| A2 | Graphic Layers → Background | Matches the layer panel's visual order (graphic layers above background). Consistent spatial metaphor. |

---

### Choice B — Design Assets accordion default state

**Context:** Should the Design Assets section be expanded or collapsed when the Media tab is first opened (fresh modal open)?

| Option | Default | Notes |
|--------|---------|-------|
| **B1 (recommended)** | Open | Design assets are commonly configured and shouldn't require an extra click to reach. |
| B2 | Closed | Keeps the Media tab focused on campaign media by default; Design Assets is a secondary concern. |
| B3 | Persisted to localStorage | Remembers the last state. Adds ~3 lines. |

---

### Choice C — Graphic Layer Properties implementation

**Context:** When a graphic layer is selected in the Layer Panel, the right panel needs to show its editable properties. Two implementation approaches:

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **C1 (recommended)** | New `GraphicLayerPropertiesPanel.tsx` component | Clean separation; slots and overlays have genuinely different property sets; each component stays ≤200 lines | One more file |
| C2 | Extend `SlotPropertiesPanel.tsx` to accept `overlay` prop with conditional rendering | Fewer files, reuses panel frame and z-order buttons | `SlotPropertiesPanel` is already 350 lines and adds branching complexity |

---

### Choice D — Dockable panels scope for P17

**Context:** P17-E is the largest track by LOC. It can be deferred to P18 if the Design Assets consolidation (P17-A–D) is the higher-value delivery.

| Option | Scope | Notes |
|--------|-------|-------|
| D1 | Include P17-E in P17 | Both touch `LayoutBuilderModal.tsx`; doing layout restructure once for two features is more efficient |
| **D2 (recommended)** | Include P17-E in P17 but treat as a stretch goal | Start P17-A–D; add P17-E if time permits. If P17-E slips, it ships in P18 without blocking P17-A–D |
| D3 | Defer P17-E to P18 | Safe; P17-A–D still deliver clear value |

---

### Choice E — On-canvas overlay cards in Design Assets section

**Context:** The current Overlays tab has "On canvas" cards below the library (showing opacity slider, fill-canvas button, delete, click-through per overlay). With P17-D surfacing these in the right panel when the overlay is selected, the on-canvas cards become partially redundant.

| Option | Treatment | Notes |
|--------|-----------|-------|
| **E1 (recommended)** | Keep minimal on-canvas list (thumbnail + name + delete only); full properties go to right panel | The list is useful for quick deletion and overview; full editing in right panel is the canonical flow |
| E2 | Remove on-canvas cards entirely | Cleaner. User must use Layer Panel to select, then edit in right panel. Relies on P17-D being solid. |
| E3 | Keep full on-canvas cards as-is | Redundant with right panel but zero regression risk |

---

## Execution Priority

| Sprint | Tracks | Prerequisite | Risk |
|--------|--------|-------------|------|
| 1 | P17-B (`AssetUploader`) | None — pure new component | Low |
| 2 | P17-C (drop guard) | None — 1-line addition | Low |
| 3 | P17-D (`GraphicLayerPropertiesPanel`) | P17-B (for AssetUploader if needed) | Low—Medium |
| 4 | P17-A (Design Assets consolidation) | P17-B, P17-D complete | Medium (modal restructure) |
| 5 | P17-E (dockable panels) *(stretch)* | P17-A complete (modal layout stable) | Medium |

Sprint 4 is the highest regression risk — removing two tabs and routing their content. Running the full test suite and building `build:wp` after each sprint milestone is mandatory.

---

## Testing Strategy

| File | Tests | What to cover |
|------|-------|--------------|
| `AssetUploader.test.tsx` | ~8 | Renders upload button; renders URL input; calls `onFileSelect` on file pick; calls `onUrlSubmit` on Enter; shows loader when `isUploading=true` |
| `GraphicLayerPropertiesPanel.test.tsx` | ~12 | Renders overlay name, position, opacity; slider change calls `onUpdateOverlay`; fill-canvas button; remove button; z-order buttons call correct callbacks |
| `LayoutBuilderModal.test.tsx` (extend) | ~6 new | Design Assets section visible in Media tab; background controls present; graphic layer upload button present; overlay card present after adding overlay |
| `useDockState.test.ts` | ~6 | Default state; toggle media dock; toggle properties dock; persists to localStorage; reads from localStorage on init; handles corrupt stored value |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Removing `overlaysVisible` prop breaks `LayoutCanvas` | Medium | Low | `LayoutCanvas` already drives per-element visibility via `overlay.visible`; grep for all `overlaysVisible` usages before removal |
| `setLeftTab('bg')` callsites missed → background layer click does nothing | Medium | Low | Grep for `'bg'` string in modal before removing tab; add regression test for background row click → Design Assets open |
| Dock state causes layout shift on first render (before localStorage read) | Low | Medium | Initialize from localStorage synchronously in `useState(() => ...)` initializer (already shown in `useDockState` sketch) — avoids flash |
| P17-A modal restructure causes existing test snapshots to fail | Medium | Medium | No snapshot tests in this codebase — all tests use RTL queries; restructure is safe as long as rendered text and accessible labels are preserved |
| Stacking two docked panels on same side creates overflow on short viewports | Low | Low | Right panel and Media panel get `ScrollArea.Autosize` wrappers with `mah` cap — already pattern used in current modal |

---

## Modified File Inventory (projected)

| File | Track | Change |
|------|-------|--------|
| `src/components/Admin/LayoutBuilder/AssetUploader.tsx` | P17-B | **New** — `AssetUploader` sub-component |
| `src/components/Admin/LayoutBuilder/GraphicLayerPropertiesPanel.tsx` | P17-D | **New** — graphic layer property editor (if Choice C1 accepted) |
| `src/hooks/useDockState.ts` | P17-E | **New** — dock toggle + localStorage persistence |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | P17-A, P17-D, P17-E | Remove `overlays`/`bg` tabs; add Design Assets accordion; wire `GraphicLayerPropertiesPanel`; add dock toggle buttons and column-order logic |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | P17-C | Add 1-line `media-id` guard in `onDrop` |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | P17-A | Remove `overlaysVisible` prop (replaced by per-element `visible`) |
| `src/components/Admin/LayoutBuilder/index.ts` | P17-B, P17-D | Add new component exports |

---

*Plan written: February 26, 2026. Awaiting sign-off before implementation begins.*
