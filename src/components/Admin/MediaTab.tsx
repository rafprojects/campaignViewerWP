import { useEffect, useMemo, useState, useRef } from 'react';
import { Button, Grid, Image, Text, Group, Loader, SegmentedControl, Table, Box, ActionIcon, Tooltip } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import { MediaCard } from './MediaCard';
import { MediaLightboxModal } from './MediaLightboxModal';
import { MediaAddModal } from './MediaAddModal';
import { MediaEditModal } from './MediaEditModal';
import { MediaDeleteModal } from './MediaDeleteModal';
import { showNotification } from '@mantine/notifications';
import { IconPlus, IconTrash, IconRefresh, IconLayoutGrid, IconList, IconGridDots, IconPhoto } from '@tabler/icons-react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem, UploadResponse } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';

type ViewMode = 'grid' | 'list' | 'compact';
type CardSize = 'small' | 'medium' | 'large';

const VIRTUALIZATION_THRESHOLD = 80;
const LIST_ROW_HEIGHT = 72;
const LIST_MIN_WIDTH = 720;
const VIRTUAL_LIST_MAX_HEIGHT = 520;

type Props = { campaignId: string; apiClient: ApiClient };

export default function MediaTab({ campaignId, apiClient }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalPreview, setExternalPreview] = useState<any | null>(null);
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

  // View options
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const { ref: listMeasureRef, width: listWidth } = useElementSize();

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
      const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setMedia(sorted);

      const needs = sorted.filter((it) => it.source === 'external' && (!it.thumbnail || !it.caption));
      if (needs.length > 0) {
        try {
          await Promise.all(
            needs.map(async (it) => {
              try {
                const data = await apiClient.get<any>(`/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(it.url)}`);
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
    setUploading(true);
    setUploadProgress(0);
    try {
      // Determine media type from file
      const mediaType = selectedFile.type.startsWith('image') ? 'image' : 'video';

      // upload using authenticated form POST (no progress via ApiClient.postForm)
      const form = new FormData();
      form.append('file', selectedFile);
      const uploadUrl = `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`;
      const authHeaders = await apiClient.getAuthHeaders();
      const res = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        Object.entries(authHeaders).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
        xhr.responseType = 'json';
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response as UploadResponse);
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => {
          try {
            const detailsParts: string[] = [
              `status=${xhr.status}`,
              `readyState=${xhr.readyState}`,
            ];
            if (xhr.statusText) {
              detailsParts.push(`statusText=${xhr.statusText}`);
            }
            // Attempt to capture any response text if available
            try {
              if (xhr.responseText) {
                detailsParts.push(`response=${xhr.responseText.substring(0,200)}`);
              }
            } catch {}
            const details = detailsParts.join(', ');
            reject(new Error(`Upload failed (network/CORS). Details: ${details}`));
          } catch (e) {
            reject(new Error('Upload failed'));
          }
        };
        if (xhr.upload) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
        }
        xhr.send(form);
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
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Upload failed', message: (err as Error).message, color: 'red' });
    } finally {
      setUploading(false);
      setUploadProgress(null);
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
      const payload: any = {
        type: inferredType,
        source: 'external',
        provider: externalPreview?.provider ?? 'external',
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
      const data = await apiClient.get<any>(`/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(externalUrl)}`);
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
    const onDragOver = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; };
    const onDrop = (e: DragEvent) => {
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

  async function moveItem(item: MediaItem, direction: 'up' | 'down') {
    // Prevent concurrent reorder operations using stable ref-based guard
    if (reorderingRef.current) return;
    reorderingRef.current = true;

    const prev = media.slice();
    const idx = media.findIndex((m) => m.id === item.id);
    if (idx === -1) {
      reorderingRef.current = false;
      return;
    }

    const newMedia = media.slice();
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newMedia.length) {
      reorderingRef.current = false;
      return;
    }
    const temp = newMedia[swapIdx];
    newMedia[swapIdx] = newMedia[idx];
    newMedia[idx] = temp;
    const itemsToSend = newMedia.map((it, i) => ({ id: it.id, order: i + 1 }));

    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/reorder`, { items: itemsToSend });
      setMedia(newMedia.map((it, i) => ({ ...it, order: i + 1 })));
      showNotification({ title: 'Reordered', message: 'Media order updated.' });
    } catch (err) {
      // Roll back local state to previous order
      setMedia(prev);
      showNotification({ title: 'Reorder failed', message: (err as Error).message, color: 'red' });
    } finally {
      reorderingRef.current = false;
    }
  }

  const listHeight = useMemo(() => {
    if (media.length === 0) return 240;
    const estimated = media.length * LIST_ROW_HEIGHT;
    return Math.min(VIRTUAL_LIST_MAX_HEIGHT, Math.max(240, estimated));
  }, [media.length]);

  const enableVirtualList = viewMode === 'list' && media.length >= VIRTUALIZATION_THRESHOLD && listWidth > 0;

  const renderListRow = ({ index, style }: ListChildComponentProps) => {
    const item = media[index];
    return (
      <Box
        role="row"
        key={item.id}
        style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: '60px 1fr 90px 90px 180px',
          alignItems: 'center',
          columnGap: 12,
          padding: '8px 12px',
          borderBottom: '1px solid var(--mantine-color-dark-5)',
        }}
      >
        <Box role="cell">
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
        </Box>
        <Box role="cell">
          <Text size="sm" c="gray.1" lineClamp={1}>{item.caption || '—'}</Text>
          <Text size="xs" c="gray.4" lineClamp={1}>{item.url}</Text>
        </Box>
        <Box role="cell"><Text size="sm">{item.type}</Text></Box>
        <Box role="cell"><Text size="sm">{item.source}</Text></Box>
        <Box role="cell">
          <Group gap={4} wrap="nowrap">
            <ActionIcon variant="subtle" onClick={() => openEdit(item)} aria-label="Edit"><IconPhoto size={16} /></ActionIcon>
            <ActionIcon variant="subtle" onClick={() => moveItem(item, 'up')} aria-label="Move media up">↑</ActionIcon>
            <ActionIcon variant="subtle" onClick={() => moveItem(item, 'down')} aria-label="Move media down">↓</ActionIcon>
            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item)} aria-label="Delete media"><IconTrash size={16} /></ActionIcon>
          </Group>
        </Box>
      </Box>
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
      ) : viewMode === 'list' ? (
        /* List View */
        <Box ref={listMeasureRef}>
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

          {enableVirtualList ? (
            <Box style={{ minWidth: LIST_MIN_WIDTH, borderTop: '1px solid var(--mantine-color-dark-5)' }}>
              <FixedSizeList
                height={listHeight}
                itemCount={media.length}
                itemSize={LIST_ROW_HEIGHT}
                width={Math.max(listWidth, LIST_MIN_WIDTH)}
              >
                {renderListRow}
              </FixedSizeList>
            </Box>
          ) : (
            <Table.ScrollContainer minWidth={LIST_MIN_WIDTH}>
              <Table verticalSpacing="xs" highlightOnHover>
                <Table.Tbody>
                  {media.map((item) => (
                    <Table.Tr key={item.id}>
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
                        <Text size="xs" c="gray.4" lineClamp={1}>{item.url}</Text>
                      </Table.Td>
                      <Table.Td><Text size="sm">{item.type}</Text></Table.Td>
                      <Table.Td><Text size="sm">{item.source}</Text></Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <ActionIcon variant="subtle" onClick={() => openEdit(item)} aria-label="Edit"><IconPhoto size={16} /></ActionIcon>
                          <ActionIcon variant="subtle" onClick={() => moveItem(item, 'up')} aria-label="Move media up">↑</ActionIcon>
                          <ActionIcon variant="subtle" onClick={() => moveItem(item, 'down')} aria-label="Move media down">↓</ActionIcon>
                          <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item)} aria-label="Delete media"><IconTrash size={16} /></ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Box>
      ) : (
        /* Grid / Compact View */
        <Grid>
          {media.map((item) => {
            const mediaHeight = viewMode === 'compact'
              ? sizeConfig.compact.height
              : sizeConfig[cardSize].height;
            const isCompact = viewMode === 'compact' || cardSize === 'small';
            
            return (
              <Grid.Col
                key={item.id}
                span={viewMode === 'compact' ? sizeConfig.compact.span : sizeConfig[cardSize].span}
              >
                <MediaCard
                  item={item}
                  height={mediaHeight}
                  compact={isCompact}
                  showUrl={cardSize === 'large'}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                  onMoveUp={() => moveItem(item, 'up')}
                  onMoveDown={() => moveItem(item, 'down')}
                  onImageClick={item.type === 'image' ? () => openLightbox(item) : undefined}
                />
              </Grid.Col>
            );
          })}
        </Grid>
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
