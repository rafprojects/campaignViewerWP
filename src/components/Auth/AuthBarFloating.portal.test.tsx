import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@/test/test-utils';
import { CampaignContextProvider } from '@/contexts/CampaignContext';

const { popoverPropsSpy } = vi.hoisted(() => ({
    popoverPropsSpy: vi.fn(),
}));

vi.mock('@mantine/core', async () => {
    const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');

    const Popover = Object.assign(
        ({ children, withinPortal }: { children: ReactNode; withinPortal?: boolean }) => {
            popoverPropsSpy({ withinPortal });
            return <div data-testid="authbar-popover-root">{children}</div>;
        },
        {
            Target: ({ children }: { children: ReactNode }) => <div data-testid="authbar-popover-target">{children}</div>,
            Dropdown: ({ children }: { children: ReactNode }) => <div data-testid="authbar-popover-dropdown">{children}</div>,
        },
    );

    return {
        ...actual,
        Popover,
    };
});

import { AuthBarFloating } from './AuthBarFloating';

describe('AuthBarFloating portal safety', () => {
    beforeEach(() => {
        popoverPropsSpy.mockReset();
    });

    it('keeps the floating admin menu inside the active render tree', () => {
        render(
            <CampaignContextProvider>
                <AuthBarFloating
                    email="admin@example.com"
                    isAdmin
                    onOpenAdminPanel={vi.fn()}
                    onOpenSettings={vi.fn()}
                    onLogout={vi.fn()}
                />
            </CampaignContextProvider>,
        );

        expect(popoverPropsSpy).toHaveBeenCalledWith(expect.objectContaining({ withinPortal: false }));
        expect(screen.getByRole('button', { name: 'Admin menu' })).toBeInTheDocument();
    });
});