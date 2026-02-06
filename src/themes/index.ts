/**
 * Theme Registry
 *
 * Pre-computes all bundled themes at startup and stores them in a Map
 * for O(1) runtime switching. This is the primary public API for the
 * theme system.
 *
 * Pipeline per theme:
 *   1. Import JSON definition
 *   2. Deep-merge with _base.json defaults
 *   3. Validate merged result (strict, throws in dev)
 *   4. Adapt to MantineThemeOverride via adapter
 *   5. Store in Map<id, { mantine, meta, cssVars }>
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §3
 */

import type { MantineThemeOverride } from '@mantine/core';
import type { ThemeDefinition, ThemeExtension, ThemeMeta } from './types';
import { adaptTheme } from './adapter';
import { isValidTheme } from './validation';
import { generateCssVariables } from './cssVariables';
import { resolveColors } from './colorGen';

// ---------------------------------------------------------------------------
// JSON imports (Vite handles JSON imports natively)
// ---------------------------------------------------------------------------

import baseDefaults from './definitions/_base.json';
import defaultDarkDef from './definitions/default-dark.json';
import defaultLightDef from './definitions/default-light.json';
import materialDarkDef from './definitions/material-dark.json';
import materialLightDef from './definitions/material-light.json';
import darculaDef from './definitions/darcula.json';
import nordDef from './definitions/nord.json';
import solarizedDarkDef from './definitions/solarized-dark.json';
import solarizedLightDef from './definitions/solarized-light.json';
import highContrastDef from './definitions/high-contrast.json';
import catppuccinMochaDef from './definitions/catppuccin-mocha.json';
import tokyoNightDef from './definitions/tokyo-night.json';
import gruvboxDarkDef from './definitions/gruvbox-dark.json';
import cyberpunkDef from './definitions/cyberpunk.json';
import synthwaveDef from './definitions/synthwave.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A fully pre-computed theme entry stored in the registry Map */
export interface ThemeEntry {
  /** Ready-to-use Mantine theme override */
  mantine: MantineThemeOverride;

  /** Lightweight metadata for UI pickers */
  meta: ThemeMeta;

  /** Pre-generated CSS variable string for Shadow DOM injection */
  cssVars: string;

  /** The full definition (kept for debugging / export) */
  definition: ThemeDefinition;
}

// ---------------------------------------------------------------------------
// Deep merge helper
// ---------------------------------------------------------------------------

/**
 * Deep-merge a theme extension onto the base defaults.
 * Extension values always win. Arrays are replaced, not concatenated.
 */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  extension: Partial<T>,
): T {
  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(extension)) {
    const extVal = (extension as Record<string, unknown>)[key];
    const baseVal = result[key];

    if (
      extVal !== null &&
      typeof extVal === 'object' &&
      !Array.isArray(extVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        extVal as Record<string, unknown>,
      );
    } else {
      result[key] = extVal;
    }
  }

  return result as T;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** The pre-computed theme map — populated at module load time */
const registry = new Map<string, ThemeEntry>();

/** Default fallback theme ID */
export const DEFAULT_THEME_ID = 'default-dark';

/**
 * Register a single theme extension JSON into the registry.
 *
 * @param extension - Partial theme definition (must have id, name, colorScheme)
 * @returns true if registration succeeded, false if validation failed
 */
function registerTheme(extension: ThemeExtension): boolean {
  // 1. Deep-merge with base defaults
  const merged = deepMerge(
    baseDefaults as unknown as Record<string, unknown>,
    extension as unknown as Record<string, unknown>,
  ) as unknown;

  // 2. Validate
  if (!isValidTheme(merged)) {
    console.error(`[WPSG Theme] Skipping invalid theme: ${extension.id}`);
    return false;
  }

  const def = merged as ThemeDefinition;

  // 3. Adapt to MantineThemeOverride
  const mantine = adaptTheme(def);

  // 4. Generate CSS variables
  const rc = resolveColors(def.colors, def.colorScheme);
  const cssVars = generateCssVariables(rc, def);

  // 5. Build metadata
  const meta: ThemeMeta = {
    id: def.id,
    name: def.name,
    colorScheme: def.colorScheme,
  };

  // 6. Store
  registry.set(def.id, { mantine, meta, cssVars, definition: def });
  return true;
}

