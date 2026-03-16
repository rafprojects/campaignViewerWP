import { Box, Text, ActionIcon, Tooltip } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { OverlayLibraryItem } from './BuilderDockContext';

/** Custom MIME type for Design Asset drag-and-drop. */
export const ASSET_MIME = 'application/x-wpsg-asset-url';

export interface DesignAssetsGridProps {
  items: OverlayLibraryItem[];
  /** Called when user clicks an asset (e.g. pick as mask or background). */
  onSelect?: (url: string) => void;
  /** Called to delete an asset from the library. */
  onDelete?: (id: string) => void;
  /** Highlight the currently-active URL (e.g. current mask image). */
  activeUrl?: string;
  /** Max height of the scrollable container (default: 180). */
  maxHeight?: number;
  /** Number of grid columns (default: 2). */
  columns?: number;
}

export function DesignAssetsGrid({
  items,
  onSelect,
  onDelete,
  activeUrl,
  maxHeight = 180,
  columns = 2,
}: DesignAssetsGridProps) {
  if (!items.length) {
    return <Text size="xs" c="dimmed">No design assets in library yet.</Text>;
  }

  return (
    <div style={{ maxHeight, overflowY: 'auto', overflowX: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 4,
        }}
      >
        {items.map((item) => {
          const isActive = !!activeUrl && item.url === activeUrl;
          return (
            <Box
              key={item.id}
              style={{
                position: 'relative',
                border: isActive
                  ? '2px solid var(--mantine-color-violet-5)'
                  : '1px solid var(--mantine-color-default-border)',
                borderRadius: 4,
                overflow: 'hidden',
                cursor: onSelect ? 'pointer' : 'grab',
              }}
              onClick={() => onSelect?.(item.url)}
              draggable
              onDragStart={(e: React.DragEvent) => {
                e.dataTransfer.setData(ASSET_MIME, item.url);
                e.dataTransfer.setData('text/plain', item.name);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <div
                style={{
                  background: 'var(--mantine-color-dark-7)',
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={item.url}
                  alt={item.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                  draggable={false}
                />
              </div>

              {/* X delete overlay */}
              {onDelete && (
                <Tooltip label="Delete" withArrow position="top">
                  <ActionIcon
                    size={16}
                    variant="filled"
                    color="dark"
                    radius="xl"
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      zIndex: 1,
                      opacity: 0.7,
                    }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    aria-label={`Delete ${item.name}`}
                  >
                    <IconX size={10} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Box>
          );
        })}
      </div>
    </div>
  );
}
