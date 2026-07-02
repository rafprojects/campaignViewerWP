import type { ReactNode } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Combobox,
  Group,
  ScrollArea,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconArchive, IconUserPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { CampaignSelector, type CampaignSelectItem } from '@/components/Common/CampaignSelector';
import { SearchableEntityInput } from '@/components/Common/SearchableEntityInput';
import { PendingRequestsPanel } from './PendingRequestsPanel';
import type { ApiClient } from '@/services/apiClient';
import type { AdminAccessState } from '@/hooks/useAdminAccessState';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

type AccessViewMode = 'campaign' | 'company' | 'all';

type SelectedCampaign = {
  companyId?: string | undefined;
  status?: string | undefined;
} | null;

type SelectedCompany = {
  id: number;
  name: string;
  slug: string;
  campaignCount: number;
  activeCampaigns: number;
  archivedCampaigns: number;
  accessGrantCount: number;
  campaigns: Array<{ id: number; title: string; status: string }>;
} | null;

interface AccessTabProps {
  accessViewMode: AccessViewMode;
  onAccessViewModeChange: (value: AccessViewMode) => void;
  campaignSelectData: CampaignSelectItem[];
  accessCampaignId: string;
  onAccessCampaignChange: (value: string) => void;
  companySelectData: Array<{ value: string; label: string }>;
  selectedCompanyId: string;
  onSelectedCompanyChange: (value: string) => void;
  companiesLoading: boolean;
  selectedCampaign: SelectedCampaign;
  selectedCompany: SelectedCompany;
  accessEntriesCount: number;
  accessLoading: boolean;
  accessRows: ReactNode;
  accessState: AdminAccessState;
  apiClient?: ApiClient | undefined;
  showExpiredGrants: boolean;
  onShowExpiredGrantsChange: (value: boolean) => void;
  isMobile?: boolean;
  /**
   * P53-A: Company / All views read company-level access (require_system_admin).
   * Editors only manage per-campaign access, so the view-mode toggle is hidden
   * for them and the mode stays 'campaign'.
   */
  isSystemAdmin?: boolean;
}

