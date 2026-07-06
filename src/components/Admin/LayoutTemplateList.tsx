/**
 * P15-F.1 + P15-F.4: Layout Template List & Management
 *
 * Admin panel tab that displays all saved layout templates with
 * grid/list toggle, search/filter, and action buttons (edit, duplicate,
 * delete). Includes import/export JSON functionality.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useQueryClient } from '@tanstack/react-query';
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
import type { ApiClient } from '@/services/apiClient';
import type { LayoutTemplate } from '@/types';
const LayoutBuilderModal = lazy(() =>
  import('./LayoutBuilder/LayoutBuilderModal').then((m) => ({ default: m.LayoutBuilderModal }))
);
const PresetGalleryModal = lazy(() =>
  import('./LayoutBuilder/PresetGalleryModal').then((m) => ({ default: m.PresetGalleryModal }))
);
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { ApiError } from '@/services/apiClient';
import { createEmptyTemplate } from '@/hooks/useLayoutBuilderState';
import type { LayoutPreset } from '@/data/layoutPresets';
import {
  getLayoutTemplatesQueryKey,
  useLayoutTemplates,
} from '@/services/layoutTemplateQuery';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { useBuilderDeepLink } from '@wp-super-gallery/shared-utils';
import { useWpsgLicense } from '@/hooks/useWpsgLicense';
import { showProUpsell } from '@/utils/wpsgUpsell';

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
  initialTemplateId?: string | undefined;
  /** P50-K: active admin space scope ('all' or a space id); scopes the builder's asset library. */
  spaceId?: string | undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

