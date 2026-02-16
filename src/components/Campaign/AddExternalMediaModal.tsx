import { Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core';

type MediaType = 'video' | 'image';

interface AddExternalMediaModalProps {
  opened: boolean;
  mediaType: MediaType;
  onMediaTypeChange: (value: MediaType) => void;
  url: string;
  onUrlChange: (value: string) => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  thumbnail: string;
  onThumbnailChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function AddExternalMediaModal({
  opened,
  mediaType,
  onMediaTypeChange,
  url,
  onUrlChange,
  caption,
  onCaptionChange,
  thumbnail,
  onThumbnailChange,
  onClose,
  onConfirm,
}: AddExternalMediaModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add External Media"
      size="md"
      zIndex={300}
      padding="md"
    >
      <Stack gap="md">
        <Select
          label="Media Type"
          data={[
            { value: 'video', label: 'Video' },
            { value: 'image', label: 'Image' },
          ]}
          value={mediaType}
          onChange={(v) => onMediaTypeChange((v as MediaType) ?? 'video')}
        />
        <TextInput
          label="URL"
          placeholder="https://..."
          description="YouTube, Vimeo, or direct media URL"
          value={url}
          onChange={(e) => onUrlChange(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Caption"
          placeholder="Optional caption"
          value={caption}
          onChange={(e) => onCaptionChange(e.currentTarget.value)}
        />
        <TextInput
          label="Thumbnail URL"
          placeholder="Optional thumbnail URL"
          value={thumbnail}
          onChange={(e) => onThumbnailChange(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void onConfirm()} disabled={!url}>
            Add Media
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
