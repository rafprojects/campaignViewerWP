import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { LayerPanel, type LayerPanelProps } from './LayerPanel';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Cast to LayoutTemplate to keep the fixture minimal — tests only exercise
// layer-panel logic, not slot/overlay rendering details.
const template = {
  id: 'tpl-1',
  name: 'Test',
  schemaVersion: 1,
  canvasAspectRatio: 1,
  canvasMinWidth: 200,
  canvasMaxWidth: 0,
  backgroundColor: '#000',
  createdAt: '',
  updatedAt: '',
  tags: [],
  slots: [
    {
      id: 'slot-1',
      x: 0, y: 0, width: 100, height: 100, zIndex: 2,
      shape: 'rectangle' as const,
      borderRadius: 0, borderWidth: 0, borderColor: '#fff',
      objectFit: 'cover' as const, objectPosition: '50% 50%',
      clickAction: 'lightbox' as const, hoverEffect: 'none' as const,
    },
    {
      id: 'slot-2',
      x: 0, y: 0, width: 100, height: 100, zIndex: 1,
      shape: 'rectangle' as const,
      borderRadius: 0, borderWidth: 0, borderColor: '#fff',
      objectFit: 'cover' as const, objectPosition: '50% 50%',
      clickAction: 'lightbox' as const, hoverEffect: 'none' as const,
    },
  ],
  overlays: [
    {
      id: 'overlay-1',
      imageUrl: '',
      x: 0, y: 0, width: 50, height: 50, zIndex: 3,
      opacity: 1, pointerEvents: false,
    },
  ],
} satisfies import('@/types').LayoutTemplate;

