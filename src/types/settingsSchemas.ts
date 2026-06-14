import { z } from 'zod';

import {
  CSS_BORDER_RADIUS_UNITS,
  CSS_HEIGHT_UNITS,
  CSS_SPACING_UNITS,
  CSS_WIDTH_UNITS,
} from '@wp-super-gallery/shared-utils';

const GALLERY_CONFIG_BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
const GALLERY_CONFIG_SCOPES = ['unified', 'image', 'video'] as const;
const GALLERY_CONFIG_MODES = ['unified', 'per-type'] as const;
const VIEWPORT_BG_TYPES = ['none', 'solid', 'gradient', 'image'] as const;
const SECTION_HEIGHT_MODES = ['auto', 'manual', 'viewport'] as const;
const ADAPTER_SIZING_MODES = ['fill', 'manual'] as const;
const ADAPTER_JUSTIFY_CONTENT_OPTIONS = ['start', 'center', 'end', 'space-between', 'space-evenly', 'stretch'] as const;
const GALLERY_SIZING_MODES = ['auto', 'viewport', 'manual'] as const;
const GALLERY_LABEL_JUSTIFICATIONS = ['left', 'center', 'right'] as const;
const FONT_STYLES = ['normal', 'italic', 'oblique'] as const;
const TEXT_TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'] as const;
const TEXT_DECORATIONS = ['none', 'underline', 'overline', 'line-through'] as const;
const SHADOW_PRESETS = ['none', 'subtle', 'medium', 'strong', 'custom'] as const;
const NAV_ARROW_POSITIONS = ['top', 'center', 'bottom'] as const;
const DOT_NAV_POSITIONS = ['below', 'overlay-bottom', 'overlay-top'] as const;
const DOT_NAV_SHAPES = ['circle', 'pill', 'square'] as const;
const CAROUSEL_AUTOPLAY_DIRECTIONS = ['ltr', 'rtl'] as const;
const LAYOUT_BUILDER_SCOPES = ['full', 'viewport'] as const;
const GRID_CARD_ASPECT_RATIOS = ['auto', '16:9', '4:3', '1:1', '3:4', '9:16', '2:3', '3:2', '21:9', '5:7'] as const;
// P31-G: masonry entrance animation values
const MASONRY_ENTRANCE_ANIMATIONS = ['none', 'waterfall'] as const;
// P31-F: scroll-snap CSS snap-align values
const SCROLL_SNAP_ALIGNMENTS = ['start', 'center', 'end'] as const;
// P31-E: spotlight strip placement options
const SPOTLIGHT_STRIP_POSITIONS = ['below', 'right'] as const;
// P51-E: spotlight hero horizontal justification
const SPOTLIGHT_HERO_JUSTIFICATIONS = ['start', 'center', 'end'] as const;

const optionalFiniteNumber = z.number().finite().optional().catch(undefined);
const optionalBoolean = z.boolean().optional().catch(undefined);
const optionalString = z.string().optional().catch(undefined);

function optionalEnum<T extends string>(values: readonly T[]) {
  return z.custom<T>(
    (value): value is T => typeof value === 'string' && values.includes(value as T),
  ).optional().catch(undefined);
}

function pruneUndefinedKeys<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

export const TypographyOverrideSchema = z.object({
  fontFamily: z.string().optional(),
  fontFallback1: z.string().optional(),
  fontFallback2: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.number().finite().optional(),
  fontStyle: z.enum(FONT_STYLES).optional(),
  textTransform: z.enum(TEXT_TRANSFORMS).optional(),
  textDecoration: z.enum(TEXT_DECORATIONS).optional(),
  lineHeight: z.number().finite().optional(),
  letterSpacing: z.string().optional(),
  wordSpacing: z.string().optional(),
  color: z.string().optional(),
  textStrokeWidth: z.string().optional(),
  textStrokeColor: z.string().optional(),
  textShadowOffsetX: z.string().optional(),
  textShadowOffsetY: z.string().optional(),
  textShadowBlur: z.string().optional(),
  textShadowColor: z.string().optional(),
  textGlowColor: z.string().optional(),
  textGlowBlur: z.string().optional(),
});

