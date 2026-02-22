import type { MutableRefObject, ReactNode } from 'react';
import type { ComboboxStore } from '@mantine/core';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Combobox,
  Group,
  InputBase,
  Loader,
  ScrollArea,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconSearch, IconTrash, IconArchive, IconUserPlus } from '@tabler/icons-react';
import { CampaignSelector, type CampaignSelectItem } from '@/components/shared/CampaignSelector';

type AccessViewMode = 'campaign' | 'company' | 'all';

type SelectedCampaign = {
  companyId?: string;
  status?: string;
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

type WpUser = {
  id: number;
  email: string;
  displayName: string;
  login: string;
  isAdmin: boolean;
};

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
  onArchiveCompanyClick: (company: NonNullable<SelectedCompany>) => void;
  userCombobox: ComboboxStore;
  userSearchResults: WpUser[];
  userSearchQuery: string;
  userSearchLoading: boolean;
  selectedUser: WpUser | null;
  setSelectedUser: (user: WpUser | null) => void;
  setUserSearchQuery: (value: string) => void;
  setAccessUserId: (value: string) => void;
  accessUserId: string;
  blurTimeoutRef: MutableRefObject<number | null>;
  accessSource: 'company' | 'campaign';
  onAccessSourceChange: (value: 'company' | 'campaign') => void;
  accessAction: 'grant' | 'deny';
  onAccessActionChange: (value: 'grant' | 'deny') => void;
  onGrantAccess: () => void;
  accessSaving: boolean;
  onQuickAddUser: () => void;
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
  onArchiveCompanyClick,
  userCombobox,
  userSearchResults,
  userSearchQuery,
  userSearchLoading,
  selectedUser,
  setSelectedUser,
  setUserSearchQuery,
  setAccessUserId,
  accessUserId,
  blurTimeoutRef,
  accessSource,
  onAccessSourceChange,
  accessAction,
  onAccessActionChange,
  onGrantAccess,
  accessSaving,
  onQuickAddUser,
}: AccessTabProps) {
  return (
    <>
      {/* View Mode Toggle */}
      <Card shadow="sm" withBorder mb="md" p={{ base: 'sm', md: 'md' }}>
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Group align="flex-end" gap="md" wrap="wrap">
            <Box>
              <Text size="sm" fw={500} mb={4} c="gray.2">View By</Text>
              <SegmentedControl
                value={accessViewMode}
                onChange={(v) => onAccessViewModeChange(v as AccessViewMode)}
                data={[
                  { value: 'campaign', label: '📋 Campaign' },
                  { value: 'company', label: '🏢 Company' },
                  { value: 'all', label: '📊 All' },
                ]}
                aria-label="Access view mode"
              />
            </Box>

            {accessViewMode === 'campaign' ? (
              <CampaignSelector
                label="Select Campaign"
                placeholder="Choose a campaign..."
                data={campaignSelectData}
                value={accessCampaignId}
                onChange={onAccessCampaignChange}
                style={{ minWidth: 240, flex: '1 1 240px' }}
              />
            ) : (
              <Select
                label={<Text size="sm" fw={500} c="gray.2">Select Company</Text>}
                placeholder={companiesLoading ? 'Loading...' : 'Choose a company...'}
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
                  <Text size="sm" c="dimmed">Company:</Text>
                  <Badge variant="light">{selectedCampaign.companyId || 'None'}</Badge>
                </Group>
                {selectedCampaign.status === 'archived' && (
                  <Alert color="yellow" variant="light" p="xs" icon={<IconAlertCircle size={16} />}>
                    <Text size="xs">Archived campaign - grants inactive</Text>
                  </Alert>
                )}
                <Group gap="xs" mt={2}>
                  <Text size="xs" c="dimmed">Total users:</Text>
                  <Badge variant="light" color="blue">Access {accessEntriesCount}</Badge>
                </Group>
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
                    onClick={() => onArchiveCompanyClick(selectedCompany)}
                    mt={4}
                  >
                    Archive All Campaigns
                  </Button>
                )}
                <Group gap="xs" mt={2}>
                  <Text size="xs" c="dimmed">Total users:</Text>
                  <Badge variant="light" color="blue">Access {accessEntriesCount}</Badge>
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
                ? 'Select a campaign to manage access permissions'
                : 'Select a company to manage access permissions'}
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          {/* Current Access - Show this first and prominently */}
          <Card shadow="sm" withBorder mb="md" p={{ base: 'sm', md: 'md' }}>
            <Group justify="space-between" mb="sm" wrap="wrap" gap="sm">
              <Text fw={600} size="lg" c="gray.1">
                {accessViewMode === 'campaign' ? 'Current Access' :
                 accessViewMode === 'company' ? 'Company-Wide Access' :
                 'All Access (Company + Campaigns)'}
              </Text>
              <Badge variant="light">{accessEntriesCount} users</Badge>
            </Group>

            {accessLoading ? (
              <Table verticalSpacing="xs" aria-label="Loading access entries" style={{ minWidth: 640 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Access Type</Table.Th>
                    <Table.Th>Granted</Table.Th>
                    <Table.Th w={80}>Revoke</Table.Th>
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
                      <Table.Td><Skeleton height={14} width={100} /></Table.Td>
                      <Table.Td><Skeleton height={28} width={28} circle /></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : accessEntriesCount === 0 ? (
              <Text c="dimmed" ta="center" py="md">
                {accessViewMode === 'campaign'
                  ? 'No users have access to this campaign yet. Add users below.'
                  : accessViewMode === 'company'
                  ? 'No company-wide access grants. Add users below.'
                  : 'No access grants found for this company or its campaigns.'}
              </Text>
            ) : (
              <ScrollArea style={{ maxHeight: 300 }} offsetScrollbars type="auto">
                <Table
                  verticalSpacing="xs"
                  highlightOnHover
                  aria-label="Current access entries"
                  style={{ minWidth: 640 }}
                >
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
          <Card shadow="sm" withBorder p={{ base: 'sm', md: 'md' }}>
            <Text fw={600} size="lg" mb="sm" c="gray.1">
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
                      label={<Text size="sm" fw={500} c="gray.2">User</Text>}
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
                        blurTimeoutRef.current = window.setTimeout(() => {
                          userCombobox.closeDropdown();
                          blurTimeoutRef.current = null;
                        }, 150);
                      }}
                      rightSection={
                        selectedUser ? (
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            aria-label="Clear selected user"
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
                    label={<Text size="sm" fw={500} c="gray.2">Scope</Text>}
                    data={[
                      { value: 'campaign', label: '📋 This Campaign' },
                      { value: 'company', label: '🏢 All Company Campaigns' },
                    ]}
                    value={accessSource}
                    onChange={(v) => onAccessSourceChange((v as 'company' | 'campaign') ?? 'campaign')}
                    style={{ minWidth: 180 }}
                  />

                  <Select
                    label={<Text size="sm" fw={500} c="gray.2">Action</Text>}
                    data={[
                      { value: 'grant', label: '✅ Grant Access' },
                      { value: 'deny', label: '❌ Deny Access' },
                    ]}
                    value={accessAction}
                    onChange={(v) => onAccessActionChange((v as 'grant' | 'deny') ?? 'grant')}
                    disabled={accessSource === 'company'}
                    style={{ minWidth: 150 }}
                  />
                </>
              )}

              <Button
                onClick={onGrantAccess}
                loading={accessSaving}
                disabled={!selectedUser && !accessUserId}
                aria-disabled={!selectedUser && !accessUserId}
              >
                Apply
              </Button>

              <Tooltip label="Create a new user">
                <Button
                  variant="light"
                  leftSection={<IconUserPlus size={16} />}
                  aria-label="Quick add a new user"
                  onClick={onQuickAddUser}
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
    </>
  );
}
