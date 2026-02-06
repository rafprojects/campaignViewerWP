import { Button, Group, Modal, Stack, Text } from '@mantine/core';
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
    <Modal opened={opened} onClose={onClose} title="Delete Media" size="sm" padding="md">
      <Stack>
        <Text>Are you sure you want to delete this media item? This action cannot be undone.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button
            color="red"
            onClick={onConfirm}
            aria-label={`Delete media ${deleteItem?.caption || deleteItem?.url || ''}`.trim()}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
