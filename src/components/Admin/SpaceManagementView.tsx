import { useState, useCallback, useEffect } from 'react';
import {
  Tabs, Stack, Group, Text, Badge, Button, TextInput, Switch,
  Alert, Loader, Center, Table, ActionIcon, Tooltip, Select, Divider, Checkbox,
} from '@mantine/core';
import {
  IconPlus, IconTrash, IconAlertCircle, IconUserPlus, IconSettings, IconInfoCircle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';
import { useSpaces } from '@/services/adminQuery';
import { SettingsPanel } from './SettingsPanel';
import { SpaceAssetLibrary } from './SpaceAssetLibrary';
import type { AssetLibraryItem } from '@/components/Admin/LayoutBuilder/BuilderDockContext';
import type { FontLibraryEntry } from '@wp-super-gallery/shared-utils';

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
  /**
   * P53-A: creating a space is a System Admin action (`spaces.create` =
   * require_system_admin). Editors can manage spaces they have access to
   * (archive / settings / access / library) but not create new ones.
   */
  isSystemAdmin?: boolean;
}

/**
 * Full space management UI (create / archive / per-space settings / access grants).
 * Rendered both inside SpaceManagementModal (admin panel header) and standalone
 * on the WP-admin "Spaces" page (see main.tsx #wpsg-spaces-admin mount).
 */
