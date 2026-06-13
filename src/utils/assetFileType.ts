/**
 * P50-I — derive a short, human-readable file-type label from an asset URL.
 * Used by the Layout Builder Asset Library grid to badge each thumbnail.
 */

const FILE_TYPE_LABELS: Record<string, string> = {
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
  svg: 'SVG',
  webp: 'WEBP',
  gif: 'GIF',
  avif: 'AVIF',
  tif: 'TIFF',
  tiff: 'TIFF',
};

/** Derive a short file-type label from a URL's extension (query/hash-safe). */
export function getAssetFileType(url: string): string {
  const path = (url.split(/[?#]/)[0] ?? '').toLowerCase();
  // Only consider a dot within the final path segment, so the dots in a
  // hostname (e.g. "x.com/noext") are never mistaken for an extension.
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot + 1) : '';
  return FILE_TYPE_LABELS[ext] ?? (ext ? ext.toUpperCase().slice(0, 4) : 'IMG');
}
