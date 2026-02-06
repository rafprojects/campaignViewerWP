/**
 * Theme System Type Definitions
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md
 *
 * Strict TypeScript interfaces for v1. All theme JSON definitions must
 * conform to these types. No index signatures — extensibility will be
 * revisited in a future iteration if needed.
 */

// ---------------------------------------------------------------------------
// Color shorthand — compact notation for theme JSON files
// ---------------------------------------------------------------------------

/**
 * A color value in theme JSON. Either:
 * - A plain hex/rgb string (used directly as a single semantic token)
 * - An object with `base` + `shades` for procedural 10-step array generation via chroma.js
 */
export type ColorShorthand = string | { base: string; shades: number };

// ---------------------------------------------------------------------------
// Theme Definition — the schema every theme JSON must match
// ---------------------------------------------------------------------------

/** Scale with 5 standard size stops */
export interface SizeScale {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

/** Heading size definition */
export interface HeadingSize {
  fontSize: string;
  lineHeight: string;
}

/** Full heading configuration */
export interface HeadingsConfig {
  fontFamily: string;
  sizes: {
    h1: HeadingSize;
    h2: HeadingSize;
    h3: HeadingSize;
    h4: HeadingSize;
    h5: HeadingSize;
    h6: HeadingSize;
  };
}

/** Typography section of a theme */
export interface ThemeTypography {
  fontFamily: string;
  fontFamilyMono: string;
  fontSizes: SizeScale;
  headings: HeadingsConfig;
}

/** Primary shade configuration (Mantine uses separate light/dark indices) */
export interface PrimaryShade {
  light: number;
  dark: number;
}

/** Color palette section of a theme */
export interface ThemeColors {
  // Surface layers (background → elevated)
  background: string;
  surface: string;
  surface2: string;
  surface3: string;

  // Text hierarchy
  text: string;
  textMuted: string;
  textMuted2: string;

  // Border
  border: string;

  // Primary accent — expanded to 10-step array via chroma.js
  primary: ColorShorthand;
  primaryShade: PrimaryShade;

  // Semantic status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Optional accent variants
  accent?: string;
  accentGreen?: string;
  accentPurple?: string;

  /**
   * Mantine dark[0-9] tuple. If omitted, the adapter derives it from
   * the surface/background/text colors to ensure coherence with the
   * overall palette. Themes may override for fine-tuned control.
   */
  dark?: string[];
}

/** Component style override (mirrors Mantine's per-component structure) */
export interface ComponentOverride {
  defaultProps?: Record<string, unknown>;
  styles?: Record<string, Record<string, unknown>>;
}

/**
 * Complete theme definition. Every bundled theme JSON file must satisfy
 * this interface after base-merge. The adapter converts this into a
 * `MantineThemeOverride` at startup.
 */
export interface ThemeDefinition {
  /** Unique identifier (e.g. "darcula", "material-dark") */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Light or dark base — drives Mantine's forceColorScheme */
  colorScheme: 'light' | 'dark';

  /** Color palette */
  colors: ThemeColors;

  /** Typography */
  typography: ThemeTypography;

  /** Spacing scale */
  spacing: SizeScale;

  /** Border radius scale */
  radius: SizeScale;

  /** Shadow definitions */
  shadows: SizeScale;

  /** Responsive breakpoints */
  breakpoints: SizeScale;

  /**
   * Optional component-specific Mantine overrides. When provided these
   * take precedence over the auto-generated overrides from the adapter.
   */
  components?: Record<string, ComponentOverride>;
}

// ---------------------------------------------------------------------------
// Theme Extension — what individual theme JSON files actually contain
// ---------------------------------------------------------------------------

/**
 * A theme extension is a partial override of the base theme.
 * `id`, `name`, and `colorScheme` are always required.
 * Everything else falls back to _base.json defaults.
 */
export interface ThemeExtension {
  id: string;
  name: string;
  colorScheme: 'light' | 'dark';
  colors?: Partial<ThemeColors>;
  typography?: Partial<ThemeTypography>;
  spacing?: Partial<SizeScale>;
  radius?: Partial<SizeScale>;
  shadows?: Partial<SizeScale>;
  breakpoints?: Partial<SizeScale>;
  components?: Record<string, ComponentOverride>;
}

// ---------------------------------------------------------------------------
// Resolved Colors — after chroma.js expansion
// ---------------------------------------------------------------------------

/**
 * The fully resolved color set after ColorShorthand values have been
 * expanded into concrete strings / arrays. This is what the adapter
 * and component-override generator consume.
 */
export interface ResolvedColors {
  background: string;
  surface: string;
  surface2: string;
  surface3: string;

  text: string;
  textMuted: string;
  textMuted2: string;

  border: string;

  /** Fully expanded 10-step array */
  primary: string[];
  primaryShade: PrimaryShade;

  success: string;
  warning: string;
  error: string;
  info: string;

  accent: string;
  accentGreen: string;
  accentPurple: string;

  /** Mantine dark[0-9] tuple (always present after resolution) */
  dark: string[];
}

// ---------------------------------------------------------------------------
// Pre-computed theme map entry
// ---------------------------------------------------------------------------

/** Metadata exposed to the theme selector UI */
export interface ThemeMeta {
  id: string;
  name: string;
  colorScheme: 'light' | 'dark';
}
