import { Button, Group, ScrollArea, Skeleton, Table, Text, TextInput } from '@mantine/core';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import type { AuditEntry, AuditFilters } from '@/services/adminQuery';
import { AuditEventRow } from './AuditEventRow';

type GlobalFilters = AuditFilters & { campaignId?: string };

function mergeGlobalFilter(base: GlobalFilters, key: keyof GlobalFilters, value: string): GlobalFilters {
  const next = { ...base };
  if (value) {
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
          <Table.Td><Skeleton height={14} width="50%" /></Table.Td>
          <Table.Td><Skeleton height={14} width={50} /></Table.Td>
          <Table.Td><Skeleton height={14} width={80} /></Table.Td>
          <Table.Td><Skeleton height={14} width={60} /></Table.Td>
          <Table.Td><Skeleton height={14} width="30%" /></Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

interface GlobalAuditTabProps {
  entries: AuditEntry[];
  loading: boolean;
  filters: AuditFilters & { campaignId?: string };
  onFiltersChange: (f: AuditFilters & { campaignId?: string }) => void;
  onExportCsv: () => void;
  onExportZip?: () => void;
  exportingZip?: boolean;
}

export function GlobalAuditTab({ entries, loading, filters, onFiltersChange, onExportCsv, onExportZip, exportingZip }: GlobalAuditTabProps) {
  const { t } = useTranslation('wpsg');
  const rows: ReactNode = useMemo(
    () => entries.map((e) => <AuditEventRow key={e.id} entry={e} showCampaignCol />),
    [entries],
  );

  return (
    <>
      <Text size="sm" fw={600} id="global-audit-heading" mb={2}>
        {t('admin_gaudit_heading', 'System Audit')}
      </Text>
      <Text size="xs" c="dimmed" mb="xs">{t('admin_gaudit_subtitle', 'Cross-campaign and plugin-wide admin events.')}</Text>
      <Group mb="sm" wrap="wrap" gap="sm">
        <TextInput
          size="xs"
          placeholder={t('admin_gaudit_campaign_id_ph', 'Campaign ID')}
          value={filters.campaignId ?? ''}
          onChange={(e) => onFiltersChange(mergeGlobalFilter(filters, 'campaignId', e.currentTarget.value))}
          aria-label={t('admin_gaudit_campaign_id_aria', 'Filter by campaign ID')}
          style={{ width: 130 }}
        />
        <TextInput
          size="xs"
          placeholder={t('admin_audit_from_ph', 'From (YYYY-MM-DD)')}
          value={filters.from ?? ''}
          onChange={(e) => onFiltersChange(mergeGlobalFilter(filters, 'from', e.currentTarget.value))}
          aria-label={t('admin_gaudit_from_aria', 'Global audit from date')}
          style={{ width: 150 }}
        />
        <TextInput
          size="xs"
          placeholder={t('admin_audit_to_ph', 'To (YYYY-MM-DD)')}
          value={filters.to ?? ''}
          onChange={(e) => onFiltersChange(mergeGlobalFilter(filters, 'to', e.currentTarget.value))}
          aria-label={t('admin_gaudit_to_aria', 'Global audit to date')}
          style={{ width: 150 }}
        />
        <TextInput
          size="xs"
          placeholder={t('admin_audit_action_ph', 'Action filter')}
          value={filters.action ?? ''}
          onChange={(e) => onFiltersChange(mergeGlobalFilter(filters, 'action', e.currentTarget.value))}
          aria-label={t('admin_gaudit_action_aria', 'Global audit action filter')}
          style={{ width: 160 }}
        />
        <Button size="xs" variant="default" onClick={onExportCsv} aria-label={t('admin_gaudit_csv_aria', 'Export global audit log as CSV')}>
          {t('admin_audit_csv', 'Export CSV')}
        </Button>
        {onExportZip && (
          <Button
            size="xs"
            variant="light"
            onClick={onExportZip}
            loading={exportingZip ?? false}
            aria-label={t('admin_gaudit_zip_aria', 'Export global audit log as ZIP')}
          >
            {t('admin_audit_zip', 'Download ZIP')}
          </Button>
        )}
      </Group>
      {loading ? (
        <Table.ScrollContainer minWidth={750}>
          <Table verticalSpacing="sm" aria-label={t('admin_gaudit_loading_aria', 'Loading system audit entries')}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th miw={140}>{t('admin_audit_th_when', 'When')}</Table.Th>
                <Table.Th miw={200}>{t('admin_audit_th_summary', 'Summary')}</Table.Th>
                <Table.Th miw={70}>{t('admin_audit_th_severity', 'Severity')}</Table.Th>
                <Table.Th miw={100}>{t('admin_gaudit_th_campaign', 'Campaign')}</Table.Th>
                <Table.Th miw={80}>{t('admin_audit_th_actor', 'Actor')}</Table.Th>
                <Table.Th miw={160}>{t('admin_audit_th_details', 'Details')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody><AuditSkeletonRows /></Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : entries.length === 0 ? (
        <Text c="dimmed" role="status" aria-live="polite">{t('admin_gaudit_none', 'No audit entries found.')}</Text>
      ) : (
        <ScrollArea offsetScrollbars type="always" scrollbars="y" className="wpsg-scrollarea" h={400}>
          <Table.ScrollContainer minWidth={750}>
            <Table verticalSpacing="sm" highlightOnHover aria-label={t('admin_gaudit_entries_aria', 'System audit entries')}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th miw={140}>{t('admin_audit_th_when', 'When')}</Table.Th>
                  <Table.Th miw={200}>{t('admin_audit_th_summary', 'Summary')}</Table.Th>
                  <Table.Th miw={70}>{t('admin_audit_th_severity', 'Severity')}</Table.Th>
                  <Table.Th miw={100}>{t('admin_gaudit_th_campaign', 'Campaign')}</Table.Th>
                  <Table.Th miw={80}>{t('admin_audit_th_actor', 'Actor')}</Table.Th>
                  <Table.Th miw={160}>{t('admin_audit_th_details', 'Details')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </ScrollArea>
      )}
    </>
  );
}

setWpsgDebugDisplayName(GlobalAuditTab, 'AdminPanel:GlobalAuditTab');
