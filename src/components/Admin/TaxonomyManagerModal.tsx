import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApiClient, CampaignCategoryEntry, TagEntry } from '@/services/apiClient';
import {
  getCampaignCategoriesQueryKey,
  getCampaignTagsQueryKey,
  getMediaTagsQueryKey,
  useCampaignCategories,
  useCampaignTags,
  useMediaTags,
} from '@/services/adminQuery';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface TaxonomyManagerModalProps {
  opened: boolean;
  apiClient: ApiClient;
  onClose: () => void;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

// ── Category Row ─────────────────────────────────────────────────────────────

interface CategoryRowProps {
  cat: CampaignCategoryEntry;
  depth: number;
  parentName?: string | undefined;
  apiClient: ApiClient;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
  onMutate: () => void;
}

function CategoryRow({ cat, depth, parentName, apiClient, onNotify, onMutate }: CategoryRowProps) {
  const { t } = useTranslation('wpsg');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cat.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!value.trim() || value.trim() === cat.name) { setEditing(false); return; }
    setSaving(true);
    try {
      await apiClient.updateCampaignCategory(cat.id, { name: value.trim() });
      onMutate();
      onNotify({ type: 'success', text: t('admin_tax_cat_renamed', 'Category renamed to "{{name}}"', { name: value.trim() }) });
    } catch {
      onNotify({ type: 'error', text: t('admin_tax_cat_rename_fail', 'Failed to rename category') });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiClient.deleteCampaignCategory(cat.id);
      onMutate();
      onNotify({ type: 'success', text: t('admin_tax_cat_deleted', 'Category "{{name}}" deleted', { name: cat.name }) });
    } catch {
      onNotify({ type: 'error', text: t('admin_tax_cat_delete_fail', 'Failed to delete category') });
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Group gap="xs" align="center" pl={depth * 16}>
        <TextInput
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setEditing(false); }}
          size="xs"
          style={{ flex: 1 }}
          autoFocus
          aria-label={t('admin_tax_edit_cat_aria', 'Edit category name')}
        />
        <ActionIcon size="sm" variant="filled" color="green" loading={saving} onClick={() => void handleSave()} aria-label={t('admin_tax_save', 'Save')}>
          <IconCheck size={14} />
        </ActionIcon>
        <ActionIcon size="sm" variant="subtle" onClick={() => { setValue(cat.name); setEditing(false); }} aria-label={t('admin_tax_cancel', 'Cancel')}>
          <IconX size={14} />
        </ActionIcon>
      </Group>
    );
  }

  return (
    <Group gap="xs" justify="space-between" pl={depth * 16}>
      <Group gap="xs">
        {/* eslint-disable-next-line i18next/no-literal-string -- tree-indent glyph, not translatable text */}
        {depth > 0 && <Text size="xs" c="dimmed">↳</Text>}
        <Text size="sm">{cat.name}</Text>
        {parentName && <Badge size="xs" variant="light" color="gray">{parentName}</Badge>}
        {cat.count > 0 && <Badge size="xs" variant="light">{cat.count}</Badge>}
      </Group>
      <Group gap={4}>
        <ActionIcon size="sm" variant="subtle" onClick={() => setEditing(true)} aria-label={t('admin_tax_rename_name', 'Rename {{name}}', { name: cat.name })}>
          <IconPencil size={14} />
        </ActionIcon>
        <ActionIcon size="sm" variant="subtle" color="red" loading={deleting} onClick={() => void handleDelete()} aria-label={t('admin_tax_delete_name', 'Delete {{name}}', { name: cat.name })}>
          <IconTrash size={14} />
        </ActionIcon>
      </Group>
    </Group>
  );
}

// ── Tag Row ───────────────────────────────────────────────────────────────────

interface TagRowProps {
  tag: TagEntry;
  onDelete: (id: string) => Promise<void>;
  deleting: boolean;
}

function TagRow({ tag, onDelete, deleting }: TagRowProps) {
  const { t } = useTranslation('wpsg');
  return (
    <Group gap="xs" justify="space-between">
      <Group gap="xs">
        <Text size="sm">{tag.name}</Text>
        {tag.count > 0 && <Badge size="xs" variant="light">{tag.count}</Badge>}
      </Group>
      <ActionIcon size="sm" variant="subtle" color="red" loading={deleting} onClick={() => void onDelete(String(tag.id))} aria-label={t('admin_tax_delete_name', 'Delete {{name}}', { name: tag.name })}>
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  );
}

// ── Add Term Form ─────────────────────────────────────────────────────────────

interface AddTermFormProps {
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
}

