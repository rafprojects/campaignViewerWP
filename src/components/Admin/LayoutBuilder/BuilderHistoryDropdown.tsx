/**
 * P30-E — Builder History Dropdown
 *
 * A lightweight history surface rendered directly in the modal header bar,
 * replacing the dedicated dock tab from P19-B. Accepts history state as
 * explicit props so it can live outside the BuilderDockContext provider.
 */
import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Box,
  Popover,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconClockHour4, IconTrash } from '@tabler/icons-react';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
}

export interface BuilderHistoryDropdownProps {
  historyEntries: HistoryEntry[];
  historyCurrentIndex: number;
  isHistoryTrimmed: boolean;
  onJump: (index: number) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BuilderHistoryDropdown({
  historyEntries,
  historyCurrentIndex,
  isHistoryTrimmed,
  onJump,
}: BuilderHistoryDropdownProps) {
  const [opened, setOpened] = useState(false);

  const handleJump = useCallback(
    (index: number) => {
      onJump(index);
      setOpened(false);
    },
    [onJump],
  );

  const count = historyEntries.length;

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={280}
      shadow="md"
      withArrow
      keepMounted
    >
      <Popover.Target>
        <Tooltip label={`History (${count})`}>
          <ActionIcon
            variant="subtle"
            onClick={() => setOpened((o) => !o)}
            aria-label="Open history"
            aria-expanded={opened}
          >
            <IconClockHour4 size={18} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        {/* Header */}
        <Box px="sm" pt="xs" pb={4} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            History ({count})
          </Text>
        </Box>

        {count === 0 ? (
          /* Empty state */
          <Box p="md" ta="center">
            <IconClockHour4 size={24} style={{ opacity: 0.4, marginBottom: 6 }} />
            <Text size="sm" c="dimmed">
              No history yet.
              <br />
              Make a change to see history.
            </Text>
          </Box>
        ) : (
          <ScrollArea style={{ maxHeight: 300 }} type="auto">
            <Stack gap={0} py={4}>
              {/* Entries in reverse order (newest first) */}
              {[...historyEntries].reverse().map((entry, reversedIdx) => {
                const entryIdx = historyEntries.length - 1 - reversedIdx;
                const isCurrent = entryIdx === historyCurrentIndex;
                const isFuture = entryIdx > historyCurrentIndex;

                return (
                  <UnstyledButton
                    key={entry.id}
                    data-testid={`history-dropdown-entry-${entryIdx}`}
                    onClick={() => handleJump(entryIdx)}
                    aria-label={`Jump to: ${entry.label}`}
                    style={{
                      borderRadius: 4,
                      padding: '4px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: isCurrent
                        ? 'var(--mantine-color-blue-light)'
                        : 'transparent',
                      opacity: isFuture ? 0.45 : 1,
                    }}
                  >
                    <Text
                      size="xs"
                      fw={isCurrent ? 600 : 400}
                      {...(isCurrent ? { c: 'blue' as const } : {})}
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
                  </UnstyledButton>
                );
              })}

              {/* Initial / oldest state sentinel */}
              <UnstyledButton
                data-testid="history-dropdown-entry-initial"
                onClick={() => handleJump(-1)}
                aria-label="Jump to initial state"
                style={{
                  borderRadius: 4,
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: historyCurrentIndex === -1 ? 1 : 0.45,
                }}
              >
                <Text size="xs" c="dimmed" fs="italic" style={{ flex: 1 }}>
                  {isHistoryTrimmed ? 'Oldest state' : 'Initial state'}
                </Text>
                <IconTrash size={12} style={{ opacity: 0.5 }} />
              </UnstyledButton>
            </Stack>
          </ScrollArea>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

setWpsgDebugDisplayName(BuilderHistoryDropdown, 'LayoutBuilder:BuilderHistoryDropdown');
