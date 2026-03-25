/**
 * P12-C: Gallery Adapter Contract
 *
 * Defines the TypeScript interface for pluggable gallery adapters.
 * Each adapter registers with an id and provides a React component
 * that accepts a mixed media array — both images and videos — so a
 * single adapter can display all campaign media in one layout.
 */
import type { ComponentType } from 'react';
import type { MediaItem, GalleryBehaviorSettings, ContainerDimensions } from '@/types';

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
  | 'layout-builder';

/** Declared capabilities a gallery adapter can support. */
export type AdapterCapability =
  | 'lightbox'
  | 'drag-scroll'
  | 'infinite-scroll'
  | 'grid-layout'
  | 'carousel-layout'
  | 'keyboard-nav'
  | 'touch-swipe'
  | 'layout-builder';

export type AdapterSettingGroup =
  | 'carousel'
  | 'compact-grid'
  | 'justified'
  | 'masonry'
  | 'shape'
  | 'layout-builder';

export type AdapterOptionContext =
  | 'unified-gallery'
  | 'per-type-gallery'
  | 'per-breakpoint-gallery'
  | 'campaign-override';

/** Unified, type-agnostic props every gallery adapter component must accept. */
export interface GalleryAdapterProps {
  /** All media items for this campaign (images + videos, pre-sorted by order). */
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  /** Measured container dimensions from GallerySectionWrapper. Optional during migration. */
  containerDimensions?: ContainerDimensions;
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
}
