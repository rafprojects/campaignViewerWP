import { useState, useCallback, useMemo } from 'react';
import { produce } from 'immer';
import type { Dispatch, SetStateAction } from 'react';
import type { LayoutTemplate } from '@/types';

const MAX_HISTORY = 50;

export interface HistoryEntry {
  /** Unique key for React lists. */
  id: string;
  /** Human-readable label, e.g. "Move slot", "Add layer". */
  label: string;
  /** Epoch ms — display only. */
  timestamp: number;
}

/** Internal past/future stack item — not part of the public API. */
interface HistoryItem {
  /** Template snapshot captured BEFORE the named mutation was applied. */
  snapshot: LayoutTemplate;
  entry: HistoryEntry;
}

/** Applies an Immer recipe to the template and records a history entry. */
export type MutateFn = (recipe: (draft: LayoutTemplate) => void, label?: string) => void;

export interface LayoutBuilderHistoryReturn {
  mutate: MutateFn;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historyEntries: HistoryEntry[];
  historyCurrentIndex: number;
  jumpToHistoryIndex: (target: number) => void;
  isHistoryTrimmed: boolean;
  resetHistory: () => void;
}

export function useLayoutBuilderHistory({
  template,
  setTemplateRaw,
  setIsDirty,
}: {
  template: LayoutTemplate;
  setTemplateRaw: Dispatch<SetStateAction<LayoutTemplate>>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
}): LayoutBuilderHistoryReturn {
  const [past, setPast] = useState<HistoryItem[]>([]);
  const [future, setFuture] = useState<HistoryItem[]>([]);
  const [historyTrimmed, setHistoryTrimmed] = useState(false);

  const pushHistory = useCallback((label: string) => {
    const entry: HistoryEntry = {
      id: crypto.randomUUID?.() ?? `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      label,
      timestamp: Date.now(),
    };
    if (!historyTrimmed && past.length >= MAX_HISTORY) {
      setHistoryTrimmed(true);
    }
    setPast((prev) => {
      const next = [...prev, { snapshot: template, entry }];
      return next.length > MAX_HISTORY ? next.slice(1) : next;
    });
    setFuture([]);
  }, [template, past, historyTrimmed]);

  const mutate: MutateFn = useCallback(
    (recipe, label = 'Edit') => {
      pushHistory(label);
      setTemplateRaw((prev) => produce(prev, recipe));
      setIsDirty(true);
    },
    [pushHistory, setTemplateRaw, setIsDirty],
  );

  const resetHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
    setHistoryTrimmed(false);
  }, []);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const lastItem = past[past.length - 1]!;
    setFuture((prev) => [{ snapshot: template, entry: lastItem.entry }, ...prev]);
    setPast((prev) => prev.slice(0, -1));
    setTemplateRaw(lastItem.snapshot);
    setIsDirty(true);
  }, [past, template, setTemplateRaw, setIsDirty]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const nextItem = future[0]!;
    setPast((prev) => {
      const next = [...prev, { snapshot: template, entry: nextItem.entry }];
      return next.length > MAX_HISTORY ? next.slice(1) : next;
    });
    setFuture((prev) => prev.slice(1));
    setTemplateRaw(nextItem.snapshot);
    setIsDirty(true);
  }, [future, template, setTemplateRaw, setIsDirty]);

  /**
   * Jump to any history position in a single synchronous state transition.
   * `target === -1` restores the initial state (before any mutations).
   * `target === k` restores the state after mutation k was applied.
   *
   * This avoids the stale-closure problem of calling undo()/redo() in a loop
   * (repeated calls in one tick would all read the same pre-update state).
   */
  const jumpToHistoryIndex = useCallback((target: number) => {
    if (past.length === 0 && future.length === 0) return;

    const maxIndex = past.length + future.length - 1;
    const clamped = Math.max(-1, Math.min(target, maxIndex));

    const currentIndex = past.length - 1;
    if (clamped === currentIndex) return;

    if (clamped < currentIndex) {
      const newFutureItems: HistoryItem[] = [];
      for (let k = clamped + 1; k < past.length; k++) {
        const snapshotAtK = k === past.length - 1 ? template : past[k + 1]!.snapshot;
        newFutureItems.push({ snapshot: snapshotAtK, entry: past[k]!.entry });
      }
      const targetTemplate = clamped >= 0 ? past[clamped + 1]!.snapshot : past[0]!.snapshot;
      setPast(past.slice(0, clamped + 1));
      setFuture([...newFutureItems, ...future]);
      setTemplateRaw(targetTemplate);
      setIsDirty(true);
    } else {
      const stepsForward = clamped - currentIndex;
      const toApply = future.slice(0, stepsForward);
      let tmpl = template;
      const newPastItems: HistoryItem[] = [];
      for (const item of toApply) {
        newPastItems.push({ snapshot: tmpl, entry: item.entry });
        tmpl = item.snapshot;
      }
      const newPast = [...past, ...newPastItems];
      setPast(newPast.length > MAX_HISTORY ? newPast.slice(newPast.length - MAX_HISTORY) : newPast);
      setFuture(future.slice(stepsForward));
      setTemplateRaw(tmpl);
      setIsDirty(true);
    }
  }, [past, future, template, setTemplateRaw, setIsDirty]);

  const historyEntries = useMemo(
    () => [...past.map((p) => p.entry), ...future.map((f) => f.entry)],
    [past, future],
  );

  return {
    mutate,
    undo,
    redo,
    canUndo,
    canRedo,
    historyEntries,
    historyCurrentIndex: past.length - 1,
    jumpToHistoryIndex,
    isHistoryTrimmed: historyTrimmed,
    resetHistory,
  };
}
