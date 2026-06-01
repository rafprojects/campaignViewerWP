import { describe, expect, it } from 'vitest';
import {
  buildMediaGridShellVars,
  mapToMediaGridBreakpoint,
  mediaGridRowMaxWidthCss,
  resolveMediaGridColumns,
  resolveMediaGridPresetKey,
  resolveResponsiveMediaGridSpan,
} from './mediaTabLayout';

describe('mediaTabLayout', () => {
  it('uses compact as the active preset whenever compact view is selected', () => {
    expect(resolveMediaGridPresetKey('compact', 'large')).toBe('compact');
    expect(resolveMediaGridPresetKey('grid', 'small')).toBe('small');
  });

  it('inherits responsive spans through the base/sm/md/lg chain', () => {
    const spans = { base: 6, sm: 4, md: 3 };

    expect(resolveResponsiveMediaGridSpan(spans, 'base')).toBe(6);
    expect(resolveResponsiveMediaGridSpan(spans, 'sm')).toBe(4);
    expect(resolveResponsiveMediaGridSpan(spans, 'md')).toBe(3);
    expect(resolveResponsiveMediaGridSpan(spans, 'lg')).toBe(3);
  });

  it('derives column counts from 12-column Grid spans', () => {
    expect(resolveMediaGridColumns(12)).toBe(1);
    expect(resolveMediaGridColumns(6)).toBe(2);
    expect(resolveMediaGridColumns(4)).toBe(3);
    expect(resolveMediaGridColumns(3)).toBe(4);
    expect(resolveMediaGridColumns(2)).toBe(6);
  });

  it('builds row max-width strings from card width, columns, and gutter', () => {
    expect(mediaGridRowMaxWidthCss(224, 1, 16)).toBe('224px');
    expect(mediaGridRowMaxWidthCss(160, 4, 16)).toBe('688px');
  });

  it('computes per-breakpoint shell vars for bounded grid widths', () => {
    const vars = buildMediaGridShellVars({
      span: { base: 6, sm: 4, md: 3, lg: 3 },
      height: 110,
      maxWidth: 160,
    });

    expect(vars['--wpsg-media-grid-max-base']).toBe('336px');
    expect(vars['--wpsg-media-grid-max-sm']).toBe('512px');
    expect(vars['--wpsg-media-grid-max-md']).toBe('688px');
    expect(vars['--wpsg-media-grid-max-lg']).toBe('688px');
  });

  it('keeps compact view bounded at higher column counts', () => {
    const vars = buildMediaGridShellVars({
      span: { base: 6, sm: 3, md: 2, lg: 2 },
      height: 72,
      maxWidth: 112,
    });

    expect(vars['--wpsg-media-grid-max-base']).toBe('240px');
    expect(vars['--wpsg-media-grid-max-sm']).toBe('496px');
    expect(vars['--wpsg-media-grid-max-md']).toBe('752px');
    expect(vars['--wpsg-media-grid-max-lg']).toBe('752px');
  });

  describe('mapToMediaGridBreakpoint', () => {
    it('maps mobile to base', () => {
      expect(mapToMediaGridBreakpoint('mobile')).toBe('base');
    });

    it('maps tablet to md', () => {
      expect(mapToMediaGridBreakpoint('tablet')).toBe('md');
    });

    it('maps desktop to lg', () => {
      expect(mapToMediaGridBreakpoint('desktop')).toBe('lg');
    });
  });
});