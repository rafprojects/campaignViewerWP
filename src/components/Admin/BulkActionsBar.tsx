import { Button, Group, Text, Paper, ActionIcon, Tooltip } from '@mantine/core';
import { IconX, IconArchive, IconArchiveOff } from '@tabler/icons-react';

export interface BulkActionsBarProps {
  selectedCount: number;
  /** True if all currently visible campaigns are archived (affects which action is primary). */
  allSelectedArchived: boolean;
  isLoading: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedCount,
  allSelectedArchived,
  isLoading,
  onArchive,
  onRestore,
  onClearSelection,
}: BulkActionsBarProps) {
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
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Clear selection">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onClearSelection}
              aria-label="Clear selection"
            >
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
          <Text size="sm" fw={600}>
            {selectedCount} campaign{selectedCount !== 1 ? 's' : ''} selected
          </Text>
        </Group>

        <Group gap="xs" wrap="nowrap">
          {!allSelectedArchived && (
            <Button
              size="xs"
              color="orange"
              variant="light"
              leftSection={<IconArchive size={14} />}
              loading={isLoading}
              onClick={onArchive}
            >
              Archive
            </Button>
          )}
          {allSelectedArchived && (
            <Button
              size="xs"
              color="teal"
              variant="light"
              leftSection={<IconArchiveOff size={14} />}
              loading={isLoading}
              onClick={onRestore}
            >
              Restore
            </Button>
          )}
          {!allSelectedArchived && (
            <Button
              size="xs"
              color="teal"
              variant="subtle"
              leftSection={<IconArchiveOff size={14} />}
              loading={isLoading}
              onClick={onRestore}
            >
              Restore
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
