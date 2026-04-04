import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Container, Group, Stack, Title, Text, Tabs, SegmentedControl, Alert, Box, Center, Loader, TextInput, Switch, Select, ColorInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { CampaignCard } from './CampaignCard';
import { OverlayArrows } from '@/components/Galleries/Shared/OverlayArrows';
import { DotNavigator } from '@/components/Galleries/Shared/DotNavigator';
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import { useTypographyStyle } from '@/hooks/useTypographyStyle';
import { useInContextSave } from '@/hooks/useInContextSave';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { InContextEditor } from '@/components/Common/InContextEditor';
import { TypographyEditor, GOOGLE_FONT_NAMES } from '@/components/Common/TypographyEditor';
import { loadGoogleFontsFromOverrides } from '@/utils/loadGoogleFont';
import { buildGradientCss } from '@/utils/gradientCss';
import { toCss, toCssOrNumber } from '@/utils/cssUnits';
import { resolveCardBreakpointSettings } from '@/utils/cardConfig';
import { resolveColumnsFromWidth } from '@/utils/resolveColumnsFromWidth';
import styles from './CardGallery.module.scss';

const CampaignViewer = lazy(() => import('@/components/CardViewer/CampaignViewer').then((m) => ({ default: m.CampaignViewer })));

interface CardGalleryProps {
  campaigns: Campaign[];
  userPermissions: string[];
  accessMode?: 'lock' | 'hide';
  galleryBehaviorSettings: GalleryBehaviorSettings;
  isAdmin?: boolean;
  isAuthenticated?: boolean;
  onAccessModeChange?: (mode: 'lock' | 'hide') => void;
  onCampaignsUpdated?: () => Promise<unknown> | void;
  onNotify?: (message: { type: 'error' | 'success'; text: string }) => void;
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
  onCampaignsUpdated,
  onNotify,
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

  // Container-based breakpoint resolution → resolved card settings
  const { breakpoint, width: containerWidth } = useBreakpoint(gridContainerRef);
  const s = useMemo(
    () => resolveCardBreakpointSettings(galleryBehaviorSettings, breakpoint),
    [galleryBehaviorSettings, breakpoint],
  );

  const displayMode = s.cardDisplayMode ?? 'load-more';

  /** Resolve effective column count from resolved settings + container width. */
  const effectiveColumns = useMemo((): number => {
    const cols = s.cardGridColumns;
    const max = s.cardMaxColumns || 0;
    if (cols > 0) return max > 0 ? Math.min(cols, max) : cols;
    // Auto mode: use container width + cardAutoColumnsBreakpoints when available
    const auto = containerWidth > 0
      ? resolveColumnsFromWidth(containerWidth, 0, galleryBehaviorSettings.cardAutoColumnsBreakpoints)
      : 1;
    return max > 0 ? Math.min(auto, max) : auto;
  }, [s.cardGridColumns, s.cardMaxColumns, containerWidth, galleryBehaviorSettings.cardAutoColumnsBreakpoints]);

  /** Max columns for fixed-width (flex) branch — used to compute row maxWidth. */
  const maxCols = useMemo((): number => {
    const cols = s.cardGridColumns;
    const max = s.cardMaxColumns || 0;
    if (cols > 0) return max > 0 ? Math.min(cols, max) : cols;
    if (max > 0) return max;
    return effectiveColumns;
  }, [s.cardGridColumns, s.cardMaxColumns, effectiveColumns]);

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
  const rowsPerPage = s.cardRowsPerPage ?? 3;
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

