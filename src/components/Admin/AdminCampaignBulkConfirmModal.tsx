import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

type BulkCampaignAction = 'archive' | 'restore';

const ACTION_CONFIG: Record<BulkCampaignAction, {
  title: (label: string) => string;
  message: (count: number) => string;
  confirmLabel: (label: string) => string;
  confirmColor: string;
}> = {
  archive: {
    title: (label) => `Archive ${label}?`,
    message: (count) => `This will mark all ${count} selected campaigns as archived. Archived campaigns are hidden from the gallery but can be restored at any time.`,
    confirmLabel: (label) => `Archive ${label}`,
    confirmColor: 'orange',
  },
  restore: {
    title: (label) => `Restore ${label}?`,
    message: (count) => `This will restore all ${count} selected campaigns and make them active again. Any associated access grants will be re-enabled.`,
    confirmLabel: (label) => `Restore ${label}`,
    confirmColor: 'teal',
  },
};

interface AdminCampaignBulkConfirmModalProps {
  opened: boolean;
  action: BulkCampaignAction;
  count: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function AdminCampaignBulkConfirmModal({
  opened,
  action,
  count,
  loading = false,
  onClose,
  onConfirm,
}: AdminCampaignBulkConfirmModalProps) {
  const label = `${count} campaign${count !== 1 ? 's' : ''}`;
  const config = ACTION_CONFIG[action];

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title={config.title(label)}
      message={config.message(count)}
      confirmLabel={config.confirmLabel(label)}
      confirmColor={config.confirmColor}
      loading={loading}
    />
  );
}

setWpsgDebugDisplayName(AdminCampaignBulkConfirmModal, 'AdminCampaignBulkConfirmModal');
