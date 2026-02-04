import { useEffect, useState, useRef } from 'react';
import { Button, Grid, Card, Image, Text, Group, Modal, TextInput, Textarea, FileButton, Loader, Progress, Paper, Stack, SegmentedControl, Table, Box, ActionIcon, Tooltip, ScrollArea } from '@mantine/core';
import { MediaCard } from './MediaCard';
import { showNotification } from '@mantine/notifications';
import { IconPlus, IconUpload, IconTrash, IconRefresh, IconLayoutGrid, IconList, IconGridDots, IconPhoto, IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem, UploadResponse } from '@/types';

type ViewMode = 'grid' | 'list' | 'compact';
type CardSize = 'small' | 'medium' | 'large';

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

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Get image items for lightbox navigation
  const imageItems = media.filter((m) => m.type === 'image');

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
  const sizeConfig = {
    compact: { span: { base: 6, sm: 3, md: 2, lg: 2 }, height: 72 },
    small: { span: { base: 6, sm: 4, md: 3, lg: 3 }, height: 110 },
    medium: { span: { base: 12, sm: 6, md: 4 }, height: 170 },
    large: { span: { base: 12, sm: 6 }, height: 240 },
  };

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
        <ScrollArea offsetScrollbars type="auto">
          <Table verticalSpacing="xs" highlightOnHover style={{ minWidth: 720 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>Thumb</Table.Th>
                <Table.Th>Caption</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th w={180}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
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
                      fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Crect fill='%23374151' width='50' height='50'/%3E%3C/svg%3E"
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
        </ScrollArea>
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

      {/* Image Lightbox Modal */}
      <Modal
        opened={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        size="xl"
        padding={0}
        withCloseButton={false}
        centered
        styles={{ body: { background: 'rgba(0,0,0,0.9)' } }}
        aria-label={`Media lightbox: ${imageItems[lightboxIndex]?.caption || 'Image'} (${lightboxIndex + 1} of ${imageItems.length})`}
      >
        {imageItems.length > 0 && imageItems[lightboxIndex] && (
          <Box pos="relative">
            <Image
              src={imageItems[lightboxIndex].url}
              alt={imageItems[lightboxIndex].caption || 'Media preview'}
              fit="contain"
              mah="80vh"
            />
            <ActionIcon
              variant="filled"
              color="dark"
              pos="absolute"
              top={10}
              right={10}
              onClick={() => setLightboxOpen(false)}
              aria-label="Close lightbox"
            >
              <IconX size={18} />
            </ActionIcon>
            {imageItems.length > 1 && (
              <>
                <ActionIcon
                  variant="filled"
                  color="dark"
                  pos="absolute"
                  left={10}
                  top="50%"
                  style={{ transform: 'translateY(-50%)' }}
                  onClick={() => navigateLightbox('prev')}
                  aria-label="Previous image"
                >
                  <IconChevronLeft size={20} />
                </ActionIcon>
                <ActionIcon
                  variant="filled"
                  color="dark"
                  pos="absolute"
                  right={10}
                  top="50%"
                  style={{ transform: 'translateY(-50%)' }}
                  onClick={() => navigateLightbox('next')}
                  aria-label="Next image"
                >
                  <IconChevronRight size={20} />
                </ActionIcon>
              </>
            )}
            <Box
              pos="absolute"
              bottom={0}
              left={0}
              right={0}
              p="md"
              style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}
            >
              <Text c="white" size="sm">{imageItems[lightboxIndex].caption || 'Untitled'}</Text>
              <Text c="dimmed" size="xs">{lightboxIndex + 1} / {imageItems.length}</Text>
            </Box>
          </Box>
        )}
      </Modal>

      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="Add Media" padding="md">
        <Stack gap="sm">
          <Paper ref={dropRef} p="md" withBorder style={{ cursor: 'pointer' }}>
            <Group justify="space-between" wrap="wrap" gap="sm">
              <Group>
                <FileButton onChange={setSelectedFile} accept="image/*,video/*">
                  {(props) => <Button leftSection={<IconUpload />} {...props}>Choose file</Button>}
                </FileButton>
                <Text size="sm" c="dimmed">or drag & drop a file here</Text>
              </Group>
              {selectedFile && <Text size="sm" c="gray.1">{selectedFile.name}</Text>}
            </Group>

            {previewUrl && (
              <Group mt="sm">
                <Image src={previewUrl} alt="Upload preview" h={140} fit="cover" radius="sm" />
              </Group>
            )}

            {selectedFile && (
              <Stack gap="xs" mt="sm">
                <TextInput
                  label="Title"
                  placeholder="Enter a title (optional)"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.currentTarget.value)}
                />
                <Textarea
                  label="Caption"
                  placeholder="Enter a caption or description (optional)"
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.currentTarget.value)}
                  autosize
                  minRows={2}
                  maxRows={4}
                />
              </Stack>
            )}

            {uploadProgress !== null && <Progress value={uploadProgress} mt="sm" />}
            <Group mt="sm">
              <Button onClick={handleUpload} loading={uploading} disabled={!selectedFile}>Upload</Button>
            </Group>
          </Paper>

          <Text fw={600}>Or add external URL</Text>
          <Group wrap="wrap" gap="sm">
            <TextInput
              label="External URL"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.currentTarget.value)}
              placeholder="https://youtube.com/..."
              error={externalError}
              aria-label="External media URL"
            />
            <Button onClick={handleFetchOEmbed} loading={externalLoading} aria-label="Preview external media">
              Preview
            </Button>
            <Button onClick={handleAddExternal} disabled={!externalUrl} aria-label="Add external media">
              Add
            </Button>
          </Group>

          {externalPreview && (
            <Card mt="sm">
              <Stack>
                {externalPreview.html ? (
                  <div
                    style={{ position: 'relative', paddingTop: '56.25%' }}
                  >
                    <div
                      style={{ position: 'absolute', inset: 0 }}
                      dangerouslySetInnerHTML={{ __html: externalPreview.html }}
                    />
                  </div>
                ) : (
                  <Group>
                    {externalPreview.thumbnail_url && (
                      <Image
                        src={externalPreview.thumbnail_url}
                        h={100}
                        fit="cover"
                        radius="sm"
                        alt={externalPreview.title || 'External media preview'}
                      />
                    )}
                    <div>
                      <Text fw={700}>{externalPreview.title}</Text>
                      <Text size="sm" c="dimmed">{externalPreview.provider_name}</Text>
                    </div>
                  </Group>
                )}
              </Stack>
            </Card>
          )}
        </Stack>
      </Modal>

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Edit Media" padding="md">
        <Stack gap="md">
          <TextInput 
            label="Title" 
            placeholder="Enter a title (optional)"
            value={editingTitle} 
            onChange={(e) => setEditingTitle(e.currentTarget.value)}
            description="Optional display title for this media item"
          />
          <Textarea
            label="Caption" 
            placeholder="Enter a caption or description"
            value={editingCaption} 
            onChange={(e) => setEditingCaption(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={4}
            description="Descriptive text shown with the media"
          />
          <TextInput 
            label="Thumbnail URL" 
            placeholder="https://..." 
            value={editingThumbnail ?? ''} 
            onChange={(e) => setEditingThumbnail(e.currentTarget.value)}
            description="Custom preview image URL (optional)"
          />
          <Group justify="flex-end" wrap="wrap" gap="sm">
            <Button variant="default" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={!!deleteItem} onClose={() => setDeleteItem(null)} title="Delete Media" size="sm" padding="md">
        <Stack>
          <Text>Are you sure you want to delete this media item? This action cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button
              color="red"
              onClick={confirmDelete}
              aria-label={`Delete media ${deleteItem?.caption || deleteItem?.url || ''}`.trim()}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
