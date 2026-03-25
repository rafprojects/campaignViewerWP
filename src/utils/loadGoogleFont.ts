const loaded = new Set<string>();
const failed = new Set<string>();

/**
 * Per-font axis specifications verified against Google Fonts CSS API v2.
 *
 * The universal template `:ital,wght@0,100..900;1,100..900` only works for
 * variable fonts with full 100-900 weight range AND italic axis.  Static fonts
 * need discrete values, some Variable fonts have restricted ranges, and some
 * lack an italic axis entirely.
 *
 * Value = the axis string after the font name in the URL (after `:` and before
 * `&display=swap`). `null` means no axes are needed (regular 400 only).
 */
const GOOGLE_FONT_SPECS: Record<string, string | null> = {
  // --- Sans-serif ---
  'Inter':             'ital,wght@0,100..900;1,100..900',
  'Roboto':            'ital,wght@0,100..900;1,100..900',
  'Open Sans':         'ital,wght@0,300..800;1,300..800',
  'Lato':              'ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900',
  'Montserrat':        'ital,wght@0,100..900;1,100..900',
  'Poppins':           'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
  'Oswald':            'wght@200..700',
  'Raleway':           'ital,wght@0,100..900;1,100..900',
  'Nunito':            'ital,wght@0,200..1000;1,200..1000',
  'Source Sans 3':     'ital,wght@0,200..900;1,200..900',
  'PT Sans':           'ital,wght@0,400;0,700;1,400;1,700',
  'Noto Sans':         'ital,wght@0,100..900;1,100..900',
  'Work Sans':         'ital,wght@0,100..900;1,100..900',
  'Quicksand':         'wght@300..700',
  'Barlow':            'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
  'Cabin':             'ital,wght@0,400..700;1,400..700',
  'DM Sans':           'ital,wght@0,100..1000;1,100..1000',
  'Fira Sans':         'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
  'Karla':             'ital,wght@0,200..800;1,200..800',
  'Mulish':            'ital,wght@0,200..1000;1,200..1000',
  'Rubik':             'ital,wght@0,300..900;1,300..900',
  'Ubuntu':            'ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700',
  'Josefin Sans':      'ital,wght@0,100..700;1,100..700',
  'Manrope':           'wght@200..800',
  'Plus Jakarta Sans': 'ital,wght@0,200..800;1,200..800',
  'Outfit':            'wght@100..900',
  // --- Serif ---
  'Playfair Display':    'ital,wght@0,400..900;1,400..900',
  'Merriweather':        'ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900',
  'Libre Baskerville':   'ital,wght@0,400;0,700;1,400',
  'Crimson Text':        'ital,wght@0,400;0,600;0,700;1,400;1,600;1,700',
  'EB Garamond':         'ital,wght@0,400..800;1,400..800',
  'Bitter':              'ital,wght@0,100..900;1,100..900',
  'Cormorant Garamond':  'ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
  'Lora':                'ital,wght@0,400..700;1,400..700',
  'PT Serif':            'ital,wght@0,400;0,700;1,400;1,700',
  'Noto Serif':          'ital,wght@0,100..900;1,100..900',
  // --- Display / Handwriting ---
  'Dancing Script': 'wght@400..700',
  'Pacifico':       null,
  'Lobster':        null,
  'Caveat':         'wght@400..700',
  'Satisfy':        null,
  // --- Monospace ---
  'Fira Code':       'wght@300..700',
  'JetBrains Mono':  'ital,wght@0,100..800;1,100..800',
  'Source Code Pro':  'ital,wght@0,200..900;1,200..900',
};

/** Exported for PHP-side sync verification in tests. */
export { GOOGLE_FONT_SPECS };

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
 * Uses a plain <link> tag (no crossOrigin attribute) so the browser makes a
 * simple GET with no CORS preflight. This avoids MIME/CORS failures on hosts
 * whose reverse proxy or security rules interfere with cross-origin fetches.
 *
 * NOTE: Server-side Google Font enqueueing via wp_enqueue_style (in
 * class-wpsg-embed.php) handles the shortcode output.  This function is
 * only needed for live-preview contexts (admin SettingsPanel, etc.)
 * where fonts are selected dynamically after the page has loaded.
 */
export function loadGoogleFont(family: string): void {
  if (!family || loaded.has(family)) return;
  loaded.add(family);

  const encoded = encodeURIComponent(family);
  const spec = GOOGLE_FONT_SPECS[family];
  const url =
    spec === null || spec === undefined
      ? `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`
      : `https://fonts.googleapis.com/css2?family=${encoded}:${spec}&display=swap`;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  // Intentionally no crossOrigin attribute — avoids CORS preflight that
  // many WordPress hosts block or proxy incorrectly.
  document.head.appendChild(link);

  link.addEventListener('load', () => {
    // Font CSS loaded successfully.
  });

  link.addEventListener('error', () => {
    loaded.delete(family);
    failed.add(family);
    console.warn(
      `[WP Super Gallery] Google Font "${family}" failed to load. ` +
      'The host may block fonts.googleapis.com. Consider using system fonts or uploading a custom font.',
    );
  });
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
