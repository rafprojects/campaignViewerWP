/**
 * P15-J.2: Preset Template Gallery — "Start from Template" picker.
 *
 * Shows a visual grid of premade layout presets. Clicking a preset
 * creates a new template pre-populated with its slot definitions.
 */
import { Modal, SimpleGrid, Card, Text, Group, Badge, Box } from '@mantine/core';
import { IconLayoutDashboard } from '@tabler/icons-react';
import { LAYOUT_PRESETS, type LayoutPreset } from '@/data/layoutPresets';

// ── Props ────────────────────────────────────────────────────

export interface PresetGalleryModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called when the user selects a preset. */
  onSelect: (preset: LayoutPreset) => void;
}

// ── Mini-canvas preview ──────────────────────────────────────

function PresetPreview({ preset }: { preset: LayoutPreset }) {
  const previewW = 200;
  const previewH = previewW / preset.canvasAspectRatio;
  const scale = previewW / 100; // slots are 0–100 %

  return (
    <Box
      style={{
        width: previewW,
        height: previewH,
        position: 'relative',
        background: '#1a1a2e',
        borderRadius: 4,
        overflow: 'hidden',
        margin: '0 auto',
      }}
    >
      {preset.slots.map((slot, i) => (
        <div
          key={slot.id}
          style={{
            position: 'absolute',
            left: slot.x * scale,
            top: slot.y * (previewH / 100),
            width: slot.width * scale,
            height: slot.height * (previewH / 100),
            background: `hsl(${(i * 45 + 200) % 360}, 55%, 55%)`,
            opacity: 0.85,
            borderRadius: 2,
            zIndex: slot.zIndex,
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        />
      ))}
    </Box>
  );
}

// ── Component ────────────────────────────────────────────────

export function PresetGalleryModal({
  opened,
  onClose,
  onSelect,
}: PresetGalleryModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconLayoutDashboard size={20} />
          <Text fw={600}>Start from Template</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <Text size="sm" c="dimmed" mb="md">
        Choose a preset layout as your starting point. You can customize
        slots, shapes, and properties after creation.
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
        {LAYOUT_PRESETS.map((preset) => (
          <Card
            key={preset.name}
            shadow="sm"
            padding="sm"
            withBorder
            style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onClick={() => {
              onSelect(preset);
              onClose();
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = '';
              (e.currentTarget as HTMLElement).style.boxShadow = '';
            }}
          >
            <PresetPreview preset={preset} />
            <Text size="sm" fw={600} mt="xs" ta="center">
              {preset.name}
            </Text>
            <Text size="xs" c="dimmed" ta="center" lineClamp={2}>
              {preset.description}
            </Text>
            <Group gap={4} mt={4} justify="center">
              <Badge size="xs" variant="light">
                {preset.slots.length} slots
              </Badge>
              {preset.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} size="xs" variant="outline">
                  {tag}
                </Badge>
              ))}
            </Group>
          </Card>
        ))}
      </SimpleGrid>
    </Modal>
  );
}