function makeProps(overrides: Partial<LayerPanelProps> = {}): LayerPanelProps {
  return {
    template,
    selectedSlotId: null,
    selectedOverlayId: null,
    isBackgroundSelected: false,
    onSelectSlot: vi.fn(),
    onSelectOverlay: vi.fn(),
    onSelectBackground: vi.fn(),
    onClearSelection: vi.fn(),
    onRenameSlot: vi.fn(),
    onRenameOverlay: vi.fn(),
    onToggleSlotVisible: vi.fn(),
    onToggleOverlayVisible: vi.fn(),
    onToggleSlotLocked: vi.fn(),
    onToggleOverlayLocked: vi.fn(),
    onReorderLayers: vi.fn(),
    onBringToFront: vi.fn(),
    onSendToBack: vi.fn(),
    onBringForward: vi.fn(),
    onSendBackward: vi.fn(),
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The ScrollArea.Autosize that owns onKeyDown has tabIndex=0. */
function getKeyboardTarget() {
  return document.querySelector<HTMLElement>('[tabindex="0"]')!;
}

// ── Rendering tests ───────────────────────────────────────────────────────────

describe('LayerPanel', () => {
  it('renders all layers including background', () => {
    render(<LayerPanel {...makeProps()} />);
    expect(screen.getByText('Graphic Layer 1')).toBeInTheDocument();
    expect(screen.getByText('Media Layer 1')).toBeInTheDocument();
    expect(screen.getByText('Media Layer 2')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
  });

  it('renders the section header', () => {
    render(<LayerPanel {...makeProps()} />);
    expect(screen.getByText('Layers')).toBeInTheDocument();
  });

  // ── Keyboard: ArrowDown / ArrowUp ─────────────────────────────────────────

  it('ArrowDown moves selection to the next layer', () => {
    const onSelectSlot = vi.fn();
    // overlay-1 (z=3) is at index 0, slot-1 (z=2) at index 1
    render(
      <LayerPanel
        {...makeProps({ selectedOverlayId: 'overlay-1', onSelectSlot })}
      />,
    );
    const kbd = getKeyboardTarget();
    fireEvent.keyDown(kbd, { key: 'ArrowDown' });
    expect(onSelectSlot).toHaveBeenCalledWith('slot-1');
  });

  it('ArrowUp moves selection to the previous layer', () => {
    const onSelectOverlay = vi.fn();
    // slot-1 (z=2) is at index 1, moving up should reach overlay-1 (z=3) at index 0
    render(
      <LayerPanel
        {...makeProps({ selectedSlotId: 'slot-1', onSelectOverlay })}
      />,
    );
    const kbd = getKeyboardTarget();
    fireEvent.keyDown(kbd, { key: 'ArrowUp' });
    expect(onSelectOverlay).toHaveBeenCalledWith('overlay-1');
  });

  it('ArrowDown does nothing when last layer is selected', () => {
    const onSelectBackground = vi.fn();
    // Background is the last item; ArrowDown should be a no-op
    render(
      <LayerPanel
        {...makeProps({ isBackgroundSelected: true, onSelectBackground })}
      />,
    );
    const kbd = getKeyboardTarget();
    fireEvent.keyDown(kbd, { key: 'ArrowDown' });
    // onSelectBackground is not called again (it was only used for initial selection)
    expect(onSelectBackground).not.toHaveBeenCalled();
  });

  // ── Keyboard: Space (toggle visibility) ───────────────────────────────────

  it('Space toggles slot visibility', () => {
    const onToggleSlotVisible = vi.fn();
    render(
      <LayerPanel
        {...makeProps({ selectedSlotId: 'slot-1', onToggleSlotVisible })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: ' ' });
    expect(onToggleSlotVisible).toHaveBeenCalledWith('slot-1');
  });

  it('Space toggles overlay visibility', () => {
    const onToggleOverlayVisible = vi.fn();
    render(
      <LayerPanel
        {...makeProps({ selectedOverlayId: 'overlay-1', onToggleOverlayVisible })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: ' ' });
    expect(onToggleOverlayVisible).toHaveBeenCalledWith('overlay-1');
  });

  it('Space does nothing when background is selected', () => {
    const onToggleSlotVisible = vi.fn();
    const onToggleOverlayVisible = vi.fn();
    render(
      <LayerPanel
        {...makeProps({
          isBackgroundSelected: true,
          onToggleSlotVisible,
          onToggleOverlayVisible,
        })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: ' ' });
    expect(onToggleSlotVisible).not.toHaveBeenCalled();
    expect(onToggleOverlayVisible).not.toHaveBeenCalled();
  });

  // ── Keyboard: L (toggle lock) ─────────────────────────────────────────────

  it('L toggles slot lock', () => {
    const onToggleSlotLocked = vi.fn();
    render(
      <LayerPanel
        {...makeProps({ selectedSlotId: 'slot-1', onToggleSlotLocked })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: 'l' });
    expect(onToggleSlotLocked).toHaveBeenCalledWith('slot-1');
  });

  it('L toggles overlay lock', () => {
    const onToggleOverlayLocked = vi.fn();
    render(
      <LayerPanel
        {...makeProps({ selectedOverlayId: 'overlay-1', onToggleOverlayLocked })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: 'L' });
    expect(onToggleOverlayLocked).toHaveBeenCalledWith('overlay-1');
  });

  // ── Keyboard: F / B (z-order) ─────────────────────────────────────────────

  it('F calls onBringToFront for a slot', () => {
    const onBringToFront = vi.fn();
    render(
      <LayerPanel
        {...makeProps({ selectedSlotId: 'slot-1', onBringToFront })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: 'f' });
    expect(onBringToFront).toHaveBeenCalledWith('slot-1');
  });

  it('B calls onSendToBack for an overlay', () => {
    const onSendToBack = vi.fn();
    render(
      <LayerPanel
        {...makeProps({ selectedOverlayId: 'overlay-1', onSendToBack })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: 'b' });
    expect(onSendToBack).toHaveBeenCalledWith('overlay-1');
  });

  it('F does nothing when background is selected', () => {
    const onBringToFront = vi.fn();
    render(
      <LayerPanel
        {...makeProps({ isBackgroundSelected: true, onBringToFront })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: 'F' });
    expect(onBringToFront).not.toHaveBeenCalled();
  });

  it('B does nothing when background is selected', () => {
    const onSendToBack = vi.fn();
    render(
      <LayerPanel
        {...makeProps({ isBackgroundSelected: true, onSendToBack })}
      />,
    );
    fireEvent.keyDown(getKeyboardTarget(), { key: 'B' });
    expect(onSendToBack).not.toHaveBeenCalled();
  });

  // ── Keyboard: no selection → no-op ───────────────────────────────────────

  it('keyboard shortcuts are no-ops when nothing is selected', () => {
    const props = makeProps();
    render(<LayerPanel {...props} />);
    const kbd = getKeyboardTarget();
    fireEvent.keyDown(kbd, { key: 'ArrowDown' });
    fireEvent.keyDown(kbd, { key: ' ' });
    fireEvent.keyDown(kbd, { key: 'f' });
    expect(props.onSelectSlot).not.toHaveBeenCalled();
    expect(props.onToggleSlotVisible).not.toHaveBeenCalled();
    expect(props.onBringToFront).not.toHaveBeenCalled();
  });

  // ── Drop triggers onReorderLayers ────────────────────────────────────────

  it('drop on a different row calls onReorderLayers', () => {
    const onReorderLayers = vi.fn();
    render(<LayerPanel {...makeProps({ onReorderLayers })} />);

    // Find the row containers by their drag-handle presence
    const rows = document.querySelectorAll<HTMLElement>('[draggable="true"]');
    // rows[0] → overlay-1 (highest z-index), rows[1] → slot-1
    const dragSource = rows[0];
    const dropTarget = rows[1];

    fireEvent.dragStart(dragSource, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragOver(dropTarget, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(dropTarget, { dataTransfer: {} });

    expect(onReorderLayers).toHaveBeenCalledWith('overlay-1', 'slot-1');
  });
});
