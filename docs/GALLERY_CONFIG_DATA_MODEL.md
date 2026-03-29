# Gallery Configuration Data Model

## Purpose

This document defines the Phase 23 gallery configuration model for WP Super Gallery.

The goals of the model are:

1. support responsive gallery behavior cleanly
2. support unified and per-type gallery modes with one coherent structure
3. support full campaign-level gallery parity
4. preserve backward compatibility with current flat settings during transition
5. allow UI, runtime rendering, and sanitization to operate from the same conceptual model

---

## Design Principles

1. New nested config is the preferred source of truth.
2. Existing flat fields remain supported as compatibility inputs while the transition is underway.
3. Campaign configuration uses the same model as global configuration.
4. Inheritance is explicit and testable.
5. Adapter-specific settings are schema-driven, not scattered conditionals.

---

## Terminology

### Breakpoint

Responsive viewport category.

- `desktop`
- `tablet`
- `mobile`

### Scope

Gallery context within a breakpoint.

- `unified`
- `image`
- `video`

### Common settings

Settings that affect gallery layout/behavior regardless of the specific adapter, as long as that scope is active.

### Adapter settings

Settings specific to one adapter or adapter family.

---

## Proposed Type Model

The examples below are intentionally close to TypeScript, but are meant as architecture definitions rather than final code.

```ts
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export type GalleryScope = 'unified' | 'image' | 'video';

export type GalleryMode = 'unified' | 'per-type';

export interface GalleryCommonSettings {
  sectionMaxWidth?: number;
  sectionMaxHeight?: number;
  sectionMinWidth?: number;
  sectionMinHeight?: number;
  sectionHeightMode?: 'auto' | 'manual' | 'viewport';
  sectionPadding?: number;
  adapterContentPadding?: number;
  adapterSizingMode?: 'fill' | 'manual';
  adapterMaxWidthPct?: number;
  adapterMaxHeightPct?: number;
  adapterItemGap?: number;
  adapterJustifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly' | 'stretch';
  gallerySizingMode?: 'auto' | 'viewport' | 'manual';
  galleryManualHeight?: string;
  viewportBgType?: 'none' | 'solid' | 'gradient' | 'image';
  viewportBgColor?: string;
  viewportBgGradient?: string;
  viewportBgImageUrl?: string;
  perTypeSectionEqualHeight?: boolean;
}

export interface GalleryScopeConfig {
  adapterId?: string;
  common?: GalleryCommonSettings;
  adapterSettings?: Record<string, unknown>;
}

export interface BreakpointGalleryConfig {
  unified?: GalleryScopeConfig;
  image?: GalleryScopeConfig;
  video?: GalleryScopeConfig;
}

export interface GalleryConfig {
  mode?: GalleryMode;
  breakpoints?: Partial<Record<Breakpoint, BreakpointGalleryConfig>>;
}
```

`adapterSettings` is intentionally broad in the first planning pass. Once the authoritative adapter schema lands, the final TypeScript representation should be generated from, or validated against, that schema so per-adapter settings become strongly typed rather than permanently remaining a generic record.

---

## Global Settings Shape

Phase 23 should retain existing flat settings in `GalleryBehaviorSettings`, but add a new nested field.

```ts
export interface GalleryBehaviorSettings {
  // existing flat fields remain for compatibility
  imageGalleryAdapterId: string;
  videoGalleryAdapterId: string;
  unifiedGalleryAdapterId: string;
  gallerySelectionMode: 'unified' | 'per-breakpoint';
  desktopImageAdapterId: string;
  desktopVideoAdapterId: string;
  tabletImageAdapterId: string;
  tabletVideoAdapterId: string;
  mobileImageAdapterId: string;
  mobileVideoAdapterId: string;
  // ...existing gallery fields...

  // new nested preferred field
  galleryConfig?: GalleryConfig;
}
```

### Rule

If `galleryConfig` is present and valid, it takes precedence over equivalent legacy flat fields.

---

## Campaign Settings Shape

Phase 23 selects full gallery parity, so campaigns need a nested override field that matches the same model.

```ts
export interface Campaign {
  // existing fields remain
  imageAdapterId?: string;
  videoAdapterId?: string;
  layoutTemplateId?: string;

  // new nested override field
  galleryOverrides?: Partial<GalleryConfig>;
}
```

The recommended WordPress storage key for the nested campaign override payload is `_wpsg_gallery_overrides`.

### Rule

Campaigns should store only the portions they override, but the allowed override surface is the full editor-supported gallery config model.

That means campaigns are not limited to adapter ids or adapter-specific deltas. They may override responsive common settings and scope behavior as needed.

---

## Resolution Order

Effective gallery behavior must be resolved in one place, in one deterministic order.

### Recommended order

1. campaign nested override
2. campaign legacy override (`imageAdapterId`, `videoAdapterId`, layout binding, etc.)
3. global nested `galleryConfig`
4. global legacy flat fields
5. hard fallback

### Why this order

1. New nested config must win when present.
2. Campaign-level intent must override global intent.
3. Legacy values remain functional while the transition is in progress.
4. Runtime behavior becomes predictable and testable.

---

## Compatibility Strategy

### Transitional behavior

1. Existing installs may still have only flat global fields.
2. Existing campaigns may still have only legacy adapter override fields.
3. Merge utilities must hydrate nested config only when it exists.
4. Nested and legacy values must not clobber each other unpredictably.

### Practical bridge behavior

1. Read nested config first if present.
2. Fall back to legacy fields when nested config is absent or incomplete.
3. Preserve legacy fields in REST round-trip until the migration strategy is intentionally narrowed.

### Migration posture

Phase 23 should be compatibility-first, not migration-first.

