/**
 * Card breakpoint configuration utilities.
 *
 * The card breakpoint model is sparse: flat top-level card settings are the
 * canonical base (desktop), and `cardConfig.breakpoints` holds optional
 * per-breakpoint overrides that cascade desktop → tablet → mobile.
 *
 * @module cardConfig
 */

import type {
  CardBreakpointOverrides,
  CardConfig,
  CardConfigBreakpoint,
  GalleryBehaviorSettings,
} from '@/types';
import { CARD_BREAKPOINT_OVERRIDE_KEYS } from '@/types';

// ── Resolver ──────────────────────────────────────────────────────────────

/**
 * Resolves the effective card settings for a given breakpoint by cascading
 * sparse overrides onto the canonical flat settings.
 *
 * Cascade order (later wins):
 *   1. Base flat settings (the incoming `settings` object).
 *   2. `cardConfig.breakpoints.desktop` overrides (if present).
 *   3. `cardConfig.breakpoints.tablet` overrides (when breakpoint is `tablet` or `mobile`).
 *   4. `cardConfig.breakpoints.mobile` overrides (when breakpoint is `mobile`).
 *
 * Returns a shallow clone of the full settings object with overrides applied,
 * so downstream code (CardGallery, CampaignCard) keeps receiving the same shape.
 */
export function resolveCardBreakpointSettings(
  settings: GalleryBehaviorSettings,
  breakpoint: CardConfigBreakpoint,
): GalleryBehaviorSettings {
  const resolved = { ...settings };
  const bp = settings.cardConfig?.breakpoints;
  if (!bp) return resolved;

  applyOverrides(resolved, bp.desktop);

  if (breakpoint === 'tablet' || breakpoint === 'mobile') {
    applyOverrides(resolved, bp.tablet);
  }

  if (breakpoint === 'mobile') {
    applyOverrides(resolved, bp.mobile);
  }

  return resolved;
}

/** Apply a sparse override object onto a mutable settings clone. */
function applyOverrides(
  target: GalleryBehaviorSettings,
  overrides: CardBreakpointOverrides | undefined,
): void {
  if (!overrides) return;
  for (const key of CARD_BREAKPOINT_OVERRIDE_KEYS) {
    if (key in overrides && overrides[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe: key is from the constrained override set
      (target as any)[key] = overrides[key];
    }
  }
}

// ── Clone / prune / parse ─────────────────────────────────────────────────

/** Deep-clone a CardConfig, producing an independent copy safe to mutate. */
export function cloneCardConfig(config: CardConfig): CardConfig {
  const clone: CardConfig = { breakpoints: {} };
  const src = config.breakpoints;
  if (!src) return clone;

  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    if (src[bp]) clone.breakpoints![bp] = { ...src[bp] };
  }
  return clone;
}

/**
 * Prune a CardConfig by removing `undefined` keys from each breakpoint
 * object and stripping breakpoint nodes that become empty.
 *
 * Important: preserves `0`, `false`, and empty-string values when they are
 * valid override values (e.g. `cardGridColumns = 0` means auto).
 */
export function pruneCardConfig(config: CardConfig): CardConfig {
  const pruned: CardConfig = { breakpoints: {} };
  const src = config.breakpoints;
  if (!src) return pruned;

  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    const layer = src[bp];
    if (!layer) continue;

    const cleaned: Record<string, unknown> = {};
    let count = 0;
    for (const key of CARD_BREAKPOINT_OVERRIDE_KEYS) {
      if (key in layer && layer[key] !== undefined) {
        cleaned[key] = layer[key];
        count++;
      }
    }
    if (count > 0) {
      pruned.breakpoints![bp] = cleaned as CardBreakpointOverrides;
    }
  }

  return pruned;
}

/**
 * Parse a JSON-string or plain-object `cardConfig` payload into a typed
 * {@link CardConfig}. Returns the default empty config on parse failure.
 */
export function parseCardConfig(input: CardConfig | string | undefined | null): CardConfig {
  if (!input) return { breakpoints: {} };
  if (typeof input === 'string') {
    try {
      const parsed: unknown = JSON.parse(input);
      if (parsed && typeof parsed === 'object') return pruneCardConfig(parsed as CardConfig);
    } catch {
      return { breakpoints: {} };
    }
  }
  return pruneCardConfig(input as CardConfig);
}