export function AccessTab({
  accessViewMode,
  onAccessViewModeChange,
  campaignSelectData,
  accessCampaignId,
  onAccessCampaignChange,
  companySelectData,
  selectedCompanyId,
  onSelectedCompanyChange,
  companiesLoading,
  selectedCampaign,
  selectedCompany,
  accessEntriesCount,
  accessLoading,
  accessRows,
  accessState,
  apiClient,
  showExpiredGrants,
  onShowExpiredGrantsChange,
  isMobile = false,
  isSystemAdmin = false,
}: AccessTabProps) {
  const { t } = useTranslation('wpsg');
  const {
    userSearchResults,
    userSearchQuery,
    userSearchLoading,
    selectedUser,
    setSelectedUser,
    setUserSearchQuery,
    setAccessUserId,
    accessUserId,
    accessSource,
    setAccessSource: onAccessSourceChange,
    accessAction,
    setAccessAction: onAccessActionChange,
    handleGrantAccess: onGrantAccess,
    accessSaving,
    handleOpenQuickAddUser: onQuickAddUser,
    setConfirmArchiveCompany,
    expiresAt,
    setExpiresAt,
    accessLevel,
    setAccessLevel: onAccessLevelChange,
  } = accessState;

  const onArchiveCompanyClick = (company: NonNullable<SelectedCompany>) => setConfirmArchiveCompany(company);

  return (
    <>
      {/* View Mode Toggle */}
      <Card shadow="sm" withBorder mb="md" p={{ base: 'sm', md: 'md' }}>
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Group align="flex-end" gap="md" wrap="wrap">
            {/* P53-A: Company / All are system-admin only; editors see campaign access only. */}
            {isSystemAdmin && (
              <Box>
                <Text size="sm" fw={500} mb={4}>{t('admin_access_view_by', 'View By')}</Text>
                <SegmentedControl
                  value={accessViewMode}
                  onChange={(v) => onAccessViewModeChange(v as AccessViewMode)}
                  data={[
                    { value: 'campaign', label: t('admin_access_view_campaign', '📋 Campaign') },
                    { value: 'company', label: t('admin_access_view_company', '🏢 Company') },
                    { value: 'all', label: t('admin_access_view_all', '📊 All') },
                  ]}
                  aria-label={t('admin_access_view_mode_aria', 'Access view mode')}
                />
              </Box>
            )}

            {accessViewMode === 'campaign' ? (
              <CampaignSelector
                label={t('admin_access_select_campaign', 'Select Campaign')}
                placeholder={t('admin_access_choose_campaign', 'Choose a campaign...')}
                data={campaignSelectData}
                value={accessCampaignId}
                onChange={onAccessCampaignChange}
                style={{ minWidth: 240, flex: '1 1 240px' }}
              />
            ) : (
              <Select
                label={<Text size="sm" fw={500}>{t('admin_access_select_company', 'Select Company')}</Text>}
                placeholder={companiesLoading ? t('admin_access_loading', 'Loading...') : t('admin_access_choose_company', 'Choose a company...')}
                data={companySelectData}
                value={selectedCompanyId}
                onChange={(v) => onSelectedCompanyChange(v ?? '')}
                disabled={companiesLoading}
                style={{ minWidth: 240, flex: '1 1 240px' }}
              />
            )}
          </Group>

          {/* Context info */}
          <Group gap="md" wrap="wrap">
            {accessViewMode === 'campaign' && selectedCampaign && (
              <Stack gap={2}>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">{t('admin_access_company_label', 'Company:')}</Text>
                  <Badge variant="light">{selectedCampaign.companyId || t('admin_access_none', 'None')}</Badge>
                </Group>
                {selectedCampaign.status === 'archived' && (
                  <Alert color="yellow" variant="light" p="xs" icon={<IconAlertCircle size={16} />}>
                    <Text size="xs">{t('admin_access_archived_inactive', 'Archived campaign - grants inactive')}</Text>
                  </Alert>
                )}
                <Group gap="xs" mt={2}>
                  <Text size="xs" c="dimmed">{t('admin_access_total_users', 'Total users:')}</Text>
                  <Badge variant="light" color="blue">{t('admin_access_badge_count', 'Access {{count}}', { count: accessEntriesCount })}</Badge>
                </Group>
              </Stack>
            )}
            {(accessViewMode === 'company' || accessViewMode === 'all') && selectedCompany && (
              <Stack gap={2}>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">{t('admin_access_campaigns_label', 'Campaigns:')}</Text>
                  <Badge variant="light" color="green">{t('admin_access_n_active', '{{count}} active', { count: selectedCompany.activeCampaigns })}</Badge>
                  <Badge variant="light" color="gray">{t('admin_access_n_archived', '{{count}} archived', { count: selectedCompany.archivedCampaigns })}</Badge>
                </Group>
                {selectedCompany.activeCampaigns > 0 && (
                  <Button
                    variant="light"
                    color="red"
                    size="xs"
                    leftSection={<IconArchive size={14} />}
                    onClick={() => onArchiveCompanyClick(selectedCompany)}
                    mt={4}
                  >
                    {t('admin_access_archive_all', 'Archive All Campaigns')}
                  </Button>
                )}
                <Group gap="xs" mt={2}>
                  <Text size="xs" c="dimmed">{t('admin_access_total_users', 'Total users:')}</Text>
                  <Badge variant="light" color="blue">{t('admin_access_badge_count', 'Access {{count}}', { count: accessEntriesCount })}</Badge>
                </Group>
              </Stack>
            )}
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
                ? t('admin_access_empty_campaign', 'Select a campaign to manage access permissions')
                : t('admin_access_empty_company', 'Select a company to manage access permissions')}
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          {/* Current Access - Show this first and prominently */}
          <Card shadow="sm" withBorder mb="md" p={{ base: 'sm', md: 'md' }}>
            <Group justify="space-between" mb="sm" wrap="wrap" gap="sm">
              <Text fw={600} size="lg">
                {accessViewMode === 'campaign' ? t('admin_access_current', 'Current Access') :
                 accessViewMode === 'company' ? t('admin_access_company_wide', 'Company-Wide Access') :
                 t('admin_access_all', 'All Access (Company + Campaigns)')}
              </Text>
              <Group gap="sm">
                <Checkbox
                  label={t('admin_access_show_expired', 'Show expired')}
                  size="xs"
                  checked={showExpiredGrants}
                  onChange={(e) => onShowExpiredGrantsChange(e.currentTarget.checked)}
                />
                <Badge variant="light">{t('admin_access_n_users', '{{count}} users', { count: accessEntriesCount })}</Badge>
              </Group>
            </Group>

            {accessLoading ? (
              <Table.ScrollContainer minWidth={700}>
                <Table verticalSpacing="xs" aria-label={t('admin_access_loading_aria', 'Loading access entries')}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('admin_access_th_user', 'User')}</Table.Th>
                      <Table.Th>{t('admin_access_th_type', 'Access Type')}</Table.Th>
                      <Table.Th>{t('admin_access_th_role', 'Role')}</Table.Th>
                      <Table.Th>{t('admin_access_th_granted', 'Granted / Expires')}</Table.Th>
                      <Table.Th w={80}>{t('admin_access_th_revoke', 'Revoke')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>
                          <Skeleton height={14} width="50%" mb={4} />
                          <Skeleton height={10} width="70%" />
                        </Table.Td>
                        <Table.Td><Skeleton height={22} width={80} radius="xl" /></Table.Td>
                        <Table.Td><Skeleton height={22} width={70} radius="xl" /></Table.Td>
                        <Table.Td><Skeleton height={14} width={100} /></Table.Td>
                        <Table.Td><Skeleton height={28} width={28} circle /></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : accessEntriesCount === 0 ? (
              <Text c="dimmed" ta="center" py="md">
                {accessViewMode === 'campaign'
                  ? t('admin_access_none_campaign', 'No users have access to this campaign yet. Add users below.')
                  : accessViewMode === 'company'
                  ? t('admin_access_none_company', 'No company-wide access grants. Add users below.')
                  : t('admin_access_none_all', 'No access grants found for this company or its campaigns.')}
              </Text>
            ) : (
              <ScrollArea style={{ maxHeight: 300 }} offsetScrollbars type="auto">
                <Table.ScrollContainer minWidth={700}>
                  <Table
                    verticalSpacing="xs"
                    highlightOnHover
                    aria-label={t('admin_access_current_aria', 'Current access entries')}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>User</Table.Th>
                        <Table.Th>Access Type</Table.Th>
                        <Table.Th>Role</Table.Th>
                        <Table.Th>Granted / Expires</Table.Th>
                        <Table.Th w={80}>Revoke</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{accessRows}</Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </ScrollArea>
            )}
          </Card>

          {/* P18-I: Access Request Workflow */}
          {accessViewMode === 'campaign' && accessCampaignId && apiClient && (
            <Card shadow="sm" withBorder mb="md" p={{ base: 'sm', md: 'md' }}>
              <PendingRequestsPanel
                campaignId={accessCampaignId}
                apiClient={apiClient}
              />
            </Card>
          )}

          {/* Grant Access Form - Unified and compact */}
          <Card shadow="sm" withBorder p={{ base: 'sm', md: 'md' }}>
            <Text fw={600} size="lg" mb="sm">
              {accessViewMode === 'campaign' ? t('admin_access_grant_new', 'Grant New Access') : t('admin_access_grant_company', 'Grant Company-Wide Access')}
            </Text>

            <Group align="flex-end" gap="sm" wrap="wrap">
              {/* Unified user search with ID fallback built-in */}
              <Box style={{ flex: 1, minWidth: isMobile ? undefined : 250, width: isMobile ? '100%' : undefined }}>
                <SearchableEntityInput
                  label={<Text size="sm" fw={500}>{t('admin_access_th_user', 'User')}</Text>}
                  placeholder={t('admin_access_user_ph', 'Search name, email, or enter ID...')}
                  displayValue={selectedUser ? `${selectedUser.displayName} (${selectedUser.email})` : userSearchQuery}
                  onInputChange={(val) => {
                    setUserSearchQuery(val);
                    setSelectedUser(null);
                    // If it looks like a number, treat as User ID.
                    if (/^\d+$/.test(val)) {
                      setAccessUserId(val);
                    } else {
                      setAccessUserId('');
                    }
                  }}
                  onOptionSubmit={(val) => {
                    const user = userSearchResults.find((u) => String(u.id) === val);
                    if (user) {
                      setSelectedUser(user);
                      setAccessUserId('');
                      setUserSearchQuery('');
                    }
                  }}
                  hasSelection={!!selectedUser}
                  onClear={() => {
                    setSelectedUser(null);
                    setUserSearchQuery('');
                    setAccessUserId('');
                  }}
                  loading={userSearchLoading}
                >
                  {userSearchResults.length === 0 && userSearchQuery.length >= 2 && !userSearchLoading && !/^\d+$/.test(userSearchQuery) && (
                    <Combobox.Empty>{t('admin_access_no_users', 'No users found')}</Combobox.Empty>
                  )}
                  {/^\d+$/.test(userSearchQuery) && (
                    <Combobox.Empty>{t('admin_access_using_id', 'Using User ID: {{id}}', { id: userSearchQuery })}</Combobox.Empty>
                  )}
                  {userSearchQuery.length < 2 && !/^\d+$/.test(userSearchQuery) && (
                    <Combobox.Empty>{t('admin_access_type_hint', 'Type name/email or enter user ID')}</Combobox.Empty>
                  )}
                  {userSearchResults.map((user) => (
                    <Combobox.Option key={user.id} value={String(user.id)}>
                      <Group gap="xs">
                        <Text size="sm" fw={500}>{user.displayName}</Text>
                        <Text size="xs" c="dimmed">{user.email}</Text>
                        {user.isAdmin && <Badge size="xs" color="blue">{t('admin_access_admin_badge', 'Admin')}</Badge>}
                      </Group>
                    </Combobox.Option>
                  ))}
                </SearchableEntityInput>
              </Box>

              {/* Campaign mode: show scope and action options */}
              {accessViewMode === 'campaign' && (
                <>
                  <Select
                    label={<Text size="sm" fw={500}>{t('admin_access_scope', 'Scope')}</Text>}
                    data={[
                      { value: 'campaign', label: t('admin_access_scope_campaign', '📋 This Campaign') },
                      { value: 'company', label: t('admin_access_scope_company', '🏢 All Company Campaigns') },
                    ]}
                    value={accessSource}
                    onChange={(v) => onAccessSourceChange((v as 'company' | 'campaign') ?? 'campaign')}
                    style={{ minWidth: isMobile ? undefined : 180, width: isMobile ? '100%' : undefined }}
                  />

                  <Select
                    label={<Text size="sm" fw={500}>{t('admin_access_action', 'Action')}</Text>}
                    data={[
                      { value: 'grant', label: t('admin_access_action_grant', '✅ Grant Access') },
                      { value: 'deny', label: t('admin_access_action_deny', '❌ Deny Access') },
                    ]}
                    value={accessAction}
                    onChange={(v) => onAccessActionChange((v as 'grant' | 'deny') ?? 'grant')}
                    disabled={accessSource === 'company'}
                    style={{ minWidth: isMobile ? undefined : 150, width: isMobile ? '100%' : undefined }}
                  />
                </>
              )}

              {/* P53-D: access grants are viewer-only — editing/managing comes from the
                  wpsg_editor role, not from per-campaign grants. Hidden when action is 'deny'. */}
              {accessAction !== 'deny' && (
                <Select
                  label={<Text size="sm" fw={500}>{t('admin_access_th_role', 'Role')}</Text>}
                  data={[
                    { value: 'viewer', label: t('admin_access_role_viewer', '👁 Viewer') },
                  ]}
                  value={accessLevel}
                  onChange={(v) => onAccessLevelChange((v as 'viewer' | 'editor' | 'owner') ?? 'viewer')}
                  style={{ minWidth: isMobile ? undefined : 140, width: isMobile ? '100%' : undefined }}
                  aria-label={t('admin_access_role_aria', 'Access role level')}
                />
              )}

              {/* P28-B: optional expiry date-time */}
              <TextInput
                label={<Text size="sm" fw={500}>{t('admin_access_expires', 'Expires at')} <Text span size="xs" c="dimmed">{t('admin_access_optional', '(optional)')}</Text></Text>}
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.currentTarget.value)}
                style={{ minWidth: isMobile ? undefined : 200, width: isMobile ? '100%' : undefined }}
                aria-label={t('admin_access_expires_aria', 'Access expiry date and time')}
              />

              <Button
                onClick={onGrantAccess}
                loading={accessSaving}
                disabled={!selectedUser && !accessUserId}
                aria-disabled={!selectedUser && !accessUserId}
              >
                {t('admin_access_apply', 'Apply')}
              </Button>

              <Tooltip label={t('admin_access_create_user', 'Create a new user')}>
                <Button
                  variant="light"
                  leftSection={<IconUserPlus size={16} />}
                  aria-label={t('admin_access_quick_add_aria', 'Quick add a new user')}
                  onClick={onQuickAddUser}
                >
                  {t('admin_access_quick_add', 'Quick Add User')}
                </Button>
              </Tooltip>
            </Group>

            {accessViewMode === 'campaign' && accessSource === 'company' && (
              <Text size="xs" c="dimmed" mt="xs">
                {t('admin_access_note_company_level', 'Company-level grants give access to all campaigns under the same company.')}
              </Text>
            )}
            {(accessViewMode === 'company' || accessViewMode === 'all') && (
              <Text size="xs" c="dimmed" mt="xs">
                {t('admin_access_note_company_future', 'Grants apply to all current and future campaigns for this company.')}
              </Text>
            )}
          </Card>
        </>
      )}
    </>
  );
}

setWpsgDebugDisplayName(AccessTab, 'AdminPanel:AccessTab');