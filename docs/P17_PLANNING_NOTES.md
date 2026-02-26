# P17 Planning Notes — Media Redesign & Dockable Panels

> Temporary working doc. Promote to PHASE17_REPORT.md when implementation begins.
> Created: February 26, 2026

---

## 1. Media / Design Assets Redesign

### Problem (QA feedback)
- Overlays tab and BG tab are design-asset tools that live separate from each other but serve the same purpose (template-level branding graphics).
- "Overlay" as a concept/name is too specific; it implies covering something, but these are general graphic elements that can sit at any z-position.
- Campaign media (photos/videos for gallery slots) and design assets (graphics, background images) are fundamentally different things that should not be mixed.
- There is no logical reason an overlay image requires a separate tab from the background image — both are template-level, campaign-agnostic uploads.

### Proposed Structure

**Left panel — Media tab (single tab):**

```
┌─────────────────────────────┐
│ Campaign:  [Select ▼]       │
│                             │
│  ┌─ Campaign Media ────────┐│
│  │  [thumb] [thumb] [thumb]││
│  │  (assignable to media   ││
│  │   layer slots only)     ││
│  └─────────────────────────┘│
│                             │
│  ┌─ Design Assets ─── [^] ─┐│  ← collapsible
│  │  Background              ││
│  │    [color] [image] [url] ││
│  │                          ││
│  │  Graphic Layers          ││
│  │    [+ Add graphic layer] ││
│  │    [lib thumb] [lib thumb]││
│  │    Upload / URL          ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

**Key rules:**
- Campaign media items are **drag-assignable to Media Layer slots only** — the picker already guards this; no change needed in the canvas drop handler.
- Design asset items (graphic layers, background image) are **not** drag-assignable to media slots — add a type guard in `MediaPickerSidebar` / `LayoutSlotComponent` drop handler.
- Background image and graphic layers share the same upload/library flow — DRY up the FileButton + TextInput URL pattern into a small `AssetUploader` sub-component.

### Naming convention (finalized in P16 QA)
| Old name | New name | Why |
|---|---|---|
| Slot N | Media Layer N | Describes what it holds, not its internal model name |
| Overlay N | Graphic Layer N | Not all graphic layers "overlay" — some are below media |
| Overlay (tab) | Design Assets (section) | Broader, accurate scope |
| BG (tab) | (merged into Design Assets) | Same flow, no need for separate tab |

### Tabs after redesign
**Before (P16):** Layers | Media | Overlays | BG  
**After (P17):** Layers | Media  
(Media tab contains both campaign media and collapsed Design Assets section.)

### Data model impact
None. The `overlay` array in `LayoutTemplate` is unchanged. The "graphic layer" label is display-only (from `getLayerName()`). Background fields on the template are also unchanged.

### Migration risk
Low. The modal change is purely presentational — same state, same actions, different panel layout.

---

## 2. Dockable Panels

### Problem
The current layout is rigid:
```
[Left: Layers+Media] | [Canvas] | [Right: Properties (pinnable)]
```
Designers may prefer Layers on the left and Properties either side depending on screen size and workflow. Full drag-to-dock is complex (~600 lines + hit testing). A **toggle-based dock** is achievable with ~200 lines, zero new dependencies.

### Feasibility: Yes — toggle approach

Each dockable panel gets a **←/→ dock button** in its header. Preferred position persisted to `localStorage`. The modal renders column order reactively.

#### Panel inventory

| Panel | Default side | Can dock to? |
|---|---|---|
| Layers | Left | Left only (anchored — spatial logic breaks on right) |
| Media / Design Assets | Left (tab) | Left **or** Right |
| Properties (slot/overlay/BG) | Right | Right **or** Left |

#### The 3 realistic configurations

```
Config A (default):
[Layers + Media] | [Canvas] | [Properties]

Config B (properties left for multitasking):
[Properties] | [Canvas] | [Layers + Media]

Config C (minimal — media right for large-canvas focus):
[Layers] | [Canvas] | [Media + Properties]
```

Config C requires splitting Layers from Media into separate collapsible panels. That's the cleanest architecture anyway — each panel has a fixed role.

### Implementation sketch

```typescript
// Persistent dock preference
type DockSide = 'left' | 'right';
interface PanelDockState {
  media: DockSide;
  properties: DockSide;
}

const DEFAULT_DOCK: PanelDockState = { media: 'left', properties: 'right' };
// Persisted: localStorage.getItem('wpsg_builder_dock')

// In modal render:
const leftPanels  = panelsForSide('left',  dockState);   // → [Layers, maybe Media]
const rightPanels = panelsForSide('right', dockState);   // → [maybe Properties, maybe Media]
```

Each panel group renders as a `<Stack>` with individual collapsible cards (`<Collapse>`). The dock toggle button just writes to state + `localStorage`.

### UI for the dock button
A small `←` / `→` icon in the panel's top-right corner. Tooltip: "Move panel to right side" / "Move panel to left side". Only appears on hover to avoid cluttering the UI.

### Dependencies needed
None. Pure CSS column-reversal + React state.

### Effort estimate
~3–4 hours for the toggle mechanism + localStorage persistence + panel-group container component. Visual polish adds ~2 hours.

### Recommendation
Implement in P17 alongside the Media tab restructure — both touch the same modal layout. Fixing the layout once for two features is more efficient than two separate modal restructures.

---

## 3. P17 Work Breakdown (draft)

| Track | Work | Effort |
|---|---|---|
| P17-A | Design Assets section in Media tab (merge Overlays + BG) | Medium |
| P17-B | `AssetUploader` sub-component (DRY upload/URL flow) | Small |
| P17-C | Guard: design assets not assignable to media slots | Small |
| P17-D | Dockable panels (toggle + localStorage) | Medium |
| P17-E | Properties panel: overlay properties when overlay row selected | Small |
| P17-F | Tests + docs | Small |

---

*Notes captured from QA session: Feb 26, 2026*
