import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBuilderWorkspacePrefs } from './useBuilderWorkspacePrefs';

const ROOT = 'test-root';
const SWATCHES_KEY = `wpsg_builder_${ROOT}_color_swatches`;

beforeEach(() => {
  localStorage.clear();
});

describe('useBuilderWorkspacePrefs — savedSwatches / addSwatch (P57-C)', () => {
  it('starts with an empty swatch list when nothing is stored', () => {
    const { result } = renderHook(() => useBuilderWorkspacePrefs(ROOT));
    expect(result.current.savedSwatches).toEqual([]);
  });

  it('loads swatches from localStorage on mount', () => {
    localStorage.setItem(SWATCHES_KEY, JSON.stringify(['#ff0000', '#00ff00']));
    const { result } = renderHook(() => useBuilderWorkspacePrefs(ROOT));
    expect(result.current.savedSwatches).toEqual(['#ff0000', '#00ff00']);
  });

  it('addSwatch prepends the new color and persists it', () => {
    const { result } = renderHook(() => useBuilderWorkspacePrefs(ROOT));
    act(() => { result.current.addSwatch('#aabbcc'); });
    expect(result.current.savedSwatches[0]).toBe('#aabbcc');
    expect(JSON.parse(localStorage.getItem(SWATCHES_KEY)!)).toContain('#aabbcc');
  });

  it('addSwatch deduplicates: existing color is moved to the front', () => {
    localStorage.setItem(SWATCHES_KEY, JSON.stringify(['#111', '#222', '#333']));
    const { result } = renderHook(() => useBuilderWorkspacePrefs(ROOT));
    act(() => { result.current.addSwatch('#222'); });
    expect(result.current.savedSwatches).toEqual(['#222', '#111', '#333']);
  });

  it('addSwatch limits the list to 30 entries', () => {
    const initial = Array.from({ length: 30 }, (_, i) => `#${String(i).padStart(6, '0')}`);
    localStorage.setItem(SWATCHES_KEY, JSON.stringify(initial));
    const { result } = renderHook(() => useBuilderWorkspacePrefs(ROOT));
    act(() => { result.current.addSwatch('#ffffff'); });
    expect(result.current.savedSwatches).toHaveLength(30);
    expect(result.current.savedSwatches[0]).toBe('#ffffff');
  });

  it('addSwatch ignores empty strings and bare "#"', () => {
    const { result } = renderHook(() => useBuilderWorkspacePrefs(ROOT));
    act(() => { result.current.addSwatch(''); });
    act(() => { result.current.addSwatch('#'); });
    expect(result.current.savedSwatches).toEqual([]);
  });
});
