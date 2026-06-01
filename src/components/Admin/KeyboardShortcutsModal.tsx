import { useState, useRef, useCallback } from 'react';
import { Modal, Table, Text, Stack, Badge, Group, Button, ActionIcon, Tooltip, TextInput } from '@mantine/core';
import { IconEdit, IconCheck, IconX, IconRotateClockwise } from '@tabler/icons-react';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { ACTION_IDS, ACTION_DEFAULTS, type ShortcutActionId, type ShortcutConfigHandle } from '@/hooks/useShortcutConfig';

// ── Key display helpers ───────────────────────────────────────────────────────

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

function formatKeyParts(hotkeyStr: string): string[] {
  return hotkeyStr.split('+').map((k) => {
    if (k === 'mod') return isMac ? '⌘' : 'Ctrl';
    if (k === 'shift') return 'Shift';
    if (k === 'alt') return isMac ? '⌥' : 'Alt';
    return k.toUpperCase();
  });
}

function recordKeyFromEvent(e: React.KeyboardEvent): string | null {
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('mod');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  // Produce a lowercase key name; normalize Space to 'space'
  const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
  parts.push(key);
  return parts.join('+');
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

setWpsgDebugDisplayName(Keys, 'AdminPanel:ShortcutKeys');

interface EditRowProps {
  id: ShortcutActionId;
  currentKey: string;
  defaultKey: string;
  config: ShortcutConfigHandle;
}

function EditRow({ id, currentKey, defaultKey, config }: EditRowProps) {
  const [recording, setRecording] = useState(false);
  const [pendingKey, setPendingKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRecording = useCallback(() => {
    setRecording(true);
    setPendingKey('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const commitKey = useCallback((key: string) => {
    const err = config.updateShortcut(id, key);
    if (err) {
      setError(err);
    } else {
      setRecording(false);
      setError(null);
    }
  }, [config, id]);

  const cancelRecording = useCallback(() => {
    setRecording(false);
    setPendingKey('');
    setError(null);
  }, []);

  const resetRow = useCallback(() => {
    config.updateShortcut(id, defaultKey);
    setError(null);
  }, [config, id, defaultKey]);

  const isCustomized = currentKey !== defaultKey;

  return (
    <Table.Tr>
      <Table.Td w={180}>
        {recording ? (
          <Stack gap={4}>
            <TextInput
              ref={inputRef}
              value={pendingKey ? formatKeyParts(pendingKey).join('+') : ''}
              placeholder="Press a key combo…"
              readOnly
              size="xs"
              error={!!error}
              onKeyDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const combo = recordKeyFromEvent(e);
                if (!combo) return;
                setPendingKey(combo);
                setError(null);
              }}
              onBlur={cancelRecording}
              rightSection={
                pendingKey ? (
                  <ActionIcon size="xs" variant="subtle" color="green" onMouseDown={(e) => { e.preventDefault(); commitKey(pendingKey); }}>
                    <IconCheck size={12} />
                  </ActionIcon>
                ) : (
                  <ActionIcon size="xs" variant="subtle" color="gray" onMouseDown={(e) => { e.preventDefault(); cancelRecording(); }}>
                    <IconX size={12} />
                  </ActionIcon>
                )
              }
            />
            {error && <Text size="xs" c="red">{error}</Text>}
            <Text size="xs" c="dimmed">Press any key combo, then ✓ to confirm</Text>
          </Stack>
        ) : (
          <Group gap={6} wrap="nowrap">
            <Keys keys={formatKeyParts(currentKey)} />
            {isCustomized && (
              <Badge size="xs" variant="dot" color="blue">custom</Badge>
            )}
          </Group>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm">{ACTION_DEFAULTS[id].label}</Text>
      </Table.Td>
      <Table.Td w={80}>
        <Group gap={4} wrap="nowrap">
          {!recording && (
            <Tooltip label="Remap" withArrow>
              <ActionIcon size="xs" variant="subtle" onClick={startRecording} aria-label={`Remap ${ACTION_DEFAULTS[id].label}`}>
                <IconEdit size={13} />
              </ActionIcon>
            </Tooltip>
          )}
          {isCustomized && !recording && (
            <Tooltip label="Reset to default" withArrow>
              <ActionIcon size="xs" variant="subtle" color="orange" onClick={resetRow} aria-label={`Reset ${ACTION_DEFAULTS[id].label} to default`}>
                <IconRotateClockwise size={13} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

setWpsgDebugDisplayName(EditRow, 'AdminPanel:ShortcutEditRow');

// ── Main modal ────────────────────────────────────────────────────────────────

// Navigation group actions that are always displayed but cannot be customized via hotkeys
const STATIC_ITEMS = [
  { keys: ['Escape'], description: 'Close active modal' },
];

// Configurable action IDs rendered in order
const CONFIGURABLE_IDS: ShortcutActionId[] = ACTION_IDS;

interface KeyboardShortcutsModalProps {
  opened: boolean;
  onClose: () => void;
  config?: ShortcutConfigHandle;
}

export function KeyboardShortcutsModal({ opened, onClose, config }: KeyboardShortcutsModalProps) {
  const [editMode, setEditMode] = useState(false);

  const handleClose = useCallback(() => {
    setEditMode(false);
    onClose();
  }, [onClose]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <Text fw={500}>Keyboard Shortcuts</Text>
          {config && (
            <Button
              size="compact-xs"
              variant={editMode ? 'filled' : 'light'}
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? 'Done' : 'Edit shortcuts'}
            </Button>
          )}
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="xl">
        {/* Navigation section — static entries */}
        <Stack gap="xs">
          <Group gap="xs" align="center">
            <Badge variant="light" size="sm">Navigation</Badge>
          </Group>
          <Table striped withTableBorder fz="sm">
            <Table.Tbody>
              <Table.Tr>
                <Table.Td w={180}><Keys keys={['?']} /></Table.Td>
                <Table.Td><Text size="sm">Open keyboard shortcuts help (this modal)</Text></Table.Td>
                {editMode && <Table.Td w={80} />}
              </Table.Tr>
              {STATIC_ITEMS.map((item) => (
                <Table.Tr key={item.description}>
                  <Table.Td w={180}><Keys keys={item.keys} /></Table.Td>
                  <Table.Td><Text size="sm">{item.description}</Text></Table.Td>
                  {editMode && <Table.Td w={80} />}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>

        {/* Campaigns section — configurable */}
        <Stack gap="xs">
          <Group gap="xs" align="center">
            <Badge variant="light" size="sm">Campaigns</Badge>
            {config?.hasCustomizations && !editMode && (
              <Badge size="xs" variant="dot" color="blue">customized</Badge>
            )}
          </Group>
          {editMode && config ? (
            <Table striped withTableBorder fz="sm">
              <Table.Tbody>
                {CONFIGURABLE_IDS.filter((id) => id !== 'openHelp').map((id) => (
                  <EditRow
                    key={id}
                    id={id}
                    currentKey={config.effectiveMap[id]}
                    defaultKey={config.actionDefs[id].defaultKey}
                    config={config}
                  />
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Table striped withTableBorder fz="sm">
              <Table.Tbody>
                {CONFIGURABLE_IDS.filter((id) => id !== 'openHelp').map((id) => {
                  const key = config ? config.effectiveMap[id] : ACTION_DEFAULTS[id].defaultKey;
                  return (
                    <Table.Tr key={id}>
                      <Table.Td w={180}><Keys keys={formatKeyParts(key)} /></Table.Td>
                      <Table.Td><Text size="sm">{ACTION_DEFAULTS[id].label}</Text></Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
          {editMode && config?.hasCustomizations && (
            <Button
              size="xs"
              variant="subtle"
              color="orange"
              leftSection={<IconRotateClockwise size={13} />}
              onClick={() => config.resetToDefaults()}
            >
              Reset all to defaults
            </Button>
          )}
        </Stack>

        <Text size="xs" c="dimmed">
          macOS: ⌘ replaces Ctrl. Shortcuts are disabled when focus is inside a text input.
        </Text>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(KeyboardShortcutsModal, 'AdminPanel:KeyboardShortcutsModal');
