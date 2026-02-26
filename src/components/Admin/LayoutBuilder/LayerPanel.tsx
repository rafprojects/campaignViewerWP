import { useRef, type DragEvent, type KeyboardEvent } from 'react';
import { Stack, Text, ScrollArea } from '@mantine/core';
import { buildLayerList } from '@/utils/layerList';
import { LayerRow } from './LayerRow';
import type { LayoutTemplate } from '@/types';

// ── Props ────────────────────────────────────────────────────

export interface LayerPanelProps {
  template: LayoutTemplate;
  /** ID of the currently-selected slot (from builder state). */
  selectedSlotId?: string | null;
  /** ID of the currently-selected graphic layer / overlay (local modal state). */
  selectedOverlayId?: string | null;
  /** Whether the Background row is currently selected. */
  isBackgroundSelected?: boolean;
  onSelectSlot: (id: string) => void;
  onSelectOverlay: (id: string) => void;
  /** Called when the user clicks the Background row. */
  onSelectBackground?: () => void;
  onClearSelection: () => void;
  onRenameSlot: (id: string, name: string) => void;
  onRenameOverlay: (id: string, name: string) => void;
  onToggleSlotVisible: (id: string) => void;
  onToggleOverlayVisible: (id: string) => void;
  onToggleSlotLocked: (id: string) => void;
  onToggleOverlayLocked: (id: string) => void;
  onReorderLayers: (draggedId: string, targetId: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
}

// ── Component ────────────────────────────────────────────────

export function LayerPanel({
  template,
  selectedSlotId,
  selectedOverlayId,
  isBackgroundSelected,
  onSelectSlot,
  onSelectOverlay,
  onSelectBackground,
  onClearSelection,
  onRenameSlot,
  onRenameOverlay,
  onToggleSlotVisible,
  onToggleOverlayVisible,
  onToggleSlotLocked,
  onToggleOverlayLocked,
  onReorderLayers,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
}: LayerPanelProps) {
  const layers = buildLayerList(template);
  const dragIdRef = useRef<string | null>(null);

  // ── Drag handlers ─────────────────────────────────────────

  function handleDragStart(e: DragEvent<HTMLDivElement>, id: string) {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Minimal ghost data so DnD works in all browsers
    e.dataTransfer.setData('text/plain', id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, _targetId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    const draggedId = dragIdRef.current;
    if (draggedId && draggedId !== targetId) {
      onReorderLayers(draggedId, targetId);
    }
    dragIdRef.current = null;
  }

  // ── Keyboard navigation ───────────────────────────────────
  // Determine the single active ID across all layer types for navigation.
  const activeLayerId = selectedSlotId ?? selectedOverlayId ?? (isBackgroundSelected ? 'background' : null);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const selectedIndex = layers.findIndex((l) => l.id === activeLayerId);
    if (selectedIndex < 0) return;

    function selectLayer(item: (typeof layers)[0]) {
      if (item.kind === 'slot') onSelectSlot(item.id);
      else if (item.kind === 'overlay') onSelectOverlay(item.id);
      else onSelectBackground?.();
    }

    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault();
        const prev = layers[selectedIndex - 1];
        if (prev) selectLayer(prev);
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        const next = layers[selectedIndex + 1];
        if (next) selectLayer(next);
        break;
      }
      case ' ':
      case 'Space': {
        e.preventDefault();
        const cur = layers[selectedIndex];
        if (cur.kind === 'slot') onToggleSlotVisible(cur.id);
        else if (cur.kind === 'overlay') onToggleOverlayVisible(cur.id);
        break;
      }
      case 'l':
      case 'L': {
        const cur = layers[selectedIndex];
        if (cur.kind === 'slot') onToggleSlotLocked(cur.id);
        else if (cur.kind === 'overlay') onToggleOverlayLocked(cur.id);
        break;
      }
      case 'f':
      case 'F':
        onBringToFront(layers[selectedIndex].id);
        break;
      case 'b':
      case 'B':
        onSendToBack(layers[selectedIndex].id);
        break;
      case 'Delete':
      case 'Backspace':
        // Deletion handled by parent — just clear selection signal
        onClearSelection();
        break;
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <Stack gap={0} style={{ width: 220, minWidth: 220 }}>
      <Text
        size="xs"
        fw={600}
        px={6}
        py={4}
        style={{
          borderBottom: '1px solid var(--mantine-color-gray-2)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--mantine-color-gray-6)',
        }}
      >
        Layers
      </Text>

      <ScrollArea.Autosize
        mah={460}
        scrollbarSize={4}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        <Stack gap={0} py={4}>
          {layers.map((item) => {
            const isBackground = item.kind === 'background';
            const isSelected =
              (item.kind === 'slot' && item.id === selectedSlotId) ||
              (item.kind === 'overlay' && item.id === selectedOverlayId) ||
              (item.kind === 'background' && !!isBackgroundSelected);
            return (
              <LayerRow
                key={item.id}
                item={item}
                template={template}
                isSelected={isSelected}
                onSelect={() => {
                  if (isBackground) onSelectBackground?.();
                  else if (item.kind === 'overlay') onSelectOverlay(item.id);
                  else onSelectSlot(item.id);
                }}
                onRename={(id, name) => {
                  if (item.kind === 'slot') onRenameSlot(id, name);
                  else if (item.kind === 'overlay') onRenameOverlay(id, name);
                }}
                onToggleVisible={(id) => {
                  if (item.kind === 'slot') onToggleSlotVisible(id);
                  else if (item.kind === 'overlay') onToggleOverlayVisible(id);
                }}
                onToggleLocked={(id) => {
                  if (item.kind === 'slot') onToggleSlotLocked(id);
                  else if (item.kind === 'overlay') onToggleOverlayLocked(id);
                }}
                onBringToFront={onBringToFront}
                onSendToBack={onSendToBack}
                onBringForward={onBringForward}
                onSendBackward={onSendBackward}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
