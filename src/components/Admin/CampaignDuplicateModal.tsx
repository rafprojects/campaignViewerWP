import { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  TextInput,
  Text,
  Switch,
  Divider,
} from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { AdminCampaign } from '@/services/adminQuery';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface CampaignDuplicateModalProps {
  /** Source campaign to duplicate; null when modal is closed. */
  source: AdminCampaign | null;
  isSaving: boolean;
  onConfirm: (name: string, copyMedia: boolean, duplicateLayoutTemplate: boolean) => void;
  onClose: () => void;
}

interface CampaignDuplicateModalOptionsProps {
  source: AdminCampaign | null;
  name: string;
  setName: (value: string) => void;
  copyMedia: boolean;
  setCopyMedia: (value: boolean) => void;
  duplicateLayoutTemplate: boolean;
  setDuplicateLayoutTemplate: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
}

function CampaignDuplicateModalOptions({
  source,
  name,
  setName,
  copyMedia,
  setCopyMedia,
  duplicateLayoutTemplate,
  setDuplicateLayoutTemplate,
  onClose,
  onConfirm,
  isSaving,
}: CampaignDuplicateModalOptionsProps) {
  const { t } = useTranslation('wpsg');
  return (
    <Stack {...getWpsgDebugProps('CampaignDuplicateModal', 'stack')} gap="md">
      <div>
        <Text size="sm" c="dimmed" mb={4}>
          {t('admin_dup_source_label', 'Source:')}
        </Text>
        <Text fw={600}>{source?.title}</Text>
      </div>

      <TextInput
        label={t('admin_dup_new_name', 'New name')}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder={t('admin_dup_name_placeholder', 'Campaign name')}
        data-autofocus
        required
      />

      <Divider />

      <Stack gap="xs">
        <Switch
          label={t('admin_dup_copy_media', 'Copy media associations')}
          description={t('admin_dup_copy_media_desc', 'Media items will appear in both campaigns')}
          checked={copyMedia}
          onChange={(e) => setCopyMedia(e.currentTarget.checked)}
        />
        {!copyMedia && (
          <Text size="xs" c="dimmed">
            {t('admin_dup_empty_media', 'The duplicate will start with an empty media library.')}
          </Text>
        )}
        {source?.layoutTemplateId && (
          <>
            <Switch
              label={t('admin_dup_layout', 'Duplicate linked layout template')}
              description={t('admin_dup_layout_desc', 'The copied campaign gets its own editable layout instead of sharing the original template.')}
              checked={duplicateLayoutTemplate}
              onChange={(e) => setDuplicateLayoutTemplate(e.currentTarget.checked)}
            />
            {!duplicateLayoutTemplate && (
              <Text size="xs" c="dimmed">
                {t('admin_dup_layout_keep', 'The duplicate will keep pointing at the original layout template.')}
              </Text>
            )}
          </>
        )}
      </Stack>

      <Group {...getWpsgDebugProps('CampaignDuplicateModal', 'actions')} justify="flex-end" mt="xs">
        <Button variant="subtle" onClick={onClose} disabled={isSaving}>
          {t('admin_cancel', 'Cancel')}
        </Button>
        <Button
          leftSection={<IconCopy size={16} />}
          onClick={onConfirm}
          loading={isSaving}
          disabled={!name.trim()}
        >
          {t('admin_duplicate', 'Duplicate')}
        </Button>
      </Group>
    </Stack>
  );
}

setWpsgDebugDisplayName(CampaignDuplicateModalOptions, 'AdminPanel:CampaignDuplicateModalOptions');

export function CampaignDuplicateModal({
  source,
  isSaving,
  onConfirm,
  onClose,
}: CampaignDuplicateModalProps) {
  const { t } = useTranslation('wpsg');
  const [name, setName] = useState('');
  const [copyMedia, setCopyMedia] = useState(true);
  const [duplicateLayoutTemplate, setDuplicateLayoutTemplate] = useState(false);

  // Reset state whenever a new source is shown
  useEffect(() => {
    if (source) {
      setName(t('admin_dup_copy_suffix', '{{title}} (Copy)', { title: source.title }));
      setCopyMedia(true);
      setDuplicateLayoutTemplate(Boolean(source.layoutTemplateId));
    }
  }, [source, t]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, copyMedia, duplicateLayoutTemplate);
  };

  return (
    <Modal
      {...getWpsgDebugProps('CampaignDuplicateModal')}
      opened={source !== null}
      onClose={onClose}
      title={<span {...getWpsgDebugProps('CampaignDuplicateModal', 'title')}>{t('admin_dup_title', 'Duplicate Campaign')}</span>}
      size="sm"
      aria-label={t('admin_dup_aria', 'Duplicate campaign')}
      closeButtonProps={getWpsgDebugProps('CampaignDuplicateModal', 'close')}
      overlayProps={getWpsgDebugProps('CampaignDuplicateModal', 'overlay')}
    >
      <CampaignDuplicateModalOptions
        source={source}
        name={name}
        setName={setName}
        copyMedia={copyMedia}
        setCopyMedia={setCopyMedia}
        duplicateLayoutTemplate={duplicateLayoutTemplate}
        setDuplicateLayoutTemplate={setDuplicateLayoutTemplate}
        onClose={onClose}
        onConfirm={handleConfirm}
        isSaving={isSaving}
      />
    </Modal>
  );
}

setWpsgDebugDisplayName(CampaignDuplicateModal, 'AdminPanel:CampaignDuplicateModal');