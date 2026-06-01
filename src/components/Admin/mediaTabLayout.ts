import type { CSSProperties } from 'react';
import type { Breakpoint } from '@/hooks/useBreakpoint';

export type MediaGridBreakpoint = 'base' | 'sm' | 'md' | 'lg';
export type MediaGridPresetKey = 'compact' | 'small' | 'medium' | 'large';
export type MediaTabViewMode = 'grid' | 'list' | 'compact';
export type MediaTabCardSize = 'small' | 'medium' | 'large';

export interface ResponsiveMediaGridSpan {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
}

export interface MediaGridPreset {
  span: ResponsiveMediaGridSpan;
  height: number;
  maxWidth: number;
}

export type MediaGridSizeConfig = Record<MediaGridPresetKey, MediaGridPreset>;

export type MediaGridShellVars = CSSProperties & {
  '--wpsg-media-grid-max-base'?: string;
  '--wpsg-media-grid-max-sm'?: string;
  '--wpsg-media-grid-max-md'?: string;
  '--wpsg-media-grid-max-lg'?: string;
};

export const MEDIA_GRID_TOTAL_COLUMNS = 12;
export const MEDIA_GRID_GUTTER_PX = 16;
export const MEDIA_GRID_MAX_WIDTHS: Record<MediaGridPresetKey, number> = {
  compact: 112,
  small: 160,
  medium: 224,
  large: 320,
};

const MEDIA_GRID_BREAKPOINTS: MediaGridBreakpoint[] = ['base', 'sm', 'md', 'lg'];

export function resolveMediaGridPresetKey(
  viewMode: MediaTabViewMode,
  cardSize: MediaTabCardSize,
): MediaGridPresetKey {
  return viewMode === 'compact' ? 'compact' : cardSize;
}

export function resolveResponsiveMediaGridSpan(
  spans: ResponsiveMediaGridSpan,
  breakpoint: MediaGridBreakpoint,
): number {
  if (breakpoint === 'lg') {
    return spans.lg ?? spans.md ?? spans.sm ?? spans.base;
  }

  if (breakpoint === 'md') {
    return spans.md ?? spans.sm ?? spans.base;
  }

  if (breakpoint === 'sm') {
    return spans.sm ?? spans.base;
  }

  return spans.base;
}

export function resolveMediaGridColumns(
  span: number,
  totalColumns: number = MEDIA_GRID_TOTAL_COLUMNS,
): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  return Math.max(1, Math.floor(totalColumns / span));
}

export function mediaGridRowMaxWidthCss(
  cardMaxWidthPx: number,
  columns: number,
  gutterPx: number = MEDIA_GRID_GUTTER_PX,
): string {
  const safeColumns = Number.isFinite(columns) && columns > 0 ? Math.floor(columns) : 1;
  if (safeColumns <= 1) return `${cardMaxWidthPx}px`;
  return `${cardMaxWidthPx * safeColumns + gutterPx * (safeColumns - 1)}px`;
}

export function buildMediaGridShellVars(
  preset: MediaGridPreset,
  gutterPx: number = MEDIA_GRID_GUTTER_PX,
): MediaGridShellVars {
  const vars: MediaGridShellVars = {};

  for (const breakpoint of MEDIA_GRID_BREAKPOINTS) {
    const span = resolveResponsiveMediaGridSpan(preset.span, breakpoint);
    const columns = resolveMediaGridColumns(span);
    vars[`--wpsg-media-grid-max-${breakpoint}`] = mediaGridRowMaxWidthCss(preset.maxWidth, columns, gutterPx);
  }

  return vars;
}

export function mapToMediaGridBreakpoint(bp: Breakpoint): MediaGridBreakpoint {
  if (bp === 'mobile') return 'base';
  if (bp === 'tablet') return 'md';
  return 'lg';
}