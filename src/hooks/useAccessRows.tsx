import { useMemo } from 'react';
import { Table, Text, Stack, Tooltip, Badge, ActionIcon, Group } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { CompanyAccessGrant as CompanyAccessGrantType } from '@/services/adminQuery';
import type { CampaignAccessLevel } from '@/types';
import type { AccessViewMode } from '@/hooks/useAdminAccessState';

interface Options {
  accessEntries: CompanyAccessGrantType[];
  accessViewMode: AccessViewMode;
  onRevokeAccess: (entry: CompanyAccessGrantType) => Promise<void>;
}

// P33-D: visual config for each role level.
const ROLE_BADGE_CONFIG: Record<CampaignAccessLevel, { label: string; color: string; tip: string }> = {
  viewer: { label: '👁 Viewer',  color: 'gray',   tip: 'Can read campaign content only' },
  editor: { label: '✏️ Editor',  color: 'teal',   tip: 'Can edit metadata and media; cannot manage access or builder' },
  owner:  { label: '👑 Owner',   color: 'violet', tip: 'Full campaign control including access management and builder' },
};

export function useAccessRows({ accessEntries, accessViewMode, onRevokeAccess }: Options) {
  return useMemo(() => {
    return accessEntries.map((a) => {
      const isExpired = a.is_expired === true;
      // P33-D: normalise access_level — server always sends one, but guard for legacy data.
      const level = (a.access_level ?? 'viewer') as CampaignAccessLevel;
      const roleCfg = ROLE_BADGE_CONFIG[level] ?? ROLE_BADGE_CONFIG.viewer;

      return (
        <Table.Tr
          key={`${a.userId}-${a.source}-${a.campaignId || 'company'}`}
          style={{
            ...(a.source === 'company' ? { backgroundColor: 'color-mix(in srgb, var(--wpsg-color-primary) 5%, transparent)' } : {}),
            ...(isExpired ? { opacity: 0.55 } : {}),
          }}
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
              {isExpired && (
                <Badge variant="light" color="gray" size="xs">Expired</Badge>
              )}
              {accessViewMode === 'all' && a.source === 'campaign' && a.campaignTitle && (
                <Text size="xs" c="dimmed">{a.campaignTitle}</Text>
              )}
            </Stack>
          </Table.Td>
          {/* P33-D: role badge column */}
          <Table.Td>
            <Group gap="xs" wrap="nowrap">
              <Tooltip label={roleCfg.tip} withArrow>
                <Badge
                  variant="light"
                  color={roleCfg.color}
                  size="sm"
                  aria-label={`Role: ${level}`}
                >
                  {roleCfg.label}
                </Badge>
              </Tooltip>
            </Group>
          </Table.Td>
          <Table.Td>
            <Stack gap={2}>
              <Text size="xs">{a.grantedAt ? new Date(a.grantedAt).toLocaleString() : '—'}</Text>
              {a.expires_at && (
                <Tooltip label={isExpired ? 'This grant has expired' : 'Grant expires at this time'}>
                  <Text size="xs" c={isExpired ? 'red' : 'dimmed'}>
                    Expires: {new Date(a.expires_at).toLocaleString()}
                  </Text>
                </Tooltip>
              )}
            </Stack>
          </Table.Td>
          <Table.Td>
            <Tooltip label={a.source === 'company' ? 'Revoke company-wide access' : 'Revoke campaign access'}>
              <ActionIcon color="red" variant="light" size="lg" onClick={() => void onRevokeAccess(a)} aria-label="Revoke access">
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Table.Td>
        </Table.Tr>
      );
    });
  }, [accessEntries, accessViewMode, onRevokeAccess]);
}
