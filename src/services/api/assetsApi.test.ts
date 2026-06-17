/**
 * Unit tests for AssetsApi (P52-B global asset library).
 *
 * Exercises the domain module against a mock HttpTransport — proving the four
 * REST helpers build the right URLs/payloads (incl. the P52-A5c `force` flag and
 * id URL-encoding) without a real HTTP connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpTransport } from '../http/HttpTransport';
import { AssetsApi, ASSET_IN_USE_CODE } from './assetsApi';

const BASE = '/wp-json/wp-super-gallery/v1/admin/asset-library';

function makeMockTransport(overrides: Partial<HttpTransport> = {}): HttpTransport {
  return {
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('https://example.test'),
    getAuthHeaders: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe('AssetsApi', () => {
  let transport: HttpTransport;
  let api: AssetsApi;

  beforeEach(() => {
    transport = makeMockTransport();
    api = new AssetsApi(transport);
  });

  it('exposes the in-use sentinel code', () => {
    expect(ASSET_IN_USE_CODE).toBe('wpsg_asset_in_use');
  });

  describe('list', () => {
    it('GETs the asset-library endpoint and returns the transport result', async () => {
      const items = [{ id: 'a1', name: 'Overlay' }];
      vi.mocked(transport.get).mockResolvedValue(items);

      const result = await api.list();

      expect(transport.get).toHaveBeenCalledOnce();
      expect(transport.get).toHaveBeenCalledWith(BASE);
      expect(result).toEqual(items);
    });
  });

  describe('upload', () => {
    it('postForms a FormData containing only the file when no opts are given', async () => {
      vi.mocked(transport.postForm).mockResolvedValue({ id: 'new' });
      const file = new File(['x'], 'asset.png', { type: 'image/png' });

      await api.upload(file);

      expect(transport.postForm).toHaveBeenCalledOnce();
      const [path, fd] = vi.mocked(transport.postForm).mock.calls[0]!;
      expect(path).toBe(BASE);
      expect(fd).toBeInstanceOf(FormData);
      const body = fd as FormData;
      expect((body.get('file') as File).name).toBe('asset.png');
      expect(body.get('name')).toBeNull();
      expect(body.get('is_universal')).toBeNull();
      expect(body.get('tags')).toBeNull();
    });

    it('includes name, is_universal (as 0/1) and JSON tags when provided', async () => {
      vi.mocked(transport.postForm).mockResolvedValue({ id: 'new' });
      const file = new File(['x'], 'asset.png', { type: 'image/png' });

      await api.upload(file, { name: 'My Asset', isUniversal: true, tags: ['a', 'b'] });

      const fd = vi.mocked(transport.postForm).mock.calls[0]![1] as FormData;
      expect(fd.get('name')).toBe('My Asset');
      expect(fd.get('is_universal')).toBe('1');
      expect(fd.get('tags')).toBe(JSON.stringify(['a', 'b']));
    });

    it('serializes is_universal=false to "0" and omits an empty tags array', async () => {
      vi.mocked(transport.postForm).mockResolvedValue({ id: 'new' });
      const file = new File(['x'], 'asset.png', { type: 'image/png' });

      await api.upload(file, { isUniversal: false, tags: [] });

      const fd = vi.mocked(transport.postForm).mock.calls[0]![1] as FormData;
      expect(fd.get('is_universal')).toBe('0');
      expect(fd.get('tags')).toBeNull();
    });
  });

  describe('update', () => {
    it('POSTs the patch to the per-asset endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ id: 'a1', isUniversal: true });

      await api.update('a1', { is_universal: true, tags: ['x'] });

      expect(transport.post).toHaveBeenCalledWith(`${BASE}/a1`, { is_universal: true, tags: ['x'] });
    });

    it('URL-encodes the id', async () => {
      vi.mocked(transport.post).mockResolvedValue({ id: 'a b/c' });

      await api.update('a b/c', { is_universal: false });

      expect(transport.post).toHaveBeenCalledWith(`${BASE}/a%20b%2Fc`, { is_universal: false });
    });
  });

  describe('delete', () => {
    it('DELETEs without a force query by default', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ deleted: true });

      const result = await api.delete('a1');

      expect(transport.delete).toHaveBeenCalledWith(`${BASE}/a1`);
      expect(result).toEqual({ deleted: true });
    });

    it('appends ?force=true when forced', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ deleted: true });

      await api.delete('a1', true);

      expect(transport.delete).toHaveBeenCalledWith(`${BASE}/a1?force=true`);
    });

    it('URL-encodes the id (force path)', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ deleted: true });

      await api.delete('a b/c', true);

      expect(transport.delete).toHaveBeenCalledWith(`${BASE}/a%20b%2Fc?force=true`);
    });
  });
});
