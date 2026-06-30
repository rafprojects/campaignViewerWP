/**
 * P59-A: Text-layer CRUD + persistence tests.
 *
 * Exercises the text-layer actions exposed by useLayoutBuilderState (wired from
 * useLayoutBuilderText), z-order participation, undo/redo integration, the
 * back-compat path for pre-v3 templates (no `texts` array), and that text
 * layers survive the local-draft autosave path.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutBuilderState, createEmptyTemplate } from './useLayoutBuilderState';
import { DEFAULT_TEXT_LAYER } from '@/types';
import type { LayoutTemplate } from '@/types';

/** A template stripped of its `texts` array, simulating a pre-v3 (P59) load. */
function legacyTemplateWithoutTexts(): LayoutTemplate {
  const t: LayoutTemplate = { ...createEmptyTemplate(), schemaVersion: 2 };
  delete (t as { texts?: unknown }).texts;
  return t;
}

describe('useLayoutBuilderText — CRUD (P59-A)', () => {
  it('addText adds a text layer with default shape and returns its id', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id = '';
    act(() => { id = result.current.addText(); });

    expect(id).toBeTruthy();
    expect(result.current.template.texts).toHaveLength(1);
    const text = result.current.template.texts![0]!;
    expect(text.id).toBe(id);
    expect(text.content).toBe(DEFAULT_TEXT_LAYER.content);
    expect(text.semanticTag).toBe('heading');
    expect(text.textAlign).toBe('left');
    expect(text.typography.fontSize).toBe('28px');
    expect(text.typography.fontWeight).toBe(600);
    expect(text.opacity).toBe(1);
  });

  it('addText stacks new text above existing slots/overlays by z-index', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let oid = '';
    act(() => { oid = result.current.addOverlay('https://example.com/a.png'); });
    // Read after the act() commits so the template reflects the added overlay.
    const overlayZ = result.current.template.overlays.find((o) => o.id === oid)!.zIndex;
    act(() => { result.current.addText(); });
    expect(result.current.template.texts![0]!.zIndex).toBeGreaterThan(overlayZ);
  });

  it('addText lazily initialises texts on a legacy template with no texts array', () => {
    const { result } = renderHook(() => useLayoutBuilderState(legacyTemplateWithoutTexts()));
    expect(result.current.template.texts).toBeUndefined();
    act(() => { result.current.addText(); });
    expect(result.current.template.texts).toHaveLength(1);
  });

  it('updateText patches content, role, and typography', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id = '';
    act(() => { id = result.current.addText(); });
    act(() => result.current.updateText(id, {
      content: 'Summer Sale',
      semanticTag: 'paragraph',
      typography: { fontSize: '48px', fontWeight: 700 },
    }));

    const text = result.current.template.texts![0]!;
    expect(text.content).toBe('Summer Sale');
    expect(text.semanticTag).toBe('paragraph');
    expect(text.typography.fontSize).toBe('48px');
    expect(text.typography.fontWeight).toBe(700);
  });

  it('moveText updates x and y', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id = '';
    act(() => { id = result.current.addText(); });
    act(() => result.current.moveText(id, 55, 65));
    expect(result.current.template.texts![0]!.x).toBe(55);
    expect(result.current.template.texts![0]!.y).toBe(65);
  });

  it('resizeText updates position and dimensions', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id = '';
    act(() => { id = result.current.addText(); });
    act(() => result.current.resizeText(id, 5, 10, 70, 30));
    const text = result.current.template.texts![0]!;
    expect(text.x).toBe(5);
    expect(text.y).toBe(10);
    expect(text.width).toBe(70);
    expect(text.height).toBe(30);
  });

  it('removeText removes the layer by id', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id = '';
    act(() => { id = result.current.addText(); });
    expect(result.current.template.texts).toHaveLength(1);
    act(() => result.current.removeText(id));
    expect(result.current.template.texts).toHaveLength(0);
  });

  it('renameText sets the display name', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id = '';
    act(() => { id = result.current.addText(); });
    act(() => result.current.renameText(id, 'Headline'));
    expect(result.current.template.texts![0]!.name).toBe('Headline');
  });

  it('toggleTextVisible flips visibility (default visible → hidden → visible)', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id = '';
    act(() => { id = result.current.addText(); });
    expect(result.current.template.texts![0]!.visible).toBeUndefined(); // defaults to visible
    act(() => result.current.toggleTextVisible(id));
    expect(result.current.template.texts![0]!.visible).toBe(false);
    act(() => result.current.toggleTextVisible(id));
    expect(result.current.template.texts![0]!.visible).toBe(true);
  });

  it('toggleTextLocked flips the lock flag', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let id = '';
    act(() => { id = result.current.addText(); });
    act(() => result.current.toggleTextLocked(id));
    expect(result.current.template.texts![0]!.locked).toBe(true);
    act(() => result.current.toggleTextLocked(id));
    expect(result.current.template.texts![0]!.locked).toBe(false);
  });
});

describe('useLayoutBuilderText — history & z-order (P59-A)', () => {
  it('text mutations are undoable', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    act(() => { result.current.addText(); });
    expect(result.current.template.texts).toHaveLength(1);
    act(() => result.current.undo());
    expect(result.current.template.texts ?? []).toHaveLength(0);
  });

  it('bringToFront raises a text layer above slots and overlays', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let textId = '';
    act(() => {
      result.current.addSlot();
      result.current.addOverlay('https://example.com/a.png');
      textId = result.current.addText();
    });
    // Push the text behind everything, then bring it back to front.
    act(() => result.current.sendToBack([textId]));
    act(() => result.current.bringToFront([textId]));

    const text = result.current.template.texts!.find((t) => t.id === textId)!;
    const maxOther = Math.max(
      ...result.current.template.slots.map((s) => s.zIndex),
      ...result.current.template.overlays.map((o) => o.zIndex),
    );
    expect(text.zIndex).toBeGreaterThan(maxOther);
  });

  it('sendToBack lowers a text layer below slots and overlays', () => {
    const { result } = renderHook(() => useLayoutBuilderState(createEmptyTemplate()));
    let textId = '';
    act(() => {
      result.current.addSlot();
      result.current.addOverlay('https://example.com/a.png');
      textId = result.current.addText();
    });
    act(() => result.current.sendToBack([textId]));

    const text = result.current.template.texts!.find((t) => t.id === textId)!;
    const minOther = Math.min(
      ...result.current.template.slots.map((s) => s.zIndex),
      ...result.current.template.overlays.map((o) => o.zIndex),
    );
    expect(text.zIndex).toBeLessThan(minOther);
  });
});

describe('useLayoutBuilderText — persistence (P59-A)', () => {
  it('text layers survive the local-draft autosave', () => {
    vi.useFakeTimers();
    try {
      const initial: LayoutTemplate = { ...createEmptyTemplate(), id: 'tpl-text-1' };
      const { result } = renderHook(() => useLayoutBuilderState(initial));
      act(() => { result.current.addText(); });
      // Autosave is debounced ~2s on the template object.
      act(() => { vi.advanceTimersByTime(2100); });

      const raw = localStorage.getItem('wpsg_layout_draft_tpl-text-1');
      expect(raw).toBeTruthy();
      const payload = JSON.parse(raw!) as { schemaVersion: number; template: LayoutTemplate };
      expect(payload.schemaVersion).toBe(3);
      expect(payload.template.texts).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
