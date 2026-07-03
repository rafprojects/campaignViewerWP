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
import { IconTrash, IconUpload, IconWorld, IconWorldOff } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';
import { type FontLibraryEntry, loadCustomFonts } from '@wp-super-gallery/shared-utils';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

const ACCEPT = '.woff2,.woff,.ttf,.otf';

interface Props {
  apiClient: ApiClient;
  /** Called whenever the font list changes so parent can pass to TypographyEditors. */
  onFontsChange?: (fonts: FontLibraryEntry[]) => void;
  /**
   * P53-A: deleting a font is system-admin only (`fonts.delete` =
   * require_system_admin). Editors can still upload + toggle universal.
   */
  isSystemAdmin?: boolean;
}

export function FontLibraryManager({ apiClient, onFontsChange, isSystemAdmin = false }: Props) {
  const { t } = useTranslation('wpsg');
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

  const handleToggleUniversal = useCallback(async (id: string, universal: boolean) => {
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/admin/font-library/${id}`, {
        is_universal: universal,
      });
      await fetchFonts();
    } catch {
      // Toggle failed
    }
  }, [apiClient, fetchFonts]);

  if (isLoading) {
    return <Loader size="sm" />;
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{t('admin_font_title', 'Custom Fonts')}</Text>
      <Text size="xs" c="dimmed">
        {t('admin_font_desc', 'Upload .woff2, .woff, .ttf, or .otf font files. Uploaded fonts appear in the font picker for all typography editors.')}
      </Text>

      {fonts.length > 0 && (
        <Stack gap={4}>
          {fonts.map((f) => (
            <Group key={f.id} justify="space-between" wrap="nowrap" gap="xs">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                <Text size="xs" truncate style={{ maxWidth: 150 }}>{f.name}</Text>
                <Badge size="xs" variant="light" color="gray">{f.format}</Badge>
                {f.isUniversal && (
                  <Badge size="xs" variant="light" color="blue">{t('admin_font_all_spaces', 'All spaces')}</Badge>
                )}
              </Group>
              <Group gap={2} wrap="nowrap">
                <ActionIcon
                  variant="subtle"
                  color={f.isUniversal ? 'blue' : 'gray'}
                  size="sm"
                  onClick={() => handleToggleUniversal(f.id, !f.isUniversal)}
                  title={f.isUniversal ? t('admin_font_make_specific', 'Make {{name}} space-specific', { name: f.name }) : t('admin_font_make_universal', 'Make {{name}} available to all spaces', { name: f.name })}
                  aria-label={f.isUniversal ? t('admin_font_make_specific', 'Make {{name}} space-specific', { name: f.name }) : t('admin_font_make_universal', 'Make {{name}} available to all spaces', { name: f.name })}
                >
                  {f.isUniversal ? <IconWorld size={14} /> : <IconWorldOff size={14} />}
                </ActionIcon>
                {isSystemAdmin && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleDelete(f.id)}
                    title={t('admin_font_delete', 'Delete {{name}}', { name: f.name })}
                    aria-label={t('admin_font_delete', 'Delete {{name}}', { name: f.name })}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
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
            {isUploading ? t('admin_font_uploading', 'Uploading…') : t('admin_font_upload', 'Upload font')}
          </Button>
        )}
      </FileButton>
    </Stack>
  );
}

setWpsgDebugDisplayName(FontLibraryManager, 'AdminPanel:FontLibraryManager');