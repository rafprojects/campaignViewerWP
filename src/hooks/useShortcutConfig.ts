import { useCallback, useMemo, useState } from 'react';

export type ShortcutActionId = 'openHelp' | 'newCampaign' | 'importJson' | 'bulkSelect';

export interface ShortcutActionDef {
  defaultKey: string;
  label: string;
}

export type ShortcutEffectiveMap = Record<ShortcutActionId, string>;

export interface ShortcutConfigHandle {
  effectiveMap: ShortcutEffectiveMap;
  actionDefs: Record<ShortcutActionId, ShortcutActionDef>;
  hasCustomizations: boolean;
  updateShortcut: (id: ShortcutActionId, key: string) => string | null;
  resetToDefaults: () => void;
}

export const ACTION_DEFAULTS: Record<ShortcutActionId, ShortcutActionDef> = {
  openHelp:    { defaultKey: '?',           label: 'Open keyboard shortcuts help' },
  newCampaign: { defaultKey: 'mod+n',       label: 'New campaign' },
  importJson:  { defaultKey: 'mod+i',       label: 'Import campaign from JSON' },
  bulkSelect:  { defaultKey: 'mod+shift+a', label: 'Select all / deselect all' },
};

export const ACTION_IDS = Object.keys(ACTION_DEFAULTS) as ShortcutActionId[];

const STORAGE_KEY = 'wpsg_admin_shortcuts';

// Keys that cannot be remapped: navigation fundamentals and common browser shortcuts.
const RESERVED_KEYS = new Set([
  'escape', 'tab',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'mod+r', 'mod+w', 'mod+t', 'mod+f', 'mod+l', 'mod+q', 'mod+h',
  'mod+shift+i', 'mod+shift+j',
]);

function loadOverrides(): Partial<ShortcutEffectiveMap> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: Partial<ShortcutEffectiveMap> = {};
    for (const id of ACTION_IDS) {
      const val = (parsed as Record<string, unknown>)[id];
      if (typeof val === 'string' && val.trim()) result[id] = val.trim();
    }
    return result;
  } catch {
    // non-fatal: localStorage unavailable or JSON parse error — use empty overrides
    return {};
  }
}

function saveOverrides(overrides: Partial<ShortcutEffectiveMap>): void {
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export function useShortcutConfig(): ShortcutConfigHandle {
  const [overrides, setOverrides] = useState<Partial<ShortcutEffectiveMap>>(loadOverrides);

  const effectiveMap = useMemo<ShortcutEffectiveMap>(() => {
    const map = {} as ShortcutEffectiveMap;
    for (const id of ACTION_IDS) {
      map[id] = overrides[id] ?? ACTION_DEFAULTS[id].defaultKey;
    }
    return map;
  }, [overrides]);

  const hasCustomizations = useMemo(
    () => ACTION_IDS.some((id) => overrides[id] !== undefined),
    [overrides],
  );

  const updateShortcut = useCallback((id: ShortcutActionId, key: string): string | null => {
    const normalized = key.trim().toLowerCase();

    if (!normalized) {
      return 'Shortcut key cannot be empty';
    }

    if (RESERVED_KEYS.has(normalized)) {
      return `"${key}" is reserved and cannot be used`;
    }

    // Check for conflicts with other actions
    for (const otherId of ACTION_IDS) {
      if (otherId === id) continue;
      const otherKey = overrides[otherId] ?? ACTION_DEFAULTS[otherId].defaultKey;
      if (otherKey.toLowerCase() === normalized) {
        return `"${key}" is already used by "${ACTION_DEFAULTS[otherId].label}"`;
      }
    }

    const next: Partial<ShortcutEffectiveMap> = { ...overrides, [id]: normalized };
    // Drop overrides that match the default (keep stored map clean)
    if (normalized === ACTION_DEFAULTS[id].defaultKey) {
      delete next[id];
    }
    setOverrides(next);
    saveOverrides(next);
    return null;
  }, [overrides]);

  const resetToDefaults = useCallback(() => {
    setOverrides({});
    saveOverrides({});
  }, []);

  return { effectiveMap, actionDefs: ACTION_DEFAULTS, hasCustomizations, updateShortcut, resetToDefaults };
}
