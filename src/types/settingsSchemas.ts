import { z } from 'zod';

import {
  CSS_HEIGHT_UNITS,
  CSS_SPACING_UNITS,
  CSS_WIDTH_UNITS,
} from '@/utils/cssUnits';

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
}).catchall(z.unknown());

export const GalleryScopeConfigSchema = z.object({
  adapterId: z.string().optional(),
  common: GalleryCommonSettingsSchema.optional(),
  adapterSettings: z.record(z.string(), z.unknown()).optional(),
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