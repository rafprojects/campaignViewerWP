export interface Company {
  id: string;
  name: string;
  logo: string;
  brandColor: string;
}

export interface Campaign {
  id: string;
  companyId: string;
  company: Company;
  title: string;
  description: string;
  thumbnail: string;
  coverImage: string;
  videos: MediaItem[];
  images: MediaItem[];
  tags: string[];
  status: 'draft' | 'active' | 'archived';
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
  /** Per-campaign border color override (used when cardBorderMode is 'individual') */
  borderColor?: string;
  /** P13-D: Optional ISO 8601 scheduled-publish date. */
  publishAt?: string;
  /** P13-D: Optional ISO 8601 auto-unpublish date. */
  unpublishAt?: string;
  /** P15-B: Optional layout template reference. */
  layoutTemplateId?: string;
  /** Per-campaign image gallery adapter override (empty = use global setting). */
  imageAdapterId?: string;
  /** Per-campaign video gallery adapter override (empty = use global setting). */
  videoAdapterId?: string;
  /** P18-H: Category names assigned to this campaign. */
  categories?: string[];
}

export interface MediaItem {
  id: string;
  type: 'video' | 'image' | 'other';
  source: 'upload' | 'external';
  url: string;
  embedUrl?: string;
  provider?: 'youtube' | 'vimeo' | 'rumble' | 'bitchute' | 'odysee' | 'other';
  attachmentId?: number;
  thumbnail?: string;
  title?: string;
  caption?: string;
  order: number;
  /** Pixel dimensions supplied by server (WP attachment metadata). Used by mosaic layout. */
  width?: number;
  height?: number;
}

export interface User {
  id: string;
  email: string;
  role: 'viewer' | 'admin';
  permissions: string[]; // Array of campaign IDs user can access
}

export interface CampaignAccessGrant {
  userId: string;
  campaignId: string;
  source: 'company' | 'campaign';
  grantedAt: string;
  revokedAt?: string;
  user?: {
    displayName: string;
    email: string;
    login: string;
  };
}

/**
 * Response from media upload endpoint
 */
export interface UploadResponse {
  attachmentId: string;
  url: string;
  thumbnail?: string;
  mimeType?: string;
}

/**
 * Response from the oEmbed proxy endpoint
 */
export interface OEmbedResponse {
  type?: 'video' | 'photo' | 'rich' | 'link';
  title?: string;
  thumbnail_url?: string;
  provider_name?: string;
  provider?: string;
  html?: string;
  width?: number;
  height?: number;
}

// ── P15-B: Layout Builder Data Model ──────────────────────────────

/**
 * Shape preset for a layout slot. Each maps to a CSS clip-path value.
 * 'custom' uses the slot's own `clipPath` string.
 */
export type LayoutSlotShape =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'hexagon'
  | 'diamond'
  | 'parallelogram-left'
  | 'parallelogram-right'
  | 'chevron'
  | 'arrow'
  | 'trapezoid'
  | 'custom';

/**
 * A single media slot inside a layout template.
 * All position/size values are percentages (0–100) of the canvas dimensions.
 */
