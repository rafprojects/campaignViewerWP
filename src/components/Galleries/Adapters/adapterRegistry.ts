/**
 * P12-C / P23-C: Gallery Adapter Registry
 *
 * Central source of truth for adapter runtime resolution and editor metadata.
 * The registry owns labels, aliases, breakpoint restrictions, setting-group
 * membership, and the component used to render each adapter.
 */
import { createElement, lazy, type ComponentType } from 'react';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import type {
  AdapterMediaScope,
  AdapterOptionContext,
  AdapterRegistration,
  AdapterSelectionUpdate,
  AdapterSettingFieldDefinition,
  AdapterSettingGroupDefinition,
  AdapterSettingGroup,
  GalleryAdapterId,
  GalleryAdapterProps,
} from './GalleryAdapter';
import type { GalleryBehaviorSettings } from '@/types';
import { CSS_BORDER_RADIUS_UNITS, CSS_HEIGHT_UNITS, CSS_SPACING_UNITS, CSS_WIDTH_UNITS } from '@/utils/cssUnits';
import { getLegacyFlatAdapterId, LEGACY_BREAKPOINT_SCOPE_KEYS, LEGACY_FLAT_SCOPE_KEYS } from '@/utils/galleryAdapterSelection';
import { MediaCarouselAdapter } from './MediaCarouselAdapter';

export interface AdapterSelectOption {
  value: GalleryAdapterId;
  label: string;
  disabled?: boolean;
}

const CompactGridGallery = lazy(() =>
  import('@/components/Galleries/Adapters/compact-grid/CompactGridGallery').then((m) => ({ default: m.CompactGridGallery })),
);
const JustifiedGallery = lazy(() =>
  import('@/components/Galleries/Adapters/justified/JustifiedGallery').then((m) => ({ default: m.JustifiedGallery })),
);
const MasonryGallery = lazy(() =>
  import('@/components/Galleries/Adapters/masonry/MasonryGallery').then((m) => ({ default: m.MasonryGallery })),
);
const HexagonalGallery = lazy(() =>
  import('@/components/Galleries/Adapters/hexagonal/HexagonalGallery').then((m) => ({ default: m.HexagonalGallery })),
);
const CircularGallery = lazy(() =>
  import('@/components/Galleries/Adapters/circular/CircularGallery').then((m) => ({ default: m.CircularGallery })),
);
const DiamondGallery = lazy(() =>
  import('@/components/Galleries/Adapters/diamond/DiamondGallery').then((m) => ({ default: m.DiamondGallery })),
);
function LayoutBuilderRegistryFallback(props: GalleryAdapterProps) {
  return createElement(MediaCarouselAdapter, props);
}

// Internal map keyed by adapter id
const registry = new Map<string, AdapterRegistration>();

const BUILTIN_ADAPTERS: AdapterRegistration[] = [
  {
    id: 'classic',
    label: 'Classic',
    aliases: ['carousel'],
    optionLabels: {
      'unified-gallery': 'Classic (Carousel)',
      'per-type-gallery': 'Classic (Carousel)',
      'per-breakpoint-gallery': 'Classic',
      'campaign-override': 'Classic Carousel',
    },
    capabilities: ['carousel-layout', 'lightbox', 'keyboard-nav', 'touch-swipe'],
    settingGroups: ['media-frame', 'carousel'],
    component: MediaCarouselAdapter,
  },
  {
    id: 'compact-grid',
    label: 'Compact Grid',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['media-frame', 'compact-grid'],
    component: CompactGridGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'justified',
    label: 'Justified',
    aliases: ['mosaic'],
    optionLabels: {
      'unified-gallery': 'Justified Rows (Flickr-style)',
      'per-type-gallery': 'Justified Rows (Flickr-style)',
      'campaign-override': 'Justified',
    },
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['media-frame', 'photo-grid', 'tile-appearance', 'justified'],
    component: JustifiedGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'masonry',
    label: 'Masonry',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['media-frame', 'photo-grid', 'tile-appearance', 'masonry'],
    component: MasonryGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'hexagonal',
    label: 'Hexagonal',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['shape', 'tile-appearance'],
    component: HexagonalGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'circular',
    label: 'Circular',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['shape', 'tile-appearance'],
    component: CircularGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'diamond',
    label: 'Diamond',
    capabilities: ['grid-layout', 'lightbox'],
    settingGroups: ['shape', 'tile-appearance'],
    component: DiamondGallery as ComponentType<GalleryAdapterProps>,
  },
  {
    id: 'layout-builder',
    label: 'Layout Builder',
    optionLabels: {
      'per-type-gallery': 'Layout Builder -> per-breakpoint',
    },
    capabilities: ['layout-builder'],
    settingGroups: ['layout-builder'],
    supportsMobile: false,
    component: LayoutBuilderRegistryFallback,
  },
];

