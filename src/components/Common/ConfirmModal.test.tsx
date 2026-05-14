import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
    it('keeps confirmation dialogs inside the active render tree', () => {
        const { container } = render(
            <ConfirmModal
                opened={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                title="Discard changes?"
                message="Unsaved changes will be lost."
                confirmLabel="Discard"
            />,
        );

        // With withinPortal={false}, the modal content renders inside our
        // component tree rather than being portaled to document.body.
        const content = screen.getByText('Unsaved changes will be lost.');
        expect(container).toContainElement(content);
    });
});