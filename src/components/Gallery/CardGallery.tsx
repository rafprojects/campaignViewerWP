import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Container, Group, Stack, Title, Text, Tabs, SegmentedControl, Alert, Box, SimpleGrid, Center, Loader, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { CampaignCard } from './CampaignCard';
import { OverlayArrows } from '@/components/Campaign/OverlayArrows';
import { DotNavigator } from '@/components/Campaign/DotNavigator';
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
  // Keep a ref to the last campaign so CampaignViewer stays mounted during close animation
  const lastCampaignRef = useRef<Campaign | null>(null);
  if (selectedCampaign) lastCampaignRef.current = selectedCampaign;
  const displayedCampaign = selectedCampaign ?? lastCampaignRef.current;
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load-more state
  const LOAD_MORE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE_SIZE);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const displayMode = galleryBehaviorSettings.cardDisplayMode ?? 'load-more';

  /** Resolve effective column count based on settings + current breakpoint. */
  const getEffectiveColumns = useCallback((): number => {
    const cols = galleryBehaviorSettings.cardGridColumns;
    if (cols > 0) return cols;
    // Responsive auto: match Mantine's base:1 sm:2 lg:3 breakpoints
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
    if (w >= 1200) return 3;  // lg
    if (w >= 768) return 2;   // sm
    return 1;                 // base
  }, [galleryBehaviorSettings.cardGridColumns]);

  const [effectiveColumns, setEffectiveColumns] = useState(getEffectiveColumns);

  // Update columns on resize
  useEffect(() => {
    if (displayMode !== 'paginated') return;
    const handleResize = () => setEffectiveColumns(getEffectiveColumns());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [displayMode, getEffectiveColumns]);

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

  // Pagination math
  const rowsPerPage = galleryBehaviorSettings.cardRowsPerPage ?? 3;
  const cardsPerPage = rowsPerPage * effectiveColumns;
  const totalPages = displayMode === 'paginated' && cardsPerPage > 0
    ? Math.ceil(filteredCampaigns.length / cardsPerPage)
    : 1;

  // Reset state when filters/mode change
  useEffect(() => {
    setVisibleCount(LOAD_MORE_SIZE);
    setCurrentPage(0);
    setSlideDirection(null);
    setIsAnimating(false);
  }, [filter, searchQuery, accessMode, displayMode]);

  // Clamp currentPage if totalPages shrinks (e.g. resize or filter change)
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [currentPage, totalPages]);

  // Compute visible campaigns based on display mode
  const visibleCampaigns = useMemo(() => {
    if (displayMode === 'show-all') return filteredCampaigns;
    if (displayMode === 'paginated') {
      const start = currentPage * cardsPerPage;
      return filteredCampaigns.slice(start, start + cardsPerPage);
    }
    // load-more
    return filteredCampaigns.slice(0, visibleCount);
  }, [filteredCampaigns, displayMode, currentPage, cardsPerPage, visibleCount]);

  const hasMore = displayMode === 'load-more' && visibleCount < filteredCampaigns.length;

  // Page navigation handlers
  const goToPage = useCallback((page: number) => {
    if (isAnimating || page < 0 || page >= totalPages || page === currentPage) return;
    const dir = page > currentPage ? 'left' : 'right';
    setSlideDirection(dir);
    setIsAnimating(true);
    const duration = galleryBehaviorSettings.cardPageTransitionMs ?? 300;
    setTimeout(() => {
      setCurrentPage(page);
      setSlideDirection(null);
      setIsAnimating(false);
    }, duration);
  }, [currentPage, galleryBehaviorSettings.cardPageTransitionMs, isAnimating, totalPages]);

  const goPrev = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const goNext = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);

  // Keyboard navigation for paginated mode
  useEffect(() => {
    if (displayMode !== 'paginated' || totalPages <= 1) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    const container = gridContainerRef.current;
    container?.addEventListener('keydown', handleKey);
    return () => container?.removeEventListener('keydown', handleKey);
  }, [displayMode, totalPages, goPrev, goNext]);

  // Slide animation styles
  const transitionMs = galleryBehaviorSettings.cardPageTransitionMs ?? 300;
  const slideStyle: React.CSSProperties = displayMode === 'paginated' ? {
    transform: slideDirection === 'left'
      ? 'translateX(-100%)'
      : slideDirection === 'right'
        ? 'translateX(100%)'
        : 'translateX(0)',
    transition: slideDirection ? `transform ${transitionMs}ms ease` : 'none',
    opacity: slideDirection ? 0.3 : 1,
  } : {};

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
                style={{ minWidth: 'min(200px, 100%)', maxWidth: 280 }}
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
        {/* Pagination wrapper — relative for overlay arrows */}
        <Box
          ref={gridContainerRef}
          style={{ position: 'relative', overflow: 'hidden' }}
          tabIndex={displayMode === 'paginated' ? 0 : undefined}
          aria-label={displayMode === 'paginated' ? `Card gallery page ${currentPage + 1} of ${totalPages}` : undefined}
        >
          <div style={slideStyle}>
            <SimpleGrid
              cols={galleryBehaviorSettings.cardGridColumns > 0
                ? galleryBehaviorSettings.cardGridColumns
                : { base: 1, sm: 2, lg: 3 }
              }
              spacing={galleryBehaviorSettings.cardGap}
            >
              {visibleCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  hasAccess={hasAccess(campaign.id, campaign.visibility)}
                  onClick={() => setSelectedCampaign(campaign)}
                  settings={galleryBehaviorSettings}
                />
              ))}
            </SimpleGrid>
          </div>

          {/* Overlay arrows for paginated mode */}
          {displayMode === 'paginated' && totalPages > 1 && (
            <OverlayArrows
              onPrev={goPrev}
              onNext={goNext}
              total={totalPages}
              settings={galleryBehaviorSettings}
              previousLabel="Previous page"
              nextLabel="Next page"
            />
          )}
        </Box>

        {/* Dot navigator + page indicator for paginated mode */}
        {displayMode === 'paginated' && totalPages > 1 && (
          <Stack align="center" gap={4} mt="sm">
            {galleryBehaviorSettings.cardPageDotNav && (
              <DotNavigator
                total={totalPages}
                currentIndex={currentPage}
                onSelect={(page) => goToPage(page)}
                settings={galleryBehaviorSettings}
              />
            )}
            <Text size="xs" c="dimmed">
              Page {currentPage + 1} of {totalPages}
            </Text>
          </Stack>
        )}

        {/* Load more button */}
        {hasMore && (
          <Center mt="xl">
            <Button
              variant="light"
              size="md"
              onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_SIZE)}
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

      {/* Campaign Viewer Modal — always mounted so open/close transitions animate */}
      {displayedCampaign && (
        <Suspense fallback={<Center py="xl"><Loader /></Center>}>
          <CampaignViewer
            campaign={displayedCampaign}
            opened={!!selectedCampaign}
            hasAccess={hasAccess(displayedCampaign.id, displayedCampaign.visibility)}
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
