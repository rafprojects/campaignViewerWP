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

  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Reject characters that can break out of url() or inject CSS
  // Includes whitespace, quotes, and backslashes per CSS url() token spec
  if (/[)};"'\\\s]/.test(trimmed)) return undefined;

  // Reject dangerous protocols
  const lower = trimmed.toLowerCase();
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
    return trimmed;
  }

  // Also allow http:// for local dev
  if (import.meta.env.DEV && lower.startsWith('http://')) return trimmed;

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

/**
 * Strict CSS color sanitizer.
 *
 * Only accepts:
 *  - Hex: #RGB, #RRGGBB, #RGBA, #RRGGBBAA
 *  - Functions: rgb(), rgba(), hsl(), hsla() with only safe chars inside parens
 *  - Keywords: transparent, currentcolor, inherit
 *  - Named colors: pure alphabetic strings up to 20 chars
 *
 * Rejects anything containing `)`, `,`, `;` etc. that could break out
 * of a `filter: drop-shadow(...)` or `background: linear-gradient(...)` context.
 */
export function sanitizeCssColor(value: string | undefined): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Hex colors
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;
  // CSS color functions — only digits, dots, commas, spaces, %, / inside parens
  if (/^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/+-]+\s*\)$/i.test(trimmed)) return trimmed;
  // Keywords
  if (/^(transparent|currentcolor|inherit)$/i.test(trimmed)) return trimmed;
  // Named colors — pure alphabetic, max 20 chars (covers all CSS named colors)
  if (/^[a-z]{3,20}$/i.test(trimmed)) return trimmed;
  return undefined;
}
