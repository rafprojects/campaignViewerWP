import { describe, expect, it } from 'vitest';

import {
  GalleryConfigSchema,
  parseGalleryConfigInput,
  parseTypographyOverridesInput,
} from './settingsSchemas';

describe('settingsSchemas', () => {
  it('parses nested gallery config from JSON input', () => {
    const parsed = parseGalleryConfigInput(JSON.stringify({
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'classic',
            common: {
              sectionPadding: 24,
              futureSetting: 'preserved',
            },
            adapterSettings: {
              tileGapX: 12,
            },
          },
        },
      },
    }));

    expect(parsed).toEqual({
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'classic',
            common: {
              sectionPadding: 24,
              futureSetting: 'preserved',
            },
            adapterSettings: {
              tileGapX: 12,
            },
          },
        },
      },
    });
  });

  it('rejects invalid gallery config payloads', () => {
    expect(parseGalleryConfigInput('not-json')).toBeUndefined();
    expect(parseGalleryConfigInput({ mode: 'invalid-mode' })).toBeUndefined();
    expect(parseGalleryConfigInput([])).toBeUndefined();
  });

  it('parses typography overrides from JSON input', () => {
    const parsed = parseTypographyOverridesInput(JSON.stringify({
      heading: {
        fontFamily: 'Merriweather',
        fontWeight: 700,
        textTransform: 'uppercase',
      },
    }));

    expect(parsed).toEqual({
      heading: {
        fontFamily: 'Merriweather',
        fontWeight: 700,
        textTransform: 'uppercase',
      },
    });
  });

  it('rejects invalid typography override payloads', () => {
    expect(parseTypographyOverridesInput({
      heading: {
        fontWeight: '700',
      },
    })).toBeUndefined();
  });

  it('exposes a safe gallery config schema for direct validation', () => {
    const parsed = GalleryConfigSchema.safeParse({
      mode: 'unified',
      breakpoints: {
        mobile: {
          unified: {
            adapterId: 'compact-grid',
          },
        },
      },
    });

    expect(parsed.success).toBe(true);
  });
});