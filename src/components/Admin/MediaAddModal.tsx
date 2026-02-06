import type { RefObject } from 'react';
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

type ExternalPreview = {
  html?: string;
  thumbnail_url?: string;
  title?: string;
  provider_name?: string;
} & Record<string, unknown>;

interface MediaAddModalProps {
  opened: boolean;
  onClose: () => void;
  dropRef: RefObject<HTMLDivElement>;
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  previewUrl: string | null;
  uploadTitle: string;
  onUploadTitleChange: (value: string) => void;
  uploadCaption: string;
  onUploadCaptionChange: (value: string) => void;
  uploadProgress: number | null;
  uploading: boolean;
  onUpload: () => void;
  externalUrl: string;
  onExternalUrlChange: (value: string) => void;
  externalError: string | null;
  onFetchOEmbed: () => void;
  externalLoading: boolean;
  onAddExternal: () => void;
  externalPreview: ExternalPreview | null;
}

export function MediaAddModal({
  opened,
  onClose,
  dropRef,
  selectedFile,
  onSelectFile,
  previewUrl,
  uploadTitle,
  onUploadTitleChange,
  uploadCaption,
  onUploadCaptionChange,
  uploadProgress,
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
  return (
    <Modal opened={opened} onClose={onClose} title="Add Media" padding="md">
      <Stack gap="sm">
        <Paper ref={dropRef} p="md" withBorder style={{ cursor: 'pointer' }}>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group>
              <FileButton onChange={onSelectFile} accept="image/*,video/*">
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

          {uploadProgress !== null && <Progress value={uploadProgress} mt="sm" />}
          <Group mt="sm">
            <Button onClick={onUpload} loading={uploading} disabled={!selectedFile}>Upload</Button>
          </Group>
        </Paper>

        <Text fw={600}>Or add external URL</Text>
        <Group wrap="wrap" gap="sm">
          <TextInput
            label="External URL"
            value={externalUrl}
            onChange={(e) => onExternalUrlChange(e.currentTarget.value)}
            placeholder="https://youtube.com/..."
            error={externalError}
            aria-label="External media URL"
          />
          <Button onClick={onFetchOEmbed} loading={externalLoading} aria-label="Preview external media">
            Preview
          </Button>
          <Button onClick={onAddExternal} disabled={!externalUrl} aria-label="Add external media">
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
  );
}
