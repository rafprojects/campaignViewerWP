/**
 * Coverage tests for useLayoutBuilderZIndex — fills uncovered overlay branches
 * (lines 39, 47, 52, 70, 99) not hit by the existing useLayoutBuilderState tests.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useLayoutBuilderZIndex } from './useLayoutBuilderZIndex';
import { useLayoutBuilderHistory } from './useLayoutBuilderHistory';
import { createEmptyTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate, LayoutSlot, LayoutGraphicLayer } from '@/types';

function makeSlot(id: string, z: number): LayoutSlot {
  return {
    id, x: 0, y: 0, width: 20, height: 20, zIndex: z,
    shape: 'rectangle', borderRadius: 0, borderWidth: 0,
    borderColor: '#fff', objectFit: 'cover',
    objectPosition: '50% 50%', clickAction: 'lightbox', hoverEffect: 'pop',
  };
}

function makeOverlay(id: string, z: number): LayoutGraphicLayer {
  return { id, imageUrl: 'img.png', x: 0, y: 0, width: 10, height: 10, zIndex: z, opacity: 1, pointerEvents: false };
}

function makeHook(initial: Partial<LayoutTemplate> = {}) {
  return renderHook(() => {
    const [template, setTemplateRaw] = useState<LayoutTemplate>({
      ...createEmptyTemplate('t'),
      ...initial,
    });
    const [_isDirty, setIsDirty] = useState(false);
    const { mutate } = useLayoutBuilderHistory({ template, setTemplateRaw, setIsDirty });
    const z = useLayoutBuilderZIndex({ mutate, template });
    return { template, z };
  });
}

describe('useLayoutBuilderZIndex — overlay branches', () => {
  it('bringToFront also raises an overlay in the id set', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 1), makeSlot('s2', 2)],
      overlays: [makeOverlay('o1', 3)],
    });
    act(() => result.current.z.bringToFront(['o1']));
    const o1 = result.current.template.overlays.find((o) => o.id === 'o1')!;
    expect(o1.zIndex).toBeGreaterThan(3);
  });

  it('sendToBack also lowers an overlay in the id set', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 5), makeSlot('s2', 6)],
      overlays: [makeOverlay('o1', 7)],
    });
    act(() => result.current.z.sendToBack(['o1']));
    const o1 = result.current.template.overlays.find((o) => o.id === 'o1')!;
    const s1 = result.current.template.slots.find((s) => s.id === 's1')!;
    expect(o1.zIndex).toBeLessThan(s1.zIndex);
  });

  it('sendToBack normalizes so minimum z-index is 1 (covers the offset branch, line 52)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 1)],
      overlays: [makeOverlay('o1', 2)],
    });
    // Sending both to back results in o1 going below 1; normalization must apply
    act(() => result.current.z.sendToBack(['s1', 'o1']));
    const minZ = Math.min(
      ...result.current.template.slots.map((s) => s.zIndex),
      ...result.current.template.overlays.map((o) => o.zIndex),
    );
    expect(minZ).toBeGreaterThanOrEqual(1);
  });

  it('bringForward swaps an overlay with the item above it (line 70)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 1)],
      overlays: [makeOverlay('o1', 2), makeOverlay('o2', 3)],
    });
    act(() => result.current.z.bringForward(['o1']));
    const o1 = result.current.template.overlays.find((o) => o.id === 'o1')!;
    const o2 = result.current.template.overlays.find((o) => o.id === 'o2')!;
    expect(o1.zIndex).toBe(3);
    expect(o2.zIndex).toBe(2);
  });

  it('bringForward is a no-op for an item already at the top (above branch missing)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 1)],
      overlays: [makeOverlay('o1', 2)],
    });
    act(() => result.current.z.bringForward(['o1']));
    const o1 = result.current.template.overlays.find((o) => o.id === 'o1')!;
    expect(o1.zIndex).toBe(2); // unchanged
  });

  it('sendBackward swaps an overlay with the item below it (line 99)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 1)],
      overlays: [makeOverlay('o1', 2), makeOverlay('o2', 3)],
    });
    act(() => result.current.z.sendBackward(['o2']));
    const o1 = result.current.template.overlays.find((o) => o.id === 'o1')!;
    const o2 = result.current.template.overlays.find((o) => o.id === 'o2')!;
    expect(o2.zIndex).toBe(2);
    expect(o1.zIndex).toBe(3);
  });

  it('sendBackward is a no-op for an item already at the bottom', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 1)],
      overlays: [],
    });
    act(() => result.current.z.sendBackward(['s1']));
    const s1 = result.current.template.slots.find((s) => s.id === 's1')!;
    expect(s1.zIndex).toBe(1); // unchanged — already at bottom
  });
});

describe('useLayoutBuilderZIndex — false branch of overlay condition', () => {
  it('bringToFront with slot id skips overlays in template (false branch, line 27)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 1), makeSlot('s2', 2)],
      overlays: [makeOverlay('o1', 3)],
    });
    // Pass only the slot id — o1 is in the template but NOT in idSet
    act(() => result.current.z.bringToFront(['s1']));
    const o1 = result.current.template.overlays.find((o) => o.id === 'o1')!;
    expect(o1.zIndex).toBe(3); // unchanged — not in idSet
  });

  it('sendToBack with slot id skips overlays in template (false branch, line 47)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 5), makeSlot('s2', 6)],
      overlays: [makeOverlay('o1', 7)],
    });
    // Pass only a slot id — o1 is in the template but NOT in idSet
    act(() => result.current.z.sendToBack(['s1']));
    // o1 zIndex should not be changed by sendToBack (it was not selected)
    // (normalization may shift all, but it shouldn't be LOWER than after normalization)
    const o1 = result.current.template.overlays.find((o) => o.id === 'o1')!;
    const s2 = result.current.template.slots.find((s) => s.id === 's2')!;
    expect(o1.zIndex).toBeGreaterThan(s2.zIndex); // o1 wasn't sent to back
  });
});

describe('useLayoutBuilderZIndex — normalizeZIndices', () => {
  it('returns a normalized template synchronously', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 10), makeSlot('s2', 5), makeSlot('s3', 1)],
    });
    let normalized: LayoutTemplate | undefined;
    act(() => { normalized = result.current.z.normalizeZIndices(); });
    const zs = normalized!.slots.map((s) => s.zIndex).sort((a, b) => a - b);
    expect(zs).toEqual([1, 2, 3]);
  });
});
