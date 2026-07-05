import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

type BulkCampaignAction = 'archive' | 'restore';

interface AdminCampaignBulkConfirmModalProps {
  opened: boolean;
  action: BulkCampaignAction;
  count: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function AdminCampaignBulkConfirmModal({
  opened,
  action,
  count,
  loading = false,
  onClose,
  onConfirm,
}: AdminCampaignBulkConfirmModalProps) {
  const { t } = useTranslation('wpsg');

  const title = action === 'archive'
    ? t('admin_bulk_archive_title', 'Archive {{count}} campaign?', { count })
    : t('admin_bulk_restore_title', 'Restore {{count}} campaign?', { count });
  const message = action === 'archive'
    ? t('admin_bulk_archive_msg', 'This will mark all {{count}} selected campaigns as archived. Archived campaigns are hidden from the gallery but can be restored at any time.', { count })
    : t('admin_bulk_restore_msg', 'This will restore all {{count}} selected campaigns and make them active again. Any associated access grants will be re-enabled.', { count });
  const confirmLabel = action === 'archive'
    ? t('admin_bulk_archive_confirm', 'Archive {{count}} campaign', { count })
    : t('admin_bulk_restore_confirm', 'Restore {{count}} campaign', { count });

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      confirmColor={action === 'archive' ? 'orange' : 'teal'}
      loading={loading}
    />
  );
}

setWpsgDebugDisplayName(AdminCampaignBulkConfirmModal, 'AdminCampaignBulkConfirmModal');
