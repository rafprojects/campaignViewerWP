# Gallery Configuration Data Model

## Purpose

This document records the implemented Phase 23 and Phase 24 gallery configuration model for WP Super Gallery.

The goals of the model are:

1. support responsive gallery behavior cleanly
2. support unified and per-type gallery modes with one coherent structure
3. support full campaign-level gallery parity
4. preserve backward compatibility with current flat settings during transition
5. allow UI, runtime rendering, and sanitization to operate from the same conceptual model

---

## Design Principles

1. New nested config is the authoritative source of truth for persistence and runtime resolution.
2. Existing flat fields remain supported as compatibility inputs and in-memory bridge values while the transition is underway, but are no longer written on save.
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

## Implemented Type Model

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
  galleryImageLabel?: string;
  galleryVideoLabel?: string;
  galleryLabelJustification?: 'left' | 'center' | 'right';
  showGalleryLabelIcon?: boolean;
  showCampaignGalleryLabels?: boolean;
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

`adapterSettings` remains intentionally broad at the top-level TypeScript type, but the live editor, shared adapter registry, runtime resolver, and backend sanitizer now constrain the known Phase 23 adapter fields through one schema-driven contract.

---

## Implemented Global Settings Shape

Phase 24 retains existing flat settings in `GalleryBehaviorSettings` only for compatibility, while using a nested preferred field as the persisted representation.

```ts
export interface GalleryBehaviorSettings {
  // existing flat fields remain for compatibility and local bridge hydration
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

### Current Rule

If `galleryConfig` is present and valid, it takes precedence over equivalent legacy flat fields. When a response contains only legacy flat fields, the load path promotes them into `galleryConfig` and rehydrates flat compatibility values in memory from the nested result.

---

## Implemented Campaign Settings Shape

Phase 23 introduced full campaign parity, and Phase 24 makes the nested override field the only persisted campaign representation.

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

The WordPress storage key for the nested campaign override payload is `_wpsg_gallery_overrides`.

Legacy `_wpsg_image_adapter_id` and `_wpsg_video_adapter_id` post meta remain readable for one release cycle, but new nested saves delete those flat keys.

### Current Rule

Campaigns should store only the portions they override, but the allowed override surface is the full editor-supported gallery config model.

That means campaigns are not limited to adapter ids or adapter-specific deltas. They may override responsive common settings and scope behavior as needed.

---

## Resolution Order

Effective gallery behavior must be resolved in one place, in one deterministic order.

### Current order

1. campaign nested override
2. campaign legacy override (`imageAdapterId`, `videoAdapterId`) only when no nested campaign override is present for that scope
3. global nested `galleryConfig`
4. hard fallback from default nested config

### Why this order

1. New nested config must win when present.
2. Campaign-level intent must override global intent.
3. Legacy values are migrated into nested form during load, not consulted as a parallel runtime source once nested config is available.
4. Runtime behavior becomes predictable and testable.

---

## Compatibility Strategy

### Transitional behavior

1. Existing installs may still have only flat global fields.
2. Existing campaigns may still have only legacy adapter override fields.
3. Load utilities must promote legacy flat data into nested config when nested data is missing.
4. Save utilities must persist nested config only and prune legacy flat keys when nested payloads are posted.

### Practical bridge behavior

1. Read nested config first if present.
2. If nested config is absent, promote legacy flat settings or campaign adapter overrides into nested config during load.
3. Rehydrate flat compatibility fields in memory from nested config for editor surfaces that still consume them.
4. Do not emit legacy flat gallery keys in settings or campaign save payloads.

### Migration posture

Phase 24 is migration-first on writes and compatibility-first on reads.

That means the system still reads old representations during the bridge window, but successful saves normalize storage back to the nested model.

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

Phase 23 does not move every user-facing setting into the nested responsive model. The implemented surface covers the core gallery layout and presentation concerns needed for the shared editor, runtime resolver, and campaign parity path.

### Current nested common settings coverage

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
13. gallery image label text
14. gallery video label text
15. gallery label justification
16. gallery label icon visibility
17. campaign gallery label visibility

### Still out of scope for Phase 23

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

Phase 23 adopts a nested, responsive gallery configuration model with these properties:

1. one conceptual model for global and campaign contexts
2. one resolver for effective behavior
3. one schema for adapter-aware editing and sanitization
4. one compatibility bridge for legacy flat settings during transition

That is the minimum architecture that supports the required level of deep campaign customization without compounding the current settings drift.