// ── Field-level accessors ─────────────────────────────────────────────────

/** Read a single override value from a specific breakpoint layer. */
export function getCardBreakpointOverride<K extends keyof CardBreakpointOverrides>(
  config: CardConfig | undefined,
  breakpoint: CardConfigBreakpoint,
  key: K,
): CardBreakpointOverrides[K] | undefined {
  return config?.breakpoints?.[breakpoint]?.[key];
}

/**
 * Set a single override value on a breakpoint layer.
 * Returns a new CardConfig (immutable update).
 */
export function setCardBreakpointOverride<K extends keyof CardBreakpointOverrides>(
  config: CardConfig,
  breakpoint: CardConfigBreakpoint,
  key: K,
  value: CardBreakpointOverrides[K],
): CardConfig {
  const cloned = cloneCardConfig(config);
  if (!cloned.breakpoints![breakpoint]) {
    cloned.breakpoints![breakpoint] = {};
  }
  (cloned.breakpoints![breakpoint] as Record<string, unknown>)[key] = value;
  return cloned;
}

/**
 * Clear a single override from a breakpoint layer.
 * Returns a new CardConfig with the key removed (and the breakpoint node
 * stripped if empty).
 */
export function clearCardBreakpointOverride<K extends keyof CardBreakpointOverrides>(
  config: CardConfig,
  breakpoint: CardConfigBreakpoint,
  key: K,
): CardConfig {
  const cloned = cloneCardConfig(config);
  const layer = cloned.breakpoints![breakpoint];
  if (layer) {
    delete (layer as Record<string, unknown>)[key];
    // Strip empty breakpoint node
    if (Object.keys(layer).length === 0) {
      delete cloned.breakpoints![breakpoint];
    }
  }
  return pruneCardConfig(cloned);
}

/**
 * Clear a dimension pair (value + unit) from a breakpoint layer in one
 * atomic operation. This prevents orphaned unit-only overrides.
 */
export function clearCardDimensionOverride(
  config: CardConfig,
  breakpoint: CardConfigBreakpoint,
  valueKey: keyof CardBreakpointOverrides,
  unitKey: keyof CardBreakpointOverrides,
): CardConfig {
  const cloned = cloneCardConfig(config);
  const layer = cloned.breakpoints![breakpoint];
  if (layer) {
    delete (layer as Record<string, unknown>)[valueKey];
    delete (layer as Record<string, unknown>)[unitKey];
    if (Object.keys(layer).length === 0) {
      delete cloned.breakpoints![breakpoint];
    }
  }
  return pruneCardConfig(cloned);
}

/**
 * Reject unit-only overrides: if a unit key is present without its
 * numeric partner in the same breakpoint layer, strip the orphaned unit.
 *
 * Call this before persisting to enforce the design rule that a unit
 * override is only meaningful alongside a numeric value override.
 */
export function rejectUnitOnlyOverrides(config: CardConfig): CardConfig {
  const DIMENSION_PAIRS: readonly [keyof CardBreakpointOverrides, keyof CardBreakpointOverrides][] = [
    ['cardMaxWidth', 'cardMaxWidthUnit'],
    ['cardGapH', 'cardGapHUnit'],
    ['cardGapV', 'cardGapVUnit'],
    ['cardThumbnailHeight', 'cardThumbnailHeightUnit'],
    ['cardMinHeight', 'cardMinHeightUnit'],
    ['cardBorderRadius', 'cardBorderRadiusUnit'],
    ['cardGalleryMinHeight', 'cardGalleryMinHeightUnit'],
    ['cardGalleryMaxHeight', 'cardGalleryMaxHeightUnit'],
    ['cardGalleryOffsetX', 'cardGalleryOffsetXUnit'],
    ['cardGalleryOffsetY', 'cardGalleryOffsetYUnit'],
  ];

  const cloned = cloneCardConfig(config);
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    const layer = cloned.breakpoints?.[bp];
    if (!layer) continue;
    for (const [valKey, unitKey] of DIMENSION_PAIRS) {
      if (unitKey in layer && !(valKey in layer)) {
        delete (layer as Record<string, unknown>)[unitKey];
      }
    }
    // Strip if now empty
    if (Object.keys(layer).length === 0) {
      delete cloned.breakpoints![bp];
    }
  }
  return cloned;
}
