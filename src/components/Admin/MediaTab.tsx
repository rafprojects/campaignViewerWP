import { useCallback, useEffect, useMemo, useState, useRef, type CSSProperties, type KeyboardEventHandler } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import { Button, Grid, Image, Text, Group, SegmentedControl, Table, Box, ActionIcon, Tooltip, Card, Badge, Pagination, Skeleton, Switch, type GridColProps } from '@mantine/core';
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
import { MediaUsageBadge } from './MediaUsageBadge';
import { showNotification } from '@mantine/notifications';
import { IconPlus, IconTrash, IconRefresh, IconLayoutGrid, IconList, IconGridDots, IconPhoto, IconGripVertical } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@/services/apiClient';
import { useMediaItems, getMediaItemsQueryKey } from '@/services/adminQuery';
import { useGetSettings } from '@/services/settingsQuery';
import type {
  BatchUploadResponse,
  CampaignMediaBatchRequestItem,
  MediaItem,
  OEmbedResponse,
} from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { useXhrUpload } from '@/hooks/useXhrUpload';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

type ViewMode = 'grid' | 'list' | 'compact';
type CardSize = 'small' | 'medium' | 'large';
type DropPosition = 'before' | 'after';

const LIST_MIN_WIDTH = 720;
const LIST_PAGE_SIZE = 50;

