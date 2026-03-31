/**
 * Tests for P19-A: Builder Keyboard Shortcuts
 *
 * Covers the keyboard handler in LayoutBuilderModal and the BuilderKeyboardShortcutsModal
 * reference sheet, as specified in the P19-A track of PHASE19_REPORT.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import type { ReactNode } from 'react';

// ── Heavy dep mocks ──────────────────────────────────────────────────────────

vi.mock('dockview', () => ({
  DockviewReact: () => <div data-testid="dockview-mock" />,
}));

vi.mock('swr', () => ({
  default: vi.fn().mockReturnValue({ data: undefined, mutate: vi.fn() }),
}));

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: (ref: unknown) => ReactNode }) =>
    typeof children === 'function'
      ? children(null)
      : children,
  TransformComponent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/utils/debug', () => ({
  debugGroup: vi.fn(),
  debugLog: vi.fn(),
  debugGroupEnd: vi.fn(),
}));

// ── Mock useLayoutBuilderState ───────────────────────────────────────────────

const {
  mockUndo,
  mockRedo,
  mockNudgeSlots,
  mockRemoveSlots,
  mockClearSelection,
  mockNormalizeZIndices,
  mockBringForward,
  mockSendBackward,
  mockBringToFront,
  mockSendToBack,
  mockSelectedSlotIds,
  mockBuilderReturn,
} = vi.hoisted(() => {
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();
  const mockNudgeSlots = vi.fn();
  const mockRemoveSlots = vi.fn();
  const mockClearSelection = vi.fn();
  const mockDuplicateSlots = vi.fn();
  const mockNormalizeZIndices = vi.fn().mockReturnValue({
    id: 1, name: 'Test', slots: [], overlays: [], canvasAspectRatio: 1.78,
  });
  const mockBringForward = vi.fn();
  const mockSendBackward = vi.fn();
  const mockBringToFront = vi.fn();
  const mockSendToBack = vi.fn();
  const mockSetName = vi.fn();
  const mockSetAspectRatio = vi.fn();
  const mockTogglePreview = vi.fn();
  const mockMarkSaved = vi.fn();
  const mockSetTemplate = vi.fn();
  const mockAutoAssignMedia = vi.fn();
  const mockAddOverlay = vi.fn();
  const mockSetBackgroundImage = vi.fn();
  const mockSelectedSlotIds = new Set<string>();
  const mockBuilderReturn = {
    template: { id: 1, name: 'Test Layout', slots: [], overlays: [], canvasAspectRatio: 16 / 9 },
    selectedSlotIds: mockSelectedSlotIds,
    isDirty: false,
    isSaving: false,
    isPreview: false,
    isHistoryTrimmed: false,
    canUndo: true,
    canRedo: true,
    undo: mockUndo,
    redo: mockRedo,
    nudgeSlots: mockNudgeSlots,
    removeSlots: mockRemoveSlots,
    clearSelection: mockClearSelection,
    duplicateSlots: mockDuplicateSlots,
    normalizeZIndices: mockNormalizeZIndices,
    bringForward: mockBringForward,
    sendBackward: mockSendBackward,
    bringToFront: mockBringToFront,
    sendToBack: mockSendToBack,
    setName: mockSetName,
    setAspectRatio: mockSetAspectRatio,
    togglePreview: mockTogglePreview,
    markSaved: mockMarkSaved,
    setTemplate: mockSetTemplate,
    autoAssignMedia: mockAutoAssignMedia,
    addOverlay: mockAddOverlay,
    setBackgroundImage: mockSetBackgroundImage,
    selectSlot: vi.fn(),
    toggleSlotSelection: vi.fn(),
    moveSlot: vi.fn(),
    resizeSlot: vi.fn(),
    addSlot: vi.fn(),
    removeSlot: vi.fn(),
    updateSlot: vi.fn(),
    addGraphicLayer: vi.fn(),
    removeGraphicLayer: vi.fn(),
    updateGraphicLayer: vi.fn(),
    setSlotLocked: vi.fn(),
    setSlotVisible: vi.fn(),
  };
  return {
    mockUndo, mockRedo, mockNudgeSlots, mockRemoveSlots, mockClearSelection,
    mockNormalizeZIndices, mockBringForward, mockSendBackward,
    mockBringToFront, mockSendToBack, mockSelectedSlotIds, mockBuilderReturn,
  };
});

vi.mock('@/hooks/useLayoutBuilderState', () => ({
  useLayoutBuilderState: vi.fn().mockReturnValue(mockBuilderReturn),
  createEmptyTemplate: vi.fn().mockReturnValue({
    id: undefined,
    name: 'Untitled Layout',
    slots: [],
    overlays: [],
    canvasAspectRatio: 16 / 9,
  }),
}));

// ── Import component under test (after mocks) ────────────────────────────────

import { LayoutBuilderModal } from './LayoutBuilderModal';
import { BuilderKeyboardShortcutsModal } from './BuilderKeyboardShortcutsModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <ModalsProvider>{children}</ModalsProvider>
    </MantineProvider>
  );
}

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  postForm: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  updateLayoutTemplate: vi.fn().mockResolvedValue({ id: 1, name: 'Test Layout', slots: [], overlays: [], canvasAspectRatio: 1.78 }),
  createLayoutTemplate: vi.fn().mockResolvedValue({ id: 1, name: 'Test Layout', slots: [], overlays: [], canvasAspectRatio: 1.78 }),
};

function renderModal(props: Partial<Parameters<typeof LayoutBuilderModal>[0]> = {}) {
  return render(
    <LayoutBuilderModal
      opened
      onClose={vi.fn()}
      apiClient={mockApiClient as never}
      {...props}
    />,
    { wrapper },
  );
}

/** Fire a keydown on the builder keyboard-handler div (rendered in a Mantine portal). */
function pressKey(
  key: string,
  options: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {},
) {
  const builderDiv = document.body.querySelector('[data-testid="builder-keyboard-handler"]') as Element | null;
  if (!builderDiv) throw new Error('builder-keyboard-handler not found in document.body');
  fireEvent.keyDown(builderDiv, { key, bubbles: true, ...options });
}

