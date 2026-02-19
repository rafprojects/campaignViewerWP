import { lazy, Suspense } from 'react';
import { IconArrowLeft, IconCalendar, IconTag } from '@tabler/icons-react';
import { Modal, Image, Button, Badge, Group, Stack, Title, Text, Paper, SimpleGrid, Box, Center, Loader } from '@mantine/core';
import type { Campaign, GalleryBehaviorSettings, MediaItem } from '@/types';

/**
 * Dispatch a gallery adapter by ID. 'classic' is handled separately in the
 * caller because image/video carousels have different props. All other adapter
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

interface CampaignViewerProps {
  campaign: Campaign;
  hasAccess: boolean;
  galleryBehaviorSettings: GalleryBehaviorSettings;
  isAdmin: boolean;
  onEditCampaign?: (campaign: Campaign) => void;
  onArchiveCampaign?: (campaign: Campaign) => void;
  onAddExternalMedia?: (campaign: Campaign) => void;
  onClose: () => void;
}

export function CampaignViewer({
  campaign,
  hasAccess,
  galleryBehaviorSettings,
  isAdmin,
  onEditCampaign,
  onArchiveCampaign,
  onAddExternalMedia,
  onClose,
}: CampaignViewerProps) {
  return (
    <Modal
      opened={true}
      onClose={onClose}
      fullScreen
      padding={0}
      withCloseButton={false}
      transitionProps={{ transition: 'fade', duration: 200 }}
      styles={{
        content: { overflow: 'auto' },
      }}
      aria-label={`Campaign details for ${campaign.title}`}
    >
      {/* Cover Image Header */}
      <Box pos="relative" h={{ base: 220, sm: 280, md: 320 }} component="div">
        <Image 
          src={campaign.coverImage}
          alt={campaign.title}
          h={{ base: 220, sm: 280, md: 320 }}
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

        {/* Back button */}
        <Button
          pos="absolute"
          top={{ base: 12, sm: 16 }}
          left={{ base: 12, sm: 16 }}
          leftSection={<IconArrowLeft size={20} />}
          onClick={onClose}
          variant="light"
          color="dark"
          radius="xl"
          aria-label="Back to gallery"
          size="sm"
          style={{ minHeight: 44 }}
        >
          Back
        </Button>

        {/* Company badge */}
        <Badge
          pos="absolute"
          top={16}
          right={16}
          style={{ backgroundColor: campaign.company.brandColor }}
          size="lg"
        >
          <Group gap={8}>
            <span>{campaign.company.logo}</span>
            <span>{campaign.company.name}</span>
          </Group>
        </Badge>

        {/* Title and meta overlay */}
        <Box pos="absolute" bottom={0} left={0} right={0} p={{ base: 'md', md: 'lg' }}>
          <Title order={1} size="h1" mb="sm">
            {campaign.title}
          </Title>
          <Group gap="lg" wrap="wrap">
            <Group gap={4}>
              <IconCalendar size={16} color="var(--wpsg-color-text-muted)" />
              <Text size="sm" c="dimmed">
                {new Date(campaign.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </Group>
            <Group gap={4}>
              <IconTag size={16} color="var(--wpsg-color-text-muted)" />
              <Text size="sm" c="dimmed">
                {campaign.tags.join(', ')}
              </Text>
            </Group>
          </Group>
        </Box>
      </Box>

      {/* Content */}
      <Box p={{ base: 'md', md: 'xl' }} style={{ maxWidth: '64rem', marginLeft: 'auto', marginRight: 'auto' }}>
        <Stack gap="xl">
          {/* Description */}
          <Box>
            <Title order={2} size="h4" mb="sm">About this Campaign</Title>
            <Text c="dimmed" lh={1.6}>
              {campaign.description}
            </Text>
          </Box>

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
            <Suspense fallback={<Center py="md"><Loader /></Center>}>
              {galleryBehaviorSettings.unifiedGalleryEnabled ? (
                // Unified mode: all media merged and sorted by order → single adapter
                (() => {
                  const allMedia = [...campaign.videos, ...campaign.images].sort(
                    (a, b) => a.order - b.order,
                  );
                  if (allMedia.length === 0) return null;
                  return renderAdapter(galleryBehaviorSettings.unifiedGalleryAdapterId, allMedia, galleryBehaviorSettings);
                })()
              ) : (
                // Per-type mode: each media kind uses its own adapter
                <>
                  {campaign.videos.length > 0 && (() => {
                    const id = galleryBehaviorSettings.videoGalleryAdapterId;
                    if (id === 'classic') return <VideoCarousel videos={campaign.videos} settings={galleryBehaviorSettings} />;
                    return renderAdapter(id, campaign.videos, galleryBehaviorSettings);
                  })()}
                  {campaign.images.length > 0 && (() => {
                    const id = galleryBehaviorSettings.imageGalleryAdapterId;
                    if (id === 'classic') return <ImageCarousel images={campaign.images} settings={galleryBehaviorSettings} />;
                    return renderAdapter(id, campaign.images, galleryBehaviorSettings);
                  })()}
                </>
              )}
            </Suspense>
          )}

          {/* Campaign Stats */}
          <Box component="section" aria-labelledby="campaign-stats-heading">
            <Title order={3} size="h6" mb="sm" id="campaign-stats-heading" className="wpsg-sr-only">Campaign Statistics</Title>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={{ base: 'sm', md: 'md' }} py="md" style={{ borderTopWidth: 1, borderTopColor: 'var(--wpsg-color-border)' }}>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700}>{campaign.videos.length}</Text>
              <Text size="sm" c="dimmed">Videos</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700}>{campaign.images.length}</Text>
              <Text size="sm" c="dimmed">Images</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700}>{campaign.tags.length}</Text>
              <Text size="sm" c="dimmed">Tags</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700}>
                {campaign.visibility === 'public' ? '🌐' : '🔒'}
              </Text>
              <Text size="sm" c="dimmed">
                {campaign.visibility === 'public' ? 'Public' : 'Private'}
              </Text>
            </Paper>
          </SimpleGrid>
          </Box>

          {/* Admin Section */}
          {isAdmin && (
            <Paper p="lg" radius="md" withBorder bg="var(--wpsg-color-surface)" component="section" aria-labelledby="admin-actions-heading">
              <Stack gap="md">
                <Box>
                  <Title order={3} size="h5" mb={4} id="admin-actions-heading">Admin Actions</Title>
                </Box>
                
                <Group gap="md" wrap="wrap">
                  <Button
                    onClick={() => onEditCampaign?.(campaign)}
                    style={{ flex: '1 1 160px' }}
                    size="sm"
                    aria-label={`Edit ${campaign.title}`}
                  >
                    Edit Campaign
                  </Button>
                  <Button
                    onClick={() => onAddExternalMedia?.(campaign)}
                    style={{ flex: '1 1 160px' }}
                    size="sm"
                    aria-label={`Manage media for ${campaign.title}`}
                  >
                    Manage Media
                  </Button>
                  <Button
                    color="red"
                    onClick={() => onArchiveCampaign?.(campaign)}
                    style={{ flex: '1 1 160px' }}
                    size="sm"
                    aria-label={`Archive ${campaign.title}`}
                  >
                    Archive Campaign
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Box>
    </Modal>
  );
}
