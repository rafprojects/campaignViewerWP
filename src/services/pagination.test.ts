/**
 * Tests for pagination.ts `fetchAllPages` — the shared all-pages loop behind
 * P68-A (public gallery listing) and the admin campaign selector.
 */
import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages, DEFAULT_MAX_PAGES } from './pagination';

interface TestResponse {
  items: number[];
  totalPages?: number;
}

/** Build a fake paged endpoint over `pageCount` pages, 2 items per page. */
function makeEndpoint(pageCount: number) {
  return vi.fn(async (page: number): Promise<TestResponse> => ({
    items: [page * 10, page * 10 + 1],
    totalPages: pageCount,
  }));
}

describe('fetchAllPages', () => {
  it('fetches a single page when totalPages is 1', async () => {
    const fetchPage = makeEndpoint(1);
    const pages = await fetchAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(1);
    expect(pages.flatMap((p) => p.items)).toEqual([10, 11]);
  });

  it('fetches a single page when totalPages is absent (defaults to 1)', async () => {
    const fetchPage = vi.fn(async (): Promise<TestResponse> => ({ items: [1, 2] }));
    const pages = await fetchAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(pages).toHaveLength(1);
  });

  it('walks every page in order and returns raw per-page responses', async () => {
    const fetchPage = makeEndpoint(3);
    const pages = await fetchAllPages(fetchPage);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    expect(pages).toHaveLength(3);
    expect(pages.flatMap((p) => p.items)).toEqual([10, 11, 20, 21, 30, 31]);
  });

  it('stops at the maxPages cap even when the server reports more pages', async () => {
    const fetchPage = makeEndpoint(100);
    const pages = await fetchAllPages(fetchPage, { maxPages: 4 });
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(pages).toHaveLength(4);
  });

  it('defaults the cap to DEFAULT_MAX_PAGES', async () => {
    const fetchPage = makeEndpoint(1000);
    const pages = await fetchAllPages(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(DEFAULT_MAX_PAGES);
    expect(pages).toHaveLength(DEFAULT_MAX_PAGES);
  });

  it('reports genuine per-page progress via onPage', async () => {
    const fetchPage = makeEndpoint(3);
    const progress: Array<[number, number]> = [];
    await fetchAllPages(fetchPage, {
      onPage: (completed, total) => progress.push([completed, total]),
    });
    // Real intermediate values — not a synthetic 0→N flash.
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('clamps the reported progress total to maxPages', async () => {
    const fetchPage = makeEndpoint(50);
    const totals: number[] = [];
    await fetchAllPages(fetchPage, {
      maxPages: 2,
      onPage: (_completed, total) => totals.push(total),
    });
    // total reflects what will actually be fetched, so the bar reaches 100%.
    expect(totals).toEqual([2, 2]);
  });
});
