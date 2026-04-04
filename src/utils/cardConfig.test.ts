import { describe, it, expect } from 'vitest';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import type { CardConfig, GalleryBehaviorSettings } from '@/types';
import {
  resolveCardBreakpointSettings,
  cloneCardConfig,
  pruneCardConfig,
  parseCardConfig,
  getCardBreakpointOverride,
  setCardBreakpointOverride,
  clearCardBreakpointOverride,
  clearCardDimensionOverride,
  rejectUnitOnlyOverrides,
} from './cardConfig';

/** Build a full settings object with optional overrides. */
function makeSettings(overrides?: Partial<GalleryBehaviorSettings>): GalleryBehaviorSettings {
  return { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, ...overrides };
}

// ── Resolver tests ────────────────────────────────────────────────────────

describe('resolveCardBreakpointSettings', () => {
  it('returns base settings when cardConfig has no breakpoints', () => {
    const settings = makeSettings({ cardGridColumns: 3 });
    const resolved = resolveCardBreakpointSettings(settings, 'desktop');
    expect(resolved.cardGridColumns).toBe(3);
    expect(resolved).not.toBe(settings); // shallow clone
  });

  it('ignores desktop overrides for desktop breakpoint (flat fields are canonical)', () => {
    const settings = makeSettings({
      cardGridColumns: 3,
      cardConfig: {
        breakpoints: {
          desktop: { cardGridColumns: 4 },
        },
      },
    });
    // Desktop nested override should NOT win over flat base
    expect(resolveCardBreakpointSettings(settings, 'desktop').cardGridColumns).toBe(3);
  });

  it('applies tablet override for tablet breakpoint (desktop overrides ignored)', () => {
    const settings = makeSettings({
      cardGapH: 16,
      cardConfig: {
        breakpoints: {
          desktop: { cardGapH: 20 },
          tablet: { cardGapH: 12 },
        },
      },
    });
    // tablet gets tablet overlay only; desktop nested override is skipped
    const resolved = resolveCardBreakpointSettings(settings, 'tablet');
    expect(resolved.cardGapH).toBe(12);
  });

  it('cascades tablet → mobile for mobile breakpoint (desktop overrides ignored)', () => {
    const settings = makeSettings({
      cardGapH: 16,
      cardConfig: {
        breakpoints: {
          desktop: { cardGapH: 20 },
          tablet: { cardGapH: 12 },
          mobile: { cardGapH: 8 },
        },
      },
    });
    expect(resolveCardBreakpointSettings(settings, 'mobile').cardGapH).toBe(8);
  });

  it('inherits from tablet when no mobile override exists', () => {
    const settings = makeSettings({
      cardGapH: 16,
      cardConfig: {
        breakpoints: {
          tablet: { cardGapH: 12 },
        },
      },
    });
    expect(resolveCardBreakpointSettings(settings, 'mobile').cardGapH).toBe(12);
  });

  it('ignores desktop overrides for mobile when no tablet override exists', () => {
    const settings = makeSettings({
      cardMaxWidth: 300,
      cardConfig: {
        breakpoints: {
          desktop: { cardMaxWidth: 400 },
        },
      },
    });
    // Desktop nested override is ignored — mobile falls through to flat base
    expect(resolveCardBreakpointSettings(settings, 'mobile').cardMaxWidth).toBe(300);
  });

  it('preserves explicit zero as an override (not treated as unset)', () => {
    const settings = makeSettings({
      cardGridColumns: 3,
      cardConfig: {
        breakpoints: {
          tablet: { cardGridColumns: 0 },
        },
      },
    });
    const resolved = resolveCardBreakpointSettings(settings, 'tablet');
    expect(resolved.cardGridColumns).toBe(0); // 0 = auto, must not fall back to 3
  });

  it('does not apply tablet overrides for desktop breakpoint', () => {
    const settings = makeSettings({
      cardGapH: 16,
      cardConfig: {
        breakpoints: {
          tablet: { cardGapH: 8 },
        },
      },
    });
    expect(resolveCardBreakpointSettings(settings, 'desktop').cardGapH).toBe(16);
  });

  it('does not apply mobile overrides for tablet breakpoint', () => {
    const settings = makeSettings({
      cardGapV: 16,
      cardConfig: {
        breakpoints: {
          mobile: { cardGapV: 4 },
        },
      },
    });
    expect(resolveCardBreakpointSettings(settings, 'tablet').cardGapV).toBe(16);
  });

  it('handles value-only override (inherits unit from base)', () => {
    const settings = makeSettings({
      cardMaxWidth: 400,
      cardMaxWidthUnit: 'px',
      cardConfig: {
        breakpoints: {
          tablet: { cardMaxWidth: 90 },
          // No cardMaxWidthUnit override — inherits 'px' from base
        },
      },
    });
    const resolved = resolveCardBreakpointSettings(settings, 'tablet');
    expect(resolved.cardMaxWidth).toBe(90);
    expect(resolved.cardMaxWidthUnit).toBe('px');
  });

  it('handles value + unit override together', () => {
    const settings = makeSettings({
      cardMaxWidth: 400,
      cardMaxWidthUnit: 'px',
      cardConfig: {
        breakpoints: {
          tablet: { cardMaxWidth: 90, cardMaxWidthUnit: '%' },
        },
      },
    });
    const resolved = resolveCardBreakpointSettings(settings, 'tablet');
    expect(resolved.cardMaxWidth).toBe(90);
    expect(resolved.cardMaxWidthUnit).toBe('%');
  });

  it('ignores undefined override keys', () => {
    const settings = makeSettings({
      cardGapH: 16,
      cardConfig: {
        breakpoints: {
          tablet: { cardGapH: undefined } as CardConfig['breakpoints'] extends infer T ? T extends Record<string, infer V> ? V : never : never,
        },
      },
    });
    // undefined should not overwrite the base
    const resolved = resolveCardBreakpointSettings(settings, 'tablet');
    expect(resolved.cardGapH).toBe(16);
  });

  it('does not mutate the original settings object', () => {
    const settings = makeSettings({
      cardGridColumns: 3,
      cardConfig: {
        breakpoints: {
          tablet: { cardGridColumns: 5 },
        },
      },
    });
    resolveCardBreakpointSettings(settings, 'tablet');
    expect(settings.cardGridColumns).toBe(3); // original unchanged
  });
});

