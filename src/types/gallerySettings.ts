/**
 * Gallery configuration, runtime resolution, and behaviour/card settings.
 *
 * Split out of the former monolithic `types/index.ts` (Phase 70-G) and
 * re-exported from `./index`, so every existing `@/types` import is unchanged.
 */

/** Shared breakpoint label used across gallery, card, and hook code. */
export type ResponsiveBreakpoint = 'desktop' | 'tablet' | 'mobile';

export type GalleryConfigBreakpoint = ResponsiveBreakpoint;
export type CardConfigBreakpoint = ResponsiveBreakpoint;

export type GalleryConfigScope = 'unified' | 'image' | 'video';

export type GalleryConfigMode = 'unified' | 'per-type';

export interface GalleryCommonSettings {
  sectionMaxWidth?: number | undefined;
  sectionMaxWidthUnit?: import('@wp-super-gallery/shared-utils').CssWidthUnit | undefined;
  sectionMaxHeight?: number | undefined;
  sectionMaxHeightUnit?: import('@wp-super-gallery/shared-utils').CssHeightUnit | undefined;
  sectionMinWidth?: number | undefined;
  sectionMinWidthUnit?: import('@wp-super-gallery/shared-utils').CssWidthUnit | undefined;
  sectionMinHeight?: number | undefined;
  sectionMinHeightUnit?: import('@wp-super-gallery/shared-utils').CssHeightUnit | undefined;
  sectionHeightMode?: 'auto' | 'manual' | 'viewport' | undefined;
  sectionPadding?: number | undefined;
  sectionPaddingUnit?: import('@wp-super-gallery/shared-utils').CssSpacingUnit | undefined;
  adapterContentPadding?: number | undefined;
  adapterContentPaddingUnit?: import('@wp-super-gallery/shared-utils').CssSpacingUnit | undefined;
  adapterSizingMode?: 'fill' | 'manual' | undefined;
  adapterMaxWidthPct?: number | undefined;
  adapterMaxHeightPct?: number | undefined;
  adapterItemGap?: number | undefined;
  adapterItemGapUnit?: import('@wp-super-gallery/shared-utils').CssSpacingUnit | undefined;
  adapterJustifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly' | 'stretch' | undefined;
  gallerySizingMode?: 'auto' | 'viewport' | 'manual' | undefined;
  galleryManualHeight?: string | undefined;
  viewportBgType?: ViewportBgType | undefined;
  viewportBgColor?: string | undefined;
  viewportBgGradient?: string | undefined;
  viewportBgImageUrl?: string | undefined;
  perTypeSectionEqualHeight?: boolean | undefined;
  galleryImageLabel?: string | undefined;
  galleryVideoLabel?: string | undefined;
  galleryLabelJustification?: 'left' | 'center' | 'right' | undefined;
  showGalleryLabelIcon?: boolean | undefined;
  showCampaignGalleryLabels?: boolean | undefined;
}

export interface GalleryScopeConfig {
  adapterId?: string | undefined;
  common?: GalleryCommonSettings | undefined;
  adapterSettings?: Record<string, unknown> | undefined;
}

export type BreakpointGalleryConfig = Partial<Record<GalleryConfigScope, GalleryScopeConfig>>;

export interface GalleryConfig {
  mode?: GalleryConfigMode | undefined;
  breakpoints?: Partial<Record<GalleryConfigBreakpoint, BreakpointGalleryConfig>> | undefined;
}

export interface ResolvedGallerySectionBackground {
  type: ViewportBgType;
  color: string;
  gradient: string;
  imageUrl: string;
}

export interface ResolvedGallerySectionRuntime {
  breakpoint: ResponsiveBreakpoint;
  scope: GalleryConfigScope;
  common: GalleryCommonSettings;
  background: ResolvedGallerySectionBackground;
  adapterSettings: Record<string, unknown>;
}

export type ScrollAnimationStyle = 'smooth' | 'instant';
export type ScrollAnimationEasing = 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type ScrollTransitionType = 'fade' | 'slide' | 'slide-fade';

// P12-H: Overlay Arrow types
export type NavArrowPosition = 'top' | 'center' | 'bottom';

// P12-I: Dot Navigator types
export type DotNavPosition = 'below' | 'overlay-bottom' | 'overlay-top';
export type DotNavShape = 'circle' | 'pill' | 'square';

// P12-J: Shadow types
export type ShadowPreset = 'none' | 'subtle' | 'medium' | 'strong' | 'custom';
export type ViewportBgType = 'none' | 'solid' | 'gradient' | 'image';
export type GridCardAspectRatio = 'auto' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '2:3' | '3:2' | '21:9' | '5:7';

// P21-I: Typography override type (Elementor-inspired)
export interface TypographyOverride {
  // Core typography
  fontFamily?: string | undefined;
  /** First fallback font name (system font), e.g. "Helvetica" */
  fontFallback1?: string | undefined;
  /** Second fallback font name (system font), e.g. "Arial" */
  fontFallback2?: string | undefined;
  fontSize?: string | undefined;
  fontWeight?: number | undefined;
  fontStyle?: 'normal' | 'italic' | 'oblique' | undefined;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize' | undefined;
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through' | undefined;
  lineHeight?: number | undefined;
  letterSpacing?: string | undefined;
  wordSpacing?: string | undefined;
  color?: string | undefined;
  // Text Stroke
  textStrokeWidth?: string | undefined;
  textStrokeColor?: string | undefined;
  // Text Shadow
  textShadowOffsetX?: string | undefined;
  textShadowOffsetY?: string | undefined;
  textShadowBlur?: string | undefined;
  textShadowColor?: string | undefined;
  // Text Glow
  textGlowColor?: string | undefined;
  textGlowBlur?: string | undefined;
}

