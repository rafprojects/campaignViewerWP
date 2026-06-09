import { useState, useCallback } from 'react';
import {
  Tabs, Stack, Group, Text, Badge, Button, TextInput, Switch,
  Alert, Loader, Center, Table, ActionIcon, Tooltip, Select, Divider,
} from '@mantine/core';
import {
  IconPlus, IconTrash, IconAlertCircle, IconUserPlus,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@/services/apiClient';
import { useSpaces } from '@/services/adminQuery';
import { SpaceSettingsPanel } from './SpaceSettingsPanel';

interface SpaceGrant {
  userId: number;
  user?: { displayName: string; email: string };
  access_level?: string;
  grantedAt?: string;
  expires_at?: string | null;
  is_expired?: boolean;
}

export interface SpaceManagementViewProps {
  apiClient: ApiClient;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  onSpacesChanged: () => void;
}

/**
 * Full space management UI (create / archive / per-space settings / access grants).
 * Rendered both inside SpaceManagementModal (admin panel header) and standalone
 * on the WP-admin "Spaces" page (see main.tsx #wpsg-spaces-admin mount).
 */
export function SpaceManagementView({ apiClient, onNotify, onSpacesChanged }: SpaceManagementViewProps) {
  const { spaces, spacesLoading, mutateSpaces } = useSpaces(apiClient);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('spaces');

  // Create space form
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createIsolation, setCreateIsolation] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);

  // Grant management
  const [grantEmail, setGrantEmail] = useState('');
  const [grantRole, setGrantRole] = useState<string>('editor');
  const [grantSaving, setGrantSaving] = useState(false);

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId) ?? null;

  const { data: grants, isLoading: grantsLoading, refetch: refetchGrants } = useQuery({
    queryKey: ['space-grants', selectedSpaceId],
    queryFn: async () => {
      const res = await apiClient.get<SpaceGrant[]>(`/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/access`);
      return Array.isArray(res) ? res : [];
    },
    enabled: selectedSpaceId !== null && activeTab === 'access',
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = useCallback((name: string) => {
    setCreateName(name);
    if (!createSlug || createSlug === autoSlug(createName)) {
      setCreateSlug(autoSlug(name));
    }
  }, [createName, createSlug]);

  const handleCreateSpace = useCallback(async () => {
    if (!createName.trim()) return;
    setCreateSaving(true);
    try {
      const res = await apiClient.post<{ id: number }>('/wp-json/wp-super-gallery/v1/spaces', {
        name: createName.trim(),
        slug: createSlug.trim() || autoSlug(createName.trim()),
        isolation_mode: createIsolation ? 'delegated' : 'open',
      });
      setCreateName('');
      setCreateSlug('');
      setCreateIsolation(false);
      await mutateSpaces();
      onSpacesChanged();
      onNotify({ type: 'success', text: `Space "${createName.trim()}" created` });
      setSelectedSpaceId(res.id);
      setActiveTab('settings');
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? 'Failed to create space' });
    } finally {
      setCreateSaving(false);
    }
  }, [apiClient, createName, createSlug, createIsolation, mutateSpaces, onSpacesChanged, onNotify]);

  const handleArchiveSpace = useCallback(async (spaceId: number, spaceName: string) => {
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/spaces/${spaceId}`);
      await mutateSpaces();
      onSpacesChanged();
      if (selectedSpaceId === spaceId) {
        setSelectedSpaceId(null);
        setActiveTab('spaces');
      }
      onNotify({ type: 'success', text: `Space "${spaceName}" archived` });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? 'Failed to archive space' });
    }
  }, [apiClient, mutateSpaces, onSpacesChanged, onNotify, selectedSpaceId]);

  const handleGrantAccess = useCallback(async () => {
    if (!grantEmail.trim() || !selectedSpaceId) return;
    setGrantSaving(true);
    try {
      const usersRes = await apiClient.get<{ id: number }[]>(
        `/wp-json/wp/v2/users?search=${encodeURIComponent(grantEmail.trim())}&per_page=1`,
      );
      if (!usersRes || usersRes.length === 0) {
        onNotify({ type: 'error', text: 'No WordPress user found with that email' });
        setGrantSaving(false);
        return;
      }
      await apiClient.post(`/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/access`, {
        userId: usersRes[0]!.id,
        access_level: grantRole,
      });
      setGrantEmail('');
      await refetchGrants();
      onNotify({ type: 'success', text: 'Access granted' });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? 'Failed to grant access' });
    } finally {
      setGrantSaving(false);
    }
  }, [apiClient, grantEmail, grantRole, selectedSpaceId, refetchGrants, onNotify]);

  const handleRevokeAccess = useCallback(async (userId: number) => {
    if (!selectedSpaceId) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/access/${userId}`);
      await refetchGrants();
      onNotify({ type: 'success', text: 'Access revoked' });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? 'Failed to revoke access' });
    }
  }, [apiClient, selectedSpaceId, refetchGrants, onNotify]);

  return (
    <Tabs value={activeTab} onChange={setActiveTab}>
      <Tabs.List>
        <Tabs.Tab value="spaces">Spaces</Tabs.Tab>
        <Tabs.Tab value="settings" disabled={!selectedSpaceId}>Settings</Tabs.Tab>
        <Tabs.Tab value="access" disabled={!selectedSpaceId}>Access</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="spaces" pt="md">
        <Stack gap="md">
          {spacesLoading ? (
            <Center py="md"><Loader size="sm" /></Center>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Slug</Table.Th>
                  <Table.Th>Mode</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {spaces.filter((s) => !s.archived).map((space) => (
                  <Table.Tr
                    key={space.id}
                    style={{ cursor: 'pointer', background: selectedSpaceId === space.id ? 'var(--mantine-color-blue-light)' : undefined }}
                    onClick={() => setSelectedSpaceId(space.id)}
                  >
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm">{space.name}</Text>
                        {space.isDefault && <Badge size="xs" variant="light">default</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{space.slug}</Text></Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={space.isolationMode === 'delegated' ? 'orange' : 'gray'} variant="outline">
                        {space.isolationMode}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {!space.isDefault && (
                        <Tooltip label="Archive space">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); void handleArchiveSpace(space.id, space.name); }}
                            aria-label={`Archive ${space.name}`}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          <Divider label="Create new space" labelPosition="center" />

          <Stack gap="sm">
            <Group grow align="flex-start">
              <TextInput
                label="Space name"
                placeholder="My Gallery Space"
                value={createName}
                onChange={(e) => handleNameChange(e.currentTarget.value)}
                required
                size="sm"
              />
              <TextInput
                label="Slug"
                placeholder="my-gallery-space"
                value={createSlug}
                onChange={(e) => setCreateSlug(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                size="sm"
              />
            </Group>
            <Stack gap="xs">
              <Switch
                label="Delegated isolation mode"
                description="Only explicit grantees can access this space. Admins without a grant are denied."
                checked={createIsolation}
                onChange={(e) => setCreateIsolation(e.currentTarget.checked)}
                size="sm"
              />
              {createIsolation && (
                <Alert icon={<IconAlertCircle size={14} />} color="orange" variant="light" p="xs">
                  In delegated mode, WordPress admins without an explicit grant cannot access this space. Make sure to add yourself as an owner before saving.
                </Alert>
              )}
            </Stack>
            <Group justify="flex-end">
              <Button
                leftSection={<IconPlus size={14} />}
                onClick={() => void handleCreateSpace()}
                loading={createSaving}
                disabled={!createName.trim()}
                size="sm"
              >
                Create space
              </Button>
            </Group>
          </Stack>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="settings" pt="md">
        {selectedSpace ? (
          <SpaceSettingsPanel
            apiClient={apiClient}
            spaceId={selectedSpace.id}
            spaceName={selectedSpace.name}
            onNotify={onNotify}
          />
        ) : (
          <Text c="dimmed" size="sm">Select a space from the Spaces tab to edit its settings.</Text>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="access" pt="md">
        {selectedSpace ? (
          <Stack gap="md">
            <Text size="sm" fw={500}>Access grants for {selectedSpace.name}</Text>

            {grantsLoading ? (
              <Center py="md"><Loader size="sm" /></Center>
            ) : grants && grants.length > 0 ? (
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Granted</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {grants.map((grant) => (
                    <Table.Tr key={grant.userId}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm">{grant.user?.displayName ?? `User #${grant.userId}`}</Text>
                          {grant.user?.email && <Text size="xs" c="dimmed">{grant.user.email}</Text>}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light">{grant.access_level ?? 'viewer'}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {grant.grantedAt ? new Date(grant.grantedAt).toLocaleDateString() : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="Revoke access">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => void handleRevokeAccess(grant.userId)}
                            aria-label="Revoke access"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text size="sm" c="dimmed">No access grants. Everyone with the manage_wpsg capability can access this space.</Text>
            )}

            <Divider label="Grant access" labelPosition="center" />

            <Group align="flex-end" gap="sm">
              <TextInput
                label="User email"
                placeholder="user@example.com"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.currentTarget.value)}
                size="sm"
                style={{ flex: 1 }}
              />
              <Select
                label="Role"
                data={[
                  { value: 'viewer', label: 'Viewer' },
                  { value: 'editor', label: 'Editor' },
                  { value: 'owner', label: 'Owner' },
                ]}
                value={grantRole}
                onChange={(v) => setGrantRole(v ?? 'editor')}
                size="sm"
                w={120}
                allowDeselect={false}
              />
              <Button
                leftSection={<IconUserPlus size={14} />}
                onClick={() => void handleGrantAccess()}
                loading={grantSaving}
                disabled={!grantEmail.trim()}
                size="sm"
              >
                Grant
              </Button>
            </Group>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">Select a space from the Spaces tab to manage access.</Text>
        )}
      </Tabs.Panel>
    </Tabs>
  );
}
