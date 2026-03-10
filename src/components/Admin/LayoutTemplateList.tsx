/**
 * P15-F.1 + P15-F.4: Layout Template List & Management
 *
 * Admin panel tab that displays all saved layout templates with
 * grid/list toggle, search/filter, and action buttons (edit, duplicate,
 * delete). Includes import/export JSON functionality.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  FileButton,
  Group,
  Menu,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconCopy,
  IconDots,
  IconDownload,
  IconEdit,
  IconLayoutDashboard,
  IconList,
  IconGridDots,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import useSWR from 'swr';
import type { ApiClient } from '@/services/apiClient';
import type { LayoutTemplate } from '@/types';
import { LayoutBuilderModal } from './LayoutBuilder';
import { PresetGalleryModal } from './LayoutBuilder/PresetGalleryModal';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { createEmptyTemplate } from '@/hooks/useLayoutBuilderState';
import type { LayoutPreset } from '@/data/layoutPresets';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format ISO date to a short locale string. */
function shortDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format aspect ratio number to a human-friendly label. */
function aspectLabel(ratio: number): string {
  if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.02) return '4:3';
  if (Math.abs(ratio - 1) < 0.02) return '1:1';
  if (Math.abs(ratio - 21 / 9) < 0.02) return '21:9';
  if (Math.abs(ratio - 3 / 2) < 0.02) return '3:2';
  return ratio.toFixed(2);
}

// ── Schema validation for import ─────────────────────────────────────────────

