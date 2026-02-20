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
};
