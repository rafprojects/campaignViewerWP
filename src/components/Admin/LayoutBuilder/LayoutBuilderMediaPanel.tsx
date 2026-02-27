import {
  Select,
  Text,
  Accordion,
  Box,
  Tooltip,
  ActionIcon,
  Group,
  Divider,
  Button,
  Stack,
  ColorInput,
  Slider,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { MediaPickerSidebar } from './MediaPickerSidebar';
import { AssetUploader } from './AssetUploader';

export function LayoutBuilderMediaPanel(_props: IDockviewPanelProps) {
  const {
    builder,
    media,
    campaigns,
    selectedCampaignId,
    setSelectedCampaignId,
    overlayLibrary,
    isUploadingOverlay,
    isUploadingBg,
    designAssetsOpen,
    setDesignAssetsOpen,
    bgSectionRef,
    handleUploadOverlay,
    handleAddUrlToLibrary,
    handleDeleteLibraryOverlay,
    handleUploadBgImage,
    handleAutoAssign,
    announce,
  } = useBuilderDock();

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 'var(--mantine-spacing-sm)',
      }}
    >
      <Select
        size="xs"
        mb="sm"
        placeholder="Choose a campaign…"
        value={selectedCampaignId}
        onChange={setSelectedCampaignId}
        data={(campaigns ?? []).map((c) => ({
          value: String(c.id),
          label: c.title,
        }))}
        clearable
        searchable
        aria-label="Select campaign for media"
      />
      <MediaPickerSidebar
        media={media}
        template={builder.template}
        selectedSlotIds={builder.selectedSlotIds}
        onAssignMedia={builder.assignMediaToSlot}
        onClearMedia={builder.clearSlotMedia}
        onAutoAssign={handleAutoAssign}
      />

      {/* ── Design Assets Accordion ── */}
      <Accordion
        value={designAssetsOpen ? 'design-assets' : null}
        onChange={(val) => {
          const next = val === 'design-assets';
          setDesignAssetsOpen(next);
          try {
            localStorage.setItem('wpsg_builder_design_assets_open', String(next));
          } catch { /* ignore */ }
        }}
        mt="sm"
      >
        <Accordion.Item value="design-assets">
          <Accordion.Control>Design Assets</Accordion.Control>
          <Accordion.Panel>
            {/* ── Graphic Layers section ── */}
            <Text size="xs" fw={500} mb={4}>Graphic Layers</Text>
            {(overlayLibrary ?? []).length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                {(overlayLibrary ?? []).map((item) => (
                  <Box
                    key={item.id}
                    style={{
                      border: '1px solid var(--mantine-color-default-border)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--mantine-color-dark-7)',
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                    <Group gap={2} p={2} wrap="nowrap">
                      <Tooltip label="Add to canvas">
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          style={{ flex: 1 }}
                          onClick={() => {
                            builder.addOverlay(item.url);
                            announce(`Graphic layer "${item.name}" added to canvas`);
                          }}
                          aria-label={`Add graphic layer ${item.name} to canvas`}
                        >
                          <IconPlus size={10} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete from library">
                        <ActionIcon
                          size="xs"
                          color="red"
                          variant="subtle"
                          onClick={() => handleDeleteLibraryOverlay(item.id)}
                          aria-label={`Delete graphic layer ${item.name} from library`}
                        >
                          <IconTrash size={10} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Box>
                ))}
              </div>
            ) : (
              <Text size="xs" c="dimmed" mb={8}>
                No graphic layers in library yet.
              </Text>
            )}
            <AssetUploader
              onFileSelect={handleUploadOverlay}
              onUrlSubmit={(url) => void handleAddUrlToLibrary(url)}
              isUploading={isUploadingOverlay}
              accept="image/png,image/svg+xml,image/webp,image/gif"
              uploadLabel="Upload to library"
              urlPlaceholder="Or paste image URL into library…"
              uploadAriaLabel="Upload graphic layer to library"
              urlAriaLabel="Graphic layer image URL"
            />

            {/* ── Background section ── */}
            <Divider my="sm" />
            <div ref={bgSectionRef}>
              <Text size="xs" fw={500} mb={4}>Background</Text>
            </div>
            <Stack gap="sm">
              <div>
                <Text size="xs" fw={500} mb={4}>Color</Text>
                <ColorInput
                  size="xs"
                  value={builder.template.backgroundColor}
                  onChange={builder.setBackgroundColor}
                  format="hex"
                  swatches={['#1a1a2e', '#0d1117', '#000000', '#ffffff', '#16213e', 'transparent']}
                />
              </div>

              <Divider />

              <Text size="xs" fw={500}>Background Image</Text>
              <Text size="xs" c="dimmed" mt={-6}>
                Layered on top of color (supports transparency)
              </Text>

              {builder.template.backgroundImage ? (
                <Box>
                  <div
                    style={{
                      background: 'var(--mantine-color-dark-7)',
                      height: 80,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      overflow: 'hidden',
                      marginBottom: 6,
                    }}
                  >
                    <img
                      src={builder.template.backgroundImage}
                      alt="Background preview"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    fullWidth
                    leftSection={<IconTrash size={12} />}
                    onClick={() => builder.setBackgroundImage('')}
                    mb={4}
                  >
                    Remove background image
                  </Button>
                </Box>
              ) : (
                <Text size="xs" c="dimmed">No background image set.</Text>
              )}

              <AssetUploader
                onFileSelect={handleUploadBgImage}
                onUrlSubmit={(url) => {
                  builder.setBackgroundImage(url);
                  announce('Background image set from URL');
                }}
                isUploading={isUploadingBg}
                accept="image/*"
                uploadLabel="Upload image"
                urlPlaceholder="Or paste image URL…"
                uploadAriaLabel="Upload background image"
                urlAriaLabel="Background image URL"
              />

              {builder.template.backgroundImage && (
                <>
                  <Select
                    size="xs"
                    label="Image fit"
                    value={builder.template.backgroundImageFit ?? 'cover'}
                    onChange={(val) =>
                      builder.setBackgroundImageFit(
                        (val ?? 'cover') as 'cover' | 'contain' | 'fill',
                      )
                    }
                    data={[
                      { value: 'cover', label: 'Cover (fill, crop)' },
                      { value: 'contain', label: 'Contain (letterbox)' },
                      { value: 'fill', label: 'Fill (stretch)' },
                    ]}
                  />
                  <div>
                    <Text size="xs" c="dimmed" mb={2}>Image opacity</Text>
                    <Slider
                      value={builder.template.backgroundImageOpacity ?? 1}
                      onChange={(val) => builder.setBackgroundImageOpacity(val)}
                      min={0}
                      max={1}
                      step={0.05}
                      size="xs"
                      label={(v) => `${Math.round(v * 100)}%`}
                    />
                  </div>
                </>
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}
