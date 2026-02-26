/**
 * Tests for the SmartGuides SVG overlay component.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { SmartGuides } from './SmartGuides';
import type { GuideLine } from '@/utils/smartGuides';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeEdge = (axis: 'x' | 'y', position: number, label?: string): GuideLine => ({
  type: 'edge',
  axis,
  position,
  label,
});

const makeCenter = (axis: 'x' | 'y', position: number): GuideLine => ({
  type: 'center',
  axis,
  position,
});

const makeSpacing = (axis: 'x' | 'y', position: number, label?: string): GuideLine => ({
  type: 'spacing',
  axis,
  position,
  label,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SmartGuides', () => {
  it('renders nothing when guides array is empty', () => {
    const { container } = render(
      <SmartGuides guides={[]} canvasWidth={800} canvasHeight={450} />,
    );
    // Component returns null; no SVG should be present.
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders an SVG element when guides are present', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeEdge('x', 50)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('sets SVG dimensions from props', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeEdge('x', 25)]}
        canvasWidth={600}
        canvasHeight={300}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '600');
    expect(svg).toHaveAttribute('height', '300');
  });

  it('SVG is aria-hidden to screen readers', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeCenter('y', 50)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a line element for each guide', () => {
    const guides: GuideLine[] = [
      makeEdge('x', 25),
      makeCenter('y', 50),
      makeSpacing('x', 75),
    ];
    const { container } = render(
      <SmartGuides guides={guides} canvasWidth={800} canvasHeight={450} />,
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(3);
  });

  it('edge guide renders with solid stroke (no dasharray)', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeEdge('x', 50)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const line = container.querySelector('line')!;
    const dash = line.getAttribute('stroke-dasharray');
    // 'none' or absent both mean solid
    expect(dash === 'none' || dash === null).toBe(true);
  });

  it('center guide renders with a dash pattern', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeCenter('x', 50)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const line = container.querySelector('line')!;
    const dash = line.getAttribute('stroke-dasharray');
    expect(dash).not.toBe('none');
    expect(dash).toBeTruthy();
  });

  it('spacing guide renders with a dash pattern', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeSpacing('y', 30)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const line = container.querySelector('line')!;
    const dash = line.getAttribute('stroke-dasharray');
    expect(dash).not.toBe('none');
    expect(dash).toBeTruthy();
  });

  it('x-axis guide renders a vertical line across full canvas height', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeEdge('x', 25)]}
        canvasWidth={800}
        canvasHeight={400}
      />,
    );
    const line = container.querySelector('line')!;
    // vertical line: y1=0, y2=canvasHeight; x1===x2
    expect(line.getAttribute('y1')).toBe('0');
    expect(line.getAttribute('y2')).toBe('400');
    expect(line.getAttribute('x1')).toBe(line.getAttribute('x2'));
  });

  it('y-axis guide renders a horizontal line across full canvas width', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeCenter('y', 50)]}
        canvasWidth={800}
        canvasHeight={400}
      />,
    );
    const line = container.querySelector('line')!;
    // horizontal line: x1=0, x2=canvasWidth; y1===y2
    expect(line.getAttribute('x1')).toBe('0');
    expect(line.getAttribute('x2')).toBe('800');
    expect(line.getAttribute('y1')).toBe(line.getAttribute('y2'));
  });

  it('x-axis guide positions line at correct pixel x from percentage', () => {
    // position=25% of 800px = 200px
    const { container } = render(
      <SmartGuides
        guides={[makeEdge('x', 25)]}
        canvasWidth={800}
        canvasHeight={400}
      />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('x1')).toBe('200');
  });

  it('y-axis guide positions line at correct pixel y from percentage', () => {
    // position=50% of 400px = 200px
    const { container } = render(
      <SmartGuides
        guides={[makeCenter('y', 50)]}
        canvasWidth={800}
        canvasHeight={400}
      />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('y1')).toBe('200');
  });

  it('renders label text element when guide has a label', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeEdge('x', 50, 'L edge')]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const text = container.querySelector('text');
    expect(text).toBeInTheDocument();
    expect(text?.textContent).toBe('L edge');
  });

  it('does not render text element when guide has no label', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeEdge('x', 50)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const text = container.querySelector('text');
    expect(text).toBeNull();
  });

  it('renders edge guide with red stroke colour', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeEdge('x', 50)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('stroke')).toBe('#ff6b6b');
  });

  it('renders center guide with blue stroke colour', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeCenter('x', 50)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('stroke')).toBe('#4dabf7');
  });

  it('renders spacing guide with green stroke colour', () => {
    const { container } = render(
      <SmartGuides
        guides={[makeSpacing('x', 50)]}
        canvasWidth={800}
        canvasHeight={450}
      />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('stroke')).toBe('#69db7c');
  });

  it('renders multiple guides with correct individual colours', () => {
    const guides: GuideLine[] = [
      makeEdge('x', 10),
      makeCenter('x', 50),
      makeSpacing('x', 90),
    ];
    const { container } = render(
      <SmartGuides guides={guides} canvasWidth={800} canvasHeight={450} />,
    );
    const lines = container.querySelectorAll('line');
    expect(lines[0].getAttribute('stroke')).toBe('#ff6b6b');
    expect(lines[1].getAttribute('stroke')).toBe('#4dabf7');
    expect(lines[2].getAttribute('stroke')).toBe('#69db7c');
  });
});
