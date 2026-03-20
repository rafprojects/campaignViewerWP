import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { IconCalendar, IconTag } from '@tabler/icons-react';
import { Modal, Image, Badge, Group, Stack, Title, Text, Paper, SimpleGrid, Box, Center, Loader, Switch } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { Campaign, GalleryBehaviorSettings, MediaItem } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { useTypographyStyle } from '@/hooks/useTypographyStyle';
import { useInContextSave } from '@/hooks/useInContextSave';
import { InContextEditor } from '@/components/shared/InContextEditor';
import { TypographyEditor } from '@/components/shared/TypographyEditor';
import { resolveAdapterId } from '@/utils/resolveAdapterId';
import { sanitizeCssUrl } from '@/utils/sanitizeCss';
import { buildGradientCss } from '@/utils/gradientCss';
import { loadGoogleFontsFromOverrides } from '@/utils/loadGoogleFont';
import { GOOGLE_FONT_NAMES } from '@/components/shared/TypographyEditor';
import { useCampaignContext } from '@/contexts/CampaignContext';
import { CompanyLogo } from '@/components/shared/CompanyLogo';

/**
 * Dispatch a gallery adapter by ID. 'classic' and 'layout-builder' are handled
 * separately in the caller because they need different props. All other adapter
 * IDs are resolved here. Unknown IDs fall back to CompactGridGallery.
 */
function renderAdapter(id: string, media: MediaItem[], settings: GalleryBehaviorSettings) {
  switch (id) {
    case 'justified':
    case 'mosaic': // legacy alias → justified (fixes single-column bug)
      return <JustifiedGallery media={media} settings={settings} />;
    case 'masonry':
      return <MasonryGallery media={media} settings={settings} />;
    case 'hexagonal':
      return <HexagonalGallery media={media} settings={settings} />;
    case 'circular':
      return <CircularGallery media={media} settings={settings} />;
    case 'diamond':
      return <DiamondGallery media={media} settings={settings} />;
    case 'compact-grid':
    default:
      return <CompactGridGallery media={media} settings={settings} />;
  }
}

