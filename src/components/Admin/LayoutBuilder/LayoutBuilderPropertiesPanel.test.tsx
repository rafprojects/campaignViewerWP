/**
 * P62-A gating test for LayoutBuilderPropertiesPanel — text-layer editor.
 *
 * Regression guard: in the premium build the text properties editor must be
 * gated on the runtime `isPro` license, not only the `__WPSG_PREMIUM__` build
 * flag. An unlicensed premium user editing an existing text layer would have
 * their edits silently discarded by the server-side freeze
 * (WPSG_Layout_Templates::enforce_license_gates) on save — so we show the
 * upsell instead of a live editor.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

// Stub the heavyweight editor (and its TypographyEditor tree) with a marker.
vi.mock('./TextPropertiesPanel', () => ({
  TextPropertiesPanel: () => <div data-testid="text-props-editor" />,
}));

// Isolate the panel from the sibling property editors (not exercised here).
vi.mock('./SlotPropertiesPanel', () => ({ SlotPropertiesPanel: () => null }));
vi.mock('./GraphicLayerPropertiesPanel', () => ({ GraphicLayerPropertiesPanel: () => null }));
vi.mock('./MaskPropertiesPanel', () => ({ MaskPropertiesPanel: () => null }));
vi.mock('./BackgroundPropertiesPanel', () => ({ BackgroundPropertiesPanel: () => null }));

const selectedText = { id: 'txt-1', semanticTag: 'p', content: 'Hi', typography: {} };

vi.mock('./BuilderDockContext', () => ({
  useBuilderDock: () => ({
    builder: {
      isPreview: false,
      template: { texts: [selectedText] },
      updateText: vi.fn(), renameText: vi.fn(), removeText: vi.fn(),
      bringToFront: vi.fn(), sendToBack: vi.fn(), bringForward: vi.fn(), sendBackward: vi.fn(),
    },
    selectedSlot: null,
    selectedOverlay: null,
    selectedOverlayIndex: -1,
    setSelectedOverlayId: vi.fn(),
    selectedText,
    setSelectedTextId: vi.fn(),
    selectedMaskSlotId: null,
    handleUploadMask: vi.fn(),
    assetLibrary: [],
    isBackgroundSelected: false,
    listingMode: false,
  }),
}));

// Imported after mocks are registered.
import { LayoutBuilderPropertiesPanel } from './LayoutBuilderPropertiesPanel';

const panelProps = {} as never;

describe('LayoutBuilderPropertiesPanel — text-layer pro gate', () => {
  afterEach(() => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
  });

  it('licensed: renders the text properties editor', async () => {
    window.__WPSG_CONFIG__ = { license: { isPro: true, tier: null, upgradeUrl: '' } };
    render(<LayoutBuilderPropertiesPanel {...panelProps} />);

    expect(await screen.findByTestId('text-props-editor')).toBeInTheDocument();
  });

  it('unlicensed: shows the upsell instead of the editor (no silent edit-loss)', () => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
    render(<LayoutBuilderPropertiesPanel {...panelProps} />);

    expect(screen.queryByTestId('text-props-editor')).not.toBeInTheDocument();
    expect(screen.getByText(/Pro feature/i)).toBeInTheDocument();
  });
});
