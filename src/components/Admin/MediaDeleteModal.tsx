import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import type { MediaItem } from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface MediaDeleteModalProps {
  opened: boolean;
  onClose: () => void;
  deleteItem: MediaItem | null;
  onConfirm: () => void;
  /** Number of other campaigns that also reference this item. */
  usageCount?: number;
}

export function MediaDeleteModal({
  opened,
  onClose,
  deleteItem,
  onConfirm,
  usageCount = 0,
}: MediaDeleteModalProps) {
  const { t } = useTranslation('wpsg');
  const baseMessage = t('admin_media_del_msg', 'Remove this item from the campaign? The file stays in your media library and can be added to other campaigns.');
  const usageWarning =
    usageCount > 0
      ? t('admin_media_del_usage', ' It is currently used in {{count}} other campaign — those associations are not affected.', { count: usageCount })
      : '';

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t('admin_media_del_title', 'Remove from Campaign')}
      message={baseMessage + usageWarning}
      confirmLabel={t('admin_media_remove', 'Remove')}
      confirmColor="red"
      confirmAriaLabel={t('admin_media_remove_aria', 'Remove media {{label}}', { label: deleteItem?.caption || deleteItem?.url || '' }).trim()}
    />
  );
}

setWpsgDebugDisplayName(MediaDeleteModal, 'AdminPanel:MediaDeleteModal');
