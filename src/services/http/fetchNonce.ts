/**
 * Pure "mint a fresh WP REST nonce" fetch (Phase 70-C).
 *
 * GETs the nonce endpoint at `url`, optionally presenting the current nonce as
 * an `X-WP-Nonce` header, and returns the freshly-minted nonce — or `null` on
 * any failure (non-OK response, a missing `nonce` field, or a thrown network
 * error). Callers decide whether/when to retry.
 *
 * Deliberately WordPress-agnostic: it takes the URL and current nonce as
 * arguments and touches no `window.__WPSG_*` globals. That lets the decoupled
 * HTTP transport (`HttpTransportImpl.refreshNonce`) and the WordPress nonce glue
 * (`wpNonce.fetchFreshNonce`) share one fetch implementation without the
 * transport being re-coupled to WordPress (preserving the P51-D decoupling).
 */
export async function fetchNonceFrom(url: string, currentNonce?: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: currentNonce ? { 'X-WP-Nonce': currentNonce } : {},
    });
    if (!response.ok) return null;
    const data: { nonce?: string } = await response.json();
    return data.nonce ?? null;
  } catch {
    // Network errors are non-fatal — the caller retries at its own cadence.
    return null;
  }
}