const SETTING_GROUP_DEFINITIONS: Record<string, AdapterSettingGroupDefinition> = {
  'media-frame': {
    group: 'media-frame',
    layout: 'stack',
    fields: [
      {
        control: 'dimension',
        key: 'imageBorderRadius',
        unitKey: 'imageBorderRadiusUnit',
        label: 'Image Border Radius',
        description: 'Rounded-corner radius for image media surfaces in supported adapters.',
        appliesTo: ['unified', 'image'],
        allowedUnits: CSS_BORDER_RADIUS_UNITS,
        max: 48,
        step: 1,
        fallback: 8,
      },
      {
        control: 'dimension',
        key: 'videoBorderRadius',
        unitKey: 'videoBorderRadiusUnit',
        label: 'Video Border Radius',
        description: 'Rounded-corner radius for video media surfaces in supported adapters.',
        appliesTo: ['unified', 'video'],
        allowedUnits: CSS_BORDER_RADIUS_UNITS,
        max: 48,
        step: 1,
        fallback: 8,
      },
    ],
  },
  'photo-grid': {
    group: 'photo-grid',
    layout: 'stack',
    fields: [
      {
        control: 'number',
        key: 'thumbnailGap',
        label: 'Thumbnail Gap (px)',
        description: 'Space between items in justified and masonry gallery layouts.',
        min: 0,
        max: 48,
        step: 2,
        fallback: 6,
      },
    ],
  },
  'tile-appearance': {
    group: 'tile-appearance',
    layout: 'stack',
    fields: [
      {
        control: 'number',
        key: 'tileBorderWidth',
        label: 'Border Width (px)',
        description: 'Tile border thickness. Set 0 to disable borders.',
        min: 0,
        max: 20,
        step: 1,
        fallback: 0,
      },
      {
        control: 'text',
        key: 'tileBorderColor',
        label: 'Border Color',
        description: 'CSS color used for tile borders when border width is greater than 0.',
        fallback: '#ffffff',
        placeholder: '#ffffff',
      },
      {
        control: 'boolean',
        key: 'tileHoverBounce',
        label: 'Hover Bounce',
        description: 'Scale-up spring animation when hovering over a tile.',
        fallback: true,
      },
      {
        control: 'boolean',
        key: 'tileGlowEnabled',
        label: 'Hover Glow',
        description: 'Drop-shadow glow on hover for supported tile-based adapters.',
        fallback: false,
      },
      {
        control: 'text',
        key: 'tileGlowColor',
        label: 'Glow Color',
        description: 'CSS color used for the hover glow effect.',
        fallback: '#7c9ef8',
        placeholder: '#7c9ef8',
      },
      {
        control: 'number',
        key: 'tileGlowSpread',
        label: 'Glow Spread (px)',
        description: 'Radius of the glow effect.',
        min: 2,
        max: 60,
        step: 2,
        fallback: 12,
      },
    ],
  },
  carousel: {
    group: 'carousel',
    layout: 'stack',
    fields: [
      {
        control: 'dimension',
        key: 'imageViewportHeight',
        unitKey: 'imageViewportHeightUnit',
        label: 'Image Viewport Height',
        description: 'Base height used for image-dominant classic galleries before breakpoint scaling. Manual gallery height overrides this when the shared height mode is set to manual.',
        appliesTo: ['unified', 'image'],
        allowedUnits: CSS_HEIGHT_UNITS,
        max: 900,
        step: 10,
        fallback: 420,
      },
      {
        control: 'dimension',
        key: 'videoViewportHeight',
        unitKey: 'videoViewportHeightUnit',
        label: 'Video Viewport Height',
        description: 'Base height used for video-dominant classic galleries before breakpoint scaling. Manual gallery height overrides this when the shared height mode is set to manual.',
        appliesTo: ['unified', 'video'],
        allowedUnits: CSS_HEIGHT_UNITS,
        max: 900,
        step: 10,
        fallback: 420,
      },
      {
        control: 'select',
        key: 'imageShadowPreset',
        label: 'Image Shadow Preset',
        description: 'Box-shadow depth effect for image-dominant classic galleries.',
        appliesTo: ['unified', 'image'],
        fallback: 'subtle',
        options: [
          { value: 'none', label: 'None' },
          { value: 'subtle', label: 'Subtle' },
          { value: 'medium', label: 'Medium' },
          { value: 'strong', label: 'Strong' },
          { value: 'custom', label: 'Custom' },
        ],
      },
      {
        control: 'text',
        key: 'imageShadowCustom',
        label: 'Image Custom Shadow',
        description: 'CSS box-shadow value used when the image shadow preset is custom.',
        appliesTo: ['unified', 'image'],
        fallback: '0 2px 8px rgba(0,0,0,0.15)',
        placeholder: '0 4px 16px rgba(0,0,0,0.25)',
      },
      {
        control: 'select',
        key: 'videoShadowPreset',
        label: 'Video Shadow Preset',
        description: 'Box-shadow depth effect for video-dominant classic galleries.',
        appliesTo: ['unified', 'video'],
        fallback: 'subtle',
        options: [
          { value: 'none', label: 'None' },
          { value: 'subtle', label: 'Subtle' },
          { value: 'medium', label: 'Medium' },
          { value: 'strong', label: 'Strong' },
          { value: 'custom', label: 'Custom' },
        ],
      },
      {
        control: 'text',
        key: 'videoShadowCustom',
        label: 'Video Custom Shadow',
        description: 'CSS box-shadow value used when the video shadow preset is custom.',
        appliesTo: ['unified', 'video'],
        fallback: '0 2px 8px rgba(0,0,0,0.15)',
        placeholder: '0 4px 16px rgba(0,0,0,0.25)',
      },
      {
        control: 'number',
        key: 'carouselVisibleCards',
        label: 'Visible Cards',
        description: 'Number of slides visible at once in the carousel.',
        min: 1,
        max: 10,
        step: 1,
        fallback: 1,
      },
      {
        control: 'dimension',
        key: 'carouselGap',
        unitKey: 'carouselGapUnit',
        label: 'Slide Gap',
        description: 'Space between carousel slides.',
        allowedUnits: CSS_SPACING_UNITS,
        max: 64,
        step: 4,
        fallback: 16,
      },
      {
        control: 'boolean',
        key: 'carouselLoop',
        label: 'Loop',
        description: 'Continuously loop slides when reaching the end.',
        fallback: true,
      },
      {
        control: 'boolean',
        key: 'carouselDragEnabled',
        label: 'Drag Enabled',
        description: 'Allow dragging or swiping to navigate slides.',
        fallback: true,
      },
      {
        control: 'boolean',
        key: 'carouselAutoplay',
        label: 'Autoplay',
        description: 'Automatically advance slides.',
        fallback: false,
      },
      {
        control: 'number',
        key: 'carouselAutoplaySpeed',
        label: 'Autoplay Speed (ms)',
        description: 'Delay between automatic slide transitions.',
        min: 500,
        max: 15000,
        step: 250,
        fallback: 3000,
      },
      {
        control: 'boolean',
        key: 'carouselAutoplayPauseOnHover',
        label: 'Pause on Hover',
        description: 'Pause autoplay when the mouse hovers over the carousel.',
        fallback: true,
      },
      {
        control: 'select',
        key: 'carouselAutoplayDirection',
        label: 'Autoplay Direction',
        description: 'Direction autoplay advances slides.',
        fallback: 'ltr',
        options: [
          { value: 'ltr', label: 'Left to Right' },
          { value: 'rtl', label: 'Right to Left' },
        ],
      },
      {
        control: 'boolean',
        key: 'carouselDarkenUnfocused',
        label: 'Darken Unfocused Slides',
        description: 'Apply a dark overlay on slides that are not currently selected.',
        fallback: false,
      },
      {
        control: 'number',
        key: 'carouselDarkenOpacity',
        label: 'Darken Opacity',
        description: 'Opacity of the darken overlay (0 = transparent, 1 = fully dark).',
        min: 0,
        max: 1,
        step: 0.05,
        fallback: 0.5,
      },
      {
        control: 'boolean',
        key: 'carouselEdgeFade',
        label: 'Edge Fade',
        description: 'Fade slides at the edges of the carousel viewport.',
        fallback: false,
      },
      {
        control: 'select',
        key: 'navArrowPosition',
        label: 'Arrow Vertical Position',
        description: 'Vertical alignment of the overlay prev/next arrows.',
        fallback: 'center',
        options: [
          { value: 'top', label: 'Top' },
          { value: 'center', label: 'Center' },
          { value: 'bottom', label: 'Bottom' },
        ],
      },
      {
        control: 'number',
        key: 'navArrowSize',
        label: 'Arrow Size (px)',
        description: 'Diameter of the overlay navigation arrows.',
        min: 20,
        max: 64,
        step: 2,
        fallback: 36,
      },
      {
        control: 'text',
        key: 'navArrowColor',
        label: 'Arrow Color',
        description: 'Foreground color used for the overlay arrow icon and border.',
        fallback: '#ffffff',
        placeholder: '#ffffff',
      },
      {
        control: 'text',
        key: 'navArrowBgColor',
        label: 'Arrow Background Color',
        description: 'Background fill applied behind the overlay arrows.',
        fallback: 'rgba(0,0,0,0.45)',
        placeholder: 'rgba(0,0,0,0.45)',
      },
      {
        control: 'number',
        key: 'navArrowBorderWidth',
        label: 'Arrow Border Width (px)',
        description: 'Border thickness around the arrows (0 = none).',
        min: 0,
        max: 6,
        step: 1,
        fallback: 0,
      },
      {
        control: 'number',
        key: 'navArrowHoverScale',
        label: 'Hover Scale Factor',
        description: 'Scale factor applied when hovering the overlay arrows.',
        min: 1,
        max: 1.5,
        step: 0.05,
        fallback: 1.1,
      },
      {
        control: 'number',
        key: 'navArrowAutoHideMs',
        label: 'Auto-hide Delay (ms)',
        description: 'Show arrows on hover or interaction. 0 keeps them always visible.',
        min: 0,
        max: 10000,
        step: 500,
        fallback: 0,
      },
      {
        control: 'number',
        key: 'navArrowEdgeInset',
        label: 'Arrow Edge Inset (px)',
        description: 'Distance between the overlay arrows and the carousel edge.',
        min: 0,
        max: 48,
        step: 1,
        fallback: 8,
      },
      {
        control: 'number',
        key: 'navArrowMinHitTarget',
        label: 'Arrow Min Hit Target (px)',
        description: 'Minimum touch and click target size for the overlay arrows.',
        min: 24,
        max: 80,
        step: 1,
        fallback: 44,
      },
      {
        control: 'number',
        key: 'navArrowFadeDurationMs',
        label: 'Arrow Fade Duration (ms)',
        description: 'Fade-in and fade-out duration used when arrows auto-hide.',
        min: 0,
        max: 1000,
        step: 10,
        fallback: 200,
      },
      {
        control: 'number',
        key: 'navArrowScaleTransitionMs',
        label: 'Arrow Scale Transition (ms)',
        description: 'Hover-scale transition duration for the overlay arrows.',
        min: 0,
        max: 1000,
        step: 10,
        fallback: 150,
      },
      {
        control: 'boolean',
        key: 'dotNavEnabled',
        label: 'Enable Dot Navigator',
        description: 'Show a dot-style page indicator.',
        fallback: true,
      },
      {
        control: 'select',
        key: 'dotNavPosition',
        label: 'Dot Position',
        description: 'Where to render the dot navigator relative to the viewport.',
        fallback: 'below',
        options: [
          { value: 'below', label: 'Below Viewport' },
          { value: 'overlay-bottom', label: 'Overlay Bottom' },
          { value: 'overlay-top', label: 'Overlay Top' },
        ],
      },
      {
        control: 'number',
        key: 'dotNavSize',
        label: 'Dot Size (px)',
        description: 'Diameter of each dot.',
        min: 4,
        max: 24,
        step: 1,
        fallback: 10,
      },
      {
        control: 'number',
        key: 'dotNavMaxVisibleDots',
        label: 'Max Visible Dots',
        description: 'Maximum number of dot buttons shown before truncation inserts ellipses.',
        min: 3,
        max: 20,
        step: 1,
        fallback: 7,
      },
      {
        control: 'text',
        key: 'dotNavActiveColor',
        label: 'Active Dot Color',
        description: 'Fill color used for the active dot.',
        fallback: 'var(--wpsg-color-primary)',
        placeholder: 'var(--wpsg-color-primary)',
      },
      {
        control: 'text',
        key: 'dotNavInactiveColor',
        label: 'Inactive Dot Color',
        description: 'Fill color used for inactive dots.',
        fallback: 'rgba(128,128,128,0.4)',
        placeholder: 'rgba(128,128,128,0.4)',
      },
      {
        control: 'select',
        key: 'dotNavShape',
        label: 'Dot Shape',
        description: 'Shape of the navigation dots.',
        fallback: 'circle',
        options: [
          { value: 'circle', label: 'Circle' },
          { value: 'pill', label: 'Pill' },
          { value: 'square', label: 'Square' },
        ],
      },
      {
        control: 'number',
        key: 'dotNavSpacing',
        label: 'Dot Spacing (px)',
        description: 'Gap between dots.',
        min: 2,
        max: 20,
        step: 1,
        fallback: 6,
      },
      {
        control: 'number',
        key: 'dotNavActiveScale',
        label: 'Active Dot Scale',
        description: 'Scale multiplier applied to the active dot.',
        min: 1,
        max: 2,
        step: 0.1,
        fallback: 1.3,
      },
      {
        control: 'number',
        key: 'viewportHeightMobileRatio',
        label: 'Viewport Height Mobile Ratio',
        description: 'Fraction of the viewport height reserved for the carousel on mobile.',
        min: 0.3,
        max: 1,
        step: 0.05,
        fallback: 0.65,
      },
      {
        control: 'number',
        key: 'viewportHeightTabletRatio',
        label: 'Viewport Height Tablet Ratio',
        description: 'Fraction of the viewport height reserved for the carousel on tablet.',
        min: 0.3,
        max: 1,
        step: 0.05,
        fallback: 0.8,
      },
    ],
  },
  'compact-grid': {
    group: 'compact-grid',
    layout: 'group',
    fields: [
      {
        control: 'dimension',
        key: 'gridCardWidth',
        unitKey: 'gridCardWidthUnit',
        label: 'Card Min Width',
        description: 'Minimum width of each grid card. Grid auto-fills based on available space.',
        allowedUnits: CSS_WIDTH_UNITS,
        max: 400,
        step: 10,
        fallback: 220,
      },
      {
        control: 'dimension',
        key: 'gridCardHeight',
        unitKey: 'gridCardHeightUnit',
        label: 'Card Height',
        description: 'Fixed height of each grid card.',
        allowedUnits: CSS_HEIGHT_UNITS,
        max: 600,
        step: 10,
        fallback: 180,
      },
    ],
  },
  justified: {
    group: 'justified',
    layout: 'stack',
    fields: [
      {
        control: 'dimension',
        key: 'mosaicTargetRowHeight',
        unitKey: 'mosaicTargetRowHeightUnit',
        label: 'Target Row Height',
        description: 'Ideal height for each justified row. Rows scale slightly to fill container width while preserving aspect ratios.',
        allowedUnits: CSS_HEIGHT_UNITS,
        max: 600,
        step: 10,
        fallback: 220,
      },
      {
        control: 'dimension',
        key: 'photoNormalizeHeight',
        unitKey: 'photoNormalizeHeightUnit',
        label: 'Photo Normalize Height',
        description: 'Normalization height used to scale image dimensions before layout. Lower values produce smaller tiles.',
        allowedUnits: CSS_HEIGHT_UNITS,
        max: 800,
        step: 10,
        fallback: 300,
      },
    ],
  },
  masonry: {
    group: 'masonry',
    layout: 'stack',
    fields: [
      {
        control: 'number',
        key: 'masonryColumns',
        label: 'Masonry Columns (0 = auto)',
        description: 'Number of masonry columns. Set 0 to let the layout choose responsively (1-4 based on width).',
        min: 0,
        max: 8,
        step: 1,
        fallback: 0,
      },
      {
        control: 'text',
        key: 'masonryAutoColumnBreakpoints',
        label: 'Auto Column Breakpoints',
        description: 'Comma-separated width:columns pairs used when masonry columns are set to auto.',
        fallback: '480:2,768:3,1024:4,1280:5',
        placeholder: '480:2,768:3,1024:4,1280:5',
      },
    ],
  },
  shape: {
    group: 'shape',
    layout: 'group',
    scopeMode: 'contextual',
    fields: [
      {
        control: 'dimension',
        key: 'tileSize',
        unitKey: 'tileSizeUnit',
        label: 'Tile Size',
        description: 'Width and height of each shape tile (unified gallery).',
        appliesTo: 'unified',
        allowedUnits: CSS_WIDTH_UNITS,
        max: 400,
        step: 10,
        fallback: 150,
      },
      {
        control: 'dimension',
        key: 'imageTileSize',
        unitKey: 'imageTileSizeUnit',
        label: 'Image Tile Size',
        description: 'Shape tile size for the image gallery.',
        appliesTo: 'image',
        allowedUnits: CSS_WIDTH_UNITS,
        max: 400,
        step: 10,
        fallback: 150,
      },
      {
        control: 'dimension',
        key: 'videoTileSize',
        unitKey: 'videoTileSizeUnit',
        label: 'Video Tile Size',
        description: 'Shape tile size for the video gallery.',
        appliesTo: 'video',
        allowedUnits: CSS_WIDTH_UNITS,
        max: 400,
        step: 10,
        fallback: 150,
      },
      {
        control: 'dimension',
        key: 'tileGapX',
        unitKey: 'tileGapXUnit',
        label: 'Gap X',
        description: 'Horizontal gap between shape tiles.',
        allowedUnits: CSS_SPACING_UNITS,
        max: 60,
        step: 1,
        fallback: 8,
      },
      {
        control: 'dimension',
        key: 'tileGapY',
        unitKey: 'tileGapYUnit',
        label: 'Gap Y',
        description: 'Vertical gap between shape-tile rows.',
        allowedUnits: CSS_SPACING_UNITS,
        max: 60,
        step: 1,
        fallback: 8,
      },
    ],
  },
  'layout-builder': {
    group: 'layout-builder',
    layout: 'stack',
    placement: 'inline',
    fields: [
      {
        control: 'select',
        key: 'layoutBuilderScope',
        label: 'Layout Builder Scope',
        description: 'Full: replaces entire gallery (no thumbnail strip). Viewport: replaces only the viewport area.',
        fallback: 'full',
        size: 'xs',
        options: [
          { value: 'full', label: 'Full Gallery' },
          { value: 'viewport', label: 'Viewport Only' },
        ],
      },
      {
        control: 'color',
        key: 'tileGlowColor',
        label: 'Default Glow Color',
        description: 'Fallback glow color for slots using Hover = Glow when the slot does not override it.',
        fallback: '#7c9ef8',
      },
      {
        control: 'number',
        key: 'tileGlowSpread',
        label: 'Default Glow Spread (px)',
        description: 'Fallback glow radius for slots using Hover = Glow when the slot does not override it.',
        min: 2,
        max: 60,
        step: 2,
        fallback: 12,
      },
    ],
  },
};

