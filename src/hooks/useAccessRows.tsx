import { useMemo } from 'react';
import { Table, Text, Stack, Tooltip, Badge, ActionIcon } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { CompanyAccessGrant as CompanyAccessGrantType } from '@/hooks/useAdminSWR';
import type { AccessViewMode } from '@/hooks/useAdminAccessState';

interface Options {
  accessEntries: CompanyAccessGrantType[];
  accessViewMode: AccessViewMode;
  onRevokeAccess: (entry: CompanyAccessGrantType) => Promise<void>;
}

export function useAccessRows({ accessEntries, accessViewMode, onRevokeAccess }: Options) {
  return useMemo(() => {
    return accessEntries.map((a) => (
      <Table.Tr
        key={`${a.userId}-${a.source}-${a.campaignId || 'company'}`}
        style={a.source === 'company' ? { backgroundColor: 'color-mix(in srgb, var(--wpsg-color-primary) 5%, transparent)' } : undefined}
      >
        <Table.Td>
          {a.user ? (
            <Stack gap={2}>
              <Text size="sm" fw={500}>{a.user.displayName}</Text>
              <Text size="xs" c="dimmed">{a.user.email}</Text>
            </Stack>
          ) : (
            <Text size="sm">User #{a.userId}</Text>
          )}
        </Table.Td>
        <Table.Td>
          <Stack gap={2}>
            <Tooltip label={a.source === 'company' ? 'Company-wide access' : 'Direct campaign access'}>
              <Badge variant="light" color={a.source === 'company' ? 'blue' : 'green'}>
                {a.source === 'company' ? '🏢 Company' : '📋 Campaign'}
              </Badge>
            </Tooltip>
            {accessViewMode === 'all' && a.source === 'campaign' && a.campaignTitle && (
              <Text size="xs" c="dimmed">{a.campaignTitle}</Text>
            )}
          </Stack>
        </Table.Td>
        <Table.Td>{a.grantedAt ? new Date(a.grantedAt).toLocaleString() : '—'}</Table.Td>
        <Table.Td>
          <Tooltip label={a.source === 'company' ? 'Revoke company-wide access' : 'Revoke campaign access'}>
            <ActionIcon color="red" variant="light" size="lg" onClick={() => void onRevokeAccess(a)} aria-label="Revoke access">
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
      </Table.Tr>
    ));
  }, [accessEntries, accessViewMode, onRevokeAccess]);
}
