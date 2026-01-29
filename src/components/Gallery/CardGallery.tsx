import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Container, Group, Stack, Title, Text, Tabs, SegmentedControl, Alert, Box, SimpleGrid, Center } from '@mantine/core';
import { CampaignCard } from './CampaignCard';
import { CampaignViewer } from '@/components/Campaign/CampaignViewer';
import type { Campaign } from '@/types';
import styles from './CardGallery.module.scss';

interface CardGalleryProps {
  campaigns: Campaign[];
  userPermissions: string[];
  accessMode?: 'lock' | 'hide';
  isAdmin?: boolean;
  onAccessModeChange?: (mode: 'lock' | 'hide') => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onArchiveCampaign?: (campaign: Campaign) => void;
  onAddExternalMedia?: (campaign: Campaign) => void;
}

export function CardGallery({
  campaigns,
  userPermissions,
  accessMode = 'lock',
  isAdmin = false,
  onAccessModeChange,
  onEditCampaign,
  onArchiveCampaign,
  onAddExternalMedia,
}: CardGalleryProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const companies = [...new Set(campaigns.map((c) => c.company.name))];

  const hasAccess = (campaignId: string, visibility: 'public' | 'private') => {
    return visibility === 'public' || userPermissions.includes(campaignId);
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (filter === 'all') return true;
    if (filter === 'accessible') return hasAccess(campaign.id, campaign.visibility);
    return campaign.company.name === filter;
  }).filter((campaign) => {
    if (accessMode !== 'hide') {
      return true;
    }
    if (filter === 'accessible') {
      return true;
    }
    return hasAccess(campaign.id, campaign.visibility);
  });

  const accessibleCount = campaigns.filter((campaign) =>
    hasAccess(campaign.id, campaign.visibility),
  ).length;
  const hiddenCount = Math.max(0, campaigns.length - accessibleCount);
  const showHiddenNotice = accessMode === 'hide' && filter === 'all' && hiddenCount > 0;

  return (
    <Box className={styles.gallery}>
      {/* Header */}
      <Box component="header" className={styles.header}>
        <Container size="xl" py="md">
          <Stack gap="lg">
            {/* Title and subtitle */}
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
              <Stack gap={0}>
                <Title order={1} size="h3" c="white">Campaign Gallery</Title>
                <Text c="dimmed" size="sm">Browse and access your campaign media</Text>
              </Stack>

              {/* Admin controls */}
              {isAdmin && (
                <Group gap="sm" align="center">
                  <Text size="xs" fw={600} tt="uppercase" c="gray.3">Access mode</Text>
                  <SegmentedControl
                    value={accessMode}
                    onChange={(v) => onAccessModeChange?.(v as 'lock' | 'hide')}
                    data={[
                      { label: 'Lock', value: 'lock' },
                      { label: 'Hide', value: 'hide' },
                    ]}
                    size="xs"
                  />
                </Group>
              )}
            </Group>

            {/* Filter tabs */}
            <Tabs value={filter} onChange={(v) => setFilter(v ?? 'all')} defaultValue="all">
              <Tabs.List>
                <Tabs.Tab value="all">All</Tabs.Tab>
                <Tabs.Tab value="accessible">My Access</Tabs.Tab>
                {companies.map((company) => (
                  <Tabs.Tab key={company} value={company}>
                    {company}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>

            {/* Hidden notice */}
            {showHiddenNotice && (
              <Alert color="yellow" title="Access mode active">
                {hiddenCount} campaign{hiddenCount === 1 ? '' : 's'} hidden by access mode.
              </Alert>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Gallery Grid */}
      <Container size="xl" component="main" py="xl">
        <motion.div layout>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            <AnimatePresence mode="popLayout">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  hasAccess={hasAccess(campaign.id, campaign.visibility)}
                  onClick={() => setSelectedCampaign(campaign)}
                />
              ))}
            </AnimatePresence>
          </SimpleGrid>
        </motion.div>

        {filteredCampaigns.length === 0 && (
          <Center py={80}>
            <Stack align="center">
              <Text size="lg" c="dimmed">
                {filter === 'accessible'
                  ? 'No accessible campaigns yet.'
                  : accessMode === 'hide'
                    ? 'No accessible campaigns found. Switch to Lock mode to view locked cards.'
                    : 'No campaigns found matching your filter.'}
              </Text>
            </Stack>
          </Center>
        )}
      </Container>

      {/* Campaign Viewer Modal */}
      <AnimatePresence>
        {selectedCampaign && (
          <CampaignViewer
            campaign={selectedCampaign}
            hasAccess={hasAccess(selectedCampaign.id, selectedCampaign.visibility)}
            isAdmin={isAdmin}
            onEditCampaign={onEditCampaign}
            onArchiveCampaign={onArchiveCampaign}
            onAddExternalMedia={onAddExternalMedia}
            onClose={() => setSelectedCampaign(null)}
          />
        )}
      </AnimatePresence>
    </Box>
  );
}
