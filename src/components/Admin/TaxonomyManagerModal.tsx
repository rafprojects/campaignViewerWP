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
  apiClient: ApiClient;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
  onMutate: () => void;
}

function CategoryRow({ cat, apiClient, onNotify, onMutate }: CategoryRowProps) {
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
      onNotify({ type: 'success', text: `Category renamed to "${value.trim()}"` });
    } catch {
      onNotify({ type: 'error', text: 'Failed to rename category' });
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
      onNotify({ type: 'success', text: `Category "${cat.name}" deleted` });
    } catch {
      onNotify({ type: 'error', text: 'Failed to delete category' });
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Group gap="xs" align="center">
        <TextInput
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setEditing(false); }}
          size="xs"
          style={{ flex: 1 }}
          autoFocus
          aria-label="Edit category name"
        />
        <ActionIcon size="sm" variant="filled" color="green" loading={saving} onClick={() => void handleSave()} aria-label="Save">
          <IconCheck size={14} />
        </ActionIcon>
        <ActionIcon size="sm" variant="subtle" onClick={() => { setValue(cat.name); setEditing(false); }} aria-label="Cancel">
          <IconX size={14} />
        </ActionIcon>
      </Group>
    );
  }

  return (
    <Group gap="xs" justify="space-between">
      <Group gap="xs">
        <Text size="sm">{cat.name}</Text>
        {cat.count > 0 && <Badge size="xs" variant="light">{cat.count}</Badge>}
      </Group>
      <Group gap={4}>
        <ActionIcon size="sm" variant="subtle" onClick={() => setEditing(true)} aria-label={`Rename ${cat.name}`}>
          <IconPencil size={14} />
        </ActionIcon>
        <ActionIcon size="sm" variant="subtle" color="red" loading={deleting} onClick={() => void handleDelete()} aria-label={`Delete ${cat.name}`}>
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
  return (
    <Group gap="xs" justify="space-between">
      <Group gap="xs">
        <Text size="sm">{tag.name}</Text>
        {tag.count > 0 && <Badge size="xs" variant="light">{tag.count}</Badge>}
      </Group>
      <ActionIcon size="sm" variant="subtle" color="red" loading={deleting} onClick={() => void onDelete(String(tag.id))} aria-label={`Delete ${tag.name}`}>
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
        Add
      </Button>
    </Group>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function TaxonomyManagerModal({ opened, apiClient, onClose, onNotify }: TaxonomyManagerModalProps) {
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
      onNotify({ type: 'success', text: `Category "${name}" created` });
    } catch {
      onNotify({ type: 'error', text: 'Failed to create category' });
    }
  }

  async function handleAddCampaignTag(name: string) {
    try {
      await apiClient.createCampaignTag(name);
      invalidateCampaignTags();
      onNotify({ type: 'success', text: `Tag "${name}" created` });
    } catch {
      onNotify({ type: 'error', text: 'Failed to create tag' });
    }
  }

  async function handleDeleteCampaignTag(id: string) {
    setDeletingTagId(id);
    try {
      await apiClient.deleteCampaignTag(id);
      invalidateCampaignTags();
      onNotify({ type: 'success', text: 'Tag deleted' });
    } catch {
      onNotify({ type: 'error', text: 'Failed to delete tag' });
    } finally {
      setDeletingTagId(null);
    }
  }

  async function handleAddMediaTag(name: string) {
    try {
      await apiClient.createMediaTag(name);
      invalidateMediaTags();
      onNotify({ type: 'success', text: `Media tag "${name}" created` });
    } catch {
      onNotify({ type: 'error', text: 'Failed to create media tag' });
    }
  }

  async function handleDeleteMediaTag(id: string) {
    setDeletingTagId(id);
    try {
      await apiClient.deleteMediaTag(id);
      invalidateMediaTags();
      onNotify({ type: 'success', text: 'Media tag deleted' });
    } catch {
      onNotify({ type: 'error', text: 'Failed to delete media tag' });
    } finally {
      setDeletingTagId(null);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Manage Taxonomy"
      size="sm"
      {...getWpsgDebugProps('TaxonomyManagerModal')}
    >
      <Tabs defaultValue="categories">
        <Tabs.List>
          <Tabs.Tab value="categories">Categories</Tabs.Tab>
          <Tabs.Tab value="campaign-tags">Campaign Tags</Tabs.Tab>
          <Tabs.Tab value="media-tags">Media Tags</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories" pt="sm">
          <Stack gap="xs">
            {campaignCategories.length === 0 && (
              <Text size="sm" c="dimmed">No categories yet.</Text>
            )}
            {campaignCategories.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                apiClient={apiClient}
                onNotify={onNotify}
                onMutate={invalidateCategories}
              />
            ))}
            <AddTermForm placeholder="New category name" onAdd={handleAddCategory} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="campaign-tags" pt="sm">
          <Stack gap="xs">
            {campaignTags.length === 0 && (
              <Text size="sm" c="dimmed">No campaign tags yet.</Text>
            )}
            {campaignTags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                onDelete={handleDeleteCampaignTag}
                deleting={deletingTagId === String(tag.id)}
              />
            ))}
            <AddTermForm placeholder="New campaign tag" onAdd={handleAddCampaignTag} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="media-tags" pt="sm">
          <Stack gap="xs">
            {mediaTags.length === 0 && (
              <Text size="sm" c="dimmed">No media tags yet.</Text>
            )}
            {mediaTags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                onDelete={handleDeleteMediaTag}
                deleting={deletingTagId === String(tag.id)}
              />
            ))}
            <AddTermForm placeholder="New media tag" onAdd={handleAddMediaTag} />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

setWpsgDebugDisplayName(TaxonomyManagerModal, 'TaxonomyManagerModal');
