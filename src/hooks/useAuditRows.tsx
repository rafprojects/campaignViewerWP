import { useMemo } from 'react';
import { Table, Text } from '@mantine/core';
import type { AuditEntry } from '@/hooks/useAdminSWR';

export function useAuditRows(auditEntries: AuditEntry[]) {
  return useMemo(() => {
    return auditEntries
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((e) => (
        <Table.Tr key={e.id}>
          <Table.Td>{new Date(e.createdAt).toLocaleString()}</Table.Td>
          <Table.Td>
            <Text size="sm" style={{ wordBreak: 'break-all' }}>{e.action}</Text>
          </Table.Td>
          <Table.Td>{e.userId || '—'}</Table.Td>
          <Table.Td>
            <Text size="xs" lineClamp={1}>
              {Object.keys(e.details ?? {}).length > 0 ? JSON.stringify(e.details) : '—'}
            </Text>
          </Table.Td>
        </Table.Tr>
      ));
  }, [auditEntries]);
}
