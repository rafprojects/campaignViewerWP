import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

type CampaignSummary = {
  id: string;
  title: string;
};

interface AdminCampaignRestoreModalProps {
  opened: boolean;
  campaign: CampaignSummary | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function AdminCampaignRestoreModal({
  opened,
  campaign,
  onClose,
  onConfirm,
}: AdminCampaignRestoreModalProps) {
  const { t } = useTranslation('wpsg');
  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t('admin_restore_campaign_title', 'Restore campaign')}
      message={t('admin_restore_campaign_msg', 'Restore this campaign? This will make it active again and enable any associated access grants.')}
      confirmLabel={t('admin_restore', 'Restore')}
      confirmColor="teal"
      confirmAriaLabel={t('admin_restore_campaign_aria', 'Restore campaign {{title}}', { title: campaign?.title ?? '' }).trim()}
    />
  );
}

setWpsgDebugDisplayName(AdminCampaignRestoreModal, 'AdminCampaignRestoreModal');