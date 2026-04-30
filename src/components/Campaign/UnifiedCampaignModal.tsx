import { Suspense, lazy, useState } from 'react';
import {
  ActionIcon, Badge, Box, Button, Card, Center, FileButton, Group, Image, Loader,
  Modal, Progress, SimpleGrid, Stack, Tabs, TagsInput, Text, TextInput, Textarea, Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconLink, IconTrash, IconUpload } from '@tabler/icons-react';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { ModalSelect as Select } from '@/components/Common/ModalSelect';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type LayoutTemplate, type MediaItem } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { GalleryConfigEditorLoader } from '@/components/Common/GalleryConfigEditorLoader';
import { MediaLibraryPicker } from '@/components/Campaign/MediaLibraryPicker';
import { getAdapterSelectOptions } from '@/components/Galleries/Adapters/adapterRegistry';
import type { UnifiedCampaignModalHandle } from '@/hooks/useUnifiedCampaignModal';
import { resolveGalleryMode } from '@/utils/resolveAdapterId';
import {
  clearCampaignGalleryOverrides,
  describeCampaignGalleryOverrides,
  getCampaignGalleryOverrideMode,
  hasCampaignGalleryOverrides,
  setCampaignBreakpointScopeAdapterOverride,
  syncCampaignGalleryOverrideMode,
} from '@/utils/campaignGalleryOverrides';

const LazyGalleryConfigEditorModal = lazy(() =>
  import('@/components/Common/GalleryConfigEditorModal').then((module) => ({
    default: module.GalleryConfigEditorModal,
  })),
);

const CAMPAIGN_BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
const BREAKPOINT_LABELS = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
} as const;

/** Convert ISO date string to datetime-local input value. */
function toLocalInputValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const GALLERY_MODE_OPTIONS = [
  { value: 'unified', label: 'Unified' },
  { value: 'per-type', label: 'Per-Type' },
];

function getCampaignBreakpointAdapterId(
  galleryOverrides: UnifiedCampaignModalHandle['formState']['galleryOverrides'],
  breakpoint: typeof CAMPAIGN_BREAKPOINTS[number],
  scope: 'unified' | 'image' | 'video',
): string | null {
  return galleryOverrides?.breakpoints?.[breakpoint]?.[scope]?.adapterId ?? null;
}

interface UnifiedCampaignModalProps {
  modal: UnifiedCampaignModalHandle;
  galleryBehaviorSettings?: GalleryBehaviorSettings;
  /** When 'individual', show per-card border color picker. */
  cardBorderMode?: 'single' | 'auto' | 'individual';
  /** Available layout templates for the template selector. */
  layoutTemplates?: LayoutTemplate[];
  /** Called when user clicks "Edit Layout" for the selected template. */
  onEditLayout?: (templateId: string) => void;
  /** All existing category names for autocomplete. */
  availableCategories?: string[];
}

