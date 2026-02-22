import { Group, Skeleton, Table, Text } from '@mantine/core';
import type { ReactNode } from 'react';

/** P13-C: Skeleton rows displayed while campaign list loads. */
function CampaignSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <Table.Tr key={i}>
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
}

export function CampaignsTab({ isLoading, error, campaignsRows }: CampaignsTabProps) {
  if (error) {
    return <Text c="red" role="alert" aria-live="assertive">{error}</Text>;
  }

  return (
    <Table.ScrollContainer minWidth={720}>
      <Table verticalSpacing="sm" highlightOnHover aria-label="Campaign list">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Visibility</Table.Th>
            <Table.Th>Company</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{isLoading ? <CampaignSkeletonRows /> : campaignsRows}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
