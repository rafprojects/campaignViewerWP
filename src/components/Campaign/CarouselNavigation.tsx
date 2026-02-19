import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ActionIcon, Badge, Box, Group, Image } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { ScrollAnimationEasing, ScrollAnimationStyle } from '@/types';

interface CarouselNavigationItem {
  id: string;
  thumbnail?: string;
  url: string;
  caption?: string;
}

interface CarouselNavigationProps {
  total: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  items: CarouselNavigationItem[];
  previousLabel: string;
  nextLabel: string;
  thumbnailHeight?: number;
  thumbnailWidth?: number;
  thumbnailScrollSpeed?: number;
  thumbnailGap?: number;
  thumbnailWheelScrollEnabled?: boolean;
  thumbnailDragScrollEnabled?: boolean;
  thumbnailScrollButtonsVisible?: boolean;
  scrollAnimationStyle?: ScrollAnimationStyle;
  scrollAnimationDurationMs?: number;
  scrollAnimationEasing?: ScrollAnimationEasing;
}

export function CarouselNavigation({
  total,
  currentIndex,
  onPrev,
  onNext,
  onSelect,
  items,
  previousLabel,
  nextLabel,
  thumbnailHeight = 60,
  thumbnailWidth = 60,
  thumbnailScrollSpeed = 1,
  thumbnailGap = 6,
  thumbnailWheelScrollEnabled = true,
  thumbnailDragScrollEnabled = true,
  thumbnailScrollButtonsVisible = false,
  scrollAnimationStyle = 'smooth',
  scrollAnimationDurationMs = 180,
  scrollAnimationEasing = 'ease',
}: CarouselNavigationProps) {
  const thumbnailStripRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* ── Drag-to-scroll state ─────────────────────────── */
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0, hasMoved: false });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!thumbnailDragScrollEnabled) return;
      const strip = thumbnailStripRef.current;
      if (!strip) return;
      setIsDragging(true);
      dragState.current = { startX: e.clientX, scrollLeft: strip.scrollLeft, hasMoved: false };
      strip.setPointerCapture(e.pointerId);
    },
    [thumbnailDragScrollEnabled],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const dx = e.clientX - dragState.current.startX;
      if (Math.abs(dx) > 3) dragState.current.hasMoved = true;
      const strip = thumbnailStripRef.current;
      if (strip) strip.scrollLeft = dragState.current.scrollLeft - dx;
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      setIsDragging(false);
      const strip = thumbnailStripRef.current;
      if (strip) strip.releasePointerCapture(e.pointerId);
    },
    [isDragging],
  );

  /* ── Strip scroll buttons ─────────────────────────── */
  const scrollStrip = useCallback(
    (direction: -1 | 1) => {
      const strip = thumbnailStripRef.current;
      if (!strip) return;
      const pageSize = strip.clientWidth * 0.75;
      strip.scrollBy({ left: direction * pageSize, behavior: 'smooth' });
    },
    [],
  );

  const resolvedScrollBehavior = useMemo<ScrollBehavior>(
    () => (scrollAnimationStyle === 'smooth' ? 'smooth' : 'auto'),
    [scrollAnimationStyle],
  );

  const resolvedCssScrollBehavior = useMemo<NonNullable<CSSProperties['scrollBehavior']>>(
    () => (scrollAnimationStyle === 'smooth' ? 'smooth' : 'auto'),
    [scrollAnimationStyle],
  );

  useEffect(() => {
    const activeThumb = thumbRefs.current[currentIndex];
    if (!activeThumb) return;
    if (typeof activeThumb.scrollIntoView !== 'function') return;
    activeThumb.scrollIntoView({ behavior: resolvedScrollBehavior, inline: 'center', block: 'nearest' });
  }, [currentIndex, resolvedScrollBehavior]);

  return (
    <>
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <ActionIcon
            onClick={onPrev}
            variant="light"
            size="lg"
            aria-label={previousLabel}
            disabled={total <= 1}
          >
            <IconChevronLeft size={20} />
          </ActionIcon>
          <ActionIcon
            onClick={onNext}
            variant="light"
            size="lg"
            aria-label={nextLabel}
            disabled={total <= 1}
          >
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>

        <Badge>
          {currentIndex + 1} / {total}
        </Badge>
      </Group>

      {total > 1 && (
        <Group gap={4} wrap="nowrap">
          {thumbnailScrollButtonsVisible && (
            <ActionIcon
              onClick={() => scrollStrip(-1)}
              variant="subtle"
              size="sm"
              aria-label="Scroll thumbnails left"
            >
              <IconChevronLeft size={14} />
            </ActionIcon>
          )}

          <Box
            ref={thumbnailStripRef}
            onWheel={
              thumbnailWheelScrollEnabled
                ? (event) => {
                    const strip = thumbnailStripRef.current;
                    if (!strip) return;
                    const deltaX =
                      (event.deltaY !== 0 ? event.deltaY : event.deltaX) * thumbnailScrollSpeed;
                    strip.scrollBy({ left: deltaX, behavior: resolvedScrollBehavior });
                    event.preventDefault();
                  }
                : undefined
            }
            onPointerDown={thumbnailDragScrollEnabled ? handlePointerDown : undefined}
            onPointerMove={thumbnailDragScrollEnabled ? handlePointerMove : undefined}
            onPointerUp={thumbnailDragScrollEnabled ? handlePointerUp : undefined}
            onPointerCancel={thumbnailDragScrollEnabled ? handlePointerUp : undefined}
            style={{
              display: 'flex',
              gap: thumbnailGap,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollBehavior: resolvedCssScrollBehavior,
              paddingBottom: 4,
              cursor: thumbnailDragScrollEnabled ? (isDragging ? 'grabbing' : 'grab') : undefined,
              userSelect: isDragging ? 'none' : undefined,
              flex: 1,
              minWidth: 0,
            }}
          >
            {items.map((item, index) => (
              <ActionIcon
                key={item.id}
                ref={(node) => {
                  thumbRefs.current[index] = node;
                }}
                onClick={() => {
                  if (!dragState.current.hasMoved) onSelect(index);
                }}
                variant={index === currentIndex ? 'light' : 'subtle'}
                size="lg"
                p={0}
                aria-label={`Show item ${index + 1} of ${total}`}
                aria-pressed={index === currentIndex}
                style={{
                  border: '2px solid',
                  borderColor: index === currentIndex ? 'var(--wpsg-color-primary)' : 'transparent',
                  overflow: 'hidden',
                  flex: '0 0 auto',
                  transition: `border-color ${scrollAnimationDurationMs}ms ${scrollAnimationEasing}`,
                }}
              >
                <Image
                  src={item.thumbnail || item.url}
                  alt={
                    index === currentIndex
                      ? `${item.caption || `Media item ${index + 1}`} thumbnail`
                      : (item.caption || `Media item ${index + 1}`)
                  }
                  w={thumbnailWidth}
                  h={thumbnailHeight}
                  fit="cover"
                  loading="lazy"
                />
              </ActionIcon>
            ))}
          </Box>

          {thumbnailScrollButtonsVisible && (
            <ActionIcon
              onClick={() => scrollStrip(1)}
              variant="subtle"
              size="sm"
              aria-label="Scroll thumbnails right"
            >
              <IconChevronRight size={14} />
            </ActionIcon>
          )}
        </Group>
      )}
    </>
  );
}