// ---------------------------------------------------------------------------
// Startup pre-computation
// ---------------------------------------------------------------------------

/**
 * Initialize all bundled themes. Called once at module load.
 *
 * Performance note: each theme takes ~1-5ms to adapt (chroma.js color
 * generation + component override assembly). With 14 themes this is
 * well under 100ms total, run once at startup.
 */
function initializeRegistry(): void {
  const startTime = performance.now();

  // Register bundled themes in order
  const bundled: ThemeExtension[] = [
    defaultDarkDef as unknown as ThemeExtension,
    defaultLightDef as unknown as ThemeExtension,
    materialDarkDef as unknown as ThemeExtension,
    materialLightDef as unknown as ThemeExtension,
    darculaDef as unknown as ThemeExtension,
    nordDef as unknown as ThemeExtension,
    solarizedDarkDef as unknown as ThemeExtension,
    solarizedLightDef as unknown as ThemeExtension,
    highContrastDef as unknown as ThemeExtension,
    catppuccinMochaDef as unknown as ThemeExtension,
    tokyoNightDef as unknown as ThemeExtension,
    gruvboxDarkDef as unknown as ThemeExtension,
    cyberpunkDef as unknown as ThemeExtension,
    synthwaveDef as unknown as ThemeExtension,
  ];

  let successCount = 0;
  for (const ext of bundled) {
    if (registerTheme(ext)) {
      successCount++;
    }
  }

  const elapsed = performance.now() - startTime;

  if (import.meta.env.DEV) {
    console.log(
      `[WPSG Theme] Registry initialized: ${successCount}/${bundled.length} themes in ${elapsed.toFixed(1)}ms`,
    );
  }

  // Safety: ensure default theme is always available
  if (!registry.has(DEFAULT_THEME_ID)) {
    console.error(
      `[WPSG Theme] CRITICAL: Default theme "${DEFAULT_THEME_ID}" failed to register!`,
    );
  }
}

// Run at module load time (pre-compute all themes)
initializeRegistry();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a pre-computed theme by ID. Falls back to default-dark if the
 * requested ID is not found.
 *
 * @param id - Theme identifier
 * @returns ThemeEntry with mantine override, metadata, and CSS vars
 */
export function getTheme(id: string): ThemeEntry {
  const entry = registry.get(id);
  if (entry) return entry;

  if (import.meta.env.DEV) {
    console.warn(`[WPSG Theme] Theme "${id}" not found, falling back to "${DEFAULT_THEME_ID}"`);
  }

  // Guaranteed to exist after initialization
  return registry.get(DEFAULT_THEME_ID)!;
}

/**
 * Get the MantineThemeOverride for a theme ID. Convenience wrapper.
 */
export function getMantineTheme(id: string): MantineThemeOverride {
  return getTheme(id).mantine;
}

/**
 * Get metadata for all registered themes. Used by the theme selector UI.
 */
export function getAllThemeMeta(): ThemeMeta[] {
  return Array.from(registry.values()).map((entry) => entry.meta);
}

/**
 * Get all registered theme IDs.
 */
export function getAllThemeIds(): string[] {
  return Array.from(registry.keys());
}

/**
 * Check if a theme ID is registered.
 */
export function hasTheme(id: string): boolean {
  return registry.has(id);
}

/**
 * Register a custom theme at runtime (e.g., from WordPress admin settings).
 * Validates and adds to the registry. Returns success status.
 */
export function registerCustomTheme(extension: ThemeExtension): boolean {
  return registerTheme(extension);
}

/**
 * Get the total number of registered themes.
 */
export function getThemeCount(): number {
  return registry.size;
}