function isValidTemplate(data: unknown): data is LayoutTemplate {
  if (!data || typeof data !== 'object') return false;
  const t = data as Record<string, unknown>;
  return (
    typeof t.name === 'string' &&
    typeof t.canvasAspectRatio === 'number' &&
    Array.isArray(t.slots) &&
    t.slots.every(
      (s: unknown) =>
        s &&
        typeof s === 'object' &&
        typeof (s as Record<string, unknown>).x === 'number' &&
        typeof (s as Record<string, unknown>).y === 'number' &&
        typeof (s as Record<string, unknown>).width === 'number' &&
        typeof (s as Record<string, unknown>).height === 'number',
    )
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface LayoutTemplateListProps {
  apiClient: ApiClient;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
  /** If set, open the builder for this template ID as soon as data loads. */
  initialTemplateId?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function LayoutTemplateList({ apiClient, onNotify, initialTemplateId }: LayoutTemplateListProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<LayoutTemplate | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LayoutTemplate | null>(null);
  const [presetGalleryOpen, setPresetGalleryOpen] = useState(false);
  const resetRef = useRef<() => void>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: templates, isLoading, mutate } = useSWR<LayoutTemplate[]>(
    'admin-layout-templates',
    () => apiClient.getLayoutTemplates(),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  // ── Open builder for initialTemplateId once data is available ─────────────
  const handledInitialRef = useRef(false);
  useEffect(() => {
    if (!initialTemplateId || !templates || handledInitialRef.current) return;
    const target = templates.find((t) => t.id === initialTemplateId);
    if (target) {
      handledInitialRef.current = true;
      setEditingTemplate(target);
      setBuilderOpen(true);
    }
  }, [initialTemplateId, templates]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = templates ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [templates, searchQuery]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    setEditingTemplate(null);
    setBuilderOpen(true);
  }, []);

  const handleCreateFromPreset = useCallback((preset: LayoutPreset) => {
    const t = createEmptyTemplate(preset.name);
    // Re-generate slot IDs to avoid conflicts
    t.slots = preset.slots.map((s, i) => ({
      ...s,
      id: crypto.randomUUID?.() ?? `slot-${Date.now()}-${i}`,
    }));
    t.canvasAspectRatio = preset.canvasAspectRatio;
    t.tags = [...preset.tags];
    setEditingTemplate(t as LayoutTemplate);
    setBuilderOpen(true);
  }, []);

  const handleEdit = useCallback((t: LayoutTemplate) => {
    setEditingTemplate(t);
    setBuilderOpen(true);
  }, []);

  const handleBuilderSaved = useCallback(
    (saved: LayoutTemplate) => {
      // Optimistically update the SWR cache so the template list (and any
      // immediate re-open of the builder) reflect the latest server data
      // without waiting for a background revalidation round-trip.
      mutate(
        (current) => {
          if (!current) return [saved];
          const idx = current.findIndex((t) => t.id === saved.id);
          if (idx >= 0) {
            const next = [...current];
            next[idx] = saved;
            return next;
          }
          return [...current, saved];
        },
        { revalidate: false },
      );
    },
    [mutate],
  );

  const handleBuilderClose = useCallback(() => {
    setBuilderOpen(false);
    setEditingTemplate(null);
  }, []);

  const handleDuplicate = useCallback(
    async (t: LayoutTemplate) => {
      try {
        await apiClient.duplicateLayoutTemplate(t.id, `${t.name} (copy)`);
        onNotify({ type: 'success', text: `Duplicated "${t.name}"` });
        mutate();
      } catch (err) {
        onNotify({ type: 'error', text: (err as Error).message });
      }
    },
    [apiClient, mutate, onNotify],
  );

  const handleDelete = useCallback(
    async () => {
      if (!confirmDelete) return;
      try {
        await apiClient.deleteLayoutTemplate(confirmDelete.id);
        onNotify({ type: 'success', text: `Deleted "${confirmDelete.name}"` });
        setConfirmDelete(null);
        mutate();
      } catch (err) {
        onNotify({ type: 'error', text: (err as Error).message });
      }
    },
    [apiClient, confirmDelete, mutate, onNotify],
  );

  // ── Export (P15-F.4) ──────────────────────────────────────────────────────

  const handleExport = useCallback((t: LayoutTemplate) => {
    // Strip server-specific fields for portability
    const exportData = { ...t };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-${t.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Import (P15-F.4) ──────────────────────────────────────────────────────

  const handleImport = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!isValidTemplate(data)) {
          onNotify({ type: 'error', text: 'Invalid template JSON — missing required fields.' });
          return;
        }
        // Strip id so server creates a new one; update timestamps
        const { id: _id, ...rest } = data as LayoutTemplate & { id?: string };
        await apiClient.createLayoutTemplate({
          ...rest,
          name: rest.name + ' (imported)',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        onNotify({ type: 'success', text: `Imported "${rest.name}"` });
        mutate();
        resetRef.current?.();
      } catch (err) {
        onNotify({ type: 'error', text: `Import failed: ${(err as Error).message}` });
      }
    },
    [apiClient, mutate, onNotify],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Stack gap="md">
      {/* Toolbar */}
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm">
          <TextInput
            placeholder="Search layouts…"
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ minWidth: 200, flex: '1 1 200px' }}
            aria-label="Search layout templates"
          />
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'grid' | 'list')}
            data={[
              { value: 'grid', label: <IconGridDots size={16} /> },
              { value: 'list', label: <IconList size={16} /> },
            ]}
            aria-label="View mode"
          />
        </Group>
        <Group gap="sm">
          <FileButton onChange={handleImport} accept="application/json" resetRef={resetRef}>
            {(props) => (
              <Button variant="outline" leftSection={<IconUpload size={16} />} size="sm" {...props}>
                Import
              </Button>
            )}
          </FileButton>
          <Button leftSection={<IconPlus size={16} />} size="sm" onClick={handleCreate}>
            New Layout
          </Button>
          <Button
            variant="light"
            leftSection={<IconLayoutDashboard size={16} />}
            size="sm"
            onClick={() => setPresetGalleryOpen(true)}
          >
            From Preset
          </Button>
        </Group>
      </Group>

      {/* Loading skeleton */}
      {isLoading && (
        <Group gap="md" wrap="wrap">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={120} width={200} radius="md" />
          ))}
        </Group>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <IconLayoutDashboard size={48} color="var(--mantine-color-dimmed)" />
            <Text c="dimmed">
              {searchQuery ? 'No layouts match your search.' : 'No layout templates yet.'}
            </Text>
            {!searchQuery && (
              <Button variant="light" size="sm" onClick={handleCreate}>
                Create your first layout
              </Button>
            )}
          </Stack>
        </Center>
      )}

      {/* Grid view */}
      {!isLoading && filtered.length > 0 && viewMode === 'grid' && (
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((t) => (
            <TemplateGridCard
              key={t.id}
              template={t}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={setConfirmDelete}
              onExport={handleExport}
            />
          ))}
        </Box>
      )}

      {/* List view */}
      {!isLoading && filtered.length > 0 && viewMode === 'list' && (
        <Table.ScrollContainer minWidth={600}>
          <Table verticalSpacing="sm" highlightOnHover aria-label="Layout template list">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Slots</Table.Th>
                <Table.Th>Aspect</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th>Tags</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{t.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light">{t.slots.length} slots</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{aspectLabel(t.canvasAspectRatio)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{shortDate(t.updatedAt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {t.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} size="xs" variant="outline">{tag}</Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="Edit">
                        <ActionIcon variant="subtle" size="sm" onClick={() => handleEdit(t)} aria-label={`Edit ${t.name}`}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Duplicate">
                        <ActionIcon variant="subtle" size="sm" onClick={() => handleDuplicate(t)} aria-label={`Duplicate ${t.name}`}>
                          <IconCopy size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Export JSON">
                        <ActionIcon variant="subtle" size="sm" onClick={() => handleExport(t)} aria-label={`Export ${t.name}`}>
                          <IconDownload size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setConfirmDelete(t)} aria-label={`Delete ${t.name}`}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {/* Layout Builder Modal – key forces remount so useState re-inits */}
      <LayoutBuilderModal
        key={editingTemplate?.id ?? 'new'}
        opened={builderOpen}
        initialTemplate={editingTemplate ?? undefined}
        apiClient={apiClient}
        onSaved={handleBuilderSaved}
        onClose={handleBuilderClose}
        onNotify={onNotify}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete layout template?"
        message={`Are you sure you want to delete "${confirmDelete?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />

      {/* Preset gallery (P15-J.2) */}
      <PresetGalleryModal
        opened={presetGalleryOpen}
        onClose={() => setPresetGalleryOpen(false)}
        onSelect={handleCreateFromPreset}
      />
    </Stack>
  );
}

// ── Grid Card ────────────────────────────────────────────────────────────────

interface TemplateGridCardProps {
  template: LayoutTemplate;
  onEdit: (t: LayoutTemplate) => void;
  onDuplicate: (t: LayoutTemplate) => void;
  onDelete: (t: LayoutTemplate) => void;
  onExport: (t: LayoutTemplate) => void;
}

function TemplateGridCard({ template, onEdit, onDuplicate, onDelete, onExport }: TemplateGridCardProps) {
  const t = template;
  return (
    <Card
      shadow="xs"
      radius="md"
      withBorder
      padding="sm"
      style={{ cursor: 'pointer' }}
      onClick={() => onEdit(t)}
      role="button"
      tabIndex={0}
      aria-label={`Edit layout ${t.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(t);
        }
      }}
    >
      {/* Mini canvas preview (metadata only for v1) */}
      <Box
        style={{
          height: 80,
          background: t.backgroundColor || '#1a1a1a',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Miniature slot indicators */}
        {t.slots.slice(0, 8).map((slot) => (
          <div
            key={slot.id}
            style={{
              position: 'absolute',
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: `${slot.width}%`,
              height: `${slot.height}%`,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: slot.shape === 'rectangle' ? Math.min(slot.borderRadius, 4) : undefined,
            }}
          />
        ))}
        <Badge
          size="xs"
          variant="filled"
          color="dark"
          style={{ position: 'absolute', bottom: 4, right: 4 }}
        >
          {aspectLabel(t.canvasAspectRatio)}
        </Badge>
      </Box>

      <Group justify="space-between" wrap="nowrap" gap={4}>
        <Box style={{ overflow: 'hidden' }}>
          <Text size="sm" fw={600} lineClamp={1}>{t.name}</Text>
          <Text size="xs" c="dimmed">
            {t.slots.length} slot{t.slots.length !== 1 ? 's' : ''} · {shortDate(t.updatedAt)}
          </Text>
        </Box>

        {/* Action menu */}
        <Menu position="bottom-end" withArrow>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Actions for ${t.name}`}
            >
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEdit(t)}>
              Edit
            </Menu.Item>
            <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => onDuplicate(t)}>
              Duplicate
            </Menu.Item>
            <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => onExport(t)}>
              Export JSON
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => onDelete(t)}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Card>
  );
}
