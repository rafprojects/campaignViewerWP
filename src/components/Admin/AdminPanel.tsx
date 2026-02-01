import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign, CampaignAccessGrant } from '@/types';
import {
  Tabs,
  Button,
  Group,
  Card,
  Text,
  ScrollArea,
  Table,
  Badge,
  TextInput,
  Textarea,
  Select,
  Stack,
  Loader,
  Center,
  Title,
  Modal,
  ActionIcon,
  Box,
  Combobox,
  InputBase,
  useCombobox,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconTrash, IconEdit, IconArrowLeft, IconRefresh, IconSearch } from '@tabler/icons-react';
import MediaTab from './MediaTab';

type AdminCampaign = Pick<Campaign, 'id' | 'title' | 'description' | 'status' | 'visibility' | 'createdAt' | 'updatedAt'> & {
  companyId: string;
  tags: string[];
};

interface ApiCampaignResponse {
  items: AdminCampaign[];
}

interface AuditEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  userId: number;
  createdAt: string;
}

interface WpUser {
  id: number;
  email: string;
  displayName: string;
  login: string;
  isAdmin: boolean;
}

interface AdminPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onCampaignsUpdated: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

const emptyForm = {
  title: '',
  description: '',
  company: '',
  status: 'draft' as Campaign['status'],
  visibility: 'private' as Campaign['visibility'],
  tags: '',
};

