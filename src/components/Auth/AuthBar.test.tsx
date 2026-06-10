import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { AuthBar } from './AuthBar';
import type { PageSpace } from '@/hooks/usePageSpaces';

type Win = typeof window & {
    __WPSG_PAGE_SPACES__?: PageSpace[];
    [key: string]: unknown;
};

const SPACE_A: PageSpace = { instanceId: 'space-a', id: 1, slug: 'hero', name: 'Hero Gallery' };
const SPACE_B: PageSpace = { instanceId: 'space-b', id: 2, slug: 'products', name: 'Products' };

function setSpaces(...spaces: PageSpace[]) {
    (window as Win).__WPSG_PAGE_SPACES__ = spaces;
}
function setOpener(instanceId: string, fn: (...args: unknown[]) => void) {
    (window as Win)[`__wpsgOpen_${instanceId}`] = fn;
}

afterEach(() => {
    delete (window as Win).__WPSG_PAGE_SPACES__;
    delete (window as Win).__wpsgOpen_space_b;
    delete (window as Win)['__wpsgOpen_space-b'];
});

const baseProps = {
    email: 'user@example.com',
    isAdmin: false,
    onOpenAdminPanel: vi.fn(),
    onOpenSettings: vi.fn(),
    onLogout: vi.fn(),
};

describe('AuthBar', () => {
    it('renders in floating mode without crashing', () => {
        const { container } = render(
            <AuthBar {...baseProps} displayMode="floating" isAuthenticated={true} />,
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('renders in minimal mode without crashing', () => {
        const { container } = render(
            <AuthBar {...baseProps} displayMode="minimal" isAuthenticated={true} />,
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('renders in bar mode without crashing', () => {
        const { container } = render(
            <AuthBar {...baseProps} displayMode="bar" isAuthenticated={true} />,
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('renders sign-in state when unauthenticated', () => {
        render(
            <AuthBar
                {...baseProps}
                isAuthenticated={false}
                displayMode="minimal"
                onOpenSignIn={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
    });
});

// ── Bar mode (AuthBarFull) — cross-space opener routing ───────────────────────
//
// This is the critical invariant: when the user switches the target space via
// SpaceSwitcher, Admin Panel and Settings must call the OTHER space's
// window.__wpsgOpen_<id> opener, NOT the local prop handlers.

describe('AuthBar bar mode — SpaceSwitcher visibility', () => {
    it('renders SpaceSwitcher for an admin user when instanceId is provided', () => {
        setSpaces(SPACE_A, SPACE_B);
        render(
            <AuthBar
                {...baseProps}
                displayMode="bar"
                isAuthenticated={true}
                isAdmin={true}
                instanceId="space-a"
            />,
        );
        expect(screen.getByLabelText('Switch targeted gallery space')).toBeTruthy();
    });

    it('does NOT render SpaceSwitcher when instanceId is omitted', () => {
        setSpaces(SPACE_A, SPACE_B);
        render(
            <AuthBar
                {...baseProps}
                displayMode="bar"
                isAuthenticated={true}
                isAdmin={true}
            />,
        );
        expect(screen.queryByLabelText('Switch targeted gallery space')).toBeNull();
    });

    it('does NOT render SpaceSwitcher for non-admin users', () => {
        setSpaces(SPACE_A, SPACE_B);
        render(
            <AuthBar
                {...baseProps}
                displayMode="bar"
                isAuthenticated={true}
                isAdmin={false}
                instanceId="space-a"
            />,
        );
        expect(screen.queryByLabelText('Switch targeted gallery space')).toBeNull();
    });
});

describe('AuthBar bar mode — cross-space opener routing', () => {
    const adminProps = {
        email: 'admin@example.com',
        isAdmin: true,
        isAuthenticated: true as const,
        displayMode: 'bar' as const,
        instanceId: 'space-a',
        onLogout: vi.fn(),
    };

    it('calls onOpenAdminPanel directly when own space is still active', () => {
        setSpaces(SPACE_A);
        const onOpenAdminPanel = vi.fn();
        render(
            <AuthBar {...adminProps} onOpenAdminPanel={onOpenAdminPanel} onOpenSettings={vi.fn()} />,
        );
        fireEvent.click(screen.getByRole('button', { name: /admin panel/i }));
        expect(onOpenAdminPanel).toHaveBeenCalledOnce();
    });

    it('calls onOpenSettings directly when own space is still active', () => {
        setSpaces(SPACE_A);
        const onOpenSettings = vi.fn();
        render(
            <AuthBar {...adminProps} onOpenAdminPanel={vi.fn()} onOpenSettings={onOpenSettings} />,
        );
        fireEvent.click(screen.getByRole('button', { name: /settings/i }));
        expect(onOpenSettings).toHaveBeenCalledOnce();
    });

    it('calls the target space opener for Admin Panel after switching — NOT the local handler', () => {
        setSpaces(SPACE_A, SPACE_B);
        const otherOpener = vi.fn();
        setOpener('space-b', otherOpener);
        const onOpenAdminPanel = vi.fn();

        render(
            <AuthBar {...adminProps} onOpenAdminPanel={onOpenAdminPanel} onOpenSettings={vi.fn()} />,
        );

        // Switch the target space to Products (space-b)
        fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
        fireEvent.click(screen.getByText('Products'));

        // Admin Panel must now delegate to the other space's opener
        fireEvent.click(screen.getByRole('button', { name: /admin panel/i }));

        expect(otherOpener).toHaveBeenCalledOnce();
        expect(otherOpener).toHaveBeenCalledWith('admin');
        expect(onOpenAdminPanel).not.toHaveBeenCalled();
    });

    it('calls the target space opener for Settings after switching — NOT the local handler', () => {
        setSpaces(SPACE_A, SPACE_B);
        const otherOpener = vi.fn();
        setOpener('space-b', otherOpener);
        const onOpenSettings = vi.fn();

        render(
            <AuthBar {...adminProps} onOpenAdminPanel={vi.fn()} onOpenSettings={onOpenSettings} />,
        );

        // Switch the target space to Products (space-b)
        fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
        fireEvent.click(screen.getByText('Products'));

        // Settings must now delegate to the other space's opener
        fireEvent.click(screen.getByRole('button', { name: /settings/i }));

        expect(otherOpener).toHaveBeenCalledOnce();
        expect(otherOpener).toHaveBeenCalledWith('settings');
        expect(onOpenSettings).not.toHaveBeenCalled();
    });

    it('gracefully no-ops if the other space opener is not yet registered', () => {
        setSpaces(SPACE_A, SPACE_B);
        // Deliberately do NOT register an opener for space-b.
        const onOpenAdminPanel = vi.fn();

        render(
            <AuthBar {...adminProps} onOpenAdminPanel={onOpenAdminPanel} onOpenSettings={vi.fn()} />,
        );

        fireEvent.click(screen.getByLabelText('Switch targeted gallery space'));
        fireEvent.click(screen.getByText('Products'));
        // Should not throw; the missing opener is a no-op.
        expect(() => fireEvent.click(screen.getByRole('button', { name: /admin panel/i }))).not.toThrow();
        expect(onOpenAdminPanel).not.toHaveBeenCalled();
    });
});
