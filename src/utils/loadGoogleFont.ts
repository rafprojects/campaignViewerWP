const loaded = new Set<string>();
const failed = new Set<string>();

/**
 * Returns the set of font families that failed to load from Google Fonts CDN.
 * Consumed by the fallback chain UI to show warnings.
 */
export function getFailedFonts(): ReadonlySet<string> {
  return failed;
}

/**
 * Dynamically inject a Google Fonts stylesheet for the given font family.
 *
 * Idempotent — subsequent calls for the same family are no-ops.
 * Returns immediately; the browser loads the stylesheet asynchronously.
 *
 * On error (CDN blocked, MIME mismatch, network failure) the font is removed
 * from the loaded set so it can be retried on next navigation, and a console
 * warning is emitted.
 */
export function loadGoogleFont(family: string): void {
  if (!family || loaded.has(family)) return;
  loaded.add(family);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.crossOrigin = 'anonymous';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,100..900;1,100..900&display=swap`;

  link.onerror = () => {
    loaded.delete(family);
    failed.add(family);
    console.warn(
      `[WP Super Gallery] Google Font "${family}" failed to load. ` +
      'The host may block fonts.googleapis.com. Consider using system fonts or uploading a custom font.',
    );
  };

  document.head.appendChild(link);
}

/**
 * Scan a typography overrides map and load any Google Fonts referenced.
 */
export function loadGoogleFontsFromOverrides(
  overrides: Record<string, { fontFamily?: string } | undefined>,
  googleFontNames: ReadonlySet<string>,
): void {
  for (const entry of Object.values(overrides)) {
    if (!entry?.fontFamily) continue;
    // fontFamily value is like "Roboto, sans-serif" — extract the first name
    const name = entry.fontFamily.split(',')[0].trim();
    if (googleFontNames.has(name)) {
      loadGoogleFont(name);
    }
  }
}
