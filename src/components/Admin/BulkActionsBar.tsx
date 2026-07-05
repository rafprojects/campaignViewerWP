import { Button, Group, Text, Paper, ActionIcon, Tooltip } from '@mantine/core';
import { IconX, IconArchive, IconArchiveOff, IconFileZip, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface BulkActionsBarProps {
  selectedCount: number;
  /** True if at least one selected campaign is active (not archived). */
  hasActiveSelected: boolean;
  /** True if at least one selected campaign is archived. */
  hasArchivedSelected: boolean;
  isLoading: boolean;
  isExporting: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedCount,
  hasActiveSelected,
  hasArchivedSelected,
  isLoading,
  isExporting,
  onArchive,
  onRestore,
  onExport,
  onDelete,
  onClearSelection,
}: BulkActionsBarProps) {
  const { t } = useTranslation('wpsg');
  if (selectedCount === 0) return null;

  return (
    <Paper
      shadow="sm"
      p="xs"
      radius="md"
      withBorder
      style={{
        position: 'sticky',
        bottom: 12,
        zIndex: 10,
        background: 'var(--mantine-color-dark-7)',
        borderColor: 'var(--mantine-color-blue-6)',
      }}
    >
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs" wrap="nowrap">
          <Tooltip label={t('admin_clear_selection', 'Clear selection')}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onClearSelection}
              aria-label={t('admin_clear_selection', 'Clear selection')}
            >
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
          <Text size="sm" fw={600}>
            {t('admin_bulk_selected', '{{count}} campaign selected', { count: selectedCount })}
          </Text>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs"
            color="blue"
            variant="light"
            leftSection={<IconFileZip size={14} />}
            loading={isExporting}
            onClick={onExport}
          >
            {t('admin_export_zip', 'Export ZIP')}
          </Button>
          {hasActiveSelected && (
            <Button
              size="xs"
              color="orange"
              variant="light"
              leftSection={<IconArchive size={14} />}
              loading={isLoading}
              onClick={onArchive}
            >
              {t('admin_archive', 'Archive')}
            </Button>
          )}
          {hasArchivedSelected && (
            <Button
              size="xs"
              color="teal"
              variant={hasActiveSelected ? 'subtle' : 'light'}
              leftSection={<IconArchiveOff size={14} />}
              loading={isLoading}
              onClick={onRestore}
            >
              {t('admin_restore', 'Restore')}
            </Button>
          )}
          <Button
            size="xs"
            color="red"
            variant="light"
            leftSection={<IconTrash size={14} />}
            loading={isLoading}
            onClick={onDelete}
          >
            {t('admin_delete', 'Delete')}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

setWpsgDebugDisplayName(BulkActionsBar, 'AdminPanel:BulkActionsBar');
