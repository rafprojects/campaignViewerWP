import { Badge, Table, Text } from '@mantine/core';
import type { AuditEntry } from '@/services/adminQuery';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

const SEVERITY_COLORS = {
  info: 'blue',
  warning: 'orange',
  error: 'red',
} as const;

interface AuditEventRowProps {
  entry: AuditEntry;
  showCampaignCol?: boolean;
}

export function AuditEventRow({ entry, showCampaignCol = false }: AuditEventRowProps) {
  const summary = entry.summary || entry.action;
  const resource = entry.resourceLabel || entry.resourceType || '';
  const actor = entry.actorLogin || (entry.userId ? String(entry.userId) : '—');
  const severityColor = SEVERITY_COLORS[entry.severity ?? 'info'] ?? 'blue';

  return (
    <Table.Tr>
      <Table.Td>{new Date(entry.createdAt).toLocaleString()}</Table.Td>
      <Table.Td>
        <Text size="sm">{summary}</Text>
        {resource && <Text size="xs" c="dimmed">{resource}</Text>}
      </Table.Td>
      <Table.Td>
        <Badge color={severityColor} variant="light" size="xs">
          {entry.severity ?? 'info'}
        </Badge>
      </Table.Td>
      {showCampaignCol && (
        <Table.Td>
          <Text size="xs">{entry.campaignId ?? '—'}</Text>
        </Table.Td>
      )}
      <Table.Td>{actor}</Table.Td>
      <Table.Td>
        <Text size="xs" lineClamp={1}>
          {Object.keys(entry.details ?? {}).length > 0 ? JSON.stringify(entry.details) : '—'}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

setWpsgDebugDisplayName(AuditEventRow, 'AdminPanel:AuditEventRow');
