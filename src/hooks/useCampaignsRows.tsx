import { useMemo } from 'react';
import { Table, Text, Box, Group, Badge, Tooltip, Button, Checkbox } from '@mantine/core';
import { IconEdit, IconCopy, IconDownload, IconArchive, IconArchiveOff, IconLayoutGrid, IconTrash } from '@tabler/icons-react';
import type { AccessSummaryItem, AdminCampaign } from '@/services/adminQuery';
import type { CampaignActionsHandle } from '@/hooks/useAdminCampaignActions';
import { describeCampaignGalleryOverrides, hasCampaignGalleryOverrides } from '@/utils/campaignGalleryOverrides';

/** Derive a human-readable schedule label from publishAt / unpublishAt dates. */
function scheduleLabel(publishAt?: string, unpublishAt?: string): { text: string; color: string } | null {
  const now = Date.now();
  if (publishAt && new Date(publishAt).getTime() > now) return { text: 'Scheduled', color: 'blue' };
  if (unpublishAt) {
    const end = new Date(unpublishAt).getTime();
    if (end <= now) return { text: 'Expired', color: 'red' };
    if (end - now < 86_400_000) return { text: 'Expiring soon', color: 'orange' };
  }
  return null;
}

interface Options {
  campaigns: AdminCampaign[];
  campaignActions: CampaignActionsHandle;
  /** Map of campaign id (number) → AccessSummaryItem. Undefined while loading. */
  grantSummary?: Map<number, AccessSummaryItem> | undefined;
}

export function useCampaignsRows({ campaigns, campaignActions, grantSummary }: Options) {
  const {
    selectMode, selectedCampaignIds,
    handleToggleCampaignSelect, handleEdit,
    setDuplicateSource, handleExportCampaign,
    setConfirmRestore, setConfirmArchive, setConfirmDelete,
    restoringIds, archivingIds, deletingIds,
  } = campaignActions;

  return useMemo(() => {
    return campaigns.map((c) => {
      const cid = String(c.id);
      const isSelected = selectedCampaignIds.has(cid);
      const galleryOverrideSummary = describeCampaignGalleryOverrides(c);
      const summary = grantSummary?.get(Number(c.id));
      return (
        <Table.Tr key={c.id} data-selected={isSelected || undefined}>
          {selectMode && (
            <Table.Td w={36}>
              <Checkbox
                checked={isSelected}
                onChange={() => handleToggleCampaignSelect(cid)}
                aria-label={`Select ${c.title}`}
              />
            </Table.Td>
          )}
          <Table.Td>
            <Box>
              <Group gap={6}>
                <Text fw={700}>{c.title}</Text>
                {hasCampaignGalleryOverrides(c) && (
                  <Tooltip label={`Custom gallery: ${galleryOverrideSummary.join(', ') || 'Nested campaign gallery overrides'}`} withArrow>
                    <Box
                      component="span"
                      role="img"
                      aria-label={`Custom gallery overrides: ${galleryOverrideSummary.join(', ') || 'Nested campaign gallery overrides'}`}
                      style={{ display: 'inline-flex' }}
                    >
                      <IconLayoutGrid size={14} color="var(--mantine-color-violet-5)" aria-hidden="true" />
                    </Box>
                  </Tooltip>
                )}
              </Group>
              <Text size="xs" c="dimmed">{c.description?.slice(0, 120)}</Text>
            </Box>
          </Table.Td>
          <Table.Td>
            <Group gap={4} wrap="wrap">
              <Badge color={c.status === 'active' ? 'teal' : c.status === 'archived' ? 'gray' : 'yellow'}>
                {c.status}
              </Badge>
              {(() => {
                const sched = scheduleLabel(c.publishAt, c.unpublishAt);
                return sched ? <Badge variant="light" color={sched.color} size="xs">{sched.text}</Badge> : null;
              })()}
            </Group>
          </Table.Td>
          <Table.Td><Badge variant="light">{c.visibility}</Badge></Table.Td>
          <Table.Td>{c.companyId || '—'}</Table.Td>
          <Table.Td>
            {summary !== undefined ? (
              <Group gap={4} wrap="nowrap">
                <Tooltip label={`${summary.grantCount} active grant${summary.grantCount !== 1 ? 's' : ''}`} withArrow>
                  <Badge variant="light" color="blue" size="sm">{summary.grantCount}</Badge>
                </Tooltip>
                {summary.pendingRequestCount > 0 && (
                  <Tooltip label={`${summary.pendingRequestCount} pending request${summary.pendingRequestCount !== 1 ? 's' : ''}`} withArrow>
                    <Badge variant="dot" color="orange" size="sm">{summary.pendingRequestCount}</Badge>
                  </Tooltip>
                )}
              </Group>
            ) : (
              <Text size="xs" c="dimmed">—</Text>
            )}
          </Table.Td>
          <Table.Td>
            <Group gap="xs" wrap="wrap">
              <Button variant="outline" size="xs" leftSection={<IconEdit size={14} />} onClick={() => handleEdit(c)}>Edit</Button>
              <Tooltip label="Clone campaign">
                <Button variant="subtle" size="xs" leftSection={<IconCopy size={14} />} onClick={() => setDuplicateSource(c)} aria-label={`Duplicate ${c.title}`}>Clone</Button>
              </Tooltip>
              <Tooltip label="Export campaign as JSON">
                <Button variant="subtle" size="xs" leftSection={<IconDownload size={14} />} onClick={() => void handleExportCampaign(c)} aria-label={`Export ${c.title}`}>Export</Button>
              </Tooltip>
              {c.status === 'archived' ? (
                <Button color="teal" size="xs" leftSection={<IconArchiveOff size={14} />} loading={restoringIds.has(cid)} onClick={() => setConfirmRestore(c)}>Restore</Button>
              ) : (
                <Button color="orange" variant="light" size="xs" leftSection={<IconArchive size={14} />} loading={archivingIds.has(cid)} onClick={() => setConfirmArchive(c)}>Archive</Button>
              )}
              <Tooltip label="Permanently delete campaign">
                <Button color="red" variant="subtle" size="xs" leftSection={<IconTrash size={14} />} loading={deletingIds.has(cid)} onClick={() => setConfirmDelete(c)} aria-label={`Delete ${c.title}`}>Delete</Button>
              </Tooltip>
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    });
  }, [campaigns, selectMode, selectedCampaignIds, grantSummary, handleToggleCampaignSelect, handleEdit, setDuplicateSource, handleExportCampaign, setConfirmRestore, setConfirmArchive, setConfirmDelete, restoringIds, archivingIds, deletingIds]);
}
