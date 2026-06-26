import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutBuilderState } from './useLayoutBuilderState';

// We test guide actions through useLayoutBuilderState (which composes the sub-hook)
// so that undo integration is also exercised.

function useStateHook() {
  return useLayoutBuilderState();
}

describe('useLayoutBuilderGuides (P57-E)', () => {
  it('addGuide adds a vertical guide at default 50%', () => {
    const { result } = renderHook(useStateHook);
    act(() => { result.current.addGuide('x'); });
    expect(result.current.template.guides).toHaveLength(1);
    const g = result.current.template.guides![0]!;
    expect(g.axis).toBe('x');
    expect(g.position).toBe(50);
    expect(g.locked).toBe(false);
    expect(g.id).toBeTruthy();
  });

  it('addGuide adds a horizontal guide at custom position', () => {
    const { result } = renderHook(useStateHook);
    act(() => { result.current.addGuide('y', 30); });
    const g = result.current.template.guides![0]!;
    expect(g.axis).toBe('y');
    expect(g.position).toBe(30);
  });

  it('addGuide generates unique IDs for multiple guides', () => {
    const { result } = renderHook(useStateHook);
    act(() => { result.current.addGuide('x'); });
    act(() => { result.current.addGuide('x'); });
    const ids = result.current.template.guides!.map((g) => g.id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('moveGuide updates the position and clamps to 0–100', () => {
    const { result } = renderHook(useStateHook);
    act(() => { result.current.addGuide('x', 50); });
    const id = result.current.template.guides![0]!.id;
    act(() => { result.current.moveGuide(id, 75); });
    expect(result.current.template.guides![0]!.position).toBe(75);
    act(() => { result.current.moveGuide(id, 150); });
    expect(result.current.template.guides![0]!.position).toBe(100);
    act(() => { result.current.moveGuide(id, -10); });
    expect(result.current.template.guides![0]!.position).toBe(0);
  });

  it('removeGuide deletes the guide by id', () => {
    const { result } = renderHook(useStateHook);
    act(() => { result.current.addGuide('x'); });
    act(() => { result.current.addGuide('y'); });
    const id = result.current.template.guides![0]!.id;
    act(() => { result.current.removeGuide(id); });
    expect(result.current.template.guides).toHaveLength(1);
    expect(result.current.template.guides![0]!.axis).toBe('y');
  });

  it('toggleGuideLock flips the locked flag', () => {
    const { result } = renderHook(useStateHook);
    act(() => { result.current.addGuide('x'); });
    const id = result.current.template.guides![0]!.id;
    expect(result.current.template.guides![0]!.locked).toBe(false);
    act(() => { result.current.toggleGuideLock(id); });
    expect(result.current.template.guides![0]!.locked).toBe(true);
    act(() => { result.current.toggleGuideLock(id); });
    expect(result.current.template.guides![0]!.locked).toBe(false);
  });

  it('addGuide is undoable via the history sub-hook', () => {
    const { result } = renderHook(useStateHook);
    act(() => { result.current.addGuide('x'); });
    expect(result.current.template.guides).toHaveLength(1);
    act(() => { result.current.undo(); });
    expect((result.current.template.guides ?? []).length).toBe(0);
  });

  it('removeGuide is undoable', () => {
    const { result } = renderHook(useStateHook);
    act(() => { result.current.addGuide('y', 25); });
    const id = result.current.template.guides![0]!.id;
    act(() => { result.current.removeGuide(id); });
    expect((result.current.template.guides ?? []).length).toBe(0);
    act(() => { result.current.undo(); });
    expect(result.current.template.guides).toHaveLength(1);
  });
});
