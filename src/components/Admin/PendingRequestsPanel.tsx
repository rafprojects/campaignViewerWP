import { useState } from 'react';
import useSWR from 'swr';
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
import type { ApiClient, AccessRequest } from '@/services/apiClient';

interface PendingRequestsPanelProps {
  campaignId: string;
  apiClient: ApiClient;
  onMutate?: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function PendingRequestsPanel({ campaignId, apiClient, onMutate }: PendingRequestsPanelProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const swrKey = campaignId ? `access-requests-${campaignId}` : null;

  const {
    data: requests,
    isLoading,
    mutate,
  } = useSWR<AccessRequest[]>(
    swrKey,
    () => apiClient.listAccessRequests(campaignId),
    { revalidateOnFocus: false },
  );

  const pendingRequests = (requests ?? []).filter((r) => r.status === 'pending');
  const resolvedRequests = (requests ?? []).filter((r) => r.status !== 'pending');

  const handleApprove = async (token: string) => {
    setActionLoading(token);
    setActionError(null);
    try {
      await apiClient.approveAccessRequest(campaignId, token);
      await mutate();
      onMutate?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (token: string) => {
    setActionLoading(token);
    setActionError(null);
    try {
      await apiClient.denyAccessRequest(campaignId, token);
      await mutate();
      onMutate?.();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to deny request');
    } finally {
      setActionLoading(null);
    }
  };

  if (!campaignId) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        Select a campaign to see access requests.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Title order={6} c="gray.2">
          Access Requests
        </Title>
        {pendingRequests.length > 0 && (
          <Badge color="orange" variant="filled" size="sm">
            {pendingRequests.length} pending
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
          No access requests for this campaign.
        </Text>
      ) : (
        <Stack gap="xs">
          {pendingRequests.length > 0 && (
            <>
              <Text size="xs" tt="uppercase" fw={600} c="orange.4">
                Pending
              </Text>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Requested</Table.Th>
                    <Table.Th style={{ width: 160 }}>Actions</Table.Th>
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
                          {formatDate(req.requested_at)}
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
                            Approve
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
                            Deny
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
                Resolved
              </Text>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Resolved</Table.Th>
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
                          {req.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {req.resolved_at ? formatDate(req.resolved_at) : '—'}
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
