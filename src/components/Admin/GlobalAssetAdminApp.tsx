import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';

import { ApiClient } from '@/services/apiClient';
import { getWpNonce, setWpNonce, WP_NONCE_PATH } from '@/services/wpNonce';
import { createAppQueryClient } from '@/services/queryClient';
import { GlobalAssetManager } from '@/components/Admin/GlobalAssetManager';

function notify(message: { type: 'error' | 'success'; text: string }) {
  notifications.show({
    color: message.type === 'error' ? 'red' : 'green',
    message: message.text,
  });
}

/**
 * P52-B — Standalone mount for the WP-admin "Asset Library" page
 * (#wpsg-assets-admin).
 *
 * Renders only the GlobalAssetManager — not the full gallery App — wrapped in
 * the minimal provider tree it needs. Auth is cookie + REST nonce (read from
 * window.__WPSG_CONFIG__ by the HTTP transport). Mounts in light DOM (no shadow
 * root) to live inside wp-admin.
 */
export function mountGlobalAssets(host: HTMLElement): void {
  if (host.hasAttribute('data-wpsg-mounted')) return;
  host.setAttribute('data-wpsg-mounted', 'true');

  const apiBaseUrl = window.__WPSG_API_BASE__ ?? window.location.origin;
  const apiClient = new ApiClient({
    baseUrl: apiBaseUrl,
    getNonce: getWpNonce,
    setNonce: setWpNonce,
    noncePath: WP_NONCE_PATH,
  });
  const queryClient = createAppQueryClient();

  createRoot(host).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <ModalsProvider>
            <GlobalAssetManager apiClient={apiClient} onNotify={notify} />
          </ModalsProvider>
        </MantineProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
