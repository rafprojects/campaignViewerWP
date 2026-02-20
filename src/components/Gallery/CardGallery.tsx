import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Container, Group, Stack, Title, Text, Tabs, SegmentedControl, Alert, Box, SimpleGrid, Center, Loader, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { CampaignCard } from './CampaignCard';
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import styles from './CardGallery.module.scss';

const CampaignViewer = lazy(() => import('@/components/Campaign/CampaignViewer').then((m) => ({ default: m.CampaignViewer })));

interface CardGalleryProps {
  campaigns: Campaign[];
  userPermissions: string[];
  accessMode?: 'lock' | 'hide';
  galleryBehaviorSettings: GalleryBehaviorSettings;
  isAdmin?: boolean;
  isAuthenticated?: boolean;
  onAccessModeChange?: (mode: 'lock' | 'hide') => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onArchiveCampaign?: (campaign: Campaign) => void;
  onAddExternalMedia?: (campaign: Campaign) => void;
}

export function CardGallery({
  campaigns,
  userPermissions,
  accessMode = 'lock',
  galleryBehaviorSettings,
  isAdmin = false,
  isAuthenticated = false,
  onAccessModeChange,
  onEditCampaign,
  onArchiveCampaign,
  onAddExternalMedia,
}: CardGalleryProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);

  const PAGE_SIZE = 12;

  const companies = useMemo(() => [...new Set(campaigns.map((c) => c.company.name))], [campaigns]);

  const hasAccess = useCallback((campaignId: string, visibility: 'public' | 'private') => {
    return visibility === 'public' || userPermissions.includes(campaignId);
  }, [userPermissions]);

  const filteredCampaigns = useMemo(() => {
    const lowerSearch = searchQuery.toLowerCase().trim();
    return campaigns.filter((campaign) => {
      // Tab filter
      if (filter === 'accessible' && !hasAccess(campaign.id, campaign.visibility)) return false;
      if (filter !== 'all' && filter !== 'accessible' && campaign.company.name !== filter) return false;
      // Hide mode filter
      if (accessMode === 'hide' && filter !== 'accessible' && !hasAccess(campaign.id, campaign.visibility)) return false;
      // Text search
      if (lowerSearch) {
        const haystack = `${campaign.title} ${campaign.description} ${campaign.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(lowerSearch)) return false;
      }
      return true;
    });
  }, [accessMode, campaigns, filter, hasAccess, searchQuery]);

  const accessibleCount = useMemo(() => campaigns.filter((campaign) =>
    hasAccess(campaign.id, campaign.visibility),
  ).length, [campaigns, hasAccess]);
  const hiddenCount = useMemo(() => Math.max(0, campaigns.length - accessibleCount), [accessibleCount, campaigns.length]);
  const showHiddenNotice = useMemo(() => accessMode === 'hide' && filter === 'all' && hiddenCount > 0, [accessMode, filter, hiddenCount]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, searchQuery, accessMode]);

  const visibleCampaigns = useMemo(
    () => filteredCampaigns.slice(0, visibleCount),
    [filteredCampaigns, visibleCount],
  );
  const hasMore = visibleCount < filteredCampaigns.length;

  return (
    <Box className={styles.gallery}>
      {/* Header */}
      <Box component="header" className={styles.header}>
        <Container size="xl" py={{ base: 'sm', md: 'md' }}>
          <Stack gap="lg">
            {/* Title and subtitle */}
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
              <Stack gap={0}>
                <Title order={1} size="h3">Campaign Gallery</Title>
                <Text c="dimmed" size="sm">Browse and access your campaign media</Text>
              </Stack>

              {/* Admin controls */}
              {isAdmin && (
                <Group gap="sm" align="center">
                  <Text size="xs" fw={600} tt="uppercase" c="dimmed">Access mode</Text>
                  <SegmentedControl
                    value={accessMode}
                    onChange={(v) => onAccessModeChange?.(v as 'lock' | 'hide')}
                    data={[
                      { label: 'Lock', value: 'lock' },
                      { label: 'Hide', value: 'hide' },
                    ]}
                    size="xs"
                    aria-label="Access mode"
                  />
                </Group>
              )}
            </Group>

            {/* Filter tabs */}
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
              <Tabs value={filter} onChange={(v) => setFilter(v ?? 'all')} aria-label="Campaign filters" style={{ flex: '1 1 auto' }}>
                <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                  <Tabs.Tab value="all">All</Tabs.Tab>
                  <Tabs.Tab value="accessible">My Access</Tabs.Tab>
                  {companies.map((company) => (
                    <Tabs.Tab key={company} value={company}>
                      {company}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>
              <TextInput
                placeholder="Search campaigns..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                style={{ minWidth: 200, maxWidth: 280 }}
                size="sm"
                aria-label="Search campaigns by title, description, or tags"
              />
            </Group>

            {/* Hidden notice */}
            {showHiddenNotice && (
              <Alert color="yellow" title="Access mode active" role="status" aria-live="polite">
                {hiddenCount} campaign{hiddenCount === 1 ? '' : 's'} hidden by access mode.
              </Alert>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Gallery Grid */}
      <Container size="xl" component="main" py={{ base: 'lg', md: 'xl' }}>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={{ base: 'md', sm: 'lg' }}>
          {visibleCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              hasAccess={hasAccess(campaign.id, campaign.visibility)}
              onClick={() => setSelectedCampaign(campaign)}
            />
          ))}
        </SimpleGrid>

        {hasMore && (
          <Center mt="xl">
            <Button
              variant="light"
              size="md"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              Load more ({filteredCampaigns.length - visibleCount} remaining)
            </Button>
          </Center>
        )}

        {filteredCampaigns.length === 0 && (
          <Center py={{ base: 60, md: 80 }} role="status" aria-live="polite">
            <Stack align="center" gap="md">
              <Text size="lg" c="dimmed" ta="center">
                {searchQuery.trim()
                  ? 'No campaigns match your search.'
                  : !isAuthenticated && campaigns.length === 0
                    ? 'Sign in to view campaigns.'
                    : filter === 'accessible'
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
      {selectedCampaign && (
        <Suspense fallback={<Center py="xl"><Loader /></Center>}>
          <CampaignViewer
            campaign={selectedCampaign}
            hasAccess={hasAccess(selectedCampaign.id, selectedCampaign.visibility)}
            galleryBehaviorSettings={galleryBehaviorSettings}
            isAdmin={isAdmin}
            onEditCampaign={onEditCampaign}
            onArchiveCampaign={onArchiveCampaign}
            onAddExternalMedia={onAddExternalMedia}
            onClose={() => setSelectedCampaign(null)}
          />
        </Suspense>
      )}
    </Box>
  );
}
