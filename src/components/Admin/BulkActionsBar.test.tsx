import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { BulkActionsBar } from './BulkActionsBar';

const defaults = {
  selectedCount: 2,
  hasActiveSelected: true,
  hasArchivedSelected: false,
  isLoading: false,
  isExporting: false,
  onArchive: vi.fn(),
  onRestore: vi.fn(),
  onExport: vi.fn(),
  onDelete: vi.fn(),
  onClearSelection: vi.fn(),
};

describe('BulkActionsBar', () => {
  it('renders nothing when selectedCount is 0', () => {
    render(<BulkActionsBar {...defaults} selectedCount={0} />);
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

  it('shows Archive when hasActiveSelected is true', () => {
    render(<BulkActionsBar {...defaults} hasActiveSelected={true} hasArchivedSelected={false} />);
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^restore$/i })).not.toBeInTheDocument();
  });

  it('shows Restore when hasArchivedSelected is true', () => {
    render(<BulkActionsBar {...defaults} hasActiveSelected={false} hasArchivedSelected={true} />);
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^archive$/i })).not.toBeInTheDocument();
  });

  it('shows both Archive and Restore for mixed selection', () => {
    render(<BulkActionsBar {...defaults} hasActiveSelected={true} hasArchivedSelected={true} />);
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
  });

  it('Archive button calls onArchive', () => {
    const onArchive = vi.fn();
    render(<BulkActionsBar {...defaults} hasActiveSelected={true} onArchive={onArchive} />);
    fireEvent.click(screen.getByRole('button', { name: /^archive$/i }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('Restore button calls onRestore', () => {
    const onRestore = vi.fn();
    render(<BulkActionsBar {...defaults} hasActiveSelected={false} hasArchivedSelected={true} onRestore={onRestore} />);
    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('Export ZIP button is always visible and calls onExport', () => {
    const onExport = vi.fn();
    render(<BulkActionsBar {...defaults} onExport={onExport} />);
    fireEvent.click(screen.getByRole('button', { name: /export zip/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('Clear selection button calls onClearSelection', () => {
    const onClearSelection = vi.fn();
    render(<BulkActionsBar {...defaults} onClearSelection={onClearSelection} />);
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('archive and restore buttons show loading state', () => {
    render(<BulkActionsBar {...defaults} hasActiveSelected={true} hasArchivedSelected={true} isLoading={true} />);
    const actionButtons = screen.getAllByRole('button');
    const archiveRestoreButtons = actionButtons.filter((b) =>
      b.textContent?.match(/^archive$|^restore$/i),
    );
    archiveRestoreButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('data-loading', 'true');
    });
  });

  it('export zip button shows loading state when isExporting', () => {
    render(<BulkActionsBar {...defaults} isExporting={true} />);
    const exportBtn = screen.getByRole('button', { name: /export zip/i });
    expect(exportBtn).toHaveAttribute('data-loading', 'true');
  });

  it('Delete button is always visible and calls onDelete', () => {
    const onDelete = vi.fn();
    render(<BulkActionsBar {...defaults} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('Delete button shows loading state when isLoading', () => {
    render(<BulkActionsBar {...defaults} isLoading={true} />);
    expect(screen.getByRole('button', { name: /^delete$/i })).toHaveAttribute('data-loading', 'true');
  });
});
