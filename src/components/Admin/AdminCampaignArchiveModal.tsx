import { Button, Group, Modal, Text } from '@mantine/core';

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
  return (
    <Modal opened={opened} onClose={onClose} title="Archive campaign" padding="md">
      <Text>Archive this campaign? This action will mark it archived.</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button
          color="red"
          onClick={onConfirm}
          aria-label={`Archive campaign ${campaign?.title ?? ''}`.trim()}
        >
          Archive
        </Button>
      </Group>
    </Modal>
  );
}