export function LayoutTemplateList({ apiClient, onNotify, initialTemplateId, spaceId }: LayoutTemplateListProps) {
  const { t: tr } = useTranslation('wpsg');
  const { isPro, upgradeUrl } = useWpsgLicense();
  const queryClient = useQueryClient();
  // ── State ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const nullRef = useRef<HTMLElement>(null);
  const { breakpoint } = useBreakpoint(nullRef, { source: 'viewport' });
  const isMobile = breakpoint === 'mobile';
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<LayoutTemplate | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LayoutTemplate | null>(null);
  // P53-A: when a delete hits the P52-A5c in-use guard (409), surface a second
  // confirm that can force past it instead of just erroring.
  const [forceDelete, setForceDelete] = useState<{ template: LayoutTemplate; inUse: number } | null>(null);
  const [forceDeleting, setForceDeleting] = useState(false);
  const [presetGalleryOpen, setPresetGalleryOpen] = useState(false);
  const resetRef = useRef<() => void>(null);

  // ── P30-D: URL deep-link state ────────────────────────────────────────────
  const { pushBuilderUrl, clearBuilderUrl } = useBuilderDeepLink();

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: templates, isLoading, refetch: refetchTemplates } = useLayoutTemplates(apiClient);

  // ── Open builder for initialTemplateId once data is available ─────────────
  const handledInitialRef = useRef(false);
  useEffect(() => {
    if (!initialTemplateId || !templates || handledInitialRef.current) return;
    const target = templates.find((t) => t.id === initialTemplateId);
    if (target) {
      handledInitialRef.current = true;
      setEditingTemplate(target);
      setBuilderOpen(true);
      // Don't push URL here — the URL already contains the param (we got here via deep-link)
    }
  }, [initialTemplateId, templates]);

  // ── P30-D: Close builder when browser Back removes the ?builder= param ────
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('builder') && builderOpen) {
        // Back button removed the builder param — close without pushing history again
        setBuilderOpen(false);
        setEditingTemplate(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [builderOpen]);

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
    // New templates have no ID yet — no URL push until first save
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
    // New templates from presets have no ID yet — URL pushed on first save
  }, []);

  const handleEdit = useCallback((t: LayoutTemplate) => {
    setEditingTemplate(t);
    setBuilderOpen(true);
    // Push shareable builder URL (P30-D)
    pushBuilderUrl(t.id);
  }, [pushBuilderUrl]);

  const handleBuilderSaved = useCallback(
    (saved: LayoutTemplate) => {
      queryClient.setQueryData<LayoutTemplate[]>(
        getLayoutTemplatesQueryKey(apiClient),
        (current) => {
          if (!current) return [saved];
          const index = current.findIndex((template) => template.id === saved.id);
          if (index >= 0) {
            const next = [...current];
            next[index] = saved;
            return next;
          }
          return [...current, saved];
        },
      );
      // P30-D: If this was a new template that just received its first ID, push the URL now
      pushBuilderUrl(saved.id);
    },
    [apiClient, queryClient, pushBuilderUrl],
  );

  const handleBuilderClose = useCallback(() => {
    setBuilderOpen(false);
    setEditingTemplate(null);
    // P30-D: Remove builder URL param on close
    clearBuilderUrl();
  }, [clearBuilderUrl]);

  const handleDuplicate = useCallback(
    async (t: LayoutTemplate) => {
      try {
        await apiClient.duplicateLayoutTemplate(t.id, `${t.name} (copy)`);
        onNotify({ type: 'success', text: tr('admin_lt_duplicated', 'Duplicated "{{name}}"', { name: t.name }) });
        await refetchTemplates();
      } catch (err) {
        onNotify({ type: 'error', text: (err as Error).message });
      }
    },
    [apiClient, onNotify, refetchTemplates, tr],
  );

  const handleDelete = useCallback(
    async () => {
      if (!confirmDelete) return;
      const target = confirmDelete;
      try {
        await apiClient.deleteLayoutTemplate(target.id);
        onNotify({ type: 'success', text: tr('admin_lt_deleted', 'Deleted "{{name}}"', { name: target.name }) });
        setConfirmDelete(null);
        await refetchTemplates();
      } catch (err) {
        // P52-A5c in-use guard → escalate to a force-confirm instead of erroring.
        if (err instanceof ApiError && err.status === 409) {
          const inUse = Number((err.data as { data?: { inUse?: number } } | undefined)?.data?.inUse ?? 0);
          setConfirmDelete(null);
          setForceDelete({ template: target, inUse });
          return;
        }
        onNotify({ type: 'error', text: (err as Error).message });
      }
    },
    [apiClient, confirmDelete, onNotify, refetchTemplates, tr],
  );

  const handleForceDelete = useCallback(
    async () => {
      if (!forceDelete) return;
      setForceDeleting(true);
      try {
        await apiClient.deleteLayoutTemplate(forceDelete.template.id, true);
        onNotify({ type: 'success', text: tr('admin_lt_deleted', 'Deleted "{{name}}"', { name: forceDelete.template.name }) });
        setForceDelete(null);
        await refetchTemplates();
      } catch (err) {
        onNotify({ type: 'error', text: (err as Error).message });
      } finally {
        setForceDeleting(false);
      }
    },
    [apiClient, forceDelete, onNotify, refetchTemplates, tr],
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
          onNotify({ type: 'error', text: tr('admin_lt_invalid_json', 'Invalid template JSON — missing required fields.') });
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
        onNotify({ type: 'success', text: tr('admin_lt_imported', 'Imported "{{name}}"', { name: rest.name }) });
        await refetchTemplates();
        resetRef.current?.();
      } catch (err) {
        onNotify({ type: 'error', text: tr('admin_lt_import_fail', 'Import failed: {{message}}', { message: (err as Error).message }) });
      }
    },
    [apiClient, onNotify, refetchTemplates, tr],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Stack gap="md">
      {/* Toolbar */}
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm">
          <TextInput
            placeholder={tr('admin_lt_search_ph', 'Search layouts…')}
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ minWidth: 200, flex: '1 1 200px' }}
            aria-label={tr('admin_lt_search_aria', 'Search layout templates')}
          />
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'grid' | 'list')}
            data={[
              { value: 'grid', label: <IconGridDots size={16} /> },
              { value: 'list', label: <IconList size={16} /> },
            ]}
            aria-label={tr('admin_lt_view_mode', 'View mode')}
          />
        </Group>
        <Group gap="sm">
          <FileButton onChange={handleImport} accept="application/json" resetRef={resetRef}>
            {(props) => (
              <Button variant="outline" leftSection={<IconUpload size={16} />} size="sm" {...props}>
                {tr('admin_lt_import', 'Import')}
              </Button>
            )}
          </FileButton>
          <Button leftSection={<IconPlus size={16} />} size="sm" onClick={handleCreate}>
            {tr('admin_lt_new', 'New Layout')}
          </Button>
          <Button
            variant="light"
            leftSection={<IconLayoutDashboard size={16} />}
            size="sm"
            onClick={() => {
              // P62-A: the starter template library is a Pro feature. Button
              // stays visible (a locked CTA converts better than a hidden one);
              // gate the open action.
              if (!isPro) {
                showProUpsell(
                  'upsell_starter_library',
                  'The starter template library is a Pro feature. Upgrade to start from a curated preset.',
                  upgradeUrl,
                );
                return;
              }
              setPresetGalleryOpen(true);
            }}
          >
            {tr('admin_lt_from_preset', 'From Preset')}
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
              {searchQuery ? tr('admin_lt_no_match', 'No layouts match your search.') : tr('admin_lt_none', 'No layout templates yet.')}
            </Text>
            {!searchQuery && (
              <Button variant="light" size="sm" onClick={handleCreate}>
                {tr('admin_lt_create_first', 'Create your first layout')}
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
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
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
          <Table verticalSpacing="sm" highlightOnHover aria-label={tr('admin_lt_list_aria', 'Layout template list')}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tr('admin_lt_th_name', 'Name')}</Table.Th>
                <Table.Th>{tr('admin_lt_th_slots', 'Slots')}</Table.Th>
                <Table.Th>{tr('admin_lt_th_aspect', 'Aspect')}</Table.Th>
                <Table.Th>{tr('admin_lt_th_updated', 'Updated')}</Table.Th>
                <Table.Th>{tr('admin_lt_th_tags', 'Tags')}</Table.Th>
                <Table.Th>{tr('admin_lt_th_actions', 'Actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{t.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light">{tr('admin_lt_n_slots', '{{count}} slot', { count: t.slots.length })}</Badge>
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
                      <Tooltip label={tr('admin_lt_edit', 'Edit')}>
                        <ActionIcon variant="subtle" size="sm" onClick={() => handleEdit(t)} aria-label={tr('admin_lt_edit_name', 'Edit {{name}}', { name: t.name })}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={tr('admin_lt_duplicate', 'Duplicate')}>
                        <ActionIcon variant="subtle" size="sm" onClick={() => handleDuplicate(t)} aria-label={tr('admin_lt_duplicate_name', 'Duplicate {{name}}', { name: t.name })}>
                          <IconCopy size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={tr('admin_lt_export_json', 'Export JSON')}>
                        <ActionIcon variant="subtle" size="sm" onClick={() => handleExport(t)} aria-label={tr('admin_lt_export_name', 'Export {{name}}', { name: t.name })}>
                          <IconDownload size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={tr('admin_lt_delete', 'Delete')}>
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setConfirmDelete(t)} aria-label={tr('admin_lt_delete_name', 'Delete {{name}}', { name: t.name })}>
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
      <Suspense fallback={null}>
        {builderOpen && (
          <LayoutBuilderModal
            key={editingTemplate?.id ?? 'new'}
            opened={builderOpen}
            initialTemplate={editingTemplate ?? undefined}
            apiClient={apiClient}
            onSaved={handleBuilderSaved}
            onClose={handleBuilderClose}
            onNotify={onNotify}
            spaceId={spaceId}
          />
        )}
      </Suspense>

      {/* Delete confirmation */}
      <ConfirmModal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={tr('admin_lt_delete_title', 'Delete layout template?')}
        message={tr('admin_lt_delete_msg', 'Are you sure you want to delete "{{name}}"? This cannot be undone.', { name: confirmDelete?.name ?? '' })}
        confirmLabel={tr('admin_lt_delete', 'Delete')}
        confirmColor="red"
      />

      {/* P53-A: in-use (409) escalation — confirm a forced delete. */}
      <ConfirmModal
        opened={!!forceDelete}
        onClose={() => setForceDelete(null)}
        onConfirm={handleForceDelete}
        title={tr('admin_lt_inuse_title', 'Template in use')}
        message={tr('admin_lt_inuse_msg', '"{{name}}" is in use by {{count}} campaign. Deleting it will unbind those campaigns. Delete anyway?', { name: forceDelete?.template.name ?? '', count: forceDelete?.inUse ?? 0 })}
        confirmLabel={tr('admin_lt_delete_anyway', 'Delete anyway')}
        confirmColor="red"
        loading={forceDeleting}
      />

      {/* Preset gallery (P15-J.2) */}
      <Suspense fallback={null}>
        {presetGalleryOpen && (
          <PresetGalleryModal
            opened={presetGalleryOpen}
            onClose={() => setPresetGalleryOpen(false)}
            onSelect={handleCreateFromPreset}
          />
        )}
      </Suspense>
    </Stack>
  );
}

