import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AdminCampaignArchiveModal } from './AdminCampaignArchiveModal';

describe('AdminCampaignArchiveModal', () => {
    it('renders archive confirmation content when opened', () => {
        const { container } = render(
            <AdminCampaignArchiveModal
                opened={true}
                campaign={{ id: '1', title: 'Summer Sale' }}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );

        const title = screen.getByText('Archive campaign');
        expect(container).toContainElement(title);
    });

    it('renders with null campaign without crashing', () => {
        expect(() =>
            render(
                <AdminCampaignArchiveModal
                    opened={true}
                    campaign={null}
                    onClose={vi.fn()}
                    onConfirm={vi.fn()}
                />,
            ),
        ).not.toThrow();
    });
});
