import { Button, Group, ScrollArea, Skeleton, Table, Text, TextInput } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CampaignSelector, type CampaignSelectItem } from '@/components/Common/CampaignSelector';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import type { AuditFilters } from '@/services/adminQuery';

function mergeFilter(base: AuditFilters, key: keyof AuditFilters, value: string): AuditFilters {
  const next = { ...base };
  if (value) {
    // The filter values are always free-text strings from input fields; narrower
    // union types on the interface are for the API boundary, not this setter.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next as any)[key] = value;
  } else {
    delete next[key];
  }
  return next;
}

function AuditSkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <Table.Tr key={i}>
          <Table.Td><Skeleton height={14} width={120} /></Table.Td>
          <Table.Td><Skeleton height={14} width="60%" /></Table.Td>
          <Table.Td><Skeleton height={14} width={50} /></Table.Td>
          <Table.Td><Skeleton height={14} width={60} /></Table.Td>
          <Table.Td><Skeleton height={14} width="40%" /></Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

setWpsgDebugDisplayName(AuditSkeletonRows, 'AdminPanel:AuditSkeletonRows');

interface AuditTabProps {
  campaignSelectData: CampaignSelectItem[];
  auditCampaignId: string;
  onAuditCampaignChange: (value: string | null) => void;
  auditLoading: boolean;
  auditEntriesCount: number;
  auditRows: ReactNode;
  /** P28-G: active filters */
  filters: AuditFilters;
  onFiltersChange: (filters: AuditFilters) => void;
  onExportCsv: () => void;
  onExportZip?: () => void;
  exportingZip?: boolean;
  auditError?: Error | null;
}

export function AuditTab({
  campaignSelectData,
  auditCampaignId,
  onAuditCampaignChange,
  auditLoading,
  auditEntriesCount,
  auditRows,
  filters,
  onFiltersChange,
  onExportCsv,
  onExportZip,
  exportingZip,
  auditError,
}: AuditTabProps) {
  const { t } = useTranslation('wpsg');
  return (
    <>
      <Text size="sm" fw={600} id="audit-heading" mb={2}>
        {t('admin_audit_heading', 'Campaign Activity')}
      </Text>
      <Text size="xs" c="dimmed" mb="xs">{t('admin_audit_subtitle', 'All activity recorded for the selected campaign.')}</Text>
      <Group mb="sm" wrap="wrap" gap="sm">
        <CampaignSelector
          data={campaignSelectData}
          value={auditCampaignId}
          onChange={(v) => onAuditCampaignChange(v)}
          style={{ minWidth: 200 }}
          aria-label={t('admin_audit_select_aria', 'Select campaign for audit log')}
        />
        <TextInput
          size="xs"
          placeholder={t('admin_audit_from_ph', 'From (YYYY-MM-DD)')}
          value={filters.from ?? ''}
          onChange={(e) => onFiltersChange(mergeFilter(filters, 'from', e.currentTarget.value))}
          aria-label={t('admin_audit_from_aria', 'Audit log from date')}
          style={{ width: 150 }}
        />
        <TextInput
          size="xs"
          placeholder={t('admin_audit_to_ph', 'To (YYYY-MM-DD)')}
          value={filters.to ?? ''}
          onChange={(e) => onFiltersChange(mergeFilter(filters, 'to', e.currentTarget.value))}
          aria-label={t('admin_audit_to_aria', 'Audit log to date')}
          style={{ width: 150 }}
        />
        <TextInput
          size="xs"
          placeholder={t('admin_audit_action_ph', 'Action filter')}
          value={filters.action ?? ''}
          onChange={(e) => onFiltersChange(mergeFilter(filters, 'action', e.currentTarget.value))}
          aria-label={t('admin_audit_action_aria', 'Audit log action filter')}
          style={{ width: 160 }}
        />
        <Button size="xs" variant="default" onClick={onExportCsv} aria-label={t('admin_audit_csv_aria', 'Export audit log as CSV')}>
          {t('admin_audit_csv', 'Export CSV')}
        </Button>
        {onExportZip && (
          <Button
            size="xs"
            variant="light"
            onClick={onExportZip}
            loading={exportingZip ?? false}
            aria-label={t('admin_audit_zip_aria', 'Export audit log as ZIP')}
          >
            {t('admin_audit_zip', 'Download ZIP')}
          </Button>
        )}
      </Group>
      {auditLoading ? (
        <Table.ScrollContainer minWidth={680}>
          <Table verticalSpacing="sm" aria-label={t('admin_audit_loading_aria', 'Loading audit entries')}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th miw={140}>{t('admin_audit_th_when', 'When')}</Table.Th>
                <Table.Th miw={200}>{t('admin_audit_th_summary', 'Summary')}</Table.Th>
                <Table.Th miw={70}>{t('admin_audit_th_severity', 'Severity')}</Table.Th>
                <Table.Th miw={80}>{t('admin_audit_th_actor', 'Actor')}</Table.Th>
                <Table.Th miw={160}>{t('admin_audit_th_details', 'Details')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody><AuditSkeletonRows /></Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : auditError ? (
        <Text c="red" role="alert" aria-live="assertive">{t('admin_audit_load_fail', 'Failed to load audit entries: {{message}}', { message: auditError.message })}</Text>
      ) : auditEntriesCount === 0 ? (
        <Text c="dimmed" role="status" aria-live="polite">{t('admin_audit_none', 'No audit entries yet.')}</Text>
      ) : (
        <ScrollArea
          offsetScrollbars
          type="always"
          scrollbars="y"
          className="wpsg-scrollarea"
          h={360}
        >
          <Table.ScrollContainer minWidth={680}>
            <Table verticalSpacing="sm" highlightOnHover aria-label={t('admin_audit_entries_aria', 'Audit entries')}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th miw={140}>{t('admin_audit_th_when', 'When')}</Table.Th>
                  <Table.Th miw={200}>{t('admin_audit_th_summary', 'Summary')}</Table.Th>
                  <Table.Th miw={70}>{t('admin_audit_th_severity', 'Severity')}</Table.Th>
                  <Table.Th miw={80}>{t('admin_audit_th_actor', 'Actor')}</Table.Th>
                  <Table.Th miw={160}>{t('admin_audit_th_details', 'Details')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{auditRows}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </ScrollArea>
      )}
    </>
  );
}

setWpsgDebugDisplayName(AuditTab, 'AdminPanel:AuditTab');