export const TypographyOverridesSchema = z.record(z.string(), TypographyOverrideSchema);

export const GalleryCommonSettingsSchema = z.object({
  sectionMaxWidth: z.number().finite().optional(),
  sectionMaxWidthUnit: z.enum(CSS_WIDTH_UNITS).optional(),
  sectionMaxHeight: z.number().finite().optional(),
  sectionMaxHeightUnit: z.enum(CSS_HEIGHT_UNITS).optional(),
  sectionMinWidth: z.number().finite().optional(),
  sectionMinWidthUnit: z.enum(CSS_WIDTH_UNITS).optional(),
  sectionMinHeight: z.number().finite().optional(),
  sectionMinHeightUnit: z.enum(CSS_HEIGHT_UNITS).optional(),
  sectionHeightMode: z.enum(SECTION_HEIGHT_MODES).optional(),
  sectionPadding: z.number().finite().optional(),
  sectionPaddingUnit: z.enum(CSS_SPACING_UNITS).optional(),
  adapterContentPadding: z.number().finite().optional(),
  adapterContentPaddingUnit: z.enum(CSS_SPACING_UNITS).optional(),
  adapterSizingMode: z.enum(ADAPTER_SIZING_MODES).optional(),
  adapterMaxWidthPct: z.number().finite().optional(),
  adapterMaxHeightPct: z.number().finite().optional(),
  adapterItemGap: z.number().finite().optional(),
  adapterItemGapUnit: z.enum(CSS_SPACING_UNITS).optional(),
  adapterJustifyContent: z.enum(ADAPTER_JUSTIFY_CONTENT_OPTIONS).optional(),
  gallerySizingMode: z.enum(GALLERY_SIZING_MODES).optional(),
  galleryManualHeight: z.string().optional(),
  viewportBgType: z.enum(VIEWPORT_BG_TYPES).optional(),
  viewportBgColor: z.string().optional(),
  viewportBgGradient: z.string().optional(),
  viewportBgImageUrl: z.string().optional(),
  perTypeSectionEqualHeight: z.boolean().optional(),
  galleryImageLabel: z.string().optional(),
  galleryVideoLabel: z.string().optional(),
  galleryLabelJustification: z.enum(GALLERY_LABEL_JUSTIFICATIONS).optional(),
  showGalleryLabelIcon: z.boolean().optional(),
  showCampaignGalleryLabels: z.boolean().optional(),
  // Forward-compat: future common settings added server-side pass through without
  // breaking validation. Known keys above are strictly typed.
}).catchall(z.unknown());

