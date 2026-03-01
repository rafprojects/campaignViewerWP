import { ConfirmModal } from '@/components/shared/ConfirmModal';
import type { MediaItem } from '@/types';

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
  const baseMessage =
    'Are you sure you want to delete this media item? This action cannot be undone.';
  const usageWarning =
    usageCount > 0
      ? ` This item is also used in ${usageCount} other campaign${usageCount === 1 ? '' : 's'} — removing it here only affects the current campaign.`
      : '';

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Media"
      message={baseMessage + usageWarning}
      confirmLabel="Delete"
      confirmColor="red"
      confirmAriaLabel={`Delete media ${deleteItem?.caption || deleteItem?.url || ''}`.trim()}
    />
  );
}