for (const adapter of BUILTIN_ADAPTERS) {
  registerAdapter(adapter);
}

export function registerAdapter(reg: AdapterRegistration): void {
  registry.set(reg.id, reg);
  for (const alias of reg.aliases ?? []) {
    registry.set(alias, reg);
  }
}

/** Return all registered adapters. */
export function getRegisteredAdapters(): AdapterRegistration[] {
  return BUILTIN_ADAPTERS.map((adapter) => registry.get(adapter.id) ?? adapter);
}

export function getAdapterRegistration(id: string): AdapterRegistration | undefined {
  return registry.get(id);
}

export function normalizeAdapterId(id: string | null | undefined): GalleryAdapterId {
  if (!id) {
    return 'classic';
  }
  const normalized = registry.get(id)?.id;
  return (normalized ?? id) as GalleryAdapterId;
}

export function adapterUsesSettingGroup(id: string | null | undefined, group: AdapterSettingGroup): boolean {
  return !!getAdapterRegistration(normalizeAdapterId(id))?.settingGroups.includes(group);
}

export function anyAdapterUsesSettingGroup(ids: Array<string | null | undefined>, group: AdapterSettingGroup): boolean {
  return ids.some((id) => adapterUsesSettingGroup(id, group));
}

export function getSettingGroupDefinition(group: AdapterSettingGroup): AdapterSettingGroupDefinition | undefined {
  return SETTING_GROUP_DEFINITIONS[group];
}

