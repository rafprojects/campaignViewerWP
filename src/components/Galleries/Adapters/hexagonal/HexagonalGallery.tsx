/**
 * Hexagonal Gallery Adapter  (adapter id = "hexagonal")
 *
 * Honeycomb layout: pointy-top hexagonal tiles in offset rows, with a
 * controlled vertical overlap producing the classic honeycomb pattern.
 *
 * All rendering/behaviour lives in the shared {@link ClippedTileGridGallery}
 * (Phase 70-B) — this file only supplies the hexagon-specific config.
 */
import { IconHexagon } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { ClippedTileGridGallery, type ClippedTileGridConfig } from '../_shared/ClippedTileGridGallery';

/** Pointy-top hexagon — tip at 12 o'clock and 6 o'clock. */
const HEXAGONAL_CONFIG: ClippedTileGridConfig = {
  scope: 'hex',
  debugName: 'HexagonalGallery',
  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  // Row overlap ratio: rows are this × tileSize apart vertically (classic honeycomb).
  vOverlap: 0.25,
  icon: <IconHexagon size={18} />,
  playIconRatio: 0.25,
  zoomIconRatio: 0.22,
  badge: { bottom: '28%', padding: '1px 5px', fontSize: 9 },
};

interface HexagonalGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function HexagonalGallery({ media, settings, runtime }: HexagonalGalleryProps) {
  return <ClippedTileGridGallery media={media} settings={settings} runtime={runtime} config={HEXAGONAL_CONFIG} />;
}

setWpsgDebugDisplayName(HexagonalGallery, 'HexagonalGallery');
