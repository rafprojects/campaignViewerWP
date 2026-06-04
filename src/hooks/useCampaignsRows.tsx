import { useMemo } from 'react';
import { Table, Text, Box, Group, Badge, Tooltip, Button, Checkbox, Select, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconCopy, IconDownload, IconFileZip, IconArchive, IconArchiveOff, IconLayoutGrid, IconTrash, IconChevronDown } from '@tabler/icons-react';
import type { AccessSummaryItem, AdminCampaign } from '@/services/adminQuery';
import { useAllCompanies, usePatchCampaign } from '@/services/adminQuery';
import type { CampaignActionsHandle } from '@/hooks/useAdminCampaignActions';
import { describeCampaignGalleryOverrides, hasCampaignGalleryOverrides } from '@/utils/campaignGalleryOverrides';
import { CompanyCombobox } from '@/components/Common/CompanyCombobox';
import type { ApiClient } from '@/services/apiClient';

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
] as const;

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
  apiClient: ApiClient;
  /** Map of campaign id (number) → AccessSummaryItem. Undefined while loading. */
  grantSummary?: Map<number, AccessSummaryItem> | undefined;
}

export function useCampaignsRows({ campaigns, campaignActions, grantSummary, apiClient }: Options) {
  const {
    selectedCampaignIds,
    handleToggleCampaignSelect, handleEdit,
    setDuplicateSource, handleExportCampaign,
    handleBinaryExportCampaign, binaryExportingIds,
    setConfirmRestore, setConfirmArchive, setConfirmDelete,
    restoringIds, archivingIds, deletingIds,
  } = campaignActions;

  const { mutate: patchCampaign } = usePatchCampaign(apiClient);
  const { companies, companiesLoading } = useAllCompanies(apiClient);

  return useMemo(() => {
    return campaigns.map((c) => {
      const cid = String(c.id);
      const isSelected = selectedCampaignIds.has(cid);
      const galleryOverrideSummary = describeCampaignGalleryOverrides(c);
      const summary = grantSummary?.get(Number(c.id));
      const sched = scheduleLabel(c.publishAt, c.unpublishAt);

      return (
        <Table.Tr key={c.id} data-selected={isSelected || undefined}>
          <Table.Td w={36}>
            <Checkbox
              checked={isSelected}
              onChange={() => handleToggleCampaignSelect(cid)}
              aria-label={`Select ${c.title}`}
            />
          </Table.Td>
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
            <Group gap={4} wrap="nowrap" align="center">
              <Select
                size="xs"
                variant="filled"
                data={STATUS_OPTIONS}
                value={c.status}
                onChange={(v) => {
                  if (!v || v === c.status) return;
                  const status = v as AdminCampaign['status'];
                  patchCampaign(
                    { id: cid, apiPatch: { status }, optimisticPatch: { status } },
                    { onError: () => notifications.show({ message: 'Failed to update status.', color: 'red', autoClose: 3000 }) },
                  );
                }}
                styles={{ input: { minWidth: 90 } }}
                comboboxProps={{ width: 120 }}
                withCheckIcon={false}
                aria-label={`Status for ${c.title}`}
              />
              {sched && <Badge variant="light" color={sched.color} size="xs">{sched.text}</Badge>}
            </Group>
          </Table.Td>
          <Table.Td>
            <Select
              size="xs"
              variant="filled"
              data={VISIBILITY_OPTIONS}
              value={c.visibility}
              onChange={(v) => {
                if (!v || v === c.visibility) return;
                const visibility = v as AdminCampaign['visibility'];
                patchCampaign(
                  { id: cid, apiPatch: { visibility }, optimisticPatch: { visibility } },
                  { onError: () => notifications.show({ message: 'Failed to update visibility.', color: 'red', autoClose: 3000 }) },
                );
              }}
              styles={{ input: { minWidth: 80 } }}
              withCheckIcon={false}
              aria-label={`Visibility for ${c.title}`}
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
                  { onError: () => notifications.show({ message: 'Failed to update company.', color: 'red', autoClose: 3000 }) },
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
              <Menu shadow="md" width={210} position="bottom-end" withinPortal>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconDownload size={14} />}
                    rightSection={<IconChevronDown size={12} />}
                    loading={binaryExportingIds.has(cid)}
                    aria-label={`Export ${c.title}`}
                  >
                    Export
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconFileZip size={14} />} onClick={() => void handleBinaryExportCampaign(c)}>
                    Export as ZIP (includes media)
                  </Menu.Item>
                  <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => void handleExportCampaign(c)}>
                    Export as JSON (data only)
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
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
  }, [campaigns, selectedCampaignIds, grantSummary, companies, companiesLoading, patchCampaign, handleToggleCampaignSelect, handleEdit, setDuplicateSource, handleExportCampaign, handleBinaryExportCampaign, binaryExportingIds, setConfirmRestore, setConfirmArchive, setConfirmDelete, restoringIds, archivingIds, deletingIds]);
}
