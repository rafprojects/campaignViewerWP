import { Center, Group, Loader, ScrollArea, Table, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { CampaignSelector, type CampaignSelectItem } from '@/components/shared/CampaignSelector';

interface AuditTabProps {
  campaignSelectData: CampaignSelectItem[];
  auditCampaignId: string;
  onAuditCampaignChange: (value: string | null) => void;
  auditLoading: boolean;
  auditEntriesCount: number;
  auditRows: ReactNode;
}

export function AuditTab({
  campaignSelectData,
  auditCampaignId,
  onAuditCampaignChange,
  auditLoading,
  auditEntriesCount,
  auditRows,
}: AuditTabProps) {
  return (
    <>
      <Text size="sm" fw={600} c="gray.2" id="audit-heading" mb="xs">
        Campaign Audit Log
      </Text>
      <Group mb="md">
        <CampaignSelector
          data={campaignSelectData}
          value={auditCampaignId}
          onChange={(v) => onAuditCampaignChange(v)}
          style={{ minWidth: 200 }}
          aria-label="Select campaign for audit log"
        />
      </Group>
      {auditLoading ? (
        <Center><Loader aria-label="Loading audit entries" /></Center>
      ) : auditEntriesCount === 0 ? (
        <Text c="dimmed" role="status" aria-live="polite">No audit entries yet.</Text>
      ) : (
        <ScrollArea
          offsetScrollbars
          type="always"
          scrollbars="y"
          className="wpsg-scrollarea"
          h={360}
        >
          <Table verticalSpacing="sm" highlightOnHover aria-label="Audit entries" style={{ minWidth: 640 }}>
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
    </>
  );
}
