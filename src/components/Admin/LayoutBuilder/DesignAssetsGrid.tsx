import { Box, Text, ActionIcon, Tooltip, Badge, Popover, TagsInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconX, IconWorld, IconWorldOff, IconTag } from '@tabler/icons-react';
import type { AssetLibraryItem } from './BuilderDockContext';
import { getAssetFileType } from '@/utils/assetFileType';
import { CHECKERED_BG } from '@/utils/checkeredBg';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

/** Custom MIME type for Design Asset drag-and-drop. */
export const ASSET_MIME = 'application/x-wpsg-asset-url';

export interface DesignAssetsGridProps {
  items: AssetLibraryItem[];
  /** Called when user clicks an asset (e.g. pick as mask or background). */
  onSelect?: ((url: string) => void) | undefined;
  /** Called to delete an asset from the library. */
  onDelete?: ((id: string) => void) | undefined;
  /** P50-I: toggle an asset's universal (all-spaces) visibility. */
  onSetUniversal?: ((id: string, universal: boolean) => void) | undefined;
  /** P50-K: replace an asset's tag list. */
  onSetTags?: ((id: string, tags: string[]) => void) | undefined;
  /** Highlight the currently-active URL (e.g. current mask image). */
  activeUrl?: string | undefined;
  /** Max height of the scrollable container (default: 180). */
  maxHeight?: number | undefined;
  /** Number of grid columns (default: 2). */
  columns?: number | undefined;
}

export function DesignAssetsGrid({
  items,
  onSelect,
  onDelete,
  onSetUniversal,
  onSetTags,
  activeUrl,
  maxHeight = 180,
  columns = 2,
}: DesignAssetsGridProps) {
  const { t } = useTranslation('wpsg');
  if (!items.length) {
    return <Text size="xs" c="dimmed">{t('lb_dag_empty', 'No design assets in library yet.')}</Text>;
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
          const fileType = getAssetFileType(item.url);
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
                  ...CHECKERED_BG,
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

              {/* File-type badge (bottom-left) */}
              <Badge
                size="xs"
                variant="filled"
                color="dark"
                radius="sm"
                style={{
                  position: 'absolute',
                  bottom: 2,
                  left: 2,
                  zIndex: 1,
                  opacity: 0.78,
                  pointerEvents: 'none',
                }}
                aria-label={t('lb_dag_file_type', 'File type: {{type}}', { type: fileType })}
              >
                {fileType}
              </Badge>

              {/* Universal (all-spaces) toggle — bottom-right */}
              {onSetUniversal && (
                <Tooltip
                  label={item.isUniversal ? 'Available to all spaces — click to make space-specific' : 'Make available to all spaces'}
                  withArrow
                  position="top"
                >
                  <ActionIcon
                    size={16}
                    variant={item.isUniversal ? 'filled' : 'light'}
                    color={item.isUniversal ? 'blue' : 'gray'}
                    radius="xl"
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      zIndex: 1,
                      opacity: item.isUniversal ? 1 : 0.7,
                    }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onSetUniversal(item.id, !item.isUniversal);
                    }}
                    aria-label={
                      item.isUniversal
                        ? t('admin_font_make_specific', 'Make {{name}} space-specific', { name: item.name })
                        : t('admin_font_make_universal', 'Make {{name}} available to all spaces', { name: item.name })
                    }
                    aria-pressed={item.isUniversal}
                  >
                    {item.isUniversal ? <IconWorld size={10} /> : <IconWorldOff size={10} />}
                  </ActionIcon>
                </Tooltip>
              )}

              {/* P50-K: tag editor — top-left */}
              {onSetTags && (
                <Popover position="bottom-start" withArrow shadow="md" width={220} withinPortal>
                  <Popover.Target>
                    <Tooltip label={item.tags?.length ? t('lb_dag_tags_list', 'Tags: {{tags}}', { tags: item.tags.join(', ') }) : t('lb_dag_add_tags', 'Add tags')} withArrow position="top">
                      <ActionIcon
                        size={16}
                        variant={item.tags?.length ? 'filled' : 'light'}
                        color={item.tags?.length ? 'grape' : 'gray'}
                        radius="xl"
                        style={{ position: 'absolute', top: 2, left: 2, zIndex: 1, opacity: item.tags?.length ? 1 : 0.7 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        aria-label={t('lb_dag_edit_tags', 'Edit tags for {{name}}', { name: item.name })}
                      >
                        <IconTag size={10} />
                      </ActionIcon>
                    </Tooltip>
                  </Popover.Target>
                  <Popover.Dropdown onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <TagsInput
                      size="xs"
                      label={t('lb_dag_tags', 'Tags')}
                      placeholder={t('lb_dag_add_tag_ph', 'Add a tag…')}
                      value={item.tags ?? []}
                      onChange={(tags) => onSetTags(item.id, tags)}
                      clearable
                    />
                  </Popover.Dropdown>
                </Popover>
              )}

              {/* X delete overlay */}
              {onDelete && (
                <Tooltip label={t('lb_dag_delete', 'Delete')} withArrow position="top">
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
                    aria-label={t('lb_dag_delete_name', 'Delete {{name}}', { name: item.name })}
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

setWpsgDebugDisplayName(DesignAssetsGrid, 'LayoutBuilder:DesignAssetsGrid');
