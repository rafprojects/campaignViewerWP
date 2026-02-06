import { Button, Group, Modal, Stack, TextInput, Textarea } from '@mantine/core';

interface MediaEditModalProps {
  opened: boolean;
  onClose: () => void;
  editingTitle: string;
  onEditingTitleChange: (value: string) => void;
  editingCaption: string;
  onEditingCaptionChange: (value: string) => void;
  editingThumbnail: string | undefined;
  onEditingThumbnailChange: (value: string) => void;
  onSave: () => void;
}

export function MediaEditModal({
  opened,
  onClose,
  editingTitle,
  onEditingTitleChange,
  editingCaption,
  onEditingCaptionChange,
  editingThumbnail,
  onEditingThumbnailChange,
  onSave,
}: MediaEditModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Edit Media" padding="md">
      <Stack gap="md">
        <TextInput
          label="Title"
          placeholder="Enter a title (optional)"
          value={editingTitle}
          onChange={(e) => onEditingTitleChange(e.currentTarget.value)}
          description="Optional display title for this media item"
        />
        <Textarea
          label="Caption"
          placeholder="Enter a caption or description"
          value={editingCaption}
          onChange={(e) => onEditingCaptionChange(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
          description="Descriptive text shown with the media"
        />
        <TextInput
          label="Thumbnail URL"
          placeholder="https://..."
          value={editingThumbnail ?? ''}
          onChange={(e) => onEditingThumbnailChange(e.currentTarget.value)}
          description="Custom preview image URL (optional)"
        />
        <Group justify="flex-end" wrap="wrap" gap="sm">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
