import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AdminCampaignRestoreModal } from './AdminCampaignRestoreModal';

describe('AdminCampaignRestoreModal', () => {
    it('renders restore confirmation content when opened', () => {
        const { container } = render(
            <AdminCampaignRestoreModal
                opened={true}
                campaign={{ id: '2', title: 'Winter Promo' }}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );

        const title = screen.getByText('Restore campaign');
        expect(container).toContainElement(title);
    });

    it('renders with null campaign without crashing', () => {
        expect(() =>
            render(
                <AdminCampaignRestoreModal
                    opened={true}
                    campaign={null}
                    onClose={vi.fn()}
                    onConfirm={vi.fn()}
                />,
            ),
        ).not.toThrow();
    });
});
