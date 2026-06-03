import { Button, Group, ScrollArea, Skeleton, Table, Text, TextInput } from '@mantine/core';
import { useMemo, type ReactNode } from 'react';
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
}

export function GlobalAuditTab({ entries, loading, filters, onFiltersChange, onExportCsv }: GlobalAuditTabProps) {
  const rows: ReactNode = useMemo(
    () => entries.map((e) => <AuditEventRow key={e.id} entry={e} showCampaignCol />),
    [entries],
  );

  return (
    <>
      <Text size="sm" fw={600} id="global-audit-heading" mb={2}>
        System Audit
      </Text>
      <Text size="xs" c="dimmed" mb="xs">Cross-campaign and plugin-wide admin events.</Text>
      <Group mb="sm" wrap="wrap" gap="sm">
        <TextInput
          size="xs"
          placeholder="Campaign ID"
          value={filters.campaignId ?? ''}
          onChange={(e) => onFiltersChange(mergeGlobalFilter(filters, 'campaignId', e.currentTarget.value))}
          aria-label="Filter by campaign ID"
          style={{ width: 130 }}
        />
        <TextInput
          size="xs"
          placeholder="From (YYYY-MM-DD)"
          value={filters.from ?? ''}
          onChange={(e) => onFiltersChange(mergeGlobalFilter(filters, 'from', e.currentTarget.value))}
          aria-label="Global audit from date"
          style={{ width: 150 }}
        />
        <TextInput
          size="xs"
          placeholder="To (YYYY-MM-DD)"
          value={filters.to ?? ''}
          onChange={(e) => onFiltersChange(mergeGlobalFilter(filters, 'to', e.currentTarget.value))}
          aria-label="Global audit to date"
          style={{ width: 150 }}
        />
        <TextInput
          size="xs"
          placeholder="Action filter"
          value={filters.action ?? ''}
          onChange={(e) => onFiltersChange(mergeGlobalFilter(filters, 'action', e.currentTarget.value))}
          aria-label="Global audit action filter"
          style={{ width: 160 }}
        />
        <Button size="xs" variant="default" onClick={onExportCsv} aria-label="Export global audit log as CSV">
          Export CSV
        </Button>
      </Group>
      {loading ? (
        <Table.ScrollContainer minWidth={750}>
          <Table verticalSpacing="sm" aria-label="Loading system audit entries">
            <Table.Thead>
              <Table.Tr>
                <Table.Th miw={140}>When</Table.Th>
                <Table.Th miw={200}>Summary</Table.Th>
                <Table.Th miw={70}>Severity</Table.Th>
                <Table.Th miw={100}>Campaign</Table.Th>
                <Table.Th miw={80}>Actor</Table.Th>
                <Table.Th miw={160}>Details</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody><AuditSkeletonRows /></Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : entries.length === 0 ? (
        <Text c="dimmed" role="status" aria-live="polite">No audit entries found.</Text>
      ) : (
        <ScrollArea offsetScrollbars type="always" scrollbars="y" className="wpsg-scrollarea" h={400}>
          <Table.ScrollContainer minWidth={750}>
            <Table verticalSpacing="sm" highlightOnHover aria-label="System audit entries">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th miw={140}>When</Table.Th>
                  <Table.Th miw={200}>Summary</Table.Th>
                  <Table.Th miw={70}>Severity</Table.Th>
                  <Table.Th miw={100}>Campaign</Table.Th>
                  <Table.Th miw={80}>Actor</Table.Th>
                  <Table.Th miw={160}>Details</Table.Th>
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
