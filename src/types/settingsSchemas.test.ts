import { describe, expect, it } from 'vitest';

import {
  GalleryAdapterSettingsSchema,
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

  it('drops invalid known adapter settings while preserving valid and unknown values', () => {
    const parsed = parseGalleryConfigInput({
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'compact-grid',
            adapterSettings: {
              gridCardWidth: 180,
              gridCardAspectRatio: 'not-a-ratio',
              gridCardMaxColumns: '3',
              gridCardMinHeight: 220,
              layoutBuilderScope: 'viewport',
              futureAdapterSetting: { preserve: true },
            },
          },
        },
      },
    });

    expect(parsed).toEqual({
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'compact-grid',
            adapterSettings: {
              gridCardWidth: 180,
              gridCardMinHeight: 220,
              layoutBuilderScope: 'viewport',
              futureAdapterSetting: { preserve: true },
            },
          },
        },
      },
    });
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

  it('exposes a safe adapter settings schema for direct validation', () => {
    const parsed = GalleryAdapterSettingsSchema.safeParse({
      gridCardAspectRatio: '5:7',
      gridCardMaxColumns: 4,
      gridCardMinHeight: 220,
      customFutureSetting: ['kept'],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data : undefined).toEqual({
      gridCardAspectRatio: '5:7',
      gridCardMaxColumns: 4,
      gridCardMinHeight: 220,
      customFutureSetting: ['kept'],
    });
  });
});