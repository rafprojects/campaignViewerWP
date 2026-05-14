import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';

function NotificationsHarness() {
    return (
        <MantineProvider>
            <Notifications withinPortal={false} transitionDuration={0} />
        </MantineProvider>
    );
}

describe('Notifications mount behavior', () => {
    beforeEach(() => {
        notifications.clean();
        vi.useFakeTimers();
    });

    afterEach(() => {
        act(() => {
            notifications.clean();
            vi.runOnlyPendingTimers();
        });
        vi.useRealTimers();
        cleanup();
    });

    it('renders and auto-closes notifications in the default DOM tree', async () => {
        const view = render(<NotificationsHarness />);

        await act(async () => {
            notifications.show({ message: 'DOM notification', autoClose: 100 });
            await vi.advanceTimersByTimeAsync(1);
        });

        expect(view.queryByText('DOM notification')).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });

        expect(view.queryByText('DOM notification')).not.toBeInTheDocument();
    });

    it('renders and auto-closes notifications inside a shadow-root mount', async () => {
        const host = document.createElement('div');
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const mountPoint = document.createElement('div');
        shadowRoot.appendChild(mountPoint);
        document.body.appendChild(host);

        const view = render(<NotificationsHarness />, { container: mountPoint });

        await act(async () => {
            notifications.show({ message: 'Shadow notification', autoClose: 100 });
            await vi.advanceTimersByTimeAsync(1);
        });

        expect(view.queryByText('Shadow notification')).toBeInTheDocument();
        expect(shadowRoot.textContent).toContain('Shadow notification');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });

        expect(view.queryByText('Shadow notification')).not.toBeInTheDocument();

        view.unmount();
        host.remove();
    });
});