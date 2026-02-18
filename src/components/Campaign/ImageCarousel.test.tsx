import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { ImageCarousel } from './ImageCarousel';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type MediaItem } from '@/types';

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
];

describe('ImageCarousel', () => {
  it('opens lightbox and navigates images', async () => {
    render(<ImageCarousel images={images} />);

    expect(screen.getByText('Image One')).toBeInTheDocument();

    const imageTwoThumb = screen.getAllByAltText('Image Two')[0];
    fireEvent.click(imageTwoThumb);
    expect(screen.getByText('Image Two')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next image'));
    await waitFor(() => {
      expect(screen.getAllByAltText('Image Two')[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Previous image'));
    await waitFor(() => {
      expect(screen.getAllByAltText('Image One')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Open lightbox'));
    await waitFor(() => {
      expect(document.body.getAttribute('data-scroll-locked')).toBe('1');
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
      expect(document.body.getAttribute('data-scroll-locked')).toBeNull();
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
});
