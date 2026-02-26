/**
 * Comprehensive tests for useLayoutBuilderState hook.
 *
 * Sprint 5: P15-G (z-index reorder) + P15-H (overlay CRUD) + P15-I (shapes)
 * Sprint 6+: Slot CRUD, undo/redo, selection, dirty tracking, template-level
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
    expect(t.schemaVersion).toBe(1);
    expect(t.canvasAspectRatio).toBeCloseTo(16 / 9);
    expect(t.slots).toEqual([]);
    expect(t.overlays).toEqual([]);
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
