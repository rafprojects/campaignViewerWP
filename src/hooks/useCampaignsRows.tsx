import { useMemo } from 'react';
import { Table, Text, Box, Group, Badge, Tooltip, Button, Checkbox } from '@mantine/core';
import { IconEdit, IconCopy, IconDownload, IconArchive, IconArchiveOff, IconLayoutGrid } from '@tabler/icons-react';
import type { AdminCampaign } from '@/hooks/useAdminSWR';
import type { CampaignActionsHandle } from '@/hooks/useAdminCampaignActions';

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
  categoryFilter: string | null;
  campaignActions: CampaignActionsHandle;
}

export function useCampaignsRows({ campaigns, categoryFilter, campaignActions }: Options) {
  const {
    selectMode, selectedCampaignIds,
    handleToggleCampaignSelect, handleEdit,
    setDuplicateSource, handleExportCampaign,
    setConfirmRestore, setConfirmArchive,
    restoringIds, archivingIds,
  } = campaignActions;

  return useMemo(() => {
    const visible = categoryFilter
      ? campaigns.filter((c) => (c.categories ?? []).includes(categoryFilter))
      : campaigns;

    return visible.map((c) => {
      const cid = String(c.id);
      const isSelected = selectedCampaignIds.has(cid);
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
                {(c.imageAdapterId || c.videoAdapterId) && (
                  <Tooltip label={`Custom gallery: ${[c.imageAdapterId && `Image: ${c.imageAdapterId}`, c.videoAdapterId && `Video: ${c.videoAdapterId}`].filter(Boolean).join(', ')}`} withArrow>
                    <IconLayoutGrid size={14} color="var(--mantine-color-violet-5)" />
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
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    });
  }, [campaigns, categoryFilter, selectMode, selectedCampaignIds, handleToggleCampaignSelect, handleEdit, setDuplicateSource, handleExportCampaign, setConfirmRestore, setConfirmArchive, restoringIds, archivingIds]);
}
