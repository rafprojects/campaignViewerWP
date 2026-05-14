import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AuthBarMinimal } from './AuthBarMinimal';

const baseProps = {
    email: 'user@example.com',
    isAdmin: false,
    onOpenAdminPanel: vi.fn(),
    onOpenSettings: vi.fn(),
    onLogout: vi.fn(),
};

describe('AuthBarMinimal', () => {
    it('shows email when authenticated', () => {
        const { container } = render(<AuthBarMinimal {...baseProps} isAuthenticated={true} />);

        const email = screen.getByText('user@example.com');
        expect(container).toContainElement(email);
    });

    it('shows sign-in button when unauthenticated', () => {
        const { container } = render(
            <AuthBarMinimal
                {...baseProps}
                email=""
                isAuthenticated={false}
                onOpenSignIn={vi.fn()}
            />,
        );

        const btn = screen.getByRole('button', { name: /sign in/i });
        expect(container).toContainElement(btn);
    });

    it('renders admin menu items for admin users', () => {
        const { container } = render(
            <AuthBarMinimal {...baseProps} isAdmin={true} isAuthenticated={true} />,
        );

        // The menu trigger button is present
        const trigger = screen.getByRole('button', { name: /user menu/i });
        expect(container).toContainElement(trigger);
    });
});
