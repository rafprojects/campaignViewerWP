/**
 * Tests for SlotPropertiesPanel — the right-hand properties inspector in the
 * layout builder that controls position, size, shape, focal point, border and
 * z-index stacking for the selected slot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { SlotPropertiesPanel } from './SlotPropertiesPanel';
import type { LayoutSlot } from '@/types';

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeSlot(overrides: Partial<LayoutSlot> = {}): LayoutSlot {
  return {
    id: 's1',
    x: 10,
    y: 20,
    width: 30,
    height: 25,
    zIndex: 2,
    shape: 'rectangle',
    borderRadius: 4,
    borderWidth: 0,
    borderColor: '#ffffff',
    objectFit: 'cover',
    objectPosition: '50% 50%',
    clickAction: 'lightbox',
    hoverEffect: 'pop',
    ...overrides,
  };
}

function renderPanel(overrides: Partial<LayoutSlot> = {}, callbacks: Record<string, unknown> = {}) {
  const onUpdate = vi.fn();
  render(
    <SlotPropertiesPanel
      slot={makeSlot(overrides)}
      onUpdate={onUpdate}
      onBringToFront={vi.fn()}
      onSendToBack={vi.fn()}
      onBringForward={vi.fn()}
      onSendBackward={vi.fn()}
      {...callbacks}
    />,
  );
  return { onUpdate };
}

// ── Structure ─────────────────────────────────────────────────────────────────

describe('SlotPropertiesPanel — structure', () => {
  it('renders position section with X % and Y % labels', () => {
    renderPanel();
    // Position section uses PropRow — labels rendered as Text, not HTML labels.
    // NumberInputs don't have explicit aria-labels, so we check for the text.
    expect(screen.getByText('X %')).toBeInTheDocument();
    expect(screen.getByText('Y %')).toBeInTheDocument();
  });

  it('renders Width % and Height % inputs with aria-labels', () => {
    renderPanel();
    expect(screen.getByLabelText('Width %')).toBeInTheDocument();
    expect(screen.getByLabelText('Height %')).toBeInTheDocument();
  });

  it('renders lock aspect ratio button', () => {
    renderPanel();
    expect(screen.getByLabelText('Lock aspect ratio')).toBeInTheDocument();
  });

  it('renders Shape section with Preset selector', () => {
    renderPanel();
    expect(screen.getByText('Shape')).toBeInTheDocument();
    expect(screen.getByText('Preset')).toBeInTheDocument();
  });

  it('renders Border Radius row for rectangle shape', () => {
    renderPanel({ shape: 'rectangle' });
    expect(screen.getByText('Radius')).toBeInTheDocument();
  });

  it('does not render Border Radius row for non-rectangle shape', () => {
    renderPanel({ shape: 'circle' });
    expect(screen.queryByText('Radius')).toBeNull();
  });

  it('renders Clip-path input for custom shape', () => {
    renderPanel({ shape: 'custom' });
    expect(screen.getByPlaceholderText('polygon(50% 0%, 100% 50%, …)')).toBeInTheDocument();
  });

  it('renders border width and color rows', () => {
    renderPanel();
    expect(screen.getByText('Border')).toBeInTheDocument();
    expect(screen.getByText('Width')).toBeInTheDocument();
    // "Color" appears both as a PropRow label and inside Mantine's ColorInput
    expect(screen.getAllByText('Color').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Stacking section with Z-Index row', () => {
    renderPanel();
    expect(screen.getByText('Stacking')).toBeInTheDocument();
    expect(screen.getByText('Z-Index')).toBeInTheDocument();
  });

  it('renders layer order action buttons', () => {
    renderPanel();
    expect(screen.getByLabelText('Send to back')).toBeInTheDocument();
    expect(screen.getByLabelText('Send backward')).toBeInTheDocument();
    expect(screen.getByLabelText('Bring forward')).toBeInTheDocument();
    expect(screen.getByLabelText('Bring to front')).toBeInTheDocument();
  });

  it('renders click action segmented control with Lightbox option', () => {
    renderPanel();
    expect(screen.getByText('Lightbox')).toBeInTheDocument();
  });

  it('renders hover effect control with Pop/Glow/None options', () => {
    renderPanel();
    expect(screen.getByText('Pop')).toBeInTheDocument();
    expect(screen.getByText('Glow')).toBeInTheDocument();
    // Both click-action and hover-effect have a "None" option — two total
    const noneEls = screen.getAllByText('None');
    expect(noneEls.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Focal point grid ──────────────────────────────────────────────────────────

describe('SlotPropertiesPanel — focal point grid', () => {
  it('renders exactly 9 focal preset buttons', () => {
    renderPanel();
    const buttons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-pressed') !== null,
    );
    expect(buttons).toHaveLength(9);
  });

  it('active preset button has aria-pressed="true"', () => {
    renderPanel({ objectPosition: '50% 50%' });
    const centerBtn = screen.getByTitle('Center');
    expect(centerBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('inactive preset buttons have aria-pressed="false"', () => {
    renderPanel({ objectPosition: '50% 50%' });
    const topLeftBtn = screen.getByTitle('Top left');
    expect(topLeftBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onUpdate with correct objectPosition on preset click', () => {
    const { onUpdate } = renderPanel({ objectPosition: '50% 50%' });
    fireEvent.click(screen.getByTitle('Top left'));
    expect(onUpdate).toHaveBeenCalledWith({ objectPosition: '0% 0%' });
  });

  it('calls onUpdate with bottom-right position when that preset clicked', () => {
    const { onUpdate } = renderPanel({ objectPosition: '50% 50%' });
    fireEvent.click(screen.getByTitle('Bottom right'));
    expect(onUpdate).toHaveBeenCalledWith({ objectPosition: '100% 100%' });
  });

  it('each preset button has an aria-label matching its position name', () => {
    renderPanel();
    const labels = [
      'Top left', 'Top center', 'Top right',
      'Left center', 'Center', 'Right center',
      'Bottom left', 'Bottom center', 'Bottom right',
    ];
    for (const label of labels) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

// ── Z-index layer actions ────────────────────────────────────────────────────

describe('SlotPropertiesPanel — layer order callbacks', () => {
  it('calls onBringToFront when "Bring to front" button clicked', () => {
    const onBringToFront = vi.fn();
    renderPanel({}, { onBringToFront });
    fireEvent.click(screen.getByLabelText('Bring to front'));
    expect(onBringToFront).toHaveBeenCalledOnce();
  });

  it('calls onSendToBack when "Send to back" button clicked', () => {
    const onSendToBack = vi.fn();
    renderPanel({}, { onSendToBack });
    fireEvent.click(screen.getByLabelText('Send to back'));
    expect(onSendToBack).toHaveBeenCalledOnce();
  });

  it('calls onBringForward when "Bring forward" button clicked', () => {
    const onBringForward = vi.fn();
    renderPanel({}, { onBringForward });
    fireEvent.click(screen.getByLabelText('Bring forward'));
    expect(onBringForward).toHaveBeenCalledOnce();
  });

  it('calls onSendBackward when "Send backward" button clicked', () => {
    const onSendBackward = vi.fn();
    renderPanel({}, { onSendBackward });
    fireEvent.click(screen.getByLabelText('Send backward'));
    expect(onSendBackward).toHaveBeenCalledOnce();
  });
});

// ── Shape selector ────────────────────────────────────────────────────────────

describe('SlotPropertiesPanel — shape selector', () => {
  it('shows current shape value in the Select input', async () => {
    renderPanel({ shape: 'circle' });
    // The Mantine Select displays the selected value as visible text.
    expect(screen.getByText(/Circle/i)).toBeInTheDocument();
  });

  it('calls onUpdate with new shape when selection changes', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderPanel({ shape: 'rectangle' });

    // Open the shape select dropdown — find the displayed value and click
    const displayed = screen.getByText(/Rectangle/i);
    await user.click(displayed);

    // Click the Diamond option
    const option = await screen.findByText(/Diamond/i);
    await user.click(option);

    expect(onUpdate).toHaveBeenCalledWith({ shape: 'diamond' });
  });
});

// ── Lock ratio ────────────────────────────────────────────────────────────────

describe('SlotPropertiesPanel — lock size ratio', () => {
  it('lock ratio button shows Lock aspect ratio by default', () => {
    renderPanel();
    expect(screen.getByLabelText('Lock aspect ratio')).toBeInTheDocument();
  });

  it('calls onUpdate with lockAspectRatio: true when lock button clicked', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderPanel();
    const btn = screen.getByLabelText('Lock aspect ratio');
    await user.click(btn);
    expect(onUpdate).toHaveBeenCalledWith({ lockAspectRatio: true });
  });
});
