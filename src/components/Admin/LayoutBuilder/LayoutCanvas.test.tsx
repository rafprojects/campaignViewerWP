/**
 * Tests for LayoutCanvas — the shared canvas used in the builder (edit + preview)
 * and as a preview thumbnail within the builder modal.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { LayoutCanvas } from './LayoutCanvas';
import type { LayoutTemplate, LayoutSlot, LayoutGraphicLayer } from '@/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseSlot: LayoutSlot = {
  id: 's1',
  x: 10,
  y: 10,
  width: 40,
  height: 40,
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

const baseOverlay: LayoutGraphicLayer = {
  id: 'o1',
  imageUrl: 'https://example.com/overlay.png',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  zIndex: 10,
  opacity: 0.8,
  pointerEvents: false,
};

function makeTemplate(overrides: Partial<LayoutTemplate> = {}): LayoutTemplate {
  return {
    id: 'tpl-test',
    name: 'Test',
    schemaVersion: 1,
    canvasAspectRatio: 16 / 9,
    canvasMinWidth: 400,
    canvasMaxWidth: 800,
    backgroundColor: '#111',
    slots: [baseSlot],
    overlays: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tags: [],
    ...overrides,
  };
}

const noopHandlers = {
  onSlotMove: vi.fn(),
  onSlotResize: vi.fn(),
  onSlotSelect: vi.fn(),
  onSlotToggleSelect: vi.fn(),
  onCanvasClick: vi.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderCanvas(
  props: Partial<Parameters<typeof LayoutCanvas>[0]> & {
    template?: LayoutTemplate;
    isPreview?: boolean;
  } = {},
) {
  const template = props.template ?? makeTemplate();
  return render(
    <LayoutCanvas
      template={template}
      selectedSlotIds={new Set()}
      isPreview={props.isPreview ?? false}
      media={[]}
      snapEnabled={false}
      {...noopHandlers}
      {...props}
    />,
  );
}

// ── Dimension label ───────────────────────────────────────────────────────────

describe('LayoutCanvas — dimension label', () => {
  it('shows canvas pixel dimensions in edit mode', () => {
    renderCanvas({ isPreview: false });
    // e.g. "800 × 450px · 1 slot"
    expect(screen.getByText(/\d+ × \d+px/)).toBeInTheDocument();
  });

  it('shows slot count in dimension label', () => {
    renderCanvas({
      isPreview: false,
      template: makeTemplate({ slots: [baseSlot, { ...baseSlot, id: 's2' }] }),
    });
    expect(screen.getByText(/2 slots/)).toBeInTheDocument();
  });

  it('uses singular "slot" for a single slot', () => {
    renderCanvas({ isPreview: false });
    expect(screen.getByText(/1 slot(?!s)/)).toBeInTheDocument();
  });

  it('hides dimension label in preview mode', () => {
    renderCanvas({ isPreview: true });
    expect(screen.queryByText(/\d+ × \d+px/)).toBeNull();
  });
});

// ── Canvas element ────────────────────────────────────────────────────────────

describe('LayoutCanvas — canvas element', () => {
  it('has role="application" on the canvas div', () => {
    renderCanvas();
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('has aria-label "Layout canvas"', () => {
    renderCanvas();
    expect(screen.getByRole('application', { name: 'Layout canvas' })).toBeInTheDocument();
  });

  it('calls onCanvasClick when user clicks the canvas directly', () => {
    const onCanvasClick = vi.fn();
    renderCanvas({ onCanvasClick });
    const canvas = screen.getByRole('application');
    fireEvent.mouseDown(canvas);
    expect(onCanvasClick).toHaveBeenCalledOnce();
  });
});

// ── Background image ──────────────────────────────────────────────────────────

describe('LayoutCanvas — background image', () => {
  it('renders background image element when template has backgroundImage', () => {
    const { container } = renderCanvas({
      template: makeTemplate({ backgroundMode: 'image', backgroundImage: 'https://example.com/bg.jpg' }),
    });
    const img = container.querySelector('img[src="https://example.com/bg.jpg"]');
    expect(img).toBeInTheDocument();
  });

  it('does not render background image element when template has no backgroundImage', () => {
    const { container } = renderCanvas({
      template: makeTemplate({ backgroundImage: undefined }),
    });
    // Only overlay/slot images should be absent without backgroundImage
    const imgs = Array.from(container.querySelectorAll('img')).filter(
      (img) => !img.src.includes('overlay'),
    );
    expect(imgs).toHaveLength(0);
  });

  it('applies backgroundImageFit as objectFit on the bg image', () => {
    const { container } = renderCanvas({
      template: makeTemplate({
        backgroundMode: 'image',
        backgroundImage: 'https://example.com/bg.jpg',
        backgroundImageFit: 'contain',
      }),
    });
    const img = container.querySelector('img[src="https://example.com/bg.jpg"]') as HTMLImageElement;
    expect(img.style.objectFit).toBe('contain');
  });

  it('defaults backgroundImageFit to cover when not specified', () => {
    const { container } = renderCanvas({
      template: makeTemplate({
        backgroundMode: 'image',
        backgroundImage: 'https://example.com/bg.jpg',
        backgroundImageFit: undefined,
      }),
    });
    const img = container.querySelector('img[src="https://example.com/bg.jpg"]') as HTMLImageElement;
    expect(img.style.objectFit).toBe('cover');
  });

  it('applies backgroundImageOpacity to bg image', () => {
    const { container } = renderCanvas({
      template: makeTemplate({
        backgroundMode: 'image',
        backgroundImage: 'https://example.com/bg.jpg',
        backgroundImageOpacity: 0.5,
      }),
    });
    const img = container.querySelector('img[src="https://example.com/bg.jpg"]') as HTMLImageElement;
    expect(img.style.opacity).toBe('0.5');
  });
});

// ── Overlays ──────────────────────────────────────────────────────────────────

describe('LayoutCanvas — overlays', () => {
  it('renders overlay image in edit mode', () => {
    const { container } = renderCanvas({
      isPreview: false,
      template: makeTemplate({ overlays: [baseOverlay] }),
    });
    const img = container.querySelector(`img[src="${baseOverlay.imageUrl}"]`);
    expect(img).toBeInTheDocument();
  });

  it('renders overlay in preview mode', () => {
    const { container } = renderCanvas({
      isPreview: true,
      template: makeTemplate({ overlays: [baseOverlay] }),
    });
    const img = container.querySelector(`img[src="${baseOverlay.imageUrl}"]`);
    expect(img).toBeInTheDocument();
  });

  it('all overlay images use objectFit fill', () => {
    const { container } = renderCanvas({
      isPreview: true,
      template: makeTemplate({ overlays: [baseOverlay] }),
    });
    const img = container.querySelector(`img[src="${baseOverlay.imageUrl}"]`) as HTMLImageElement;
    expect(img.style.objectFit).toBe('fill');
  });

  it('does not render overlay elements when template has no overlays', () => {
    const { container } = renderCanvas({
      template: makeTemplate({ overlays: [] }),
    });
    const svgOnly = container.querySelector('svg');
    // SVG only appears for smart guides (not active here) — so no overlays = no overlay imgs
    expect(svgOnly).toBeNull();
  });

  it('renders multiple overlays', () => {
    const overlay2: LayoutGraphicLayer = { ...baseOverlay, id: 'o2', imageUrl: 'https://example.com/o2.png' };
    const { container } = renderCanvas({
      isPreview: true,
      template: makeTemplate({ overlays: [baseOverlay, overlay2] }),
    });
    const imgs = container.querySelectorAll('img');
    const overlaySrcs = Array.from(imgs).map((i) => i.getAttribute('src'));
    expect(overlaySrcs).toContain(baseOverlay.imageUrl);
    expect(overlaySrcs).toContain(overlay2.imageUrl);
  });
});

// ── Slot rendering ────────────────────────────────────────────────────────────

describe('LayoutCanvas — slot rendering', () => {
  it('renders slots in preview mode', () => {
    renderCanvas({
      isPreview: true,
      template: makeTemplate({ slots: [baseSlot] }),
    });
    // In preview mode, LayoutSlotComponent renders an element with aria-label "Slot 1: ..."
    expect(screen.getByLabelText(/Slot 1/)).toBeInTheDocument();
  });

  it('renders multiple slots in preview', () => {
    renderCanvas({
      isPreview: true,
      template: makeTemplate({
        slots: [baseSlot, { ...baseSlot, id: 's2', x: 55, y: 10 }],
      }),
    });
    expect(screen.getByLabelText(/Slot 1/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Slot 2/)).toBeInTheDocument();
  });

  it('renders empty slot placeholder when no media assigned', () => {
    renderCanvas({
      isPreview: true,
      template: makeTemplate({ slots: [baseSlot] }),
      media: [],
    });
    // Empty slot shows placeholder text
    expect(screen.getByLabelText(/Slot 1/)).toBeInTheDocument();
  });

  it('renders media image when media is assigned to a slot', () => {
    const media = [{
      id: 'img1',
      url: 'https://example.com/photo.jpg',
      thumbnail: 'https://example.com/photo-thumb.jpg',
      type: 'image' as const,
      source: 'upload' as const,
      order: 0,
      width: 1920,
      height: 1080,
    }];
    const slotWithMedia: LayoutSlot = { ...baseSlot, mediaId: 'img1' };
    const { container } = renderCanvas({
      isPreview: true,
      template: makeTemplate({ slots: [slotWithMedia] }),
      media,
    });
    const img = container.querySelector('img[src="https://example.com/photo.jpg"]');
    expect(img).toBeInTheDocument();
  });
});

// ── Smart guides ──────────────────────────────────────────────────────────────

describe('LayoutCanvas — smart guides', () => {
  it('does not render SmartGuides SVG when no guides are active at mount', () => {
    const { container } = renderCanvas({ isPreview: false, snapEnabled: true });
    // No active guides at mount time = no SVG
    const svg = container.querySelector('svg[aria-hidden]');
    expect(svg).toBeNull();
  });

  it('does not render SmartGuides SVG in preview mode', () => {
    const { container } = renderCanvas({ isPreview: true });
    expect(container.querySelector('svg[aria-hidden]')).toBeNull();
  });
});
