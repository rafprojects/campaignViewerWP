import { useCallback, useEffect, useState } from 'react';

// ── Module-level body-scroll lock manager ────────────────────────────────────
//
// A single reference counter coordinates body-scroll locking across multiple
// concurrent lightbox hook instances. This prevents one closing consumer from
// unlocking the body while another is still open, and avoids the "double-lock"
// that occurred when each instance managed its own overflow write.
//
// Invariants:
//   lockCount ≥ 0 at all times (releaseScrollLock clamps at zero)
//   previousOverflow is snapshotted only on the 0 → 1 transition
//   overflow is restored only on the 1 → 0 transition

let lockCount = 0;
let previousOverflow = '';

function acquireScrollLock(): void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount++;
}

function releaseScrollLock(): void {
  if (lockCount <= 0) return; // clamp: prevent going negative
  lockCount--;
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = '';
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseLightboxOptions {
  initialOpen?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  enableArrowNavigation?: boolean;
}

interface UseLightboxResult {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export function useLightbox(options: UseLightboxOptions = {}): UseLightboxResult {
  const {
    initialOpen = false,
    onPrev,
    onNext,
    enableArrowNavigation = false,
  } = options;

  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Manage body-scroll lock through the shared module-level manager.
  //
  // Using an effect (rather than calling acquire/release directly from open/close)
  // ensures a single, canonical lock/unlock per open→close or close→open
  // transition and coordinates correctly with other concurrent lightbox
  // consumers regardless of close or unmount order.
  useEffect(() => {
    if (!isOpen) return;
    acquireScrollLock();
    return () => {
      releaseScrollLock();
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (!enableArrowNavigation) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrev?.();
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close, enableArrowNavigation, isOpen, onNext, onPrev]);

  return { isOpen, setIsOpen, open, close, toggle };
}
