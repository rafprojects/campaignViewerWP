import { useCallback, useEffect, useMemo, useState, useRef, memo } from 'react';
import { Button, Grid, Text, Group, Select, Table, Box, Tooltip, Pagination, Skeleton, Switch, type Primitive } from '@mantine/core';
import { SegmentedControl } from '@mantine/core';

// Mantine's SegmentedControl calls setState inside its ref callbacks, which triggers
// React's "maximum update depth" error when the component re-renders rapidly.
// Wrapping in memo (with stable data/onChange props) prevents re-renders during cascades.
const StableSegmentedControl = memo(SegmentedControl);
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { MediaLightboxModal } from './MediaLightboxModal';
import { MediaAddModal } from './MediaAddModal';
import { MediaEditModal } from './MediaEditModal';
import { MediaDeleteModal } from './MediaDeleteModal';
import { NearDuplicateWarning } from '@/components/Common/NearDuplicateWarning';
import { IconPlus, IconRefresh, IconLayoutGrid, IconList, IconGridDots } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';
import { useMediaItems } from '@/services/adminQuery';
import { useGetSettings } from '@/services/settingsQuery';
import type { MediaItem, OEmbedResponse } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { useRootId } from '@wp-super-gallery/shared-ui';
import {
  buildMediaGridShellVars,
  mapToMediaGridBreakpoint,
  MEDIA_GRID_GUTTER_PX,
  MEDIA_GRID_MAX_WIDTHS,
  resolveMediaGridPresetKey,
  resolveResponsiveMediaGridSpan,
} from './mediaTabLayout';
import { SortableListRow, SortableGridItem, type SharedSortableProps } from './MediaTabSortableItems';
import { useMediaViewPrefs, type ViewMode, type CardSize } from '@/hooks/useMediaViewPrefs';
import { useMediaLightbox } from '@wp-super-gallery/shared-utils';
import { useMediaUsageSummary } from '@/hooks/useMediaUsageSummary';
import { type MediaSortMode } from './applySortMode';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useMediaExternal } from '@/hooks/useMediaExternal';
import { useMediaCrud } from '@/hooks/useMediaCrud';
import { useMediaDisplay } from '@/hooks/useMediaDisplay';
import styles from './MediaTab.module.scss';

// Position the DragOverlay so its top-center sits just below the cursor.
// The overlay is 140 px wide; placing the cursor at (width/2, 12) gives a natural
// "carrying" feel — the thumbnail hangs from the pointer rather than appearing
// at the drag-source element's top-left corner.
const snapThumbnailToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !activatorEvent) return transform;
  const coords = getEventCoordinates(activatorEvent);
  if (!coords) return transform;
  const offsetX = coords.x - draggingNodeRect.left;
  const offsetY = coords.y - draggingNodeRect.top;
  const OVERLAY_W = 140;
  const CURSOR_TOP_OFFSET = 12; // px below overlay's top edge where cursor sits
  return {
    ...transform,
    x: transform.x + offsetX - OVERLAY_W / 2,
    y: transform.y + offsetY - CURSOR_TOP_OFFSET,
  };
};

const LIST_MIN_WIDTH = 720;

type Props = { campaignId: string; apiClient: ApiClient; onCampaignsUpdated?: () => void };

