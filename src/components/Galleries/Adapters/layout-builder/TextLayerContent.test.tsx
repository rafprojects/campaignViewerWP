/**
 * P59-C Tests: TextLayerContent — the shared semantic/typography render used by
 * the builder canvas (P59-B) and the published gallery (P59-C). Verifies the
 * role→element mapping, that the text is real/reachable DOM (not aria-hidden),
 * and that typography + alignment are applied.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { TextLayerContent } from './TextLayerContent';
import { textLayerElement, textLayerTextStyle } from '@/utils/textLayerStyle';
import type { LayoutTextLayer } from '@/types';

function makeText(overrides: Partial<LayoutTextLayer> = {}): LayoutTextLayer {
  return {
    id: 't1', x: 0, y: 0, width: 40, height: 12, zIndex: 1, opacity: 1,
    content: 'Summer Sale', semanticTag: 'heading', textAlign: 'left',
    typography: {},
    ...overrides,
  };
}

describe('TextLayerContent (P59-C render)', () => {
  it('renders the content text', () => {
    render(<TextLayerContent layer={makeText()} />);
    expect(screen.getByText('Summer Sale')).toBeInTheDocument();
  });

  it('renders the heading role as a reachable <h2> (not aria-hidden)', () => {
    render(<TextLayerContent layer={makeText({ semanticTag: 'heading' })} />);
    // getByRole only finds elements in the accessibility tree — this passing
    // proves the text is reachable, the core P59 win over baked-in image text.
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Summer Sale');
  });

  it('renders subheading as <h3>', () => {
    render(<TextLayerContent layer={makeText({ semanticTag: 'subheading' })} />);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('renders paragraph as <p>', () => {
    render(<TextLayerContent layer={makeText({ semanticTag: 'paragraph', content: 'Body' })} />);
    expect(screen.getByText('Body').tagName).toBe('P');
  });

  it('renders caption as a <p> tagged with its role', () => {
    render(<TextLayerContent layer={makeText({ semanticTag: 'caption', content: 'Cap' })} />);
    const el = screen.getByText('Cap');
    expect(el.tagName).toBe('P');
    expect(el).toHaveAttribute('data-wpsg-text-role', 'caption');
  });

  it('applies typography color and alignment from the layer', () => {
    render(<TextLayerContent layer={makeText({ textAlign: 'center', typography: { color: 'rgb(255, 0, 0)' } })} />);
    expect(screen.getByText('Summer Sale')).toHaveStyle({ color: 'rgb(255, 0, 0)', textAlign: 'center' });
  });
});

describe('textLayerStyle helpers', () => {
  it('maps semantic roles to HTML elements', () => {
    expect(textLayerElement('heading')).toBe('h2');
    expect(textLayerElement('subheading')).toBe('h3');
    expect(textLayerElement('paragraph')).toBe('p');
    expect(textLayerElement('caption')).toBe('p');
  });

  it('builds a CSS style from typography + alignment', () => {
    const style = textLayerTextStyle(makeText({ textAlign: 'right', typography: { fontSize: '32px', fontWeight: 700 } }));
    expect(style.textAlign).toBe('right');
    expect(style.fontSize).toBe('32px');
    expect(style.fontWeight).toBe(700);
  });
});
