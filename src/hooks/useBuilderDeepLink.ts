/**
 * P30-D — Builder URL deep-link hook.
 *
 * Provides search-param-based builder URL state management that is compatible
 * with the WordPress admin URL pattern (?page=wpsg-gallery).
 *
 * Strategy:
 *  - On open   → `history.pushState` adds `?builder=<templateId>` so the
 *    browser Back button closes the builder naturally via popstate.
 *  - On close  → `history.replaceState` removes `builder` param (no phantom
 *    forward entry; closing is not a new navigation step).
 *  - Existing params (e.g. `?page=wpsg-gallery`) are always preserved.
 *
 * Usage:
 *   const { initialBuilderTemplateId, pushBuilderUrl, clearBuilderUrl } =
 *     useBuilderDeepLink();
 */

import { useCallback, useMemo } from 'react';

export const BUILDER_URL_PARAM = 'builder';

export interface BuilderDeepLink {
  /** Template ID read from `?builder=` on initial page load. `null` if absent. */
  initialBuilderTemplateId: string | null;
  /** Push `?builder=<id>` onto history (creates a back-navigable entry). */
  pushBuilderUrl: (templateId: string) => void;
  /** Replace current URL removing the `builder` param (no forward entry). */
  clearBuilderUrl: () => void;
  /** Read the current (live) builder param from the URL. */
  getCurrentBuilderTemplateId: () => string | null;
}

export function useBuilderDeepLink(): BuilderDeepLink {
  /** Captured once at mount; stable for the lifetime of the component. */
  const initialBuilderTemplateId = useMemo<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get(BUILDER_URL_PARAM) ?? null;
    } catch {
      return null;
    }
  }, []);

  const pushBuilderUrl = useCallback((templateId: string) => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set(BUILDER_URL_PARAM, templateId);
      history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch {
      // history API not available (test environment) — ignore
    }
  }, []);

  const clearBuilderUrl = useCallback(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has(BUILDER_URL_PARAM)) return;
      params.delete(BUILDER_URL_PARAM);
      const search = params.toString();
      history.replaceState(
        null,
        '',
        `${window.location.pathname}${search ? `?${search}` : ''}`,
      );
    } catch {
      // history API not available (test environment) — ignore
    }
  }, []);

  const getCurrentBuilderTemplateId = useCallback((): string | null => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get(BUILDER_URL_PARAM) ?? null;
    } catch {
      return null;
    }
  }, []);

  return { initialBuilderTemplateId, pushBuilderUrl, clearBuilderUrl, getCurrentBuilderTemplateId };
}