/** Return a CSS background style object from viewport background settings. */
function resolveViewportBg(type: string, color: string, gradient: string, imageUrl: string) {
  switch (type) {
    case 'solid':    return { background: color };
    case 'gradient': return { background: gradient };
    case 'image': {
      const safeUrl = sanitizeCssUrl(imageUrl);
      return safeUrl ? { backgroundImage: `url(${safeUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
    }
    default:         return {};
  }
}

const VideoCarousel = lazy(() => import('./VideoCarousel').then((m) => ({ default: m.VideoCarousel })));
const ImageCarousel = lazy(() => import('./ImageCarousel').then((m) => ({ default: m.ImageCarousel })));
const CompactGridGallery = lazy(() =>
  import('@/gallery-adapters/compact-grid/CompactGridGallery').then((m) => ({
    default: m.CompactGridGallery,
  }))
);
const JustifiedGallery = lazy(() =>
  import('@/gallery-adapters/justified/JustifiedGallery').then((m) => ({
    default: m.JustifiedGallery,
  }))
);
const MasonryGallery = lazy(() =>
  import('@/gallery-adapters/masonry/MasonryGallery').then((m) => ({
    default: m.MasonryGallery,
  }))
);
const HexagonalGallery = lazy(() =>
  import('@/gallery-adapters/hexagonal/HexagonalGallery').then((m) => ({
    default: m.HexagonalGallery,
  }))
);
const CircularGallery = lazy(() =>
  import('@/gallery-adapters/circular/CircularGallery').then((m) => ({
    default: m.CircularGallery,
  }))
);
const DiamondGallery = lazy(() =>
  import('@/gallery-adapters/diamond/DiamondGallery').then((m) => ({
    default: m.DiamondGallery,
  }))
);
const LayoutBuilderGallery = lazy(() =>
  import('@/gallery-adapters/layout-builder/LayoutBuilderGallery').then((m) => ({
    default: m.LayoutBuilderGallery,
  }))
);

/* ── Local gallery section components (extracted from IIFEs) ────────── */

interface GallerySectionProps {
  campaign: Campaign;
  settings: GalleryBehaviorSettings;
  isAdmin: boolean;
}

function UnifiedGallerySection({ campaign, settings: s, isAdmin }: GallerySectionProps) {
  const allMedia = [...campaign.videos, ...campaign.images].sort((a, b) => a.order - b.order);
  if (allMedia.length === 0) return null;
  const bgStyle = resolveViewportBg(s.unifiedBgType, s.unifiedBgColor, s.unifiedBgGradient, s.unifiedBgImageUrl);
  const effectiveId = campaign.imageAdapterId || s.unifiedGalleryAdapterId;
  const inner = effectiveId === 'layout-builder' && campaign.layoutTemplateId
    ? <LayoutBuilderGallery media={allMedia} settings={s} templateId={campaign.layoutTemplateId} isAdmin={isAdmin} />
    : renderAdapter(effectiveId, allMedia, s);
  return s.unifiedBgType !== 'none'
    ? <Box style={{ ...bgStyle, borderRadius: s.imageBorderRadius, overflow: 'hidden', padding: '16px' }}>{inner}</Box>
    : <>{inner}</>;
}

interface PerTypeGallerySectionProps extends GallerySectionProps {
  breakpoint: Breakpoint;
}

function VideoGallerySection({ campaign, settings: s, breakpoint, isAdmin }: PerTypeGallerySectionProps) {
  const id = campaign.videoAdapterId || resolveAdapterId(s, 'video', breakpoint);
  const videoSettings = { ...s, tileSize: s.videoTileSize ?? s.tileSize };
  const bgStyle = resolveViewportBg(s.videoBgType, s.videoBgColor, s.videoBgGradient, s.videoBgImageUrl);
  const inner = id === 'classic'
    ? <VideoCarousel videos={campaign.videos} settings={videoSettings} />
    : id === 'layout-builder' && campaign.layoutTemplateId
      ? <LayoutBuilderGallery media={campaign.videos} settings={videoSettings} templateId={campaign.layoutTemplateId} isAdmin={isAdmin} />
      : renderAdapter(id, campaign.videos, videoSettings);
  return s.videoBgType !== 'none'
    ? <Box style={{ ...bgStyle, borderRadius: s.videoBorderRadius, overflow: 'hidden', padding: '16px' }}>{inner}</Box>
    : <>{inner}</>;
}

function ImageGallerySection({ campaign, settings: s, breakpoint, isAdmin }: PerTypeGallerySectionProps) {
  const id = campaign.imageAdapterId || resolveAdapterId(s, 'image', breakpoint);
  const imageSettings = { ...s, tileSize: s.imageTileSize ?? s.tileSize };
  const bgStyle = resolveViewportBg(s.imageBgType, s.imageBgColor, s.imageBgGradient, s.imageBgImageUrl);
  const inner = id === 'classic'
    ? <ImageCarousel images={campaign.images} settings={imageSettings} />
    : id === 'layout-builder' && campaign.layoutTemplateId
      ? <LayoutBuilderGallery media={campaign.images} settings={imageSettings} templateId={campaign.layoutTemplateId} isAdmin={isAdmin} />
      : renderAdapter(id, campaign.images, imageSettings);
  return s.imageBgType !== 'none'
    ? <Box style={{ ...bgStyle, borderRadius: s.imageBorderRadius, overflow: 'hidden', padding: '16px' }}>{inner}</Box>
    : <>{inner}</>;
}

interface CampaignViewerProps {
  campaign: Campaign;
  opened: boolean;
  hasAccess: boolean;
  galleryBehaviorSettings: GalleryBehaviorSettings;
  isAdmin: boolean;
  apiClient?: ApiClient;
  onClose: () => void;
}

export function CampaignViewer({
  campaign,
  opened,
  hasAccess,
  galleryBehaviorSettings,
  isAdmin,
  apiClient,
  onClose,
}: CampaignViewerProps) {
  const s = galleryBehaviorSettings;
  const { setActiveCampaign } = useCampaignContext();
  // P22-K5: Keep CampaignContext in sync with viewer open/close
  useEffect(() => {
    setActiveCampaign(opened ? campaign : null);
    return () => setActiveCampaign(null);
  }, [opened, campaign, setActiveCampaign]);
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
  // Reactive media query so fullScreen updates on orientation changes / resizes
  const isMobile = useMediaQuery('(max-width: 48em)'); // ≤ 768px
  // P15-A: Per-breakpoint adapter resolution
  const containerRef = useRef<HTMLDivElement>(null);
  const breakpoint = useBreakpoint(containerRef);
  // P21-F: Fullscreen and conditional rendering
  const useFullscreen = !!isMobile || !!s.campaignModalFullscreen;
  const galleriesOnly = s.campaignOpenMode === 'galleries-only';
  const showStats = (s.showCampaignStats !== false) && (!s.campaignStatsAdminOnly || isAdmin);
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
      size={useFullscreen ? '100%' : (s.modalMaxWidth > 0 ? `${s.modalMaxWidth}px` : 'xl')}
      padding={0}
      withCloseButton
      closeButtonProps={{ 'aria-label': 'Close campaign viewer', size: 'lg' }}
      transitionProps={{ transition, duration: s.modalTransitionDuration }}
      radius={useFullscreen ? 0 : 'lg'}
      fullScreen={useFullscreen}
      styles={{
        content: useFullscreen
          ? { overflow: 'auto', maxHeight: '100dvh', ...modalBgStyle }
          : { overflow: 'auto', maxHeight: `${s.modalMaxHeight}dvh` },
        header: { position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'transparent', padding: 0 },
        close: { color: 'white', background: 'rgba(0,0,0,0.65)', borderRadius: '50%', width: 36, height: 36 },
      }}
      aria-label={`Campaign details for ${campaign.title}`}
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
          src={campaign.coverImage}
          alt={campaign.title}
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
            <CompanyLogo logo={campaign.company.logo} companyName={campaign.company.name} />
            <span>{campaign.company.name}</span>
          </Group>
        </Badge>
        )}

        {/* Title and meta overlay */}
        <Box pos="absolute" bottom={0} left={0} right={0} p={{ base: 'md', md: 'lg' }}>
          <Title order={2} size="h3" mb="sm" style={campaignTitleStyle}>
            {campaign.title}
          </Title>
          {s.showCampaignDate !== false && (
          <Group gap="lg" wrap="wrap">
            <Group gap={4}>
              <IconCalendar size={16} color="var(--wpsg-color-text-muted)" />
              <Text size="sm" c="dimmed" style={campaignDateStyle}>
                {new Date(campaign.createdAt).toLocaleDateString('en-US', {
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
                {campaign.tags.join(', ')}
              </Text>
            </Group>
            )}
          </Group>
          )}
        </Box>
      </Box>
      )}

      {/* Content */}
      <Box ref={containerRef} p={galleriesOnly || useFullscreen ? 0 : { base: 'md', md: 'xl' }} style={{ maxWidth: s.fullscreenContentMaxWidth && s.fullscreenContentMaxWidth > 0 ? `${s.fullscreenContentMaxWidth}px` : '64rem', marginLeft: 'auto', marginRight: 'auto' }}>
        <Stack gap="lg">
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
              {campaign.description}
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
          {hasAccess && (campaign.videos.length > 0 || campaign.images.length > 0) && (
          <Box style={{
            maxWidth: s.modalGalleryMaxWidth > 0 ? `${s.modalGalleryMaxWidth}px` : '100%',
            marginInline: 'auto',
            paddingLeft: s.modalGalleryMargin > 0 ? `${s.modalGalleryMargin}px` : undefined,
            paddingRight: s.modalGalleryMargin > 0 ? `${s.modalGalleryMargin}px` : undefined,
          }}>
            <Suspense fallback={
              <Center py="xl" mih={200}>
                <Stack align="center" gap="xs">
                  <Loader size="md" />
                  <Text size="sm" c="dimmed">Loading gallery…</Text>
                </Stack>
              </Center>
            }>
            <Stack gap={s.modalGalleryGap ?? 32}>
              {galleryBehaviorSettings.unifiedGalleryEnabled ? (
                <UnifiedGallerySection campaign={campaign} settings={galleryBehaviorSettings} isAdmin={isAdmin} />
              ) : (
                <>
                  {campaign.videos.length > 0 && (
                    <VideoGallerySection campaign={campaign} settings={galleryBehaviorSettings} breakpoint={breakpoint} isAdmin={isAdmin} />
                  )}
                  {campaign.images.length > 0 && (
                    <ImageGallerySection campaign={campaign} settings={galleryBehaviorSettings} breakpoint={breakpoint} isAdmin={isAdmin} />
                  )}
                </>
              )}
            </Stack>
            </Suspense>
          </Box>
          )}

          {hasAccess && campaign.videos.length === 0 && campaign.images.length === 0 && (
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
              <Text size="xl" fw={700} style={campaignStatsValueStyle}>{campaign.videos.length}</Text>
              <Text size="sm" c="dimmed" style={campaignStatsLabelStyle}>Videos</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} style={campaignStatsValueStyle}>{campaign.images.length}</Text>
              <Text size="sm" c="dimmed" style={campaignStatsLabelStyle}>Images</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} style={campaignStatsValueStyle}>{campaign.tags.length}</Text>
              <Text size="sm" c="dimmed" style={campaignStatsLabelStyle}>Tags</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} style={campaignStatsValueStyle}>
                {campaign.visibility === 'public' ? '🌐' : '🔒'}
              </Text>
              <Text size="sm" c="dimmed" style={campaignStatsLabelStyle}>
                {campaign.visibility === 'public' ? 'Public' : 'Private'}
              </Text>
            </Paper>
          </SimpleGrid>
          </Box>
          )}
        </Stack>
      </Box>
    </Modal>
  );
}
