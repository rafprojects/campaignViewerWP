/**
 * CSS sanitization utilities.
 *
 * Prevents CSS injection via user-controlled values interpolated into
 * style properties (url(), font-family, clip-path, etc.).
 */

/** Characters that could break out of a CSS value context. */
const CSS_INJECTION_RE = /[{}<>;/\\]/;

/**
 * Validate and sanitize a URL for use inside CSS `url(...)`.
 *
 * Accepts only:
 *  - HTTPS URLs
 *  - Protocol-relative URLs (//...)
 *  - Relative paths (no protocol)
 *  - Blob URLs (blob:...)
 *
 * Rejects data:, javascript:, and URLs containing characters that could
 * break out of the `url()` context (`)`, `}`, `;`).
 */
export function sanitizeCssUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Reject characters that can break out of url() or inject CSS
  if (/[)};]/.test(url)) return undefined;

  // Reject dangerous protocols
  const lower = url.toLowerCase().trim();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return undefined;
  }

  // Allow: https://, blob:, //, or relative paths
  if (
    lower.startsWith('https://') ||
    lower.startsWith('blob:') ||
    lower.startsWith('//') ||
    lower.startsWith('/') ||
    !lower.includes(':')
  ) {
    return url;
  }

  // Also allow http:// for local dev
  if (import.meta.env.DEV && lower.startsWith('http://')) return url;

  return undefined;
}

/**
 * Validate a CSS clip-path value.
 *
 * Only allows known CSS shape functions and `none`.
 */
const CLIP_PATH_FN_RE =
  /^(polygon|circle|ellipse|inset|path)\s*\([\d\s%.,a-zA-Z-]+\)$/;

export function sanitizeClipPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed === 'none') return trimmed;
  if (CLIP_PATH_FN_RE.test(trimmed)) return trimmed;
  return undefined;
}

/**
 * Sanitize a string for safe interpolation into a CSS property value
 * (e.g. font-family, box-shadow). Rejects values that contain characters
 * capable of breaking out of a CSS declaration.
 */
export function sanitizeCssValue(value: string | undefined): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  if (CSS_INJECTION_RE.test(value)) return undefined;
  return value;
}
