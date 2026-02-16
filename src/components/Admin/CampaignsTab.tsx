import { Center, Loader, Table, Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface CampaignsTabProps {
  isLoading: boolean;
  error: string | null;
  campaignsRows: ReactNode;
}

export function CampaignsTab({ isLoading, error, campaignsRows }: CampaignsTabProps) {
  if (isLoading) {
    return <Center><Loader /></Center>;
  }

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
        <Table.Tbody>{campaignsRows}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
