import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCalendar, IconTag } from '@tabler/icons-react';
import { Modal, Image, Badge, Group, Stack, Title, Text, Paper, SimpleGrid, Box, Center, Loader, Switch } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { Campaign, GalleryBehaviorSettings, GalleryConfig } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTypographyStyle } from '@/hooks/useTypographyStyle';
import { useInContextSave } from '@/hooks/useInContextSave';
import { InContextEditor } from '@/components/Common/InContextEditor';
import { TypographyEditor } from '@/components/Common/TypographyEditor';
import { GalleryConfigEditorLoader } from '@/components/Common/GalleryConfigEditorLoader';
import { buildGradientCss } from '@/utils/gradientCss';
import { loadGoogleFontsFromOverrides } from '@/utils/loadGoogleFont';
import { GOOGLE_FONT_NAMES } from '@/components/Common/TypographyEditor';
import { useCampaignContext } from '@/contexts/CampaignContext';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { CompanyLogo } from '@/components/Common/CompanyLogo';
import { resolveCampaignViewerGalleryShellLayout } from '@/utils/campaignViewerLayout';
import {
  buildCampaignGalleryOverrideEditorValue,
  hasCampaignGalleryOverrides,
} from '@/utils/campaignGalleryOverrides';
import { UnifiedGallerySection } from './UnifiedGallerySection';
import { PerTypeGallerySection } from './PerTypeGallerySection';

const LazyGalleryConfigEditorModal = lazy(() =>
  import('@/components/Common/GalleryConfigEditorModal').then((module) => ({
    default: module.GalleryConfigEditorModal,
  })),
);

interface CampaignViewerProps {
  campaign: Campaign;
  opened: boolean;
  hasAccess: boolean;
  galleryBehaviorSettings: GalleryBehaviorSettings;
  isAdmin: boolean;
  apiClient?: ApiClient;
  onCampaignsUpdated?: () => Promise<unknown> | void;
  onNotify?: (message: { type: 'error' | 'success'; text: string }) => void;
  onClose: () => void;
}

