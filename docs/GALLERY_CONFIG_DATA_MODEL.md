# Gallery Configuration Data Model

## Purpose

This document records the implemented gallery configuration model for WP Super Gallery as of Phase 25. Phase 23 and Phase 24 introduced the nested structures; Phase 25 completed the contract reset that makes them the active gallery settings surface.

## Status Note (2026-04-30)

This file documents the current nested-first gallery contract in the codebase.

`galleryConfig` and campaign `galleryOverrides` are the only supported gallery configuration surfaces exposed to the app and REST responses when nested data exists. Older flat global settings and historical campaign adapter override fields may still be promoted into nested form during DB/read-time migration, but they are no longer rehydrated back into the live frontend/PHP contract once nested config is available.

The broader implementation/refactor record lives in [PHASE25_SETTINGS_REFACTOR.md](PHASE25_SETTINGS_REFACTOR.md).

The goals of the model are:

1. support responsive gallery behavior cleanly
2. support unified and per-type gallery modes with one coherent structure
3. support full campaign-level gallery parity
4. promote older flat settings into nested config without keeping them in the active contract
5. allow UI, runtime rendering, and sanitization to operate from the same conceptual model

---

## Design Principles

1. New nested config is the authoritative source of truth for persistence and runtime resolution.
2. Older flat fields may still be accepted as migration inputs when nested config is missing, but they are not part of the live response/runtime contract once nested data exists.
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

Phase 25 uses `galleryConfig` as the only active gallery-settings contract. `GalleryBehaviorSettings` still includes some legacy flat gallery fields in the broader type/default surface for migration helpers and untouched consumers, but the gallery editor, runtime resolver, and PHP REST contract do not depend on those flat fields when `galleryConfig` is present.

```ts
export interface GalleryBehaviorSettings {
  // broader settings surface omitted

  // canonical gallery settings contract
  galleryConfig?: GalleryConfig;
}
```

### Current Rule

If `galleryConfig` is present and valid, it is the only gallery-settings contract surfaced to frontend UI, runtime resolution, and REST responses. If stored data contains only older flat fields, migration/read helpers may promote them into `galleryConfig`, but the promoted nested result is not mirrored back into flat gallery response fields.

---

## Implemented Campaign Settings Shape

Phase 25 keeps `galleryOverrides` as the only supported campaign gallery override surface in frontend types and REST responses.

```ts
export interface Campaign {
  // existing campaign fields omitted
  layoutTemplateId?: string;
  galleryOverrides?: Partial<GalleryConfig>;
}
```

The WordPress storage key for the nested campaign override payload is `_wpsg_gallery_overrides`.

Older `_wpsg_image_adapter_id` and `_wpsg_video_adapter_id` post meta may still be promoted into nested overrides during PHP migration/read flows, but they are not exposed as parallel campaign fields in the app contract.

### Current Rule

Campaign responses and modal/runtime state use only nested `galleryOverrides`. Any legacy flat campaign adapter data is normalized into nested overrides before resolution runs.

---

## Resolution Order

Effective gallery behavior must be resolved in one place, in one deterministic order.

### Current order

1. campaign nested override, after any legacy storage promotion into nested form
2. global nested `galleryConfig`
3. hard fallback from default nested config

### Why this order

1. New nested config must win when present.
2. Campaign-level intent must override global intent.
3. Legacy values are promoted into nested form before resolution instead of being consulted as a parallel runtime source.
4. Runtime behavior stays predictable and testable.

---

## Legacy Input Migration

### Current behavior

1. Older installs may still store only flat global gallery settings or older campaign adapter meta.
2. DB/read-time promotion utilities may translate those stored values into nested `galleryConfig` or `galleryOverrides`.
3. Once nested config exists, live frontend runtime, settings panel state, PHP `get_settings()`, and REST responses do not rehydrate flat gallery bridge fields.
4. Save flows persist nested config and prune obsolete flat fields where that persistence path owns the write.

### Practical contract

1. Read nested config first if present.
2. If nested config is absent, promote legacy flat settings or campaign adapter overrides into nested config during load or DB backfill.
3. Resolve runtime behavior from nested config only.
4. Emit nested gallery data only in active settings and campaign contracts.

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

Global settings REST update flow must accept nested `galleryConfig`. Legacy flat inputs may still be sanitized as migration inputs, but REST responses are nested-only whenever `gallery_config` exists.

### Campaign settings

Campaign update flow must accept nested `galleryOverrides` and sanitize it using the same schema rules as global config. Older flat campaign adapter meta may still be promoted before that contract is surfaced, but not exposed as parallel response fields.

### Core rule

There must not be two independently evolving sanitization definitions for the same gallery behavior concepts.

---

## Testing Implications

At minimum, the data model requires tests for:

1. legacy-only global settings promotion into nested config
2. nested-only global settings
3. global settings responses omitting flat gallery bridge fields when nested config exists
4. campaign nested overrides
5. legacy campaign meta promotion into nested overrides
6. nested resolution order after promotion
7. schema-driven adapter restrictions and fallbacks

---

## Non-Goals For This Document

This document does not prescribe:

1. the exact final file paths for every new editor component
2. the exact visual styling of the editor
3. the exact timing for deleting every remaining migration helper after the nested-only contract landed in Phase 25

Those are implementation details or future cleanup concerns.

---

## Summary

The implemented gallery configuration model now has these properties:

1. one conceptual model for global and campaign contexts
2. one resolver for effective behavior
3. one schema for adapter-aware editing and sanitization
4. one active nested contract for settings and campaign overrides, with legacy flat values limited to migration input/backfill paths

That is the minimum architecture that supports deep campaign customization without carrying a parallel flat-field runtime bridge.