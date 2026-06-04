import { useState, useEffect } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface AdminCampaignBulkDeleteModalProps {
  opened: boolean;
  count: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (opts: { purgeAnalytics: boolean }) => void;
}

export function AdminCampaignBulkDeleteModal({
  opened,
  count,
  loading = false,
  onClose,
  onConfirm,
}: AdminCampaignBulkDeleteModalProps) {
  const [purgeAnalytics, setPurgeAnalytics] = useState(false);

  useEffect(() => {
    if (!opened) setPurgeAnalytics(false);
  }, [opened]);

  const label = `${count} campaign${count !== 1 ? 's' : ''}`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Delete ${label}?`}
      withinPortal={false}
      padding="md"
    >
      <Stack gap="sm">
        <Text>
          This will permanently delete all {count} selected campaigns, their media references,
          and pending access requests. This cannot be undone.
        </Text>
        <Checkbox
          checked={purgeAnalytics}
          onChange={(e) => setPurgeAnalytics(e.currentTarget.checked)}
          label="Also purge all analytics data for these campaigns"
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={loading}
            disabled={loading}
            onClick={() => onConfirm({ purgeAnalytics })}
          >
            Delete {label}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(AdminCampaignBulkDeleteModal, 'AdminCampaignBulkDeleteModal');
