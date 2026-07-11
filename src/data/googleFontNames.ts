/**
 * Google Fonts that must be loaded from the CDN (vs. always-available system fonts).
 *
 * Extracted from `TypographyEditor` (P62-G) into a light, dependency-free data module
 * so the layer renderers (`TextLayerContent`) and the public gallery/viewer components
 * can check font names **without importing the heavyweight authoring `TypographyEditor`
 * component**. This keeps the free WP.org build's renderer path free of authoring code.
 * Keep in sync with the font Select options in `TypographyEditor`.
 */
export const GOOGLE_FONT_NAMES: ReadonlySet<string> = new Set([
  // Sans-serif
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Oswald', 'Raleway', 'Nunito', 'Source Sans 3', 'PT Sans', 'Noto Sans',
  'Work Sans', 'Quicksand', 'Barlow', 'Cabin', 'DM Sans', 'Fira Sans',
  'Karla', 'Mulish', 'Rubik', 'Ubuntu', 'Josefin Sans', 'Manrope',
  'Plus Jakarta Sans', 'Outfit',
  // Serif
  'Playfair Display', 'Merriweather', 'Libre Baskerville', 'Crimson Text',
  'EB Garamond', 'Bitter', 'Cormorant Garamond', 'Lora', 'PT Serif',
  'Noto Serif',
  // Display / Handwriting
  'Dancing Script', 'Pacifico', 'Lobster', 'Caveat', 'Satisfy',
  // Monospace
  'Fira Code', 'JetBrains Mono', 'Source Code Pro',
]);
