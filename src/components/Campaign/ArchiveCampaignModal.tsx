import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface ArchiveCampaignModalProps {
  opened: boolean;
  campaign: Campaign | null;
  onClose: () => void;
  onConfirm: () => void;
}

interface ArchiveCampaignModalContentProps {
  campaign: Campaign | null;
  onClose: () => void;
  onConfirm: () => void;
}

function ArchiveCampaignModalContent({ campaign, onClose, onConfirm }: ArchiveCampaignModalContentProps) {
  const { t } = useTranslation('wpsg');
  return (
    <Stack gap="md">
      <Text>
        {t('campmodal_archive_msg', 'Are you sure you want to archive "{{title}}"? This action will mark it as archived.', { title: campaign?.title ?? '' })}
      </Text>
      <Group justify="flex-end" wrap="wrap" gap="sm">
        <Button variant="default" onClick={onClose}>
          {t('admin_cancel', 'Cancel')}
        </Button>
        <Button
          color="red"
          onClick={() => void onConfirm()}
          aria-label={t('admin_archive_campaign_aria', 'Archive campaign {{title}}', { title: campaign?.title ?? '' }).trim()}
        >
          {t('admin_archive', 'Archive')}
        </Button>
      </Group>
    </Stack>
  );
}

setWpsgDebugDisplayName(ArchiveCampaignModalContent, 'ArchiveCampaignModalContent');

export function ArchiveCampaignModal({
  opened,
  campaign,
  onClose,
  onConfirm,
}: ArchiveCampaignModalProps) {
  const { t } = useTranslation('wpsg');
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('campmodal_archive_title', 'Archive Campaign')}
      zIndex={300}
      padding="md"
      withinPortal={false}
    >
      <ArchiveCampaignModalContent campaign={campaign} onClose={onClose} onConfirm={onConfirm} />
    </Modal>
  );
}

setWpsgDebugDisplayName(ArchiveCampaignModal, 'ArchiveCampaignModal');