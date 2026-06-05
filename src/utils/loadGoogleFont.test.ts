import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadGoogleFont,
  loadGoogleFontsFromOverrides,
  getFailedFonts,
  GOOGLE_FONT_SPECS,
} from './loadGoogleFont';

// Each test uses a unique font name so the module-level `loaded`/`failed` Sets
// (which persist across tests within a single module instance) don't cross-contaminate.

afterEach(() => {
  // Remove all stylesheet links injected during tests (loadGoogleFont doesn't
  // set a data attribute, so we remove all <link rel="stylesheet"> elements).
  document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
});

function getInjectedLink(family: string): HTMLLinkElement | null {
  const needle = family.toLowerCase();
  const encodedNeedle = encodeURIComponent(family).toLowerCase();
  for (const el of document.querySelectorAll('link[rel="stylesheet"]')) {
    const link = el as HTMLLinkElement;
    const attrHref = (link.getAttribute('href') ?? '').toLowerCase();
    const idlHref = link.href.toLowerCase();
    if (
      attrHref.includes(needle) || attrHref.includes(encodedNeedle) ||
      idlHref.includes(needle) || idlHref.includes(encodedNeedle)
    ) {
      return link;
    }
  }
  return null;
}

describe('loadGoogleFont', () => {
  it('injects a <link> tag into document.head for a known font', () => {
    loadGoogleFont('Inter');

    const link = getInjectedLink('Inter');
    expect(link).not.toBeNull();
    expect(link?.rel).toBe('stylesheet');
    expect(link?.href).toContain('fonts.googleapis.com');
    expect(link?.href).toContain('Inter');
    expect(link?.href).toContain('display=swap');
  });

  it('includes the axis spec in the URL for fonts that have one', () => {
    const spec = GOOGLE_FONT_SPECS['Roboto'];
    expect(spec).toBeTruthy();

    loadGoogleFont('Roboto');

    const link = getInjectedLink('Roboto');
    // The spec is inserted into the URL without additional encoding.
    expect(link?.href).toContain(':' + spec!);
  });

  it('omits the axis spec for fonts with null spec (e.g. Pacifico)', () => {
    expect(GOOGLE_FONT_SPECS['Pacifico']).toBeNull();

    loadGoogleFont('Pacifico');

    const link = getInjectedLink('Pacifico');
    expect(link).not.toBeNull();
    expect(link?.href).not.toContain(':null');
    // URL should just be ...?family=Pacifico&display=swap with no colon axis segment
    expect(link?.href).toMatch(/family=Pacifico&display=swap/);
  });

  it('is idempotent — does not inject a second link for the same family', () => {
    loadGoogleFont('Montserrat');
    loadGoogleFont('Montserrat');

    const links = document.querySelectorAll('link[href*="Montserrat"]');
    expect(links.length).toBe(1);
  });

  it('does nothing for an empty string family', () => {
    const countBefore = document.querySelectorAll('link[href*="fonts.googleapis"]').length;
    loadGoogleFont('');
    const countAfter = document.querySelectorAll('link[href*="fonts.googleapis"]').length;
    expect(countAfter).toBe(countBefore);
  });

  it('handles unknown font families by using the bare URL form', () => {
    loadGoogleFont('MyCustomTestFont99');

    const link = getInjectedLink('MyCustomTestFont99');
    expect(link).not.toBeNull();
    expect(link?.href).toContain('MyCustomTestFont99');
  });

  it('adds family to failed set on error event and removes from loaded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    loadGoogleFont('FailTestFontXYZ');
    const link = getInjectedLink('FailTestFontXYZ');
    expect(link).not.toBeNull();

    link!.dispatchEvent(new Event('error'));

    expect(getFailedFonts().has('FailTestFontXYZ')).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('FailTestFontXYZ'),
    );

    warnSpy.mockRestore();
  });

  it('encodes font family names with spaces in the URL', () => {
    loadGoogleFont('Open Sans');
    const link = getInjectedLink('Open Sans');
    expect(link).not.toBeNull();
    // jsdom may normalize %20 to a space — check either encoded or raw family name.
    const href = (link!.getAttribute('href') ?? '') + link!.href;
    expect(href).toSatisfy((h: string) =>
      h.includes('Open%20Sans') || h.includes('Open Sans'),
    );
  });
});

describe('loadGoogleFontsFromOverrides', () => {
  const googleFontNames = new Set(Object.keys(GOOGLE_FONT_SPECS));

  it('loads fonts found in overrides', () => {
    loadGoogleFontsFromOverrides(
      { title: { fontFamily: 'Lato, sans-serif' } },
      googleFontNames,
    );

    const link = getInjectedLink('Lato');
    expect(link).not.toBeNull();
  });

  it('extracts the first name from a multi-family stack', () => {
    loadGoogleFontsFromOverrides(
      { caption: { fontFamily: 'Raleway, Arial, sans-serif' } },
      googleFontNames,
    );

    expect(getInjectedLink('Raleway')).not.toBeNull();
  });

  it('skips entries with no fontFamily', () => {
    const countBefore = document.querySelectorAll('link[href*="fonts.googleapis"]').length;
    loadGoogleFontsFromOverrides(
      { body: { fontFamily: undefined } },
      googleFontNames,
    );
    const countAfter = document.querySelectorAll('link[href*="fonts.googleapis"]').length;
    expect(countAfter).toBe(countBefore);
  });

  it('skips font families not in the googleFontNames set', () => {
    const countBefore = document.querySelectorAll('link[href*="fonts.googleapis"]').length;
    loadGoogleFontsFromOverrides(
      { body: { fontFamily: 'Arial' } },
      googleFontNames,
    );
    const countAfter = document.querySelectorAll('link[href*="fonts.googleapis"]').length;
    expect(countAfter).toBe(countBefore);
  });

  it('handles an empty overrides map', () => {
    expect(() => loadGoogleFontsFromOverrides({}, googleFontNames)).not.toThrow();
  });

  it('handles undefined entry values', () => {
    expect(() =>
      loadGoogleFontsFromOverrides({ title: undefined }, googleFontNames)
    ).not.toThrow();
  });
});

describe('GOOGLE_FONT_SPECS', () => {
  it('exports a non-empty spec map', () => {
    expect(Object.keys(GOOGLE_FONT_SPECS).length).toBeGreaterThan(0);
  });

  it('has null spec for decorative fonts without axis specs', () => {
    expect(GOOGLE_FONT_SPECS['Pacifico']).toBeNull();
    expect(GOOGLE_FONT_SPECS['Lobster']).toBeNull();
    expect(GOOGLE_FONT_SPECS['Satisfy']).toBeNull();
  });

  it('has axis strings for variable fonts', () => {
    expect(GOOGLE_FONT_SPECS['Inter']).toContain('wght');
    expect(GOOGLE_FONT_SPECS['Roboto']).toContain('wght');
  });
});
