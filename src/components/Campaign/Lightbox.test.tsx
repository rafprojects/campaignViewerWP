import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { Lightbox } from './Lightbox';
import type { MediaItem } from '@/types';

const image = (id: string, caption?: string): MediaItem => ({
  id,
  url: `https://example.com/${id}.jpg`,
  type: 'image',
  caption,
  width: 800,
  height: 600,
});

const video = (id: string): MediaItem => ({
  id,
  url: `https://example.com/${id}.mp4`,
  type: 'video',
  caption: 'A video',
  width: 1280,
  height: 720,
});

const videoEmbed = (id: string): MediaItem => ({
  id,
  url: `https://example.com/${id}.mp4`,
  embedUrl: `https://www.youtube.com/embed/${id}`,
  type: 'video',
  caption: 'Embedded video',
  width: 1280,
  height: 720,
});

const MEDIA = [image('a', 'Image A'), image('b', 'Image B'), image('c', 'Image C')];

const open = (extra = {}) =>
  render(
    <Lightbox
      isOpen={true}
      media={MEDIA}
      currentIndex={0}
      onPrev={vi.fn()}
      onNext={vi.fn()}
      onClose={vi.fn()}
      {...extra}
    />,
  );

describe('Lightbox', () => {
  it('renders nothing when isOpen=false', () => {
    render(
      <Lightbox
        isOpen={false}
        media={MEDIA}
        currentIndex={0}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog when isOpen=true', async () => {
    open();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('shows the current image alt text', async () => {
    open({ currentIndex: 1 });
    await waitFor(() => expect(screen.getByAltText('Image B')).toBeInTheDocument());
  });

  it('shows counter text', async () => {
    open();
    await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument());
  });

  it('shows caption when present', async () => {
    open({ currentIndex: 0 });
    await waitFor(() => expect(screen.getByText('Image A')).toBeInTheDocument());
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    open({ onClose });
    await waitFor(() => screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    open({ onClose });
    await waitFor(() => screen.getByLabelText('Close lightbox'));
    fireEvent.click(screen.getByLabelText('Close lightbox'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', async () => {
    const onClose = vi.fn();
    open({ onClose });
    await waitFor(() => screen.getByRole('dialog'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onPrev on ArrowLeft key', async () => {
    const onPrev = vi.fn();
    open({ onPrev, currentIndex: 1 });
    await waitFor(() => screen.getByRole('dialog'));
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onNext on ArrowRight key', async () => {
    const onNext = vi.fn();
    open({ onNext });
    await waitFor(() => screen.getByRole('dialog'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('shows prev/next arrows for multi-item media', async () => {
    open({ currentIndex: 1 });
    await waitFor(() => screen.getByRole('dialog'));
    expect(screen.getByLabelText('Previous image (lightbox)')).toBeInTheDocument();
    expect(screen.getByLabelText('Next image (lightbox)')).toBeInTheDocument();
  });

  it('prev arrow calls onPrev', async () => {
    const onPrev = vi.fn();
    open({ onPrev, currentIndex: 1 });
    await waitFor(() => screen.getByLabelText('Previous image (lightbox)'));
    fireEvent.click(screen.getByLabelText('Previous image (lightbox)'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('next arrow calls onNext', async () => {
    const onNext = vi.fn();
    open({ onNext });
    await waitFor(() => screen.getByLabelText('Next image (lightbox)'));
    fireEvent.click(screen.getByLabelText('Next image (lightbox)'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders video element for video items without embedUrl', async () => {
    render(
      <Lightbox
        isOpen={true}
        media={[video('v1')]}
        currentIndex={0}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(document.querySelector('video')).toBeInTheDocument());
  });

  it('renders iframe for embedded videos', async () => {
    render(
      <Lightbox
        isOpen={true}
        media={[videoEmbed('yt1')]}
        currentIndex={0}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(document.querySelector('iframe')).toBeInTheDocument());
  });
});
