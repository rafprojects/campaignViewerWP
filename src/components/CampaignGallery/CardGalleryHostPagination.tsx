/**
 * P35-C: CardGallery Host Pagination Module
 *
 * Extracted from CardGallery.tsx to give the host shell a clean separation:
 *   • Host shell (CardGallery.tsx)   — filter, search, access mode, header, modal.
 *   • Host pagination (this file)    — display-mode state, slide animation,
 *                                      DotNavigator, OverlayArrows, keyboard nav.
 *   • Adapter slot                   — passed via `renderAdapter` render prop.
 *
 * Mounted only when the active listing adapter has `paginationOwnership === 'host'`
 * (i.e. compact-grid, masonry, justified).  When the classic carousel adapter is
 * active the host hides this component and passes all campaigns straight to the
 * adapter.
 */
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Center, Stack, Text } from '@mantine/core';
import { OverlayArrows } from '@/components/Galleries/Shared/OverlayArrows';
import { DotNavigator } from '@/components/Galleries/Shared/DotNavigator';
import { Box } from '@mantine/core';
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { getWpsgDebugProps } from '@/utils/wpsgDebug';

const LOAD_MORE_SIZE = 12;

interface CardGalleryHostPaginationProps {
  filteredCampaigns: Campaign[];
  /** Breakpoint-resolved card settings. */
  settings: GalleryBehaviorSettings;
  /** Effective column count (computed from resolved settings + container width). */
  effectiveColumns: number;
  /** Active breakpoint — resets the current page when it changes. */
  breakpoint: Breakpoint;
  /**
   * Ref attached to the outer pagination-shell Box.
   * Created in CardGallery and passed here so `useBreakpoint` in CardGallery
   * keeps measuring the correct DOM element.
   */
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Key that changes whenever filter / search / access mode changes.
   * Triggers a pagination state reset (page 0, visibleCount reset).
   */
  resetKey: string;
  /** Render the listing adapter with a given campaign slice. */
  renderAdapter: (visibleCampaigns: Campaign[]) => ReactNode;
  /** Rendered below the adapter when filteredCampaigns is empty. */
  emptyNode: ReactNode;
}

export function CardGalleryHostPagination({
  filteredCampaigns,
  settings,
  effectiveColumns,
  breakpoint,
  gridContainerRef,
  resetKey,
  renderAdapter,
  emptyNode,
}: CardGalleryHostPaginationProps) {
  const displayMode = settings.cardDisplayMode ?? 'load-more';

  // ── Pagination state ─────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(LOAD_MORE_SIZE);
  const [currentPage, setCurrentPage] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  // ── Derived pagination values ─────────────────────────────────────────────
  const rowsPerPage = settings.cardRowsPerPage ?? 3;
  const cardsPerPage = rowsPerPage * effectiveColumns;
  const totalPages = displayMode === 'paginated' && cardsPerPage > 0
    ? Math.ceil(filteredCampaigns.length / cardsPerPage)
    : 1;

  const visibleCampaigns = (() => {
    if (displayMode === 'show-all') return filteredCampaigns;
    if (displayMode === 'paginated') {
      const start = currentPage * cardsPerPage;
      return filteredCampaigns.slice(start, start + cardsPerPage);
    }
    // load-more
    return filteredCampaigns.slice(0, visibleCount);
  })();

  const hasMore = displayMode === 'load-more' && visibleCount < filteredCampaigns.length;

  // ── Page navigation ───────────────────────────────────────────────────────
  const goToPage = useCallback((page: number) => {
    if (isAnimating || page < 0 || page >= totalPages || page === currentPage) return;
    const dir = page > currentPage ? 'left' : 'right';
    setSlideDirection(dir);
    setIsAnimating(true);
    const el = slideRef.current;
    if (!el) {
      setCurrentPage(page);
      setSlideDirection(null);
      setIsAnimating(false);
      return;
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== 'transform') return;
      el.removeEventListener('transitionend', onEnd);
      setCurrentPage(page);
      setSlideDirection(null);
      setIsAnimating(false);
    };
    el.addEventListener('transitionend', onEnd);
    const dur = window.getComputedStyle(el).transitionDuration;
    if (!dur || dur === '0s' || dur === '') {
      el.removeEventListener('transitionend', onEnd);
      setCurrentPage(page);
      setSlideDirection(null);
      setIsAnimating(false);
    }
  }, [currentPage, isAnimating, totalPages]);

  const goPrev = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const goNext = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Reset state when the upstream filter/search/accessMode/displayMode changes.
  useEffect(() => {
    setVisibleCount(LOAD_MORE_SIZE);
    setCurrentPage(0);
    setSlideDirection(null);
    setIsAnimating(false);
   
  }, [resetKey]);

  // Reset page when breakpoint changes (column count shifts).
  useEffect(() => {
    setCurrentPage(0);
  }, [breakpoint]);

  // Clamp currentPage if totalPages shrinks (resize / filter change).
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [currentPage, totalPages]);

  // Keyboard navigation — only bind when in paginated mode with multiple pages.
  useEffect(() => {
    if (displayMode !== 'paginated' || totalPages <= 1) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    const container = gridContainerRef.current;
    container?.addEventListener('keydown', handleKey);
    return () => container?.removeEventListener('keydown', handleKey);
  }, [displayMode, totalPages, goPrev, goNext, gridContainerRef]);

  // ── Slide animation styles ─────────────────────────────────────────────────
  const transitionMs = settings.cardPageTransitionMs ?? 300;
  const slideStyle: React.CSSProperties = displayMode === 'paginated' ? {
    transform: slideDirection === 'left'
      ? 'translateX(-100%)'
      : slideDirection === 'right'
        ? 'translateX(100%)'
        : 'translateX(0)',
    transition: slideDirection ? `transform ${transitionMs}ms ease` : 'none',
    opacity: slideDirection ? (settings.cardPageTransitionOpacity ?? 0.3) : 1,
  } : {};

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Pagination shell — relative container for overlay arrows; holds keyboard focus. */}
      <Box
        {...getWpsgDebugProps('CardGallery', 'pagination-shell')}
        ref={gridContainerRef}
        style={{ position: 'relative', overflow: 'hidden' }}
        tabIndex={displayMode === 'paginated' ? 0 : undefined}
        aria-label={displayMode === 'paginated' ? `Card gallery page ${currentPage + 1} of ${totalPages}` : undefined}
      >
        <div ref={slideRef} style={slideStyle}>
          {renderAdapter(visibleCampaigns)}
        </div>

        {/* Overlay arrows for paginated mode */}
        {displayMode === 'paginated' && totalPages > 1 && (
          <OverlayArrows
            onPrev={goPrev}
            onNext={goNext}
            total={totalPages}
            settings={settings}
            previousLabel="Previous page"
            nextLabel="Next page"
          />
        )}
      </Box>

      {/* Dot navigator + page indicator for paginated mode */}
      {displayMode === 'paginated' && totalPages > 1 && (
        <Stack align="center" gap={4} mt="sm">
          {settings.cardPageDotNav && (
            <DotNavigator
              total={totalPages}
              currentIndex={currentPage}
              onSelect={(page) => goToPage(page)}
              settings={settings}
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

      {emptyNode}
    </>
  );
}
