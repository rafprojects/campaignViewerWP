import { Button, Group, Modal, Stack, TextInput, Textarea } from '@mantine/core';
import { useDirtyGuard } from '@wp-super-gallery/shared-utils';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

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

interface MediaEditFormProps {
  editingTitle: string;
  onEditingTitleChange: (value: string) => void;
  editingCaption: string;
  onEditingCaptionChange: (value: string) => void;
  editingThumbnail: string | undefined;
  onEditingThumbnailChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

function MediaEditForm({
  editingTitle,
  onEditingTitleChange,
  editingCaption,
  onEditingCaptionChange,
  editingThumbnail,
  onEditingThumbnailChange,
  onClose,
  onSave,
}: MediaEditFormProps) {
  return (
    <Stack {...getWpsgDebugProps('MediaEditModal', 'stack')} gap="md">
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
      <Group {...getWpsgDebugProps('MediaEditModal', 'actions')} justify="flex-end" wrap="wrap" gap="sm">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave}>Save</Button>
      </Group>
    </Stack>
  );
}

setWpsgDebugDisplayName(MediaEditForm, 'AdminPanel:MediaEditForm');

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
  const { confirmOpen, guardedClose, confirmDiscard, cancelDiscard } = useDirtyGuard({
    current: { editingTitle, editingCaption, editingThumbnail },
    isOpen: opened,
    onClose,
  });

  return (
    <>
      <Modal
        {...getWpsgDebugProps('MediaEditModal')}
        opened={opened}
        onClose={guardedClose}
        title={<span {...getWpsgDebugProps('MediaEditModal', 'title')}>Edit Media</span>}
        padding="md"
        closeButtonProps={getWpsgDebugProps('MediaEditModal', 'close')}
        overlayProps={getWpsgDebugProps('MediaEditModal', 'overlay')}
      >
        <MediaEditForm
          editingTitle={editingTitle}
          onEditingTitleChange={onEditingTitleChange}
          editingCaption={editingCaption}
          onEditingCaptionChange={onEditingCaptionChange}
          editingThumbnail={editingThumbnail}
          onEditingThumbnailChange={onEditingThumbnailChange}
          onClose={guardedClose}
          onSave={onSave}
        />
      </Modal>

      <ConfirmModal
        opened={confirmOpen}
        onClose={cancelDiscard}
        onConfirm={confirmDiscard}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        confirmColor="red"
      />
    </>
  );
}

setWpsgDebugDisplayName(MediaEditModal, 'AdminPanel:MediaEditModal');
