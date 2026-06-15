import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { AuthBarMinimal, type SpaceSwitcherSpace } from '@wp-super-gallery/shared-ui';

type Win = typeof window & { [key: string]: unknown };

// [P51-J] pageSpaces is now an injected prop; cross-space openers stay on window.
const SPACE_A: SpaceSwitcherSpace = { instanceId: 'space-a', name: 'Hero Gallery' };
const SPACE_B: SpaceSwitcherSpace = { instanceId: 'space-b', name: 'Products' };

function setOpener(instanceId: string, fn: (...args: unknown[]) => void) {
    (window as Win)[`__wpsgOpen_${instanceId}`] = fn;
}

afterEach(() => {
    delete (window as Win)['__wpsgOpen_space-b'];
});

const baseProps = {
    email: 'user@example.com',
    isAuthenticated: true,
    isAdmin: false,
    onOpenAdminPanel: vi.fn(),
    onOpenSettings: vi.fn(),
    onLogout: vi.fn(),
};

describe('AuthBarMinimal', () => {
    it('shows email when authenticated', () => {
        const { container } = render(<AuthBarMinimal {...baseProps} />);

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
            <AuthBarMinimal {...baseProps} isAdmin={true} />,
        );

        // The menu trigger button is present
        const trigger = screen.getByRole('button', { name: /user menu/i });
        expect(container).toContainElement(trigger);
    });
});

// ── Cross-space opener routing ────────────────────────────────────────────────
//
// The SpaceSwitcher lives inside the dropdown menu. The routing invariant is the
// same as AuthBarFull: after switching target space, Settings/Admin must call the
// OTHER space's window opener, not the local prop handlers.

describe('AuthBarMinimal — SpaceSwitcher presence', () => {
    it('shows SpaceSwitcher in the dropdown for admin + multi-space + instanceId', async () => {
        render(
            <AuthBarMinimal
                {...baseProps}
                isAdmin={true}
                instanceId="space-a"
                pageSpaces={[SPACE_A, SPACE_B]}
            />,
        );
        await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
        expect(await screen.findByLabelText('Switch targeted gallery space')).toBeTruthy();
    });

    it('does NOT show SpaceSwitcher when instanceId is not provided', async () => {
        render(<AuthBarMinimal {...baseProps} isAdmin={true} pageSpaces={[SPACE_A, SPACE_B]} />);
        await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
        expect(screen.queryByLabelText('Switch targeted gallery space')).toBeNull();
    });
});

describe('AuthBarMinimal — cross-space opener routing', () => {
    const adminProps = {
        email: 'admin@example.com',
        isAdmin: true,
        isAuthenticated: true as const,
        instanceId: 'space-a',
        pageSpaces: [SPACE_A, SPACE_B],
        onOpenAdminPanel: vi.fn(),
        onOpenSettings: vi.fn(),
        onLogout: vi.fn(),
    };

    it('calls onOpenSettings directly when own space is active', async () => {
        const onOpenSettings = vi.fn();
        render(<AuthBarMinimal {...adminProps} onOpenSettings={onOpenSettings} />);
        await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
        await userEvent.click(await screen.findByRole('menuitem', { name: /settings/i }));
        expect(onOpenSettings).toHaveBeenCalledOnce();
    });

    it('routes Settings to the target space opener after switching spaces', async () => {
        const otherOpener = vi.fn();
        setOpener('space-b', otherOpener);
        const onOpenSettings = vi.fn();

        render(<AuthBarMinimal {...adminProps} onOpenSettings={onOpenSettings} />);

        // Open menu, switch target space via SpaceSwitcher (now in a Box, not Menu.Item, so parent stays open)
        await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
        await userEvent.click(await screen.findByLabelText('Switch targeted gallery space'));
        await userEvent.click(await screen.findByRole('menuitem', { name: /products/i }));

        // Click Settings — menu should still be open after space switch
        await userEvent.click(await screen.findByRole('menuitem', { name: /settings/i }));

        expect(otherOpener).toHaveBeenCalledWith('settings');
        expect(onOpenSettings).not.toHaveBeenCalled();
    });

    it('routes Admin Panel to the target space opener after switching spaces', async () => {
        const otherOpener = vi.fn();
        setOpener('space-b', otherOpener);
        const onOpenAdminPanel = vi.fn();

        render(<AuthBarMinimal {...adminProps} onOpenAdminPanel={onOpenAdminPanel} />);

        await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
        await userEvent.click(await screen.findByLabelText('Switch targeted gallery space'));
        await userEvent.click(await screen.findByRole('menuitem', { name: /products/i }));

        await userEvent.click(await screen.findByRole('menuitem', { name: /admin panel/i }));

        expect(otherOpener).toHaveBeenCalledWith('admin');
        expect(onOpenAdminPanel).not.toHaveBeenCalled();
    });
});
