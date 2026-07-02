import { useState, useEffect } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('wpsg');
  const [purgeAnalytics, setPurgeAnalytics] = useState(false);

  useEffect(() => {
    if (!opened) setPurgeAnalytics(false);
  }, [opened]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('admin_bulk_delete_title', 'Delete {{count}} campaign?', { count })}
      withinPortal={false}
      padding="md"
    >
      <Stack gap="sm">
        <Text>
          {t('admin_bulk_delete_msg', 'This will permanently delete all {{count}} selected campaigns, their media references, and pending access requests. This cannot be undone.', { count })}
        </Text>
        <Checkbox
          checked={purgeAnalytics}
          onChange={(e) => setPurgeAnalytics(e.currentTarget.checked)}
          label={t('admin_bulk_delete_purge', 'Also purge all analytics data for these campaigns')}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {t('admin_cancel', 'Cancel')}
          </Button>
          <Button
            color="red"
            loading={loading}
            disabled={loading}
            onClick={() => onConfirm({ purgeAnalytics })}
          >
            {t('admin_bulk_delete_confirm', 'Delete {{count}} campaign', { count })}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(AdminCampaignBulkDeleteModal, 'AdminCampaignBulkDeleteModal');
