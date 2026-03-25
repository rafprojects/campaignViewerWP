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

export function loadCustomFonts(fonts: FontLibraryEntry[]): void {
  const existing = document.getElementById(STYLE_ID);

  if (fonts.length === 0) {
    if (existing) existing.remove();
    return;
  }

  const css = fonts
    .map((f) => {
      const fmt = f.format ? ` format('${f.format}')` : '';
      return `@font-face {\n  font-family: '${f.name}';\n  src: url('${f.url}')${fmt};\n  font-display: swap;\n}`;
    })
    .join('\n');

  if (existing?.textContent === css) return;
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}
