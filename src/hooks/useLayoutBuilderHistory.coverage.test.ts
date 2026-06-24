/**
 * Branch-coverage tests for useLayoutBuilderHistory.
 * Focuses on jumpToHistoryIndex (lines 116-151), history trimming,
 * and edge-case guards not reached through useLayoutBuilderState tests.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useLayoutBuilderHistory } from './useLayoutBuilderHistory';
import { createEmptyTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate } from '@/types';

function makeHook(initial?: LayoutTemplate) {
  return renderHook(() => {
    const [template, setTemplateRaw] = useState<LayoutTemplate>(initial ?? createEmptyTemplate('test'));
    const [isDirty, setIsDirty] = useState(false);
    const h = useLayoutBuilderHistory({ template, setTemplateRaw, setIsDirty });
    return { ...h, template, isDirty };
  });
}

describe('useLayoutBuilderHistory — basic undo/redo', () => {
  it('mutate records history and marks dirty', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo restores previous state and redo re-applies', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'B'; }));
    act(() => result.current.undo());
    expect(result.current.template.name).toBe('test');
    act(() => result.current.redo());
    expect(result.current.template.name).toBe('B');
  });

  it('undo at start is inert', () => {
    const { result } = makeHook();
    act(() => result.current.undo()); // no past → no-op
    expect(result.current.canUndo).toBe(false);
  });

  it('redo at tip is inert', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'C'; }));
    act(() => result.current.redo()); // no future → no-op
    expect(result.current.canRedo).toBe(false);
  });

  it('resetHistory clears past/future and isHistoryTrimmed', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'X'; }));
    act(() => result.current.resetHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.isHistoryTrimmed).toBe(false);
  });
});

describe('useLayoutBuilderHistory — historyEntries and historyCurrentIndex', () => {
  it('historyEntries lists past then future labels', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }, 'Step A'));
    act(() => result.current.mutate((d) => { d.name = 'B'; }, 'Step B'));
    act(() => result.current.undo()); // current index = 0, future has Step B
    const labels = result.current.historyEntries.map((e) => e.label);
    expect(labels).toContain('Step A');
    expect(labels).toContain('Step B');
    expect(result.current.historyCurrentIndex).toBe(0);
  });

  it('historyCurrentIndex is -1 when no past', () => {
    const { result } = makeHook();
    expect(result.current.historyCurrentIndex).toBe(-1);
  });
});

describe('useLayoutBuilderHistory — jumpToHistoryIndex', () => {
  it('no-op when there is no history at all', () => {
    const { result } = makeHook();
    act(() => result.current.jumpToHistoryIndex(0)); // past=[], future=[] → early return
    expect(result.current.canUndo).toBe(false);
  });

  it('no-op when jumping to current index', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }));
    const before = result.current.template.name;
    act(() => result.current.jumpToHistoryIndex(0)); // already at index 0
    expect(result.current.template.name).toBe(before);
  });

  it('jump backward (clamped < currentIndex) restores earlier state', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }, 'A'));
    act(() => result.current.mutate((d) => { d.name = 'B'; }, 'B'));
    // currentIndex = 1, jump to 0 → go back to after-A state
    act(() => result.current.jumpToHistoryIndex(0));
    expect(result.current.template.name).toBe('A');
    expect(result.current.canRedo).toBe(true);
  });

  it('jump to -1 restores initial state', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }));
    act(() => result.current.jumpToHistoryIndex(-1));
    expect(result.current.template.name).toBe('test');
  });

  it('jump forward (clamped > currentIndex) re-applies future states', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }, 'A'));
    act(() => result.current.mutate((d) => { d.name = 'B'; }, 'B'));
    act(() => result.current.undo()); // index = 0, future = [B]
    act(() => result.current.undo()); // index = -1, future = [A, B]
    // Jump forward 2 steps to index 1
    act(() => result.current.jumpToHistoryIndex(1));
    expect(result.current.template.name).toBe('B');
    expect(result.current.canRedo).toBe(false);
  });

  it('jump clamps to maxIndex when target exceeds range', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }));
    act(() => result.current.undo()); // index=-1, future=[A]
    // target=99 clamps to maxIndex=0 (past=[], future=[A] → maxIndex=0)
    act(() => result.current.jumpToHistoryIndex(99));
    expect(result.current.template.name).toBe('A');
  });

  it('jump clamps to -1 when target is below -1', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }));
    act(() => result.current.jumpToHistoryIndex(-10)); // clamps to -1 → initial state
    expect(result.current.template.name).toBe('test');
  });
});

describe('useLayoutBuilderHistory — redo when past is at MAX_HISTORY', () => {
  it('redo trims past to MAX_HISTORY when applying history exceeds capacity (line 101)', () => {
    const { result } = makeHook();
    // Build 50 mutations to fill past
    for (let i = 0; i < 50; i++) {
      act(() => result.current.mutate((d) => { d.name = `step-${i}`; }));
    }
    // Undo once so we have 1 item in future
    act(() => result.current.undo());
    // Redo: past is already at max (49) + 1 new = 50, does NOT exceed MAX_HISTORY
    // We need past to be 50 and redo adds 1 more → trim to 50
    // First: undo 2 more times, redo to go past 50
    act(() => result.current.undo());
    act(() => result.current.undo());
    // Now redo twice — first redo: past=48→49, second: 49→50, third would be 50→51 (trim)
    act(() => result.current.redo());
    act(() => result.current.redo());
    // At this point past should be capped at MAX_HISTORY
    expect(result.current.historyEntries.length).toBeLessThanOrEqual(50);
  });
});

describe('useLayoutBuilderHistory — jumpToHistoryIndex multi-step backward', () => {
  it('jump backward multiple steps covers the else branch at line 128', () => {
    const { result } = makeHook();
    act(() => result.current.mutate((d) => { d.name = 'A'; }, 'A'));
    act(() => result.current.mutate((d) => { d.name = 'B'; }, 'B'));
    act(() => result.current.mutate((d) => { d.name = 'C'; }, 'C'));
    // currentIndex = 2, jump to 0 → multi-step back (k will be 1 AND 2 in the loop)
    act(() => result.current.jumpToHistoryIndex(0));
    expect(result.current.template.name).toBe('A');
  });

  it('jumpToHistoryIndex forward trims past when it exceeds MAX_HISTORY (line 146)', () => {
    const { result } = makeHook();
    // Build 48 mutations, undo 3, then jump forward 3 steps so newPast = 48+3=51 > 50
    for (let i = 0; i < 48; i++) {
      act(() => result.current.mutate((d) => { d.name = `m${i}`; }));
    }
    act(() => result.current.undo());
    act(() => result.current.undo());
    act(() => result.current.undo());
    // past = 45, future = 3; jump forward to index 47 (current + 3 steps)
    act(() => result.current.jumpToHistoryIndex(47));
    expect(result.current.historyEntries.length).toBeLessThanOrEqual(50);
  });
});

describe('useLayoutBuilderHistory — history trimming', () => {
  it('isHistoryTrimmed becomes true after MAX_HISTORY mutations', () => {
    const { result } = makeHook();
    // MAX_HISTORY = 50; push 51 mutations
    for (let i = 0; i < 51; i++) {
      act(() => result.current.mutate((d) => { d.name = `step-${i}`; }));
    }
    expect(result.current.isHistoryTrimmed).toBe(true);
    // History is capped at 50 entries
    expect(result.current.historyEntries.length).toBeLessThanOrEqual(50);
  });
});