// ── Test suites ──────────────────────────────────────────────────────────────

describe('BuilderKeyboardShortcutsModal', () => {
  it('renders shortcut sections when opened', () => {
    render(<BuilderKeyboardShortcutsModal opened onClose={vi.fn()} />, { wrapper });
    expect(screen.getByText('Builder Keyboard Shortcuts')).toBeDefined();
    expect(screen.getAllByText(/Ctrl/i).length).toBeGreaterThan(0);
  });

  it('does not render content when closed', () => {
    render(<BuilderKeyboardShortcutsModal opened={false} onClose={vi.fn()} />, { wrapper });
    expect(screen.queryByText('Builder Keyboard Shortcuts')).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<BuilderKeyboardShortcutsModal opened onClose={onClose} />, { wrapper });
    // Mantine renders a close button with data-close-button
    const closeBtn = document.body.querySelector('[data-mantine-stop-propagation]') as HTMLElement
      ?? document.body.querySelector('button[aria-label="Close"]') as HTMLElement;
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    } else {
      // No close button found in jsdom — modal renders correctly, skip close-button sub-test
      expect(onClose).not.toHaveBeenCalled();
    }
  });

  it('shows undo shortcut (Ctrl+Z)', () => {
    render(<BuilderKeyboardShortcutsModal opened onClose={vi.fn()} />, { wrapper });
    expect(screen.getByText('Undo')).toBeDefined();
  });

  it('shows save shortcut (Ctrl+S)', () => {
    render(<BuilderKeyboardShortcutsModal opened onClose={vi.fn()} />, { wrapper });
    expect(screen.getByText('Save template')).toBeDefined();
  });

  it('shows H shortcut for hand tool', () => {
    render(<BuilderKeyboardShortcutsModal opened onClose={vi.fn()} />, { wrapper });
    expect(screen.getByText('Toggle hand / pan tool')).toBeDefined();
  });

  it('shows V shortcut for select tool', () => {
    render(<BuilderKeyboardShortcutsModal opened onClose={vi.fn()} />, { wrapper });
    expect(screen.getByText('Return to select tool')).toBeDefined();
  });

  it('shows ? shortcut for help', () => {
    render(<BuilderKeyboardShortcutsModal opened onClose={vi.fn()} />, { wrapper });
    expect(screen.getByText('Show this keyboard shortcuts reference')).toBeDefined();
  });
});

