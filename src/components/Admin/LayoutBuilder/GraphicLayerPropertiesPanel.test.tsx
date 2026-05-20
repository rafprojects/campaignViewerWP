/**
 * P17-D Tests: GraphicLayerPropertiesPanel
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
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

  it('send to back calls onSendToBack with overlay id', () => {
    const onSendToBack = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onSendToBack })} />);
    fireEvent.click(screen.getByRole('button', { name: /send to back/i }));
    expect(onSendToBack).toHaveBeenCalledWith('g1');
  });

  it('send backward calls onSendBackward with overlay id', () => {
    const onSendBackward = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onSendBackward })} />);
    fireEvent.click(screen.getByRole('button', { name: /send backward/i }));
    expect(onSendBackward).toHaveBeenCalledWith('g1');
  });

  it('bring forward calls onBringForward with overlay id', () => {
    const onBringForward = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onBringForward })} />);
    fireEvent.click(screen.getByRole('button', { name: /bring forward/i }));
    expect(onBringForward).toHaveBeenCalledWith('g1');
  });
});

describe('GraphicLayerPropertiesPanel — name editing', () => {
  it('updates local state as user types in the name input', async () => {
    const user = userEvent.setup();
    render(<GraphicLayerPropertiesPanel {...makeProps()} />);
    const input = screen.getByLabelText('Graphic layer name');
    await user.clear(input);
    await user.type(input, 'NewName');
    expect(input).toHaveValue('NewName');
  });

  it('calls onRename on blur when name changed', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onRename })} />);
    const input = screen.getByLabelText('Graphic layer name');
    await user.clear(input);
    await user.type(input, 'Updated');
    await user.tab();
    expect(onRename).toHaveBeenCalledWith('g1', 'Updated');
  });

  it('resets to display name on blur when input cleared', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onRename })} />);
    const input = screen.getByLabelText('Graphic layer name');
    await user.clear(input);
    await user.tab();
    expect(onRename).not.toHaveBeenCalled();
    expect(input).toHaveValue('Logo');
  });

  it('commits rename on Enter key', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onRename })} />);
    const input = screen.getByLabelText('Graphic layer name');
    await user.clear(input);
    await user.type(input, 'ViaEnter');
    await user.keyboard('{Enter}');
    expect(onRename).toHaveBeenCalledWith('g1', 'ViaEnter');
  });
});

describe('GraphicLayerPropertiesPanel — position/size inputs', () => {
  it('calls onUpdate with new x when X input changes', () => {
    const onUpdate = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onUpdate })} />);
    const xInput = screen.getByLabelText('X %');
    fireEvent.change(xInput, { target: { value: '25' } });
    expect(onUpdate).toHaveBeenCalledWith('g1', expect.objectContaining({ x: 25 }));
  });

  it('calls onUpdate with new y when Y input changes', () => {
    const onUpdate = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onUpdate })} />);
    const yInput = screen.getByLabelText('Y %');
    fireEvent.change(yInput, { target: { value: '30' } });
    expect(onUpdate).toHaveBeenCalledWith('g1', expect.objectContaining({ y: 30 }));
  });

  it('calls onUpdate with new width when W input changes', () => {
    const onUpdate = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onUpdate })} />);
    const wInput = screen.getByLabelText('W %');
    fireEvent.change(wInput, { target: { value: '60' } });
    expect(onUpdate).toHaveBeenCalledWith('g1', expect.objectContaining({ width: 60 }));
  });

  it('calls onUpdate with new height when H input changes', () => {
    const onUpdate = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onUpdate })} />);
    const hInput = screen.getByLabelText('H %');
    fireEvent.change(hInput, { target: { value: '45' } });
    expect(onUpdate).toHaveBeenCalledWith('g1', expect.objectContaining({ height: 45 }));
  });
});

describe('GraphicLayerPropertiesPanel — appearance', () => {
  it('calls onUpdate when click-through switch is toggled', () => {
    const onUpdate = vi.fn();
    render(<GraphicLayerPropertiesPanel {...makeProps({ onUpdate })} />);
    const sw = screen.getByRole('switch', { name: /click-through/i });
    fireEvent.click(sw);
    expect(onUpdate).toHaveBeenCalledWith('g1', expect.objectContaining({ pointerEvents: expect.any(Boolean) }));
  });
});