export function AdminPanel({ apiClient, onClose, onCampaignsUpdated, onNotify }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('campaigns');
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(null);
  const [formState, setFormState] = useState({ ...emptyForm });
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

  const [mediaCampaignId, setMediaCampaignId] = useState<string>('');
  

  const [accessCampaignId, setAccessCampaignId] = useState<string>('');
  const [accessEntries, setAccessEntries] = useState<CampaignAccessGrant[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessUserId, setAccessUserId] = useState('');
  const [accessSource, setAccessSource] = useState<'company' | 'campaign'>('campaign');
  const [accessAction, setAccessAction] = useState<'grant' | 'deny'>('grant');
  const [accessSaving, setAccessSaving] = useState(false);
  
  // User search state for searchable picker
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(userSearchQuery, 300);
  const [userSearchResults, setUserSearchResults] = useState<WpUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WpUser | null>(null);
  const userCombobox = useCombobox({
    onDropdownClose: () => userCombobox.resetSelectedOption(),
  });

  const [auditCampaignId, setAuditCampaignId] = useState<string>('');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [confirmArchive, setConfirmArchive] = useState<AdminCampaign | null>(null);
  const [rescanAllLoading, setRescanAllLoading] = useState(false);
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ApiCampaignResponse>('/wp-json/wp-super-gallery/v1/campaigns?per_page=50');
      setCampaigns(response.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  // Auto-select first campaign for media/access/audit tabs
  useEffect(() => {
    if (activeTab === 'media' && !mediaCampaignId && campaigns.length > 0) {
      setMediaCampaignId(campaigns[0].id);
    }
  }, [activeTab, campaigns, mediaCampaignId]);

  useEffect(() => {
    if (activeTab === 'access' && !accessCampaignId && campaigns.length > 0) {
      setAccessCampaignId(campaigns[0].id);
    }
  }, [activeTab, accessCampaignId, campaigns]);

  useEffect(() => {
    if (activeTab === 'audit' && !auditCampaignId && campaigns.length > 0) {
      setAuditCampaignId(campaigns[0].id);
    }
  }, [activeTab, auditCampaignId, campaigns]);

  

  // Load access when campaign selected
  const loadAccess = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    setAccessLoading(true);
    try {
      const response = await apiClient.get<CampaignAccessGrant[]>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access`);
      setAccessEntries(response ?? []);
    } catch {
      setAccessEntries([]);
    } finally {
      setAccessLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (activeTab === 'access' && accessCampaignId) {
      void loadAccess(accessCampaignId);
    }
  }, [activeTab, accessCampaignId, loadAccess]);

  // Search users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setUserSearchResults([]);
        return;
      }
      setUserSearchLoading(true);
      try {
        const response = await apiClient.get<{ users: WpUser[]; total: number }>(
          `/wp-json/wp-super-gallery/v1/users/search?search=${encodeURIComponent(debouncedSearch)}`
        );
        setUserSearchResults(response.users ?? []);
      } catch {
        setUserSearchResults([]);
      } finally {
        setUserSearchLoading(false);
      }
    };
    void searchUsers();
  }, [debouncedSearch, apiClient]);

  const handleGrantAccess = async () => {
    if (!accessCampaignId) return;
    
    // Use selected user from picker, or fall back to manual ID input
    let userId: number;
    if (selectedUser) {
      userId = selectedUser.id;
    } else if (accessUserId) {
      const parsedUserId = Number(accessUserId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        onNotify({ type: 'error', text: 'User ID must be a positive numeric value.' });
        return;
      }
      userId = parsedUserId;
    } else {
      onNotify({ type: 'error', text: 'Please select a user or enter a User ID.' });
      return;
    }

    setAccessSaving(true);
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access`, {
        userId,
        source: accessSource,
        action: accessSource === 'company' ? 'grant' : accessAction,
      });
      onNotify({ type: 'success', text: 'Access updated.' });
      setAccessUserId('');
      setSelectedUser(null);
      setUserSearchQuery('');
      setAccessAction('grant');
      await loadAccess(accessCampaignId);
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update access.' });
    } finally {
      setAccessSaving(false);
    }
  };

  const handleRevokeAccess = async (entry: CampaignAccessGrant) => {
    if (!accessCampaignId) return;
    setAccessSaving(true);
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access/${entry.userId}`);
      onNotify({ type: 'success', text: 'Access revoked.' });
      await loadAccess(accessCampaignId);
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to revoke access.' });
    } finally {
      setAccessSaving(false);
    }
  };

  // Load audit when campaign selected
  const loadAudit = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    setAuditLoading(true);
    try {
      const response = await apiClient.get<AuditEntry[]>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/audit`);
      setAuditEntries(response ?? []);
    } catch {
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (activeTab === 'audit' && auditCampaignId) {
      void loadAudit(auditCampaignId);
    }
  }, [activeTab, auditCampaignId, loadAudit]);

  const handleEdit = (campaign: AdminCampaign) => {
    setEditingCampaign(campaign);
    setFormState({
      title: campaign.title ?? '',
      description: campaign.description ?? '',
      company: campaign.companyId ?? '',
      status: campaign.status ?? 'draft',
      visibility: campaign.visibility ?? 'private',
      tags: (campaign.tags ?? []).join(', '),
    });
    setCampaignFormOpen(true);
  };

  const handleCreate = () => {
    setEditingCampaign(null);
    setFormState({ ...emptyForm });
    setCampaignFormOpen(true);
  };

  const closeCampaignForm = () => {
    setCampaignFormOpen(false);
    setEditingCampaign(null);
    setFormState({ ...emptyForm });
  };

  const saveCampaign = async () => {
    setIsSavingCampaign(true);
    const payload = {
      title: formState.title,
      description: formState.description,
      company: formState.company,
      status: formState.status,
      visibility: formState.visibility,
      tags: formState.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editingCampaign) {
        await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${editingCampaign.id}`, payload);
        onNotify({ type: 'success', text: 'Campaign updated.' });
      } else {
        await apiClient.post('/wp-json/wp-super-gallery/v1/campaigns', payload);
        onNotify({ type: 'success', text: 'Campaign created.' });
      }
      closeCampaignForm();
      await loadCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save campaign.' });
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const archiveCampaign = async (campaign: AdminCampaign) => {
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/archive`, {});
      onNotify({ type: 'success', text: 'Campaign archived.' });
      await loadCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to archive campaign.' });
    }
  };

  const campaignSelectData = useMemo(() => {
    return campaigns.map((c) => ({ value: c.id, label: c.title }));
  }, [campaigns]);

  const campaignsRows = useMemo(() => {
    return campaigns.map((c) => (
      <Table.Tr key={c.id}>
        <Table.Td>
          <Box>
            <Text fw={700}>{c.title}</Text>
            <Text size="xs" c="dimmed">{c.description?.slice(0, 120)}</Text>
          </Box>
        </Table.Td>
        <Table.Td>
          <Badge color={c.status === 'active' ? 'teal' : c.status === 'archived' ? 'gray' : 'yellow'}>
            {c.status}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Badge variant="light">{c.visibility}</Badge>
        </Table.Td>
        <Table.Td>{c.companyId || '—'}</Table.Td>
        <Table.Td>
          <Group gap="xs" wrap="nowrap">
            <Button variant="outline" size="xs" leftSection={<IconEdit size={14} />} onClick={() => handleEdit(c)}>
              Edit
            </Button>
            <Button color="red" size="xs" leftSection={<IconTrash size={14} />} onClick={() => setConfirmArchive(c)}>
              Archive
            </Button>
          </Group>
        </Table.Td>
      </Table.Tr>
    ));
  }, [campaigns]);

  

  const accessRows = useMemo(() => {
    return accessEntries.map((a) => (
      <Table.Tr key={`${a.userId}-${a.source}`} style={a.source === 'company' ? { backgroundColor: 'rgba(34, 139, 230, 0.05)' } : undefined}>
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
          <Tooltip label={a.source === 'company' ? 'Inherited from company - applies to all campaigns' : 'Direct campaign access'}>
            <Badge variant="light" color={a.source === 'company' ? 'blue' : 'green'}>
              {a.source === 'company' ? '🏢 Company' : '📋 Campaign'}
            </Badge>
          </Tooltip>
        </Table.Td>
        <Table.Td>{a.grantedAt ? new Date(a.grantedAt).toLocaleString() : '—'}</Table.Td>
        <Table.Td>
          <Tooltip label={a.source === 'company' ? 'Revoke company-wide access' : 'Revoke campaign access'}>
            <ActionIcon color="red" variant="light" onClick={() => handleRevokeAccess(a)} aria-label="Revoke access">
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
      </Table.Tr>
    ));
  }, [accessEntries, handleRevokeAccess]);

  const auditRows = useMemo(() => {
    return auditEntries
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((e) => (
        <Table.Tr key={e.id}>
          <Table.Td>{new Date(e.createdAt).toLocaleString()}</Table.Td>
          <Table.Td>
            <Text size="sm" style={{ wordBreak: 'break-all' }}>
              {e.action}
            </Text>
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

  return (
    <Card shadow="sm" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group>
          <ActionIcon variant="light" onClick={onClose} aria-label="Back to gallery">
            <IconArrowLeft />
          </ActionIcon>
          <Title order={3}>Admin Panel</Title>
        </Group>
        <Button leftSection={<IconPlus />} onClick={handleCreate}>
          New Campaign
        </Button>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>
          <Tabs.Tab value="media">Media</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="audit">Audit</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="campaigns" pt="md">
          {isLoading ? (
            <Center><Loader /></Center>
          ) : error ? (
            <Text c="red">{error}</Text>
          ) : (
            <ScrollArea>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Visibility</Table.Th>
                    <Table.Th>Company</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{campaignsRows}</Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Tabs.Panel>

        {/* Campaign Form Modal */}
        <Modal
          opened={campaignFormOpen}
          onClose={closeCampaignForm}
          title={editingCampaign ? 'Edit Campaign' : 'New Campaign'}
          size="lg"
        >
          <Stack gap="sm">
            <TextInput
              label="Title"
              placeholder="Campaign title"
              value={formState.title}
              onChange={(e) => setFormState((s) => ({ ...s, title: e.currentTarget.value }))}
            />
            <Textarea
              label="Description"
              placeholder="Campaign description"
              value={formState.description}
              onChange={(e) => setFormState((s) => ({ ...s, description: e.currentTarget.value }))}
              minRows={3}
            />
            <Group grow>
              <TextInput
                label="Company Slug"
                placeholder="company-id"
                value={formState.company}
                onChange={(e) => setFormState((s) => ({ ...s, company: e.currentTarget.value }))}
              />
              <Select
                label="Status"
                data={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'active', label: 'Active' },
                  { value: 'archived', label: 'Archived' },
                ]}
                value={formState.status}
                onChange={(v) => setFormState((s) => ({ ...s, status: (v ?? 'draft') as Campaign['status'] }))}
              />
              <Select
                label="Visibility"
                data={[
                  { value: 'private', label: 'Private' },
                  { value: 'public', label: 'Public' },
                ]}
                value={formState.visibility}
                onChange={(v) => setFormState((s) => ({ ...s, visibility: (v ?? 'private') as Campaign['visibility'] }))}
              />
            </Group>
            <TextInput
              label="Tags"
              placeholder="tag1, tag2, tag3"
              description="Comma separated list of tags"
              value={formState.tags}
              onChange={(e) => setFormState((s) => ({ ...s, tags: e.currentTarget.value }))}
            />
            {editingCampaign && (
              <Card withBorder p="sm">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    To manage media for this campaign, save changes and go to the Media tab.
                  </Text>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() => {
                      setMediaCampaignId(editingCampaign.id);
                      closeCampaignForm();
                      setActiveTab('media');
                    }}
                  >
                    Go to Media
                  </Button>
                </Group>
              </Card>
            )}
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCampaignForm}>
                Cancel
              </Button>
              <Button onClick={saveCampaign} loading={isSavingCampaign}>
                {editingCampaign ? 'Save Changes' : 'Create Campaign'}
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Tabs.Panel value="media" pt="md">
          <Group mb="md" justify="space-between">
            <Select
              label="Campaign"
              placeholder="Select campaign"
              data={campaignSelectData}
              value={mediaCampaignId}
              onChange={(v) => setMediaCampaignId(v ?? '')}
              style={{ minWidth: 200 }}
            />
            <Button
              variant="outline"
              leftSection={<IconRefresh size={18} />}
              loading={rescanAllLoading}
              onClick={async () => {
                setRescanAllLoading(true);
                try {
                  const result = await apiClient.post<{ message: string; campaigns_updated: number; media_updated: number }>(
                    '/wp-json/wp-super-gallery/v1/media/rescan-all',
                    {},
                  );
                  onNotify({
                    type: 'success',
                    text: result.media_updated > 0
                      ? `Rescanned: ${result.media_updated} media items updated across ${result.campaigns_updated} campaigns.`
                      : 'All media types are correct.',
                  });
                  onCampaignsUpdated();
                } catch (err) {
                  onNotify({ type: 'error', text: (err as Error).message });
                } finally {
                  setRescanAllLoading(false);
                }
              }}
            >
              Rescan All Campaigns
            </Button>
          </Group>
          <MediaTab campaignId={mediaCampaignId} apiClient={apiClient} />
        </Tabs.Panel>

        <Tabs.Panel value="access" pt="md">
          <Group mb="md">
            <Select
              label="Campaign"
              placeholder="Select campaign"
              data={campaignSelectData}
              value={accessCampaignId}
              onChange={(v) => setAccessCampaignId(v ?? '')}
              style={{ minWidth: 200 }}
            />
          </Group>
          <Card shadow="sm" withBorder mb="md">
            <Stack gap="sm">
              <Text fw={600}>Grant access</Text>
              
              {/* Searchable user picker */}
              <Combobox
                store={userCombobox}
                onOptionSubmit={(val) => {
                  const user = userSearchResults.find((u) => String(u.id) === val);
                  if (user) {
                    setSelectedUser(user);
                    setAccessUserId('');
                  }
                  userCombobox.closeDropdown();
                }}
              >
                <Combobox.Target>
                  <InputBase
                    label="Select User"
                    placeholder="Search by name or email..."
                    value={selectedUser ? `${selectedUser.displayName} (${selectedUser.email})` : userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.currentTarget.value);
                      setSelectedUser(null);
                      userCombobox.openDropdown();
                      userCombobox.updateSelectedOptionIndex();
                    }}
                    onClick={() => userCombobox.openDropdown()}
                    onFocus={() => userCombobox.openDropdown()}
                    onBlur={() => userCombobox.closeDropdown()}
                    rightSection={userSearchLoading ? <Loader size={16} /> : <IconSearch size={16} />}
                    rightSectionPointerEvents="none"
                  />
                </Combobox.Target>

                <Combobox.Dropdown>
                  <Combobox.Options>
                    {userSearchResults.length === 0 && userSearchQuery.length >= 2 && !userSearchLoading && (
                      <Combobox.Empty>No users found</Combobox.Empty>
                    )}
                    {userSearchQuery.length < 2 && (
                      <Combobox.Empty>Type at least 2 characters to search</Combobox.Empty>
                    )}
                    {userSearchResults.map((user) => (
                      <Combobox.Option key={user.id} value={String(user.id)}>
                        <Group gap="xs">
                          <Text size="sm" fw={500}>{user.displayName}</Text>
                          <Text size="xs" c="dimmed">{user.email}</Text>
                          {user.isAdmin && <Badge size="xs" color="blue">Admin</Badge>}
                        </Group>
                      </Combobox.Option>
                    ))}
                  </Combobox.Options>
                </Combobox.Dropdown>
              </Combobox>

              {/* Manual ID fallback */}
              <TextInput
                label="Or enter User ID manually"
                placeholder="e.g. 42"
                value={accessUserId}
                onChange={(e) => {
                  setAccessUserId(e.currentTarget.value);
                  setSelectedUser(null);
                }}
                disabled={!!selectedUser}
                size="xs"
              />

              <Group grow align="flex-end">
                <Select
                  label="Source"
                  data={[
                    { value: 'campaign', label: 'Campaign' },
                    { value: 'company', label: 'Company' },
                  ]}
                  value={accessSource}
                  onChange={(v) => setAccessSource((v as 'company' | 'campaign') ?? 'campaign')}
                />
                <Select
                  label="Action"
                  data={[
                    { value: 'grant', label: 'Grant' },
                    { value: 'deny', label: 'Deny' },
                  ]}
                  value={accessAction}
                  onChange={(v) => setAccessAction((v as 'grant' | 'deny') ?? 'grant')}
                  disabled={accessSource === 'company'}
                />
                <Button onClick={handleGrantAccess} loading={accessSaving}>Apply</Button>
              </Group>
              {accessSource === 'company' && (
                <Text size="xs" c="dimmed">
                  Company grants apply across all campaigns in the company.
                </Text>
              )}
            </Stack>
          </Card>
          {accessLoading ? (
            <Center><Loader /></Center>
          ) : accessEntries.length === 0 ? (
            <Text c="dimmed">No explicit access grants.</Text>
          ) : (
            <ScrollArea>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Access Type</Table.Th>
                    <Table.Th>Granted</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{accessRows}</Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="audit" pt="md">
          <Group mb="md">
            <Select
              label="Campaign"
              placeholder="Select campaign"
              data={campaignSelectData}
              value={auditCampaignId}
              onChange={(v) => setAuditCampaignId(v ?? '')}
              style={{ minWidth: 200 }}
            />
          </Group>
          {auditLoading ? (
            <Center><Loader /></Center>
          ) : auditEntries.length === 0 ? (
            <Text c="dimmed">No audit entries yet.</Text>
          ) : (
            <ScrollArea>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th miw={140}>When</Table.Th>
                    <Table.Th miw={160}>Action</Table.Th>
                    <Table.Th miw={80}>User</Table.Th>
                    <Table.Th miw={200}>Details</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{auditRows}</Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal opened={!!confirmArchive} onClose={() => setConfirmArchive(null)} title="Archive campaign">
        <Text>Archive this campaign? This action will mark it archived.</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setConfirmArchive(null)}>Cancel</Button>
          <Button color="red" onClick={() => { if (confirmArchive) { archiveCampaign(confirmArchive); setConfirmArchive(null); } }}>Archive</Button>
        </Group>
      </Modal>
    </Card>
  );
}
