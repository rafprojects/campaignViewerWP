import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  ActionIcon, Badge, Box, Button, Card, Center, FileButton, Group, Image, Loader,
  Modal, MultiSelect, Progress, SimpleGrid, Stack, Tabs, TagsInput, Text, TextInput, Textarea, Tooltip,
} from '@mantine/core';
import type { CampaignCategoryEntry } from '@/services/apiClient';
import type { TagEntry } from '@/services/api/campaignsApi';
import type { CompanyInfo } from '@/services/adminQuery';
import { CompanyCombobox } from '@/components/Common/CompanyCombobox';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { IconLink, IconTrash, IconUpload } from '@tabler/icons-react';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { ModalSelect as Select } from '@/components/Common/ModalSelect';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type LayoutTemplate, type MediaItem } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { useDirtyGuard } from '@wp-super-gallery/shared-utils';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { GalleryConfigEditorLoader } from '@/components/Common/GalleryConfigEditorLoader';
import { MediaLibraryPicker } from '@/components/Campaign/MediaLibraryPicker';
import { getAdapterSelectOptions } from '@/components/Galleries/Adapters/adapterRegistry';
import type { UnifiedCampaignModalHandle } from '@/hooks/useUnifiedCampaignModal';
import { useCampaignContext } from '@/contexts/CampaignContext';
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

function getCampaignBreakpointAdapterId(
  galleryOverrides: UnifiedCampaignModalHandle['formState']['galleryOverrides'],
  breakpoint: typeof CAMPAIGN_BREAKPOINTS[number],
  scope: 'unified' | 'image' | 'video',
): string | null {
  return galleryOverrides?.breakpoints?.[breakpoint]?.[scope]?.adapterId ?? null;
}

/**
 * B-6: true when any configured campaign adapter (across breakpoints/scopes) is
 * the Layout Builder. Used to contextually surface the layout-template picker.
 */
function campaignUsesLayoutBuilder(
  galleryOverrides: UnifiedCampaignModalHandle['formState']['galleryOverrides'],
): boolean {
  const breakpoints = galleryOverrides?.breakpoints;
  if (!breakpoints) return false;
  for (const scopeConfig of Object.values(breakpoints)) {
    if (!scopeConfig) continue;
    for (const scope of Object.values(scopeConfig)) {
      if (scope?.adapterId === 'layout-builder') return true;
    }
  }
  return false;
}

function buildCategorySelectData(items: CampaignCategoryEntry[]): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = [];
  const byParent = new Map<number, CampaignCategoryEntry[]>();
  for (const c of items) {
    const pid = c.parent_id ?? 0;
    if (pid !== 0) {
      const list = byParent.get(pid) ?? [];
      list.push(c);
      byParent.set(pid, list);
    }
  }
  const roots = items.filter((c) => (c.parent_id ?? 0) === 0);

  function addLevel(cats: CampaignCategoryEntry[], depth: number) {
    if (depth >= 3) return;
    for (const cat of cats) {
      const prefix = depth === 0 ? '' : '  '.repeat(depth) + '↳ ';
      result.push({ value: cat.id, label: `${prefix}${cat.name}` });
      addLevel(byParent.get(parseInt(cat.id, 10)) ?? [], depth + 1);
    }
  }
  addLevel(roots, 0);
  return result;
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
  /** All existing categories for the hierarchical picker. */
  categoryItems?: CampaignCategoryEntry[];
  /** All existing tags for the tag input autocomplete. */
  tagItems?: TagEntry[];
}

type NamedComponent<Props = Record<string, never>> = ((props: Props) => ReactElement) & {
  displayName?: string;
};

type UnifiedCampaignFormState = UnifiedCampaignModalHandle['formState'];
type UnifiedCampaignGalleryOverrides = UnifiedCampaignFormState['galleryOverrides'];
type UnifiedCampaignUpdateForm = (next: UnifiedCampaignFormState) => void;

interface UnifiedCampaignModalTabListProps {
  isEdit: boolean;
  mediaCount: number;
}

