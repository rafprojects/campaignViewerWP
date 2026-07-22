/**
 * Media items and tags, upload/batch responses, and the oEmbed proxy shape.
 *
 * Split out of `types/index.ts` (Phase 70-G); re-exported from `./index`.
 */

/** Measured dimensions of a gallery section container, passed to child adapters. */
export interface ContainerDimensions {
  width: number;
  height: number;
}

/** A single tag from the wpsg_media_tag taxonomy, as returned by the media REST endpoint. */
export interface MediaTag {
  id: number;
  name: string;
  slug: string;
}

export interface MediaItem {
  id: string;
  type: 'video' | 'image' | 'other';
  source: 'upload' | 'external';
  url: string;
  embedUrl?: string | undefined;
  provider?: 'youtube' | 'vimeo' | 'rumble' | 'bitchute' | 'odysee' | 'other' | undefined;
  attachmentId?: number | undefined;
  thumbnail?: string | undefined;
  title?: string | undefined;
  caption?: string | undefined;
  order: number;
  /** Pixel dimensions supplied by server (WP attachment metadata). Used by mosaic layout. */
  width?: number | undefined;
  height?: number | undefined;
  /**
   * WP attachment upload date (post_date, local time, MySQL datetime format).
   * Present only for source === 'upload' items. Undefined for external media.
   * Reserved for future Timeline adapter and date-based sort UI.
   */
  dateUploaded?: string | undefined;
  /**
   * File size in bytes from WP attachment metadata.
   * Present only for source === 'upload' items where the file exists on disk.
   * Undefined for external media or items whose file cannot be stat'd.
   */
  filesize?: number | undefined;
  /**
   * Tags from the wpsg_media_tag taxonomy assigned to this attachment.
   * Present only for source === 'upload' items that have at least one tag.
   * Undefined (not an empty array) when no tags are assigned.
   * Reserved for future filterable-gallery work.
   */
  tags?: MediaTag[] | undefined;
}

/**
 * Response from media upload endpoint
 */
export interface UploadResponse {
  attachmentId: number | string;
  url: string;
  thumbnail?: string;
  mimeType?: string;
}

export interface UploadDuplicateCampaign {
  id: string;
  title: string;
}

export interface BatchUploadResult {
  filename: string;
  success: boolean;
  attachmentId?: number | string;
  url?: string;
  thumbnail?: string;
  mimeType?: string;
  error?: string;
  /** P28-N exact duplicate */
  duplicate?: boolean;
  existing_id?: number;
  existing_url?: string;
  existing_name?: string;
  existing_campaigns?: UploadDuplicateCampaign[];
  /** P38-MD1 near-duplicate */
  near_duplicate?: boolean;
  similar_id?: number;
  similar_url?: string;
  similar_name?: string;
  similar_campaigns?: UploadDuplicateCampaign[];
  distance?: number;
}

export interface BatchUploadResponse {
  results: BatchUploadResult[];
  total: number;
  succeeded: number;
  failed: number;
}

export interface CampaignMediaBatchRequestItem {
  id?: string | undefined;
  type: 'image' | 'video';
  source: 'upload' | 'external';
  url?: string | undefined;
  attachmentId?: number | string | undefined;
  caption?: string | undefined;
  title?: string | undefined;
  thumbnail?: string | undefined;
  provider?: string | undefined;
  order?: number | undefined;
}

export interface CampaignMediaBatchFailure {
  index: number;
  error: string;
}

export interface CampaignMediaBatchResponse {
  added: MediaItem[];
  failed: CampaignMediaBatchFailure[];
  total: number;
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
