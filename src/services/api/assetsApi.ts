import type { AssetLibraryItem } from '@/components/Admin/LayoutBuilder/BuilderDockContext';
import type { HttpTransport } from '../http/HttpTransport';

export interface AssetUploadOptions {
  name?: string;
  isUniversal?: boolean;
  tags?: string[];
}

export interface AssetUpdatePatch {
  /** snake_case matches the PHP JSON field name expected by update_asset(). */
  is_universal?: boolean;
  tags?: string[];
}

export interface AssetDeleteResult {
  deleted: boolean;
}

/** Sentinel error code returned by DELETE when the asset is still in use. */
export const ASSET_IN_USE_CODE = 'wpsg_asset_in_use';

/**
 * P52-B — standalone CRUD helpers for the global asset library.
 *
 * Accepts any {@link HttpTransport} so it can be tested without a live HTTP
 * connection.  Used by adminQuery.ts mutation hooks and by the GlobalAssetManager.
 */
export class AssetsApi {
  constructor(private readonly transport: HttpTransport) {}

  list(): Promise<AssetLibraryItem[]> {
    return this.transport.get<AssetLibraryItem[]>(
      '/wp-json/wp-super-gallery/v1/admin/asset-library',
    );
  }

  upload(file: File, opts: AssetUploadOptions = {}): Promise<AssetLibraryItem> {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.name) fd.append('name', opts.name);
    if (opts.isUniversal !== undefined) fd.append('is_universal', String(Number(opts.isUniversal)));
    if (opts.tags?.length) fd.append('tags', JSON.stringify(opts.tags));
    return this.transport.postForm<AssetLibraryItem>(
      '/wp-json/wp-super-gallery/v1/admin/asset-library',
      fd,
    );
  }

  update(
    id: string,
    patch: AssetUpdatePatch,
  ): Promise<{ id: string; isUniversal?: boolean; tags?: string[] }> {
    return this.transport.post<{ id: string; isUniversal?: boolean; tags?: string[] }>(
      `/wp-json/wp-super-gallery/v1/admin/asset-library/${id}`,
      patch,
    );
  }

  delete(id: string, force = false): Promise<AssetDeleteResult> {
    const path = force
      ? `/wp-json/wp-super-gallery/v1/admin/asset-library/${id}?force=true`
      : `/wp-json/wp-super-gallery/v1/admin/asset-library/${id}`;
    return this.transport.delete<AssetDeleteResult>(path);
  }
}
