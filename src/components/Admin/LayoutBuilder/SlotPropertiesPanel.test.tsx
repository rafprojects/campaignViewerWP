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
  it('renders X % and Y % inputs', () => {
    renderPanel();
    expect(screen.getByLabelText('X %')).toBeInTheDocument();
    expect(screen.getByLabelText('Y %')).toBeInTheDocument();
  });

  it('renders Width % and Height % inputs', () => {
    renderPanel();
    expect(screen.getByLabelText('Width %')).toBeInTheDocument();
    expect(screen.getByLabelText('Height %')).toBeInTheDocument();
  });

  it('populates X input with slot.x value', () => {
    renderPanel({ x: 15 });
    const input = screen.getByLabelText('X %') as HTMLInputElement;
    expect(input.value).toBe('15');
  });

  it('populates Y input with slot.y value', () => {
    renderPanel({ y: 33 });
    const input = screen.getByLabelText('Y %') as HTMLInputElement;
    expect(input.value).toBe('33');
  });

  it('renders lock ratio switch', () => {
    renderPanel();
    expect(screen.getByLabelText('Lock width/height ratio')).toBeInTheDocument();
  });

  it('renders Shape selector', () => {
    renderPanel();
    // The Divider also renders "Shape" text, so use getAllByLabelText
    const shapeInputs = screen.getAllByLabelText('Shape');
    expect(shapeInputs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Border radius input for rectangle shape', () => {
    renderPanel({ shape: 'rectangle' });
    expect(screen.getByLabelText('Border radius (px)')).toBeInTheDocument();
  });

  it('does not render Border radius input for non-rectangle shape', () => {
    renderPanel({ shape: 'circle' });
    expect(screen.queryByLabelText('Border radius (px)')).toBeNull();
  });

  it('renders CSS clip-path input for custom shape', () => {
    renderPanel({ shape: 'custom' });
    expect(screen.getByLabelText('CSS clip-path')).toBeInTheDocument();
  });

  it('renders border width and color inputs', () => {
    renderPanel();
    expect(screen.getByLabelText('Width (px)')).toBeInTheDocument();
    expect(screen.getByLabelText('Color')).toBeInTheDocument();
  });

  it('renders Z-Index input', () => {
    renderPanel();
    expect(screen.getByLabelText('Z-Index')).toBeInTheDocument();
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
    // The Mantine Select displays the current value as an input value.
    // Multiple inputs share 'Shape' label due to the Divider, so use getAllByLabelText.
    const shapeInputs = screen.getAllByLabelText('Shape') as HTMLInputElement[];
    const hasCircle = shapeInputs.some((el) => el.value?.includes('Circle'));
    expect(hasCircle).toBe(true);
  });

  it('calls onUpdate with new shape when selection changes', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderPanel({ shape: 'rectangle' });

    // Open the shape select dropdown (use getAllByLabelText to avoid ambiguity)
    const shapeInputs = screen.getAllByLabelText('Shape');
    const selectInput = shapeInputs[0];
    await user.click(selectInput);

    // Click the Diamond option
    const option = await screen.findByText(/Diamond/i);
    await user.click(option);

    expect(onUpdate).toHaveBeenCalledWith({ shape: 'diamond' });
  });
});

// ── Lock ratio ────────────────────────────────────────────────────────────────

describe('SlotPropertiesPanel — lock size ratio', () => {
  it('lock ratio switch is unchecked by default', () => {
    renderPanel();
    const toggle = screen.getByLabelText('Lock width/height ratio') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it('can toggle lock ratio switch on', async () => {
    const user = userEvent.setup();
    renderPanel();
    const toggle = screen.getByLabelText('Lock width/height ratio');
    await user.click(toggle);
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });
});
