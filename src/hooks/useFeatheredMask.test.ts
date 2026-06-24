/**
 * Tests for useFeatheredMask — covers async feathering branches (lines 27-48):
 * maskUrl undefined, featherPx ≤ 0, resolve path, reject path, cancellation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatheredMask } from './useFeatheredMask';

const featherMaskMock = vi.hoisted(() => vi.fn());
vi.mock('@wp-super-gallery/shared-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@wp-super-gallery/shared-utils')>();
  return { ...actual, featherMask: featherMaskMock };
});

beforeEach(() => {
  featherMaskMock.mockClear();
});

describe('useFeatheredMask — early returns', () => {
  it('returns undefined immediately when maskUrl is undefined', () => {
    const { result } = renderHook(() => useFeatheredMask(undefined, 5));
    expect(result.current).toBeUndefined();
    expect(featherMaskMock).not.toHaveBeenCalled();
  });

  it('returns maskUrl immediately when featherPx is 0 (line 27 branch)', () => {
    const { result } = renderHook(() => useFeatheredMask('mask.png', 0));
    expect(result.current).toBe('mask.png');
    expect(featherMaskMock).not.toHaveBeenCalled();
  });

  it('returns maskUrl immediately when featherPx is negative', () => {
    const { result } = renderHook(() => useFeatheredMask('mask.png', -1));
    expect(result.current).toBe('mask.png');
    expect(featherMaskMock).not.toHaveBeenCalled();
  });
});

describe('useFeatheredMask — async feathering', () => {
  it('calls featherMask and resolves with the feathered URL (lines 35-39)', async () => {
    featherMaskMock.mockResolvedValue('blob:feathered');
    const { result } = renderHook(() => useFeatheredMask('mask.png', 10));
    await act(async () => {
      await featherMaskMock.mock.results[0]!.value;
    });
    expect(result.current).toBe('blob:feathered');
  });

  it('falls back to original maskUrl when featherMask rejects (lines 41-44)', async () => {
    featherMaskMock.mockRejectedValue(new Error('canvas error'));
    const { result } = renderHook(() => useFeatheredMask('mask.png', 10));
    await act(async () => {
      await featherMaskMock.mock.results[0]!.value.catch(() => {});
    });
    expect(result.current).toBe('mask.png');
  });

  it('ignores resolve when unmounted before featherMask finishes (cancelled path)', async () => {
    let resolveFeather!: (url: string) => void;
    featherMaskMock.mockReturnValue(new Promise<string>((r) => { resolveFeather = r; }));

    const { result, unmount } = renderHook(() => useFeatheredMask('mask.png', 10));
    expect(featherMaskMock).toHaveBeenCalled();

    // Unmount before the promise resolves → cancelled = true → setResolved not called
    unmount();
    await act(async () => { resolveFeather('blob:late'); });

    // After unmount the resolved value should NOT be 'blob:late' (still original)
    expect(result.current).toBe('mask.png');
  });
});

describe('useFeatheredMask — maskUrl changes', () => {
  it('re-runs effect and updates when maskUrl changes', async () => {
    featherMaskMock.mockResolvedValue('blob:first');
    const { result, rerender } = renderHook(
      ({ url, px }: { url: string | undefined; px: number }) => useFeatheredMask(url, px),
      { initialProps: { url: 'a.png', px: 5 } },
    );
    await act(async () => { await featherMaskMock.mock.results[0]!.value; });
    expect(result.current).toBe('blob:first');

    featherMaskMock.mockResolvedValue('blob:second');
    await act(async () => { rerender({ url: 'b.png', px: 5 }); });
    await act(async () => { await featherMaskMock.mock.results[1]!.value; });
    expect(result.current).toBe('blob:second');
  });

  it('clears resolved when maskUrl becomes undefined', () => {
    featherMaskMock.mockResolvedValue('blob:feathered');
    const { result, rerender } = renderHook(
      ({ url, px }: { url: string | undefined; px: number }) => useFeatheredMask(url, px),
      { initialProps: { url: 'a.png' as string | undefined, px: 5 } },
    );
    act(() => { rerender({ url: undefined, px: 5 }); });
    expect(result.current).toBeUndefined();
  });
});