export function CampaignViewer({
  campaign,
  opened,
  hasAccess,
  galleryBehaviorSettings,
  isAdmin,
  apiClient,
  onCampaignsUpdated,
  onNotify,
  onClose,
}: CampaignViewerProps) {
  const s = galleryBehaviorSettings;
  const { setActiveCampaign, setOnEditGalleryConfig } = useCampaignContext();
  const [viewerCampaign, setViewerCampaign] = useState(campaign);
  const [galleryConfigEditorOpen, setGalleryConfigEditorOpen] = useState(false);
  const [galleryConfigEditorValue, setGalleryConfigEditorValue] = useState<Partial<GalleryConfig> | undefined>(undefined);
  const [galleryConfigPreviewBaseline, setGalleryConfigPreviewBaseline] = useState<Partial<GalleryConfig> | undefined>(undefined);
  const [isSavingGalleryConfig, setIsSavingGalleryConfig] = useState(false);

  useEffect(() => {
    setViewerCampaign(campaign);
    setGalleryConfigEditorOpen(false);
    setGalleryConfigEditorValue(undefined);
    setGalleryConfigPreviewBaseline(undefined);
  }, [campaign]);

  const openGalleryConfigEditor = useCallback((nextCampaign: Campaign) => {
    setViewerCampaign((current) => (current.id === nextCampaign.id ? current : nextCampaign));
    setGalleryConfigEditorValue(buildCampaignGalleryOverrideEditorValue(nextCampaign));
    setGalleryConfigPreviewBaseline(nextCampaign.galleryOverrides);
    setGalleryConfigEditorOpen(true);
  }, []);

  const closeGalleryConfigEditor = useCallback(() => {
    setViewerCampaign((current) => ({
      ...current,
      galleryOverrides: galleryConfigPreviewBaseline,
    }));
    setGalleryConfigEditorOpen(false);
    setGalleryConfigEditorValue(undefined);
    setGalleryConfigPreviewBaseline(undefined);
  }, [galleryConfigPreviewBaseline]);

  const persistCampaignGalleryConfig = useCallback(async (
    nextState: Pick<Campaign, 'galleryOverrides'>,
  ) => {
    if (isSavingGalleryConfig) {
      return;
    }

    if (!isAdmin) {
      onNotify?.({ type: 'error', text: 'Admin permissions required.' });
      return;
    }

    if (!apiClient) {
      onNotify?.({ type: 'error', text: 'Campaign API client unavailable.' });
      return;
    }

    setIsSavingGalleryConfig(true);

    const payload = {
      galleryOverrides: nextState.galleryOverrides ?? null,
    };

    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(viewerCampaign.id)}`, payload);

      setViewerCampaign((current) => ({
        ...current,
        imageAdapterId: undefined,
        videoAdapterId: undefined,
        galleryOverrides: nextState.galleryOverrides,
        updatedAt: new Date().toISOString(),
      }));
      setGalleryConfigEditorOpen(false);
      setGalleryConfigEditorValue(undefined);
      setGalleryConfigPreviewBaseline(undefined);
      onNotify?.({ type: 'success', text: 'Campaign gallery config updated.' });
      await onCampaignsUpdated?.();
    } catch (err) {
      onNotify?.({
        type: 'error',
        text: getErrorMessage(err, 'Failed to save campaign gallery config.'),
      });
    } finally {
      setIsSavingGalleryConfig(false);
    }
  }, [apiClient, isAdmin, isSavingGalleryConfig, onCampaignsUpdated, onNotify, viewerCampaign.id]);

  const handleGalleryConfigSave = useCallback((galleryOverrides: GalleryConfig | undefined) => {
    void persistCampaignGalleryConfig({
      galleryOverrides,
    });
  }, [persistCampaignGalleryConfig]);

  const handleGalleryConfigPreviewChange = useCallback((galleryOverrides: GalleryConfig | undefined) => {
    setViewerCampaign((current) => ({
      ...current,
      galleryOverrides,
    }));
  }, []);

  // P22-K5: Keep CampaignContext in sync with viewer open/close
  useEffect(() => {
    if (!opened) {
      setActiveCampaign(null);
      setOnEditGalleryConfig(undefined);
      return;
    }

    setActiveCampaign(viewerCampaign);
    setOnEditGalleryConfig(openGalleryConfigEditor);

    return () => {
      setActiveCampaign(null);
      setOnEditGalleryConfig(undefined);
    };
  }, [opened, openGalleryConfigEditor, setActiveCampaign, setOnEditGalleryConfig, viewerCampaign]);
  // P22-L1: Preload Google Fonts referenced in typography overrides
  useEffect(() => {
    loadGoogleFontsFromOverrides(s.typographyOverrides, GOOGLE_FONT_NAMES);
  }, [s.typographyOverrides]);
  const inContextSave = useInContextSave(apiClient, s);
  const campaignTitleStyle = useTypographyStyle('campaignTitle', s);
  const campaignDateStyle = useTypographyStyle('campaignDate', s);
  const campaignAboutHeadingStyle = useTypographyStyle('campaignAboutHeading', s);
  const campaignDescriptionStyle = useTypographyStyle('campaignDescription', s);
  const campaignStatsValueStyle = useTypographyStyle('campaignStatsValue', s);
  const campaignStatsLabelStyle = useTypographyStyle('campaignStatsLabel', s);
  const coverH = s.modalCoverHeight;
  const coverHBase = Math.round(coverH * 0.67);
  const coverHSm = Math.round(coverH * 0.83);
  const transition = s.modalTransition === 'slide-up' ? 'slide-up' : s.modalTransition as 'pop' | 'fade';
  const displayedCampaign = viewerCampaign;
  // Reactive media query so fullScreen updates on orientation changes / resizes
  const isMobile = useMediaQuery('(max-width: 48em)'); // ≤ 768px
  // P15-A: Per-breakpoint adapter resolution
  const containerRef = useRef<HTMLDivElement>(null);
  // The campaign viewer is intentionally width-clamped, so container width
  // tends to collapse desktop screens into the tablet breakpoint. Use the
  // viewport here so desktop/tablet/mobile map to the actual device size.
  const breakpoint = useBreakpoint(containerRef, { source: 'viewport' });
  const galleryShellLayout = resolveCampaignViewerGalleryShellLayout(galleryBehaviorSettings, displayedCampaign.galleryOverrides);
  // P21-F: Fullscreen and conditional rendering
  const useFullscreen = !!isMobile || !!s.campaignModalFullscreen;
  const galleriesOnly = s.campaignOpenMode === 'galleries-only';
  const showStats = (s.showCampaignStats !== false) && (!s.campaignStatsAdminOnly || isAdmin);
  // P22-P4: Modal dimension clamping
  const MODAL_MIN_WIDTH = 600;
  const MODAL_MAX_WIDTH = 1600;
  const MODAL_MIN_HEIGHT_DVH = 50;
  const MODAL_MAX_HEIGHT_DVH = 95;
  const clampedWidth = Math.max(MODAL_MIN_WIDTH, Math.min(MODAL_MAX_WIDTH, s.modalMaxWidth || 1200));
  const clampedMaxHeight = Math.max(MODAL_MIN_HEIGHT_DVH, Math.min(MODAL_MAX_HEIGHT_DVH, s.modalMaxHeight));
  const modalSize = useFullscreen ? '100%' : `${clampedWidth}px`;
  const clampedInnerPadding = Math.max(0, Math.min(48, s.modalInnerPadding));
  const contentMaxWidth = useFullscreen
    ? (s.fullscreenContentMaxWidth > 0 ? `${s.fullscreenContentMaxWidth}px` : '100%')
    : (s.modalContentMaxWidth > 0 ? `${s.modalContentMaxWidth}px` : '100%');
  // P22-K3: Modal background style (only applied in fullscreen)
  const modalBgStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!useFullscreen) return undefined;
    const t = s.modalBgType ?? 'theme';
    if (t === 'transparent') return { background: 'transparent' };
    if (t === 'solid' && s.modalBgColor) return { background: s.modalBgColor };
    if (t === 'gradient') {
      const css = buildGradientCss(s.modalBgGradient);
      if (css) return { background: css };
    }
    return undefined; // 'theme' = no override
  }, [useFullscreen, s.modalBgType, s.modalBgColor, s.modalBgGradient]);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={modalSize}
      padding={0}
      withCloseButton
      closeButtonProps={{ 'aria-label': 'Close campaign viewer', size: 'lg' }}
      transitionProps={{ transition, duration: s.modalTransitionDuration }}
      radius={useFullscreen ? 0 : 'lg'}
      fullScreen={useFullscreen}
      styles={{
        body: { padding: 0 },
        content: useFullscreen
          ? { overflow: 'auto', maxHeight: '100dvh', ...modalBgStyle }
          : { overflow: 'auto', maxHeight: `${clampedMaxHeight}dvh` },
        header: { position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'transparent', padding: 0 },
        close: { color: 'white', background: 'rgba(0,0,0,0.65)', borderRadius: '50%', width: 36, height: 36 },
      }}
      aria-label={`Campaign details for ${displayedCampaign.title}`}
    >
      {/* Cover Image Header — hidden in galleries-only mode or when cover image disabled */}
      {!galleriesOnly && s.showCampaignCoverImage !== false && (
      <Box pos="relative" h={{ base: coverHBase, sm: coverHSm, md: coverH }} component="div">
        <InContextEditor
          visible={isAdmin && s.showInContextEditors}
          position="top-left"
        >
          <Stack gap="sm">
            <Text fw={600} size="xs">Campaign Header</Text>
            <Switch label="Show Company Name" checked={s.showCampaignCompanyName !== false} onChange={(e) => inContextSave('showCampaignCompanyName', e.currentTarget.checked)} size="xs" />
            <Switch label="Show Date" checked={s.showCampaignDate !== false} onChange={(e) => inContextSave('showCampaignDate', e.currentTarget.checked)} size="xs" />
            <Text fw={500} size="xs" mt="xs">Title Typography</Text>
            <TypographyEditor
              value={s.typographyOverrides['campaignTitle'] ?? {}}
              onChange={(v) => {
                const o = { ...s.typographyOverrides };
                if (Object.keys(v).length === 0) delete o['campaignTitle'];
                else o['campaignTitle'] = v;
                inContextSave('typographyOverrides', o);
              }}
            />
          </Stack>
        </InContextEditor>
        <Image
          src={displayedCampaign.coverImage}
          alt={displayedCampaign.title}
          h={{ base: coverHBase, sm: coverHSm, md: coverH }}
          fit="cover"
          loading="lazy"
        />
        
        {/* Overlay gradient */}
        <Box
          pos="absolute"
          inset={0}
          style={{
            background: 'linear-gradient(to top, var(--wpsg-color-surface) 0%, color-mix(in srgb, var(--wpsg-color-surface) 60%, transparent) 45%, transparent 80%)',
            pointerEvents: 'none'
          }}
        />

        {/* Company badge */}
        {s.showCampaignCompanyName !== false && (
        <Badge
          pos="absolute"
          top={16}
          left={16}
          style={{ backgroundColor: campaign.company.brandColor }}
          size="lg"
        >
          <Group gap={8}>
            <CompanyLogo logo={displayedCampaign.company.logo} companyName={displayedCampaign.company.name} />
            <span>{displayedCampaign.company.name}</span>
          </Group>
        </Badge>
        )}

        {/* Title and meta overlay */}
        <Box pos="absolute" bottom={0} left={0} right={0} p={{ base: 'md', md: 'lg' }}>
          <Title order={2} size="h3" mb="sm" style={campaignTitleStyle}>
            {displayedCampaign.title}
          </Title>
          {s.showCampaignDate !== false && (
          <Group gap="lg" wrap="wrap">
            <Group gap={4}>
              <IconCalendar size={16} color="var(--wpsg-color-text-muted)" />
              <Text size="sm" c="dimmed" style={campaignDateStyle}>
                {new Date(displayedCampaign.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </Group>
            {s.showCampaignTags !== false && (
            <Group gap={4}>
              <IconTag size={16} color="var(--wpsg-color-text-muted)" />
              <Text size="sm" c="dimmed">
                {displayedCampaign.tags.join(', ')}
              </Text>
            </Group>
            )}
          </Group>
          )}
        </Box>
      </Box>
      )}

      {/* Content */}
      <Box ref={containerRef} style={{ width: '100%', maxWidth: contentMaxWidth, marginLeft: 'auto', marginRight: 'auto', padding: galleriesOnly ? 0 : clampedInnerPadding, display: 'flex', flexDirection: 'column' as const, flex: 1, justifyContent: s.modalContentVerticalAlign === 'center' ? 'center' : s.modalContentVerticalAlign === 'bottom' ? 'flex-end' : undefined }}>
        <Stack gap="lg" style={{ width: '100%' }}>
          {/* Description — hidden in galleries-only mode */}
          {!galleriesOnly && s.showCampaignAbout !== false && (
          <Box pos="relative">
            <InContextEditor
              visible={isAdmin && s.showInContextEditors}
              position="top-right"
            >
              <Stack gap="sm">
                <Text fw={600} size="xs">About Section</Text>
                <Switch label="Show About" checked={Boolean(s.showCampaignAbout)} onChange={(e) => inContextSave('showCampaignAbout', e.currentTarget.checked)} size="xs" />
                <Switch label="Show Description" checked={Boolean(s.showCampaignDescription)} onChange={(e) => inContextSave('showCampaignDescription', e.currentTarget.checked)} size="xs" />
                <Text fw={500} size="xs" mt="xs">Heading Typography</Text>
                <TypographyEditor
                  value={s.typographyOverrides['campaignAboutHeading'] ?? {}}
                  onChange={(v) => {
                    const o = { ...s.typographyOverrides };
                    if (Object.keys(v).length === 0) delete o['campaignAboutHeading'];
                    else o['campaignAboutHeading'] = v;
                    inContextSave('typographyOverrides', o);
                  }}
                />
              </Stack>
            </InContextEditor>
            <Title order={2} size="h4" mb="sm" style={campaignAboutHeadingStyle}>{s.campaignAboutHeadingText || 'About this Campaign'}</Title>
            {s.showCampaignDescription !== false && (
            <Text c="dimmed" lh={1.6} style={campaignDescriptionStyle}>
              {displayedCampaign.description}
            </Text>
            )}
          </Box>
          )}

          {/* Access notice */}
          {!hasAccess && (
            <Paper p="md" radius="md" bg="red.9" withBorder role="alert" aria-live="assertive">
              <Text size="sm" fw={600}>
                This campaign is private. Sign in or request access to view media.
              </Text>
            </Paper>
          )}

          {/* Media Sections */}
          {hasAccess && (displayedCampaign.videos.length > 0 || displayedCampaign.images.length > 0) && (
          <Box style={{
            width: '100%',
            maxWidth: galleryShellLayout.maxWidth,
            marginInline: 'auto',
            paddingLeft: galleryShellLayout.paddingLeft,
            paddingRight: galleryShellLayout.paddingRight,
          }}>
            <Suspense fallback={
              <Center py="xl" mih={200}>
                <Stack align="center" gap="xs">
                  <Loader size="md" />
                  <Text size="sm" c="dimmed">Loading gallery…</Text>
                </Stack>
              </Center>
            }>
            <Stack gap={galleryShellLayout.galleryGap} style={{ width: '100%' }}>
              {galleryShellLayout.galleryMode === 'unified' ? (
                <UnifiedGallerySection campaign={displayedCampaign} settings={galleryBehaviorSettings} breakpoint={breakpoint} isAdmin={isAdmin} />
              ) : (
                <PerTypeGallerySection campaign={displayedCampaign} settings={galleryBehaviorSettings} breakpoint={breakpoint} isAdmin={isAdmin} />
              )}
            </Stack>
            </Suspense>
          </Box>
          )}

          {hasAccess && displayedCampaign.videos.length === 0 && displayedCampaign.images.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">No media available for this campaign.</Text>
          )}

          {/* Campaign Stats — conditional */}
          {!galleriesOnly && showStats && (
          <Box component="section" role="region" aria-labelledby="campaign-stats-heading" pos="relative">
            <InContextEditor
              visible={isAdmin && s.showInContextEditors}
              position="top-right"
            >
              <Stack gap="sm">
                <Text fw={600} size="xs">Stats Section</Text>
                <Switch label="Show Stats" checked={s.showCampaignStats !== false} onChange={(e) => inContextSave('showCampaignStats', e.currentTarget.checked)} size="xs" />
                <Switch label="Admin Only" checked={!!s.campaignStatsAdminOnly} onChange={(e) => inContextSave('campaignStatsAdminOnly', e.currentTarget.checked)} size="xs" />
              </Stack>
            </InContextEditor>
            <Title order={3} size="h6" mb="sm" id="campaign-stats-heading" className="wpsg-sr-only">Campaign Statistics</Title>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={{ base: 'sm', md: 'md' }} py="sm" style={{ borderTopWidth: 1, borderTopColor: 'var(--wpsg-color-border)' }}>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} style={campaignStatsValueStyle}>{displayedCampaign.videos.length}</Text>
              <Text size="sm" c="dimmed" style={campaignStatsLabelStyle}>Videos</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} style={campaignStatsValueStyle}>{displayedCampaign.images.length}</Text>
              <Text size="sm" c="dimmed" style={campaignStatsLabelStyle}>Images</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} style={campaignStatsValueStyle}>{displayedCampaign.tags.length}</Text>
              <Text size="sm" c="dimmed" style={campaignStatsLabelStyle}>Tags</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} style={campaignStatsValueStyle}>
                {displayedCampaign.visibility === 'public' ? '🌐' : '🔒'}
              </Text>
              <Text size="sm" c="dimmed" style={campaignStatsLabelStyle}>
                {displayedCampaign.visibility === 'public' ? 'Public' : 'Private'}
              </Text>
            </Paper>
          </SimpleGrid>
          </Box>
          )}
        </Stack>
      </Box>

      {galleryConfigEditorOpen && (
        <Suspense fallback={<GalleryConfigEditorLoader />}>
          <LazyGalleryConfigEditorModal
            opened={galleryConfigEditorOpen}
            onClose={closeGalleryConfigEditor}
            title="Campaign Gallery Config"
            value={galleryConfigEditorValue}
            contextSummary={hasCampaignGalleryOverrides(displayedCampaign)
              ? 'This campaign currently stores custom gallery overrides. Changes preview in the viewer immediately, revert on cancel, and persist only when you save.'
              : 'This campaign is currently inheriting global gallery settings. Changes preview in the viewer immediately, revert on cancel, and persist only when you save.'}
            onChange={handleGalleryConfigPreviewChange}
            onSave={handleGalleryConfigSave}
            saveLabel="Save Campaign Gallery Config"
            clearLabel="Preview Inherited Gallery Settings"
            clearMode="draft"
            unifiedAdapterDescription="Adapter applied when this campaign renders images and videos together."
            zIndex={500}
          />
        </Suspense>
      )}
    </Modal>
  );
}
