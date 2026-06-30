import { useEffect, useState } from 'react';
import {
  Stack, TextInput, Textarea, Select, SegmentedControl, Divider, Group,
  NumberInput, Slider, Button, Text, ActionIcon, Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconTrash, IconArrowBigDownLine, IconArrowDown, IconArrowUp, IconArrowBigUpLine,
  IconAlignLeft, IconAlignCenter, IconAlignRight,
} from '@tabler/icons-react';
import type { LayoutTextLayer, LayoutTextSemanticTag, LayoutTextAlign, TypographyOverride } from '@/types';
import { TypographyEditor } from '@/components/Common/TypographyEditor';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface TextPropertiesPanelProps {
  text: LayoutTextLayer;
  /** 1-based display index used in the fallback label ("Text Layer 2"). */
  textIndex: number;
  onUpdate: (id: string, patch: Partial<LayoutTextLayer>) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
}

const SEMANTIC_TAG_OPTIONS: { value: LayoutTextSemanticTag; label: string }[] = [
  { value: 'heading', label: 'Heading (H2)' },
  { value: 'subheading', label: 'Subheading (H3)' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'caption', label: 'Caption' },
];

export function TextPropertiesPanel({
  text, textIndex, onUpdate, onRename, onRemove,
  onBringToFront, onSendToBack, onBringForward, onSendBackward,
}: TextPropertiesPanelProps) {
  const displayName = text.name || `Text Layer ${textIndex}`;
  const [nameValue, setNameValue] = useState(displayName);
  const [contentValue, setContentValue] = useState(text.content);
  const [confirmOpen, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  // Keep local fields in sync if the layer changes externally (e.g. inline
  // canvas edit commits new content while this panel is open).
  useEffect(() => { setContentValue(text.content); }, [text.content]);
  useEffect(() => { setNameValue(displayName); }, [displayName]);

  const set = (patch: Partial<LayoutTextLayer>) => onUpdate(text.id, patch);

  function commitRename() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== displayName) onRename(text.id, trimmed);
    else setNameValue(displayName);
  }
  function commitContent() {
    if (contentValue !== text.content) set({ content: contentValue });
  }

  return (
    <Stack gap="sm" p="xs">
      {/* ── Name ── */}
      <TextInput
        label="Name"
        size="xs"
        value={nameValue}
        onChange={(e) => setNameValue(e.currentTarget.value)}
        onBlur={commitRename}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        aria-label="Text layer name"
      />

      {/* ── Content ── */}
      <Textarea
        label="Text"
        size="xs"
        autosize
        minRows={2}
        maxRows={6}
        value={contentValue}
        onChange={(e) => setContentValue(e.currentTarget.value)}
        onBlur={commitContent}
        aria-label="Text content"
      />

      {/* ── Role & alignment ── */}
      <Divider label="Text" labelPosition="left" />
      <Select
        label="Style"
        size="xs"
        value={text.semanticTag}
        onChange={(v) => v && set({ semanticTag: v as LayoutTextSemanticTag })}
        data={SEMANTIC_TAG_OPTIONS}
        allowDeselect={false}
        comboboxProps={{ withinPortal: false }}
      />
      <div>
        <Text size="xs" c="dimmed" mb={4}>Alignment</Text>
        <SegmentedControl
          size="xs"
          fullWidth
          value={text.textAlign}
          onChange={(v) => set({ textAlign: v as LayoutTextAlign })}
          data={[
            { value: 'left', label: <IconAlignLeft size={14} /> },
            { value: 'center', label: <IconAlignCenter size={14} /> },
            { value: 'right', label: <IconAlignRight size={14} /> },
          ]}
          aria-label="Text alignment"
        />
      </div>

      {/* ── Typography (reuses the shared TypographyEditor) ── */}
      <Divider label="Typography" labelPosition="left" />
      <TypographyEditor
        value={text.typography}
        onChange={(typo: TypographyOverride) => set({ typography: typo })}
      />

      {/* ── Position ── */}
      <Divider label="Position" labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput label="X %" value={text.x} onChange={(v) => set({ x: Number(v) || 0 })} min={0} max={100} step={0.5} size="xs" />
        <NumberInput label="Y %" value={text.y} onChange={(v) => set({ y: Number(v) || 0 })} min={0} max={100} step={0.5} size="xs" />
      </Group>

      {/* ── Size ── */}
      <Divider label="Size" labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput label="W %" value={text.width} onChange={(v) => set({ width: Math.max(1, Number(v) || 1) })} min={1} max={100} step={0.5} size="xs" />
        <NumberInput label="H %" value={text.height} onChange={(v) => set({ height: Math.max(1, Number(v) || 1) })} min={1} max={100} step={0.5} size="xs" />
      </Group>

      {/* ── Transform & appearance ── */}
      <Divider label="Transform" labelPosition="left" />
      <Text size="xs" c="dimmed">Rotation</Text>
      <Slider value={text.rotation ?? 0} onChange={(v) => set({ rotation: v })} min={-180} max={180} step={1} size="xs" label={(v) => `${v}°`} aria-label="Rotation" />
      <Text size="xs" c="dimmed">Opacity</Text>
      <Slider value={text.opacity} onChange={(v) => set({ opacity: v })} min={0} max={1} step={0.05} size="xs" label={(v) => `${Math.round(v * 100)}%`} aria-label="Opacity" />

      {/* ── Stacking ── */}
      <Divider label="Stacking" labelPosition="left" />
      <Group gap={4} justify="center">
        <Tooltip label="Send to Back"><ActionIcon size="sm" variant="subtle" onClick={() => onSendToBack(text.id)} aria-label="Send to back"><IconArrowBigDownLine size={16} /></ActionIcon></Tooltip>
        <Tooltip label="Send Backward"><ActionIcon size="sm" variant="subtle" onClick={() => onSendBackward(text.id)} aria-label="Send backward"><IconArrowDown size={16} /></ActionIcon></Tooltip>
        <Tooltip label="Bring Forward"><ActionIcon size="sm" variant="subtle" onClick={() => onBringForward(text.id)} aria-label="Bring forward"><IconArrowUp size={16} /></ActionIcon></Tooltip>
        <Tooltip label="Bring to Front"><ActionIcon size="sm" variant="subtle" onClick={() => onBringToFront(text.id)} aria-label="Bring to front"><IconArrowBigUpLine size={16} /></ActionIcon></Tooltip>
      </Group>

      {/* ── Remove ── */}
      <Divider label="Danger zone" labelPosition="left" />
      {confirmOpen ? (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">Remove this text layer?</Text>
          <Group gap={4}>
            <Button size="xs" variant="subtle" onClick={closeConfirm} flex={1}>Cancel</Button>
            <Button size="xs" color="red" onClick={() => { closeConfirm(); onRemove(text.id); }} leftSection={<IconTrash size={12} />} flex={1} aria-label="Confirm remove">Remove</Button>
          </Group>
        </Stack>
      ) : (
        <Button size="xs" variant="light" color="red" fullWidth leftSection={<IconTrash size={12} />} onClick={openConfirm} aria-label="Remove text layer">Remove text layer</Button>
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(TextPropertiesPanel, 'LayoutBuilder:TextPropertiesPanel');
