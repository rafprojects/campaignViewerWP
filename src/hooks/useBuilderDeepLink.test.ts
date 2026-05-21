/**
 * P30-D — useBuilderDeepLink tests
 *
 * Tests URL read/write behavior without a real browser history stack.
 * We stub `window.location.search` and spy on `history.pushState` /
 * `history.replaceState` to keep tests hermetic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBuilderDeepLink, BUILDER_URL_PARAM } from './useBuilderDeepLink';

const originalSearch = window.location.search;
const originalPathname = window.location.pathname;

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      ...window.location,
      search,
      pathname: originalPathname,
    },
  });
}

describe('useBuilderDeepLink', () => {
  beforeEach(() => {
    // Restore original location and reset spies
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        search: originalSearch,
        pathname: originalPathname,
      },
    });
    vi.restoreAllMocks();
  });

  it('returns null when ?builder param is absent', () => {
    setSearch('');
    const { result } = renderHook(() => useBuilderDeepLink());
    expect(result.current.initialBuilderTemplateId).toBeNull();
  });

  it('returns null when only other params are present', () => {
    setSearch('?page=wpsg-gallery&tab=campaigns');
    const { result } = renderHook(() => useBuilderDeepLink());
    expect(result.current.initialBuilderTemplateId).toBeNull();
  });

  it('reads template ID from ?builder= param', () => {
    setSearch('?page=wpsg-gallery&builder=template-abc');
    const { result } = renderHook(() => useBuilderDeepLink());
    expect(result.current.initialBuilderTemplateId).toBe('template-abc');
  });

  it('reads template ID when builder is the only param', () => {
    setSearch(`?${BUILDER_URL_PARAM}=tpl-123`);
    const { result } = renderHook(() => useBuilderDeepLink());
    expect(result.current.initialBuilderTemplateId).toBe('tpl-123');
  });

  it('pushBuilderUrl calls history.pushState with builder param added', () => {
    setSearch('?page=wpsg-gallery');
    const pushSpy = vi.spyOn(history, 'pushState').mockImplementation(() => {});
    const { result } = renderHook(() => useBuilderDeepLink());

    result.current.pushBuilderUrl('tpl-999');

    expect(pushSpy).toHaveBeenCalledOnce();
    const url = pushSpy.mock.calls[0]![2] as string;
    expect(url).toContain('builder=tpl-999');
    expect(url).toContain('page=wpsg-gallery');
  });

  it('pushBuilderUrl replaces an existing builder param', () => {
    setSearch('?builder=old-id');
    const pushSpy = vi.spyOn(history, 'pushState').mockImplementation(() => {});
    const { result } = renderHook(() => useBuilderDeepLink());

    result.current.pushBuilderUrl('new-id');

    const url = pushSpy.mock.calls[0]![2] as string;
    expect(url).toContain('builder=new-id');
    expect(url).not.toContain('builder=old-id');
  });

  it('clearBuilderUrl calls history.replaceState and removes builder param', () => {
    setSearch('?page=wpsg-gallery&builder=tpl-123');
    const replaceSpy = vi.spyOn(history, 'replaceState').mockImplementation(() => {});
    const { result } = renderHook(() => useBuilderDeepLink());

    result.current.clearBuilderUrl();

    expect(replaceSpy).toHaveBeenCalledOnce();
    const url = replaceSpy.mock.calls[0]![2] as string;
    expect(url).not.toContain('builder=');
    expect(url).toContain('page=wpsg-gallery');
  });

  it('clearBuilderUrl is a no-op when builder param is absent', () => {
    setSearch('?page=wpsg-gallery');
    const replaceSpy = vi.spyOn(history, 'replaceState').mockImplementation(() => {});
    const { result } = renderHook(() => useBuilderDeepLink());

    result.current.clearBuilderUrl();

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('clearBuilderUrl produces a clean URL with no trailing "?"', () => {
    setSearch('?builder=only-param');
    const replaceSpy = vi.spyOn(history, 'replaceState').mockImplementation(() => {});
    const { result } = renderHook(() => useBuilderDeepLink());

    result.current.clearBuilderUrl();

    const url = replaceSpy.mock.calls[0]![2] as string;
    expect(url).not.toMatch(/\?$/);
    expect(url).not.toContain('builder=');
  });

  it('getCurrentBuilderTemplateId reads the live URL (not the initial snapshot)', () => {
    setSearch('?builder=live-id');
    const { result } = renderHook(() => useBuilderDeepLink());
    // Simulate URL change after mount (e.g. programmatic pushState in the component)
    setSearch('?builder=updated-id');
    expect(result.current.getCurrentBuilderTemplateId()).toBe('updated-id');
  });

  it('getCurrentBuilderTemplateId returns null when param is gone', () => {
    setSearch('?builder=tpl');
    const { result } = renderHook(() => useBuilderDeepLink());
    setSearch('');
    expect(result.current.getCurrentBuilderTemplateId()).toBeNull();
  });

  it('provides stable callback references across re-renders', () => {
    setSearch('');
    const { result, rerender } = renderHook(() => useBuilderDeepLink());
    const push1 = result.current.pushBuilderUrl;
    const clear1 = result.current.clearBuilderUrl;
    rerender();
    expect(result.current.pushBuilderUrl).toBe(push1);
    expect(result.current.clearBuilderUrl).toBe(clear1);
  });
});
