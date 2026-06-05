import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  CopyButton,
  Divider,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCopy, IconRefresh, IconTrash } from '@tabler/icons-react';
import type { ApiClient, WebhookEndpoint } from '@/services/apiClient';
import { notifications } from '@mantine/notifications';
import { getErrorMessage } from '@/utils/getErrorMessage';

const WEBHOOK_EVENTS = [
  { value: 'campaign.created', label: 'Campaign created' },
  { value: 'campaign.updated', label: 'Campaign updated' },
  { value: 'campaign.archived', label: 'Campaign archived' },
  { value: 'campaign.restored', label: 'Campaign restored' },
  { value: 'campaign.deleted', label: 'Campaign deleted' },
  { value: 'media.added', label: 'Media added' },
  { value: 'media.removed', label: 'Media removed' },
  { value: 'access.granted', label: 'Access granted' },
  { value: 'access.revoked', label: 'Access revoked' },
];

const QUERY_KEY = ['webhooks'] as const;
const MAX_ENDPOINTS = 5;

interface Props {
  apiClient: ApiClient;
}

interface AddFormState {
  url: string;
  events: string[];
  enabled: boolean;
}

function SecretReveal({ secret }: { secret: string }) {
  return (
    <Box
      p="xs"
      style={{
        background: 'var(--mantine-color-dark-6, #1a1a2e)',
        borderRadius: 4,
        fontFamily: 'monospace',
        fontSize: 12,
        wordBreak: 'break-all',
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="xs" ff="monospace" c="green">
          {secret}
        </Text>
        <CopyButton value={secret}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied!' : 'Copy secret'}>
              <ActionIcon size="sm" variant="subtle" onClick={copy} aria-label="Copy secret">
                <IconCopy size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
    </Box>
  );
}

function EndpointRow({
  endpoint,
  onToggleEnabled,
  onUpdateEvents,
  onRotateSecret,
  onDelete,
  isDeleting,
  isRotating,
  isUpdating,
}: {
  endpoint: WebhookEndpoint;
  onToggleEnabled: (idx: number, enabled: boolean) => void;
  onUpdateEvents: (idx: number, events: string[]) => void;
  onRotateSecret: (idx: number) => void;
  onDelete: (idx: number) => void;
  isDeleting: boolean;
  isRotating: boolean;
  isUpdating: boolean;
}) {
  const [showEvents, setShowEvents] = useState(false);

  return (
    <Box
      p="sm"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 6,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" style={{ wordBreak: 'break-all' }}>
              {endpoint.url}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              secret: ...{endpoint.secretHint.slice(-8)}
            </Text>
          </Box>
          <Group gap="xs" wrap="nowrap">
            <Switch
              size="sm"
              checked={endpoint.enabled}
              onChange={(e) => onToggleEnabled(endpoint.index, e.currentTarget.checked)}
              disabled={isUpdating}
              label={endpoint.enabled ? 'On' : 'Off'}
            />
            <Tooltip label="Rotate secret">
              <ActionIcon
                variant="subtle"
                loading={isRotating}
                onClick={() => onRotateSecret(endpoint.index)}
                aria-label={`Rotate secret for ${endpoint.url}`}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete endpoint">
              <ActionIcon
                variant="subtle"
                color="red"
                loading={isDeleting}
                onClick={() => onDelete(endpoint.index)}
                aria-label={`Delete endpoint ${endpoint.url}`}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Group gap="xs">
          {endpoint.events.length === 0 ? (
            <Badge size="xs" variant="outline">
              All events
            </Badge>
          ) : (
            endpoint.events.map((ev) => (
              <Badge key={ev} size="xs" variant="light">
                {ev}
              </Badge>
            ))
          )}
          <Button
            variant="subtle"
            size="compact-xs"
            onClick={() => setShowEvents((v) => !v)}
            disabled={isUpdating}
          >
            {showEvents ? 'Hide filter' : 'Edit filter'}
          </Button>
        </Group>

        {showEvents && (
          <MultiSelect
            size="xs"
            data={WEBHOOK_EVENTS}
            value={endpoint.events}
            onChange={(events) => onUpdateEvents(endpoint.index, events)}
            placeholder="All events (leave empty to receive all)"
            clearable
          />
        )}
      </Stack>
    </Box>
  );
}

export function WebhookSettingsSection({ apiClient }: Props) {
  const queryClient = useQueryClient();

  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.listWebhookEndpoints(),
    staleTime: 60_000,
  });

  const [addForm, setAddForm] = useState<AddFormState>({
    url: '',
    events: [],
    enabled: true,
  });
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [rotatedLabel, setRotatedLabel] = useState('');

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    [queryClient],
  );

  const createMutation = useMutation({
    mutationFn: (data: { url: string; events: string[]; enabled: boolean }) =>
      apiClient.createWebhookEndpoint(data),
    onSuccess: (data) => {
      setNewSecret(data.secret);
      setAddForm({ url: '', events: [], enabled: true });
      invalidate();
    },
    onError: (err) => {
      notifications.show({ color: 'red', message: getErrorMessage(err, 'Failed to create webhook endpoint.') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (index: number) => apiClient.deleteWebhookEndpoint(index),
    onSuccess: invalidate,
    onError: (err) => {
      notifications.show({ color: 'red', message: getErrorMessage(err, 'Failed to delete webhook endpoint.') });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ index, data }: { index: number; data: { enabled?: boolean; events?: string[] } }) =>
      apiClient.updateWebhookEndpoint(index, data),
    onSuccess: invalidate,
    onError: (err) => {
      notifications.show({ color: 'red', message: getErrorMessage(err, 'Failed to update webhook endpoint.') });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (index: number) => apiClient.rotateWebhookSecret(index),
    onSuccess: (data, index) => {
      invalidate();
      const ep = endpoints.find((e) => e.index === index);
      setRotatedLabel(ep?.url ?? `Endpoint ${index}`);
      setRotatedSecret(data.secret);
    },
    onError: (err) => {
      notifications.show({ color: 'red', message: getErrorMessage(err, 'Failed to rotate webhook secret.') });
    },
  });

  const handleCreate = useCallback(() => {
    if (!addForm.url.trim()) return;
    createMutation.mutate(addForm);
  }, [addForm, createMutation]);

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Webhook endpoints receive signed HMAC-SHA256 POST requests when campaign events occur.
        Payloads include the event type, ISO timestamp, and event data. Use the{' '}
        <Text component="span" ff="monospace" size="xs">
          X-WPSG-Signature
        </Text>{' '}
        header to verify delivery authenticity.
      </Text>

      {endpoints.length === 0 && (
        <Text size="sm" c="dimmed">
          No webhook endpoints configured.
        </Text>
      )}

      {endpoints.map((ep) => (
        <EndpointRow
          key={ep.index}
          endpoint={ep}
          onToggleEnabled={(idx, enabled) => updateMutation.mutate({ index: idx, data: { enabled } })}
          onUpdateEvents={(idx, events) => updateMutation.mutate({ index: idx, data: { events } })}
          onRotateSecret={(idx) => rotateMutation.mutate(idx)}
          onDelete={(idx) => deleteMutation.mutate(idx)}
          isDeleting={deleteMutation.isPending && deleteMutation.variables === ep.index}
          isRotating={rotateMutation.isPending && rotateMutation.variables === ep.index}
          isUpdating={updateMutation.isPending && updateMutation.variables?.index === ep.index}
        />
      ))}

      {endpoints.length < MAX_ENDPOINTS && (
        <>
          <Divider label="Add endpoint" labelPosition="left" />
          <Stack gap="sm">
            <TextInput
              label="URL"
              placeholder="https://hooks.example.com/my-webhook"
              value={addForm.url}
              onChange={(e) => setAddForm((s) => ({ ...s, url: e.currentTarget.value }))}
              size="sm"
            />
            <MultiSelect
              label="Events (optional)"
              description="Leave empty to receive all events."
              data={WEBHOOK_EVENTS}
              value={addForm.events}
              onChange={(events) => setAddForm((s) => ({ ...s, events }))}
              clearable
              size="sm"
            />
            <Checkbox
              label="Enabled"
              checked={addForm.enabled}
              onChange={(e) => setAddForm((s) => ({ ...s, enabled: e.currentTarget.checked }))}
              size="sm"
            />
            <Box>
              <Button
                size="sm"
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!addForm.url.trim()}
              >
                Add endpoint
              </Button>
            </Box>
          </Stack>
        </>
      )}

      {/* One-time new-endpoint secret modal */}
      <Modal
        opened={newSecret !== null}
        onClose={() => setNewSecret(null)}
        title="Webhook secret — save this now"
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm">
            This is the only time the full secret will be shown. Copy it and configure your
            endpoint to verify the{' '}
            <Text component="span" ff="monospace" size="xs">
              X-WPSG-Signature
            </Text>{' '}
            header using HMAC-SHA256.
          </Text>
          {newSecret && <SecretReveal secret={newSecret} />}
          <Group justify="flex-end">
            <Button onClick={() => setNewSecret(null)}>Done</Button>
          </Group>
        </Stack>
      </Modal>

      {/* One-time rotated-secret modal */}
      <Modal
        opened={rotatedSecret !== null}
        onClose={() => setRotatedSecret(null)}
        title="New webhook secret — save this now"
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm">
            The secret for <strong>{rotatedLabel}</strong> has been rotated. Update your endpoint
            receiver with this new value before closing.
          </Text>
          {rotatedSecret && <SecretReveal secret={rotatedSecret} />}
          <Group justify="flex-end">
            <Button onClick={() => setRotatedSecret(null)}>Done</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