export function UnifiedCampaignModal({
  modal,
  galleryBehaviorSettings = DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  cardBorderMode,
  layoutTemplates = [],
  onEditLayout,
  availableCategories = [],
}: UnifiedCampaignModalProps) {
  const [galleryConfigEditorOpen, setGalleryConfigEditorOpen] = useState(false);
  const {
    opened, mode, formState, updateForm, isSaving,
    coverImageUploading, handleSelectCoverImage, handleUploadCoverImage,
    activeTab, setActiveTab,
    mediaItems, mediaLoading, handleRemoveMedia, handleAddFromLibrary,
    handleUploadMedia, handleAddExternalMedia,
    uploadFile, uploadProgress,
    addMediaUrl, setAddMediaUrl, addMediaType, setAddMediaType,
    addMediaCaption, setAddMediaCaption, addMediaLoading,
    libraryMedia, libraryLoading, librarySearch, setLibrarySearch, loadLibraryMedia,
    close, save,
  } = modal;

  const { confirmOpen, guardedClose, confirmDiscard, cancelDiscard } = useDirtyGuard({
    current: formState,
    isOpen: opened,
    onClose: close,
  });

  const isExtraSmall = useMediaQuery('(max-width: 575px)');
  const isEdit = mode === 'edit';
  const campaignGalleryOverrideMode = getCampaignGalleryOverrideMode(formState.galleryOverrides);
  const effectiveCampaignGalleryMode = resolveGalleryMode(galleryBehaviorSettings, formState.galleryOverrides);
  const resolvedCampaignQuickOverrides = formState.galleryOverrides;
  const hasCustomGalleryOverrides = hasCampaignGalleryOverrides(formState);
  const galleryOverrideSummary = describeCampaignGalleryOverrides(formState);

  const updateCampaignBreakpointOverride = (
    breakpoint: typeof CAMPAIGN_BREAKPOINTS[number],
    scope: 'unified' | 'image' | 'video',
    adapterId: string,
  ) => {
    const nextGalleryOverrides = setCampaignBreakpointScopeAdapterOverride(
      {
        ...(resolvedCampaignQuickOverrides ?? {}),
        mode: effectiveCampaignGalleryMode,
      },
      breakpoint,
      scope,
      adapterId,
    );

    updateForm({
      ...formState,
      galleryOverrides: nextGalleryOverrides,
    });
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={guardedClose}
        title={isEdit ? 'Edit Campaign' : 'New Campaign'}
        size={isExtraSmall ? '100%' : 'xl'}
        fullScreen={!!isExtraSmall}
        zIndex={300}
      >
        <Tabs value={activeTab} onChange={setActiveTab} aria-label="Campaign modal tabs">
          <Tabs.List>
            <Tabs.Tab value="details">Details</Tabs.Tab>
            {isEdit && (
              <Tabs.Tab value="media">
                Media {mediaItems.length > 0 && <Badge size="sm" ml={4}>{mediaItems.length}</Badge>}
              </Tabs.Tab>
            )}
            <Tabs.Tab value="settings">Settings</Tabs.Tab>
          </Tabs.List>

          {/* ── Details Tab ────────────────────────────────────────── */}
          <Tabs.Panel value="details" pt="md">
            <Stack gap="md">
              <TextInput
                label="Title"
                placeholder="Campaign title"
                value={formState.title}
                onChange={(e) => updateForm({ ...formState, title: e.currentTarget.value })}
                required
              />
              <Textarea
                label="Description"
                placeholder="Campaign description"
                value={formState.description}
                onChange={(e) => updateForm({ ...formState, description: e.currentTarget.value })}
                minRows={3}
              />
              <TextInput
                label="Company Slug"
                placeholder="company-id"
                value={formState.company}
                onChange={(e) => updateForm({ ...formState, company: e.currentTarget.value })}
                required
                description="Unique identifier for the company"
              />

              {/* Thumbnail section */}
              <Card withBorder>
                <Stack gap="sm">
                  <Text fw={500}>Campaign Thumbnail (Card Image)</Text>
                  <Image
                    src={formState.coverImage || FALLBACK_IMAGE_SRC}
                    alt="Campaign thumbnail preview"
                    height={140}
                    fit="cover"
                    fallbackSrc={FALLBACK_IMAGE_SRC}
                  />
                  {isEdit && mediaItems.length > 0 && (
                    <Select
                      label="Use existing campaign media as thumbnail"
                      placeholder="Choose media image/thumbnail"
                      value={formState.coverImage || null}
                      data={mediaItems
                        .filter((media) => media.thumbnail || media.url)
                        .map((media) => ({
                          value: media.thumbnail || media.url,
                          label: media.caption || `${media.type.toUpperCase()} #${media.id}`,
                        }))}
                      onChange={(value) => handleSelectCoverImage(value ?? '')}
                      searchable
                      clearable
                      nothingFoundMessage="No campaign media available"
                    />
                  )}
                  {isEdit && (
                    <FileButton
                      onChange={(file) => file && void handleUploadCoverImage(file)}
                      accept="image/*"
                    >
                      {(props) => (
                        <Button {...props} variant="light" loading={coverImageUploading}>
                          Upload Custom Thumbnail
                        </Button>
                      )}
                    </FileButton>
                  )}
                </Stack>
              </Card>

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={guardedClose}>Cancel</Button>
                <Button onClick={() => void save()} loading={isSaving}>
                  {isEdit ? 'Save Changes' : 'Create Campaign'}
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          {/* ── Media Tab (edit only) ──────────────────────────────── */}
          {isEdit && (
            <Tabs.Panel value="media" pt="md">
              {mediaLoading ? (
                <Center py="xl"><Loader /></Center>
              ) : (
                <MediaTabContent
                  mediaItems={mediaItems}
                  onRemoveMedia={handleRemoveMedia}
                  libraryMedia={libraryMedia}
                  libraryLoading={libraryLoading}
                  librarySearch={librarySearch}
                  onLibrarySearchChange={setLibrarySearch}
                  onLoadLibrary={loadLibraryMedia}
                  onAddFromLibrary={handleAddFromLibrary}
                  uploadFile={uploadFile}
                  uploadProgress={uploadProgress}
                  onUploadFile={handleUploadMedia}
                  addMediaType={addMediaType}
                  onAddMediaTypeChange={setAddMediaType}
                  addMediaUrl={addMediaUrl}
                  onAddMediaUrlChange={setAddMediaUrl}
                  addMediaCaption={addMediaCaption}
                  onAddMediaCaptionChange={setAddMediaCaption}
                  addMediaLoading={addMediaLoading}
                  onAddExternalMedia={handleAddExternalMedia}
                />
              )}
            </Tabs.Panel>
          )}

          {/* ── Settings Tab ──────────────────────────────────────── */}
          <Tabs.Panel value="settings" pt="md">
            <Stack gap="md">
              <Group grow wrap="wrap" gap="sm">
                <Select
                  label="Status"
                  data={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'active', label: 'Active' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                  value={formState.status}
                  onChange={(v) => updateForm({ ...formState, status: (v ?? 'draft') as 'draft' | 'active' | 'archived' })}
                />
                <Select
                  label="Visibility"
                  data={[
                    { value: 'private', label: 'Private' },
                    { value: 'public', label: 'Public' },
                  ]}
                  value={formState.visibility}
                  onChange={(v) => updateForm({ ...formState, visibility: (v ?? 'private') as 'public' | 'private' })}
                />
              </Group>
              <TextInput
                label="Tags"
                placeholder="tag1, tag2, tag3"
                description="Comma separated list of tags"
                value={formState.tags}
                onChange={(e) => updateForm({ ...formState, tags: e.currentTarget.value })}
              />
              <TagsInput
                label="Categories"
                placeholder="Type and press Enter or comma to add"
                description="Assign this campaign to one or more categories"
                value={formState.categories}
                onChange={(v) => updateForm({ ...formState, categories: v })}
                data={availableCategories}
                clearable
                splitChars={[',']}
              />
              <Group grow wrap="wrap" gap="sm">
                <TextInput
                  type="datetime-local"
                  label="Publish At"
                  description="Campaign becomes visible at this date/time"
                  value={formState.publishAt ? toLocalInputValue(formState.publishAt) : ''}
                  onChange={(e) => updateForm({ ...formState, publishAt: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : '' })}
                />
                <TextInput
                  type="datetime-local"
                  label="Unpublish At"
                  description="Campaign is hidden after this date/time"
                  value={formState.unpublishAt ? toLocalInputValue(formState.unpublishAt) : ''}
                  onChange={(e) => updateForm({ ...formState, unpublishAt: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : '' })}
                />
              </Group>
              {isEdit && cardBorderMode === 'individual' && (
                <ColorInput
                  label="Card Border Color"
                  description="Custom accent border color for this campaign card"
                  value={formState.borderColor ?? ''}
                  onChange={(v) => updateForm({ ...formState, borderColor: v || undefined })}
                  placeholder="Auto (company brand color)"
                />
              )}
              {isEdit && (
                <>
                  <Stack gap="sm">
                    <Select
                      label="Gallery Mode Override"
                      description="Override the global gallery mode for this campaign"
                      placeholder="Default (from settings)"
                      clearable
                      data={GALLERY_MODE_OPTIONS}
                      value={campaignGalleryOverrideMode || null}
                      onChange={(v) => updateForm({
                        ...formState,
                        galleryOverrides: syncCampaignGalleryOverrideMode(
                          formState.galleryOverrides,
                          (v as 'unified' | 'per-type' | null) ?? '',
                        ),
                      })}
                    />
                    {effectiveCampaignGalleryMode === 'unified' ? (
                      <Box>
                        <Text size="sm" fw={500} mb={4}>Unified Breakpoint Adapters</Text>
                        <Text size="xs" c="dimmed" mb={8}>
                          Clear a cell to inherit the global unified adapter for that breakpoint.
                        </Text>
                        <SimpleGrid cols={2} spacing="xs" mb={4}>
                          <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
                          <Text size="xs" fw={600} ta="center">Unified</Text>
                        </SimpleGrid>
                        {CAMPAIGN_BREAKPOINTS.map((breakpoint) => (
                          <SimpleGrid cols={2} spacing="xs" mb="xs" key={breakpoint}>
                            <Text size="sm" fw={500} style={{ display: 'flex', alignItems: 'center' }}>
                              {BREAKPOINT_LABELS[breakpoint]}
                            </Text>
                            <Select
                              size="xs"
                              aria-label={`${BREAKPOINT_LABELS[breakpoint]} Unified Gallery Adapter`}
                              placeholder="Inherited"
                              clearable
                              data={getAdapterSelectOptions({ context: 'unified-gallery', breakpoint })}
                              value={getCampaignBreakpointAdapterId(resolvedCampaignQuickOverrides, breakpoint, 'unified')}
                              onChange={(value) => updateCampaignBreakpointOverride(breakpoint, 'unified', value ?? '')}
                            />
                          </SimpleGrid>
                        ))}
                      </Box>
                    ) : (
                      <Box>
                        <Text size="sm" fw={500} mb={4}>Per-Type Breakpoint Adapters</Text>
                        <Text size="xs" c="dimmed" mb={8}>
                          Clear any cell to inherit that breakpoint's global adapter selection.
                        </Text>
                        <SimpleGrid cols={3} spacing="xs" mb={4}>
                          <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
                          <Text size="xs" fw={600} ta="center">Image</Text>
                          <Text size="xs" fw={600} ta="center">Video</Text>
                        </SimpleGrid>
                        {CAMPAIGN_BREAKPOINTS.map((breakpoint) => (
                          <SimpleGrid cols={3} spacing="xs" mb="xs" key={breakpoint}>
                            <Text size="sm" fw={500} style={{ display: 'flex', alignItems: 'center' }}>
                              {BREAKPOINT_LABELS[breakpoint]}
                            </Text>
                            <Select
                              size="xs"
                              aria-label={`${BREAKPOINT_LABELS[breakpoint]} Image Gallery Adapter`}
                              placeholder="Inherited"
                              clearable
                              data={getAdapterSelectOptions({ context: 'campaign-override', breakpoint })}
                              value={getCampaignBreakpointAdapterId(resolvedCampaignQuickOverrides, breakpoint, 'image')}
                              onChange={(value) => updateCampaignBreakpointOverride(breakpoint, 'image', value ?? '')}
                            />
                            <Select
                              size="xs"
                              aria-label={`${BREAKPOINT_LABELS[breakpoint]} Video Gallery Adapter`}
                              placeholder="Inherited"
                              clearable
                              data={getAdapterSelectOptions({ context: 'campaign-override', breakpoint })}
                              value={getCampaignBreakpointAdapterId(resolvedCampaignQuickOverrides, breakpoint, 'video')}
                              onChange={(value) => updateCampaignBreakpointOverride(breakpoint, 'video', value ?? '')}
                            />
                          </SimpleGrid>
                        ))}
                      </Box>
                    )}
                  </Stack>
                  <Group justify="space-between" align="flex-start" gap="md">
                    <Text size="sm" c="dimmed" maw={560}>
                      Quick per-breakpoint overrides stay inline here. Use the shared responsive editor for mode changes, shared responsive settings, and adapter-specific fields.
                    </Text>
                    <Button variant="light" onClick={() => setGalleryConfigEditorOpen(true)}>
                      Edit Responsive Config
                    </Button>
                  </Group>
                  <Stack gap={6}>
                    <Group gap="xs" wrap="wrap">
                      <Badge color={hasCustomGalleryOverrides ? 'grape' : 'gray'} variant={hasCustomGalleryOverrides ? 'light' : 'outline'}>
                        {hasCustomGalleryOverrides ? 'Custom gallery overrides' : 'Inheriting global gallery settings'}
                      </Badge>
                      {galleryOverrideSummary.map((summary) => (
                        <Badge key={summary} color="violet" variant="light">
                          {summary}
                        </Badge>
                      ))}
                    </Group>
                    {hasCustomGalleryOverrides && (
                      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                        <Text size="xs" c="dimmed">
                          Clear the campaign-specific gallery override state here to fall back to the global gallery configuration.
                        </Text>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="xs"
                          onClick={() => updateForm({
                            ...formState,
                            ...clearCampaignGalleryOverrides(),
                          })}
                        >
                          Use Inherited Gallery Settings
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </>
              )}
              {layoutTemplates.length > 0 && (
                <Group grow wrap="wrap" gap="sm" align="flex-end">
                  <Select
                    label="Layout Template"
                    description="Assign a layout template to use the Layout Builder adapter"
                    placeholder="None (use default adapter)"
                    clearable
                    data={layoutTemplates.map((lt) => ({
                      value: lt.id,
                      label: `${lt.name} (${lt.slots.length} slots)`,
                    }))}
                    value={formState.layoutTemplateId || null}
                    onChange={(v) => updateForm({ ...formState, layoutTemplateId: v ?? '' })}
                  />
                  {formState.layoutTemplateId && onEditLayout && (
                    <Button
                      variant="light"
                      size="sm"
                      onClick={() => onEditLayout(formState.layoutTemplateId)}
                      style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}
                    >
                      Edit Layout
                    </Button>
                  )}
                </Group>
              )}

              <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
                <Button variant="default" onClick={guardedClose}>Cancel</Button>
                <Button onClick={() => void save()} loading={isSaving}>
                  {isEdit ? 'Save Changes' : 'Create Campaign'}
                </Button>
              </Group>
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

      {galleryConfigEditorOpen && (
        <Suspense fallback={<GalleryConfigEditorLoader />}>
          <LazyGalleryConfigEditorModal
            opened={galleryConfigEditorOpen}
            onClose={() => setGalleryConfigEditorOpen(false)}
            title="Campaign Responsive Gallery Config"
            value={formState.galleryOverrides}
            contextSummary={hasCampaignGalleryOverrides(formState)
              ? 'This campaign currently stores custom gallery overrides. Use Clear Campaign Overrides to return to inherited global gallery settings.'
              : 'This campaign is currently inheriting global gallery settings. Any changes saved here will create campaign-specific overrides.'}
            onClear={() => {
              updateForm({
                ...formState,
                ...clearCampaignGalleryOverrides(),
              });
              setGalleryConfigEditorOpen(false);
            }}
            onSave={(galleryOverrides) => {
              updateForm({
                ...formState,
                galleryOverrides,
              });
              setGalleryConfigEditorOpen(false);
            }}
            saveLabel="Apply Campaign Gallery Config"
            clearLabel="Clear Campaign Overrides"
            unifiedAdapterDescription="Adapter applied when this campaign renders images and videos together."
            zIndex={500}
          />
        </Suspense>
      )}
    </>
  );
}

/* ── Media Tab inner content (split out for readability) ──────── */

interface MediaTabContentProps {
  mediaItems: MediaItem[];
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

function MediaTabContent({
  mediaItems,
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
}: MediaTabContentProps) {
  return (
    <Stack gap="lg">
      {/* Media grid */}
      {mediaItems.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No media attached to this campaign.</Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
          {mediaItems.map((media) => (
            <Card key={media.id} shadow="sm" padding="xs" radius="md" withBorder role="group" aria-label={`Media item ${media.caption || media.url}`}>
              <Card.Section>
                <Image src={media.thumbnail || media.url} height={100} alt={media.caption || 'Media'} fallbackSrc={FALLBACK_IMAGE_SRC} />
              </Card.Section>
              <Group justify="space-between" mt="xs">
                <Badge size="xs" variant="light">{media.type}</Badge>
                <Tooltip label="Remove from campaign">
                  <ActionIcon color="red" variant="light" size="sm" onClick={() => void onRemoveMedia(media)} aria-label="Remove from campaign">
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              {media.caption && <Text size="xs" c="dimmed" lineClamp={1} mt={4}>{media.caption}</Text>}
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Library picker */}
      <MediaLibraryPicker
        libraryMedia={libraryMedia}
        libraryLoading={libraryLoading}
        librarySearch={librarySearch}
        onLibrarySearchChange={onLibrarySearchChange}
        onLoadLibrary={onLoadLibrary}
        onAddFromLibrary={onAddFromLibrary}
        isAlreadyAdded={(item) => mediaItems.some((m) => m.id === item.id || m.url === item.url)}
      />

      {/* Upload section */}
      <Card withBorder>
        <Stack gap="sm">
          <Group><IconUpload size={20} /><Text fw={500}>Upload New File</Text></Group>
          <FileButton onChange={(file) => file && void onUploadFile(file)} accept="image/*,video/*">
            {(props) => (
              <Button {...props} variant="light" fullWidth disabled={!!uploadFile}>
                {uploadFile ? 'Uploading...' : 'Choose file to upload'}
              </Button>
            )}
          </FileButton>
          {uploadProgress !== null && <Progress value={uploadProgress} size="md" striped animated />}
        </Stack>
      </Card>

      {/* External URL section */}
      <Card withBorder>
        <Stack gap="sm">
          <Group><IconLink size={20} /><Text fw={500}>Add External URL</Text></Group>
          <Select
            label="Type"
            data={[{ value: 'video', label: 'Video' }, { value: 'image', label: 'Image' }]}
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
          <Button onClick={() => void onAddExternalMedia()} disabled={!addMediaUrl} loading={addMediaLoading}>
            Add External Media
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