function normalizeSelectedFiles(value: File | File[] | null): File[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getNextMediaOrder(items: MediaItem[]): number {
  return items.reduce((maxOrder, item) => Math.max(maxOrder, item.order ?? 0), 0) + 1;
}

type SharedSortableProps = {
  item: MediaItem;
  getInsertionStyle: (itemId: string, axis: 'horizontal' | 'vertical') => CSSProperties | undefined;
  moveByKeyboard: (itemId: string, direction: 'forward' | 'backward') => Promise<void>;
  openLightbox: (item: MediaItem) => void;
  openEdit: (item: MediaItem) => void;
  handleDelete: (item: MediaItem) => void;
  usageSummaryLoading: boolean;
  usageSummary: Record<string, number>;
  apiClient: ApiClient;
};

function SortableListRow({
  item, getInsertionStyle, moveByKeyboard, openLightbox, openEdit, handleDelete,
  usageSummaryLoading, usageSummary, apiClient,
}: SharedSortableProps) {
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
        <Text size="sm" lineClamp={1}>{item.caption || '—'}</Text>
        <Group gap={4} mt={4}>
          <Badge size="xs" variant="filled" color={mediaTypeColor}>{mediaTypeLabel}</Badge>
          <Badge size="xs" variant="light" color={sourceColor}>{sourceLabel}</Badge>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={1}>{item.url}</Text>
      </Table.Td>
      <Table.Td><Text size="sm">{item.type}</Text></Table.Td>
      <Table.Td><Text size="sm">{item.source}</Text></Table.Td>
      <Table.Td>
        {usageSummaryLoading
          ? <Skeleton width={64} height={20} radius="xl" />
          : <MediaUsageBadge count={usageSummary[item.id] ?? 1} mediaId={item.id} apiClient={apiClient} />}
      </Table.Td>
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
}

type SortableGridItemProps = SharedSortableProps & {
  viewMode: ViewMode;
  cardSize: CardSize;
  mediaHeight: number;
  gridSpan: GridColProps['span'];
  showUrl: boolean;
};

function SortableGridItem({
  item, getInsertionStyle, moveByKeyboard, openLightbox, openEdit, handleDelete,
  usageSummaryLoading, usageSummary, apiClient,
  viewMode, cardSize, mediaHeight, gridSpan, showUrl,
}: SortableGridItemProps) {
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
  const isCompact = viewMode === 'compact' || cardSize === 'small';

  return (
    <Grid.Col
      ref={setNodeRef}
      data-testid={`media-draggable-${item.id}`}
      style={{ transform: CSS.Transform.toString(transform) ?? undefined, transition: transition ?? undefined, opacity: isDragging ? 0.7 : 1 } as CSSProperties}
      span={gridSpan!}
    >
      <Box style={{ position: 'relative' }}>
        <MediaCard
          item={item}
          height={mediaHeight}
          compact={isCompact}
          showUrl={showUrl}
          onEdit={() => openEdit(item)}
          onDelete={() => handleDelete(item)}
          onImageClick={item.type === 'image' ? () => openLightbox(item) : undefined}
          cardStyle={getInsertionStyle(item.id, 'horizontal')}
          dragHandleProps={{ ...attributes, ...listeners, onKeyDown: onHandleKeyDown }}
        />
        <Box style={{ position: 'absolute', bottom: 8, left: 8 }}>
          {usageSummaryLoading
            ? <Skeleton width={64} height={20} radius="xl" />
            : <MediaUsageBadge count={usageSummary[item.id] ?? 1} mediaId={item.id} apiClient={apiClient} />}
        </Box>
      </Box>
    </Grid.Col>
  );
}

type Props = { campaignId: string; apiClient: ApiClient; onCampaignsUpdated?: () => void };

export default function MediaTab({ campaignId, apiClient, onCampaignsUpdated }: Props) {
  // P13-C: Query-cached media fetch — instant render on campaign revisit.
  // Local state holds the working copy for optimistic mutations (upload, delete,
  // reorder, oEmbed enrichment). Query data seeds it on mount / campaign change.
  const queryClient = useQueryClient();
  const { mediaItems, mediaLoading: mediaQueryLoading, mutateMedia } = useMediaItems(apiClient, campaignId);
  const { data: settingsResponse } = useGetSettings(apiClient);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Array<string | null>>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { uploadMany, batchProgress, isUploading: uploading, resetProgress } = useXhrUpload();
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

  // View options — persisted per-campaign so tab switches / refreshes preserve user preference
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>({
    key: `wpsg_media_viewMode_${campaignId}`,
    defaultValue: 'grid',
    getInitialValueInEffect: false,
  });
  const [cardSize, setCardSize] = useLocalStorage<CardSize>({
    key: `wpsg_media_cardSize_${campaignId}`,
    defaultValue: 'medium',
    getInitialValueInEffect: false,
  });
  const [listPage, setListPage] = useLocalStorage<number>({
    key: `wpsg_media_listPage_${campaignId}`,
    defaultValue: 1,
    getInitialValueInEffect: false,
  });

  // P18-G: Media usage tracking
  const [usageSummary, setUsageSummary] = useState<Record<string, number>>({});
  const [usageSummaryLoading, setUsageSummaryLoading] = useState(false);
  const [orphanFilter, setOrphanFilter] = useLocalStorage<boolean>({
    key: `wpsg_media_orphanFilter_${campaignId}`,
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const maxBatchUploadSize = settingsResponse?.maxBatchUploadSize ?? 20;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Scroll position preservation across tab switches (sessionStorage, per-campaign)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollKey = `wpsg_media_scrollTop_${campaignId}`;

  const hasMedia = media.length > 0;

  // Restore scroll on mount (after data ready)
  useEffect(() => {
    if (!campaignId) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved && scrollContainerRef.current) {
      const top = parseInt(saved, 10);
      // Defer to ensure DOM + lazy content is painted
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = top;
      });
    }
  }, [campaignId, hasMedia, scrollKey]);

  // Save scroll on unmount / campaign change
  useEffect(() => {
    const key = scrollKey;
    const el = scrollContainerRef.current;
    return () => {
      if (el) {
        sessionStorage.setItem(key, String(el.scrollTop));
      }
    };
  }, [scrollKey]);

  // Get image items for lightbox navigation
  const imageItems = useMemo(() => media.filter((m) => m.type === 'image'), [media]);

  const openLightbox = (item: MediaItem) => {
    const idx = imageItems.findIndex((m) => m.id === item.id);
    if (idx !== -1) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  };

  const navigateLightbox = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setLightboxIndex((i) => (i > 0 ? i - 1 : imageItems.length - 1));
    } else {
      setLightboxIndex((i) => (i < imageItems.length - 1 ? i + 1 : 0));
    }
  }, [imageItems.length]);

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
  }, [lightboxOpen, navigateLightbox]);

  // Card size configurations
  const sizeConfig = useMemo(() => ({
    compact: { span: { base: 6, sm: 3, md: 2, lg: 2 }, height: 72 },
    small: { span: { base: 6, sm: 4, md: 3, lg: 3 }, height: 110 },
    medium: { span: { base: 12, sm: 6, md: 4 }, height: 170 },
    large: { span: { base: 12, sm: 6 }, height: 240 },
  }), []);

  // Show skeleton only on first load when no cached query data exists yet.
  const effectiveLoading = mediaQueryLoading && media.length === 0;

  function getMediaTypeFromUrl(url: string): 'image' | 'video' {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
    const lowerUrl = url.toLowerCase();
    if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
      return 'image';
    }
    // Default to video for external links, as most oEmbed content is video
    return 'video';
  }

  /** Enrich external media items that are missing thumbnail / caption via oEmbed. */
  const enrichOEmbedMetadata = useCallback(async (items: MediaItem[]) => {
    const needs = items.filter((it) => it.source === 'external' && (!it.thumbnail || !it.caption));
    if (needs.length === 0) return;

    try {
      await Promise.all(
        needs.map(async (it) => {
          try {
            const data = await apiClient.get<OEmbedResponse>(
              `/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(it.url)}`,
            );
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
  }, [apiClient, campaignId]);

  // Sync local media state from the query cache. This fires on initial load,
  // campaign switch, and background revalidation. OEmbed enrichment runs
  // once after the first sync for the current campaign.
  const enrichedRef = useRef<string>(''); // tracks campaignId already enriched
  useEffect(() => {
    if (mediaItems.length > 0 || !mediaQueryLoading) {
      setMedia(mediaItems);
      // Run oEmbed enrichment once per campaign after initial data arrives
      if (campaignId && mediaItems.length > 0 && enrichedRef.current !== campaignId) {
        enrichedRef.current = campaignId;
        void enrichOEmbedMetadata(mediaItems);
      }
    }
  }, [mediaItems, mediaQueryLoading, campaignId, enrichOEmbedMetadata]);

  const handleSelectFiles = useCallback((value: File | File[] | null) => {
    const nextFiles = normalizeSelectedFiles(value);
    const mediaFiles = nextFiles.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    const skippedCount = nextFiles.length - mediaFiles.length;

    if (skippedCount > 0) {
      showNotification({
        title: 'Some files were skipped',
        message: `${skippedCount} non-media file${skippedCount === 1 ? '' : 's'} ${skippedCount === 1 ? 'was' : 'were'} ignored.`,
        color: 'yellow',
      });
    }

    if (mediaFiles.length > maxBatchUploadSize) {
      showNotification({
        title: 'Batch limit reached',
        message: `Only the first ${maxBatchUploadSize} files were kept.`,
        color: 'yellow',
      });
    }

    const limitedFiles = mediaFiles.slice(0, maxBatchUploadSize);
    setSelectedFiles(limitedFiles);
    setUploadErrors(Array(limitedFiles.length).fill(null));
    if (limitedFiles.length !== 1) {
      setUploadTitle('');
      setUploadCaption('');
    }
  }, [maxBatchUploadSize]);

  async function handleUpload() {
    if (selectedFiles.length === 0) return;

    try {
      setUploadErrors(Array(selectedFiles.length).fill(null));

      const authHeaders = await apiClient.getAuthHeaders();
      const uploadResponse = await uploadMany<BatchUploadResponse>({
        url: `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`,
        files: selectedFiles,
        headers: authHeaders,
      });

      const nextOrder = getNextMediaOrder(media);
      const successfulUploadEntries = uploadResponse.results
        .map((result, index) => ({ result, file: selectedFiles[index] }))
        .filter(({ result, file }) => Boolean(file) && result.success && result.attachmentId && result.url);

      const batchItems: CampaignMediaBatchRequestItem[] = successfulUploadEntries.map(({ result, file }, index) => ({
        type: file!.type.startsWith('image') ? 'image' : 'video',
        source: 'upload',
        provider: 'wordpress',
        attachmentId: result.attachmentId!,
        url: result.url!,
        thumbnail: result.thumbnail ?? result.url,
        caption: selectedFiles.length === 1
          ? uploadCaption.trim() || uploadTitle.trim() || file!.name
          : file!.name,
        title: selectedFiles.length === 1 ? uploadTitle.trim() || undefined : undefined,
        order: nextOrder + index,
      }));

      let addedMedia: MediaItem[] = [];
      let batchAddFailures = 0;

      if (batchItems.length > 0) {
        const batchAddResponse = await apiClient.addCampaignMediaBatch(campaignId, batchItems);
        addedMedia = batchAddResponse.added;
        batchAddFailures = batchAddResponse.failed.length;

        if (addedMedia.length > 0) {
          setMedia((current) => [...current, ...addedMedia]);
          queryClient.setQueryData<MediaItem[]>(
            getMediaItemsQueryKey(apiClient, campaignId),
            (prev) => [...(prev ?? []), ...addedMedia],
          );
          onCampaignsUpdated?.();
        }
      }

      const failedUploadEntries = uploadResponse.results
        .map((result, index) => ({
          file: selectedFiles[index],
          error: result.success ? null : (result.error ?? 'Upload failed.'),
        }))
        .filter((entry): entry is { file: File; error: string } => Boolean(entry.file) && Boolean(entry.error));

      const uploadedCount = addedMedia.length;
      const totalCount = selectedFiles.length;
      const hasFailures = failedUploadEntries.length > 0 || batchAddFailures > 0;

      if (failedUploadEntries.length > 0) {
        setSelectedFiles(failedUploadEntries.map((entry) => entry.file));
        setUploadErrors(failedUploadEntries.map((entry) => entry.error));
      } else {
        setSelectedFiles([]);
        setUploadErrors([]);
        setUploadTitle('');
        setUploadCaption('');
        setAddOpen(false);
      }

      showNotification({
        title: hasFailures ? 'Upload complete with issues' : 'Upload complete',
        message: `${uploadedCount} of ${totalCount} file${totalCount === 1 ? '' : 's'} uploaded successfully.${batchAddFailures > 0 ? ` ${batchAddFailures} file${batchAddFailures === 1 ? '' : 's'} could not be added to the campaign.` : ''}`,
        color: hasFailures ? 'yellow' : 'blue',
      });
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Upload failed', message: getErrorMessage(err, 'Upload failed.'), color: 'red' });
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
      queryClient.setQueryData<MediaItem[]>(getMediaItemsQueryKey(apiClient, campaignId), (prev) => [...(prev ?? []), created]);
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
      const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
      if (files.length > 0) {
        handleSelectFiles(files);
      }
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
    };
  }, [handleSelectFiles]);

  useEffect(() => {
    if (selectedFiles.length !== 1) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFiles[0]!);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFiles]);

  async function handleDelete(item: MediaItem) {
    setDeleteItem(item);
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/${deleteItem.id}`);
      setMedia((m) => m.filter((x) => x.id !== deleteItem.id));
      queryClient.setQueryData<MediaItem[]>(getMediaItemsQueryKey(apiClient, campaignId), (prev) => (prev ?? []).filter((x) => x.id !== deleteItem.id));
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
      queryClient.setQueryData<MediaItem[]>(getMediaItemsQueryKey(apiClient, campaignId), (prev) => (prev ?? []).map((it) => (it.id === updated.id ? updated : it)));
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
        await mutateMedia();
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
      const reorderedMedia = nextMedia.map((it, i) => ({ ...it, order: i + 1 }));
      setMedia(reorderedMedia);
      queryClient.setQueryData<MediaItem[]>(getMediaItemsQueryKey(apiClient, campaignId), reorderedMedia);
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

  // P18-G: Stable key derived from the sorted media IDs — reorder and
  // caption edits change `media` but not the set of IDs, so we avoid
  // unnecessary network round-trips by keying the effect off this string.
  const mediaIdKey = useMemo(
    () => media.map((m) => m.id).sort().join(','),
    [media],
  );
  const usageSummaryIds = useMemo(
    () => (mediaIdKey ? mediaIdKey.split(',') : []),
    [mediaIdKey],
  );

  // P18-G: Fetch usage summary whenever the rendered media list changes (use
  // `media`, not the query seed `mediaItems`, so mutations stay in sync)
  useEffect(() => {
    if (usageSummaryIds.length === 0) {
      setUsageSummary({});
      setUsageSummaryLoading(false);
      return;
    }
    let canceled = false;
    setUsageSummaryLoading(true);
    void apiClient.getMediaUsageSummary(usageSummaryIds)
      .then((data) => {
        if (canceled) return;
        setUsageSummary(data);
        setUsageSummaryLoading(false);
      })
      .catch(() => {
        if (canceled) return;
        setUsageSummary({});
        setUsageSummaryLoading(false);
      });
    return () => { canceled = true; };
  }, [usageSummaryIds, apiClient]);

  // P18-G: Optionally filter to items used in exactly 1 campaign (only this one)
  const displayedMedia = useMemo(() => {
    if (!orphanFilter) return media;
    // Don't apply the filter while counts are being fetched — unknown entries
    // would be incorrectly excluded, making items temporarily disappear.
    if (usageSummaryLoading) return media;
    // Only include items whose usage count is a known number ≤ 1.
    // Items absent from the summary (partial/failed response) are excluded
    // rather than assumed exclusive.
    return media.filter((m) => {
      const count = usageSummary[m.id];
      return typeof count === 'number' && count <= 1;
    });
  }, [media, orphanFilter, usageSummary, usageSummaryLoading]);

  const mediaIds = useMemo(() => displayedMedia.map((item) => item.id), [displayedMedia]);
  const listTotalPages = useMemo(() => Math.max(1, Math.ceil(displayedMedia.length / LIST_PAGE_SIZE)), [displayedMedia.length]);
  const pagedListMedia = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return displayedMedia.slice(start, start + LIST_PAGE_SIZE);
  }, [displayedMedia, listPage]);

  useEffect(() => {
    if (listPage > listTotalPages) {
      setListPage(listTotalPages);
    }
  }, [listPage, listTotalPages, setListPage]);

  useEffect(() => {
    if (viewMode !== 'list') {
      setListPage(1);
    }
  }, [viewMode, setListPage]);

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

  // Shared props passed to both sortable sub-components (stable references prevent remounts).
  const sharedSortableProps: Omit<SharedSortableProps, 'item'> = {
    getInsertionStyle, moveByKeyboard, openLightbox, openEdit, handleDelete,
    usageSummaryLoading, usageSummary, apiClient,
  };

  return (
    <div ref={scrollContainerRef} style={{ overflowY: 'auto', maxHeight: '70vh' }}>
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <Group gap="md" wrap="wrap">
          <Text fw={700}>Media</Text>
          <Text size="sm" c="dimmed">({displayedMedia.length}{orphanFilter ? ` / ${media.length}` : ''} items)</Text>
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
          <Tooltip label="Show only items exclusive to this campaign">
            <Switch
              size="xs"
              label="Exclusive only"
              checked={orphanFilter}
              onChange={(e) => setOrphanFilter(e.currentTarget.checked)}
              aria-label="Show only media exclusive to this campaign"
            />
          </Tooltip>
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

      {effectiveLoading ? (
        <Grid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid.Col key={i} span={sizeConfig[cardSize]?.span ?? sizeConfig.medium.span}>
              <Skeleton height={sizeConfig[cardSize]?.height ?? 170} radius="md" />
            </Grid.Col>
          ))}
        </Grid>
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
                      <Table.Th w={100}>Usage</Table.Th>
                      <Table.Th w={180}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                </Table>
              </Table.ScrollContainer>

              <Table.ScrollContainer minWidth={LIST_MIN_WIDTH}>
                <SortableContext items={pagedListMedia.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <Table verticalSpacing="xs" highlightOnHover>
                    <Table.Tbody>
                      {pagedListMedia.map((item) => (
                        <SortableListRow key={item.id} item={item} {...sharedSortableProps} />
                      ))}
                    </Table.Tbody>
                  </Table>
                </SortableContext>
              </Table.ScrollContainer>

              {listTotalPages > 1 && (
                <Group justify="flex-end" mt="sm">
                  <Pagination
                    value={listPage}
                    onChange={setListPage}
                    total={listTotalPages}
                    size="sm"
                    withEdges
                    aria-label="Media list pages"
                  />
                </Group>
              )}
            </>
          ) : (
            <SortableContext items={mediaIds} strategy={rectSortingStrategy}>
              <Grid>
                {displayedMedia.map((item) => (
                  <SortableGridItem
                    key={item.id}
                    item={item}
                    {...sharedSortableProps}
                    viewMode={viewMode}
                    cardSize={cardSize}
                    mediaHeight={viewMode === 'compact' ? sizeConfig.compact.height : sizeConfig[cardSize].height}
                    gridSpan={viewMode === 'compact' ? sizeConfig.compact.span : sizeConfig[cardSize].span}
                    showUrl={cardSize === 'large'}
                  />
                ))}
              </Grid>
            </SortableContext>
          )}

          <DragOverlay>
            {activeMediaItem ? (
              <Card withBorder shadow="sm" radius="md" p="xs" style={{ minWidth: 160, opacity: 0.95 }}>
                <Text size="sm" lineClamp={1}>{activeMediaItem.caption || 'Dragging media'}</Text>
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
        selectedFiles={selectedFiles}
        onSelectFiles={handleSelectFiles}
        previewUrl={previewUrl}
        uploadTitle={uploadTitle}
        onUploadTitleChange={setUploadTitle}
        uploadCaption={uploadCaption}
        onUploadCaptionChange={setUploadCaption}
        uploadProgresses={batchProgress}
        uploadErrors={uploadErrors}
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
        usageCount={Math.max(0, (usageSummary[deleteItem?.id ?? ''] ?? 1) - 1)}
      />
    </div>
  );
}

setWpsgDebugDisplayName(MediaTab, 'AdminPanel:MediaTab');