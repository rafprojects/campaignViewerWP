import { Modal, Table, Text, Kbd, Group, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface BuilderKeyboardShortcutsModalProps {
  opened: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  dkey: string;
  description: string;
}

const SECTIONS: Array<{ hkey: string; heading: string; rows: ShortcutRow[] }> = [
  {
    hkey: 'lb_bksc_h_file', heading: 'File',
    rows: [{ keys: ['Ctrl / ⌘', 'S'], dkey: 'lb_bksc_save', description: 'Save template' }],
  },
  {
    hkey: 'lb_bksc_h_history', heading: 'History',
    rows: [
      { keys: ['Ctrl / ⌘', 'Z'], dkey: 'lb_bksc_undo', description: 'Undo' },
      { keys: ['Ctrl / ⌘', 'Shift', 'Z'], dkey: 'lb_bksc_redo', description: 'Redo' },
    ],
  },
  {
    hkey: 'lb_bksc_h_selection', heading: 'Selection',
    rows: [
      { keys: ['Delete'], dkey: 'lb_bksc_remove', description: 'Remove selected slot(s)' },
      { keys: ['Escape'], dkey: 'lb_bksc_deselect', description: 'Deselect all' },
      { keys: ['Ctrl / ⌘', 'D'], dkey: 'lb_bksc_duplicate', description: 'Duplicate selected slot(s)' },
      { keys: ['Ctrl / ⌘', 'C'], dkey: 'lb_bksc_copy', description: 'Copy selected slot(s)' },
      { keys: ['Ctrl / ⌘', 'V'], dkey: 'lb_bksc_paste', description: 'Paste slot(s)' },
      { keys: ['Ctrl / ⌘', 'G'], dkey: 'lb_bksc_group', description: 'Group selected (2+) · or select all in group when already grouped' },
      { keys: ['Ctrl / ⌘', 'Shift', 'G'], dkey: 'lb_bksc_ungroup', description: 'Ungroup selected group' },
      { keys: ['Ctrl / ⌘', 'click'], dkey: 'lb_bksc_toggle', description: 'Toggle slot in selection (layers panel)' },
      { keys: ['Shift', 'click'], dkey: 'lb_bksc_range', description: 'Range select (layers panel)' },
    ],
  },
  {
    hkey: 'lb_bksc_h_nudge', heading: 'Nudge',
    rows: [
      { keys: ['↑ ↓ ← →'], dkey: 'lb_bksc_nudge1', description: 'Move selected slot 1%' },
      { keys: ['Shift', '↑ ↓ ← →'], dkey: 'lb_bksc_nudge10', description: 'Move selected slot 10% (large)' },
      { keys: ['Alt', '↑ ↓ ← →'], dkey: 'lb_bksc_nudge01', description: 'Move selected slot 0.1% (fine)' },
    ],
  },
  {
    hkey: 'lb_bksc_h_zorder', heading: 'Z-order',
    rows: [
      { keys: [']'], dkey: 'lb_bksc_bring_fwd', description: 'Bring forward' },
      { keys: ['['], dkey: 'lb_bksc_send_bwd', description: 'Send backward' },
      { keys: ['Shift', ']'], dkey: 'lb_bksc_bring_front', description: 'Bring to front' },
      { keys: ['Shift', '['], dkey: 'lb_bksc_send_back', description: 'Send to back' },
    ],
  },
  {
    hkey: 'lb_bksc_h_canvas', heading: 'Canvas',
    rows: [
      { keys: ['N'], dkey: 'lb_bksc_add_slot', description: 'Add new slot' },
      { keys: ['H'], dkey: 'lb_bksc_hand', description: 'Toggle hand / pan tool' },
      { keys: ['V'], dkey: 'lb_bksc_select', description: 'Return to select tool' },
      { keys: ['F'], dkey: 'lb_bksc_fit', description: 'Fit canvas to viewport' },
      { keys: ['0'], dkey: 'lb_bksc_reset_zoom', description: 'Reset zoom to 100%' },
      { keys: ['+'], dkey: 'lb_bksc_zoom_in', description: 'Zoom in' },
      { keys: ['-'], dkey: 'lb_bksc_zoom_out', description: 'Zoom out' },
    ],
  },
  {
    hkey: 'lb_bksc_h_help', heading: 'Help',
    rows: [{ keys: ['?'], dkey: 'lb_bksc_help_desc', description: 'Show this keyboard shortcuts reference' }],
  },
];

export function BuilderKeyboardShortcutsModal({
  opened,
  onClose,
}: BuilderKeyboardShortcutsModalProps) {
  const { t } = useTranslation('wpsg');
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('lb_bksc_title', 'Builder Keyboard Shortcuts')}
      size="md"
      aria-label={t('lb_bksc_aria', 'Builder keyboard shortcuts reference')}
    >
      <Stack gap="lg">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <Text fw={600} mb="xs" size="sm" c="dimmed" tt="uppercase">
              {t(section.hkey, section.heading)}
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
                    <Table.Td>{t(row.dkey, row.description)}</Table.Td>
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

setWpsgDebugDisplayName(BuilderKeyboardShortcutsModal, 'LayoutBuilder:BuilderKeyboardShortcutsModal');