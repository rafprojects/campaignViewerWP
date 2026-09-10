/**
 * P77-B: the Portal target must survive Mantine's theme merge as the same
 * DOM element. `mergeMantineTheme` deep-merges plain objects, and an
 * HTMLElement is `typeof 'object'`, so a target present on both sides of a
 * merge would be spread into a plain object and Mantine would then call
 * `createPortal` on something that is not a node. `withPortalTarget` avoids
 * that by only ever adding the key to a theme that does not carry it.
 */

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, mergeMantineTheme, mergeThemeOverrides } from '@mantine/core';
import { resolvePortalMode, withPortalTarget, type PortalTarget } from '../portalTarget';

describe('withPortalTarget', () => {
  it('keeps the element identity through Mantine\'s theme merge', () => {
    const target = document.createElement('div');
    const portal: PortalTarget = { mode: 'overlay-root', target };
    const theme = withPortalTarget(mergeThemeOverrides({ primaryColor: 'blue' }, {}), portal);
    const merged = mergeMantineTheme(DEFAULT_THEME, theme);
    expect(merged.components.Portal?.defaultProps?.target).toBe(target);
  });

  it('leaves the theme untouched in document mode', () => {
    const theme = { primaryColor: 'blue' };
    expect(withPortalTarget(theme, { mode: 'document', target: null })).toBe(theme);
  });
});

describe('resolvePortalMode', () => {
  it('reads the window flag, then the query, and falls back to document', () => {
    const g = window as Window & { __MULLION_PORTAL_MODE__?: string };
    const history = vi.spyOn(window, 'location', 'get');
    history.mockReturnValue({ search: '?portal=shadow' } as Location);
    expect(resolvePortalMode()).toBe('shadow');
    g.__MULLION_PORTAL_MODE__ = 'overlay-root';
    expect(resolvePortalMode()).toBe('overlay-root');
    g.__MULLION_PORTAL_MODE__ = 'nonsense';
    expect(resolvePortalMode()).toBe('document');
    delete g.__MULLION_PORTAL_MODE__;
    history.mockReturnValue({ search: '' } as Location);
    expect(resolvePortalMode()).toBe('document');
    history.mockRestore();
  });
});
