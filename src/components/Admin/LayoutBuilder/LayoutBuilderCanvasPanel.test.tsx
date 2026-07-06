/**
 * P62-A gating tests for LayoutBuilderCanvasPanel.
 *
 * Scope: the per-breakpoint responsive edit-mode gate only. The heavy canvas
 * (react-zoom-pan-pinch, LayoutCanvas) and the builder context are mocked so
 * the test isolates the breakpoint SegmentedControl.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

const showProUpsell = vi.fn();
vi.mock('@/utils/wpsgUpsell', () => ({
  showProUpsell: (...args: unknown[]) => showProUpsell(...args),
}));

// Passthrough the pan/zoom wrappers and stub the canvas so the panel renders
// its toolbars (which include the breakpoint selector) in jsdom.
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('./LayoutCanvas', () => ({ LayoutCanvas: () => null }));
vi.mock('@wp-super-gallery/shared-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@wp-super-gallery/shared-ui')>()),
  useRootId: () => 'test-root',
}));

const setActiveBreakpoint = vi.fn();

function makeBuilder() {
  const noop = vi.fn();
  return {
    activeBreakpoint: 'desktop' as const,
    isPreview: false,
    selectedSlotIds: [],
    template: { slots: [], overlays: [], texts: [], groups: [], guides: [], breakpointOverrides: {} },
    setActiveBreakpoint,
    addOverlay: noop, addSlot: noop, addSlotsToSelection: noop, assignMediaToSlot: noop,
    clearSelection: noop, moveOverlay: noop, moveSlot: noop, moveText: noop,
    resizeOverlay: noop, resizeSlot: noop, resizeText: noop, selectSlot: noop,
    selectSlotsInRange: noop, setTemplate: noop, toggleSlotSelection: noop,
    updateSlot: noop, updateSlots: noop, updateText: noop,
  };
}

vi.mock('./BuilderDockContext', () => ({
  useBuilderDock: () => ({
    builder: makeBuilder(),
    media: [],
    snapMode: 'off', setSnapMode: vi.fn(),
    snapThreshold: 8, setSnapThreshold: vi.fn(),
    showGrid: false, setShowGrid: vi.fn(),
    gridSizePx: 16, setGridSizePx: vi.fn(),
    showRulers: false, setShowRulers: vi.fn(),
    showMeasurements: false, setShowMeasurements: vi.fn(),
    setSelectedOverlayId: vi.fn(), setIsBackgroundSelected: vi.fn(),
    setSelectedTextId: vi.fn(), selectedTextId: null,
    selectedMaskSlotId: null, setSelectedGuideId: vi.fn(), selectedGuideId: null,
    announce: vi.fn(),
    handleDeleteSelected: vi.fn(), handleDuplicateSelected: vi.fn(),
    handleCreateGroup: vi.fn(), handleUngroupSelected: vi.fn(),
    handleGroupLockToggle: vi.fn(), handleGroupVisibilityToggle: vi.fn(),
    handleGroupRename: vi.fn(),
    handleBringForwardSelected: vi.fn(), handleSendBackwardSelected: vi.fn(),
    guides: [], addGuide: vi.fn(), moveGuide: vi.fn(), removeGuide: vi.fn(), toggleGuideLock: vi.fn(),
  }),
}));

import { LayoutBuilderCanvasPanel } from './LayoutBuilderCanvasPanel';

const panelProps = {} as never;

function breakpointInput(container: HTMLElement, value: string): HTMLInputElement {
  const selector = container.querySelector('[data-testid="breakpoint-edit-selector"]');
  return selector!.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
}

describe('LayoutBuilderCanvasPanel — per-breakpoint pro gate', () => {
  beforeEach(() => {
    setActiveBreakpoint.mockClear();
    showProUpsell.mockClear();
  });
  afterEach(() => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
  });

  it('unlicensed: selecting tablet upsells and does not switch breakpoint', () => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
    const { container } = render(<LayoutBuilderCanvasPanel {...panelProps} />);

    fireEvent.click(breakpointInput(container, 'tablet'));

    expect(showProUpsell).toHaveBeenCalledTimes(1);
    expect(showProUpsell).toHaveBeenCalledWith('upsell_breakpoints', expect.any(String), expect.any(String));
    expect(setActiveBreakpoint).not.toHaveBeenCalled();
  });

  it('unlicensed: selecting mobile also upsells (only desktop is free)', () => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
    const { container } = render(<LayoutBuilderCanvasPanel {...panelProps} />);

    fireEvent.click(breakpointInput(container, 'mobile'));

    expect(showProUpsell).toHaveBeenCalledTimes(1);
    expect(setActiveBreakpoint).not.toHaveBeenCalled();
  });

  it('licensed: selecting tablet switches breakpoint and does not upsell', () => {
    window.__WPSG_CONFIG__ = { license: { isPro: true, tier: null, upgradeUrl: '' } };
    const { container } = render(<LayoutBuilderCanvasPanel {...panelProps} />);

    fireEvent.click(breakpointInput(container, 'tablet'));

    expect(setActiveBreakpoint).toHaveBeenCalledWith('tablet');
    expect(showProUpsell).not.toHaveBeenCalled();
  });
});
