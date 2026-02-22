import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign } from '@/types';
import {
  Tabs,
  Button,
  Group,
  Card,
  Text,
  Table,
  Badge,
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
import { CampaignSelector } from '@/components/shared/CampaignSelector';
import { AdminCampaignArchiveModal } from './AdminCampaignArchiveModal';
import { AdminCampaignRestoreModal } from './AdminCampaignRestoreModal';
import { ArchiveCompanyModal } from './ArchiveCompanyModal';
import { QuickAddUserModal } from './QuickAddUserModal';
import { getErrorMessage } from '@/utils/getErrorMessage';
import {
  useAdminCampaigns,
  useAccessGrants,
  useCompanies,
  useAuditEntries,
  prefetchAllCampaignMedia,
  prefetchAllCampaignAccess,
  prefetchAllCampaignAudit,
  type AdminCampaign,
  type CompanyInfo,
  type CompanyAccessGrant as CompanyAccessGrantType,
} from '@/hooks/useAdminSWR';

const MediaTab = lazy(() => import('./MediaTab'));

// Types moved to useAdminSWR.ts hook — only keep AccessViewMode, WpUser locally.

interface WpUser {
  id: number;
  email: string;
  displayName: string;
  login: string;
  isAdmin: boolean;
}

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

  // P13-C: SWR-cached campaign list — no duplicate fetch, instant re-open.
  const { campaigns, campaignsLoading: isLoading, campaignsError: error, mutateCampaigns } = useAdminCampaigns(apiClient);

  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(null);
  const [formState, dispatchFormState] = useReducer(campaignFormReducer, { ...emptyForm });
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

  const [mediaCampaignId, setMediaCampaignId] = useState<string>('');
  

  const [accessCampaignId, setAccessCampaignId] = useState<string>('');
  const [accessUserId, setAccessUserId] = useState('');
  const [accessSource, setAccessSource] = useState<'company' | 'campaign'>('campaign');
  const [accessAction, setAccessAction] = useState<'grant' | 'deny'>('grant');
  const [accessSaving, setAccessSaving] = useState(false);
  
  // Company management state
  const [accessViewMode, setAccessViewMode] = useState<AccessViewMode>('campaign');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [confirmArchiveCompany, setConfirmArchiveCompany] = useState<CompanyInfo | null>(null);
  const [archiveRevokeAccess, setArchiveRevokeAccess] = useState(false);

  // P13-C: SWR-cached access, companies, and audit data.
  const accessTargetId = accessViewMode === 'campaign' ? accessCampaignId : selectedCompanyId;
  const { accessEntries, accessLoading, mutateAccess } = useAccessGrants(
    apiClient,
    accessViewMode,
    activeTab === 'access' ? accessTargetId : '', // only fetch when access tab active
  );
  const companiesEnabled = activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all');
  const { companies, companiesLoading, mutateCompanies } = useCompanies(apiClient, companiesEnabled);
  
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
  // P13-C: SWR-cached audit entries — only fetches when audit tab is active.
  const { auditEntries, auditLoading } = useAuditEntries(
    apiClient,
    activeTab === 'audit' ? auditCampaignId : '',
  );

  const [confirmArchive, setConfirmArchive] = useState<AdminCampaign | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<AdminCampaign | null>(null);
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [rescanAllLoading, setRescanAllLoading] = useState(false);
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);

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

  // Auto-select first company when in company/all mode
  useEffect(() => {
    if (activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(String(companies[0].id));
    }
  }, [activeTab, accessViewMode, selectedCompanyId, companies]);

  // Prefetch media for all campaigns when the media tab opens (Option B).
  // This runs in the background with staggered requests so switching between
  // campaigns in the media selector is instant (SWR cache hit).
  const mediaPrefetchedRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'media' && campaigns.length > 0 && !mediaPrefetchedRef.current) {
      mediaPrefetchedRef.current = true;
      void prefetchAllCampaignMedia(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);

  // Prefetch access grants for all campaigns when the access tab opens.
  const accessPrefetchedRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'access' && campaigns.length > 0 && !accessPrefetchedRef.current) {
      accessPrefetchedRef.current = true;
      void prefetchAllCampaignAccess(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);

  // Prefetch audit entries for all campaigns when the audit tab opens.
  const auditPrefetchedRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'audit' && campaigns.length > 0 && !auditPrefetchedRef.current) {
      auditPrefetchedRef.current = true;
      void prefetchAllCampaignAudit(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);

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
        await mutateAccess();
      } else {
        // Company/All mode: use company access endpoint
        await apiClient.post(`/wp-json/wp-super-gallery/v1/companies/${selectedCompanyId}/access`, {
          userId,
        });
        await mutateAccess();
      }
      onNotify({ type: 'success', text: 'Access updated.' });
      setAccessUserId('');
      setSelectedUser(null);
      setUserSearchQuery('');
      setAccessAction('grant');
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to update access.') });
    } finally {
      setAccessSaving(false);
    }
  };

  const handleRevokeAccess = useCallback(async (entry: CompanyAccessGrantType) => {
    setAccessSaving(true);
    try {
      if (accessViewMode === 'campaign') {
        if (!accessCampaignId) return;
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access/${entry.userId}`);
      } else if (entry.source === 'company' && selectedCompanyId) {
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/companies/${selectedCompanyId}/access/${entry.userId}`);
      } else if (entry.source === 'campaign' && entry.campaignId) {
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${entry.campaignId}/access/${entry.userId}`);
      }
      await mutateAccess();
      onNotify({ type: 'success', text: 'Access revoked.' });
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to revoke access.') });
    } finally {
      setAccessSaving(false);
    }
  }, [accessCampaignId, accessViewMode, apiClient, mutateAccess, onNotify, selectedCompanyId]);

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
      // Revalidate cached data
      await Promise.all([
        mutateCompanies(),
        mutateCampaigns(),
        selectedCompanyId ? mutateAccess() : Promise.resolve(),
      ]);
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to archive company.') });
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

      // Revalidate access if we granted access to a campaign
      if (response.accessGranted && accessCampaignId) {
        await mutateAccess();
      }

      // Clear form after success
      setQuickAddEmail('');
      setQuickAddName('');
      setQuickAddRole('subscriber');
      setQuickAddCampaignId('');
    } catch (err) {
      setQuickAddResult({
        success: false,
        message: getErrorMessage(err, 'Failed to create user.'),
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

  // loadAudit removed — SWR hook handles fetching automatically when auditCampaignId changes.

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
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to save campaign.') });
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const archiveCampaign = async (campaign: AdminCampaign) => {
    const id = String(campaign.id);
    setArchivingIds((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/archive`, {});
      onNotify({ type: 'success', text: 'Campaign archived.' });
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to archive campaign.') });
    } finally {
      setArchivingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const restoreCampaign = async (campaign: AdminCampaign) => {
    const id = String(campaign.id);
    setRestoringIds((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/restore`, {});
      onNotify({ type: 'success', text: 'Campaign restored.' });
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to restore campaign.') });
    } finally {
      setRestoringIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
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
              <Button color="teal" size="xs" leftSection={<IconArchiveOff size={14} />} loading={restoringIds.has(String(c.id))} onClick={() => setConfirmRestore(c)}>
                Restore
              </Button>
            ) : (
              <Button color="red" size="xs" leftSection={<IconTrash size={14} />} loading={archivingIds.has(String(c.id))} onClick={() => setConfirmArchive(c)}>
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
            <CampaignSelector
              data={campaignSelectData}
              value={mediaCampaignId}
              onChange={setMediaCampaignId}
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
            <MediaTab campaignId={mediaCampaignId} apiClient={apiClient} onCampaignsUpdated={onCampaignsUpdated} />
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
        onConfirm={async () => {
          if (confirmArchive) {
            setConfirmArchive(null);
            await archiveCampaign(confirmArchive);
          }
        }}
      />

      <AdminCampaignRestoreModal
        opened={!!confirmRestore}
        campaign={confirmRestore ? { id: confirmRestore.id, title: confirmRestore.title } : null}
        onClose={() => setConfirmRestore(null)}
        onConfirm={async () => {
          if (confirmRestore) {
            setConfirmRestore(null);
            await restoreCampaign(confirmRestore);
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
