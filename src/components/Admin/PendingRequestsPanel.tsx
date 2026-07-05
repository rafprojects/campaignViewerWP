import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';
import { useAccessRequests } from '@/services/adminQuery';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface PendingRequestsPanelProps {
  campaignId: string;
  apiClient: ApiClient;
  onMutate?: () => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function PendingRequestsPanel({ campaignId, apiClient, onMutate }: PendingRequestsPanelProps) {
  const { t } = useTranslation('wpsg');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: requests, isLoading, refetch } = useAccessRequests(apiClient, campaignId);

  const safeRequests = Array.isArray(requests) ? requests : [];
  const pendingRequests = safeRequests.filter((r) => r.status === 'pending');
  const resolvedRequests = safeRequests.filter((r) => r.status !== 'pending');

  const handleApprove = async (token: string) => {
    setActionLoading(token);
    setActionError(null);
    try {
      await apiClient.approveAccessRequest(campaignId, token);
      await refetch();
      onMutate?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('admin_req_approve_fail', 'Failed to approve request'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (token: string) => {
    setActionLoading(token);
    setActionError(null);
    try {
      await apiClient.denyAccessRequest(campaignId, token);
      await refetch();
      onMutate?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('admin_req_deny_fail', 'Failed to deny request'));
    } finally {
      setActionLoading(null);
    }
  };

  if (!campaignId) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        {t('admin_req_select_campaign', 'Select a campaign to see access requests.')}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Title order={6}>
          {t('admin_req_title', 'Access Requests')}
        </Title>
        {pendingRequests.length > 0 && (
          <Badge color="orange" variant="filled" size="sm">
            {t('admin_req_n_pending', '{{count}} pending', { count: pendingRequests.length })}
          </Badge>
        )}
      </Group>

      {actionError && (
        <Alert icon={<IconAlertCircle size={14} />} color="red" variant="light" onClose={() => setActionError(null)} withCloseButton>
          {actionError}
        </Alert>
      )}

      {isLoading ? (
        <Box ta="center" py="md">
          <Loader size="sm" />
        </Box>
      ) : pendingRequests.length === 0 && resolvedRequests.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          {t('admin_req_none', 'No access requests for this campaign.')}
        </Text>
      ) : (
        <Stack gap="xs">
          {pendingRequests.length > 0 && (
            <>
              <Text size="xs" tt="uppercase" fw={600} c="orange.4">
                {t('admin_req_pending', 'Pending')}
              </Text>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('admin_req_th_email', 'Email')}</Table.Th>
                    <Table.Th>{t('admin_req_th_requested', 'Requested')}</Table.Th>
                    <Table.Th style={{ width: 160 }}>{t('admin_req_th_actions', 'Actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pendingRequests.map((req) => (
                    <Table.Tr key={req.token}>
                      <Table.Td>
                        <Text size="sm" style={{ wordBreak: 'break-all' }}>
                          {req.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {formatDate(req.requestedAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Button
                            size="xs"
                            color="green"
                            variant="filled"
                            leftSection={<IconCheck size={12} />}
                            loading={actionLoading === req.token}
                            disabled={!!actionLoading}
                            onClick={() => handleApprove(req.token)}
                          >
                            {t('admin_req_approve', 'Approve')}
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            leftSection={<IconX size={12} />}
                            loading={actionLoading === req.token}
                            disabled={!!actionLoading}
                            onClick={() => handleDeny(req.token)}
                          >
                            {t('admin_req_deny', 'Deny')}
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}

          {resolvedRequests.length > 0 && (
            <>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed" mt="xs">
                {t('admin_req_resolved', 'Resolved')}
              </Text>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('admin_req_th_email', 'Email')}</Table.Th>
                    <Table.Th>{t('admin_req_th_status', 'Status')}</Table.Th>
                    <Table.Th>{t('admin_req_th_resolved', 'Resolved')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {resolvedRequests.map((req) => (
                    <Table.Tr key={req.token}>
                      <Table.Td>
                        <Text size="sm" style={{ wordBreak: 'break-all' }}>
                          {req.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={req.status === 'approved' ? 'green' : 'red'}
                          variant="light"
                          size="sm"
                        >
                          {t(`admin_req_status_${req.status}`, req.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {req.resolvedAt ? formatDate(req.resolvedAt) : '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(PendingRequestsPanel, 'AdminPanel:PendingRequestsPanel');