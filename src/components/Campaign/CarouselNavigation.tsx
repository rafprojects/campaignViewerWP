import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
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
  scrollAnimationStyle = 'smooth',
  scrollAnimationDurationMs = 180,
  scrollAnimationEasing = 'ease',
}: CarouselNavigationProps) {
  const thumbnailStripRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
        <Box
          ref={thumbnailStripRef}
          onWheel={(event) => {
            const strip = thumbnailStripRef.current;
            if (!strip) return;
            const deltaX = (event.deltaY !== 0 ? event.deltaY : event.deltaX) * thumbnailScrollSpeed;
            strip.scrollBy({ left: deltaX, behavior: resolvedScrollBehavior });
            event.preventDefault();
          }}
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollBehavior: resolvedCssScrollBehavior,
            paddingBottom: 4,
          }}
        >
          {items.map((item, index) => (
            <ActionIcon
              key={item.id}
              ref={(node) => {
                thumbRefs.current[index] = node;
              }}
              onClick={() => onSelect(index)}
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
      )}
    </>
  );
}
