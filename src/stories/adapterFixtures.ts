import type { MediaItem, GalleryBehaviorSettings, ResolvedGallerySectionRuntime, ContainerDimensions } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

export type { GalleryBehaviorSettings, ResolvedGallerySectionRuntime, ContainerDimensions };

/** Stable 9-item media fixture (landscape × 4, portrait × 3, square × 2) used
 *  by all adapter stories and P49-D visual regression tests. */
export const FIXTURE_MEDIA: MediaItem[] = [
  { id: 'm1', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion1/800/600', width: 800, height: 600, order: 0, caption: 'Landscape 1' },
  { id: 'm2', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion2/600/800', width: 600, height: 800, order: 1, caption: 'Portrait 1' },
  { id: 'm3', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion3/800/600', width: 800, height: 600, order: 2, caption: 'Landscape 2' },
  { id: 'm4', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion4/600/800', width: 600, height: 800, order: 3, caption: 'Portrait 2' },
  { id: 'm5', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion5/600/600', width: 600, height: 600, order: 4, caption: 'Square 1' },
  { id: 'm6', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion6/800/600', width: 800, height: 600, order: 5, caption: 'Landscape 3' },
  { id: 'm7', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion7/600/600', width: 600, height: 600, order: 6, caption: 'Square 2' },
  { id: 'm8', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion8/600/800', width: 600, height: 800, order: 7, caption: 'Portrait 3' },
  { id: 'm9', type: 'image', source: 'upload', url: 'https://picsum.photos/seed/mullion9/800/600', width: 800, height: 600, order: 8, caption: 'Landscape 4' },
];

export const FIXTURE_SETTINGS: GalleryBehaviorSettings = {
  ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
};

export const FIXTURE_RUNTIME: ResolvedGallerySectionRuntime = {
  breakpoint: 'desktop',
  scope: 'unified',
  common: {},
  background: {
    type: 'none',
    color: '',
    gradient: '',
    imageUrl: '',
  },
  adapterSettings: {},
};

export const FIXTURE_CONTAINER: ContainerDimensions = {
  width: 900,
  height: 500,
};
