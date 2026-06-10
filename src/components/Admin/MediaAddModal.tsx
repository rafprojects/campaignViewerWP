import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';
import DOMPurify from 'dompurify';
import {
  ActionIcon,
  Button,
  Card,
  FileButton,
  Group,
  Modal,
  Paper,
  Progress,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconUpload, IconX, IconFile, IconVideo } from '@tabler/icons-react';
import type { OEmbedResponse } from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface MediaAddModalProps {
  opened: boolean;
  onClose: () => void;
  title?: string;
  zIndex?: number;
  dropRef: RefObject<HTMLDivElement | null>;
  selectedFiles: File[];
  onSelectFiles: (files: File[]) => void;
  onRemoveFile?: (index: number) => void;
  onClearFiles?: () => void;
  uploadTitle: string;
  onUploadTitleChange: (value: string) => void;
  uploadCaption: string;
  onUploadCaptionChange: (value: string) => void;
  uploadProgresses: number[] | null;
  uploadErrors?: Array<string | null>;
  uploading: boolean;
  onUpload: () => void;
  externalUrl: string;
  onExternalUrlChange: (value: string) => void;
  externalError: string | null;
  onFetchOEmbed: () => void;
  externalLoading: boolean;
  onAddExternal: () => void;
  externalPreview: OEmbedResponse | null;
}

