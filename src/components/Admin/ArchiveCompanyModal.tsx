import { Alert, Box, Checkbox, ScrollArea, Stack, Text } from '@mantine/core';
import { Trans, useTranslation } from 'react-i18next';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

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
  const { t } = useTranslation('wpsg');
  const campaignsToArchive = (Array.isArray(company?.campaigns) ? company.campaigns : []).filter((c) => c.status !== 'archived');
  const activeCount = company?.activeCampaigns ?? 0;

  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t('admin_archco_title', 'Archive all company campaigns')}
      message={
        <Text>
          <Trans
            i18nKey="admin_archco_msg"
            count={activeCount}
            values={{ name: company?.name, count: activeCount }}
            components={{ strong: <strong /> }}
            defaults="Archive all campaigns for <strong>{{name}}</strong>? This will archive {{count}} active campaign."
          />
        </Text>
      }
      confirmLabel={t('admin_archco_confirm', 'Archive {{count}} Campaign', { count: activeCount })}
      confirmColor="red"
      confirmAriaLabel={t('admin_archco_confirm_aria', 'Archive {{count}} campaign for {{name}}', { count: activeCount, name: company?.name ?? t('admin_archco_company', 'company') })}
      loading={accessSaving}
    >
      {campaignsToArchive.length > 0 && (
        <Box {...getWpsgDebugProps('ArchiveCompanyModal', 'campaign-list')}>
          <Text size="sm" fw={500} mb="xs">{t('admin_archco_list_heading', 'Campaigns to be archived:')}</Text>
          <ScrollArea {...getWpsgDebugProps('ArchiveCompanyModal', 'campaign-scroll')} style={{ maxHeight: 150 }}>
            <Stack gap={4}>
              {campaignsToArchive.map((c) => (
                <Text key={c.id} size="sm" c="dimmed">• {c.title}</Text>
              ))}
            </Stack>
          </ScrollArea>
        </Box>
      )}

      <Checkbox
        {...getWpsgDebugProps('ArchiveCompanyModal', 'revoke-access')}
        label={t('admin_archco_revoke', 'Also revoke all company-level access grants')}
        checked={archiveRevokeAccess}
        onChange={(e) => onArchiveRevokeAccessChange(e.currentTarget.checked)}
      />

      <Alert {...getWpsgDebugProps('ArchiveCompanyModal', 'warning')} color="yellow" variant="light">
        <Text size="sm">{t('admin_archco_warning', 'Access grants for individual campaigns will be preserved but become inactive.')}</Text>
      </Alert>
    </ConfirmModal>
  );
}

setWpsgDebugDisplayName(ArchiveCompanyModal, 'AdminPanel:ArchiveCompanyModal');