import { Modal, Table, Text, Stack, Badge, Group } from '@mantine/core';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  section: string;
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    section: 'Navigation',
    items: [
      { keys: ['?'], description: 'Open keyboard shortcuts help (this modal)' },
      { keys: ['Escape'], description: 'Close active modal' },
      { keys: ['/'], description: 'Focus campaign search / filter' },
    ],
  },
  {
    section: 'Campaigns',
    items: [
      { keys: ['Ctrl', 'N'], description: 'New campaign' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate focused campaign' },
      { keys: ['Ctrl', 'E'], description: 'Edit focused campaign' },
      { keys: ['Ctrl', 'I'], description: 'Import campaign from JSON' },
      { keys: ['Ctrl', 'Shift', 'A'], description: 'Toggle bulk select mode' },
    ],
  },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <Group gap={4} wrap="nowrap">
      {keys.map((k, i) => (
        <span key={i}>
          <kbd
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              fontSize: 12,
              lineHeight: '18px',
              fontFamily: 'var(--mantine-font-family-monospace, monospace)',
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 4,
              background: 'var(--mantine-color-default)',
              boxShadow: '0 1px 2px rgba(0,0,0,.1)',
              whiteSpace: 'nowrap',
            }}
          >
            {k}
          </kbd>
          {i < keys.length - 1 && (
            <Text span size="xs" c="dimmed" mx={2}>
              +
            </Text>
          )}
        </span>
      ))}
    </Group>
  );
}

interface KeyboardShortcutsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ opened, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Keyboard Shortcuts" size="lg" centered>
      <Stack gap="xl">
        {SHORTCUT_GROUPS.map((group) => (
          <Stack key={group.section} gap="xs">
            <Badge variant="light" size="sm" style={{ alignSelf: 'flex-start' }}>
              {group.section}
            </Badge>
            <Table striped withTableBorder fz="sm">
              <Table.Tbody>
                {group.items.map((item) => (
                  <Table.Tr key={item.description}>
                    <Table.Td w={180}>
                      <Keys keys={item.keys} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{item.description}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        ))}
        <Text size="xs" c="dimmed">
          macOS: ⌘ replaces Ctrl. Shortcuts are disabled when focus is inside a text input.
        </Text>
      </Stack>
    </Modal>
  );
}
