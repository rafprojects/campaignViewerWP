/**
 * Tests for MediaPickerSidebar — the media list panel used in the layout builder
 * for assigning campaign images to slots via click or drag.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { MediaPickerSidebar } from './MediaPickerSidebar';
import type { MediaItem, LayoutTemplate, LayoutSlot } from '@/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMedia(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'media-1',
    type: 'image',
    source: 'upload',
    url: 'https://example.com/photo.jpg',
    thumbnail: 'https://example.com/thumb.jpg',
    title: 'Test Photo',
    order: 0,
    ...overrides,
  };
}

const baseSlot: LayoutSlot = {
  id: 's1',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  zIndex: 1,
  shape: 'rectangle',
  borderRadius: 0,
  borderWidth: 0,
  borderColor: '#fff',
  objectFit: 'cover',
  objectPosition: '50% 50%',
  clickAction: 'lightbox',
  hoverEffect: 'none',
};

function makeTemplate(slots: LayoutSlot[] = [baseSlot]): LayoutTemplate {
  return {
    id: 'tpl-1',
    name: 'Test',
    schemaVersion: 1,
    canvasAspectRatio: 16 / 9,
    canvasMinWidth: 400,
    canvasMaxWidth: 800,
    backgroundColor: '#000',
    slots,
    overlays: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tags: [],
  };
}

function renderSidebar({
  media = [makeMedia()],
  template = makeTemplate(),
  selectedSlotIds = new Set<string>(),
  onAssignMedia = vi.fn(),
  onClearMedia = vi.fn(),
  onAutoAssign = vi.fn(),
} = {}) {
  render(
    <MediaPickerSidebar
      media={media}
      template={template}
      selectedSlotIds={selectedSlotIds}
      onAssignMedia={onAssignMedia}
      onClearMedia={onClearMedia}
      onAutoAssign={onAutoAssign}
    />,
  );
  return { onAssignMedia, onClearMedia, onAutoAssign };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('MediaPickerSidebar — rendering', () => {
  it('renders the media count in the header', () => {
    renderSidebar({ media: [makeMedia(), makeMedia({ id: 'media-2' })] });
    expect(screen.getByText('Media (2)')).toBeInTheDocument();
  });

  it('renders "No media items available" when media is empty', () => {
    renderSidebar({ media: [] });
    expect(screen.getByText('No media items available.')).toBeInTheDocument();
  });

  it('renders a media item title', () => {
    renderSidebar({ media: [makeMedia({ title: 'My Image' })] });
    expect(screen.getByText('My Image')).toBeInTheDocument();
  });

  it('renders fallback title with order when media has no title', () => {
    renderSidebar({ media: [makeMedia({ title: undefined, order: 3 })] });
    expect(screen.getByText('Media #4')).toBeInTheDocument();
  });

  it('renders image type label', () => {
    renderSidebar({ media: [makeMedia({ type: 'image', width: 1920, height: 1080 })] });
    expect(screen.getByText(/1920×1080/)).toBeInTheDocument();
  });

  it('renders multiple media items', () => {
    renderSidebar({
      media: [
        makeMedia({ id: '1', title: 'First' }),
        makeMedia({ id: '2', title: 'Second' }),
        makeMedia({ id: '3', title: 'Third' }),
      ],
    });
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });
});

// ── Slot selection prompts ─────────────────────────────────────────────────────

describe('MediaPickerSidebar — slot selection prompts', () => {
  it('shows "Select a slot first" when no slot is selected', () => {
    renderSidebar({ selectedSlotIds: new Set() });
    expect(screen.getByText(/Select a slot first/)).toBeInTheDocument();
  });

  it('shows drag/assign prompt when one slot is selected', () => {
    renderSidebar({ selectedSlotIds: new Set(['s1']) });
    expect(screen.getByText(/Click or drag a media item/)).toBeInTheDocument();
  });

  it('shows "Select a slot first" when multiple slots selected', () => {
    renderSidebar({ selectedSlotIds: new Set(['s1', 's2']) });
    expect(screen.getByText(/Select a slot first/)).toBeInTheDocument();
  });
});

// ── Auto-assign button ────────────────────────────────────────────────────────

describe('MediaPickerSidebar — auto-assign button', () => {
  it('renders the Auto button', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: /Auto/i })).toBeInTheDocument();
  });

  it('Auto button is enabled when media and slots exist', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: /Auto/i })).not.toBeDisabled();
  });

  it('Auto button is disabled when no media', () => {
    renderSidebar({ media: [] });
    expect(screen.getByRole('button', { name: /Auto/i })).toBeDisabled();
  });

  it('Auto button is disabled when template has no slots', () => {
    renderSidebar({ template: makeTemplate([]) });
    expect(screen.getByRole('button', { name: /Auto/i })).toBeDisabled();
  });

  it('calls onAutoAssign when Auto button is clicked', () => {
    const { onAutoAssign } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Auto/i }));
    expect(onAutoAssign).toHaveBeenCalledOnce();
  });
});

// ── Click-to-assign ────────────────────────────────────────────────────────────

describe('MediaPickerSidebar — click-to-assign', () => {
  it('calls onAssignMedia with slotId and mediaId when media clicked with slot selected', () => {
    const { onAssignMedia } = renderSidebar({
      media: [makeMedia({ id: 'media-1', url: 'https://example.com/photo.jpg' })],
      selectedSlotIds: new Set(['s1']),
    });

    const mediaBtn = screen.getByLabelText(/Test Photo.*unassigned/i);
    // Mantine's Image loads the `src` prop; the button wraps it
    fireEvent.click(mediaBtn);

    expect(onAssignMedia).toHaveBeenCalledWith('s1', 'media-1', expect.objectContaining({ url: 'https://example.com/photo.jpg' }));
  });

  it('does NOT call onAssignMedia when clicked with no slot selected', () => {
    const { onAssignMedia } = renderSidebar({
      media: [makeMedia({ id: 'media-1' })],
      selectedSlotIds: new Set(),
    });

    fireEvent.click(screen.getByLabelText(/Test Photo.*unassigned/i));
    expect(onAssignMedia).not.toHaveBeenCalled();
  });
});

// ── Assignments panel ─────────────────────────────────────────────────────────

describe('MediaPickerSidebar — assignments panel', () => {
  it('does not show Assignments section when no slots have media', () => {
    renderSidebar({ template: makeTemplate([baseSlot]) });
    expect(screen.queryByText('Assignments')).toBeNull();
  });

  it('shows Assignments section when a slot has media assigned', () => {
    const slotWithMedia: LayoutSlot = { ...baseSlot, mediaId: 'media-1' };
    renderSidebar({
      media: [makeMedia({ id: 'media-1', title: 'Photo A' })],
      template: makeTemplate([slotWithMedia]),
    });
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });

  it('shows slot label in assignments', () => {
    const slotWithMedia: LayoutSlot = { ...baseSlot, mediaId: 'media-1' };
    renderSidebar({
      media: [makeMedia({ id: 'media-1' })],
      template: makeTemplate([slotWithMedia]),
    });
    expect(screen.getByText('Slot 1')).toBeInTheDocument();
  });

  it('shows unassign button for assigned slot', () => {
    const slotWithMedia: LayoutSlot = { ...baseSlot, mediaId: 'media-1' };
    renderSidebar({
      media: [makeMedia({ id: 'media-1' })],
      template: makeTemplate([slotWithMedia]),
    });
    expect(screen.getByLabelText('Unassign media from slot 1')).toBeInTheDocument();
  });

  it('calls onClearMedia when unassign button clicked', () => {
    const slotWithMedia: LayoutSlot = { ...baseSlot, mediaId: 'media-1' };
    const { onClearMedia } = renderSidebar({
      media: [makeMedia({ id: 'media-1' })],
      template: makeTemplate([slotWithMedia]),
    });
    fireEvent.click(screen.getByLabelText('Unassign media from slot 1'));
    expect(onClearMedia).toHaveBeenCalledWith('s1');
  });

  it('shows assigned slot badge on media item', () => {
    const slotWithMedia: LayoutSlot = { ...baseSlot, id: 's1', mediaId: 'media-1' };
    renderSidebar({
      media: [makeMedia({ id: 'media-1', title: 'My Image' })],
      template: makeTemplate([slotWithMedia]),
    });
    // The badge shows the 1-based slot number
    // The media item aria-label should say "assigned to slot 1"
    expect(screen.getByLabelText(/assigned to slot 1/i)).toBeInTheDocument();
  });
});

// ── Drag to slot ──────────────────────────────────────────────────────────────

describe('MediaPickerSidebar — drag behavior', () => {
  it('sets media data on drag start', () => {
    renderSidebar({
      media: [makeMedia({ id: 'media-1' })],
    });

    const mediaBtn = screen.getByLabelText(/Test Photo/i);
    const dataMap: Record<string, string> = {};

    fireEvent.dragStart(mediaBtn, {
      dataTransfer: {
        setData: (type: string, value: string) => {
          dataMap[type] = value;
        },
        effectAllowed: undefined,
      },
    });

    expect(dataMap['application/x-wpsg-media-id']).toBe('media-1');
    expect(dataMap['application/x-wpsg-media-meta']).toBeTruthy();

    const meta = JSON.parse(dataMap['application/x-wpsg-media-meta']);
    expect(meta.url).toBe('https://example.com/photo.jpg');
  });
});
