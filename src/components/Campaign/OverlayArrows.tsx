import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { GalleryBehaviorSettings } from '@/types';

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
 */
export function OverlayArrows({
  onPrev,
  onNext,
  total,
  settings,
  previousLabel = 'Previous',
  nextLabel = 'Next',
}: OverlayArrowsProps) {
  const [visible, setVisible] = useState(settings.navArrowAutoHideMs === 0);
  const hideTimerRef = useRef<number>(0);

  const scheduleHide = useCallback(() => {
    if (settings.navArrowAutoHideMs <= 0) return;
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setVisible(false), settings.navArrowAutoHideMs);
  }, [settings.navArrowAutoHideMs]);

  const handleInteraction = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (settings.navArrowAutoHideMs > 0) {
      // Start hidden, show on interaction
      setVisible(false);
    } else {
      setVisible(true);
    }
    return () => window.clearTimeout(hideTimerRef.current);
  }, [settings.navArrowAutoHideMs]);

  if (total <= 1) return null;

  const verticalStyle: CSSProperties =
    settings.navArrowPosition === 'top'
      ? { top: 12 }
      : settings.navArrowPosition === 'bottom'
        ? { bottom: 12 }
        : { top: '50%', transform: 'translateY(-50%)' };

  const iconSize = Math.round(settings.navArrowSize * 0.6);

  const baseBtnStyle: CSSProperties = {
    position: 'absolute',
    color: settings.navArrowColor,
    backgroundColor: settings.navArrowBgColor,
    border: settings.navArrowBorderWidth > 0
      ? `${settings.navArrowBorderWidth}px solid ${settings.navArrowColor}`
      : 'none',
    transition: 'opacity 250ms ease, transform 150ms ease',
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    width: settings.navArrowSize,
    height: settings.navArrowSize,
    minWidth: settings.navArrowSize,
    minHeight: settings.navArrowSize,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  };

  const handleHover = (e: React.MouseEvent<HTMLButtonElement>, entering: boolean) => {
    if (entering) {
      e.currentTarget.style.transform = `scale(${settings.navArrowHoverScale})`;
    } else {
      e.currentTarget.style.transform = '';
    }
  };

  return (
    <div
      onMouseMove={settings.navArrowAutoHideMs > 0 ? handleInteraction : undefined}
      onTouchStart={settings.navArrowAutoHideMs > 0 ? handleInteraction : undefined}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
    >
      <button
        type="button"
        style={{ ...baseBtnStyle, left: 12, ...verticalStyle }}
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        onMouseEnter={(e) => handleHover(e, true)}
        onMouseLeave={(e) => handleHover(e, false)}
        aria-label={previousLabel}
      >
        <IconChevronLeft size={iconSize} />
      </button>

      <button
        type="button"
        style={{ ...baseBtnStyle, right: 12, ...verticalStyle }}
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
