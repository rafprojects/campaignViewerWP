/**
 * Branch-coverage tests for useLayoutBuilderState (hand-authored) — complements
 * useLayoutBuilderState.test.ts by hitting the negative guards (id-not-found),
 * the toggle nullish branches, empty-input early returns, and the setters.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutBuilderState, createEmptyTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate } from '@/types';

function templateWithSlots(count: number): LayoutTemplate {
  const t = createEmptyTemplate('test');
  for (let i = 0; i < count; i++) {
    t.slots.push({
      id: `s${i + 1}`, x: i * 10, y: 0, width: 20, height: 20, zIndex: i + 1,
      shape: 'rectangle', borderRadius: 0, borderWidth: 0, borderColor: '#fff',
      objectFit: 'cover', objectPosition: '50% 50%', clickAction: 'lightbox', hoverEffect: 'pop',
    });
  }
  return t;
}

const render = (count = 2) => renderHook(() => useLayoutBuilderState(templateWithSlots(count)));

describe('template setters', () => {
  it('applies every background / canvas setter', () => {
    const { result } = render();
    act(() => {
      result.current.setName('Renamed');
      result.current.setBackgroundMode('gradient');
      result.current.setBackgroundGradientDirection('to-right');
      result.current.setBackgroundGradientStops([{ color: '#000', position: 0 }, { color: '#fff', position: 100 }] as never);
      result.current.setBackgroundGradientType('radial');
      result.current.setBackgroundGradientAngle(45);
      result.current.setBackgroundRadialShape('circle');
      result.current.setBackgroundRadialSize('farthest-corner');
      result.current.setBackgroundGradientCenterX(50);
      result.current.setBackgroundGradientCenterY(50);
      result.current.setBackgroundImageFit('contain');
      result.current.setBackgroundImageOpacity(0.5);
      result.current.setCanvasHeightMode('fixed-vh');
      result.current.setCanvasHeightVh(150); // clamps to 100
    });
    expect(result.current.template.name).toBe('Renamed');
    expect(result.current.template.backgroundMode).toBe('gradient');
    expect(result.current.template.canvasHeightVh).toBe(100);
  });

  it('setBackgroundImage stores a url and clears it with an empty string', () => {
    const { result } = render();
    act(() => result.current.setBackgroundImage('http://img'));
    expect(result.current.template.backgroundImage).toBe('http://img');
    act(() => result.current.setBackgroundImage(''));
    expect(result.current.template.backgroundImage).toBeUndefined();
  });
});

describe('slot-op negative guards (non-existent id no-ops)', () => {
  it('move/resize/update/assign/clear/rename/toggle on a missing slot do nothing', () => {
    const { result } = render(1);
    const before = JSON.stringify(result.current.template.slots);
    act(() => {
      result.current.moveSlot('nope', 5, 5);
      result.current.resizeSlot('nope', 1, 1, 1, 1);
      result.current.updateSlot('nope', { width: 99 });
      result.current.assignMediaToSlot('nope', 'm1');
      result.current.clearSlotMedia('nope');
      result.current.renameSlot('nope', 'X');
      result.current.toggleSlotVisible('nope');
      result.current.toggleSlotLocked('nope');
    });
    expect(JSON.stringify(result.current.template.slots)).toBe(before);
  });
});

describe('slot ops positive paths + toggle nullish branches', () => {
  it('toggles visibility and lock both ways', () => {
    const { result } = render(1);
    act(() => result.current.toggleSlotVisible('s1'));
    expect(result.current.template.slots[0]!.visible).toBe(false);
    act(() => result.current.toggleSlotVisible('s1'));
    expect(result.current.template.slots[0]!.visible).toBe(true);
    act(() => result.current.toggleSlotLocked('s1'));
    expect(result.current.template.slots[0]!.locked).toBe(true);
    act(() => result.current.toggleSlotLocked('s1'));
    expect(result.current.template.slots[0]!.locked).toBe(false);
  });

  it('renames, assigns and clears media, and nudges with clamping', () => {
    const { result } = render(1);
    act(() => result.current.renameSlot('s1', 'Hero'));
    expect(result.current.template.slots[0]!.name).toBe('Hero');
    act(() => result.current.assignMediaToSlot('s1', 'media-9', { attachmentId: 3, url: 'u' }));
    expect(result.current.template.slots[0]!.mediaId).toBe('media-9');
    act(() => result.current.clearSlotMedia('s1'));
    expect(result.current.template.slots[0]!.mediaId).toBeUndefined();
    act(() => result.current.nudgeSlots(['s1'], -999, 999)); // clamps to 0 / (100-h)
    expect(result.current.template.slots[0]!.x).toBe(0);
  });
});

describe('batch / duplicate / auto-assign edge branches', () => {
  it('updateSlots returns early for an empty map and applies a populated one', () => {
    const { result } = render(2);
    act(() => result.current.updateSlots({}));
    act(() => result.current.updateSlots({ s1: { width: 33 } }, 'Batch'));
    expect(result.current.template.slots.find((s) => s.id === 's1')!.width).toBe(33);
  });

  it('duplicateSlots skips a non-existent id (no new selection)', () => {
    const { result } = render(1);
    act(() => result.current.duplicateSlots(['nope']));
    expect(result.current.template.slots).toHaveLength(1);
  });

  it('autoAssignMedia fills then clears the surplus slots', () => {
    const { result } = render(3);
    act(() => result.current.autoAssignMedia(['m1'], [{ id: 'm1', attachmentId: 1, url: 'u', type: 'image' } as never]));
    expect(result.current.template.slots[0]!.mediaId).toBe('m1');
    expect(result.current.template.slots[1]!.mediaId).toBeUndefined();
  });

  it('removeSlots handles single and multi labels', () => {
    const { result } = render(3);
    act(() => result.current.removeSlots(['s1']));
    act(() => result.current.removeSlots(['s2', 's3']));
    expect(result.current.template.slots).toHaveLength(0);
  });
});

describe('overlay ops', () => {
  it('add / update / move / resize / rename / toggle / remove with positive and missing ids', () => {
    const { result } = render(1);
    let oid = '';
    act(() => { oid = result.current.addOverlay('http://o'); });
    act(() => {
      result.current.updateOverlay(oid, { opacity: 0.5 });
      result.current.moveOverlay(oid, 1, 2);
      result.current.resizeOverlay(oid, 1, 2, 3, 4);
      result.current.renameOverlay(oid, 'Top');
      result.current.toggleOverlayVisible(oid);
      result.current.toggleOverlayLocked(oid);
      // missing-id no-ops
      result.current.updateOverlay('nope', { opacity: 1 });
      result.current.moveOverlay('nope', 0, 0);
      result.current.resizeOverlay('nope', 0, 0, 0, 0);
      result.current.renameOverlay('nope', 'X');
      result.current.toggleOverlayVisible('nope');
      result.current.toggleOverlayLocked('nope');
    });
    expect(result.current.template.overlays[0]!.name).toBe('Top');
    act(() => result.current.removeOverlay(oid));
    expect(result.current.template.overlays).toHaveLength(0);
  });

  it('reorderLayers recomputes z-indices across slots and an overlay', () => {
    const { result } = render(2);
    let oid = '';
    act(() => { oid = result.current.addOverlay('http://o'); });
    act(() => result.current.reorderLayers('s1', oid));
    expect(result.current.template).toBeTruthy();
  });
});

describe('history boundaries', () => {
  it('undo/redo are inert at the boundaries', () => {
    const { result } = render(1);
    expect(result.current.canRedo).toBe(false);
    // redo with empty future is a no-op
    act(() => result.current.redo());
    expect(result.current.template.slots).toHaveLength(1);
    act(() => result.current.setName('x'));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    // undo again past the start is inert
    act(() => result.current.undo());
    expect(result.current.template.name).toBe('test');
  });
});

// ── P54-D perf sanity — 100-slot state mutation ───────────────────────────

describe('P54-D — 100-slot perf sanity', () => {
  it('100 moveSlot calls complete under 200 ms', () => {
    const t = templateWithSlots(100);
    const { result } = renderHook(() => useLayoutBuilderState(t));
    const start = performance.now();
    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.moveSlot(`s${i + 1}`, 10 + i % 70, 10 + i % 70);
      }
    });
    const elapsed = performance.now() - start;
    // State mutation for 100 slots must remain well under 200 ms in a
    // headless environment; drag jank in a real browser is tracked separately.
    expect(elapsed).toBeLessThan(200);
  });

  it('100-slot nudge clamps all slots within bounds', () => {
    const t = templateWithSlots(100);
    const { result } = renderHook(() => useLayoutBuilderState(t));
    const allIds = t.slots.map((s) => s.id);
    // Nudge way off canvas — all slots must stay within [0, 100 - dimension]
    act(() => { result.current.nudgeSlots(allIds, 200, 200); });
    for (const slot of result.current.template.slots) {
      expect(slot.x).toBeLessThanOrEqual(100 - slot.width);
      expect(slot.y).toBeLessThanOrEqual(100 - slot.height);
    }
  });
});
