/**
 * Visual-similarity suggestions for automatic fallback chain population.
 *
 * Keys are the primary font label (first segment of the CSS fontFamily value).
 * Values are ordered arrays of suggested fallbacks (system fonts preferred,
 * then widely-available Google Fonts).
 *
 * Only the most common primary fonts have entries — for unlisted fonts the
 * terminal generic family is used as the sole fallback.
 */
export const FONT_FALLBACK_MAP: Record<string, string[]> = {
  // ── Sans-serif ──
  'Inter':              ['Helvetica', 'Arial'],
  'Roboto':             ['Helvetica', 'Arial'],
  'Open Sans':          ['Helvetica', 'Arial'],
  'Lato':               ['Helvetica', 'Arial'],
  'Montserrat':         ['Verdana', 'Arial'],
  'Poppins':            ['Verdana', 'Arial'],
  'Oswald':             ['Arial', 'Helvetica'],
  'Raleway':            ['Verdana', 'Trebuchet MS'],
  'Nunito':             ['Verdana', 'Arial'],
  'Source Sans 3':      ['Helvetica', 'Arial'],
  'PT Sans':            ['Tahoma', 'Arial'],
  'Noto Sans':          ['Helvetica', 'Arial'],
  'Work Sans':          ['Helvetica', 'Arial'],
  'Quicksand':          ['Verdana', 'Tahoma'],
  'Barlow':             ['Helvetica', 'Arial'],
  'Cabin':              ['Verdana', 'Tahoma'],
  'DM Sans':            ['Helvetica', 'Arial'],
  'Fira Sans':          ['Helvetica', 'Arial'],
  'Karla':              ['Verdana', 'Tahoma'],
  'Mulish':             ['Helvetica', 'Arial'],
  'Rubik':              ['Verdana', 'Arial'],
  'Ubuntu':             ['Tahoma', 'Verdana'],
  'Josefin Sans':       ['Trebuchet MS', 'Verdana'],
  'Manrope':            ['Helvetica', 'Arial'],
  'Plus Jakarta Sans':  ['Helvetica', 'Arial'],
  'Outfit':             ['Helvetica', 'Arial'],
  // ── Serif ──
  'Playfair Display':   ['Georgia', 'Times New Roman'],
  'Merriweather':       ['Georgia', 'Times New Roman'],
  'Libre Baskerville':  ['Georgia', 'Times New Roman'],
  'Crimson Text':       ['Georgia', 'Times New Roman'],
  'EB Garamond':        ['Georgia', 'Times New Roman'],
  'Bitter':             ['Georgia', 'Times New Roman'],
  'Cormorant Garamond': ['Georgia', 'Times New Roman'],
  'Lora':               ['Georgia', 'Times New Roman'],
  'PT Serif':           ['Georgia', 'Times New Roman'],
  'Noto Serif':         ['Georgia', 'Times New Roman'],
  // ── Display / Handwriting ──
  'Dancing Script':     ['Georgia', 'Times New Roman'],
  'Pacifico':           ['Georgia', 'Times New Roman'],
  'Lobster':            ['Georgia', 'Times New Roman'],
  'Caveat':             ['Georgia', 'Times New Roman'],
  'Satisfy':            ['Georgia', 'Times New Roman'],
  // ── Monospace ──
  'Fira Code':          ['Courier New'],
  'JetBrains Mono':     ['Courier New'],
  'Source Code Pro':     ['Courier New'],
  // ── System fonts (typically no fallback needed, but cover the case) ──
  'Arial':              ['Helvetica'],
  'Helvetica':          ['Arial'],
  'Verdana':            ['Tahoma', 'Arial'],
  'Tahoma':             ['Verdana', 'Arial'],
  'Trebuchet MS':       ['Verdana', 'Arial'],
  'Georgia':            ['Times New Roman'],
  'Times New Roman':    ['Georgia'],
  'Courier New':        [],
};

/** Detect the terminal generic family keyword for a given font. */
export function getTerminalFamily(fontLabel: string): string {
  const mono = /code|mono|courier/i;
  const serif = /serif|garamond|baskerville|merriweather|crimson|georgia|times|lora|bitter|playfair|cormorant|noto serif|pt serif/i;
  const cursive = /dancing|pacifico|lobster|caveat|satisfy/i;

  if (mono.test(fontLabel)) return 'monospace';
  if (cursive.test(fontLabel)) return 'cursive, serif';
  if (serif.test(fontLabel)) return 'serif';
  return 'sans-serif';
}
