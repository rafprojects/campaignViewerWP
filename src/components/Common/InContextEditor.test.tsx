import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { InContextEditor } from './InContextEditor';

describe('InContextEditor', () => {
    it('keeps its popover inside the active render tree', async () => {
        const { container } = render(
            <InContextEditor visible>
                <div>In-context controls</div>
            </InContextEditor>,
        );

        // Open the popover by clicking the toggle button
        await userEvent.click(within(container).getByRole('button'));

        // With withinPortal={false}, the dropdown content renders inside our
        // component tree rather than being portaled to document.body.
        const content = screen.getByText('In-context controls');
        expect(container).toContainElement(content);
    });
});