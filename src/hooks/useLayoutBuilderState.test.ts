/**
 * Comprehensive tests for useLayoutBuilderState hook.
 *
 * Sprint 5: P15-G (z-index reorder) + P15-H (overlay CRUD) + P15-I (shapes)
 * Sprint 6+: Slot CRUD, undo/redo, selection, dirty tracking, template-level
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutBuilderState, createEmptyTemplate, migrateTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate } from '@/types';
import { DEFAULT_TEXT_LAYER } from '@/types';

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

// ── P59: text layers participate in the unified z-index stack ──

describe('useLayoutBuilderState — text-layer z-index (P59)', () => {
  it('reorderLayers renumbers text layers alongside slots/overlays', () => {
    const initial = templateWithSlots(2); // s1 z=1, s2 z=2
    initial.texts = [{ ...DEFAULT_TEXT_LAYER, id: 't1', zIndex: 3 }];
    const { result } = renderHook(() => useLayoutBuilderState(initial));

    // Panel order (top→bottom by z): t1(3), s2(2), s1(1).
    // Drag s1 above t1 → [s1, t1, s2] → s1=3, t1=2, s2=1.
    act(() => result.current.reorderLayers('s1', 't1'));

    const s1 = result.current.template.slots.find((s) => s.id === 's1')!;
    const s2 = result.current.template.slots.find((s) => s.id === 's2')!;
    const t1 = result.current.template.texts!.find((t) => t.id === 't1')!;
    expect(s1.zIndex).toBe(3);
    // Regression guard: before the fix the text kept its stale z-index (3).
    expect(t1.zIndex).toBe(2);
    expect(s2.zIndex).toBe(1);
  });

  it('addOverlay stacks above an existing high-z text layer', () => {
    const initial = createEmptyTemplate('test');
    initial.texts = [{ ...DEFAULT_TEXT_LAYER, id: 't1', zIndex: 500 }];
    const { result } = renderHook(() => useLayoutBuilderState(initial));

    let overlayId = '';
    act(() => {
      overlayId = result.current.addOverlay('https://example.com/o.png');
    });

    const overlay = result.current.template.overlays.find((o) => o.id === overlayId)!;
    const t1 = result.current.template.texts!.find((t) => t.id === 't1')!;
    // Regression guard: addOverlay's max-z now includes text layers, so a new
    // overlay is never placed underneath an existing text layer.
    expect(overlay.zIndex).toBeGreaterThan(t1.zIndex);
  });
});

// ── P15-H: Overlay CRUD ─────────────────────────────────────

describe('useLayoutBuilderState — Overlay CRUD (P15-H)', () => {
  it('addOverlay adds an overlay with defaults', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let overlayId = '';
    act(() => {
      overlayId = result.current.addOverlay('https://example.com/overlay.png');
    });
    expect(overlayId).toBeTruthy();
    expect(result.current.template.overlays).toHaveLength(1);
    const overlay = result.current.template.overlays[0];
    expect(overlay.id).toBe(overlayId);
    expect(overlay.imageUrl).toBe('https://example.com/overlay.png');
    expect(overlay.opacity).toBe(1);
    expect(overlay.pointerEvents).toBe(false);
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

// ── createEmptyTemplate ─────────────────────────────────────

describe('createEmptyTemplate', () => {
  it('returns a template with sensible defaults', () => {
    const t = createEmptyTemplate();
    expect(t.name).toBe('Untitled Layout');
    expect(t.schemaVersion).toBe(3);
    expect(t.canvasAspectRatio).toBeCloseTo(16 / 9);
    expect(t.slots).toEqual([]);
    expect(t.overlays).toEqual([]);
    expect(t.texts).toEqual([]);
    expect(t.id).toBe('');
    expect(t.backgroundColor).toBe('#1a1a2e');
    expect(t.tags).toEqual([]);
  });

  it('accepts a custom name', () => {
    const t = createEmptyTemplate('My Layout');
    expect(t.name).toBe('My Layout');
  });

  it('sets valid ISO timestamps', () => {
    const t = createEmptyTemplate();
    expect(() => new Date(t.createdAt).toISOString()).not.toThrow();
    expect(() => new Date(t.updatedAt).toISOString()).not.toThrow();
  });
});

// ── Slot CRUD ───────────────────────────────────────────────

describe('useLayoutBuilderState — Slot CRUD', () => {
  it('addSlot adds a slot with default values', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addSlot();
    });
    expect(id!).toBeTruthy();
    expect(result.current.template.slots).toHaveLength(1);
    const slot = result.current.template.slots[0];
    expect(slot.id).toBe(id!);
    expect(slot.shape).toBe('rectangle');
    expect(slot.width).toBe(25);
    expect(slot.height).toBe(25);
  });

  it('addSlot staggers position for multiple slots', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => {
      result.current.addSlot();
      result.current.addSlot();
      result.current.addSlot();
    });
    // Each slot should have a different x/y offset
    const positions = result.current.template.slots.map((s) => `${s.x},${s.y}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(positions.length);
  });

  it('addSlot auto-selects the new slot', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    let id: string;
    act(() => {
      id = result.current.addSlot();
    });
    expect(result.current.selectedSlotIds.has(id!)).toBe(true);
    expect(result.current.selectedSlotIds.size).toBe(1);
  });

  it('removeSlots removes slots by ID array', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.removeSlots(['s1', 's3']));
    const ids = result.current.template.slots.map((s) => s.id);
    expect(ids).toEqual(['s2']);
  });

  it('removeSlots clears removed IDs from selection', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.selectSlot('s2'));
    act(() => result.current.removeSlots(['s2']));
    expect(result.current.selectedSlotIds.has('s2')).toBe(false);
  });

  it('removeSlots with empty array is a no-op (but pushes history)', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(2)),
    );
    act(() => result.current.removeSlots([]));
    expect(result.current.template.slots).toHaveLength(2);
  });

  it('duplicateSlots creates offset copies with new IDs', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(2)),
    );
    act(() => result.current.duplicateSlots(['s1']));
    expect(result.current.template.slots).toHaveLength(3);
    const dup = result.current.template.slots[2];
    expect(dup.id).not.toBe('s1');
    expect(dup.x).toBe(Math.min(0 + 3, 100 - 20)); // source.x + 3 clamped
    expect(dup.y).toBe(Math.min(0 + 3, 100 - 20));
  });

  it('duplicateSlots creates copies and updates selection', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(2)),
    );
    act(() => result.current.duplicateSlots(['s1']));
    // The duplicated slot should be the last one
    const slots = result.current.template.slots;
    expect(slots).toHaveLength(3);
    const dupSlot = slots[slots.length - 1];
    expect(dupSlot.id).not.toBe('s1');
    expect(dupSlot.id).not.toBe('s2');
    // Duplicated slot should have the source's dimensions
    expect(dupSlot.width).toBe(20);
    expect(dupSlot.height).toBe(20);
  });

  it('duplicateSlots clamps to canvas bounds', () => {
    const initial = templateWithSlots(1);
    initial.slots[0].x = 90;
    initial.slots[0].y = 90;
    initial.slots[0].width = 20;
    initial.slots[0].height = 20;
    const { result } = renderHook(() => useLayoutBuilderState(initial));
    act(() => result.current.duplicateSlots(['s1']));
    const dup = result.current.template.slots[1];
    expect(dup.x).toBeLessThanOrEqual(100 - dup.width);
    expect(dup.y).toBeLessThanOrEqual(100 - dup.height);
  });

  it('duplicateSlots with nonexistent ID creates nothing', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(2)),
    );
    act(() => result.current.duplicateSlots(['nonexistent']));
    expect(result.current.template.slots).toHaveLength(2);
  });

  it('duplicateSlots selects the duplicated slot(s), not the originals', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(2)));
    act(() => { result.current.duplicateSlots(['s1']); });
    expect(result.current.selectedSlotIds.size).toBe(1);
    expect(result.current.selectedSlotIds.has('s1')).toBe(false);
    const newId = [...result.current.selectedSlotIds][0]!;
    expect(result.current.template.slots.some((s) => s.id === newId)).toBe(true);
  });
});

// ── Slot mutation ───────────────────────────────────────────

describe('useLayoutBuilderState — Slot mutation', () => {
  it('moveSlot updates x and y', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(1)),
    );
    act(() => result.current.moveSlot('s1', 50, 60));
    expect(result.current.template.slots[0].x).toBe(50);
    expect(result.current.template.slots[0].y).toBe(60);
  });

  it('moveSlot with nonexistent ID is a no-op', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(1)),
    );
    const before = result.current.template.slots[0];
    act(() => result.current.moveSlot('nonexistent', 99, 99));
    expect(result.current.template.slots[0].x).toBe(before.x);
  });

  it('moveSlot clamps x to lower bound (0)', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(1)),
    );
    act(() => result.current.moveSlot('s1', -5, 0));
    expect(result.current.template.slots[0].x).toBe(0);
  });

  it('moveSlot clamps x to upper bound (100 - slot.width)', () => {
    const initial = templateWithSlots(1);
    initial.slots[0].width = 20;
    const { result } = renderHook(() => useLayoutBuilderState(initial));
    act(() => result.current.moveSlot('s1', 110, 0));
    expect(result.current.template.slots[0].x).toBe(80); // 100 - 20
  });

  it('moveSlot clamps y to lower bound (0)', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(1)),
    );
    act(() => result.current.moveSlot('s1', 0, -10));
    expect(result.current.template.slots[0].y).toBe(0);
  });

  it('moveSlot clamps y to upper bound (100 - slot.height)', () => {
    const initial = templateWithSlots(1);
    initial.slots[0].height = 20;
    const { result } = renderHook(() => useLayoutBuilderState(initial));
    act(() => result.current.moveSlot('s1', 0, 110));
    expect(result.current.template.slots[0].y).toBe(80); // 100 - 20
  });

  it('resizeSlot updates all four dimensions', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(1)),
    );
    act(() => result.current.resizeSlot('s1', 5, 10, 60, 70));
    const s = result.current.template.slots[0];
    expect(s.x).toBe(5);
    expect(s.y).toBe(10);
    expect(s.width).toBe(60);
    expect(s.height).toBe(70);
  });

  it('nudgeSlots moves by delta and clamps to bounds', () => {
    const initial = templateWithSlots(1);
    initial.slots[0].x = 0;
    initial.slots[0].y = 0;
    initial.slots[0].width = 20;
    initial.slots[0].height = 20;
    const { result } = renderHook(() => useLayoutBuilderState(initial));
    // Nudge negatively — should clamp at 0
    act(() => result.current.nudgeSlots(['s1'], -10, -10));
    expect(result.current.template.slots[0].x).toBe(0);
    expect(result.current.template.slots[0].y).toBe(0);
  });

  it('nudgeSlots clamps at upper bound (100 - width)', () => {
    const initial = templateWithSlots(1);
    initial.slots[0].x = 70;
    initial.slots[0].width = 20;
    const { result } = renderHook(() => useLayoutBuilderState(initial));
    act(() => result.current.nudgeSlots(['s1'], 20, 0));
    expect(result.current.template.slots[0].x).toBe(80); // 100 - 20
  });

  it('assignMediaToSlot sets mediaId on the slot', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(1)),
    );
    act(() => result.current.assignMediaToSlot('s1', 'media-42'));
    expect(result.current.template.slots[0].mediaId).toBe('media-42');
  });

  it('clearSlotMedia removes mediaId from the slot', () => {
    const initial = templateWithSlots(1);
    initial.slots[0].mediaId = 'media-42';
    const { result } = renderHook(() => useLayoutBuilderState(initial));
    act(() => result.current.clearSlotMedia('s1'));
    expect(result.current.template.slots[0].mediaId).toBeUndefined();
  });

  it('autoAssignMedia assigns in order, clearing extras', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.autoAssignMedia(['m1', 'm2']));
    expect(result.current.template.slots[0].mediaId).toBe('m1');
    expect(result.current.template.slots[1].mediaId).toBe('m2');
    expect(result.current.template.slots[2].mediaId).toBeUndefined();
  });
});

// ── Template-level actions ──────────────────────────────────

describe('useLayoutBuilderState — Template-level actions', () => {
  it('setName updates template name', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('New Name'));
    expect(result.current.template.name).toBe('New Name');
  });

  it('setAspectRatio updates canvas ratio', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setAspectRatio(4 / 3));
    expect(result.current.template.canvasAspectRatio).toBeCloseTo(4 / 3);
  });

  it('setBackgroundColor updates background', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setBackgroundColor('#ff0000'));
    expect(result.current.template.backgroundColor).toBe('#ff0000');
  });

  it('setTemplate replaces entire template and resets state', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    // Make it dirty
    act(() => result.current.addSlot());
    expect(result.current.isDirty).toBe(true);

    const newTemplate = createEmptyTemplate('Replaced');
    newTemplate.id = 'tpl-new';
    act(() => result.current.setTemplate(newTemplate));

    expect(result.current.template.name).toBe('Replaced');
    expect(result.current.template.id).toBe('tpl-new');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.selectedSlotIds.size).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });
});

// ── Selection ───────────────────────────────────────────────

describe('useLayoutBuilderState — Selection', () => {
  it('selectSlot selects a single slot', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.selectSlot('s2'));
    expect(result.current.selectedSlotIds.has('s2')).toBe(true);
    expect(result.current.selectedSlotIds.size).toBe(1);
  });

  it('selectSlot replaces previous selection', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.selectSlot('s1'));
    act(() => result.current.selectSlot('s2'));
    expect(result.current.selectedSlotIds.has('s1')).toBe(false);
    expect(result.current.selectedSlotIds.has('s2')).toBe(true);
  });

  it('toggleSlotSelection adds to selection', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.selectSlot('s1'));
    act(() => result.current.toggleSlotSelection('s2'));
    expect(result.current.selectedSlotIds.has('s1')).toBe(true);
    expect(result.current.selectedSlotIds.has('s2')).toBe(true);
  });

  it('toggleSlotSelection removes if already selected', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.selectSlot('s1'));
    act(() => result.current.toggleSlotSelection('s1'));
    expect(result.current.selectedSlotIds.has('s1')).toBe(false);
  });

  it('clearSelection empties the set', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(templateWithSlots(3)),
    );
    act(() => result.current.selectSlot('s1'));
    act(() => result.current.toggleSlotSelection('s2'));
    act(() => result.current.clearSelection());
    expect(result.current.selectedSlotIds.size).toBe(0);
  });
});

// ── Dirty tracking ──────────────────────────────────────────

describe('useLayoutBuilderState — Dirty tracking', () => {
  it('starts clean', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    expect(result.current.isDirty).toBe(false);
  });

  it('becomes dirty after a mutation', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('Changed'));
    expect(result.current.isDirty).toBe(true);
  });

  it('markSaved clears dirty flag', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('Changed'));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.markSaved());
    expect(result.current.isDirty).toBe(false);
  });

  it('mutation after markSaved re-dirties', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('A'));
    act(() => result.current.markSaved());
    act(() => result.current.setName('B'));
    expect(result.current.isDirty).toBe(true);
  });
});

// ── Preview ─────────────────────────────────────────────────

describe('useLayoutBuilderState — Preview', () => {
  it('starts not in preview mode', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    expect(result.current.isPreview).toBe(false);
  });

  it('togglePreview flips the flag', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.togglePreview());
    expect(result.current.isPreview).toBe(true);
    act(() => result.current.togglePreview());
    expect(result.current.isPreview).toBe(false);
  });
});

// ── Undo / Redo ─────────────────────────────────────────────

describe('useLayoutBuilderState — Undo / Redo', () => {
  it('canUndo is false initially', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    expect(result.current.canUndo).toBe(false);
  });

  it('canRedo is false initially', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    expect(result.current.canRedo).toBe(false);
  });

  it('canUndo becomes true after a mutation', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('Changed'));
    expect(result.current.canUndo).toBe(true);
  });

  it('undo restores previous template state', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('First'));
    act(() => result.current.setName('Second'));
    expect(result.current.template.name).toBe('Second');

    act(() => result.current.undo());
    expect(result.current.template.name).toBe('First');
  });

  it('redo restores forward state after undo', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('First'));
    act(() => result.current.setName('Second'));
    act(() => result.current.undo());
    expect(result.current.template.name).toBe('First');

    act(() => result.current.redo());
    expect(result.current.template.name).toBe('Second');
  });

  it('canRedo becomes false after all redos exhausted', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('A'));
    act(() => result.current.setName('B'));
    // At tip — no redo available
    expect(result.current.canRedo).toBe(false);
    // After undo, redo should be available
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);
  });

  it('undo when canUndo is false is a no-op', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    const nameBefore = result.current.template.name;
    act(() => result.current.undo());
    expect(result.current.template.name).toBe(nameBefore);
  });

  it('redo when canRedo is false is a no-op', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('A'));
    const nameAfter = result.current.template.name;
    act(() => result.current.redo());
    expect(result.current.template.name).toBe(nameAfter);
  });

  it('undo marks state as dirty', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('Changed'));
    act(() => result.current.markSaved());
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.undo());
    expect(result.current.isDirty).toBe(true);
  });

  it('new mutation after undo clears redo stack', () => {
    const { result } = renderHook(() =>
      useLayoutBuilderState(createEmptyTemplate()),
    );
    act(() => result.current.setName('A'));
    act(() => result.current.setName('B'));
    act(() => result.current.undo()); // back to A
    // New mutation should wipe the "B" redo
    act(() => result.current.setName('C'));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.template.name).toBe('C');
  });
});

// ── P58-A: Clipboard (copy / paste) ──────────────────────────

describe('useLayoutBuilderState — Clipboard (P58-A)', () => {
  it('copySlots returns the count; pasteSlots clones with an offset, leaving originals intact', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(2)));
    let copied = 0;
    act(() => { copied = result.current.copySlots(['s1']); });
    expect(copied).toBe(1);
    // copy alone does not mutate the template
    expect(result.current.template.slots).toHaveLength(2);

    act(() => { result.current.pasteSlots(); });
    expect(result.current.template.slots).toHaveLength(3);
    const original = result.current.template.slots.find((s) => s.id === 's1')!;
    const pasted = result.current.template.slots[2]!;
    expect(pasted.id).not.toBe('s1');
    expect(pasted.x).toBe(3); // s1 at x:0 → +3% offset
    expect(pasted.y).toBe(3);
    expect(original.x).toBe(0); // original untouched
    expect(original.y).toBe(0);
  });

  it('pasteSlots selects the pasted slots, not the originals', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(2)));
    act(() => { result.current.copySlots(['s1', 's2']); });
    act(() => { result.current.pasteSlots(); });
    expect(result.current.selectedSlotIds.size).toBe(2);
    expect(result.current.selectedSlotIds.has('s1')).toBe(false);
    expect(result.current.selectedSlotIds.has('s2')).toBe(false);
  });

  it('repeated pasteSlots offsets cumulatively', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.copySlots(['s1']); });
    act(() => { result.current.pasteSlots(); }); // offset 3
    act(() => { result.current.pasteSlots(); }); // offset 6
    const slots = result.current.template.slots;
    expect(slots).toHaveLength(3);
    expect(slots[1]!.x).toBe(3);
    expect(slots[2]!.x).toBe(6);
  });

  it('a fresh copySlots resets the paste offset cadence', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.copySlots(['s1']); });
    act(() => { result.current.pasteSlots(); }); // offset 3
    act(() => { result.current.copySlots(['s1']); }); // reset cadence
    act(() => { result.current.pasteSlots(); }); // offset 3 again, not 6
    const slots = result.current.template.slots;
    expect(slots[1]!.x).toBe(3);
    expect(slots[2]!.x).toBe(3);
  });

  it('pasteSlots with an empty clipboard is a no-op', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(2)));
    let ids: string[] = ['sentinel'];
    act(() => { ids = result.current.pasteSlots(); });
    expect(ids).toEqual([]);
    expect(result.current.template.slots).toHaveLength(2);
  });

  it('paste is a single undo entry (one undo removes the whole paste)', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(2)));
    act(() => { result.current.copySlots(['s1', 's2']); });
    act(() => { result.current.pasteSlots(); });
    expect(result.current.template.slots).toHaveLength(4);
    act(() => { result.current.undo(); });
    expect(result.current.template.slots).toHaveLength(2);
  });

  it('copySlots deep-clones nested effect objects (paste is independent of the source)', () => {
    const initial = templateWithSlots(1);
    initial.slots[0].filterEffects = { brightness: 50 };
    const { result } = renderHook(() => useLayoutBuilderState(initial));
    act(() => { result.current.copySlots(['s1']); });
    act(() => { result.current.pasteSlots(); });
    const pasted = result.current.template.slots[1]!;
    act(() => { result.current.updateSlot(pasted.id, { filterEffects: { brightness: 99 } }); });
    const original = result.current.template.slots.find((s) => s.id === 's1')!;
    expect(original.filterEffects?.brightness).toBe(50); // source not mutated
  });
});

// ── P58-A: Slot opacity ──────────────────────────────────────

describe('useLayoutBuilderState — Slot opacity (P58-A)', () => {
  it('opacity defaults to undefined and updateSlot merges a value', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    expect(result.current.template.slots[0]!.opacity).toBeUndefined();
    act(() => { result.current.updateSlot('s1', { opacity: 0.5 }); });
    expect(result.current.template.slots[0]!.opacity).toBe(0.5);
  });

  it('opacity can be cleared back to undefined', () => {
    const initial = templateWithSlots(1);
    initial.slots[0].opacity = 0.3;
    const { result } = renderHook(() => useLayoutBuilderState(initial));
    act(() => { result.current.updateSlot('s1', { opacity: undefined }); });
    expect(result.current.template.slots[0]!.opacity).toBeUndefined();
  });
});

// ── P58-F: Auto-grid generator ───────────────────────────────

describe('useLayoutBuilderState — Auto-grid (P58-F)', () => {
  it('generateGrid creates rows×cols slots, selected, as a single undo entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.generateGrid({ rows: 2, cols: 3, gapPct: 0, marginPct: 0 }); });
    expect(result.current.template.slots).toHaveLength(6);
    expect(result.current.selectedSlotIds.size).toBe(6);
    act(() => { result.current.undo(); }); // one undo clears the whole grid
    expect(result.current.template.slots).toHaveLength(0);
  });

  it('generateGrid appends by default and replaces when asked', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(2)));
    act(() => { result.current.generateGrid({ rows: 1, cols: 2, gapPct: 0, marginPct: 0 }); });
    expect(result.current.template.slots).toHaveLength(4); // 2 existing + 2 appended
    act(() => { result.current.generateGrid({ rows: 1, cols: 3, gapPct: 0, marginPct: 0, replace: true }); });
    expect(result.current.template.slots).toHaveLength(3); // replaced
  });

  it('generateGrid assigns sequential z-indices and default slot props', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.generateGrid({ rows: 1, cols: 2, gapPct: 0, marginPct: 0 }); });
    const slots = result.current.template.slots;
    expect(slots[0]!.zIndex).toBe(1);
    expect(slots[1]!.zIndex).toBe(2);
    expect(slots[0]!.shape).toBe('rectangle'); // from DEFAULT_LAYOUT_SLOT
    expect(slots[0]!.width).toBe(50);
  });

  it('generateGrid with over-constrained settings is a no-op', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let ids: string[] = ['sentinel'];
    act(() => { ids = result.current.generateGrid({ rows: 1, cols: 10, gapPct: 20, marginPct: 0 }); });
    expect(ids).toEqual([]);
    expect(result.current.template.slots).toHaveLength(0);
  });
});

// ── P58-D: Marquee selection helper ──────────────────────────

describe('useLayoutBuilderState — addSlotsToSelection (P58-D)', () => {
  it('unions ids into the current selection', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(3)));
    act(() => { result.current.selectSlot('s1'); });
    act(() => { result.current.addSlotsToSelection(['s2', 's3']); });
    expect(result.current.selectedSlotIds).toEqual(new Set(['s1', 's2', 's3']));
  });

  it('does not drop already-selected ids it re-adds', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(2)));
    act(() => { result.current.selectSlot('s1'); });
    act(() => { result.current.addSlotsToSelection(['s1', 's2']); });
    expect(result.current.selectedSlotIds).toEqual(new Set(['s1', 's2']));
  });
});

// ── P58-B: Per-breakpoint slot overrides ────────────────────

describe('useLayoutBuilderState — breakpoint overrides (P58-B)', () => {
  it('starts with desktop as activeBreakpoint', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    expect(result.current.activeBreakpoint).toBe('desktop');
  });

  it('setActiveBreakpoint changes the active breakpoint without creating a history entry', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    const historyBefore = result.current.historyEntries.length;
    act(() => { result.current.setActiveBreakpoint('tablet'); });
    expect(result.current.activeBreakpoint).toBe('tablet');
    expect(result.current.historyEntries.length).toBe(historyBefore);
  });

  it('moveSlot in tablet mode writes to breakpointOverrides, not base slot', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.setActiveBreakpoint('tablet'); });
    act(() => { result.current.moveSlot('s1', 50, 50); });
    // Base slot unchanged
    expect(result.current.template.slots[0]!.x).toBe(0);
    expect(result.current.template.slots[0]!.y).toBe(0);
    // Breakpoint override written
    expect(result.current.template.breakpointOverrides?.tablet?.s1?.x).toBe(50);
    expect(result.current.template.breakpointOverrides?.tablet?.s1?.y).toBe(50);
  });

  it('moveSlot in desktop mode updates the base slot', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.moveSlot('s1', 30, 40); });
    expect(result.current.template.slots[0]!.x).toBe(30);
    expect(result.current.template.slots[0]!.y).toBe(40);
    expect(result.current.template.breakpointOverrides).toBeUndefined();
  });

  it('resizeSlot in mobile mode writes to breakpointOverrides', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.setActiveBreakpoint('mobile'); });
    act(() => { result.current.resizeSlot('s1', 10, 10, 30, 30); });
    const mobileOverride = result.current.template.breakpointOverrides?.mobile?.s1;
    expect(mobileOverride).toMatchObject({ x: 10, y: 10, width: 30, height: 30 });
    // Base slot unchanged
    expect(result.current.template.slots[0]!.width).toBe(20);
  });

  it('setSlotBreakpointOverride writes sparse overrides', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.setSlotBreakpointOverride('s1', 'tablet', { visible: false }); });
    expect(result.current.template.breakpointOverrides?.tablet?.s1?.visible).toBe(false);
  });

  it('clearSlotBreakpointOverride removes the override', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.setSlotBreakpointOverride('s1', 'tablet', { x: 50, y: 50 }); });
    act(() => { result.current.clearSlotBreakpointOverride('s1', 'tablet'); });
    expect(result.current.template.breakpointOverrides?.tablet?.s1).toBeUndefined();
  });

  it('nudgeSlots in tablet mode delta-applies to breakpoint override', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    // Set a base tablet position first
    act(() => { result.current.setActiveBreakpoint('tablet'); });
    act(() => { result.current.moveSlot('s1', 20, 20); });
    // Nudge by +5, +5
    act(() => { result.current.nudgeSlots(['s1'], 5, 5); });
    const override = result.current.template.breakpointOverrides?.tablet?.s1;
    expect(override?.x).toBe(25);
    expect(override?.y).toBe(25);
  });

  // ── B-1: updateSlot routes override-eligible keys per breakpoint ──

  it('updateSlot in tablet mode routes rotation/opacity to the override, not the base slot', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.setActiveBreakpoint('tablet'); });
    act(() => { result.current.updateSlot('s1', { rotation: 30, opacity: 0.5 }); });

    // Base slot untouched
    expect(result.current.template.slots[0]!.rotation).toBeUndefined();
    expect(result.current.template.slots[0]!.opacity).toBeUndefined();
    // Override written
    const override = result.current.template.breakpointOverrides?.tablet?.s1;
    expect(override?.rotation).toBe(30);
    expect(override?.opacity).toBe(0.5);
  });

  it('updateSlot in tablet mode still writes non-override keys (e.g. shape) to the base slot', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.setActiveBreakpoint('tablet'); });
    act(() => { result.current.updateSlot('s1', { shape: 'circle', rotation: 15 }); });

    // Non-override key edits the base slot
    expect(result.current.template.slots[0]!.shape).toBe('circle');
    // Override key still goes to the breakpoint layer
    expect(result.current.template.breakpointOverrides?.tablet?.s1?.rotation).toBe(15);
    // ...and shape is NOT duplicated into the override
    expect((result.current.template.breakpointOverrides?.tablet?.s1 as Record<string, unknown> | undefined)?.shape).toBeUndefined();
  });

  it('updateSlot in desktop mode edits the base slot directly', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.updateSlot('s1', { rotation: 45, shape: 'diamond' }); });
    expect(result.current.template.slots[0]!.rotation).toBe(45);
    expect(result.current.template.slots[0]!.shape).toBe('diamond');
    expect(result.current.template.breakpointOverrides).toBeUndefined();
  });

  // ── B-2: toggleSlotVisible is per-breakpoint ──

  it('toggleSlotVisible in tablet mode writes a visibility override, not the base slot', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.setActiveBreakpoint('tablet'); });
    act(() => { result.current.toggleSlotVisible('s1'); });

    // Base slot visibility unchanged
    expect(result.current.template.slots[0]!.visible).toBeUndefined();
    // Override hides the slot at tablet only
    expect(result.current.template.breakpointOverrides?.tablet?.s1?.visible).toBe(false);
  });

  it('toggleSlotVisible in desktop mode toggles the base slot', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.toggleSlotVisible('s1'); });
    expect(result.current.template.slots[0]!.visible).toBe(false);
    expect(result.current.template.breakpointOverrides).toBeUndefined();
  });

  // ── updateSlots (batch) breakpoint-awareness — powers the fit/align toolbar ──

  it('updateSlots in tablet mode routes override-eligible keys to the breakpoint layer', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(2)));
    act(() => { result.current.setActiveBreakpoint('tablet'); });
    act(() => {
      result.current.updateSlots({
        s1: { x: 10, y: 20, width: 30, height: 40 },
        s2: { x: 50 },
      });
    });

    // Base slots untouched
    expect(result.current.template.slots[0]!.x).toBe(0);
    expect(result.current.template.slots[1]!.x).toBe(10);
    // Overrides written to tablet
    expect(result.current.template.breakpointOverrides?.tablet?.s1).toMatchObject({ x: 10, y: 20, width: 30, height: 40 });
    expect(result.current.template.breakpointOverrides?.tablet?.s2).toMatchObject({ x: 50 });
  });

  it('updateSlots in tablet mode still writes non-override keys to the base slot', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.setActiveBreakpoint('tablet'); });
    act(() => { result.current.updateSlots({ s1: { shape: 'circle', x: 25 } }); });

    expect(result.current.template.slots[0]!.shape).toBe('circle');
    expect(result.current.template.breakpointOverrides?.tablet?.s1?.x).toBe(25);
  });

  it('updateSlots in desktop mode edits base slots directly', () => {
    const { result } = renderHook(() => useLayoutBuilderState(templateWithSlots(1)));
    act(() => { result.current.updateSlots({ s1: { x: 33, shape: 'diamond' } }); });
    expect(result.current.template.slots[0]!.x).toBe(33);
    expect(result.current.template.slots[0]!.shape).toBe('diamond');
    expect(result.current.template.breakpointOverrides).toBeUndefined();
  });
});

describe('migrateTemplate (P58-B, P59-A)', () => {
  /** Build a genuine vN template by stripping fields a later version would add. */
  function vTemplate(version: number): LayoutTemplate {
    const t: LayoutTemplate = { ...createEmptyTemplate(), schemaVersion: version };
    if (version < 3) delete (t as { texts?: unknown }).texts;
    if (version < 2) delete (t as { breakpointOverrides?: unknown }).breakpointOverrides;
    return t;
  }

  it('carries a schemaVersion 1 template all the way to the current version (3)', () => {
    const migrated = migrateTemplate(vTemplate(1));
    expect(migrated.schemaVersion).toBe(3);
  });

  it('initialises breakpointOverrides to an empty object when migrating from v1', () => {
    const migrated = migrateTemplate(vTemplate(1));
    expect(migrated.breakpointOverrides).toEqual({});
  });

  it('initialises texts to an empty array when migrating a v2 template to v3', () => {
    const old = vTemplate(2);
    expect(old.texts).toBeUndefined();
    const migrated = migrateTemplate(old);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.texts).toEqual([]);
  });

  it('preserves existing text layers during migration', () => {
    const old: LayoutTemplate = { ...vTemplate(2), texts: [{ ...DEFAULT_TEXT_LAYER, id: 'tx1', content: 'Hi' }] };
    const migrated = migrateTemplate(old);
    expect(migrated.texts).toHaveLength(1);
    expect(migrated.texts![0]!.content).toBe('Hi');
  });

  it('does not modify a template that is already at the current version (3)', () => {
    const t = createEmptyTemplate();
    expect(t.schemaVersion).toBe(3);
    const result = migrateTemplate(t);
    expect(result).toBe(t);
  });

  it('preserves existing slot data during migration', () => {
    const old: LayoutTemplate = { ...templateWithSlots(2), schemaVersion: 1 };
    const migrated = migrateTemplate(old);
    expect(migrated.slots).toHaveLength(2);
    expect(migrated.slots[0]!.id).toBe('s1');
  });
});
