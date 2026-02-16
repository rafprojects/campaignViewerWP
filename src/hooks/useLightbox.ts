import { useCallback, useEffect, useState } from 'react';

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

  const lockBodyScroll = useCallback(() => {
    const body = document.body;
    body.style.overflow = 'hidden';
  }, []);

  const unlockBodyScroll = useCallback(() => {
    const body = document.body;
    body.style.overflow = '';
  }, []);

  const open = useCallback(() => {
    lockBodyScroll();
    setIsOpen(true);
  }, [lockBodyScroll]);

  const close = useCallback(() => {
    setIsOpen(false);
    unlockBodyScroll();
  }, [unlockBodyScroll]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isOpen, lockBodyScroll, unlockBodyScroll]);

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