That means the system should support old and new representations together before any future cleanup removes legacy paths.

---

## Adapter Schema Requirements

The adapter definition layer must expand beyond runtime component lookup.

Each adapter definition should own or reference:

1. adapter id
2. display label
3. supported scopes
4. mobile allowance or restrictions
5. capabilities
6. common setting groups relevant when active
7. adapter-specific field groups
8. fallback or migration hints

### Example shape

```ts
export interface AdapterFieldGroup {
  id: string;
  label: string;
  fields: string[];
}

export interface AdapterDefinition {
  id: string;
  label: string;
  supportsScopes: GalleryScope[];
  mobileAllowed: boolean;
  capabilities: string[];
  commonFieldGroups: AdapterFieldGroup[];
  adapterFieldGroups: AdapterFieldGroup[];
  fallbackAdapterId?: string;
}
```

### Why this matters

The same schema must drive:

1. global settings adapter choices
2. campaign settings adapter choices
3. adapter-specific form visibility
4. runtime restrictions
5. fallback behavior

---

## Common Settings Scope

Phase 23 does not need to move every user-facing setting into the nested responsive model on day one. The first pass should cover core gallery layout concerns.

### First-pass recommended common settings

1. section max/min width and height
2. section height mode
3. section padding
4. adapter content padding
5. adapter sizing mode
6. adapter max width/height percentages
7. adapter item gap
8. adapter justification
9. gallery sizing mode
10. gallery manual height
11. viewport background type/color/gradient/image URL
12. equal-height behavior for per-type sections

### Deferred for later phases unless needed by implementation

1. broader non-gallery UI settings
2. typography system migration into the same responsive structure
3. auth bar, card, and other broader user-facing settings beyond gallery configuration

---

## Adapter-Specific Settings Scope

Examples of adapter-specific settings the new model should absorb:

### Compact grid

1. `gridCardWidth`
2. `gridCardHeight`

### Justified / mosaic

1. `mosaicTargetRowHeight`
2. `photoNormalizeHeight`

### Masonry

1. `masonryColumns`
2. future masonry-specific responsive options if added

### Photo grid

1. `thumbnailGap`

`thumbnailGap` stays adapter-owned because only justified and masonry consume that denser photo-album spacing contract. It should live in a shared multi-adapter setting group for those adapters rather than being merged into nested `common.adapterItemGap`.

### Tile appearance

1. `tileBorderWidth`
2. `tileBorderColor`
3. `tileHoverBounce`
4. `tileGlowEnabled`
5. `tileGlowColor`
6. `tileGlowSpread`

These tile-style fields stay adapter-owned because only the shape adapters plus justified and masonry consume the shared border/bounce/glow runtime contract. They belong in a shared multi-adapter setting group rather than in nested `common` settings.

### Shape adapters

1. `tileSize`
2. `imageTileSize`
3. `videoTileSize`
4. `tileGapX`
5. `tileGapY`
6. related overlap or clip-path controls where appropriate

`tileGapX` and `tileGapY` stay adapter-owned because only the shape adapters consume that spacing contract. They belong in the shared `shape` setting group rather than being merged into broader nested `common` spacing controls.

### Media frame

1. image border radius
2. video border radius

These rounded-corner controls are broader than classic-only behavior but still adapter-owned because they only apply to the adapters that render rectangular media surfaces. They should live in a shared multi-adapter setting group rather than being promoted into nested `common` settings.

### Carousel

1. image viewport height
2. video viewport height
3. image shadow preset
4. image custom shadow
5. video shadow preset
6. video custom shadow
7. visible cards
8. autoplay
9. autoplay direction
10. loop
11. gap
12. darken unfocused
13. other carousel-only behavior

Shared height constraint mode (`gallerySizingMode`) and manual CSS height (`galleryManualHeight`) belong in `common`; the classic adapter's per-media base viewport heights remain adapter-specific because the runtime consumes them alongside the rest of the carousel behavior contract.

Classic image/video shadow depth settings follow that same adapter-specific ownership path. Border radius is now covered by the shared adapter-owned `media-frame` group instead of remaining a flat-only appearance field.

### Layout builder

1. scope behavior
2. default slot glow color
3. default slot glow spread
4. template requirements
5. any layout-builder-specific gallery presentation rules

Layout-builder glow defaults stay adapter-owned because only the layout-builder runtime consumes them as per-slot fallbacks when a slot uses Hover = Glow without its own override. They belong in the `layout-builder` setting group rather than in the shared `tile-appearance` group.

---

## REST and Sanitization Implications

### Global settings

Global settings REST update flow must accept nested `galleryConfig` while keeping legacy flat field handling stable.

### Campaign settings

Campaign update flow must accept nested `galleryOverrides` and sanitize it using the same schema rules as global config.

### Core rule

There must not be two independently evolving sanitization definitions for the same gallery behavior concepts.

---

## Testing Implications

At minimum, the data model requires tests for:

1. legacy-only global settings
2. nested-only global settings
3. mixed nested plus legacy global settings
4. campaign nested overrides
5. campaign legacy overrides
6. nested plus legacy resolution order
7. schema-driven adapter restrictions and fallbacks

---

## Non-Goals For This Document

This document does not prescribe:

1. the exact final file paths for every new editor component
2. the exact visual styling of the editor
3. a full migration away from legacy flat fields in Phase 23

Those are implementation details or future cleanup concerns.

---

## Summary

Phase 23 should adopt a nested, responsive gallery configuration model with these properties:

1. one conceptual model for global and campaign contexts
2. one resolver for effective behavior
3. one schema for adapter-aware editing and sanitization
4. one compatibility bridge for legacy flat settings during transition

That is the minimum architecture that supports the required level of deep campaign customization without compounding the current settings drift.