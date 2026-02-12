import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign, CampaignAccessGrant } from '@/types';
import {
  Tabs,
  Button,
  Group,
  Card,
  Text,
  Table,
  Badge,
  Select,
  Stack,
  Loader,
  Center,
  Title,
  ActionIcon,
  Box,
  useCombobox,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconTrash, IconEdit, IconArrowLeft, IconRefresh, IconArchiveOff } from '@tabler/icons-react';
import { CampaignFormModal, type CampaignFormState } from './CampaignFormModal';
import { CampaignsTab } from './CampaignsTab';
import { AuditTab } from './AuditTab';
import { AccessTab } from './AccessTab';
import { AdminCampaignArchiveModal } from './AdminCampaignArchiveModal';
import { AdminCampaignRestoreModal } from './AdminCampaignRestoreModal';
import { ArchiveCompanyModal } from './ArchiveCompanyModal';
import { QuickAddUserModal } from './QuickAddUserModal';

const MediaTab = lazy(() => import('./MediaTab'));

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

type ListResponse<T> = T[] | { items?: T[]; entries?: T[]; grants?: T[]; data?: T[] };

const normalizeListResponse = <T,>(response: ListResponse<T>): T[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.entries)) return response.entries;
  if (Array.isArray(response.grants)) return response.grants;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

type AccessViewMode = 'campaign' | 'company' | 'all';

interface AdminPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onCampaignsUpdated: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

const emptyForm: CampaignFormState = {
  title: '',
  description: '',
  company: '',
  status: 'draft' as Campaign['status'],
  visibility: 'private' as Campaign['visibility'],
  tags: '',
};

const campaignFormReducer = (_state: CampaignFormState, next: CampaignFormState): CampaignFormState => next;

