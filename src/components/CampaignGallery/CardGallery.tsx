/**
 * P35-C: CardGallery Host Shell
 *
 * Owns: filter tabs, search, access-mode toggle, header, in-context editors,
 * CampaignViewer modal, and the adapter slot decision (host-paginated vs.
 * adapter-paginated).
 *
 * Layout (how cards are arranged) is now fully delegated to the active listing
 * adapter via the GalleryAdapter contract (items + renderItem, P35-A).
 * Pagination state lives in CardGalleryHostPagination (P35-C) for adapters
 * that use `paginationOwnership === 'host'`, and in the adapter itself (e.g.
 * classic carousel) when `paginationOwnership === 'adapter'`.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, Group, Stack, Title, Text, Chip, SegmentedControl, Alert, Box, Center, Loader, TextInput, Switch, Select } from '@mantine/core';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { IconSearch } from '@tabler/icons-react';
import { CampaignCard } from './CampaignCard';
import { CardGalleryHostPagination } from './CardGalleryHostPagination';
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import type { GalleryAdapterProps, ListingItem } from '@/components/Galleries/Adapters/GalleryAdapter';
import { CompactGridGallery } from '@/components/Galleries/Adapters/compact-grid/CompactGridGallery';
import { useTypographyStyle } from '@/hooks/useTypographyStyle';
import { useInContextSave } from '@/hooks/useInContextSave';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { InContextEditor } from '@/components/Common/InContextEditor';
import { TypographyEditor } from '@/components/Common/TypographyEditor';
import { GOOGLE_FONT_NAMES } from '@/data/googleFontNames';
import { notifications } from '@mantine/notifications';
import { loadGoogleFontsFromOverrides } from '@wp-super-gallery/shared-utils';
import { buildGradientCss } from '@wp-super-gallery/shared-utils';
import { getErrorMessage } from '@wp-super-gallery/shared-utils';
import { toCssOrNumber, type CssWidthUnit } from '@wp-super-gallery/shared-utils';
import { resolveFixedCardWidth, resolveListingColumns } from '@/utils/gridLayout';
import { resolveCardBreakpointSettings } from '@/utils/cardConfig';
import { resolveListingAdapterId } from '@/utils/resolveListingAdapterId';
import { adapterOwnsPagination, resolveAdapter } from '@/components/Galleries/Adapters/adapterRegistry';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
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
  spaceId?: number;
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
  spaceId,
}: CardGalleryProps) {
  const { t } = useTranslation('wpsg');
  // ── Modal state ───────────────────────────────────────────────────────────
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  // Keep a ref to the last campaign so CampaignViewer stays mounted during close animation.
  const lastCampaignRef = useRef<Campaign | null>(null);
  if (selectedCampaign) lastCampaignRef.current = selectedCampaign;
  const displayedCampaign = selectedCampaign ?? lastCampaignRef.current;

  // ── Filter / search state ─────────────────────────────────────────────────
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Typography ────────────────────────────────────────────────────────────
  const viewerTitleStyle = useTypographyStyle('viewerTitle', galleryBehaviorSettings);
  const viewerSubtitleStyle = useTypographyStyle('viewerSubtitle', galleryBehaviorSettings);
  const inContextSave = useInContextSave(apiClient, galleryBehaviorSettings, 500, (err) => {
    notifications.show({ color: 'red', message: getErrorMessage(err, t('cardgal_save_error', 'Failed to save settings.')) });
  }, spaceId);

  // Load Google Fonts referenced in typography overrides.
  useEffect(() => {
    loadGoogleFontsFromOverrides(galleryBehaviorSettings.typographyOverrides, GOOGLE_FONT_NAMES);
  }, [galleryBehaviorSettings.typographyOverrides]);

  // ── Container-based breakpoint resolution → resolved card settings ────────
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const { breakpoint, width: containerWidth } = useBreakpoint(gridContainerRef);
  const s = useMemo(
    () => resolveCardBreakpointSettings(galleryBehaviorSettings, breakpoint),
    [galleryBehaviorSettings, breakpoint],
  );

  // ── Effective column count ────────────────────────────────────────────────
  const effectiveColumns = useMemo(
    () => resolveListingColumns(s, containerWidth),
    [s, containerWidth],
  );

  // ── Fixed / responsive card width ─────────────────────────────────────────
  /** Below this resolved pixel width, fixed-width cards fall back to the responsive branch. */
  const MIN_FIXED_CARD_WIDTH_PX = 120;
  const hasFixedCardWidth = s.cardMaxWidth > 0;

  const fixedCardWidth = useMemo<{ value: number; unit: CssWidthUnit } | null>(() => {
    if (!hasFixedCardWidth) return null;
    return resolveFixedCardWidth(
      s.cardMaxWidth,
      s.cardMaxWidthUnit,
      s.cardScale ?? 1,
      containerWidth,
      MIN_FIXED_CARD_WIDTH_PX,
    );
  }, [hasFixedCardWidth, s.cardMaxWidth, s.cardMaxWidthUnit, s.cardScale, containerWidth]);

  // cardGapHUnit is used only for the responsive wrapper, now inside the adapter.
  // effectiveGapH and responsiveCardWidth are computed inside CompactGridGallery
  // listing mode (P35-D) from containerDimensions + settings.

  // ── Listing adapter resolution ─────────────────────────────────────────────
  const listingAdapterId = resolveListingAdapterId(galleryBehaviorSettings, breakpoint);
  const adapterPaginated = adapterOwnsPagination(listingAdapterId);
  // compact-grid is imported directly (non-lazy) so its listing-mode branch renders
  // synchronously — no Suspense suspension, no flicker, and tests stay fast.
  // All other adapters continue through the lazy registry path.
  const AdapterComponent: ComponentType<GalleryAdapterProps> = listingAdapterId === 'compact-grid'
    ? CompactGridGallery
    : resolveAdapter(listingAdapterId);

  // ── Filter / access helpers ────────────────────────────────────────────────
  const companies = useMemo(() => [...new Set(campaigns.map((c) => c.company.name))], [campaigns]);

  const hasAccess = useCallback((campaignId: string, visibility: 'public' | 'private') => {
    return visibility === 'public' || userPermissions.includes(campaignId);
  }, [userPermissions]);

  const filteredCampaigns = useMemo(() => {
    const lowerSearch = searchQuery.toLowerCase().trim();
    return campaigns.filter((campaign) => {
      if (filter === 'accessible' && !hasAccess(campaign.id, campaign.visibility)) return false;
      if (filter !== 'all' && filter !== 'accessible' && campaign.company.name !== filter) return false;
      if (accessMode === 'hide' && filter !== 'accessible' && !hasAccess(campaign.id, campaign.visibility)) return false;
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

  // ── Container sizing ───────────────────────────────────────────────────────
  const containerSize = galleryBehaviorSettings.appMaxWidth > 0
    ? toCssOrNumber(galleryBehaviorSettings.appMaxWidth, galleryBehaviorSettings.appMaxWidthUnit)
    : undefined;
  const containerFluid = galleryBehaviorSettings.appMaxWidth === 0;
  const containerPaddingStyle = { paddingInline: toCssOrNumber(galleryBehaviorSettings.appPadding, galleryBehaviorSettings.appPaddingUnit) };

  // ── Viewer background / header border ─────────────────────────────────────
  const galleryStyle = useMemo<React.CSSProperties | undefined>(() => {
    switch (galleryBehaviorSettings.viewerBgType) {
      case 'transparent': return { background: 'transparent' };
      case 'solid': return { background: galleryBehaviorSettings.viewerBgColor || 'transparent' };
      case 'gradient': return { background: buildGradientCss(galleryBehaviorSettings.viewerBgGradient) || undefined };
      default: return undefined;
    }
  }, [galleryBehaviorSettings.viewerBgType, galleryBehaviorSettings.viewerBgColor, galleryBehaviorSettings.viewerBgGradient]);

  const headerStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (galleryBehaviorSettings.showViewerBorder === false) {
      return { borderBottom: 'none', boxShadow: 'none', backdropFilter: 'none', background: 'transparent' };
    }
    return undefined;
  }, [galleryBehaviorSettings.showViewerBorder]);

  // ── renderItem: host-supplied card renderer ────────────────────────────────
  // Passed to the adapter so it knows how to render each Campaign item.
  const renderItem = useCallback((item: ListingItem, _idx: number): React.ReactNode => {
    const campaign = item as Campaign;
    const access = hasAccess(campaign.id, campaign.visibility);
    const sharedProps = {
      campaign,
      hasAccess: access,
      onClick: () => setSelectedCampaign(campaign),
      settings: s,
      apiClient: !access && !isAdmin ? apiClient : undefined,
    };
    if (fixedCardWidth) {
      return (
        <CampaignCard
          {...sharedProps}
          maxWidth={fixedCardWidth.value}
          maxWidthUnit={fixedCardWidth.unit}
        />
      );
    }
    return <CampaignCard {...sharedProps} />;
  }, [hasAccess, isAdmin, apiClient, s, fixedCardWidth]);

  // ── Adapter slot factory ───────────────────────────────────────────────────
  // Builds the <Adapter> node for a given campaign slice. Called by both the
  // host-paginated and adapter-paginated branches.
  // compact-grid is a direct import (not lazy) so it renders synchronously;
  // other adapters go through the lazy registry and need a Suspense boundary.
  const buildAdapter = useCallback((items: Campaign[]) => {
    const adapterNode = (
      <AdapterComponent
        items={items}
        renderItem={renderItem}
        media={[]}
        settings={s}
        listingMode={{ surface: 'campaign-listing' }}
        containerDimensions={{ width: containerWidth, height: 0 }}
      />
    );
    if (listingAdapterId === 'compact-grid') return adapterNode;
    return <Suspense fallback={<Center><Loader /></Center>}>{adapterNode}</Suspense>;
  }, [AdapterComponent, listingAdapterId, renderItem, s, containerWidth]);

  // ── Empty-state node ───────────────────────────────────────────────────────
  const emptyNode = filteredCampaigns.length === 0 ? (
    <Center py={{ base: 60, md: 80 }} role="status" aria-live="polite">
      <Stack align="center" gap="md">
        <Text size="lg" c="dimmed" ta="center">
          {searchQuery.trim()
            ? t('cardgal_empty_search', 'No campaigns match your search.')
            : !isAuthenticated && campaigns.length === 0
              ? t('cardgal_empty_signin', 'Sign in to view campaigns.')
              : filter === 'accessible'
                ? t('cardgal_empty_accessible', 'No accessible campaigns yet.')
                : accessMode === 'hide'
                  ? t('cardgal_empty_hide', 'No accessible campaigns found. Switch to Lock mode to view locked cards.')
                  : t('cardgal_empty_filter', 'No campaigns found matching your filter.')}
        </Text>
      </Stack>
    </Center>
  ) : null;

  // ── resetKey for CardGalleryHostPagination ────────────────────────────────
  const resetKey = `${filter}__${searchQuery}__${accessMode}__${s.cardDisplayMode ?? 'load-more'}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box {...(styles.gallery ? { className: styles.gallery } : {})} style={galleryStyle}>
      {/* Header */}
      <Box component="header" {...(styles.header ? { className: styles.header } : {})} style={{ ...headerStyle, position: 'relative' }}>
        <InContextEditor
          visible={!!isAdmin && galleryBehaviorSettings.showInContextEditors}
          position="top-right"
        >
          <Stack gap="sm">
            <Text fw={600} size="xs">{t('cardgal_hdr_settings', 'Viewer Header Settings')}</Text>
            <Switch
              label={t('cardgal_show_title', 'Show Title')}
              checked={galleryBehaviorSettings.showGalleryTitle}
              onChange={(e) => inContextSave('showGalleryTitle', e.currentTarget.checked)}
              size="xs"
            />
            <Switch
              label={t('cardgal_show_subtitle', 'Show Subtitle')}
              checked={galleryBehaviorSettings.showGallerySubtitle}
              onChange={(e) => inContextSave('showGallerySubtitle', e.currentTarget.checked)}
              size="xs"
            />
            <TextInput
              label={t('cardgal_title_text', 'Title Text')}
              value={galleryBehaviorSettings.galleryTitleText}
              onChange={(e) => inContextSave('galleryTitleText', e.currentTarget.value)}
              size="xs"
            />
            <TextInput
              label={t('cardgal_subtitle_text', 'Subtitle Text')}
              value={galleryBehaviorSettings.gallerySubtitleText}
              onChange={(e) => inContextSave('gallerySubtitleText', e.currentTarget.value)}
              size="xs"
            />
            <Select
              label={t('cardgal_bg_type', 'Background Type')}
              value={galleryBehaviorSettings.viewerBgType}
              onChange={(v) => inContextSave('viewerBgType', v)}
              data={[
                { value: 'theme', label: t('cardgal_bg_theme', 'Theme') },
                { value: 'transparent', label: t('cardgal_bg_transparent', 'Transparent') },
                { value: 'solid', label: t('cardgal_bg_solid', 'Solid Color') },
                { value: 'gradient', label: t('cardgal_bg_gradient', 'Gradient') },
              ]}
              size="xs"
            />
            {galleryBehaviorSettings.viewerBgType === 'solid' && (
              <ColorInput
                label={t('cardgal_bg_color', 'Background Color')}
                value={galleryBehaviorSettings.viewerBgColor}
                onChange={(v) => inContextSave('viewerBgColor', v)}
                size="xs"
              />
            )}
            <Text fw={500} size="xs" mt="xs">{t('cardgal_title_typo', 'Title Typography')}</Text>
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
        <Container {...getWpsgDebugProps('CardGallery', 'header-shell')} {...(containerSize !== undefined ? { size: containerSize } : {})} fluid={containerFluid} py={{ base: 'sm', md: 'md' }} style={containerPaddingStyle}>
          <Stack {...getWpsgDebugProps('CardGallery', 'header-stack')} gap="lg">
            {/* Title and subtitle */}
            {(galleryBehaviorSettings.showGalleryTitle || galleryBehaviorSettings.showGallerySubtitle || (isAdmin && galleryBehaviorSettings.showAccessMode)) && (
              <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
                {(galleryBehaviorSettings.showGalleryTitle || galleryBehaviorSettings.showGallerySubtitle) && (
                  <Stack gap={0}>
                    {galleryBehaviorSettings.showGalleryTitle && <Title order={1} size="h3" style={viewerTitleStyle}>{galleryBehaviorSettings.galleryTitleText || t('cardgal_gallery_fallback', 'Gallery')}</Title>}
                    {galleryBehaviorSettings.showGallerySubtitle && galleryBehaviorSettings.gallerySubtitleText && <Text c="dimmed" size="sm" style={viewerSubtitleStyle}>{galleryBehaviorSettings.gallerySubtitleText}</Text>}
                  </Stack>
                )}
                {isAdmin && galleryBehaviorSettings.showAccessMode && (
                  <Group gap="sm" align="center">
                    <Text size="xs" fw={600} tt="uppercase" c="dimmed">{t('cardgal_access_mode', 'Access mode')}</Text>
                    <SegmentedControl
                      value={accessMode}
                      onChange={(v) => onAccessModeChange?.(v as 'lock' | 'hide')}
                      data={[
                        { label: t('cardgal_lock', 'Lock'), value: 'lock' },
                        { label: t('cardgal_hide', 'Hide'), value: 'hide' },
                      ]}
                      size="xs"
                      aria-label={t('cardgal_access_mode', 'Access mode')}
                    />
                  </Group>
                )}
              </Group>
            )}

            {/* Filter tabs */}
            {(galleryBehaviorSettings.showFilterTabs || galleryBehaviorSettings.showSearchBox) && (
              <Group justify="space-between" align="flex-end" wrap="wrap" gap="md" style={{ overflow: 'hidden' }}>
                {galleryBehaviorSettings.showFilterTabs && (
                  // P60-D: a single-select filter, not tab navigation — Chip.Group
                  // avoids the invalid tab→panel `aria-controls` that Mantine Tabs
                  // emit here, and matches the admin-panel filter pattern.
                  <Chip.Group multiple={false} value={filter} onChange={(v) => setFilter((v as string) || 'all')}>
                    <Group gap="xs" wrap="wrap" role="group" aria-label={t('cardgal_filters_aria', 'Campaign filters')} style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <Chip value="all" variant="light" size="sm">{t('cardgal_filter_all', 'All')}</Chip>
                      <Chip value="accessible" variant="light" size="sm">{t('cardgal_filter_my_access', 'My Access')}</Chip>
                      {companies.map((company) => (
                        <Chip key={company} value={company} variant="light" size="sm">
                          {company}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                )}
                {galleryBehaviorSettings.showSearchBox && (
                  <TextInput
                    placeholder={t('cardgal_search_ph', 'Search campaigns...')}
                    leftSection={<IconSearch size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    style={{ minWidth: 'min(200px, 100%)', maxWidth: 280 }}
                    size="sm"
                    aria-label={t('cardgal_search_aria', 'Search campaigns by title, description, or tags')}
                  />
                )}
              </Group>
            )}

            {/* Hidden notice */}
            {showHiddenNotice && (
              <Alert color="yellow" title={t('cardgal_access_active_title', 'Access mode active')} role="status" aria-live="polite">
                {t('cardgal_hidden_notice', '{{count}} campaign hidden by access mode.', { count: hiddenCount })}
              </Alert>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Gallery main area */}
      <Container {...getWpsgDebugProps('CardGallery')} {...(containerSize !== undefined ? { size: containerSize } : {})} fluid={containerFluid} component="main" py={{ base: 'lg', md: 'xl' }} style={containerPaddingStyle}>
        {adapterPaginated ? (
          // Adapter-owned pagination (e.g. classic carousel): host hides all
          // display-mode controls; the adapter manages its own slide state.
          <>
            <Box
              {...getWpsgDebugProps('CardGallery', 'adapter-shell')}
              ref={gridContainerRef}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {buildAdapter(filteredCampaigns)}
            </Box>
            {emptyNode}
          </>
        ) : (
          // Host-owned pagination: CardGalleryHostPagination manages slicing,
          // animation, dot nav, overlay arrows, load-more, and keyboard nav.
          <CardGalleryHostPagination
            filteredCampaigns={filteredCampaigns}
            settings={s}
            effectiveColumns={effectiveColumns}
            breakpoint={breakpoint}
            gridContainerRef={gridContainerRef}
            resetKey={resetKey}
            renderAdapter={buildAdapter}
            emptyNode={emptyNode}
          />
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
            {...(spaceId !== undefined && { spaceId })}
          />
        </Suspense>
      )}
    </Box>
  );
}

setWpsgDebugDisplayName(CardGallery, 'CardGallery');
