import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@/test/test-utils';

const { popoverPropsSpy } = vi.hoisted(() => ({
    popoverPropsSpy: vi.fn(),
}));

vi.mock('@mantine/core', async () => {
    const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');

    const Popover = Object.assign(
        ({ children, withinPortal }: { children: ReactNode; withinPortal?: boolean }) => {
            popoverPropsSpy({ withinPortal });
            return <div data-testid="popover-root">{children}</div>;
        },
        {
            Target: ({ children }: { children: ReactNode }) => <div data-testid="popover-target">{children}</div>,
            Dropdown: ({ children }: { children: ReactNode }) => <div data-testid="popover-dropdown">{children}</div>,
        },
    );

    return {
        ...actual,
        Popover,
        ScrollArea: {
            Autosize: ({ children }: { children: ReactNode }) => <div data-testid="scroll-area-autosize">{children}</div>,
        },
    };
});

import { InContextEditor } from './InContextEditor';

describe('InContextEditor', () => {
    beforeEach(() => {
        popoverPropsSpy.mockReset();
    });

    it('keeps its popover inside the active render tree', () => {
        render(
            <InContextEditor visible>
                <div>In-context controls</div>
            </InContextEditor>,
        );

        expect(popoverPropsSpy).toHaveBeenCalledWith(expect.objectContaining({ withinPortal: false }));
        expect(screen.getByText('In-context controls')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument();
    });
});