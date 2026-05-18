import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { AuditTab } from './AuditTab';

const defaultFilters = {};

describe('AuditTab', () => {
    const baseProps = {
        campaignSelectData: [{ value: '1', label: 'Campaign 1' }],
        auditCampaignId: '1',
        onAuditCampaignChange: vi.fn(),
        auditLoading: false,
        auditEntriesCount: 0,
        auditRows: null,
        filters: defaultFilters,
        onFiltersChange: vi.fn(),
        onExportCsv: vi.fn(),
    };

    it('renders without crashing', () => {
        const { container } = render(<AuditTab {...baseProps} />);
        expect(container.firstChild).toBeTruthy();
    });

    it('shows skeleton rows while loading', () => {
        render(<AuditTab {...baseProps} auditLoading={true} />);
        expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    });

    it('renders audit rows when not loading', () => {
        const rows = <tr><td>Audit entry</td></tr>;
        render(<AuditTab {...baseProps} auditRows={rows} auditEntriesCount={1} />);
        expect(screen.getByText('Audit entry')).toBeDefined();
    });

    it('shows "No audit entries yet." when count is 0 and not loading', () => {
        render(<AuditTab {...baseProps} auditEntriesCount={0} auditLoading={false} />);
        expect(screen.getByText('No audit entries yet.')).toBeInTheDocument();
    });

    it('calls onFiltersChange with updated from when from input changes', () => {
        const onFiltersChange = vi.fn();
        render(<AuditTab {...baseProps} onFiltersChange={onFiltersChange} />);

        fireEvent.change(screen.getByRole('textbox', { name: /from/i }), {
            target: { value: '2026-01-01' },
        });
        expect(onFiltersChange).toHaveBeenCalledWith(
            expect.objectContaining({ from: '2026-01-01' }),
        );
    });

    it('calls onFiltersChange with updated to when to input changes', () => {
        const onFiltersChange = vi.fn();
        render(<AuditTab {...baseProps} onFiltersChange={onFiltersChange} />);

        fireEvent.change(screen.getByRole('textbox', { name: /^audit log to date$/i }), {
            target: { value: '2026-01-31' },
        });
        expect(onFiltersChange).toHaveBeenCalledWith(
            expect.objectContaining({ to: '2026-01-31' }),
        );
    });

    it('calls onFiltersChange with updated action when action input changes', () => {
        const onFiltersChange = vi.fn();
        render(<AuditTab {...baseProps} onFiltersChange={onFiltersChange} />);

        fireEvent.change(screen.getByRole('textbox', { name: /action filter/i }), {
            target: { value: 'media.added' },
        });
        expect(onFiltersChange).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'media.added' }),
        );
    });

    it('removes filter key when value is cleared', () => {
        const onFiltersChange = vi.fn();
        render(
            <AuditTab
                {...baseProps}
                filters={{ from: '2026-01-01' }}
                onFiltersChange={onFiltersChange}
            />,
        );

        fireEvent.change(screen.getByRole('textbox', { name: /from/i }), {
            target: { value: '' },
        });
        const result = onFiltersChange.mock.calls[0][0];
        expect(result).not.toHaveProperty('from');
    });

    it('calls onExportCsv when Export CSV is clicked', () => {
        const onExportCsv = vi.fn();
        render(<AuditTab {...baseProps} onExportCsv={onExportCsv} />);
        fireEvent.click(screen.getByRole('button', { name: /export audit log as csv/i }));
        expect(onExportCsv).toHaveBeenCalledTimes(1);
    });
});
