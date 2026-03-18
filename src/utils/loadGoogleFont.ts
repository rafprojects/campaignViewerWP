const loaded = new Set<string>();

/**
 * Dynamically inject a Google Fonts stylesheet for the given font family.
 *
 * Idempotent — subsequent calls for the same family are no-ops.
 * Returns immediately; the browser loads the stylesheet asynchronously.
 */
export function loadGoogleFont(family: string): void {
  if (!family || loaded.has(family)) return;
  loaded.add(family);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,100..900;1,100..900&display=swap`;
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
