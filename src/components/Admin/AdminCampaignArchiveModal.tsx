import { ConfirmModal } from '@/components/shared/ConfirmModal';

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
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Archive campaign"
      message="Archive this campaign? This action will mark it archived."
      confirmLabel="Archive"
      confirmColor="red"
      confirmAriaLabel={`Archive campaign ${campaign?.title ?? ''}`.trim()}
    />
  );
}
