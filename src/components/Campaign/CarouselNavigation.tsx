import { ActionIcon, Badge, Group, Image } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

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
}: CarouselNavigationProps) {
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
        <Group gap={6}>
          {items.map((item, index) => (
            <ActionIcon
              key={item.id}
              onClick={() => onSelect(index)}
              variant={index === currentIndex ? 'light' : 'subtle'}
              size="lg"
              p={0}
              aria-label={`Show item ${index + 1} of ${total}`}
              aria-pressed={index === currentIndex}
              style={{
                border: index === currentIndex ? '2px solid var(--wpsg-color-primary)' : 'none',
                overflow: 'hidden',
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
        </Group>
      )}
    </>
  );
}
