import { useEffect, useState, useRef } from 'react';
import { Button, Grid, Card, Image, Text, Group, Modal, TextInput, FileButton, Loader, Progress, Paper, Stack } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconPlus, IconUpload, IconTrash } from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '../../api/media';

type Props = { campaignId: string; apiClient: ApiClient };

export default function MediaTab({ campaignId, apiClient }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalPreview, setExternalPreview] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editingCaption, setEditingCaption] = useState('');
  const [editingThumbnail, setEditingThumbnail] = useState<string | undefined>(undefined);

  useEffect(() => {
    void fetchMedia();
  }, [campaignId]);

  async function fetchMedia() {
    if (!campaignId) {
      setMedia([]);
      return;
    }

    setLoading(true);
    try {
      const items = await apiClient.get<MediaItem[]>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`);
      const sorted = items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setMedia(sorted);

      // Auto-fetch oEmbed metadata for external items missing thumbnail or title
      const needs = sorted.filter((it) => it.source === 'external' && (!it.thumbnail || !it.caption));
      if (needs.length > 0) {
        console.log('MediaTab: fetching oEmbed for', needs.length, 'items');
        try {
          await Promise.all(
            needs.map(async (it) => {
              try {
                const data = await apiClient.get<any>(`/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(it.url)}`);
                if (data) {
                  setMedia((prev) =>
                    prev.map((p) => (p.id === it.id ? { ...p, thumbnail: p.thumbnail || data.thumbnail_url || p.thumbnail, caption: p.caption || data.title || '' } : p)),
                  );
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
    try {
      // upload using authenticated form POST (no progress via ApiClient.postForm)
      const form = new FormData();
      form.append('file', selectedFile);
      const res = await apiClient.postForm<{ attachmentId: string; url: string; thumbnail?: string; mimeType?: string }>(`/wp-json/wp-super-gallery/v1/media/upload`, form);
      const newMedia = await apiClient.post<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`, {
        type: res.mimeType?.startsWith('image') ? 'image' : 'video',
        source: 'upload',
        provider: 'wordpress',
        url: res.url,
        thumbnail: res.thumbnail ?? res.url,
        caption: selectedFile.name,
      });
      setMedia((m) => [...m, newMedia]);
      setSelectedFile(null);
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
    try {
      const payload: any = {
        type: externalPreview?.type ?? 'video',
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
    try {
      console.log('MediaTab: handleFetchOEmbed', externalUrl);
      showNotification({ title: 'Fetching preview', message: 'Attempting to load preview...', loading: true });
      // 1) Try plugin server-side oEmbed proxy to avoid CORS and provider restrictions
      try {
        console.log('MediaTab: calling server oembed proxy');
        const data = await apiClient.get<any>(`/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(externalUrl)}`);
        console.log('MediaTab: server oembed response', data);
        if (data) {
          setExternalPreview(data);
          showNotification({ title: 'Preview loaded', message: data.title ?? 'Preview available' });
          return;
        }
      } catch (serverErr) {
        console.warn('Server-side oEmbed failed, falling back to provider endpoints', serverErr);
      }

      // 2) Provider-specific oEmbed endpoints (may be CORS-restricted)
      const tryFetch = async (url: string) => {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
        return res.json();
      };

      // YouTube
      if (/youtube\.com|youtu\.be/.test(externalUrl)) {
        try {
          const y = `https://www.youtube.com/oembed?url=${encodeURIComponent(externalUrl)}&format=json`;
          const data = await tryFetch(y);
          console.log('YouTube oEmbed data', data);
          setExternalPreview(data);
          showNotification({ title: 'Preview loaded', message: data.title ?? 'Preview available' });
          return;
        } catch (e) {
          console.warn('YouTube oEmbed failed', e);
        }
      }

      // Vimeo
      if (/vimeo\.com/.test(externalUrl)) {
        try {
          const v = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(externalUrl)}`;
          const data = await tryFetch(v);
          setExternalPreview(data);
          showNotification({ title: 'Preview loaded', message: data.title ?? 'Preview available' });
          return;
        } catch (e) {
          console.warn('Vimeo oEmbed failed', e);
        }
      }

      // 3) Public fallback: noembed.com (supports many providers)
      try {
        const n = `https://noembed.com/embed?url=${encodeURIComponent(externalUrl)}`;
        const data = await tryFetch(n);
        setExternalPreview(data);
        showNotification({ title: 'Preview loaded', message: data.title ?? 'Preview available' });
        return;
      } catch (e) {
        console.warn('noembed fallback failed', e);
      }

      throw new Error('All oEmbed attempts failed');
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Preview failed', message: (err as Error).message, color: 'red' });
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
    if (!confirm('Delete this media?')) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/${item.id}`);
      setMedia((m) => m.filter((x) => x.id !== item.id));
      showNotification({ title: 'Deleted', message: 'Media removed.' });
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Delete failed', message: (err as Error).message, color: 'red' });
    }
  }

  function openEdit(item: MediaItem) {
    setEditingItem(item);
    setEditingCaption(item.caption ?? '');
    setEditingThumbnail(item.thumbnail);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editingItem) return;
    try {
      const updated = await apiClient.put<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/${editingItem.id}`, { caption: editingCaption, thumbnail: editingThumbnail });
      setMedia((m) => m.map((it) => (it.id === updated.id ? updated : it)));
      setEditOpen(false);
      showNotification({ title: 'Saved', message: 'Media updated.' });
    } catch (err) {
      showNotification({ title: 'Save failed', message: (err as Error).message, color: 'red' });
    }
  }

  async function moveItem(item: MediaItem, direction: 'up' | 'down') {
    const idx = media.findIndex((m) => m.id === item.id);
    if (idx === -1) return;
    const newMedia = media.slice();
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newMedia.length) return;
    const temp = newMedia[swapIdx];
    newMedia[swapIdx] = newMedia[idx];
    newMedia[idx] = temp;
    const itemsToSend = newMedia.map((it, i) => ({ id: it.id, order: i + 1 }));
    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/reorder`, { items: itemsToSend });
      setMedia(newMedia.map((it, i) => ({ ...it, order: i + 1 })));
    } catch (err) {
      showNotification({ title: 'Reorder failed', message: (err as Error).message, color: 'red' });
    }
  }

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Text fw={700}>Media</Text>
        <Button leftSection={<IconPlus />} onClick={() => setAddOpen(true)}>Add Media</Button>
      </Group>

      {loading ? (
        <Loader />
      ) : (
        <Grid>
          {media.map((item) => (
            <Grid.Col key={item.id} span={4}>
              <Card shadow="sm">
                <Card.Section>
                  {item.source === 'external' && item.type === 'video' && item.embedUrl ? (
                    <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                      <iframe
                        src={item.embedUrl}
                        title={item.caption || 'External video'}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <Image src={item.thumbnail ?? item.url} alt={item.caption} height={160} />
                  )}
                </Card.Section>
                <Group justify="space-between" mt="sm">
                  <div>
                    <Text size="sm">{item.caption || '—'}</Text>
                    {item.url && (
                      <Text size="xs" c="dimmed">
                        <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                      </Text>
                    )}
                  </div>
                  <Group gap="xs">
                    <Button variant="subtle" onClick={() => openEdit(item)}>Edit</Button>
                    <Button variant="subtle" onClick={() => moveItem(item, 'up')}>↑</Button>
                    <Button variant="subtle" onClick={() => moveItem(item, 'down')}>↓</Button>
                    <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={() => handleDelete(item)} />
                  </Group>
                </Group>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      )}

      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="Add Media">
        <Stack gap="sm">
          <Paper ref={dropRef} p="md" withBorder style={{ cursor: 'pointer' }}>
            <Group justify="space-between">
              <Group>
                <FileButton onChange={setSelectedFile} accept="image/*,video/*">
                  {(props) => <Button leftSection={<IconUpload />} {...props}>Choose file</Button>}
                </FileButton>
                <Text size="sm" c="dimmed">or drag & drop a file here</Text>
              </Group>
              {selectedFile && <Text size="sm">{selectedFile.name}</Text>}
            </Group>

            {previewUrl && (
              <Group mt="sm">
                <Image src={previewUrl} alt="preview" height={140} />
              </Group>
            )}

            {uploadProgress !== null && <Progress value={uploadProgress} mt="sm" />}
            <Group mt="sm">
              <Button onClick={handleUpload} loading={uploading} disabled={!selectedFile}>Upload</Button>
            </Group>
          </Paper>

          <Text fw={600}>Or add external URL</Text>
          <Group>
            <TextInput value={externalUrl} onChange={(e) => setExternalUrl(e.currentTarget.value)} placeholder="https://youtube.com/..." />
            <Button onClick={handleFetchOEmbed}>Preview</Button>
            <Button onClick={handleAddExternal}>Add</Button>
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
                    {externalPreview.thumbnail_url && <Image src={externalPreview.thumbnail_url} height={100} />}
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

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Edit Media">
        <Stack>
          <TextInput label="Caption" value={editingCaption} onChange={(e) => setEditingCaption(e.currentTarget.value)} />
          <TextInput label="Thumbnail URL" value={editingThumbnail ?? ''} onChange={(e) => setEditingThumbnail(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
