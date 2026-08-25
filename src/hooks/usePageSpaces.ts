export interface PageSpace {
  instanceId: string;
  id: number;
  slug: string;
  name: string;
}

/** Returns all gallery spaces on the current page, as emitted by PHP into
 *  window.__MULLION_PAGE_SPACES__ via wp_footer. Empty array on single-space pages
 *  or when the current user lacks manage_mullion. */
export function usePageSpaces(): PageSpace[] {
  return (window as unknown as { __MULLION_PAGE_SPACES__?: PageSpace[] }).__MULLION_PAGE_SPACES__ ?? [];
}
