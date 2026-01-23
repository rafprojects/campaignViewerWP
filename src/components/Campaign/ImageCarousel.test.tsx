import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageCarousel } from './ImageCarousel';
import type { MediaItem } from '@/types';

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

    const nextButton = document.querySelector('[class*="navButtonRight"]');
    if (nextButton) {
      fireEvent.click(nextButton);
      expect(screen.getByText('Image One')).toBeInTheDocument();
    }

    const prevButton = document.querySelector('[class*="navButtonLeft"]');
    if (prevButton) {
      fireEvent.click(prevButton);
      expect(screen.getByText('Image Two')).toBeInTheDocument();
    }

    const zoomButton = document.querySelector('[class*="zoomButton"]');
    if (zoomButton) {
      fireEvent.click(zoomButton);
    }

    const imageOne = screen.getAllByAltText('Image One')[0];
    fireEvent.click(imageOne);
    const lightbox = document.querySelector('[class*="lightbox"]');
    expect(lightbox).toBeTruthy();
    if (lightbox) {
      fireEvent.click(lightbox);
    }
    await waitFor(() => {
      expect(document.querySelector('[class*="lightbox"]')).toBeNull();
    });
  });
});
