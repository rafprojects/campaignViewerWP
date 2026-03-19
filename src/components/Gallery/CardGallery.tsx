import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Container, Group, Stack, Title, Text, Tabs, SegmentedControl, Alert, Box, SimpleGrid, Center, Loader, TextInput, Switch, Select, ColorInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { CampaignCard } from './CampaignCard';
import { OverlayArrows } from '@/components/Campaign/OverlayArrows';
import { DotNavigator } from '@/components/Campaign/DotNavigator';
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import { useTypographyStyle } from '@/hooks/useTypographyStyle';
import { useInContextSave } from '@/hooks/useInContextSave';
import { InContextEditor } from '@/components/shared/InContextEditor';
import { TypographyEditor, GOOGLE_FONT_NAMES } from '@/components/shared/TypographyEditor';
import { loadGoogleFontsFromOverrides } from '@/utils/loadGoogleFont';
import { buildGradientCss } from '@/utils/gradientCss';
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
  apiClient?: ApiClient;
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
  apiClient,
}: CardGalleryProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  // Keep a ref to the last campaign so CampaignViewer stays mounted during close animation
  const lastCampaignRef = useRef<Campaign | null>(null);
  if (selectedCampaign) lastCampaignRef.current = selectedCampaign;
  const displayedCampaign = selectedCampaign ?? lastCampaignRef.current;
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const viewerTitleStyle = useTypographyStyle('viewerTitle', galleryBehaviorSettings);
  const viewerSubtitleStyle = useTypographyStyle('viewerSubtitle', galleryBehaviorSettings);
  const inContextSave = useInContextSave(apiClient, galleryBehaviorSettings);

  // Load Google Fonts referenced in typography overrides
  useEffect(() => {
    loadGoogleFontsFromOverrides(galleryBehaviorSettings.typographyOverrides, GOOGLE_FONT_NAMES);
  }, [galleryBehaviorSettings.typographyOverrides]);

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
  const isLg = useMediaQuery('(min-width: 1200px)');
  const isSm = useMediaQuery('(min-width: 768px)');
  const effectiveColumns = useMemo((): number => {
    const cols = galleryBehaviorSettings.cardGridColumns;
    const max = galleryBehaviorSettings.cardMaxColumns || 0;
    if (cols > 0) return max > 0 ? Math.min(cols, max) : cols;
    // Responsive auto: base:1 sm:2 lg:3
    const auto = isLg ? 3 : isSm ? 2 : 1;
    return max > 0 ? Math.min(auto, max) : auto;
  }, [galleryBehaviorSettings.cardGridColumns, galleryBehaviorSettings.cardMaxColumns, isLg, isSm]);

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
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending transition timeout on unmount.
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const goToPage = useCallback((page: number) => {
    if (isAnimating || page < 0 || page >= totalPages || page === currentPage) return;
    const dir = page > currentPage ? 'left' : 'right';
    setSlideDirection(dir);
    setIsAnimating(true);
    // Clear any prior pending transition before starting a new one.
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    const duration = galleryBehaviorSettings.cardPageTransitionMs ?? 300;
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
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

  const containerSize = galleryBehaviorSettings.appMaxWidth > 0
    ? galleryBehaviorSettings.appMaxWidth
    : undefined;
  const containerFluid = galleryBehaviorSettings.appMaxWidth === 0;
  const containerPaddingStyle = { paddingInline: galleryBehaviorSettings.appPadding };

  // P21-D: Dynamic viewer background
  const galleryStyle = useMemo<React.CSSProperties | undefined>(() => {
    switch (galleryBehaviorSettings.viewerBgType) {
      case 'transparent': return { background: 'transparent' };
      case 'solid': return { background: galleryBehaviorSettings.viewerBgColor || 'transparent' };
      case 'gradient': return { background: buildGradientCss(galleryBehaviorSettings.viewerBgGradient) || undefined };
      default: return undefined; // 'theme' — use SCSS default
    }
  }, [galleryBehaviorSettings.viewerBgType, galleryBehaviorSettings.viewerBgColor, galleryBehaviorSettings.viewerBgGradient]);

  // P21-D: Header border/shadow control
  const headerStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (galleryBehaviorSettings.showViewerBorder === false) {
      return { borderBottom: 'none', boxShadow: 'none', backdropFilter: 'none', background: 'transparent' };
    }
    return undefined;
  }, [galleryBehaviorSettings.showViewerBorder]);

  return (
    <Box className={styles.gallery} style={galleryStyle}>
      {/* Header */}
      <Box component="header" className={styles.header} style={{ ...headerStyle, position: 'relative' }}>
        <InContextEditor
          visible={!!isAdmin && galleryBehaviorSettings.showInContextEditors}
          position="top-right"
        >
          <Stack gap="sm">
            <Text fw={600} size="xs">Viewer Header Settings</Text>
            <Switch
              label="Show Title"
              checked={galleryBehaviorSettings.showGalleryTitle}
              onChange={(e) => inContextSave('showGalleryTitle', e.currentTarget.checked)}
              size="xs"
            />
            <Switch
              label="Show Subtitle"
              checked={galleryBehaviorSettings.showGallerySubtitle}
              onChange={(e) => inContextSave('showGallerySubtitle', e.currentTarget.checked)}
              size="xs"
            />
            <TextInput
              label="Title Text"
              value={galleryBehaviorSettings.galleryTitleText}
              onChange={(e) => inContextSave('galleryTitleText', e.currentTarget.value)}
              size="xs"
            />
            <TextInput
              label="Subtitle Text"
              value={galleryBehaviorSettings.gallerySubtitleText}
              onChange={(e) => inContextSave('gallerySubtitleText', e.currentTarget.value)}
              size="xs"
            />
            <Select
              label="Background Type"
              value={galleryBehaviorSettings.viewerBgType}
              onChange={(v) => inContextSave('viewerBgType', v)}
              data={[
                { value: 'theme', label: 'Theme' },
                { value: 'transparent', label: 'Transparent' },
                { value: 'solid', label: 'Solid Color' },
                { value: 'gradient', label: 'Gradient' },
              ]}
              size="xs"
            />
            {galleryBehaviorSettings.viewerBgType === 'solid' && (
              <ColorInput
                label="Background Color"
                value={galleryBehaviorSettings.viewerBgColor}
                onChange={(v) => inContextSave('viewerBgColor', v)}
                size="xs"
              />
            )}
            <Text fw={500} size="xs" mt="xs">Title Typography</Text>
            <TypographyEditor
              value={galleryBehaviorSettings.typographyOverrides['viewerTitle'] ?? {}}
              onChange={(v) => {
                const overrides = { ...galleryBehaviorSettings.typographyOverrides };
                if (Object.keys(v).length === 0) delete overrides['viewerTitle'];
                else overrides['viewerTitle'] = v;
                inContextSave('typographyOverrides', overrides);
              }}
            />
          </Stack>
        </InContextEditor>
        <Container size={containerSize} fluid={containerFluid} py={{ base: 'sm', md: 'md' }} style={containerPaddingStyle}>
          <Stack gap="lg">
            {/* Title and subtitle */}
            {(galleryBehaviorSettings.showGalleryTitle || galleryBehaviorSettings.showGallerySubtitle || (isAdmin && galleryBehaviorSettings.showAccessMode)) && (
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
              {(galleryBehaviorSettings.showGalleryTitle || galleryBehaviorSettings.showGallerySubtitle) && (
              <Stack gap={0}>
                {galleryBehaviorSettings.showGalleryTitle && <Title order={1} size="h3" style={viewerTitleStyle}>{galleryBehaviorSettings.galleryTitleText || 'Gallery'}</Title>}
                {galleryBehaviorSettings.showGallerySubtitle && galleryBehaviorSettings.gallerySubtitleText && <Text c="dimmed" size="sm" style={viewerSubtitleStyle}>{galleryBehaviorSettings.gallerySubtitleText}</Text>}
              </Stack>
              )}

              {/* Admin controls */}
              {isAdmin && galleryBehaviorSettings.showAccessMode && (
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
            )}

            {/* Filter tabs */}
            {(galleryBehaviorSettings.showFilterTabs || galleryBehaviorSettings.showSearchBox) && (
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="md" style={{ overflow: 'hidden' }}>
              {galleryBehaviorSettings.showFilterTabs && (
              <Tabs value={filter} onChange={(v) => setFilter(v ?? 'all')} aria-label="Campaign filters" style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
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
              )}
              {galleryBehaviorSettings.showSearchBox && (
              <TextInput
                placeholder="Search campaigns..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                style={{ minWidth: 'min(200px, 100%)', maxWidth: 280 }}
                size="sm"
                aria-label="Search campaigns by title, description, or tags"
              />
              )}
            </Group>
            )}

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
      <Container size={containerSize} fluid={containerFluid} component="main" py={{ base: 'lg', md: 'xl' }} style={containerPaddingStyle}>
        {/* Pagination wrapper — relative for overlay arrows */}
        <Box
          ref={gridContainerRef}
          style={{ position: 'relative', overflow: 'hidden' }}
          tabIndex={displayMode === 'paginated' ? 0 : undefined}
          aria-label={displayMode === 'paginated' ? `Card gallery page ${currentPage + 1} of ${totalPages}` : undefined}
        >
          <div style={slideStyle}>
            {galleryBehaviorSettings.cardMaxWidth > 0 ? (
              <Box
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: `${galleryBehaviorSettings.cardGapV}px ${galleryBehaviorSettings.cardGapH}px`,
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                {visibleCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    hasAccess={hasAccess(campaign.id, campaign.visibility)}
                    onClick={() => setSelectedCampaign(campaign)}
                    settings={galleryBehaviorSettings}
                    apiClient={!hasAccess(campaign.id, campaign.visibility) && !isAdmin ? apiClient : undefined}
                    maxWidth={galleryBehaviorSettings.cardMaxWidth}
                  />
                ))}
              </Box>
            ) : (
              <SimpleGrid
                cols={galleryBehaviorSettings.cardGridColumns > 0
                  ? galleryBehaviorSettings.cardGridColumns
                  : galleryBehaviorSettings.cardMaxColumns > 0
                    ? { base: 1, sm: Math.min(2, galleryBehaviorSettings.cardMaxColumns), lg: Math.min(3, galleryBehaviorSettings.cardMaxColumns) }
                    : { base: 1, sm: 2, lg: 3 }
                }
                spacing={galleryBehaviorSettings.cardGapH}
                verticalSpacing={galleryBehaviorSettings.cardGapV}
              >
                {visibleCampaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    hasAccess={hasAccess(campaign.id, campaign.visibility)}
                    onClick={() => setSelectedCampaign(campaign)}
                    settings={galleryBehaviorSettings}
                    apiClient={!hasAccess(campaign.id, campaign.visibility) && !isAdmin ? apiClient : undefined}
                  />
                ))}
              </SimpleGrid>
            )}
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
              aria-label={`Load ${filteredCampaigns.length - visibleCount} more campaigns`}
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
            apiClient={apiClient}
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
