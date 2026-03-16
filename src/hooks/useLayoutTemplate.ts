/**
 * P15-E.6: SWR-based hook to fetch a layout template by ID.
 *
 * Uses the public endpoint (no auth required) so the gallery can render
 * layout-builder adapters without requiring login.
 * Falls back gracefully: returns `null` template with `error` on failure.
 */
import useSWR from 'swr';
import type { LayoutTemplate } from '@/types';

/** Resolve the WP REST API base URL from global config or current origin. */
function getApiBase(): string {
  return (
    (window as unknown as Record<string, string>).__WPSG_API_BASE__ ??
    window.location.origin
  );
}

/** Simple public fetcher — no auth header needed. */
async function fetchPublicTemplate(id: string): Promise<LayoutTemplate> {
  const url = `${getApiBase()}/wp-json/wp-super-gallery/v1/layout-templates/${id}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch layout template (${res.status})`);
  }
  return res.json() as Promise<LayoutTemplate>;
}

export interface UseLayoutTemplateResult {
  template: LayoutTemplate | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch a layout template by ID using SWR.
 *
 * - Caches across re-renders so navigating between campaigns is instant.
 * - Returns skeleton-friendly `isLoading` flag.
 * - On error, `template` is null and `error` contains a message.
 *
 * @param templateId - Template UUID (pass `undefined`/`null`/`''` to skip fetch).
 */
export function useLayoutTemplate(templateId: string | undefined | null): UseLayoutTemplateResult {
  const { data, error, isLoading } = useSWR<LayoutTemplate>(
    templateId ? `layout-template-${templateId}` : null,
    () => fetchPublicTemplate(templateId!),
    {
      revalidateOnFocus: true,
      dedupingInterval: 10_000, // 10 s dedup — balance between freshness and request volume
    },
  );

  return {
    template: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load template') : null,
  };
}
