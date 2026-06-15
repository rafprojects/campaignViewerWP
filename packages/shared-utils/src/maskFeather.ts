/**
 * Mask Feathering Utility
 *
 * Loads a mask image into an offscreen canvas, applies a Gaussian blur to
 * ALL channels (RGB + alpha), and returns a blob-URL of the feathered result.
 * The blurred mask softens edge transitions, giving a "feather" effect.
 *
 * Uses the native `CanvasRenderingContext2D.filter` API for hardware-
 * accelerated blur that works correctly for both `luminance` and `alpha`
 * mask modes:
 *   - luminance mode: white/black pixel brightness drives the mask →
 *     blurring RGB channels produces a smooth gradient at edges.
 *   - alpha mode: the alpha channel drives the mask →
 *     blurring all channels (incl. alpha) softens alpha edges.
 */

// ── Cache: url+feather → blobUrl ─────────────────────────────────

const featherCache = new Map<string, string>();

/**
 * Generate a feathered (edge-blurred) version of a mask image.
 *
 * @param maskUrl    URL of the original mask image.
 * @param featherPx  Gaussian blur radius in CSS pixels.
 * @returns A blob URL of the feathered mask image (PNG).
 */
export async function featherMask(maskUrl: string, featherPx: number): Promise<string> {
  if (featherPx <= 0) return maskUrl;

  const cacheKey = `${maskUrl}__${featherPx}`;
  const cached = featherCache.get(cacheKey);
  if (cached) return cached;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load mask: ${maskUrl}`));
    img.src = maskUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  // Use the native CSS filter API for hardware-accelerated full-channel blur.
  // This blurs R, G, B, and A channels — essential for luminance-mode masks
  // where RGB brightness (not alpha) drives the masking.
  ctx.filter = `blur(${featherPx}px)`;
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
  });

  const blobUrl = URL.createObjectURL(blob);

  // Limit cache to 50 entries — evict before inserting.
  if (featherCache.size >= 50) {
    const first = featherCache.keys().next().value;
    if (first) {
      const old = featherCache.get(first);
      if (old) URL.revokeObjectURL(old);
      featherCache.delete(first);
    }
  }
  featherCache.set(cacheKey, blobUrl);

  return blobUrl;
}

/** Revoke all cached feathered mask blob URLs (call on unmount). */
export function clearFeatherCache(): void {
  for (const url of featherCache.values()) URL.revokeObjectURL(url);
  featherCache.clear();
}
