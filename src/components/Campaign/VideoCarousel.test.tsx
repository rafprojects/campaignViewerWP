import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { VideoCarousel } from './VideoCarousel';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type MediaItem } from '@/types';

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

    fireEvent.click(screen.getAllByAltText('Video One')[0]);
    expect(screen.getByTitle('Video player: Video One')).toBeInTheDocument();

    fireEvent.click(screen.getAllByAltText('Video Two')[0]);
    expect(screen.getByText('Video Two')).toBeInTheDocument();

    fireEvent.click(screen.getAllByAltText('Video One')[0]);
    expect(screen.getByText('Video One')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next video'));
    expect(screen.getByText('Video Two')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous video'));
    expect(screen.getByText('Video One')).toBeInTheDocument();
  });

  it('renders native video player for uploaded videos with transparent surface', () => {
    const uploadedVideos: MediaItem[] = [
      {
        id: 'u1',
        type: 'video',
        source: 'upload',
        url: 'https://example.com/video.mp4',
        thumbnail: 'https://example.com/video-thumb.jpg',
        caption: 'Uploaded Video',
        order: 1,
      },
    ];

    render(<VideoCarousel videos={uploadedVideos} />);

    fireEvent.click(screen.getByAltText('Uploaded Video'));

    const player = screen.getByLabelText('Video player: Uploaded Video');
    expect(player.tagName.toLowerCase()).toBe('video');

    expect(screen.getByTestId('video-player-surface')).toBeInTheDocument();
    expect(player).toHaveStyle({ objectFit: 'contain' });
  });

  it('appends autoplay to external embed URL safely', () => {
    render(<VideoCarousel videos={videos} />);

    fireEvent.click(screen.getAllByAltText('Video One')[0]);

    const iframe = screen.getByTitle('Video player: Video One') as HTMLIFrameElement;
    expect(iframe.src).toContain('autoplay=1');
  });

  it('uses configured video viewport height', () => {
    render(
      <VideoCarousel
        videos={videos}
        settings={{
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          videoViewportHeight: 520,
        }}
      />,
    );

    expect(screen.getByTestId('video-player-frame')).toHaveStyle({ height: '520px' });
  });
});