export function SpaceManagementView({ apiClient, onNotify, onSpacesChanged, isSystemAdmin = false }: SpaceManagementViewProps) {
  const { t } = useTranslation('wpsg');
  const spaceRoleOptions = [
    { value: 'viewer', label: t('admin_space_role_viewer', 'Viewer') },
    { value: 'editor', label: t('admin_space_role_editor', 'Editor') },
    { value: 'owner', label: t('admin_space_role_owner', 'Owner') },
  ];
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
  // P51-H: tracks the grant whose role is currently being updated inline.
  const [roleSavingUserId, setRoleSavingUserId] = useState<number | null>(null);

  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId) ?? null;

  // Close the settings drawer whenever the selected space changes.
  useEffect(() => { setSettingsPanelOpen(false); }, [selectedSpaceId]);

  const { data: grants, isLoading: grantsLoading, refetch: refetchGrants } = useQuery({
    queryKey: ['space-grants', apiClient.getBaseUrl(), selectedSpaceId],
    queryFn: async () => {
      const res = await apiClient.get<{ items?: SpaceGrant[] } | SpaceGrant[]>(
        `/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/access`
      );
      if (Array.isArray(res)) return res;
      return (res as { items?: SpaceGrant[] }).items ?? [];
    },
    enabled: selectedSpaceId !== null && activeTab === 'access',
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const libraryTabActive = activeTab === 'library';
  const isDelegated = selectedSpace?.isolationMode === 'delegated';

  const { data: allAssets, isLoading: assetsLoading } = useQuery({
    queryKey: ['asset-library', apiClient.getBaseUrl()],
    queryFn: async () =>
      (await apiClient.get<AssetLibraryItem[]>('/wp-json/wp-super-gallery/v1/admin/asset-library')) ?? [],
    enabled: libraryTabActive && isDelegated,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: allFonts, isLoading: fontsLoading } = useQuery({
    queryKey: ['font-library', apiClient.getBaseUrl()],
    queryFn: async () =>
      (await apiClient.get<FontLibraryEntry[]>('/wp-json/wp-super-gallery/v1/admin/font-library')) ?? [],
    enabled: libraryTabActive && isDelegated,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: spaceLibrary, isLoading: libraryLoading, refetch: refetchLibrary } = useQuery({
    queryKey: ['space-library', apiClient.getBaseUrl(), selectedSpaceId],
    queryFn: async () =>
      apiClient.get<{ asset: string[]; font: string[] }>(
        `/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/library`
      ),
    enabled: libraryTabActive && isDelegated && selectedSpaceId !== null,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const toggleLibraryAsset = useCallback(async (
    assetType: 'asset' | 'font',
    assetId: string,
    checked: boolean,
  ): Promise<void> => {
    if (!selectedSpaceId) return;
    if (checked) {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/library`, {
        assetType,
        assetId,
      });
    } else {
      const params = new URLSearchParams({ assetType, assetId });
      await apiClient.delete(
        `/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/library?${params.toString()}`
      );
    }
  }, [apiClient, selectedSpaceId]);

  const handleLibraryToggle = useCallback(async (
    assetType: 'asset' | 'font',
    assetId: string,
    checked: boolean,
  ) => {
    try {
      await toggleLibraryAsset(assetType, assetId, checked);
      await refetchLibrary();
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? t('admin_space_lib_fail', 'Failed to update library') });
    }
  }, [toggleLibraryAsset, refetchLibrary, onNotify, t]);

  const handleBulkLibraryToggle = useCallback(async (assetIds: string[], associated: boolean) => {
    const current = new Set(spaceLibrary?.asset ?? []);
    // Only act on assets that actually need changing.
    const targets = assetIds.filter((id) => associated ? !current.has(id) : current.has(id));
    if (targets.length === 0) return;
    try {
      for (const id of targets) {
        await toggleLibraryAsset('asset', id, associated);
      }
      await refetchLibrary();
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? t('admin_space_lib_fail', 'Failed to update library') });
    }
  }, [spaceLibrary, toggleLibraryAsset, refetchLibrary, onNotify, t]);

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
      onNotify({ type: 'success', text: t('admin_space_created', 'Space "{{name}}" created', { name: createName.trim() }) });
      setSelectedSpaceId(res.id);
      setActiveTab('settings');
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? t('admin_space_create_fail', 'Failed to create space') });
    } finally {
      setCreateSaving(false);
    }
  }, [apiClient, createName, createSlug, createIsolation, mutateSpaces, onSpacesChanged, onNotify, t]);

  const handleArchiveSpace = useCallback(async (spaceId: number, spaceName: string) => {
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/spaces/${spaceId}`);
      await mutateSpaces();
      onSpacesChanged();
      if (selectedSpaceId === spaceId) {
        setSelectedSpaceId(null);
        setActiveTab('spaces');
      }
      onNotify({ type: 'success', text: t('admin_space_archived', 'Space "{{name}}" archived', { name: spaceName }) });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? t('admin_space_archive_fail', 'Failed to archive space') });
    }
  }, [apiClient, mutateSpaces, onSpacesChanged, onNotify, selectedSpaceId, t]);

  const handleGrantAccess = useCallback(async () => {
    if (!grantEmail.trim() || !selectedSpaceId) return;
    setGrantSaving(true);
    try {
      const resolveRes = await apiClient.get<{ found: boolean; id?: number }>(
        `/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/resolve-user?search=${encodeURIComponent(grantEmail.trim())}`,
      );
      if (!resolveRes?.found || !resolveRes.id) {
        onNotify({ type: 'error', text: t('admin_space_no_user', 'No WordPress user found with that email') });
        setGrantSaving(false);
        return;
      }
      await apiClient.post(`/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/access`, {
        userId: resolveRes.id,
        access_level: grantRole,
      });
      setGrantEmail('');
      await refetchGrants();
      onNotify({ type: 'success', text: t('admin_space_access_granted', 'Access granted') });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? t('admin_space_grant_fail', 'Failed to grant access') });
    } finally {
      setGrantSaving(false);
    }
  }, [apiClient, grantEmail, grantRole, selectedSpaceId, refetchGrants, onNotify, t]);

  const handleRevokeAccess = useCallback(async (userId: number) => {
    if (!selectedSpaceId) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/access/${userId}`);
      await refetchGrants();
      onNotify({ type: 'success', text: t('admin_space_access_revoked', 'Access revoked') });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? t('admin_space_revoke_fail', 'Failed to revoke access') });
    }
  }, [apiClient, selectedSpaceId, refetchGrants, onNotify, t]);

  // P51-H: change an existing grant's role inline. POST /access upserts the grant
  // (see WPSG_Space_Controller::upsert_space_grant), so re-posting with the new
  // access_level updates it in place.
  const handleChangeRole = useCallback(async (userId: number, newLevel: string) => {
    if (!selectedSpaceId) return;
    setRoleSavingUserId(userId);
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/spaces/${selectedSpaceId}/access`, {
        userId,
        access_level: newLevel,
      });
      await refetchGrants();
      onNotify({ type: 'success', text: t('admin_space_role_updated', 'Role updated') });
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message ?? t('admin_space_role_fail', 'Failed to update role') });
    } finally {
      setRoleSavingUserId(null);
    }
  }, [apiClient, selectedSpaceId, refetchGrants, onNotify, t]);

  return (
    <>
    <Tabs value={activeTab} onChange={setActiveTab}>
      <Tabs.List>
        <Tabs.Tab value="spaces">{t('admin_space_tab_spaces', 'Spaces')}</Tabs.Tab>
        <Tabs.Tab value="settings" disabled={!selectedSpaceId}>{t('admin_space_tab_settings', 'Settings')}</Tabs.Tab>
        <Tabs.Tab value="access" disabled={!selectedSpaceId}>{t('admin_space_tab_access', 'Access')}</Tabs.Tab>
        <Tabs.Tab value="library" disabled={!selectedSpaceId}>{t('admin_space_tab_library', 'Library')}</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="spaces" pt="md">
        <Stack gap="md">
          {spacesLoading ? (
            <Center py="md"><Loader size="sm" /></Center>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('admin_space_th_name', 'Name')}</Table.Th>
                  <Table.Th>{t('admin_space_th_slug', 'Slug')}</Table.Th>
                  <Table.Th>{t('admin_space_th_mode', 'Mode')}</Table.Th>
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
                        {space.isDefault && <Badge size="xs" variant="light">{t('admin_space_default', 'default')}</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{space.slug}</Text></Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={space.isolationMode === 'delegated' ? 'orange' : 'gray'} variant="outline">
                        {t(`admin_space_mode_${space.isolationMode}`, space.isolationMode)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {!space.isDefault && (
                        <Tooltip label={t('admin_space_archive_tt', 'Archive space')}>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); void handleArchiveSpace(space.id, space.name); }}
                            aria-label={t('admin_space_archive_aria', 'Archive {{name}}', { name: space.name })}
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

          {/* P53-A: creating a space is system-admin only (spaces.create). */}
          {isSystemAdmin && <>
          <Divider label={t('admin_space_create_divider', 'Create new space')} labelPosition="center" />

          <Stack gap="sm">
            <Group grow align="flex-start">
              <TextInput
                label={t('admin_space_name_label', 'Space name')}
                placeholder={t('admin_space_name_ph', 'My Gallery Space')}
                value={createName}
                onChange={(e) => handleNameChange(e.currentTarget.value)}
                required
                size="sm"
              />
              <TextInput
                label={t('admin_space_slug_label', 'Slug')}
                placeholder={t('admin_space_slug_ph', 'my-gallery-space')}
                value={createSlug}
                onChange={(e) => setCreateSlug(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                size="sm"
              />
            </Group>
            <Stack gap="xs">
              <Switch
                label={t('admin_space_delegated_label', 'Delegated isolation mode')}
                description={t('admin_space_delegated_desc', 'Only explicit grantees can access this space. Admins without a grant are denied.')}
                checked={createIsolation}
                onChange={(e) => setCreateIsolation(e.currentTarget.checked)}
                size="sm"
              />
              {createIsolation && (
                <Alert icon={<IconAlertCircle size={14} />} color="orange" variant="light" p="xs">
                  {t('admin_space_delegated_alert', 'In delegated mode, WordPress admins without an explicit grant cannot access this space. Make sure to add yourself as an owner before saving.')}
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
                {t('admin_space_create_btn', 'Create space')}
              </Button>
            </Group>
          </Stack>
          </>}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="settings" pt="md">
        {selectedSpace ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {t('admin_space_settings_pre', 'Configure display settings for ')}<Text span fw={500}>{selectedSpace.name}</Text>{t('admin_space_settings_post', '. Unset fields inherit the global defaults.')}
            </Text>
            <Button
              leftSection={<IconSettings size={14} />}
              variant="light"
              size="sm"
              onClick={() => setSettingsPanelOpen(true)}
            >
              {t('admin_space_settings_btn', 'Configure display settings')}
            </Button>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">{t('admin_space_settings_empty', 'Select a space from the Spaces tab to edit its settings.')}</Text>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="access" pt="md">
        {selectedSpace ? (
          <Stack gap="md">
            <Text size="sm" fw={500}>{t('admin_space_grants_for', 'Access grants for {{name}}', { name: selectedSpace.name })}</Text>

            {grantsLoading ? (
              <Center py="md"><Loader size="sm" /></Center>
            ) : grants && grants.length > 0 ? (
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('admin_space_th_user', 'User')}</Table.Th>
                    <Table.Th>{t('admin_space_th_role', 'Role')}</Table.Th>
                    <Table.Th>{t('admin_space_th_granted', 'Granted')}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {grants.map((grant) => (
                    <Table.Tr key={grant.userId}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm">{grant.user?.displayName ?? t('admin_space_user_num', 'User #{{id}}', { id: grant.userId })}</Text>
                          {grant.user?.email && <Text size="xs" c="dimmed">{grant.user.email}</Text>}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          variant="filled"
                          w={120}
                          data={spaceRoleOptions}
                          value={grant.access_level ?? 'viewer'}
                          allowDeselect={false}
                          disabled={roleSavingUserId === grant.userId}
                          comboboxProps={{ withinPortal: true }}
                          aria-label={t('admin_space_role_for', 'Role for {{name}}', { name: grant.user?.displayName ?? t('admin_space_user_lc', 'user {{id}}', { id: grant.userId }) })}
                          onChange={(v) => {
                            if (v && v !== (grant.access_level ?? 'viewer')) {
                              void handleChangeRole(grant.userId, v);
                            }
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {grant.grantedAt ? new Date(grant.grantedAt).toLocaleDateString() : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={t('admin_space_revoke_tt', 'Revoke access')}>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => void handleRevokeAccess(grant.userId)}
                            aria-label={t('admin_space_revoke_aria', 'Revoke access')}
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
              <Text size="sm" c="dimmed">{t('admin_space_no_grants', 'No access grants. Everyone with the manage_wpsg capability can access this space.')}</Text>
            )}

            <Divider label={t('admin_space_grant_divider', 'Grant access')} labelPosition="center" />

            <Group align="flex-end" gap="sm">
              <TextInput
                label={t('admin_space_email_label', 'User email')}
                placeholder={t('admin_space_email_ph', 'user@example.com')}
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.currentTarget.value)}
                size="sm"
                style={{ flex: 1 }}
              />
              <Select
                label={t('admin_space_role_label', 'Role')}
                data={spaceRoleOptions}
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
                {t('admin_space_grant_btn', 'Grant')}
              </Button>
            </Group>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">{t('admin_space_access_empty', 'Select a space from the Spaces tab to manage access.')}</Text>
        )}
      </Tabs.Panel>

      <Tabs.Panel value="library" pt="md">
        {!selectedSpace ? (
          <Text c="dimmed" size="sm">{t('admin_space_library_empty', 'Select a space from the Spaces tab to manage its shared library.')}</Text>
        ) : !isDelegated ? (
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            <Text size="sm" fw={500} mb={2}>{t('admin_space_open_title', '{{name}} is an open space.', { name: selectedSpace.name })}</Text>
            <Text size="sm">
              {t('admin_space_open_desc', 'Open spaces can use every asset in the library — per-space selection only applies to delegated spaces. Switch this space to delegated isolation mode to restrict its assets.')}
            </Text>
          </Alert>
        ) : (
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              {t('admin_space_lib_pre', 'Select the assets ')}<Text span fw={500}>{selectedSpace.name}</Text>{t('admin_space_lib_post', ' is allowed to use. Unselected assets are hidden in this space.')}
            </Text>

            <Stack gap="xs">
              <Text size="sm" fw={500}>{t('admin_space_assets', 'Assets')}</Text>
              <SpaceAssetLibrary
                assets={allAssets ?? []}
                associatedIds={spaceLibrary?.asset ?? []}
                onToggle={(id, on) => void handleLibraryToggle('asset', id, on)}
                onBulkToggle={(ids, on) => void handleBulkLibraryToggle(ids, on)}
                loading={assetsLoading || libraryLoading}
              />
            </Stack>

            <Stack gap="xs">
              <Text size="sm" fw={500}>{t('admin_space_fonts', 'Fonts')}</Text>
              {fontsLoading || libraryLoading ? (
                <Center py="xs"><Loader size="sm" /></Center>
              ) : !allFonts?.length ? (
                <Text size="xs" c="dimmed">{t('admin_space_no_fonts', 'No fonts in the global library.')}</Text>
              ) : (
                allFonts.map((font) => (
                  <Checkbox
                    key={font.id}
                    label={font.name}
                    checked={spaceLibrary?.font?.includes(font.id) ?? false}
                    onChange={(e) => void handleLibraryToggle('font', font.id, e.currentTarget.checked)}
                    size="sm"
                  />
                ))
              )}
            </Stack>
          </Stack>
        )}
      </Tabs.Panel>
    </Tabs>

    {selectedSpace && (
      <SettingsPanel
        opened={settingsPanelOpen}
        apiClient={apiClient}
        onClose={() => setSettingsPanelOpen(false)}
        onNotify={onNotify}
        spaceId={selectedSpace.id}
        withinPortal
        isSystemAdmin={isSystemAdmin}
      />
    )}
    </>
  );
}
