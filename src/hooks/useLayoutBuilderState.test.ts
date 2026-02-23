/**
 * Sprint 5 tests: P15-G (z-index reorder) + P15-H (overlay CRUD) in useLayoutBuilderState.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutBuilderState, createEmptyTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate } from '@/types';

function templateWithSlots(count: number): LayoutTemplate {
  const t = createEmptyTemplate('test');
  for (let i = 0; i < count; i++) {
    t.slots.push({
      id: `s${i + 1}`,
      x: i * 10,
      y: 0,
      width: 20,
      height: 20,
      zIndex: i + 1,
      shape: 'rectangle',
      borderRadius: 0,
      borderWidth: 0,
      borderColor: '#fff',
      objectFit: 'cover',
      objectPosition: '50% 50%',
      clickAction: 'lightbox',
      hoverEffect: 'pop',
    });
  }
  return t;
}

// ── P15-G: Z-Index reorder ───────────────────────────────────

describe('useLayoutBuilderState — Z-Index reorder (P15-G)', () => {
  it('bringToFront moves slot to highest z-index', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    // s1=1, s2=2, s3=3 → bringToFront(s1) → s1=4
    act(() => result.current.bringToFront(['s1']));
    const s1 = result.current.template.slots.find((s) => s.id === 's1')!;
    const others = result.current.template.slots.filter((s) => s.id !== 's1');
    expect(s1.zIndex).toBeGreaterThan(Math.max(...others.map((s) => s.zIndex)));
  });

  it('sendToBack moves slot to lowest z-index', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    // s3=3 → sendToBack(s3) → z-index should be lowest
    act(() => result.current.sendToBack(['s3']));
    const s3 = result.current.template.slots.find((s) => s.id === 's3')!;
    const others = result.current.template.slots.filter((s) => s.id !== 's3');
    expect(s3.zIndex).toBeLessThan(Math.min(...others.map((s) => s.zIndex)));
  });

  it('bringForward swaps with the slot above', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    // s1=1, s2=2, s3=3 → bringForward(s1) → s1 gets s2's z, s2 gets s1's z
    act(() => result.current.bringForward(['s1']));
    const s1 = result.current.template.slots.find((s) => s.id === 's1')!;
    const s2 = result.current.template.slots.find((s) => s.id === 's2')!;
    expect(s1.zIndex).toBe(2);
    expect(s2.zIndex).toBe(1);
  });

  it('sendBackward swaps with the slot below', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    // s3=3 → sendBackward(s3) → s3 gets s2's z, s2 gets s3's z
    act(() => result.current.sendBackward(['s3']));
    const s3 = result.current.template.slots.find((s) => s.id === 's3')!;
    const s2 = result.current.template.slots.find((s) => s.id === 's2')!;
    expect(s3.zIndex).toBe(2);
    expect(s2.zIndex).toBe(3);
  });

  it('normalizeZIndices sequential 1..N', () => {
    const initial = templateWithSlots(3);
    initial.slots[0].zIndex = 10;
    initial.slots[1].zIndex = 5;
    initial.slots[2].zIndex = 99;
    const { result } = renderHook(() =>
      useLayoutBuilderState(initial),
    );
    act(() => result.current.normalizeZIndices());
    const zIndices = result.current.template.slots
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((s) => s.zIndex);
    expect(zIndices).toEqual([1, 2, 3]);
  });

  it('sendToBack ensures no negative z-indices', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.sendToBack(['s1']));
    const allZ = result.current.template.slots.map((s) => s.zIndex);
    expect(allZ.every((z) => z >= 0)).toBe(true);
  });
});

// ── P15-H: Overlay CRUD ─────────────────────────────────────

describe('useLayoutBuilderState — Overlay CRUD (P15-H)', () => {
  it('addOverlay adds an overlay with defaults', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let overlayId: string;
    act(() => {
      overlayId = result.current.addOverlay('https://example.com/overlay.png');
    });
    expect(result.current.template.overlays).toHaveLength(1);
    const overlay = result.current.template.overlays[0];
    expect(overlay.imageUrl).toBe('https://example.com/overlay.png');
    expect(overlay.opacity).toBe(1);
    expect(overlay.pointerEvents).toBe(false);
    expect(overlay.id).toBeTruthy();
  });

  it('removeOverlay removes by id', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addOverlay('https://example.com/a.png');
    });
    expect(result.current.template.overlays).toHaveLength(1);
    act(() => result.current.removeOverlay(id!));
    expect(result.current.template.overlays).toHaveLength(0);
  });

  it('updateOverlay updates partial properties', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addOverlay('https://example.com/b.png');
    });
    act(() => result.current.updateOverlay(id!, { opacity: 0.5 }));
    expect(result.current.template.overlays[0].opacity).toBe(0.5);
  });

  it('moveOverlay updates x,y', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addOverlay('https://example.com/c.png');
    });
    act(() => result.current.moveOverlay(id!, 50, 60));
    expect(result.current.template.overlays[0].x).toBe(50);
    expect(result.current.template.overlays[0].y).toBe(60);
  });

  it('resizeOverlay updates position and dimensions', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addOverlay('https://example.com/d.png');
    });
    act(() => result.current.resizeOverlay(id!, 5, 10, 80, 90));
    const o = result.current.template.overlays[0];
    expect(o.x).toBe(5);
    expect(o.y).toBe(10);
    expect(o.width).toBe(80);
    expect(o.height).toBe(90);
  });

  it('overlay z-index is above slots by default', () => {
    const initial = templateWithSlots(3);
    const { result } = renderHook(() =>
      useLayoutBuilderState(initial),
    );
    act(() => {
      result.current.addOverlay('https://example.com/e.png');
    });
    const overlayZ = result.current.template.overlays[0].zIndex;
    const maxSlotZ = Math.max(...result.current.template.slots.map((s) => s.zIndex));
    expect(overlayZ).toBeGreaterThan(maxSlotZ);
  });
});

// ── P15-I: Shape rendering ───────────────────────────────────

describe('useLayoutBuilderState — Shape support (P15-I)', () => {
  it('addSlot defaults to rectangle shape', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.addSlot());
    expect(result.current.template.slots[0].shape).toBe('rectangle');
  });

  it('updateSlot changes shape', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addSlot();
    });
    act(() => result.current.updateSlot(id!, { shape: 'hexagon' }));
    expect(result.current.template.slots[0].shape).toBe('hexagon');
  });

  it('updateSlot sets custom clip-path', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addSlot();
    });
    act(() =>
      result.current.updateSlot(id!, {
        shape: 'custom',
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%)',
      }),
    );
    expect(result.current.template.slots[0].shape).toBe('custom');
    expect(result.current.template.slots[0].clipPath).toBe(
      'polygon(0% 0%, 100% 0%, 100% 100%)',
    );
  });

  it('updateSlot sets maskUrl', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addSlot();
    });
    act(() =>
      result.current.updateSlot(id!, { maskUrl: 'https://example.com/mask.svg' }),
    );
    expect(result.current.template.slots[0].maskUrl).toBe(
      'https://example.com/mask.svg',
    );
  });
});
