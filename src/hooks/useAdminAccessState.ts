import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useCombobox } from '@mantine/core';
import type { ApiClient } from '@/services/apiClient';
import type { CompanyInfo, CompanyAccessGrant as CompanyAccessGrantType } from '@/hooks/useAdminSWR';
import { getErrorMessage } from '@/utils/getErrorMessage';

export interface WpUser {
  id: number;
  email: string;
  displayName: string;
  login: string;
  isAdmin: boolean;
}

export type AccessViewMode = 'campaign' | 'company' | 'all';

interface Options {
  apiClient: ApiClient;
  accessCampaignId: string;
  selectedCompanyId: string;
  accessViewMode: AccessViewMode;
  mutateAccess: () => Promise<unknown>;
  mutateCompanies: () => Promise<unknown>;
  mutateCampaigns: () => Promise<unknown>;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

export function useAdminAccessState({
  apiClient,
  accessCampaignId,
  selectedCompanyId,
  accessViewMode,
  mutateAccess,
  mutateCompanies,
  mutateCampaigns,
  onNotify,
}: Options) {
  const [accessUserId, setAccessUserId] = useState('');
  const [accessSource, setAccessSource] = useState<'company' | 'campaign'>('campaign');
  const [accessAction, setAccessAction] = useState<'grant' | 'deny'>('grant');
  const [accessSaving, setAccessSaving] = useState(false);

  const [confirmArchiveCompany, setConfirmArchiveCompany] = useState<CompanyInfo | null>(null);
  const [archiveRevokeAccess, setArchiveRevokeAccess] = useState(false);

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(userSearchQuery, 300);
  const [userSearchResults, setUserSearchResults] = useState<WpUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WpUser | null>(null);
  const userCombobox = useCombobox({ onDropdownClose: () => userCombobox.resetSelectedOption() });
  const blurTimeoutRef = useRef<number | null>(null);

  const [quickAddUserOpen, setQuickAddUserOpen] = useState(false);
  const [quickAddEmail, setQuickAddEmail] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddRole, setQuickAddRole] = useState('subscriber');
  const [quickAddCampaignId, setQuickAddCampaignId] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddResult, setQuickAddResult] = useState<{ success: boolean; message: string; resetUrl?: string } | null>(null);
  const [quickAddTestMode, setQuickAddTestMode] = useState(false);

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  // Search users when debounced query changes
  useEffect(() => {
    const controller = new AbortController();

    const searchUsers = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setUserSearchResults([]);
        setUserSearchLoading(false);
        return;
      }
      setUserSearchLoading(true);
      try {
        const response = await apiClient.get<{ users: WpUser[]; total: number }>(
          `/wp-json/wp-super-gallery/v1/users/search?search=${encodeURIComponent(debouncedSearch)}`,
          { signal: controller.signal },
        );
        setUserSearchResults(response.users ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setUserSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setUserSearchLoading(false);
      }
    };

    void searchUsers();
    return () => controller.abort();
  }, [debouncedSearch, apiClient]);

  const handleGrantAccess = useCallback(async () => {
    if (accessViewMode === 'campaign' && !accessCampaignId) return;
    if ((accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId) return;

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
        await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access`, {
          userId, source: accessSource, action: accessSource === 'company' ? 'grant' : accessAction,
        });
      } else {
        await apiClient.post(`/wp-json/wp-super-gallery/v1/companies/${selectedCompanyId}/access`, { userId });
      }
      await mutateAccess();
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
  }, [accessViewMode, accessCampaignId, selectedCompanyId, selectedUser, accessUserId, accessSource, accessAction, apiClient, mutateAccess, onNotify]);

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
  }, [accessViewMode, accessCampaignId, selectedCompanyId, apiClient, mutateAccess, onNotify]);

  const handleArchiveCompany = useCallback(async () => {
    if (!confirmArchiveCompany) return;
    setAccessSaving(true);
    try {
      const response = await apiClient.post<{ archivedCount: number }>(
        `/wp-json/wp-super-gallery/v1/companies/${confirmArchiveCompany.id}/archive`,
        { revokeAccess: archiveRevokeAccess }
      );
      onNotify({ type: 'success', text: `Archived ${response.archivedCount} campaigns.` });
      setConfirmArchiveCompany(null);
      setArchiveRevokeAccess(false);
      await Promise.all([mutateCompanies(), mutateCampaigns(), selectedCompanyId ? mutateAccess() : Promise.resolve()]);
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to archive company.') });
    } finally {
      setAccessSaving(false);
    }
  }, [confirmArchiveCompany, archiveRevokeAccess, apiClient, onNotify, mutateCompanies, mutateCampaigns, selectedCompanyId, mutateAccess]);

  const handleQuickAddUser = useCallback(async () => {
    if (!quickAddEmail || !quickAddName) {
      onNotify({ type: 'error', text: 'Email and name are required.' });
      return;
    }
    setQuickAddSaving(true);
    setQuickAddResult(null);
    try {
      const response = await apiClient.post<{
        message: string; userId: number; emailSent: boolean; accessGranted: boolean; resetUrl?: string; emailFailed?: boolean;
      }>('/wp-json/wp-super-gallery/v1/users', {
        email: quickAddEmail,
        displayName: quickAddName,
        role: quickAddRole,
        campaignId: quickAddCampaignId ? parseInt(quickAddCampaignId, 10) : 0,
        simulateEmailFailure: quickAddTestMode,
      });
      if (response.emailSent) {
        setQuickAddResult({ success: true, message: `User created! Password setup email sent to ${quickAddEmail}.` });
      } else {
        setQuickAddResult({ success: true, message: response.message, resetUrl: response.resetUrl });
      }
      if (response.accessGranted && accessCampaignId) await mutateAccess();
      setQuickAddEmail('');
      setQuickAddName('');
      setQuickAddRole('subscriber');
      setQuickAddCampaignId('');
    } catch (err) {
      setQuickAddResult({ success: false, message: getErrorMessage(err, 'Failed to create user.') });
    } finally {
      setQuickAddSaving(false);
    }
  }, [quickAddEmail, quickAddName, quickAddRole, quickAddCampaignId, quickAddTestMode, apiClient, accessCampaignId, mutateAccess, onNotify]);

  const closeQuickAddUser = useCallback(() => {
    setQuickAddUserOpen(false);
    setQuickAddEmail('');
    setQuickAddName('');
    setQuickAddRole('subscriber');
    setQuickAddCampaignId('');
    setQuickAddResult(null);
    setQuickAddTestMode(false);
  }, []);

  return {
    accessUserId, setAccessUserId,
    accessSource, setAccessSource,
    accessAction, setAccessAction,
    accessSaving,
    confirmArchiveCompany, setConfirmArchiveCompany,
    archiveRevokeAccess, setArchiveRevokeAccess,
    userSearchQuery, setUserSearchQuery,
    userSearchResults,
    userSearchLoading,
    selectedUser, setSelectedUser,
    userCombobox,
    blurTimeoutRef,
    quickAddUserOpen, setQuickAddUserOpen,
    quickAddEmail, setQuickAddEmail,
    quickAddName, setQuickAddName,
    quickAddRole, setQuickAddRole,
    quickAddCampaignId, setQuickAddCampaignId,
    quickAddSaving,
    quickAddResult,
    quickAddTestMode, setQuickAddTestMode,
    handleGrantAccess,
    handleRevokeAccess,
    handleArchiveCompany,
    handleQuickAddUser,
    closeQuickAddUser,
  };
}
