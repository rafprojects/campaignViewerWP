import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign, CampaignAccessGrant, MediaItem } from '@/types';
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
} from '@mantine/core';
import { IconPlus, IconTrash, IconEdit, IconArrowLeft } from '@tabler/icons-react';

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
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const [accessCampaignId, setAccessCampaignId] = useState<string>('');
  const [accessEntries, setAccessEntries] = useState<CampaignAccessGrant[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);

  const [auditCampaignId, setAuditCampaignId] = useState<string>('');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [confirmArchive, setConfirmArchive] = useState<AdminCampaign | null>(null);

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

  // Load media when campaign selected
  const loadMedia = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    setMediaLoading(true);
    try {
      const response = await apiClient.get<MediaItem[]>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`);
      setMediaItems(response ?? []);
    } catch {
      setMediaItems([]);
    } finally {
      setMediaLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (activeTab === 'media' && mediaCampaignId) {
      void loadMedia(mediaCampaignId);
    }
  }, [activeTab, loadMedia, mediaCampaignId]);

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
  };

  const handleCreate = () => {
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
      setEditingCampaign(null);
      setFormState({ ...emptyForm });
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

  const mediaRows = useMemo(() => {
    return mediaItems.map((m) => (
      <Table.Tr key={m.id}>
        <Table.Td>{m.type}</Table.Td>
        <Table.Td>{m.source}</Table.Td>
        <Table.Td>
          <Text size="xs" lineClamp={1}>{m.url}</Text>
        </Table.Td>
        <Table.Td>{m.order ?? 0}</Table.Td>
      </Table.Tr>
    ));
  }, [mediaItems]);

  const accessRows = useMemo(() => {
    return accessEntries.map((a) => (
      <Table.Tr key={`${a.userId}-${a.source}`}>
        <Table.Td>{a.userId}</Table.Td>
        <Table.Td><Badge variant="light">{a.source}</Badge></Table.Td>
        <Table.Td>{a.grantedAt ? new Date(a.grantedAt).toLocaleString() : '—'}</Table.Td>
      </Table.Tr>
    ));
  }, [accessEntries]);

  const auditRows = useMemo(() => {
    return auditEntries
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((e) => (
        <Table.Tr key={e.id}>
          <Table.Td>{new Date(e.createdAt).toLocaleString()}</Table.Td>
          <Table.Td><Badge variant="light">{e.action}</Badge></Table.Td>
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

          <Card shadow="sm" mt="md" p="md">
            <Stack gap="sm">
              <Text fw={700}>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</Text>
              <TextInput label="Title" value={formState.title} onChange={(e) => setFormState((s) => ({ ...s, title: e.currentTarget.value }))} />
              <Textarea label="Description" value={formState.description} onChange={(e) => setFormState((s) => ({ ...s, description: e.currentTarget.value }))} />
              <Group grow>
                <TextInput label="Company Slug" value={formState.company} onChange={(e) => setFormState((s) => ({ ...s, company: e.currentTarget.value }))} />
                <Select label="Status" data={[{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} value={formState.status} onChange={(v) => setFormState((s) => ({ ...s, status: (v ?? 'draft') as Campaign['status'] }))} />
                <Select label="Visibility" data={[{ value: 'private', label: 'Private' }, { value: 'public', label: 'Public' }]} value={formState.visibility} onChange={(v) => setFormState((s) => ({ ...s, visibility: (v ?? 'private') as Campaign['visibility'] }))} />
              </Group>
              <TextInput label="Tags (comma separated)" value={formState.tags} onChange={(e) => setFormState((s) => ({ ...s, tags: e.currentTarget.value }))} />
              <Group justify="flex-end">
                {editingCampaign && (
                  <Button variant="default" onClick={handleCreate}>Cancel</Button>
                )}
                <Button onClick={saveCampaign} loading={isSavingCampaign}>{editingCampaign ? 'Save Changes' : 'Create Campaign'}</Button>
              </Group>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="media" pt="md">
          <Group mb="md">
            <Select
              label="Campaign"
              placeholder="Select campaign"
              data={campaignSelectData}
              value={mediaCampaignId}
              onChange={(v) => setMediaCampaignId(v ?? '')}
              style={{ minWidth: 200 }}
            />
          </Group>
          {mediaLoading ? (
            <Center><Loader /></Center>
          ) : mediaItems.length === 0 ? (
            <Text c="dimmed">No media items yet.</Text>
          ) : (
            <ScrollArea>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>URL</Table.Th>
                    <Table.Th>Order</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{mediaRows}</Table.Tbody>
              </Table>
            </ScrollArea>
          )}
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
          {accessLoading ? (
            <Center><Loader /></Center>
          ) : accessEntries.length === 0 ? (
            <Text c="dimmed">No explicit access grants.</Text>
          ) : (
            <ScrollArea>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User ID</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Granted</Table.Th>
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
                    <Table.Th>When</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Details</Table.Th>
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
