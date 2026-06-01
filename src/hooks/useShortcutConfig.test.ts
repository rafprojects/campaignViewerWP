import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShortcutConfig, ACTION_DEFAULTS, ACTION_IDS } from './useShortcutConfig';

const STORAGE_KEY = 'wpsg_admin_shortcuts';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useShortcutConfig', () => {
  describe('initial state', () => {
    it('returns default keys when no overrides are stored', () => {
      const { result } = renderHook(() => useShortcutConfig());
      expect(result.current.effectiveMap.openHelp).toBe('?');
      expect(result.current.effectiveMap.newCampaign).toBe('mod+n');
      expect(result.current.effectiveMap.importJson).toBe('mod+i');
      expect(result.current.effectiveMap.bulkSelect).toBe('mod+shift+a');
    });

    it('hasCustomizations is false when no overrides exist', () => {
      const { result } = renderHook(() => useShortcutConfig());
      expect(result.current.hasCustomizations).toBe(false);
    });

    it('loads persisted overrides from localStorage on mount', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ newCampaign: 'mod+m' }));
      const { result } = renderHook(() => useShortcutConfig());
      expect(result.current.effectiveMap.newCampaign).toBe('mod+m');
      expect(result.current.effectiveMap.openHelp).toBe('?');
    });

    it('falls back to defaults when localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');
      const { result } = renderHook(() => useShortcutConfig());
      expect(result.current.effectiveMap.newCampaign).toBe('mod+n');
    });

    it('exposes actionDefs with all defaults', () => {
      const { result } = renderHook(() => useShortcutConfig());
      for (const id of ACTION_IDS) {
        expect(result.current.actionDefs[id].defaultKey).toBe(ACTION_DEFAULTS[id].defaultKey);
        expect(typeof result.current.actionDefs[id].label).toBe('string');
      }
    });
  });

  describe('updateShortcut', () => {
    it('updates the effective map for the given action', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'mod+m'); });
      expect(result.current.effectiveMap.newCampaign).toBe('mod+m');
    });

    it('returns null on successful update', () => {
      const { result } = renderHook(() => useShortcutConfig());
      let error: string | null = 'sentinel';
      act(() => { error = result.current.updateShortcut('newCampaign', 'mod+m'); });
      expect(error).toBeNull();
    });

    it('persists the override to localStorage', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'mod+m'); });
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
      expect(stored.newCampaign).toBe('mod+m');
    });

    it('normalizes key to lowercase', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'Mod+M'); });
      expect(result.current.effectiveMap.newCampaign).toBe('mod+m');
    });

    it('marks hasCustomizations as true after a successful update', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'mod+m'); });
      expect(result.current.hasCustomizations).toBe(true);
    });

    it('does not store an override when setting a key back to its default', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'mod+m'); });
      act(() => { result.current.updateShortcut('newCampaign', 'mod+n'); });
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
      expect(stored.newCampaign).toBeUndefined();
    });

    it('rejects reserved keys and returns an error message', () => {
      const { result } = renderHook(() => useShortcutConfig());
      let error: string | null = null;
      act(() => { error = result.current.updateShortcut('newCampaign', 'escape'); });
      expect(error).toMatch(/reserved/i);
      expect(result.current.effectiveMap.newCampaign).toBe('mod+n');
    });

    it('rejects function keys', () => {
      const { result } = renderHook(() => useShortcutConfig());
      let error: string | null = null;
      act(() => { error = result.current.updateShortcut('newCampaign', 'f5'); });
      expect(error).toMatch(/reserved/i);
    });

    it('rejects keys already used by another action and returns an error message', () => {
      const { result } = renderHook(() => useShortcutConfig());
      let error: string | null = null;
      // mod+i is already the importJson default
      act(() => { error = result.current.updateShortcut('newCampaign', 'mod+i'); });
      expect(error).toMatch(/already used/i);
      expect(result.current.effectiveMap.newCampaign).toBe('mod+n');
    });

    it('does not modify other action bindings on update', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'mod+m'); });
      expect(result.current.effectiveMap.openHelp).toBe('?');
      expect(result.current.effectiveMap.importJson).toBe('mod+i');
      expect(result.current.effectiveMap.bulkSelect).toBe('mod+shift+a');
    });
  });

  describe('resetToDefaults', () => {
    it('restores all keys to defaults', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => {
        result.current.updateShortcut('newCampaign', 'mod+m');
        result.current.updateShortcut('importJson', 'mod+j');
      });
      act(() => { result.current.resetToDefaults(); });
      expect(result.current.effectiveMap.newCampaign).toBe('mod+n');
      expect(result.current.effectiveMap.importJson).toBe('mod+i');
    });

    it('clears localStorage after reset', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'mod+m'); });
      act(() => { result.current.resetToDefaults(); });
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('sets hasCustomizations to false after reset', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'mod+m'); });
      act(() => { result.current.resetToDefaults(); });
      expect(result.current.hasCustomizations).toBe(false);
    });
  });

  describe('persistence round-trip', () => {
    it('multiple updates accumulate in localStorage', () => {
      const { result } = renderHook(() => useShortcutConfig());
      act(() => { result.current.updateShortcut('newCampaign', 'mod+m'); });
      act(() => { result.current.updateShortcut('importJson', 'mod+j'); });
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
      expect(stored.newCampaign).toBe('mod+m');
      expect(stored.importJson).toBe('mod+j');
    });

    it('survives a remount with stored overrides', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bulkSelect: 'mod+b' }));
      const { result } = renderHook(() => useShortcutConfig());
      expect(result.current.effectiveMap.bulkSelect).toBe('mod+b');
      expect(result.current.hasCustomizations).toBe(true);
    });
  });
});
