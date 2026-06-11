import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageSpaces, type PageSpace } from './usePageSpaces';

type Win = typeof window & { __WPSG_PAGE_SPACES__?: PageSpace[] };

afterEach(() => {
  delete (window as Win).__WPSG_PAGE_SPACES__;
});

const SPACES: PageSpace[] = [
  { instanceId: 'wpsg-hero-0', id: 1, slug: 'hero', name: 'Hero Gallery' },
  { instanceId: 'wpsg-products-0', id: 2, slug: 'products', name: 'Products' },
];

describe('usePageSpaces', () => {
  it('returns an empty array when window.__WPSG_PAGE_SPACES__ is not defined', () => {
    const { result } = renderHook(() => usePageSpaces());
    expect(result.current).toEqual([]);
  });

  it('returns the full spaces array when the global is set', () => {
    (window as Win).__WPSG_PAGE_SPACES__ = SPACES;
    const { result } = renderHook(() => usePageSpaces());
    expect(result.current).toEqual(SPACES);
  });

  it('returns the correct length when one space is registered', () => {
    (window as Win).__WPSG_PAGE_SPACES__ = [SPACES[0]!];
    const { result } = renderHook(() => usePageSpaces());
    expect(result.current).toHaveLength(1);
  });

  it('preserves all PageSpace fields — instanceId, id, slug, name', () => {
    (window as Win).__WPSG_PAGE_SPACES__ = SPACES;
    const { result } = renderHook(() => usePageSpaces());
    expect(result.current[0]).toMatchObject({
      instanceId: 'wpsg-hero-0',
      id: 1,
      slug: 'hero',
      name: 'Hero Gallery',
    });
  });

  it('returns empty array again after the global is cleared (afterEach isolation)', () => {
    // The previous test set the global; afterEach deletes it.
    // This test verifies that each test starts with a clean slate.
    const { result } = renderHook(() => usePageSpaces());
    expect(result.current).toEqual([]);
  });
});
