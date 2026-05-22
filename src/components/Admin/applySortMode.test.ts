/**
 * Unit tests for the applySortMode helper (P34-B).
 * Pure function — no component rendering required.
 */
import { describe, it, expect } from 'vitest';
import { applySortMode } from './applySortMode';
import type { MediaItem } from '@/types';

function makeItem(overrides: Partial<MediaItem> & Pick<MediaItem, 'id'>): MediaItem {
  return {
    type: 'image',
    source: 'upload',
    url: `https://example.com/${overrides.id}.jpg`,
    order: 1,
    ...overrides,
  };
}

const items: MediaItem[] = [
  makeItem({ id: 'c', caption: 'Charlie', order: 3, filesize: 500, dateUploaded: '2024-01-03 00:00:00' }),
  makeItem({ id: 'a', caption: 'Alpha',   order: 1, filesize: 200, dateUploaded: '2024-01-01 00:00:00' }),
  makeItem({ id: 'b', caption: 'Bravo',   order: 2, filesize: 900, dateUploaded: '2024-01-02 00:00:00' }),
];

describe('applySortMode', () => {
  it('does not mutate the original array', () => {
    const copy = [...items];
    applySortMode(items, 'title', {});
    expect(items).toEqual(copy);
  });

  it('sorts by order (ascending)', () => {
    const result = applySortMode(items, 'order', {});
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by title A–Z (caption)', () => {
    const result = applySortMode(items, 'title', {});
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by created date descending (newest first)', () => {
    const result = applySortMode(items, 'created', {});
    expect(result.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by file size descending (largest first)', () => {
    const result = applySortMode(items, 'size', {});
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by usage count descending', () => {
    const usage = { a: 10, b: 5, c: 8 };
    const result = applySortMode(items, 'usage', usage);
    expect(result.map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('places items with no dateUploaded at the end when sorting by created', () => {
    const withExternal: MediaItem[] = [
      makeItem({ id: 'ext', source: 'external', order: 1, dateUploaded: undefined }),
      makeItem({ id: 'up',  source: 'upload',   order: 2, dateUploaded: '2024-06-01 00:00:00' }),
    ];
    const result = applySortMode(withExternal, 'created', {});
    expect(result[0]!.id).toBe('up');
    expect(result[1]!.id).toBe('ext');
  });

  it('places items with no filesize at the end when sorting by size', () => {
    const mixed: MediaItem[] = [
      makeItem({ id: 'nosize', order: 1, filesize: undefined }),
      makeItem({ id: 'hassize', order: 2, filesize: 1024 }),
    ];
    const result = applySortMode(mixed, 'size', {});
    expect(result[0]!.id).toBe('hassize');
    expect(result[1]!.id).toBe('nosize');
  });

  it('treats items absent from usageSummary as 0 usage when sorting', () => {
    const usage = { a: 3 }; // b and c not present
    const result = applySortMode(items, 'usage', usage);
    expect(result[0]!.id).toBe('a'); // highest usage
  });
});
