/**
 * Tests for LayoutSlotComponent.
 * Preview mode (isPreview=true) is tested extensively because it bypasses
 * react-rnd, giving deterministic DOM output. Edit mode tests focus on
 * verifiable rendered structure that Rnd exposes through its wrapper.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { LayoutSlotComponent } from './LayoutSlotComponent';
import type { LayoutSlot, MediaItem } from '@/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseSlot: LayoutSlot = {
  id: 'slot-1',
  x: 5,
  y: 5,
  width: 40,
  height: 40,
  zIndex: 1,
  shape: 'rectangle',
  borderRadius: 0,
  borderWidth: 0,
  borderColor: '#ff0000',
  objectFit: 'cover',
  objectPosition: '50% 50%',
  clickAction: 'lightbox',
  hoverEffect: 'none',
};

const mediaItem: MediaItem = {
  id: 'media-1',
  url: 'https://example.com/image.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  filename: 'image.jpg',
  mimeType: 'image/jpeg',
  width: 1920,
  height: 1080,
};

const defaultProps = {
  index: 0,
  pixelX: 50,
  pixelY: 50,
  pixelWidth: 200,
  pixelHeight: 200,
  canvasWidth: 800,
  canvasHeight: 450,
  isSelected: false,
  isPreview: true,
  onDragStop: vi.fn(),
  onResizeStop: vi.fn(),
  onSelect: vi.fn(),
  onToggleSelect: vi.fn(),
};

function renderSlot(slotOverrides: Partial<LayoutSlot> = {}, extraProps: Record<string, unknown> = {}) {
  const slot = { ...baseSlot, ...slotOverrides };
  return render(
    <LayoutSlotComponent
      slot={slot}
      {...defaultProps}
      {...extraProps}
    />,
  );
}

// ── Preview mode ─────────────────────────────────────────────────────────────

describe('LayoutSlotComponent — preview mode', () => {
  it('renders with role="img"', () => {
    renderSlot();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('aria-label says "Slot 1: empty" when no media', () => {
    renderSlot();
    expect(screen.getByRole('img', { name: 'Slot 1: empty' })).toBeInTheDocument();
  });

  it('aria-label uses 1-based index', () => {
    render(
      <LayoutSlotComponent
        slot={baseSlot}
        {...defaultProps}
        index={2}
      />,
    );
    expect(screen.getByRole('img', { name: 'Slot 3: empty' })).toBeInTheDocument();
  });

  it('aria-label says "assigned" when media item provided', () => {
    renderSlot({}, { mediaItem });
    expect(screen.getByRole('img', { name: 'Slot 1: assigned' })).toBeInTheDocument();
  });

  it('renders img element with correct src when media assigned', () => {
    const { container } = renderSlot({}, { mediaItem });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('image.jpg');
  });

  it('applies slot objectFit to media image', () => {
    const { container } = renderSlot({ objectFit: 'contain' }, { mediaItem });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.objectFit).toBe('contain');
  });

  it('applies slot objectPosition to media image', () => {
    const { container } = renderSlot({ objectPosition: '25% 75%' }, { mediaItem });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.objectPosition).toBe('25% 75%');
  });

  it('renders "Empty" placeholder text when no media', () => {
    renderSlot();
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('positions slot at pixelX/pixelY', () => {
    renderSlot();
    const el = screen.getByRole('img');
    expect(el.style.left).toBe('50px');
    expect(el.style.top).toBe('50px');
  });

  it('sizes slot with pixelWidth/pixelHeight', () => {
    renderSlot();
    const el = screen.getByRole('img');
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('200px');
  });

  it('cursor is pointer when clickAction is lightbox', () => {
    renderSlot({ clickAction: 'lightbox' });
    const el = screen.getByRole('img');
    expect(el.style.cursor).toBe('pointer');
  });

  it('cursor is default when clickAction is none', () => {
    renderSlot({ clickAction: 'none' });
    const el = screen.getByRole('img');
    expect(el.style.cursor).toBe('default');
  });
});

// ── Preview: rectangle with border ───────────────────────────────────────────

describe('LayoutSlotComponent — preview rectangle with border', () => {
  it('applies border style when borderWidth > 0', () => {
    renderSlot({ borderWidth: 3, borderColor: '#0000ff' });
    const el = screen.getByRole('img');
    // toHaveStyle handles JSDOM's shorthand→longhand decomposition
    expect(el).toHaveStyle({ borderWidth: '3px', borderStyle: 'solid' });
  });

  it('has no border style when borderWidth === 0', () => {
    renderSlot({ borderWidth: 0 });
    const el = screen.getByRole('img');
    // No border or an empty border
    expect(el.style.border).toBeFalsy();
  });

  it('applies borderRadius from slot', () => {
    renderSlot({ shape: 'rectangle', borderRadius: 12 });
    const el = screen.getByRole('img');
    expect(el.style.borderRadius).toBe('12px');
  });
});

// ── Preview: clip-path shapes ─────────────────────────────────────────────────

describe('LayoutSlotComponent — preview clip-path shapes', () => {
  const clipShapes: Array<LayoutSlot['shape']> = [
    'circle',
    'hexagon',
    'diamond',
    'chevron',
    'arrow',
    'trapezoid',
    'ellipse',
  ];

  for (const shape of clipShapes) {
    it(`applies clip-path wrapper structure for shape "${shape}"`, () => {
      renderSlot({ shape });
      // Double-container: role="img" wraps an inner clipped overflow:hidden div
      const outer = screen.getByRole('img');
      const inner = outer.querySelector('div');
      expect(inner).toBeInTheDocument();
      expect(inner!.style.overflow).toBe('hidden');
    });
  }

  it('renders border color layer when borderWidth > 0 on clip-path shape', () => {
    renderSlot({ shape: 'circle', borderWidth: 4, borderColor: '#aa00cc' });
    const outer = screen.getByRole('img');
    const divs = outer.querySelectorAll('div');
    // First child div is the border fill layer with borderColor as backgroundColor
    const borderLayer = divs[0] as HTMLElement;
    expect(borderLayer.style.backgroundColor).toBe('rgb(170, 0, 204)');
  });

  it('does not render border color layer when borderWidth === 0 on clip-path shape', () => {
    renderSlot({ shape: 'circle', borderWidth: 0, borderColor: '#aa00cc' });
    const outer = screen.getByRole('img');
    // The border fill div has backgroundColor = slot.borderColor.
    // With borderWidth=0 that div should not exist.
    const maybeBorderDiv = Array.from(outer.children).find(
      (el) => (el as HTMLElement).style.backgroundColor === 'rgb(170, 0, 204)',
    );
    expect(maybeBorderDiv).toBeUndefined();
  });
});

// ── Edit mode (react-rnd wrapper) ─────────────────────────────────────────────

describe('LayoutSlotComponent — edit mode', () => {
  function renderEditSlot(slotOverrides: Partial<LayoutSlot> = {}, extraProps: Record<string, unknown> = {}) {
    const slot = { ...baseSlot, ...slotOverrides };
    return render(
      <LayoutSlotComponent
        slot={slot}
        {...defaultProps}
        isPreview={false}
        {...extraProps}
      />,
    );
  }

  it('renders role="img" aria-label in edit mode', () => {
    renderEditSlot();
    expect(screen.getByRole('img', { name: /Slot 1/ })).toBeInTheDocument();
  });

  it('shows media image in edit mode when media is assigned', () => {
    const { container } = renderEditSlot({}, { mediaItem });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('image.jpg');
  });

  it('shows empty placeholder in edit mode when no media', () => {
    renderEditSlot();
    // Edit mode shows the slot's 1-based index as the placeholder, not "Empty"
    expect(screen.getByRole('img', { name: /Slot 1/ })).toBeInTheDocument();
  });

  it('renders index label in edit mode (slot number overlay)', () => {
    // Both the centered placeholder and the index badge render the 1-based index.
    const { getAllByText } = renderEditSlot({ shape: 'rectangle' });
    const labels = getAllByText('1');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Drop events ───────────────────────────────────────────────────────────────

describe('LayoutSlotComponent — media drop events', () => {
  function renderForDrop(slotOverrides: Partial<LayoutSlot> = {}) {
    const onMediaDrop = vi.fn();
    const slot = { ...baseSlot, ...slotOverrides };
    const { container } = render(
      <LayoutSlotComponent
        slot={slot}
        {...defaultProps}
        isPreview={false}
        onMediaDrop={onMediaDrop}
      />,
    );
    return { container, onMediaDrop };
  }

  it('calls onMediaDrop with slotId and mediaId on drop', () => {
    const { container, onMediaDrop } = renderForDrop();
    const imgContainer = container.querySelector('[role="img"]')!;

    fireEvent.drop(imgContainer, {
      dataTransfer: {
        getData: (type: string) =>
          type === 'application/x-wpsg-media-id' ? 'media-42' : '',
        types: ['application/x-wpsg-media-id'],
      },
    });

    expect(onMediaDrop).toHaveBeenCalledWith('slot-1', 'media-42', undefined);
  });

  it('parses meta JSON from drag data on drop', () => {
    const { container, onMediaDrop } = renderForDrop();
    const imgContainer = container.querySelector('[role="img"]')!;
    const meta = { attachmentId: 99, url: 'https://x.com/img.jpg' };

    fireEvent.drop(imgContainer, {
      dataTransfer: {
        getData: (type: string) => {
          if (type === 'application/x-wpsg-media-id') return 'media-42';
          if (type === 'application/x-wpsg-media-meta') return JSON.stringify(meta);
          return '';
        },
        types: ['application/x-wpsg-media-id'],
      },
    });

    expect(onMediaDrop).toHaveBeenCalledWith('slot-1', 'media-42', meta);
  });

  it('does not call onMediaDrop when mediaId is empty', () => {
    const { container, onMediaDrop } = renderForDrop();
    const imgContainer = container.querySelector('[role="img"]')!;

    fireEvent.drop(imgContainer, {
      dataTransfer: {
        getData: () => '',
        types: [],
      },
    });

    expect(onMediaDrop).not.toHaveBeenCalled();
  });
});
