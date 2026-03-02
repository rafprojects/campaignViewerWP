import { Modal, Table, Text, Kbd, Group, Stack } from '@mantine/core';

interface BuilderKeyboardShortcutsModalProps {
  opened: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  description: string;
}

const SECTIONS: Array<{ heading: string; rows: ShortcutRow[] }> = [
  {
    heading: 'File',
    rows: [{ keys: ['Ctrl', 'S'], description: 'Save template' }],
  },
  {
    heading: 'History',
    rows: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
    ],
  },
  {
    heading: 'Selection',
    rows: [
      { keys: ['Delete'], description: 'Remove selected slot(s)' },
      { keys: ['Escape'], description: 'Deselect all' },
      { keys: ['Ctrl', 'V'], description: 'Duplicate selected slot(s)' },
    ],
  },
  {
    heading: 'Nudge',
    rows: [
      { keys: ['↑ ↓ ← →'], description: 'Move selected slot 1 unit' },
      { keys: ['Shift', '↑ ↓ ← →'], description: 'Move selected slot 0.1 unit (fine)' },
    ],
  },
  {
    heading: 'Z-order',
    rows: [
      { keys: [']'], description: 'Bring forward' },
      { keys: ['['], description: 'Send backward' },
      { keys: ['Shift', ']'], description: 'Bring to front' },
      { keys: ['Shift', '['], description: 'Send to back' },
    ],
  },
  {
    heading: 'Canvas',
    rows: [
      { keys: ['H'], description: 'Toggle hand / pan tool' },
      { keys: ['V'], description: 'Return to select tool' },
      { keys: ['0'], description: 'Reset zoom to 100%' },
      { keys: ['+'], description: 'Zoom in' },
      { keys: ['-'], description: 'Zoom out' },
    ],
  },
  {
    heading: 'Help',
    rows: [{ keys: ['?'], description: 'Show this keyboard shortcuts reference' }],
  },
];

export function BuilderKeyboardShortcutsModal({
  opened,
  onClose,
}: BuilderKeyboardShortcutsModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Builder Keyboard Shortcuts"
      size="md"
      aria-label="Builder keyboard shortcuts reference"
    >
      <Stack gap="lg">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <Text fw={600} mb="xs" size="sm" c="dimmed" tt="uppercase">
              {section.heading}
            </Text>
            <Table
              striped
              withColumnBorders={false}
              style={{ tableLayout: 'fixed' }}
            >
              <Table.Tbody>
                {section.rows.map((row) => (
                  <Table.Tr key={row.description}>
                    <Table.Td style={{ width: '50%' }}>
                      <Group gap={4} wrap="nowrap">
                        {row.keys.map((k, i) => (
                          <span key={i}>
                            <Kbd>{k}</Kbd>
                            {i < row.keys.length - 1 && (
                              <Text span size="xs" c="dimmed" px={2}>
                                +
                              </Text>
                            )}
                          </span>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>{row.description}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        ))}
      </Stack>
    </Modal>
  );
}
