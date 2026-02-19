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
};
