import { useEffect, useState } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

type CampaignSummary = {
  id: string;
  title: string;
};

interface AdminCampaignDeleteModalProps {
  opened: boolean;
  campaign: CampaignSummary | null;
  onClose: () => void;
  onConfirm: (opts: { purgeAnalytics: boolean }) => void;
  loading?: boolean;
}

const CONFIRM_TOKEN = 'DELETE';

export function AdminCampaignDeleteModal({
  opened,
  campaign,
  onClose,
  onConfirm,
  loading = false,
}: AdminCampaignDeleteModalProps) {
  const [typed, setTyped] = useState('');
  const [purgeAnalytics, setPurgeAnalytics] = useState(false);

  useEffect(() => {
    if (!opened) {
      setTyped('');
      setPurgeAnalytics(false);
    }
  }, [opened]);

  const canDelete = typed.trim() === CONFIRM_TOKEN && !loading;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Delete campaign"
      withinPortal={false}
      padding="md"
    >
      <Stack gap="sm">
        <Text>
          This permanently deletes <strong>{campaign?.title ?? 'this campaign'}</strong>,
          its media references, and pending access requests.
          This cannot be undone.
        </Text>
        <Text size="sm" c="dimmed">
          Type <strong>{CONFIRM_TOKEN}</strong> to confirm.
        </Text>
        <TextInput
          value={typed}
          onChange={(e) => setTyped(e.currentTarget.value)}
          placeholder={CONFIRM_TOKEN}
          aria-label="Type DELETE to confirm"
          autoFocus
        />
        <Checkbox
          checked={purgeAnalytics}
          onChange={(e) => setPurgeAnalytics(e.currentTarget.checked)}
          label="Also purge analytics events for this campaign"
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            color="red"
            disabled={!canDelete}
            loading={loading}
            onClick={() => onConfirm({ purgeAnalytics })}
            aria-label={`Delete campaign ${campaign?.title ?? ''}`.trim()}
          >
            Delete permanently
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(AdminCampaignDeleteModal, 'AdminCampaignDeleteModal');
