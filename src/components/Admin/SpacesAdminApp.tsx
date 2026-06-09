import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';

import { ApiClient } from '@/services/apiClient';
import { createAppQueryClient } from '@/services/queryClient';
import { SpaceManagementView } from '@/components/Admin/SpaceManagementView';

function notify(message: { type: 'error' | 'success'; text: string }) {
  notifications.show({
    color: message.type === 'error' ? 'red' : 'green',
    message: message.text,
  });
}

/**
 * Standalone mount for the WP-admin "Gallery Spaces" page (#wpsg-spaces-admin).
 *
 * Renders only the space-management UI — not the public gallery App — wrapped in
 * the minimal provider tree it needs. Auth is cookie + REST nonce (read from
 * window.__WPSG_CONFIG__ by the HTTP transport), so no JWT flow is required for a
 * logged-in admin. Mounts in light DOM (no shadow root) to live inside wp-admin.
 */
export function mountSpacesAdmin(host: HTMLElement): void {
  if (host.hasAttribute('data-wpsg-mounted')) return;
  host.setAttribute('data-wpsg-mounted', 'true');

  const apiBaseUrl = window.__WPSG_API_BASE__ ?? window.location.origin;
  const apiClient = new ApiClient({ baseUrl: apiBaseUrl });
  const queryClient = createAppQueryClient();

  createRoot(host).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <ModalsProvider>
            <SpaceManagementView
              apiClient={apiClient}
              onNotify={notify}
              onSpacesChanged={() => { /* standalone page: useSpaces refetches itself */ }}
            />
          </ModalsProvider>
        </MantineProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