export function getSettingGroupFieldDefinitions(group: AdapterSettingGroup): AdapterSettingFieldDefinition[] {
  return getSettingGroupDefinition(group)?.fields ?? [];
}

export function getActiveSettingGroupDefinitions(ids: Array<string | null | undefined>): AdapterSettingGroupDefinition[] {
  return Object.values(SETTING_GROUP_DEFINITIONS).filter((definition) => anyAdapterUsesSettingGroup(ids, definition.group));
}

export function getPerTypeAdapterSelectionUpdates(
  settings: GalleryBehaviorSettings,
  scope: AdapterMediaScope,
  requestedId: string | null | undefined,
): AdapterSelectionUpdate[] {
  const nextId = (requestedId ?? 'classic') as GalleryAdapterId;
  const flatKey = LEGACY_FLAT_SCOPE_KEYS[scope];

  if (nextId !== 'layout-builder') {
    return [{
      key: flatKey,
      value: nextId,
    }];
  }

  const otherScope: AdapterMediaScope = scope === 'image' ? 'video' : 'image';
  const currentScopeFallback = (getLegacyFlatAdapterId(settings, scope) || 'classic') as GalleryAdapterId;
  const otherScopeFallback = (getLegacyFlatAdapterId(settings, otherScope) || 'classic') as GalleryAdapterId;

  return [
    { key: 'gallerySelectionMode', value: 'per-breakpoint' },
    { key: LEGACY_BREAKPOINT_SCOPE_KEYS[scope].desktop, value: 'layout-builder' },
    { key: LEGACY_BREAKPOINT_SCOPE_KEYS[scope].tablet, value: 'layout-builder' },
    { key: LEGACY_BREAKPOINT_SCOPE_KEYS[scope].mobile, value: currentScopeFallback },
    { key: LEGACY_BREAKPOINT_SCOPE_KEYS[otherScope].desktop, value: otherScopeFallback },
    { key: LEGACY_BREAKPOINT_SCOPE_KEYS[otherScope].tablet, value: otherScopeFallback },
    { key: LEGACY_BREAKPOINT_SCOPE_KEYS[otherScope].mobile, value: otherScopeFallback },
  ];
}

