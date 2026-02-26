import { useRef, useState, type KeyboardEvent, type DragEvent } from 'react';
import {
  Group,
  Text,
  ActionIcon,
  Tooltip,
  TextInput,
  Menu,
} from '@mantine/core';
import {
  IconPhoto,
  IconStack2,
  IconPhoto as IconBg,
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconGripVertical,
  IconDots,
  IconLayoutAlignTop,
  IconLayoutAlignBottom,
  IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';
import type { LayerItem } from '@/utils/layerList';
import { getLayerName } from '@/utils/layerList';
import type { LayoutTemplate } from '@/types';

// ── Props ────────────────────────────────────────────────────

export interface LayerRowProps {
  item: LayerItem;
  template: LayoutTemplate;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  /** Native DnD callbacks */
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, id: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────

function TypeIcon({ item }: { item: LayerItem }) {
  if (item.kind === 'background') return <IconBg size={14} />;
  if (item.kind === 'overlay') return <IconStack2 size={14} />;
  return <IconPhoto size={14} />;
}

// ── Component ────────────────────────────────────────────────

export function LayerRow({
  item,
  template,
  isSelected,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onDragStart,
  onDragOver,
  onDrop,
}: LayerRowProps) {
  const isBackground = item.kind === 'background';
  const visible = item.visible ?? true;
  const locked = item.kind !== 'background' ? (item.locked ?? false) : false;
  const displayName = getLayerName(item, template);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function startEdit() {
    if (isBackground) return;
    setDraftName(displayName);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== displayName) {
      onRename(item.id, trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
    onDragOver(e, item.id);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    setDragOver(false);
    onDrop(e, item.id);
  }

  return (
    <Group
      gap={4}
      py={4}
      data-layer-id={item.id}
      draggable={!isBackground}
      onDragStart={(e) => onDragStart(e as DragEvent<HTMLDivElement>, item.id)}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => onSelect(item.id)}
      style={{
        cursor: isBackground ? 'default' : 'grab',
        // Selection: 3px solid left accent + coloured bg row.
        // `blue-filled` resolves to the solid Mantine blue in both light & dark.
        borderLeft: isSelected
          ? '3px solid var(--mantine-color-blue-filled)'
          : '3px solid transparent',
        borderRadius: isSelected ? '0 4px 4px 0' : 4,
        // Reduce left padding when border is visible so text stays at 6px from edge.
        paddingLeft: isSelected ? 3 : 6,
        paddingRight: 6,
        backgroundColor: isSelected
          ? 'var(--mantine-color-blue-light)'
          : dragOver ? 'var(--mantine-color-gray-light)' : 'transparent',
        userSelect: 'none',
        opacity: visible ? 1 : 0.45,
        borderTop: dragOver ? '2px solid var(--mantine-color-blue-5)' : '2px solid transparent',
        transition: 'background-color 120ms, opacity 120ms, border-left-color 80ms',
      }}
    >
      {/* Drag handle */}
      {!isBackground && (
        <IconGripVertical
          size={12}
          style={{ color: 'var(--mantine-color-gray-5)', flexShrink: 0 }}
        />
      )}

      {/* Type icon */}
      <span style={{ color: 'var(--mantine-color-gray-6)', flexShrink: 0 }}>
        <TypeIcon item={item} />
      </span>

      {/* Name — dbl-click to edit */}
      {editing ? (
        <TextInput
          ref={inputRef}
          size="xs"
          value={draftName}
          onChange={(e) => setDraftName(e.currentTarget.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          styles={{ input: { height: 22, minHeight: 22, padding: '0 4px', fontSize: 12 } }}
          style={{ flex: 1, minWidth: 0 }}
          autoFocus
        />
      ) : (
        <Text
          size="xs"
          fw={isSelected ? 600 : 400}
          onDoubleClick={startEdit}
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: '22px',
            color: isSelected ? 'var(--mantine-color-blue-filled)' : undefined,
          }}
          title={displayName}
        >
          {displayName}
        </Text>
      )}

      {/* Visibility toggle */}
      {!isBackground && (
        <Tooltip label={visible ? 'Hide layer' : 'Show layer'} withArrow openDelay={400}>
          <ActionIcon
            size="xs"
            variant="subtle"
            color={visible ? 'gray' : 'blue'}
            onClick={(e) => { e.stopPropagation(); onToggleVisible(item.id); }}
          >
            {visible ? <IconEye size={12} /> : <IconEyeOff size={12} />}
          </ActionIcon>
        </Tooltip>
      )}

      {/* Lock toggle */}
      {!isBackground && (
        <Tooltip label={locked ? 'Unlock layer' : 'Lock layer'} withArrow openDelay={400}>
          <ActionIcon
            size="xs"
            variant="subtle"
            color={locked ? 'orange' : 'gray'}
            onClick={(e) => { e.stopPropagation(); onToggleLocked(item.id); }}
          >
            {locked ? <IconLock size={12} /> : <IconLockOpen size={12} />}
          </ActionIcon>
        </Tooltip>
      )}

      {/* Context menu */}
      {!isBackground && (
        <Menu width={160} withinPortal>
          <Menu.Target>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={(e) => e.stopPropagation()}
            >
              <IconDots size={12} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconLayoutAlignTop size={12} />}
              onClick={() => onBringToFront(item.id)}
            >
              Bring to Front
            </Menu.Item>
            <Menu.Item
              leftSection={<IconArrowUp size={12} />}
              onClick={() => onBringForward(item.id)}
            >
              Bring Forward
            </Menu.Item>
            <Menu.Item
              leftSection={<IconArrowDown size={12} />}
              onClick={() => onSendBackward(item.id)}
            >
              Send Backward
            </Menu.Item>
            <Menu.Item
              leftSection={<IconLayoutAlignBottom size={12} />}
              onClick={() => onSendToBack(item.id)}
            >
              Send to Back
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}
