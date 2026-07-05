import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Text, Box, Group, Badge, Tooltip, Button, Checkbox, Select, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconCopy, IconDownload, IconFileZip, IconArchive, IconArchiveOff, IconLayoutGrid, IconTrash, IconChevronDown, IconArrowsExchange, IconPhotoPlus } from '@tabler/icons-react';
import type { AccessSummaryItem, AdminCampaign } from '@/services/adminQuery';
import type { CampaignCategoryEntry } from '@/services/apiClient';
import { useAllCompanies, usePatchCampaign } from '@/services/adminQuery';
import type { CampaignActionsHandle } from '@/hooks/useAdminCampaignActions';
import { describeCampaignGalleryOverrides, hasCampaignGalleryOverrides } from '@/utils/campaignGalleryOverrides';
import { CompanyCombobox } from '@/components/Common/CompanyCombobox';
import type { ApiClient } from '@/services/apiClient';

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface Options {
  campaigns: AdminCampaign[];
  campaignActions: CampaignActionsHandle;
  apiClient: ApiClient;
  /** Map of campaign id (number) → AccessSummaryItem. Undefined while loading. */
  grantSummary?: Map<number, AccessSummaryItem> | undefined;
  /** P50-A: show the owner-only "Move" action (host computes space gating). */
  canMoveCampaigns?: boolean;
  /** P50-I: open the unified media-upload modal targeting this campaign. */
  onAddMedia?: (campaign: AdminCampaign) => void;
  /** P52-C: all categories for ID→name resolution in the listing. */
  categoryItems?: CampaignCategoryEntry[];
}

