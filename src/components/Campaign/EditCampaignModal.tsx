import { ActionIcon, Badge, Button, Card, Center, FileButton, Group, Image, Loader, Modal, Progress, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Textarea, Tooltip } from '@mantine/core';
import { IconLink, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import type { Campaign, MediaItem } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { MediaLibraryPicker } from './MediaLibraryPicker';

interface EditCampaignModalProps {
  opened: boolean;
  campaign: Campaign | null;
  editMediaTab: string | null;
  onEditMediaTabChange: (value: string | null) => void;
  editTitle: string;
  onEditTitleChange: (value: string) => void;
  editDescription: string;
  onEditDescriptionChange: (value: string) => void;
  editCoverImage: string;
  onEditCoverImageChange: (value: string) => void;
  onUploadCoverImage: (file: File) => void;
  coverImageUploading: boolean;
  onClose: () => void;
  onConfirmEdit: () => void;
  editMediaLoading: boolean;
  editCampaignMedia: MediaItem[];
  onRemoveMedia: (media: MediaItem) => void;
  libraryMedia: MediaItem[];
  libraryLoading: boolean;
  librarySearch: string;
  onLibrarySearchChange: (value: string) => void;
  onLoadLibrary: (search: string) => void;
  onAddFromLibrary: (media: MediaItem) => void;
  uploadFile: File | null;
  uploadProgress: number | null;
  onUploadFile: (file: File) => void;
  addMediaType: 'video' | 'image';
  onAddMediaTypeChange: (value: 'video' | 'image') => void;
  addMediaUrl: string;
  onAddMediaUrlChange: (value: string) => void;
  addMediaCaption: string;
  onAddMediaCaptionChange: (value: string) => void;
  addMediaLoading: boolean;
  onAddExternalMedia: () => void;
}

export function EditCampaignModal({
  opened,
  campaign,
  editMediaTab,
  onEditMediaTabChange,
  editTitle,
  onEditTitleChange,
  editDescription,
  onEditDescriptionChange,
  editCoverImage,
  onEditCoverImageChange,
  onUploadCoverImage,
  coverImageUploading,
  onClose,
  onConfirmEdit,
  editMediaLoading,
  editCampaignMedia,
  onRemoveMedia,
  libraryMedia,
  libraryLoading,
  librarySearch,
  onLibrarySearchChange,
  onLoadLibrary,
  onAddFromLibrary,
  uploadFile,
  uploadProgress,
  onUploadFile,
  addMediaType,
  onAddMediaTypeChange,
  addMediaUrl,
  onAddMediaUrlChange,
  addMediaCaption,
  onAddMediaCaptionChange,
  addMediaLoading,
  onAddExternalMedia,
}: EditCampaignModalProps) {
  const { confirmOpen, guardedClose, confirmDiscard, cancelDiscard } = useDirtyGuard({
    current: { editTitle, editDescription, editCoverImage },
    isOpen: opened,
    onClose,
  });

  return (
    <>
    <Modal
      opened={opened}
      onClose={guardedClose}
      title={`Edit Campaign: ${campaign?.title ?? ''}`}
      size="xl"
      zIndex={300}
    >
      <Tabs value={editMediaTab} onChange={onEditMediaTabChange} aria-label="Edit campaign tabs">
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          <Tabs.Tab value="list">
            Media {editCampaignMedia.length > 0 && <Badge size="sm" ml={4}>{editCampaignMedia.length}</Badge>}
          </Tabs.Tab>
          <Tabs.Tab value="add">Add Media</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Stack gap="md">
            <TextInput
              label="Title"
              placeholder="Campaign title"
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.currentTarget.value)}
            />
            <Textarea
              label="Description"
              placeholder="Campaign description"
              value={editDescription}
              onChange={(e) => onEditDescriptionChange(e.currentTarget.value)}
              minRows={3}
            />

            <Card withBorder>
              <Stack gap="sm">
                <Text fw={500}>Campaign Thumbnail (Card Image)</Text>
                <Image
                  src={editCoverImage || campaign?.thumbnail || FALLBACK_IMAGE_SRC}
                  alt="Campaign thumbnail preview"
                  height={140}
                  fit="cover"
                  fallbackSrc={FALLBACK_IMAGE_SRC}
                />

                <Select
                  label="Use existing campaign media as thumbnail"
                  placeholder="Choose media image/thumbnail"
                  value={editCoverImage || null}
                  data={editCampaignMedia
                    .filter((media) => media.thumbnail || media.url)
                    .map((media) => ({
                      value: media.thumbnail || media.url,
                      label: media.caption || `${media.type.toUpperCase()} #${media.id}`,
                    }))}
                  onChange={(value) => {
                    if (value !== null) {
                      onEditCoverImageChange(value);
                    } else {
                      onEditCoverImageChange('');
                    }
                  }}
                  searchable
                  clearable
                  nothingFoundMessage="No campaign media available"
                />

                <FileButton
                  onChange={(file) => file && void onUploadCoverImage(file)}
                  accept="image/*"
                >
                  {(props) => (
                    <Button {...props} variant="light" loading={coverImageUploading}>
                      Upload Custom Thumbnail
                    </Button>
                  )}
                </FileButton>
              </Stack>
            </Card>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={guardedClose}>
                Cancel
              </Button>
              <Button onClick={() => void onConfirmEdit()}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="list" pt="md">
          {editMediaLoading ? (
            <Center py="xl"><Loader /></Center>
          ) : editCampaignMedia.length === 0 ? (
            <Stack align="center" py="xl">
              <Text c="dimmed">No media attached to this campaign.</Text>
              <Button leftSection={<IconPlus size={16} />} onClick={() => onEditMediaTabChange('add')}>
                Add Media
              </Button>
            </Stack>
          ) : (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                {editCampaignMedia.map((media) => (
                  <Card
                    key={media.id}
                    shadow="sm"
                    padding="xs"
                    radius="md"
                    withBorder
                    role="group"
                    aria-label={`Media item ${media.caption || media.url}`}
                  >
                    <Card.Section>
                      <Image
                        src={media.thumbnail || media.url}
                        height={100}
                        alt={media.caption || 'Media'}
                        fallbackSrc={FALLBACK_IMAGE_SRC}
                      />
                    </Card.Section>
                    <Group justify="space-between" mt="xs">
                      <Badge size="xs" variant="light">
                        {media.type}
                      </Badge>
                      <Tooltip label="Remove from campaign">
                        <ActionIcon
                          color="red"
                          variant="light"
                          size="sm"
                          onClick={() => void onRemoveMedia(media)}
                          aria-label="Remove from campaign"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    {media.caption && (
                      <Text size="xs" c="dimmed" lineClamp={1} mt={4}>
                        {media.caption}
                      </Text>
                    )}
                  </Card>
                ))}
              </SimpleGrid>
              <Group justify="flex-end">
                <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => onEditMediaTabChange('add')}>
                  Add More
                </Button>
              </Group>
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="add" pt="md">
          <Stack gap="lg">
            <MediaLibraryPicker
              libraryMedia={libraryMedia}
              libraryLoading={libraryLoading}
              librarySearch={librarySearch}
              onLibrarySearchChange={onLibrarySearchChange}
              onLoadLibrary={onLoadLibrary}
              onAddFromLibrary={onAddFromLibrary}
              isAlreadyAdded={(item) =>
                editCampaignMedia.some((m) => m.id === item.id || m.url === item.url)
              }
            />

            {/* Upload Section */}
            <Card withBorder>
              <Stack gap="sm">
                <Group>
                  <IconUpload size={20} />
                  <Text fw={500}>Upload New File</Text>
                </Group>
                <FileButton
                  onChange={(file) => file && void onUploadFile(file)}
                  accept="image/*,video/*"
                >
                  {(props) => (
                    <Button {...props} variant="light" fullWidth disabled={!!uploadFile}>
                      {uploadFile ? 'Uploading...' : 'Choose file to upload'}
                    </Button>
                  )}
                </FileButton>
                {uploadProgress !== null && (
                  <Progress value={uploadProgress} size="md" striped animated />
                )}
              </Stack>
            </Card>

            {/* External URL Section */}
            <Card withBorder>
              <Stack gap="sm">
                <Group>
                  <IconLink size={20} />
                  <Text fw={500}>Add External URL</Text>
                </Group>
                <Select
                  label="Type"
                  data={[
                    { value: 'video', label: 'Video' },
                    { value: 'image', label: 'Image' },
                  ]}
                  value={addMediaType}
                  onChange={(v) => onAddMediaTypeChange((v as 'video' | 'image') ?? 'video')}
                />
                <TextInput
                  label="URL"
                  placeholder="https://youtube.com/watch?v=... or image URL"
                  value={addMediaUrl}
                  onChange={(e) => onAddMediaUrlChange(e.currentTarget.value)}
                />
                <TextInput
                  label="Caption (optional)"
                  placeholder="Describe this media"
                  value={addMediaCaption}
                  onChange={(e) => onAddMediaCaptionChange(e.currentTarget.value)}
                />
                <Button
                  onClick={() => void onAddExternalMedia()}
                  disabled={!addMediaUrl}
                  loading={addMediaLoading}
                >
                  Add External Media
                </Button>
              </Stack>
            </Card>

            <Button variant="subtle" onClick={() => onEditMediaTabChange('list')}>
              ← Back to Media List
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
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
