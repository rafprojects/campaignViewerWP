/**
 * WordPress REST-nonce glue.
 *
 * The single place that reads and writes the WP-injected nonce globals
 * (`window.__WPSG_CONFIG__.restNonce` / `window.__WPSG_REST_NONCE__`). The HTTP
 * transport takes these as injected callbacks (`getNonce`/`setNonce`/`noncePath`
 * on `ApiClientOptions`) so it stays free of any direct `window.__WPSG_*`
 * coupling and can be extracted/published without dragging WordPress along.
 *
 * [P51-D] Decoupling: lifted out of `HttpTransportImpl` per spike playbook §3.
 */

/** REST route (relative to the API base URL) that mints a fresh nonce. */
export const WP_NONCE_PATH = '/wp-json/wp-super-gallery/v1/nonce';

/** Read the current WP REST nonce, or undefined when none is available. */
export function getWpNonce(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__WPSG_CONFIG__?.restNonce ?? window.__WPSG_REST_NONCE__;
}

/** Persist a refreshed nonce back to both WP global slots. */
export function setWpNonce(nonce: string): void {
  if (typeof window === 'undefined') return;
  if (window.__WPSG_CONFIG__) {
    window.__WPSG_CONFIG__.restNonce = nonce;
  }
  (window as Window & { __WPSG_REST_NONCE__?: string }).__WPSG_REST_NONCE__ = nonce;
}
