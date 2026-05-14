import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@/test/test-utils';

const { modalPropsSpy } = vi.hoisted(() => ({
    modalPropsSpy: vi.fn(),
}));

vi.mock('@mantine/core', async () => {
    const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');

    return {
        ...actual,
        Modal: ({ children, withinPortal, opened }: { children: ReactNode; withinPortal?: boolean; opened: boolean }) => {
            modalPropsSpy({ withinPortal });
            return opened ? <div data-testid="confirm-modal-root">{children}</div> : null;
        },
    };
});

import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
    beforeEach(() => {
        modalPropsSpy.mockReset();
    });

    it('keeps confirmation dialogs inside the active render tree', () => {
        render(
            <ConfirmModal
                opened={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                title="Discard changes?"
                message="Unsaved changes will be lost."
                confirmLabel="Discard"
            />,
        );

        expect(modalPropsSpy).toHaveBeenCalledWith(expect.objectContaining({ withinPortal: false }));
        expect(screen.getByText('Unsaved changes will be lost.')).toBeInTheDocument();
    });
});