// ── Clone / prune / parse tests ──────────────────────────────────────────

describe('cloneCardConfig', () => {
  it('produces an independent deep copy', () => {
    const config: CardConfig = {
      breakpoints: {
        tablet: { cardGapH: 12 },
      },
    };
    const clone = cloneCardConfig(config);
    clone.breakpoints!.tablet!.cardGapH = 999;
    expect(config.breakpoints!.tablet!.cardGapH).toBe(12); // original unchanged
  });
});

describe('pruneCardConfig', () => {
  it('removes undefined keys', () => {
    const config: CardConfig = {
      breakpoints: {
        tablet: { cardGapH: 12, cardGapV: undefined } as any,
      },
    };
    const pruned = pruneCardConfig(config);
    expect(pruned.breakpoints!.tablet).toEqual({ cardGapH: 12 });
  });

  it('preserves explicit zero', () => {
    const config: CardConfig = {
      breakpoints: {
        tablet: { cardGridColumns: 0 },
      },
    };
    const pruned = pruneCardConfig(config);
    expect(pruned.breakpoints!.tablet!.cardGridColumns).toBe(0);
  });

  it('strips empty breakpoint nodes', () => {
    const config: CardConfig = {
      breakpoints: {
        tablet: { cardGapH: undefined } as any,
      },
    };
    const pruned = pruneCardConfig(config);
    expect(pruned.breakpoints!.tablet).toBeUndefined();
  });

  it('strips unknown keys', () => {
    const config: CardConfig = {
      breakpoints: {
        mobile: { cardGapH: 8, bogusKey: 123 } as any,
      },
    };
    const pruned = pruneCardConfig(config);
    expect(pruned.breakpoints!.mobile).toEqual({ cardGapH: 8 });
    expect((pruned.breakpoints!.mobile as any).bogusKey).toBeUndefined();
  });
});

describe('parseCardConfig', () => {
  it('handles null/undefined', () => {
    expect(parseCardConfig(null)).toEqual({ breakpoints: {} });
    expect(parseCardConfig(undefined)).toEqual({ breakpoints: {} });
  });

  it('parses a JSON string', () => {
    const json = JSON.stringify({ breakpoints: { tablet: { cardGapH: 8 } } });
    const parsed = parseCardConfig(json);
    expect(parsed.breakpoints!.tablet!.cardGapH).toBe(8);
  });

  it('handles invalid JSON gracefully', () => {
    expect(parseCardConfig('not-json')).toEqual({ breakpoints: {} });
  });

  it('passes through object input', () => {
    const config: CardConfig = { breakpoints: { mobile: { cardScale: 0.9 } } };
    const parsed = parseCardConfig(config);
    expect(parsed.breakpoints!.mobile!.cardScale).toBe(0.9);
  });
});

// ── Field-level accessor tests ────────────────────────────────────────────

