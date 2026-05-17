import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AuditTab } from './AuditTab';

// Define default filters to avoid undefined error
const defaultFilters = {
  from: '',
  to: '',
  action: '',
};

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
    };

    it('renders without crashing', () => {
        const { container } = render(<AuditTab {...baseProps} />);
        expect(container.firstChild).toBeTruthy();
    });

    it('shows skeleton rows while loading', () => {
        render(<AuditTab {...baseProps} auditLoading={true} />);
        // Skeleton rows render as elements in the table
        expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    });

    it('renders audit rows when not loading', () => {
        const rows = <tr><td>Audit entry</td></tr>;
        render(<AuditTab {...baseProps} auditRows={rows} auditEntriesCount={1} />);
        expect(screen.getByText('Audit entry')).toBeDefined();
    });
});