export interface LayoutSlot {
  id: string;
  /** % from left edge */
  x: number;
  /** % from top edge */
  y: number;
  /** % of canvas width */
  width: number;
  /** % of canvas height */
  height: number;
  /** Layer order */
  zIndex: number;
  /** Shape preset */
  shape: LayoutSlotShape;
  /** Custom CSS clip-path (used when shape === 'custom') */
  clipPath?: string;
  /** CSS mask-image URL (legacy — prefer maskLayer for new templates) */
  maskUrl?: string;
  /** CSS mask-mode (legacy — prefer maskLayer for new templates) */
  maskMode?: 'luminance' | 'alpha';
  /** Mask layer with full position/scale/feather controls (replaces maskUrl). */
  maskLayer?: MaskLayer;
  /** Corner rounding in px (for rectangle shapes) */
  borderRadius: number;
  /** Border thickness in px (0 = none) */
  borderWidth: number;
  /** Border CSS color */
  borderColor: string;
  /** How the image fills the slot */
  objectFit: 'cover' | 'contain' | 'fill';
  /** CSS object-position for focal point, e.g. '50% 30%' */
  objectPosition: string;
  /** Fixed media binding (overrides auto-assignment) */
  mediaId?: string;
  /** WP attachment post ID for cross-campaign matching (same image → same attachmentId). */
  mediaAttachmentId?: number;
  /** Media URL for cross-campaign matching fallback. */
  mediaUrl?: string;
  /** Click behavior in rendered gallery */
  clickAction: 'lightbox' | 'none';
  /** Hover behavior in rendered gallery */
  hoverEffect: 'pop' | 'glow' | 'none';
  /** Per-slot glow color (overrides campaign-level tileGlowColor when hoverEffect is 'glow'). */
  glowColor?: string;
  /** Per-slot glow spread in px (overrides campaign-level tileGlowSpread when hoverEffect is 'glow'). */
  glowSpread?: number;
  // ── Layer system (P16) ──
  /** Human-readable label shown in the layer panel. Defaults to "Slot N" if absent. */
  name?: string;
  /** Builder-only visibility. false = ghost at 10% opacity in editor; no effect on gallery rendering. */
  visible?: boolean;
  /** Prevents drag/resize in the builder. No effect on gallery rendering. */
  locked?: boolean;
  /** When true, drag-resize handles maintain the width/height ratio. */
  lockAspectRatio?: boolean;
  // ── Image effects (P20 QA-R3) ──
  /** CSS filter chain (brightness, contrast, etc.). */
  filterEffects?: SlotFilterEffects;
  /** Drop-shadow or glow applied via CSS filter. */
  shadow?: SlotShadow;
  /** 3D tilt on mouse interaction. Applied in gallery only (not builder). */
  tilt?: SlotTiltEffect;
  /** CSS mix-blend-mode. Default: 'normal'. */
  blendMode?: SlotBlendMode;
  /** Darken/lighten overlay on the slot. */
  overlayEffect?: SlotOverlayEffect;
}

/** Sensible defaults for a new layout slot. */
export const DEFAULT_LAYOUT_SLOT: LayoutSlot = {
  id: '',
  x: 0,
  y: 0,
  width: 25,
  height: 25,
  zIndex: 0,
  shape: 'rectangle',
  borderRadius: 4,
  borderWidth: 0,
  borderColor: '#ffffff',
  objectFit: 'cover',
  objectPosition: '50% 50%',
  clickAction: 'lightbox',
  hoverEffect: 'pop',
};

/**
 * A decorative graphic layer rendered above slots (P15-H, renamed P17-F).
 * All position/size values are percentages (0–100) of the canvas.
 * Stored in `template.overlays` (key unchanged for DB compatibility).
 */
export interface LayoutGraphicLayer {
  id: string;
  /** Transparent PNG/SVG URL */
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  /** 0–1 */
  opacity: number;
  /** false = click-through (default) */
  pointerEvents: boolean;
  // ── Layer system (P16) ──
  /** Human-readable label shown in the layer panel. Defaults to "Overlay N" if absent. */
  name?: string;
  /** Builder-only visibility. false = ghost at 10% opacity in editor; no effect on gallery rendering. */
  visible?: boolean;
  /** Prevents drag/resize in the builder. No effect on gallery rendering. */
  locked?: boolean;
}

export type BackgroundMode = 'none' | 'color' | 'gradient' | 'image';

/** Gradient type: linear, radial, or conic. */
export type GradientType = 'linear' | 'radial' | 'conic';

/**
 * Direction presets (kept for backward compat).
 * With `gradientType` + `gradientAngle`, these serve as quick-select shortcuts.
 */
export type GradientDirection = 'horizontal' | 'vertical' | 'diagonal-right' | 'diagonal-left' | 'radial';

/** Radial gradient shape: `circle` or `ellipse` (default). */
export type RadialShape = 'circle' | 'ellipse';

/** Radial gradient size keyword. */
export type RadialSize = 'closest-side' | 'closest-corner' | 'farthest-side' | 'farthest-corner';

export interface GradientStop {
  color: string;      // rgba or hex
  position?: number;  // 0–100 %
}

// ── Mask Layer Sub-System ─────────────────────────────────────────

/**
 * A mask layer sits as a child of a slot, controlling how the slot's image is
 * clipped via CSS mask-image.  Position/size are percentages relative to the
 * slot bounding box.
 */
export interface MaskLayer {
  /** Mask image URL (SVG/PNG). */
  url: string;
  /** 'luminance' (default) interprets white=visible, black=hidden. 'alpha' uses transparency. */
  mode: 'luminance' | 'alpha';
  /** Horizontal offset as % of slot width (0 = left-aligned). */
  x: number;
  /** Vertical offset as % of slot height (0 = top-aligned). */
  y: number;
  /** Mask width as % of slot width (100 = same width). */
  width: number;
  /** Mask height as % of slot height (100 = same height). */
  height: number;
  /** Gaussian-blur feather intensity in px applied to the mask edges (0 = sharp). */
  feather: number;
  /** When false the mask is temporarily hidden without removing config. Defaults to true. */
  visible?: boolean;
}

