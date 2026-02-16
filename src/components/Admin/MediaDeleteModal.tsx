import { ConfirmModal } from '@/components/shared/ConfirmModal';
import type { MediaItem } from '@/types';

interface MediaDeleteModalProps {
  opened: boolean;
  onClose: () => void;
  deleteItem: MediaItem | null;
  onConfirm: () => void;
}

export function MediaDeleteModal({
  opened,
  onClose,
  deleteItem,
  onConfirm,
}: MediaDeleteModalProps) {
  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Media"
      message="Are you sure you want to delete this media item? This action cannot be undone."
      confirmLabel="Delete"
      confirmColor="red"
      confirmAriaLabel={`Delete media ${deleteItem?.caption || deleteItem?.url || ''}`.trim()}
    />
  );
}