export interface GalleryBehaviorSettings {
  videoViewportHeight: number;
  videoViewportHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  imageViewportHeight: number;
  imageViewportHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  thumbnailScrollSpeed: number;
  scrollAnimationStyle: ScrollAnimationStyle;
  scrollAnimationDurationMs: number;
  scrollAnimationEasing: ScrollAnimationEasing;
  scrollTransitionType: ScrollTransitionType;
  imageBorderRadius: number;
  imageBorderRadiusUnit: import('@wp-super-gallery/shared-utils').CssBorderRadiusUnit;
  videoBorderRadius: number;
  videoBorderRadiusUnit: import('@wp-super-gallery/shared-utils').CssBorderRadiusUnit;
  transitionFadeEnabled: boolean;
  // P12-A/B: Advanced thumbnail strip controls
  videoThumbnailWidth: number;
  videoThumbnailHeight: number;
  imageThumbnailWidth: number;
  imageThumbnailHeight: number;
  thumbnailGap: number;
  thumbnailWheelScrollEnabled: boolean;
  thumbnailDragScrollEnabled: boolean;
  thumbnailScrollButtonsVisible: boolean;
  gridCardWidth: number;
  gridCardWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  gridCardAspectRatio: GridCardAspectRatio;
  gridCardMaxColumns: number;
  gridCardMinHeight: number;
  /** Legacy fallback when gridCardAspectRatio remains on 'auto'. */
  gridCardHeight: number;
  gridCardHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  mosaicTargetRowHeight: number;
  mosaicTargetRowHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  // Tile appearance — shared by masonry, justified, hexagonal, circular, diamond
  tileSize: number;          // px: fixed tile size for shape adapters
  tileSizeUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  tileGapX: number;          // px: horizontal gap between tiles
  tileGapXUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  tileGapY: number;          // px: vertical gap between tiles
  tileGapYUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  tileBorderWidth: number;   // px: 0 = no border
  tileBorderColor: string;   // CSS color
  tileGlowEnabled: boolean;  // hover glow via drop-shadow
  tileGlowColor: string;     // glow CSS color
  tileGlowSpread: number;    // px: glow spread radius
  tileHoverBounce: boolean;  // scale-up bounce on hover
  masonryColumns: number;    // 0 = auto-responsive
  // P31-G: Masonry entrance animation (Waterfall)
  masonryEntranceAnimation: string;   // 'none' | 'waterfall'
  masonryEntranceStagger: number;     // ms delay between successive tile animations
  // P31-F: Vertical Scroll Snap adapter
  scrollSnapAlignment: string;        // 'start' | 'center' | 'end'
  scrollSnapPageIndicator: boolean;   // show slide counter (n / total)
  scrollSnapMaxWidth: number;         // 0 = no max-width (full container)
  scrollSnapMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  // P31-E: Spotlight / Hero adapter
  spotlightHeroAspectRatio: string;                                          // e.g. '16:9', '4:3', '1:1'
  spotlightThumbnailSize: number;                                            // px: thumbnail strip item size
  spotlightThumbnailSizeUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  spotlightTransitionDuration: number;                                       // ms: hero swap / border transition
  spotlightStripPosition: 'below' | 'right';                                 // strip layout direction
  spotlightHeroMaxWidth: number;      // 0 = no max-width (full container)
  spotlightHeroMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  spotlightHeroJustification: 'start' | 'center' | 'end';                    // horizontal alignment of the hero block within the container
  // P12-H: Navigation Overlay Arrows
  navArrowPosition: NavArrowPosition;
  navArrowSize: number;
  navArrowColor: string;
  navArrowBgColor: string;
  navArrowBorderWidth: number;
  navArrowHoverScale: number;
  navArrowAutoHideMs: number;
  // P12-I: Dot Navigator
  dotNavEnabled: boolean;
  dotNavPosition: DotNavPosition;
  dotNavSize: number;
  dotNavActiveColor: string;
  dotNavInactiveColor: string;
  dotNavShape: DotNavShape;
  dotNavSpacing: number;
  dotNavActiveScale: number;
  // P12-J: Shadow & Depth Controls
  imageShadowPreset: ShadowPreset;
  videoShadowPreset: ShadowPreset;
  imageShadowCustom: string;
  videoShadowCustom: string;
  // Viewport backgrounds
  imageBgType: ViewportBgType;
  imageBgColor: string;
  imageBgGradient: string;
  imageBgImageUrl: string;
  videoBgType: ViewportBgType;
  videoBgColor: string;
  videoBgGradient: string;
  videoBgImageUrl: string;
  unifiedBgType: ViewportBgType;
  unifiedBgColor: string;
  unifiedBgGradient: string;
  unifiedBgImageUrl: string;
  // P13-A: Campaign Card settings
  cardBorderRadius: number;
  cardBorderRadiusUnit: import('@wp-super-gallery/shared-utils').CssBorderRadiusUnit;
  cardBorderWidth: number;
  cardBorderMode: 'single' | 'auto' | 'individual';
  cardBorderColor: string;
  cardShadowPreset: string;
  cardThumbnailHeight: number;
  cardThumbnailHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  cardThumbnailFit: string;
  cardGridColumns: number;
  cardGapH: number;
  cardGapHUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  cardGapV: number;
  cardGapVUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  cardMaxWidth: number;
  modalCoverHeight: number;
  modalCoverHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  modalTransition: string;
  modalTransitionDuration: number;
  modalMaxHeight: number;
  // P13-F: Card Gallery Pagination
  cardDisplayMode: 'show-all' | 'load-more' | 'paginated';
  cardRowsPerPage: number;
  cardPageDotNav: boolean;
  cardPageTransitionMs: number;
  // P13-E: Header visibility toggles
  showGalleryTitle: boolean;
  showGallerySubtitle: boolean;
  showAccessMode: boolean;
  showFilterTabs: boolean;
  showSearchBox: boolean;
  // P13-E: App width control (0 = full width / edge-to-edge)
  appMaxWidth: number;
  appMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  // P13-E: Container padding (px). Controls horizontal padding on all containers.
  // Default 16 (matches Mantine spacing-md). Set to 0 for true edge-to-edge.
  appPadding: number;
  appPaddingUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  // P36-D: Settings Panel (right-side drawer) width on non-small screens.
  settingsPanelWidth: number;
  settingsPanelWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  // P57-A: Settings Panel open/close transition. 'none' opens instantly.
  settingsPanelAnimation: 'slide-left' | 'fade' | 'scale' | 'none';
  // P36-D: Admin Panel (main container) max-width. 0 = no constraint (full width).
  adminPanelMaxWidth: number;
  adminPanelMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  /**
   * P13-E: WP Full Bleed — break out of WordPress block theme container padding.
   *
   * WP block themes apply `.has-global-padding` + `.is-layout-constrained` on the
   * parent element, adding horizontal padding and capping child max-width.
   * These settings inject an `alignfull` wrapper in the PHP shortcode output with
   * CSS media-query rules that apply negative margins (bleed ON) or re-constrain
   * (bleed OFF) at each breakpoint. Server-rendered — requires page refresh.
   *
   * See: class-wpsg-embed.php render_shortcode() for the full implementation.
   */
  wpFullBleedDesktop: boolean; // ≥ 1024px
  wpFullBleedTablet: boolean;  // 768–1023px
  wpFullBleedMobile: boolean;  // < 768px
  // P13-E: Per-gallery tile sizes (shape adapters)
  imageTileSize: number;
  imageTileSizeUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  videoTileSize: number;
  videoTileSizeUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  // P14-C: Thumbnail cache TTL
  thumbnailCacheTtl: number;
  // P14-F: Image optimization on upload
  optimizeOnUpload: boolean;
  optimizeMaxWidth: number;
  optimizeMaxHeight: number;
  optimizeQuality: number;
  optimizeWebpEnabled: boolean;
  // P14-B: Advanced Settings toggle
  advancedSettingsEnabled: boolean;
  // P14-B: Card Appearance (advanced)
  cardLockedOpacity: number;
  cardGradientStartOpacity: number;
  cardGradientEndOpacity: number;
  cardLockIconSize: number;
  cardAccessIconSize: number;
  cardBadgeOffsetY: number;
  cardCompanyBadgeMaxWidth: number;
  cardThumbnailHoverTransitionMs: number;
  // P14-B: Gallery Text (advanced)
  galleryTitleText: string;
  gallerySubtitleText: string;
  campaignAboutHeadingText: string;
  // P14-B: Modal / Viewer (advanced)
  modalCoverMobileRatio: number;
  modalCoverTabletRatio: number;
  modalCloseButtonSize: number;
  modalCloseButtonBgColor: string;
  modalContentMaxWidth: number;
  modalContentMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  campaignDescriptionLineHeight: number;
  modalMobileBreakpoint: number;
  cardPageTransitionOpacity: number;
  // P14-B: Upload / Media (advanced)
  uploadMaxSizeMb: number;
  maxBatchUploadSize: number;
  uploadAllowedTypes: string;
  libraryPageSize: number;
  mediaListPageSize: number;
  mediaCompactCardHeight: number;
  mediaSmallCardHeight: number;
  mediaMediumCardHeight: number;
  mediaLargeCardHeight: number;
  mediaListMinWidth: number;
  notificationDismissMs: number;
  // P14-B: Tile / Adapter (advanced)
  tileHoverOverlayOpacity: number;
  tileBounceScaleHover: number;
  tileBounceScaleActive: number;
  tileBounceDurationMs: number;
  tileBaseTransitionDurationMs: number;
  hexVerticalOverlapRatio: number;
  diamondVerticalOverlapRatio: number;
  hexClipPath: string;
  diamondClipPath: string;
  tileDefaultPerRow: number;
  photoNormalizeHeight: number;
  photoNormalizeHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  masonryAutoColumnBreakpoints: string;
  gridCardHoverShadow: string;
  gridCardDefaultShadow: string;
  gridCardHoverScale: number;
  tileTransitionDurationMs: number;
  // P14-B: Lightbox (advanced)
  lightboxTransitionMs: number;
  lightboxBackdropColor: string;
  lightboxEntryScale: number;
  lightboxVideoMaxWidth: number;
  lightboxVideoMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  lightboxVideoHeight: number;
  lightboxVideoHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  lightboxMediaMaxHeight: string;
  lightboxZIndex: number;
  // P14-B: Navigation (advanced)
  dotNavMaxVisibleDots: number;
  navArrowEdgeInset: number;
  navArrowMinHitTarget: number;
  navArrowFadeDurationMs: number;
  navArrowScaleTransitionMs: number;
  viewportHeightMobileRatio: number;
  viewportHeightTabletRatio: number;
  searchInputMinWidth: number;
  searchInputMaxWidth: number;
  // P14-B: System (advanced)
  adminSearchDebounceMs: number;
  loginMinPasswordLength: number;
  loginFormMaxWidth: number;
  authBarBackdropBlur: number;
  authBarMobileBreakpoint: number;
  cardAutoColumnsBreakpoints: string;
  // P20-K: Session idle timeout (minutes). 0 = disabled.
  sessionIdleTimeoutMinutes: number;
  // P45-A5: Warning shown N seconds before idle logout. 0 = no warning.
  sessionIdleWarningSeconds: number;
  // P15-A: Layout builder scope
  layoutBuilderScope: 'full' | 'viewport';
  // P56-B: Configurable breakpoint pixel thresholds for the classic carousel adapter.
  mobileBreakpointPx: number;
  tabletBreakpointPx: number;
  // P23-D: Canonical responsive gallery configuration surface.
  galleryConfig?: GalleryConfig;
  // P20-E: Uninstall data preservation
  preserveDataOnUninstall: boolean;
  // D-4: Archive purge safeguards
  archivePurgeDays: number;
  archivePurgeGraceDays: number;
  // D-20: Analytics data retention
  analyticsRetentionDays: number;
  // P21-B: Card visibility toggles
  showCardCompanyName: boolean;
  showCardMediaCounts: boolean;
  showCardTitle: boolean;
  showCardDescription: boolean;
  showCardBorder: boolean;
  showCardAccessBadge: boolean;
  showCardThumbnailFade: boolean;
  // P21-D: Viewer background & border
  viewerBgType: 'theme' | 'transparent' | 'solid' | 'gradient';
  viewerBgColor: string;
  viewerBgGradient: import('@wp-super-gallery/shared-utils').GradientOptions;
  showViewerBorder: boolean;
  // P21-C: Card aspect ratio & max columns
  cardMaxColumns: number;
  cardAspectRatio: 'auto' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '2:3' | '3:2' | '21:9';
  cardMinHeight: number;
  cardMinHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  // P21-G: Gallery label editing & justification
  galleryImageLabel: string;
  galleryVideoLabel: string;
  galleryLabelJustification: 'left' | 'center' | 'right';
  showGalleryLabelIcon: boolean;
  // P21-F: CampaignViewer enhancements
  campaignModalFullscreen: boolean;
  showCampaignCompanyName: boolean;
  showCampaignDate: boolean;
  showCampaignAbout: boolean;
  showCampaignDescription: boolean;
  showCampaignStats: boolean;
  campaignStatsAdminOnly: boolean;
  campaignOpenMode: 'full' | 'galleries-only';
  // P21-E: Auth bar display modes
  authBarDisplayMode: 'bar' | 'floating' | 'draggable' | 'minimal' | 'auto-hide';
  authBarDragMargin: number;
  // P21-H: Settings tooltips
  showSettingsTooltips: boolean;
  // P25-Z: React DevTools names and DOM component debug metadata in deployed builds
  debugComponentMarkers: boolean;
  // P21-I: Typography overrides & in-context editors
  typographyOverrides: Record<string, TypographyOverride>;
  showInContextEditors: boolean;
  // P21-J: QA fixes & UX enhancements
  showCardInfoPanel: boolean;
  showCampaignCoverImage: boolean;
  showCampaignTags: boolean;
  showCampaignAdminActions: boolean;
  showCampaignGalleryLabels: boolean;
  fullscreenContentMaxWidth: number;
  fullscreenContentMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  // P22-K: Modal max width & background
  modalMaxWidth: number;
  modalMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  modalBgType: 'theme' | 'transparent' | 'solid' | 'gradient';
  modalBgColor: string;
  modalBgGradient: import('@wp-super-gallery/shared-utils').GradientOptions;
  // P22-M: Modal gallery width/gap/margin
  modalGalleryMaxWidth: number;
  modalGalleryMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  modalGalleryGap: number;
  modalGalleryGapUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  modalGalleryMargin: number;
  modalGalleryMarginUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  // P22-P8: Vertical alignment of modal content
  modalContentVerticalAlign: 'top' | 'center' | 'bottom';
  // P25-T: Gallery shell vertical alignment + offset
  modalGalleryVerticalAlign: 'start' | 'center' | 'end';
  modalGalleryOffsetY: number;
  modalGalleryOffsetYUnit: import('@wp-super-gallery/shared-utils').CssOffsetUnit;
  // P22-M: Gallery height constraint mode + manual CSS height
  gallerySizingMode: 'auto' | 'viewport' | 'manual';
  galleryManualHeight: string;
  // P22-P2: Dimension propagation — gallery section sizing
  gallerySectionMaxWidth: number;
  gallerySectionMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  gallerySectionMaxHeight: number;
  gallerySectionMaxHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  gallerySectionHeightMode: 'auto' | 'manual' | 'viewport';
  gallerySectionMinWidth: number;
  gallerySectionMinWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  gallerySectionMinHeight: number;
  gallerySectionMinHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  // P25-T: Section content alignment + offset
  gallerySectionContentAlignX: 'start' | 'center' | 'end';
  gallerySectionContentAlignY: 'start' | 'center' | 'end';
  gallerySectionContentOffsetX: number;
  gallerySectionContentOffsetXUnit: import('@wp-super-gallery/shared-utils').CssOffsetUnit;
  gallerySectionContentOffsetY: number;
  gallerySectionContentOffsetYUnit: import('@wp-super-gallery/shared-utils').CssOffsetUnit;
  // P25-S: Primary gallery section scale multiplier
  sectionScale: number;
  perTypeSectionEqualHeight: boolean;
  modalInnerPadding: number;
  modalInnerPaddingUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  gallerySectionPadding: number;
  gallerySectionPaddingUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  adapterContentPadding: number;
  adapterContentPaddingUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  adapterSizingMode: 'fill' | 'manual';
  adapterMaxWidthPct: number;
  adapterMaxHeightPct: number;
  // P22-P7: Card width responsive unit & last-row justification
  cardMaxWidthUnit: import('@wp-super-gallery/shared-utils').CssWidthUnit;
  cardJustifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly';
  // P25-S: Primary card scale multiplier
  cardScale: number;
  // P25-Q: Card gallery vertical justification
  cardGalleryVerticalAlign: 'start' | 'center' | 'end';
  cardGalleryMinHeight: number;
  cardGalleryMinHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  cardGalleryMaxHeight: number;
  cardGalleryMaxHeightUnit: import('@wp-super-gallery/shared-utils').CssHeightUnit;
  // P25-T: Card gallery offset nudges
  cardGalleryOffsetX: number;
  cardGalleryOffsetXUnit: import('@wp-super-gallery/shared-utils').CssOffsetUnit;
  cardGalleryOffsetY: number;
  cardGalleryOffsetYUnit: import('@wp-super-gallery/shared-utils').CssOffsetUnit;
  // P22-P7: Unified adapter item gap & justification
  adapterItemGap: number;
  adapterItemGapUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  adapterJustifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly' | 'stretch';
  // P25-S: Primary gallery item scale multiplier (applies to adapter sizing)
  itemScale: number;
  // P22-P8d: Embla carousel settings
  carouselVisibleCards: number;
  carouselAutoplay: boolean;
  carouselAutoplaySpeed: number;
  carouselAutoplayPauseOnHover: boolean;
  carouselAutoplayDirection: 'ltr' | 'rtl';
  carouselDragEnabled: boolean;
  carouselDarkenUnfocused: boolean;
  carouselDarkenOpacity: number;
  carouselEdgeFade: boolean;
  carouselLoop: boolean;
  carouselGap: number;
  carouselGapUnit: import('@wp-super-gallery/shared-utils').CssSpacingUnit;
  // P25-U Phase 1b: Drawer backdrop blur toggle
  settingsDrawerBlurEnabled: boolean;
  // P25-X Phase 5: Card breakpoint overrides
  cardConfig: CardConfig;
  // P35-B: Campaign listing adapter selection
  /** Adapter used to render the public campaign listing (CardGallery). Default 'compact-grid'. */
  campaignListingAdapterId: string;
  /** Per-breakpoint override for the listing adapter on mobile. Omit to inherit desktop value. */
  campaignListingAdapterIdMobile?: string;
  /** Per-breakpoint override for the listing adapter on tablet. Omit to inherit desktop value. */
  campaignListingAdapterIdTablet?: string;
  /** P37-LB: Template ID used when campaignListingAdapterId is 'layout-builder'. */
  campaignListingLayoutTemplateId?: string;
}

