import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { BuilderColorInput } from './BuilderColorInput';

const mockAddSwatch = vi.fn();

vi.mock('./BuilderDockContext', () => ({
  useBuilderDock: () => ({
    savedSwatches: ['#ff0000', '#00ff00'],
    addSwatch: mockAddSwatch,
  }),
}));

describe('BuilderColorInput (P57-C)', () => {
  it('renders without crashing', () => {
    render(<BuilderColorInput value="#123456" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls addSwatch via onChangeEnd when a non-empty color is committed', () => {
    const onChangeEnd = vi.fn();
    render(<BuilderColorInput value="" onChange={vi.fn()} onChangeEnd={onChangeEnd} />);

    const input = screen.getByRole('textbox');
    // blur the input to trigger onChangeEnd
    fireEvent.change(input, { target: { value: '#abcdef' } });
    fireEvent.blur(input);

    expect(mockAddSwatch).toHaveBeenCalledWith('#abcdef');
  });

  it('does not call addSwatch when the committed value is empty', () => {
    mockAddSwatch.mockClear();
    render(<BuilderColorInput value="#123" onChange={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(mockAddSwatch).not.toHaveBeenCalled();
  });
});
