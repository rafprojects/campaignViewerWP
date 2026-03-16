import {
  Select,
  Text,
  Accordion,
  Box,
} from '@mantine/core';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { MediaPickerSidebar } from './MediaPickerSidebar';
import { AssetUploader } from './AssetUploader';
import { DesignAssetsGrid } from './DesignAssetsGrid';

export function LayoutBuilderMediaPanel(_props: IDockviewPanelProps) {
  const {
    builder,
    media,
    campaigns,
    selectedCampaignId,
    setSelectedCampaignId,
    overlayLibrary,
    isUploadingOverlay,
    designAssetsOpen,
    setDesignAssetsOpen,
    handleUploadOverlay,
    handleDeleteLibraryOverlay,
    handleAutoAssign,
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
            <DesignAssetsGrid
              items={overlayLibrary ?? []}
              onDelete={handleDeleteLibraryOverlay}
              maxHeight={200}
            />
            <Box mt={8}>
              <AssetUploader
                onFileSelect={handleUploadOverlay}
                isUploading={isUploadingOverlay}
                accept="image/png,image/svg+xml,image/webp,image/gif"
                uploadLabel="Upload to library"
                uploadAriaLabel="Upload graphic layer to library"
              />
            </Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}
