/**
 * P50-C: StackedDeckAdapter behavior tests.
 *
 * Uses the real useCarousel / useSwipe hooks so cycling, promotion, and
 * keyboard navigation are exercised end-to-end. Lightbox and LazyImage are
 * mocked like the shared adapter smoke suite.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import type { MediaItem, GalleryBehaviorSettings } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

vi.mock('@wp-super-gallery/shared-ui', () => ({
  Lightbox: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="lightbox-open" /> : null,
}));

vi.mock('@/components/CampaignGallery/LazyImage', () => ({
  LazyImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const { StackedDeckAdapter } = await import('./StackedDeckAdapter');

const makeImage = (id: string, order: number): MediaItem => ({
  id,
  type: 'image',
  source: 'upload',
  url: `https://example.com/${id}.jpg`,
  thumbnail: `https://example.com/${id}-thumb.jpg`,
  title: `Image ${id}`,
  order,
  width: 800,
  height: 600,
});

const makeVideo = (id: string, order: number): MediaItem => ({
  id,
  type: 'video',
  source: 'external',
  url: `https://example.com/${id}`,
  thumbnail: `https://example.com/${id}-thumb.jpg`,
  title: `Video ${id}`,
  order,
  width: 1280,
  height: 720,
});

const THREE_IMAGES: MediaItem[] = [
  makeImage('img-1', 0),
  makeImage('img-2', 1),
  makeImage('img-3', 2),
];

const SETTINGS: GalleryBehaviorSettings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS };

function getCard(title: string): HTMLElement {
  return screen.getByRole('button', { name: title });
}

function getStage(container: HTMLElement): HTMLElement {
  // The stage is the focusable swipe/keyboard surface wrapping the cards.
  const stage = container.querySelector<HTMLElement>('[tabindex="0"]');
  if (!stage) throw new Error('stage not found');
  return stage;
}

function swipe(stage: HTMLElement, fromX: number, toX: number) {
  // jsdom's pointer-event fallback drops clientX, so dispatch MouseEvents under
  // the pointer event names instead. Their pointerType is undefined, which
  // passes useSwipe's pointerType === 'mouse' guard.
  fireEvent(stage, new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: fromX }));
  fireEvent(stage, new MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: toX }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('StackedDeckAdapter', () => {
  it('renders all cards with the first item on top', () => {
    render(<StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />);

    expect(getCard('Image img-1')).toHaveClass('wpsg-stacked-top');
    expect(getCard('Image img-2')).not.toHaveClass('wpsg-stacked-top');
    expect(getCard('Image img-3')).not.toHaveClass('wpsg-stacked-top');
  });

  it('peeking cards have alternating depth offsets and rotation', () => {
    render(<StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />);

    expect(getCard('Image img-1').style.transform).toBe('translateX(0px) rotate(0deg)');
    expect(getCard('Image img-2').style.transform).toBe('translateX(4px) rotate(1.5deg)');
    expect(getCard('Image img-3').style.transform).toBe('translateX(-8px) rotate(-3deg)');
  });

  it('top card has the highest z-index; depth lowers z-index', () => {
    render(<StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />);

    expect(getCard('Image img-1').style.zIndex).toBe('3');
    expect(getCard('Image img-2').style.zIndex).toBe('2');
    expect(getCard('Image img-3').style.zIndex).toBe('1');
  });

  it('swiping left dismisses the top card to the back of the stack', () => {
    vi.useFakeTimers();
    const { container } = render(
      <StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />,
    );

    swipe(getStage(container), 200, 100);

    // The next card becomes top; the dismissed card flies out above the stack.
    expect(getCard('Image img-2')).toHaveClass('wpsg-stacked-top');
    expect(getCard('Image img-1').style.zIndex).toBe('4');
    expect(getCard('Image img-1').style.transform).toContain('translateX(-130%)');

    // After the fly-out window the dismissed card settles at the back.
    act(() => { vi.advanceTimersByTime(400); });
    expect(getCard('Image img-1').style.zIndex).toBe('1');
  });

  it('swiping right also dismisses the top card, flying in the other direction', () => {
    const { container } = render(
      <StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />,
    );

    swipe(getStage(container), 100, 200);

    expect(getCard('Image img-2')).toHaveClass('wpsg-stacked-top');
    expect(getCard('Image img-1').style.transform).toContain('translateX(130%)');
  });

  it('clicking a peeking card promotes it to the top without opening the lightbox', () => {
    render(<StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />);

    fireEvent.click(getCard('Image img-3'));

    expect(getCard('Image img-3')).toHaveClass('wpsg-stacked-top');
    expect(screen.queryByTestId('lightbox-open')).not.toBeInTheDocument();
  });

  it('clicking the top card opens the lightbox', () => {
    render(<StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />);

    fireEvent.click(getCard('Image img-1'));

    expect(screen.getByTestId('lightbox-open')).toBeInTheDocument();
  });

  it('ArrowRight cycles forward, ArrowLeft cycles back', () => {
    const { container } = render(
      <StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />,
    );
    const stage = getStage(container);

    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(getCard('Image img-2')).toHaveClass('wpsg-stacked-top');

    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(getCard('Image img-1')).toHaveClass('wpsg-stacked-top');
  });

  it('Enter on the stage opens the lightbox for the top card', () => {
    const { container } = render(
      <StackedDeckAdapter media={THREE_IMAGES} settings={SETTINGS} />,
    );

    fireEvent.keyDown(getStage(container), { key: 'Enter' });

    expect(screen.getByTestId('lightbox-open')).toBeInTheDocument();
  });

  it('renders gracefully with empty media', () => {
    render(<StackedDeckAdapter media={[]} settings={SETTINGS} />);

    expect(screen.getByText('No media')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Images (0)');
  });

  it('a single item cannot be dismissed', () => {
    const { container } = render(
      <StackedDeckAdapter media={[makeImage('solo', 0)]} settings={SETTINGS} />,
    );

    swipe(getStage(container), 200, 100);

    expect(getCard('Image solo')).toHaveClass('wpsg-stacked-top');
    expect(getCard('Image solo').style.transform).toBe('translateX(0px) rotate(0deg)');
  });

  it('renders a play icon overlay for video items', () => {
    const { container } = render(
      <StackedDeckAdapter
        media={[makeVideo('vid-1', 0), makeImage('img-1', 1)]}
        settings={SETTINGS}
      />,
    );

    expect(container.querySelector('.tabler-icon-player-play')).not.toBeNull();
  });
});
