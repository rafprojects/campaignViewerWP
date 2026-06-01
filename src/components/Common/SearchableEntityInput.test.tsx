import { describe, it, expect, vi } from 'vitest';
import { Combobox } from '@mantine/core';
import { render, screen, fireEvent, act } from '@/test/test-utils';
import { SearchableEntityInput } from './SearchableEntityInput';

function SimpleInput({
  onInputChange = vi.fn(),
  onOptionSubmit = vi.fn(),
  onBlur,
  onClear,
  hasSelection = false,
  loading = false,
  displayValue = '',
}: Partial<{
  onInputChange: (v: string) => void;
  onOptionSubmit: (v: string) => void;
  onBlur: () => void;
  onClear: () => void;
  hasSelection: boolean;
  loading: boolean;
  displayValue: string;
}>) {
  return (
    <SearchableEntityInput
      displayValue={displayValue}
      onInputChange={onInputChange}
      onOptionSubmit={onOptionSubmit}
      onBlur={onBlur}
      onClear={onClear}
      hasSelection={hasSelection}
      loading={loading}
      placeholder="Search..."
      label="Entity"
    >
      <Combobox.Option value="opt-a">Option A</Combobox.Option>
      <Combobox.Option value="opt-b">Option B</Combobox.Option>
      {!hasSelection && <Combobox.Option value="create">+ Create new</Combobox.Option>}
    </SearchableEntityInput>
  );
}

describe('SearchableEntityInput', () => {
  describe('display resolution', () => {
    it('renders the displayValue in the input', () => {
      render(<SimpleInput displayValue="Acme Corp" />);
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument();
    });

    it('renders empty string when displayValue is empty', () => {
      render(<SimpleInput displayValue="" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });
  });

  describe('search/filter behavior', () => {
    it('calls onInputChange when typing', () => {
      const onInputChange = vi.fn();
      render(<SimpleInput onInputChange={onInputChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
      expect(onInputChange).toHaveBeenCalledWith('abc');
    });

    it('calls onInputChange for each keystroke', () => {
      const onInputChange = vi.fn();
      render(<SimpleInput onInputChange={onInputChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ab' } });
      expect(onInputChange).toHaveBeenCalledTimes(2);
      expect(onInputChange).toHaveBeenLastCalledWith('ab');
    });

    it('opens the dropdown on focus', async () => {
      render(<SimpleInput />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(await screen.findByRole('option', { name: 'Option A' })).toBeInTheDocument();
    });
  });

  describe('freeform create affordance', () => {
    it('renders a consumer-provided create option', async () => {
      render(<SimpleInput />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(await screen.findByRole('option', { name: '+ Create new' })).toBeInTheDocument();
    });

    it('calls onOptionSubmit with the create option value when clicked', async () => {
      const onOptionSubmit = vi.fn();
      render(<SimpleInput onOptionSubmit={onOptionSubmit} />);
      fireEvent.focus(screen.getByRole('textbox'));
      const createOption = await screen.findByRole('option', { name: '+ Create new' });
      fireEvent.click(createOption);
      expect(onOptionSubmit).toHaveBeenCalledWith('create');
    });

    it('calls onOptionSubmit with the correct value for a regular option', async () => {
      const onOptionSubmit = vi.fn();
      render(<SimpleInput onOptionSubmit={onOptionSubmit} />);
      fireEvent.focus(screen.getByRole('textbox'));
      const optA = await screen.findByRole('option', { name: 'Option A' });
      fireEvent.click(optA);
      expect(onOptionSubmit).toHaveBeenCalledWith('opt-a');
    });
  });

  describe('focus/blur lifecycle', () => {
    it('calls onBlur after blur when no option was selected', async () => {
      const onBlur = vi.fn();
      render(<SimpleInput onBlur={onBlur} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);
      await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('does not call onBlur after an option is selected', async () => {
      const onBlur = vi.fn();
      render(<SimpleInput onBlur={onBlur} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      const optA = await screen.findByRole('option', { name: 'Option A' });
      fireEvent.click(optA);
      fireEvent.blur(input);
      await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
      expect(onBlur).not.toHaveBeenCalled();
    });

    it('shows a clear button when hasSelection is true', () => {
      render(<SimpleInput hasSelection onClear={vi.fn()} />);
      expect(screen.getByRole('button', { name: /clear selection/i })).toBeInTheDocument();
    });

    it('calls onClear when the clear button is clicked', () => {
      const onClear = vi.fn();
      render(<SimpleInput hasSelection onClear={onClear} />);
      fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('shows search icon when not loading and no selection', () => {
      render(<SimpleInput />);
      // IconSearch is rendered via tabler — verify the clear button is absent
      expect(screen.queryByRole('button', { name: /clear selection/i })).not.toBeInTheDocument();
    });
  });
});