function AddTermForm({ placeholder, onAdd }: AddTermFormProps) {
  const { t } = useTranslation('wpsg');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      setName('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Group gap="xs" align="flex-end">
      <TextInput
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
        size="xs"
        style={{ flex: 1 }}
        aria-label={placeholder}
      />
      <Button size="xs" leftSection={<IconPlus size={12} />} loading={saving} onClick={() => void handleAdd()}>
        {t('admin_tax_add', 'Add')}
      </Button>
    </Group>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function TaxonomyManagerModal({ opened, apiClient, onClose, onNotify }: TaxonomyManagerModalProps) {
  const { t } = useTranslation('wpsg');
  const queryClient = useQueryClient();
  const { campaignCategories, mutateCampaignCategories } = useCampaignCategories(apiClient, opened);
  const { campaignTags, mutateCampaignTags } = useCampaignTags(apiClient, opened);
  const { mediaTags, mutateMediaTags } = useMediaTags(apiClient, opened);

  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  function invalidateCategories() {
    void queryClient.invalidateQueries({ queryKey: getCampaignCategoriesQueryKey(apiClient) });
    void mutateCampaignCategories();
  }

  function invalidateCampaignTags() {
    void queryClient.invalidateQueries({ queryKey: getCampaignTagsQueryKey(apiClient) });
    void mutateCampaignTags();
  }

  function invalidateMediaTags() {
    void queryClient.invalidateQueries({ queryKey: getMediaTagsQueryKey(apiClient) });
    void mutateMediaTags();
  }

  async function handleAddCategory(name: string) {
    try {
      await apiClient.createCampaignCategory(name);
      invalidateCategories();
      onNotify({ type: 'success', text: t('admin_tax_cat_created', 'Category "{{name}}" created', { name }) });
    } catch {
      onNotify({ type: 'error', text: t('admin_tax_cat_create_fail', 'Failed to create category') });
    }
  }

  async function handleAddCampaignTag(name: string) {
    try {
      await apiClient.createCampaignTag(name);
      invalidateCampaignTags();
      onNotify({ type: 'success', text: t('admin_tax_tag_created', 'Tag "{{name}}" created', { name }) });
    } catch {
      onNotify({ type: 'error', text: t('admin_tax_tag_create_fail', 'Failed to create tag') });
    }
  }

  async function handleDeleteCampaignTag(id: string) {
    setDeletingTagId(id);
    try {
      await apiClient.deleteCampaignTag(id);
      invalidateCampaignTags();
      onNotify({ type: 'success', text: t('admin_tax_tag_deleted', 'Tag deleted') });
    } catch {
      onNotify({ type: 'error', text: t('admin_tax_tag_delete_fail', 'Failed to delete tag') });
    } finally {
      setDeletingTagId(null);
    }
  }

  async function handleAddMediaTag(name: string) {
    try {
      await apiClient.createMediaTag(name);
      invalidateMediaTags();
      onNotify({ type: 'success', text: t('admin_tax_mtag_created', 'Media tag "{{name}}" created', { name }) });
    } catch {
      onNotify({ type: 'error', text: t('admin_tax_mtag_create_fail', 'Failed to create media tag') });
    }
  }

  async function handleDeleteMediaTag(id: string) {
    setDeletingTagId(id);
    try {
      await apiClient.deleteMediaTag(id);
      invalidateMediaTags();
      onNotify({ type: 'success', text: t('admin_tax_mtag_deleted', 'Media tag deleted') });
    } catch {
      onNotify({ type: 'error', text: t('admin_tax_mtag_delete_fail', 'Failed to delete media tag') });
    } finally {
      setDeletingTagId(null);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('admin_tax_title', 'Manage Taxonomy')}
      size="sm"
      {...getWpsgDebugProps('TaxonomyManagerModal')}
    >
      <Tabs defaultValue="categories">
        <Tabs.List>
          <Tabs.Tab value="categories">{t('admin_tax_tab_categories', 'Categories')}</Tabs.Tab>
          <Tabs.Tab value="campaign-tags">{t('admin_tax_tab_campaign_tags', 'Campaign Tags')}</Tabs.Tab>
          <Tabs.Tab value="media-tags">{t('admin_tax_tab_media_tags', 'Media Tags')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories" pt="sm">
          <Stack gap="xs">
            {campaignCategories.length === 0 && (
              <Text size="sm" c="dimmed">{t('admin_tax_no_categories', 'No categories yet.')}</Text>
            )}
            {(() => {
              const byId = new Map(campaignCategories.map((c) => [c.id, c]));
              const byParent = new Map<number, CampaignCategoryEntry[]>();
              for (const c of campaignCategories) {
                if ((c.parent_id ?? 0) !== 0) {
                  const list = byParent.get(c.parent_id) ?? [];
                  list.push(c);
                  byParent.set(c.parent_id, list);
                }
              }
              const roots = campaignCategories.filter((c) => (c.parent_id ?? 0) === 0);
              const rows: { cat: CampaignCategoryEntry; depth: number }[] = [];
              function walk(cats: CampaignCategoryEntry[], depth: number) {
                if (depth >= 3) return;
                for (const cat of cats) {
                  rows.push({ cat, depth });
                  walk(byParent.get(parseInt(cat.id, 10)) ?? [], depth + 1);
                }
              }
              walk(roots, 0);
              return rows.map(({ cat, depth }) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  depth={depth}
                  parentName={depth > 0 ? byId.get(String(cat.parent_id))?.name : undefined}
                  apiClient={apiClient}
                  onNotify={onNotify}
                  onMutate={invalidateCategories}
                />
              ));
            })()}
            <AddTermForm placeholder={t('admin_tax_new_category', 'New category name')} onAdd={handleAddCategory} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="campaign-tags" pt="sm">
          <Stack gap="xs">
            {campaignTags.length === 0 && (
              <Text size="sm" c="dimmed">{t('admin_tax_no_campaign_tags', 'No campaign tags yet.')}</Text>
            )}
            {campaignTags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                onDelete={handleDeleteCampaignTag}
                deleting={deletingTagId === String(tag.id)}
              />
            ))}
            <AddTermForm placeholder={t('admin_tax_new_campaign_tag', 'New campaign tag')} onAdd={handleAddCampaignTag} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="media-tags" pt="sm">
          <Stack gap="xs">
            {mediaTags.length === 0 && (
              <Text size="sm" c="dimmed">{t('admin_tax_no_media_tags', 'No media tags yet.')}</Text>
            )}
            {mediaTags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                onDelete={handleDeleteMediaTag}
                deleting={deletingTagId === String(tag.id)}
              />
            ))}
            <AddTermForm placeholder={t('admin_tax_new_media_tag', 'New media tag')} onAdd={handleAddMediaTag} />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

setWpsgDebugDisplayName(TaxonomyManagerModal, 'TaxonomyManagerModal');
