import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { CampaignContextProvider } from '@/contexts/CampaignContext';
import { AuthBarFloating } from './AuthBarFloating';

describe('AuthBarFloating portal safety', () => {
    it('keeps the floating admin menu inside the active render tree', async () => {
        const { container } = render(
            <CampaignContextProvider>
                <AuthBarFloating
                    email="admin@example.com"
                    isAdmin
                    isAuthenticated
                    onOpenAdminPanel={vi.fn()}
                    onOpenSettings={vi.fn()}
                    onLogout={vi.fn()}
                />
            </CampaignContextProvider>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Admin menu' }));

        // With withinPortal={false}, the popover dropdown renders inside our
        // component tree rather than being portaled to document.body.
        const content = within(container).getByText('Signed in as admin@example.com');
        expect(container).toContainElement(content);
    });
});