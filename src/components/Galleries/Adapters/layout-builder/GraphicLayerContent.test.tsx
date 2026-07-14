/**
 * P50-J Tests: GraphicLayerContent — shared overlay visual renderer.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@/test/test-utils';
import { GraphicLayerContent } from './GraphicLayerContent';
import { buildGraphicLayerTransform } from '@wp-super-gallery/shared-utils';
import type { LayoutGraphicLayer } from '@/types';

const base: LayoutGraphicLayer = {
  id: 'g1',
  imageUrl: 'https://example.com/logo.png',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  zIndex: 1,
  opacity: 1,
  pointerEvents: false,
};

describe('buildGraphicLayerTransform', () => {
  it('returns undefined when no transform is set', () => {
    expect(buildGraphicLayerTransform(base)).toBeUndefined();
  });

  it('composes rotation and flips', () => {
    expect(buildGraphicLayerTransform({ ...base, rotation: 45, flipH: true, flipV: true })).toBe(
      'rotate(45deg) scaleX(-1) scaleY(-1)',
    );
  });

  it('emits only rotation when no flips', () => {
    expect(buildGraphicLayerTransform({ ...base, rotation: -90 })).toBe('rotate(-90deg)');
  });
});

describe('GraphicLayerContent', () => {
  it('renders the layer image', () => {
    const { container } = render(<GraphicLayerContent layer={base} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(base.imageUrl);
  });

  it('uses the rectangle branch (no shape) with a CSS border when borderWidth > 0', () => {
    const { container } = render(
      <GraphicLayerContent layer={{ ...base, borderWidth: 4, borderColor: '#ff0000' }} />,
    );
    const rect = container.querySelector('[data-wpsg-graphic-layer="rect"]') as HTMLElement;
    expect(rect).not.toBeNull();
    expect(rect.style.border).toContain('4px');
  });

  it('uses the clipped branch and applies a clip-path for a shape preset', () => {
    const { container } = render(<GraphicLayerContent layer={{ ...base, shape: 'circle' }} />);
    expect(container.querySelector('[data-wpsg-graphic-layer="clipped"]')).not.toBeNull();
    // The inner clipped containers carry the ellipse clip-path.
    const clipped = container.querySelector('[style*="ellipse"]');
    expect(clipped).not.toBeNull();
  });

  it('applies rotation + flip transform on the content wrapper', () => {
    const { container } = render(
      <GraphicLayerContent layer={{ ...base, rotation: 30, flipH: true }} />,
    );
    const wrapper = container.querySelector('[data-wpsg-graphic-layer="rect"]') as HTMLElement;
    expect(wrapper.style.transform).toContain('rotate(30deg)');
    expect(wrapper.style.transform).toContain('scaleX(-1)');
  });
});
