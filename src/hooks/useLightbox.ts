import { useCallback, useEffect, useState } from 'react';
import { acquireBodyScrollLock, releaseBodyScrollLock } from '@wp-super-gallery/shared-utils';

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
    acquireBodyScrollLock();
    return () => {
      releaseBodyScrollLock();
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
