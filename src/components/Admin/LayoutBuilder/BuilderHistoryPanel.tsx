import { useCallback } from 'react';
import { Stack, Text, Box, ActionIcon, Tooltip, Group, ScrollArea } from '@mantine/core';
import { IconClockHour4, IconTrash } from '@tabler/icons-react';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';

// ── Component ────────────────────────────────────────────────

export function BuilderHistoryPanel(_props: IDockviewPanelProps) {
  const { builder } = useBuilderDock();
  const { historyEntries, historyCurrentIndex, undo, redo, canUndo, canRedo } =
    builder;

  /**
   * Jump to a specific history index by calling undo/redo the appropriate
   * number of times.  This is a simple sequential approach; a direct jump
   * would require restructuring the hook but is not needed for P19-B scope.
   */
  const handleJump = useCallback(
    (targetIndex: number) => {
      const current = historyCurrentIndex;
      if (targetIndex < current) {
        for (let i = 0; i < current - targetIndex; i++) undo();
      } else if (targetIndex > current) {
        for (let i = 0; i < targetIndex - current; i++) redo();
      }
    },
    [historyCurrentIndex, undo, redo],
  );

  if (historyEntries.length === 0) {
    return (
      <Box
        p="md"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconClockHour4
          size={32}
          style={{ opacity: 0.3, marginBottom: 8 }}
        />
        <Text size="sm" c="dimmed" ta="center">
          No history yet.
          <br />
          Make a change to see the history.
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }} p="xs">
      {/* Header */}
      <Group justify="space-between" mb="xs" px={4}>
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          History ({historyEntries.length})
        </Text>
        <Group gap={4}>
          <Tooltip label="Undo (Ctrl+Z)">
            <ActionIcon
              size="sm"
              variant="subtle"
              disabled={!canUndo}
              onClick={undo}
              aria-label="Undo"
            >
              &#8630;
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Redo (Ctrl+Shift+Z)">
            <ActionIcon
              size="sm"
              variant="subtle"
              disabled={!canRedo}
              onClick={redo}
              aria-label="Redo"
            >
              &#8631;
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Entry list */}
      <ScrollArea style={{ flex: 1 }} type="auto">
        <Stack gap={0}>
          {/* Show entries in reverse (most recent first) */}
          {[...historyEntries].reverse().map((entry, reversedIdx) => {
            const entryIdx = historyEntries.length - 1 - reversedIdx;
            const isCurrent = entryIdx === historyCurrentIndex;
            const isFuture = entryIdx > historyCurrentIndex;

            return (
              <Box
                key={entry.id}
                data-testid={`history-entry-${entryIdx}`}
                onClick={() => handleJump(entryIdx)}
                style={{
                  cursor: 'pointer',
                  borderRadius: 4,
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isCurrent
                    ? 'var(--mantine-color-blue-light)'
                    : 'transparent',
                  opacity: isFuture ? 0.45 : 1,
                }}
                aria-label={`Jump to: ${entry.label}`}
              >
                <Text
                  size="xs"
                  fw={isCurrent ? 600 : 400}
                  c={isCurrent ? 'blue' : undefined}
                  truncate
                  style={{ flex: 1 }}
                >
                  {entry.label}
                </Text>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </Text>
              </Box>
            );
          })}

          {/* "Initial state" marker at the bottom */}
          <Box
            data-testid="history-entry-initial"
            onClick={() => {
              // Jump all the way back
              for (let i = 0; i < historyCurrentIndex + 1; i++) undo();
            }}
            style={{
              cursor: 'pointer',
              borderRadius: 4,
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: historyCurrentIndex === -1 ? 1 : 0.45,
            }}
            aria-label="Jump to initial state"
          >
            <Text size="xs" c="dimmed" fs="italic" style={{ flex: 1 }}>
              Initial state
            </Text>
            <IconTrash size={12} style={{ opacity: 0.3 }} />
          </Box>
        </Stack>
      </ScrollArea>
    </Box>
  );
}
