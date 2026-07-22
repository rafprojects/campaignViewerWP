/**
 * Phase 70-C: unit tests for the shared pure nonce-fetch helper.
 *
 * This is the single fetch-and-parse implementation now used by both
 * HttpTransportImpl.refreshNonce and wpNonce.fetchFreshNonce.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNonceFrom } from './fetchNonce';

const URL = 'https://example.test/wp-json/wp-super-gallery/v1/nonce';

describe('fetchNonceFrom', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the fresh nonce and sends the current nonce as an X-WP-Nonce header', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'fresh' }),
    });

    await expect(fetchNonceFrom(URL, 'current')).resolves.toBe('fresh');
    expect(globalThis.fetch).toHaveBeenCalledWith(URL, {
      credentials: 'same-origin',
      headers: { 'X-WP-Nonce': 'current' },
    });
  });

  it('omits the X-WP-Nonce header when no current nonce is given', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'fresh' }),
    });

    await fetchNonceFrom(URL);
    expect(globalThis.fetch).toHaveBeenCalledWith(URL, {
      credentials: 'same-origin',
      headers: {},
    });
  });

  it('returns null on a non-OK response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchNonceFrom(URL, 'current')).resolves.toBeNull();
  });

  it('returns null when the response body has no nonce field', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(fetchNonceFrom(URL, 'current')).resolves.toBeNull();
  });

  it('returns null on a thrown network error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    await expect(fetchNonceFrom(URL, 'current')).resolves.toBeNull();
  });
});
