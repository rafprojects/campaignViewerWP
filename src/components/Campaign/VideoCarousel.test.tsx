import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoCarousel } from './VideoCarousel';
import type { MediaItem } from '@/types';

const videos: MediaItem[] = [
  {
    id: 'v1',
    type: 'video',
    source: 'external',
    url: 'https://example.com/watch?v=1',
    embedUrl: 'https://example.com/embed/1',
    thumbnail: 'https://example.com/thumb1.jpg',
    caption: 'Video One',
    order: 1,
  },
  {
    id: 'v2',
    type: 'video',
    source: 'external',
    url: 'https://example.com/watch?v=2',
    embedUrl: 'https://example.com/embed/2',
    thumbnail: 'https://example.com/thumb2.jpg',
    caption: 'Video Two',
    order: 2,
  },
];

describe('VideoCarousel', () => {
  it('renders captions and switches videos', () => {
    render(<VideoCarousel videos={videos} />);

    expect(screen.getByText('Video One')).toBeInTheDocument();

    const playOverlay = document.querySelector('[class*="playOverlay"]');
    if (playOverlay) {
      fireEvent.click(playOverlay);
      expect(screen.getByTitle('Video player: Video One')).toBeInTheDocument();
    }

    const nextButton = document.querySelector('[class*="navButtonRight"]');
    if (nextButton) {
      fireEvent.click(nextButton);
    }
    expect(screen.getByText('Video Two')).toBeInTheDocument();

    const prevButton = document.querySelector('[class*="navButtonLeft"]');
    if (prevButton) {
      fireEvent.click(prevButton);
    }
    expect(screen.getByText('Video One')).toBeInTheDocument();
  });
});
