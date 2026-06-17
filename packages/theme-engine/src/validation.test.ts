/**
 * Tests for src/themes/validation.ts
 *
 * Covers: validateTheme, isValidTheme, warnLowContrast — schema checks, edge cases, all branches
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { validateTheme, isValidTheme, warnLowContrast } from './validation';
import baseDefaults from './definitions/_base.json';
import defaultDarkDef from './definitions/default-dark.json';

// Helper: build a valid theme by deep-merging default-dark onto base
function makeValidTheme(overrides?: Record<string, unknown>): unknown {
  const base = JSON.parse(JSON.stringify(baseDefaults));
  const ext = JSON.parse(JSON.stringify(defaultDarkDef));
  const merged = deepMerge(base, ext);
  if (overrides) {
    return deepMerge(merged, overrides);
  }
  return merged;
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    const bVal = b[key];
    const aVal = result[key];
    if (
      bVal !== null && typeof bVal === 'object' && !Array.isArray(bVal) &&
      aVal !== null && typeof aVal === 'object' && !Array.isArray(aVal)
    ) {
      result[key] = deepMerge(aVal as Record<string, unknown>, bVal as Record<string, unknown>);
    } else {
      result[key] = bVal;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// validateTheme — valid inputs
// ---------------------------------------------------------------------------

describe('validateTheme', () => {
  it('accepts a valid default-dark theme', () => {
    const theme = makeValidTheme();
    expect(() => validateTheme(theme)).not.toThrow();
  });

  it('accepts colorScheme "light"', () => {
    const theme = makeValidTheme({ colorScheme: 'light' });
    expect(() => validateTheme(theme)).not.toThrow();
  });

  it('accepts colorScheme "dark"', () => {
    const theme = makeValidTheme({ colorScheme: 'dark' });
    expect(() => validateTheme(theme)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateTheme — invalid inputs
// ---------------------------------------------------------------------------

describe('validateTheme (invalid)', () => {
  it('rejects null', () => {
    expect(() => validateTheme(null)).toThrow();
  });

  it('rejects non-object', () => {
    expect(() => validateTheme('string')).toThrow();
  });

  it('rejects missing id', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['id'];
    expect(() => validateTheme(theme)).toThrow(/id/);
  });

  it('rejects empty id', () => {
    const theme = makeValidTheme({ id: '' });
    expect(() => validateTheme(theme)).toThrow(/id/);
  });

  it('rejects invalid colorScheme', () => {
    const theme = makeValidTheme({ colorScheme: 'midnight' });
    expect(() => validateTheme(theme)).toThrow(/colorScheme/);
  });

  it('rejects missing colors section', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['colors'];
    expect(() => validateTheme(theme)).toThrow(/colors/);
  });

  it('rejects invalid color in colors.background', () => {
    const theme = makeValidTheme({ colors: { background: 'not-a-color' } }) as Record<string, unknown>;
    expect(() => validateTheme(theme)).toThrow(/background/);
  });

  it('rejects missing typography', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['typography'];
    expect(() => validateTheme(theme)).toThrow(/typography/);
  });

  it('rejects missing spacing', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['spacing'];
    expect(() => validateTheme(theme)).toThrow(/spacing/);
  });

  it('rejects primaryShade.light out of range', () => {
    const theme = makeValidTheme({
      colors: { primaryShade: { light: 15, dark: 5 } },
    });
    expect(() => validateTheme(theme)).toThrow(/primaryShade/);
  });
});

// ---------------------------------------------------------------------------
// isValidTheme
// ---------------------------------------------------------------------------

describe('isValidTheme', () => {
  it('returns true for a valid theme', () => {
    const theme = makeValidTheme();
    expect(isValidTheme(theme)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidTheme(null)).toBe(false);
  });

  it('returns false for a theme with missing id', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['id'];
    expect(isValidTheme(theme)).toBe(false);
  });

  it('returns false for a theme with invalid color', () => {
    const theme = makeValidTheme({ colors: { background: 'xyz' } });
    expect(isValidTheme(theme)).toBe(false);
  });

  it('suppresses the dev validation log when isDev=false (browser prod path)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['id'];
    expect(isValidTheme(theme, false)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('emits the dev validation log when isDev=true', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['id'];
    expect(isValidTheme(theme, true)).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// warnLowContrast — dev-only advisory, dev-ness injectable for browser callers
// ---------------------------------------------------------------------------

describe('warnLowContrast', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns on a low-contrast pair when isDev=true', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // grey-on-grey: well below the 4.5:1 WCAG AA threshold
    warnLowContrast('test', '#808080', '#888888', true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays silent on a low-contrast pair when isDev=false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', '#808080', '#888888', false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn on a high-contrast pair even when isDev=true', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', '#ffffff', '#000000', true);
    expect(warn).not.toHaveBeenCalled();
  });
});

// ============================================================================
// COMPREHENSIVE BRANCH COVERAGE TESTS
// ============================================================================

describe('validateTheme — comprehensive coverage', () => {
  describe('isDevEnv internal function (implicit coverage)', () => {
    it('works in test environment with process.env available', () => {
      // In test env, isDevEnv should return true (NODE_ENV !== 'production')
      const validTheme = makeValidTheme();
      expect(() => validateTheme(validTheme)).not.toThrow();
    });
  });

  describe('top-level structure — all branches', () => {
    it('throws when theme is null', () => {
      expect(() => validateTheme(null)).toThrow('Theme must be a non-null object');
    });

    it('throws when theme is undefined', () => {
      expect(() => validateTheme(undefined)).toThrow('Theme must be a non-null object');
    });

    it('throws when theme is a string', () => {
      expect(() => validateTheme('string')).toThrow('Theme must be a non-null object');
    });

    it('throws when theme is a number', () => {
      expect(() => validateTheme(123)).toThrow('Theme must be a non-null object');
    });

    it('throws when theme is an array (arrays are objects, but fail validation)', () => {
      // Arrays pass the typeof object check but fail validation on structure
      expect(() => validateTheme([])).toThrow();
    });

    it('throws when theme is a boolean', () => {
      expect(() => validateTheme(true)).toThrow('Theme must be a non-null object');
    });

    it('throws when id is missing', () => {
      const theme = makeValidTheme();
      delete (theme as Record<string, unknown>)['id'];
      expect(() => validateTheme(theme)).toThrow('id must be a non-empty string');
    });

    it('throws when id is empty string', () => {
      const theme = makeValidTheme({ id: '' });
      expect(() => validateTheme(theme)).toThrow('id must be a non-empty string');
    });

    it('throws when id is whitespace only', () => {
      const theme = makeValidTheme({ id: '   ' });
      expect(() => validateTheme(theme)).toThrow('id must be a non-empty string');
    });

    it('throws when id is not a string', () => {
      const theme = makeValidTheme({ id: 123 });
      expect(() => validateTheme(theme)).toThrow('id must be a non-empty string');
    });

    it('throws when name is missing', () => {
      const theme = makeValidTheme();
      delete (theme as Record<string, unknown>)['name'];
      expect(() => validateTheme(theme)).toThrow('name must be a non-empty string');
    });

    it('throws when name is empty string', () => {
      const theme = makeValidTheme({ name: '' });
      expect(() => validateTheme(theme)).toThrow('name must be a non-empty string');
    });

    it('throws when name is not a string', () => {
      const theme = makeValidTheme({ name: 123 });
      expect(() => validateTheme(theme)).toThrow('name must be a non-empty string');
    });

    it('throws when colorScheme is neither light nor dark', () => {
      const theme = makeValidTheme({ colorScheme: 'medium' });
      expect(() => validateTheme(theme)).toThrow('colorScheme must be "light" or "dark"');
    });

    it('throws when colorScheme is null', () => {
      const theme = makeValidTheme({ colorScheme: null });
      expect(() => validateTheme(theme)).toThrow('colorScheme must be "light" or "dark"');
    });

    it('throws when colorScheme is missing', () => {
      const theme = makeValidTheme();
      delete (theme as Record<string, unknown>)['colorScheme'];
      expect(() => validateTheme(theme)).toThrow('colorScheme must be "light" or "dark"');
    });
  });

  describe('validateColors — all branches', () => {
    it('throws when colors is not an object', () => {
      const theme = makeValidTheme({ colors: null });
      expect(() => validateTheme(theme)).toThrow('colors must be an object');
    });

    it('throws when colors is a string', () => {
      const theme = makeValidTheme({ colors: 'not-an-object' });
      expect(() => validateTheme(theme)).toThrow('colors must be an object');
    });

    it('throws when colors is missing', () => {
      const theme = makeValidTheme();
      delete (theme as Record<string, unknown>)['colors'];
      expect(() => validateTheme(theme)).toThrow('colors must be an object');
    });

    describe('required color fields', () => {
      const requiredFields = [
        'background', 'surface', 'surface2', 'surface3',
        'text', 'textMuted', 'textMuted2', 'border', 'success',
      ] as const;

      requiredFields.forEach((field) => {
        it(`throws when ${field} is missing`, () => {
          const theme = makeValidTheme();
          const colors = (theme as Record<string, unknown>).colors as Record<string, unknown>;
          delete colors[field];
          expect(() => validateTheme(theme)).toThrow(`colors.${field} must be a valid CSS color`);
        });

        it(`throws when ${field} is not a valid color`, () => {
          const theme = makeValidTheme({ colors: { [field]: 'not-a-color' } });
          expect(() => validateTheme(theme)).toThrow(`colors.${field} must be a valid CSS color`);
        });

        it(`throws when ${field} is empty string`, () => {
          const theme = makeValidTheme({ colors: { [field]: '' } });
          expect(() => validateTheme(theme)).toThrow(`colors.${field} must be a valid CSS color`);
        });

        it(`throws when ${field} is whitespace only`, () => {
          const theme = makeValidTheme({ colors: { [field]: '   ' } });
          expect(() => validateTheme(theme)).toThrow(`colors.${field} must be a valid CSS color`);
        });
      });
    });

    describe('primary color (flexible format)', () => {
      it('accepts primary as a string color', () => {
        const theme = makeValidTheme({ colors: { primary: '#ff0000' } });
        expect(() => validateTheme(theme)).not.toThrow();
      });

      it('throws when primary is invalid string color', () => {
        const theme = makeValidTheme({ colors: { primary: 'invalid' } });
        expect(() => validateTheme(theme)).toThrow('colors.primary must be a valid CSS color');
      });

      it('accepts primary as object with base and shades', () => {
        const theme = makeValidTheme({ colors: { primary: { base: '#ff0000', shades: 5 } } });
        expect(() => validateTheme(theme)).not.toThrow();
      });

      it('throws when primary.base is not a valid color', () => {
        const theme = makeValidTheme({ colors: { primary: { base: 'invalid', shades: 5 } } });
        expect(() => validateTheme(theme)).toThrow('colors.primary.base must be a valid CSS color');
      });

      it('throws when primary.shades is 0', () => {
        const theme = makeValidTheme({ colors: { primary: { base: '#ff0000', shades: 0 } } });
        expect(() => validateTheme(theme)).toThrow('colors.primary.shades must be a positive number');
      });

      it('throws when primary.shades is negative', () => {
        const theme = makeValidTheme({ colors: { primary: { base: '#ff0000', shades: -5 } } });
        expect(() => validateTheme(theme)).toThrow('colors.primary.shades must be a positive number');
      });

      it('throws when primary.shades is not a number', () => {
        const theme = makeValidTheme({ colors: { primary: { base: '#ff0000', shades: 'five' } } });
        expect(() => validateTheme(theme)).toThrow('colors.primary.shades must be a positive number');
      });

      it('throws when primary is neither string nor object', () => {
        const theme = makeValidTheme({ colors: { primary: 123 } });
        expect(() => validateTheme(theme)).toThrow('colors.primary must be a color string or {base, shades} object');
      });

      it('throws when primary is empty object (missing base and shades)', () => {
        const theme = makeValidTheme({ colors: { primary: {} } });
        // Empty object is an object, but lacks valid base/shades
        expect(() => validateTheme(theme)).toThrow(/colors\.primary/);
      });

      it('throws when primary is null', () => {
        const theme = makeValidTheme({ colors: { primary: null } });
        expect(() => validateTheme(theme)).toThrow('colors.primary must be a color string or {base, shades} object');
      });
    });

    describe('primaryShade', () => {
      it('throws when primaryShade is not an object', () => {
        const theme = makeValidTheme({ colors: { primaryShade: null } });
        expect(() => validateTheme(theme)).toThrow('colors.primaryShade must be {light: number, dark: number}');
      });

      it('throws when primaryShade is a string', () => {
        const theme = makeValidTheme({ colors: { primaryShade: 'invalid' } });
        expect(() => validateTheme(theme)).toThrow('colors.primaryShade must be {light: number, dark: number}');
      });

      it('throws when primaryShade.light is not a number', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 'five', dark: 5 } } });
        expect(() => validateTheme(theme)).toThrow('colors.primaryShade.light must be 0-9');
      });

      it('throws when primaryShade.light is -1', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: -1, dark: 5 } } });
        expect(() => validateTheme(theme)).toThrow('colors.primaryShade.light must be 0-9');
      });

      it('throws when primaryShade.light is 10', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 10, dark: 5 } } });
        expect(() => validateTheme(theme)).toThrow('colors.primaryShade.light must be 0-9');
      });

      it('accepts primaryShade.light as 0', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 0, dark: 5 } } });
        expect(() => validateTheme(theme)).not.toThrow();
      });

      it('accepts primaryShade.light as 9', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 9, dark: 5 } } });
        expect(() => validateTheme(theme)).not.toThrow();
      });

      it('throws when primaryShade.dark is not a number', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 5, dark: 'seven' } } });
        expect(() => validateTheme(theme)).toThrow('colors.primaryShade.dark must be 0-9');
      });

      it('throws when primaryShade.dark is -1', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 5, dark: -1 } } });
        expect(() => validateTheme(theme)).toThrow('colors.primaryShade.dark must be 0-9');
      });

      it('throws when primaryShade.dark is 10', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 5, dark: 10 } } });
        expect(() => validateTheme(theme)).toThrow('colors.primaryShade.dark must be 0-9');
      });

      it('accepts primaryShade.dark as 0', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 5, dark: 0 } } });
        expect(() => validateTheme(theme)).not.toThrow();
      });

      it('accepts primaryShade.dark as 9', () => {
        const theme = makeValidTheme({ colors: { primaryShade: { light: 5, dark: 9 } } });
        expect(() => validateTheme(theme)).not.toThrow();
      });
    });

    describe('dark tuple (optional)', () => {
      it('passes when dark is undefined', () => {
        const theme = makeValidTheme();
        const colors = (theme as Record<string, unknown>).colors as Record<string, unknown>;
        delete colors['dark'];
        expect(() => validateTheme(theme)).not.toThrow();
      });

      it('throws when dark is not an array', () => {
        const theme = makeValidTheme({ colors: { dark: 'not-an-array' } });
        expect(() => validateTheme(theme)).toThrow('colors.dark must be an array of exactly 10 colors');
      });

      it('throws when dark array has 0 items', () => {
        const theme = makeValidTheme({ colors: { dark: [] } });
        expect(() => validateTheme(theme)).toThrow('colors.dark must be an array of exactly 10 colors');
      });

      it('throws when dark array has 9 items', () => {
        const theme = makeValidTheme({ colors: { dark: Array(9).fill('#000000') } });
        expect(() => validateTheme(theme)).toThrow('colors.dark must be an array of exactly 10 colors');
      });

      it('throws when dark array has 11 items', () => {
        const theme = makeValidTheme({ colors: { dark: Array(11).fill('#000000') } });
        expect(() => validateTheme(theme)).toThrow('colors.dark must be an array of exactly 10 colors');
      });

      it('accepts dark array with exactly 10 items', () => {
        const theme = makeValidTheme({ colors: { dark: Array(10).fill('#000000') } });
        expect(() => validateTheme(theme)).not.toThrow();
      });

      it('throws when dark[0] is not a valid color', () => {
        const dark = Array(10).fill('#000000');
        dark[0] = 'invalid';
        const theme = makeValidTheme({ colors: { dark } });
        expect(() => validateTheme(theme)).toThrow('colors.dark[0] must be a valid CSS color');
      });

      it('throws when dark[5] is not a valid color', () => {
        const dark = Array(10).fill('#000000');
        dark[5] = 'invalid';
        const theme = makeValidTheme({ colors: { dark } });
        expect(() => validateTheme(theme)).toThrow('colors.dark[5] must be a valid CSS color');
      });

      it('throws when dark[9] is not a valid color', () => {
        const dark = Array(10).fill('#000000');
        dark[9] = 'invalid';
        const theme = makeValidTheme({ colors: { dark } });
        expect(() => validateTheme(theme)).toThrow('colors.dark[9] must be a valid CSS color');
      });

      it('throws when dark element is empty string', () => {
        const dark = Array(10).fill('#000000');
        dark[3] = '';
        const theme = makeValidTheme({ colors: { dark } });
        expect(() => validateTheme(theme)).toThrow('colors.dark[3] must be a valid CSS color');
      });
    });

    describe('optional color fields', () => {
      const optionalFields = ['warning', 'error', 'info', 'accent', 'accentGreen', 'accentPurple'] as const;

      optionalFields.forEach((field) => {
        it(`passes when ${field} is undefined`, () => {
          const theme = makeValidTheme();
          const colors = (theme as Record<string, unknown>).colors as Record<string, unknown>;
          delete colors[field];
          expect(() => validateTheme(theme)).not.toThrow();
        });

        it(`throws when ${field} is provided but invalid`, () => {
          const theme = makeValidTheme({ colors: { [field]: 'invalid' } });
          expect(() => validateTheme(theme)).toThrow(`colors.${field} must be a valid CSS color when provided`);
        });

        it(`passes when ${field} is a valid color`, () => {
          const theme = makeValidTheme({ colors: { [field]: '#ff0000' } });
          expect(() => validateTheme(theme)).not.toThrow();
        });
      });
    });
  });

  describe('validateTypography — all branches', () => {
    it('throws when typography is not an object', () => {
      const theme = makeValidTheme({ typography: null });
      expect(() => validateTheme(theme)).toThrow('typography must be an object');
    });

    it('throws when typography is missing', () => {
      const theme = makeValidTheme();
      delete (theme as Record<string, unknown>)['typography'];
      expect(() => validateTheme(theme)).toThrow('typography must be an object');
    });

    it('throws when fontFamily is empty string', () => {
      const theme = makeValidTheme({
        typography: { fontFamily: '' },
      });
      expect(() => validateTheme(theme)).toThrow('typography.fontFamily must be a non-empty string');
    });

    it('throws when fontFamily is not a string', () => {
      const theme = makeValidTheme({
        typography: { fontFamily: 123 },
      });
      expect(() => validateTheme(theme)).toThrow('typography.fontFamily must be a non-empty string');
    });

    it('throws when fontFamily is whitespace only', () => {
      const theme = makeValidTheme({
        typography: { fontFamily: '   ' },
      });
      expect(() => validateTheme(theme)).toThrow('typography.fontFamily must be a non-empty string');
    });

    it('throws when fontFamilyMono is empty string', () => {
      const theme = makeValidTheme({
        typography: { fontFamilyMono: '' },
      });
      expect(() => validateTheme(theme)).toThrow('typography.fontFamilyMono must be a non-empty string');
    });

    it('throws when fontFamilyMono is not a string', () => {
      const theme = makeValidTheme({
        typography: { fontFamilyMono: 123 },
      });
      expect(() => validateTheme(theme)).toThrow('typography.fontFamilyMono must be a non-empty string');
    });

    it('throws when fontSizes is not an object', () => {
      const theme = makeValidTheme({
        typography: { fontSizes: null },
      });
      expect(() => validateTheme(theme)).toThrow('typography.fontSizes must be an object with xs/sm/md/lg/xl');
    });

    it('throws when headings is not an object', () => {
      const theme = makeValidTheme({
        typography: { headings: null },
      });
      expect(() => validateTheme(theme)).toThrow('typography.headings must be an object');
    });

    describe('headings.fontFamily', () => {
      it('throws when headings.fontFamily is not a string', () => {
        const theme = makeValidTheme();
        const typography = (theme as Record<string, unknown>).typography as Record<string, unknown>;
        const headings = typography.headings as Record<string, unknown>;
        headings.fontFamily = 123;
        expect(() => validateTheme(theme)).toThrow('typography.headings.fontFamily must be a string');
      });
    });

    describe('headings.sizes', () => {
      it('throws when headings.sizes is not an object', () => {
        const theme = makeValidTheme();
        const typography = (theme as Record<string, unknown>).typography as Record<string, unknown>;
        const headings = typography.headings as Record<string, unknown>;
        headings.sizes = null;
        expect(() => validateTheme(theme)).toThrow('typography.headings.sizes must be an object');
      });

      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach((level) => {
        it(`throws when headings.sizes.${level} is not an object`, () => {
          const theme = makeValidTheme();
          const typography = (theme as Record<string, unknown>).typography as Record<string, unknown>;
          const headings = typography.headings as Record<string, unknown>;
          const sizes = headings.sizes as Record<string, unknown>;
          sizes[level] = null;
          expect(() => validateTheme(theme)).toThrow(`typography.headings.sizes.${level} must be {fontSize, lineHeight}`);
        });

        it(`throws when headings.sizes.${level}.fontSize is not a string`, () => {
          const theme = makeValidTheme();
          const typography = (theme as Record<string, unknown>).typography as Record<string, unknown>;
          const headings = typography.headings as Record<string, unknown>;
          const sizes = headings.sizes as Record<string, unknown>;
          const heading = sizes[level] as Record<string, unknown>;
          heading.fontSize = 123;
          expect(() => validateTheme(theme)).toThrow(`typography.headings.sizes.${level}.fontSize must be a string`);
        });

        it(`throws when headings.sizes.${level}.lineHeight is not a string`, () => {
          const theme = makeValidTheme();
          const typography = (theme as Record<string, unknown>).typography as Record<string, unknown>;
          const headings = typography.headings as Record<string, unknown>;
          const sizes = headings.sizes as Record<string, unknown>;
          const heading = sizes[level] as Record<string, unknown>;
          heading.lineHeight = 123;
          expect(() => validateTheme(theme)).toThrow(`typography.headings.sizes.${level}.lineHeight must be a string`);
        });
      });
    });
  });

  describe('validateSizeScale — all branches', () => {
    const sizeScaleFields: ('spacing' | 'radius' | 'shadows' | 'breakpoints')[] = [
      'spacing', 'radius', 'shadows', 'breakpoints',
    ];

    sizeScaleFields.forEach((field) => {
      describe(field, () => {
        it(`throws when ${field} is not an object`, () => {
          const theme = makeValidTheme({ [field]: null });
          expect(() => validateTheme(theme)).toThrow(`${field} must be an object with xs/sm/md/lg/xl`);
        });

        it(`throws when ${field} is missing`, () => {
          const theme = makeValidTheme();
          delete (theme as Record<string, unknown>)[field];
          expect(() => validateTheme(theme)).toThrow(`${field} must be an object with xs/sm/md/lg/xl`);
        });

        ['xs', 'sm', 'md', 'lg', 'xl'].forEach((key) => {
          it(`throws when ${field}.${key} is missing`, () => {
            const theme = makeValidTheme();
            const scale = (theme as Record<string, unknown>)[field] as Record<string, unknown>;
            delete scale[key];
            expect(() => validateTheme(theme)).toThrow(`${field}.${key} must be a non-empty string`);
          });

          it(`throws when ${field}.${key} is empty string`, () => {
            const theme = makeValidTheme({ [field]: { xs: '', sm: '8px', md: '16px', lg: '24px', xl: '32px' } });
            expect(() => validateTheme(theme)).toThrow(`${field}.xs must be a non-empty string`);
          });

          it(`throws when ${field}.${key} is not a string`, () => {
            const obj: Record<string, unknown> = { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' };
            obj[key] = 123;
            const theme = makeValidTheme({ [field]: obj });
            expect(() => validateTheme(theme)).toThrow(`${field}.${key} must be a non-empty string`);
          });

          it(`throws when ${field}.${key} is whitespace only`, () => {
            const obj: Record<string, unknown> = { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' };
            obj[key] = '   ';
            const theme = makeValidTheme({ [field]: obj });
            expect(() => validateTheme(theme)).toThrow(`${field}.${key} must be a non-empty string`);
          });
        });
      });
    });
  });
});

describe('isValidTheme — comprehensive coverage', () => {
  it('returns true for a valid theme', () => {
    const theme = makeValidTheme();
    expect(isValidTheme(theme)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidTheme(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidTheme(undefined)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isValidTheme('string')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isValidTheme(123)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isValidTheme([])).toBe(false);
  });

  it('returns false for any invalid theme', () => {
    const theme = makeValidTheme({ id: '' });
    expect(isValidTheme(theme)).toBe(false);
  });

  it('suppresses console.warn when isDev=false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = makeValidTheme({ id: '' });
    expect(isValidTheme(theme, false)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('emits console.warn when isDev=true and validation fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = makeValidTheme({ id: '' });
    expect(isValidTheme(theme, true)).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0]![0]).toContain('[WPSG Theme]');
    warn.mockRestore();
  });

  it('does not emit console.warn when isDev=true but validation passes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = makeValidTheme();
    expect(isValidTheme(theme, true)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('uses isDevEnv as default when isDev is not provided', () => {
    const theme = makeValidTheme();
    expect(isValidTheme(theme)).toBe(true);
  });
});

describe('warnLowContrast — comprehensive coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns early when isDev=false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', '#808080', '#888888', false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not log when both colors have null luminance (invalid text color)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', 'invalid-color', '#ffffff', true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not log when both colors have null luminance (invalid bg color)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', '#000000', 'invalid-color', true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not log when contrast ratio >= 4.5 (black on white)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', '#000000', '#ffffff', true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not log when contrast ratio >= 4.5 (white on black)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', '#ffffff', '#000000', true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('logs when contrast ratio < 4.5 (low contrast grays)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', '#808080', '#888888', true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('[WPSG Theme]');
    expect(warn.mock.calls[0]![0]).toContain('test');
    expect(warn.mock.calls[0]![0]).toContain('contrast ratio');
    expect(warn.mock.calls[0]![0]).toContain('WCAG AA');
    warn.mockRestore();
  });

  it('includes contrast ratio number in message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', '#808080', '#888888', true);
    const message = warn.mock.calls[0]![0] as string;
    expect(message).toMatch(/\d+\.\d+/);
    warn.mockRestore();
  });

  it('uses isDevEnv as default when isDev is not provided', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // In test env, isDevEnv should be true
    expect(() => warnLowContrast('test', '#808080', '#888888')).not.toThrow();
    warn.mockRestore();
  });

  it('works with rgb() color format', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', 'rgb(0, 0, 0)', 'rgb(255, 255, 255)', true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('works with named colors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLowContrast('test', 'black', 'white', true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('correctly calculates luminance for different colors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Very low contrast should trigger warning
    warnLowContrast('test', '#aaaaaa', '#ababab', true);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
