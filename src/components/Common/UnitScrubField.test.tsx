import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { UnitScrubField } from './UnitScrubField';
import { CSS_WIDTH_UNITS, CSS_HEIGHT_UNITS, CSS_SPACING_UNITS } from '@wp-super-gallery/shared-utils';

describe('UnitScrubField', () => {
	it('renders label and value', () => {
		render(
			<UnitScrubField
				label="Max Width"
				value={1200}
				unit="px"
				onValueChange={() => { }}
				onUnitChange={() => { }}
				allowedUnits={CSS_WIDTH_UNITS}
			/>,
		);
		expect(screen.getByLabelText('Max Width')).toHaveValue('1200');
	});

	it('renders an empty value as a blank field', () => {
		render(
			<UnitScrubField
				label="Font Size"
				value=""
				unit="px"
				onValueChange={() => { }}
				onUnitChange={() => { }}
				allowedUnits={CSS_SPACING_UNITS}
			/>,
		);
		expect(screen.getByLabelText('Font Size')).toHaveValue('');
	});

	it('renders unit dropdown when multiple units available', () => {
		render(
			<UnitScrubField
				value={100}
				unit="px"
				onValueChange={() => { }}
				onUnitChange={() => { }}
				allowedUnits={CSS_WIDTH_UNITS}
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
		expect(unitSelect).toBeInTheDocument();
		expect(unitSelect).toHaveValue('px');
	});

	it('hides unit selector when only one unit is allowed', () => {
		render(
			<UnitScrubField
				value={16}
				unit="px"
				onValueChange={() => { }}
				onUnitChange={() => { }}
				allowedUnits={['px']}
			/>,
		);
		expect(screen.queryByRole('combobox', { name: 'Unit' })).not.toBeInTheDocument();
	});

	it('calls onUnitChange when a different unit is selected', async () => {
		const user = userEvent.setup();
		const onUnitChange = vi.fn();
		const onValueChange = vi.fn();
		render(
			<UnitScrubField
				value={50}
				unit="px"
				onValueChange={onValueChange}
				onUnitChange={onUnitChange}
				allowedUnits={CSS_SPACING_UNITS}
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
		await user.click(unitSelect);
		fireEvent.click(screen.getByRole('option', { name: 'em' }));
		expect(onUnitChange).toHaveBeenCalledWith('em');
	});

	it('clamps value when switching to a unit with lower max', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onUnitChange = vi.fn();
		render(
			<UnitScrubField
				value={3000}
				unit="px"
				onValueChange={onValueChange}
				onUnitChange={onUnitChange}
				allowedUnits={CSS_WIDTH_UNITS}
				max={5000}
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
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
			<UnitScrubField
				value={50}
				unit="px"
				onValueChange={onValueChange}
				onUnitChange={onUnitChange}
				allowedUnits={CSS_WIDTH_UNITS}
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
		await user.click(unitSelect);
		fireEvent.click(screen.getByRole('option', { name: '%' }));
		expect(onValueChange).not.toHaveBeenCalled();
		expect(onUnitChange).toHaveBeenCalledWith('%');
	});

	it('does not clamp an empty value on unit switch', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onUnitChange = vi.fn();
		render(
			<UnitScrubField
				value=""
				unit="px"
				onValueChange={onValueChange}
				onUnitChange={onUnitChange}
				allowedUnits={CSS_WIDTH_UNITS}
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
		await user.click(unitSelect);
		fireEvent.click(screen.getByRole('option', { name: 'vw' }));
		expect(onValueChange).not.toHaveBeenCalled();
		expect(onUnitChange).toHaveBeenCalledWith('vw');
	});

	it('renders all height units in dropdown', async () => {
		const user = userEvent.setup();
		render(
			<UnitScrubField
				value={80}
				unit="vh"
				onValueChange={() => { }}
				onUnitChange={() => { }}
				allowedUnits={CSS_HEIGHT_UNITS}
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
		expect(unitSelect).toHaveValue('vh');
		await user.click(unitSelect);
		for (const u of CSS_HEIGHT_UNITS) {
			expect(screen.getByRole('option', { name: u })).toBeInTheDocument();
		}
	});

	describe('drag-to-scrub', () => {
		it('increases value when dragging the label right', () => {
			const onValueChange = vi.fn();
			render(
				<UnitScrubField
					label="Blur"
					value={10}
					unit="px"
					onValueChange={onValueChange}
					onUnitChange={() => { }}
					allowedUnits={['px', 'em', 'rem']}
					step={1}
				/>,
			);
			const handle = screen.getByText('Blur');
			fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, buttons: 1 });
			fireEvent.pointerMove(handle, { clientX: 125, pointerId: 1, buttons: 1 });
			expect(onValueChange).toHaveBeenCalledWith(35);
		});

		it('decreases value when dragging the label left, clamped at min', () => {
			const onValueChange = vi.fn();
			render(
				<UnitScrubField
					label="Blur"
					value={10}
					unit="px"
					onValueChange={onValueChange}
					onUnitChange={() => { }}
					allowedUnits={['px', 'em', 'rem']}
					step={1}
				/>,
			);
			const handle = screen.getByText('Blur');
			fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, buttons: 1 });
			fireEvent.pointerMove(handle, { clientX: 50, pointerId: 1, buttons: 1 });
			expect(onValueChange).toHaveBeenCalledWith(0);
		});

		it('does not update value on pointermove without an active drag', () => {
			const onValueChange = vi.fn();
			render(
				<UnitScrubField
					label="Blur"
					value={10}
					unit="px"
					onValueChange={onValueChange}
					onUnitChange={() => { }}
					allowedUnits={['px', 'em', 'rem']}
					step={1}
				/>,
			);
			const handle = screen.getByText('Blur');
			fireEvent.pointerMove(handle, { clientX: 125, pointerId: 1, buttons: 1 });
			expect(onValueChange).not.toHaveBeenCalled();
		});

		it('stops updating after pointerup', () => {
			const onValueChange = vi.fn();
			render(
				<UnitScrubField
					label="Blur"
					value={10}
					unit="px"
					onValueChange={onValueChange}
					onUnitChange={() => { }}
					allowedUnits={['px', 'em', 'rem']}
					step={1}
				/>,
			);
			const handle = screen.getByText('Blur');
			fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, buttons: 1 });
			fireEvent.pointerUp(handle, { clientX: 100, pointerId: 1 });
			onValueChange.mockClear();
			fireEvent.pointerMove(handle, { clientX: 200, pointerId: 1, buttons: 1 });
			expect(onValueChange).not.toHaveBeenCalled();
		});

		it('respects allowNegative=false by clamping scrub at 0', () => {
			const onValueChange = vi.fn();
			render(
				<UnitScrubField
					label="Stroke"
					value={2}
					unit="px"
					onValueChange={onValueChange}
					onUnitChange={() => { }}
					allowedUnits={['px', 'em', 'rem']}
					step={1}
					allowNegative={false}
				/>,
			);
			const handle = screen.getByText('Stroke');
			fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, buttons: 1 });
			fireEvent.pointerMove(handle, { clientX: -1000, pointerId: 1, buttons: 1 });
			expect(onValueChange).toHaveBeenCalledWith(0);
		});

		it('allows negative values when allowNegative=true', () => {
			const onValueChange = vi.fn();
			render(
				<UnitScrubField
					label="Offset X"
					value={0}
					unit="px"
					onValueChange={onValueChange}
					onUnitChange={() => { }}
					allowedUnits={['px', 'em', 'rem']}
					step={1}
					allowNegative
				/>,
			);
			const handle = screen.getByText('Offset X');
			fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, buttons: 1 });
			fireEvent.pointerMove(handle, { clientX: 70, pointerId: 1, buttons: 1 });
			expect(onValueChange).toHaveBeenCalledWith(-30);
		});
	});
});