export function AdminPanel({ apiClient, onClose, onCampaignsUpdated, onNotify }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('campaigns');
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(null);
  const [formState, dispatchFormState] = useReducer(campaignFormReducer, { ...emptyForm });
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
    const timeoutId = blurTimeoutRef.current;
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Auto-select first campaign for media/access/audit tabs
  useEffect(() => {
    if (activeTab === 'media' && !mediaCampaignId && campaigns.length > 0) {
      setMediaCampaignId(String(campaigns[0].id));
    }
  }, [activeTab, campaigns, mediaCampaignId]);

  useEffect(() => {
    if (activeTab === 'access' && !accessCampaignId && campaigns.length > 0 && accessViewMode === 'campaign') {
      setAccessCampaignId(String(campaigns[0].id));
    }
  }, [activeTab, accessCampaignId, campaigns, accessViewMode]);

  useEffect(() => {
    if (activeTab === 'audit' && !auditCampaignId && campaigns.length > 0) {
      setAuditCampaignId(String(campaigns[0].id));
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
      const response = await apiClient.get<ListResponse<CompanyAccessGrant>>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access`);
      setAccessEntries(normalizeListResponse(response));
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load access entries.' });
      setAccessEntries([]);
    } finally {
      setAccessLoading(false);
    }
  }, [apiClient, onNotify]);

  // Load company access when company selected (company/all mode)
  const loadCompanyAccess = useCallback(async (companyId: string, includeCampaigns: boolean) => {
    if (!companyId) return;
    setAccessLoading(true);
    try {
      const url = `/wp-json/wp-super-gallery/v1/companies/${companyId}/access${includeCampaigns ? '?include_campaigns=true' : ''}`;
      const response = await apiClient.get<ListResponse<CompanyAccessGrant>>(url);
      setAccessEntries(normalizeListResponse(response));
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load company access entries.' });
      setAccessEntries([]);
    } finally {
      setAccessLoading(false);
    }
  }, [apiClient, onNotify]);

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

  const handleRevokeAccess = useCallback(async (entry: CompanyAccessGrant) => {
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
  }, [accessCampaignId, accessViewMode, apiClient, loadAccess, loadCompanyAccess, onNotify, selectedCompanyId]);

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
      const response = await apiClient.get<ListResponse<AuditEntry>>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/audit`);
      setAuditEntries(normalizeListResponse(response));
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load audit entries.' });
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  }, [apiClient, onNotify]);

  useEffect(() => {
    if (activeTab === 'audit' && auditCampaignId) {
      void loadAudit(auditCampaignId);
    }
  }, [activeTab, auditCampaignId, loadAudit]);

  const handleEdit = (campaign: AdminCampaign) => {
    setEditingCampaign(campaign);
    dispatchFormState({
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
    dispatchFormState({ ...emptyForm });
    setCampaignFormOpen(true);
  };

  const closeCampaignForm = () => {
    setCampaignFormOpen(false);
    setEditingCampaign(null);
    dispatchFormState({ ...emptyForm });
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
      value: String(c.id), 
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
    return campaigns.find((c) => String(c.id) === String(accessCampaignId)) || null;
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
          <Group gap="xs" wrap="wrap">
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
      <Table.Tr key={`${a.userId}-${a.source}-${a.campaignId || 'company'}`} style={a.source === 'company' ? { backgroundColor: 'color-mix(in srgb, var(--wpsg-color-primary) 5%, transparent)' } : undefined}>
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
            <ActionIcon color="red" variant="light" size="lg" onClick={() => handleRevokeAccess(a)} aria-label="Revoke access">
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
      <Stack gap="md" mb="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group>
            <ActionIcon variant="light" size="lg" onClick={onClose} aria-label="Back to gallery">
              <IconArrowLeft />
            </ActionIcon>
            <Title order={2} size="h3">Admin Panel</Title>
          </Group>
          <Button 
            leftSection={<IconPlus />} 
            onClick={handleCreate} 
            aria-label="Create new campaign"
            size="sm"
          >
            New Campaign
          </Button>
        </Group>
      </Stack>

      <Tabs value={activeTab} onChange={setActiveTab} aria-label="Admin panel sections">
        <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>
          <Tabs.Tab value="media">Media</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="audit">Audit</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="campaigns" pt="md">
          <CampaignsTab
            isLoading={isLoading}
            error={error}
            campaignsRows={campaignsRows}
          />
        </Tabs.Panel>

        {/* Campaign Form Modal */}
        <CampaignFormModal
          opened={campaignFormOpen}
          editingCampaign={editingCampaign}
          formState={formState}
          onFormChange={dispatchFormState}
          onClose={closeCampaignForm}
          onSave={saveCampaign}
          isSaving={isSavingCampaign}
          onGoToMedia={(campaignId) => {
            setMediaCampaignId(campaignId);
            closeCampaignForm();
            setActiveTab('media');
          }}
        />

        <Tabs.Panel value="media" pt="md">
          <Group mb="md" justify="space-between" wrap="wrap" gap="sm">
            <Select
              label={<Text size="sm" fw={500} c="gray.2">Campaign</Text>}
              placeholder="Select campaign"
              data={campaignSelectData}
              value={mediaCampaignId}
              onChange={(v) => setMediaCampaignId(v ?? '')}
              style={{ minWidth: 200, flex: '1 1 200px' }}
            />
            <Button
              variant="outline"
              leftSection={<IconRefresh size={18} />}
              loading={rescanAllLoading}
              style={{ flex: '0 0 auto' }}
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
          <Suspense fallback={<Center py="md"><Loader /></Center>}>
            <MediaTab campaignId={mediaCampaignId} apiClient={apiClient} />
          </Suspense>
        </Tabs.Panel>

        <Tabs.Panel value="access" pt="md">
          <AccessTab
            accessViewMode={accessViewMode}
            onAccessViewModeChange={(v) => setAccessViewMode(v)}
            campaignSelectData={campaignSelectData}
            accessCampaignId={accessCampaignId}
            onAccessCampaignChange={setAccessCampaignId}
            companySelectData={companySelectData}
            selectedCompanyId={selectedCompanyId}
            onSelectedCompanyChange={setSelectedCompanyId}
            companiesLoading={companiesLoading}
            selectedCampaign={selectedCampaign}
            selectedCompany={selectedCompany}
            accessEntriesCount={accessEntries.length}
            accessLoading={accessLoading}
            accessRows={accessRows}
            onArchiveCompanyClick={(company) => setConfirmArchiveCompany(company)}
            userCombobox={userCombobox}
            userSearchResults={userSearchResults}
            userSearchQuery={userSearchQuery}
            userSearchLoading={userSearchLoading}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            setUserSearchQuery={setUserSearchQuery}
            setAccessUserId={setAccessUserId}
            accessUserId={accessUserId}
            blurTimeoutRef={blurTimeoutRef}
            accessSource={accessSource}
            onAccessSourceChange={setAccessSource}
            accessAction={accessAction}
            onAccessActionChange={setAccessAction}
            onGrantAccess={handleGrantAccess}
            accessSaving={accessSaving}
            onQuickAddUser={() => {
              if (accessViewMode === 'campaign' && accessCampaignId) {
                setQuickAddCampaignId(accessCampaignId);
              }
              setQuickAddUserOpen(true);
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="audit" pt="md" component="section" aria-labelledby="audit-heading">
          <AuditTab
            campaignSelectData={campaignSelectData}
            auditCampaignId={auditCampaignId}
            onAuditCampaignChange={(v) => setAuditCampaignId(v ?? '')}
            auditLoading={auditLoading}
            auditEntriesCount={auditEntries.length}
            auditRows={auditRows}
          />
        </Tabs.Panel>
      </Tabs>

      <AdminCampaignArchiveModal
        opened={!!confirmArchive}
        campaign={confirmArchive ? { id: confirmArchive.id, title: confirmArchive.title } : null}
        onClose={() => setConfirmArchive(null)}
        onConfirm={() => {
          if (confirmArchive) {
            archiveCampaign(confirmArchive);
            setConfirmArchive(null);
          }
        }}
      />

      <AdminCampaignRestoreModal
        opened={!!confirmRestore}
        campaign={confirmRestore ? { id: confirmRestore.id, title: confirmRestore.title } : null}
        onClose={() => setConfirmRestore(null)}
        onConfirm={() => {
          if (confirmRestore) {
            restoreCampaign(confirmRestore);
            setConfirmRestore(null);
          }
        }}
      />

      <ArchiveCompanyModal
        opened={!!confirmArchiveCompany}
        company={confirmArchiveCompany}
        archiveRevokeAccess={archiveRevokeAccess}
        onArchiveRevokeAccessChange={setArchiveRevokeAccess}
        onClose={() => {
          setConfirmArchiveCompany(null);
          setArchiveRevokeAccess(false);
        }}
        onConfirm={handleArchiveCompany}
        accessSaving={accessSaving}
      />

      <QuickAddUserModal
        opened={quickAddUserOpen}
        onClose={closeQuickAddUser}
        quickAddResult={quickAddResult}
        quickAddEmail={quickAddEmail}
        setQuickAddEmail={setQuickAddEmail}
        quickAddName={quickAddName}
        setQuickAddName={setQuickAddName}
        quickAddRole={quickAddRole}
        setQuickAddRole={setQuickAddRole}
        quickAddCampaignId={quickAddCampaignId}
        setQuickAddCampaignId={setQuickAddCampaignId}
        quickAddTestMode={quickAddTestMode}
        setQuickAddTestMode={setQuickAddTestMode}
        campaigns={campaigns}
        onSubmit={handleQuickAddUser}
        quickAddSaving={quickAddSaving}
        onNotify={onNotify}
      />
    </Card>
  );
}