setWpsgDebugDisplayName(LayoutTemplateList, 'AdminPanel:LayoutTemplateList');

// ── Grid Card ────────────────────────────────────────────────────────────────

interface TemplateGridCardProps {
  template: LayoutTemplate;
  onEdit: (t: LayoutTemplate) => void;
  onDuplicate: (t: LayoutTemplate) => void;
  onDelete: (t: LayoutTemplate) => void;
  onExport: (t: LayoutTemplate) => void;
}

function TemplateGridCard({ template, onEdit, onDuplicate, onDelete, onExport }: TemplateGridCardProps) {
  const { t: tr } = useTranslation('wpsg');
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
      aria-label={tr('admin_lt_edit_layout', 'Edit layout {{name}}', { name: t.name })}
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
            {tr('admin_lt_n_slots', '{{count}} slot', { count: t.slots.length })} · {shortDate(t.updatedAt)}
          </Text>
        </Box>

        {/* Action menu */}
        <Menu position="bottom-end" withArrow>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={(e) => e.stopPropagation()}
              aria-label={tr('admin_lt_actions_for', 'Actions for {{name}}', { name: t.name })}
            >
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEdit(t)}>
              {tr('admin_lt_edit', 'Edit')}
            </Menu.Item>
            <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => onDuplicate(t)}>
              {tr('admin_lt_duplicate', 'Duplicate')}
            </Menu.Item>
            <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => onExport(t)}>
              {tr('admin_lt_export_json', 'Export JSON')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => onDelete(t)}>
              {tr('admin_lt_delete', 'Delete')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Card>
  );
}

setWpsgDebugDisplayName(TemplateGridCard, 'AdminPanel:TemplateGridCard');