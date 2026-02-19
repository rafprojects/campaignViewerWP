/**
 * P12-C: Gallery Adapter Contract
 *
 * Defines the TypeScript interface for pluggable gallery adapters.
 * Each adapter registers with an id, declares capabilities, and provides
 * a React component that conforms to the appropriate Props interface.
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

export type AdapterMediaType = 'image' | 'video';

/** Props contract all image gallery adapter components must accept. */
export interface ImageAdapterProps {
  images: MediaItem[];
  settings: GalleryBehaviorSettings;
}

/** Props contract all video gallery adapter components must accept. */
export interface VideoAdapterProps {
  videos: MediaItem[];
  settings: GalleryBehaviorSettings;
}

/**
 * Registered metadata for a gallery adapter.
 * T narrows the mediaType and component prop type together.
 */
export interface AdapterRegistration<T extends AdapterMediaType = AdapterMediaType> {
  id: string;
  mediaType: T;
  label: string;
  capabilities: AdapterCapability[];
  component: T extends 'image'
    ? ComponentType<ImageAdapterProps>
    : ComponentType<VideoAdapterProps>;
}
