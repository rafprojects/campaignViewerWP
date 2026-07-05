import { useMemo } from 'react';
import {
  Badge, Box, Button, Card, Center, Checkbox, Group, Loader, Menu,
  Pagination, Stack, Text, Tooltip,
} from '@mantine/core';
import {
  IconArchive, IconArchiveOff, IconChevronDown, IconCopy, IconDownload, IconEdit,
  IconFileZip, IconLayoutGrid, IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { AccessSummaryItem, AdminCampaign } from '@/services/adminQuery';
import type { CampaignActionsHandle } from '@/hooks/useAdminCampaignActions';
import { describeCampaignGalleryOverrides, hasCampaignGalleryOverrides } from '@/utils/campaignGalleryOverrides';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// Returns an i18next key + English default so the caller can translate in render.
function scheduleLabel(publishAt?: string, unpublishAt?: string): { key: string; text: string; color: string } | null {
  const now = Date.now();
  if (publishAt && new Date(publishAt).getTime() > now) return { key: 'admin_sched_scheduled', text: 'Scheduled', color: 'blue' };
  if (unpublishAt) {
    const end = new Date(unpublishAt).getTime();
    if (end <= now) return { key: 'admin_sched_expired', text: 'Expired', color: 'red' };
    if (end - now < 86_400_000) return { key: 'admin_sched_expiring', text: 'Expiring soon', color: 'orange' };
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
  const { t } = useTranslation('wpsg');
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
                  aria-label={t('admin_select_item', 'Select {{title}}', { title: c.title })}
                  size="xs"
                />
                <Text fw={700} size="sm" truncate style={{ flex: 1 }}>{c.title}</Text>
                {hasCampaignGalleryOverrides(c) && (
                  <Tooltip label={t('admin_custom_gallery', 'Custom gallery: {{summary}}', { summary: galleryOverrideSummary.join(', ') || t('admin_nested_overrides', 'Nested overrides') })} withArrow>
                    <Box component="span" role="img" aria-label={t('admin_custom_gallery_aria', 'Custom gallery overrides')} style={{ display: 'inline-flex' }}>
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
              {sched && <Badge size="xs" variant="light" color={sched.color}>{t(sched.key, sched.text)}</Badge>}
              {c.companyId && <Badge size="xs" variant="dot" color="gray">{c.companyId}</Badge>}
              {summary !== undefined && (
                <Tooltip label={t('admin_grant_count', '{{count}} grant', { count: summary.grantCount })} withArrow>
                  <Badge size="xs" variant="light" color="blue">{t('admin_grants_badge', '{{count}} grants', { count: summary.grantCount })}</Badge>
                </Tooltip>
              )}
            </Group>

            {/* Actions */}
            <Group gap="xs" wrap="wrap" mt={2}>
              <Button size="xs" variant="outline" leftSection={<IconEdit size={12} />} onClick={() => handleEdit(c)}>
                {t('admin_edit', 'Edit')}
              </Button>
              <Tooltip label={t('admin_clone', 'Clone')}>
                <Button size="xs" variant="subtle" leftSection={<IconCopy size={12} />} onClick={() => setDuplicateSource(c)} aria-label={t('admin_duplicate_item', 'Duplicate {{title}}', { title: c.title })}>
                  {t('admin_clone', 'Clone')}
                </Button>
              </Tooltip>
              <Menu shadow="md" width={210} position="bottom-end" withinPortal>
                <Menu.Target>
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconDownload size={12} />}
                    rightSection={<IconChevronDown size={11} />}
                    loading={binaryExportingIds.has(cid)}
                    aria-label={t('admin_export_item', 'Export {{title}}', { title: c.title })}
                  >
                    {t('admin_export', 'Export')}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconFileZip size={14} />} onClick={() => void handleBinaryExportCampaign(c)}>
                    {t('admin_export_zip_media', 'Export as ZIP (includes media)')}
                  </Menu.Item>
                  <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => void handleExportCampaign(c)}>
                    {t('admin_export_json', 'Export as JSON (data only)')}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              {c.status === 'archived' ? (
                <Button size="xs" color="teal" leftSection={<IconArchiveOff size={12} />} loading={restoringIds.has(cid)} onClick={() => setConfirmRestore(c)}>
                  {t('admin_restore', 'Restore')}
                </Button>
              ) : (
                <Button size="xs" color="orange" variant="light" leftSection={<IconArchive size={12} />} loading={archivingIds.has(cid)} onClick={() => setConfirmArchive(c)}>
                  {t('admin_archive', 'Archive')}
                </Button>
              )}
              <Tooltip label={t('admin_perm_delete', 'Permanently delete')}>
                <Button size="xs" color="red" variant="subtle" leftSection={<IconTrash size={12} />} loading={deletingIds.has(cid)} onClick={() => setConfirmDelete(c)} aria-label={t('admin_delete_item', 'Delete {{title}}', { title: c.title })}>
                  {t('admin_delete', 'Delete')}
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
    restoringIds, archivingIds, deletingIds, t,
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
          <Text size="sm" c="dimmed">{t('admin_campaign_count', '{{count}} campaigns', { count: total })}</Text>
          <Pagination value={page} onChange={onPageChange} total={totalPages} size="sm" />
        </Group>
      )}
    </>
  );
}

setWpsgDebugDisplayName(CampaignsMobileList, 'AdminPanel:CampaignsMobileList');