export function isAdapterSupportedAtBreakpoint(id: string | null | undefined, breakpoint: Breakpoint): boolean {
  const adapter = getAdapterRegistration(normalizeAdapterId(id));
  if (!adapter) {
    return true;
  }
  if (breakpoint === 'mobile' && adapter.supportsMobile === false) {
    return false;
  }
  return true;
}

export function getAdapterSelectOptions(options: {
  context?: AdapterOptionContext;
  breakpoint?: Breakpoint;
} = {}): AdapterSelectOption[] {
  const { context = 'per-type-gallery', breakpoint } = options;

  return getRegisteredAdapters().map((adapter) => {
    const disabled = breakpoint ? !isAdapterSupportedAtBreakpoint(adapter.id, breakpoint) : false;
    let label = adapter.optionLabels?.[context] ?? adapter.label;

    if (disabled && adapter.id === 'layout-builder') {
      label = 'Layout Builder (desktop/tablet only)';
    }

    return {
      value: adapter.id,
      label,
      disabled,
    };
  });
}

/**
 * Resolve an adapter component by id.
 * Falls back to 'classic' if the requested id is not registered.
 * Throws only if 'classic' itself is not registered (should never happen).
 */
export function resolveAdapter(id: string): ComponentType<GalleryAdapterProps> {
  const found = registry.get(id);
  if (found) return found.component;

  // Hard fallback
  const classic = registry.get('classic');
  if (classic) return classic.component;

  throw new Error(
    `[WPSG] No adapter registered for id="${id}" and no "classic" fallback found.`,
  );
}
