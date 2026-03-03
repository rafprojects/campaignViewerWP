/**
 * Tests for P19-B: Builder Undo/Redo Improvements
 *
 * Tests the HistoryEntry tracking added to useLayoutBuilderState and the
 * BuilderHistoryPanel component.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { useLayoutBuilderState, createEmptyTemplate } from '@/hooks/useLayoutBuilderState';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('dockview', () => ({
  DockviewReact: () => <div data-testid="dockview-mock" />,
}));

vi.mock('@/utils/debug', () => ({
  debugGroup: vi.fn(),
  debugLog: vi.fn(),
  debugGroupEnd: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

// ── useLayoutBuilderState — history entry tracking ───────────────────────────

describe('useLayoutBuilderState — history entries (P19-B)', () => {
  it('starts with no history entries', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    expect(result.current.historyEntries).toHaveLength(0);
    expect(result.current.historyCurrentIndex).toBe(-1);
  });

  it('addSlot creates a history entry with label "Add slot"', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.addSlot(); });
    expect(result.current.historyEntries).toHaveLength(1);
    expect(result.current.historyEntries[0].label).toBe('Add slot');
    expect(result.current.historyEntries[0].id).toBeTruthy();
    expect(result.current.historyEntries[0].timestamp).toBeGreaterThan(0);
    expect(result.current.historyCurrentIndex).toBe(0);
  });

  it('removeSlots creates a history entry with label "Remove slot"', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let slotId: string;
    act(() => { slotId = result.current.addSlot(); });
    act(() => { result.current.removeSlots([slotId!]); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Remove slot');
  });

  it('removeSlots (multiple) uses plural "Remove slots"', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id1: string, id2: string;
    act(() => { id1 = result.current.addSlot(); });
    act(() => { id2 = result.current.addSlot(); });
    act(() => { result.current.removeSlots([id1!, id2!]); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Remove slots');
  });

  it('nudgeSlots creates "Nudge slot" entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let slotId: string;
    act(() => { slotId = result.current.addSlot(); });
    act(() => { result.current.nudgeSlots([slotId!], 1, 0); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Nudge slot');
  });

  it('setName creates "Rename template" entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.setName('My Layout'); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Rename template');
  });

  it('multiple mutations create multiple history entries in order', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.addSlot(); });
    act(() => { result.current.setName('New Name'); });
    expect(result.current.historyEntries).toHaveLength(2);
    expect(result.current.historyEntries[0].label).toBe('Add slot');
    expect(result.current.historyEntries[1].label).toBe('Rename template');
  });

  it('undo decrements historyCurrentIndex', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.addSlot(); });
    expect(result.current.historyCurrentIndex).toBe(0);
    act(() => { result.current.undo(); });
    expect(result.current.historyCurrentIndex).toBe(-1);
  });

  it('setTemplate clears history entries', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.addSlot(); });
    expect(result.current.historyEntries).toHaveLength(1);
    act(() => { result.current.setTemplate(createEmptyTemplate()); });
    expect(result.current.historyEntries).toHaveLength(0);
    expect(result.current.historyCurrentIndex).toBe(-1);
  });

  it('assignMediaToSlot creates "Assign media" entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let slotId: string;
    act(() => { slotId = result.current.addSlot(); });
    act(() => { result.current.assignMediaToSlot(slotId!, 'media-1'); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Assign media');
  });

  it('toggleSlotVisible creates "Toggle slot visibility" entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let slotId: string;
    act(() => { slotId = result.current.addSlot(); });
    act(() => { result.current.toggleSlotVisible(slotId!); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Toggle slot visibility');
  });

  it('toggleSlotLocked creates "Toggle slot lock" entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let slotId: string;
    act(() => { slotId = result.current.addSlot(); });
    act(() => { result.current.toggleSlotLocked(slotId!); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Toggle slot lock');
  });

  it('bringForward creates "Bring forward" entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let slotId: string;
    act(() => { slotId = result.current.addSlot(); });
    act(() => { result.current.bringForward([slotId!]); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Bring forward');
  });

  it('sendBackward creates "Send backward" entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let slotId: string;
    act(() => { slotId = result.current.addSlot(); });
    act(() => { result.current.sendBackward([slotId!]); });
    expect(result.current.historyEntries.at(-1)?.label).toBe('Send backward');
  });

  it('history is trimmed to MAX_HISTORY=50 entries', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    // Push 55 mutations
    for (let i = 0; i < 55; i++) {
      act(() => { result.current.setName(`Name ${i}`); });
    }
    expect(result.current.historyEntries.length).toBeLessThanOrEqual(50);
  });

  it('each history entry has a unique id', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.addSlot(); });
    act(() => { result.current.setName('A'); });
    act(() => { result.current.setName('B'); });
    const ids = result.current.historyEntries.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ── BuilderHistoryPanel ──────────────────────────────────────────────────────

const {
  mockBuilderHistoryReturn,
} = vi.hoisted(() => {
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();
  const mockJumpToHistoryIndex = vi.fn();
  const mockBuilderHistoryReturn = {
    historyEntries: [] as Array<{ id: string; label: string; timestamp: number }>,
    historyCurrentIndex: -1,
    undo: mockUndo,
    redo: mockRedo,
    jumpToHistoryIndex: mockJumpToHistoryIndex,
    canUndo: false,
    canRedo: false,
    isHistoryTrimmed: false,
    template: { id: 1, name: 'Test', slots: [], overlays: [], canvasAspectRatio: 1.78 },
    selectedSlotIds: new Set<string>(),
    isDirty: false,
    isPreview: false,
    setTemplate: vi.fn(),
    setName: vi.fn(),
    setAspectRatio: vi.fn(),
    setBackgroundColor: vi.fn(),
    addSlot: vi.fn(),
    removeSlots: vi.fn(),
    duplicateSlots: vi.fn(),
    moveSlot: vi.fn(),
    resizeSlot: vi.fn(),
    updateSlot: vi.fn(),
    nudgeSlots: vi.fn(),
    assignMediaToSlot: vi.fn(),
    clearSlotMedia: vi.fn(),
    autoAssignMedia: vi.fn(),
    bringToFront: vi.fn(),
    sendToBack: vi.fn(),
    bringForward: vi.fn(),
    sendBackward: vi.fn(),
    normalizeZIndices: vi.fn(),
    addOverlay: vi.fn(),
    removeOverlay: vi.fn(),
    updateOverlay: vi.fn(),
    moveOverlay: vi.fn(),
    resizeOverlay: vi.fn(),
    renameSlot: vi.fn(),
    renameOverlay: vi.fn(),
    toggleSlotVisible: vi.fn(),
    toggleOverlayVisible: vi.fn(),
    toggleSlotLocked: vi.fn(),
    toggleOverlayLocked: vi.fn(),
    reorderLayers: vi.fn(),
    setBackgroundImage: vi.fn(),
    setBackgroundImageFit: vi.fn(),
    setBackgroundImageOpacity: vi.fn(),
    selectSlot: vi.fn(),
    toggleSlotSelection: vi.fn(),
    clearSelection: vi.fn(),
    togglePreview: vi.fn(),
    markSaved: vi.fn(),
  };
  return { mockBuilderHistoryReturn };
});

vi.mock('./BuilderDockContext', () => ({
  useBuilderDock: () => ({
    builder: mockBuilderHistoryReturn,
    media: [],
    campaigns: [],
    selectedCampaignId: null,
    setSelectedCampaignId: vi.fn(),
    overlayLibrary: [],
    isUploadingOverlay: false,
    isUploadingBg: false,
    selectedSlot: undefined,
    selectedOverlayId: null,
    setSelectedOverlayId: vi.fn(),
    selectedOverlay: undefined,
    selectedOverlayIndex: -1,
    isBackgroundSelected: false,
    setIsBackgroundSelected: vi.fn(),
    snapEnabled: true,
    setSnapEnabled: vi.fn(),
    snapThreshold: 5,
    setSnapThreshold: vi.fn(),
    designAssetsOpen: true,
    setDesignAssetsOpen: vi.fn(),
    bgSectionRef: { current: null },
    dockApiRef: { current: null },
    announce: vi.fn(),
    handleSave: vi.fn(),
    handleClose: vi.fn(),
    handleAutoAssign: vi.fn(),
    handleUploadOverlay: vi.fn(),
    handleAddUrlToLibrary: vi.fn(),
    handleDeleteLibraryOverlay: vi.fn(),
    handleUploadBgImage: vi.fn(),
    handleDeleteSelected: vi.fn(),
    handleDuplicateSelected: vi.fn(),
    isSaving: false,
  }),
}));

import { BuilderHistoryPanel } from './BuilderHistoryPanel';

function renderPanel() {
  return render(
    <BuilderHistoryPanel
      api={null as never}
      containerApi={null as never}
      params={{}}
    />,
    { wrapper },
  );
}

describe('BuilderHistoryPanel (P19-B)', () => {
  it('shows empty state when no history entries', () => {
    mockBuilderHistoryReturn.historyEntries = [];
    renderPanel();
    expect(screen.getByText(/No history yet/i)).toBeDefined();
  });

  it('renders history entries', () => {
    mockBuilderHistoryReturn.historyEntries = [
      { id: 'h1', label: 'Add slot', timestamp: Date.now() },
      { id: 'h2', label: 'Rename template', timestamp: Date.now() },
    ];
    mockBuilderHistoryReturn.historyCurrentIndex = 1;
    renderPanel();
    expect(screen.getByText('Add slot')).toBeDefined();
    expect(screen.getByText('Rename template')).toBeDefined();
  });

  it('shows the history count', () => {
    mockBuilderHistoryReturn.historyEntries = [
      { id: 'h1', label: 'Add slot', timestamp: Date.now() },
    ];
    mockBuilderHistoryReturn.historyCurrentIndex = 0;
    renderPanel();
    expect(screen.getByText(/History \(1\)/i)).toBeDefined();
  });

  it('shows "Initial state" sentinel at bottom', () => {
    mockBuilderHistoryReturn.historyEntries = [
      { id: 'h1', label: 'Add slot', timestamp: Date.now() },
    ];
    mockBuilderHistoryReturn.historyCurrentIndex = 0;
    renderPanel();
    expect(screen.getByText('Initial state')).toBeDefined();
  });

  it('calls undo when undo button clicked', () => {
    mockBuilderHistoryReturn.canUndo = true;
    mockBuilderHistoryReturn.historyEntries = [
      { id: 'h1', label: 'Add slot', timestamp: Date.now() },
    ];
    mockBuilderHistoryReturn.historyCurrentIndex = 0;
    const undoSpy = vi.spyOn(mockBuilderHistoryReturn, 'undo');
    renderPanel();
    const undoBtn = screen.getByLabelText('Undo');
    fireEvent.click(undoBtn);
    expect(undoSpy).toHaveBeenCalled();
  });

  it('calls redo when redo button clicked', () => {
    mockBuilderHistoryReturn.canRedo = true;
    mockBuilderHistoryReturn.historyEntries = [
      { id: 'h1', label: 'Add slot', timestamp: Date.now() },
    ];
    mockBuilderHistoryReturn.historyCurrentIndex = -1;
    const redoSpy = vi.spyOn(mockBuilderHistoryReturn, 'redo');
    renderPanel();
    const redoBtn = screen.getByLabelText('Redo');
    fireEvent.click(redoBtn);
    expect(redoSpy).toHaveBeenCalled();
  });

  it('clicking a history entry calls jumpToHistoryIndex to jump to that state', () => {
    mockBuilderHistoryReturn.historyEntries = [
      { id: 'h1', label: 'Add slot', timestamp: Date.now() },
      { id: 'h2', label: 'Rename template', timestamp: Date.now() },
    ];
    mockBuilderHistoryReturn.historyCurrentIndex = 1;
    mockBuilderHistoryReturn.canUndo = true;
    const jumpSpy = vi.spyOn(mockBuilderHistoryReturn, 'jumpToHistoryIndex');
    renderPanel();
    // Click the initial state entry — should call jumpToHistoryIndex(-1)
    const initialEntry = screen.getByLabelText('Jump to initial state');
    fireEvent.click(initialEntry);
    expect(jumpSpy).toHaveBeenCalledWith(-1);
  });
});
