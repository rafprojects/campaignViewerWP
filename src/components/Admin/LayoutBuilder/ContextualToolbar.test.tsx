/**
 * Tests for ContextualToolbar — the floating contextual action toolbar.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';
import { ContextualToolbar, type ContextualToolbarCallbacks, type SelectionRect } from './ContextualToolbar';
import type { LayoutGroup } from '@/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 600;

const midRect: SelectionRect = { x: 300, y: 200, width: 200, height: 150 };

function makeGroup(overrides: Partial<LayoutGroup> = {}): LayoutGroup {
  return {
    id: 'g1',
    name: 'Group 1',
    memberIds: ['s1', 's2'],
    ...overrides,
  };
}

function makeCallbacks(overrides: Partial<ContextualToolbarCallbacks> = {}): ContextualToolbarCallbacks {
  return {
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onCreateGroup: vi.fn(),
    onUngroup: vi.fn(),
    onGroupLockToggle: vi.fn(),
    onGroupVisibilityToggle: vi.fn(),
    onGroupRename: vi.fn(),
    onBringForward: vi.fn(),
    onSendBackward: vi.fn(),
    announce: vi.fn(),
    ...overrides,
  };
}

function renderToolbar(
  props: {
    selectionRect?: SelectionRect | null;
    selectedSlotIds?: ReadonlySet<string>;
    groups?: LayoutGroup[];
    canvasWidth?: number;
    canvasHeight?: number;
    callbacks?: ContextualToolbarCallbacks;
  } = {},
) {
  const {
    selectionRect = midRect,
    selectedSlotIds = new Set(['s1']),
    groups = [],
    canvasWidth = CANVAS_W,
    canvasHeight = CANVAS_H,
    callbacks = makeCallbacks(),
  } = props;

  return render(
    <ContextualToolbar
      selectionRect={selectionRect}
      selectedSlotIds={selectedSlotIds}
      groups={groups}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      callbacks={callbacks}
    />,
  );
}

// ── Null-render cases ─────────────────────────────────────────────────────────

describe('ContextualToolbar — null-render cases', () => {
  it('renders nothing when selectionRect is null', () => {
    renderToolbar({ selectionRect: null });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('renders nothing when selectedSlotIds is empty', () => {
    renderToolbar({ selectedSlotIds: new Set() });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});

// ── Single-slot toolbar ───────────────────────────────────────────────────────

describe('ContextualToolbar — single-slot selection', () => {
  it('shows Duplicate, Bring Forward, Send Backward, Delete', () => {
    renderToolbar({ selectedSlotIds: new Set(['s1']) });
    expect(screen.getByRole('button', { name: 'Duplicate slot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bring forward' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send backward' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete slot' })).toBeInTheDocument();
  });

  it('does not show Group or Ungroup buttons', () => {
    renderToolbar({ selectedSlotIds: new Set(['s1']) });
    expect(screen.queryByRole('button', { name: 'Group selected slots' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ungroup' })).toBeNull();
  });

  it('calls onDuplicate when Duplicate is clicked', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds: new Set(['s1']), callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate slot' }));
    expect(callbacks.onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when Delete is clicked', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds: new Set(['s1']), callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Delete slot' }));
    expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onBringForward with slot ids', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds: new Set(['s1']), callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Bring forward' }));
    expect(callbacks.onBringForward).toHaveBeenCalledWith(['s1']);
  });

  it('calls onSendBackward with slot ids', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds: new Set(['s1']), callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Send backward' }));
    expect(callbacks.onSendBackward).toHaveBeenCalledWith(['s1']);
  });
});

// ── Multi-slot toolbar ────────────────────────────────────────────────────────

describe('ContextualToolbar — multi-slot selection', () => {
  it('shows Group, Duplicate, Delete', () => {
    renderToolbar({ selectedSlotIds: new Set(['s1', 's2']) });
    expect(screen.getByRole('button', { name: 'Group selected slots' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate selected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeInTheDocument();
  });

  it('does not show Ungroup or single-slot Bring Forward', () => {
    renderToolbar({ selectedSlotIds: new Set(['s1', 's2']) });
    expect(screen.queryByRole('button', { name: 'Ungroup' })).toBeNull();
  });

  it('calls onCreateGroup when Group is clicked', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds: new Set(['s1', 's2']), callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Group selected slots' }));
    expect(callbacks.onCreateGroup).toHaveBeenCalledTimes(1);
  });

  it('calls onDuplicate when Duplicate is clicked', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds: new Set(['s1', 's2']), callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate selected' }));
    expect(callbacks.onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when Delete is clicked', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds: new Set(['s1', 's2']), callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
  });
});

// ── Group toolbar ─────────────────────────────────────────────────────────────

describe('ContextualToolbar — group selection', () => {
  const group = makeGroup({ memberIds: ['s1', 's2'] });
  const selectedSlotIds = new Set(['s1', 's2']);

  it('shows Rename, Ungroup, Lock, Hide, Bring Forward, Send Backward', () => {
    renderToolbar({ selectedSlotIds, groups: [group] });
    expect(screen.getByRole('button', { name: 'Rename group' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ungroup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock group' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide group' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bring forward' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send backward' })).toBeInTheDocument();
  });

  it('does not show Group or Duplicate-slot buttons', () => {
    renderToolbar({ selectedSlotIds, groups: [group] });
    expect(screen.queryByRole('button', { name: 'Group selected slots' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duplicate slot' })).toBeNull();
  });

  it('shows Unlock when group is locked', () => {
    const lockedGroup = makeGroup({ memberIds: ['s1', 's2'], locked: true });
    renderToolbar({ selectedSlotIds, groups: [lockedGroup] });
    expect(screen.getByRole('button', { name: 'Unlock group' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lock group' })).toBeNull();
  });

  it('shows Show when group is hidden', () => {
    const hiddenGroup = makeGroup({ memberIds: ['s1', 's2'], visible: false });
    renderToolbar({ selectedSlotIds, groups: [hiddenGroup] });
    expect(screen.getByRole('button', { name: 'Show group' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide group' })).toBeNull();
  });

  it('calls onUngroup with group id', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds, groups: [group], callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Ungroup' }));
    expect(callbacks.onUngroup).toHaveBeenCalledWith('g1');
  });

  it('calls onGroupLockToggle with locked=true', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds, groups: [group], callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Lock group' }));
    expect(callbacks.onGroupLockToggle).toHaveBeenCalledWith('g1', true);
  });

  it('calls onGroupVisibilityToggle with visible=false', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds, groups: [group], callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Hide group' }));
    expect(callbacks.onGroupVisibilityToggle).toHaveBeenCalledWith('g1', false);
  });

  it('calls onBringForward with all selected ids', () => {
    const callbacks = makeCallbacks();
    renderToolbar({ selectedSlotIds, groups: [group], callbacks });
    fireEvent.click(screen.getByRole('button', { name: 'Bring forward' }));
    expect(callbacks.onBringForward).toHaveBeenCalledWith(expect.arrayContaining(['s1', 's2']));
  });
});

// ── Placement ─────────────────────────────────────────────────────────────────

describe('ContextualToolbar — placement', () => {
  it('positions toolbar above selection when there is enough room', () => {
    // selectionRect.y = 200, TOOLBAR_HEIGHT = 36, TOOLBAR_GAP = 8 → 200 >= 44 → above
    const { getByTestId } = renderToolbar({
      selectionRect: { x: 300, y: 200, width: 200, height: 100 },
    });
    const toolbar = getByTestId('contextual-toolbar');
    const top = parseInt(toolbar.style.top, 10);
    // above: y - TOOLBAR_HEIGHT - TOOLBAR_GAP = 200 - 36 - 8 = 156
    expect(top).toBe(156);
  });

  it('flips below selection when there is not enough room above', () => {
    // selectionRect.y = 20, TOOLBAR_HEIGHT = 36, TOOLBAR_GAP = 8 → 20 < 44 → below
    const { getByTestId } = renderToolbar({
      selectionRect: { x: 300, y: 20, width: 200, height: 100 },
    });
    const toolbar = getByTestId('contextual-toolbar');
    const top = parseInt(toolbar.style.top, 10);
    // below: y + height + gap = 20 + 100 + 8 = 128
    expect(top).toBe(128);
  });

  it('clamps left edge to 0 when selection is near left edge', () => {
    // midX = 10 + 20/2 = 20; rawLeft = 20 - 90 = -70 → clamps to 0
    const { getByTestId } = renderToolbar({
      selectionRect: { x: 10, y: 200, width: 20, height: 50 },
    });
    const toolbar = getByTestId('contextual-toolbar');
    expect(parseInt(toolbar.style.left, 10)).toBe(0);
  });

  it('clamps right edge when selection is near right canvas edge', () => {
    // midX near canvasWidth; rawLeft would exceed canvasWidth - TOOLBAR_MIN_WIDTH
    const { getByTestId } = renderToolbar({
      selectionRect: { x: CANVAS_W - 30, y: 200, width: 20, height: 50 },
      canvasWidth: CANVAS_W,
    });
    const toolbar = getByTestId('contextual-toolbar');
    // clampedLeft = min(CANVAS_W - 180, rawLeft) but rawLeft is large → CANVAS_W - 180 = 620
    expect(parseInt(toolbar.style.left, 10)).toBeLessThanOrEqual(CANVAS_W - 180);
  });
});
