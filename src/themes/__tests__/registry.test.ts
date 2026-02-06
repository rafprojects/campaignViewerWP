/**
 * Tests for src/themes/index.ts
 *
 * Covers: Registry API — getTheme, getAllThemeMeta, getAllThemeIds,
 * hasTheme, getMantineTheme, registerCustomTheme, DEFAULT_THEME_ID
 */

import { describe, it, expect } from 'vitest';
import {
  getTheme,
  getMantineTheme,
  getAllThemeMeta,
  getAllThemeIds,
  hasTheme,
  DEFAULT_THEME_ID,
  registerCustomTheme,
} from '../index';

// ---------------------------------------------------------------------------
// Registry initialization
// ---------------------------------------------------------------------------

describe('Theme Registry', () => {
  it('registers all 14 bundled themes', () => {
    const ids = getAllThemeIds();
    expect(ids).toHaveLength(14);
    expect(ids).toContain('default-dark');
    expect(ids).toContain('default-light');
    expect(ids).toContain('material-dark');
    expect(ids).toContain('material-light');
    expect(ids).toContain('darcula');
    expect(ids).toContain('nord');
    expect(ids).toContain('solarized-dark');
    expect(ids).toContain('solarized-light');
    expect(ids).toContain('high-contrast');
    expect(ids).toContain('catppuccin-mocha');
    expect(ids).toContain('tokyo-night');
    expect(ids).toContain('gruvbox-dark');
    expect(ids).toContain('cyberpunk');
    expect(ids).toContain('synthwave');
  });

  it('has DEFAULT_THEME_ID set to "default-dark"', () => {
    expect(DEFAULT_THEME_ID).toBe('default-dark');
  });
});

// ---------------------------------------------------------------------------
// hasTheme
// ---------------------------------------------------------------------------

describe('hasTheme', () => {
  it('returns true for registered themes', () => {
    expect(hasTheme('default-dark')).toBe(true);
    expect(hasTheme('nord')).toBe(true);
    expect(hasTheme('high-contrast')).toBe(true);
  });

  it('returns false for unregistered themes', () => {
    expect(hasTheme('nonexistent-theme')).toBe(false);
    expect(hasTheme('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTheme
// ---------------------------------------------------------------------------

describe('getTheme', () => {
  it('returns a ThemeEntry for a valid theme ID', () => {
    const entry = getTheme('default-dark');
    expect(entry).toBeDefined();
    expect(entry.meta.id).toBe('default-dark');
    expect(entry.meta.name).toBe('Default Dark');
    expect(entry.meta.colorScheme).toBe('dark');
    expect(entry.mantine).toBeDefined();
    expect(entry.cssVars).toBeTruthy();
  });

  it('falls back to default-dark for unknown theme ID', () => {
    const entry = getTheme('nonexistent');
    expect(entry.meta.id).toBe('default-dark');
  });

  it('returns pre-computed MantineThemeOverride', () => {
    const entry = getTheme('material-dark');
    expect(entry.mantine.primaryColor).toBe('primary');
    expect(entry.mantine.colors?.primary).toHaveLength(10);
  });

  it('includes CSS variables string', () => {
    const entry = getTheme('solarized-dark');
    expect(entry.cssVars).toContain('--wpsg-color-background');
    expect(entry.cssVars).toContain('--wpsg-color-primary');
  });
});

// ---------------------------------------------------------------------------
// getMantineTheme
// ---------------------------------------------------------------------------

describe('getMantineTheme', () => {
  it('returns a MantineThemeOverride for a valid theme', () => {
    const theme = getMantineTheme('darcula');
    expect(theme.primaryColor).toBe('primary');
    expect(theme.colors?.primary).toHaveLength(10);
    expect(theme.fontFamily).toBeTruthy();
  });

  it('falls back to default-dark for unknown theme', () => {
    const theme = getMantineTheme('unknown');
    expect(theme).toEqual(getMantineTheme('default-dark'));
  });
});

// ---------------------------------------------------------------------------
// getAllThemeMeta
// ---------------------------------------------------------------------------

describe('getAllThemeMeta', () => {
  it('returns metadata for all 14 themes', () => {
    const meta = getAllThemeMeta();
    expect(meta).toHaveLength(14);
    for (const m of meta) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(['light', 'dark']).toContain(m.colorScheme);
    }
  });

  it('includes both light and dark themes', () => {
    const meta = getAllThemeMeta();
    const schemes = meta.map((m) => m.colorScheme);
    expect(schemes).toContain('light');
    expect(schemes).toContain('dark');
  });
});

// ---------------------------------------------------------------------------
// registerCustomTheme
// ---------------------------------------------------------------------------

describe('registerCustomTheme', () => {
  it('rejects an invalid theme extension', () => {
    const result = registerCustomTheme({
      id: '',
      name: '',
      colorScheme: 'dark',
    });
    expect(result).toBe(false);
  });
});
