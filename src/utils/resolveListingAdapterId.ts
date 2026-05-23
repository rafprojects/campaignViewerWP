/**
 * P35-B: Resolve the campaign listing adapter id.
 *
 * The listing surface (CardGallery) is semantically separate from per-campaign
 * galleries (which use galleryConfig with per-scope/per-breakpoint adapter trees).
 * This helper reads the three flat fields added in P35-B and applies breakpoint
 * precedence: per-breakpoint override → base id → 'compact-grid' fallback.
 *
 * Intentionally NOT folded into resolveAdapterId — that function is structured
 * around per-media-type scopes intrinsic to per-campaign galleries, and conflating
 * the two surfaces inside galleryConfig would confuse the existing per-scope model.
 */

import type { GalleryBehaviorSettings } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { normalizeAdapterId } from '@/components/Galleries/Adapters/adapterRegistry';

/**
 * Return the normalized adapter id to use for the campaign listing at the given
 * breakpoint.  Falls back to `'compact-grid'` when no setting is configured.
 *
 * Precedence (highest → lowest):
 *   1. `campaignListingAdapterIdMobile` / `campaignListingAdapterIdTablet` for the
 *      active breakpoint.
 *   2. `campaignListingAdapterId` (base, applies to all breakpoints).
 *   3. Hard-coded `'compact-grid'` — the legacy CardGallery layout.
 */
export function resolveListingAdapterId(
  s: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
): string {
  const perBreakpoint =
    breakpoint === 'mobile' ? s.campaignListingAdapterIdMobile :
    breakpoint === 'tablet' ? s.campaignListingAdapterIdTablet :
    undefined;

  const resolved = perBreakpoint ?? s.campaignListingAdapterId ?? 'compact-grid';
  return normalizeAdapterId(resolved);
}
