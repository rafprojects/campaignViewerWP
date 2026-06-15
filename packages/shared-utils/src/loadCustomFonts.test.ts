import { afterEach, describe, expect, it } from 'vitest';
import { loadCustomFonts } from './loadCustomFonts';

describe('loadCustomFonts', () => {
  afterEach(() => {
    document.getElementById('wpsg-custom-fonts')?.remove();
  });

  it('escapes font-family values before injecting CSS', () => {
    loadCustomFonts([
      {
        id: '1',
        url: 'https://example.com/font.woff2',
        name: "Brand's Font",
        filename: 'font.woff2',
        format: 'woff2',
        uploadedAt: '2026-03-25T00:00:00Z',
      },
    ]);

    expect(document.head.textContent).toContain("font-family: 'Brand\\'s Font';");
  });

  it('skips unsafe font URLs', () => {
    loadCustomFonts([
      {
        id: '1',
        url: "https://example.com/font.woff2');body{color:red}/*",
        name: 'Unsafe',
        filename: 'font.woff2',
        format: 'woff2',
        uploadedAt: '2026-03-25T00:00:00Z',
      },
    ]);

    expect(document.getElementById('wpsg-custom-fonts')).toBeNull();
  });

  it('does not replace the style tag when CSS is unchanged', () => {
    const fonts = [
      {
        id: '1',
        url: 'https://example.com/font.woff2',
        name: 'Brand Sans',
        filename: 'font.woff2',
        format: 'woff2',
        uploadedAt: '2026-03-25T00:00:00Z',
      },
    ];

    loadCustomFonts(fonts);
    const initialNode = document.getElementById('wpsg-custom-fonts');

    loadCustomFonts(fonts);

    expect(document.getElementById('wpsg-custom-fonts')).toBe(initialNode);
  });
});