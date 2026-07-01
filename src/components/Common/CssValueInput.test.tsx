import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { CssValueInput } from './CssValueInput';

const TRACKING_UNITS = ['px', 'em', 'rem'];

describe('CssValueInput', () => {
	it('renders a parsed CSS value', () => {
		render(
			<CssValueInput
				label="Font Size"
				value="28px"
				onChange={() => { }}
				allowedUnits={TRACKING_UNITS}
			/>,
		);
		expect(screen.getByLabelText('Font Size')).toHaveValue('28');
		expect(screen.getByRole('combobox', { name: 'Unit' })).toHaveValue('px');
	});

	it('renders an empty field when value is undefined', () => {
		render(
			<CssValueInput
				label="Letter Spacing"
				value={undefined}
				onChange={() => { }}
				allowedUnits={TRACKING_UNITS}
			/>,
		);
		expect(screen.getByLabelText('Letter Spacing')).toHaveValue('');
	});

	it('coerces a unit-less legacy value to the default unit', () => {
		render(
			<CssValueInput
				label="Glow Blur"
				value="10"
				onChange={() => { }}
				allowedUnits={TRACKING_UNITS}
			/>,
		);
		expect(screen.getByLabelText('Glow Blur')).toHaveValue('10');
		expect(screen.getByRole('combobox', { name: 'Unit' })).toHaveValue('px');
	});

	it('emits a complete CSS string on numeric edit', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<CssValueInput
				label="Stroke Width"
				value="1px"
				onChange={onChange}
				allowedUnits={TRACKING_UNITS}
			/>,
		);
		const input = screen.getByLabelText('Stroke Width');
		await user.clear(input);
		await user.type(input, '3');
		expect(onChange).toHaveBeenLastCalledWith('3px');
	});

	it('emits undefined when the field is cleared', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<CssValueInput
				label="Word Spacing"
				value="0.1em"
				onChange={onChange}
				allowedUnits={TRACKING_UNITS}
			/>,
		);
		const input = screen.getByLabelText('Word Spacing');
		await user.clear(input);
		expect(onChange).toHaveBeenLastCalledWith(undefined);
	});

	it('re-serializes the existing value when the unit changes', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<CssValueInput
				label="Shadow Blur"
				value="4px"
				onChange={onChange}
				allowedUnits={TRACKING_UNITS}
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
		await user.click(unitSelect);
		fireEvent.click(screen.getByRole('option', { name: 'em' }));
		expect(onChange).toHaveBeenCalledWith('4em');
	});

	it('persists the clamped value (not the pre-clamp value) when switching to a smaller-range unit', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<CssValueInput
				label="Font Size"
				value="400px"
				onChange={onChange}
				allowedUnits={TRACKING_UNITS}
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
		await user.click(unitSelect);
		// em max is 100, so 400 must clamp to 100 — and the stored string must be
		// the clamped value with the new unit, not the stale '400em'.
		fireEvent.click(screen.getByRole('option', { name: 'em' }));
		expect(onChange).toHaveBeenLastCalledWith('100em');
	});

	it('remembers a unit picked before any number is typed, without emitting a change', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<CssValueInput
				label="Offset X"
				value={undefined}
				onChange={onChange}
				allowedUnits={TRACKING_UNITS}
				allowNegative
			/>,
		);
		const unitSelect = screen.getByRole('combobox', { name: 'Unit' });
		await user.click(unitSelect);
		fireEvent.click(screen.getByRole('option', { name: 'em' }));
		// No number yet, so no override exists to emit.
		expect(onChange).not.toHaveBeenCalled();

		const input = screen.getByLabelText('Offset X');
		await user.type(input, '2');
		expect(onChange).toHaveBeenLastCalledWith('2em');
	});

	it('hides the unit selector when only one unit is allowed', () => {
		render(
			<CssValueInput
				label="Line Width"
				value="1px"
				onChange={() => { }}
				allowedUnits={['px']}
			/>,
		);
		expect(screen.queryByRole('combobox', { name: 'Unit' })).not.toBeInTheDocument();
	});
});
