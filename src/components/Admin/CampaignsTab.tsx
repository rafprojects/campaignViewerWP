import { Button, Group, Pagination, Skeleton, Table, Text, Checkbox } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

/** P13-C: Skeleton rows displayed while campaign list loads. */
function CampaignSkeletonRows({ withCheckbox }: { withCheckbox: boolean }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <Table.Tr key={i}>
          {withCheckbox && <Table.Td w={36}><Skeleton height={16} width={16} /></Table.Td>}
          <Table.Td>
            <Skeleton height={14} width="60%" mb={6} />
            <Skeleton height={10} width="80%" />
          </Table.Td>
          <Table.Td><Skeleton height={22} width={60} radius="xl" /></Table.Td>
          <Table.Td><Skeleton height={22} width={56} radius="xl" /></Table.Td>
          <Table.Td><Skeleton height={14} width={80} /></Table.Td>
          <Table.Td><Skeleton height={22} width={40} radius="xl" /></Table.Td>
          <Table.Td><Skeleton height={14} width={80} /></Table.Td>
          <Table.Td><Skeleton height={14} width={80} /></Table.Td>
          <Table.Td>
            <Group gap="xs">
              <Skeleton height={28} width={60} radius="sm" />
              <Skeleton height={28} width={70} radius="sm" />
            </Group>
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

setWpsgDebugDisplayName(CampaignSkeletonRows, 'AdminPanel:CampaignSkeletonRows');

interface CampaignsTabProps {
  isLoading: boolean;
  error: string | null;
  campaignsRows: ReactNode;
  /** Number of selected items (used to show select-all state). */
  selectedCount: number;
  /** Total visible campaign count (used to compute select-all state). */
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  /** Current page number (1-based). */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Total number of campaigns across all pages. */
  total: number;
  /** Called when the user navigates to a different page. */
  onPageChange: (page: number) => void;
  /** Opens the campaign creation flow. Omit or pass undefined to hide the button. */
  onAddCampaign?: (() => void) | undefined;
}

export function CampaignsTab({
  isLoading,
  error,
  campaignsRows,
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  page,
  totalPages,
  total,
  onPageChange,
  onAddCampaign,
}: CampaignsTabProps) {
  if (error) {
    return <Text c="red" role="alert" aria-live="assertive">{error}</Text>;
  }

  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <>
      {onAddCampaign && (
        <Group justify="flex-end" mb="xs">
          <Button size="sm" leftSection={<IconPlus size={14} />} onClick={onAddCampaign}>
            Add Campaign
          </Button>
        </Group>
      )}
      <Table.ScrollContainer minWidth={720}>
        <Table verticalSpacing="sm" highlightOnHover aria-label="Campaign list">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={36} aria-label="Select all">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={allSelected ? onDeselectAll : onSelectAll}
                  aria-label="Select all campaigns"
                />
              </Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Visibility</Table.Th>
              <Table.Th>Company</Table.Th>
              <Table.Th>Grants</Table.Th>
              <Table.Th>Tags</Table.Th>
              <Table.Th>Categories</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? <CampaignSkeletonRows withCheckbox={true} /> : campaignsRows}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {totalPages > 1 && (
        <Group justify="space-between" mt="md">
          <Text size="sm" c="dimmed">{total} campaigns</Text>
          <Pagination value={page} onChange={onPageChange} total={totalPages} size="sm" />
        </Group>
      )}
    </>
  );
}

setWpsgDebugDisplayName(CampaignsTab, 'AdminPanel:CampaignsTab');