const UnifiedCampaignModalTabList: NamedComponent<UnifiedCampaignModalTabListProps> = ({ isEdit, mediaCount }) => {
  const { t } = useTranslation('wpsg');
  return (
    <Tabs.List>
      <Tabs.Tab value="details">{t('admin_camp_tab_details', 'Details')}</Tabs.Tab>
      {isEdit && (
        <Tabs.Tab value="media">
          {t('admin_camp_tab_media', 'Media')} {mediaCount > 0 && <Badge size="sm" ml={4}>{mediaCount}</Badge>}
        </Tabs.Tab>
      )}
      <Tabs.Tab value="settings">{t('admin_camp_tab_settings', 'Settings')}</Tabs.Tab>
    </Tabs.List>
  );
};

UnifiedCampaignModalTabList.displayName = 'UnifiedCampaignModalTabList';

interface UnifiedCampaignDetailsPanelProps {
  isEdit: boolean;
  formState: UnifiedCampaignFormState;
  updateForm: UnifiedCampaignUpdateForm;
  mediaItems: MediaItem[];
  onSelectCoverImage: (value: string) => void;
  onUploadCoverImage: (file: File) => Promise<void> | void;
  coverImageUploading: boolean;
  companies: CompanyInfo[];
  companiesLoading: boolean;
}

const UnifiedCampaignDetailsPanel: NamedComponent<UnifiedCampaignDetailsPanelProps> = ({
  isEdit,
  formState,
  updateForm,
  mediaItems,
  onSelectCoverImage,
  onUploadCoverImage,
  coverImageUploading,
  companies,
  companiesLoading,
}) => {
  const { t } = useTranslation('wpsg');
  return (
  <Tabs.Panel value="details" pt="md">
    <Stack gap="md">
      <TextInput
        label={t('admin_camp_title_label', 'Title')}
        placeholder={t('admin_camp_title_ph', 'Campaign title')}
        value={formState.title}
        onChange={(e) => updateForm({ ...formState, title: e.currentTarget.value })}
        required
      />
      <Textarea
        label={t('admin_camp_desc_label', 'Description')}
        placeholder={t('admin_camp_desc_ph', 'Campaign description')}
        value={formState.description}
        onChange={(e) => updateForm({ ...formState, description: e.currentTarget.value })}
        minRows={3}
      />
      <CompanyCombobox
        label={t('admin_camp_company_label', 'Company')}
        value={formState.company}
        onChange={(v) => updateForm({ ...formState, company: v })}
        companies={companies}
        loading={companiesLoading}
        required
      />

      <Card withBorder>
        <Stack gap="sm">
          <Text fw={500}>{t('admin_camp_thumbnail', 'Campaign Thumbnail (Card Image)')}</Text>
          <Image
            src={formState.coverImage || FALLBACK_IMAGE_SRC}
            alt={t('admin_camp_thumbnail_alt', 'Campaign thumbnail preview')}
            height={140}
            fit="cover"
            fallbackSrc={FALLBACK_IMAGE_SRC}
          />
          {isEdit && mediaItems.length > 0 && (
            <Select
              label={t('admin_camp_use_media_thumb', 'Use existing campaign media as thumbnail')}
              placeholder={t('admin_camp_choose_thumb', 'Choose media image/thumbnail')}
              value={formState.coverImage || null}
              data={mediaItems
                .filter((media) => media.thumbnail || media.url)
                .map((media) => ({
                  value: media.thumbnail || media.url,
                  label: media.caption || t('admin_camp_media_label', '{{type}} #{{id}}', { type: media.type.toUpperCase(), id: media.id }),
                }))}
              onChange={(value) => onSelectCoverImage(value ?? '')}
              searchable
              clearable
              nothingFoundMessage={t('admin_camp_no_media_avail', 'No campaign media available')}
            />
          )}
          {isEdit && (
            <FileButton
              onChange={(file) => file && void onUploadCoverImage(file)}
              accept="image/*"
            >
              {(props) => (
                <Button {...props} variant="light" loading={coverImageUploading}>
                  {t('admin_camp_upload_thumb', 'Upload Custom Thumbnail')}
                </Button>
              )}
            </FileButton>
          )}
        </Stack>
      </Card>

    </Stack>
  </Tabs.Panel>
  );
};

