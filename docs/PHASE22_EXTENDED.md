# Phase 22 Extended: Responsive Layout & Dimension Control Refactor

> **Branch:** Current working branch (with unstaged prior work)
> **Scope:** CampaignViewer → Gallery Section → Adapter responsive chain, unified carousel, file reorganization, settings restructuring
> **Reference:** [COMPONENT_TREE_MAP.md](COMPONENT_TREE_MAP.md), [MANTINE_COMPONENT_MAP.md](MANTINE_COMPONENT_MAP.md)
> **External reference:** [Grok assessment](https://grok.com/share/bGVnYWN5_7adf4fa9-b928-4cf9-80f2-d58a6e8153d6) (critique + recommendations incorporated below)

---

## Problem Statement

The CampaignViewer and its nested galleries have fragmented responsive behavior:
- Sizing is calculated independently at each layer (Viewer → Section → Carousel/Adapter) with hard-coded viewport ratios and no clean parent-to-child propagation
- ImageCarousel and VideoCarousel duplicate ~75-80% of logic and live outside the adapter system
- No runtime clamping on user-configured dimension values — unrealistic settings break layouts
- Per-type gallery sections stack vertically without optional equal-height distribution or independent caps
- SettingsPanel is an 1,855-line monolith with settings in wrong sections
- File organization doesn't reflect the conceptual hierarchy, making development difficult

---

## Phase Dependencies

```
Phase 1 (File Moves) ──→ Phase 2 (Dimension Model) ──→ Phase 4 (Modal Controls)
                                    │                           │
                                    │                    Phase 6 (Padding/Gaps)
                                    │
                                    └──→ Phase 3 (Unified Carousel)

Phase 5 (Settings Reorg) ← independent, can happen at any point
```

Phases 3 and 4 can run in parallel once Phase 2's `GallerySectionWrapper` interface is defined.

---

## Phase 1: File Reorganization

**Goal:** Move files into a hierarchy that reflects the conceptual model. No file renames, no logic changes — only moves and import path updates.

### Target Structure

```
src/components/
├── CampaignGallery/                       ← from Gallery/
│   ├── CardGallery.tsx
│   ├── CardGallery.module.scss
│   ├── CardGallery.test.tsx
│   ├── CampaignCard.tsx
│   ├── CampaignCard.module.scss
│   ├── LazyImage.tsx
│   ├── RequestAccessForm.tsx
│   └── RequestAccessForm.test.tsx
│
├── CardViewer/                            ← extracted from Campaign/
│   ├── CampaignViewer.tsx
│   ├── CampaignViewer.module.scss
│   ├── CampaignViewer.test.tsx
│   ├── GallerySectionWrapper.tsx          ← NEW in Phase 2
│   ├── UnifiedGallerySection.tsx          ← extracted in Phase 2
│   └── PerTypeGallerySection.tsx          ← extracted in Phase 2
│
├── Galleries/
│   ├── Adapters/                          ← from src/gallery-adapters/
│   │   ├── compact-grid/
│   │   │   └── CompactGridGallery.tsx
│   │   ├── justified/
│   │   │   └── JustifiedGallery.tsx
│   │   ├── masonry/
│   │   │   └── MasonryGallery.tsx
│   │   ├── hexagonal/
│   │   │   └── HexagonalGallery.tsx
│   │   ├── circular/
│   │   │   └── CircularGallery.tsx
│   │   ├── diamond/
│   │   │   └── DiamondGallery.tsx
│   │   ├── layout-builder/
│   │   │   └── LayoutBuilderGallery.tsx (+ sub-components)
│   │   ├── MediaCarouselAdapter.tsx       ← NEW in Phase 3
│   │   ├── GalleryAdapter.ts
│   │   ├── adapterRegistry.ts
│   │   ├── _shared/
│   │   │   ├── overlayStyles.ts
│   │   │   └── tileHoverStyles.ts
│   │   └── __tests__/
│   └── Shared/
│       ├── OverlayArrows.tsx
│       ├── OverlayArrows.test.tsx
│       ├── DotNavigator.tsx
│       ├── DotNavigator.test.tsx
│       ├── Lightbox.tsx
│       ├── Lightbox.test.tsx
│       └── KeyboardHintOverlay.tsx
│
├── Common/                                ← from shared/
│   ├── CompanyLogo.tsx
│   ├── InContextEditor.tsx
│   ├── TypographyEditor.tsx
│   ├── GradientEditor.tsx
│   ├── ConfirmModal.tsx
│   └── CampaignSelector.tsx
│
├── Campaign/                              ← kept for CRUD modals only
│   ├── UnifiedCampaignModal.tsx
│   ├── UnifiedCampaignModal.test.tsx
│   ├── ArchiveCampaignModal.tsx
│   ├── AddExternalMediaModal.tsx
│   └── MediaLibraryPicker.tsx
│
├── Admin/                                 ← unchanged
│   ├── AdminPanel.tsx
│   ├── SettingsPanel.tsx
│   ├── CampaignsTab.tsx
│   ├── MediaTab.tsx
│   └── LayoutBuilder/ (unchanged)
│
└── Auth/                                  ← unchanged
    ├── AuthBar.tsx
    └── LoginForm.tsx
```

### What Moves Where

| Current Location | New Location | Notes |
|---|---|---|
| `src/components/Gallery/*` | `src/components/CampaignGallery/` | CardGallery, CampaignCard, LazyImage, RequestAccessForm + their tests/scss |
| `src/components/Campaign/CampaignViewer.*` | `src/components/CardViewer/` | Viewer + its scss + test |
| `src/components/Campaign/ImageCarousel.*` | `src/components/Galleries/Shared/` temporarily | Will be deprecated in Phase 3 |
| `src/components/Campaign/VideoCarousel.*` | `src/components/Galleries/Shared/` temporarily | Will be deprecated in Phase 3 |
| `src/components/Campaign/OverlayArrows.*` | `src/components/Galleries/Shared/` | Shared gallery navigation |
| `src/components/Campaign/DotNavigator.*` | `src/components/Galleries/Shared/` | Shared gallery navigation |
| `src/components/Campaign/Lightbox.*` | `src/components/Galleries/Shared/` | Shared gallery component |
| `src/components/Campaign/KeyboardHintOverlay.tsx` | `src/components/Galleries/Shared/` | Lightbox sub-component |
| `src/gallery-adapters/*` | `src/components/Galleries/Adapters/` | All adapter dirs + registry + shared utils |
| `src/components/shared/*` | `src/components/Common/` | Cross-cutting shared components |
| `src/components/Campaign/UnifiedCampaignModal.*` | `src/components/Campaign/` | Stays — CRUD modal |
| `src/components/Campaign/ArchiveCampaignModal.tsx` | `src/components/Campaign/` | Stays — CRUD modal |
| `src/components/Campaign/AddExternalMediaModal.tsx` | `src/components/Campaign/` | Stays — CRUD modal |
| `src/components/Campaign/MediaLibraryPicker.tsx` | `src/components/Campaign/` | Stays — CRUD modal support |

### Steps

1. Create new directories: `CampaignGallery/`, `CardViewer/`, `Galleries/Adapters/`, `Galleries/Shared/`, `Common/`
2. `git mv` each file (preserves git history)
3. Update all import paths project-wide — estimated ~40-60 files affected
4. Verify: `npx tsc --noEmit` (zero errors) + `npm run test:silent` (all pass)

### Risk

Import path breakage is the primary risk. The dedicated branch provides rollback safety. Run `tsc` after every batch of moves.

---

## Phase 2: Dimension Propagation Model + GallerySectionWrapper

**Goal:** Establish a clean parent-to-child dimension pipeline with clamping at every level.

### Current Dimension Flow (Broken)

```
Modal (modalMaxWidth, no runtime clamp)
  → Content wrapper (hardcoded 64rem or 100%)
    → Gallery wrapper (modalGalleryMaxWidth, no min clamp)
      → Inline section functions (duplicate sizing code)
        → Adapters (own independent sizing, no awareness of parent bounds)
        → Carousels (own VIEWPORT_MAX_HEIGHTS, independent of section)
```

### Target Dimension Flow

```
Modal (modalMaxWidth, clamped 600–1600px)
  → Content wrapper (modalInnerPadding, overflow: auto)
    → GallerySectionWrapper (measures self via ResizeObserver, clamps section bounds)
      → containerDimensions { width, height } passed as prop
        → Adapters (respect containerDimensions, adapter % sizing)
        → Carousel (respect containerDimensions, adapter % sizing)
```

### 2a. New Types

Add to `src/types/index.ts`:

```typescript
/** Measured dimensions of a container, passed to child adapters */
export interface ContainerDimensions {
  width: number;
  height: number;
}
```

### 2b. New Settings Fields

Add to `GalleryBehaviorSettings` in `src/types/index.ts` with defaults in the existing defaults object:

| Setting | Type | Default | Range | Purpose |
|---|---|---|---|---|
| `gallerySectionMaxWidth` | number | 0 | 0=auto, 300–2000 | Max width of a gallery section |
| `gallerySectionMaxHeight` | number | 0 | 0=auto, 150–2000 | Max height of a gallery section |
| `gallerySectionHeightMode` | `'auto' \| 'manual' \| 'viewport'` | `'auto'` | — | Height constraint mode for sections. `'auto'` = content-driven (no maxHeight, only minHeight enforced — important for masonry/justified/layout-builder). `'manual'` = use `gallerySectionMaxHeight`. `'viewport'` = percentage of viewport. |
| `gallerySectionMinWidth` | number | 300 | 200–600 | Min width floor |
| `gallerySectionMinHeight` | number | 150 | 100–400 | Min height floor |
| `perTypeSectionEqualHeight` | boolean | false | — | Side-by-side layout for per-type sections at ≥ tablet |
| `modalInnerPadding` | number | 16 | 0–48 | Padding from modal edges to content |
| `gallerySectionPadding` | number | 16 | 0–32 | Padding inside gallery section wrapper |
| `adapterSizingMode` | `'fill' \| 'manual'` | `'fill'` | — | Fill section or use manual percentage |
| `adapterMaxWidthPct` | number | 100 | 50–100 | Adapter width as % of section |
| `adapterMaxHeightPct` | number | 100 | 50–100 | Adapter height as % of section |

### 2c. Clamping Utility

**New file:** `src/utils/clampDimension.ts`

```typescript
/**
 * Clamp a dimension value between min and max, also capped by available container space.
 * A value of 0 means "auto" (use containerMax).
 */
export function clampDimension(
  value: number,
  min: number,
  max: number,
  containerMax: number,
): number {
  if (value <= 0) return containerMax; // 0 = auto/fill
  return Math.max(min, Math.min(value, max, containerMax));
}
```

Clamping is applied at **two levels**:
1. **Settings input** — `NumberInput` min/max props in SettingsPanel prevent obviously bad values
2. **Component consumption** — `clampDimension()` at render time caps to actual container bounds

### 2d. GallerySectionWrapper Component

**New file:** `src/components/CardViewer/GallerySectionWrapper.tsx`

**Responsibilities:**
- Wraps each gallery section (unified or per-type)
- Uses `ResizeObserver` to measure own content width
- Computes clamped `containerDimensions` and passes to children via render prop or direct prop
- Applies background styling (`bgType`, `bgColor`, `bgGradient` — reuses existing pattern from CampaignViewer)
- Applies `gallerySectionPadding` as inner padding
- Applies `gallerySectionMaxWidth` / `gallerySectionMaxHeight` as CSS `max-width` / `max-height` with `clampDimension`

**Key implementation details:**

```typescript
interface GallerySectionWrapperProps {
  settings: GalleryBehaviorSettings;
  bgType: ViewportBgType;
  bgColor: string;
  bgGradient: GradientDef;
  children: (containerDimensions: ContainerDimensions) => React.ReactNode;
}
```

Internal sizing logic:
```
const sectionRef = useRef<HTMLDivElement>(null);
const [measuredWidth, setMeasuredWidth] = useState(0);

// ResizeObserver to track actual width
useEffect(() => {
  const ro = new ResizeObserver(entries => {
    setMeasuredWidth(entries[0].contentRect.width);
  });
  ro.observe(sectionRef.current);
  return () => ro.disconnect();
}, []);

// Clamp user settings to measured available space
const effectiveMaxWidth = clampDimension(
  s.gallerySectionMaxWidth,
  s.gallerySectionMinWidth,
  2000,
  measuredWidth,
);

// Pass down as containerDimensions
const containerDimensions = {
  width: effectiveMaxWidth,
  height: /* similar clamping for height */
};
```

CSS styling:
```
// Height behavior depends on gallerySectionHeightMode:
// 'auto'     → maxHeight: 'none' (content-driven — critical for masonry, justified, layout-builder)
// 'manual'   → maxHeight: clamped gallerySectionMaxHeight
// 'viewport' → maxHeight: percentage of viewport height
const resolvedMaxHeight =
  s.gallerySectionHeightMode === 'manual' && s.gallerySectionMaxHeight > 0
    ? `${clampDimension(s.gallerySectionMaxHeight, s.gallerySectionMinHeight, 2000, Infinity)}px`
    : s.gallerySectionHeightMode === 'viewport'
      ? '80dvh'
      : undefined; // 'auto' — no max height constraint

style={{
  width: '100%',
  maxWidth: s.gallerySectionMaxWidth > 0 ? `clamp(${s.gallerySectionMinWidth}px, ${s.gallerySectionMaxWidth}px, 100%)` : '100%',
  maxHeight: resolvedMaxHeight,
  minHeight: `${s.gallerySectionMinHeight}px`,
  padding: `${s.gallerySectionPadding}px`,
  marginInline: 'auto',
  overflow: resolvedMaxHeight ? 'hidden' : undefined,
  borderRadius: `${s.imageBorderRadius}px`,
  ...backgroundStyles,
}}
```

### 2e. Extract Gallery Sections from CampaignViewer

Currently `CampaignViewer.tsx` contains three inline function components (lines ~106-145):
- `UnifiedGallerySection` 
- `VideoGallerySection`
- `ImageGallerySection`

Extract to standalone files:

**`src/components/CardViewer/UnifiedGallerySection.tsx`**
- Receives `media`, `settings`, `containerDimensions` (from wrapper)
- Renders the adapter (via `resolveAdapter`) or the new `MediaCarouselAdapter`
- Passes `containerDimensions` to the adapter

**`src/components/CardViewer/PerTypeGallerySection.tsx`**
- Receives `images`, `videos`, `settings`
- Renders two `GallerySectionWrapper` instances
- When `perTypeSectionEqualHeight` is true, wraps in:
  ```tsx
  <SimpleGrid
    cols={{ base: 1, md: 2 }}
    spacing={s.modalGalleryGap}
    style={{ alignItems: 'stretch' }}  // ensure true equal visual height
  >
    <GallerySectionWrapper style={{ minHeight: '100%' }} ...>
      {dims => <VideoAdapter ... />}
    </GallerySectionWrapper>
    <GallerySectionWrapper style={{ minHeight: '100%' }} ...>
      {dims => <ImageAdapter ... />}
    </GallerySectionWrapper>
  </SimpleGrid>
  ```
- When false, stacks vertically in a `Stack` (current behavior)

### 2f. Update Adapter Interface

In `src/components/Galleries/Adapters/GalleryAdapter.ts`, add `containerDimensions` to the interface:

```typescript
export interface GalleryAdapterProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  containerDimensions?: ContainerDimensions; // NEW — optional for backward compat during migration
}
```

Once all adapters are updated, make it required.

### 2g. Update Each Adapter

Each adapter uses `containerDimensions` to constrain its layout:

**CompactGridGallery:** `gridMaxWidth` capped by `containerDimensions.width`
**JustifiedGallery:** `RowsPhotoAlbum` respects parent width automatically (no change needed, just pass through)
**MasonryGallery:** Replace inline responsive column function with `resolveColumnsFromWidth(containerDimensions.width, settings)` helper (see below) — removes the last vestige of independent breakpoint logic in adapters
**HexagonalGallery / CircularGallery / DiamondGallery:** Grid wrapper `maxWidth` = `containerDimensions.width`
**LayoutBuilderGallery:** Already uses ResizeObserver, but additionally cap `containerWidth` to `containerDimensions.width`

**New helper** `resolveColumnsFromWidth` (place in `src/utils/resolveColumnsFromWidth.ts` or colocate in masonry adapter):
```typescript
/** Derive column count from container width, replacing per-adapter breakpoint logic */
export function resolveColumnsFromWidth(
  width: number,
  pinned: number, // settings.masonryColumns — 0 means auto
): number {
  if (pinned > 0) return pinned;
  if (width < 400) return 1;
  if (width < 700) return 2;
  if (width < 1000) return 3;
  return 4;
}
```
This can also be reused by HexagonalGallery, CircularGallery, DiamondGallery for their per-row calculations.

Adapter manual sizing (when `adapterSizingMode === 'manual'`):
```typescript
const effectiveWidth = containerDimensions
  ? containerDimensions.width * (settings.adapterMaxWidthPct / 100)
  : parentWidth;
```

### Files Modified

- `src/types/index.ts` — `ContainerDimensions` type + new settings fields + defaults
- `src/components/Galleries/Adapters/GalleryAdapter.ts` — updated interface
- **NEW** `src/utils/clampDimension.ts`
- **NEW** `src/components/CardViewer/GallerySectionWrapper.tsx`
- **NEW** `src/components/CardViewer/UnifiedGallerySection.tsx`
- **NEW** `src/components/CardViewer/PerTypeGallerySection.tsx`
- `src/components/CardViewer/CampaignViewer.tsx` — remove inline sections, use new components + wrapper
- All 7 adapter files — accept + use `containerDimensions`

---

## Phase 3: Unified MediaCarousel Adapter

**Goal:** Replace ImageCarousel + VideoCarousel with a single `MediaCarouselAdapter` registered in the adapter system.

### Current Duplication Analysis

| Shared Logic (~75-80%) | Image-Only | Video-Only |
|---|---|---|
| Navigation state (`useCarousel`) | Aspect ratio `3:2` | Aspect ratio `16:9` |
| Swipe handling (`useSwipe`) | `imageBorderRadius` setting | `videoBorderRadius` setting |
| Transition animation (beginTransition, exitTimerRef, applyGalleryTransition) | `imageShadowPreset/Custom` | `videoShadowPreset/Custom` |
| Height calculation (breakpoint multipliers, sizing modes) | `imageViewportHeight` | `videoViewportHeight` |
| OverlayArrows rendering | `galleryImageLabel` | `galleryVideoLabel` |
| DotNavigator rendering + onSelect logic | `useLightbox()` for fullscreen | `isPlaying` state + play/pause toggle |
| Keyboard/click handlers | `<Image fit="contain">` | `<video>` (uploads) or `<iframe>` (embeds) |
| Section label with icon | Zoom icon overlay | Play icon overlay |
| CSS transition application (imperative useLayoutEffect) | | `withAutoplay()` for embed URLs |
| | | No lightbox (video) |

### 3a. Extract Transition Logic into Reusable Hook

**Extend/create:** `src/hooks/useMediaTransition.ts`

The transition pattern is identical in both carousels:
1. `beginTransition(navigate)` — set `previousItem`, call `navigate()`
2. `exitTimerRef` — clear `previousItem` after animation completes
3. `useLayoutEffect` — apply CSS transforms via `applyGalleryTransition(enterRef, exitRef, opts)`

New hook API:
```typescript
function useMediaTransition(settings: GalleryBehaviorSettings) {
  return {
    previousItem: MediaItem | null;
    enterRef: React.RefObject<HTMLDivElement>;
    exitRef: React.RefObject<HTMLDivElement>;
    beginTransition: (navigate: () => void) => void;
    clearTransition: () => void;
  };
}
```

This captures the `previousItem` state, timer management, and CSS application — the densest duplicated logic.

### 3b. Verify/Extend useCarousel Hook

Current `useCarousel` API (from `src/hooks/useCarousel.ts`):
```typescript
interface UseCarouselResult {
  currentIndex: number;
  direction: NavigationDirection; // -1 | 0 | 1
  setCurrentIndex: (index: number) => void;
  next: () => void;
  prev: () => void;
}
```

This is already sufficient for navigation. No extension needed.

### 3c. Create MediaCarouselAdapter

**New file:** `src/components/Galleries/Adapters/MediaCarouselAdapter.tsx`

**Props:** Same as `GalleryAdapterProps` (extends adapter interface):
```typescript
interface MediaCarouselAdapterProps extends GalleryAdapterProps {
  containerDimensions?: ContainerDimensions;
}
```

**Internal architecture:**

```
MediaCarouselAdapter
├── useCarousel(media.length)              — navigation state
├── useMediaTransition(settings)            — transition animation
├── useSwipe({ onSwipeLeft: next, ... })    — touch handling
├── useLightbox({ onPrev, onNext })         — fullscreen (image items only)
│
├── Section Label (Group > Title + Icon)
├── Frame Container (Box)
│   ├── Current Media Renderer
│   │   ├── IF image → <Image fit="contain" ... />
│   │   ├── IF video upload → <video src={...} controls />
│   │   └── IF video embed → <iframe src={withAutoplay(embedUrl)} />
│   ├── Previous Media (exit overlay — transition animation)
│   ├── Play Button Overlay (video items only)
│   └── Zoom/Expand Overlay (image items only)
├── OverlayArrows
├── DotNavigator
└── Lightbox [LAZY]
```

**Section label** (unified, type-aware):
```typescript
// For mixed-media unified galleries, label falls back to "Media" instead of type-specific
const images = media.filter(m => m.type === 'image');
const videos = media.filter(m => m.type === 'video');
const isMixed = images.length > 0 && videos.length > 0;
const sectionLabel = isMixed
  ? `Media (${media.length})`
  : videos.length > 0 ? settings.galleryVideoLabel : settings.galleryImageLabel;
```

**Height calculation** (unified from both carousels):
```typescript
// Determine dominant media type for default aspect ratio
const dominantType = images.length >= videos.length ? 'image' : 'video';
const defaultAspectRatio = dominantType === 'image' ? '3 / 2' : '16 / 9';

// Use type-appropriate viewport height
const baseHeight = dominantType === 'image' 
  ? settings.imageViewportHeight 
  : settings.videoViewportHeight;

// Apply breakpoint multiplier (existing pattern)
const heightMultiplier = breakpoint === 'mobile' ? 0.55 : breakpoint === 'tablet' ? 0.75 : 1.0;
const standardHeight = `${Math.round(Math.max(180, Math.min(900, baseHeight)) * heightMultiplier)}px`;
```

**Constraint chain** (respects section bounds):
```typescript
// If containerDimensions provided, cap to it
const maxW = containerDimensions
  ? `${containerDimensions.width * (settings.adapterMaxWidthPct / 100)}px`
  : configuredMaxWidth;
```

**Video-specific state:**
```typescript
const [isPlaying, setIsPlaying] = useState(false);
const currentItem = media[currentIndex];
const isVideo = currentItem.type === 'video';

// Reset play state on navigation
useEffect(() => setIsPlaying(false), [currentIndex]);
```

### 3d. Register in Adapter System

In `src/components/Galleries/Adapters/adapterRegistry.ts`:

```typescript
import { MediaCarouselAdapter } from './MediaCarouselAdapter';

registerAdapter({
  id: 'carousel',
  label: 'Carousel',
  capabilities: ['carousel-layout', 'lightbox', 'keyboard-nav', 'touch-swipe'],
  component: MediaCarouselAdapter,
});
```

### 3e. Update CampaignViewer to Use Registry

Replace direct imports of `ImageCarousel` / `VideoCarousel` with adapter resolution:
- When `imageGalleryAdapterId === 'classic'` → change to resolve `'carousel'` adapter with image media
- When `videoGalleryAdapterId === 'classic'` → change to resolve `'carousel'` adapter with video media
- The `'classic'` id can become an alias for `'carousel'` in the registry fallback

### 3f. Deprecate Old Carousels

Keep `ImageCarousel.tsx` and `VideoCarousel.tsx` as thin wrappers:

```typescript
/** @deprecated Use MediaCarouselAdapter via adapter registry instead */
export function ImageCarousel(props: { ... }) {
  return <MediaCarouselAdapter media={props.images} settings={props.settings} />;
}
```

Remove in a follow-up PR after thorough testing.

### Files Created/Modified

- **NEW** `src/hooks/useMediaTransition.ts`
- **NEW** `src/components/Galleries/Adapters/MediaCarouselAdapter.tsx`
- `src/components/Galleries/Adapters/adapterRegistry.ts` — register `'carousel'`
- `src/hooks/useCarousel.ts` — verify adequate (likely no changes needed)
- `src/components/Galleries/Shared/ImageCarousel.tsx` — deprecation wrapper
- `src/components/Galleries/Shared/VideoCarousel.tsx` — deprecation wrapper
- `src/components/CardViewer/CampaignViewer.tsx` — use adapter registry instead of direct carousel imports

### Also Fixed: Compact-Grid Hover "Pop"

The compact-grid hover effect (`scale(1.05)`) was applied to the `LazyImage` inside the card rather than the card wrapper itself. This caused the image to pop outside its container bounds instead of smoothly scaling the entire card. Fixed by moving the `transform` to the card wrapper `Box` and combining the transition with the existing `box-shadow` animation. (`CompactGridGallery.tsx`)

---

## Phase 4: Modal Dimension Controls + Responsive Containment

**Goal:** Clamp modal dimensions, take full control of inner padding, ensure content never exceeds viewport.

### 4a. Modal Size Clamping

Current in `CampaignViewer.tsx` (line ~238):
```typescript
// CURRENT — no clamping, modalMaxWidth can be anything 0–3000
size={useFullscreen ? '100%' : (s.modalMaxWidth > 0 ? `${s.modalMaxWidth}px` : 'xl')}
```

Replace with:
```typescript
const MODAL_MIN_WIDTH = 600;
const MODAL_MAX_WIDTH = 1600;
const MODAL_MIN_HEIGHT_DVH = 50;
const MODAL_MAX_HEIGHT_DVH = 95;

const clampedWidth = Math.max(MODAL_MIN_WIDTH, Math.min(MODAL_MAX_WIDTH, s.modalMaxWidth || 1200));
const clampedMaxHeight = Math.max(MODAL_MIN_HEIGHT_DVH, Math.min(MODAL_MAX_HEIGHT_DVH, s.modalMaxHeight));

const modalSize = useFullscreen ? '100%' : `${clampedWidth}px`;
```

Height:
```typescript
// CURRENT — maxHeight: `${s.modalMaxHeight}dvh` (no clamp)
// NEW
styles.content.maxHeight = useFullscreen ? '100dvh' : `${clampedMaxHeight}dvh`;
```

### 4b. Override Mantine Modal Body Padding

Currently Mantine `<Modal>` adds its own body padding. Take full control:

```tsx
<Modal
  styles={{
    body: { padding: 0 },  // Override Mantine's default
    content: { maxHeight: useFullscreen ? '100dvh' : `${clampedMaxHeight}dvh` },
  }}
  ...
>
```

Then apply our own padding on the content wrapper:
```tsx
<Box style={{
  padding: `${Math.max(0, Math.min(48, s.modalInnerPadding))}px`,
  maxWidth: contentMaxWidth,
  margin: '0 auto',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}}>
```

### 4c. Content Max Width Update

Current:
```typescript
const contentMaxWidth = useFullscreen
  ? (s.fullscreenContentMaxWidth > 0 ? `${s.fullscreenContentMaxWidth}px` : '100%')
  : '64rem';  // Hardcoded 1024px
```

New — respect `modalContentMaxWidth` setting in contained mode too:
```typescript
const contentMaxWidth = useFullscreen
  ? (s.fullscreenContentMaxWidth > 0 ? `${s.fullscreenContentMaxWidth}px` : '100%')
  : (s.modalContentMaxWidth > 0 ? `${s.modalContentMaxWidth}px` : '100%');
```

### 4d. Conditional Settings Visibility

In SettingsPanel, when `campaignModalFullscreen === true`:
- Disable / grey out `modalMaxWidth` and `modalMaxHeight` controls
- Show helper text: "Fullscreen mode uses viewport dimensions"

### Files Modified

- `src/components/CardViewer/CampaignViewer.tsx` — clamping, padding override, content width
- `src/components/Admin/SettingsPanel.tsx` — conditional visibility for fullscreen mode

---

## Phase 5: Settings Panel Reorganization

**Goal:** Restructure the 1,855-line SettingsPanel so settings live under tabs matching the conceptual hierarchy.

### Current Tab Structure (6 tabs)

| Tab | Approx Lines | Issues |
|---|---|---|
| General | ~100 | Contains some viewer settings that belong elsewhere |
| Campaign Cards | ~250 | Includes "Campaign Modal" accordion that belongs in Viewer tab |
| Media Gallery | ~400 | Mixes gallery layout + adapter + tile settings |
| Campaign Viewer | ~200 | Missing dimension controls, has visibility toggles |
| Advanced | ~600 | Catch-all with 9 accordion sections |
| Typography | ~300 | Fine as-is |

### New Tab Structure (7 tabs)

| Tab | Contents | Settings Keys |
|---|---|---|
| **General** | Theme, App Container, Auth Bar, Session, WP Full Bleed | `appMaxWidth`, `appPadding`, `wpFullBleed*`, `authBarDisplayMode`, `sessionIdleTimeoutMinutes` |
| **Campaign Cards** | Card Appearance (border, shadow, thumbnail), Card Grid (columns, gaps, maxWidth), Pagination (displayMode, rowsPerPage, transition) | `cardBorderRadius`, `cardBorderWidth`, `cardShadowPreset`, `cardGridColumns`, `cardMaxColumns`, `cardGapH/V`, `cardMaxWidth`, `cardDisplayMode`, `cardRowsPerPage` |
| **Campaign Viewer** | Modal Mode (fullscreen toggle), Modal Dimensions (width, height — disabled when fullscreen), Cover Image (height, ratios), Open Mode, Visibility Toggles, Modal Background, Modal Transitions | `campaignModalFullscreen`, `modalMaxWidth`, `modalMaxHeight`, `modalInnerPadding`, `modalCoverHeight`, `campaignOpenMode`, `showCampaign*`, `modalBgType/Color/Gradient`, `modalTransition/Duration` |
| **Gallery Layout** *(new)* | Unified vs Per-type toggle, `perTypeSectionEqualHeight`, Section Sizing (max/min W/H), Section Padding, Section Background, Gallery Gap, Adapter Selection (per-breakpoint), Adapter Sizing Mode + Pct | `unifiedGalleryEnabled`, `perTypeSectionEqualHeight`, `gallerySectionMax/MinWidth/Height`, `gallerySectionPadding`, `modalGalleryGap`, `modalGalleryMargin`, `*AdapterId`, `adapterSizingMode`, `adapterMaxWidth/HeightPct` |
| **Media Display** | Tile Appearance (size, gap, border, glow, hover), Thumbnail Strip, Carousel-specific (aspect ratio, viewport heights), Lightbox, Navigation (arrows, dot nav) | `tileSize`, `tileGap*`, `tileBorder*`, `tileGlow*`, `tileHover*`, `*ViewportHeight`, `dotNav*`, `navArrow*`, `lightbox*` |
| **Typography** | Font Library + per-element overrides | `typographyOverrides`, `showInContextEditors` |
| **Advanced** | Upload/Media limits, System, Data Maintenance, any remaining edge settings | `uploadMaxSizeMb`, `libraryPageSize`, `expiryWarningThresholdMs`, `preserveDataOnUninstall`, `archivePurgeDays` |

### Implementation Approach

1. Don't rewrite — move JSX blocks between tabs
2. For each new tab, create a labeled `<Tabs.Panel>` and relocate the relevant accordion sections
3. Add `NumberInput` controls for new settings from Phase 2 (min/max props for clamping at input level)
4. Add `disabled` prop to modal dimension controls when `campaignModalFullscreen` is true

### Files Modified

- `src/components/Admin/SettingsPanel.tsx` — tab restructure + new controls with input validation

---

## Phase 6: Padding & Gap Controls

**Goal:** Expose controllable padding at every nesting boundary so users can fine-tune spacing from edges-meet (0) to comfortably spaced.

### Padding Layers (top to bottom)

```
┌─ Modal ─────────────────────────────────┐
│  modalInnerPadding (0–48px)             │
│  ┌─ Gallery Section ──────────────────┐ │
│  │  gallerySectionPadding (0–32px)    │ │
│  │  ┌─ Adapter ────────────────────┐  │ │
│  │  │  adapterContentPadding       │  │ │
│  │  │  (0–24px)                    │  │ │
│  │  │                              │  │ │
│  │  └──────────────────────────────┘  │ │
│  └────────────────────────────────────┘ │
│         ↕ modalGalleryGap (0–64px)      │
│  ┌─ Gallery Section ──────────────────┐ │
│  │  ...                               │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### New Settings

| Setting | Type | Default | Range | Where Consumed |
|---|---|---|---|---|
| `modalInnerPadding` | number | 16 | 0–48 | CampaignViewer content wrapper |
| `gallerySectionPadding` | number | 16 | 0–32 | GallerySectionWrapper |
| `adapterContentPadding` | number | 0 | 0–24 | Each adapter's outer Box |
| `modalGalleryGap` | number | 32 | 0–64 | Already exists — add clamping |

### Clamping (defense in depth)

At SettingsPanel input (use `step={4}` for padding fields to match Mantine's visual rhythm):
```tsx
<NumberInput label="Inner Padding" min={0} max={48} step={4} value={s.modalInnerPadding} ... />
<NumberInput label="Section Padding" min={0} max={32} step={4} value={s.gallerySectionPadding} ... />
<NumberInput label="Adapter Padding" min={0} max={24} step={4} value={s.adapterContentPadding} ... />
<NumberInput label="Gallery Gap" min={0} max={64} step={8} value={s.modalGalleryGap} ... />
```

At component consumption:
```typescript
const safePadding = Math.max(0, Math.min(48, s.modalInnerPadding));
```

### Files Modified

- `src/types/index.ts` — add `adapterContentPadding` field
- `src/components/CardViewer/CampaignViewer.tsx` — consume `modalInnerPadding` (Phase 4 overlap)
- `src/components/CardViewer/GallerySectionWrapper.tsx` — consume `gallerySectionPadding`
- All adapter files — consume `adapterContentPadding`
- `src/components/Admin/SettingsPanel.tsx` — add controls (Phase 5 overlap)

---

## Complete File Inventory

### New Files

| File | Phase | Purpose |
|---|---|---|
| `src/utils/clampDimension.ts` | 2 | Clamping utility function |
| `src/utils/resolveColumnsFromWidth.ts` | 2 | Column count helper replacing per-adapter breakpoint logic |
| `src/components/CardViewer/GallerySectionWrapper.tsx` | 2 | Section wrapper with ResizeObserver + clamping |
| `src/components/CardViewer/UnifiedGallerySection.tsx` | 2 | Extracted unified gallery section component |
| `src/components/CardViewer/PerTypeGallerySection.tsx` | 2 | Extracted per-type gallery section component |
| `src/hooks/useMediaTransition.ts` | 3 | Extracted transition animation hook |
| `src/components/Galleries/Adapters/MediaCarouselAdapter.tsx` | 3 | Unified carousel adapter |

### Modified Files

| File | Phases | Changes |
|---|---|---|
| `src/types/index.ts` | 2, 6 | `ContainerDimensions` type, new settings fields + defaults |
| `src/components/CardViewer/CampaignViewer.tsx` | 2, 4, 6 | Extract sections, dimension clamping, padding control |
| `src/components/Galleries/Adapters/GalleryAdapter.ts` | 2 | `containerDimensions` on adapter interface |
| `src/components/Galleries/Adapters/adapterRegistry.ts` | 3 | Register `'carousel'` adapter |
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` | 2, 6 | Accept containerDimensions, adapterContentPadding |
| `src/components/Galleries/Adapters/justified/JustifiedGallery.tsx` | 2, 6 | Accept containerDimensions, adapterContentPadding |
| `src/components/Galleries/Adapters/masonry/MasonryGallery.tsx` | 2, 6 | Accept containerDimensions, adapterContentPadding |
| `src/components/Galleries/Adapters/hexagonal/HexagonalGallery.tsx` | 2, 6 | Accept containerDimensions, adapterContentPadding |
| `src/components/Galleries/Adapters/circular/CircularGallery.tsx` | 2, 6 | Accept containerDimensions, adapterContentPadding |
| `src/components/Galleries/Adapters/diamond/DiamondGallery.tsx` | 2, 6 | Accept containerDimensions, adapterContentPadding |
| `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx` | 2, 6 | Cap containerWidth to containerDimensions |
| `src/components/Galleries/Shared/ImageCarousel.tsx` | 3 | Deprecation wrapper |
| `src/components/Galleries/Shared/VideoCarousel.tsx` | 3 | Deprecation wrapper |
| `src/hooks/useCarousel.ts` | 3 | Verify adequate (likely no changes) |
| `src/components/Admin/SettingsPanel.tsx` | 4, 5, 6 | Tab restructure, new controls, conditional visibility, clamped inputs |
| ~40-60 files | 1 | Import path updates from file moves |

### Moved Files (Phase 1)

See Phase 1 table above for complete move list.

---

## Verification Checklist

### After Phase 1 (File Moves)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run test:silent` — all tests pass
- [ ] App loads in browser, campaigns display, viewer opens

### After Phase 2 (Dimension Propagation)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Gallery sections render inside GallerySectionWrapper
- [ ] Set `gallerySectionMaxWidth` to 500 → section constrained, centered
- [ ] Set `gallerySectionMaxWidth` to 5000 → clamped to 2000 or modal width
- [ ] Set `gallerySectionMaxWidth` to 0 → 100% fill (auto)
- [ ] Toggle `perTypeSectionEqualHeight` → two sections side-by-side at ≥ tablet, stacked on mobile
- [ ] Adapters receive and respect `containerDimensions`
- [ ] Resize browser → dimensions scale proportionally

### After Phase 3 (Unified Carousel)
- [ ] Open gallery with adapter `'carousel'` → carousel renders for images
- [ ] Open gallery with adapter `'carousel'` → carousel renders for videos
- [ ] Open gallery with adapter `'carousel'` → mixed media works (type-aware rendering per slide)
- [ ] Navigation (arrows, dots, keyboard, swipe) all work
- [ ] Lightbox opens for image slides
- [ ] Video play/pause works for video slides
- [ ] Transitions (fade, slide, slide-fade) all work
- [ ] Old `'classic'` adapter id still resolves correctly (via alias or fallback)

### After Phase 4 (Modal Controls)
- [ ] Set `modalMaxWidth=2000` → clamped to 1600px
- [ ] Set `modalMaxWidth=300` → clamped to 600px
- [ ] Set `modalMaxHeight=100` → clamped to 95dvh
- [ ] Toggle fullscreen → modal becomes 100% viewport
- [ ] Fullscreen on → width/height controls disabled in settings
- [ ] `modalInnerPadding=0` → content meets modal edges
- [ ] Content never overflows viewport (scroll within modal, not page)

### After Phase 5 (Settings Reorg)
- [ ] All 7 tabs render without errors
- [ ] Every setting is accessible from exactly one tab
- [ ] New dimension/padding controls have proper min/max on NumberInput
- [ ] Settings values persist correctly after tab restructure

### After Phase 6 (Padding/Gaps)
- [ ] `modalInnerPadding=0` + `gallerySectionPadding=0` + `adapterContentPadding=0` → all edges meet
- [ ] `modalInnerPadding=48` + `gallerySectionPadding=32` + `adapterContentPadding=24` → well-spaced, not absurd
- [ ] `modalGalleryGap=0` → sections touch; `modalGalleryGap=64` → well-separated

### Smoke Tests
- [ ] `npx playwright test e2e/smoke.spec.ts`
- [ ] Each adapter type renders correctly in the new flow
- [ ] Mobile viewport → fullscreen modal, stacked sections, responsive adapters
- [ ] Tablet viewport → two-column sections (when enabled), tablet-sized adapters
- [ ] Desktop viewport → full layout with all controls applied

### After Phase 7 (Layout Polish — QA-driven)
- [ ] Auto-mode card grid reaches 4+ columns on wide viewports (xl:4, xxl:5+)
- [ ] `cardMaxColumns` in auto mode caps columns correctly at configured value
- [ ] `cardMaxWidth` accepts responsive units (%, vw) — not px-only
- [ ] Cards Per Row = 5 or 6 renders correctly (flex branch container wide enough)
- [ ] Last row justification setting controls partial-row alignment in CardGallery
- [ ] CompactGridGallery fills container width when `adapterSizingMode='fill'` (no premature maxWidth cap)
- [ ] `adapterItemGap` provides unified per-adapter gap control (applied uniformly)
- [ ] CompactGridGallery grid justification setting distributes items across container
- [ ] `adapterSizingMode` / `adapterMaxWidthPct` wired to actual rendering
- [ ] `adapterJustifyContent` controls item distribution/alignment in adapters

---

## Phase 7: Gallery Layout Polish & Justification Controls

> **Status:** QA-validated + externally reviewed. Items identified from hands-on QA of Phases 1–6 and refined by external assessment.

**Goal:** Fix card grid responsiveness issues, CompactGridGallery container-fill and gap problems, wire dead settings, and add justification controls for both the card gallery and gallery adapters.

---

### 7a. Card Grid Auto-Mode Column Scaling

**QA Finding:** In auto mode (`cardGridColumns=0`), columns are hardcapped at 3 by breakpoint logic (`isLg ? 3 : isSm ? 2 : 1`). `cardMaxColumns` can only _reduce_ columns — never increase beyond 3. On wide viewports (1400px+) the grid has excessive empty space.

**Root Cause:** Only two breakpoints (`sm: 768px`, `lg: 1200px`) with a ceiling of 3 columns. No `xl` or `xxl` breakpoints.

**Tasks:**
- Add breakpoints to `effectiveColumns` in `CardGallery.tsx` ([line 82](src/components/CampaignGallery/CardGallery.tsx#L82)):
  ```
  xxl (≥1800px): 5 cols
  xl  (≥1400px): 4 cols
  lg  (≥1200px): 3 cols
  sm  (≥768px):  2 cols
  base:          1 col
  ```
- `cardMaxColumns` continues to cap the result (already works — just never had reason to go above 3)
- Update `maxCols` fallback from hardcoded `4` to use the same breakpoint ladder as `effectiveColumns`

**Files:** `src/components/CampaignGallery/CardGallery.tsx`

---

### 7b. Card Max Width Responsive Units

**QA Finding:** `cardMaxWidth` is `number` (px only). Setting it to, say, `300px` looks fine on desktop but is too rigid for mobile. Users need percentage or viewport-relative sizing.

**Root Cause:** Type is `number`, consumption is `${maxWidth}px`.

**Tasks:**
- Add `cardMaxWidthUnit: 'px' | '%'` setting (default `'px'` for backward compat)
- In `CampaignCard.tsx` ([line 62](src/components/CampaignGallery/CampaignCard.tsx#L62)): emit `maxWidth: \`${maxWidth}${unit}\`` based on unit setting
- In `CardGallery.tsx` flex branch: when unit is `'%'`, skip the `maxCols * cardMaxWidth` arithmetic and let flexbox handle wrapping naturally (percentage widths are relative to parent, not absolute)
- Add a Select control beside the Card Max Width NumberInput in SettingsPanel

**Files:** `src/types/index.ts`, `src/components/CampaignGallery/CampaignCard.tsx`, `src/components/CampaignGallery/CardGallery.tsx`, `src/components/Admin/SettingsPanel.tsx`

> **Deferred (future scope):** Full `galleryItemWidthMode` / `galleryItemHeightMode` controls (auto/static/percentage per axis) for adapter gallery items — as recommended by external review. This would replace the current `gridCardWidth`/`gridCardHeight` static-px approach with responsive modes. Deferred because the existing adapter thumbnail sizes work adequately with `auto-fill` CSS Grid; the QA-validated issue is specifically about CardGallery `cardMaxWidth`, not adapter item sizing.

---

### 7c. Cards Per Row 5 & 6 Fix

**QA Finding:** Selecting 5 or 6 columns appears to "reset" back to 4. The Select dropdown offers these values, but the flex branch's container `maxWidth` is calculated from `maxCols`, which falls back to `4` when `cardGridColumns > 0` but `cardMaxWidth > 0` creates a container too narrow for the viewport.

**Root Cause:** In `CardGallery.tsx` ([line 91](src/components/CampaignGallery/CardGallery.tsx#L91)), `maxCols` hardcode-fallbacks to `4` in auto mode. When `cardGridColumns` is set to 5 or 6, `maxCols` does use that value — but with `cardMaxWidth` set, the resulting container `maxWidth = 5 * cardMaxWidth + gaps` may be narrower than expected, causing fewer visible columns. Also, the SimpleGrid branch uses `effectiveColumns` directly which should work — so this bug is flex-branch-specific.

**Tasks:**
- Ensure the flex branch container `maxWidth` calculation in `CardGallery.tsx` doesn't artificially limit columns:
  - When `cardGridColumns` is explicitly set (> 0), use it as `maxCols` regardless
  - Remove the `return 4` fallback in `maxCols` — use the same breakpoint ladder as `effectiveColumns` (from 7a)
- Verify 5- and 6-column layouts render correctly at typical desktop widths (1200px–1920px)
- Consider whether `cardMaxWidth` at the default 0 (no limit) should bypass the flex branch entirely (it currently does — flex only activates when `cardMaxWidth > 0`)

**Files:** `src/components/CampaignGallery/CardGallery.tsx`

---

### 7d. CardGallery Last-Row Justification

**QA Finding:** Partial last rows in the flex branch are hardcoded to `justifyContent: 'center'` ([line 384](src/components/CampaignGallery/CardGallery.tsx#L384)). Users need control over this.

**Root Cause:** Hardcoded value, no setting exists.

**Tasks:**
- Add `cardJustifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly'` setting (default: `'center'` for backward compat)
- Replace the hardcoded `'center'` in CardGallery flex container with the setting value
- Also apply `justifyContent` in the flex branch row wrapper (same setting — ensures the entire flex container respects it)
- Add Select control in the "Card Grid & Pagination" section of SettingsPanel (Cards tab)
- Note: SimpleGrid (non-flex) branch uses CSS Grid where items naturally left-align — this is fine as default and doesn't need justification override

**Files:** `src/types/index.ts`, `src/components/CampaignGallery/CardGallery.tsx`, `src/components/Admin/SettingsPanel.tsx`

---

### 7e. CompactGridGallery Container-Fill & Gap Controls

**QA Finding:** The grid is wrapped in `<Box style={{ maxWidth: gridMaxWidth, marginInline: 'auto' }}>` where `gridMaxWidth = maxCols * cardWidth + (maxCols-1) * gap` — typically ~824px. This prevents the grid from ever filling its container. Items huddle in the center even when the modal/viewport is 1400px wide.

**Root Cause:** 
1. The maxWidth wrapper caps grid width to `maxCols * cardWidth` (static pixels), then centers it.
2. The `auto-fill` grid inside is responsive, but its parent won't let it grow.
3. `adapterSizingMode: 'fill'` should remove this cap, but it's a dead setting (never consumed).

**Tasks:**
- **Wire `adapterSizingMode`**: When `'fill'` (default), remove the `maxWidth` wrapper entirely — let the CSS Grid `auto-fill` + `1fr` naturally create as many columns as fit the container. When `'manual'`, apply `maxWidth: ${adapterMaxWidthPct}%` and `marginInline: 'auto'` via the `adapterMaxWidthPct` setting (already exists, just unwired).
- **Add `adapterItemGap`**: A single unified per-adapter gap setting (default: `16`px) that provides consistent spacing between gallery items across ALL adapters. Applied as uniform `gap` on the adapter's CSS grid/flex container. This replaces the intent of the fragmented `thumbnailGap` (6px default, inconsistent usage) with a cleaner, more generous default. Existing `thumbnailGap`, `tileGapX`/`tileGapY` remain as adapter-specific overrides for hexagonal/diamond/circular where directional control matters.
- **Remove hardcoded `marginInline: 'auto'`** from the inner wrapper when sizing mode is `'fill'` — grid items distribute naturally via CSS Grid + `justifyContent`.
- Ensure `gridTemplateColumns: repeat(auto-fill, ...)` still works correctly when the grid fills the full container (it will — `auto-fill` + `1fr` will create more columns as space allows).

**Files:** `src/types/index.ts`, `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx`, `src/components/Admin/SettingsPanel.tsx`

> **Design Note (from external review):** The original plan proposed splitting `thumbnailGap` into directional H/V controls. This was deemed unnecessary complexity — the primary QA issue is the maxWidth cap preventing container fill, not gap direction. A single `adapterItemGap` with a more generous default (16px vs 6px) solves the "tightly compacted" appearance once the maxWidth cap is removed and items spread across the container. If directional gap control is needed later, it can be added as `adapterItemGapH`/`adapterItemGapV` without breaking changes.

---

### 7f. Adapter Justification Controls

**QA Finding:** No way to control how grid items distribute within the adapter container. Users want CSS Grid `justify-content` control for spreading items (e.g., partial rows in compact-grid, or controlling masonry column alignment).

**Tasks:**
- Add `adapterJustifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly' | 'stretch'` setting (default: `'center'` — matches existing centered behavior from the marginInline:auto wrapper being removed in 7e)
- Apply to CompactGridGallery's inner grid `<Box>` as `justifyContent` (CSS Grid `justify-content` distributes columns within the grid container)
- Apply to other adapters where appropriate:
  - **Masonry**: justify-content on column container
  - **Justified**: inherently fills rows (N/A — skip)
  - **Hexagonal/Diamond/Circular**: row containers may benefit from justify-content
  - **LayoutBuilder**: slot positions are absolute (N/A — skip)
  - **Carousel**: single item (N/A — skip)
- Add Select control in Gallery Layout tab's adapter-sizing accordion in SettingsPanel

**Files:** `src/types/index.ts`, adapter files, `src/components/Admin/SettingsPanel.tsx`

---

### 7g. Wire adapterSizingMode / adapterMaxWidthPct

**QA Finding:** These settings exist in types and the SettingsPanel UI, but are never consumed. Changing them has zero effect on rendering. They are dead settings.

**Root Cause:** No component reads `adapterSizingMode` or `adapterMaxWidthPct` and applies them as CSS.

**Tasks:**
- In each adapter's outer `<Stack>` wrapper: when `adapterSizingMode === 'manual'`, apply `maxWidth: ${adapterMaxWidthPct}%` and `marginInline: 'auto'`
- When `adapterSizingMode === 'fill'` (default), ensure no maxWidth restriction (100% fill)
- This intersects with 7e for CompactGridGallery specifically — consolidate the logic so CompactGridGallery's inner `maxWidth` wrapper is replaced by the adapter-level sizing from this task

**Files:** Individual adapter files (CompactGridGallery, MasonryGallery, JustifiedGallery, HexagonalGallery, CircularGallery, DiamondGallery, LayoutBuilderGallery)

---

### Already Addressed (from previous phases)

- **Compact-grid hover pop** — Fixed in Phase 3 commit.
- **Padding layers** — `modalInnerPadding`, `gallerySectionPadding`, `adapterContentPadding` all wired and clamped in Phase 6.
- **Existing gap controls** — `thumbnailGap` (masonry/justified/compact-grid), `tileGapX`/`tileGapY` (hexagonal/diamond/circular), `cardGapH`/`cardGapV` (card gallery) all exist. Phase 7e supplements these with a unified `adapterItemGap` baseline.

### Implementation Order

Recommended sequence to minimize conflicts:
1. **7a** (auto-mode columns) + **7c** (5/6 fix) — both in CardGallery.tsx, tightly coupled
2. **7b** (responsive card width units) — also CardGallery + CampaignCard
3. **7d** (card justification) — CardGallery flex branch
4. **7g** (wire dead settings) — foundation for 7e/7f
5. **7e** (CompactGridGallery fill + gap) — depends on 7g for adapterSizingMode
6. **7f** (adapter justification) — final polish across all adapters

---

## Decisions & Scope

| Decision | Rationale |
|---|---|
| File moves only, no renames in Phase 1 | Minimize diff size; renames can be a follow-up |
| Adapter sizing as percentage (not absolute px) | Ensures proportional scaling when parent resizes |
| React props for dimensions, CSS vars for theme overrides only | Type safety for the primary flow; CSS vars for external customization |
| Old carousels kept as deprecated wrappers | Safe rollback path; removed after testing confirms parity |
| `GallerySectionWrapper` uses render prop pattern | Children need `containerDimensions` — render prop is cleaner than context for a single level |
| Clamping at both input AND consumption | Defense in depth — bad values from API/DB still get caught |
| `gallerySectionHeightMode` defaults to `'auto'` | Content-driven adapters (masonry, justified, layout-builder) should not be vertically truncated by default |
| `resolveColumnsFromWidth` shared helper | Removes independent breakpoint logic from adapters; single source of truth for container-aware column counts |
| Padding NumberInputs use `step={4}` or `step={8}` | Matches Mantine's 4px visual rhythm for consistent spacing |
| Mixed-media carousel label falls back to "Media (N)" | Avoids misleading "Images" or "Videos" label when unified gallery has both types |

### Excluded from Scope

- Admin Panel / LayoutBuilder responsive changes (already adequate)
- Theme system changes
- File renames (can be a follow-up)
- LayoutBuilderGallery internal slot positioning (percentage-based, already responsive)

---

## Phase 8: Gallery Item Sizing Modes & Post-Phase-7 QA

> **Status:** Deferred. To be evaluated after Phase 7 QA.

**Goal:** Address remaining responsive sizing refinements and any issues discovered during Phase 7 QA.

### 8a. Gallery Item Sizing Mode Controls (auto / static / percentage)

**Origin:** External review recommendation (Grok assessment of Phase 7 plan). Deferred from Phase 7 because current `auto-fill` CSS Grid handles responsive thumbnail sizing adequately once the Phase 7e maxWidth cap is removed.

**Problem:** Adapter gallery items (CompactGrid, Masonry, etc.) use static pixel values for card dimensions (`gridCardWidth: 160`, `gridCardHeight: 224`). These work with `auto-fill` CSS Grid but offer no user control over responsive vs fixed behavior per axis.

**Proposed Tasks:**
- Add `galleryItemWidthMode: 'auto' | 'static' | 'percentage'` setting (default `'auto'`)
- Add `galleryItemHeightMode: 'auto' | 'static' | 'percentage'` setting (default `'auto'`)
- Add `galleryItemWidthValue: number` (default `0` — auto) and `galleryItemHeightValue: number` (default `0` — auto)
- When `'auto'`: derive dimensions from `containerDimensions.width` and column count (responsive scaling)
- When `'static'`: use `gridCardWidth`/`gridCardHeight` as fixed px values (current behavior)
- When `'percentage'`: use value as `%` of container width/height
- Replace the "Card Min Width (px)" / "Card Height (px)" labels in SettingsPanel with paired mode+value controls
- Apply in CompactGridGallery and any other adapter that uses explicit `cardWidth`/`cardHeight`

**Files:** `src/types/index.ts`, adapter files, `src/components/Admin/SettingsPanel.tsx`

### 8b. Post-Phase-7 QA Findings

> Placeholder — add items here as they emerge from Phase 7 QA testing.
