import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  Text,
  Accordion,
  Box,
  Button,
  Group,
} from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { MediaPickerSidebar } from './MediaPickerSidebar';
import { DesignAssetsGrid } from './DesignAssetsGrid';
import { MediaUploadController, GENERAL_LIBRARY_TARGET } from '../MediaUploadController';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { useRootId } from '@wp-super-gallery/shared-ui';

export function LayoutBuilderMediaPanel(_props: IDockviewPanelProps) {
  const { t } = useTranslation('wpsg');
  const {
    builder,
    apiClient,
    media,
    campaigns,
    selectedCampaignId,
    setSelectedCampaignId,
    assetLibrary,
    designAssetsOpen,
    setDesignAssetsOpen,
    handleDeleteLibraryAsset,
    handleSetAssetUniversal,
    handleSetAssetTags,
    handleAutoAssign,
  } = useBuilderDock();
  const rootId = useRootId();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--mantine-spacing-sm)',
        background: 'var(--wpsg-builder-surface)',
        color: 'var(--wpsg-builder-text)',
        overflow: 'hidden',
      }}
    >
      <Select
        size="xs"
        mb="sm"
        placeholder={t('lb_mp_choose_campaign', 'Choose a campaign…')}
        value={selectedCampaignId}
        onChange={setSelectedCampaignId}
        data={(campaigns ?? []).map((c) => ({
          value: String(c.id),
          label: c.title,
        }))}
        clearable
        searchable
        aria-label={t('lb_mp_select_campaign_aria', 'Select campaign for media')}
      />

      {/* Always-visible primary entry point — never gated behind the accordion. */}
      <Button
        size="xs"
        variant="filled"
        leftSection={<IconUpload size={14} />}
        onClick={() => setUploadOpen(true)}
        fullWidth
        mb="sm"
      >
        {t('lb_mp_add_media', 'Add media')}
      </Button>

      {/* Campaign media list — flexes to fill remaining space, scrolls internally. */}
      <Box style={{ flex: 1, minHeight: 80, overflow: 'hidden' }}>
        <MediaPickerSidebar
          media={media}
          template={builder.template}
          selectedSlotIds={builder.selectedSlotIds}
          onAssignMedia={builder.assignMediaToSlot}
          onClearMedia={builder.clearSlotMedia}
          onAutoAssign={handleAutoAssign}
        />
      </Box>

      {/* ── Asset Library Accordion — pinned below the media list, always visible ── */}
      <Accordion
        value={designAssetsOpen ? 'asset-library' : null}
        onChange={(val) => {
          const next = val === 'asset-library';
          setDesignAssetsOpen(next);
          try {
            localStorage.setItem(`wpsg_builder_${rootId}_design_assets_open`, String(next));
          } catch { /* ignore */ }
        }}
        mt="sm"
        style={{ flexShrink: 0 }}
      >
        <Accordion.Item value="asset-library">
          <Accordion.Control>{t('lb_mp_asset_library', 'Asset Library')}</Accordion.Control>
          <Accordion.Panel>
            <Group justify="space-between" align="center" mb={6}>
              <Text size="xs" c="dimmed">
                {t('lb_mp_asset_desc', 'Decorative assets, shared across campaigns. Drag onto the canvas to place.')}
              </Text>
            </Group>
            <DesignAssetsGrid
              items={assetLibrary ?? []}
              onDelete={handleDeleteLibraryAsset}
              onSetUniversal={handleSetAssetUniversal}
              onSetTags={handleSetAssetTags}
              maxHeight={200}
            />
            <Box mt={8}>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconUpload size={14} />}
                onClick={() => setUploadOpen(true)}
                fullWidth
              >
                {t('lb_mp_upload_library', 'Upload to library')}
              </Button>
            </Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <MediaUploadController
        opened={uploadOpen}
        onClose={() => setUploadOpen(false)}
        apiClient={apiClient}
        campaigns={campaigns ?? []}
        defaultTarget={GENERAL_LIBRARY_TARGET}
        title={t('lb_mp_add_media', 'Add media')}
      />
    </div>
  );
}

setWpsgDebugDisplayName(LayoutBuilderMediaPanel, 'LayoutBuilder:LayoutBuilderMediaPanel');
