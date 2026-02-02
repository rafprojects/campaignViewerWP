import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  SegmentedControl,
  Alert,
  Checkbox,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconTrash, IconEdit, IconArrowLeft, IconRefresh, IconSearch, IconAlertCircle, IconArchive, IconArchiveOff, IconUserPlus } from '@tabler/icons-react';
import MediaTab from './MediaTab';

type AdminCampaign = Pick<Campaign, 'id' | 'title' | 'description' | 'status' | 'visibility' | 'createdAt' | 'updatedAt'> & {
  companyId: string;
  companyName?: string;
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

interface CompanyInfo {
  id: number;
  name: string;
  slug: string;
  campaignCount: number;
  activeCampaigns: number;
  archivedCampaigns: number;
  accessGrantCount: number;
  campaigns: Array<{ id: number; title: string; status: string }>;
}

interface CompanyAccessGrant extends CampaignAccessGrant {
  companyId?: number;
  companyName?: string;
  campaignTitle?: string;
  campaignStatus?: string;
}

type AccessViewMode = 'campaign' | 'company' | 'all';

interface AdminPanelProps {
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
  const [accessEntries, setAccessEntries] = useState<CompanyAccessGrant[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessUserId, setAccessUserId] = useState('');
  const [accessSource, setAccessSource] = useState<'company' | 'campaign'>('campaign');
  const [accessAction, setAccessAction] = useState<'grant' | 'deny'>('grant');
  const [accessSaving, setAccessSaving] = useState(false);
  
  // Company management state
  const [accessViewMode, setAccessViewMode] = useState<AccessViewMode>('campaign');
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [confirmArchiveCompany, setConfirmArchiveCompany] = useState<CompanyInfo | null>(null);
  const [archiveRevokeAccess, setArchiveRevokeAccess] = useState(false);
  
  // User search state for searchable picker
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(userSearchQuery, 300);
  const [userSearchResults, setUserSearchResults] = useState<WpUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WpUser | null>(null);
  const userCombobox = useCombobox({
    onDropdownClose: () => userCombobox.resetSelectedOption(),
  });
  const blurTimeoutRef = useRef<number | null>(null);

  // Quick Add User state
  const [quickAddUserOpen, setQuickAddUserOpen] = useState(false);
  const [quickAddEmail, setQuickAddEmail] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddRole, setQuickAddRole] = useState('subscriber');
  const [quickAddCampaignId, setQuickAddCampaignId] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddResult, setQuickAddResult] = useState<{ success: boolean; message: string; resetUrl?: string } | null>(null);
  const [quickAddTestMode, setQuickAddTestMode] = useState(false);

  const [auditCampaignId, setAuditCampaignId] = useState<string>('');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [confirmArchive, setConfirmArchive] = useState<AdminCampaign | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<AdminCampaign | null>(null);
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

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Auto-select first campaign for media/access/audit tabs
  useEffect(() => {
    if (activeTab === 'media' && !mediaCampaignId && campaigns.length > 0) {
      setMediaCampaignId(campaigns[0].id);
    }
  }, [activeTab, campaigns, mediaCampaignId]);

  useEffect(() => {
    if (activeTab === 'access' && !accessCampaignId && campaigns.length > 0 && accessViewMode === 'campaign') {
      setAccessCampaignId(campaigns[0].id);
    }
  }, [activeTab, accessCampaignId, campaigns, accessViewMode]);

  useEffect(() => {
    if (activeTab === 'audit' && !auditCampaignId && campaigns.length > 0) {
      setAuditCampaignId(campaigns[0].id);
    }
  }, [activeTab, auditCampaignId, campaigns]);

  // Load companies list
  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const response = await apiClient.get<CompanyInfo[]>('/wp-json/wp-super-gallery/v1/companies');
      setCompanies(response ?? []);
    } catch {
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }, [apiClient]);

  // Load companies when switching to access tab with company/all view
  useEffect(() => {
    if (activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all')) {
      void loadCompanies();
    }
  }, [activeTab, accessViewMode, loadCompanies]);

  // Auto-select first company when in company/all mode
  useEffect(() => {
    if (activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(String(companies[0].id));
    }
  }, [activeTab, accessViewMode, selectedCompanyId, companies]);

  // Load access when campaign selected (campaign mode)
  const loadAccess = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    setAccessLoading(true);
    try {
      const response = await apiClient.get<CompanyAccessGrant[]>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access`);
      setAccessEntries(response ?? []);
    } catch {
      setAccessEntries([]);
    } finally {
      setAccessLoading(false);
    }
  }, [apiClient]);

  // Load company access when company selected (company/all mode)
  const loadCompanyAccess = useCallback(async (companyId: string, includeCampaigns: boolean) => {
    if (!companyId) return;
    setAccessLoading(true);
    try {
      const url = `/wp-json/wp-super-gallery/v1/companies/${companyId}/access${includeCampaigns ? '?include_campaigns=true' : ''}`;
      const response = await apiClient.get<CompanyAccessGrant[]>(url);
      setAccessEntries(response ?? []);
    } catch {
      setAccessEntries([]);
    } finally {
      setAccessLoading(false);
    }
  }, [apiClient]);

  // Load access based on view mode
  useEffect(() => {
    if (activeTab !== 'access') return;
    
    if (accessViewMode === 'campaign' && accessCampaignId) {
      void loadAccess(accessCampaignId);
    } else if (accessViewMode === 'company' && selectedCompanyId) {
      void loadCompanyAccess(selectedCompanyId, false);
    } else if (accessViewMode === 'all' && selectedCompanyId) {
      void loadCompanyAccess(selectedCompanyId, true);
    }
  }, [activeTab, accessViewMode, accessCampaignId, selectedCompanyId, loadAccess, loadCompanyAccess]);

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
    // Validate we have a target (campaign or company based on mode)
    if (accessViewMode === 'campaign' && !accessCampaignId) return;
    if ((accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId) return;
    
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
      if (accessViewMode === 'campaign') {
        // Campaign mode: use existing campaign access endpoint
        await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access`, {
          userId,
          source: accessSource,
          action: accessSource === 'company' ? 'grant' : accessAction,
        });
        await loadAccess(accessCampaignId);
      } else {
        // Company/All mode: use company access endpoint
        await apiClient.post(`/wp-json/wp-super-gallery/v1/companies/${selectedCompanyId}/access`, {
          userId,
        });
        await loadCompanyAccess(selectedCompanyId, accessViewMode === 'all');
      }
      onNotify({ type: 'success', text: 'Access updated.' });
      setAccessUserId('');
      setSelectedUser(null);
      setUserSearchQuery('');
      setAccessAction('grant');
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update access.' });
    } finally {
      setAccessSaving(false);
    }
  };

  const handleRevokeAccess = async (entry: CompanyAccessGrant) => {
    setAccessSaving(true);
    try {
      if (accessViewMode === 'campaign') {
        if (!accessCampaignId) return;
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access/${entry.userId}`);
        await loadAccess(accessCampaignId);
      } else if (entry.source === 'company' && selectedCompanyId) {
        // Revoke company-level access
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/companies/${selectedCompanyId}/access/${entry.userId}`);
        await loadCompanyAccess(selectedCompanyId, accessViewMode === 'all');
      } else if (entry.source === 'campaign' && entry.campaignId) {
        // Revoke campaign-level access (from All view)
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${entry.campaignId}/access/${entry.userId}`);
        await loadCompanyAccess(selectedCompanyId, accessViewMode === 'all');
      }
      onNotify({ type: 'success', text: 'Access revoked.' });
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to revoke access.' });
    } finally {
      setAccessSaving(false);
    }
  };

  // Handle archive company (bulk archive all campaigns)
  const handleArchiveCompany = async () => {
    if (!confirmArchiveCompany) return;
    setAccessSaving(true);
    try {
      const response = await apiClient.post<{ archivedCount: number }>(`/wp-json/wp-super-gallery/v1/companies/${confirmArchiveCompany.id}/archive`, {
        revokeAccess: archiveRevokeAccess,
      });
      onNotify({ type: 'success', text: `Archived ${response.archivedCount} campaigns.` });
      setConfirmArchiveCompany(null);
      setArchiveRevokeAccess(false);
      // Reload data
      await loadCompanies();
      await loadCampaigns();
      if (selectedCompanyId) {
        await loadCompanyAccess(selectedCompanyId, accessViewMode === 'all');
      }
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to archive company.' });
    } finally {
      setAccessSaving(false);
    }
  };

  // Handle quick add user
  const handleQuickAddUser = async () => {
    if (!quickAddEmail || !quickAddName) {
      onNotify({ type: 'error', text: 'Email and name are required.' });
      return;
    }
    setQuickAddSaving(true);
    setQuickAddResult(null);
    try {
      const response = await apiClient.post<{
        message: string;
        userId: number;
        emailSent: boolean;
        accessGranted: boolean;
        resetUrl?: string;
        emailFailed?: boolean;
      }>('/wp-json/wp-super-gallery/v1/users', {
        email: quickAddEmail,
        displayName: quickAddName,
        role: quickAddRole,
        campaignId: quickAddCampaignId ? parseInt(quickAddCampaignId) : 0,
        simulateEmailFailure: quickAddTestMode,
      });

      if (response.emailSent) {
        setQuickAddResult({
          success: true,
          message: `User created! Password setup email sent to ${quickAddEmail}.`,
        });
      } else {
        setQuickAddResult({
          success: true,
          message: response.message,
          resetUrl: response.resetUrl,
        });
      }

      // Reload access if we're on a campaign that was granted access
      if (response.accessGranted && accessCampaignId) {
        await loadAccess(accessCampaignId);
      }

      // Clear form after success
      setQuickAddEmail('');
      setQuickAddName('');
      setQuickAddRole('subscriber');
      setQuickAddCampaignId('');
    } catch (err) {
      setQuickAddResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to create user.',
      });
    } finally {
      setQuickAddSaving(false);
    }
  };

  const closeQuickAddUser = () => {
    setQuickAddUserOpen(false);
    setQuickAddEmail('');
    setQuickAddName('');
    setQuickAddRole('subscriber');
    setQuickAddCampaignId('');
    setQuickAddResult(null);
    setQuickAddTestMode(false);
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

  const restoreCampaign = async (campaign: AdminCampaign) => {
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/restore`, {});
      onNotify({ type: 'success', text: 'Campaign restored.' });
      await loadCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to restore campaign.' });
    }
  };

  const campaignSelectData = useMemo(() => {
    return campaigns.map((c) => ({ 
      value: c.id, 
      label: c.companyId ? `${c.title} (${c.companyId})` : c.title 
    }));
  }, [campaigns]);

  const companySelectData = useMemo(() => {
    return companies.map((c) => ({ 
      value: String(c.id), 
      label: `${c.name} (${c.activeCampaigns} active, ${c.archivedCampaigns} archived)` 
    }));
  }, [companies]);

  // Get the currently selected campaign with company info
  const selectedCampaign = useMemo(() => {
    if (!accessCampaignId) return null;
    return campaigns.find((c) => c.id === accessCampaignId) || null;
  }, [accessCampaignId, campaigns]);

  // Get the currently selected company info
  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((c) => String(c.id) === selectedCompanyId) || null;
  }, [selectedCompanyId, companies]);

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
            {c.status === 'archived' ? (
              <Button color="teal" size="xs" leftSection={<IconArchiveOff size={14} />} onClick={() => setConfirmRestore(c)}>
                Restore
              </Button>
            ) : (
              <Button color="red" size="xs" leftSection={<IconTrash size={14} />} onClick={() => setConfirmArchive(c)}>
                Archive
              </Button>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
    ));
  }, [campaigns]);

  

  const accessRows = useMemo(() => {
    return accessEntries.map((a) => (
      <Table.Tr key={`${a.userId}-${a.source}-${a.campaignId || 'company'}`} style={a.source === 'company' ? { backgroundColor: 'rgba(34, 139, 230, 0.05)' } : undefined}>
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
            <Tooltip label={a.source === 'company' ? 'Company-wide access - applies to all campaigns' : 'Direct campaign access'}>
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
            <ActionIcon color="red" variant="light" onClick={() => handleRevokeAccess(a)} aria-label="Revoke access">
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
      </Table.Tr>
    ));
  }, [accessEntries, accessViewMode, handleRevokeAccess]);

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
          {/* View Mode Toggle */}
          <Card shadow="sm" withBorder mb="md" p="sm">
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
              <Group align="flex-end" gap="md">
                <Box>
                  <Text size="sm" fw={500} mb={4}>View By</Text>
                  <SegmentedControl
                    value={accessViewMode}
                    onChange={(v) => setAccessViewMode(v as AccessViewMode)}
                    data={[
                      { value: 'campaign', label: '📋 Campaign' },
                      { value: 'company', label: '🏢 Company' },
                      { value: 'all', label: '📊 All' },
                    ]}
                  />
                </Box>

                {accessViewMode === 'campaign' ? (
                  <Select
                    label="Select Campaign"
                    placeholder="Choose a campaign..."
                    data={campaignSelectData}
                    value={accessCampaignId}
                    onChange={(v) => setAccessCampaignId(v ?? '')}
                    style={{ minWidth: 280 }}
                  />
                ) : (
                  <Select
                    label="Select Company"
                    placeholder={companiesLoading ? 'Loading...' : 'Choose a company...'}
                    data={companySelectData}
                    value={selectedCompanyId}
                    onChange={(v) => setSelectedCompanyId(v ?? '')}
                    disabled={companiesLoading}
                    style={{ minWidth: 280 }}
                  />
                )}
              </Group>

              {/* Context info */}
              <Group gap="md">
                {accessViewMode === 'campaign' && selectedCampaign && (
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">Company:</Text>
                      <Badge variant="light">{selectedCampaign.companyId || 'None'}</Badge>
                    </Group>
                    {selectedCampaign.status === 'archived' && (
                      <Alert color="yellow" variant="light" p="xs" icon={<IconAlertCircle size={16} />}>
                        <Text size="xs">Archived campaign - grants inactive</Text>
                      </Alert>
                    )}
                  </Stack>
                )}
                {(accessViewMode === 'company' || accessViewMode === 'all') && selectedCompany && (
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">Campaigns:</Text>
                      <Badge variant="light" color="green">{selectedCompany.activeCampaigns} active</Badge>
                      <Badge variant="light" color="gray">{selectedCompany.archivedCampaigns} archived</Badge>
                    </Group>
                    {selectedCompany.activeCampaigns > 0 && (
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        leftSection={<IconArchive size={14} />}
                        onClick={() => setConfirmArchiveCompany(selectedCompany)}
                      >
                        Archive All Campaigns
                      </Button>
                    )}
                  </Stack>
                )}
                <Text size="sm" c="dimmed">
                  {accessEntries.length} user{accessEntries.length !== 1 ? 's' : ''} with access
                </Text>
              </Group>
            </Group>
          </Card>

          {/* Empty state */}
          {(accessViewMode === 'campaign' && !accessCampaignId) || 
           ((accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId) ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <Text c="dimmed">
                  {accessViewMode === 'campaign' 
                    ? 'Select a campaign to manage access permissions'
                    : 'Select a company to manage access permissions'}
                </Text>
              </Stack>
            </Center>
          ) : (
            <>
              {/* Current Access - Show this first and prominently */}
              <Card shadow="sm" withBorder mb="md">
                <Group justify="space-between" mb="sm">
                  <Text fw={600} size="lg">
                    {accessViewMode === 'campaign' ? 'Current Access' : 
                     accessViewMode === 'company' ? 'Company-Wide Access' : 
                     'All Access (Company + Campaigns)'}
                  </Text>
                  <Badge variant="light">{accessEntries.length} users</Badge>
                </Group>
                
                {accessLoading ? (
                  <Center py="md"><Loader /></Center>
                ) : accessEntries.length === 0 ? (
                  <Text c="dimmed" ta="center" py="md">
                    {accessViewMode === 'campaign' 
                      ? 'No users have access to this campaign yet. Add users below.'
                      : accessViewMode === 'company'
                      ? 'No company-wide access grants. Add users below.'
                      : 'No access grants found for this company or its campaigns.'}
                  </Text>
                ) : (
                  <ScrollArea style={{ maxHeight: 300 }}>
                    <Table verticalSpacing="xs" highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>User</Table.Th>
                          <Table.Th>Access Type</Table.Th>
                          <Table.Th>Granted</Table.Th>
                          <Table.Th w={80}>Revoke</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>{accessRows}</Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Card>

              {/* Grant Access Form - Unified and compact */}
              <Card shadow="sm" withBorder>
                <Text fw={600} size="lg" mb="sm">
                  {accessViewMode === 'campaign' ? 'Grant New Access' : 'Grant Company-Wide Access'}
                </Text>
                
                <Group align="flex-end" gap="sm" wrap="wrap">
                  {/* Unified user search with ID fallback built-in */}
                  <Box style={{ flex: 1, minWidth: 250 }}>
                    <Combobox
                      store={userCombobox}
                      onOptionSubmit={(val) => {
                        const user = userSearchResults.find((u) => String(u.id) === val);
                        if (user) {
                          setSelectedUser(user);
                          setAccessUserId('');
                          setUserSearchQuery('');
                        }
                        userCombobox.closeDropdown();
                      }}
                    >
                      <Combobox.Target>
                        <InputBase
                          label="User"
                          placeholder="Search name, email, or enter ID..."
                          value={selectedUser ? `${selectedUser.displayName} (${selectedUser.email})` : userSearchQuery}
                          onChange={(e) => {
                            const val = e.currentTarget.value;
                            setUserSearchQuery(val);
                            setSelectedUser(null);
                            // If it looks like a number, treat as User ID
                            if (/^\d+$/.test(val)) {
                              setAccessUserId(val);
                            } else {
                              setAccessUserId('');
                            }
                            userCombobox.openDropdown();
                            userCombobox.updateSelectedOptionIndex();
                          }}
                          onClick={() => userCombobox.openDropdown()}
                          onFocus={() => userCombobox.openDropdown()}
                          onBlur={() => {
                            if (blurTimeoutRef.current) {
                              clearTimeout(blurTimeoutRef.current);
                            }
                            blurTimeoutRef.current = setTimeout(() => {
                              userCombobox.closeDropdown();
                              blurTimeoutRef.current = null;
                            }, 150);
                          }}
                          rightSection={
                            selectedUser ? (
                              <ActionIcon 
                                size="sm" 
                                variant="subtle" 
                                onClick={() => {
                                  setSelectedUser(null);
                                  setUserSearchQuery('');
                                  setAccessUserId('');
                                }}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            ) : userSearchLoading ? (
                              <Loader size={16} />
                            ) : (
                              <IconSearch size={16} />
                            )
                          }
                          rightSectionPointerEvents={selectedUser ? 'auto' : 'none'}
                        />
                      </Combobox.Target>

                      <Combobox.Dropdown>
                        <Combobox.Options>
                          {userSearchResults.length === 0 && userSearchQuery.length >= 2 && !userSearchLoading && !/^\d+$/.test(userSearchQuery) && (
                            <Combobox.Empty>No users found</Combobox.Empty>
                          )}
                          {/^\d+$/.test(userSearchQuery) && (
                            <Combobox.Empty>Using User ID: {userSearchQuery}</Combobox.Empty>
                          )}
                          {userSearchQuery.length < 2 && !/^\d+$/.test(userSearchQuery) && (
                            <Combobox.Empty>Type name/email or enter user ID</Combobox.Empty>
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
                  </Box>

                  {/* Campaign mode: show scope and action options */}
                  {accessViewMode === 'campaign' && (
                    <>
                      <Select
                        label="Scope"
                        data={[
                          { value: 'campaign', label: '📋 This Campaign' },
                          { value: 'company', label: '🏢 All Company Campaigns' },
                        ]}
                        value={accessSource}
                        onChange={(v) => setAccessSource((v as 'company' | 'campaign') ?? 'campaign')}
                        style={{ minWidth: 180 }}
                      />

                      <Select
                        label="Action"
                        data={[
                          { value: 'grant', label: '✅ Grant Access' },
                          { value: 'deny', label: '❌ Deny Access' },
                        ]}
                        value={accessAction}
                        onChange={(v) => setAccessAction((v as 'grant' | 'deny') ?? 'grant')}
                        disabled={accessSource === 'company'}
                        style={{ minWidth: 150 }}
                      />
                    </>
                  )}

                  <Button 
                    onClick={handleGrantAccess} 
                    loading={accessSaving}
                    disabled={!selectedUser && !accessUserId}
                  >
                    Apply
                  </Button>

                  <Tooltip label="Create a new user">
                    <Button
                      variant="light"
                      leftSection={<IconUserPlus size={16} />}
                      onClick={() => {
                        // Pre-fill campaign if in campaign mode
                        if (accessViewMode === 'campaign' && accessCampaignId) {
                          setQuickAddCampaignId(accessCampaignId);
                        }
                        setQuickAddUserOpen(true);
                      }}
                    >
                      Quick Add User
                    </Button>
                  </Tooltip>
                </Group>

                {accessViewMode === 'campaign' && accessSource === 'company' && (
                  <Text size="xs" c="dimmed" mt="xs">
                    Company-level grants give access to all campaigns under the same company.
                  </Text>
                )}
                {(accessViewMode === 'company' || accessViewMode === 'all') && (
                  <Text size="xs" c="dimmed" mt="xs">
                    Grants apply to all current and future campaigns for this company.
                  </Text>
                )}
              </Card>
            </>
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

      <Modal opened={!!confirmRestore} onClose={() => setConfirmRestore(null)} title="Restore campaign">
        <Text>Restore this campaign? This will make it active again and enable any associated access grants.</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setConfirmRestore(null)}>Cancel</Button>
          <Button color="teal" onClick={() => { if (confirmRestore) { restoreCampaign(confirmRestore); setConfirmRestore(null); } }}>Restore</Button>
        </Group>
      </Modal>

      <Modal 
        opened={!!confirmArchiveCompany} 
        onClose={() => { setConfirmArchiveCompany(null); setArchiveRevokeAccess(false); }} 
        title="Archive all company campaigns"
      >
        <Stack gap="md">
          <Text>
            Archive all campaigns for <strong>{confirmArchiveCompany?.name}</strong>? 
            This will archive {confirmArchiveCompany?.activeCampaigns} active campaign{confirmArchiveCompany?.activeCampaigns !== 1 ? 's' : ''}.
          </Text>
          
          {confirmArchiveCompany && confirmArchiveCompany.campaigns.filter(c => c.status !== 'archived').length > 0 && (
            <Box>
              <Text size="sm" fw={500} mb="xs">Campaigns to be archived:</Text>
              <ScrollArea style={{ maxHeight: 150 }}>
                <Stack gap={4}>
                  {confirmArchiveCompany.campaigns
                    .filter(c => c.status !== 'archived')
                    .map(c => (
                      <Text key={c.id} size="sm" c="dimmed">• {c.title}</Text>
                    ))}
                </Stack>
              </ScrollArea>
            </Box>
          )}

          <Checkbox
            label="Also revoke all company-level access grants"
            checked={archiveRevokeAccess}
            onChange={(e) => setArchiveRevokeAccess(e.currentTarget.checked)}
          />

          <Alert color="yellow" variant="light">
            <Text size="sm">Access grants for individual campaigns will be preserved but become inactive.</Text>
          </Alert>
        </Stack>
        
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setConfirmArchiveCompany(null); setArchiveRevokeAccess(false); }}>Cancel</Button>
          <Button color="red" onClick={handleArchiveCompany} loading={accessSaving}>
            Archive {confirmArchiveCompany?.activeCampaigns} Campaign{confirmArchiveCompany?.activeCampaigns !== 1 ? 's' : ''}
          </Button>
        </Group>
      </Modal>

      {/* Quick Add User Modal */}
      <Modal 
        opened={quickAddUserOpen} 
        onClose={closeQuickAddUser} 
        title="Quick Add User"
        size="md"
      >
        <Stack gap="md">
          {quickAddResult ? (
            <>
              <Alert 
                color={quickAddResult.success ? 'teal' : 'red'} 
                title={quickAddResult.success ? 'Success' : 'Error'}
              >
                <Text size="sm">{quickAddResult.message}</Text>
                {quickAddResult.resetUrl && (
                  <Box mt="sm">
                    <Text size="sm" fw={500}>Password Reset Link:</Text>
                    <TextInput
                      value={quickAddResult.resetUrl}
                      readOnly
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      rightSection={(
                        <Tooltip label="Click to select">
                          <IconAlertCircle size={16} />
                        </Tooltip>
                      )}
                    />
                    <Group mt="xs" gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        component="a"
                        href={quickAddResult.resetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Reset Link
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => {
                          navigator.clipboard.writeText(quickAddResult.resetUrl!);
                          onNotify({ type: 'success', text: 'Reset URL copied to clipboard' });
                        }}
                      >
                        Copy Link
                      </Button>
                    </Group>
                    <Text size="xs" c="dimmed" mt="xs">
                      Share this link securely with the user. They can use it to set their own password.
                    </Text>
                  </Box>
                )}
              </Alert>
              <Group justify="flex-end">
                <Button onClick={closeQuickAddUser}>Close</Button>
              </Group>
            </>
          ) : (
            <>
              <TextInput
                label="Email"
                placeholder="user@example.com"
                required
                value={quickAddEmail}
                onChange={(e) => setQuickAddEmail(e.currentTarget.value)}
              />

              <TextInput
                label="Display Name"
                placeholder="John Doe"
                required
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.currentTarget.value)}
              />

              <Select
                label="Role"
                data={[
                  { value: 'subscriber', label: '👁 Viewer - Can view granted campaigns' },
                  { value: 'wpsg_admin', label: '⚙️ Gallery Admin - Can manage this plugin' },
                ]}
                value={quickAddRole}
                onChange={(v) => setQuickAddRole(v ?? 'subscriber')}
              />

              <Select
                label="Grant Access To (optional)"
                placeholder="No initial access"
                data={[
                  { value: '', label: 'No initial access' },
                  ...campaigns.filter(c => c.status === 'active').map((c) => ({ 
                    value: c.id, 
                    label: c.companyId ? `${c.title} (${c.companyId})` : c.title 
                  })),
                ]}
                value={quickAddCampaignId}
                onChange={(v) => setQuickAddCampaignId(v ?? '')}
                clearable
              />

              <Checkbox
                label="🧪 Test mode: Simulate email failure"
                checked={quickAddTestMode}
                onChange={(e) => setQuickAddTestMode(e.currentTarget.checked)}
                description="Enable to test the password reset link UI without actually sending email"
              />

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeQuickAddUser}>Cancel</Button>
                <Button 
                  onClick={handleQuickAddUser} 
                  loading={quickAddSaving}
                  disabled={!quickAddEmail || !quickAddName}
                  leftSection={<IconUserPlus size={16} />}
                >
                  Create User
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Card>
  );
}
