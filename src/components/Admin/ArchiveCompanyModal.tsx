import { Alert, Box, Checkbox, ScrollArea, Stack, Text } from '@mantine/core';
import { ConfirmModal } from '@/components/shared/ConfirmModal';

type CompanyCampaign = { id: number; title: string; status: string };

type CompanySummary = {
  id: number;
  name: string;
  activeCampaigns: number;
  campaigns: CompanyCampaign[];
};

interface ArchiveCompanyModalProps {
  opened: boolean;
  company: CompanySummary | null;
  archiveRevokeAccess: boolean;
  onArchiveRevokeAccessChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  accessSaving: boolean;
}

export function ArchiveCompanyModal({
  opened,
  company,
  archiveRevokeAccess,
  onArchiveRevokeAccessChange,
  onClose,
  onConfirm,
  accessSaving,
}: ArchiveCompanyModalProps) {
  const campaignsToArchive = company?.campaigns.filter((c) => c.status !== 'archived') ?? [];

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Archive all company campaigns"
      message={
        <Text>
          Archive all campaigns for <strong>{company?.name}</strong>?{' '}
          This will archive {company?.activeCampaigns} active campaign{company?.activeCampaigns !== 1 ? 's' : ''}.
        </Text>
      }
      confirmLabel={`Archive ${company?.activeCampaigns} Campaign${company?.activeCampaigns !== 1 ? 's' : ''}`}
      confirmColor="red"
      confirmAriaLabel={`Archive ${company?.activeCampaigns ?? 0} campaign${company?.activeCampaigns === 1 ? '' : 's'} for ${company?.name ?? 'company'}`}
      loading={accessSaving}
    >
      {campaignsToArchive.length > 0 && (
        <Box>
          <Text size="sm" fw={500} mb="xs">Campaigns to be archived:</Text>
          <ScrollArea style={{ maxHeight: 150 }}>
            <Stack gap={4}>
              {campaignsToArchive.map((c) => (
                <Text key={c.id} size="sm" c="dimmed">• {c.title}</Text>
              ))}
            </Stack>
          </ScrollArea>
        </Box>
      )}

      <Checkbox
        label="Also revoke all company-level access grants"
        checked={archiveRevokeAccess}
        onChange={(e) => onArchiveRevokeAccessChange(e.currentTarget.checked)}
      />

      <Alert color="yellow" variant="light">
        <Text size="sm">Access grants for individual campaigns will be preserved but become inactive.</Text>
      </Alert>
    </ConfirmModal>
  );
}
