/**
 * Shared "fetch every page" loop for paginated REST list endpoints.
 *
 * [P68-A] Both the public gallery fetch (`App.tsx` `fetchCampaigns`) and the
 * admin campaign-selector fetch (`adminQuery.ts` `fetchAllCampaignOptions`)
 * need to walk all pages of `campaigns.list` and merge the results. They had
 * (or would have had) two independent copies of the same page loop; this is the
 * single implementation both call. The loop is intentionally shape-agnostic —
 * it returns the raw per-page responses so each caller merges its own fields
 * (one flat-maps `.items`; the other also merges `.mediaByCampaign`).
 */

/** Minimal contract a paged response must satisfy to drive the loop. */
export interface PagedResponse {
  /** Total page count reported by the server; absent/1 stops after one page. */
  totalPages?: number;
}

export interface FetchAllPagesOptions {
  /**
   * Hard cap on pages fetched regardless of the server's `totalPages`, so a
   * pathologically large collection can't spin an unbounded request loop.
   * Defaults to {@link DEFAULT_MAX_PAGES}.
   */
  maxPages?: number;
  /**
   * Called after each page resolves with the 1-based page number just fetched
   * and the effective total (`min(totalPages, maxPages)`), giving callers a
   * genuine progress signal (page N of M) rather than a synthetic one.
   */
  onPage?: (completed: number, total: number) => void;
}

/**
 * Default page cap: 20 pages. At the campaigns endpoint's max `per_page=50`
 * that covers 1,000 campaigns per space before the follow-on server-driven
 * pagination work (see PHASE68_REPORT Follow-On Candidates) would be needed.
 */
export const DEFAULT_MAX_PAGES = 20;

/**
 * Fetch pages 1..N via `fetchPage`, stopping when the server reports no further
 * pages or the `maxPages` cap is hit, and return the raw responses in order.
 *
 * @param fetchPage Fetches a single 1-based page; must resolve a {@link PagedResponse}.
 * @param options   Optional page cap and per-page progress callback.
 */
export async function fetchAllPages<TResponse extends PagedResponse>(
  fetchPage: (page: number) => Promise<TResponse>,
  options: FetchAllPagesOptions = {},
): Promise<TResponse[]> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const pages: TResponse[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetchPage(page);
    pages.push(response);
    totalPages = response.totalPages ?? 1;
    options.onPage?.(page, Math.min(totalPages, maxPages));
    page += 1;
  } while (page <= totalPages && page <= maxPages);

  return pages;
}