export default function MediaTab({ campaignId, apiClient, onCampaignsUpdated }: Props) {
  const { t } = useTranslation('wpsg');
  const rootId = useRootId();
  // P13-C: Query-cached media fetch — instant render on campaign revisit.
  // Local state holds the working copy for optimistic mutations (upload, delete,
  // reorder, oEmbed enrichment). Query data seeds it on mount / campaign change.
  const queryClient = useQueryClient();
  const { mediaItems, mediaLoading: mediaQueryLoading, mutateMedia } = useMediaItems(apiClient, campaignId);
  const { data: settingsResponse } = useGetSettings(apiClient);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const maxBatchUploadSize = settingsResponse?.maxBatchUploadSize ?? 20;

  const { viewMode, setViewMode, cardSize, setCardSize, listPage, setListPage,
    sortMode, setSortMode, orphanFilter, setOrphanFilter } = useMediaViewPrefs(campaignId, rootId);
  const { usageSummary, usageSummaryLoading } = useMediaUsageSummary(apiClient, media);

  const hasMedia = media.length > 0;

  // Scroll position preservation across tab switches (sessionStorage, per-campaign)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollKey = `wpsg_media_scrollTop_${campaignId}`;

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
  const { lightboxOpen, setLightboxOpen, lightboxIndex, openLightbox, navigateLightbox } = useMediaLightbox(imageItems);

  // Card size configurations
  const sizeConfig = useMemo(() => ({
    compact: { span: { base: 6, sm: 3, md: 2, lg: 2 }, height: 72, maxWidth: MEDIA_GRID_MAX_WIDTHS.compact },
    small: { span: { base: 6, sm: 4, md: 3, lg: 3 }, height: 110, maxWidth: MEDIA_GRID_MAX_WIDTHS.small },
    medium: { span: { base: 12, sm: 6, md: 4 }, height: 170, maxWidth: MEDIA_GRID_MAX_WIDTHS.medium },
    large: { span: { base: 12, sm: 6 }, height: 240, maxWidth: MEDIA_GRID_MAX_WIDTHS.large },
  }), []);

  const activeGridPreset = useMemo(() => {
    const presetKey = resolveMediaGridPresetKey(viewMode, cardSize);
    return sizeConfig[presetKey];
  }, [viewMode, cardSize, sizeConfig]);

  const mediaGridShellVars = useMemo(
    () => buildMediaGridShellVars(activeGridPreset, MEDIA_GRID_GUTTER_PX),
    [activeGridPreset],
  );

  const gridShellRef = useRef<HTMLDivElement | null>(null);
  const { breakpoint: containerBp } = useBreakpoint(gridShellRef);
  const resolvedSpan = useMemo(
    () => resolveResponsiveMediaGridSpan(activeGridPreset.span, mapToMediaGridBreakpoint(containerBp)),
    [activeGridPreset.span, containerBp],
  );

  // Show skeleton only on first load when no cached query data exists yet.
  const effectiveLoading = mediaQueryLoading && media.length === 0;

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

  const {
    selectedFiles,
    uploadErrors,
    uploadTitle,
    setUploadTitle,
    uploadCaption,
    setUploadCaption,
    batchProgress,
    uploading,
    pendingNearDuplicates,
    nearDupLoading,
    handleSelectFiles,
    handleRemoveFile,
    handleClearFiles,
    handleUpload,
    handleNearDupUseExisting,
    handleNearDupUploadAnyway,
    handleNearDupDismiss,
  } = useMediaUpload({ apiClient, campaignId, maxBatchUploadSize, media, setMedia, queryClient, onCampaignsUpdated, setAddOpen });

  const {
    externalUrl,
    setExternalUrl,
    externalPreview,
    externalLoading,
    externalError,
    handleAddExternal,
    handleFetchOEmbed,
  } = useMediaExternal({ apiClient, campaignId, setMedia, queryClient, onCampaignsUpdated, setAddOpen });

  const {
    editOpen,
    setEditOpen,
    editingTitle,
    setEditingTitle,
    editingCaption,
    setEditingCaption,
    editingThumbnail,
    setEditingThumbnail,
    deleteItem,
    setDeleteItem,
    rescanning,
    handleDelete,
    confirmDelete,
    openEdit,
    saveEdit,
    handleRescanTypes,
  } = useMediaCrud({ apiClient, campaignId, setMedia, queryClient, onCampaignsUpdated, mutateMedia });

  const {
    displayedMedia,
    mediaIds,
    listTotalPages,
    pagedListMedia,
    sensors,
    activeMediaItem,
    getInsertionStyle,
    handleDndStart,
    handleDndOver,
    handleDndEnd,
    moveByKeyboard,
  } = useMediaDisplay({ media, setMedia, apiClient, campaignId, queryClient, onCampaignsUpdated, orphanFilter, usageSummary, usageSummaryLoading, sortMode, viewMode, listPage, setListPage });

  // Stable data arrays for SegmentedControl — new array references on every render can trigger
  // Mantine's internal ref-measurement loop and cause infinite setState cycles under rapid updates.
  const viewModeData = useMemo(() => [
    { value: 'grid', label: <Tooltip label={t('admin_media_view_grid', 'Grid View')}><Box><IconLayoutGrid size={16} /></Box></Tooltip> },
    { value: 'compact', label: <Tooltip label={t('admin_media_view_compact', 'Compact Grid')}><Box><IconGridDots size={16} /></Box></Tooltip> },
    { value: 'list', label: <Tooltip label={t('admin_media_view_list', 'List View')}><Box><IconList size={16} /></Box></Tooltip> },
  ], [t]);

  const cardSizeData = useMemo(() => [
    { value: 'small', label: 'S' },
    { value: 'medium', label: 'M' },
    { value: 'large', label: 'L' },
  ], []);

  // P34-B: sort selector options — disable usage sort while summary is being fetched
  // to avoid showing a misleading all-zero-count ordering before data arrives.
  const sortModeData = useMemo(() => [
    { value: 'order', label: t('admin_media_sort_order', 'Order') },
    { value: 'title', label: t('admin_media_sort_title', 'Title A–Z') },
    { value: 'created', label: t('admin_media_sort_created', 'Date uploaded') },
    { value: 'size', label: t('admin_media_sort_size', 'File size') },
    { value: 'usage', label: t('admin_media_sort_usage', 'Usage count'), disabled: usageSummaryLoading },
  ], [usageSummaryLoading, t]);

  const handleViewModeChange = useCallback((v: Primitive) => setViewMode(v as unknown as ViewMode), [setViewMode]);
  const handleCardSizeChange = useCallback((v: Primitive) => setCardSize(v as unknown as CardSize), [setCardSize]);

  // Shared props passed to both sortable sub-components (stable references prevent remounts).
  // P34-B: hide drag handles when a non-order sort is active (dragging would
  // modify server-side `order` values while items are displayed in a different sequence).
  const sharedSortableProps: Omit<SharedSortableProps, 'item'> = {
    getInsertionStyle, moveByKeyboard, openLightbox, openEdit, handleDelete,
    usageSummaryLoading, usageSummary, apiClient,
    dragDisabled: sortMode !== 'order',
  };

  return (
    <div ref={scrollContainerRef} style={{ overflowY: 'auto', maxHeight: '70vh' }}>
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <Group gap="md" wrap="wrap">
          <Text fw={700}>{t('admin_media_heading', 'Media')}</Text>
          <Text size="sm" c="dimmed">({displayedMedia.length}{orphanFilter ? ` / ${media.length}` : ''} {t('admin_media_items', 'items')})</Text>
        </Group>
        <Group gap="sm" wrap="wrap" style={{ flex: '1 1 auto', justifyContent: 'flex-end' }}>
          {/* View Mode Toggle */}
          <StableSegmentedControl
            size="xs"
            value={viewMode}
            onChange={handleViewModeChange}
            aria-label={t('admin_media_view_mode', 'Media view mode')}
            data={viewModeData}
          />
          {/* Card Size (only for grid modes) */}
          {viewMode !== 'list' && (
            <StableSegmentedControl
              size="xs"
              value={cardSize}
              onChange={handleCardSizeChange}
              aria-label={t('admin_media_card_size', 'Media card size')}
              data={cardSizeData}
            />
          )}
          {/* P34-B: sort mode selector */}
          <Select
            size="xs"
            value={sortMode}
            onChange={(v) => v && setSortMode(v as MediaSortMode)}
            data={sortModeData}
            style={{ minWidth: 138 }}
            aria-label={t('admin_media_sort_mode', 'Media sort mode')}
            comboboxProps={{ width: 160 }}
          />
          <Tooltip label={t('admin_media_exclusive_tooltip', 'Show only items exclusive to this campaign')}>
            <Switch
              size="xs"
              label={t('admin_media_exclusive', 'Exclusive only')}
              checked={orphanFilter}
              onChange={(e) => setOrphanFilter(e.currentTarget.checked)}
              aria-label={t('admin_media_exclusive_aria', 'Show only media exclusive to this campaign')}
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
            {t('admin_media_rescan_types', 'Rescan Types')}
          </Button>
          <Button leftSection={<IconPlus />} onClick={() => setAddOpen(true)} style={{ flex: '0 0 auto' }}>
            {t('admin_media_add', 'Add Media')}
          </Button>
        </Group>
      </Group>

      {effectiveLoading ? (
        <Box ref={gridShellRef} className={styles.mediaGridShell ?? ''} style={mediaGridShellVars} data-testid="media-grid-shell">
          <Grid gap={MEDIA_GRID_GUTTER_PX}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid.Col key={i} span={resolvedSpan}>
                <Skeleton height={activeGridPreset.height} radius="md" />
              </Grid.Col>
            ))}
          </Grid>
        </Box>
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
                      <Table.Th w={60}>{t('admin_media_col_thumb', 'Thumb')}</Table.Th>
                      <Table.Th>{t('admin_media_col_caption', 'Caption')}</Table.Th>
                      <Table.Th>{t('admin_media_col_type', 'Type')}</Table.Th>
                      <Table.Th>{t('admin_media_col_source', 'Source')}</Table.Th>
                      <Table.Th w={100}>{t('admin_media_col_usage', 'Usage')}</Table.Th>
                      <Table.Th w={180}>{t('admin_col_actions', 'Actions')}</Table.Th>
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
                    aria-label={t('admin_media_list_pages', 'Media list pages')}
                  />
                </Group>
              )}
            </>
          ) : (
            <SortableContext items={mediaIds} strategy={rectSortingStrategy}>
              <Box ref={gridShellRef} className={styles.mediaGridShell ?? ''} style={mediaGridShellVars} data-testid="media-grid-shell">
                <Grid gap={MEDIA_GRID_GUTTER_PX}>
                  {displayedMedia.map((item) => (
                    <SortableGridItem
                      key={item.id}
                      item={item}
                      {...sharedSortableProps}
                      viewMode={viewMode}
                      cardSize={cardSize}
                      mediaHeight={activeGridPreset.height}
                      gridSpan={resolvedSpan}
                      showUrl={viewMode !== 'compact' && cardSize === 'large'}
                    />
                  ))}
                </Grid>
              </Box>
            </SortableContext>
          )}

          <DragOverlay modifiers={[snapThumbnailToCursor]} dropAnimation={{ duration: 180, easing: 'ease' }}>
            {activeMediaItem ? (
              <div style={{
                width: 140,
                borderRadius: 8,
                overflow: 'hidden',
                opacity: 0.82,
                boxShadow: '0 8px 28px rgba(0,0,0,0.32)',
                transform: 'rotate(1.5deg)',
                pointerEvents: 'none',
                background: 'var(--mantine-color-body)',
              }}>
                <img
                  src={activeMediaItem.thumbnail ?? activeMediaItem.url ?? FALLBACK_IMAGE_SRC}
                  alt={activeMediaItem.caption || t('admin_media_drag_alt', 'media item')}
                  style={{ display: 'block', width: '100%', height: 96, objectFit: 'cover' }}
                />
                {activeMediaItem.caption && (
                  <div style={{
                    fontSize: 11,
                    padding: '4px 6px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--mantine-color-text)',
                    borderTop: '1px solid var(--mantine-color-default-border)',
                  }}>
                    {activeMediaItem.caption}
                  </div>
                )}
              </div>
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
        onRemoveFile={handleRemoveFile}
        onClearFiles={handleClearFiles}
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

      {pendingNearDuplicates.length > 0 && (
        <NearDuplicateWarning
          opened
          filename={pendingNearDuplicates[0]!.filename}
          similarUrl={pendingNearDuplicates[0]!.similarUrl}
          similarId={pendingNearDuplicates[0]!.similarId}
          distance={pendingNearDuplicates[0]!.distance}
          originalName={pendingNearDuplicates[0]!.similarName}
          campaigns={pendingNearDuplicates[0]!.campaigns}
          onUseExisting={handleNearDupUseExisting}
          onUploadAnyway={handleNearDupUploadAnyway}
          onDismiss={handleNearDupDismiss}
          loading={nearDupLoading}
        />
      )}
    </div>
  );
}

setWpsgDebugDisplayName(MediaTab, 'AdminPanel:MediaTab');
