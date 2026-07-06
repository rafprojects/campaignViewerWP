/**
 * P62-A gating tests for LayoutBuilderLayersPanel.
 *
 * Scope: the "Add text" pro-feature gate only. Heavy children (LayerPanel) and
 * the builder context are mocked so the test isolates the toolbar entry point.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

// Spy on the shared pro-upsell helper (no Notifications provider needed).
const showProUpsell = vi.fn();
vi.mock('@/utils/wpsgUpsell', () => ({
  showProUpsell: (...args: unknown[]) => showProUpsell(...args),
}));

// Isolate the toolbar: stub the heavy layer tree and its data builder.
vi.mock('./LayerPanel', () => ({ LayerPanel: () => null }));
vi.mock('@/utils/layerList', () => ({ buildLayerList: () => [] }));
vi.mock('@wp-super-gallery/shared-ui', () => ({ useRootId: () => 'test-root' }));

const addText = vi.fn(() => 'new-text-id');

function makeBuilder() {
  const noop = vi.fn();
  return {
    isPreview: false,
    template: { slots: [], overlays: [], texts: [], groups: [], guides: [], breakpointOverrides: {} },
    selectedSlotIds: [],
    addText,
    addSlot: noop,
    clearSelection: noop,
    bringForward: noop, bringToFront: noop, sendBackward: noop, sendToBack: noop,
    dissolveGroup: noop, removeOverlay: noop, removeSlots: noop, removeText: noop,
    renameOverlay: noop, renameSlot: noop, renameText: noop, reorderLayers: noop,
    reparentGroup: noop, selectGroup: noop, selectSlot: noop, selectSlotsInRange: noop,
    toggleOverlayLocked: noop, toggleOverlayVisible: noop, toggleSlotLocked: noop,
    toggleSlotSelection: noop, toggleSlotVisible: noop, toggleTextLocked: noop,
    toggleTextVisible: noop, updateGroup: noop, updateSlot: noop, updateSlots: noop,
  };
}

vi.mock('./BuilderDockContext', () => ({
  useBuilderDock: () => ({
    builder: makeBuilder(),
    selectedOverlayId: null, setSelectedOverlayId: vi.fn(),
    isBackgroundSelected: false, setIsBackgroundSelected: vi.fn(),
    selectedMaskSlotId: null, setSelectedMaskSlotId: vi.fn(),
    selectedTextId: null, setSelectedTextId: vi.fn(),
    setSelectedGuideId: vi.fn(),
    designAssetsOpen: false, setDesignAssetsOpen: vi.fn(),
    bgSectionRef: { current: null }, dockApiRef: { current: null },
    handleDeleteSelected: vi.fn(), handleDuplicateSelected: vi.fn(),
  }),
}));

// Imported after mocks are registered.
import { LayoutBuilderLayersPanel } from './LayoutBuilderLayersPanel';

const panelProps = {} as never;

describe('LayoutBuilderLayersPanel — text-layer pro gate', () => {
  beforeEach(() => {
    addText.mockClear();
    showProUpsell.mockClear();
  });
  afterEach(() => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
  });

  it('unlicensed: clicking "Add text" upsells and does not add a text layer', () => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
    render(<LayoutBuilderLayersPanel {...panelProps} />);

    fireEvent.click(screen.getByLabelText('Add text'));

    expect(showProUpsell).toHaveBeenCalledTimes(1);
    expect(showProUpsell).toHaveBeenCalledWith('upsell_text_layers', expect.any(String), expect.any(String));
    expect(addText).not.toHaveBeenCalled();
  });

  it('licensed: clicking "Add text" adds a text layer and does not upsell', () => {
    window.__WPSG_CONFIG__ = { license: { isPro: true, tier: null, upgradeUrl: '' } };
    render(<LayoutBuilderLayersPanel {...panelProps} />);

    fireEvent.click(screen.getByLabelText('Add text'));

    expect(addText).toHaveBeenCalledTimes(1);
    expect(showProUpsell).not.toHaveBeenCalled();
  });
});
