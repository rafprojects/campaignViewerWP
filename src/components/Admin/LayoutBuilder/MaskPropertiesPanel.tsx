import { useRef, useState } from 'react';
import { ASSET_MIME } from './DesignAssetsGrid';
import {
  Stack,
  Text,
  NumberInput,
  Group,
  SegmentedControl,
  FileButton,
  Button,
  Loader,
  Box,
  Slider,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconUpload,
  IconFocusCentered,
  IconInfoCircle,
} from '@tabler/icons-react';
import type { LayoutSlot, MaskLayer } from '@/types';
import { DEFAULT_MASK_LAYER } from '@/types';
import type { OverlayLibraryItem } from './BuilderDockContext';
import { DesignAssetsGrid } from './DesignAssetsGrid';

// ── Props ────────────────────────────────────────────────────

export interface MaskPropertiesPanelProps {
  slot: LayoutSlot;
  onUpdate: (updates: Partial<LayoutSlot>) => void;
  /** Upload a mask image and return the URL (or null on failure). */
  onUploadMask?: (file: File) => Promise<string | null>;
  /** Available Design Assets for mask image selection. */
  overlayLibrary?: OverlayLibraryItem[];
}

// ── Inline helpers (shared with SlotPropertiesPanel) ─────────

function PropRow({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <Group gap={6} align="center" wrap="nowrap" style={{ minHeight: 28 }}>
      <Group gap={2} align="center" wrap="nowrap" style={{ width: 70, flexShrink: 0 }}>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{label}</Text>
        {tooltip && (
          <Tooltip label={tooltip} multiline w={240} position="left" withArrow>
            <ActionIcon size={14} variant="transparent" c="dimmed" aria-label={`${label} info`}>
              <IconInfoCircle size={12} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Box style={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Group>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Box
      mt={6}
      mb={2}
      pb={3}
      style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}
    >
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={0.8}>
        {label}
      </Text>
    </Box>
  );
}

// ── Component ────────────────────────────────────────────────

export function MaskPropertiesPanel({
  slot,
  onUpdate,
  onUploadMask,
  overlayLibrary,
}: MaskPropertiesPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const resetRef = useRef<() => void>(null);

  const hasMask = !!(slot.maskLayer || slot.maskUrl);
  const hasImage = !!(slot.maskLayer?.url || slot.maskUrl);

  // ── No mask layer at all — show add-mask prompt ──────────

  if (!hasMask) {
    return (
      <Stack gap={8} p={4}>
        <Text size="xs" c="dimmed">
          No mask layer on this slot. Add a mask from the Layers panel first.
        </Text>
      </Stack>
    );
  }

  // ── Active mask — full property controls ──────────────────

  const ml: MaskLayer = slot.maskLayer ?? {
    ...DEFAULT_MASK_LAYER,
    url: slot.maskUrl ?? '',
    mode: slot.maskMode ?? 'luminance',
  };

  const setMask = (patch: Partial<MaskLayer>) => {
    const next: MaskLayer = { ...ml, ...patch };
    onUpdate({
      maskLayer: next,
      maskUrl: next.url,
      maskMode: next.mode,
    });
  };

  // ── Drop-to-apply: drag a Design Asset onto the preview area ──
  const handlePanelDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(ASSET_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };
  const handlePanelDragLeave = () => setIsDragOver(false);
  const handlePanelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const url = e.dataTransfer.getData(ASSET_MIME);
    if (url) setMask({ url });
  };

  return (
    <Stack gap={4} p={4}>
      {/* Preview thumbnail / drop-zone */}
      <Box
        onDragOver={handlePanelDragOver}
        onDragLeave={handlePanelDragLeave}
        onDrop={handlePanelDrop}
        style={{
          height: 64,
          borderRadius: 4,
          background: hasImage
            ? `url(${ml.url}) center/contain no-repeat var(--mantine-color-dark-7)`
            : 'var(--mantine-color-dark-7)',
          border: isDragOver
            ? '2px dashed var(--mantine-color-violet-5)'
            : '1px solid var(--mantine-color-dark-5)',
          display: hasImage ? undefined : 'flex',
          alignItems: hasImage ? undefined : 'center',
          justifyContent: hasImage ? undefined : 'center',
          transition: 'border 120ms ease',
        }}
      >
        {!hasImage && (
          <Text size="xs" c="dimmed">No mask image — drag here or pick below</Text>
        )}
      </Box>

      {/* ── Mode ── */}
      <SectionHeader label="Mode" />
      <PropRow label="Type">
        <SegmentedControl
          size="xs"
          fullWidth
          data={[
            { label: 'Luminance', value: 'luminance' },
            { label: 'Alpha', value: 'alpha' },
          ]}
          value={ml.mode}
          onChange={(v) => setMask({ mode: v as 'luminance' | 'alpha' })}
        />
      </PropRow>

      {/* Position / Scale / Feather — only meaningful when an image is assigned */}
      {hasImage && (
        <>
          {/* ── Position ── */}
          <SectionHeader label="Position" />
          <Group grow gap={6}>
            <PropRow label="X %">
              <NumberInput
                value={ml.x}
                onChange={(v) => setMask({ x: Number(v) || 0 })}
                step={1}
                size="xs"
                variant="filled"
              />
            </PropRow>
            <PropRow label="Y %">
              <NumberInput
                value={ml.y}
                onChange={(v) => setMask({ y: Number(v) || 0 })}
                step={1}
                size="xs"
                variant="filled"
              />
            </PropRow>
          </Group>

          {/* ── Scale ── */}
          <SectionHeader label="Scale" />
          <Group grow gap={6}>
            <PropRow label="W %">
              <NumberInput
                value={ml.width}
                onChange={(v) => setMask({ width: Number(v) || 100 })}
                min={1}
                max={500}
                step={1}
                size="xs"
                variant="filled"
              />
            </PropRow>
            <PropRow label="H %">
              <NumberInput
                value={ml.height}
                onChange={(v) => setMask({ height: Number(v) || 100 })}
                min={1}
                max={500}
                step={1}
                size="xs"
                variant="filled"
              />
            </PropRow>
          </Group>

          {/* Auto-fit */}
          <Button
            size="xs"
            variant="light"
            fullWidth
            leftSection={<IconFocusCentered size={12} />}
            onClick={() => setMask({ x: 0, y: 0, width: 100, height: 100 })}
          >
            Auto-fit to slot
          </Button>

          {/* ── Feather ── */}
          <SectionHeader label="Feather" />
          <PropRow label="Radius" tooltip="Soften the mask edges. Higher values create a more gradual fade.">
            <Slider
              value={ml.feather}
              onChange={(v) => setMask({ feather: v })}
              min={0}
              max={50}
              step={1}
              size="xs"
              label={(v) => `${v}px`}
            />
          </PropRow>
        </>
      )}

      {/* ── Pick from Design Assets ── */}
      {(overlayLibrary ?? []).length > 0 && (
        <>
          <SectionHeader label="Design Assets" />
          <DesignAssetsGrid
            items={overlayLibrary ?? []}
            onSelect={(url) => setMask({ url })}
            activeUrl={ml.url}
            maxHeight={140}
          />
        </>
      )}

      {/* ── Image actions ── */}
      <SectionHeader label="Mask Image" />
      <Group gap={4} grow>
        {onUploadMask && (
          <FileButton
            accept="image/png,image/svg+xml"
            onChange={async (file) => {
              if (!file) return;
              setIsUploading(true);
              try {
                const url = await onUploadMask(file);
                if (url) setMask({ url });
              } finally {
                setIsUploading(false);
                resetRef.current?.();
              }
            }}
            resetRef={resetRef}
          >
            {(props) => (
              <Button
                size="xs"
                variant="light"
                leftSection={isUploading ? <Loader size={10} /> : <IconUpload size={12} />}
                disabled={isUploading}
                {...props}
              >
                {hasImage ? 'Replace' : 'Upload'}
              </Button>
            )}
          </FileButton>
        )}
        {hasImage && (
          <Button
            size="xs"
            variant="light"
            color="red"
            onClick={() => setMask({ url: '' })}
          >
            Clear image
          </Button>
        )}
      </Group>
      <Button
        size="xs"
        variant="subtle"
        color="red"
        fullWidth
        mt={4}
        onClick={() =>
          onUpdate({ maskLayer: undefined, maskUrl: undefined, maskMode: undefined })
        }
      >
        Remove mask layer
      </Button>
    </Stack>
  );
}
