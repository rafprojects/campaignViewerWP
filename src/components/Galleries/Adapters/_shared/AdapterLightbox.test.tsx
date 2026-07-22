/**
 * Phase 70-A: unit test for the shared adapter lightbox wrapper.
 *
 * Proves it forwards the five `settings.lightbox*` values (the byte-identical
 * mapping every adapter used to hand-copy) plus the per-adapter variable props
 * through to the underlying <Lightbox> unchanged.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

const { lightboxSpy } = vi.hoisted(() => ({ lightboxSpy: vi.fn() }));

vi.mock('@wp-super-gallery/shared-ui', () => ({
  Lightbox: (props: Record<string, unknown>) => {
    lightboxSpy(props);
    return null;
  },
}));

// Imported after the mock is registered.
import { AdapterLightbox } from './AdapterLightbox';

const settings: GalleryBehaviorSettings = {
  ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  lightboxVideoMaxWidth: 920,
  lightboxVideoMaxWidthUnit: 'px',
  lightboxVideoHeight: 480,
  lightboxVideoHeightUnit: 'px',
  lightboxMediaMaxHeight: '80dvh',
};

const media: MediaItem[] = [{ id: '1', url: 'a.jpg', type: 'image' } as MediaItem];

describe('AdapterLightbox', () => {
  it('forwards the variable props and the five settings-derived props to Lightbox', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onClose = vi.fn();

    render(
      <AdapterLightbox
        isOpen
        media={media}
        currentIndex={2}
        onPrev={onPrev}
        onNext={onNext}
        onClose={onClose}
        settings={settings}
      />,
    );

    const props = lightboxSpy.mock.calls[0]![0];
    expect(props).toMatchObject({
      isOpen: true,
      media,
      currentIndex: 2,
      onPrev,
      onNext,
      onClose,
      videoMaxWidth: 920,
      videoMaxWidthUnit: 'px',
      videoHeight: 480,
      videoHeightUnit: 'px',
      mediaMaxHeight: '80dvh',
    });
  });
});
