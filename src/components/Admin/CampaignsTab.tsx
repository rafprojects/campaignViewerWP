import { Group, Skeleton, Table, Text, Checkbox, Button, Tooltip } from '@mantine/core';
import type { ReactNode } from 'react';
import { IconCheckbox, IconSquare } from '@tabler/icons-react';

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

interface CampaignsTabProps {
  isLoading: boolean;
  error: string | null;
  campaignsRows: ReactNode;
  /** When true, a checkbox column is shown. */
  selectMode: boolean;
  /** Number of selected items (used to show select-all state). */
  selectedCount: number;
  /** Total visible campaign count (used to compute select-all state). */
  totalCount: number;
  onToggleSelectMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function CampaignsTab({
  isLoading,
  error,
  campaignsRows,
  selectMode,
  selectedCount,
  totalCount,
  onToggleSelectMode,
  onSelectAll,
  onDeselectAll,
}: CampaignsTabProps) {
  if (error) {
    return <Text c="red" role="alert" aria-live="assertive">{error}</Text>;
  }

  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <>
      <Group justify="flex-end" mb="xs">
        <Tooltip label={selectMode ? 'Exit select mode' : 'Enter select mode'}>
          <Button
            size="xs"
            variant={selectMode ? 'filled' : 'subtle'}
            leftSection={selectMode ? <IconCheckbox size={14} /> : <IconSquare size={14} />}
            onClick={onToggleSelectMode}
            aria-pressed={selectMode}
          >
            {selectMode ? 'Cancel Select' : 'Select'}
          </Button>
        </Tooltip>
      </Group>

      <Table.ScrollContainer minWidth={720}>
        <Table verticalSpacing="sm" highlightOnHover aria-label="Campaign list">
          <Table.Thead>
            <Table.Tr>
              {selectMode && (
                <Table.Th w={36} aria-label="Select all">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={allSelected ? onDeselectAll : onSelectAll}
                    aria-label="Select all campaigns"
                  />
                </Table.Th>
              )}
              <Table.Th>Title</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Visibility</Table.Th>
              <Table.Th>Company</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? <CampaignSkeletonRows withCheckbox={selectMode} /> : campaignsRows}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </>
  );
}
