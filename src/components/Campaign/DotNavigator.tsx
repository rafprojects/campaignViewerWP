import { useMemo, type CSSProperties } from 'react';
import type { GalleryBehaviorSettings } from '@/types';

interface DotNavigatorProps {
  total: number;
  currentIndex: number;
  onSelect: (index: number) => void;
  settings: GalleryBehaviorSettings;
}

/** Maximum dots before truncation kicks in. */
const MAX_VISIBLE_DOTS = 7;

/**
 * Dot-style page indicator for carousels.
 * Supports configurable position, shape, size, colors, spacing, active scale,
 * and truncation for large galleries.
 */
export function DotNavigator({ total, currentIndex, onSelect, settings }: DotNavigatorProps) {
  if (!settings.dotNavEnabled || total <= 1) return null;

  const isOverlay = settings.dotNavPosition !== 'below';

  const containerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: settings.dotNavSpacing,
    padding: '6px 0',
    ...(isOverlay
      ? {
          position: 'absolute',
          left: 0,
          right: 0,
          zIndex: 10,
          ...(settings.dotNavPosition === 'overlay-bottom' ? { bottom: 8 } : { top: 8 }),
          pointerEvents: 'none',
        }
      : {}),
  };

  // Truncation logic: show first, last, current ± 1, and ellipsis
  const dots = useMemo(() => {
    if (total <= MAX_VISIBLE_DOTS) {
      return Array.from({ length: total }, (_, i) => ({ index: i, type: 'dot' as const }));
    }

    const visible = new Set<number>();
    visible.add(0);
    visible.add(total - 1);
    for (let d = -1; d <= 1; d++) {
      const idx = currentIndex + d;
      if (idx >= 0 && idx < total) visible.add(idx);
    }

    const sorted = [...visible].sort((a, b) => a - b);
    const result: Array<{ index: number; type: 'dot' | 'ellipsis' }> = [];
    let prev = -1;

    for (const idx of sorted) {
      if (prev !== -1 && idx - prev > 1) {
        result.push({ index: -1, type: 'ellipsis' });
      }
      result.push({ index: idx, type: 'dot' });
      prev = idx;
    }

    return result;
  }, [total, currentIndex]);

  const shapeRadius =
    settings.dotNavShape === 'circle'
      ? '50%'
      : settings.dotNavShape === 'pill'
        ? `${settings.dotNavSize}px`
        : '2px';

  const dotWidth =
    settings.dotNavShape === 'pill' ? settings.dotNavSize * 2 : settings.dotNavSize;

  return (
    <div style={containerStyle} role="tablist" aria-label="Slide navigation">
      {dots.map((item, i) => {
        if (item.type === 'ellipsis') {
          return (
            <span
              key={`ellipsis-${i}`}
              style={{
                width: settings.dotNavSize,
                height: settings.dotNavSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: settings.dotNavInactiveColor,
                fontSize: settings.dotNavSize,
                lineHeight: 1,
                pointerEvents: 'auto',
              }}
              aria-hidden
            >
              …
            </span>
          );
        }

        const isActive = item.index === currentIndex;
        const scale = isActive ? settings.dotNavActiveScale : 1;

        return (
          <button
            key={item.index}
            role="tab"
            aria-selected={isActive}
            aria-label={`Go to slide ${item.index + 1}`}
            onClick={() => onSelect(item.index)}
            style={{
              display: 'inline-block',
              width: dotWidth,
              height: settings.dotNavSize,
              borderRadius: shapeRadius,
              backgroundColor: isActive ? settings.dotNavActiveColor : settings.dotNavInactiveColor,
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transform: `scale(${scale})`,
              transition: 'transform 200ms ease, background-color 200ms ease',
              pointerEvents: 'auto',
            }}
          />
        );
      })}
    </div>
  );
}
