import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DimensionInput } from './DimensionInput';
import { CSS_WIDTH_UNITS, CSS_HEIGHT_UNITS, CSS_SPACING_UNITS } from '@/utils/cssUnits';

describe('DimensionInput', () => {
  it('renders label and value', () => {
    render(
      <DimensionInput
        label="Max Width"
        value={1200}
        unit="px"
        onValueChange={() => {}}
        onUnitChange={() => {}}
        allowedUnits={CSS_WIDTH_UNITS}
      />,
    );
    expect(screen.getByLabelText('Max Width')).toHaveValue('1200');
  });

  it('renders unit dropdown when multiple units available', () => {
    render(
      <DimensionInput
        value={100}
        unit="px"
        onValueChange={() => {}}
        onUnitChange={() => {}}
        allowedUnits={CSS_WIDTH_UNITS}
      />,
    );
    // Select renders a combobox showing the current unit
    const unitSelect = screen.getByRole('textbox', { name: 'Unit' });
    expect(unitSelect).toBeInTheDocument();
    expect(unitSelect).toHaveValue('px');
  });

  it('hides unit selector when only one unit is allowed', () => {
    render(
      <DimensionInput
        value={16}
        unit="px"
        onValueChange={() => {}}
        onUnitChange={() => {}}
        allowedUnits={['px']}
      />,
    );
    // Should not render a unit Select
    expect(screen.queryByRole('textbox', { name: 'Unit' })).not.toBeInTheDocument();
  });

  it('calls onUnitChange when a different unit is selected', async () => {
    const user = userEvent.setup();
    const onUnitChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <DimensionInput
        value={50}
        unit="px"
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
        allowedUnits={CSS_SPACING_UNITS}
      />,
    );
    const unitSelect = screen.getByRole('textbox', { name: 'Unit' });
    await user.click(unitSelect);
    fireEvent.click(screen.getByRole('option', { name: 'em' }));
    expect(onUnitChange).toHaveBeenCalledWith('em');
  });

  it('clamps value when switching to a unit with lower max', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onUnitChange = vi.fn();
    render(
      <DimensionInput
        value={3000}
        unit="px"
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
        allowedUnits={CSS_WIDTH_UNITS}
        max={5000}
      />,
    );
    // Switch to vw — max is 100
    const unitSelect = screen.getByRole('textbox', { name: 'Unit' });
    await user.click(unitSelect);
    fireEvent.click(screen.getByRole('option', { name: 'vw' }));
    expect(onValueChange).toHaveBeenCalledWith(100);
    expect(onUnitChange).toHaveBeenCalledWith('vw');
  });

  it('does not clamp when value already fits new unit range', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onUnitChange = vi.fn();
    render(
      <DimensionInput
        value={50}
        unit="px"
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
        allowedUnits={CSS_WIDTH_UNITS}
      />,
    );
    const unitSelect = screen.getByRole('textbox', { name: 'Unit' });
    await user.click(unitSelect);
    fireEvent.click(screen.getByRole('option', { name: '%' }));
    // 50 fits within 0–100, so onValueChange should NOT be called
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onUnitChange).toHaveBeenCalledWith('%');
  });

  it('renders all height units in dropdown', async () => {
    const user = userEvent.setup();
    render(
      <DimensionInput
        value={80}
        unit="vh"
        onValueChange={() => {}}
        onUnitChange={() => {}}
        allowedUnits={CSS_HEIGHT_UNITS}
      />,
    );
    const unitSelect = screen.getByRole('textbox', { name: 'Unit' });
    expect(unitSelect).toHaveValue('vh');
    // Open dropdown and verify all options
    await user.click(unitSelect);
    for (const u of CSS_HEIGHT_UNITS) {
      expect(screen.getByRole('option', { name: u })).toBeInTheDocument();
    }
  });
});
