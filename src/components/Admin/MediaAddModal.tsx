import type { RefObject } from 'react';
import DOMPurify from 'dompurify';
import {
  Button,
  Card,
  FileButton,
  Group,
  Image,
  Modal,
  Paper,
  Progress,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
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
  previewUrl: string | null;
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
  previewUrl,
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

  return (
    <Modal opened={opened} onClose={onClose} title={title} padding="md" {...(zIndex !== undefined ? { zIndex } : {})} withinPortal={false}>
      <Stack gap="md">
        <Paper ref={dropRef} p="md" withBorder style={{ cursor: 'pointer' }}>
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap" gap="sm">
              <Group>
                <FileButton
                  onChange={(value) => {
                    if (!value) {
                      onSelectFiles([]);
                      return;
                    }
                    onSelectFiles(Array.isArray(value) ? value : [value]);
                  }}
                  accept="image/*,video/*"
                  multiple
                >
                  {(props) => <Button leftSection={<IconUpload />} {...props}>Choose files</Button>}
                </FileButton>
                <Text size="sm" c="dimmed">or drag & drop files here</Text>
              </Group>
              {hasFiles && (
                <Text size="sm" c="dimmed">
                  {isBatchSelection ? `${selectedFiles.length} files selected` : selectedFiles[0]?.name}
                </Text>
              )}
            </Group>

            {previewUrl && selectedFiles.length === 1 && selectedFiles[0]?.type.startsWith('image') && (
              <Image src={previewUrl} alt="Upload preview" mah={140} fit="contain" radius="sm" />
            )}

            {hasFiles && (
              <Stack gap="xs">
                {selectedFiles.map((file, index) => {
                  const progress = uploadProgresses?.[index] ?? null;
                  const error = uploadErrors[index] ?? null;
                  const identity = `${file.name}-${file.size}-${file.lastModified}`;

                  return (
                    <Stack key={identity} gap={4}>
                      <Group justify="space-between" wrap="nowrap" gap="sm">
                        <Text size="sm" lineClamp={1}>{file.name}</Text>
                        <Text size="xs" c={error ? 'red' : 'dimmed'}>
                          {error ?? (progress !== null ? `${progress}%` : '')}
                        </Text>
                      </Group>
                      {progress !== null && (
                        <Progress value={progress} size="sm" striped animated={uploading && progress < 100} color={error ? 'red' : 'blue'} />
                      )}
                    </Stack>
                  );
                })}
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