describe('getCardBreakpointOverride', () => {
  it('reads an existing override', () => {
    const config: CardConfig = {
      breakpoints: { tablet: { cardGapH: 12 } },
    };
    expect(getCardBreakpointOverride(config, 'tablet', 'cardGapH')).toBe(12);
  });

  it('returns undefined for missing override', () => {
    const config: CardConfig = { breakpoints: {} };
    expect(getCardBreakpointOverride(config, 'mobile', 'cardGapH')).toBeUndefined();
  });

  it('returns undefined for undefined config', () => {
    expect(getCardBreakpointOverride(undefined, 'desktop', 'cardGapH')).toBeUndefined();
  });
});

describe('setCardBreakpointOverride', () => {
  it('sets a value on an existing breakpoint layer', () => {
    const config: CardConfig = { breakpoints: { tablet: { cardGapH: 12 } } };
    const next = setCardBreakpointOverride(config, 'tablet', 'cardGapV', 10);
    expect(next.breakpoints!.tablet!.cardGapH).toBe(12);
    expect(next.breakpoints!.tablet!.cardGapV).toBe(10);
    // Immutable
    expect(config.breakpoints!.tablet!.cardGapV).toBeUndefined();
  });

  it('creates a breakpoint layer if missing', () => {
    const config: CardConfig = { breakpoints: {} };
    const next = setCardBreakpointOverride(config, 'mobile', 'cardScale', 0.8);
    expect(next.breakpoints!.mobile!.cardScale).toBe(0.8);
  });
});

describe('clearCardBreakpointOverride', () => {
  it('removes a single override key', () => {
    const config: CardConfig = { breakpoints: { tablet: { cardGapH: 12, cardGapV: 10 } } };
    const next = clearCardBreakpointOverride(config, 'tablet', 'cardGapH');
    expect(next.breakpoints!.tablet!.cardGapH).toBeUndefined();
    expect(next.breakpoints!.tablet!.cardGapV).toBe(10);
  });

  it('strips empty breakpoint node after last key removed', () => {
    const config: CardConfig = { breakpoints: { tablet: { cardGapH: 12 } } };
    const next = clearCardBreakpointOverride(config, 'tablet', 'cardGapH');
    expect(next.breakpoints!.tablet).toBeUndefined();
  });
});

describe('clearCardDimensionOverride', () => {
  it('removes both value and unit keys together', () => {
    const config: CardConfig = {
      breakpoints: {
        tablet: { cardMaxWidth: 300, cardMaxWidthUnit: '%', cardGapH: 10 },
      },
    };
    const next = clearCardDimensionOverride(config, 'tablet', 'cardMaxWidth', 'cardMaxWidthUnit');
    expect(next.breakpoints!.tablet!.cardMaxWidth).toBeUndefined();
    expect(next.breakpoints!.tablet!.cardMaxWidthUnit).toBeUndefined();
    expect(next.breakpoints!.tablet!.cardGapH).toBe(10);
  });
});

// ── Unit-only rejection tests ─────────────────────────────────────────────

describe('rejectUnitOnlyOverrides', () => {
  it('strips a unit override when the numeric value is absent', () => {
    const config: CardConfig = {
      breakpoints: {
        tablet: { cardMaxWidthUnit: '%' } as any,
      },
    };
    const cleaned = rejectUnitOnlyOverrides(config);
    expect(cleaned.breakpoints!.tablet).toBeUndefined(); // only key removed → node stripped
  });

  it('preserves a unit override when the numeric value is also present', () => {
    const config: CardConfig = {
      breakpoints: {
        tablet: { cardMaxWidth: 90, cardMaxWidthUnit: '%' },
      },
    };
    const cleaned = rejectUnitOnlyOverrides(config);
    expect(cleaned.breakpoints!.tablet).toEqual({ cardMaxWidth: 90, cardMaxWidthUnit: '%' });
  });

  it('preserves zero numeric value alongside a unit override', () => {
    const config: CardConfig = {
      breakpoints: {
        mobile: { cardGalleryMinHeight: 0, cardGalleryMinHeightUnit: 'vh' },
      },
    };
    const cleaned = rejectUnitOnlyOverrides(config);
    expect(cleaned.breakpoints!.mobile!.cardGalleryMinHeight).toBe(0);
    expect(cleaned.breakpoints!.mobile!.cardGalleryMinHeightUnit).toBe('vh');
  });

  it('strips orphaned unit across multiple dimension pairs', () => {
    const config: CardConfig = {
      breakpoints: {
        tablet: {
          cardGapHUnit: 'rem',       // orphaned — no cardGapH
          cardGapV: 8,               // valid alone
          cardMaxWidthUnit: '%',     // orphaned — no cardMaxWidth
        } as any,
      },
    };
    const cleaned = rejectUnitOnlyOverrides(config);
    expect(cleaned.breakpoints!.tablet).toEqual({ cardGapV: 8 });
  });
});
