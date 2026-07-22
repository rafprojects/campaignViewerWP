/**
 * Company and Campaign types.
 *
 * Split out of `types/index.ts` (Phase 70-G); re-exported from `./index`.
 */
import type { MediaItem } from './media';
import type { GalleryConfig } from './gallerySettings';

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
  borderColor?: string | undefined;
  /** P13-D: Optional ISO 8601 scheduled-publish date. */
  publishAt?: string | undefined;
  /** P13-D: Optional ISO 8601 auto-unpublish date. */
  unpublishAt?: string | undefined;
  /** P15-B: Optional layout template reference. */
  layoutTemplateId?: string | undefined;
  /** Phase 23 nested campaign gallery override surface. */
  galleryOverrides?: Partial<GalleryConfig> | undefined;
  /** P18-H: Category names assigned to this campaign. */
  categories?: string[] | undefined;
}
