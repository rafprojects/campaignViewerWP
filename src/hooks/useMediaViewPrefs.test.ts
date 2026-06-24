/**
 * Tests for useMediaViewPrefs — covers the legacy sort mode migration
 * (lines 54-56) and basic preference initialization.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaViewPrefs } from './useMediaViewPrefs';

beforeEach(() => localStorage.clear());

describe('useMediaViewPrefs — defaults', () => {
  it('initialises with grid viewMode and medium cardSize', () => {
    const { result } = renderHook(() => useMediaViewPrefs('camp-1', 'root-1'));
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.cardSize).toBe('medium');
    expect(result.current.listPage).toBe(1);
    expect(result.current.sortMode).toBe('order');
    expect(result.current.orphanFilter).toBe(false);
  });
});

describe('useMediaViewPrefs — legacy sort mode migration (lines 54-56)', () => {
  it('migrates legacy global sortMode key to root-scoped key on mount', () => {
    // Seed the legacy key
    localStorage.setItem('wpsg_media_sortMode', 'title');
    renderHook(() => useMediaViewPrefs('camp-1', 'root-1'));
    // Legacy key should be removed
    expect(localStorage.getItem('wpsg_media_sortMode')).toBeNull();
    // Root-scoped key should have the migrated value (safeLocalStorage stores raw)
    expect(localStorage.getItem('wpsg_media_sortMode_root-1')).toBe('title');
  });

  it('is a no-op when legacy key does not exist (line 54 false branch)', () => {
    const spy = vi.spyOn(localStorage, 'removeItem');
    renderHook(() => useMediaViewPrefs('camp-1', 'root-1'));
    expect(spy).not.toHaveBeenCalledWith('wpsg_media_sortMode');
    spy.mockRestore();
  });
});

describe('useMediaViewPrefs — setters', () => {
  it('setViewMode updates the view mode', () => {
    const { result } = renderHook(() => useMediaViewPrefs('camp-2', 'root-2'));
    act(() => result.current.setViewMode('list'));
    expect(result.current.viewMode).toBe('list');
  });

  it('setOrphanFilter toggles the filter', () => {
    const { result } = renderHook(() => useMediaViewPrefs('camp-2', 'root-2'));
    act(() => result.current.setOrphanFilter(true));
    expect(result.current.orphanFilter).toBe(true);
  });
});