  // Reset page when breakpoint changes (layout shifts column count)
  useEffect(() => {
    setCurrentPage(0);
  }, [breakpoint]);

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
    const duration = s.cardPageTransitionMs ?? 300;
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      setCurrentPage(page);
      setSlideDirection(null);
      setIsAnimating(false);
    }, duration);
  }, [currentPage, s.cardPageTransitionMs, isAnimating, totalPages]);

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
  const transitionMs = s.cardPageTransitionMs ?? 300;
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
    ? toCssOrNumber(galleryBehaviorSettings.appMaxWidth, galleryBehaviorSettings.appMaxWidthUnit)
    : undefined;
  const containerFluid = galleryBehaviorSettings.appMaxWidth === 0;
  const containerPaddingStyle = { paddingInline: toCssOrNumber(galleryBehaviorSettings.appPadding, galleryBehaviorSettings.appPaddingUnit) };
  const hasFixedCardWidth = s.cardMaxWidth > 0;
  const cardGridJustification = s.cardJustifyContent || 'center';
  const cardGridVerticalAlign = s.cardGalleryVerticalAlign || 'start';
  const cardGridMinHeight = s.cardGalleryMinHeight || 0;
  const cardGridMaxHeight = s.cardGalleryMaxHeight || 0;
  const cardGridOffsetX = s.cardGalleryOffsetX || 0;
  const cardGridOffsetY = s.cardGalleryOffsetY || 0;
  const cardGapHUnit = s.cardGapHUnit ?? 'px';
  const cardGapVUnit = s.cardGapVUnit ?? 'px';
  const responsiveCardWidth = useMemo(() => {
    if (effectiveColumns <= 1) {
      return '100%';
    }

    const totalGap = toCss((effectiveColumns - 1) * s.cardGapH, cardGapHUnit);
    return `calc((100% - ${totalGap}) / ${effectiveColumns})`;
  }, [effectiveColumns, s.cardGapH, cardGapHUnit]);

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
            <Box
              data-testid="card-gallery-grid"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: `${toCss(s.cardGapV, cardGapVUnit)} ${toCss(s.cardGapH, cardGapHUnit)}`,
                justifyContent: cardGridJustification,
                alignContent: cardGridVerticalAlign,
                ...(cardGridMinHeight > 0 ? { minHeight: toCssOrNumber(cardGridMinHeight, s.cardGalleryMinHeightUnit) } : {}),
                ...(cardGridMaxHeight > 0 ? { maxHeight: toCssOrNumber(cardGridMaxHeight, s.cardGalleryMaxHeightUnit), overflow: 'auto' as const } : {}),
                ...(cardGridOffsetX !== 0 || cardGridOffsetY !== 0 ? { transform: `translate(${toCss(cardGridOffsetX, s.cardGalleryOffsetXUnit)}, ${toCss(cardGridOffsetY, s.cardGalleryOffsetYUnit)})` } : {}),
                width: '100%',
                ...(hasFixedCardWidth && s.cardMaxWidthUnit !== '%' ? {
                  maxWidth: `calc(${toCss(maxCols * s.cardMaxWidth, s.cardMaxWidthUnit)} + ${toCss((maxCols - 1) * s.cardGapH, cardGapHUnit)})`,
                  marginInline: 'auto',
                } : {}),
              }}
            >
              {visibleCampaigns.map((campaign) => {
                const sharedProps = {
                  campaign,
                  hasAccess: hasAccess(campaign.id, campaign.visibility),
                  onClick: () => setSelectedCampaign(campaign),
                  settings: s,
                  apiClient: !hasAccess(campaign.id, campaign.visibility) && !isAdmin ? apiClient : undefined,
                };

                if (hasFixedCardWidth) {
                  return (
                    <CampaignCard
                      key={campaign.id}
                      {...sharedProps}
                      maxWidth={s.cardMaxWidth}
                      maxWidthUnit={s.cardMaxWidthUnit}
                    />
                  );
                }

                return (
                  <Box
                    key={campaign.id}
                    style={{
                      flex: `0 0 ${responsiveCardWidth}`,
                      maxWidth: responsiveCardWidth,
                      minWidth: 0,
                    }}
                  >
                    <CampaignCard {...sharedProps} />
                  </Box>
                );
              })}
            </Box>
          </div>

          {/* Overlay arrows for paginated mode */}
          {displayMode === 'paginated' && totalPages > 1 && (
            <OverlayArrows
              onPrev={goPrev}
              onNext={goNext}
              total={totalPages}
              settings={s}
              previousLabel="Previous page"
              nextLabel="Next page"
            />
          )}
        </Box>

        {/* Dot navigator + page indicator for paginated mode */}
        {displayMode === 'paginated' && totalPages > 1 && (
          <Stack align="center" gap={4} mt="sm">
            {s.cardPageDotNav && (
              <DotNavigator
                total={totalPages}
                currentIndex={currentPage}
                onSelect={(page) => goToPage(page)}
                settings={s}
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
            onCampaignsUpdated={onCampaignsUpdated}
            onNotify={onNotify}
            onClose={() => setSelectedCampaign(null)}
          />
        </Suspense>
      )}
    </Box>
  );
}
