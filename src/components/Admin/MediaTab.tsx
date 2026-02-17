import { useEffect, useMemo, useState, useRef, type CSSProperties, type KeyboardEventHandler } from 'react';
import { Button, Grid, Image, Text, Group, Loader, SegmentedControl, Table, Box, ActionIcon, Tooltip, Card, Badge } from '@mantine/core';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaCard } from './MediaCard';
import { MediaLightboxModal } from './MediaLightboxModal';
import { MediaAddModal } from './MediaAddModal';
import { MediaEditModal } from './MediaEditModal';
import { MediaDeleteModal } from './MediaDeleteModal';
import { showNotification } from '@mantine/notifications';
import { IconPlus, IconTrash, IconRefresh, IconLayoutGrid, IconList, IconGridDots, IconPhoto, IconGripVertical } from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem, OEmbedResponse, UploadResponse } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { useXhrUpload } from '@/hooks/useXhrUpload';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { sortByOrder } from '@/utils/sortByOrder';

type ViewMode = 'grid' | 'list' | 'compact';
type CardSize = 'small' | 'medium' | 'large';
type DropPosition = 'before' | 'after';

const LIST_MIN_WIDTH = 720;

type Props = { campaignId: string; apiClient: ApiClient; onCampaignsUpdated?: () => void };

