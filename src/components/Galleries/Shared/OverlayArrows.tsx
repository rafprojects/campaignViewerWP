import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings } from '@/types';

interface OverlayArrowsProps {
  onPrev: () => void;
  onNext: () => void;
  total: number;
  settings: GalleryBehaviorSettings;
  previousLabel?: string;
  nextLabel?: string;
}

/**
 * Navigation arrows overlaid on the media viewport (left/right edges).
 * Supports configurable position, size, color, background, border, hover scale,
 * and auto-hide with fade timing.
 *
 * Auto-hide attaches mousemove/touchstart listeners to the parent element
 * (the viewport Box) so events fire even while the overlay has pointer-events: none.
 */
export function OverlayArrows({
  onPrev,
  onNext,
  total,
  settings,
  previousLabel = 'Previous',
  nextLabel = 'Next',
}: OverlayArrowsProps) {
  const autoHideMs = settings.navArrowAutoHideMs ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowAutoHideMs;
  const edgeInset = settings.navArrowEdgeInset ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowEdgeInset;
  const minHitTarget = settings.navArrowMinHitTarget ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowMinHitTarget;
  const fadeDurationMs = settings.navArrowFadeDurationMs ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowFadeDurationMs;
  const scaleTransitionMs = settings.navArrowScaleTransitionMs ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowScaleTransitionMs;

  const [visible, setVisible] = useState(autoHideMs === 0);
  const hideTimerRef = useRef<number>(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const scheduleHide = useCallback(() => {
    if (autoHideMs <= 0) return;
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setVisible(false), autoHideMs);
  }, [autoHideMs]);

  /* Seed initial visibility */
  useEffect(() => {
    if (autoHideMs > 0) {
      setVisible(false);
    } else {
      setVisible(true);
    }
    return () => window.clearTimeout(hideTimerRef.current);
  }, [autoHideMs]);

  /* Attach interaction listeners on the *parent* element (the viewport Box)
     so they fire even while the overlay wrapper has pointer-events: none. */
  useEffect(() => {
    if (autoHideMs <= 0) return;
    const parent = wrapperRef.current?.parentElement;
    if (!parent) return;

    const show = () => {
      setVisible(true);
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setVisible(false), autoHideMs);
    };

    parent.addEventListener('mousemove', show);
    parent.addEventListener('touchstart', show, { passive: true });
    return () => {
      parent.removeEventListener('mousemove', show);
      parent.removeEventListener('touchstart', show);
    };
  }, [autoHideMs, scheduleHide]);

  if (total <= 1) return null;

  /* Use top/bottom + margin:auto for vertical centering so that `transform`
     is free for the hover-scale effect (avoids the translateY(-50%) conflict
     that caused the "initial drop" bug). */
  const verticalStyle: CSSProperties =
    settings.navArrowPosition === 'top'
      ? { top: edgeInset }
      : settings.navArrowPosition === 'bottom'
        ? { bottom: edgeInset }
        : { top: 0, bottom: 0, marginBlock: 'auto' };

  const iconSize = Math.round(settings.navArrowSize * 0.6);

  const baseBtnStyle: CSSProperties = {
    position: 'absolute',
    color: settings.navArrowColor,
    backgroundColor: settings.navArrowBgColor,
    border: settings.navArrowBorderWidth > 0
      ? `${settings.navArrowBorderWidth}px solid ${settings.navArrowColor}`
      : 'none',
    transition: `opacity ${fadeDurationMs}ms ease, transform ${scaleTransitionMs}ms ease`,
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    width: Math.max(minHitTarget, settings.navArrowSize),
    height: Math.max(minHitTarget, settings.navArrowSize),
    minWidth: Math.max(minHitTarget, settings.navArrowSize),
    minHeight: Math.max(minHitTarget, settings.navArrowSize),
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  };

  const handleHover = (e: React.MouseEvent<HTMLButtonElement>, entering: boolean) => {
    e.currentTarget.style.transform = entering
      ? `scale(${settings.navArrowHoverScale})`
      : 'scale(1)';
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
    >
      <button
        type="button"
        style={{ ...baseBtnStyle, left: edgeInset, ...verticalStyle }}
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        onMouseEnter={(e) => handleHover(e, true)}
        onMouseLeave={(e) => handleHover(e, false)}
        aria-label={previousLabel}
      >
        <IconChevronLeft size={iconSize} />
      </button>

      <button
        type="button"
        style={{ ...baseBtnStyle, right: edgeInset, ...verticalStyle }}
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        onMouseEnter={(e) => handleHover(e, true)}
        onMouseLeave={(e) => handleHover(e, false)}
        aria-label={nextLabel}
      >
        <IconChevronRight size={iconSize} />
      </button>
    </div>
  );
}
