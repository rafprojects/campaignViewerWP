/**
 * P18-QA: MediaCard component tests.
 *
 * Covers:
 * - Basic render with image and video items
 * - Compact and full modes
 * - onEdit, onDelete, onImageClick callbacks
 * - Keyboard interaction (Enter, Space) on clickable image section
 * - Caption display and showUrl prop
 * - Badge labels (Image/Video, Upload/External)
 * - Drag handle renders with dragHandleProps
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import { MediaCard } from './MediaCard';
import type { MediaItem } from '@/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const imageItem: MediaItem = {
  id: 'img-1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/photo.jpg',
  thumbnail: 'https://example.com/photo-thumb.jpg',
  caption: 'A beautiful photo',
  order: 0,
};

const videoItem: MediaItem = {
  id: 'vid-1',
  type: 'video',
  source: 'external',
  url: 'https://example.com/video.mp4',
  thumbnail: 'https://example.com/video-thumb.jpg',
  order: 1,
};

const defaultProps = {
  height: 120,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

// ─── Render tests ────────────────────────────────────────────────────────────

describe('MediaCard — basic render', () => {
  it('renders without crashing (image)', () => {
    const { container } = render(
      <MediaCard item={imageItem} {...defaultProps} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('renders without crashing (video)', () => {
    const { container } = render(
      <MediaCard item={videoItem} {...defaultProps} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('shows "Image" badge for image items', () => {
    render(<MediaCard item={imageItem} {...defaultProps} />);
    expect(screen.getByText('Image')).toBeInTheDocument();
  });

  it('shows "Video" badge for video items', () => {
    render(<MediaCard item={videoItem} {...defaultProps} />);
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('shows "Upload" badge for upload-sourced items', () => {
    render(<MediaCard item={imageItem} {...defaultProps} />);
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('shows "External" badge for externally-sourced items', () => {
    render(<MediaCard item={videoItem} {...defaultProps} />);
    expect(screen.getByText('External')).toBeInTheDocument();
  });

  it('renders caption text when present', () => {
    render(<MediaCard item={imageItem} {...defaultProps} />);
    expect(screen.getByText('A beautiful photo')).toBeInTheDocument();
  });

  it('renders "—" when caption is absent', () => {
    const noCaption: MediaItem = { ...imageItem, caption: undefined };
    render(<MediaCard item={noCaption} {...defaultProps} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

// ─── Full vs compact mode ────────────────────────────────────────────────────

describe('MediaCard — compact mode', () => {
  it('renders Edit and Delete buttons in compact mode', () => {
    render(<MediaCard item={imageItem} compact {...defaultProps} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete media/i })).toBeInTheDocument();
  });

  it('renders Edit and Delete buttons in full mode', () => {
    render(<MediaCard item={imageItem} {...defaultProps} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete media/i })).toBeInTheDocument();
  });
});

// ─── Action callbacks ────────────────────────────────────────────────────────

describe('MediaCard — callbacks', () => {
  it('calls onEdit when Edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<MediaCard item={imageItem} height={120} onEdit={onEdit} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('calls onDelete when Delete button is clicked', () => {
    const onDelete = vi.fn();
    render(
      <MediaCard item={imageItem} height={120} onEdit={vi.fn()} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete media/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('calls onImageClick when image section is clicked (image item)', () => {
    const onImageClick = vi.fn();
    render(
      <MediaCard item={imageItem} height={120} onEdit={vi.fn()} onDelete={vi.fn()} onImageClick={onImageClick} />,
    );
    const previewBtn = screen.getByRole('button', {
      name: /open image preview/i,
    });
    fireEvent.click(previewBtn);
    expect(onImageClick).toHaveBeenCalledOnce();
  });

  it('does NOT make image section clickable when onImageClick is not provided', () => {
    render(
      <MediaCard item={imageItem} height={120} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(
      screen.queryByRole('button', { name: /open image preview/i }),
    ).not.toBeInTheDocument();
  });

  it('does NOT make video image section a button (onImageClick + video)', () => {
    const onImageClick = vi.fn();
    render(
      <MediaCard item={videoItem} height={120} onEdit={vi.fn()} onDelete={vi.fn()} onImageClick={onImageClick} />,
    );
    // Video items are not clickable even when onImageClick is provided
    expect(
      screen.queryByRole('button', { name: /open image preview/i }),
    ).not.toBeInTheDocument();
  });
});

// ─── Keyboard interaction ────────────────────────────────────────────────────

describe('MediaCard — keyboard navigation', () => {
  it('fires onImageClick on Enter key in image preview section', () => {
    const onImageClick = vi.fn();
    render(
      <MediaCard item={imageItem} height={120} onEdit={vi.fn()} onDelete={vi.fn()} onImageClick={onImageClick} />,
    );
    const previewBtn = screen.getByRole('button', {
      name: /open image preview/i,
    });

    // Enter key should trigger the click handler via onKeyDown
    // The element itself may receive keyDown; use the Card.Section's DOM node
    const section = previewBtn.closest('[role="button"]') ?? previewBtn;
    fireEvent.keyDown(section, { key: 'Enter' });
    expect(onImageClick).toHaveBeenCalledOnce();
  });

  it('fires onImageClick on Space key in image preview section', () => {
    const onImageClick = vi.fn();
    render(
      <MediaCard item={imageItem} height={120} onEdit={vi.fn()} onDelete={vi.fn()} onImageClick={onImageClick} />,
    );
    const previewBtn = screen.getByRole('button', {
      name: /open image preview/i,
    });
    const section = previewBtn.closest('[role="button"]') ?? previewBtn;
    fireEvent.keyDown(section, { key: ' ' });
    expect(onImageClick).toHaveBeenCalledOnce();
  });
});

// ─── showUrl prop ────────────────────────────────────────────────────────────

describe('MediaCard — showUrl prop', () => {
  it('does not show URL by default', () => {
    render(<MediaCard item={imageItem} {...defaultProps} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows image URL as a link when showUrl is true', () => {
    render(<MediaCard item={imageItem} showUrl {...defaultProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', imageItem.url);
  });
});

// ─── Drag handle ────────────────────────────────────────────────────────────

describe('MediaCard — drag handle', () => {
  it('renders drag handle button', () => {
    render(<MediaCard item={imageItem} {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /drag media to reorder/i }),
    ).toBeInTheDocument();
  });

  it('passes dragHandleProps to the drag handle button', () => {
    const handleData = { 'data-drag-handle': 'true' } as React.HTMLAttributes<HTMLButtonElement>;
    render(
      <MediaCard item={imageItem} {...defaultProps} dragHandleProps={handleData} />,
    );
    const btn = screen.getByRole('button', { name: /drag media to reorder/i });
    expect(btn).toHaveAttribute('data-drag-handle', 'true');
  });
});