export default function MediaTab({ campaignId, apiClient, onCampaignsUpdated }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { upload, isUploading: uploading, progress: uploadProgress, resetProgress } = useXhrUpload();
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalPreview, setExternalPreview] = useState<OEmbedResponse | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingCaption, setEditingCaption] = useState('');
  const [editingThumbnail, setEditingThumbnail] = useState<string | undefined>(undefined);
  const [deleteItem, setDeleteItem] = useState<MediaItem | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const reorderingRef = useRef(false);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [overMediaId, setOverMediaId] = useState<string | null>(null);

  // View options
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [cardSize, setCardSize] = useState<CardSize>('medium');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Get image items for lightbox navigation
  const imageItems = useMemo(() => media.filter((m) => m.type === 'image'), [media]);

  const openLightbox = (item: MediaItem) => {
    const idx = imageItems.findIndex((m) => m.id === item.id);
    if (idx !== -1) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setLightboxIndex((i) => (i > 0 ? i - 1 : imageItems.length - 1));
    } else {
      setLightboxIndex((i) => (i < imageItems.length - 1 ? i + 1 : 0));
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateLightbox('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateLightbox('next');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setLightboxOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, imageItems.length]);

  // Card size configurations
  const sizeConfig = useMemo(() => ({
    compact: { span: { base: 6, sm: 3, md: 2, lg: 2 }, height: 72 },
    small: { span: { base: 6, sm: 4, md: 3, lg: 3 }, height: 110 },
    medium: { span: { base: 12, sm: 6, md: 4 }, height: 170 },
    large: { span: { base: 12, sm: 6 }, height: 240 },
  }), []);

  useEffect(() => {
    void fetchMedia();
  }, [campaignId]);

  function getMediaTypeFromUrl(url: string): 'image' | 'video' {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
    const lowerUrl = url.toLowerCase();
    if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
      return 'image';
    }
    // Default to video for external links, as most oEmbed content is video
    return 'video';
  }

  async function fetchMedia() {
    if (!campaignId) {
      setMedia([]);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
        `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`,
      );
      const items = Array.isArray(response) ? response : response.items ?? [];
      const sorted = sortByOrder(items);
      setMedia(sorted);

      const needs = sorted.filter((it) => it.source === 'external' && (!it.thumbnail || !it.caption));
      if (needs.length > 0) {
        try {
          await Promise.all(
            needs.map(async (it) => {
              try {
                const data = await apiClient.get<OEmbedResponse>(`/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(it.url)}`);
                if (data) {
                  const nextThumb = it.thumbnail || data.thumbnail_url;
                  const nextCaption = it.caption || data.title || '';
                  setMedia((prev) =>
                    prev.map((p) => (p.id === it.id ? { ...p, thumbnail: nextThumb ?? p.thumbnail, caption: nextCaption } : p)),
                  );
                  if (nextThumb || nextCaption) {
                    await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/${it.id}`, {
                      thumbnail: nextThumb,
                      caption: nextCaption,
                    });
                  }
                }
              } catch (e) {
                console.warn('oEmbed fetch failed for', it.url, e);
              }
            }),
          );
        } catch (e) {
          console.warn('Error fetching oEmbed metadata', e);
        }
      }
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Error', message: 'Failed to load media', color: 'red' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;

    // Client-side validation
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg',
    ];
    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      showNotification({ title: 'Invalid file type', message: 'Accepted: JPEG, PNG, GIF, WebP, MP4, WebM, OGG.', color: 'red' });
      setSelectedFile(null);
      return;
    }
    if (selectedFile.size > MAX_SIZE) {
      showNotification({ title: 'File too large', message: `File is ${Math.round(selectedFile.size / 1024 / 1024)} MB. Maximum size is 50 MB.`, color: 'red' });
      setSelectedFile(null);
      return;
    }

    try {
      // Determine media type from file
      const mediaType = selectedFile.type.startsWith('image') ? 'image' : 'video';

      const uploadUrl = `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`;
      const authHeaders = await apiClient.getAuthHeaders();
      const res = await upload<UploadResponse>({
        url: uploadUrl,
        file: selectedFile,
        headers: authHeaders,
      });
      // Use user-provided caption or fall back to file name
      const finalCaption = uploadCaption.trim() || uploadTitle.trim() || selectedFile.name;
      const newMedia = await apiClient.post<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`, {
        type: mediaType,
        source: 'upload',
        provider: 'wordpress',
        attachmentId: res.attachmentId,
        url: res.url,
        thumbnail: res.thumbnail ?? res.url,
        caption: finalCaption,
        title: uploadTitle.trim() || undefined,
      });
      setMedia((m) => [...m, newMedia]);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadCaption('');
      setAddOpen(false);
      showNotification({ title: 'Uploaded', message: 'Media uploaded and added to campaign.' });
      onCampaignsUpdated?.();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Upload failed', message: getErrorMessage(err, 'Upload failed.'), color: 'red' });
      setSelectedFile(null);
    } finally {
      resetProgress();
    }
  }

  async function handleAddExternal() {
    if (!externalUrl) return;
    if (!isValidExternalUrl(externalUrl)) {
      showNotification({ title: 'Invalid URL', message: 'Please enter a valid https URL.', color: 'red' });
      return;
    }
    try {
      const inferredType = externalPreview?.type || getMediaTypeFromUrl(externalUrl);
      const payload: Record<string, unknown> = {
        type: inferredType,
        source: 'external',
        provider: externalPreview?.provider ?? externalPreview?.provider_name ?? 'external',
        url: externalUrl,
        caption: externalPreview?.title ?? '',
        thumbnail: externalPreview?.thumbnail_url ?? undefined,
      };
      const created = await apiClient.post<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`, payload);
      setMedia((m) => [...m, created]);
      setExternalUrl('');
      setExternalPreview(null);
      setAddOpen(false);
      showNotification({ title: 'Added', message: 'External media added.' });
      onCampaignsUpdated?.();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Add failed', message: (err as Error).message, color: 'red' });
    }
  }

  async function handleFetchOEmbed() {
    if (!externalUrl) return;
    if (!isValidExternalUrl(externalUrl)) {
      setExternalError('Please enter a valid https URL.');
      return;
    }
    try {
      setExternalLoading(true);
      setExternalError(null);
      // Rely on server-side proxy to avoid CORS/provider restrictions.
      // The server implements provider handlers and caching; if it cannot
      // fetch a preview it will return a non-200 or error payload.
      const data = await apiClient.get<OEmbedResponse>(`/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(externalUrl)}`);
      if (data) {
        setExternalPreview(data);
        showNotification({ title: 'Preview loaded', message: data.title ?? 'Preview available' });
      } else {
        throw new Error('No preview available');
      }
    } catch (err) {
      console.error(err);
      setExternalError((err as Error).message);
      showNotification({ title: 'Preview failed', message: (err as Error).message, color: 'red' });
    } finally {
      setExternalLoading(false);
    }
  }

  function isValidExternalUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: globalThis.DragEvent) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; };
    const onDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) setSelectedFile(f);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function handleDelete(item: MediaItem) {
    setDeleteItem(item);
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/${deleteItem.id}`);
      setMedia((m) => m.filter((x) => x.id !== deleteItem.id));
      showNotification({ title: 'Deleted', message: 'Media removed.' });
      onCampaignsUpdated?.();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Delete failed', message: (err as Error).message, color: 'red' });
    } finally {
      setDeleteItem(null);
    }
  }

  function openEdit(item: MediaItem) {
    setEditingItem(item);
    setEditingTitle(item.title ?? '');
    setEditingCaption(item.caption ?? '');
    setEditingThumbnail(item.thumbnail);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editingItem) return;
    try {
      const updated = await apiClient.put<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/${editingItem.id}`, { 
        title: editingTitle.trim() || undefined,
        caption: editingCaption, 
        thumbnail: editingThumbnail 
      });
      setMedia((m) => m.map((it) => (it.id === updated.id ? updated : it)));
      setEditOpen(false);
      showNotification({ title: 'Saved', message: 'Media updated.' });
    } catch (err) {
      showNotification({ title: 'Save failed', message: (err as Error).message, color: 'red' });
    }
  }

  async function handleRescanTypes() {
    setRescanning(true);
    try {
      const result = await apiClient.post<{ message: string; updated: number; total: number }>(
        `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/rescan`,
        {},
      );
      if (result.updated > 0) {
        showNotification({ title: 'Rescan Complete', message: `Updated ${result.updated} of ${result.total} media items.` });
        await fetchMedia();
      } else {
        showNotification({ title: 'Rescan Complete', message: 'All media types are correct.' });
      }
    } catch (err) {
      showNotification({ title: 'Rescan failed', message: (err as Error).message, color: 'red' });
    } finally {
      setRescanning(false);
    }
  }

  async function reorderMediaItems(nextMedia: MediaItem[]) {
    // Prevent concurrent reorder operations using stable ref-based guard
    if (reorderingRef.current) return;
    reorderingRef.current = true;

    const prev = media.slice();
    const itemsToSend = nextMedia.map((it, i) => ({ id: it.id, order: i + 1 }));

    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/reorder`, { items: itemsToSend });
      setMedia(nextMedia.map((it, i) => ({ ...it, order: i + 1 })));
      showNotification({ title: 'Reordered', message: 'Media order updated.' });
      onCampaignsUpdated?.();
    } catch (err) {
      // Roll back local state to previous order
      setMedia(prev);
      showNotification({ title: 'Reorder failed', message: (err as Error).message, color: 'red' });
    } finally {
      reorderingRef.current = false;
    }
  }

  const mediaIds = useMemo(() => media.map((item) => item.id), [media]);

  const getDropPosition = (activeId: string, overId: string): DropPosition => {
    const sourceIndex = media.findIndex((item) => item.id === activeId);
    const targetIndex = media.findIndex((item) => item.id === overId);
    return sourceIndex < targetIndex ? 'after' : 'before';
  };

  const getInsertionStyle = (itemId: string, axis: 'horizontal' | 'vertical'): CSSProperties | undefined => {
    if (!activeMediaId || !overMediaId || activeMediaId === overMediaId || itemId !== overMediaId) {
      return undefined;
    }

    const position = getDropPosition(activeMediaId, overMediaId);
    if (axis === 'horizontal') {
      return {
        boxShadow:
          position === 'before'
            ? 'inset 6px 0 0 0 var(--wpsg-color-primary)'
            : 'inset -6px 0 0 0 var(--wpsg-color-primary)',
      };
    }

    return {
      boxShadow:
        position === 'before'
          ? 'inset 0 6px 0 0 var(--wpsg-color-primary)'
          : 'inset 0 -6px 0 0 var(--wpsg-color-primary)',
    };
  };

  const handleDndStart = ({ active }: DragStartEvent) => {
    setActiveMediaId(String(active.id));
    setOverMediaId(String(active.id));
  };

  const handleDndOver = ({ over }: DragOverEvent) => {
    setOverMediaId(over ? String(over.id) : null);
  };

  const handleDndEnd = async ({ active, over }: DragEndEvent) => {
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;

    setActiveMediaId(null);
    setOverMediaId(null);

    if (!overId || activeId === overId) return;

    const sourceIndex = media.findIndex((item) => item.id === activeId);
    const targetIndex = media.findIndex((item) => item.id === overId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const nextMedia = arrayMove(media, sourceIndex, targetIndex);
    await reorderMediaItems(nextMedia);
  };

  const moveByKeyboard = async (itemId: string, direction: 'forward' | 'backward') => {
    const sourceIndex = media.findIndex((item) => item.id === itemId);
    if (sourceIndex === -1) return;

    const targetIndex = direction === 'forward' ? sourceIndex + 1 : sourceIndex - 1;
    if (targetIndex < 0 || targetIndex >= media.length) return;

    const nextMedia = arrayMove(media, sourceIndex, targetIndex);
    await reorderMediaItems(nextMedia);
  };

  const activeMediaItem = useMemo(
    () => (activeMediaId ? media.find((item) => item.id === activeMediaId) ?? null : null),
    [activeMediaId, media],
  );

  const SortableListRow = ({ item }: { item: MediaItem }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const onHandleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
      listeners?.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        void moveByKeyboard(item.id, 'forward');
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        void moveByKeyboard(item.id, 'backward');
      }
    };
    const rowStyle: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.7 : 1,
      ...getInsertionStyle(item.id, 'vertical'),
    };
    const mediaTypeLabel = item.type === 'video' ? 'Video' : 'Image';
    const sourceLabel = item.source === 'external' ? 'External' : 'Upload';
    const mediaTypeColor = item.type === 'video' ? 'violet' : 'blue';
    const sourceColor = item.source === 'external' ? 'grape' : 'teal';

    return (
      <Table.Tr ref={setNodeRef} data-testid={`media-draggable-${item.id}`} style={rowStyle}>
        <Table.Td>
          <Image
            src={item.thumbnail ?? item.url}
            alt={item.caption || 'Media thumbnail'}
            w={50}
            h={50}
            fit="cover"
            radius="sm"
            loading="lazy"
            style={{ cursor: item.type === 'image' ? 'pointer' : 'default' }}
            onClick={() => item.type === 'image' && openLightbox(item)}
            role={item.type === 'image' ? 'button' : undefined}
            tabIndex={item.type === 'image' ? 0 : -1}
            aria-label={
              item.type === 'image'
                ? `Open image preview for ${item.caption || item.url}`
                : undefined
            }
            onKeyDown={(event) => {
              if (item.type !== 'image') return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openLightbox(item);
              }
            }}
            fallbackSrc={FALLBACK_IMAGE_SRC}
          />
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="gray.1" lineClamp={1}>{item.caption || '—'}</Text>
          <Group gap={4} mt={4}>
            <Badge size="xs" variant="filled" color={mediaTypeColor}>{mediaTypeLabel}</Badge>
            <Badge size="xs" variant="light" color={sourceColor}>{sourceLabel}</Badge>
          </Group>
          <Text size="xs" c="gray.4" lineClamp={1}>{item.url}</Text>
        </Table.Td>
        <Table.Td><Text size="sm">{item.type}</Text></Table.Td>
        <Table.Td><Text size="sm">{item.source}</Text></Table.Td>
        <Table.Td>
          <Group gap={4}>
            <ActionIcon
              variant="subtle"
              aria-label="Drag media to reorder"
              style={{ cursor: 'grab' }}
              {...attributes}
              {...listeners}
              onKeyDown={onHandleKeyDown}
            >
              <IconGripVertical size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" onClick={() => openEdit(item)} aria-label="Edit"><IconPhoto size={16} /></ActionIcon>
            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item)} aria-label="Delete media"><IconTrash size={16} /></ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  };

  const SortableGridItem = ({ item }: { item: MediaItem }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const onHandleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
      listeners?.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        void moveByKeyboard(item.id, 'forward');
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        void moveByKeyboard(item.id, 'backward');
      }
    };
    const mediaHeight = viewMode === 'compact'
      ? sizeConfig.compact.height
      : sizeConfig[cardSize].height;
    const isCompact = viewMode === 'compact' || cardSize === 'small';

    return (
      <Grid.Col
        ref={setNodeRef}
        data-testid={`media-draggable-${item.id}`}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 }}
        span={viewMode === 'compact' ? sizeConfig.compact.span : sizeConfig[cardSize].span}
      >
        <MediaCard
          item={item}
          height={mediaHeight}
          compact={isCompact}
          showUrl={cardSize === 'large'}
          onEdit={() => openEdit(item)}
          onDelete={() => handleDelete(item)}
          onImageClick={item.type === 'image' ? () => openLightbox(item) : undefined}
          cardStyle={getInsertionStyle(item.id, 'horizontal')}
          dragHandleProps={{ ...attributes, ...listeners, onKeyDown: onHandleKeyDown }}
        />
      </Grid.Col>
    );
  };

  return (
    <div>
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <Group gap="md" wrap="wrap">
          <Text fw={700} c="white">Media</Text>
          <Text size="sm" c="dimmed">({media.length} items)</Text>
        </Group>
        <Group gap="sm" wrap="wrap" style={{ flex: '1 1 auto', justifyContent: 'flex-end' }}>
          {/* View Mode Toggle */}
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            aria-label="Media view mode"
            data={[
              { value: 'grid', label: <Tooltip label="Grid View"><Box><IconLayoutGrid size={16} /></Box></Tooltip> },
              { value: 'compact', label: <Tooltip label="Compact Grid"><Box><IconGridDots size={16} /></Box></Tooltip> },
              { value: 'list', label: <Tooltip label="List View"><Box><IconList size={16} /></Box></Tooltip> },
            ]}
          />
          {/* Card Size (only for grid modes) */}
          {viewMode !== 'list' && (
            <SegmentedControl
              size="xs"
              value={cardSize}
              onChange={(v) => setCardSize(v as CardSize)}
              aria-label="Media card size"
              data={[
                { value: 'small', label: 'S' },
                { value: 'medium', label: 'M' },
                { value: 'large', label: 'L' },
              ]}
            />
          )}
          <Button
            variant="subtle"
            leftSection={<IconRefresh size={18} />}
            onClick={handleRescanTypes}
            loading={rescanning}
            disabled={media.length === 0}
            style={{ flex: '0 0 auto' }}
          >
            Rescan Types
          </Button>
          <Button leftSection={<IconPlus />} onClick={() => setAddOpen(true)} style={{ flex: '0 0 auto' }}>
            Add Media
          </Button>
        </Group>
      </Group>

      {loading ? (
        <Loader />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDndStart}
          onDragOver={handleDndOver}
          onDragEnd={(event) => void handleDndEnd(event)}
        >
          {viewMode === 'list' ? (
            <>
              <Table.ScrollContainer minWidth={LIST_MIN_WIDTH}>
                <Table verticalSpacing="xs" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={60}>Thumb</Table.Th>
                      <Table.Th>Caption</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Source</Table.Th>
                      <Table.Th w={180}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                </Table>
              </Table.ScrollContainer>

              <Table.ScrollContainer minWidth={LIST_MIN_WIDTH}>
                <SortableContext items={mediaIds} strategy={verticalListSortingStrategy}>
                  <Table verticalSpacing="xs" highlightOnHover>
                    <Table.Tbody>
                      {media.map((item) => (
                        <SortableListRow key={item.id} item={item} />
                      ))}
                    </Table.Tbody>
                  </Table>
                </SortableContext>
              </Table.ScrollContainer>
            </>
          ) : (
            <SortableContext items={mediaIds} strategy={rectSortingStrategy}>
              <Grid>
                {media.map((item) => (
                  <SortableGridItem key={item.id} item={item} />
                ))}
              </Grid>
            </SortableContext>
          )}

          <DragOverlay>
            {activeMediaItem ? (
              <Card withBorder shadow="sm" radius="md" p="xs" style={{ minWidth: 160, opacity: 0.95 }}>
                <Text size="sm" c="gray.1" lineClamp={1}>{activeMediaItem.caption || 'Dragging media'}</Text>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <MediaLightboxModal
        opened={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageItems={imageItems}
        lightboxIndex={lightboxIndex}
        onPrev={() => navigateLightbox('prev')}
        onNext={() => navigateLightbox('next')}
      />

      <MediaAddModal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        dropRef={dropRef}
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
        previewUrl={previewUrl}
        uploadTitle={uploadTitle}
        onUploadTitleChange={setUploadTitle}
        uploadCaption={uploadCaption}
        onUploadCaptionChange={setUploadCaption}
        uploadProgress={uploadProgress}
        uploading={uploading}
        onUpload={handleUpload}
        externalUrl={externalUrl}
        onExternalUrlChange={setExternalUrl}
        externalError={externalError}
        onFetchOEmbed={handleFetchOEmbed}
        externalLoading={externalLoading}
        onAddExternal={handleAddExternal}
        externalPreview={externalPreview}
      />

      <MediaEditModal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        editingTitle={editingTitle}
        onEditingTitleChange={setEditingTitle}
        editingCaption={editingCaption}
        onEditingCaptionChange={setEditingCaption}
        editingThumbnail={editingThumbnail}
        onEditingThumbnailChange={setEditingThumbnail}
        onSave={saveEdit}
      />

      <MediaDeleteModal
        opened={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        deleteItem={deleteItem}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