// ── Card breakpoint override model ───────────────────────────────────────────

/**
 * Explicit list of card fields that may be overridden per breakpoint.
 * Used to derive the override type and to drive UI / pruning logic.
 */
export const CARD_BREAKPOINT_OVERRIDE_KEYS = [
  'cardGridColumns',
  'cardMaxColumns',
  'cardMaxWidth',
  'cardMaxWidthUnit',
  'cardGapH',
  'cardGapHUnit',
  'cardGapV',
  'cardGapVUnit',
  'cardScale',
  'cardJustifyContent',
  'cardGalleryVerticalAlign',
  'cardAspectRatio',
  'cardThumbnailHeight',
  'cardThumbnailHeightUnit',
  'cardMinHeight',
  'cardMinHeightUnit',
  'cardBorderRadius',
  'cardBorderRadiusUnit',
  'cardGalleryMinHeight',
  'cardGalleryMinHeightUnit',
  'cardGalleryMaxHeight',
  'cardGalleryMaxHeightUnit',
  'cardGalleryOffsetX',
  'cardGalleryOffsetXUnit',
  'cardGalleryOffsetY',
  'cardGalleryOffsetYUnit',
  'cardDisplayMode',
  'cardRowsPerPage',
  'cardPageDotNav',
  'cardPageTransitionMs',
  'cardPageTransitionOpacity',
  'cardBorderWidth',
  'cardBorderMode',
  'cardBorderColor',
  'cardShadowPreset',
  'cardThumbnailFit',
  'showCardCompanyName',
  'showCardAccessBadge',
  'showCardTitle',
  'showCardDescription',
  'showCardMediaCounts',
  'showCardBorder',
  'showCardThumbnailFade',
  'showCardInfoPanel',
  'cardLockedOpacity',
  'cardGradientStartOpacity',
  'cardGradientEndOpacity',
  'cardLockIconSize',
  'cardAccessIconSize',
  'cardBadgeOffsetY',
  'cardCompanyBadgeMaxWidth',
  'cardThumbnailHoverTransitionMs',
  'cardAutoColumnsBreakpoints',
] as const;

