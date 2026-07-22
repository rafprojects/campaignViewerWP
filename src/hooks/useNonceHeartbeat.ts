import { useEffect, useRef } from 'react';
import { fetchFreshNonce, getWpNonce, setWpNonce } from '@/services/wpNonce';

/**
 * Periodically refresh the WP REST nonce to prevent 403 errors in
 * long-running browser tabs.
 *
 * WordPress nonces expire after 24 hours (two 12-hour ticks). This hook
 * calls a lightweight endpoint every `intervalMs` (default: 20 minutes)
 * to obtain a fresh nonce and updates `window.__WPSG_CONFIG__.restNonce`
 * so subsequent API calls use the refreshed value.
 *
 * The nonce read (`getWpNonce`), fetch (`fetchFreshNonce`) and store
 * (`setWpNonce`) all go through the shared `wpNonce.ts` helpers (P70-C) — this
 * hook no longer touches the nonce globals directly. Only the JWT gate and the
 * API base URL are read from `window.__WPSG_CONFIG__` here (non-nonce config).
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

    if (!getWpNonce()) {
      return;
    }

    const apiBase =
      window.__WPSG_CONFIG__?.apiBase ??
      window.__WPSG_API_BASE__ ??
      window.location.origin;

    const refresh = async () => {
      const nonce = await fetchFreshNonce(apiBase);
      if (nonce) {
        setWpNonce(nonce);
      }
    };

    // Refresh immediately on mount, then periodically.
    void refresh();
    timerRef.current = setInterval(() => void refresh(), intervalMs);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [intervalMs]);
}