export function useCampaignsRows({ campaigns, campaignActions, grantSummary, apiClient, canMoveCampaigns = false, onAddMedia, categoryItems }: Options) {
  const { t } = useTranslation('wpsg');
  const {
    selectedCampaignIds,
    handleToggleCampaignSelect, handleEdit,
    setDuplicateSource, setMoveSource, handleExportCampaign,
    handleBinaryExportCampaign, binaryExportingIds,
    setConfirmRestore, setConfirmArchive, setConfirmDelete,
    restoringIds, archivingIds, deletingIds,
  } = campaignActions;

  const { mutate: patchCampaign } = usePatchCampaign(apiClient);
  const { companies, companiesLoading } = useAllCompanies(apiClient);

  return useMemo(() => {
    const statusOptions = [
      { value: 'draft', label: t('admin_status_draft', 'Draft') },
      { value: 'active', label: t('admin_status_active', 'Active') },
      { value: 'archived', label: t('admin_status_archived', 'Archived') },
    ];
    const visibilityOptions = [
      { value: 'public', label: t('admin_visibility_public', 'Public') },
      { value: 'private', label: t('admin_visibility_private', 'Private') },
    ];
    const catMap = new Map((categoryItems ?? []).map((cat) => [cat.id, cat.name]));
    return campaigns.map((c) => {
      const cid = String(c.id);
      const isSelected = selectedCampaignIds.has(cid);
      const galleryOverrideSummary = describeCampaignGalleryOverrides(c);
      const overrideText = galleryOverrideSummary.join(', ') || t('admin_camprow_nested_fallback', 'Nested campaign gallery overrides');
      const summary = grantSummary?.get(Number(c.id));

      const now = Date.now();
      let sched: { text: string; color: string } | null = null;
      if (c.publishAt && new Date(c.publishAt).getTime() > now) {
        sched = { text: t('admin_sched_scheduled', 'Scheduled'), color: 'blue' };
      } else if (c.unpublishAt) {
        const end = new Date(c.unpublishAt).getTime();
        if (end <= now) sched = { text: t('admin_sched_expired', 'Expired'), color: 'red' };
        else if (end - now < 86_400_000) sched = { text: t('admin_sched_expiring', 'Expiring soon'), color: 'orange' };
      }

      return (
        <Table.Tr key={c.id} data-selected={isSelected || undefined}>
          <Table.Td w={36}>
            <Checkbox
              checked={isSelected}
              onChange={() => handleToggleCampaignSelect(cid)}
              aria-label={t('admin_select_item', 'Select {{title}}', { title: c.title })}
            />
          </Table.Td>
          <Table.Td>
            <Box>
              <Group gap={6}>
                <Text fw={700}>{c.title}</Text>
                {hasCampaignGalleryOverrides(c) && (
                  <Tooltip label={t('admin_custom_gallery', 'Custom gallery: {{summary}}', { summary: overrideText })} withArrow>
                    <Box
                      component="span"
                      role="img"
                      aria-label={t('admin_camprow_overrides_aria', 'Custom gallery overrides: {{summary}}', { summary: overrideText })}
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
            <Group gap={4} wrap="nowrap" align="center">
              <Select
                size="xs"
                variant="filled"
                data={statusOptions}
                value={c.status}
                onChange={(v) => {
                  if (!v || v === c.status) return;
                  const status = v as AdminCampaign['status'];
                  patchCampaign(
                    { id: cid, apiPatch: { status }, optimisticPatch: { status } },
                    { onError: () => notifications.show({ message: t('admin_camprow_fail_status', 'Failed to update status.'), color: 'red', autoClose: 3000 }) },
                  );
                }}
                styles={{ input: { minWidth: 90 } }}
                comboboxProps={{ width: 120 }}
                withCheckIcon={false}
                aria-label={t('admin_camprow_status_aria', 'Status for {{title}}', { title: c.title })}
              />
              {sched && <Badge variant="light" color={sched.color} size="xs">{sched.text}</Badge>}
            </Group>
          </Table.Td>
          <Table.Td>
            <Select
              size="xs"
              variant="filled"
              data={visibilityOptions}
              value={c.visibility}
              onChange={(v) => {
                if (!v || v === c.visibility) return;
                const visibility = v as AdminCampaign['visibility'];
                patchCampaign(
                  { id: cid, apiPatch: { visibility }, optimisticPatch: { visibility } },
                  { onError: () => notifications.show({ message: t('admin_camprow_fail_visibility', 'Failed to update visibility.'), color: 'red', autoClose: 3000 }) },
                );
              }}
              styles={{ input: { minWidth: 80 } }}
              withCheckIcon={false}
              aria-label={t('admin_camprow_visibility_aria', 'Visibility for {{title}}', { title: c.title })}
            />
          </Table.Td>
          <Table.Td>
            <CompanyCombobox
              value={c.companyId}
              onChange={(v) => {
                if (v === c.companyId) return;
                const existing = companies.find((co) => co.slug === v);
                const companyPayload = existing ? v : { name: v, slug: toSlug(v) };
                patchCampaign(
                  { id: cid, apiPatch: { company: companyPayload } },
                  { onError: () => notifications.show({ message: t('admin_camprow_fail_company', 'Failed to update company.'), color: 'red', autoClose: 3000 }) },
                );
              }}
              companies={companies}
              loading={companiesLoading}
              size="xs"
              placeholder={c.companyName ?? c.companyId ?? '—'}
            />
          </Table.Td>
          <Table.Td>
            {summary !== undefined ? (
              <Group gap={4} wrap="nowrap">
                <Tooltip label={t('admin_camprow_grants_tt', '{{count}} active grant', { count: summary.grantCount })} withArrow>
                  <Badge variant="light" color="blue" size="sm">{summary.grantCount}</Badge>
                </Tooltip>
                {summary.pendingRequestCount > 0 && (
                  <Tooltip label={t('admin_camprow_pending_tt', '{{count}} pending request', { count: summary.pendingRequestCount })} withArrow>
                    <Badge variant="dot" color="orange" size="sm">{summary.pendingRequestCount}</Badge>
                  </Tooltip>
                )}
              </Group>
            ) : (
              <Text size="xs" c="dimmed">—</Text>
            )}
          </Table.Td>
          <Table.Td>
            {c.tags.length > 0 ? (
              <Group gap={4} wrap="wrap">
                {c.tags.map((tag) => (
                  <Badge key={tag} size="xs" variant="light">{tag}</Badge>
                ))}
              </Group>
            ) : (
              <Text size="xs" c="dimmed">—</Text>
            )}
          </Table.Td>
          <Table.Td>
            {(c.categories ?? []).length > 0 ? (
              <Group gap={4} wrap="wrap">
                {(c.categories ?? []).map((id) => (
                  <Badge key={id} size="xs" variant="outline">{catMap.get(id) ?? id}</Badge>
                ))}
              </Group>
            ) : (
              <Text size="xs" c="dimmed">—</Text>
            )}
          </Table.Td>
          <Table.Td>
            <Group gap="xs" wrap="wrap">
              <Button variant="outline" size="xs" leftSection={<IconEdit size={14} />} onClick={() => handleEdit(c)}>{t('admin_edit', 'Edit')}</Button>
              {onAddMedia && (
                <Tooltip label={t('admin_camprow_add_media_tt', 'Add media to this campaign')}>
                  <Button variant="subtle" size="xs" leftSection={<IconPhotoPlus size={14} />} onClick={() => onAddMedia(c)} aria-label={t('admin_camprow_add_media_aria', 'Add media to {{title}}', { title: c.title })}>{t('lb_mp_add_media', 'Add media')}</Button>
                </Tooltip>
              )}
              <Tooltip label={t('admin_camprow_clone_tt', 'Clone campaign')}>
                <Button variant="subtle" size="xs" leftSection={<IconCopy size={14} />} onClick={() => setDuplicateSource(c)} aria-label={t('admin_duplicate_item', 'Duplicate {{title}}', { title: c.title })}>{t('admin_clone', 'Clone')}</Button>
              </Tooltip>
              {canMoveCampaigns && (
                <Tooltip label={t('admin_camprow_move_tt', 'Move to another space')}>
                  <Button variant="subtle" size="xs" leftSection={<IconArrowsExchange size={14} />} onClick={() => setMoveSource(c)} aria-label={t('admin_camprow_move_aria', 'Move {{title}} to another space', { title: c.title })}>{t('admin_move', 'Move')}</Button>
                </Tooltip>
              )}
              <Menu shadow="md" width={210} position="bottom-end" withinPortal>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    rightSection={<IconChevronDown size={12} />}
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
                <Button color="teal" size="xs" leftSection={<IconArchiveOff size={14} />} loading={restoringIds.has(cid)} onClick={() => setConfirmRestore(c)}>{t('admin_restore', 'Restore')}</Button>
              ) : (
                <Button color="orange" variant="light" size="xs" leftSection={<IconArchive size={14} />} loading={archivingIds.has(cid)} onClick={() => setConfirmArchive(c)}>{t('admin_archive', 'Archive')}</Button>
              )}
              <Tooltip label={t('admin_camprow_delete_tt', 'Permanently delete campaign')}>
                <Button color="red" variant="subtle" size="xs" leftSection={<IconTrash size={14} />} loading={deletingIds.has(cid)} onClick={() => setConfirmDelete(c)} aria-label={t('admin_delete_item', 'Delete {{title}}', { title: c.title })}>{t('admin_delete', 'Delete')}</Button>
              </Tooltip>
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    });
  }, [t, campaigns, selectedCampaignIds, grantSummary, companies, companiesLoading, patchCampaign, handleToggleCampaignSelect, handleEdit, setDuplicateSource, setMoveSource, canMoveCampaigns, onAddMedia, categoryItems, handleExportCampaign, handleBinaryExportCampaign, binaryExportingIds, setConfirmRestore, setConfirmArchive, setConfirmDelete, restoringIds, archivingIds, deletingIds]);
}