export const GalleryAdapterSettingsSchema = z.object({
  gridCardWidth: optionalFiniteNumber,
  gridCardAspectRatio: optionalEnum(GRID_CARD_ASPECT_RATIOS),
  gridCardMaxColumns: optionalFiniteNumber,
  gridCardMinHeight: optionalFiniteNumber,
  gridCardWidthUnit: optionalEnum(CSS_WIDTH_UNITS),
  gridCardHeight: optionalFiniteNumber,
  gridCardHeightUnit: optionalEnum(CSS_HEIGHT_UNITS),
  mosaicTargetRowHeight: optionalFiniteNumber,
  mosaicTargetRowHeightUnit: optionalEnum(CSS_HEIGHT_UNITS),
  photoNormalizeHeight: optionalFiniteNumber,
  photoNormalizeHeightUnit: optionalEnum(CSS_HEIGHT_UNITS),
  masonryColumns: optionalFiniteNumber,
  masonryAutoColumnBreakpoints: optionalString,
  // P31-G: Masonry entrance animation
  masonryEntranceAnimation: optionalEnum(MASONRY_ENTRANCE_ANIMATIONS),
  masonryEntranceStagger: optionalFiniteNumber,
  // P31-F: Vertical Scroll Snap adapter
  scrollSnapAlignment: optionalEnum(SCROLL_SNAP_ALIGNMENTS),
  scrollSnapPageIndicator: optionalBoolean,
  scrollSnapMaxWidth: optionalFiniteNumber,
  scrollSnapMaxWidthUnit: optionalEnum(CSS_WIDTH_UNITS),
  // P31-E: Spotlight / Hero adapter
  spotlightHeroAspectRatio: optionalString,
  spotlightThumbnailSize: optionalFiniteNumber,
  spotlightThumbnailSizeUnit: optionalEnum(CSS_WIDTH_UNITS),
  spotlightTransitionDuration: optionalFiniteNumber,
  spotlightStripPosition: optionalEnum(SPOTLIGHT_STRIP_POSITIONS),
  spotlightHeroMaxWidth: optionalFiniteNumber,
  spotlightHeroMaxWidthUnit: optionalEnum(CSS_WIDTH_UNITS),
  spotlightHeroJustification: optionalEnum(SPOTLIGHT_HERO_JUSTIFICATIONS),
  imageViewportHeight: optionalFiniteNumber,
  imageViewportHeightUnit: optionalEnum(CSS_HEIGHT_UNITS),
  videoViewportHeight: optionalFiniteNumber,
  videoViewportHeightUnit: optionalEnum(CSS_HEIGHT_UNITS),
  imageBorderRadius: optionalFiniteNumber,
  imageBorderRadiusUnit: optionalEnum(CSS_BORDER_RADIUS_UNITS),
  videoBorderRadius: optionalFiniteNumber,
  videoBorderRadiusUnit: optionalEnum(CSS_BORDER_RADIUS_UNITS),
  thumbnailGap: optionalFiniteNumber,
  tileSize: optionalFiniteNumber,
  tileSizeUnit: optionalEnum(CSS_WIDTH_UNITS),
  imageTileSize: optionalFiniteNumber,
  imageTileSizeUnit: optionalEnum(CSS_WIDTH_UNITS),
  videoTileSize: optionalFiniteNumber,
  videoTileSizeUnit: optionalEnum(CSS_WIDTH_UNITS),
  layoutBuilderScope: optionalEnum(LAYOUT_BUILDER_SCOPES),
  tileGapX: optionalFiniteNumber,
  tileGapXUnit: optionalEnum(CSS_SPACING_UNITS),
  tileGapY: optionalFiniteNumber,
  tileGapYUnit: optionalEnum(CSS_SPACING_UNITS),
  tileBorderWidth: optionalFiniteNumber,
  tileBorderColor: optionalString,
  tileGlowEnabled: optionalBoolean,
  tileGlowColor: optionalString,
  tileGlowSpread: optionalFiniteNumber,
  tileHoverBounce: optionalBoolean,
  carouselVisibleCards: optionalFiniteNumber,
  carouselAutoplay: optionalBoolean,
  carouselAutoplaySpeed: optionalFiniteNumber,
  carouselAutoplayPauseOnHover: optionalBoolean,
  carouselAutoplayDirection: optionalEnum(CAROUSEL_AUTOPLAY_DIRECTIONS),
  carouselDragEnabled: optionalBoolean,
  carouselDarkenUnfocused: optionalBoolean,
  carouselDarkenOpacity: optionalFiniteNumber,
  carouselEdgeFade: optionalBoolean,
  carouselLoop: optionalBoolean,
  carouselGap: optionalFiniteNumber,
  carouselGapUnit: optionalEnum(CSS_SPACING_UNITS),
  navArrowPosition: optionalEnum(NAV_ARROW_POSITIONS),
  navArrowSize: optionalFiniteNumber,
  navArrowColor: optionalString,
  navArrowBgColor: optionalString,
  navArrowBorderWidth: optionalFiniteNumber,
  navArrowHoverScale: optionalFiniteNumber,
  navArrowAutoHideMs: optionalFiniteNumber,
  navArrowEdgeInset: optionalFiniteNumber,
  navArrowMinHitTarget: optionalFiniteNumber,
  navArrowFadeDurationMs: optionalFiniteNumber,
  navArrowScaleTransitionMs: optionalFiniteNumber,
  dotNavEnabled: optionalBoolean,
  dotNavPosition: optionalEnum(DOT_NAV_POSITIONS),
  dotNavSize: optionalFiniteNumber,
  dotNavMaxVisibleDots: optionalFiniteNumber,
  dotNavActiveColor: optionalString,
  dotNavInactiveColor: optionalString,
  dotNavShape: optionalEnum(DOT_NAV_SHAPES),
  dotNavSpacing: optionalFiniteNumber,
  dotNavActiveScale: optionalFiniteNumber,
  viewportHeightMobileRatio: optionalFiniteNumber,
  viewportHeightTabletRatio: optionalFiniteNumber,
  imageShadowPreset: optionalEnum(SHADOW_PRESETS),
  imageShadowCustom: optionalString,
  videoShadowPreset: optionalEnum(SHADOW_PRESETS),
  videoShadowCustom: optionalString,
  // Forward-compat: adapter-specific settings not listed above pass through unchanged.
  // Adapters are open-ended by design; unknown keys are preserved as-is.
}).catchall(z.unknown()).transform(pruneUndefinedKeys);

