import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { GlobalAuditTab } from './GlobalAuditTab';
import type { AuditEntry } from '@/services/adminQuery';

const baseEntry: AuditEntry = {
  id: 'e1',
  action: 'media.created',
  actorLogin: 'admin',
  userId: 1,
  campaignId: '42',
  details: { file: 'photo.jpg' },
  createdAt: '2026-03-15T10:00:00.000Z',
};

const baseProps = {
  entries: [],
  loading: false,
  filters: {},
  onFiltersChange: vi.fn(),
  onExportCsv: vi.fn(),
};

describe('GlobalAuditTab', () => {
  it('renders without crashing', () => {
    const { container } = render(<GlobalAuditTab {...baseProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('shows heading and filter inputs', () => {
    render(<GlobalAuditTab {...baseProps} />);
    expect(screen.getByText('System Audit')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /campaign id/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /from date/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /to date/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /action filter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export.*csv/i })).toBeInTheDocument();
  });

  it('shows help text explaining scope', () => {
    render(<GlobalAuditTab {...baseProps} />);
    expect(screen.getByText(/Cross-campaign and plugin-wide admin events/)).toBeInTheDocument();
  });

  it('shows empty state message when entries is empty', () => {
    render(<GlobalAuditTab {...baseProps} />);
    expect(screen.getByText('No audit entries found.')).toBeInTheDocument();
  });

  it('shows loading skeleton table when loading', () => {
    render(<GlobalAuditTab {...baseProps} loading={true} />);
    expect(screen.getByRole('table', { name: /loading system audit/i })).toBeInTheDocument();
  });

  it('renders audit entries table when entries are provided', () => {
    render(<GlobalAuditTab {...baseProps} entries={[baseEntry]} />);
    expect(screen.getByText('media.created')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders "—" for entry with no details', () => {
    const entry = { ...baseEntry, details: {}, actorLogin: '' };
    render(<GlobalAuditTab {...baseProps} entries={[entry]} />);
    // No details and no actorLogin → dash for user, dash for details
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders JSON details when present', () => {
    render(<GlobalAuditTab {...baseProps} entries={[baseEntry]} />);
    expect(screen.getByText(/"file":"photo\.jpg"/)).toBeInTheDocument();
  });

  it('calls onFiltersChange when campaignId input changes', () => {
    const onFiltersChange = vi.fn();
    render(<GlobalAuditTab {...baseProps} onFiltersChange={onFiltersChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: /campaign id/i }), {
      target: { value: '5' },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ campaignId: '5' }));
  });

  it('calls onFiltersChange when from date input changes', () => {
    const onFiltersChange = vi.fn();
    render(<GlobalAuditTab {...baseProps} onFiltersChange={onFiltersChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: /from date/i }), {
      target: { value: '2026-01-01' },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-01-01' }));
  });

  it('calls onFiltersChange when to date input changes', () => {
    const onFiltersChange = vi.fn();
    render(<GlobalAuditTab {...baseProps} onFiltersChange={onFiltersChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: /to date/i }), {
      target: { value: '2026-01-31' },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ to: '2026-01-31' }));
  });

  it('calls onFiltersChange when action filter input changes', () => {
    const onFiltersChange = vi.fn();
    render(<GlobalAuditTab {...baseProps} onFiltersChange={onFiltersChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: /action filter/i }), {
      target: { value: 'media' },
    });
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ action: 'media' }));
  });

  it('removes filter key when value is cleared', () => {
    const onFiltersChange = vi.fn();
    render(
      <GlobalAuditTab
        {...baseProps}
        filters={{ from: '2026-01-01' }}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /from date/i }), {
      target: { value: '' },
    });
    const result = onFiltersChange.mock.calls[0][0];
    expect(result).not.toHaveProperty('from');
  });

  it('calls onExportCsv when Export CSV is clicked', () => {
    const onExportCsv = vi.fn();
    render(<GlobalAuditTab {...baseProps} onExportCsv={onExportCsv} />);
    fireEvent.click(screen.getByRole('button', { name: /export.*csv/i }));
    expect(onExportCsv).toHaveBeenCalledTimes(1);
  });

  it('renders multiple entries', () => {
    const second: AuditEntry = { ...baseEntry, id: 'e2', action: 'access.granted', campaignId: '7' };
    render(<GlobalAuditTab {...baseProps} entries={[baseEntry, second]} />);
    expect(screen.getByText('media.created')).toBeInTheDocument();
    expect(screen.getByText('access.granted')).toBeInTheDocument();
  });

  it('uses summary as primary row text when present', () => {
    const entry: AuditEntry = { ...baseEntry, summary: 'Photo uploaded' };
    render(<GlobalAuditTab {...baseProps} entries={[entry]} />);
    expect(screen.getByText('Photo uploaded')).toBeInTheDocument();
  });

  it('falls back to action key when summary is absent', () => {
    render(<GlobalAuditTab {...baseProps} entries={[baseEntry]} />);
    expect(screen.getByText('media.created')).toBeInTheDocument();
  });

  it('shows severity badge when entry has severity', () => {
    const entry: AuditEntry = { ...baseEntry, severity: 'warning' };
    render(<GlobalAuditTab {...baseProps} entries={[entry]} />);
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('shows resource label in row when present', () => {
    const entry: AuditEntry = { ...baseEntry, resourceLabel: 'photo.jpg' };
    render(<GlobalAuditTab {...baseProps} entries={[entry]} />);
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });

  it('shows pre-filled filter values from props', () => {
    render(
      <GlobalAuditTab
        {...baseProps}
        filters={{ campaignId: '3', from: '2026-02-01', to: '2026-02-28', action: 'media.added' }}
      />,
    );
    expect(screen.getByRole('textbox', { name: /campaign id/i })).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: /from date/i })).toHaveValue('2026-02-01');
    expect(screen.getByRole('textbox', { name: /to date/i })).toHaveValue('2026-02-28');
    expect(screen.getByRole('textbox', { name: /action filter/i })).toHaveValue('media.added');
  });
});
