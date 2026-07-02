import { useEffect, useState } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('wpsg');
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
      title={t('admin_delete_campaign_title', 'Delete campaign')}
      withinPortal={false}
      padding="md"
    >
      <Stack gap="sm">
        <Text>
          {t('admin_delete_campaign_msg', 'This permanently deletes "{{title}}", its media references, and pending access requests. This cannot be undone.', { title: campaign?.title ?? t('admin_delete_this_campaign', 'this campaign') })}
        </Text>
        <Text size="sm" c="dimmed">
          {t('admin_delete_type_confirm', 'Type {{token}} to confirm.', { token: CONFIRM_TOKEN })}
        </Text>
        <TextInput
          value={typed}
          onChange={(e) => setTyped(e.currentTarget.value)}
          placeholder={CONFIRM_TOKEN}
          aria-label={t('admin_delete_type_aria', 'Type {{token}} to confirm', { token: CONFIRM_TOKEN })}
          autoFocus
        />
        <Checkbox
          checked={purgeAnalytics}
          onChange={(e) => setPurgeAnalytics(e.currentTarget.checked)}
          label={t('admin_delete_purge_analytics', 'Also purge analytics events for this campaign')}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>{t('admin_cancel', 'Cancel')}</Button>
          <Button
            color="red"
            disabled={!canDelete}
            loading={loading}
            onClick={() => onConfirm({ purgeAnalytics })}
            aria-label={t('admin_delete_campaign_aria', 'Delete campaign {{title}}', { title: campaign?.title ?? '' }).trim()}
          >
            {t('admin_delete_permanently', 'Delete permanently')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(AdminCampaignDeleteModal, 'AdminCampaignDeleteModal');
