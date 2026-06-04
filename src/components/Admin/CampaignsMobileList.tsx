import { useMemo } from 'react';
import {
  Badge, Box, Button, Card, Center, Checkbox, Group, Loader,
  Pagination, Stack, Text, Tooltip,
} from '@mantine/core';
import {
  IconArchive, IconArchiveOff, IconCopy, IconDownload, IconEdit,
  IconFileZip, IconLayoutGrid, IconTrash,
} from '@tabler/icons-react';
import type { AccessSummaryItem, AdminCampaign } from '@/services/adminQuery';
import type { CampaignActionsHandle } from '@/hooks/useAdminCampaignActions';
import { describeCampaignGalleryOverrides, hasCampaignGalleryOverrides } from '@/utils/campaignGalleryOverrides';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

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

interface Props {
  isLoading: boolean;
  error: string | null;
  campaigns: AdminCampaign[];
  campaignActions: CampaignActionsHandle;
  grantSummary?: Map<number, AccessSummaryItem> | undefined;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function CampaignsMobileList({
  isLoading,
  error,
  campaigns,
  campaignActions,
  grantSummary,
  page,
  totalPages,
  total,
  onPageChange,
}: Props) {
  const {
    selectedCampaignIds,
    handleToggleCampaignSelect,
    handleEdit,
    setDuplicateSource,
    handleExportCampaign,
    handleBinaryExportCampaign,
    binaryExportingIds,
    setConfirmRestore,
    setConfirmArchive,
    setConfirmDelete,
    restoringIds,
    archivingIds,
    deletingIds,
  } = campaignActions;

  const cards = useMemo(() => {
    return campaigns.map((c) => {
      const cid = String(c.id);
      const isSelected = selectedCampaignIds.has(cid);
      const sched = scheduleLabel(c.publishAt, c.unpublishAt);
      const summary = grantSummary?.get(Number(c.id));
      const galleryOverrideSummary = describeCampaignGalleryOverrides(c);

      return (
        <Card
          key={c.id}
          withBorder
          radius="md"
          p="sm"
          data-selected={isSelected || undefined}
          style={{ borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined }}
        >
          <Stack gap={6}>
            {/* Title row */}
            <Group gap={6} justify="space-between" wrap="nowrap">
              <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Checkbox
                  checked={isSelected}
                  onChange={() => handleToggleCampaignSelect(cid)}
                  aria-label={`Select ${c.title}`}
                  size="xs"
                />
                <Text fw={700} size="sm" truncate style={{ flex: 1 }}>{c.title}</Text>
                {hasCampaignGalleryOverrides(c) && (
                  <Tooltip label={`Custom gallery: ${galleryOverrideSummary.join(', ') || 'Nested overrides'}`} withArrow>
                    <Box component="span" role="img" aria-label="Custom gallery overrides" style={{ display: 'inline-flex' }}>
                      <IconLayoutGrid size={13} color="var(--mantine-color-violet-5)" aria-hidden />
                    </Box>
                  </Tooltip>
                )}
              </Group>
            </Group>

            {/* Description */}
            {c.description && (
              <Text size="xs" c="dimmed" lineClamp={2}>{c.description}</Text>
            )}

            {/* Badges */}
            <Group gap={4} wrap="wrap">
              <Badge size="xs" color={c.status === 'active' ? 'teal' : c.status === 'archived' ? 'gray' : 'yellow'}>
                {c.status}
              </Badge>
              <Badge size="xs" variant="light">{c.visibility}</Badge>
              {sched && <Badge size="xs" variant="light" color={sched.color}>{sched.text}</Badge>}
              {c.companyId && <Badge size="xs" variant="dot" color="gray">{c.companyId}</Badge>}
              {summary !== undefined && (
                <Tooltip label={`${summary.grantCount} grant${summary.grantCount !== 1 ? 's' : ''}`} withArrow>
                  <Badge size="xs" variant="light" color="blue">{summary.grantCount} grants</Badge>
                </Tooltip>
              )}
            </Group>

            {/* Actions */}
            <Group gap="xs" wrap="wrap" mt={2}>
              <Button size="xs" variant="outline" leftSection={<IconEdit size={12} />} onClick={() => handleEdit(c)}>
                Edit
              </Button>
              <Tooltip label="Clone">
                <Button size="xs" variant="subtle" leftSection={<IconCopy size={12} />} onClick={() => setDuplicateSource(c)} aria-label={`Duplicate ${c.title}`}>
                  Clone
                </Button>
              </Tooltip>
              <Tooltip label="Export as JSON">
                <Button size="xs" variant="subtle" leftSection={<IconDownload size={12} />} onClick={() => void handleExportCampaign(c)} aria-label={`Export ${c.title}`}>
                  Export
                </Button>
              </Tooltip>
              <Tooltip label="Export as ZIP (includes media)">
                <Button size="xs" variant="subtle" leftSection={<IconFileZip size={12} />} loading={binaryExportingIds.has(cid)} onClick={() => void handleBinaryExportCampaign(c)} aria-label={`Export ${c.title} as ZIP`}>
                  Export ZIP
                </Button>
              </Tooltip>
              {c.status === 'archived' ? (
                <Button size="xs" color="teal" leftSection={<IconArchiveOff size={12} />} loading={restoringIds.has(cid)} onClick={() => setConfirmRestore(c)}>
                  Restore
                </Button>
              ) : (
                <Button size="xs" color="orange" variant="light" leftSection={<IconArchive size={12} />} loading={archivingIds.has(cid)} onClick={() => setConfirmArchive(c)}>
                  Archive
                </Button>
              )}
              <Tooltip label="Permanently delete">
                <Button size="xs" color="red" variant="subtle" leftSection={<IconTrash size={12} />} loading={deletingIds.has(cid)} onClick={() => setConfirmDelete(c)} aria-label={`Delete ${c.title}`}>
                  Delete
                </Button>
              </Tooltip>
            </Group>
          </Stack>
        </Card>
      );
    });
  }, [
    campaigns, selectedCampaignIds, grantSummary,
    handleToggleCampaignSelect, handleEdit, setDuplicateSource,
    handleExportCampaign, handleBinaryExportCampaign, binaryExportingIds,
    setConfirmRestore, setConfirmArchive, setConfirmDelete,
    restoringIds, archivingIds, deletingIds,
  ]);

  if (error) return <Text c="red" role="alert">{error}</Text>;

  if (isLoading) {
    return <Center py="xl"><Loader size="sm" /></Center>;
  }

  return (
    <>
      <Stack gap="sm">{cards}</Stack>
      {totalPages > 1 && (
        <Group justify="space-between" mt="md">
          <Text size="sm" c="dimmed">{total} campaigns</Text>
          <Pagination value={page} onChange={onPageChange} total={totalPages} size="sm" />
        </Group>
      )}
    </>
  );
}

setWpsgDebugDisplayName(CampaignsMobileList, 'AdminPanel:CampaignsMobileList');
