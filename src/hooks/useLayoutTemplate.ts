/**
 * P15-E.6: Query-based hook to fetch a layout template by ID.
 *
 * Uses the public endpoint (no auth required) so the gallery can render
 * layout-builder adapters without requiring login.
 * Falls back gracefully: returns `null` template with `error` on failure.
 */
import type { LayoutTemplate } from '@/types';
import { usePublicLayoutTemplate } from '@/services/layoutTemplateQuery';

export interface UseLayoutTemplateResult {
  template: LayoutTemplate | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch a layout template by ID using TanStack Query.
 *
 * - Caches across re-renders so navigating between campaigns is instant.
 * - Returns skeleton-friendly `isLoading` flag.
 * - On error, `template` is null and `error` contains a message.
 *
 * @param templateId - Template UUID (pass `undefined`/`null`/`''` to skip fetch).
 */
export function useLayoutTemplate(templateId: string | undefined | null): UseLayoutTemplateResult {
  const { data, error, isLoading } = usePublicLayoutTemplate(templateId);

  return {
    template: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load template') : null,
  };
}
