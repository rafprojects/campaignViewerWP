/**
 * Diamond Gallery Adapter  (adapter id = "diamond")
 *
 * Argyle/diamond grid: square tiles rotated 45° via CSS clip-path. Rows are
 * offset horizontally by half a tile width and overlap vertically by half a
 * tile height, forming an interlocked diamond lattice.
 *
 * All rendering/behaviour lives in the shared {@link ClippedTileGridGallery}
 * (Phase 70-B) — this file only supplies the diamond-specific config.
 */
import { IconDiamond } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { ClippedTileGridGallery, type ClippedTileGridConfig } from '../_shared/ClippedTileGridGallery';

/** Diamond clip-path: rhombus with tips at 12, 3, 6, 9 o'clock positions. */
const DIAMOND_CONFIG: ClippedTileGridConfig = {
  scope: 'diamond',
  debugName: 'DiamondGallery',
  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  // Vertical overlap ratio — 0.5 = rows are half-a-tile apart vertically.
  vOverlap: 0.5,
  icon: <IconDiamond size={18} />,
  playIconRatio: 0.22,
  zoomIconRatio: 0.2,
  badge: { bottom: '26%', padding: '1px 4px', fontSize: 8, whiteSpace: 'nowrap' },
};

interface DiamondGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function DiamondGallery({ media, settings, runtime }: DiamondGalleryProps) {
  return <ClippedTileGridGallery media={media} settings={settings} runtime={runtime} config={DIAMOND_CONFIG} />;
}

setWpsgDebugDisplayName(DiamondGallery, 'DiamondGallery');
