/**
 * P12-C: Gallery Adapter Contract
 *
 * Defines the TypeScript interface for pluggable gallery adapters.
 * Each adapter registers with an id and provides a React component
 * that accepts a mixed media array — both images and videos — so a
 * single adapter can display all campaign media in one layout.
 *
 * P35-A: Widened contract for listing-mode rendering.
 * Optional `items` + `renderItem` allow a host (CardGallery) to delegate
 * arbitrary-item layout to an adapter without the adapter owning item data.
 * The `listingMode` discriminant lets adapters opt into surface-aware
 * affordances. `AdapterCapability` gains `'listing-compatible'` and
 * `AdapterRegistration` gains `paginationOwnership` to model carousel-owned
 * pagination cleanly.
 */
import type { ComponentType, ReactNode } from 'react';
import type {
  MediaItem,
  GalleryBehaviorSettings,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';

export type GalleryAdapterId =
  | 'classic'
  | 'carousel'
  | 'compact-grid'
  | 'justified'
  | 'mosaic'
  | 'masonry'
  | 'hexagonal'
  | 'circular'
  | 'diamond'
  | 'layout-builder'
  | 'spotlight'
  | 'scroll-snap'
  | 'coverflow';

/** Declared capabilities a gallery adapter can support. */
export type AdapterCapability =
  | 'lightbox'
  | 'drag-scroll'
  | 'infinite-scroll'
  | 'grid-layout'
  | 'carousel-layout'
  | 'keyboard-nav'
  | 'touch-swipe'
  | 'layout-builder'
  /** P35-A: adapter can render arbitrary items via the host-supplied renderItem renderer. */
  | 'listing-compatible';

export type AdapterSettingGroup =
  | 'media-frame'
  | 'photo-grid'
  | 'tile-appearance'
  | 'carousel'
  | 'compact-grid'
  | 'justified'
  | 'masonry'
  | 'shape'
  | 'layout-builder'
  | 'spotlight'
  | 'scroll-snap';

export type AdapterSettingFieldScope = 'unified' | 'image' | 'video';

export type AdapterSettingFieldAppliesTo = 'always' | AdapterSettingFieldScope | readonly AdapterSettingFieldScope[];

export type AdapterSettingGroupLayout = 'group' | 'stack';

export type AdapterSettingGroupPlacement = 'inline' | 'section';

export type AdapterSettingGroupScopeMode = 'shared' | 'contextual';

export interface AdapterNumberSettingField {
  control: 'number';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  min: number;
  max: number;
  step: number;
  fallback: number;
}

export interface AdapterDimensionSettingField {
  control: 'dimension';
  key: keyof GalleryBehaviorSettings;
  unitKey: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  allowedUnits: readonly string[];
  max: number;
  step: number;
  fallback: number;
}

export interface AdapterSelectSettingField {
  control: 'select';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  fallback: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export interface AdapterBooleanSettingField {
  control: 'boolean';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  fallback: boolean;
}

export interface AdapterTextSettingField {
  control: 'text';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  fallback: string;
  placeholder?: string;
}

export interface AdapterColorSettingField {
  control: 'color';
  key: keyof GalleryBehaviorSettings;
  label: string;
  description: string;
  appliesTo?: AdapterSettingFieldAppliesTo;
  fallback: string;
}

export type AdapterSettingFieldDefinition =
  | AdapterNumberSettingField
  | AdapterDimensionSettingField
  | AdapterSelectSettingField
  | AdapterBooleanSettingField
  | AdapterTextSettingField
  | AdapterColorSettingField;

export interface AdapterSettingGroupDefinition {
  group: AdapterSettingGroup;
  fields: AdapterSettingFieldDefinition[];
  layout?: AdapterSettingGroupLayout;
  placement?: AdapterSettingGroupPlacement;
  scopeMode?: AdapterSettingGroupScopeMode;
}

export type AdapterOptionContext =
  | 'unified-gallery'
  | 'per-type-gallery'
  | 'per-breakpoint-gallery'
  | 'campaign-override'
  /** P35-A: listing adapter selector shown in the Campaign Listing settings accordion. */
  | 'campaign-listing';

export type AdapterMediaScope = 'image' | 'video';

/**
 * P35-A: Minimum contract for items supplied by a listing-mode host.
 * Adapters receive ListingItem[] and call renderItem(item, idx); they do not
 * access item properties directly.
 */
export interface ListingItem {
  id: string;
}

/** Unified, type-agnostic props every gallery adapter component must accept. */
export interface GalleryAdapterProps {
  /** All media items for this campaign (images + videos, pre-sorted by order). */
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  /** Explicit resolved runtime common/background data for the active scope. */
  runtime?: ResolvedGallerySectionRuntime;
  /** Measured container dimensions from GallerySectionWrapper. Optional during migration. */
  containerDimensions?: ContainerDimensions;
  /**
   * P35-A: Arbitrary items supplied by a listing-mode host (e.g. campaigns in CardGallery).
   * When present, adapters render via `renderItem` instead of their media-tile path.
   */
  items?: ListingItem[];
  /**
   * P35-A: Host-supplied renderer called once per item in listing mode.
   * The adapter is responsible for container/layout; the host is responsible for
   * what each item looks like.
   */
  renderItem?: (item: ListingItem, index: number) => ReactNode;
  /**
   * P35-A: Discriminant that lets adapters render surface-aware affordances.
   * Absent outside listing mode.
   */
  listingMode?: { surface: 'campaign-listing' };
}

/** Registered metadata for a gallery adapter. */
export interface AdapterRegistration {
  id: GalleryAdapterId;
  label: string;
  aliases?: GalleryAdapterId[];
  optionLabels?: Partial<Record<AdapterOptionContext, string>>;
  capabilities: AdapterCapability[];
  settingGroups: AdapterSettingGroup[];
  supportsMobile?: boolean;
  component: ComponentType<GalleryAdapterProps>;
  /**
   * P35-A: Who owns pagination when this adapter is active in listing mode.
   * `'host'` (default) — CardGallery drives load-more / paginated / show-all.
   * `'adapter'` — the adapter manages its own slide state (e.g. classic carousel);
   * the host hides its pagination UI entirely.
   */
  paginationOwnership?: 'host' | 'adapter';
}
