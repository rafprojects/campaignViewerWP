import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  FileButton,
  Button,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core';
import { IconTrash, IconUpload } from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import { type FontLibraryEntry, loadCustomFonts } from '@/utils/loadCustomFonts';

const ACCEPT = '.woff2,.woff,.ttf,.otf';

interface Props {
  apiClient: ApiClient;
  /** Called whenever the font list changes so parent can pass to TypographyEditors. */
  onFontsChange?: (fonts: FontLibraryEntry[]) => void;
}

export function FontLibraryManager({ apiClient, onFontsChange }: Props) {
  const [fonts, setFonts] = useState<FontLibraryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const onFontsChangeRef = useRef(onFontsChange);
  onFontsChangeRef.current = onFontsChange;

  const fetchFonts = useCallback(async () => {
    try {
      const data = await apiClient.get<FontLibraryEntry[]>(
        '/wp-json/wp-super-gallery/v1/admin/font-library',
      );
      setFonts(data);
      loadCustomFonts(data);
      onFontsChangeRef.current?.(data);
    } catch {
      // Silent — admin may not have access
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  useEffect(() => { fetchFonts(); }, [fetchFonts]);

  const handleUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await apiClient.postForm<FontLibraryEntry>(
        '/wp-json/wp-super-gallery/v1/admin/font-library',
        fd,
      );
      await fetchFonts();
    } catch {
      // Upload failed — silently handled
    } finally {
      setIsUploading(false);
    }
  }, [apiClient, fetchFonts]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/admin/font-library/${id}`);
      await fetchFonts();
    } catch {
      // Delete failed
    }
  }, [apiClient, fetchFonts]);

  if (isLoading) {
    return <Loader size="sm" />;
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>Custom Fonts</Text>
      <Text size="xs" c="dimmed">
        Upload .woff2, .woff, .ttf, or .otf font files. Uploaded fonts appear in the font picker for all typography editors.
      </Text>

      {fonts.length > 0 && (
        <Stack gap={4}>
          {fonts.map((f) => (
            <Group key={f.id} justify="space-between" wrap="nowrap" gap="xs">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                <Text size="xs" truncate style={{ maxWidth: 180 }}>{f.name}</Text>
                <Badge size="xs" variant="light" color="gray">{f.format}</Badge>
              </Group>
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => handleDelete(f.id)}
                title={`Delete ${f.name}`}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}

      <FileButton onChange={handleUpload} accept={ACCEPT}>
        {(props) => (
          <Button
            {...props}
            variant="light"
            size="xs"
            leftSection={isUploading ? <Loader size={14} /> : <IconUpload size={14} />}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading…' : 'Upload font'}
          </Button>
        )}
      </FileButton>
    </Stack>
  );
}
