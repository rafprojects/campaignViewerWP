import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { Campaign } from '@/types';

interface ArchiveCampaignModalProps {
  opened: boolean;
  campaign: Campaign | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ArchiveCampaignModal({
  opened,
  campaign,
  onClose,
  onConfirm,
}: ArchiveCampaignModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Archive Campaign"
      zIndex={300}
      padding="md"
    >
      <Stack gap="md">
        <Text>
          Are you sure you want to archive &quot;{campaign?.title}&quot;? This action will mark it as archived.
        </Text>
        <Group justify="flex-end" wrap="wrap" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => void onConfirm()}
            aria-label={`Archive campaign ${campaign?.title ?? ''}`.trim()}
          >
            Archive
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
