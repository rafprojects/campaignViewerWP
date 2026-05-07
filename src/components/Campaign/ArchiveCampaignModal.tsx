import { Button, Group, Modal, Stack, Text } from '@mantine/core';
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
  return (
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
  );
}

setWpsgDebugDisplayName(ArchiveCampaignModalContent, 'ArchiveCampaignModalContent');

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
      <ArchiveCampaignModalContent campaign={campaign} onClose={onClose} onConfirm={onConfirm} />
    </Modal>
  );
}

setWpsgDebugDisplayName(ArchiveCampaignModal, 'ArchiveCampaignModal');