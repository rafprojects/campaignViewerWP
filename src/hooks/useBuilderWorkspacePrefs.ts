import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { safeLocalStorage } from '@mullion/shared-utils';
import type { SnapMode } from '@mullion/shared-utils';

export type LayoutScope = 'global' | 'per-template';

export interface BuilderWorkspacePrefs {
  snapMode: SnapMode;
  setSnapMode: Dispatch<SetStateAction<SnapMode>>;
  snapThreshold: number;
  setSnapThreshold: Dispatch<SetStateAction<number>>;
  showGrid: boolean;
  setShowGrid: Dispatch<SetStateAction<boolean>>;
  gridSizePx: number;
  setGridSizePx: Dispatch<SetStateAction<number>>;
  showRulers: boolean;
  setShowRulers: Dispatch<SetStateAction<boolean>>;
  showMeasurements: boolean;
  setShowMeasurements: Dispatch<SetStateAction<boolean>>;
  designAssetsOpen: boolean;
  setDesignAssetsOpen: (open: boolean) => void;
  layoutScope: LayoutScope;
  setLayoutScope: (scope: LayoutScope) => void;
  /** P57-C: recently-used colors shown as swatches in the builder color pickers. */
  savedSwatches: string[];
  addSwatch: (color: string) => void;
}

/** P30-B workspace preferences, persisted in localStorage and root-scoped per P37-KS1. */
export function useBuilderWorkspacePrefs(rootId: string): BuilderWorkspacePrefs {
  const [snapMode, setSnapMode] = useState<SnapMode>(() => {
    try { return (safeLocalStorage.getItem(`mullion_builder_${rootId}_snap_mode`) as SnapMode | null) ?? 'guides'; } catch { return 'guides'; }
  });
  const [snapThreshold, setSnapThreshold] = useState(5);
  const [showGrid, setShowGrid] = useState(() => {
    try { return safeLocalStorage.getItem(`mullion_builder_${rootId}_show_grid`) === 'true'; } catch { return false; }
  });
  const [gridSizePx, setGridSizePx] = useState(() => {
    try { return Number(safeLocalStorage.getItem(`mullion_builder_${rootId}_grid_size`)) || 20; } catch { return 20; }
  });
  const [showRulers, setShowRulers] = useState(() => {
    try { return safeLocalStorage.getItem(`mullion_builder_${rootId}_show_rulers`) === 'true'; } catch { return false; }
  });
  const [showMeasurements, setShowMeasurements] = useState(() => {
    try { return safeLocalStorage.getItem(`mullion_builder_${rootId}_show_measurements`) === 'true'; } catch { return false; }
  });
  const [designAssetsOpen, setDesignAssetsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(`mullion_builder_${rootId}_design_assets_open`);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const [layoutScope, setLayoutScopeState] = useState<LayoutScope>(() => {
    try {
      return (localStorage.getItem(`mullion_builder_${rootId}_layout_scope`) as LayoutScope | null) ?? 'global';
    } catch {
      return 'global';
    }
  });
  const setLayoutScope = useCallback(
    (scope: LayoutScope) => {
      setLayoutScopeState(scope);
      try { localStorage.setItem(`mullion_builder_${rootId}_layout_scope`, scope); } catch { /* ignore */ }
    },
    [rootId],
  );

  const [savedSwatches, setSavedSwatches] = useState<string[]>(() => {
    try {
      const raw = safeLocalStorage.getItem(`mullion_builder_${rootId}_color_swatches`);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });

  const addSwatch = useCallback(
    (color: string) => {
      const trimmed = color.trim();
      if (!trimmed || trimmed === '#') return;
      setSavedSwatches((prev) => {
        const deduped = [trimmed, ...prev.filter((c) => c !== trimmed)].slice(0, 30);
        try { safeLocalStorage.setItem(`mullion_builder_${rootId}_color_swatches`, JSON.stringify(deduped)); } catch { /* ignore */ }
        return deduped;
      });
    },
    [rootId],
  );

  useEffect(() => { safeLocalStorage.setItem(`mullion_builder_${rootId}_snap_mode`, snapMode); }, [rootId, snapMode]);
  useEffect(() => { safeLocalStorage.setItem(`mullion_builder_${rootId}_show_grid`, String(showGrid)); }, [rootId, showGrid]);
  useEffect(() => { safeLocalStorage.setItem(`mullion_builder_${rootId}_grid_size`, String(gridSizePx)); }, [rootId, gridSizePx]);
  useEffect(() => { safeLocalStorage.setItem(`mullion_builder_${rootId}_show_rulers`, String(showRulers)); }, [rootId, showRulers]);
  useEffect(() => { safeLocalStorage.setItem(`mullion_builder_${rootId}_show_measurements`, String(showMeasurements)); }, [rootId, showMeasurements]);

  // P37-KS1: one-time migration of legacy global builder workspace keys to root-scoped keys.
  useEffect(() => {
    const migrations: [string, string][] = [
      ['mullion_builder_snap_mode', `mullion_builder_${rootId}_snap_mode`],
      ['mullion_builder_show_grid', `mullion_builder_${rootId}_show_grid`],
      ['mullion_builder_grid_size', `mullion_builder_${rootId}_grid_size`],
      ['mullion_builder_show_rulers', `mullion_builder_${rootId}_show_rulers`],
      ['mullion_builder_show_measurements', `mullion_builder_${rootId}_show_measurements`],
      ['mullion_builder_design_assets_open', `mullion_builder_${rootId}_design_assets_open`],
      ['mullion_builder_layout', `mullion_builder_${rootId}_layout`],
    ];
    for (const [oldKey, newKey] of migrations) {
      try {
        const v = localStorage.getItem(oldKey);
        if (v !== null) {
          safeLocalStorage.setItem(newKey, v);
          localStorage.removeItem(oldKey);
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    snapMode, setSnapMode,
    snapThreshold, setSnapThreshold,
    showGrid, setShowGrid,
    gridSizePx, setGridSizePx,
    showRulers, setShowRulers,
    showMeasurements, setShowMeasurements,
    designAssetsOpen, setDesignAssetsOpen,
    layoutScope, setLayoutScope,
    savedSwatches, addSwatch,
  };
}
