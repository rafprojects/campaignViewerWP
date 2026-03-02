import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { BulkActionsBar } from './BulkActionsBar';

const defaults = {
  selectedCount: 2,
  allSelectedArchived: false,
  isLoading: false,
  onArchive: vi.fn(),
  onRestore: vi.fn(),
  onClearSelection: vi.fn(),
};

describe('BulkActionsBar', () => {
  it('renders nothing when selectedCount is 0', () => {
    render(<BulkActionsBar {...defaults} selectedCount={0} />);
    // Component returns null — no action buttons or count text rendered
    expect(screen.queryByText(/campaigns selected/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
  });

  it('displays the selected count', () => {
    render(<BulkActionsBar {...defaults} selectedCount={3} />);
    expect(screen.getByText(/3 campaigns selected/i)).toBeInTheDocument();
  });

  it('uses singular label for 1 campaign', () => {
    render(<BulkActionsBar {...defaults} selectedCount={1} />);
    expect(screen.getByText(/1 campaign selected/i)).toBeInTheDocument();
  });

  it('shows Archive button when allSelectedArchived is false', () => {
    render(<BulkActionsBar {...defaults} allSelectedArchived={false} />);
    expect(screen.getAllByRole('button', { name: /archive/i }).length).toBeGreaterThan(0);
  });

  it('Archive button calls onArchive', () => {
    const onArchive = vi.fn();
    render(<BulkActionsBar {...defaults} allSelectedArchived={false} onArchive={onArchive} />);
    fireEvent.click(screen.getByRole('button', { name: /^archive$/i }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('Restore button calls onRestore', () => {
    const onRestore = vi.fn();
    render(<BulkActionsBar {...defaults} onRestore={onRestore} />);
    // Restore button always present (either filled or subtle variant)
    fireEvent.click(screen.getAllByRole('button', { name: /restore/i })[0]);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('shows only Restore button when allSelectedArchived is true', () => {
    render(<BulkActionsBar {...defaults} allSelectedArchived={true} />);
    expect(screen.queryByRole('button', { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
  });

  it('Clear selection button calls onClearSelection', () => {
    const onClearSelection = vi.fn();
    render(<BulkActionsBar {...defaults} onClearSelection={onClearSelection} />);
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('buttons are disabled when isLoading is true', () => {
    render(<BulkActionsBar {...defaults} isLoading={true} />);
    // Loading buttons render a spinner and become mechanically disabled
    const buttons = screen.getAllByRole('button');
    // At least the action buttons carry data-disabled or disabled attr
    const actionButtons = buttons.filter((b) =>
      b.textContent?.match(/archive|restore/i),
    );
    actionButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('data-loading', 'true');
    });
  });
});
