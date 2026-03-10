import { useEffect, useRef } from 'react';

/**
 * Periodically refresh the WP REST nonce to prevent 403 errors in
 * long-running browser tabs.
 *
 * WordPress nonces expire after 24 hours (two 12-hour ticks). This hook
 * calls a lightweight endpoint every `intervalMs` (default: 20 minutes)
 * to obtain a fresh nonce and updates `window.__WPSG_CONFIG__.restNonce`
 * so subsequent API calls use the refreshed value.
 *
 * Only active when JWT auth is **not** enabled (nonce-only path).
 *
 * @since 0.18.0 P20-K
 */
export function useNonceHeartbeat(intervalMs = 20 * 60 * 1000): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Skip heartbeat when JWT auth is active (tokens manage their own expiry).
    const enableJwt = window.__WPSG_CONFIG__?.enableJwt === true;
    if (enableJwt) {
      return;
    }

    const nonce = window.__WPSG_CONFIG__?.restNonce ?? window.__WPSG_REST_NONCE__;
    if (!nonce) {
      return;
    }

    const apiBase =
      window.__WPSG_CONFIG__?.apiBase ??
      window.__WPSG_API_BASE__ ??
      window.location.origin;

    const refresh = async () => {
      try {
        const currentNonce =
          window.__WPSG_CONFIG__?.restNonce ?? window.__WPSG_REST_NONCE__;

        const response = await fetch(
          `${apiBase}/wp-json/wp-super-gallery/v1/nonce`,
          {
            credentials: 'same-origin',
            headers: currentNonce ? { 'X-WP-Nonce': currentNonce } : {},
          },
        );

        if (!response.ok) {
          return;
        }

        const data: { nonce?: string } = await response.json();
        if (data.nonce) {
          // Update the global config so all future apiClient calls use the
          // refreshed nonce.
          if (window.__WPSG_CONFIG__) {
            window.__WPSG_CONFIG__.restNonce = data.nonce;
          }
          // Also update the legacy global for backward compatibility.
          (window as Window & { __WPSG_REST_NONCE__?: string }).__WPSG_REST_NONCE__ =
            data.nonce;
        }
      } catch {
        // Network errors are non-fatal — we'll retry at the next interval.
      }
    };

    // Run the first refresh after one interval (not immediately).
    timerRef.current = setInterval(() => void refresh(), intervalMs);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [intervalMs]);
}
