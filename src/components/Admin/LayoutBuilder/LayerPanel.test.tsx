import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
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
    selectedSlotIds: new Set<string>(),
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

  it('honors persisted collapsed groups on first render', async () => {
    const groupedTemplate = {
      ...template,
      groups: [{ id: 'group-1', name: 'Grouped', memberIds: ['slot-1'], collapsed: true }],
    } satisfies import('@/types').LayoutTemplate;

    render(<LayerPanel {...makeProps({ template: groupedTemplate })} />);

    expect(screen.getByText('Grouped')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Media Layer 1')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Media Layer 2')).toBeInTheDocument();
  });

  it('allows keyboard activation of a group header row', () => {
    const onSelectGroup = vi.fn();
    const groupedTemplate = {
      ...template,
      groups: [{ id: 'group-1', name: 'Grouped', memberIds: ['slot-1'], collapsed: false }],
    } satisfies import('@/types').LayoutTemplate;

    render(<LayerPanel {...makeProps({ template: groupedTemplate, onSelectGroup })} />);

    const groupRow = screen.getByRole('button', { name: 'Select group Grouped' });

    fireEvent.keyDown(groupRow, { key: 'Enter' });
    fireEvent.keyDown(groupRow, { key: ' ' });

    expect(onSelectGroup).toHaveBeenCalledTimes(2);
    expect(onSelectGroup).toHaveBeenCalledWith('group-1');
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
        {...makeProps({ selectedSlotIds: new Set(['slot-1']), onSelectOverlay })}
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
        {...makeProps({ selectedSlotIds: new Set(['slot-1']), onToggleSlotVisible })}
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
        {...makeProps({ selectedSlotIds: new Set(['slot-1']), onToggleSlotLocked })}
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
        {...makeProps({ selectedSlotIds: new Set(['slot-1']), onBringToFront })}
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

  // ── P30-G: nested group tree rendering ───────────────────────────────────

  it('renders child group headers under their parent group', () => {
    const nestedTemplate = {
      ...template,
      slots: [
        ...template.slots,
        {
          id: 'slot-3',
          x: 0, y: 0, width: 10, height: 10, zIndex: 5,
          shape: 'rectangle' as const,
          borderRadius: 0, borderWidth: 0, borderColor: '#fff',
          objectFit: 'cover' as const, objectPosition: '50% 50%',
          clickAction: 'lightbox' as const, hoverEffect: 'none' as const,
        },
      ],
      groups: [
        {
          id: 'gParent',
          name: 'Parent Group',
          memberIds: [] as string[],
          childGroupIds: ['gChild'],
          parentGroupId: null as null,
          x: 0, y: 0, width: 100, height: 100,
        },
        {
          id: 'gChild',
          name: 'Child Group',
          memberIds: ['slot-3'],
          childGroupIds: [] as string[],
          parentGroupId: 'gParent' as string,
          x: 0, y: 0, width: 10, height: 10,
        },
      ],
    } satisfies import('@/types').LayoutTemplate;

    render(<LayerPanel {...makeProps({ template: nestedTemplate })} />);

    expect(screen.getByText('Parent Group')).toBeInTheDocument();
    expect(screen.getByText('Child Group')).toBeInTheDocument();
  });

  it('collapsing parent group hides child group and its member slots', async () => {
    const nestedTemplate = {
      ...template,
      slots: [
        ...template.slots,
        {
          id: 'slot-3',
          x: 0, y: 0, width: 10, height: 10, zIndex: 5,
          shape: 'rectangle' as const,
          borderRadius: 0, borderWidth: 0, borderColor: '#fff',
          objectFit: 'cover' as const, objectPosition: '50% 50%',
          clickAction: 'lightbox' as const, hoverEffect: 'none' as const,
          name: 'Slot Three',
        },
      ],
      groups: [
        {
          id: 'gParent',
          name: 'Parent Group',
          memberIds: [] as string[],
          childGroupIds: ['gChild'],
          parentGroupId: null as null,
          collapsed: false,
        },
        {
          id: 'gChild',
          name: 'Child Group',
          memberIds: ['slot-3'],
          childGroupIds: [] as string[],
          parentGroupId: 'gParent' as string,
        },
      ],
    } satisfies import('@/types').LayoutTemplate;

    render(<LayerPanel {...makeProps({ template: nestedTemplate })} />);

    // Initially visible
    expect(screen.getByText('Child Group')).toBeInTheDocument();
    expect(screen.getByText('Slot Three')).toBeInTheDocument();

    // Click the collapse button on the parent group header (first collapse button = topmost group)
    const collapseBtns = screen.getAllByRole('button', { name: 'Collapse group' });
    fireEvent.click(collapseBtns[0]!);

    // Child group and its slot should now be hidden
    await waitFor(() => {
      expect(screen.queryByText('Child Group')).not.toBeInTheDocument();
      expect(screen.queryByText('Slot Three')).not.toBeInTheDocument();
    });
    // Parent group header itself should still be visible
    expect(screen.getByText('Parent Group')).toBeInTheDocument();
  });

  it('shows total descendant count (not just direct member count)', () => {
    // gParent has 0 direct members but 1 nested slot in gChild
    const nestedTemplate = {
      ...template,
      slots: [
        ...template.slots,
        {
          id: 'slot-3',
          x: 0, y: 0, width: 10, height: 10, zIndex: 5,
          shape: 'rectangle' as const,
          borderRadius: 0, borderWidth: 0, borderColor: '#fff',
          objectFit: 'cover' as const, objectPosition: '50% 50%',
          clickAction: 'lightbox' as const, hoverEffect: 'none' as const,
        },
      ],
      groups: [
        {
          id: 'gParent',
          name: 'Parent Group',
          memberIds: [] as string[],
          childGroupIds: ['gChild'],
          parentGroupId: null as null,
        },
        {
          id: 'gChild',
          name: 'Child Group',
          memberIds: ['slot-3'],
          childGroupIds: [] as string[],
          parentGroupId: 'gParent' as string,
        },
      ],
    } satisfies import('@/types').LayoutTemplate;

    render(<LayerPanel {...makeProps({ template: nestedTemplate })} />);

    // The Parent Group row should show "1" (one descendant slot), not "0"
    const parentHeader = screen.getByRole('button', { name: /Select group Parent Group/ });
    expect(parentHeader).toBeInTheDocument();
    // The count badge should show "1"
    // Check the text content of the header includes "1"
    expect(parentHeader.textContent).toContain('1');
  });

  // ── P30-G: drag-reparent ─────────────────────────────────────────────────

  it('dropping a group onto another group calls onReparentGroup', () => {
    const onReparentGroup = vi.fn();
    const onReorderLayers = vi.fn();
    const twoGroupTemplate = {
      ...template,
      groups: [
        {
          id: 'gA',
          name: 'Group A',
          memberIds: ['slot-1'],
          childGroupIds: [] as string[],
          parentGroupId: null as null,
        },
        {
          id: 'gB',
          name: 'Group B',
          memberIds: ['slot-2'],
          childGroupIds: [] as string[],
          parentGroupId: null as null,
        },
      ],
    } satisfies import('@/types').LayoutTemplate;

    render(<LayerPanel {...makeProps({ template: twoGroupTemplate, onReparentGroup, onReorderLayers })} />);

    // Both group headers are draggable
    const groupRows = document.querySelectorAll<HTMLElement>('[draggable="true"][role="button"]');
    expect(groupRows.length).toBeGreaterThanOrEqual(2);

    const dragSource = groupRows[0]; // gA or gB depending on z-order
    const dropTarget = groupRows[1];

    fireEvent.dragStart(dragSource, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.dragOver(dropTarget, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(dropTarget, { dataTransfer: {} });

    expect(onReparentGroup).toHaveBeenCalledTimes(1);
    expect(onReorderLayers).not.toHaveBeenCalled();
  });

  // ── P30-G: isGroupSelected uses descendant slots ──────────────────────────

  it('group header shows selected style when all descendant slots are selected', () => {
    const nestedTemplate = {
      ...template,
      slots: [
        ...template.slots,
        {
          id: 'slot-3',
          x: 0, y: 0, width: 10, height: 10, zIndex: 5,
          shape: 'rectangle' as const,
          borderRadius: 0, borderWidth: 0, borderColor: '#fff',
          objectFit: 'cover' as const, objectPosition: '50% 50%',
          clickAction: 'lightbox' as const, hoverEffect: 'none' as const,
        },
      ],
      groups: [
        {
          id: 'gParent',
          name: 'Parent Group',
          memberIds: [] as string[],
          childGroupIds: ['gChild'],
          parentGroupId: null as null,
        },
        {
          id: 'gChild',
          name: 'Child Group',
          memberIds: ['slot-3'],
          childGroupIds: [] as string[],
          parentGroupId: 'gParent' as string,
        },
      ],
    } satisfies import('@/types').LayoutTemplate;

    // Select the descendant slot (slot-3) — parent group should show selected state
    const { container } = render(
      <LayerPanel
        {...makeProps({
          template: nestedTemplate,
          selectedSlotIds: new Set(['slot-3']),
        })}
      />,
    );

    const parentHeader = container.querySelector('[aria-label="Select group Parent Group"]');
    expect(parentHeader).toBeInTheDocument();
    // Parent header should have blue-light background (selected)
    expect(parentHeader).toHaveStyle('background: var(--mantine-color-blue-light)');
  });

  // ── P57-D: filterText ─────────────────────────────────────────────────────

  it('filterText narrows the list to matching layers', () => {
    const namedTemplate = {
      ...template,
      slots: [
        { ...template.slots[0]!, name: 'Hero Image' },
        { ...template.slots[1]!, name: 'Thumb Image' },
      ],
    } satisfies import('@/types').LayoutTemplate;

    render(<LayerPanel {...makeProps({ template: namedTemplate, filterText: 'hero' })} />);
    expect(screen.getByText('Hero Image')).toBeInTheDocument();
    expect(screen.queryByText('Thumb Image')).not.toBeInTheDocument();
    expect(screen.queryByText('Graphic Layer 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Background')).not.toBeInTheDocument();
  });

  it('filterText with no match renders an empty list without crashing', () => {
    render(<LayerPanel {...makeProps({ filterText: 'zzznomatch' })} />);
    expect(screen.queryByText('Media Layer 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Graphic Layer 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Background')).not.toBeInTheDocument();
  });

  it('clearing filterText restores the full list', () => {
    const { rerender } = render(<LayerPanel {...makeProps({ filterText: 'zzznomatch' })} />);
    expect(screen.queryByText('Media Layer 1')).not.toBeInTheDocument();

    rerender(<LayerPanel {...makeProps({ filterText: '' })} />);
    expect(screen.getByText('Media Layer 1')).toBeInTheDocument();
    expect(screen.getByText('Media Layer 2')).toBeInTheDocument();
    expect(screen.getByText('Graphic Layer 1')).toBeInTheDocument();
  });

  it('filterText keeps ancestor groups of matched slots visible', () => {
    const groupedTemplate = {
      ...template,
      slots: [
        { ...template.slots[0]!, name: 'Slot Alpha' },
        { ...template.slots[1]!, name: 'Slot Beta' },
      ],
      groups: [
        {
          id: 'g1',
          name: 'My Group',
          memberIds: ['slot-1'],
          childGroupIds: [] as string[],
          parentGroupId: null as null,
        },
      ],
    } satisfies import('@/types').LayoutTemplate;

    render(<LayerPanel {...makeProps({ template: groupedTemplate, filterText: 'alpha' })} />);
    // 'My Group' is ancestor of slot-1 ('Slot Alpha') → stays visible
    expect(screen.getByText('My Group')).toBeInTheDocument();
    expect(screen.getByText('Slot Alpha')).toBeInTheDocument();
    // 'Slot Beta' is not in the group and doesn't match → hidden
    expect(screen.queryByText('Slot Beta')).not.toBeInTheDocument();
  });
});
