import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

type CampaignSummary = {
  id: string;
  title: string;
};

interface AdminCampaignArchiveModalProps {
  opened: boolean;
  campaign: CampaignSummary | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function AdminCampaignArchiveModal({
  opened,
  campaign,
  onClose,
  onConfirm,
}: AdminCampaignArchiveModalProps) {
  const { t } = useTranslation('wpsg');
  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t('admin_archive_campaign_title', 'Archive campaign')}
      message={t('admin_archive_campaign_msg', 'Archive this campaign? This action will mark it archived.')}
      confirmLabel={t('admin_archive', 'Archive')}
      confirmColor="red"
      confirmAriaLabel={t('admin_archive_campaign_aria', 'Archive campaign {{title}}', { title: campaign?.title ?? '' }).trim()}
    />
  );
}

setWpsgDebugDisplayName(AdminCampaignArchiveModal, 'AdminCampaignArchiveModal');