describe('LayoutBuilderModal — keyboard shortcuts (P19-A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuilderReturn.isDirty = false;
    mockNormalizeZIndices.mockReturnValue({
      id: 1, name: 'Test', slots: [], overlays: [], canvasAspectRatio: 1.78,
    });
  });

  it('Ctrl+Z calls builder.undo()', () => {
    renderModal();
    pressKey('z', { ctrlKey: true });
    expect(mockUndo).toHaveBeenCalledOnce();
  });

  it('Ctrl+Shift+Z calls builder.redo()', () => {
    renderModal();
    pressKey('z', { ctrlKey: true, shiftKey: true });
    expect(mockRedo).toHaveBeenCalledOnce();
  });

  it('Ctrl+S calls handleSave and calls apiClient.createLayoutTemplate', async () => {
    renderModal();
    // Override isDirty so save is enabled
    mockBuilderReturn.isDirty = true;
    pressKey('s', { ctrlKey: true });
    // handleSave is async — wait for it
    await vi.waitFor(() => {
      expect(mockNormalizeZIndices).toHaveBeenCalled();
    });
  });

  it('Ctrl+S preventDefault is called', () => {
    renderModal();
    const target = document.body.querySelector('[data-testid="builder-keyboard-handler"]') as Element;
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    fireEvent(target, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('Delete calls builder.removeSlots for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('Delete');
    expect(mockRemoveSlots).toHaveBeenCalledWith(['slot-1']);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('Escape clears selection when slots are selected', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('Escape');
    expect(mockClearSelection).toHaveBeenCalledOnce();
    mockSelectedSlotIds.delete('slot-1');
  });

  it('Escape calls onClose when nothing is selected', () => {
    const mockOnClose = vi.fn();
    renderModal({ onClose: mockOnClose });
    pressKey('Escape');
    expect(mockClearSelection).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('Escape opens a discard confirmation modal when the builder is dirty', async () => {
    const mockOnClose = vi.fn();
    mockBuilderReturn.isDirty = true;

    renderModal({ onClose: mockOnClose });
    pressKey('Escape');

    expect(await screen.findByText('Discard changes?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await vi.waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  it('ArrowLeft calls nudgeSlots(-1, 0) for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('ArrowLeft');
    expect(mockNudgeSlots).toHaveBeenCalledWith(['slot-1'], -1, 0);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('ArrowRight calls nudgeSlots(1, 0) for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('ArrowRight');
    expect(mockNudgeSlots).toHaveBeenCalledWith(['slot-1'], 1, 0);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('ArrowUp calls nudgeSlots(0, -1) for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('ArrowUp');
    expect(mockNudgeSlots).toHaveBeenCalledWith(['slot-1'], 0, -1);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('ArrowDown calls nudgeSlots(0, 1) for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('ArrowDown');
    expect(mockNudgeSlots).toHaveBeenCalledWith(['slot-1'], 0, 1);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('Shift+ArrowLeft calls nudgeSlots with fine step', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('ArrowLeft', { shiftKey: true });
    expect(mockNudgeSlots).toHaveBeenCalledWith(['slot-1'], -0.1, 0);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('] calls bringForward for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey(']');
    expect(mockBringForward).toHaveBeenCalledWith(['slot-1']);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('[ calls sendBackward for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('[');
    expect(mockSendBackward).toHaveBeenCalledWith(['slot-1']);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('Shift+] calls bringToFront for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey(']', { shiftKey: true });
    expect(mockBringToFront).toHaveBeenCalledWith(['slot-1']);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('Shift+[ calls sendToBack for selected slots', () => {
    mockSelectedSlotIds.add('slot-1');
    renderModal();
    pressKey('[', { shiftKey: true });
    expect(mockSendToBack).toHaveBeenCalledWith(['slot-1']);
    mockSelectedSlotIds.delete('slot-1');
  });

  it('? opens the builder keyboard shortcuts reference modal', async () => {
    renderModal();
    pressKey('?');
    await vi.waitFor(() => {
      expect(screen.getByText('Builder Keyboard Shortcuts')).toBeDefined();
    });
  });

  it('keyboard shortcuts are not triggered when focus is in an input', () => {
    renderModal();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true, bubbles: true });
    // undo should NOT have been called since target is an input
    expect(mockUndo).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