UnifiedCampaignDetailsPanel.displayName = 'UnifiedCampaignDetailsPanel';

interface UnifiedCampaignSettingsPanelProps {
  isEdit: boolean;
  cardBorderMode?: 'single' | 'auto' | 'individual' | undefined;
  formState: UnifiedCampaignFormState;
  updateForm: UnifiedCampaignUpdateForm;
  categoryItems: CampaignCategoryEntry[];
  tagItems: TagEntry[];
  campaignGalleryOverrideMode: 'unified' | 'per-type' | '' | null;
  effectiveCampaignGalleryMode: 'unified' | 'per-type';
  resolvedCampaignQuickOverrides: UnifiedCampaignGalleryOverrides;
  hasCustomGalleryOverrides: boolean;
  galleryOverrideSummary: string[];
  updateCampaignBreakpointOverride: (
    breakpoint: typeof CAMPAIGN_BREAKPOINTS[number],
    scope: 'unified' | 'image' | 'video',
    adapterId: string,
  ) => void;
  onOpenResponsiveConfig: () => void;
  layoutTemplates: LayoutTemplate[];
  onEditLayout?: ((templateId: string) => void) | undefined;
}

const UnifiedCampaignSettingsPanel: NamedComponent<UnifiedCampaignSettingsPanelProps> = ({
  isEdit,
  cardBorderMode,
  formState,
  updateForm,
  categoryItems,
  tagItems,
  campaignGalleryOverrideMode,
  effectiveCampaignGalleryMode,
  resolvedCampaignQuickOverrides,
  hasCustomGalleryOverrides,
  galleryOverrideSummary,
  updateCampaignBreakpointOverride,
  onOpenResponsiveConfig,
  layoutTemplates,
  onEditLayout,
}) => {
  const { t } = useTranslation('wpsg');
  const usesLayoutBuilder = campaignUsesLayoutBuilder(formState.galleryOverrides);
  return (
  <Tabs.Panel value="settings" pt="md">
    <Stack gap="md">
      <Group grow wrap="wrap" gap="sm">
        <Select
          label={t('admin_camp_status_label', 'Status')}
          data={[
            { value: 'draft', label: t('admin_status_draft', 'Draft') },
            { value: 'active', label: t('admin_status_active', 'Active') },
            { value: 'archived', label: t('admin_status_archived', 'Archived') },
          ]}
          value={formState.status}
          onChange={(v) => updateForm({ ...formState, status: (v ?? 'draft') as 'draft' | 'active' | 'archived' })}
        />
        <Select
          label={t('admin_camp_visibility_label', 'Visibility')}
          data={[
            { value: 'private', label: t('admin_visibility_private', 'Private') },
            { value: 'public', label: t('admin_visibility_public', 'Public') },
          ]}
          value={formState.visibility}
          onChange={(v) => updateForm({ ...formState, visibility: (v ?? 'private') as 'public' | 'private' })}
        />
      </Group>
      <TagsInput
        label={t('admin_camp_tags_label', 'Tags')}
        placeholder={t('admin_camp_tags_ph', 'Add tags…')}
        description={t('admin_camp_tags_desc', 'Type a tag and press Enter or comma to add')}
        data={tagItems.map((tag) => tag.name)}
        value={formState.tags}
        onChange={(v) => updateForm({ ...formState, tags: v })}
        splitChars={[',']}
        clearable
      />
      <MultiSelect
        label={t('admin_camp_cats_label', 'Categories')}
        placeholder={t('admin_camp_cats_ph', 'Select categories')}
        description={t('admin_camp_cats_desc', 'Assign this campaign to one or more categories')}
        value={formState.categories}
        onChange={(v) => updateForm({ ...formState, categories: v })}
        data={buildCategorySelectData(categoryItems)}
        searchable
        clearable
      />
      <Group grow wrap="wrap" gap="sm">
        <TextInput
          type="datetime-local"
          label={t('admin_camp_publish_label', 'Publish At')}
          description={t('admin_camp_publish_desc', 'Campaign becomes visible at this date/time')}
          value={formState.publishAt ? toLocalInputValue(formState.publishAt) : ''}
          onChange={(e) => updateForm({ ...formState, publishAt: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : '' })}
        />
        <TextInput
          type="datetime-local"
          label={t('admin_camp_unpublish_label', 'Unpublish At')}
          description={t('admin_camp_unpublish_desc', 'Campaign is hidden after this date/time')}
          value={formState.unpublishAt ? toLocalInputValue(formState.unpublishAt) : ''}
          onChange={(e) => updateForm({ ...formState, unpublishAt: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : '' })}
        />
      </Group>
      {isEdit && cardBorderMode === 'individual' && (
        <ColorInput
          label={t('admin_camp_border_label', 'Card Border Color')}
          description={t('admin_camp_border_desc', 'Custom accent border color for this campaign card')}
          value={formState.borderColor ?? ''}
          onChange={(v) => updateForm({ ...formState, borderColor: v || undefined })}
          placeholder={t('admin_camp_border_ph', 'Auto (company brand color)')}
        />
      )}
      {isEdit && (
        <>
          <Stack gap="sm">
            <Select
              label={t('admin_camp_gmode_label', 'Gallery Mode Override')}
              description={t('admin_camp_gmode_desc', 'Override the global gallery mode for this campaign')}
              placeholder={t('admin_camp_gmode_ph', 'Default (from settings)')}
              clearable
              data={[
                { value: 'unified', label: t('admin_gallery_mode_unified', 'Unified') },
                { value: 'per-type', label: t('admin_gallery_mode_pertype', 'Per-Type') },
              ]}
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
                <Text size="sm" fw={500} mb={4}>{t('admin_camp_unified_bp', 'Unified Breakpoint Adapters')}</Text>
                <Text size="xs" c="dimmed" mb={8}>
                  {t('admin_camp_unified_bp_hint', 'Clear a cell to inherit the global unified adapter for that breakpoint.')}
                </Text>
                <SimpleGrid cols={2} spacing="xs" mb={4}>
                  <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
                  <Text size="xs" fw={600} ta="center">{t('admin_gallery_mode_unified', 'Unified')}</Text>
                </SimpleGrid>
                {CAMPAIGN_BREAKPOINTS.map((breakpoint) => (
                  <SimpleGrid cols={2} spacing="xs" mb="xs" key={breakpoint}>
                    <Text size="sm" fw={500} style={{ display: 'flex', alignItems: 'center' }}>
                      {t(`admin_bp_${breakpoint}`, BREAKPOINT_LABELS[breakpoint])}
                    </Text>
                    <Select
                      size="xs"
                      aria-label={t('admin_camp_bp_unified_aria', '{{bp}} Unified Gallery Adapter', { bp: t(`admin_bp_${breakpoint}`, BREAKPOINT_LABELS[breakpoint]) })}
                      placeholder={t('admin_camp_inherited', 'Inherited')}
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
                <Text size="sm" fw={500} mb={4}>{t('admin_camp_pertype_bp', 'Per-Type Breakpoint Adapters')}</Text>
                <Text size="xs" c="dimmed" mb={8}>
                  {t('admin_camp_pertype_bp_hint', "Clear any cell to inherit that breakpoint's global adapter selection.")}
                </Text>
                <SimpleGrid cols={3} spacing="xs" mb={4}>
                  <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
                  <Text size="xs" fw={600} ta="center">{t('admin_camp_col_image', 'Image')}</Text>
                  <Text size="xs" fw={600} ta="center">{t('admin_camp_col_video', 'Video')}</Text>
                </SimpleGrid>
                {CAMPAIGN_BREAKPOINTS.map((breakpoint) => (
                  <SimpleGrid cols={3} spacing="xs" mb="xs" key={breakpoint}>
                    <Text size="sm" fw={500} style={{ display: 'flex', alignItems: 'center' }}>
                      {t(`admin_bp_${breakpoint}`, BREAKPOINT_LABELS[breakpoint])}
                    </Text>
                    <Select
                      size="xs"
                      aria-label={t('admin_camp_bp_image_aria', '{{bp}} Image Gallery Adapter', { bp: t(`admin_bp_${breakpoint}`, BREAKPOINT_LABELS[breakpoint]) })}
                      placeholder={t('admin_camp_inherited', 'Inherited')}
                      clearable
                      data={getAdapterSelectOptions({ context: 'campaign-override', breakpoint })}
                      value={getCampaignBreakpointAdapterId(resolvedCampaignQuickOverrides, breakpoint, 'image')}
                      onChange={(value) => updateCampaignBreakpointOverride(breakpoint, 'image', value ?? '')}
                    />
                    <Select
                      size="xs"
                      aria-label={t('admin_camp_bp_video_aria', '{{bp}} Video Gallery Adapter', { bp: t(`admin_bp_${breakpoint}`, BREAKPOINT_LABELS[breakpoint]) })}
                      placeholder={t('admin_camp_inherited', 'Inherited')}
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
              {t('admin_camp_quick_overrides_hint', 'Quick per-breakpoint overrides stay inline here. Use the shared responsive editor for mode changes, shared responsive settings, and adapter-specific fields.')}
            </Text>
            <Button variant="light" onClick={onOpenResponsiveConfig}>
              {t('admin_camp_edit_responsive', 'Edit Responsive Config')}
            </Button>
          </Group>
          <Stack gap={6}>
            <Group gap="xs" wrap="wrap">
              <Badge color={hasCustomGalleryOverrides ? 'grape' : 'gray'} variant={hasCustomGalleryOverrides ? 'light' : 'outline'}>
                {hasCustomGalleryOverrides ? t('admin_camp_custom_overrides', 'Custom gallery overrides') : t('admin_camp_inheriting', 'Inheriting global gallery settings')}
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
                  {t('admin_camp_clear_overrides_hint', 'Clear the campaign-specific gallery override state here to fall back to the global gallery configuration.')}
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
                  {t('admin_camp_use_inherited', 'Use Inherited Gallery Settings')}
                </Button>
              </Group>
            )}
          </Stack>
        </>
      )}
      {/* B-6: contextual layout-template picker — surfaced/emphasized when the
          Layout Builder adapter is the chosen gallery adapter for this campaign. */}
      {(layoutTemplates.length > 0 || usesLayoutBuilder) && (
        <Box>
          {layoutTemplates.length > 0 && (
            <Group grow wrap="wrap" gap="sm" align="flex-end">
              <Select
                label={t('admin_camp_layout_label', 'Layout Template')}
                description={usesLayoutBuilder
                  ? t('admin_camp_layout_desc_active', 'Layout Builder is your selected gallery adapter — choose the template it renders.')
                  : t('admin_camp_layout_desc', 'Assign a layout template to use the Layout Builder adapter')}
                placeholder={t('admin_camp_layout_ph', 'None (use default adapter)')}
                clearable
                data={layoutTemplates.map((lt) => ({
                  value: lt.id,
                  label: t('admin_camp_layout_option', '{{name}} ({{count}} slots)', { name: lt.name, count: lt.slots.length }),
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
                  {t('admin_camp_edit_layout', 'Edit Layout')}
                </Button>
              )}
            </Group>
          )}
          {usesLayoutBuilder && !formState.layoutTemplateId && (
            <Text size="xs" c="orange" mt={layoutTemplates.length > 0 ? 4 : 0}>
              {layoutTemplates.length > 0
                ? t('admin_camp_lb_no_template', 'Layout Builder is selected as a gallery adapter, but no template is assigned — pick one above, or the gallery falls back to the default adapter.')
                : t('admin_camp_lb_no_templates', 'Layout Builder is selected as a gallery adapter, but no layout templates exist yet. Create one in the Layout Builder first.')}
            </Text>
          )}
        </Box>
      )}

    </Stack>
  </Tabs.Panel>
  );
};

UnifiedCampaignSettingsPanel.displayName = 'UnifiedCampaignSettingsPanel';

export function UnifiedCampaignModal({
  modal,
  galleryBehaviorSettings = DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  cardBorderMode,
  layoutTemplates = [],
  onEditLayout,
  categoryItems = [],
  tagItems = [],
}: UnifiedCampaignModalProps) {
  const { t } = useTranslation('wpsg');
  const [galleryConfigEditorOpen, setGalleryConfigEditorOpen] = useState(false);
  const { activeCampaign, onEditGalleryConfig, setActiveCampaign, setOnEditGalleryConfig } = useCampaignContext();
  // Live mirrors of the context so the edit-modal effect can snapshot whatever was
  // active *before* it took over, and restore it on close instead of nulling.
  const prevActiveCampaignRef = useRef(activeCampaign);
  prevActiveCampaignRef.current = activeCampaign;
  const prevOnEditGalleryConfigRef = useRef(onEditGalleryConfig);
  prevOnEditGalleryConfigRef.current = onEditGalleryConfig;
  const {
    opened, mode, formState, updateForm, isSaving,
    editingCampaign,
    coverImageUploading, handleSelectCoverImage, handleUploadCoverImage,
    activeTab, setActiveTab,
    mediaItems, mediaLoading, handleRemoveMedia, handleAddFromLibrary,
    handleUploadMedia, handleAddExternalMedia,
    uploadFiles, uploadErrors, uploadProgresses, uploadLoading,
    addMediaUrl, setAddMediaUrl, addMediaType, setAddMediaType,
    addMediaCaption, setAddMediaCaption, addMediaLoading,
    libraryMedia, libraryLoading, librarySearch, setLibrarySearch, loadLibraryMedia,
    companies, companiesLoading,
    close, save,
  } = modal;

  const openGalleryConfigFromAuthBar = useCallback(() => {
    setGalleryConfigEditorOpen(true);
  }, []);

  useEffect(() => {
    // Only take over the campaign context while actively editing an existing
    // campaign. When not editing, leave the context untouched so a campaign the
    // viewer set (e.g. when editing from within an open campaign) is preserved.
    if (!opened || mode !== 'edit' || !editingCampaign) {
      return;
    }
    // Snapshot the pre-existing context (captured at open) and restore it on close,
    // rather than nulling it — otherwise closing the edit modal while a campaign is
    // still being viewed wipes the campaign-scoped AuthBar menu items.
    const prevCampaign = prevActiveCampaignRef.current;
    const prevOnEditGalleryConfig = prevOnEditGalleryConfigRef.current;
    setActiveCampaign(editingCampaign);
    setOnEditGalleryConfig(openGalleryConfigFromAuthBar);
    return () => {
      setActiveCampaign(prevCampaign);
      setOnEditGalleryConfig(prevOnEditGalleryConfig);
    };
  }, [opened, mode, editingCampaign, openGalleryConfigFromAuthBar, setActiveCampaign, setOnEditGalleryConfig]);

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
  const handleSave = () => {
    void save();
  };

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
        withinPortal={false}
        title={
          <Group w="100%" justify="space-between" wrap="nowrap" gap="sm">
            <span>{isEdit ? t('admin_camp_edit_title', 'Edit Campaign') : t('admin_camp_new_title', 'New Campaign')}</span>
            <Group gap="xs" wrap="nowrap">
              <Button variant="default" size="sm" onClick={guardedClose}>{t('admin_cancel', 'Cancel')}</Button>
              <Button size="sm" onClick={handleSave} loading={isSaving}>
                {isEdit ? t('admin_camp_save', 'Save Changes') : t('admin_camp_create', 'Create Campaign')}
              </Button>
            </Group>
          </Group>
        }
        size={isExtraSmall ? '100%' : 'xl'}
        fullScreen={!!isExtraSmall}
        zIndex={300}
      >
        <Tabs value={activeTab} onChange={setActiveTab} aria-label={t('admin_camp_tabs_aria', 'Campaign modal tabs')}>
          <UnifiedCampaignModalTabList isEdit={isEdit} mediaCount={mediaItems.length} />

          <UnifiedCampaignDetailsPanel
            isEdit={isEdit}
            formState={formState}
            updateForm={updateForm}
            mediaItems={mediaItems}
            onSelectCoverImage={handleSelectCoverImage}
            onUploadCoverImage={handleUploadCoverImage}
            coverImageUploading={coverImageUploading}
            companies={companies}
            companiesLoading={companiesLoading}
          />

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
                  uploadFiles={uploadFiles}
                  uploadErrors={uploadErrors}
                  uploadProgresses={uploadProgresses}
                  uploadLoading={uploadLoading}
                  onUploadFile={handleUploadMedia}
                  maxBatchUploadSize={galleryBehaviorSettings.maxBatchUploadSize}
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

          <UnifiedCampaignSettingsPanel
            isEdit={isEdit}
            cardBorderMode={cardBorderMode}
            formState={formState}
            updateForm={updateForm}
            categoryItems={categoryItems}
            tagItems={tagItems}
            campaignGalleryOverrideMode={campaignGalleryOverrideMode}
            effectiveCampaignGalleryMode={effectiveCampaignGalleryMode}
            resolvedCampaignQuickOverrides={resolvedCampaignQuickOverrides}
            hasCustomGalleryOverrides={hasCustomGalleryOverrides}
            galleryOverrideSummary={galleryOverrideSummary}
            updateCampaignBreakpointOverride={updateCampaignBreakpointOverride}
            onOpenResponsiveConfig={() => setGalleryConfigEditorOpen(true)}
            layoutTemplates={layoutTemplates}
            onEditLayout={onEditLayout}
          />
        </Tabs>
      </Modal>

      <ConfirmModal
        opened={confirmOpen}
        onClose={cancelDiscard}
        onConfirm={confirmDiscard}
        title={t('admin_discard_title', 'Discard changes?')}
        message={t('admin_discard_msg', 'You have unsaved changes. Are you sure you want to discard them?')}
        confirmLabel={t('admin_discard', 'Discard')}
        confirmColor="red"
      />

      {galleryConfigEditorOpen && (
        <Suspense fallback={<GalleryConfigEditorLoader />}>
          <LazyGalleryConfigEditorModal
            opened={galleryConfigEditorOpen}
            onClose={() => setGalleryConfigEditorOpen(false)}
            title={t('admin_camp_gconfig_title', 'Campaign Responsive Gallery Config')}
            value={formState.galleryOverrides}
            contextSummary={hasCampaignGalleryOverrides(formState)
              ? t('admin_camp_gconfig_custom', 'This campaign currently stores custom gallery overrides. Use Clear Campaign Overrides to return to inherited global gallery settings.')
              : t('admin_camp_gconfig_inherit', 'This campaign is currently inheriting global gallery settings. Any changes saved here will create campaign-specific overrides.')}
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
            saveLabel={t('admin_camp_gconfig_save', 'Apply Campaign Gallery Config')}
            clearLabel={t('admin_camp_gconfig_clear', 'Clear Campaign Overrides')}
            unifiedAdapterDescription={t('admin_camp_gconfig_unified_desc', 'Adapter applied when this campaign renders images and videos together.')}
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
  uploadFiles: File[];
  uploadErrors: Array<string | null>;
  uploadProgresses: number[] | null;
  uploadLoading: boolean;
  onUploadFile: (value: File | File[] | null) => void;
  maxBatchUploadSize: number;
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
  uploadFiles,
  uploadErrors,
  uploadProgresses,
  uploadLoading,
  onUploadFile,
  maxBatchUploadSize,
  addMediaType,
  onAddMediaTypeChange,
  addMediaUrl,
  onAddMediaUrlChange,
  addMediaCaption,
  onAddMediaCaptionChange,
  addMediaLoading,
  onAddExternalMedia,
}: MediaTabContentProps) {
  const { t } = useTranslation('wpsg');
  return (
    <Stack gap="lg">
      {/* Media grid */}
      {mediaItems.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">{t('admin_camp_no_media', 'No media attached to this campaign.')}</Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
          {mediaItems.map((media) => (
            <Card key={media.id} shadow="sm" padding="xs" radius="md" withBorder role="group" aria-label={t('admin_camp_media_item_aria', 'Media item {{label}}', { label: media.caption || media.url })}>
              <Card.Section>
                <Image src={media.thumbnail || media.url} height={100} alt={media.caption || t('admin_camp_media_alt', 'Media')} fallbackSrc={FALLBACK_IMAGE_SRC} />
              </Card.Section>
              <Group justify="space-between" mt="xs">
                <Badge size="xs" variant="light">{media.type}</Badge>
                <Tooltip label={t('admin_camp_remove_media', 'Remove from campaign')}>
                  <ActionIcon color="red" variant="light" size="sm" onClick={() => void onRemoveMedia(media)} aria-label={t('admin_camp_remove_media', 'Remove from campaign')}>
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
          <Group><IconUpload size={20} /><Text fw={500}>{t('admin_camp_upload_new', 'Upload New File')}</Text></Group>
          <FileButton onChange={(files) => files && void onUploadFile(files)} accept="image/*,video/*" multiple>
            {(props) => (
              <Button {...props} variant="light" fullWidth disabled={uploadLoading}>
                {uploadLoading ? t('admin_camp_uploading', 'Uploading...') : t('admin_camp_choose_files', 'Choose up to {{count}} files', { count: maxBatchUploadSize })}
              </Button>
            )}
          </FileButton>
          {uploadFiles.length > 0 && (
            <Stack gap={4}>
              {uploadFiles.map((file, index) => {
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
                    {progress !== null && <Progress value={progress} size="sm" striped animated={uploadLoading && progress < 100} color={error ? 'red' : 'blue'} />}
                  </Stack>
                );
              })}
            </Stack>
          )}
          <Text size="xs" c="dimmed">
            {t('admin_camp_upload_hint', 'Uploaded files use their filenames as captions in this modal.')}
          </Text>
        </Stack>
      </Card>

      {/* External URL section */}
      <Card withBorder>
        <Stack gap="sm">
          <Group><IconLink size={20} /><Text fw={500}>{t('admin_camp_add_url', 'Add External URL')}</Text></Group>
          <Select
            label={t('admin_camp_type_label', 'Type')}
            data={[{ value: 'video', label: t('admin_camp_type_video', 'Video') }, { value: 'image', label: t('admin_camp_type_image', 'Image') }]}
            value={addMediaType}
            onChange={(v) => onAddMediaTypeChange((v as 'video' | 'image') ?? 'video')}
          />
          <TextInput
            label={t('admin_camp_url_label', 'URL')}
            placeholder={t('admin_camp_url_ph', 'https://youtube.com/watch?v=... or image URL')}
            value={addMediaUrl}
            onChange={(e) => onAddMediaUrlChange(e.currentTarget.value)}
          />
          <TextInput
            label={t('admin_camp_caption_label', 'Caption (optional)')}
            placeholder={t('admin_camp_caption_ph', 'Describe this media')}
            value={addMediaCaption}
            onChange={(e) => onAddMediaCaptionChange(e.currentTarget.value)}
          />
          <Button onClick={() => void onAddExternalMedia()} disabled={!addMediaUrl} loading={addMediaLoading}>
            {t('admin_camp_add_ext_media', 'Add External Media')}
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}

MediaTabContent.displayName = 'UnifiedCampaignMediaTabContent';