/** Default mask layer positioned to fill its slot. */
export const DEFAULT_MASK_LAYER: Omit<MaskLayer, 'url'> = {
  mode: 'luminance',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  feather: 0,
};

// ── Image Effects ─────────────────────────────────────────────────

/** CSS filter chain values.  All default to their identity/no-op value. */
export interface SlotFilterEffects {
  brightness?: number;   // 100 = identity, 0–200+
  contrast?: number;     // 100 = identity, 0–200+
  saturate?: number;     // 100 = identity, 0–200+
  blur?: number;         // px, 0 = none
  grayscale?: number;    // 0–100 %
  sepia?: number;        // 0–100 %
  hueRotate?: number;    // degrees 0–360
  invert?: number;       // 0–100 %
}

/** Drop- or glow-shadow applied via CSS filter. */
export interface SlotShadow {
  offsetX: number;   // px
  offsetY: number;   // px
  blur: number;      // px
  color: string;     // rgba
}

/** 3D tilt effect on mouse interaction.  Applied via CSS transform + JS onMouseMove. */
export interface SlotTiltEffect {
  enabled: boolean;
  /** Max rotation angle in degrees (default 15). */
  maxAngle: number;
  /** Perspective distance in px (default 1000). */
  perspective: number;
  /** Transition speed in ms when resetting tilt (default 300). */
  resetSpeed: number;
}

/** CSS mix-blend-mode for the slot element. */
export type SlotBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/** Static darken/lighten overlay on the slot (applied as a CSS pseudo-layer). */
export interface SlotOverlayEffect {
  /** 'darken' adds semi-transparent black, 'lighten' adds semi-transparent white, 'none' disables. */
  mode: 'none' | 'darken' | 'lighten';
  /** Intensity 0–100 (maps to overlay opacity). */
  intensity: number;
  /** Whether overlay only appears on hover. */
  onHoverOnly: boolean;
}

/**
 * A reusable layout template that defines the visual arrangement of media slots
 * on a fixed-ratio canvas. Stored globally in `wpsg_layout_templates` WP option.
 */
export interface LayoutTemplate {
  id: string;
  name: string;
  /** Schema version for future migrations (starts at 1) */
  schemaVersion: number;
  /** Canvas width / height ratio (e.g. 16/9 ≈ 1.778) */
  canvasAspectRatio: number;
  /** Minimum render width in px */
  canvasMinWidth: number;
  /** Maximum render width in px (0 = fill container) */
  canvasMaxWidth: number;
  /**
   * How canvas height is determined.
   * - `'aspect-ratio'` (default): height = width / canvasAspectRatio
   * - `'fixed-vh'`: height = canvasHeightVh % of viewport height
   */
  canvasHeightMode?: 'aspect-ratio' | 'fixed-vh';
  /** Viewport-height percentage used when canvasHeightMode is 'fixed-vh' (1–100, default 50). */
  canvasHeightVh?: number;
  /** Background mode: 'none' (transparent), 'color', 'gradient', or 'image'. Default: 'color'. */
  backgroundMode?: BackgroundMode;
  /** CSS background color for the canvas */
  backgroundColor: string;
  /** Gradient type: linear, radial, or conic. Default: 'linear'. */
  backgroundGradientType?: GradientType;
  /** Gradient direction preset (legacy shortcut, maps to angle). */
  backgroundGradientDirection?: GradientDirection;
  /** Custom angle in degrees for linear/conic gradients (overrides direction preset). */
  backgroundGradientAngle?: number;
  /** Gradient color stops (2–3 entries). */
  backgroundGradientStops?: GradientStop[];
  /** Radial gradient shape. Default: 'ellipse'. */
  backgroundRadialShape?: RadialShape;
  /** Radial gradient size. Default: 'farthest-corner'. */
  backgroundRadialSize?: RadialSize;
  /** Radial / conic gradient center X as % (0–100). Default: 50. */
  backgroundGradientCenterX?: number;
  /** Radial / conic gradient center Y as % (0–100). Default: 50. */
  backgroundGradientCenterY?: number;
  /** Optional background image URL (layered on top of backgroundColor) */
  backgroundImage?: string;
  /** How the background image fills the canvas (default: 'cover') */
  backgroundImageFit?: 'cover' | 'contain' | 'fill';
  /** Background image opacity 0–1 (default: 1) */
  backgroundImageOpacity?: number;
  /** Ordered list of media slots */
  slots: LayoutSlot[];
  /** Decorative graphic layers (P15-H). Key is `overlays` for DB compatibility. */
  overlays: LayoutGraphicLayer[];
  /** ISO 8601 created timestamp */
  createdAt: string;
  /** ISO 8601 last-updated timestamp */
  updatedAt: string;
  /** Organizational tags */
  tags: string[];
}

