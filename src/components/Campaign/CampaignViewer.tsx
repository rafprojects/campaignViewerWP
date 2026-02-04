import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import { Modal, Image, Button, Badge, Group, Stack, Title, Text, Paper, SimpleGrid, Box } from '@mantine/core';
import { VideoCarousel } from './VideoCarousel';
import { ImageCarousel } from './ImageCarousel';
import type { Campaign } from '@/types';

interface CampaignViewerProps {
  campaign: Campaign;
  hasAccess: boolean;
  isAdmin: boolean;
  onEditCampaign?: (campaign: Campaign) => void;
  onArchiveCampaign?: (campaign: Campaign) => void;
  onAddExternalMedia?: (campaign: Campaign) => void;
  onClose: () => void;
}

export function CampaignViewer({
  campaign,
  hasAccess,
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
            background: 'linear-gradient(to top, rgba(30, 41, 59, 1) 0%, rgba(30, 41, 59, 0.6) 45%, transparent 80%)',
            pointerEvents: 'none'
          }}
        />

        {/* Back button */}
        <Button
          pos="absolute"
          top={{ base: 12, sm: 16 }}
          left={{ base: 12, sm: 16 }}
          leftSection={<ArrowLeft size={20} />}
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
          <Title order={1} size="h1" c="white" mb="sm">
            {campaign.title}
          </Title>
          <Group gap="lg" wrap="wrap">
            <Group gap={4}>
              <Calendar size={16} color="#cbd5e1" />
              <Text size="sm" c="gray.4">
                {new Date(campaign.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </Group>
            <Group gap={4}>
              <Tag size={16} color="#cbd5e1" />
              <Text size="sm" c="gray.4">
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

          {/* Videos Section */}
          {hasAccess && campaign.videos.length > 0 && (
            <VideoCarousel videos={campaign.videos} />
          )}

          {/* Images Section */}
          {hasAccess && campaign.images.length > 0 && (
            <ImageCarousel images={campaign.images} />
          )}

          {/* Campaign Stats */}
          <Box component="section" aria-labelledby="campaign-stats-heading">
            <Title order={2} size="h6" mb="sm" id="campaign-stats-heading" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Campaign Statistics</Title>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={{ base: 'sm', md: 'md' }} py="md" style={{ borderTopWidth: 1, borderTopColor: 'var(--color-border)' }}>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} c="white">{campaign.videos.length}</Text>
              <Text size="sm" c="dimmed">Videos</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} c="white">{campaign.images.length}</Text>
              <Text size="sm" c="dimmed">Images</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} c="white">{campaign.tags.length}</Text>
              <Text size="sm" c="dimmed">Tags</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder ta="center">
              <Text size="xl" fw={700} c="white">
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
            <Paper p="lg" radius="md" withBorder bg="dark.8" component="section" aria-labelledby="admin-actions-heading">
              <Stack gap="md">
                <Box>
                  <Title order={2} size="h5" mb={4} id="admin-actions-heading">Admin Actions</Title>
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
