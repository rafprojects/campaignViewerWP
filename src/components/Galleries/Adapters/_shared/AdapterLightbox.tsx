import { Lightbox } from '@wp-super-gallery/shared-ui';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';

interface AdapterLightboxProps {
  isOpen: boolean;
  media: MediaItem[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** The adapter's behaviour settings — supplies the five lightbox props below. */
  settings: GalleryBehaviorSettings;
}

/**
 * Thin wrapper around {@link Lightbox} that owns the five
 * `settings.lightbox*` → prop mappings which every gallery adapter previously
 * hand-copied byte-for-byte (Phase 70-A). The variable pieces — open state,
 * media list, current index and the three navigation callbacks — stay owned by
 * each adapter and are threaded through unchanged, so behaviour is identical.
 */
export function AdapterLightbox({
  isOpen,
  media,
  currentIndex,
  onPrev,
  onNext,
  onClose,
  settings,
}: AdapterLightboxProps) {
  return (
    <Lightbox
      isOpen={isOpen}
      media={media}
      currentIndex={currentIndex}
      onPrev={onPrev}
      onNext={onNext}
      onClose={onClose}
      videoMaxWidth={settings.lightboxVideoMaxWidth}
      videoMaxWidthUnit={settings.lightboxVideoMaxWidthUnit}
      videoHeight={settings.lightboxVideoHeight}
      videoHeightUnit={settings.lightboxVideoHeightUnit}
      mediaMaxHeight={settings.lightboxMediaMaxHeight}
    />
  );
}