/**
 * Per-campaign binding that references a global template and stores
 * per-slot overrides (e.g. fixed media assignments, focal point tweaks).
 * Stored as post_meta `_wpsg_layout_binding`.
 */
export interface CampaignLayoutBinding {
  templateId: string;
  slotOverrides: Record<string, {
    mediaId?: string;
    objectPosition?: string;
  }>;
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

// P21-I: Typography override type (Elementor-inspired)
export interface TypographyOverride {
  // Core typography
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through';
  lineHeight?: number;
  letterSpacing?: string;
  wordSpacing?: string;
  color?: string;
  // Text Stroke
  textStrokeWidth?: string;
  textStrokeColor?: string;
  // Text Shadow
  textShadowOffsetX?: string;
  textShadowOffsetY?: string;
  textShadowBlur?: string;
  textShadowColor?: string;
  // Text Glow
  textGlowColor?: string;
  textGlowBlur?: string;
}

export interface GalleryBehaviorSettings {
  videoViewportHeight: number;
  imageViewportHeight: number;
  thumbnailScrollSpeed: number;
  scrollAnimationStyle: ScrollAnimationStyle;
  scrollAnimationDurationMs: number;
  scrollAnimationEasing: ScrollAnimationEasing;
  scrollTransitionType: ScrollTransitionType;
  imageBorderRadius: number;
  videoBorderRadius: number;
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
  // P12-C: Pluggable Gallery Adapters
  imageGalleryAdapterId: string;
  videoGalleryAdapterId: string;
  unifiedGalleryEnabled: boolean;
  unifiedGalleryAdapterId: string;
  gridCardWidth: number;
  gridCardHeight: number;
  mosaicTargetRowHeight: number;
  // Tile appearance — shared by masonry, justified, hexagonal, circular, diamond
  tileSize: number;          // px: fixed tile size for shape adapters
  tileGapX: number;          // px: horizontal gap between tiles
  tileGapY: number;          // px: vertical gap between tiles
  tileBorderWidth: number;   // px: 0 = no border
  tileBorderColor: string;   // CSS color
  tileGlowEnabled: boolean;  // hover glow via drop-shadow
  tileGlowColor: string;     // glow CSS color
  tileGlowSpread: number;    // px: glow spread radius
  tileHoverBounce: boolean;  // scale-up bounce on hover
  masonryColumns: number;    // 0 = auto-responsive
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
  cardBorderWidth: number;
  cardBorderMode: 'single' | 'auto' | 'individual';
  cardBorderColor: string;
  cardShadowPreset: string;
  cardThumbnailHeight: number;
  cardThumbnailFit: string;
  cardGridColumns: number;
  cardGap: number;
  modalCoverHeight: number;
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
  // P13-E: Container padding (px). Controls horizontal padding on all containers.
  // Default 16 (matches Mantine spacing-md). Set to 0 for true edge-to-edge.
  appPadding: number;
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
  videoTileSize: number;
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
  campaignDescriptionLineHeight: number;
  modalMobileBreakpoint: number;
  cardPageTransitionOpacity: number;
  // P14-B: Upload / Media (advanced)
  uploadMaxSizeMb: number;
  uploadAllowedTypes: string;
  libraryPageSize: number;
  mediaListPageSize: number;
  mediaCompactCardHeight: number;
  mediaSmallCardHeight: number;
  mediaMediumCardHeight: number;
  mediaLargeCardHeight: number;
  mediaListMinWidth: number;
  swrDedupingIntervalMs: number;
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
  lightboxVideoHeight: number;
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
  expiryWarningThresholdMs: number;
  adminSearchDebounceMs: number;
  loginMinPasswordLength: number;
  loginFormMaxWidth: number;
  authBarBackdropBlur: number;
  authBarMobileBreakpoint: number;
  cardAutoColumnsBreakpoints: string;
  // P20-K: Session idle timeout (minutes). 0 = disabled.
  sessionIdleTimeoutMinutes: number;
  // P15-A: Per-breakpoint gallery selection
  gallerySelectionMode: 'unified' | 'per-breakpoint';
  desktopImageAdapterId: string;
  desktopVideoAdapterId: string;
  tabletImageAdapterId: string;
  tabletVideoAdapterId: string;
  mobileImageAdapterId: string;
  mobileVideoAdapterId: string;
  // P15-A: Layout builder scope
  layoutBuilderScope: 'full' | 'viewport';
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
  viewerBgGradient: string;
  showViewerBorder: boolean;
  // P21-C: Card aspect ratio & max columns
  cardMaxColumns: number;
  cardAspectRatio: 'auto' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '2:3' | '3:2' | '21:9';
  cardMinHeight: number;
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
}

export const DEFAULT_GALLERY_BEHAVIOR_SETTINGS: GalleryBehaviorSettings = {
  videoViewportHeight: 420,
  imageViewportHeight: 420,
  thumbnailScrollSpeed: 1,
  scrollAnimationStyle: 'smooth',
  scrollAnimationDurationMs: 350,
  scrollAnimationEasing: 'ease',
  scrollTransitionType: 'slide-fade',
  imageBorderRadius: 8,
  videoBorderRadius: 8,
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
  cardBorderWidth: 4,
  cardBorderMode: 'auto',
  cardBorderColor: '#228be6',
  cardShadowPreset: 'subtle',
  cardThumbnailHeight: 200,
  cardThumbnailFit: 'cover',
  cardGridColumns: 0,
  cardGap: 16,
  modalCoverHeight: 240,
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
  // P13-E: Container horizontal padding (px)
  appPadding: 16,
  // P13-E: WP Full Bleed (per breakpoint)
  wpFullBleedDesktop: false,
  wpFullBleedTablet: false,
  wpFullBleedMobile: false,
  // P13-E: Per-gallery tile sizes (shape adapters)
  imageTileSize: 150,
  videoTileSize: 150,
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
  campaignDescriptionLineHeight: 1.6,
  modalMobileBreakpoint: 768,
  cardPageTransitionOpacity: 0.3,
  // P14-B: Upload / Media (advanced)
  uploadMaxSizeMb: 50,
  uploadAllowedTypes: 'image/*,video/*',
  libraryPageSize: 20,
  mediaListPageSize: 50,
  mediaCompactCardHeight: 100,
  mediaSmallCardHeight: 80,
  mediaMediumCardHeight: 240,
  mediaLargeCardHeight: 340,
  mediaListMinWidth: 600,
  swrDedupingIntervalMs: 5000,
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
  lightboxVideoHeight: 506,
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
  expiryWarningThresholdMs: 300000,
  adminSearchDebounceMs: 300,
  loginMinPasswordLength: 1,
  loginFormMaxWidth: 400,
  authBarBackdropBlur: 8,
  authBarMobileBreakpoint: 768,
  cardAutoColumnsBreakpoints: '480:1,768:2,1024:3,1280:4',
  // P20-K: Session idle timeout
  sessionIdleTimeoutMinutes: 0,
  // P15-A: Per-breakpoint gallery selection
  gallerySelectionMode: 'unified',
  desktopImageAdapterId: 'classic',
  desktopVideoAdapterId: 'classic',
  tabletImageAdapterId: 'classic',
  tabletVideoAdapterId: 'classic',
  mobileImageAdapterId: 'classic',
  mobileVideoAdapterId: 'classic',
  layoutBuilderScope: 'full',
  // P20-E: Uninstall data preservation
  preserveDataOnUninstall: false,
  // D-4: Archive purge safeguards
  archivePurgeDays: 0,
  archivePurgeGraceDays: 30,
  // D-20: Analytics data retention
  analyticsRetentionDays: 0,
  // P12-C defaults
  imageGalleryAdapterId: 'classic',
  videoGalleryAdapterId: 'classic',
  unifiedGalleryEnabled: false,
  unifiedGalleryAdapterId: 'compact-grid',
  gridCardWidth: 160,
  gridCardHeight: 224,
  mosaicTargetRowHeight: 200,
  // Tile appearance defaults
  tileSize: 150,
  tileGapX: 8,
  tileGapY: 8,
  tileBorderWidth: 0,
  tileBorderColor: '#ffffff',
  tileGlowEnabled: false,
  tileGlowColor: '#7c9ef8',
  tileGlowSpread: 12,
  tileHoverBounce: true,
  masonryColumns: 0,
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
  viewerBgGradient: '',
  showViewerBorder: true,
  // P21-C: Card aspect ratio & max columns
  cardMaxColumns: 0,
  cardAspectRatio: 'auto',
  cardMinHeight: 0,
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
};