export const GalleryScopeConfigSchema = z.object({
  adapterId: z.string().optional(),
  common: GalleryCommonSettingsSchema.optional(),
  adapterSettings: GalleryAdapterSettingsSchema.optional(),
});

export const BreakpointGalleryConfigSchema = z.object({
  unified: GalleryScopeConfigSchema.optional(),
  image: GalleryScopeConfigSchema.optional(),
  video: GalleryScopeConfigSchema.optional(),
});

export const GalleryConfigSchema = z.object({
  mode: z.enum(GALLERY_CONFIG_MODES).optional(),
  breakpoints: z.object({
    desktop: BreakpointGalleryConfigSchema.optional(),
    tablet: BreakpointGalleryConfigSchema.optional(),
    mobile: BreakpointGalleryConfigSchema.optional(),
  }).partial().optional(),
});

export type ParsedTypographyOverride = z.infer<typeof TypographyOverrideSchema>;
export type ParsedTypographyOverrides = z.infer<typeof TypographyOverridesSchema>;
export type ParsedGalleryCommonSettings = z.infer<typeof GalleryCommonSettingsSchema>;
export type ParsedGalleryAdapterSettings = z.infer<typeof GalleryAdapterSettingsSchema>;
export type ParsedGalleryScopeConfig = z.infer<typeof GalleryScopeConfigSchema>;
export type ParsedBreakpointGalleryConfig = z.infer<typeof BreakpointGalleryConfigSchema>;
export type ParsedGalleryConfig = z.infer<typeof GalleryConfigSchema>;

function normalizeJsonInput(input: unknown): unknown {
  if (typeof input !== 'string') {
    return input;
  }

  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

export function parseTypographyOverridesInput(input: unknown): ParsedTypographyOverrides | undefined {
  if (input === undefined || input === null || input === '') {
    return undefined;
  }

  const parsed = TypographyOverridesSchema.safeParse(normalizeJsonInput(input));
  return parsed.success ? parsed.data : undefined;
}

export function parseGalleryConfigInput(input: unknown): ParsedGalleryConfig | undefined {
  if (input === undefined || input === null || input === '') {
    return undefined;
  }

  const parsed = GalleryConfigSchema.safeParse(normalizeJsonInput(input));
  return parsed.success ? parsed.data : undefined;
}

export { GALLERY_CONFIG_BREAKPOINTS, GALLERY_CONFIG_SCOPES };