type CardBreakpointOverrideKey = (typeof CARD_BREAKPOINT_OVERRIDE_KEYS)[number];

/** Sparse set of card setting overrides for a single breakpoint. */
export type CardBreakpointOverrides = Partial<Pick<GalleryBehaviorSettings, CardBreakpointOverrideKey>>;

/** Per-breakpoint card configuration container. */
export interface CardConfig {
  breakpoints?: Partial<Record<CardConfigBreakpoint, CardBreakpointOverrides>>;
}

const DEFAULT_GALLERY_COMMON_SETTINGS: GalleryCommonSettings = {
  sectionMaxWidth: 0,
  sectionMaxWidthUnit: 'px',
  sectionMaxHeight: 0,
  sectionMaxHeightUnit: 'px',
  sectionMinWidth: 300,
  sectionMinWidthUnit: 'px',
  sectionMinHeight: 150,
  sectionMinHeightUnit: 'px',
  sectionHeightMode: 'auto',
  sectionPadding: 16,
  sectionPaddingUnit: 'px',
  adapterContentPadding: 0,
  adapterContentPaddingUnit: 'px',
  adapterSizingMode: 'fill',
  adapterMaxWidthPct: 100,
  adapterMaxHeightPct: 100,
  adapterItemGap: 16,
  adapterItemGapUnit: 'px',
  adapterJustifyContent: 'center',
  gallerySizingMode: 'auto',
  galleryManualHeight: '420px',
  perTypeSectionEqualHeight: false,
};

