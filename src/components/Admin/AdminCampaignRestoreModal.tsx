import { Button, Group, Modal, Text } from '@mantine/core';

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
  return (
    <Modal opened={opened} onClose={onClose} title="Restore campaign" padding="md">
      <Text>Restore this campaign? This will make it active again and enable any associated access grants.</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button
          color="teal"
          onClick={onConfirm}
          aria-label={`Restore campaign ${campaign?.title ?? ''}`.trim()}
        >
          Restore
        </Button>
      </Group>
    </Modal>
  );
}
