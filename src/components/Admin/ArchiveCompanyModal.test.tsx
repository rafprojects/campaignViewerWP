import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { ArchiveCompanyModal } from './ArchiveCompanyModal';

const mockCompany = {
    id: 1,
    name: 'Acme Corp',
    activeCampaigns: 2,
    campaigns: [
        { id: 1, title: 'Campaign A', status: 'active' },
        { id: 2, title: 'Campaign B', status: 'active' },
        { id: 3, title: 'Campaign C', status: 'archived' },
    ],
};

describe('ArchiveCompanyModal', () => {
    it('renders company name in the confirmation when opened', () => {
        const { container } = render(
            <ArchiveCompanyModal
                opened={true}
                company={mockCompany}
                archiveRevokeAccess={false}
                onArchiveRevokeAccessChange={vi.fn()}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                accessSaving={false}
            />,
        );

        const title = screen.getByText('Archive all company campaigns');
        expect(container).toContainElement(title);
    });

    it('renders with null company without crashing', () => {
        expect(() =>
            render(
                <ArchiveCompanyModal
                    opened={true}
                    company={null}
                    archiveRevokeAccess={false}
                    onArchiveRevokeAccessChange={vi.fn()}
                    onClose={vi.fn()}
                    onConfirm={vi.fn()}
                    accessSaving={false}
                />,
            ),
        ).not.toThrow();
    });
});
