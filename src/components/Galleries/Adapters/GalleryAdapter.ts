/**
 * P12-C: Gallery Adapter Contract
 *
 * Defines the TypeScript interface for pluggable gallery adapters.
 * Each adapter registers with an id and provides a React component
 * that accepts a mixed media array — both images and videos — so a
 * single adapter can display all campaign media in one layout.
 */
import type { ComponentType } from 'react';
import type { MediaItem, GalleryBehaviorSettings } from '@/types';

/** Declared capabilities a gallery adapter can support. */
export type AdapterCapability =
  | 'lightbox'
  | 'drag-scroll'
  | 'infinite-scroll'
  | 'grid-layout'
  | 'carousel-layout'
  | 'keyboard-nav'
  | 'touch-swipe';

/** Unified, type-agnostic props every gallery adapter component must accept. */
export interface GalleryAdapterProps {
  /** All media items for this campaign (images + videos, pre-sorted by order). */
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
}

/** Registered metadata for a gallery adapter. */
export interface AdapterRegistration {
  id: string;
  label: string;
  capabilities: AdapterCapability[];
  component: ComponentType<GalleryAdapterProps>;
}
