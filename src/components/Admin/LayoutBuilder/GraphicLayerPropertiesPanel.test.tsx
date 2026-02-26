/**
 * P17-D Tests: GraphicLayerPropertiesPanel
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { GraphicLayerPropertiesPanel, type GraphicLayerPropertiesPanelProps } from './GraphicLayerPropertiesPanel';
import type { LayoutGraphicLayer } from '@/types';

const baseOverlay: LayoutGraphicLayer = {
  id: 'g1',
  imageUrl: 'https://example.com/graphic.png',
  x: 10,
  y: 20,
  width: 50,
  height: 40,
  zIndex: 5,
  opacity: 0.8,
  pointerEvents: false,
  name: 'Logo',
};

function makeProps(overrides: Partial<GraphicLayerPropertiesPanelProps> = {}): GraphicLayerPropertiesPanelProps {
  return {
    overlay: baseOverlay,
    overlayIndex: 1,
    onUpdate: vi.fn(),
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onBringToFront: vi.fn(),
    onSendToBack: vi.fn(),
    onBringForward: vi.fn(),
    onSendBackward: vi.fn(),
    ...overrides,
  };
}

describe('GraphicLayerPropertiesPanel', () => {
  it('renders the layer name in the name input', () => {
    render(<GraphicLayerPropertiesPanel {...makeProps()} />);
    expect(screen.getByLabelText('Graphic layer name')).toHaveValue('Logo');
  });

  it('falls back to "Graphic Layer N" when name is absent', () => {
    const overlay = { ...baseOverlay, name: undefined };
    render(<GraphicLayerPropertiesPanel {...makeProps({ overlay, overlayIndex: 3 })} />);
    expect(screen.getByLabelText('Graphic layer name')).toHaveValue('Graphic Layer 3');
  });

  it('renders X%, Y%, W%, H% inputs with correct values', () => {
    render(<GraphicLayerPropertiesPanel {...makeProps()} />);
    expect(screen.getByLabelText('X %')).toHaveValue('10');
    expect(screen.getByLabelText('Y %')).toHaveValue('20');
    expect(screen.getByLabelText('W %')).toHaveValue('50');
    expect(screen.getByLabelText('H %')).toHaveValue('40');
  });

  it('fill canvas button calls onUpdate with 0/0/100/100', () => {
    const onUpdate = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onUpdate })} />);
    fireEvent.click(screen.getByRole('button', { name: /fill canvas/i }));
    expect(onUpdate).toHaveBeenCalledWith('g1', { x: 0, y: 0, width: 100, height: 100 });
  });

  it('opacity slider is present with correct aria-label', () => {
    render(<GraphicLayerPropertiesPanel {...makeProps()} />);
    expect(screen.getByLabelText('Graphic layer opacity')).toBeInTheDocument();
  });

  it('click-through switch reflects pointerEvents=false as checked', () => {
    render(<GraphicLayerPropertiesPanel {...makeProps()} />);
    // Mantine Switch renders with role="switch", not role="checkbox"
    const sw = screen.getByRole('switch', { name: /click-through/i });
    // pointerEvents=false → click-through=true
    expect(sw).toBeChecked();
  });

  it('remove button shows confirm UI on first click', () => {
    render(<GraphicLayerPropertiesPanel {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /remove layer/i }));
    expect(screen.getByText(/remove this graphic layer\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm remove/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onRemove after confirm', () => {
    const onRemove = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onRemove })} />);
    fireEvent.click(screen.getByRole('button', { name: /remove layer/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }));
    expect(onRemove).toHaveBeenCalledWith('g1');
  });

  it('cancel button hides confirm UI without calling onRemove', () => {
    const onRemove = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onRemove })} />);
    fireEvent.click(screen.getByRole('button', { name: /remove layer/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /remove layer/i })).toBeInTheDocument();
  });

  it('z-order action buttons are present', () => {
    render(<GraphicLayerPropertiesPanel {...makeProps()} />);
    expect(screen.getByRole('button', { name: /send to back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send backward/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bring forward/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bring to front/i })).toBeInTheDocument();
  });

  it('bring to front calls onBringToFront with overlay id', () => {
    const onBringToFront = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onBringToFront })} />);
    fireEvent.click(screen.getByRole('button', { name: /bring to front/i }));
    expect(onBringToFront).toHaveBeenCalledWith('g1');
  });
});