export function MediaAddModal({
  opened,
  onClose,
  title = 'Add Media',
  zIndex,
  dropRef,
  selectedFiles,
  onSelectFiles,
  onRemoveFile,
  onClearFiles,
  uploadTitle,
  onUploadTitleChange,
  uploadCaption,
  onUploadCaptionChange,
  uploadProgresses,
  uploadErrors = [],
  uploading,
  onUpload,
  externalUrl,
  onExternalUrlChange,
  externalError,
  onFetchOEmbed,
  externalLoading,
  onAddExternal,
  externalPreview,
}: MediaAddModalProps) {
  const hasFiles = selectedFiles.length > 0;
  const isBatchSelection = selectedFiles.length > 1;

  const [isDragOver, setIsDragOver] = useState(false);
  const enterCountRef = useRef(0);

  // Per-file object URLs for thumbnail previews. Created/revoked as selectedFiles changes.
  const [thumbUrls, setThumbUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const urls = new Map<string, string>();
    for (const file of selectedFiles) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      urls.set(key, URL.createObjectURL(file));
    }
    setThumbUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const handleDragEnter = useCallback(() => {
    enterCountRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    enterCountRef.current = Math.max(0, enterCountRef.current - 1);
    if (enterCountRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    enterCountRef.current = 0;
    setIsDragOver(false);
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) onSelectFiles(files);
  }, [onSelectFiles]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      padding="md"
      size={hasFiles ? 'lg' : 'md'}
      {...(zIndex !== undefined ? { zIndex } : {})}
      withinPortal={false}
    >
      <Stack gap="md">
        <Paper
          ref={dropRef}
          p="md"
          withBorder
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, background-color 0.15s ease',
            ...(isDragOver && {
              borderColor: 'var(--mantine-color-blue-5)',
              backgroundColor: 'var(--mantine-color-blue-light)',
            }),
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap" gap="sm">
              <Group>
                <FileButton
                  onChange={(value) => {
                    if (!value) return;
                    onSelectFiles(Array.isArray(value) ? value : [value]);
                  }}
                  accept="image/*,video/*"
                  multiple
                >
                  {(props) => <Button leftSection={<IconUpload />} {...props}>Choose files</Button>}
                </FileButton>
                <Text size="sm" c={isDragOver ? 'blue' : 'dimmed'} fw={isDragOver ? 600 : undefined}>
                  {isDragOver ? 'Drop files here' : 'or drag & drop files here'}
                </Text>
              </Group>
              {hasFiles && (
                <Text size="sm" c="dimmed">
                  {isBatchSelection ? `${selectedFiles.length} files queued` : selectedFiles[0]?.name}
                </Text>
              )}
            </Group>

            {hasFiles && (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} queued
                  </Text>
                  {onClearFiles && (
                    <Button variant="subtle" color="red" size="xs" onClick={onClearFiles}>
                      Clear all
                    </Button>
                  )}
                </Group>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedFiles.map((file, index) => {
                    const key = `${file.name}-${file.size}-${file.lastModified}`;
                    const url = thumbUrls.get(key);
                    const isImage = file.type.startsWith('image/');
                    const isVideo = file.type.startsWith('video/');
                    const progress = uploadProgresses?.[index] ?? null;
                    const error = uploadErrors[index] ?? null;

                    return (
                      <div key={key} style={{ position: 'relative', width: 80 }}>
                        <div style={{
                          width: 80,
                          height: 80,
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: `1px solid ${error ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-default-border)'}`,
                          background: 'var(--mantine-color-default)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {isImage && url ? (
                            <img src={url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : isVideo ? (
                            <IconVideo size={32} color="var(--mantine-color-dimmed)" />
                          ) : (
                            <IconFile size={32} color="var(--mantine-color-dimmed)" />
                          )}
                        </div>
                        {onRemoveFile && (
                          <ActionIcon
                            size="xs"
                            variant="filled"
                            color="red"
                            style={{ position: 'absolute', top: 2, right: 2 }}
                            onClick={() => onRemoveFile(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            <IconX size={10} />
                          </ActionIcon>
                        )}
                        <Text size="xs" lineClamp={1} title={file.name} mt={2}>{file.name}</Text>
                        {error && <Text size="xs" c="red" lineClamp={2}>{error}</Text>}
                        {progress !== null && (
                          <Progress value={progress} size="xs" color={error ? 'red' : 'blue'} mt={2} striped animated={uploading && progress < 100} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Stack>
            )}

            {selectedFiles.length === 1 && (
              <Stack gap="xs">
                <TextInput
                  label="Title"
                  placeholder="Enter a title (optional)"
                  value={uploadTitle}
                  onChange={(e) => onUploadTitleChange(e.currentTarget.value)}
                />
                <Textarea
                  label="Caption"
                  placeholder="Enter a caption or description (optional)"
                  value={uploadCaption}
                  onChange={(e) => onUploadCaptionChange(e.currentTarget.value)}
                  autosize
                  minRows={2}
                  maxRows={4}
                />
              </Stack>
            )}

            {isBatchSelection && (
              <Text size="xs" c="dimmed">
                When uploading multiple files, each item uses its filename as the default caption.
              </Text>
            )}
            <Group justify="flex-end">
              <Button
                onClick={onUpload}
                loading={uploading}
                disabled={!hasFiles}
                variant="filled"
                color="blue"
                leftSection={<IconUpload size={16} />}
              >
                {isBatchSelection ? `Upload ${selectedFiles.length} files` : 'Upload'}
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Text fw={600}>Add External URL</Text>
        <Stack gap="sm">
          <TextInput
            label="External URL"
            value={externalUrl}
            onChange={(e) => onExternalUrlChange(e.currentTarget.value)}
            placeholder="https://youtube.com/..."
            error={externalError}
            aria-label="External media URL"
          />
          <Group gap="sm">
            <Button onClick={onFetchOEmbed} loading={externalLoading} aria-label="Preview external media">
              Preview
            </Button>
            <Button onClick={onAddExternal} disabled={!externalUrl} aria-label="Add external media">
              Add
            </Button>
          </Group>
        </Stack>

        {externalPreview && (
          <Card mt="sm">
            <Stack>
              {externalPreview.html ? (
                <div
                  style={{ position: 'relative', paddingTop: '56.25%' }}
                >
                  <div
                    style={{ position: 'absolute', inset: 0 }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(externalPreview.html, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder'], ALLOWED_URI_REGEXP: /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|vimeo\.com|rumble\.com|dailymotion\.com|fast\.wistia\.(com|net))\// }) }}
                  />
                </div>
              ) : (
                <Group>
                  {externalPreview.thumbnail_url && (
                    <img
                      src={externalPreview.thumbnail_url}
                      style={{ height: 100, objectFit: 'cover', borderRadius: 4 }}
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

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

setWpsgDebugDisplayName(MediaAddModal, 'AdminPanel:MediaAddModal');
