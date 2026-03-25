import { sanitizeCssUrl } from './sanitizeCss';

/**
 * Inject @font-face CSS for custom uploaded fonts into document.head.
 *
 * Idempotent — repeated calls with the same data skip re-injection.
 */

export interface FontLibraryEntry {
  id: string;
  url: string;
  name: string;
  filename: string;
  format: string;
  uploadedAt: string;
}

const STYLE_ID = 'wpsg-custom-fonts';

function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\r\n\f]/g, ' ');
}

export function loadCustomFonts(fonts: FontLibraryEntry[]): void {
  const existing = document.getElementById(STYLE_ID);

  if (fonts.length === 0) {
    if (existing) existing.remove();
    return;
  }

  const css = fonts
    .map((f) => {
      const safeUrl = sanitizeCssUrl(f.url);
      if (!safeUrl) return '';

      const safeName = escapeCssString(f.name);
      const fmt = f.format ? ` format('${escapeCssString(f.format)}')` : '';
      return `@font-face {\n  font-family: '${safeName}';\n  src: url('${safeUrl}')${fmt};\n  font-display: swap;\n}`;
    })
    .filter(Boolean)
    .join('\n');

  if (!css) {
    if (existing) existing.remove();
    return;
  }

  if (existing?.textContent === css) return;
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}
