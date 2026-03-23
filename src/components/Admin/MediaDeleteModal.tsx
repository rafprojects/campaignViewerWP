import { ConfirmModal } from '@/components/Common/ConfirmModal';
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
    'Remove this item from the campaign? The file stays in your media library and can be added to other campaigns.';
  const usageWarning =
    usageCount > 0
      ? ` It is currently used in ${usageCount} other campaign${usageCount === 1 ? '' : 's'} — those associations are not affected.`
      : '';

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Remove from Campaign"
      message={baseMessage + usageWarning}
      confirmLabel="Remove"
      confirmColor="red"
      confirmAriaLabel={`Remove media ${deleteItem?.caption || deleteItem?.url || ''}`.trim()}
    />
  );
}

