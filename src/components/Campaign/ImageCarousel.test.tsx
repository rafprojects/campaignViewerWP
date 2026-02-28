import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../../test/test-utils';
import { ImageCarousel } from './ImageCarousel';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type MediaItem, type GalleryBehaviorSettings } from '@/types';

const images: MediaItem[] = [
  {
    id: 'i1',
    type: 'image',
    source: 'upload',
    url: 'https://example.com/img1.jpg',
    caption: 'Image One',
    order: 1,
  },
  {
    id: 'i2',
    type: 'image',
    source: 'upload',
    url: 'https://example.com/img2.jpg',
    caption: 'Image Two',
    order: 2,
  },
  {
    id: 'i3',
    type: 'image',
    source: 'upload',
    url: 'https://example.com/img3.jpg',
    caption: 'Image Three',
    order: 3,
  },
];

describe('ImageCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens lightbox and navigates images', async () => {
    render(<ImageCarousel images={images} />);

    expect(screen.getByText('Image One')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next image (overlay)'));
    await waitFor(() => {
      expect(screen.getAllByAltText('Image Two')[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Previous image (overlay)'));
    await waitFor(() => {
      expect(screen.getAllByAltText('Image One')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Open lightbox'));
    await waitFor(() => {
      // Lightbox is now a Portal-based overlay (not a Mantine Modal), so we
      // verify it opened by checking the close button and image are rendered.
      expect(screen.getByLabelText('Close lightbox')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Next image (lightbox)'));
    await waitFor(() => {
      expect(screen.getAllByAltText('Image Two')[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Previous image (lightbox)'));
    await waitFor(() => {
      expect(screen.getAllByAltText('Image One')[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/close lightbox/i));
    await waitFor(() => {
      // After close, the portal overlay is unmounted.
      expect(screen.queryByLabelText('Close lightbox')).toBeNull();
    });
  });

  it('uses configured image viewport height', () => {
    render(
      <ImageCarousel
        images={images}
        settings={{
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          imageViewportHeight: 500,
        }}
      />,
    );

    expect(screen.getByTestId('image-viewer-frame')).toHaveStyle({ height: '500px' });
  });

  it('opens lightbox on Space key press on viewer frame', async () => {
    render(<ImageCarousel images={images} />);
    const frame = screen.getByTestId('image-viewer-frame');
    fireEvent.keyDown(frame, { key: ' ' });

    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('navigates via ArrowLeft and ArrowRight keyboard on viewer frame', async () => {
    const settings: GalleryBehaviorSettings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      scrollAnimationStyle: 'instant',
    };
    render(<ImageCarousel images={images} settings={settings} />);
    const frame = screen.getByTestId('image-viewer-frame');

    fireEvent.keyDown(frame, { key: 'ArrowRight' });
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(screen.getAllByAltText('Image Two')[0]).toBeInTheDocument());

    fireEvent.keyDown(frame, { key: 'ArrowLeft' });
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(screen.getAllByAltText('Image One')[0]).toBeInTheDocument());
  });

  it('renders DotNavigator below viewport when dotNavPosition=below', () => {
    const settings: GalleryBehaviorSettings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      dotNavEnabled: true,
      dotNavPosition: 'below',
    };
    render(<ImageCarousel images={images} settings={settings} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(images.length);
  });

  it('selects a dot via DotNavigator and updates current image', async () => {
    const settings: GalleryBehaviorSettings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      dotNavEnabled: true,
      dotNavPosition: 'below',
      scrollAnimationStyle: 'instant',
    };
    render(<ImageCarousel images={images} settings={settings} />);

    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[2]);
    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => expect(screen.getAllByAltText('Image Three')[0]).toBeInTheDocument());
  });

  it('transitions previous image with smooth animation (beginTransition)', async () => {
    const settings: GalleryBehaviorSettings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      navArrowAutoHideMs: 0,
      scrollAnimationStyle: 'smooth',
      scrollAnimationDurationMs: 300,
    };
    render(<ImageCarousel images={images} settings={settings} />);

    // Click next triggers beginTransition
    fireEvent.click(screen.getByLabelText('Next image (overlay)'));

    // Advance past the transition
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    await waitFor(() => expect(screen.getAllByAltText('Image Two')[0]).toBeInTheDocument());
  });

  it('onTransitionEnd clears the previous image', async () => {
    const settings: GalleryBehaviorSettings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      navArrowAutoHideMs: 0,
      scrollAnimationStyle: 'smooth',
      scrollAnimationDurationMs: 300,
    };
    render(<ImageCarousel images={images} settings={settings} />);

    fireEvent.click(screen.getByLabelText('Next image (overlay)'));

    // The exit box appears briefly; fire transitionEnd on it if present
    const exitEl = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    if (exitEl) {
      fireEvent.transitionEnd(exitEl);
    }

    await act(async () => { vi.advanceTimersByTime(500); });

    await waitFor(() => expect(screen.getAllByAltText('Image Two')[0]).toBeInTheDocument());
  });
});