function createDefaultGalleryScopeConfig(adapterId: string): GalleryScopeConfig {
  return {
    adapterId,
    common: { ...DEFAULT_GALLERY_COMMON_SETTINGS },
  };
}

function createDefaultGalleryConfig(): GalleryConfig {
  return {
    mode: 'per-type',
    breakpoints: {
      desktop: {
        unified: createDefaultGalleryScopeConfig('compact-grid'),
        image: createDefaultGalleryScopeConfig('classic'),
        video: createDefaultGalleryScopeConfig('classic'),
      },
      tablet: {
        unified: createDefaultGalleryScopeConfig('compact-grid'),
        image: createDefaultGalleryScopeConfig('classic'),
        video: createDefaultGalleryScopeConfig('classic'),
      },
      mobile: {
        unified: createDefaultGalleryScopeConfig('compact-grid'),
        image: createDefaultGalleryScopeConfig('classic'),
        video: createDefaultGalleryScopeConfig('classic'),
      },
    },
  };
}

export const DEFAULT_GALLERY_BEHAVIOR_SETTINGS: GalleryBehaviorSettings = {
  videoViewportHeight: 420,
  videoViewportHeightUnit: 'px',
  imageViewportHeight: 420,
  imageViewportHeightUnit: 'px',
  thumbnailScrollSpeed: 1,
  scrollAnimationStyle: 'smooth',
  scrollAnimationDurationMs: 350,
  scrollAnimationEasing: 'ease',
  scrollTransitionType: 'slide-fade',
  imageBorderRadius: 8,
  imageBorderRadiusUnit: 'px',
  videoBorderRadius: 8,
  videoBorderRadiusUnit: 'px',
  transitionFadeEnabled: true,
  // P12-A/B defaults
  videoThumbnailWidth: 60,
  videoThumbnailHeight: 45,
  imageThumbnailWidth: 60,
  imageThumbnailHeight: 60,
  thumbnailGap: 6,
  thumbnailWheelScrollEnabled: true,
  thumbnailDragScrollEnabled: true,
  thumbnailScrollButtonsVisible: false,
  // P12-H defaults
  navArrowPosition: 'center',
  navArrowSize: 36,
  navArrowColor: '#ffffff',
  navArrowBgColor: 'rgba(0,0,0,0.45)',
  navArrowBorderWidth: 0,
  navArrowHoverScale: 1.1,
  navArrowAutoHideMs: 0,
  // P12-I defaults
  dotNavEnabled: true,
  dotNavPosition: 'below',
  dotNavSize: 10,
  dotNavActiveColor: 'var(--wpsg-color-primary)',
  dotNavInactiveColor: 'rgba(128,128,128,0.4)',
  dotNavShape: 'circle',
  dotNavSpacing: 6,
  dotNavActiveScale: 1.3,
  // P12-J defaults
  imageShadowPreset: 'subtle',
  videoShadowPreset: 'subtle',
  imageShadowCustom: '0 2px 8px rgba(0,0,0,0.15)',
  videoShadowCustom: '0 2px 8px rgba(0,0,0,0.15)',
  // Viewport backgrounds
  imageBgType: 'none',
  imageBgColor: '#1a1a2e',
  imageBgGradient: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
  imageBgImageUrl: '',
  videoBgType: 'none',
  videoBgColor: '#0d0d0d',
  videoBgGradient: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)',
  videoBgImageUrl: '',
  unifiedBgType: 'none',
  unifiedBgColor: '#1a1a2e',
  unifiedBgGradient: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
  unifiedBgImageUrl: '',
  // P13-A: Campaign Card settings
  cardBorderRadius: 8,
  cardBorderRadiusUnit: 'px',
  cardBorderWidth: 4,
  cardBorderMode: 'auto',
  cardBorderColor: '#228be6',
  cardShadowPreset: 'subtle',
  cardThumbnailHeight: 200,
  cardThumbnailHeightUnit: 'px',
  cardThumbnailFit: 'cover',
  cardGridColumns: 0,
  cardGapH: 16,
  cardGapHUnit: 'px',
  cardGapV: 16,
  cardGapVUnit: 'px',
  cardMaxWidth: 0,
  modalCoverHeight: 240,
  modalCoverHeightUnit: 'px',
  modalTransition: 'pop',
  modalTransitionDuration: 300,
  modalMaxHeight: 90,
  // P13-F: Card Gallery Pagination
  cardDisplayMode: 'load-more',
  cardRowsPerPage: 3,
  cardPageDotNav: false,
  cardPageTransitionMs: 300,
  // P13-E: Header visibility toggles
  showGalleryTitle: true,
  showGallerySubtitle: true,
  showAccessMode: true,
  showFilterTabs: true,
  showSearchBox: true,
  // P13-E: App width control (0 = full width)
  appMaxWidth: 1200,
  appMaxWidthUnit: 'px',
  // P13-E: Container horizontal padding (px)
  appPadding: 16,
  appPaddingUnit: 'px',
  // P36-D: Settings Panel width
  settingsPanelWidth: 600,
  settingsPanelWidthUnit: 'px',
  // P57-A: Settings Panel transition
  settingsPanelAnimation: 'slide-left',
  // P36-D: Admin Panel max-width (0 = no constraint)
  adminPanelMaxWidth: 0,
  adminPanelMaxWidthUnit: 'px',
  // P13-E: WP Full Bleed (per breakpoint)
  wpFullBleedDesktop: false,
  wpFullBleedTablet: false,
  wpFullBleedMobile: false,
  // P13-E: Per-gallery tile sizes (shape adapters)
  imageTileSize: 150,
  imageTileSizeUnit: 'px',
  videoTileSize: 150,
  videoTileSizeUnit: 'px',
  // P14-C: Thumbnail cache TTL
  thumbnailCacheTtl: 86400,
  // P14-F: Image optimization on upload
  optimizeOnUpload: false,
  optimizeMaxWidth: 1920,
  optimizeMaxHeight: 1920,
  optimizeQuality: 82,
  optimizeWebpEnabled: false,
  // P14-B: Advanced Settings toggle
  advancedSettingsEnabled: false,
  // P14-B: Card Appearance (advanced)
  cardLockedOpacity: 0.5,
  cardGradientStartOpacity: 0.0,
  cardGradientEndOpacity: 0.85,
  cardLockIconSize: 32,
  cardAccessIconSize: 14,
  cardBadgeOffsetY: 8,
  cardCompanyBadgeMaxWidth: 160,
  cardThumbnailHoverTransitionMs: 300,
  // P14-B: Gallery Text (advanced)
  galleryTitleText: 'Gallery',
  gallerySubtitleText: '',
  campaignAboutHeadingText: 'About',
  // P14-B: Modal / Viewer (advanced)
  modalCoverMobileRatio: 0.6,
  modalCoverTabletRatio: 0.75,
  modalCloseButtonSize: 36,
  modalCloseButtonBgColor: 'rgba(0,0,0,0.5)',
  modalContentMaxWidth: 900,
  modalContentMaxWidthUnit: 'px',
  campaignDescriptionLineHeight: 1.6,
  modalMobileBreakpoint: 768,
  cardPageTransitionOpacity: 0.3,
  // P14-B: Upload / Media (advanced)
  uploadMaxSizeMb: 50,
  maxBatchUploadSize: 20,
  uploadAllowedTypes: 'image/*,video/*',
  libraryPageSize: 20,
  mediaListPageSize: 50,
  mediaCompactCardHeight: 100,
  mediaSmallCardHeight: 80,
  mediaMediumCardHeight: 240,
  mediaLargeCardHeight: 340,
  mediaListMinWidth: 600,
  notificationDismissMs: 4000,
  // P14-B: Tile / Adapter (advanced)
  tileHoverOverlayOpacity: 0.6,
  tileBounceScaleHover: 1.08,
  tileBounceScaleActive: 1.02,
  tileBounceDurationMs: 300,
  tileBaseTransitionDurationMs: 250,
  hexVerticalOverlapRatio: 0.25,
  diamondVerticalOverlapRatio: 0.45,
  hexClipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
  diamondClipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  tileDefaultPerRow: 5,
  photoNormalizeHeight: 300,
  photoNormalizeHeightUnit: 'px',
  masonryAutoColumnBreakpoints: '480:2,768:3,1024:4,1280:5',
  gridCardHoverShadow: '0 4px 12px rgba(0,0,0,0.3)',
  gridCardDefaultShadow: '0 2px 8px rgba(0,0,0,0.15)',
  gridCardHoverScale: 1.02,
  tileTransitionDurationMs: 200,
  // P14-B: Lightbox (advanced)
  lightboxTransitionMs: 250,
  lightboxBackdropColor: 'rgba(0,0,0,0.92)',
  lightboxEntryScale: 0.92,
  lightboxVideoMaxWidth: 900,
  lightboxVideoMaxWidthUnit: 'px',
  lightboxVideoHeight: 506,
  lightboxVideoHeightUnit: 'px',
  lightboxMediaMaxHeight: '85vh',
  lightboxZIndex: 1000,
  // P14-B: Navigation (advanced)
  dotNavMaxVisibleDots: 7,
  navArrowEdgeInset: 8,
  navArrowMinHitTarget: 44,
  navArrowFadeDurationMs: 200,
  navArrowScaleTransitionMs: 150,
  viewportHeightMobileRatio: 0.65,
  viewportHeightTabletRatio: 0.8,
  searchInputMinWidth: 200,
  searchInputMaxWidth: 280,
  // P14-B: System (advanced)
  adminSearchDebounceMs: 300,
  loginMinPasswordLength: 1,
  loginFormMaxWidth: 400,
  authBarBackdropBlur: 8,
  authBarMobileBreakpoint: 768,
  cardAutoColumnsBreakpoints: '480:1,768:2,1024:3,1280:4',
  // P56-B: Configurable breakpoint pixel thresholds.
  mobileBreakpointPx: 768,
  tabletBreakpointPx: 1200,
  // P20-K: Session idle timeout
  sessionIdleTimeoutMinutes: 0,
  sessionIdleWarningSeconds: 120,
  layoutBuilderScope: 'full',
  galleryConfig: createDefaultGalleryConfig(),
  // P41-UN1: Uninstall data preservation defaults to safe (true)
  preserveDataOnUninstall: true,
  // D-4: Archive purge safeguards
  archivePurgeDays: 0,
  archivePurgeGraceDays: 30,
  // D-20: Analytics data retention
  analyticsRetentionDays: 0,
  gridCardWidth: 160,
  gridCardWidthUnit: 'px',
  gridCardAspectRatio: 'auto',
  gridCardMaxColumns: 0,
  gridCardMinHeight: 0,
  gridCardHeight: 224,
  gridCardHeightUnit: 'px',
  mosaicTargetRowHeight: 200,
  mosaicTargetRowHeightUnit: 'px',
  // Tile appearance defaults
  tileSize: 150,
  tileSizeUnit: 'px',
  tileGapX: 8,
  tileGapXUnit: 'px',
  tileGapY: 8,
  tileGapYUnit: 'px',
  tileBorderWidth: 0,
  tileBorderColor: '#ffffff',
  tileGlowEnabled: false,
  tileGlowColor: '#7c9ef8',
  tileGlowSpread: 12,
  tileHoverBounce: true,
  masonryColumns: 0,
  // P31-G: Masonry entrance animation
  masonryEntranceAnimation: 'none',
  masonryEntranceStagger: 60,
  // P31-F: Vertical Scroll Snap adapter
  scrollSnapAlignment: 'start',
  scrollSnapPageIndicator: true,
  scrollSnapMaxWidth: 0,
  scrollSnapMaxWidthUnit: 'px',
  // P31-E: Spotlight / Hero adapter
  spotlightHeroAspectRatio: '16:9',
  spotlightThumbnailSize: 80,
  spotlightThumbnailSizeUnit: 'px',
  spotlightTransitionDuration: 250,
  spotlightStripPosition: 'below',
  spotlightHeroMaxWidth: 0,
  spotlightHeroMaxWidthUnit: 'px',
  spotlightHeroJustification: 'center',
  // P21-B: Card visibility toggles
  showCardCompanyName: true,
  showCardMediaCounts: true,
  showCardTitle: true,
  showCardDescription: true,
  showCardBorder: true,
  showCardAccessBadge: true,
  showCardThumbnailFade: true,
  // P21-D: Viewer background & border
  viewerBgType: 'theme',
  viewerBgColor: '',
  viewerBgGradient: {},
  showViewerBorder: true,
  // P21-C: Card aspect ratio & max columns
  cardMaxColumns: 0,
  cardAspectRatio: 'auto',
  cardMinHeight: 0,
  cardMinHeightUnit: 'px',
  // P21-G: Gallery label editing & justification
  galleryImageLabel: 'Images',
  galleryVideoLabel: 'Videos',
  galleryLabelJustification: 'left',
  showGalleryLabelIcon: false,
  // P21-F: CampaignViewer enhancements
  campaignModalFullscreen: false,
  showCampaignCompanyName: true,
  showCampaignDate: true,
  showCampaignAbout: true,
  showCampaignDescription: true,
  showCampaignStats: true,
  campaignStatsAdminOnly: true,
  campaignOpenMode: 'full',
  // P21-E: Auth bar display modes
  authBarDisplayMode: 'floating',
  authBarDragMargin: 16,
  // P21-H: Settings tooltips
  showSettingsTooltips: true,
  // P25-Z: React DevTools names and DOM component debug metadata in deployed builds
  debugComponentMarkers: true,
  // P21-I: Typography overrides & in-context editors
  typographyOverrides: {},
  showInContextEditors: true,
  // P21-J: QA fixes & UX enhancements
  showCardInfoPanel: true,
  showCampaignCoverImage: true,
  showCampaignTags: true,
  showCampaignAdminActions: true,
  showCampaignGalleryLabels: true,
  fullscreenContentMaxWidth: 0,
  fullscreenContentMaxWidthUnit: 'px',
  // P22-K: Modal max width & background
  modalMaxWidth: 1200,
  modalMaxWidthUnit: 'px',
  modalBgType: 'theme',
  modalBgColor: '',
  modalBgGradient: {},
  // P22-M: Modal gallery width/gap/margin
  modalGalleryMaxWidth: 0,
  modalGalleryMaxWidthUnit: 'px',
  modalGalleryGap: 32,
  modalGalleryGapUnit: 'px',
  modalGalleryMargin: 0,
  modalGalleryMarginUnit: 'px',
  modalContentVerticalAlign: 'top',
  // P25-T: Gallery shell vertical alignment + offset
  modalGalleryVerticalAlign: 'start',
  modalGalleryOffsetY: 0,
  modalGalleryOffsetYUnit: 'px',
  // P22-M: Gallery height constraint mode + manual CSS height
  gallerySizingMode: 'auto',
  galleryManualHeight: '420px',
  // P22-P2: Dimension propagation — gallery section sizing
  gallerySectionMaxWidth: 0,
  gallerySectionMaxWidthUnit: 'px',
  gallerySectionMaxHeight: 0,
  gallerySectionMaxHeightUnit: 'px',
  gallerySectionHeightMode: 'auto',
  gallerySectionMinWidth: 300,
  gallerySectionMinWidthUnit: 'px',
  gallerySectionMinHeight: 150,
  gallerySectionMinHeightUnit: 'px',
  // P25-T: Section content alignment + offset
  gallerySectionContentAlignX: 'center',
  gallerySectionContentAlignY: 'start',
  gallerySectionContentOffsetX: 0,
  gallerySectionContentOffsetXUnit: 'px',
  gallerySectionContentOffsetY: 0,
  gallerySectionContentOffsetYUnit: 'px',
  // P25-S: Primary gallery section scale multiplier
  sectionScale: 1,
  perTypeSectionEqualHeight: false,
  modalInnerPadding: 16,
  modalInnerPaddingUnit: 'px',
  gallerySectionPadding: 16,
  gallerySectionPaddingUnit: 'px',
  adapterContentPadding: 0,
  adapterContentPaddingUnit: 'px',
  adapterSizingMode: 'fill',
  adapterMaxWidthPct: 100,
  adapterMaxHeightPct: 100,
  // P22-P7: Card width responsive unit & last-row justification
  cardMaxWidthUnit: 'px',
  cardJustifyContent: 'center',
  // P25-S: Primary card scale multiplier
  cardScale: 1,
  // P25-Q: Card gallery vertical justification
  cardGalleryVerticalAlign: 'start',
  cardGalleryMinHeight: 0,
  cardGalleryMinHeightUnit: 'px',
  cardGalleryMaxHeight: 0,
  cardGalleryMaxHeightUnit: 'px',
  // P25-T: Card gallery offset nudges
  cardGalleryOffsetX: 0,
  cardGalleryOffsetXUnit: 'px',
  cardGalleryOffsetY: 0,
  cardGalleryOffsetYUnit: 'px',
  // P22-P7: Unified adapter item gap & justification
  adapterItemGap: 16,
  adapterItemGapUnit: 'px',
  adapterJustifyContent: 'center',
  // P25-S: Primary gallery item scale multiplier
  itemScale: 1,
  // P22-P8d: Embla carousel settings
  carouselVisibleCards: 1,
  carouselAutoplay: false,
  carouselAutoplaySpeed: 3000,
  carouselAutoplayPauseOnHover: true,
  carouselAutoplayDirection: 'ltr',
  carouselDragEnabled: true,
  carouselDarkenUnfocused: false,
  carouselDarkenOpacity: 0.5,
  carouselEdgeFade: false,
  carouselLoop: true,
  carouselGap: 16,
  carouselGapUnit: 'px',
  // P25-U Phase 1b: Drawer backdrop blur toggle
  settingsDrawerBlurEnabled: true,
  // P25-X Phase 5: Card breakpoint overrides
  cardConfig: { breakpoints: {} },
  // P35-B: Campaign listing adapter — default produces byte-identical DOM to the legacy CardGallery flex grid
  campaignListingAdapterId: 'compact-grid',
};
