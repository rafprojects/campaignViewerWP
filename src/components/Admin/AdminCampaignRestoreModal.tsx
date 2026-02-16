import { ConfirmModal } from '@/components/shared/ConfirmModal';

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
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Restore campaign"
      message="Restore this campaign? This will make it active again and enable any associated access grants."
      confirmLabel="Restore"
      confirmColor="teal"
      confirmAriaLabel={`Restore campaign ${campaign?.title ?? ''}`.trim()}
    />
  );
}
