import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDirtyGuardOptions<T> {
  /** Current form values */
  current: T;
  /** Whether the form/modal is open */
  isOpen: boolean;
  /** The real close callback */
  onClose: () => void;
  /** Deep comparison function (defaults to JSON.stringify equality) */
  isEqual?: (a: T, b: T) => boolean;
}

interface UseDirtyGuardResult {
  /** Whether the discard-confirmation modal should be shown */
  confirmOpen: boolean;
  /** Call this instead of `onClose` — it checks for dirty state first */
  guardedClose: () => void;
  /** User confirmed discard — actually close */
  confirmDiscard: () => void;
  /** User cancelled discard — dismiss confirm modal */
  cancelDiscard: () => void;
  /** Whether the form has unsaved changes */
  isDirty: boolean;
}

/**
 * Intercepts a modal close when form values have changed since open.
 * Shows a "Discard changes?" confirmation before actually closing.
 */
export function useDirtyGuard<T>(options: UseDirtyGuardOptions<T>): UseDirtyGuardResult {
  const { current, isOpen, onClose, isEqual } = options;
  const snapshotRef = useRef<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const serialize = useCallback((val: T) => JSON.stringify(val), []);

  const eq = useCallback(
    (a: T, b: string) => {
      if (isEqual) return isEqual(a, JSON.parse(b) as T);
      return serialize(a) === b;
    },
    [isEqual, serialize],
  );

  // Capture snapshot when modal opens
  useEffect(() => {
    if (isOpen) {
      snapshotRef.current = serialize(current);
    }
  // Only snapshot on open toggle, not on every current change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isDirty = isOpen && !eq(current, snapshotRef.current || serialize(current));

  const guardedClose = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const confirmDiscard = useCallback(() => {
    setConfirmOpen(false);
    onClose();
  }, [onClose]);

  const cancelDiscard = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  // Warn on browser navigation / tab close when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return { confirmOpen, guardedClose, confirmDiscard, cancelDiscard, isDirty };
}
